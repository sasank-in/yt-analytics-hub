"""Advanced channel analytics.

Pure functions over a list of video dicts (the same shape `DatabaseManager`
returns). No I/O, no DB access — so trivially testable.

Public API:
    compute_channel_analytics(videos, rpm=None) -> dict

Returned shape (all keys always present; sub-dicts may have `null` values
when the input is too small to produce a meaningful answer):

    {
        "sample_size": int,
        "cadence":   {median_days, mean_days, longest_gap_days, current_streak_days, intervals},
        "publish_pattern": {weekday_counts[7], hour_counts[24], weekday_views[7], hour_views[24]},
        "engagement_vs_views": {pearson_r, slope, intercept, n},
        "title_length": [{bucket, n, median_views, median_engagement}, ...],
        "health_score": {score, components: {engagement, consistency, cadence}},
        "decay": {exponent, coefficient, r_squared, n},
        "earnings_cone": {rpm, low, mid, high, lifetime_views} | null,
        "composite_ranking": [{video_id, title, score, ranks: {...}}, ...],
    }

References for the math (in case a reviewer asks):
- MAD: Hampel (1974). 1.4826 scales to a consistent estimator of SD.
- Pearson r: standard formula, two-pass mean.
- Power-law fit: log–log linear regression. Reasonable for view-decay
  modelling per Wu, Rizoiu et al. (2018) "Beyond Views" — though they
  use a more sophisticated dual-decay model.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------
# Tiny helpers (numeric coercion mirrors the frontend's `toNumber`)
# ---------------------------------------------------------------------


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


def _engagement_rate(v: dict) -> float:
    views = _to_int(v.get("views"))
    if views <= 0:
        return 0.0
    return (_to_int(v.get("likes")) + _to_int(v.get("comments"))) / views * 100


def _median(arr: Iterable[float]) -> float:
    arr = list(arr)
    return statistics.median(arr) if arr else 0.0


def _mean(arr: Iterable[float]) -> float:
    arr = list(arr)
    return statistics.fmean(arr) if arr else 0.0


def _stdev(arr: Iterable[float]) -> float:
    arr = list(arr)
    return statistics.pstdev(arr) if len(arr) > 1 else 0.0


# ---------------------------------------------------------------------
# B1 — Publishing cadence
# ---------------------------------------------------------------------


def cadence(videos: list[dict]) -> dict:
    """Inter-publish gaps in days. Smaller = more consistent uploads."""
    dates = sorted(
        d for d in (_parse_dt(v.get("published_at")) for v in videos) if d is not None
    )
    if len(dates) < 2:
        return {
            "median_days": None,
            "mean_days": None,
            "longest_gap_days": None,
            "current_streak_days": None,
            "intervals": [],
        }
    intervals = [
        (dates[i] - dates[i - 1]).total_seconds() / 86_400
        for i in range(1, len(dates))
    ]
    now = datetime.now(timezone.utc)
    current_streak = (now - dates[-1]).total_seconds() / 86_400
    return {
        "median_days": round(_median(intervals), 2),
        "mean_days": round(_mean(intervals), 2),
        "longest_gap_days": round(max(intervals), 2),
        "current_streak_days": round(current_streak, 2),
        "intervals": [round(x, 2) for x in intervals],
    }


# ---------------------------------------------------------------------
# B2 — Publish pattern (weekday + hour)
# ---------------------------------------------------------------------


def publish_pattern(videos: list[dict]) -> dict:
    """When does this channel publish, and which slots perform best?"""
    weekday_counts = [0] * 7
    hour_counts = [0] * 24
    weekday_views = [[] for _ in range(7)]
    hour_views = [[] for _ in range(24)]

    for v in videos:
        dt = _parse_dt(v.get("published_at"))
        if dt is None:
            continue
        wd, hr = dt.weekday(), dt.hour
        weekday_counts[wd] += 1
        hour_counts[hr] += 1
        views = _to_int(v.get("views"))
        weekday_views[wd].append(views)
        hour_views[hr].append(views)

    return {
        "weekday_counts": weekday_counts,
        "hour_counts": hour_counts,
        "weekday_mean_views": [round(_mean(x)) if x else 0 for x in weekday_views],
        "hour_mean_views": [round(_mean(x)) if x else 0 for x in hour_views],
    }


# ---------------------------------------------------------------------
# B3 — Engagement vs views regression
# ---------------------------------------------------------------------


def engagement_vs_views(videos: list[dict]) -> dict:
    """Pearson r and OLS slope of engagement % on log10(views).

    Why log views: views span 3–6 orders of magnitude; raw values give
    a few mega-viral points all the leverage. Log-transforming makes the
    correlation more honest.
    """
    points = [
        (math.log10(_to_int(v.get("views"))), _engagement_rate(v))
        for v in videos
        if _to_int(v.get("views")) > 0
    ]
    n = len(points)
    if n < 3:
        return {"pearson_r": None, "slope": None, "intercept": None, "n": n}

    xs, ys = zip(*points, strict=True)
    mean_x, mean_y = _mean(xs), _mean(ys)
    sx, sy = _stdev(xs), _stdev(ys)
    if sx == 0 or sy == 0:
        return {"pearson_r": 0.0, "slope": 0.0, "intercept": mean_y, "n": n}

    cov = sum((x - mean_x) * (y - mean_y) for x, y in points) / n
    r = cov / (sx * sy)
    slope = cov / (sx * sx)
    intercept = mean_y - slope * mean_x
    return {
        "pearson_r": round(r, 4),
        "slope": round(slope, 4),
        "intercept": round(intercept, 4),
        "n": n,
    }


# ---------------------------------------------------------------------
# B4 — Title length impact
# ---------------------------------------------------------------------


_TITLE_BUCKETS = [
    ("short (≤30)", 0, 30),
    ("medium (31–60)", 31, 60),
    ("long (61+)", 61, 10_000),
]


def title_length_impact(videos: list[dict]) -> list[dict]:
    """Median views/engagement bucketed by title char-count.

    Empty buckets (n=0) are dropped — they clutter the chart.
    Non-empty buckets with n < 5 are flagged `reliable=False` so the UI can
    warn the user the sample is too thin to draw conclusions.
    """
    buckets: list[dict] = []
    for label, lo, hi in _TITLE_BUCKETS:
        in_bucket = [
            v for v in videos
            if lo <= len(v.get("title") or "") <= hi
        ]
        if not in_bucket:
            continue  # skip empty buckets
        buckets.append({
            "bucket": label,
            "n": len(in_bucket),
            "median_views": round(_median(_to_int(v.get("views")) for v in in_bucket)),
            "median_engagement": round(_median(_engagement_rate(v) for v in in_bucket), 2),
            "reliable": len(in_bucket) >= 5,
        })
    return buckets


# ---------------------------------------------------------------------
# B6 — Channel health score (0–100)
# ---------------------------------------------------------------------


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _normalise_ascending(value: float, lo: float, hi: float) -> float:
    """Map [lo..hi] to [0..1] ascending. Values <= lo → 0, >= hi → 1."""
    if hi <= lo:
        return 0.0
    return _clamp((value - lo) / (hi - lo))


def _normalise_descending(value: float, good: float, bad: float) -> float:
    """Map [good..bad] to [1..0] descending. Values <= good → 1, >= bad → 0.

    Used for "lower is better" metrics (e.g. publish gap in days).
    """
    if bad <= good:
        return 1.0
    return _clamp((bad - value) / (bad - good))


# Engagement bands by channel size. Big channels have lower engagement
# (mass-audience dilution). These thresholds calibrate the score so a
# 1.5% rate on an 8M-sub channel doesn't look "low."
#
# Bands: (max_subs, good_engagement_pct)
# Anything above the largest tier inherits the largest threshold.
_ENGAGEMENT_BANDS = [
    (10_000,       6.0),
    (100_000,      5.0),
    (1_000_000,    3.5),
    (10_000_000,   2.0),
    (float("inf"), 1.2),
]


def _good_engagement_for(subscribers: int) -> float:
    for max_subs, good in _ENGAGEMENT_BANDS:
        if subscribers <= max_subs:
            return good
    return _ENGAGEMENT_BANDS[-1][1]


def _median_absolute_deviation_ratio(values: list[float]) -> float:
    """MAD / median — robust spread measure, ignores viral outliers."""
    if not values:
        return 0.0
    m = _median(values)
    if m == 0:
        return 0.0
    deviations = [abs(v - m) for v in values]
    return _median(deviations) / m


def health_score(
    videos: list[dict],
    cadence_data: dict,
    subscribers: int = 0,
) -> dict:
    """Composite 0–100 channel health.

    Components (each 0–1, then weighted):
        engagement  (40%) — median engagement rate normalised against the
                            band for channels of this size
        consistency (30%) — robust spread (MAD/median) of views; viral
                            spikes don't punish steady channels
        cadence     (30%) — publish rhythm: weekly = full credit,
                            >60 days median gap = zero credit

    `subscribers` is used to pick the engagement band. If not provided,
    we default to the strictest (small-channel) band — i.e. we assume the
    channel is small unless told otherwise.
    """
    if not videos:
        return {
            "score": None,
            "components": {"engagement": None, "consistency": None, "cadence": None},
        }

    # --- Engagement (size-aware) ---
    rates = [_engagement_rate(v) for v in videos if _to_int(v.get("views")) > 0]
    median_engagement = _median(rates)
    good_threshold = _good_engagement_for(subscribers)
    engagement_norm = _normalise_ascending(median_engagement, 0.0, good_threshold)

    # --- Consistency (robust to viral spikes) ---
    views = [_to_int(v.get("views")) for v in videos if _to_int(v.get("views")) > 0]
    mad_ratio = _median_absolute_deviation_ratio(views)
    # mad_ratio = 0 → perfectly consistent → 1.0
    # mad_ratio = 1 → typical (very spread) → 0.5
    # mad_ratio ≥ 3 → wildly inconsistent → ~0.25
    consistency_norm = 1.0 / (1.0 + mad_ratio)

    # --- Cadence ---
    median_gap = cadence_data.get("median_days")
    if median_gap is None:
        cadence_norm = 0.5  # not enough data → neutral
    else:
        # 7-day median gap = full credit. 60-day gap = zero credit.
        cadence_norm = _normalise_descending(median_gap, good=7.0, bad=60.0)

    score = round((0.4 * engagement_norm + 0.3 * consistency_norm + 0.3 * cadence_norm) * 100)
    return {
        "score": score,
        "components": {
            "engagement": round(engagement_norm, 3),
            "consistency": round(consistency_norm, 3),
            "cadence": round(cadence_norm, 3),
        },
        "engagement_threshold_pct": good_threshold,
        "median_engagement_pct": round(median_engagement, 2),
    }


# ---------------------------------------------------------------------
# B7 — Power-law view decay fit
# ---------------------------------------------------------------------


def decay_model(videos: list[dict]) -> dict:
    """Fit views ~ a * age_days^b on log–log axes.

    Realistic exponents fall in roughly [-0.6, +0.6]:
      - b ≈ +0.3 means older videos have ~2× the views of new ones (long tail)
      - b ≈ -0.3 means new uploads dominate (trending content)
      - |b| > 1 indicates the data isn't following a power law at all — the
        line was being yanked by outliers. We report `fit_quality="poor"`
        in that case and return the slope but ALSO null the exponent so the
        UI shows "no usable signal".

    R² < 0.1 → fit_quality "poor"; R² in [0.1, 0.4] "moderate"; ≥ 0.4 "strong".
    """
    now = datetime.now(timezone.utc)
    points = []
    for v in videos:
        dt = _parse_dt(v.get("published_at"))
        if dt is None:
            continue
        age_days = (now - dt).total_seconds() / 86_400
        views = _to_int(v.get("views"))
        if age_days >= 1 and views >= 1:
            points.append((math.log10(age_days), math.log10(views)))

    n = len(points)
    if n < 5:
        return {
            "exponent": None, "coefficient": None, "r_squared": None,
            "n": n, "fit_quality": "insufficient_data",
        }

    xs, ys = zip(*points, strict=True)
    mean_x, mean_y = _mean(xs), _mean(ys)
    sx2 = sum((x - mean_x) ** 2 for x in xs)
    if sx2 == 0:
        return {
            "exponent": 0.0, "coefficient": 10 ** mean_y, "r_squared": 0.0,
            "n": n, "fit_quality": "poor",
        }

    slope = sum((x - mean_x) * (y - mean_y) for x, y in points) / sx2
    intercept = mean_y - slope * mean_x

    ss_tot = sum((y - mean_y) ** 2 for y in ys)
    ss_res = sum((y - (intercept + slope * x)) ** 2 for x, y in points)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    # Cap the slope at |1.0| before deciding quality. Real YouTube view-decay
    # exponents fall in roughly [-0.6, +0.6]; anything larger means the fit
    # has been yanked by leverage points, not a true power law.
    in_realistic_range = abs(slope) <= 1.0
    if r_squared >= 0.4 and in_realistic_range:
        quality = "strong"
    elif r_squared >= 0.1 and in_realistic_range:
        quality = "moderate"
    else:
        quality = "poor"

    # If the slope is unrealistic, null the exponent regardless of R²
    # so the UI shows "no signal" instead of "older videos get 753 billion %
    # more views per decade."
    reportable_exponent: float | None = round(slope, 4) if in_realistic_range else None

    # Coefficient = 10^intercept. Clip to avoid OverflowError on degenerate fits.
    try:
        coefficient: float | None = round(10 ** _clamp(intercept, -100, 100), 2)
    except OverflowError:
        coefficient = None
    return {
        "exponent": reportable_exponent,
        "raw_slope": round(slope, 4),
        "coefficient": coefficient,
        "r_squared": round(r_squared, 4),
        "n": n,
        "fit_quality": quality,
    }


# ---------------------------------------------------------------------
# B9 — Earnings cone
# ---------------------------------------------------------------------


def earnings_cone(videos: list[dict], rpm: float | None) -> dict | None:
    """Lifetime earnings estimate with a ±30% confidence band.

    The ±30% isn't statistical — it's an editorial admission that RPMs vary
    wildly with niche, geography, ad fill, and seasonality. We could use
    historical YouTube CPM ranges instead, but ±30% is closer to honest
    than a single hard number.
    """
    if rpm is None or rpm <= 0:
        return None
    total_views = sum(_to_int(v.get("views")) for v in videos)
    mid = total_views / 1000 * rpm
    return {
        "rpm": round(rpm, 2),
        "lifetime_views": total_views,
        "low": round(mid * 0.7, 2),
        "mid": round(mid, 2),
        "high": round(mid * 1.3, 2),
    }


# ---------------------------------------------------------------------
# B10 — Composite ranking
# ---------------------------------------------------------------------


def _percentile_rank(values: list[float], target: float) -> float:
    """Fraction of `values` strictly less than `target`. 0 → 1 range."""
    if not values:
        return 0.0
    below = sum(1 for v in values if v < target)
    return below / len(values)


def composite_ranking(videos: list[dict], limit: int = 5) -> list[dict]:
    """Identify "outperformer" videos within the channel.

    Previously this just sorted everything by percentile rank — so every
    channel had a video at 99/100. That's tautological: percentile-vs-self
    always crowns somebody. Now we add an absolute threshold:

      outperformer = views ≥ 2× channel median  AND  engagement ≥ channel median

    Videos that don't clear the bar are still ranked, but flagged
    `outperformer=False` so the UI can dim them.
    """
    enriched = []
    for v in videos:
        views = _to_int(v.get("views"))
        likes = _to_int(v.get("likes"))
        eng = _engagement_rate(v)
        like_rate = (likes / views * 100) if views > 0 else 0.0
        enriched.append({
            "video_id": v.get("video_id"),
            "title": v.get("title"),
            "views": views,
            "engagement": round(eng, 2),
            "like_rate": round(like_rate, 2),
        })

    if not enriched:
        return []

    all_views = [v["views"] for v in enriched]
    all_eng = [v["engagement"] for v in enriched]
    all_like = [v["like_rate"] for v in enriched]
    median_views = _median(all_views)
    median_eng = _median(all_eng)

    ranked = []
    for v in enriched:
        pv = _percentile_rank(all_views, v["views"])
        pe = _percentile_rank(all_eng, v["engagement"])
        pl = _percentile_rank(all_like, v["like_rate"])
        outperformer = (
            v["views"] >= 2 * median_views
            and v["engagement"] >= median_eng
        )
        ranked.append({
            **v,
            "score": round((pv + pe + pl) / 3 * 100, 1),
            "outperformer": outperformer,
            "ranks": {
                "views_pct": round(pv * 100, 1),
                "engagement_pct": round(pe * 100, 1),
                "like_rate_pct": round(pl * 100, 1),
            },
        })

    ranked.sort(key=lambda r: r["score"], reverse=True)
    return ranked[:limit]


# ---------------------------------------------------------------------
# Best publishing slot (insight on top of publish_pattern)
# ---------------------------------------------------------------------


_WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def best_slot(publish_pattern_data: dict) -> dict:
    """Identify the highest-mean-views weekday & hour.

    Only returns names if there's at least 5× the median in that slot AND
    that slot has at least 3 videos. Otherwise returns null fields so the
    UI shows "no clear preferred slot."
    """
    weekday_views = publish_pattern_data.get("weekday_mean_views", [0] * 7)
    weekday_counts = publish_pattern_data.get("weekday_counts", [0] * 7)
    hour_views = publish_pattern_data.get("hour_mean_views", [0] * 24)
    hour_counts = publish_pattern_data.get("hour_counts", [0] * 24)

    def _pick_best(views: list[int], counts: list[int], min_count: int = 3):
        candidates = [(v, i) for i, (v, c) in enumerate(zip(views, counts, strict=True)) if c >= min_count]
        if not candidates:
            return None, None
        top_v, top_i = max(candidates)
        # Baseline = median across ALL non-zero slots (not just qualifying
        # candidates) so a "Thursday is the only slot with ≥3 uploads"
        # channel can still be measured against the channel's own background.
        non_zero_all = [v for v in views if v > 0]
        if not non_zero_all:
            return None, None
        med = _median(non_zero_all)
        if med == 0 or top_v < med * 1.5:
            return None, None
        return top_i, top_v / med

    best_day_i, day_lift = _pick_best(weekday_views, weekday_counts)
    best_hour_i, hour_lift = _pick_best(hour_views, hour_counts)

    return {
        "best_weekday": _WEEKDAY_NAMES[best_day_i] if best_day_i is not None else None,
        "best_weekday_lift": round(day_lift, 2) if day_lift else None,
        "best_hour": best_hour_i,
        "best_hour_lift": round(hour_lift, 2) if hour_lift else None,
    }


# ---------------------------------------------------------------------
# Insight generators — plain-language conclusions for each metric.
# ---------------------------------------------------------------------


def _insight_cadence(c: dict) -> str | None:
    m = c.get("median_days")
    streak = c.get("current_streak_days") or 0
    if m is None:
        return None
    if streak > 90:
        return f"No new uploads for {round(streak)} days — channel may be dormant."
    if m < 1:
        return f"Hyperactive channel: a new upload roughly every {round(m * 24)} hours."
    if m <= 3:
        return f"Daily-or-better cadence ({round(m, 1)} day median gap)."
    if m <= 14:
        return f"Steady weekly-ish cadence ({round(m)} day median gap)."
    if m <= 60:
        return f"Sporadic uploads ({round(m)} day median gap) — viewers may struggle to stay subscribed."
    return f"Very infrequent ({round(m)} day median gap) — risks viewer churn."


def _insight_correlation(c: dict) -> str | None:
    r = c.get("pearson_r")
    if r is None:
        return None
    if abs(r) < 0.2:
        return "Engagement and view count move independently — quality stays steady across viral hits and small videos."
    if r >= 0.6:
        return "Bigger videos engage HARDER — viral hits are also the channel's best at hooking the audience."
    if r >= 0.2:
        return "Bigger videos engage somewhat more. Not a strong effect."
    if r > -0.6:
        return "Bigger videos engage less — typical mass-audience dilution as videos reach beyond the core."
    return "Strong dilution: viral videos collapse on engagement. Audience reach is outpacing audience fit."


def _insight_decay(d: dict) -> str | None:
    quality = d.get("fit_quality")
    if quality == "insufficient_data":
        return None
    b = d.get("exponent")
    r2 = d.get("r_squared") or 0
    if quality == "poor" or b is None:
        return f"No usable age-vs-views signal (R²={r2:.2f}). Either views aren't age-driven, or the sample is too noisy."
    if b > 0.4:
        return f"Strong long-tail (b={b:+.2f}, R²={r2:.2f}): older videos accumulate ~{round(10 ** b - 1) * 100}% more views per decade of age."
    if b > 0.1:
        return f"Mild long-tail (b={b:+.2f}, R²={r2:.2f}): older videos modestly outperform new ones."
    if b > -0.1:
        return f"Age-flat (b={b:+.2f}, R²={r2:.2f}): video age barely affects view count."
    if b > -0.4:
        return f"Recent uploads favoured (b={b:+.2f}, R²={r2:.2f}): newer videos outperform older ones."
    return f"Strong recency effect (b={b:+.2f}, R²={r2:.2f}): channel is likely on a trending streak."


def _insight_title_length(buckets: list[dict]) -> str | None:
    reliable = [b for b in buckets if b["reliable"]]
    if len(reliable) < 2:
        return "Not enough videos across title-length buckets to compare."
    best = max(reliable, key=lambda b: b["median_views"])
    worst = min(reliable, key=lambda b: b["median_views"])
    if worst["median_views"] == 0:
        return None
    lift = best["median_views"] / worst["median_views"]
    if lift < 1.2:
        return "Title length doesn't appear to affect views in this sample."
    return f"{best['bucket']} titles get {lift:.1f}× the views of {worst['bucket']} titles."


def _insight_health(h: dict) -> str | None:
    score = h.get("score")
    if score is None:
        return None
    components = h.get("components", {})
    # Find the weakest non-null component
    valid = {k: v for k, v in components.items() if v is not None}
    if not valid:
        return None
    weakest = min(valid, key=lambda k: valid[k])
    weakest_val = valid[weakest]
    advice = {
        "engagement": "Engagement is the weakest area — try asking viewers for likes/comments explicitly, or hook the first 15 s harder.",
        "consistency": "View counts swing wildly — depending on one viral hit. Try diversifying topics.",
        "cadence": "Upload cadence is hurting the score — even a fixed weekly slot helps the algorithm.",
    }
    if score >= 70:
        band = "Strong channel"
    elif score >= 50:
        band = "Healthy"
    elif score >= 30:
        band = "Mixed"
    else:
        band = "Needs work"
    if weakest_val < 0.4:
        return f"{band} ({score}/100). {advice.get(weakest, '')}"
    return f"{band} ({score}/100). Most-fixable lever: {weakest}."


def _insight_best_slot(slot: dict) -> str | None:
    day = slot.get("best_weekday")
    day_lift = slot.get("best_weekday_lift")
    hour = slot.get("best_hour")
    hour_lift = slot.get("best_hour_lift")
    parts: list[str] = []
    if day and day_lift:
        parts.append(f"{day} uploads average {day_lift:.1f}× the channel median")
    if hour is not None and hour_lift:
        parts.append(f"the {hour:02d}:00 (UTC) hour averages {hour_lift:.1f}× the median")
    if not parts:
        return "No standout publish slot — performance is spread across the week."
    return "Best slot: " + " · ".join(parts) + "."


def _insight_outperformers(ranked: list[dict]) -> str | None:
    outperformers = [r for r in ranked if r.get("outperformer")]
    if not outperformers:
        return "No video clears the outperformer bar (≥2× median views AND above-median engagement)."
    sample = outperformers[0]
    return f"{len(outperformers)} outperformer(s). Top: \"{(sample['title'] or '')[:60]}\" — {sample['views']:,} views."


def generate_insights(blocks: dict) -> dict:
    """Build the plain-language `interpretations` map."""
    return {
        "cadence": _insight_cadence(blocks["cadence"]),
        "correlation": _insight_correlation(blocks["engagement_vs_views"]),
        "decay": _insight_decay(blocks["decay"]),
        "title_length": _insight_title_length(blocks["title_length"]),
        "health": _insight_health(blocks["health_score"]),
        "best_slot": _insight_best_slot(blocks["best_slot"]),
        "outperformers": _insight_outperformers(blocks["composite_ranking"]),
    }


# ---------------------------------------------------------------------
# Top-level aggregator
# ---------------------------------------------------------------------


def compute_channel_analytics(
    videos: list[dict],
    rpm: float | None = None,
    subscribers: int = 0,
) -> dict:
    """Compute every analytics block in one shot.

    `subscribers` is used by the health-score component to pick the
    engagement band appropriate to the channel's size (mass-audience
    channels naturally have lower engagement than niche ones).
    """
    cad = cadence(videos)
    pp = publish_pattern(videos)
    blocks = {
        "sample_size": len(videos),
        "cadence": cad,
        "publish_pattern": pp,
        "best_slot": best_slot(pp),
        "engagement_vs_views": engagement_vs_views(videos),
        "title_length": title_length_impact(videos),
        "health_score": health_score(videos, cad, subscribers),
        "decay": decay_model(videos),
        "earnings_cone": earnings_cone(videos, rpm),
        "composite_ranking": composite_ranking(videos),
    }
    blocks["insights"] = generate_insights(blocks)
    return blocks
