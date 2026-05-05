# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Creatorscope — multi-stage build
#
#   docker build -t creatorscope .
#   docker run --rm -p 8000:8000 -e YOUTUBE_API_KEY=xxx -v $(pwd)/data:/app/data creatorscope
# ---------------------------------------------------------------------------

FROM python:3.12-slim AS builder
WORKDIR /app

# System deps for building wheels (needs gcc for some transitive deps).
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY youtube_analytics/ ./youtube_analytics/
COPY main_api.py ./

RUN pip install --no-cache-dir --upgrade pip wheel \
    && pip wheel --no-cache-dir --wheel-dir /wheels -e .


# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

# Run as a non-root user.
RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app

WORKDIR /app

COPY --from=builder /wheels /wheels
COPY pyproject.toml README.md ./
COPY youtube_analytics/ ./youtube_analytics/
COPY main_api.py ./

RUN pip install --no-cache-dir --no-index --find-links=/wheels -e . \
    && rm -rf /wheels \
    && mkdir -p /app/data \
    && chown -R app:app /app

USER app

ENV HOST=0.0.0.0 \
    PORT=8000 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health', timeout=3).status==200 else 1)"

CMD ["python", "main_api.py"]
