(function () {
    const state = window.VideoChartsState || (window.VideoChartsState = {});

    function theme() {
        return window.CHART_THEME;
    }

    function drawVideoCompositionChart(canvas, data) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoCompositionChartInstance) {
            state.videoCompositionChartInstance.destroy();
        }

        const total = data.views + data.likes + data.comments;
        const ctx = canvas.getContext('2d');
        state.videoCompositionChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Views', 'Likes', 'Comments'],
                datasets: [{
                    data: [data.views, data.likes, data.comments],
                    backgroundColor: [
                        'rgba(15, 76, 129, 0.85)',
                        'rgba(31, 122, 85, 0.85)',
                        'rgba(176, 135, 74, 0.85)'
                    ],
                    borderColor: theme().border,
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Engagement Composition', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    legend: { position: 'bottom', labels: { color: theme().textMuted, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: {
                            label: (c) => {
                                const pct = total > 0 ? ((c.parsed / total) * 100).toFixed(1) : '0.0';
                                return `${window.formatNumber(c.parsed)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function drawVideoBenchmarkChart(canvas, data) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoBenchmarkChartInstance) {
            state.videoBenchmarkChartInstance.destroy();
        }

        const benchmarks = window.getSavedBenchmarks();
        const metrics = [
            { key: 'views', label: 'Views', value: data.views, median: benchmarks.views },
            { key: 'likes', label: 'Likes', value: data.likes, median: benchmarks.likes },
            { key: 'comments', label: 'Comments', value: data.comments, median: benchmarks.comments }
        ];
        const relative = metrics.map(m => (m.median > 0 ? (m.value / m.median) * 100 : 0));
        const ctx = canvas.getContext('2d');
        state.videoBenchmarkChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: metrics.map(m => m.label),
                datasets: [{
                    label: 'Relative to Median (%)',
                    data: relative,
                    backgroundColor: [theme().brandBlueLight, theme().brandGreenLight, theme().brandGoldLight],
                    borderColor: [theme().brandBlue, theme().brandGreen, theme().brandGold],
                    borderWidth: 2,
                    borderRadius: 10,
                    borderSkipped: false
                }, {
                    label: 'Median Baseline (100%)',
                    data: metrics.map(() => 100),
                    type: 'line',
                    borderColor: 'rgba(120, 130, 140, 0.9)',
                    borderDash: [6, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Benchmark vs Saved Videos', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: 'Relative performance vs saved median (100% baseline)', color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
                    legend: { position: 'bottom', labels: { color: theme().textMuted, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: {
                            label: (c) => {
                                const idx = c.dataIndex;
                                const metric = metrics[idx];
                                const rel = relative[idx];
                                return `${metric.label}: ${window.formatNumber(metric.value)} vs ${window.formatNumber(metric.median)} (${rel.toFixed(0)}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 }
                    },
                    y: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: theme().text, font: { size: 12, weight: '600' }, padding: 10 }
                    }
                }
            }
        });
    }

    function drawVideoEngagementRateChart(canvas, data) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoEngagementRateChartInstance) {
            state.videoEngagementRateChartInstance.destroy();
        }

        const engagementRate = data.views > 0 ? ((data.likes + data.comments) / data.views) * 100 : 0;
        const likeRate = data.views > 0 ? (data.likes / data.views) * 100 : 0;
        const commentRate = data.views > 0 ? (data.comments / data.views) * 100 : 0;
        const maxRate = Math.max(engagementRate, likeRate, commentRate);
        const scaleMax = Math.max(1, Math.ceil(maxRate * 1.2));

        const ctx = canvas.getContext('2d');
        state.videoEngagementRateChartInstance = new Chart(ctx, {
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
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Engagement Rate Breakdown', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: { label: (c) => (c.parsed.r || 0).toFixed(2) + '%' }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: scaleMax,
                        grid: { color: theme().grid },
                        angleLines: { color: theme().grid },
                        pointLabels: { color: theme().text, font: { size: 11, weight: '600' } },
                        ticks: { color: theme().textMuted, font: { size: 11, weight: '500' }, callback: (v) => v + '%' }
                    }
                }
            }
        });
    }

    function drawVideoPercentileChart(canvas, data) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoPercentileChartInstance) {
            state.videoPercentileChartInstance.destroy();
        }

        const views = Math.max(1, data.views);
        const likesPer1k = (data.likes / views) * 1000;
        const commentsPer1k = (data.comments / views) * 1000;
        const engagementPct = ((data.likes + data.comments) / views) * 100;

        const ctx = canvas.getContext('2d');
        state.videoPercentileChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Likes / 1K', 'Comments / 1K', 'Engagement %'],
                datasets: [{
                    label: 'Efficiency Metrics',
                    data: [likesPer1k, commentsPer1k, engagementPct],
                    backgroundColor: [theme().brandGreenLight, theme().brandGoldLight, theme().brandBlueLight],
                    borderColor: [theme().brandGreen, theme().brandGold, theme().brandBlue],
                    borderWidth: 2,
                    borderRadius: 10,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Engagement Efficiency', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: 'Rates normalized per 1,000 views', color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: {
                            label: (c) => {
                                const label = c.label.includes('%') ? `${c.parsed.y.toFixed(2)}%` : `${c.parsed.y.toFixed(2)}`;
                                return `${c.label}: ${label}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, padding: 10 }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: theme().text, font: { size: 12, weight: '600' }, padding: 10 }
                    }
                }
            }
        });
    }

    function drawVideoChannelTrendChart(canvas, video, channelVideos) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoChannelTrendChartInstance) {
            state.videoChannelTrendChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        const points = [];

        if (Array.isArray(channelVideos) && channelVideos.length > 0) {
            channelVideos.forEach(v => {
                const date = v.published_at ? new Date(v.published_at) : null;
                if (!date || Number.isNaN(date.getTime())) return;
                points.push({ date, views: window.toNumber(v.views), isCurrent: false });
            });
        }

        const currentDate = video?.published_at ? new Date(video.published_at) : null;
        if (currentDate && !Number.isNaN(currentDate.getTime())) {
            points.push({ date: currentDate, views: window.toNumber(video.views), isCurrent: true });
        }

        if (points.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No timeline data available</p>';
            return;
        }

        const sorted = points.sort((a, b) => a.date - b.date);
        const labels = sorted.map(p => p.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        const channelSeries = sorted.map(p => (p.isCurrent ? null : p.views));
        const currentSeries = sorted.map(p => (p.isCurrent ? p.views : null));
        const channelViews = sorted.filter(p => !p.isCurrent).map(p => p.views);
        const avg = channelViews.length ? (channelViews.reduce((s, v) => s + v, 0) / channelViews.length) : null;
        const avgLine = sorted.map(() => avg);
        const currentViews = window.toNumber(video?.views);
        const deltaPct = avg > 0 ? ((currentViews / avg) * 100) : null;
        const currentColor = avg > 0 && currentViews >= avg ? theme().brandGreen : theme().brandGold;

        state.videoChannelTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Channel Views',
                        data: channelSeries,
                        borderColor: theme().brandBlue,
                        backgroundColor: theme().brandBlueLight,
                        fill: true,
                        tension: 0.35,
                        pointRadius: 2
                    },
                    {
                        label: 'Channel Average',
                        data: avgLine,
                        borderColor: 'rgba(120, 130, 140, 0.9)',
                        borderDash: [6, 4],
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'This Video',
                        data: currentSeries,
                        borderColor: currentColor,
                        backgroundColor: currentColor,
                        showLine: false,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Trend vs Channel Average', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: {
                        display: true,
                        text: avg > 0 ? `This video: ${window.formatNumber(currentViews)} views • ${deltaPct.toFixed(0)}% of channel avg` : 'Channel average unavailable',
                        color: theme().textMuted,
                        font: { size: 11, weight: '500' },
                        padding: { bottom: 8 }
                    },
                    legend: { position: 'bottom', labels: { color: theme().textMuted, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: {
                            label: (c) => {
                                if (c.dataset.label === 'This Video' && avg > 0) {
                                    const pct = ((c.parsed.y / avg) * 100).toFixed(0);
                                    return `${window.formatNumber(c.parsed.y)} views (${pct}% of avg)`;
                                }
                                return window.formatNumber(c.parsed.y) + ' views';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => window.formatNumber(v), padding: 10 }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: theme().text, font: { size: 12, weight: '600' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                    }
                }
            }
        });
    }

    function drawVideoVelocityChart(canvas, video) {
        if (!canvas || !canvas.getContext) return;
        if (state.videoVelocityChartInstance) {
            state.videoVelocityChartInstance.destroy();
        }

        const views = window.toNumber(video.views);
        const likes = window.toNumber(video.likes);
        const rpmInput = document.getElementById('video-rpm-input');
        const rpm = rpmInput ? Math.max(0, parseFloat(rpmInput.value || '0')) : 0;
        const publishedAt = video.published_at ? new Date(video.published_at) : null;
        if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
            canvas.parentElement.innerHTML = '<p class="placeholder">Publish date required for velocity</p>';
            return;
        }

        const days = Math.max(1, Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)));
        const viewsPerDay = views / days;
        const likesPerDay = likes / days;
        const earningsPerDay = (viewsPerDay / 1000) * rpm;
        const daysPerMonth = 30.4;
        const daysPerYear = 365;

        const labels = ['Per Day', 'Per Month', 'Per Year'];
        const viewsSeries = [viewsPerDay, viewsPerDay * daysPerMonth, viewsPerDay * daysPerYear];
        const likesSeries = [likesPerDay, likesPerDay * daysPerMonth, likesPerDay * daysPerYear];
        const earningsSeries = [earningsPerDay, earningsPerDay * daysPerMonth, earningsPerDay * daysPerYear];

        const ctx = canvas.getContext('2d');
        state.videoVelocityChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Views',
                    data: viewsSeries,
                    borderColor: theme().brandBlue,
                    backgroundColor: theme().brandBlueLight,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }, {
                    label: 'Likes',
                    data: likesSeries,
                    borderColor: theme().brandGreen,
                    backgroundColor: theme().brandGreenLight,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }, {
                    label: 'Estimated Earnings (USD)',
                    data: earningsSeries,
                    borderColor: theme().brandGold,
                    backgroundColor: theme().brandGoldLight,
                    fill: false,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Velocity Trend (Relative Rates)', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: `Normalized by publish date • RPM: $${rpm.toFixed(2)} per 1,000 views`, color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
                    legend: { position: 'bottom', labels: { color: theme().textMuted, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: {
                            label: (c) => {
                                const label = c.dataset.label || '';
                                if (c.dataset.yAxisID === 'y1') {
                                    return `${label}: $${c.parsed.y.toFixed(2)}`;
                                }
                                return `${label}: ${window.formatNumber(Math.round(c.parsed.y))}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => window.formatNumber(v), padding: 10 }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        grid: { display: false, drawBorder: false },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => `$${v}`, padding: 10 }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: theme().text, font: { size: 12, weight: '600' }, padding: 10 }
                    }
                }
            }
        });
    }

    window.VideoCharts = {
        drawVideoCompositionChart,
        drawVideoBenchmarkChart,
        drawVideoEngagementRateChart,
        drawVideoPercentileChart,
        drawVideoChannelTrendChart,
        drawVideoVelocityChart
    };
})();
