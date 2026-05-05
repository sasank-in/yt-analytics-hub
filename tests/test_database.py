"""Tests for the SQLAlchemy database layer."""


def test_add_and_get_channel(db, sample_channel):
    db.add_channel(sample_channel)
    fetched = db.get_channel(sample_channel["channel_id"])
    assert fetched is not None
    assert fetched["title"] == "Test Channel"
    assert fetched["subscribers"] == "12345"


def test_add_channel_is_upsert(db, sample_channel):
    db.add_channel(sample_channel)
    updated = {**sample_channel, "title": "Renamed Channel", "subscribers": "20000"}
    db.add_channel(updated)
    fetched = db.get_channel(sample_channel["channel_id"])
    assert fetched["title"] == "Renamed Channel"
    assert fetched["subscribers"] == "20000"


def test_get_channel_missing_returns_none(db):
    assert db.get_channel("UCdoesnotexist") is None


def test_add_and_get_video(db, sample_channel, sample_video):
    db.add_channel(sample_channel)  # videos require a parent channel
    db.add_video(sample_video)
    fetched = db.get_video(sample_video["video_id"])
    assert fetched is not None
    assert fetched["title"] == "Sample video"


def test_get_channel_videos_filters_by_channel(db, sample_channel, sample_video):
    db.add_channel(sample_channel)
    db.add_video(sample_video)
    videos = db.get_channel_videos(sample_channel["channel_id"])
    assert len(videos) == 1
    assert videos[0]["video_id"] == sample_video["video_id"]


def test_delete_channel_cascades_to_videos(db, sample_channel, sample_video):
    db.add_channel(sample_channel)
    db.add_video(sample_video)
    db.delete_channel(sample_channel["channel_id"])
    assert db.get_channel(sample_channel["channel_id"]) is None
    assert db.get_video(sample_video["video_id"]) is None


def test_get_statistics_aggregates_video_metrics(db, sample_channel, sample_video):
    db.add_channel(sample_channel)
    db.add_video(sample_video)
    db.add_video({**sample_video, "video_id": "vid_xyz", "views": "300000", "likes": "12000"})
    stats = db.get_statistics(sample_channel["channel_id"])
    assert stats["total_videos"] == 2
    assert stats["total_views"] == 450000
    assert stats["total_likes"] == 20000
    assert stats["avg_views"] == 225000


def test_private_metrics_treated_as_zero(db, sample_channel, sample_video):
    db.add_channel(sample_channel)
    db.add_video({**sample_video, "likes": "Private", "comments": "Private"})
    stats = db.get_statistics(sample_channel["channel_id"])
    assert stats["total_likes"] == 0
    assert stats["total_comments"] == 0


def test_rpm_default_and_update(db, sample_channel):
    db.add_channel(sample_channel)
    assert db.get_channel_rpm(sample_channel["channel_id"]) is None
    result = db.set_channel_rpm(sample_channel["channel_id"], 3.5)
    assert result["success"] is True
    assert db.get_channel_rpm(sample_channel["channel_id"]) == 3.5


def test_get_all_channels_returns_list(db, sample_channel):
    assert db.get_all_channels() == []
    db.add_channel(sample_channel)
    db.add_channel({**sample_channel, "channel_id": "UCtest456", "title": "Another"})
    channels = db.get_all_channels()
    assert len(channels) == 2
    titles = {c["title"] for c in channels}
    assert titles == {"Test Channel", "Another"}
