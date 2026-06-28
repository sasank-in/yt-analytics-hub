"""Tests that the rate limiter is wired correctly and bypassed in tests."""

import sys


def _reset_modules():
    for mod in list(sys.modules):
        if mod == "main_api" or mod.startswith("youtube_analytics"):
            sys.modules.pop(mod, None)


def test_rate_limit_disabled_by_default_in_tests(app_client):
    """conftest sets RATE_LIMIT_DISABLED=1, so 100 calls in a row should pass."""
    for _ in range(100):
        r = app_client.get("/api/health")
        assert r.status_code == 200


def test_rate_limit_module_reads_env(tmp_path, monkeypatch, sample_channel):
    """When RATE_LIMIT_DISABLED is unset, the limiter is enabled."""
    monkeypatch.delenv("RATE_LIMIT_DISABLED", raising=False)
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/t.db")
    # Squeeze the limit so we can hit it without 31 calls
    monkeypatch.setenv("RATE_LIMIT_CHANNEL_SEARCH", "2/minute")
    _reset_modules()

    import importlib as _il
    rl = _il.import_module("youtube_analytics.api.rate_limit")
    assert rl.limiter.enabled is True
    assert rl.LIMITS["channel_search"] == "2/minute"

    # Restore for the rest of the suite
    monkeypatch.setenv("RATE_LIMIT_DISABLED", "1")
    _reset_modules()


def test_rate_limit_enforced_when_enabled(tmp_path, monkeypatch, sample_channel):
    """Spin up the app with limiter ENABLED + a tiny limit, verify 429."""
    monkeypatch.delenv("RATE_LIMIT_DISABLED", raising=False)
    monkeypatch.setenv("RATE_LIMIT_CHANNEL_SEARCH", "2/minute")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/rl.db")
    _reset_modules()

    from unittest.mock import MagicMock

    from fastapi.testclient import TestClient

    from youtube_analytics.api import deps
    deps.get_fetcher.cache_clear()
    deps.get_db.cache_clear()
    fake = MagicMock()
    fake.get_channel_by_name.return_value = sample_channel
    deps.get_fetcher = lambda: fake  # type: ignore[assignment]

    # Re-import the api submodules with new deps + limiter
    for mod in list(sys.modules):
        if mod.startswith("youtube_analytics.api") and mod != "youtube_analytics.api.deps":
            sys.modules.pop(mod, None)
    sys.modules.pop("main_api", None)

    import main_api
    client = TestClient(main_api.app)

    payload = {"query": "x", "search_type": "name"}
    assert client.post("/api/channel/search", json=payload).status_code == 200
    assert client.post("/api/channel/search", json=payload).status_code == 200
    third = client.post("/api/channel/search", json=payload)
    assert third.status_code == 429
    assert "Retry-After" in third.headers

    # Restore
    monkeypatch.setenv("RATE_LIMIT_DISABLED", "1")
    _reset_modules()
