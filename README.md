# YouTube Analytics

Self-hosted YouTube channel & video analytics — FastAPI backend, SQLite storage, vanilla-JS + Tailwind frontend, Chart.js visualisations. Pulls data from the YouTube Data API v3, persists it locally, and serves a corporate-style single-page dashboard at the same origin.

## Features

- **Channels** — search by name or ID, persist to local DB, list with filter & sort, paginated detail view
- **Videos** — search by ID, browse a channel's top videos, link out to YouTube
- **Dashboard** — KPIs (channels, videos, audience, avg views/video), recent channels grid, portfolio charts
- **Analytics charts** — top videos, engagement rate, comments, views trend, CTR proxy, view-outliers, velocity vs RPM
- **Earnings estimate** — per-channel RPM stored in DB; drives a velocity chart on the video page
- **Settings** — paginated tables of saved channels/videos with inline view/delete actions, JSON export, cache reset
- **UX** — sidebar nav with live count badges & API status, hash-based routing, `/` to filter, `Esc` to go back
- **Idempotent search** — already-fresh channels skip the YouTube refetch (configurable TTL)

## Tech stack

| Layer | Stack |
|---|---|
| Backend | FastAPI · Uvicorn · SQLAlchemy 2 |
| Database | SQLite (default, file-based) or PostgreSQL via `DATABASE_URL` |
| External | YouTube Data API v3 (`google-api-python-client`) |
| Frontend | Vanilla JS · Tailwind CSS (CDN) · Chart.js 4 · Inter / JetBrains Mono |

## Project structure

```
yout-analytics/
├── main_api.py                       # FastAPI entry point (uvicorn target)
├── pyproject.toml                    # Packaging + tool config
├── requirements.txt                  # Pinned-min runtime deps
├── README.md
├── .env.template                     # Copy to .env and fill in
├── .gitignore
│
├── youtube_analytics/                # Python package
│   ├── __init__.py
│   ├── config.py                     # env vars, DB URL, log level
│   ├── database.py                   # SQLAlchemy models + DatabaseManager
│   ├── fetcher.py                    # YouTube Data API client
│   ├── visualizer.py                 # Server-side chart helpers (legacy)
│   ├── static/                       # Frontend JS + CSS shipped with the package
│   │   ├── app.js
│   │   ├── styles.css
│   │   ├── favicon.ico
│   │   └── js/
│   │       ├── channel-charts.js
│   │       ├── video-charts.js
│   │       └── ui-enhancements.js
│   └── templates/
│       └── index.html                # Single-page shell
│
├── data/                             # SQLite DB lives here (gitignored)
│   └── youtube_analytics.db
│
├── scripts/                          # Helper run scripts
│   ├── run.ps1
│   └── run.sh
│
└── tests/                            # Pytest suite
    ├── conftest.py
    └── test_*.py
```

## Getting started

### 1. Install

```bash
pip install -r requirements.txt
# or, for editable install + dev tools:
pip install -e .[dev]
```

Requires Python 3.10+.

### 2. Configure

Copy the template and fill in your YouTube Data API key:

```bash
cp .env.template .env
```

Minimum `.env`:

```env
YOUTUBE_API_KEY=your_api_key_here
```

Get an API key from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — enable the **YouTube Data API v3** for your project.

### 3. Run

```bash
python main_api.py            # http://127.0.0.1:8000
python main_api.py 3000       # custom port
```

Or use the helper scripts:

```bash
./scripts/run.sh 3000         # macOS / Linux
./scripts/run.ps1 -Port 3000  # Windows PowerShell
```

The API and the frontend are served from the same origin — no CORS setup needed for local use.

## Configuration reference

All settings come from environment variables (read by [config.py](youtube_analytics/config.py) via `python-dotenv`):

| Variable | Default | Description |
|---|---|---|
| `YOUTUBE_API_KEY` | *(required)* | YouTube Data API v3 key |
| `DATABASE_URL` | `sqlite:///data/youtube_analytics.db` | Full SQLAlchemy URL; set for Postgres |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose on LAN / Docker) |
| `CORS_ORIGINS` | `http://localhost:8000,http://127.0.0.1:8000` | Comma-separated allowlist |
| `CHANNEL_REFRESH_SECONDS` | `86400` | Skip YouTube refetch within this window |
| `TOP_VIDEOS_LIMIT` | `50` | Max videos fetched per channel |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `DB_ECHO` | `False` | Log every SQL statement |
| `DEBUG` | `False` | Reserved for future use |

## API endpoints

All routes are under `/api`. Health: `GET /api/health`.

### Channels
- `POST /api/channel/search` — body `{query, search_type: "id"|"name"}` — idempotent within `CHANNEL_REFRESH_SECONDS`
- `GET  /api/channels`
- `GET  /api/channel/{channel_id}` — channel + statistics + videos
- `DELETE /api/channel/{channel_id}` — cascade-deletes videos
- `POST /api/channel/{channel_id}/videos/fetch?sync=true|false`
- `GET  /api/channel/{channel_id}/videos?limit=50`
- `GET  /api/channel/{channel_id}/rpm`
- `PUT  /api/channel/{channel_id}/rpm` — body `{rpm: float}`

### Videos
- `POST /api/video/search` — body `{video_id}`
- `GET  /api/video/search?q=VIDEO_ID`
- `GET  /api/video/{video_id}`
- `GET  /api/videos`
- `DELETE /api/video/{video_id}`

### Statistics
- `GET /api/statistics/{channel_id}`

Interactive OpenAPI docs: `http://127.0.0.1:8000/docs`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus the global filter input |
| `Esc` | Close channel detail / blur the current input |

## Development

### Run tests

```bash
pytest
```

### Lint

```bash
ruff check .
black .
```

### Switch to PostgreSQL

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/youtube_db
```

Tables are auto-created on first run. The lightweight `last_searched_at` migration in [database.py](youtube_analytics/database.py) is SQLite-only — for production Postgres you'll want Alembic.

## Troubleshooting

- **Port already in use** — `python main_api.py 3001`
- **YouTube API quota exceeded** — default daily quota is 10 000 units; channel-top-videos via `search.list` costs 100 units per page. Lower `TOP_VIDEOS_LIMIT`.
- **`YOUTUBE_API_KEY not found`** — confirm `.env` is in the project root and the key is non-empty.
- **`ModuleNotFoundError: googleapiclient`** — `pip install -r requirements.txt` (or check you're in the right venv).
- **DB shows old data** — channel search now skips refetch within 24 h. Override with `CHANNEL_REFRESH_SECONDS=0` to always refetch.

## License

MIT.
