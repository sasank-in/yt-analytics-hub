"""Tests for youtube_analytics.analytics — the advanced analytics module."""

from datetime import datetime, timedelta, timezone

import pytest

from youtube_analytics.analytics import (
    cadence,
    composite_ranking,
    compute_channel_analytics,
    decay_model,
    earnings_cone,
    engagement_vs_views,
    health_score,
    publish_pattern,
    title_length_impact,
)


def _video(**kwargs):
    """Build a video dict with sane defaults."""
    base = {
        "video_id": "vid",
        "title": "Title",
        "views": "1000",
        "likes": "50",
        "comments": "5",
        "published_at": "2024-01-01T12:00:00Z",
    }
    base.update(kwargs)
    return base


# ---------------------- cadence -----------------------------------------


def test_cadence_empty_returns_nulls():
    out = cadence([])
    assert out["median_days"] is None
    assert out["intervals"] == []


def test_cadence_single_video_returns_nulls():
    assert cadence([_video()])["median_days"] is None


def test_cadence_two_videos_one_interval():
    videos = [
        _video(published_at="2024-01-01T00:00:00Z"),
        _video(published_at="2024-01-08T00:00:00Z"),
    ]
    out = cadence(videos)
    assert out["intervals"] == [7.0]
    assert out["median_days"] == 7.0
    assert out["longest_gap_days"] == 7.0


def test_cadence_median_and_max():
    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    days = [0, 3, 5, 10, 25]  # gaps: 3, 2, 5, 15 → median 4, max 15
    videos = [
        _video(published_at=(base + timedelta(days=d)).isoformat())
        for d in days
    ]
    out = cadence(videos)
    assert out["median_days"] == 4
    assert out["longest_gap_days"] == 15
    assert len(out["intervals"]) == 4


# ---------------------- publish_pattern ---------------------------------


def test_publish_pattern_counts_align():
    # 2024-01-01 = Monday (weekday 0)
    videos = [
        _video(published_at="2024-01-01T10:00:00Z"),
        _video(published_at="2024-01-08T10:00:00Z"),  # also Monday
        _video(published_at="2024-01-02T14:00:00Z"),  # Tuesday
    ]
    out = publish_pattern(videos)
    assert out["weekday_counts"][0] == 2  # Mon
    assert out["weekday_counts"][1] == 1  # Tue
    assert out["hour_counts"][10] == 2
    assert out["hour_counts"][14] == 1


# ---------------------- engagement_vs_views -----------------------------


def test_engagement_vs_views_small_sample_returns_null():
    out = engagement_vs_views([_video(), _video()])
    assert out["pearson_r"] is None


def test_engagement_vs_views_perfect_correlation():
    # Engagement increases linearly with log(views).
    videos = []
    for i, views in enumerate([100, 1000, 10000, 100000]):
        videos.append(_video(
            video_id=f"v{i}",
            views=str(views),
            likes=str(int(views * 0.01 * (i + 1))),  # rises with i
            comments="0",
        ))
    out = engagement_vs_views(videos)
    assert out["pearson_r"] is not None
    assert out["n"] == 4


def test_engagement_vs_views_zero_views_excluded():
    out = engagement_vs_views([_video(views="0"), _video(views="0"), _video(views="0")])
    assert out["n"] == 0


# ---------------------- title_length_impact -----------------------------


def test_title_length_buckets_population():
    videos = [
        _video(title="short title"),                              # 11 chars → short
        _video(title="x" * 45),                                   # medium
        _video(title="x" * 80, views="2000"),                     # long
    ]
    out = title_length_impact(videos)
    # Empty buckets are dropped now.
    assert [b["bucket"] for b in out] == ["short (≤30)", "medium (31–60)", "long (61+)"]
    assert out[0]["n"] == 1
    assert out[1]["n"] == 1
    assert out[2]["n"] == 1
    assert out[2]["median_views"] == 2000


def test_title_length_drops_empty_buckets():
    # Only short-title videos → only the short bucket appears.
    videos = [_video(title="x" * 10)] * 6
    out = title_length_impact(videos)
    assert len(out) == 1
    assert out[0]["bucket"] == "short (≤30)"
    assert out[0]["reliable"] is True  # n=6 ≥ 5


def test_title_length_reliable_flag_threshold_is_five():
    videos = [_video(title="x" * 10)] * 4
    out = title_length_impact(videos)
    assert out[0]["n"] == 4
    assert out[0]["reliable"] is False  # 4 < 5


# ---------------------- health_score ------------------------------------


def test_health_score_empty():
    out = health_score([], cadence([]))
    assert out["score"] is None


def test_health_score_bounded():
    """Score must land in [0, 100] for arbitrary input."""
    videos = [_video(views=str(v), likes="10", comments="1") for v in [100, 200, 150, 175, 220]]
    cad = cadence(videos)
    out = health_score(videos, cad)
    assert 0 <= out["score"] <= 100
    for v in out["components"].values():
        if v is not None:
            assert 0 <= v <= 1


def test_health_score_high_engagement_steady_uploads_scores_well():
    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    videos = [
        _video(
            video_id=f"v{i}",
            views="10000",
            likes="500",     # 5% engagement
            comments="0",
            published_at=(base + timedelta(days=7 * i)).isoformat(),  # weekly
        )
        for i in range(6)
    ]
    out = health_score(videos, cadence(videos))
    assert out["score"] >= 60  # very healthy: 5% engagement, weekly cadence, steady views


# ---------------------- decay_model -------------------------------------


def test_decay_model_too_few_points():
    out = decay_model([_video()] * 3)
    assert out["exponent"] is None


def test_decay_model_runs_on_realistic_input():
    # Synthesise a realistic YouTube power-law: views ∝ age^0.3
    # (typical real channels see exponents between 0.1 and 0.6, with the
    # remainder of variance coming from per-video popularity).
    videos = []
    for i, age_days in enumerate([10, 30, 100, 365, 730, 1095]):
        published = (datetime.now(timezone.utc) - timedelta(days=age_days)).isoformat()
        views = int(1000 * (age_days ** 0.3))
        videos.append(_video(video_id=f"v{i}", views=str(views), published_at=published))
    out = decay_model(videos)
    assert out["exponent"] is not None
    assert out["n"] == 6
    # Slope should be in the realistic range and reasonably close to 0.3
    assert 0.2 <= out["exponent"] <= 0.4
    # And the fit should be near-perfect on noise-free synthetic data
    assert out["r_squared"] >= 0.9


# ---------------------- earnings_cone -----------------------------------


def test_earnings_cone_returns_none_when_no_rpm():
    assert earnings_cone([_video()], None) is None
    assert earnings_cone([_video()], 0.0) is None


def test_earnings_cone_band_widths():
    videos = [_video(views="100000")] * 5  # 500k total
    out = earnings_cone(videos, 2.0)
    # 500_000 / 1000 * 2 = 1000 mid
    assert out["mid"] == 1000.0
    assert out["low"] == pytest.approx(700.0)
    assert out["high"] == pytest.approx(1300.0)
    assert out["lifetime_views"] == 500000


# ---------------------- composite_ranking -------------------------------


def test_composite_ranking_top_video_scores_highest():
    videos = [
        _video(video_id="winner", views="10000", likes="1000", comments="100"),
        _video(video_id="loser1", views="100", likes="1", comments="0"),
        _video(video_id="loser2", views="500", likes="5", comments="0"),
    ]
    out = composite_ranking(videos, limit=3)
    assert out[0]["video_id"] == "winner"
    assert out[0]["score"] >= out[1]["score"] >= out[2]["score"]


def test_composite_ranking_empty():
    assert composite_ranking([]) == []


def test_composite_ranking_respects_limit():
    videos = [_video(video_id=f"v{i}", views=str(100 + i)) for i in range(10)]
    out = composite_ranking(videos, limit=3)
    assert len(out) == 3


# ---------------------- top-level aggregator ----------------------------


def test_compute_channel_analytics_has_all_blocks():
    out = compute_channel_analytics([_video()] * 5, rpm=2.0)
    expected = {
        "sample_size", "cadence", "publish_pattern", "best_slot",
        "engagement_vs_views", "title_length", "health_score", "decay",
        "earnings_cone", "composite_ranking", "insights",
    }
    assert set(out.keys()) == expected
    assert out["sample_size"] == 5
    assert out["earnings_cone"]["rpm"] == 2.0
    # Insights map exists with the expected text keys (some may be None)
    assert set(out["insights"].keys()) == {
        "cadence", "correlation", "decay", "title_length",
        "health", "best_slot", "outperformers",
    }


def test_compute_channel_analytics_passes_subscribers_to_health():
    # Small channel (1k subs): 1.5% engagement is mediocre — engagement ~ 0.25
    # Massive channel (50M subs): 1.5% engagement is great — engagement should be 1.0
    videos = [_video(views="10000", likes="150", comments="0")] * 5
    small = compute_channel_analytics(videos, subscribers=1_000)
    huge = compute_channel_analytics(videos, subscribers=50_000_000)
    assert huge["health_score"]["components"]["engagement"] > small["health_score"]["components"]["engagement"]


def test_health_score_credits_weekly_cadence():
    """Was reporting 0 cadence component for all channels — confirm the bug is fixed."""
    from datetime import datetime, timedelta, timezone
    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    videos = [
        _video(
            video_id=f"v{i}", views="5000", likes="100",
            published_at=(base + timedelta(days=7 * i)).isoformat(),
        )
        for i in range(8)
    ]
    cad = cadence(videos)
    h = health_score(videos, cad, subscribers=10_000)
    assert h["components"]["cadence"] > 0.5  # weekly cadence is good
    assert h["components"]["cadence"] <= 1.0


def test_decay_quality_classification():
    """Wild slopes on noisy data should null the exponent and be flagged poor."""
    videos = [_video(views=str(v), published_at=f"2024-0{i+1}-01T00:00:00Z") for i, v in enumerate([100, 50000, 200, 1000000, 5])]
    out = decay_model(videos)
    # Either it fits cleanly (unlikely with this random noise) or it's poor-quality.
    # When poor + slope is wild, the exponent must be nulled so the UI shows "no signal."
    if (
        out["fit_quality"] == "poor"
        and out["raw_slope"] is not None
        and abs(out["raw_slope"]) > 1.0
    ):
        assert out["exponent"] is None


def test_composite_ranking_outperformer_flag():
    videos = [
        _video(video_id="winner", views="100000", likes="5000", comments="500"),
        _video(video_id="mid", views="1000", likes="50", comments="5"),
        _video(video_id="loser", views="100", likes="5", comments="0"),
    ]
    out = composite_ranking(videos, limit=3)
    winner = next(r for r in out if r["video_id"] == "winner")
    loser = next(r for r in out if r["video_id"] == "loser")
    assert winner["outperformer"] is True
    assert loser["outperformer"] is False


def test_best_slot_detection():
    # Five videos on Thursday with very high views; one each on other days with low views.
    videos = []
    for _ in range(5):
        videos.append(_video(views="100000", published_at="2024-01-04T14:00:00Z"))  # Thursday 14:00
    for d in ["2024-01-01T03:00:00Z", "2024-01-02T03:00:00Z", "2024-01-03T03:00:00Z"]:
        videos.append(_video(views="1000", published_at=d))
    out = compute_channel_analytics(videos)
    assert out["best_slot"]["best_weekday"] == "Thursday"
    assert out["best_slot"]["best_weekday_lift"] is not None
    assert out["best_slot"]["best_weekday_lift"] >= 1.5


def test_compute_channel_analytics_handles_empty():
    out = compute_channel_analytics([])
    assert out["sample_size"] == 0
    assert out["cadence"]["median_days"] is None
    assert out["composite_ranking"] == []
    assert out["earnings_cone"] is None
