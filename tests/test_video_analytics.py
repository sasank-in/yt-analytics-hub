"""Tests for youtube_analytics.video_analytics (per-video analytics)."""

from datetime import datetime, timedelta, timezone

from youtube_analytics.video_analytics import compute_video_analytics


def _v(**kwargs):
    base = {
        "video_id": "this",
        "title":    "This video",
        "views":    "10000",
        "likes":    "500",
        "comments": "50",
        "published_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),
    }
    base.update(kwargs)
    return base


# ---------- structure ------------------------------------------------------


def test_returns_full_envelope_with_no_siblings():
    out = compute_video_analytics(_v(), channel_videos=[])
    assert set(out.keys()) == {
        "video_id", "title", "age_days", "rates",
        "vs_channel", "verdict", "earnings", "insights",
    }
    # No siblings → vs_channel fields are null, verdict is slate
    assert out["vs_channel"]["n_siblings"] == 0
    assert out["vs_channel"]["views_pctile"] is None
    assert out["verdict"]["label"] == "Not enough data"


def test_age_days_computed_from_published_at():
    published = datetime.now(timezone.utc) - timedelta(days=45)
    out = compute_video_analytics(_v(published_at=published.isoformat()), [])
    assert 44 <= out["age_days"] <= 46


def test_age_days_floor_at_one_for_missing_date():
    out = compute_video_analytics(_v(published_at=None), [])
    assert out["age_days"] == 1


# ---------- rates ---------------------------------------------------------


def test_rates_per_day():
    # 30 days old, 10000 views → ~333/day
    out = compute_video_analytics(_v(), [])
    assert out["rates"]["views_per_day"] > 300
    assert out["rates"]["views_per_day"] < 400


def test_engagement_pct():
    # (500 + 50) / 10000 = 5.5%
    out = compute_video_analytics(_v(), [])
    assert out["rates"]["engagement_pct"] == 5.5


def test_engagement_pct_zero_when_no_views():
    out = compute_video_analytics(_v(views="0", likes="10", comments="1"), [])
    assert out["rates"]["engagement_pct"] == 0


# ---------- vs_channel ----------------------------------------------------


def test_vs_channel_excludes_self_from_baseline():
    """Without this, every video would be in the 100th percentile vs itself."""
    me = _v(video_id="me", views="1000")
    siblings = [_v(video_id="me", views="999999")] + [_v(video_id=f"s{i}", views="500") for i in range(5)]
    out = compute_video_analytics(me, siblings)
    # The big-views sibling has the same video_id as `me` so it's excluded;
    # all remaining siblings have 500 views, less than 1000 → 100th percentile
    assert out["vs_channel"]["n_siblings"] == 5
    assert out["vs_channel"]["views_pctile"] == 100


def test_vs_channel_needs_three_siblings():
    out = compute_video_analytics(_v(), channel_videos=[_v(video_id="o1"), _v(video_id="o2")])
    assert out["vs_channel"]["views_pctile"] is None


def test_vs_channel_percentile_bottom():
    me = _v(video_id="me", views="100")
    siblings = [_v(video_id=f"s{i}", views=str(10_000 + i)) for i in range(5)]
    out = compute_video_analytics(me, siblings)
    assert out["vs_channel"]["views_pctile"] == 0


def test_vs_channel_median_multiplier():
    me = _v(video_id="me", views="10000")
    siblings = [_v(video_id=f"s{i}", views="2000") for i in range(5)]
    out = compute_video_analytics(me, siblings)
    assert out["vs_channel"]["views_vs_median"] == 5.0  # 10k / 2k median


# ---------- verdict --------------------------------------------------------


def test_verdict_outperformer_requires_views_and_engagement():
    me = _v(video_id="me", views="100000", likes="8000", comments="500")
    # All siblings small + low engagement → me wins on both axes
    siblings = [_v(video_id=f"s{i}", views="1000", likes="10", comments="0") for i in range(8)]
    out = compute_video_analytics(me, siblings)
    assert out["verdict"]["label"] == "Outperformer"
    assert out["verdict"]["color"] == "green"


def test_verdict_underperformer():
    me = _v(video_id="me", views="50", likes="0", comments="0")
    siblings = [_v(video_id=f"s{i}", views="10000", likes="500", comments="20") for i in range(8)]
    out = compute_video_analytics(me, siblings)
    assert out["verdict"]["label"] in ("Below median", "Underperformer")


def test_verdict_typical_when_middling():
    me = _v(video_id="me", views="5000", likes="200", comments="10")
    siblings = []
    for i in range(8):
        siblings.append(_v(video_id=f"s{i}", views=str(2000 + i * 1000), likes="100", comments="5"))
    out = compute_video_analytics(me, siblings)
    assert out["verdict"]["score"] is not None
    # Score should land somewhere in the middle
    assert 30 < out["verdict"]["score"] < 95


# ---------- earnings -------------------------------------------------------


def test_earnings_none_when_rpm_unset():
    assert compute_video_analytics(_v(), [], rpm=None)["earnings"] is None
    assert compute_video_analytics(_v(), [], rpm=0)["earnings"] is None


def test_earnings_lifetime_and_band():
    # 10000 views @ $2/k = $20 lifetime
    out = compute_video_analytics(_v(views="10000"), [], rpm=2.0)
    e = out["earnings"]
    assert e["lifetime_usd"] == 20.0
    assert e["low_usd"] == 14.0      # 20 * 0.7
    assert e["high_usd"] == 26.0     # 20 * 1.3
    assert e["rpm"] == 2.0


def test_earnings_per_day_uses_age():
    # 10000 views over 30 days = ~333/day → at $2/k = ~$0.667/day
    out = compute_video_analytics(_v(views="10000"), [], rpm=2.0)
    assert 0.6 < out["earnings"]["per_day_usd"] < 0.8


# ---------- insights -------------------------------------------------------


def test_insights_always_list():
    out = compute_video_analytics(_v(), [])
    assert isinstance(out["insights"], list)


def test_insights_flag_viral_but_shallow():
    me = _v(video_id="me", views="1_000_000", likes="100", comments="5")  # high views, low engagement
    siblings = [_v(video_id=f"s{i}", views="1000", likes="200", comments="20") for i in range(8)]
    out = compute_video_analytics(me, siblings)
    text = " ".join(out["insights"]).lower()
    assert "viral" in text or "shallow" in text or "outperformer" in text.lower()


def test_insights_flag_hidden_gem():
    me = _v(video_id="me", views="100", likes="50", comments="20")  # tiny views but big engagement
    siblings = [_v(video_id=f"s{i}", views="10000", likes="50", comments="2") for i in range(8)]
    out = compute_video_analytics(me, siblings)
    text = " ".join(out["insights"]).lower()
    assert "hidden gem" in text or "engaged" in text


def test_insights_include_verdict_summary():
    me = _v(video_id="me", views="100000", likes="8000", comments="500")
    siblings = [_v(video_id=f"s{i}", views="1000", likes="10", comments="0") for i in range(8)]
    out = compute_video_analytics(me, siblings)
    last = out["insights"][-1]
    assert "verdict" in last.lower()


def test_insights_age_context_fresh():
    fresh = _v(published_at=(datetime.now(timezone.utc) - timedelta(days=3)).isoformat())
    out = compute_video_analytics(fresh, [])
    text = " ".join(out["insights"]).lower()
    assert "fresh" in text or "still move" in text


def test_insights_age_context_long_tail():
    old = _v(published_at=(datetime.now(timezone.utc) - timedelta(days=365 * 4)).isoformat())
    out = compute_video_analytics(old, [])
    text = " ".join(out["insights"]).lower()
    assert "long-tail" in text or "years old" in text
