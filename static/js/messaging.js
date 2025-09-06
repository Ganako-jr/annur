class Messaging {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.socket = io();
        this.messageContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendMessage');
        
        this.initialize();
    }
    
    initialize() {
        // Join classroom room
        this.socket.emit('join_classroom', { session_id: this.sessionId });
        
        // Setup socket event listeners
        this.setupSocketEvents();
        
        // Setup UI event listeners
        this.setupUIEvents();
        
        // Scroll to bottom of messages
        this.scrollToBottom();
    }
    
    setupSocketEvents() {
        this.socket.on('message', (data) => {
            this.addMessage(data);
        });
        
        this.socket.on('status', (data) => {
            this.addStatusMessage(data.msg);
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.addStatusMessage('Disconnected from server');
        });
    }
    
    setupUIEvents() {
        // Send message on button click
        this.sendButton?.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Send message on Enter key press
        this.messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.messageInput?.addEventListener('input', () => {
            this.autoResizeTextarea(this.messageInput);
        });
    }
    
    sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (message) {
            this.socket.emit('send_message', {
                session_id: this.sessionId,
                message: message
            });
            
            this.messageInput.value = '';
            this.autoResizeTextarea(this.messageInput);
        }
    }
    
    addMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.role} ${this.isOwnMessage(data.username) ? 'own' : 'other'}`;
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.textContent = `${data.username} • ${data.timestamp}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = data.message;
        
        messageDiv.appendChild(messageHeader);
        messageDiv.appendChild(messageContent);
        
        this.messageContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Show notification if message is not from current user
        if (!this.isOwnMessage(data.username)) {
            this.showMessageNotification(data);
        }
    }
    
    addStatusMessage(message) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'status-message text-center text-muted my-2';
        statusDiv.innerHTML = `<small><em>${message}</em></small>`;
        
        this.messageContainer.appendChild(statusDiv);
        this.scrollToBottom();
    }
    
    isOwnMessage(username) {
        const currentUsername = document.body.dataset.currentUser;
        return username === currentUsername;
    }
    
    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }
    
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
    
    showMessageNotification(data) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`New message from ${data.username}`, {
                body: data.message,
                icon: 'https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/message.svg'
            });
        }
    }
    
    // Request notification permission
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    // Clear chat messages
    clearMessages() {
        if (this.messageContainer) {
            this.messageContainer.innerHTML = '';
        }
    }
    
    // Disconnect from room
    disconnect() {
        this.socket.emit('leave_classroom', { session_id: this.sessionId });
        this.socket.disconnect();
    }
}

// File sharing functionality
class FileSharing {
    constructor(messaging) {
        this.messaging = messaging;
        this.fileInput = document.getElementById('fileInput');
        this.fileButton = document.getElementById('fileButton');
        
        this.setupEvents();
    }
    
    setupEvents() {
        this.fileButton?.addEventListener('click', () => {
            this.fileInput?.click();
        });
        
        this.fileInput?.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });
        
        // Drag and drop
        const dropZone = document.getElementById('messageInput');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                this.handleFileDrop(e);
            });
        }
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.uploadFile(file);
        }
    }
    
    handleFileDrop(event) {
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }
    
    async uploadFile(file) {
        // Validate file size (max 16MB)
        if (file.size > 16 * 1024 * 1024) {
            this.showError('File size must be less than 16MB');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_id', this.messaging.sessionId);
        
        try {
            this.showProgress('Uploading file...');
            
            const response = await fetch('/upload_file', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Send file message
                this.messaging.socket.emit('send_message', {
                    session_id: this.messaging.sessionId,
                    message: `📎 Shared file: ${file.name}`,
                    file_url: result.file_url
                });
                
                this.showSuccess('File uploaded successfully');
            } else {
                this.showError(result.error || 'File upload failed');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('File upload failed');
        } finally {
            this.hideProgress();
        }
    }
    
    showProgress(message) {
        // Show progress indicator
        const progressDiv = document.createElement('div');
        progressDiv.id = 'uploadProgress';
        progressDiv.className = 'alert alert-info';
        progressDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                ${message}
            </div>
        `;
        
        const container = document.querySelector('.chat-input');
        container?.prepend(progressDiv);
    }
    
    hideProgress() {
        const progressDiv = document.getElementById('uploadProgress');
        progressDiv?.remove();
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'danger');
    }
    
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize messaging when page loads
document.addEventListener('DOMContentLoaded', function() {
    const sessionId = window.sessionId;
    if (sessionId) {
        window.messaging = new Messaging(sessionId);
        window.fileSharing = new FileSharing(window.messaging);
        
        // Request notification permission
        window.messaging.requestNotificationPermission();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (window.messaging) {
        window.messaging.disconnect();
    }
});
