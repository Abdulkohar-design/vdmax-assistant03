import os
import base64
import mimetypes
import json
from flask import Flask, render_template, request, Response
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Inisialisasi client OpenAI dengan base URL dan API Key Anda
client = OpenAI(
    api_key=os.getenv("SUMOPOD_API_KEY"),
    base_url="https://ai.sumopod.com/v1"
)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    """Memeriksa apakah ekstensi file diizinkan."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- ROUTER DIUBAH UNTUK MENGGUNAKAN MODEL 'NANO' & TANPA IMAGE GENERATION ---
def get_task_type(prompt: str, has_image: bool) -> str:
    """
    Menggunakan gpt-4.1-nano sebagai router super cepat untuk klasifikasi.
    """
    if has_image:
        return "image_analysis"

    # Sistem prompt disederhanakan, tanpa 'image_generation'
    system_prompt = """
        You are a task classification expert. Analyze the user's prompt to determine the task type.
        Possible types are: 'coding' or 'general_chat'.
        Respond ONLY with a JSON object like {"task": "type"}.
        - If the user asks to write, fix, explain, or refactor code in any programming language, classify it as 'coding'.
        - Otherwise, classify it as 'general_chat'.
    """
    try:
        print("🤖 Router (gpt-4.1-nano) sedang menentukan jenis tugas...")
        response = client.chat.completions.create(
            model="gpt-4.1-nano", # Menggunakan model paling ringan untuk router
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0,
            response_format={"type": "json_object"}
        )
        task_data = json.loads(response.choices[0].message.content)
        task = task_data.get("task", "general_chat")
        print(f"✅ Tugas terdeteksi: {task}")
        return task
    except Exception as e:
        print(f"⚠️ Gagal menentukan tugas, menggunakan default. Error: {e}")
        return "general_chat"

@app.route('/')
def index():
    """Menampilkan halaman utama."""
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """Menangani permintaan utama dari pengguna."""
    prompt = request.form.get('prompt', '')
    image_file = request.files.get('image')
    
    base64_image = None
    mime_type = None

    if image_file and allowed_file(image_file.filename):
        try:
            image_bytes = image_file.read()
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            mime_type = mimetypes.guess_type(image_file.filename)[0] or 'image/jpeg'
        except Exception as e:
            return Response(f"Error memproses gambar: {e}", status=500)
    elif image_file:
        return Response("Tipe file gambar tidak didukung.", status=400)

    task_type = get_task_type(prompt, has_image=(base64_image is not None))
    
    return Response(generate(prompt, task_type, base64_image, mime_type), mimetype='text/plain')

def generate(prompt, task_type, base64_image, mime_type):
    """
    Fungsi streaming dengan pemetaan model yang baru.
    """
    model_to_use = ""
    status_message = ""

    # --- PEMETAAN MODEL BARU SESUAI PERMINTAAN ANDA ---
    if task_type == 'coding':
        model_to_use = "gpt-4.1"
        status_message = "Mendelegasikan ke Ahli Coding (gpt-4.1)..."
    elif task_type == 'image_analysis':
        model_to_use = "gpt-4o"
        status_message = "Menganalisis gambar dengan Ahli Vision (gpt-4o)..."
    else: # general_chat
        model_to_use = "gpt-4o-mini"
        status_message = "Menyiapkan jawaban (gpt-4o-mini)..."

    yield f"*{status_message}*\n\n"

    # Menyiapkan payload untuk dikirim ke API
    content_parts = []
    if prompt:
        content_parts.append({"type": "text", "text": prompt})
    if base64_image and mime_type:
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}
        })
    
    messages = [{"role": "user", "content": content_parts}]

    # Memanggil API dengan model yang sudah dipilih
    try:
        print(f"▶️ Memanggil model spesialis: {model_to_use}")
        stream = client.chat.completions.create(
            model=model_to_use, messages=messages, stream=True
        )
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content
    except Exception as e:
        yield f"\n\nTerjadi error saat menghubungi AI: {str(e)}"

if __name__ == '__main__':
    app.run(debug=True, port=5000)