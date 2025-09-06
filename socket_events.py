from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app import socketio, db
from models import Message, ClassSession

@socketio.on('join_classroom')
def on_join(data):
    if current_user.is_authenticated:
        session_id = data['session_id']
        session = ClassSession.query.get(session_id)
        
        if session and (current_user.role == 'teacher' or current_user.class_name == session.class_name):
            room = f"classroom_{session_id}"
            join_room(room)
            emit('status', {
                'msg': f'{current_user.username} has joined the classroom',
                'user': current_user.username
            }, to=room)

@socketio.on('leave_classroom')
def on_leave(data):
    if current_user.is_authenticated:
        session_id = data['session_id']
        room = f"classroom_{session_id}"
        leave_room(room)
        emit('status', {
            'msg': f'{current_user.username} has left the classroom',
            'user': current_user.username
        }, to=room)

@socketio.on('send_message')
def handle_message(data):
    if current_user.is_authenticated:
        session_id = data['session_id']
        message_text = data['message']
        
        session = ClassSession.query.get(session_id)
        if session and (current_user.role == 'teacher' or current_user.class_name == session.class_name):
            message = Message()
            message.sender_id = current_user.id
            message.class_name = session.class_name
            message.subject = session.subject
            message.content = message_text
            db.session.add(message)
            db.session.commit()
            
            room = f"classroom_{session_id}"
            emit('message', {
                'username': current_user.username,
                'message': message_text,
                'timestamp': message.timestamp.strftime('%H:%M'),
                'role': current_user.role
            }, to=room)

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    if current_user.is_authenticated:
        session_id = data['session_id']
        room = f"classroom_{session_id}"
        emit('webrtc_offer', {
            'offer': data['offer'],
            'sender': current_user.username
        }, to=room, include_self=False)

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    if current_user.is_authenticated:
        session_id = data['session_id']
        room = f"classroom_{session_id}"
        emit('webrtc_answer', {
            'answer': data['answer'],
            'sender': current_user.username
        }, to=room, include_self=False)

@socketio.on('webrtc_ice_candidate')
def handle_ice_candidate(data):
    if current_user.is_authenticated:
        session_id = data['session_id']
        room = f"classroom_{session_id}"
        emit('webrtc_ice_candidate', {
            'candidate': data['candidate'],
            'sender': current_user.username
        }, to=room, include_self=False)
