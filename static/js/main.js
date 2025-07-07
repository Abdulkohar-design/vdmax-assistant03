document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const imageInput = document.getElementById('image-input');
    const uploadButton = document.getElementById('upload-button');
    const sendButton = document.getElementById('send-button');
    const chatWindow = document.getElementById('chat-window');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // Kirim dengan Enter (Shift+Enter untuk baris baru)
    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendButton.click();
        }
    });
    
    uploadButton.addEventListener('click', () => imageInput.click());

    // Tampilkan Preview Gambar
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            displayImagePreview(file);
        }
    });

    // Logika Pengiriman Form
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const prompt = messageInput.value.trim();
        let imageFile = imageInput.files[0];

        if (!prompt && !imageFile) return;

        displayUserMessage(prompt, imageFile);

        const aiMessageElement = createMessageElement('ai');
        const aiContentElement = aiMessageElement.querySelector('.message-content');
        
        // Reset form segera setelah pesan pengguna ditampilkan
        chatForm.reset();
        messageInput.style.height = 'auto';
        imagePreviewContainer.innerHTML = '';
        
        // --- LOGIKA KOMPRESI DIMULAI DI SINI ---
        if (imageFile) {
            const options = {
                maxSizeMB: 2, // Paksa gambar maksimal 2MB
                maxWidthOrHeight: 1920, // Ubah resolusi maksimal
                useWebWorker: true
            };
            try {
                console.log(`Ukuran gambar asli: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);
                aiContentElement.innerHTML = `<i>Mengompres gambar...</i>`; // Pesan sementara
                imageFile = await imageCompression(imageFile, options); // Kompres gambar
                console.log(`Ukuran gambar setelah kompresi: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (error) {
                aiContentElement.innerHTML = `<p>Maaf, gagal mengompres gambar.</p>`;
                console.error('Error saat kompresi:', error);
                return;
            }
        }
        // --- LOGIKA KOMPRESI SELESAI ---

        const formData = new FormData();
        formData.append('prompt', prompt);
        if (imageFile) {
            formData.append('image', imageFile, imageFile.name);
        }

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                // Tangkap error 413 dan berikan pesan yang lebih ramah
                if (response.status === 413) {
                    throw new Error(`Ukuran file terlalu besar bahkan setelah kompresi.`);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            // Proses streaming
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

    // Fungsi-fungsi pembantu
    function displayUserMessage(prompt, imageFile) {
        const userMessageElement = createMessageElement('user');
        const contentElement = userMessageElement.querySelector('.message-content');
        let contentHTML = '';
        if (prompt) contentHTML += `<p>${prompt.replace(/\n/g, '<br>')}</p>`;
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
    
    function displayImagePreview(file) {
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
            imageInput.value = '';
            imagePreviewContainer.innerHTML = '';
        };
        previewWrapper.appendChild(thumbnail);
        previewWrapper.appendChild(removeButton);
        imagePreviewContainer.innerHTML = '';
        imagePreviewContainer.appendChild(previewWrapper);
    }

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
    });
});
