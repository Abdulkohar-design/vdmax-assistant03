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
        
        chatForm.reset();
        messageInput.style.height = 'auto';
        imagePreviewContainer.innerHTML = '';
        
        if (imageFile) {
            const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
            try {
                aiContentElement.innerHTML = `<i>Mengompres gambar...</i>`;
                imageFile = await imageCompression(imageFile, options);
            } catch (error) {
                aiContentElement.innerHTML = `<p>Maaf, gagal mengompres gambar.</p>`;
                return;
            }
        }

        const formData = new FormData();
        formData.append('prompt', prompt);
        if (imageFile) formData.append('image', imageFile, imageFile.name);

        try {
            const response = await fetch('/chat', { method: 'POST', body: formData });
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

    // --- FUNGSI-FUNGSI PEMBANTU ---
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

        // --- LOGIKA BARU: Tambahkan Tombol Salin jika pesan dari AI ---
        if (role === 'ai') {
            const copyButton = document.createElement('button');
            copyButton.classList.add('copy-button');
            copyButton.title = 'Salin ke clipboard';
            const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            copyButton.innerHTML = copyIconSVG;
            
            copyButton.addEventListener('click', () => {
                const textToCopy = content.innerText; // Gunakan innerText untuk mendapatkan teks bersih
                navigator.clipboard.writeText(textToCopy).then(() => {
                    // Beri feedback visual setelah berhasil menyalin
                    const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    copyButton.innerHTML = checkIconSVG;
                    setTimeout(() => {
                        copyButton.innerHTML = copyIconSVG; // Kembalikan ke ikon semula
                    }, 2000);
                }).catch(err => {
                    console.error('Gagal menyalin teks: ', err);
                });
            });
            messageWrapper.appendChild(copyButton);
        }

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
