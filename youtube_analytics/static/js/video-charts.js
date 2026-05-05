/**
 * Video-detail charts.
 *
 * Honest-analytics rewrite:
 *   - Benchmark: now compares against the SAME CHANNEL's other videos (was
 *     previously the user's localStorage history, which mixed unrelated
 *     channels into a meaningless median)
 *   - Velocity: shows actual since-publish rates (per day, per week, lifetime)
 *     INSTEAD of linearly extrapolating cumulative views into a fictional
 *     "per year" projection
 *   - Trend vs Channel: shows channel videos as a scatter of (publish date,
 *     views) and highlights the current video, instead of forcing two series
 *     onto the same line with null-gaps that zig-zag through publish dates
 *   - Composition: views removed from the doughnut (it was 1000× the others
 *     so the chart was effectively one slice); now only shows likes vs comments
 */
(function () {
    'use strict';

    const state = window.VideoChartsState || (window.VideoChartsState = {});
    const theme = () => window.CHART_THEME;
    const A = () => window.Analytics;

    function placeholder(canvas, msg) {
        canvas.parentElement.innerHTML = `<p class="placeholder">${msg}</p>`;
    }

    // ---------------------------------------------------------------------
    // Engagement composition: likes vs comments only.
    //
    // The original chart included views in the doughnut, but views are
    // typically 100–1000× larger than likes/comments, so the doughnut showed
    // a single slice. Now it shows the like/comment split — the actual
    // "engagement composition" most readers expect.
    // ---------------------------------------------------------------------
    function drawVideoCompositionChart(canvas, data) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoCompositionChartInstance) state.videoCompositionChartInstance.destroy();

        const likes = window.toNumber(data.likes);
        const comments = window.toNumber(data.comments);
        const total = likes + comments;

        if (total === 0) return placeholder(canvas, 'No likes or comments to display');

        state.videoCompositionChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Likes', 'Comments'],
                datasets: [{
                    data: [likes, comments],
                    backgroundColor: ['rgba(31, 122, 85, 0.85)', 'rgba(176, 135, 74, 0.85)'],
                    borderColor: theme().border,
                    borderWidth: 1.5,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Engagement Composition'),
                    subtitle: chartSubtitle('Likes vs comments • views excluded (different scale)'),
                    legend: { position: 'bottom', labels: legendLabelStyle() },
                    tooltip: tooltipDefaults({
                        body: (c) => {
                            const pct = ((c.parsed / total) * 100).toFixed(1);
                            return `${window.formatNumber(c.parsed)} (${pct}%)`;
                        },
                    }),
                },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Benchmark: compare to the SAME CHANNEL's other videos.
    //
    // The third arg `channelVideos` is now load-bearing — without it we have
    // no honest baseline. Falls back to a "no benchmark" placeholder.
    // ---------------------------------------------------------------------
    function drawVideoBenchmarkChart(canvas, data, channelVideos) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoBenchmarkChartInstance) state.videoBenchmarkChartInstance.destroy();

        // Only use sibling videos that aren't the one we're analyzing.
        const siblings = (channelVideos || []).filter(
            (v) => v && v.video_id && v.video_id !== data.video_id,
        );

        if (siblings.length < 3) {
            return placeholder(canvas, 'Need ≥3 sibling videos in DB for a fair benchmark');
        }

        const viewsList = siblings.map((v) => window.toNumber(v.views));
        const likesList = siblings.map((v) => window.toNumber(v.likes));
        const commentsList = siblings.map((v) => window.toNumber(v.comments));

        const medianViews = A().median(viewsList);
        const medianLikes = A().median(likesList);
        const medianComments = A().median(commentsList);

        const metrics = [
            { label: 'Views', value: data.views, median: medianViews },
            { label: 'Likes', value: data.likes, median: medianLikes },
            { label: 'Comments', value: data.comments, median: medianComments },
        ];
        const relative = metrics.map((m) => (m.median > 0 ? (m.value / m.median) * 100 : 0));

        state.videoBenchmarkChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: metrics.map((m) => m.label),
                datasets: [
                    {
                        label: 'This video vs channel median',
                        data: relative,
                        backgroundColor: [theme().brandBlueLight, theme().brandGreenLight, theme().brandGoldLight],
                        borderColor: [theme().brandBlue, theme().brandGreen, theme().brandGold],
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Channel median (100%)',
                        data: metrics.map(() => 100),
                        type: 'line',
                        borderColor: 'rgba(120, 130, 140, 0.9)',
                        borderDash: [6, 4],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Benchmark vs Channel Siblings'),
                    subtitle: chartSubtitle(`Compared to median of ${siblings.length} other videos in this channel`),
                    legend: { position: 'bottom', labels: legendLabelStyle() },
                    tooltip: tooltipDefaults({
                        body: (c) => {
                            const idx = c.dataIndex;
                            const m = metrics[idx];
                            const rel = relative[idx];
                            return `${m.label}: ${window.formatNumber(m.value)} vs ${window.formatNumber(m.median)} (${rel.toFixed(0)}%)`;
                        },
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
    // Engagement rate breakdown — radar of engagement / like rate / comment rate.
    // (Like-rate + comment-rate ≈ engagement rate, but seeing both components
    // and the total is genuinely useful.)
    // ---------------------------------------------------------------------
    function drawVideoEngagementRateChart(canvas, data) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoEngagementRateChartInstance) state.videoEngagementRateChartInstance.destroy();

        const engagementRate = A().engagementRate(data);
        const likeRate = A().likeRate(data);
        const commentRate = A().commentRate(data);
        const maxRate = Math.max(engagementRate, likeRate, commentRate);
        const scaleMax = Math.max(1, Math.ceil(maxRate * 1.2));

        state.videoEngagementRateChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'radar',
            data: {
                labels: ['Engagement', 'Like Rate', 'Comment Rate'],
                datasets: [{
                    label: 'Rate (%)',
                    data: [engagementRate, likeRate, commentRate],
                    backgroundColor: 'rgba(31, 122, 85, 0.2)',
                    borderColor: theme().brandGreen,
                    pointBackgroundColor: theme().brandGreen,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    fill: true,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Engagement Rate Breakdown'),
                    subtitle: chartSubtitle('All metrics as % of views'),
                    legend: { display: false },
                    tooltip: tooltipDefaults({
                        body: (c) => `${(c.parsed.r || 0).toFixed(2)}%`,
                    }),
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: scaleMax,
                        grid: { color: theme().grid },
                        angleLines: { color: theme().grid },
                        pointLabels: { color: theme().text, font: { size: 11, weight: '600' } },
                        ticks: { color: theme().textMuted, font: { size: 11, weight: '500' }, callback: (v) => `${v}%` },
                    },
                },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Engagement efficiency: per-1k normalised metrics. Honest as-is.
    // ---------------------------------------------------------------------
    function drawVideoPercentileChart(canvas, data) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoPercentileChartInstance) state.videoPercentileChartInstance.destroy();

        const views = Math.max(1, window.toNumber(data.views));
        const likesPer1k = (window.toNumber(data.likes) / views) * 1000;
        const commentsPer1k = (window.toNumber(data.comments) / views) * 1000;
        const engagementPct = A().engagementRate(data);

        state.videoPercentileChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Likes / 1K', 'Comments / 1K', 'Engagement %'],
                datasets: [{
                    label: 'Efficiency Metrics',
                    data: [likesPer1k, commentsPer1k, engagementPct],
                    backgroundColor: [theme().brandGreenLight, theme().brandGoldLight, theme().brandBlueLight],
                    borderColor: [theme().brandGreen, theme().brandGold, theme().brandBlue],
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Engagement Efficiency'),
                    subtitle: chartSubtitle('Rates normalized per 1,000 views'),
                    legend: { display: false },
                    tooltip: tooltipDefaults({
                        body: (c) => {
                            const isPct = c.label.includes('%');
                            return `${c.label}: ${c.parsed.y.toFixed(2)}${isPct ? '%' : ''}`;
                        },
                    }),
                },
                scales: { y: numericAxis(), x: { grid: { display: false }, ticks: labelTickStyle() } },
            },
        });
    }

    // ---------------------------------------------------------------------
    // Channel sibling scatter — replaces the broken zig-zag line.
    //
    // x = lifetime views, y = engagement %, one dot per sibling video.
    // Current video shown in highlight color so the user can immediately see
    // where it sits in the channel's distribution. No misleading line.
    // ---------------------------------------------------------------------
    function drawVideoChannelTrendChart(canvas, video, channelVideos) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoChannelTrendChartInstance) state.videoChannelTrendChartInstance.destroy();

        const siblings = (channelVideos || []).filter(
            (v) => v && v.video_id && v.video_id !== video?.video_id,
        );

        if (siblings.length === 0) {
            return placeholder(canvas, 'No sibling videos in DB to compare against');
        }

        const toPoint = (v) => {
            const views = window.toNumber(v.views);
            return {
                x: Math.max(views, 1),
                y: A().engagementRate({ likes: v.likes, comments: v.comments, views }),
                title: v.title || 'Video',
                views,
            };
        };

        const siblingPoints = siblings.map(toPoint);
        const currentPoint = video ? toPoint(video) : null;

        const medianViews = A().median(siblingPoints.map((p) => p.x));
        const medianEng = A().median(siblingPoints.map((p) => p.y));

        const datasets = [
            {
                label: `Channel videos (n=${siblingPoints.length})`,
                data: siblingPoints,
                backgroundColor: theme().brandBlueLight,
                borderColor: theme().brandBlue,
                borderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ];
        if (currentPoint) {
            datasets.push({
                label: 'This video',
                data: [currentPoint],
                backgroundColor: theme().brandGold,
                borderColor: theme().brandGold,
                pointRadius: 8,
                pointHoverRadius: 10,
                pointStyle: 'rectRounded',
            });
        }

        state.videoChannelTrendChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('This Video vs Channel Distribution'),
                    subtitle: chartSubtitle(
                        `Channel medians: ${window.formatNumber(medianViews)} views • ${medianEng.toFixed(2)}% engagement`,
                    ),
                    legend: { position: 'bottom', labels: legendLabelStyle() },
                    tooltip: tooltipDefaults({
                        title: (items) => items[0].raw.title || 'Video',
                        body: (d) => [
                            `Views: ${window.formatNumber(d.views)}`,
                            `Engagement: ${d.y.toFixed(2)}%`,
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
    // Velocity — actual since-publish rates, NOT linear extrapolation.
    //
    // Old chart computed total_views/days_since_publish then *365 for "per
    // year". YouTube views follow a power-law decay: ~50% of lifetime views
    // typically come in the first week. Multiplying daily rate by 365 is
    // fantasy. Now we show:
    //   - Lifetime total
    //   - Per-day rate since publish (honest)
    //   - Per-week rate (= per-day × 7, just unit conversion)
    //   - Estimated daily earnings at current RPM
    // No "monthly/yearly projection" anymore.
    // ---------------------------------------------------------------------
    function drawVideoVelocityChart(canvas, video) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoVelocityChartInstance) state.videoVelocityChartInstance.destroy();

        const views = window.toNumber(video.views);
        const likes = window.toNumber(video.likes);
        const days = A().daysSince(video.published_at);
        if (!days) return placeholder(canvas, 'Publish date required for velocity');

        const rpmInput = document.getElementById('video-rpm-input');
        const rpm = rpmInput ? Math.max(0, parseFloat(rpmInput.value || '0')) : 0;

        const viewsPerDay = views / days;
        const likesPerDay = likes / days;
        const earningsPerDay = (viewsPerDay / 1000) * rpm;
        const earningsLifetime = (views / 1000) * rpm;

        const labels = ['Per Day', 'Per Week', 'Lifetime'];
        const viewsSeries = [viewsPerDay, viewsPerDay * 7, views];
        const likesSeries = [likesPerDay, likesPerDay * 7, likes];
        const earningsSeries = [earningsPerDay, earningsPerDay * 7, earningsLifetime];

        state.videoVelocityChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Views',
                        data: viewsSeries,
                        backgroundColor: theme().brandBlueLight,
                        borderColor: theme().brandBlue,
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Likes',
                        data: likesSeries,
                        backgroundColor: theme().brandGreenLight,
                        borderColor: theme().brandGreen,
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Earnings (USD)',
                        data: earningsSeries,
                        type: 'line',
                        borderColor: theme().brandGold,
                        backgroundColor: theme().brandGoldLight,
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: false,
                        yAxisID: 'y1',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: chartTitle('Velocity Since Publish'),
                    subtitle: chartSubtitle(
                        `Video age: ${days} day${days === 1 ? '' : 's'} • RPM $${rpm.toFixed(2)}/1k views`
                        + ` • per-day = lifetime ÷ age (smoothed average)`,
                    ),
                    legend: { position: 'bottom', labels: legendLabelStyle() },
                    tooltip: tooltipDefaults({
                        body: (c) => {
                            const label = c.dataset.label || '';
                            if (c.dataset.yAxisID === 'y1') {
                                return `${label}: $${c.parsed.y.toFixed(2)}`;
                            }
                            return `${label}: ${window.formatNumber(Math.round(c.parsed.y))}`;
                        },
                    }),
                },
                scales: {
                    y: numericAxis(),
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        grid: { display: false },
                        ticks: {
                            color: theme().textMuted,
                            font: { size: 12, weight: '500' },
                            callback: (v) => `$${v}`,
                            padding: 10,
                        },
                    },
                    x: { grid: { display: false }, ticks: labelTickStyle() },
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

    window.VideoCharts = {
        drawVideoCompositionChart,
        drawVideoBenchmarkChart,
        drawVideoEngagementRateChart,
        drawVideoPercentileChart,
        drawVideoChannelTrendChart,
        drawVideoVelocityChart,
    };
})();
