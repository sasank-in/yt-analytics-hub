/**
 * Shared analytics helpers used by channel-charts.js and video-charts.js.
 *
 * Defines `window.Analytics` with:
 *   - daysSince(date)        days from a given date until now
 *   - median(arr)            simple median
 *   - mad(arr)               median absolute deviation
 *   - madOutliers(values, k) returns boolean mask: |x - median| / mad > k
 *   - perDayViews(video)     lifetime views ÷ days since publish
 *   - engagementRate({likes, comments, views})  (likes+comments)/views * 100
 *   - likeRate({likes, views})    likes/views * 100
 *   - commentRate({comments, views}) comments/views * 100
 *
 * Why this exists:
 * Many of the original charts treated cumulative lifetime totals as if they
 * were rate metrics. These helpers expose proper per-day rates and a real
 * outlier test (median + k·MAD, robust on small samples) so we can stop lying
 * to the user with 95th-percentile-on-n=30.
 */
(function () {
    'use strict';

    function daysSince(input) {
        if (!input) return null;
        const d = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(d.getTime())) return null;
        const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
        return Math.max(1, days);
    }

    function median(arr) {
        if (!arr.length) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // Median absolute deviation. The 1.4826 factor scales MAD to be a
    // consistent estimator of standard deviation for normal data, which
    // means the conventional "k=2 or k=3" threshold lines up with z-scores.
    function mad(arr) {
        if (!arr.length) return 0;
        const m = median(arr);
        const deviations = arr.map((x) => Math.abs(x - m));
        return 1.4826 * median(deviations);
    }

    /**
     * Identify outliers using median + k·MAD (robust to skew, works on n>=10).
     * Returns the array of booleans aligned with `values`.
     */
    function madOutliersMask(values, k = 2.5) {
        const m = median(values);
        const d = mad(values);
        if (d === 0) return values.map(() => false);
        return values.map((x) => Math.abs(x - m) / d > k);
    }

    function perDayViews(video) {
        const views = window.toNumber(video.views);
        const days = daysSince(video.published_at);
        if (!days) return null;
        return views / days;
    }

    function engagementRate({ likes, comments, views }) {
        const v = window.toNumber(views);
        if (v <= 0) return 0;
        return ((window.toNumber(likes) + window.toNumber(comments)) / v) * 100;
    }
    function likeRate({ likes, views }) {
        const v = window.toNumber(views);
        if (v <= 0) return 0;
        return (window.toNumber(likes) / v) * 100;
    }
    function commentRate({ comments, views }) {
        const v = window.toNumber(views);
        if (v <= 0) return 0;
        return (window.toNumber(comments) / v) * 100;
    }

    window.Analytics = {
        daysSince,
        median,
        mad,
        madOutliersMask,
        perDayViews,
        engagementRate,
        likeRate,
        commentRate,
    };
})();
