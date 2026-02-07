# 🚀 YouTube Analytics Pro - Quick Start Guide

## FastAPI & Vanilla JavaScript Edition

This guide will get you up and running in **5 minutes**.

---

## ✅ Prerequisites

- **Python 3.8+** installed
- **YouTube API Key** (free from Google Cloud)
- **pip** (comes with Python)

---

## 📦 Step 1: Install Dependencies (2 minutes)

Open Command Prompt/PowerShell in your project directory:

```bash
pip install -r requirements_fastapi.txt
```

✅ **Wait for all packages to install**

---

## 🔑 Step 2: Get YouTube API Key (1 minute)

### Quick Option (if you already have one):
Add to `.env` file in project root:
```
YOUTUBE_API_KEY=your_key_here
```

### Full Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Search for "YouTube Data API v3" and Enable it
4. Go to Credentials → Create Credential → API Key
5. Copy your API key
6. Paste into `.env` file

---

## 🎯 Step 3: Run the Application (1 minute)

```bash
python main_api.py
```

You'll see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## 🌐 Step 4: Open in Browser (1 minute)

Click this link or open in browser:
### [http://localhost:8000](http://localhost:8000)

---

## 🎬 Step 5: Test It! (instant)

### Try This:

**Dashboard Tab:**
- See overview of analytics

**Search Channel Tab:**
- Type: `MrBeast` or `YouTube Creators`
- Click "Search Channel"
- Channel appears with stats!

**Your Channels Tab:**
- See all saved channels
- Click to view detailed analytics

---

## 📊 What You Can Do

✅ Search for any YouTube channel  
✅ View subscriber count, views, video count  
✅ See all videos with engagement metrics  
✅ Export data as JSON  
✅ View beautiful professional dashboard  

---

## 🎨 Design Highlights

- **Corporate Professional** styling
- **Classic Blue/Gray** color scheme
- **Responsive** - works on phone/tablet/desktop
- **Smooth Animations** and transitions
- **Easy Navigation** with clear sections

---

## 🔧 Troubleshooting

### Q: "Connection refused at http://localhost:8000"
**A:** Make sure you ran `python main_api.py` and saw "running on" message

### Q: "YOUTUBE_API_KEY not found"
**A:** Create `.env` file in project root with your API key

### Q: "ModuleNotFoundError"
**A:** Run `pip install -r requirements_fastapi.txt` again

### Q: "Address already in use :8000"
**A:** Another app is using port 8000. Either:
- Close other applications
- Or change port in `main_api.py` line 91

---

## 📚 API Endpoints (Advanced)

Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Available endpoints:
- `GET /api/health` - Check if server is running
- `POST /api/channel/search` - Search for channel
- `GET /api/channels` - List all saved channels
- `GET /api/channel/{id}` - Get channel details
- `POST /api/video/search` - Search video by ID

---

## 🆘 Need Help?

1. Check the browser console for errors (F12)
2. Check the terminal window for server errors
3. Make sure `.env` file has your API key
4. Try searching a different channel
5. Restart the application

---

## ✨ Next Steps

After initial setup:

1. **Explore Dashboard** - Get familiar with UI
2. **Search Channels** - Add your favorite creators
3. **View Analytics** - Click on channels for detailed stats
4. **Export Data** - Download your analytics data
5. **Read Full Docs** - See `FASTAPI_README.md` for advanced features

---

## 📝 Project Structure

```
yout-analytics/
├── main_api.py              ← Main application (START HERE)
├── templates/index.html     ← Frontend page
├── static/
│   ├── app.js              ← JavaScript logic
│   └── styles.css          ← Professional styling
├── youtube_analytics/       ← Core modules
│   ├── fetcher.py          ← YouTube API
│   ├── database.py         ← Data storage
│   └── visualizer.py       ← Charts
└── .env                    ← Your API key
```

---

## 🎓 Technology Stack

| Component | Tech | Purpose |
|-----------|------|---------|
| **Backend** | FastAPI | REST API server |
| **Frontend** | Vanilla JS | Browser interface |
| **Styling** | CSS3 | Professional design |
| **Database** | SQLite | Data storage |
| **API Client** | Fetch API | Browser HTTP |
| **YouTube** | API v3 | Get channel data |

---

## 💡 Pro Tips

1. **First Run Slow?**  
   Database is being initialized. After first run, it's much faster.

2. **Can't Find Channel?**  
   Try exact channel name or search by Channel ID instead.

3. **Want Custom Port?**  
   Edit `main_api.py` last line, change `port=8000` to `port=3000` etc.

4. **Need API Quota?**  
   YouTube API gives 10,000 free quota units per day. Each search uses ~100.

5. **Multiple Channels?**  
   Save as many as you want! They're stored in `youtube_analytics.db`

---

## 🎉 Success Checklist

- [ ] Dependencies installed
- [ ] `.env` file created with API key
- [ ] `python main_api.py` is running
- [ ] Browser shows http://localhost:8000
- [ ] Can search for a channel
- [ ] Can see channel stats
- [ ] Happy! 🚀

---

## 📞 Support

If everything works → **Enjoy your YouTube Analytics!** 🎬📊

If something's broken → Check the error in:
1. Browser console (F12)
2. Terminal where `main_api.py` is running
3. Review `.env` file for API key

---

**Happy analyzing! 🎯**

---

*YouTube Analytics Pro v2.0 | FastAPI × Vanilla JavaScript | Corporate Professional Design*
