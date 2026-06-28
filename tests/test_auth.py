"""Tests for the opt-in X-API-Key auth."""

import sys


def _reset_modules():
    for mod in list(sys.modules):
        if mod == "main_api" or mod.startswith("youtube_analytics"):
            sys.modules.pop(mod, None)


def _client_with_auth_enabled(tmp_path, monkeypatch, key="secret-test-key"):
    monkeypatch.setenv("APP_API_KEY", key)
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/auth.db")
    monkeypatch.setenv("RATE_LIMIT_DISABLED", "1")
    _reset_modules()

    from fastapi.testclient import TestClient

    import main_api
    return TestClient(main_api.app), key


def test_auth_disabled_by_default(app_client):
    """No APP_API_KEY set in conftest → /api/channels is open."""
    assert app_client.get("/api/channels").status_code == 200


def test_health_endpoint_open_even_with_auth_on(tmp_path, monkeypatch):
    client, _ = _client_with_auth_enabled(tmp_path, monkeypatch)
    try:
        assert client.get("/api/health").status_code == 200
    finally:
        monkeypatch.delenv("APP_API_KEY", raising=False)
        _reset_modules()


def test_protected_endpoint_returns_401_without_header(tmp_path, monkeypatch):
    client, _ = _client_with_auth_enabled(tmp_path, monkeypatch)
    try:
        r = client.get("/api/channels")
        assert r.status_code == 401
        assert "X-API-Key" in r.headers.get("WWW-Authenticate", "")
    finally:
        monkeypatch.delenv("APP_API_KEY", raising=False)
        _reset_modules()


def test_protected_endpoint_returns_401_with_wrong_key(tmp_path, monkeypatch):
    client, _ = _client_with_auth_enabled(tmp_path, monkeypatch)
    try:
        r = client.get("/api/channels", headers={"X-API-Key": "wrong"})
        assert r.status_code == 401
    finally:
        monkeypatch.delenv("APP_API_KEY", raising=False)
        _reset_modules()


def test_protected_endpoint_passes_with_correct_key(tmp_path, monkeypatch):
    client, key = _client_with_auth_enabled(tmp_path, monkeypatch)
    try:
        r = client.get("/api/channels", headers={"X-API-Key": key})
        assert r.status_code == 200
    finally:
        monkeypatch.delenv("APP_API_KEY", raising=False)
        _reset_modules()


def test_root_html_open_even_with_auth_on(tmp_path, monkeypatch):
    """The frontend shell must load so the user can prompt + enter their key."""
    client, _ = _client_with_auth_enabled(tmp_path, monkeypatch)
    try:
        assert client.get("/").status_code == 200
        assert client.get("/static/styles.css").status_code == 200
    finally:
        monkeypatch.delenv("APP_API_KEY", raising=False)
        _reset_modules()
