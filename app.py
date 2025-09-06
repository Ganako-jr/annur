import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

# Initialize extensions
db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
socketio = SocketIO(cors_allowed_origins="*")

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///classroom.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }
    app.config['UPLOAD_FOLDER'] = 'uploads'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Proxy fix for HTTPS
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    
    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    socketio.init_app(app)
    
    # Login manager configuration
    login_manager.login_view = 'login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'
    
    # Create upload directory
    os.makedirs(os.path.join(app.instance_path, 'uploads'), exist_ok=True)
    
    return app

app = create_app()

# Import models to ensure they're registered
with app.app_context():
    import models
    db.create_all()
    
    # Initialize staff IDs if not exists
    from models import StaffID
    if not StaffID.query.first():
        staff_ids = [
            "ST001", "ST002", "ST003", "ST004", "ST005",
            "ST006", "ST007", "ST008", "ST009", "ST010",
            "ST011", "ST012", "ST013", "ST014", "ST015"
        ]
        for staff_id in staff_ids:
            new_staff_id = StaffID()
            new_staff_id.staff_id = staff_id
            db.session.add(new_staff_id)
        db.session.commit()
        logging.info("Staff IDs initialized")
