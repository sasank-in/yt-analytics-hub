"""Per-video analytics.

Companion to `youtube_analytics.analytics` (which is channel-level). Where
channel analytics asks "how is the channel doing overall?", this asks "how
is THIS video doing relative to its siblings?".

Public API:
    compute_video_analytics(video, channel_videos, rpm=None) -> dict

Returned shape (all keys always present; sub-blocks may have null fields
when there isn't enough data):

    {
        "video_id": str,
        "age_days": int,                  # days since publish
        "rates": {
            "views_per_day":    float,
            "likes_per_day":    float,
            "comments_per_day": float,
            "engagement_pct":   float,
            "like_rate_pct":    float,
            "comment_rate_pct": float,
        },
        "vs_channel": {
            "n_siblings":           int,
            "views_pctile":         float | None,   # 0-100
            "engagement_pctile":    float | None,
            "like_rate_pctile":     float | None,
            "comment_rate_pctile":  float | None,
            "views_vs_median":      float | None,   # 2.5 = 2.5x channel median
            "engagement_vs_median": float | None,
        },
        "verdict": {
            "label":  str,    # "Outperformer" / "Above median" / etc.
            "score":  int,    # 0-100 composite
            "color":  str,    # "green" | "blue" | "slate" | "amber"
        },
        "earnings": {
            "rpm":           float,
            "lifetime_usd":  float,
            "per_day_usd":   float,
            "low_usd":       float,
            "high_usd":      float,
        } | None,
        "insights": list[str],   # plain-language conclusions
    }
"""

from __future__ import annotations

import statistics
from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any

# ---------- shared coercion (mirrors analytics.py) -------------------------


def _to_int(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, int | float):
        return int(value)
    s = str(value).strip()
    if s.lower() in ("", "private"):
        return 0
    try:
        return int(s.replace(",", ""))
    except (ValueError, TypeError):
        return 0


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        s = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _engagement_pct(video: dict) -> float:
    v = _to_int(video.get("views"))
    if v <= 0:
        return 0.0
    return (_to_int(video.get("likes")) + _to_int(video.get("comments"))) / v * 100


def _like_rate_pct(video: dict) -> float:
    v = _to_int(video.get("views"))
    if v <= 0:
        return 0.0
    return _to_int(video.get("likes")) / v * 100


def _comment_rate_pct(video: dict) -> float:
    v = _to_int(video.get("views"))
    if v <= 0:
        return 0.0
    return _to_int(video.get("comments")) / v * 100


def _median(arr: Iterable[float]) -> float:
    arr = list(arr)
    return statistics.median(arr) if arr else 0.0


def _percentile_rank(values: list[float], target: float) -> float:
    """Fraction (0–1) of `values` strictly less than `target`.

    Excludes the target itself from the comparison set — we want "how does
    this video compare to OTHER videos", not "vs itself".
    """
    if not values:
        return 0.0
    below = sum(1 for v in values if v < target)
    return below / len(values)


# ---------- rates ----------------------------------------------------------


def _rates(video: dict, age_days: int) -> dict:
    views = _to_int(video.get("views"))
    likes = _to_int(video.get("likes"))
    comments = _to_int(video.get("comments"))
    age = max(age_days, 1)
    return {
        "views_per_day":    round(views / age, 2),
        "likes_per_day":    round(likes / age, 2),
        "comments_per_day": round(comments / age, 2),
        "engagement_pct":   round(_engagement_pct(video), 2),
        "like_rate_pct":    round(_like_rate_pct(video), 2),
        "comment_rate_pct": round(_comment_rate_pct(video), 2),
    }


# ---------- vs-channel block ----------------------------------------------


def _vs_channel(video: dict, siblings: list[dict]) -> dict:
    """Where does this video sit in the channel's distribution?

    Compares views, engagement, like rate, comment rate against the OTHER
    videos in the channel. Excludes the video itself from the baseline so
    we don't get tautological 100th-percentile results.
    """
    others = [v for v in siblings if v.get("video_id") != video.get("video_id")]
    n = len(others)
    if n < 3:
        return {
            "n_siblings": n,
            "views_pctile":         None,
            "engagement_pctile":    None,
            "like_rate_pctile":     None,
            "comment_rate_pctile":  None,
            "views_vs_median":      None,
            "engagement_vs_median": None,
        }

    other_views = [_to_int(v.get("views")) for v in others]
    other_eng = [_engagement_pct(v) for v in others if _to_int(v.get("views")) > 0]
    other_likes = [_like_rate_pct(v) for v in others if _to_int(v.get("views")) > 0]
    other_comments = [_comment_rate_pct(v) for v in others if _to_int(v.get("views")) > 0]

    views = _to_int(video.get("views"))
    eng = _engagement_pct(video)
    lr = _like_rate_pct(video)
    cr = _comment_rate_pct(video)

    median_views = _median(other_views)
    median_eng = _median(other_eng)

    return {
        "n_siblings": n,
        "views_pctile":         round(_percentile_rank(other_views, views) * 100, 1),
        "engagement_pctile":    round(_percentile_rank(other_eng, eng) * 100, 1) if other_eng else None,
        "like_rate_pctile":     round(_percentile_rank(other_likes, lr) * 100, 1) if other_likes else None,
        "comment_rate_pctile":  round(_percentile_rank(other_comments, cr) * 100, 1) if other_comments else None,
        "views_vs_median":      round(views / median_views, 2) if median_views > 0 else None,
        "engagement_vs_median": round(eng / median_eng, 2) if median_eng > 0 else None,
    }


# ---------- verdict --------------------------------------------------------


def _verdict(vs_channel: dict) -> dict:
    """One-glance summary of how this video is doing within the channel.

    Composite score = mean of (views_pctile, engagement_pctile). 0–100.

    Labels:
      ≥80 + views ≥ 2× median + engagement ≥ median → "Outperformer"
      ≥60                                            → "Above median"
      40–60                                          → "Typical"
      20–40                                          → "Below median"
      <20                                            → "Underperformer"

    The "Outperformer" gate matches the channel-level composite_ranking
    threshold so the two views agree.
    """
    vp = vs_channel.get("views_pctile")
    ep = vs_channel.get("engagement_pctile")
    if vp is None and ep is None:
        return {"label": "Not enough data", "score": None, "color": "slate"}

    parts = [p for p in (vp, ep) if p is not None]
    score = round(sum(parts) / len(parts))
    vvm = vs_channel.get("views_vs_median") or 0
    evm = vs_channel.get("engagement_vs_median") or 0

    if score >= 80 and vvm >= 2 and evm >= 1:
        return {"label": "Outperformer", "score": score, "color": "green"}
    if score >= 60:
        return {"label": "Above median", "score": score, "color": "blue"}
    if score >= 40:
        return {"label": "Typical", "score": score, "color": "slate"}
    if score >= 20:
        return {"label": "Below median", "score": score, "color": "amber"}
    return {"label": "Underperformer", "score": score, "color": "amber"}


# ---------- earnings -------------------------------------------------------


def _earnings(video: dict, age_days: int, rpm: float | None) -> dict | None:
    if rpm is None or rpm <= 0:
        return None
    views = _to_int(video.get("views"))
    lifetime = views / 1000 * rpm
    per_day = (views / max(age_days, 1)) / 1000 * rpm
    # ±30% band reflecting real-world RPM variability across niche / geo / season.
    return {
        "rpm":          round(rpm, 2),
        "lifetime_usd": round(lifetime, 2),
        "per_day_usd":  round(per_day, 4),
        "low_usd":      round(lifetime * 0.7, 2),
        "high_usd":     round(lifetime * 1.3, 2),
    }


# ---------- insights -------------------------------------------------------


def _fmt_pct(p: float | None) -> str:
    return "—" if p is None else f"{round(p)}th"


def _insights(
    video: dict,
    vs_channel: dict,
    verdict: dict,
    rates: dict,
    age_days: int,
    title: str,
) -> list[str]:
    out: list[str] = []

    # Position vs channel
    vp = vs_channel.get("views_pctile")
    ep = vs_channel.get("engagement_pctile")
    if vp is not None and ep is not None:
        if vp >= 90 and ep >= 70:
            out.append(
                f"Top-tier video: in the {_fmt_pct(vp)} percentile by views "
                f"AND {_fmt_pct(ep)} by engagement — a rare combo for this channel."
            )
        elif vp >= 90 and ep < 40:
            out.append(
                f"Viral but shallow: {_fmt_pct(vp)} percentile views but only "
                f"{_fmt_pct(ep)} engagement. The video reached people beyond "
                "the core audience."
            )
        elif vp < 20 and ep >= 70:
            out.append(
                f"Hidden gem: only {_fmt_pct(vp)} percentile views but "
                f"{_fmt_pct(ep)} engagement. The audience that DID watch was "
                "highly engaged."
            )
        elif vp < 30 and ep < 30:
            out.append(
                f"Underperforming across the board: {_fmt_pct(vp)} views / "
                f"{_fmt_pct(ep)} engagement vs siblings."
            )

    # Views vs median multiplier
    vvm = vs_channel.get("views_vs_median")
    if vvm is not None:
        if vvm >= 3:
            out.append(f"Pulled {vvm:.1f}× the channel's median views — clearly resonated.")
        elif vvm <= 0.3 and vvm > 0:
            out.append(f"Pulled only {vvm:.1f}× the channel's median views — well below typical performance.")

    # Engagement framing
    eng = rates.get("engagement_pct") or 0
    if eng >= 8:
        out.append(f"Engagement rate {eng:.1f}% is exceptional — top 1% of YouTube videos sit above 6%.")
    elif eng >= 5:
        out.append(f"Engagement rate {eng:.1f}% is strong (top 10% across YouTube).")
    elif eng < 1 and rates.get("views_per_day", 0) > 0:
        out.append(f"Engagement rate {eng:.1f}% is low — viewers watched but didn't react.")

    # Velocity framing
    vpd = rates.get("views_per_day") or 0
    if age_days >= 30 and vpd > 0:
        if vpd >= 10_000:
            out.append(f"{round(vpd):,} views/day average — strong sustained performance over {age_days} days.")
        elif vpd < 10 and age_days >= 90:
            out.append(f"Only {vpd:.1f} views/day — the algorithm has stopped recommending this video.")

    # Age context
    if age_days <= 7:
        out.append(f"Fresh upload ({age_days} days old) — these numbers will still move significantly.")
    elif age_days >= 365 * 3:
        out.append(f"Long-tail asset: {age_days // 365} years old and still accumulating views.")

    # Verdict-level summary always appended last
    label = verdict.get("label")
    score = verdict.get("score")
    if label and score is not None:
        out.append(f"Overall verdict: **{label}** ({score}/100 within channel).")
    elif label:
        out.append(f"Overall: {label}.")

    return out


# ---------- top-level aggregator ------------------------------------------


def compute_video_analytics(
    video: dict,
    channel_videos: list[dict] | None = None,
    rpm: float | None = None,
) -> dict:
    """Build the full per-video analytics payload.

    `channel_videos` is the list of sibling videos (typically the channel's
    recent uploads from the DB). Used to compute percentile ranks and the
    "vs channel" verdict.
    """
    published = _parse_dt(video.get("published_at"))
    age_days = (
        1 if published is None
        else max(1, (datetime.now(timezone.utc) - published).days)
    )

    rates = _rates(video, age_days)
    vs_channel = _vs_channel(video, channel_videos or [])
    verdict = _verdict(vs_channel)
    earnings = _earnings(video, age_days, rpm)
    insights = _insights(
        video, vs_channel, verdict, rates, age_days,
        title=video.get("title", ""),
    )

    return {
        "video_id": video.get("video_id"),
        "title":    video.get("title"),
        "age_days": age_days,
        "rates":    rates,
        "vs_channel": vs_channel,
        "verdict":   verdict,
        "earnings":  earnings,
        "insights":  insights,
    }
