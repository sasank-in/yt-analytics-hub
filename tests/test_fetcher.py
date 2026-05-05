"""Tests for the YouTube fetcher's parsing and error humanization."""

from unittest.mock import MagicMock

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
