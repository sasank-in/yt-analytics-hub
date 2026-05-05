# Creatorscope

> A self-hosted YouTube analytics workbench.

[![CI](https://github.com/sasank-in/creatorscope/actions/workflows/ci.yml/badge.svg)](https://github.com/sasank-in/creatorscope/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![Code style: ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Creatorscope pulls channel and video data from the YouTube Data API v3, persists it to local SQLite (or Postgres), and serves a single-page dashboard with engagement metrics, view-outliers, and RPM-based earnings estimates. FastAPI on the backend, vanilla JS + Tailwind on the frontend, no SaaS dependencies.

---

## Screenshots

> _Screenshots go here. Capture from `http://127.0.0.1:8000` after seeding a few channels._

| Dashboard | Channel detail |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Channel detail](docs/screenshots/channel-detail.png) |

| Video analytics | Settings |
|---|---|
| ![Video analytics](docs/screenshots/videos.png) | ![Settings](docs/screenshots/settings.png) |

---

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
| Backend | FastAPI · Uvicorn · SQLAlchemy 2 · Pydantic 2 |
| Database | SQLite (default, file-based) or PostgreSQL via `DATABASE_URL` |
| External | YouTube Data API v3 (`google-api-python-client`) |
| Frontend | Vanilla JS · Tailwind CSS (CDN) · Chart.js 4 · Inter / JetBrains Mono |
| Tooling | pytest · ruff · GitHub Actions · Docker |

## Project structure

```
creatorscope/
├── main_api.py                       # Thin FastAPI entry (uvicorn target)
├── pyproject.toml                    # Packaging, deps, ruff & pytest config
├── Dockerfile + docker-compose.yml   # Containerised runtime
├── README.md
├── .env.template                     # Copy to .env, fill YOUTUBE_API_KEY
│
├── youtube_analytics/                # Python package
│   ├── api/                          # HTTP layer split by resource
│   │   ├── __init__.py               # register_routes(app)
│   │   ├── deps.py                   # service singletons (db, fetcher)
│   │   ├── schemas.py                # Pydantic request/response models
│   │   ├── errors.py                 # JSON error handlers
│   │   ├── system.py                 # /, /favicon.ico, /api/health
│   │   ├── channels.py               # /api/channel/*
│   │   ├── videos.py                 # /api/video(s)/*
│   │   ├── statistics.py             # /api/statistics/*
│   │   └── background.py             # async fetch_channel_videos
│   ├── config.py                     # env vars, DB URL, log level
│   ├── database.py                   # SQLAlchemy models + DatabaseManager
│   ├── fetcher.py                    # YouTube Data API client
│   ├── visualizer.py                 # legacy server-side chart helpers
│   ├── static/                       # frontend assets (shipped with package)
│   │   ├── app.js, styles.css, favicon.ico
│   │   └── js/{channel,video,ui-enhancements}.js
│   └── templates/index.html
│
├── data/                             # SQLite DB (gitignored)
├── scripts/                          # run.sh / run.ps1 helpers
└── tests/                            # pytest suite (32 tests, all green)
```

## Getting started

### Run with Docker (recommended)

```bash
git clone https://github.com/sasank-in/creatorscope.git
cd creatorscope
echo "YOUTUBE_API_KEY=your_key_here" > .env
docker compose up
```

Open http://localhost:8000.

### Run locally with Python

```bash
git clone https://github.com/sasank-in/creatorscope.git
cd creatorscope
pip install -e ".[dev]"
cp .env.template .env  # edit YOUTUBE_API_KEY
python main_api.py
```

Requires Python 3.10+. Get a YouTube API key from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — enable the **YouTube Data API v3** for your project.

### Helper scripts

```bash
./scripts/run.sh 3000          # macOS / Linux
./scripts/run.ps1 -Port 3000   # Windows PowerShell
```

## Configuration reference

All settings come from environment variables (read by [config.py](youtube_analytics/config.py) via `python-dotenv`):

| Variable | Default | Description |
|---|---|---|
| `YOUTUBE_API_KEY` | *(required)* | YouTube Data API v3 key |
| `DATABASE_URL` | `sqlite:///data/youtube_analytics.db` | Full SQLAlchemy URL; set for Postgres |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` for Docker / LAN) |
| `CORS_ORIGINS` | `http://localhost:8000,http://127.0.0.1:8000` | Comma-separated allowlist |
| `CHANNEL_REFRESH_SECONDS` | `86400` | Skip YouTube refetch within this window |
| `TOP_VIDEOS_LIMIT` | `50` | Max videos fetched per channel |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `DB_ECHO` | `False` | Log every SQL statement |

## API endpoints

Routes are grouped by resource and mounted under `/api`. Health: `GET /api/health`.

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

Interactive OpenAPI docs live at http://127.0.0.1:8000/docs.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus the global filter input |
| `Esc` | Close channel detail / blur the current input |

## Development

### Run tests

```bash
pytest                # 32 tests, all green
pytest --cov          # with coverage
```

### Lint & format

```bash
ruff check .
ruff format .
```

### Switch to PostgreSQL

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/youtube_db
```

Tables are auto-created on first run. The lightweight `last_searched_at` migration in [database.py](youtube_analytics/database.py) is SQLite-only — for production Postgres you'll want Alembic.

## Architecture notes

- **Idempotent channel search.** Re-searching a channel within `CHANNEL_REFRESH_SECONDS` (default 24 h) returns the cached row instead of burning YouTube quota.
- **Quota awareness.** `search.list` for top videos costs 100 units/call (vs 1 for `playlistItems.list`). Lower `TOP_VIDEOS_LIMIT` if you hit the daily 10 000-unit cap.
- **No CORS gymnastics.** Frontend and API share the origin; the only CORS allowance is for explicitly listed origins via `CORS_ORIGINS`.
- **Decoupled video analysis.** Searching a video on the Videos page never triggers the channel-detail page's seven charts as a side-effect (a previous bug — see [commit history](https://github.com/sasank-in/creatorscope/commits/main)).
- **Friendly YouTube error messages.** `_humanize_error()` in [fetcher.py](youtube_analytics/fetcher.py) translates `<HttpError 400 ...>` into "YouTube API key is invalid. Check YOUTUBE_API_KEY in .env."

## Troubleshooting

- **Port already in use** — `python main_api.py 3001`
- **YouTube API quota exceeded** — default daily quota is 10 000 units. Lower `TOP_VIDEOS_LIMIT`.
- **`YOUTUBE_API_KEY not found`** — confirm `.env` is in the project root and the key is non-empty.
- **`ModuleNotFoundError: googleapiclient`** — `pip install -e .` (or check you're in the right venv).
- **DB shows old data** — channel search now skips refetch within 24 h. Override with `CHANNEL_REFRESH_SECONDS=0` to always refetch.

## License

MIT — see [LICENSE](LICENSE).
