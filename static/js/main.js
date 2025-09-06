// PWA Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/static/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Online/Offline Detection
window.addEventListener('online', function() {
    document.body.classList.remove('offline');
    showNotification('Connection restored', 'success');
});

window.addEventListener('offline', function() {
    document.body.classList.add('offline');
    showNotification('You are offline', 'warning');
});

// Notification System
function showNotification(message, type = 'info') {
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

// Real-time Notifications
function fetchNotifications() {
    fetch('/api/notifications')
        .then(response => response.json())
        .then(notifications => {
            const badge = document.querySelector('.notification-badge');
            if (badge) {
                badge.textContent = notifications.length;
                badge.style.display = notifications.length > 0 ? 'block' : 'none';
            }
        })
        .catch(error => console.error('Error fetching notifications:', error));
}

// Mark notification as read
function markNotificationRead(notificationId) {
    fetch(`/api/mark_notification_read/${notificationId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            fetchNotifications();
        }
    })
    .catch(error => console.error('Error marking notification as read:', error));
}

// Initialize notifications on page load
document.addEventListener('DOMContentLoaded', function() {
    fetchNotifications();
    
    // Fetch notifications every 30 seconds
    setInterval(fetchNotifications, 30000);
    
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize modals
    var modalList = [].slice.call(document.querySelectorAll('.modal'));
    modalList.forEach(function(modal) {
        new bootstrap.Modal(modal);
    });
});

// Form Validation
function validateForm(formId) {
    const form = document.getElementById(formId);
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('is-invalid');
            isValid = false;
        } else {
            input.classList.remove('is-invalid');
        }
    });
    
    return isValid;
}

// File Upload Progress
function handleFileUpload(input, progressId) {
    const file = input.files[0];
    const progressBar = document.getElementById(progressId);
    
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
                progressBar.textContent = Math.round(percentComplete) + '%';
            }
        });
        
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                showNotification('File uploaded successfully', 'success');
            } else {
                showNotification('File upload failed', 'danger');
            }
        });
        
        xhr.addEventListener('error', function() {
            showNotification('File upload failed', 'danger');
        });
        
        // Uncomment and modify the URL as needed
        // xhr.open('POST', '/upload');
        // xhr.send(formData);
    }
}

// Dynamic Class Selection
function updateSubjects() {
    const classSelect = document.getElementById('class_name');
    const subjectSelect = document.getElementById('subject');
    
    if (!classSelect || !subjectSelect) return;
    
    const selectedClass = classSelect.value;
    
    // Clear existing options
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    
    let subjects = [];
    
    if (selectedClass.endsWith('A')) {
        subjects = [
            'Mathematics', 'English', 'Data Processing', 'Marketing',
            'Civic Education', 'Geography', 'Physics', 'Chemistry',
            'Biology', 'Agriculture'
        ];
    } else if (selectedClass.endsWith('B')) {
        subjects = [
            'Mathematics', 'English', 'Data Processing', 'Marketing',
            'Civic Education', 'Geography', 'Government', 'Literature',
            'Economics', 'Islamic Studies'
        ];
    }
    
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        subjectSelect.appendChild(option);
    });
}

// Session Timer
function startSessionTimer() {
    const timerElement = document.getElementById('session-timer');
    if (!timerElement) return;
    
    let seconds = 0;
    
    setInterval(() => {
        seconds++;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

// Auto-save functionality
function autoSave(inputId, saveUrl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    let timeout;
    
    input.addEventListener('input', function() {
        clearTimeout(timeout);
        
        timeout = setTimeout(() => {
            const formData = new FormData();
            formData.append('content', input.value);
            
            fetch(saveUrl, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Auto-saved');
                }
            })
            .catch(error => console.error('Auto-save failed:', error));
        }, 2000);
    });
}

// Dark mode toggle
function toggleDarkMode() {
    const body = document.body;
    const isDark = body.getAttribute('data-bs-theme') === 'dark';
    
    if (isDark) {
        body.setAttribute('data-bs-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-bs-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-bs-theme', savedTheme);
});

// Utility function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Search functionality
function searchContent(searchTerm, containerSelector) {
    const container = document.querySelector(containerSelector);
    const items = container.querySelectorAll('[data-searchable]');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm.toLowerCase())) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        showNotification('Copied to clipboard', 'success');
    }).catch(function(err) {
        console.error('Could not copy text: ', err);
        showNotification('Failed to copy to clipboard', 'danger');
    });
}

// Generate random ID
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
