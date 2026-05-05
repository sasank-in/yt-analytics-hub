"""Tests for the FastAPI HTTP layer.

The YouTube fetcher is replaced with a MagicMock via the `fake_fetcher` fixture
so no test ever hits the live API.
"""


def test_health_endpoint(app_client):
    response = app_client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "version" in body


def test_root_serves_html(app_client):
    response = app_client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert b"Creatorscope" in response.content


def test_static_assets_serve(app_client):
    for path in ("/static/styles.css", "/static/app.js", "/static/js/ui-enhancements.js"):
        r = app_client.get(path)
        assert r.status_code == 200, f"{path} returned {r.status_code}"


def test_get_channels_empty(app_client):
    response = app_client.get("/api/channels")
    assert response.status_code == 200
    body = response.json()
    assert body["channels"] == []
    assert body["count"] == 0


def test_channel_search_persists_to_db(app_client, fake_fetcher, sample_channel):
    fake_fetcher.get_channel_by_name.return_value = sample_channel
    response = app_client.post(
        "/api/channel/search",
        json={"query": "mocked", "search_type": "name"},
    )
    assert response.status_code == 200
    assert response.json()["channel_id"] == sample_channel["channel_id"]

    listing = app_client.get("/api/channels").json()
    assert listing["count"] == 1


def test_channel_search_returns_404_on_youtube_error(app_client, fake_fetcher):
    fake_fetcher.get_channel_by_name.return_value = {"error": "Channel not found"}
    response = app_client.post(
        "/api/channel/search",
        json={"query": "nope", "search_type": "name"},
    )
    assert response.status_code == 404


def test_get_channel_returns_404_when_missing(app_client):
    response = app_client.get("/api/channel/UCdoesnotexist")
    assert response.status_code == 404


def test_get_channel_returns_full_payload(app_client, fake_fetcher, sample_channel):
    fake_fetcher.get_channel_by_name.return_value = sample_channel
    app_client.post("/api/channel/search", json={"query": "x", "search_type": "name"})

    response = app_client.get(f"/api/channel/{sample_channel['channel_id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["channel"]["title"] == "Test Channel"
    assert "videos" in body
    assert "videos_count" in body


def test_video_search_get_parses_response(app_client, fake_fetcher, sample_video):
    fake_fetcher.get_video_by_id.return_value = sample_video
    response = app_client.get(f"/api/video/search?q={sample_video['video_id']}")
    assert response.status_code == 200
    body = response.json()
    assert len(body["videos"]) == 1
    assert body["videos"][0]["video_id"] == sample_video["video_id"]


def test_video_search_post_parses_response(app_client, fake_fetcher, sample_video):
    fake_fetcher.get_video_by_id.return_value = sample_video
    response = app_client.post(
        "/api/video/search",
        json={"video_id": sample_video["video_id"]},
    )
    assert response.status_code == 200
    assert response.json()["videos"][0]["video_id"] == sample_video["video_id"]


def test_rpm_get_default_is_null_for_unset(app_client, fake_fetcher, sample_channel):
    fake_fetcher.get_channel_by_name.return_value = sample_channel
    app_client.post("/api/channel/search", json={"query": "x", "search_type": "name"})

    response = app_client.get(f"/api/channel/{sample_channel['channel_id']}/rpm")
    assert response.status_code == 200
    assert response.json()["rpm"] is None


def test_rpm_put_validates_non_negative(app_client, fake_fetcher, sample_channel):
    fake_fetcher.get_channel_by_name.return_value = sample_channel
    app_client.post("/api/channel/search", json={"query": "x", "search_type": "name"})

    response = app_client.put(
        f"/api/channel/{sample_channel['channel_id']}/rpm",
        json={"rpm": -1.0},
    )
    assert response.status_code == 422  # Pydantic ge=0 violation


def test_rpm_put_persists_value(app_client, fake_fetcher, sample_channel):
    fake_fetcher.get_channel_by_name.return_value = sample_channel
    app_client.post("/api/channel/search", json={"query": "x", "search_type": "name"})

    put = app_client.put(
        f"/api/channel/{sample_channel['channel_id']}/rpm",
        json={"rpm": 4.25},
    )
    assert put.status_code == 200
    get = app_client.get(f"/api/channel/{sample_channel['channel_id']}/rpm")
    assert get.json()["rpm"] == 4.25


def test_delete_channel(app_client, fake_fetcher, sample_channel):
    fake_fetcher.get_channel_by_name.return_value = sample_channel
    app_client.post("/api/channel/search", json={"query": "x", "search_type": "name"})

    response = app_client.delete(f"/api/channel/{sample_channel['channel_id']}")
    assert response.status_code == 200
    assert app_client.get("/api/channels").json()["count"] == 0
