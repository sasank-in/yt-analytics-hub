"""Configuration Module

Loads environment variables and configuration settings
from .env file using python-dotenv.
"""

import os

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# YouTube API Configuration
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

# Database Configuration
# IMPORTANT: Set DATABASE_URL in .env for PostgreSQL
# Format: postgresql://username:password@localhost:5432/youtube_db
# If not set, defaults to SQLite with ABSOLUTE path
db_url_env = os.getenv("DATABASE_URL", None)

if db_url_env:
    DB_URL = db_url_env
else:
    # Default SQLite location: <project>/data/youtube_analytics.db
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(PROJECT_ROOT, "data")
    os.makedirs(DATA_DIR, exist_ok=True)
    DB_FILE = os.path.join(DATA_DIR, "youtube_analytics.db")
    DB_URL = f"sqlite:///{DB_FILE}"

# Application Settings
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Analytics Settings
TOP_VIDEOS_LIMIT = int(os.getenv("TOP_VIDEOS_LIMIT", "50"))

# Database Debug Mode
DB_ECHO = os.getenv("DB_ECHO", "False").lower() == "true"  # Logs SQL queries if True
