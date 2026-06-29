"""Tests for the YouTube fetcher's parsing, error humanization, and
chronological-vs-top fetch strategies."""

from unittest.mock import MagicMock, patch

import pytest
from googleapiclient.errors import HttpError


def make_http_error(message: str, status: int = 400) -> HttpError:
    """Build a googleapiclient HttpError carrying a JSON body."""
    body = (
        '{"error": {"code": '
        + str(status)
        + ', "message": "' + message + '"}}'
    ).encode()
    resp = MagicMock(status=status, reason="Bad Request")
    return HttpError(resp=resp, content=body)


def test_humanize_invalid_api_key():
    from youtube_analytics.fetcher import _humanize_error

    err = make_http_error("API key not valid. Please pass a valid API key.", 400)
    assert "invalid" in _humanize_error(err).lower()


def test_humanize_quota_exceeded():
    from youtube_analytics.fetcher import _humanize_error

    err = make_http_error("The request cannot be completed because you have exceeded your quota.", 403)
    assert "quota" in _humanize_error(err).lower()


def test_humanize_not_found():
    from youtube_analytics.fetcher import _humanize_error

    err = make_http_error("Video not found", 404)
    assert "not found" in _humanize_error(err).lower()


def test_humanize_falls_back_to_str_on_non_http_error():
    from youtube_analytics.fetcher import _humanize_error

    assert _humanize_error(ValueError("plain text")) == "plain text"


def test_parse_video_response_extracts_fields():
    from youtube_analytics.fetcher import YouTubeFetcher

    fetcher = YouTubeFetcher.__new__(YouTubeFetcher)  # skip __init__/auth
    response = {
        "items": [{
            "id": "vid123",
            "snippet": {
                "title": "Test",
                "description": "Hello world",
                "channelId": "UCabc",
                "channelTitle": "Channel",
                "publishedAt": "2024-01-01T00:00:00Z",
                "thumbnails": {"high": {"url": "https://example/img.jpg"}},
            },
            "statistics": {"viewCount": "100", "likeCount": "5", "commentCount": "1"},
            "contentDetails": {"duration": "PT10S"},
        }]
    }
    parsed = fetcher._parse_video_response(response)
    assert parsed["video_id"] == "vid123"
    assert parsed["views"] == "100"
    assert parsed["channel_title"] == "Channel"


def test_parse_video_response_handles_empty_items():
    from youtube_analytics.fetcher import YouTubeFetcher

    fetcher = YouTubeFetcher.__new__(YouTubeFetcher)
    parsed = fetcher._parse_video_response({"items": []})
    assert "error" in parsed


@pytest.mark.parametrize("missing_stat", ["likeCount", "commentCount"])
def test_parse_video_response_treats_missing_stats_as_private(missing_stat):
    from youtube_analytics.fetcher import YouTubeFetcher

    fetcher = YouTubeFetcher.__new__(YouTubeFetcher)
    stats = {"viewCount": "100", "likeCount": "5", "commentCount": "1"}
    stats.pop(missing_stat)
    response = {
        "items": [{
            "id": "vid123",
            "snippet": {
                "title": "T",
                "description": "",
                "channelId": "UCabc",
                "channelTitle": "C",
                "publishedAt": "2024-01-01T00:00:00Z",
                "thumbnails": {"high": {"url": "x"}},
            },
            "statistics": stats,
            "contentDetails": {"duration": "PT10S"},
        }]
    }
    parsed = fetcher._parse_video_response(response)
    field = "likes" if missing_stat == "likeCount" else "comments"
    assert parsed[field] == "Private"


# ---------- chronological fetcher (get_channel_recent_videos) ----------


def _build_fake_youtube(channel_response, playlist_pages, videos_responses):
    """Build a chained MagicMock that mimics the googleapiclient client.

    youtube.channels().list(...).execute() → channel_response
    youtube.playlistItems().list(...).execute() → next page from playlist_pages
    youtube.videos().list(...).execute() → next item from videos_responses
    """
    yt = MagicMock()

    channels_chain = MagicMock()
    channels_chain.execute.return_value = channel_response
    yt.channels.return_value.list.return_value = channels_chain

    playlist_iter = iter(playlist_pages)
    def playlist_list(**_kwargs):
        m = MagicMock()
        m.execute.return_value = next(playlist_iter)
        return m
    yt.playlistItems.return_value.list.side_effect = playlist_list

    videos_iter = iter(videos_responses)
    def videos_list(**_kwargs):
        m = MagicMock()
        m.execute.return_value = next(videos_iter)
        return m
    yt.videos.return_value.list.side_effect = videos_list
    return yt


def _make_video_item(vid, title="t", views="100", published="2024-01-01T00:00:00Z"):
    return {
        "id": vid,
        "snippet": {
            "title": title,
            "description": "",
            "channelId": "UCabc",
            "channelTitle": "Channel",
            "publishedAt": published,
            "thumbnails": {"high": {"url": "x"}},
        },
        "statistics": {"viewCount": views, "likeCount": "5", "commentCount": "1"},
        "contentDetails": {"duration": "PT10S"},
    }


def test_recent_videos_preserves_chronological_order():
    """videos.list returns items in arbitrary order; we must re-sort by the
    playlist's (newest-first) sequence."""
    from youtube_analytics.fetcher import YouTubeFetcher

    fetcher = YouTubeFetcher.__new__(YouTubeFetcher)
    fetcher.youtube = _build_fake_youtube(
        channel_response={
            "items": [{"contentDetails": {"relatedPlaylists": {"uploads": "UU_x5"}}}],
        },
        playlist_pages=[{
            "items": [
                {"snippet": {"resourceId": {"videoId": "v_newest"}}},
                {"snippet": {"resourceId": {"videoId": "v_middle"}}},
                {"snippet": {"resourceId": {"videoId": "v_oldest"}}},
            ],
            "nextPageToken": None,
        }],
        # videos.list returns them shuffled — we should still get newest first.
        videos_responses=[{
            "items": [
                _make_video_item("v_middle"),
                _make_video_item("v_oldest"),
                _make_video_item("v_newest"),
            ],
        }],
    )

    videos = fetcher.get_channel_recent_videos("UC_x5", max_results=10)
    assert [v["video_id"] for v in videos] == ["v_newest", "v_middle", "v_oldest"]


def test_recent_videos_paginates_until_max_results():
    """Two pages of 50 + one of 30 → return exactly max_results."""
    from youtube_analytics.fetcher import YouTubeFetcher

    fetcher = YouTubeFetcher.__new__(YouTubeFetcher)
    page1 = {
        "items": [{"snippet": {"resourceId": {"videoId": f"p1v{i}"}}} for i in range(50)],
        "nextPageToken": "PAGE2",
    }
    page2 = {
        "items": [{"snippet": {"resourceId": {"videoId": f"p2v{i}"}}} for i in range(50)],
        "nextPageToken": None,
    }
    fetcher.youtube = _build_fake_youtube(
        channel_response={
            "items": [{"contentDetails": {"relatedPlaylists": {"uploads": "UU"}}}],
        },
        playlist_pages=[page1, page2],
        videos_responses=[
            {"items": [_make_video_item(f"p1v{i}") for i in range(50)]},
            {"items": [_make_video_item(f"p2v{i}") for i in range(50)]},
        ],
    )

    videos = fetcher.get_channel_recent_videos("UC", max_results=75)
    assert len(videos) == 75
    # First 50 from page1, next 25 from page2
    assert videos[0]["video_id"] == "p1v0"
    assert videos[49]["video_id"] == "p1v49"
    assert videos[50]["video_id"] == "p2v0"
    assert videos[74]["video_id"] == "p2v24"


def test_recent_videos_handles_missing_channel():
    from youtube_analytics.fetcher import YouTubeFetcher

    fetcher = YouTubeFetcher.__new__(YouTubeFetcher)
    fetcher.youtube = _build_fake_youtube(
        channel_response={"items": []},
        playlist_pages=[],
        videos_responses=[],
    )
    result = fetcher.get_channel_recent_videos("UCmissing")
    assert "error" in result


def test_recent_videos_returns_debug_when_requested():
    from youtube_analytics.fetcher import YouTubeFetcher

    fetcher = YouTubeFetcher.__new__(YouTubeFetcher)
    fetcher.youtube = _build_fake_youtube(
        channel_response={
            "items": [{"contentDetails": {"relatedPlaylists": {"uploads": "UU"}}}],
        },
        playlist_pages=[{"items": [], "nextPageToken": None}],
        videos_responses=[],
    )
    result = fetcher.get_channel_recent_videos("UC", max_results=10, return_debug=True)
    assert "debug" in result
    assert result["debug"]["source"] == "playlistItems"


def test_background_task_uses_recent_strategy_by_default(monkeypatch, sample_video):
    """Default VIDEO_FETCH_STRATEGY=recent → chronological method is called."""
    monkeypatch.setenv("VIDEO_FETCH_STRATEGY", "recent")
    from youtube_analytics.api import background

    fake_fetcher = MagicMock()
    fake_fetcher.get_channel_recent_videos.return_value = [sample_video]
    fake_fetcher.get_channel_top_videos.return_value = []
    fake_db = MagicMock()
    fake_db.delete_channel_videos.return_value = None
    fake_db.add_video.return_value = {"success": True}

    with patch("youtube_analytics.api.background.get_fetcher", return_value=fake_fetcher), \
         patch("youtube_analytics.api.background.get_db", return_value=fake_db):
        result = background.fetch_channel_videos("UC_x5")

    assert fake_fetcher.get_channel_recent_videos.called
    assert not fake_fetcher.get_channel_top_videos.called
    assert result["saved"] == 1
    assert result["strategy"] == "recent"


def test_background_task_top_strategy_routes_correctly(monkeypatch, sample_video):
    monkeypatch.setenv("VIDEO_FETCH_STRATEGY", "top")
    from youtube_analytics.api import background

    fake_fetcher = MagicMock()
    fake_fetcher.get_channel_top_videos.return_value = [sample_video]
    fake_fetcher.get_channel_recent_videos.return_value = []
    fake_db = MagicMock()
    fake_db.delete_channel_videos.return_value = None
    fake_db.add_video.return_value = {"success": True}

    with patch("youtube_analytics.api.background.get_fetcher", return_value=fake_fetcher), \
         patch("youtube_analytics.api.background.get_db", return_value=fake_db):
        result = background.fetch_channel_videos("UC_x5")

    assert fake_fetcher.get_channel_top_videos.called
    assert not fake_fetcher.get_channel_recent_videos.called
    assert result["strategy"] == "top"
