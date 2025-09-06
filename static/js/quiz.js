class QuizSystem {
    constructor() {
        this.currentQuiz = null;
        this.timeRemaining = 0;
        this.timerInterval = null;
        this.answers = {};
        this.autoSaveInterval = null;
        
        this.initialize();
    }
    
    initialize() {
        // Setup quiz creation form
        this.setupQuizCreation();
        
        // Setup quiz taking interface
        this.setupQuizTaking();
        
        // Setup auto-save for quiz answers
        this.setupAutoSave();
    }
    
    setupQuizCreation() {
        const createQuizBtn = document.getElementById('createQuizBtn');
        const addQuestionBtn = document.getElementById('addQuestionBtn');
        const submitQuizBtn = document.getElementById('submitQuizBtn');
        
        createQuizBtn?.addEventListener('click', () => {
            this.showCreateQuizModal();
        });
        
        addQuestionBtn?.addEventListener('click', () => {
            this.addQuestionField();
        });
        
        submitQuizBtn?.addEventListener('click', () => {
            this.submitQuiz();
        });
    }
    
    setupQuizTaking() {
        const startQuizBtns = document.querySelectorAll('.start-quiz-btn');
        const submitQuizAnswersBtn = document.getElementById('submitQuizAnswers');
        
        startQuizBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const quizId = e.target.dataset.quizId;
                this.startQuiz(quizId);
            });
        });
        
        submitQuizAnswersBtn?.addEventListener('click', () => {
            this.submitQuizAnswers();
        });
        
        // Setup answer tracking
        document.addEventListener('change', (e) => {
            if (e.target.type === 'radio' && e.target.name.startsWith('question_')) {
                const questionId = e.target.name.replace('question_', '');
                this.answers[questionId] = e.target.value;
                this.saveAnswersLocally();
            }
        });
    }
    
    setupAutoSave() {
        // Auto-save answers every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (Object.keys(this.answers).length > 0) {
                this.saveAnswersLocally();
            }
        }, 30000);
    }
    
    showCreateQuizModal() {
        const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
        modal.show();
    }
    
    addQuestionField() {
        const questionsContainer = document.getElementById('questionsContainer');
        const questionCount = questionsContainer.children.length + 1;
        
        const questionHtml = `
            <div class="card mb-3 question-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Question ${questionCount}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-question-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <label class="form-label">Question Text</label>
                        <textarea class="form-control question-text" rows="2" required></textarea>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-2">
                            <label class="form-label">Option A</label>
                            <input type="text" class="form-control option-a" required>
                        </div>
                        <div class="col-md-6 mb-2">
                            <label class="form-label">Option B</label>
                            <input type="text" class="form-control option-b" required>
                        </div>
                        <div class="col-md-6 mb-2">
                            <label class="form-label">Option C</label>
                            <input type="text" class="form-control option-c" required>
                        </div>
                        <div class="col-md-6 mb-2">
                            <label class="form-label">Option D</label>
                            <input type="text" class="form-control option-d" required>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-2">
                            <label class="form-label">Correct Answer</label>
                            <select class="form-select correct-answer" required>
                                <option value="">Select correct answer</option>
                                <option value="A">Option A</option>
                                <option value="B">Option B</option>
                                <option value="C">Option C</option>
                                <option value="D">Option D</option>
                            </select>
                        </div>
                        <div class="col-md-6 mb-2">
                            <label class="form-label">Points</label>
                            <input type="number" class="form-control points" value="1" min="1" required>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        questionsContainer.insertAdjacentHTML('beforeend', questionHtml);
        
        // Add event listener for remove button
        const removeBtn = questionsContainer.lastElementChild.querySelector('.remove-question-btn');
        removeBtn.addEventListener('click', () => {
            removeBtn.closest('.question-card').remove();
            this.updateQuestionNumbers();
        });
    }
    
    updateQuestionNumbers() {
        const questionCards = document.querySelectorAll('.question-card');
        questionCards.forEach((card, index) => {
            const header = card.querySelector('.card-header h6');
            header.textContent = `Question ${index + 1}`;
        });
    }
    
    async submitQuiz() {
        const title = document.getElementById('quizTitle').value;
        const description = document.getElementById('quizDescription').value;
        const subject = document.getElementById('quizSubject').value;
        const className = document.getElementById('quizClass').value;
        const timeLimit = document.getElementById('timeLimit').value;
        
        if (!title || !subject || !className) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        const questions = this.collectQuestions();
        if (questions.length === 0) {
            this.showError('Please add at least one question');
            return;
        }
        
        const quizData = {
            title,
            description,
            subject,
            class_name: className,
            time_limit: parseInt(timeLimit),
            questions
        };
        
        try {
            const response = await fetch('/create_quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(quizData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('Quiz created successfully');
                const modal = bootstrap.Modal.getInstance(document.getElementById('createQuizModal'));
                modal.hide();
                
                // Reset form
                document.getElementById('createQuizForm').reset();
                document.getElementById('questionsContainer').innerHTML = '';
                
                // Reload page to show new quiz
                setTimeout(() => location.reload(), 1000);
            } else {
                this.showError(result.message || 'Failed to create quiz');
            }
        } catch (error) {
            console.error('Error creating quiz:', error);
            this.showError('Failed to create quiz');
        }
    }
    
    collectQuestions() {
        const questions = [];
        const questionCards = document.querySelectorAll('.question-card');
        
        questionCards.forEach(card => {
            const questionText = card.querySelector('.question-text').value;
            const optionA = card.querySelector('.option-a').value;
            const optionB = card.querySelector('.option-b').value;
            const optionC = card.querySelector('.option-c').value;
            const optionD = card.querySelector('.option-d').value;
            const correctAnswer = card.querySelector('.correct-answer').value;
            const points = parseInt(card.querySelector('.points').value);
            
            if (questionText && optionA && optionB && optionC && optionD && correctAnswer) {
                questions.push({
                    question: questionText,
                    option_a: optionA,
                    option_b: optionB,
                    option_c: optionC,
                    option_d: optionD,
                    correct_answer: correctAnswer,
                    points: points
                });
            }
        });
        
        return questions;
    }
    
    startQuiz(quizId) {
        // Redirect to quiz taking page
        window.location.href = `/take_quiz/${quizId}`;
    }
    
    initializeQuizTaking(quizData) {
        this.currentQuiz = quizData;
        this.timeRemaining = quizData.time_limit * 60; // Convert to seconds
        
        // Load saved answers if any
        this.loadAnswersLocally();
        
        // Start timer
        this.startTimer();
        
        // Show quiz instructions
        this.showQuizInstructions();
    }
    
    startTimer() {
        if (this.timeRemaining <= 0) return;
        
        const timerElement = document.getElementById('quizTimer');
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            
            const minutes = Math.floor(this.timeRemaining / 60);
            const seconds = this.timeRemaining % 60;
            
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Change color when time is running low
            if (this.timeRemaining <= 300) { // 5 minutes
                timerElement.classList.add('text-danger');
            } else if (this.timeRemaining <= 600) { // 10 minutes
                timerElement.classList.add('text-warning');
            }
            
            // Auto-submit when time runs out
            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                this.showError('Time is up! Quiz will be submitted automatically.');
                setTimeout(() => this.submitQuizAnswers(), 2000);
            }
        }, 1000);
    }
    
    async submitQuizAnswers() {
        if (!this.currentQuiz) return;
        
        try {
            const response = await fetch(`/submit_quiz/${this.currentQuiz.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.answers)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Stop timer
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                }
                
                // Clear local storage
                this.clearAnswersLocally();
                
                // Show results
                this.showQuizResults(result.score, result.total);
            } else {
                this.showError(result.error || 'Failed to submit quiz');
            }
        } catch (error) {
            console.error('Error submitting quiz:', error);
            this.showError('Failed to submit quiz');
        }
    }
    
    showQuizResults(score, total) {
        const percentage = Math.round((score / total) * 100);
        
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Quiz Results</h5>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-4">
                            <div class="display-4 text-primary">${percentage}%</div>
                            <p class="lead">You scored ${score} out of ${total} points</p>
                        </div>
                        <div class="progress mb-3">
                            <div class="progress-bar" role="progressbar" style="width: ${percentage}%"></div>
                        </div>
                        <p class="text-muted">
                            ${percentage >= 70 ? 'Great job!' : percentage >= 50 ? 'Good effort!' : 'Keep practicing!'}
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="window.location.href='/quizzes'">
                            Back to Quizzes
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }
    
    showQuizInstructions() {
        const instructions = `
            <div class="alert alert-info">
                <h6><i class="fas fa-info-circle"></i> Quiz Instructions</h6>
                <ul class="mb-0">
                    <li>You have ${this.currentQuiz.time_limit} minutes to complete this quiz</li>
                    <li>Select the best answer for each question</li>
                    <li>Your answers are automatically saved</li>
                    <li>You can only submit the quiz once</li>
                    <li>Make sure you have a stable internet connection</li>
                </ul>
            </div>
        `;
        
        const container = document.querySelector('.quiz-container');
        container?.insertAdjacentHTML('afterbegin', instructions);
    }
    
    saveAnswersLocally() {
        if (this.currentQuiz) {
            localStorage.setItem(`quiz_${this.currentQuiz.id}_answers`, JSON.stringify(this.answers));
        }
    }
    
    loadAnswersLocally() {
        if (this.currentQuiz) {
            const saved = localStorage.getItem(`quiz_${this.currentQuiz.id}_answers`);
            if (saved) {
                this.answers = JSON.parse(saved);
                
                // Restore selected answers in UI
                Object.keys(this.answers).forEach(questionId => {
                    const radio = document.querySelector(`input[name="question_${questionId}"][value="${this.answers[questionId]}"]`);
                    if (radio) {
                        radio.checked = true;
                    }
                });
            }
        }
    }
    
    clearAnswersLocally() {
        if (this.currentQuiz) {
            localStorage.removeItem(`quiz_${this.currentQuiz.id}_answers`);
        }
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

// Initialize quiz system when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.quizSystem = new QuizSystem();
    
    // Initialize quiz taking if on quiz page
    const quizData = window.quizData;
    if (quizData) {
        window.quizSystem.initializeQuizTaking(quizData);
    }
});

// Prevent page refresh during quiz
window.addEventListener('beforeunload', function(e) {
    if (window.quizSystem && window.quizSystem.currentQuiz && Object.keys(window.quizSystem.answers).length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved answers. Are you sure you want to leave?';
        return e.returnValue;
    }
});
