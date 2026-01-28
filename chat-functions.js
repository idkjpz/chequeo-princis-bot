// State
let chatOpen = false;
let unreadCount = 0;
let lastMessageTimestamp = null;
let chatPollingInterval = null;
let replyingTo = null; // Store the message object we're replying to

// Initialize Chat
function initializeChat() {
    console.log('Initializing chat...');

    // Setup chat toggle button
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', toggleChat);
    }

    // Load initial messages
    loadChatMessages();

    // Start polling for new messages
    startChatPolling();

    // Initialize file upload
    initializeFileUpload();

    // Setup send button
    const sendBtn = document.getElementById('chatSendBtn');
    const chatInput = document.getElementById('chatInput');

    sendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Setup close button
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    if (chatCloseBtn) {
        chatCloseBtn.addEventListener('click', closeChat);
    }

    // Setup cancel reply button
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
    }
}

// Toggle chat panel
function toggleChat() {
    // Check if user has set their name
    const userName = localStorage.getItem('chatUserName');

    if (!userName) {
        // Show name prompt modal
        showNamePrompt();
        return;
    }

    const chatPanel = document.getElementById('chatPanel');
    chatOpen = !chatOpen;

    if (chatOpen) {
        chatPanel.classList.add('active');
        // Reset unread count
        unreadCount = 0;
        updateChatBadge();
        // Load latest messages
        loadChatMessages();
    } else {
        chatPanel.classList.remove('active');
    }
}

// Show name prompt modal
function showNamePrompt() {
    // Check if name is already set - if so, don't show prompt
    const existingName = localStorage.getItem('chatUserName');
    if (existingName) {
        return; // Name already set, skip prompt
    }

    const modal = document.getElementById('namePromptModal');
    const nameInput = document.getElementById('nameInput');
    const submitBtn = document.getElementById('nameSubmitBtn');

    modal.classList.add('active');
    nameInput.focus();

    // Handle submit
    const handleSubmit = () => {
        const name = nameInput.value.trim();
        if (name) {
            localStorage.setItem('chatUserName', name);
            modal.classList.remove('active');
            nameInput.value = '';
            // Now open the chat
            toggleChat();
        }
    };

    submitBtn.onclick = handleSubmit;
    nameInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };
}

// Close chat panel
function closeChat() {
    const chatPanel = document.getElementById('chatPanel');
    chatPanel.classList.remove('active');
    chatOpen = false;
}

// Load chat messages
async function loadChatMessages() {
    try {
        const response = await Auth.fetchWithAuth('/api/telegram/messages');
        const data = await response.json();

        if (data.success && data.messages) {
            renderChatMessages(data.messages);

            // Update last message timestamp
            if (data.messages.length > 0) {
                lastMessageTimestamp = data.messages[data.messages.length - 1].timestamp;
            }
        }
    } catch (error) {
        console.error('Error loading chat messages:', error);
    }
}

// Render chat messages
function renderChatMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    messages.forEach(msg => {
        const messageEl = createMessageElement(msg);
        chatMessages.appendChild(messageEl);
    });

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Create message element
function createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${msg.isBot ? 'sent' : 'received'}`;
    messageDiv.dataset.id = msg.messageId;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'chat-message-header';

    const senderSpan = document.createElement('span');
    senderSpan.className = 'chat-message-sender';
    senderSpan.textContent = msg.from;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-message-time';
    timeSpan.textContent = formatMessageTime(msg.timestamp);

    headerDiv.appendChild(senderSpan);
    headerDiv.appendChild(timeSpan);

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'chat-message-bubble';

    // Check if it's a reply and render the replied-to message
    if (msg.replyTo) {
        const replyEl = document.createElement('div');
        replyEl.className = 'chat-message-reply-ref';
        replyEl.innerHTML = `
            <div class="reply-ref-sender">${msg.replyTo.from}</div>
            <div class="reply-ref-text">${msg.replyTo.text}</div>
        `;
        // Scroll to the original message when clicked
        replyEl.onclick = () => {
            const targetEl = document.querySelector(`.chat-message[data-id="${msg.replyTo.messageId}"]`);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.classList.add('highlight-message');
                setTimeout(() => targetEl.classList.remove('highlight-message'), 2000);
            }
        };
        bubbleDiv.appendChild(replyEl);
    }

    // If message has a photo, display it
    if (msg.photoUrl) {
        const img = document.createElement('img');
        img.src = msg.photoUrl;
        img.className = 'chat-message-image';
        img.alt = 'Foto';
        bubbleDiv.appendChild(img);

        // Add caption if exists
        if (msg.text && msg.text !== '📷 Foto') {
            const caption = document.createElement('div');
            caption.className = 'chat-message-caption';
            caption.textContent = msg.text;
            bubbleDiv.appendChild(caption);
        }
    } else {
        const textContent = document.createElement('div');
        textContent.className = 'chat-message-text';
        textContent.innerHTML = msg.text;
        bubbleDiv.appendChild(textContent);
    }

    // Add reply action button
    const replyBtn = document.createElement('button');
    replyBtn.className = 'chat-message-reply-btn';
    replyBtn.innerHTML = '↩️';
    replyBtn.title = 'Responder';
    replyBtn.onclick = () => setReplyTo(msg);

    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(replyBtn);

    return messageDiv;
}

// Set reply state
function setReplyTo(msg) {
    replyingTo = msg;
    const replyPreview = document.getElementById('chatReplyPreview');
    const replySender = document.getElementById('replyPreviewSender');
    const replyText = document.getElementById('replyPreviewText');
    const chatInput = document.getElementById('chatInput');

    replySender.textContent = msg.from;
    replyText.textContent = msg.text || (msg.photoUrl ? '📷 Foto' : 'Archivo');
    replyPreview.classList.add('active');
    chatInput.focus();
}

// Cancel reply state
function cancelReply() {
    replyingTo = null;
    const replyPreview = document.getElementById('chatReplyPreview');
    replyPreview.classList.remove('active');
}

// Format message time
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;

    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' +
        date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// Send chat message
async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value.trim();

    if (!messageText) return;

    // Get user name
    const userName = localStorage.getItem('chatUserName') || 'Usuario';

    // Format message with username in bold HTML
    const formattedMessage = `<b>${userName}</b>: ${messageText}`;

    try {
        const payload = {
            message: formattedMessage
        };

        if (replyingTo) {
            payload.replyToId = replyingTo.messageId;
        }

        const response = await Auth.fetchWithAuth('/api/telegram/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            chatInput.value = '';
            cancelReply(); // Clear reply state
            // Reload messages to show the sent message
            setTimeout(() => loadChatMessages(), 500);
        } else {
            showNotification('Error al enviar mensaje', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Error al enviar mensaje', 'error');
    }
}

// Start polling for new messages
function startChatPolling() {
    // Poll every 3 seconds
    chatPollingInterval = setInterval(async () => {
        if (!lastMessageTimestamp) return;

        try {
            const response = await Auth.fetchWithAuth(`/api/telegram/updates?since=${lastMessageTimestamp}`);
            const data = await response.json();

            if (data.success && data.messages && data.messages.length > 0) {
                // Update last timestamp
                lastMessageTimestamp = data.messages[data.messages.length - 1].timestamp;

                // If chat is open, append new messages
                if (chatOpen) {
                    const chatMessages = document.getElementById('chatMessages');
                    data.messages.forEach(msg => {
                        const messageEl = createMessageElement(msg);
                        chatMessages.appendChild(messageEl);
                    });
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } else {
                    // Increment unread count
                    unreadCount += data.messages.filter(m => !m.isBot).length;
                    updateChatBadge();
                }
            }
        } catch (error) {
            console.error('Error polling messages:', error);
        }
    }, 3000);
}

// Update chat badge
function updateChatBadge() {
    const badge = document.getElementById('chatBadge');
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// ============================================
// FILE UPLOAD FUNCTIONALITY
// ============================================

let selectedFile = null;

// Initialize file upload
function initializeFileUpload() {
    const chatFileBtn = document.getElementById('chatFileBtn');
    const chatFileInput = document.getElementById('chatFileInput');
    const filePreviewModal = document.getElementById('filePreviewModal');
    const filePreviewClose = document.getElementById('filePreviewClose');
    const fileSendBtn = document.getElementById('fileSendBtn');
    const fileCancelBtn = document.getElementById('fileCancelBtn');

    if (!chatFileBtn || !chatFileInput) {
        console.log('File upload elements not found');
        return;
    }

    // Open file picker
    chatFileBtn.addEventListener('click', () => {
        console.log('File button clicked');
        chatFileInput.click();
    });

    // Handle file selection
    chatFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', file.name);
            selectedFile = file;
            showFilePreview(file);
            filePreviewModal.style.display = 'block';
        }
    });

    // Close modal
    if (filePreviewClose) filePreviewClose.addEventListener('click', closeFilePreview);
    if (fileCancelBtn) fileCancelBtn.addEventListener('click', closeFilePreview);
    if (fileSendBtn) fileSendBtn.addEventListener('click', sendFile);

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === filePreviewModal) {
            closeFilePreview();
        }
    });
}

// Show file preview
function showFilePreview(file) {
    const container = document.getElementById('filePreviewContainer');
    container.innerHTML = '';

    const fileSize = formatFileSize(file.size);
    const isImage = file.type.startsWith('image/');

    if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            container.appendChild(img);
        };
        reader.readAsDataURL(file);
    } else {
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.innerHTML = `
            <div class="file-icon">📄</div>
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${fileSize}</div>
            </div>
        `;
        container.appendChild(fileInfo);
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Send file
async function sendFile() {
    if (!selectedFile) return;

    const caption = document.getElementById('fileCaptionInput').value.trim();
    const userName = localStorage.getItem('chatUserName') || 'Usuario';
    const fullCaption = caption ? `<b>[${userName}]</b>: ${caption}` : `<b>[${userName}]</b>`;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('caption', fullCaption);

    if (replyingTo) {
        formData.append('replyToId', replyingTo.messageId);
    }

    try {
        showNotification('Enviando archivo...', 'info');

        const response = await Auth.fetchWithAuth('/api/telegram/send-file', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            closeFilePreview();
            cancelReply(); // Clear reply state
            showNotification('Archivo enviado correctamente', 'success');
        } else {
            throw new Error('Error al enviar archivo');
        }
    } catch (error) {
        console.error('Error sending file:', error);
        showNotification('Error al enviar el archivo', 'error');
    }
}

// Close file preview
function closeFilePreview() {
    const modal = document.getElementById('filePreviewModal');
    const fileInput = document.getElementById('chatFileInput');
    const captionInput = document.getElementById('fileCaptionInput');

    modal.style.display = 'none';
    fileInput.value = '';
    captionInput.value = '';
    selectedFile = null;
}
