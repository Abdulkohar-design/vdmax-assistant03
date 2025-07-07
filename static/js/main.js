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

    // --- Tampilan Awal ---
    const welcomeScreenHTML = `<div class="welcome-container">VDMAX</div>`;

    // --- Fungsi Utama ---
    function loadChat() {
        const savedHistory = localStorage.getItem('vdmaxChatHistory');
        if (savedHistory && savedHistory.trim() !== '') {
            chatWindow.innerHTML = savedHistory;
            addCopyButtonListeners();
        } else {
            chatWindow.innerHTML = welcomeScreenHTML;
        }
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function saveChatHistory() {
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

    // Mengaktifkan/menonaktifkan tombol kirim
    messageInput.addEventListener('input', () => {
        sendButton.disabled = messageInput.value.trim().length === 0;
    });

    // Kirim dengan Enter
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) sendButton.click();
        }
    });
    
    uploadButton.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) displayImagePreview(file);
    });

    // Logika Pengiriman Form
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const prompt = messageInput.value.trim();
        let imageFile = imageInput.files[0];

        if (!prompt && !imageFile) return;
        if (document.querySelector('.welcome-container')) chatWindow.innerHTML = '';

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
        sendButton.disabled = true;
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
                aiContentElement.innerHTML = marked.parse(fullResponse);
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        } catch (error) {
            aiContentElement.innerHTML = `<p>Maaf, terjadi kesalahan.</p><p><small>${error.message}</small></p>`;
        } finally {
            addActionBar(aiMessageElement);
            saveChatHistory();
        }
    });
    
    // --- Inisialisasi Aplikasi ---
    loadChat();

    // --- Fungsi-fungsi Pembantu ---
    function createMessageElement(role) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);
        const avatar = document.createElement('div');
        avatar.classList.add('avatar', `${role}-avatar`);
        avatar.textContent = role === 'ai' ? 'V' : 'U';
        const content = document.createElement('div');
        content.classList.add('message-content');
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        chatWindow.appendChild(messageDiv);
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

    function addActionBar(messageElement) {
        const contentElement = messageElement.querySelector('.message-content');
        const actionBar = document.createElement('div');
        actionBar.classList.add('action-bar');
        
        const copyButton = document.createElement('button');
        copyButton.classList.add('icon-button');
        copyButton.title = 'Salin';
        copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        
        copyButton.addEventListener('click', () => {
            const textToCopy = contentElement.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                copyButton.innerHTML = checkIconSVG;
                setTimeout(() => { copyButton.innerHTML = copyButton.dataset.originalIcon; }, 2000);
            });
        });
        copyButton.dataset.originalIcon = copyButton.innerHTML;
        
        actionBar.appendChild(copyButton);
        // Anda bisa menambahkan tombol lain (like, dislike) di sini
        contentElement.appendChild(actionBar);
    }

    function addCopyButtonListeners() {
        const allAIMessages = document.querySelectorAll('.ai-message');
        allAIMessages.forEach(addActionBar);
    }
    
    // Fungsi preview gambar tidak perlu diubah
    function displayImagePreview(file) { /* ... kode sama seperti sebelumnya ... */ }
});
