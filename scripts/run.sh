#!/usr/bin/env bash
# Run the YouTube Analytics API server.
# Usage: ./scripts/run.sh [port]
set -euo pipefail

PORT="${1:-8000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${YOUTUBE_API_KEY:-}" ]; then
    echo "warning: YOUTUBE_API_KEY is not set; channel/video lookups will fail until it is." >&2
fi

exec python main_api.py "$PORT"
