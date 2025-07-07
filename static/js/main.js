document.addEventListener('DOMContentLoaded', () => {
    // --- Elemen DOM ---
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const imageInput = document.getElementById('image-input');
    const uploadButton = document.getElementById('upload-button');
    const sendButton = document.getElementById('send-button');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const newChatButton = document.getElementById('new-chat-button');

    // --- State & Tampilan Awal ---
    const welcomeScreenHTML = `
        <div class="welcome-container">
            <div class="welcome-logo">VDMAX</div>
            <div class="welcome-cards">
                <div class="welcome-card">
                    <h3>Contoh Pertanyaan</h3>
                    <p>"Buatkan fungsi Python untuk validasi email"</p>
                </div>
                <div class="welcome-card">
                    <h3>Kemampuan</h3>
                    <p>Menganalisis kode, gambar, dan menjawab pertanyaan umum</p>
                </div>
                <div class="welcome-card">
                    <h3>Batasan</h3>
                    <p>Dapat membuat kesalahan dan tidak memiliki data setelah 2023</p>
                </div>
            </div>
        </div>`;

    // --- Fungsi Utama ---
    function loadChat() {
        const savedHistory = localStorage.getItem('vdmaxChatHistory');
        if (savedHistory) {
            chatWindow.innerHTML = savedHistory;
        } else {
            chatWindow.innerHTML = welcomeScreenHTML;
        }
        chatWindow.scrollTop = chatWindow.scrollHeight;
        addCopyButtonListeners();
    }

    function saveChatHistory() {
        // Jangan simpan jika isinya hanya welcome screen
        if (!document.querySelector('.welcome-container')) {
            localStorage.setItem('vdmaxChatHistory', chatWindow.innerHTML);
        }
    }

    newChatButton.addEventListener('click', () => {
        if (confirm('Mulai percakapan baru? Riwayat saat ini akan dihapus.')) {
            localStorage.removeItem('vdmaxChatHistory');
            loadChat();
        }
    });

    // --- Event Listeners ---
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendButton.click();
        }
    });
    
    uploadButton.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) displayImagePreview(file);
    });

    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const prompt = messageInput.value.trim();
        let imageFile = imageInput.files[0];

        if (!prompt && !imageFile) return;

        if (document.querySelector('.welcome-container')) {
            chatWindow.innerHTML = '';
        }

        displayUserMessage(prompt, imageFile);
        const aiMessageElement = createMessageElement('ai');
        const aiContentElement = aiMessageElement.querySelector('.message-content');
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        
        if (imageFile) {
            const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
            try {
                aiContentElement.innerHTML = `<i>Mengompres gambar...</i>`;
                const compressedFile = await imageCompression(imageFile, options);
                formData.append('image', compressedFile, compressedFile.name);
            } catch (error) {
                aiContentElement.innerHTML = `<p>Maaf, gagal mengompres gambar.</p>`;
                saveChatHistory();
                return;
            }
        }
        
        chatForm.reset();
        messageInput.style.height = 'auto';
        imagePreviewContainer.innerHTML = '';

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
                    aiContentElement.innerHTML = `<p><i>${fullResponse.substring(1, fullResponse.length - 3)}</i></p>`;
                } else {
                    aiContentElement.innerHTML = marked.parse(fullResponse);
                }
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        } catch (error) {
            aiContentElement.innerHTML = `<p>Maaf, terjadi kesalahan. Coba lagi nanti.</p><p><small>${error.message}</small></p>`;
        } finally {
            saveChatHistory();
            addCopyButtonListeners();
        }
    });
    
    // --- Fungsi Pembantu ---
    function createMessageElement(role) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('message-wrapper');
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', `${role}-avatar`);
        avatar.textContent = role === 'ai' ? 'V' : 'U';

        const content = document.createElement('div');
        content.classList.add('message-content');
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        wrapper.appendChild(messageDiv);
        chatWindow.appendChild(wrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return messageDiv;
    }

    function displayUserMessage(prompt, imageFile) {
        const userMessageElement = createMessageElement('user');
        const contentElement = userMessageElement.querySelector('.message-content');
        let contentHTML = '';
        if (prompt) contentHTML += `<p>${prompt.replace(/\n/g, '<br>')}</p>`;
        if (imageFile) contentHTML += `<img src="${URL.createObjectURL(imageFile)}" alt="Uploaded Image" class="uploaded-image">`;
        contentElement.innerHTML = contentHTML;
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
    
    function addCopyButtonListeners() { /* Implementasi di masa depan */ }

    // Inisialisasi Aplikasi
    loadChat();
});
