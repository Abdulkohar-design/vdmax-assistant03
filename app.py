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

def get_task_type(prompt: str, has_image: bool) -> str:
    """Menggunakan model ringan sebagai router untuk mengklasifikasikan tugas."""
    if has_image:
        return "image_analysis"
    
    system_prompt = """
        You are a task classification expert. Analyze the user's prompt to determine the task type.
        Possible types are: 'coding' or 'general_chat'.
        Respond ONLY with a JSON object like {"task": "type"}.
        - If the user asks to write, fix, explain, or refactor code, classify as 'coding'.
        - Otherwise, classify as 'general_chat'.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0,
            response_format={"type": "json_object"}
        )
        task_data = json.loads(response.choices[0].message.content)
        return task_data.get("task", "general_chat")
    except Exception:
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
    """Fungsi streaming dengan pemetaan model dan prompt yang benar."""
    model_to_use = ""
    status_message = ""
    content_parts = []
    
    if task_type == 'image_analysis':
        model_to_use = "gpt-4o"
        status_message = "Menganalisis gambar dengan Ahli Vision (gpt-4o)..."
        
        user_focus_instruction = f"Jika pengguna memberikan permintaan spesifik, fokuskan deskripsi Anda pada hal tersebut. Permintaan pengguna: '{prompt}'" if prompt else ""

        narrative_analysis_prompt = f"""
        **Perintah Sistem:** Anda adalah seorang direktur kreatif dan ahli konsep seni. Tugas Anda adalah menganalisis gambar yang diberikan dan menyatukan semua temuan Anda menjadi **satu paragraf deskriptif yang kaya dan menyatu**.

        Jangan gunakan daftar atau poin-per-poin. Tulis jawaban Anda sebagai sebuah narasi yang mengalir.

        Pastikan paragraf Anda mencakup elemen-elemen berikut secara mulus:
        - **Subjek utama**, **pose**, dan **aksinya**.
        - Deskripsi detail **pakaian** dan **aksesori**.
        - **Latar belakang**, **lingkungan**, dan **lokasi**.
        - **Suasana (mood)** dan **atmosfer** keseluruhan.
        - **Gaya visual** (misalnya: photorealistic, sinematik, lukisan cat minyak, anime, dll.).
        - Detail teknis seperti **pencahayaan**, **komposisi**, dan **sudut pandang kamera**.

        {user_focus_instruction}

        Sekarang, analisis gambar tersebut dan hasilkan paragraf deskriptifnya.
        """
        content_parts.append({"type": "text", "text": narrative_analysis_prompt})

    elif task_type == 'coding':
        model_to_use = "gpt-4.1"
        status_message = "Mendelegasikan ke Ahli Coding (gpt-4.1)..."
        content_parts.append({"type": "text", "text": prompt})
    else: # general_chat
        model_to_use = "gpt-4o-mini"
        status_message = "Menyiapkan jawaban (gpt-4o-mini)..."
        content_parts.append({"type": "text", "text": prompt})

    if base64_image and mime_type:
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}
        })
    
    yield f"*{status_message}*\n\n"
    
    messages = [{"role": "user", "content": content_parts}]

    try:
        print(f"▶️ Memanggil model spesialis: {model_to_use}")
        # Panggil API tanpa parameter 'temperature' untuk memastikan kompatibilitas
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
