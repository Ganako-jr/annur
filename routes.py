import os
from datetime import datetime
from flask import render_template, request, redirect, url_for, flash, jsonify, send_file
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.utils import secure_filename
from app import app, db
from models import User, StaffID, ClassSession, Assignment, Submission, Quiz, QuizQuestion, QuizAttempt, Message, Notification

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        role = request.form['role']
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return render_template('register.html')
        
        if User.query.filter_by(email=email).first():
            flash('Email already exists', 'error')
            return render_template('register.html')
        
        user = User()
        user.username = username
        user.email = email
        user.role = role
        user.set_password(password)
        
        if role == 'teacher':
            staff_id = request.form['staff_id']
            staff_record = StaffID.query.filter_by(staff_id=staff_id, is_used=False).first()
            if not staff_record:
                flash('Invalid or already used Staff ID', 'error')
                return render_template('register.html')
            
            user.staff_id = staff_id
            staff_record.is_used = True
        else:  # student
            class_name = request.form['class_name']
            user.class_name = class_name
        
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role == 'teacher':
        active_sessions = ClassSession.query.filter_by(teacher_id=current_user.id, is_active=True).all()
        assignments = Assignment.query.filter_by(teacher_id=current_user.id).limit(5).all()
        quizzes = Quiz.query.filter_by(teacher_id=current_user.id).limit(5).all()
    else:  # student
        active_sessions = ClassSession.query.filter_by(class_name=current_user.class_name, is_active=True).all()
        assignments = Assignment.query.filter_by(class_name=current_user.class_name).limit(5).all()
        quizzes = Quiz.query.filter_by(class_name=current_user.class_name, is_active=True).limit(5).all()
    
    notifications = Notification.query.filter_by(user_id=current_user.id, is_read=False).limit(5).all()
    
    return render_template('dashboard.html', 
                         active_sessions=active_sessions,
                         assignments=assignments,
                         quizzes=quizzes,
                         notifications=notifications)

@app.route('/start_session', methods=['POST'])
@login_required
def start_session():
    if current_user.role != 'teacher':
        flash('Only teachers can start sessions', 'error')
        return redirect(url_for('dashboard'))
    
    class_name = request.form['class_name']
    subject = request.form['subject']
    
    # End any existing active sessions for this class and subject
    ClassSession.query.filter_by(class_name=class_name, subject=subject, is_active=True).update({'is_active': False, 'ended_at': datetime.utcnow()})
    
    session = ClassSession()
    session.teacher_id = current_user.id
    session.class_name = class_name
    session.subject = subject
    db.session.add(session)
    db.session.commit()
    
    # Notify students
    students = User.query.filter_by(role='student', class_name=class_name).all()
    for student in students:
        notification = Notification()
        notification.user_id = student.id
        notification.title = f'New {subject} Session Started'
        notification.message = f'{current_user.username} has started a {subject} session for {class_name}'
        db.session.add(notification)
    
    db.session.commit()
    flash(f'Session started for {class_name} - {subject}', 'success')
    return redirect(url_for('classroom', session_id=session.id))

@app.route('/join_session/<int:session_id>')
@login_required
def join_session(session_id):
    session = ClassSession.query.get_or_404(session_id)
    
    if current_user.role == 'student' and current_user.class_name != session.class_name:
        flash('You can only join sessions for your class', 'error')
        return redirect(url_for('dashboard'))
    
    if not session.is_active:
        flash('This session is no longer active', 'error')
        return redirect(url_for('dashboard'))
    
    return redirect(url_for('classroom', session_id=session_id))

@app.route('/classroom/<int:session_id>')
@login_required
def classroom(session_id):
    session = ClassSession.query.get_or_404(session_id)
    
    if current_user.role == 'student' and current_user.class_name != session.class_name:
        flash('Access denied', 'error')
        return redirect(url_for('dashboard'))
    
    messages = Message.query.filter_by(class_name=session.class_name, subject=session.subject).order_by(Message.timestamp.desc()).limit(50).all()
    
    return render_template('classroom.html', session=session, messages=messages)

@app.route('/assignments')
@login_required
def assignments():
    if current_user.role == 'teacher':
        assignments = Assignment.query.filter_by(teacher_id=current_user.id).all()
    else:
        assignments = Assignment.query.filter_by(class_name=current_user.class_name).all()
    
    return render_template('assignments.html', assignments=assignments)

@app.route('/create_assignment', methods=['POST'])
@login_required
def create_assignment():
    if current_user.role != 'teacher':
        flash('Only teachers can create assignments', 'error')
        return redirect(url_for('assignments'))
    
    title = request.form['title']
    description = request.form['description']
    subject = request.form['subject']
    class_name = request.form['class_name']
    due_date = datetime.strptime(request.form['due_date'], '%Y-%m-%dT%H:%M')
    
    assignment = Assignment()
    assignment.title = title
    assignment.description = description
    assignment.subject = subject
    assignment.class_name = class_name
    assignment.teacher_id = current_user.id
    assignment.due_date = due_date
    db.session.add(assignment)
    db.session.commit()
    
    # Notify students
    students = User.query.filter_by(role='student', class_name=class_name).all()
    for student in students:
        notification = Notification()
        notification.user_id = student.id
        notification.title = f'New Assignment: {title}'
        notification.message = f'New assignment in {subject} for {class_name}'
        db.session.add(notification)
    
    db.session.commit()
    flash('Assignment created successfully', 'success')
    return redirect(url_for('assignments'))

@app.route('/submit_assignment/<int:assignment_id>', methods=['POST'])
@login_required
def submit_assignment(assignment_id):
    if current_user.role != 'student':
        flash('Only students can submit assignments', 'error')
        return redirect(url_for('assignments'))
    
    assignment = Assignment.query.get_or_404(assignment_id)
    content = request.form.get('content', '')
    
    # Handle file upload
    file_path = None
    if 'file' in request.files:
        file = request.files['file']
        if file and file.filename:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
    
    # Check if submission already exists
    existing_submission = Submission.query.filter_by(assignment_id=assignment_id, student_id=current_user.id).first()
    
    if existing_submission:
        existing_submission.content = content
        existing_submission.file_path = file_path
        existing_submission.submitted_at = datetime.utcnow()
    else:
        submission = Submission()
        submission.assignment_id = assignment_id
        submission.student_id = current_user.id
        submission.content = content
        submission.file_path = file_path
        db.session.add(submission)
    
    db.session.commit()
    flash('Assignment submitted successfully', 'success')
    return redirect(url_for('assignments'))

@app.route('/grade_submission/<int:submission_id>', methods=['POST'])
@login_required
def grade_submission(submission_id):
    if current_user.role != 'teacher':
        flash('Only teachers can grade submissions', 'error')
        return redirect(url_for('assignments'))
    
    submission = Submission.query.get_or_404(submission_id)
    grade = int(request.form['grade'])
    feedback = request.form.get('feedback', '')
    
    submission.grade = grade
    submission.feedback = feedback
    submission.graded_at = datetime.utcnow()
    
    db.session.commit()
    
    # Notify student
    notification = Notification()
    notification.user_id = submission.student_id
    notification.title = 'Assignment Graded'
    notification.message = f'Your assignment "{submission.assignment.title}" has been graded: {grade}/100'
    db.session.add(notification)
    db.session.commit()
    
    flash('Submission graded successfully', 'success')
    return redirect(url_for('assignments'))

@app.route('/quizzes')
@login_required
def quizzes():
    if current_user.role == 'teacher':
        quizzes = Quiz.query.filter_by(teacher_id=current_user.id).all()
    else:
        quizzes = Quiz.query.filter_by(class_name=current_user.class_name).all()
    
    return render_template('quiz.html', quizzes=quizzes)

@app.route('/create_quiz', methods=['POST'])
@login_required
def create_quiz():
    if current_user.role != 'teacher':
        flash('Only teachers can create quizzes', 'error')
        return redirect(url_for('quizzes'))
    
    data = request.get_json()
    
    quiz = Quiz()
    quiz.title = data['title']
    quiz.description = data['description']
    quiz.subject = data['subject']
    quiz.class_name = data['class_name']
    quiz.teacher_id = current_user.id
    quiz.time_limit = data['time_limit']
    db.session.add(quiz)
    db.session.flush()
    
    for question_data in data['questions']:
        question = QuizQuestion()
        question.quiz_id = quiz.id
        question.question_text = question_data['question']
        question.option_a = question_data['option_a']
        question.option_b = question_data['option_b']
        question.option_c = question_data['option_c']
        question.option_d = question_data['option_d']
        question.correct_answer = question_data['correct_answer']
        question.points = question_data['points']
        db.session.add(question)
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Quiz created successfully'})

@app.route('/take_quiz/<int:quiz_id>')
@login_required
def take_quiz(quiz_id):
    if current_user.role != 'student':
        flash('Only students can take quizzes', 'error')
        return redirect(url_for('quizzes'))
    
    quiz = Quiz.query.get_or_404(quiz_id)
    
    if not quiz.is_active:
        flash('This quiz is not active', 'error')
        return redirect(url_for('quizzes'))
    
    # Check if student already took the quiz
    existing_attempt = QuizAttempt.query.filter_by(quiz_id=quiz_id, student_id=current_user.id).first()
    if existing_attempt:
        flash('You have already taken this quiz', 'info')
        return redirect(url_for('quizzes'))
    
    return render_template('take_quiz.html', quiz=quiz)

@app.route('/submit_quiz/<int:quiz_id>', methods=['POST'])
@login_required
def submit_quiz(quiz_id):
    if current_user.role != 'student':
        return jsonify({'error': 'Only students can submit quizzes'}), 403
    
    quiz = Quiz.query.get_or_404(quiz_id)
    answers = request.get_json()
    
    # Calculate score
    score = 0
    total_points = 0
    for question in quiz.questions:
        total_points += question.points
        if str(question.id) in answers and answers[str(question.id)] == question.correct_answer:
            score += question.points
    
    attempt = QuizAttempt()
    attempt.quiz_id = quiz_id
    attempt.student_id = current_user.id
    attempt.answers = answers
    attempt.score = score
    attempt.total_points = total_points
    attempt.completed_at = datetime.utcnow()
    db.session.add(attempt)
    db.session.commit()
    
    return jsonify({'success': True, 'score': score, 'total': total_points})

@app.route('/analytics')
@login_required
def analytics():
    if current_user.role != 'teacher':
        flash('Only teachers can view analytics', 'error')
        return redirect(url_for('dashboard'))
    
    # Get real analytics data
    total_assignments = Assignment.query.filter_by(teacher_id=current_user.id).count()
    total_quizzes = Quiz.query.filter_by(teacher_id=current_user.id).count()
    total_sessions = ClassSession.query.filter_by(teacher_id=current_user.id).count()
    
    # Get active students count (unique students who have submissions or quiz attempts)
    active_students_assignments = db.session.query(Submission.student_id).join(Assignment).filter(Assignment.teacher_id == current_user.id).distinct().count()
    active_students_quizzes = db.session.query(QuizAttempt.student_id).join(Quiz).filter(Quiz.teacher_id == current_user.id).distinct().count()
    active_students = max(active_students_assignments, active_students_quizzes)
    
    # Assignment statistics
    teacher_assignments = Assignment.query.filter_by(teacher_id=current_user.id).all()
    assignment_stats = []
    total_possible_submissions = 0
    total_actual_submissions = 0
    total_graded_submissions = 0
    
    for assignment in teacher_assignments:
        # Count students in the assignment's class
        class_students = User.query.filter_by(role='student', class_name=assignment.class_name).count()
        submissions_count = len(assignment.submissions)
        graded_count = len([s for s in assignment.submissions if s.grade is not None])
        avg_grade = sum([s.grade for s in assignment.submissions if s.grade is not None]) / max(graded_count, 1) if graded_count > 0 else 0
        
        assignment_stats.append({
            'title': assignment.title,
            'class_name': assignment.class_name,
            'subject': assignment.subject,
            'total_students': class_students,
            'submissions': submissions_count,
            'graded': graded_count,
            'avg_grade': round(avg_grade, 1) if avg_grade > 0 else 0,
            'submission_rate': round((submissions_count / max(class_students, 1)) * 100, 1)
        })
        
        total_possible_submissions += class_students
        total_actual_submissions += submissions_count
        total_graded_submissions += graded_count
    
    # Quiz statistics
    teacher_quizzes = Quiz.query.filter_by(teacher_id=current_user.id).all()
    quiz_stats = []
    
    for quiz in teacher_quizzes:
        attempts = quiz.attempts
        if attempts:
            avg_score = sum([a.score for a in attempts]) / len(attempts)
            avg_total = sum([a.total_points for a in attempts]) / len(attempts) 
            avg_percentage = (avg_score / max(avg_total, 1)) * 100 if avg_total > 0 else 0
        else:
            avg_percentage = 0
            
        quiz_stats.append({
            'title': quiz.title,
            'class_name': quiz.class_name,
            'subject': quiz.subject,
            'attempts': len(attempts),
            'avg_score': round(avg_percentage, 1),
            'is_active': quiz.is_active
        })
    
    # Grade distribution for all teacher's assignments
    all_grades = []
    for assignment in teacher_assignments:
        all_grades.extend([s.grade for s in assignment.submissions if s.grade is not None])
    
    grade_distribution = {
        'excellent': len([g for g in all_grades if g >= 90]),
        'good': len([g for g in all_grades if 80 <= g < 90]),
        'fair': len([g for g in all_grades if 70 <= g < 80]),
        'poor': len([g for g in all_grades if g < 70])
    }
    
    # Session activity (last 7 days)
    from datetime import datetime, timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_sessions = ClassSession.query.filter(
        ClassSession.teacher_id == current_user.id,
        ClassSession.started_at >= week_ago
    ).all()
    
    # Group sessions by day
    session_activity = {}
    for i in range(7):
        day = (datetime.utcnow() - timedelta(days=6-i)).strftime('%a')
        session_activity[day] = 0
    
    for session in recent_sessions:
        day_key = session.started_at.strftime('%a')
        if day_key in session_activity:
            session_activity[day_key] += 1
    
    # Subject distribution
    subject_counts = {}
    for assignment in teacher_assignments:
        subject_counts[assignment.subject] = subject_counts.get(assignment.subject, 0) + 1
    for quiz in teacher_quizzes:
        subject_counts[quiz.subject] = subject_counts.get(quiz.subject, 0) + 1
    
    # Recent activity
    recent_activity = []
    
    # Add recent sessions
    recent_sessions_limited = ClassSession.query.filter_by(teacher_id=current_user.id).order_by(ClassSession.started_at.desc()).limit(3).all()
    for session in recent_sessions_limited:
        students_in_class = User.query.filter_by(role='student', class_name=session.class_name).count()
        recent_activity.append({
            'time': session.started_at,
            'action': 'Session',
            'description': f'Started {session.subject} class session',
            'class_subject': f'{session.class_name} / {session.subject}',
            'students_affected': students_in_class
        })
    
    # Add recent assignments
    recent_assignments = Assignment.query.filter_by(teacher_id=current_user.id).order_by(Assignment.created_at.desc()).limit(2).all()
    for assignment in recent_assignments:
        students_in_class = User.query.filter_by(role='student', class_name=assignment.class_name).count()
        recent_activity.append({
            'time': assignment.created_at,
            'action': 'Assignment',
            'description': f'Created "{assignment.title}" assignment',
            'class_subject': f'{assignment.class_name} / {assignment.subject}',
            'students_affected': students_in_class
        })
    
    # Sort recent activity by time
    recent_activity.sort(key=lambda x: x['time'], reverse=True)
    recent_activity = recent_activity[:5]  # Keep only 5 most recent
    
    # Calculate engagement rates
    submission_rate = round((total_actual_submissions / max(total_possible_submissions, 1)) * 100, 1)
    grading_completion = round((total_graded_submissions / max(total_actual_submissions, 1)) * 100, 1)
    quiz_participation = 0
    if teacher_quizzes:
        total_quiz_attempts = sum(len(quiz.attempts) for quiz in teacher_quizzes)
        total_possible_attempts = sum(User.query.filter_by(role='student', class_name=quiz.class_name).count() for quiz in teacher_quizzes)
        quiz_participation = round((total_quiz_attempts / max(total_possible_attempts, 1)) * 100, 1)
    
    return render_template('analytics.html', 
                         total_assignments=total_assignments,
                         total_quizzes=total_quizzes,
                         total_sessions=total_sessions,
                         active_students=active_students,
                         assignment_stats=assignment_stats,
                         quiz_stats=quiz_stats,
                         grade_distribution=grade_distribution,
                         session_activity=list(session_activity.values()),
                         session_labels=list(session_activity.keys()),
                         subject_counts=subject_counts,
                         recent_activity=recent_activity,
                         submission_rate=submission_rate,
                         grading_completion=grading_completion,
                         quiz_participation=quiz_participation)

@app.route('/video_call/<int:session_id>')
@login_required
def video_call(session_id):
    session = ClassSession.query.get_or_404(session_id)
    
    if current_user.role == 'student' and current_user.class_name != session.class_name:
        flash('Access denied', 'error')
        return redirect(url_for('dashboard'))
    
    return render_template('video_call.html', session=session)

@app.route('/api/notifications')
@login_required
def get_notifications():
    notifications = Notification.query.filter_by(user_id=current_user.id, is_read=False).all()
    return jsonify([{
        'id': n.id,
        'title': n.title,
        'message': n.message,
        'created_at': n.created_at.isoformat()
    } for n in notifications])

@app.route('/api/mark_notification_read/<int:notification_id>', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    notification = Notification.query.get_or_404(notification_id)
    if notification.user_id == current_user.id:
        notification.is_read = True
        db.session.commit()
    return jsonify({'success': True})
