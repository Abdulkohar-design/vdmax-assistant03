document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const imageInput = document.getElementById('image-input');
    const uploadButton = document.getElementById('upload-button');
    const sendButton = document.getElementById('send-button');
    const chatWindow = document.getElementById('chat-window');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // --- FITUR BARU: Kirim dengan Enter ---
    messageInput.addEventListener('keydown', (event) => {
        // Jika Enter ditekan TANPA Shift, kirim pesan
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Mencegah baris baru
            sendButton.click(); // Memicu klik pada tombol kirim
        }
    });
    
    // Memicu klik pada input file yang tersembunyi
    uploadButton.addEventListener('click', () => imageInput.click());

    // --- FITUR BARU: Tampilkan Preview Gambar ---
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            // Tampilkan preview
            const previewWrapper = document.createElement('div');
            previewWrapper.classList.add('image-preview-wrapper');

            const thumbnail = document.createElement('img');
            thumbnail.src = URL.createObjectURL(file);
            thumbnail.classList.add('image-preview-thumbnail');

            const removeButton = document.createElement('button');
            removeButton.classList.add('remove-preview-button');
            removeButton.innerHTML = '&times;';
            removeButton.title = 'Hapus Gambar';
            removeButton.onclick = () => {
                imageInput.value = ''; // Hapus file dari input
                imagePreviewContainer.innerHTML = ''; // Hapus preview dari DOM
            };

            previewWrapper.appendChild(thumbnail);
            previewWrapper.appendChild(removeButton);
            imagePreviewContainer.innerHTML = ''; // Kosongkan dulu
            imagePreviewContainer.appendChild(previewWrapper);
        }
    });

    // Logika pengiriman form yang sudah ada
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const prompt = messageInput.value.trim();
        const imageFile = imageInput.files[0];

        if (!prompt && !imageFile) return;

        displayUserMessage(prompt, imageFile);

        const aiMessageElement = createMessageElement('ai');
        const aiContentElement = aiMessageElement.querySelector('.message-content');
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        if (imageFile) formData.append('image', imageFile);

        // Reset form dan preview SEGERA setelah data dikirim
        chatForm.reset();
        messageInput.style.height = 'auto';
        imagePreviewContainer.innerHTML = '';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                fullResponse += decoder.decode(value, { stream: true });
                if (fullResponse.startsWith('*') && fullResponse.endsWith('*\n\n')) {
                    aiMessageElement.classList.add('status-message');
                    aiContentElement.innerHTML = fullResponse.substring(1, fullResponse.length - 3);
                } else {
                    aiMessageElement.classList.remove('status-message');
                    aiContentElement.innerHTML = marked.parse(fullResponse);
                }
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        } catch (error) {
            aiContentElement.innerHTML = `<p>Maaf, terjadi kesalahan. Coba lagi nanti.</p><p><small>${error.message}</small></p>`;
            console.error('Error:', error);
        }
    });

    function displayUserMessage(prompt, imageFile) {
        const userMessageElement = createMessageElement('user');
        const contentElement = userMessageElement.querySelector('.message-content');
        let contentHTML = '';
        if (prompt) contentHTML += `<p>${prompt.replace(/\n/g, '<br>')}</p>`; // ubah newline jadi <br>
        if (imageFile) contentHTML += `<img src="${URL.createObjectURL(imageFile)}" alt="Uploaded Image" class="uploaded-image">`;
        contentElement.innerHTML = contentHTML;
    }

    function createMessageElement(role) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', `${role}-message`);
        const avatar = document.createElement('div');
        avatar.classList.add('avatar', `${role}-avatar`);
        avatar.textContent = role === 'ai' ? 'AI' : 'U';
        const content = document.createElement('div');
        content.classList.add('message-content');
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(content);
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return messageWrapper;
    }

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
    });
});