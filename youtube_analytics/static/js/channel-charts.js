/**
 * Channel-detail charts.
 *
 * Honest-analytics rewrite (see ANALYTICS.md if extracted):
 *   - "CTR Proxy" → renamed to "Like Rate" (likes/views, NOT click-through)
 *   - "Engagement Rate Over Time" → per-video scatter so the user can see
 *     each video's age vs engagement instead of a falsely-aggregated line
 *   - "Top 5% View Outliers" → median + 2.5·MAD outlier test, robust at n≥10
 *   - "Top Comments" → horizontal bar (data is not share-of-whole)
 *   - "Publishing Timeline" → relabelled "Lifetime Views by Publish Date"
 */
(function () {
    'use strict';

    const state = window.ChannelChartsState || (window.ChannelChartsState = {});
    const theme = () => window.CHART_THEME;
    const A = () => window.Analytics;

    function placeholder(canvas, msg) {
        canvas.parentElement.innerHTML = `<p class="placeholder">${msg}</p>`;
    }

    // ---------------------------------------------------------------------
    // Top videos: views vs likes scatter, bubble size = √comments
    // ---------------------------------------------------------------------
    function drawTopVideosChart(canvas, videos) {
        if (state.topVideosChartInstance) state.topVideosChartInstance.destroy();
        if (videos.length === 0) return placeholder(canvas, 'No video data available');

        const top = videos
            .map((v) => ({
                title: (v.title || 'Video').substring(0, 20),
                views: window.toNumber(v.views),
                likes: window.toNumber(v.likes),
                comments: window.toNumber(v.comments),
            }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 12);

        state.topVideosChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Top videos',
                    data: top.map((v) => ({
                        x: v.views,
                        y: v.likes,
                        r: Math.max(4, Math.sqrt(v.comments || 0)),
                        title: v.title,
                    })),
                    backgroundColor: theme().brandBlueLight,
                    borderColor: theme().brandBlue,
                    borderWidth: 2,
                }],
            },
            options: scatterOptions({
                title: 'Top Videos: Views vs Likes',
                subtitle: `Bubble size = √comments • n = ${top.length}`,
                xLabel: 'Views',
                yLabel: 'Likes',
                tooltipBody: (d) => [
                    `Views: ${window.formatNumber(d.x)}`,
                    `Likes: ${window.formatNumber(d.y)}`,
                    `Comments: ${window.formatNumber(Math.round(d.r * d.r))}`,
                ],
            }),
        });
    }

    // ---------------------------------------------------------------------
    // Engagement metrics — bubble of (views, likes, comments, engagement)
    // Same as before, but with honest subtitle.
    // ---------------------------------------------------------------------
    function drawEngagementChart(canvas, videos) {
        if (state.engagementChartInstance) state.engagementChartInstance.destroy();
        if (videos.length === 0) return placeholder(canvas, 'No video data available');

        const points = videos
            .map((v) => {
                const views = window.toNumber(v.views);
                const likes = window.toNumber(v.likes);
                const comments = window.toNumber(v.comments);
                return {
                    title: (v.title || 'Video').substring(0, 18),
                    views, likes, comments,
                    engagement: A().engagementRate({ likes, comments, views }),
                };
            })
            .filter((p) => p.views > 0 || p.likes > 0 || p.comments > 0);

        if (points.length === 0) return placeholder(canvas, 'No engagement data available');

        const minRate = Math.min(...points.map((p) => p.engagement));
        const maxRate = Math.max(...points.map((p) => p.engagement));
        const lerp = (a, b, t) => Math.round(a + (b - a) * t);
        const rateColor = (rate) => {
            const t = maxRate > minRate ? (rate - minRate) / (maxRate - minRate) : 0.5;
            return `rgba(${lerp(31, 176, t)}, ${lerp(122, 135, t)}, ${lerp(85, 74, t)}, 0.7)`;
        };

        state.engagementChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Engagement',
                    data: points.map((p) => ({
                        x: p.views,
                        y: p.likes,
                        r: Math.max(4, Math.sqrt(p.comments || 0)),
                        title: p.title,
                        engagement: p.engagement,
                        comments: p.comments,
                    })),
                    backgroundColor: points.map((p) => rateColor(p.engagement)),
                    borderColor: theme().brandBlue,
                    borderWidth: 1.5,
                }],
            },
            options: scatterOptions({
                title: 'Engagement Metrics Map',
                subtitle: 'X = views • Y = likes • size = √comments • color = engagement %',
                xLabel: 'Views',
                yLabel: 'Likes',
                tooltipBody: (d) => [
                    `Views: ${window.formatNumber(d.x)}`,
                    `Likes: ${window.formatNumber(d.y)}`,
                    `Comments: ${window.formatNumber(d.comments)}`,
                    `Engagement: ${d.engagement.toFixed(2)}%`,
                ],
            }),
        });
    }

    // ---------------------------------------------------------------------
    // Top comments: horizontal bar (NOT a doughnut — data isn't share-of-whole)
    // ---------------------------------------------------------------------
    function drawCommentsChart(canvas, videos) {
        if (state.commentsChartInstance) state.commentsChartInstance.destroy();
        if (videos.length === 0) return placeholder(canvas, 'No video data available');

        const top = videos
            .map((v) => ({
                title: (v.title || 'Video').substring(0, 28),
                comments: window.toNumber(v.comments),
            }))
            .filter((v) => v.comments > 0)
            .sort((a, b) => b.comments - a.comments)
            .slice(0, 8);

        if (top.length === 0) return placeholder(canvas, 'No comment data available');

        state.commentsChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: top.map((v) => v.title),
                datasets: [{
                    label: 'Comments',
                    data: top.map((v) => v.comments),
                    backgroundColor: theme().brandGoldLight,
                    borderColor: theme().brandGold,
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Most-Discussed Videos'),
                    subtitle: chartSubtitle(`Top ${top.length} by comment count`),
                    legend: { display: false },
                    tooltip: tooltipDefaults({
                        body: (c) => `${window.formatNumber(c.parsed.x)} comments`,
                    }),
                },
                scales: {
                    x: numericAxis(),
                    y: { grid: { display: false }, ticks: labelTickStyle() },
                },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Lifetime views by publish date.
    // Renamed from "Publishing Timeline (Views)" — the line implies time-series
    // continuity but it's really cumulative-lifetime views, so we now overlay a
    // mean baseline and clearly title it.
    // ---------------------------------------------------------------------
    function drawViewsTrendChart(canvas, videos) {
        if (state.viewsTrendChartInstance) state.viewsTrendChartInstance.destroy();
        if (videos.length === 0) return placeholder(canvas, 'No video data available');

        const points = videos
            .map((v) => ({
                date: v.published_at ? new Date(v.published_at) : null,
                views: window.toNumber(v.views),
                title: v.title || 'Video',
            }))
            .filter((v) => v.date && !Number.isNaN(v.date.getTime()))
            .sort((a, b) => a.date - b.date);

        if (points.length === 0) return placeholder(canvas, 'No timeline data available');

        const labels = points.map((p) => p.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        const data = points.map((p) => p.views);
        const avgViews = data.reduce((s, v) => s + v, 0) / data.length;

        state.viewsTrendChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Lifetime views',
                        data,
                        borderColor: theme().brandBlue,
                        backgroundColor: theme().brandBlueLight,
                        fill: true,
                        tension: 0.35,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                    },
                    {
                        label: 'Mean',
                        data: labels.map(() => avgViews),
                        borderColor: 'rgba(120, 130, 140, 0.9)',
                        borderDash: [6, 4],
                        fill: false,
                        pointRadius: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Lifetime Views by Publish Date'),
                    subtitle: chartSubtitle('Each point = one video; older videos have had longer to accumulate views'),
                    legend: { position: 'bottom', labels: legendLabelStyle() },
                    tooltip: tooltipDefaults({
                        body: (c) => `${window.formatNumber(c.parsed.y)} views`,
                    }),
                },
                scales: { y: numericAxis(), x: dateAxis() },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Engagement rate per video (scatter, NOT line over time).
    //
    // Old chart aggregated likes/comments/views by publish month and
    // computed (likes+comments)/views per month — but lifetime totals make
    // older months look artificially better. Per-video scatter shows the
    // distribution honestly: each dot = one video, x = publish date, y = %.
    // ---------------------------------------------------------------------
    function drawEngagementTrendChart(canvas, videos) {
        if (state.engagementTrendChartInstance) state.engagementTrendChartInstance.destroy();
        if (videos.length === 0) return placeholder(canvas, 'No video data available');

        const points = videos
            .map((v) => {
                const date = v.published_at ? new Date(v.published_at) : null;
                if (!date || Number.isNaN(date.getTime())) return null;
                const views = window.toNumber(v.views);
                if (views <= 0) return null;
                return {
                    x: date.getTime(),
                    y: A().engagementRate({
                        likes: v.likes, comments: v.comments, views,
                    }),
                    title: v.title || 'Video',
                    label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                };
            })
            .filter(Boolean);

        if (points.length === 0) return placeholder(canvas, 'No engagement data available');

        const med = A().median(points.map((p) => p.y));

        state.engagementTrendChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Per-video engagement',
                        data: points,
                        backgroundColor: theme().brandGreenLight,
                        borderColor: theme().brandGreen,
                        borderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                    {
                        label: `Channel median (${med.toFixed(2)}%)`,
                        type: 'line',
                        data: [
                            { x: Math.min(...points.map((p) => p.x)), y: med },
                            { x: Math.max(...points.map((p) => p.x)), y: med },
                        ],
                        borderColor: 'rgba(120, 130, 140, 0.9)',
                        borderDash: [6, 4],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Engagement Rate per Video'),
                    subtitle: chartSubtitle('Each dot = one video • dashed line = channel median'),
                    legend: { position: 'bottom', labels: legendLabelStyle() },
                    tooltip: tooltipDefaults({
                        title: (items) => items[0].raw.title || 'Video',
                        body: (d) => [`${d.label}`, `Engagement: ${d.y.toFixed(2)}%`],
                    }),
                },
                scales: {
                    y: { ...numericAxis(), ticks: { ...numericAxis().ticks, callback: (v) => `${v}%` } },
                    x: {
                        type: 'linear',
                        grid: { display: false },
                        ticks: {
                            color: theme().text,
                            font: { size: 12, weight: '600' },
                            padding: 10,
                            maxTicksLimit: 8,
                            callback: (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                        },
                    },
                },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Like rate (rebranded from "CTR Proxy")
    // CTR = click-through rate (impressions → clicks), which YouTube does NOT
    // expose via the Data API. likes/views is just the like rate. We label it
    // honestly now.
    // ---------------------------------------------------------------------
    function drawCtrProxyChart(canvas, videos) {
        if (state.ctrProxyChartInstance) state.ctrProxyChartInstance.destroy();
        if (videos.length === 0) return placeholder(canvas, 'No video data available');

        const top = videos
            .map((v) => ({
                title: (v.title || 'Video').substring(0, 28),
                rate: A().likeRate({ likes: v.likes, views: v.views }),
            }))
            .filter((v) => v.rate > 0)
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 8);

        if (top.length === 0) return placeholder(canvas, 'No engagement data');

        state.ctrProxyChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: top.map((v) => v.title),
                datasets: [{
                    label: 'Like rate (%)',
                    data: top.map((v) => v.rate),
                    backgroundColor: theme().brandBlueLight,
                    borderColor: theme().brandBlue,
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Like Rate (Top 8)'),
                    subtitle: chartSubtitle('Likes ÷ views • not a click-through-rate proxy'),
                    legend: { display: false },
                    tooltip: tooltipDefaults({
                        body: (c) => `${c.parsed.x.toFixed(2)}%`,
                    }),
                },
                scales: {
                    x: { ...numericAxis(), ticks: { ...numericAxis().ticks, callback: (v) => `${v}%` } },
                    y: { grid: { display: false }, ticks: labelTickStyle() },
                },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Robust outliers: median + k·MAD.
    // Replaces the old "top 5%" which was meaningless on n<30.
    // ---------------------------------------------------------------------
    function drawOutliersChart(canvas, videos) {
        if (state.outliersChartInstance) state.outliersChartInstance.destroy();
        if (videos.length === 0) return placeholder(canvas, 'No video data available');

        const enriched = videos
            .map((v) => {
                const views = window.toNumber(v.views);
                const likes = window.toNumber(v.likes);
                const comments = window.toNumber(v.comments);
                return {
                    title: (v.title || 'Video').substring(0, 22),
                    views, likes, comments,
                    engagement: A().engagementRate({ likes, comments, views }),
                };
            })
            .filter((v) => v.views > 0);

        if (enriched.length < 5) return placeholder(canvas, 'Need ≥5 videos for outlier detection');

        const viewsArr = enriched.map((v) => v.views);
        const med = A().median(viewsArr);
        const dev = A().mad(viewsArr);
        const k = 2.5;

        // Annotate each point with its z-score and outlier status.
        const annotated = enriched.map((v) => {
            const zMad = dev > 0 ? (v.views - med) / dev : 0;
            return { ...v, zMad, isOutlier: dev > 0 && zMad > k };
        });

        const outliers = annotated.filter((v) => v.isOutlier);
        const normal = annotated.filter((v) => !v.isOutlier);

        state.outliersChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bubble',
            data: {
                datasets: [
                    {
                        label: 'Normal',
                        data: normal.map((v) => ({
                            x: Math.max(v.views, 1),
                            y: v.engagement,
                            r: Math.max(4, Math.sqrt(v.comments || 0)),
                            ...v,
                        })),
                        backgroundColor: theme().brandBlueLight,
                        borderColor: theme().brandBlue,
                        borderWidth: 1,
                    },
                    {
                        label: `Outliers (z-MAD > ${k})`,
                        data: outliers.map((v) => ({
                            x: Math.max(v.views, 1),
                            y: v.engagement,
                            r: Math.max(6, Math.sqrt(v.comments || 0)),
                            ...v,
                        })),
                        backgroundColor: theme().brandGoldLight,
                        borderColor: theme().brandGold,
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('View Outliers (Median + MAD)'),
                    subtitle: chartSubtitle(
                        `Median: ${window.formatNumber(med)} • MAD: ${window.formatNumber(Math.round(dev))}` +
                        ` • ${outliers.length} outlier(s) of ${enriched.length}`,
                    ),
                    legend: { position: 'bottom', labels: legendLabelStyle() },
                    tooltip: tooltipDefaults({
                        title: (items) => items[0].raw.title || 'Video',
                        body: (d) => [
                            `Views: ${window.formatNumber(d.views)}`,
                            `Engagement: ${d.engagement.toFixed(2)}%`,
                            `z-MAD: ${d.zMad.toFixed(2)}`,
                        ],
                    }),
                },
                scales: {
                    x: {
                        type: 'logarithmic',
                        grid: { color: theme().grid },
                        ticks: {
                            color: theme().textMuted,
                            font: { size: 12, weight: '500' },
                            callback: (v) => window.formatNumber(v),
                            padding: 10,
                        },
                        title: { display: true, text: 'Views (log)', color: theme().textMuted, font: { size: 11, weight: '600' } },
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid },
                        ticks: { ...numericAxis().ticks, callback: (v) => `${v}%` },
                        title: { display: true, text: 'Engagement %', color: theme().textMuted, font: { size: 11, weight: '600' } },
                    },
                },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Shared option helpers
    // ---------------------------------------------------------------------
    function chartTitle(text) {
        return { display: true, text, color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } };
    }
    function chartSubtitle(text) {
        return { display: true, text, color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } };
    }
    function legendLabelStyle() {
        return { color: theme().textMuted, font: { size: 11, weight: '600' } };
    }
    function labelTickStyle(extra = {}) {
        return { color: theme().text, font: { size: 12, weight: '600' }, padding: 10, ...extra };
    }
    function numericAxis() {
        return {
            beginAtZero: true,
            grid: { color: theme().grid },
            ticks: {
                color: theme().textMuted,
                font: { size: 12, weight: '500' },
                callback: (v) => window.formatNumber(v),
                padding: 10,
            },
        };
    }
    function dateAxis() {
        return {
            grid: { display: false },
            ticks: labelTickStyle({ maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }),
        };
    }
    function tooltipDefaults({ title, body }) {
        return {
            enabled: true,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 14,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12, weight: '500' },
            borderColor: theme().border,
            borderWidth: 1,
            callbacks: {
                ...(title ? { title } : {}),
                label: (item) => {
                    const result = body(item.raw || item);
                    return Array.isArray(result) ? result : [result];
                },
            },
        };
    }
    function scatterOptions({ title, subtitle, tooltipBody }) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: chartTitle(title),
                subtitle: chartSubtitle(subtitle),
                legend: { display: false },
                tooltip: tooltipDefaults({
                    title: (items) => items[0].raw.title || 'Video',
                    body: tooltipBody,
                }),
            },
            scales: { x: numericAxis(), y: numericAxis() },
        };
    }

    window.ChannelCharts = {
        drawTopVideosChart,
        drawEngagementChart,
        drawCommentsChart,
        drawViewsTrendChart,
        drawEngagementTrendChart,
        drawCtrProxyChart,        // kept under old name so app.js doesn't break
        drawOutliersChart,
    };
})();
