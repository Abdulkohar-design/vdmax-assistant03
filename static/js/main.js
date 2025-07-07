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

    const welcomeScreenHTML = `<div class="welcome-container">VDMAX</div>`;

    // --- FUNGSI BARU UNTUK MENGONTROL TOMBOL KIRIM ---
    function updateSendButtonState() {
        const hasText = messageInput.value.trim().length > 0;
        const hasImage = imageInput.files.length > 0;
        sendButton.disabled = !hasText && !hasImage;
    }

    // --- Fungsi Utama ---
    function loadChat() {
        const savedHistory = localStorage.getItem('vdmaxChatHistory');
        if (savedHistory && savedHistory.trim() !== '') {
            chatWindow.innerHTML = savedHistory;
            addCopyButtonListenersToAll();
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

    // --- Event Listeners ---
    // Panggil updateSendButtonState setiap kali ada perubahan input
    messageInput.addEventListener('input', updateSendButtonState);
    imageInput.addEventListener('change', updateSendButtonState);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) sendButton.click();
        }
    });
    
    uploadButton.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            displayImagePreview(file);
        } else {
            // Jika pemilihan file dibatalkan, hapus preview
            imagePreviewContainer.innerHTML = '';
        }
    });

    // Logika Pengiriman Form
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const prompt = messageInput.value.trim();
        let imageFile = imageInput.files[0];

        if (!prompt && !imageFile) return;
        if (document.querySelector('.welcome-container')) chatWindow.innerHTML = '';

        displayUserMessage(prompt, imageFile);
        saveChatHistory(); 
        
        const aiMessageWrapper = createMessageElement('ai');
        const aiContentElement = aiMessageWrapper.querySelector('.message-content');
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        
        if (imageFile) {
            const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
            try {
                aiContentElement.innerHTML = `<p><i>Mengompres gambar...</i></p>`;
                const compressedFile = await imageCompression(imageFile, options);
                formData.append('image', compressedFile, compressedFile.name);
            } catch (error) {
                aiContentElement.innerHTML = `<p>Maaf, gagal mengompres gambar.</p>`;
                saveChatHistory();
                return;
            }
        }
        
        chatForm.reset();
        updateSendButtonState(); // Update status tombol setelah reset
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
            addActionBar(aiMessageWrapper);
            saveChatHistory();
        }
    });
    
    // Inisialisasi Aplikasi
    loadChat();

    // --- Fungsi Pembantu ---
    function createMessageElement(role) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);
        messageDiv.innerHTML = `
            <div class="avatar ${role}-avatar">${role === 'ai' ? 'V' : 'U'}</div>
            <div class="message-content"></div>
        `;
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
        if (!contentElement || messageElement.querySelector('.action-bar')) return;

        const actionBar = document.createElement('div');
        actionBar.classList.add('action-bar');
        
        const copyButton = document.createElement('button');
        copyButton.classList.add('icon-button');
        copyButton.title = 'Salin';
        const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        copyButton.innerHTML = copyIconSVG;
        
        copyButton.addEventListener('click', () => {
            const textToCopy = contentElement.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                copyButton.innerHTML = checkIconSVG;
                setTimeout(() => { copyButton.innerHTML = copyIconSVG; }, 2000);
            });
        });
        
        actionBar.appendChild(copyButton);
        contentElement.appendChild(actionBar);
    }
    
    function addCopyButtonListenersToAll() {
        const allAIMessages = document.querySelectorAll('.ai-message');
        allAIMessages.forEach(addActionBar);
    }
    
    function displayImagePreview(file) {
        imagePreviewContainer.innerHTML = '';
        const previewWrapper = document.createElement('div');
        previewWrapper.classList.add('image-preview-wrapper');
        previewWrapper.innerHTML = `
            <img src="${URL.createObjectURL(file)}" alt="Image preview" class="image-preview-thumbnail">
            <button class="remove-preview-button">&times;</button>
        `;
        previewWrapper.querySelector('.remove-preview-button').addEventListener('click', () => {
            imageInput.value = '';
            imagePreviewContainer.innerHTML = '';
            updateSendButtonState(); // Update tombol saat preview dihapus
        });
        imagePreviewContainer.appendChild(previewWrapper);
    }
});
