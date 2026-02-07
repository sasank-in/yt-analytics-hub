# ⚙️ YouTube Analytics Pro - Installation & Configuration Guide

## 🎯 Complete Setup Instructions

This guide provides step-by-step instructions to get your FastAPI YouTube Analytics application running in production or development.

---

## 📋 System Requirements

- **OS**: Windows, macOS, or Linux
- **Python**: 3.8 or higher
- **RAM**: 2GB minimum
- **Disk**: 500MB free space
- **Internet**: Required for YouTube API

### Check Python Version
```bash
python --version
```

Should show: `Python 3.8+`

---

## 🔑 Step 1: YouTube API Setup (Required)

### 1.1 Get Your API Key

1. **Visit Google Cloud Console**
   - Go to [console.cloud.google.com](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Select a Project" → "New Project"
   - Name: `YouTube Analytics`
   - Click "Create"
   - Wait for project to be created

3. **Enable YouTube Data API v3**
   - Search for "YouTube Data API v3"
   - Click on it
   - Click "Enable"

4. **Create API Key**
   - Go to "Credentials" (left sidebar)
   - Click "Create Credentials" → "API Key"
   - Copy the generated key
   - Click the key to see full value

### 1.2 Add API Key to Project

1. **Create `.env` File**
   ```bash
   # Windows PowerShell
   echo 'YOUTUBE_API_KEY=your_key_here' > .env
   
   # macOS/Linux
   echo 'YOUTUBE_API_KEY=your_key_here' > .env
   ```

2. **Replace `your_key_here`** with your actual API key

3. **Verify File Created**
   - Open `.env` in a text editor
   - Should contain: `YOUTUBE_API_KEY=AIza...`

---

## 📦 Step 2: Install Dependencies

### 2.1 Create Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 2.2 Install Required Packages

```bash
# Upgrade pip
python -m pip install --upgrade pip

# Install all dependencies
pip install -r requirements_fastapi.txt
```

### 2.3 Verify Installation

```bash
python -c "import fastapi, uvicorn, sqlalchemy; print('✅ All dependencies installed')"
```

---

## 🚀 Step 3: Run the Application

### 3.1 Start the Server

```bash
python main_api.py
```

### 3.2 Expected Output

```
🚀 YouTube Analytics API started
📊 Backend: FastAPI
🗄️ Database: SQLite
🎨 Frontend: Vanilla JavaScript + Corporate Design
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### 3.3 Access the Application

Open your browser and go to:
```
http://localhost:8000
```

---

## ⚙️ Configuration Options

### 3.1 Change Server Port

Edit `main_api.py`, line 182:
```python
# Change from
uvicorn.run(app, host="0.0.0.0", port=8000)

# To (example: port 3000)
uvicorn.run(app, host="0.0.0.0", port=3000)
```

### 3.2 Change Database File Location

Edit `youtube_analytics/config.py`:
```python
# SQLite database file path
DB_URL = "sqlite:///./youtube_analytics.db"

# Change to absolute path if needed:
DB_URL = "sqlite:////absolute/path/to/youtube_analytics.db"
```

### 3.3 Enable SQL Query Logging

Edit `youtube_analytics/config.py`:
```python
# For debugging - shows all SQL queries
DB_ECHO = True  # Change from False to True
```

### 3.4 Change Host Address

Edit `main_api.py`, line 182:
```python
# Only localhost (default - most secure):
uvicorn.run(app, host="127.0.0.1", port=8000)

# All network interfaces (allows remote access):
uvicorn.run(app, host="0.0.0.0", port=8000)

# Specific IP:
uvicorn.run(app, host="192.168.1.100", port=8000)
```

---

## 🔍 Verify Installation

### Check 1: Python Packages

```bash
pip list | findstr fastapi
pip list | findstr sqlalchemy
pip list | findstr google
```

Should show:
```
fastapi                    0.104.1
sqlalchemy                 2.0.46
google-api-python-client   2.106.0
```

### Check 2: API Health

```bash
# In another terminal window:
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "YouTube Analytics Pro",
  "version": "2.0.0"
}
```

### Check 3: Database

```bash
python -c "from youtube_analytics.database import DatabaseManager; db = DatabaseManager(); print('✅ Database OK')"
```

### Check 4: YouTube API

```bash
python -c "from youtube_analytics.fetcher import YouTubeFetcher; f = YouTubeFetcher(); print('✅ YouTube API OK')"
```

---

## 🐛 Troubleshooting

### Problem: `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
# Reinstall dependencies
pip install --upgrade -r requirements_fastapi.txt

# Verify virtual environment is active (Windows):
venv\Scripts\activate
```

### Problem: `YOUTUBE_API_KEY not found`

**Solution:**
1. Check `.env` file exists in project root
2. Verify it contains: `YOUTUBE_API_KEY=your_key`
3. No quotes needed: ✅ `YOUTUBE_API_KEY=AIza123` (correct)
4. With quotes: ❌ `YOUTUBE_API_KEY="AIza123"` (wrong)

### Problem: `Address already in use :8000`

**Solution:**
```bash
# Option 1: Find and kill process
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Option 2: Change port in main_api.py
# Change port=8000 to port=3000
python main_api.py
# Then visit http://localhost:3000
```

### Problem: `Connection refused at http://localhost:8000`

**Solution:**
1. Verify you ran `python main_api.py`
2. Check for error messages in terminal
3. Verify port isn't already in use
4. Try refreshing browser (Ctrl+R / Cmd+R)

### Problem: Can't find installed packages

**Solution:**
```bash
# Make sure virtual environment is activated:
# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate

# Then run:
python main_api.py
```

### Problem: YouTube channel not found

**Solution:**
- Try exact channel name: `YouTube Creators` (capital letters matter)
- Try Channel ID instead: Right-click channel → "Copy user ID"
- Check channel isn't private
- Wait a moment and try again (API quota)

---

## 📊 Database

### View Database

```bash
# Using sqlite3 command line
sqlite3 youtube_analytics.db

# Then in SQLite:
sqlite> SELECT * FROM channels;
sqlite> SELECT COUNT(*) FROM videos;
sqlite> .quit
```

### Reset Database

```bash
# Delete database file (Windows):
del youtube_analytics.db

# macOS/Linux:
rm youtube_analytics.db

# Restart application - new database will be created
python main_api.py
```

---

## 🔒 Production Setup

### 3.1 Use Gunicorn

```bash
# Install Gunicorn
pip install gunicorn

# Run with Gunicorn (4 workers)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main_api:app
```

### 3.2 Use Environment Variables

Create `.env` file with:
```
YOUTUBE_API_KEY=your_key
DB_URL=sqlite:///./youtube_analytics.db
ENV=production
```

### 3.3 SSL/HTTPS Setup

```bash
# Using self-signed certificate:
pip install python-multipart

# Generate certificate:
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Update main_api.py to use SSL
```

---

## 📈 Performance Tuning

### 3.1 Database Optimization

```python
# In youtube_analytics/config.py
DB_URL = "sqlite:///./youtube_analytics.db?check_same_thread=False"
```

### 3.2 API Concurrency

In `main_api.py`, increase workers:
```bash
# For 8 CPU cores:
gunicorn -w 8 -k uvicorn.workers.UvicornWorker main_api:app
```

### 3.3 Connection Pooling

```python
# In database.py
from sqlalchemy.pool import QueuePool
engine = create_engine(
    DB_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10
)
```

---

## 🔐 Security Checklist

- [ ] `.env` file created with API key
- [ ] `.env` is in `.gitignore` (not committed)
- [ ] HTTPS enabled in production
- [ ] Database backups configured
- [ ] API rate limiting enabled
- [ ] CORS properly configured for production
- [ ] Error messages don't expose internals
- [ ] Input validation in place

---

## 📚 File Structure

After setup, your directory should look like:

```
yout-analytics/
├── main_api.py                 # FastAPI app (started here)
├── templates/
│   └── index.html             # HTML frontend
├── static/
│   ├── app.js                 # JavaScript logic
│   └── styles.css             # Professional styling
├── youtube_analytics/
│   ├── __init__.py
│   ├── config.py              # Configuration
│   ├── database.py            # Database models
│   ├── fetcher.py             # YouTube API
│   └── visualizer.py          # Data visualization
├── tests/
│   └── test_youtube_analytics.py
├── .env                       # Your API key (IMPORTANT!)
├── .gitignore                 # Exclude sensitive files
├── requirements_fastapi.txt   # Dependencies
├── youtube_analytics.db       # Database (auto-created)
├── FASTAPI_README.md          # Full documentation
├── QUICKSTART_FASTAPI.md      # Quick start
├── MIGRATION_SUMMARY.md       # Migration info
└── README.md                  # Project README
```

---

## ✨ Quick Commands Reference

```bash
# Development
python main_api.py

# With debugging
DEBUG=1 python main_api.py

# Production (Gunicorn)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main_api:app

# Check health
curl http://localhost:8000/api/health

# View Swagger docs
http://localhost:8000/docs

# View ReDoc docs
http://localhost:8000/redoc

# Run tests
python -m pytest tests/test_youtube_analytics.py -v

# Check dependencies
pip freeze > installed_packages.txt

# Update packages
pip install --upgrade pip
pip install --upgrade -r requirements_fastapi.txt
```

---

## 📞 Support Resources

1. **FastAPI Docs**: https://fastapi.tiangolo.com/
2. **YouTube API Guide**: https://developers.google.com/youtube/v3
3. **SQLAlchemy ORM**: https://docs.sqlalchemy.org/
4. **Vanilla JS Fetch API**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

---

## ✅ Setup Complete Checklist

- [ ] Python 3.8+ installed
- [ ] YouTube API key obtained
- [ ] `.env` file created with API key
- [ ] Virtual environment created and activated
- [ ] Dependencies installed: `pip install -r requirements_fastapi.txt`
- [ ] Application starts: `python main_api.py`
- [ ] Browser opens: `http://localhost:8000`
- [ ] Can search for a channel
- [ ] Can see channel statistics
- [ ] Ready to use! 🚀

---

## 🎉 You're All Set!

Your YouTube Analytics Pro application is now ready to use.

**Next Steps:**
1. Start the server: `python main_api.py`
2. Open browser: `http://localhost:8000`
3. Search for your favorite YouTube channel
4. Explore the analytics dashboard
5. Export your data as JSON

**Enjoy!** 🎬📊

---

*YouTube Analytics Pro v2.0 | Setup Guide | FastAPI × Vanilla JavaScript | Professional Design*
