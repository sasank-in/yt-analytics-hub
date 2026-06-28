"""Tests for /api/channels and /api/videos pagination."""

from unittest.mock import MagicMock


def _seed_channels(app_client, fake_fetcher, n, sample_channel):
    for i in range(n):
        ch = dict(sample_channel, channel_id=f"UCseed{i:03d}", title=f"Channel {i}")
        fake_fetcher.get_channel_by_name.return_value = ch
        app_client.post("/api/channel/search", json={"query": ch["title"], "search_type": "name"})


def test_channels_default_page_envelope(app_client, fake_fetcher, sample_channel):
    _seed_channels(app_client, fake_fetcher, 5, sample_channel)
    r = app_client.get("/api/channels")
    body = r.json()
    assert r.status_code == 200
    # New envelope
    assert body["total"] == 5
    assert body["page"] == 1
    assert body["pages"] == 1
    assert body["size"] == 50
    assert len(body["items"]) == 5
    # Legacy keys kept
    assert body["count"] == 5
    assert len(body["channels"]) == 5


def test_channels_pagination_slices(app_client, fake_fetcher, sample_channel):
    _seed_channels(app_client, fake_fetcher, 7, sample_channel)
    r = app_client.get("/api/channels?page=2&size=3")
    body = r.json()
    assert body["total"] == 7
    assert body["page"] == 2
    assert body["pages"] == 3  # ceil(7/3)
    assert body["size"] == 3
    assert len(body["items"]) == 3


def test_channels_pagination_last_page_partial(app_client, fake_fetcher, sample_channel):
    _seed_channels(app_client, fake_fetcher, 7, sample_channel)
    r = app_client.get("/api/channels?page=3&size=3")
    body = r.json()
    assert len(body["items"]) == 1


def test_channels_pagination_invalid_size_rejected(app_client):
    assert app_client.get("/api/channels?size=0").status_code == 422
    assert app_client.get("/api/channels?size=9999").status_code == 422
    assert app_client.get("/api/channels?page=0").status_code == 422


def test_videos_pagination_envelope(app_client, fake_fetcher, sample_channel, sample_video):
    fake_fetcher.get_channel_by_name.return_value = sample_channel
    app_client.post("/api/channel/search", json={"query": "x", "search_type": "name"})

    fake_fetcher.get_video_by_id = MagicMock(side_effect=lambda vid: dict(sample_video, video_id=vid))
    for i in range(4):
        app_client.get(f"/api/video/search?q=vid_{i:03d}")

    r = app_client.get("/api/videos?page=1&size=2")
    body = r.json()
    assert r.status_code == 200
    assert body["total"] == 4
    assert body["page"] == 1
    assert body["pages"] == 2
    assert body["size"] == 2
    assert len(body["items"]) == 2
    assert len(body["videos"]) == 2
    assert body["count"] == 4


def test_videos_pagination_empty_table(app_client):
    r = app_client.get("/api/videos")
    body = r.json()
    assert body["total"] == 0
    assert body["pages"] == 1
    assert body["items"] == []
