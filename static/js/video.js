class VideoCall {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.socket = io();
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        
        this.initialize();
    }
    
    async initialize() {
        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            this.localVideo.srcObject = this.localStream;
            
            // Create peer connection
            this.setupPeerConnection();
            
            // Setup socket events
            this.setupSocketEvents();
            
            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            this.showError('Unable to access camera/microphone');
        }
    }
    
    setupPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.remoteVideo.srcObject = this.remoteStream;
        };
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc_ice_candidate', {
                    session_id: this.sessionId,
                    candidate: event.candidate
                });
            }
        };
        
        // Connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.showSuccess('Video call connected');
            } else if (this.peerConnection.connectionState === 'disconnected') {
                this.showError('Video call disconnected');
            }
        };
    }
    
    setupSocketEvents() {
        this.socket.on('webrtc_offer', async (data) => {
            try {
                await this.peerConnection.setRemoteDescription(data.offer);
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                this.socket.emit('webrtc_answer', {
                    session_id: this.sessionId,
                    answer: answer
                });
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        });
        
        this.socket.on('webrtc_answer', async (data) => {
            try {
                await this.peerConnection.setRemoteDescription(data.answer);
            } catch (error) {
                console.error('Error handling answer:', error);
            }
        });
        
        this.socket.on('webrtc_ice_candidate', async (data) => {
            try {
                await this.peerConnection.addIceCandidate(data.candidate);
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });
    }
    
    async startCall() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('webrtc_offer', {
                session_id: this.sessionId,
                offer: offer
            });
        } catch (error) {
            console.error('Error starting call:', error);
            this.showError('Failed to start video call');
        }
    }
    
    toggleVideo() {
        this.isVideoEnabled = !this.isVideoEnabled;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = this.isVideoEnabled;
        }
        
        const videoBtn = document.getElementById('toggleVideoBtn');
        videoBtn.classList.toggle('active', this.isVideoEnabled);
        videoBtn.innerHTML = this.isVideoEnabled 
            ? '<i class="fas fa-video"></i>' 
            : '<i class="fas fa-video-slash"></i>';
    }
    
    toggleAudio() {
        this.isAudioEnabled = !this.isAudioEnabled;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = this.isAudioEnabled;
        }
        
        const audioBtn = document.getElementById('toggleAudioBtn');
        audioBtn.classList.toggle('active', this.isAudioEnabled);
        audioBtn.innerHTML = this.isAudioEnabled 
            ? '<i class="fas fa-microphone"></i>' 
            : '<i class="fas fa-microphone-slash"></i>';
    }
    
    async shareScreen() {
        try {
            if (!this.isScreenSharing) {
                // Start screen sharing
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                
                // Replace video track
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = this.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
                
                // Update local video
                this.localVideo.srcObject = screenStream;
                
                // Handle screen share end
                videoTrack.onended = () => {
                    this.stopScreenShare();
                };
                
                this.isScreenSharing = true;
                
                const screenBtn = document.getElementById('shareScreenBtn');
                screenBtn.classList.add('active');
                screenBtn.innerHTML = '<i class="fas fa-desktop"></i> Stop Sharing';
                
            } else {
                this.stopScreenShare();
            }
        } catch (error) {
            console.error('Error sharing screen:', error);
            this.showError('Failed to share screen');
        }
    }
    
    async stopScreenShare() {
        try {
            // Get camera stream back
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Replace video track
            const videoTrack = cameraStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
            
            // Update local stream and video
            this.localStream = cameraStream;
            this.localVideo.srcObject = cameraStream;
            
            this.isScreenSharing = false;
            
            const screenBtn = document.getElementById('shareScreenBtn');
            screenBtn.classList.remove('active');
            screenBtn.innerHTML = '<i class="fas fa-desktop"></i> Share Screen';
            
        } catch (error) {
            console.error('Error stopping screen share:', error);
            this.showError('Failed to stop screen sharing');
        }
    }
    
    endCall() {
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Clear video sources
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        
        // Redirect back to classroom
        window.location.href = `/classroom/${this.sessionId}`;
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

// Initialize video call when page loads
document.addEventListener('DOMContentLoaded', function() {
    const sessionId = window.sessionId;
    if (sessionId) {
        window.videoCall = new VideoCall(sessionId);
        
        // Setup button event listeners
        document.getElementById('startCallBtn')?.addEventListener('click', () => {
            window.videoCall.startCall();
        });
        
        document.getElementById('toggleVideoBtn')?.addEventListener('click', () => {
            window.videoCall.toggleVideo();
        });
        
        document.getElementById('toggleAudioBtn')?.addEventListener('click', () => {
            window.videoCall.toggleAudio();
        });
        
        document.getElementById('shareScreenBtn')?.addEventListener('click', () => {
            window.videoCall.shareScreen();
        });
        
        document.getElementById('endCallBtn')?.addEventListener('click', () => {
            window.videoCall.endCall();
        });
    }
});
