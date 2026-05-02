(function () {
    const state = window.ChannelChartsState || (window.ChannelChartsState = {});

    function theme() {
        return window.CHART_THEME;
    }

    function drawTopVideosChart(canvas, videos) {
        if (state.topVideosChartInstance) {
            state.topVideosChartInstance.destroy();
        }

        if (videos.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
            return;
        }

        const topVideos = videos.map(v => ({
            title: (v.title || 'Video').substring(0, 20),
            views: window.toNumber(v.views),
            likes: window.toNumber(v.likes),
            comments: window.toNumber(v.comments)
        })).sort((a, b) => b.views - a.views).slice(0, 12);

        const ctx = canvas.getContext('2d');

        state.topVideosChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Views vs Likes (bubble size = comments)',
                    data: topVideos.map(v => ({
                        x: v.views,
                        y: v.likes,
                        r: Math.max(4, Math.sqrt(v.comments || 0)),
                        title: v.title
                    })),
                    backgroundColor: theme().brandBlueLight,
                    borderColor: theme().brandBlue,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Top Videos: Views vs Likes', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: `Bubble size = comments • Sample size: ${topVideos.length}`, color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => items[0].raw.title || 'Video',
                            label: (item) => {
                                const d = item.raw;
                                return [
                                    `Views: ${window.formatNumber(d.x)}`,
                                    `Likes: ${window.formatNumber(d.y)}`,
                                    `Comments: ${window.formatNumber(Math.round(d.r * d.r))}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => window.formatNumber(v), padding: 10 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => window.formatNumber(v), padding: 10 }
                    }
                }
            }
        });
    }

    function drawEngagementChart(canvas, videos) {
        if (state.engagementChartInstance) {
            state.engagementChartInstance.destroy();
        }

        if (videos.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
            return;
        }

        const points = videos.map(v => {
            const views = window.toNumber(v.views);
            const likes = window.toNumber(v.likes);
            const comments = window.toNumber(v.comments);
            const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;
            return {
                title: (v.title || 'Video').substring(0, 18),
                views,
                likes,
                comments,
                engagement
            };
        }).filter(p => p.views > 0 || p.likes > 0 || p.comments > 0);

        if (points.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No engagement data available</p>';
            return;
        }

        const ctx = canvas.getContext('2d');
        const minRate = Math.min(...points.map(p => p.engagement));
        const maxRate = Math.max(...points.map(p => p.engagement));

        const lerp = (a, b, t) => Math.round(a + (b - a) * t);
        const rateColor = (rate) => {
            const t = maxRate > minRate ? (rate - minRate) / (maxRate - minRate) : 0.5;
            const r = lerp(31, 176, t);
            const g = lerp(122, 135, t);
            const b = lerp(85, 74, t);
            return `rgba(${r}, ${g}, ${b}, 0.7)`;
        };

        state.engagementChartInstance = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Engagement vs Views vs Likes',
                    data: points.map(p => ({
                        x: p.views,
                        y: p.likes,
                        r: Math.max(4, Math.sqrt(p.comments || 0)),
                        title: p.title,
                        engagement: p.engagement
                    })),
                    backgroundColor: points.map(p => rateColor(p.engagement)),
                    borderColor: theme().brandBlue,
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Engagement Metrics Map', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: 'X = views • Y = likes • Bubble size = comments • Color = engagement %', color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => items[0].raw.title || 'Video',
                            label: (c) => {
                                const d = c.raw;
                                return [
                                    `Views: ${window.formatNumber(d.x)}`,
                                    `Likes: ${window.formatNumber(d.y)}`,
                                    `Comments: ${window.formatNumber(Math.round(d.r * d.r))}`,
                                    `Engagement: ${d.engagement.toFixed(2)}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => window.formatNumber(v), padding: 10 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => window.formatNumber(v), padding: 10 }
                    }
                }
            }
        });
    }

    function drawCommentsChart(canvas, videos) {
        if (state.commentsChartInstance) {
            state.commentsChartInstance.destroy();
        }

        if (videos.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
            return;
        }

        const topComments = videos.map(v => ({
            title: (v.title || 'Video').substring(0, 16),
            comments: window.toNumber(v.comments)
        })).sort((a, b) => b.comments - a.comments).slice(0, 6);

        if (topComments.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No comment data available</p>';
            return;
        }

        const ctx = canvas.getContext('2d');
        state.commentsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: topComments.map(v => v.title),
                datasets: [{
                    label: 'Comments Share',
                    data: topComments.map(v => v.comments),
                    backgroundColor: [
                        'rgba(176, 135, 74, 0.85)',
                        'rgba(15, 76, 129, 0.85)',
                        'rgba(31, 122, 85, 0.85)',
                        'rgba(45, 120, 190, 0.85)',
                        'rgba(95, 166, 127, 0.85)',
                        'rgba(196, 170, 123, 0.85)'
                    ],
                    borderColor: theme().border,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Comment Share (Top Videos)', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: `Top ${topComments.length} by comments`, color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
                    legend: { position: 'bottom', labels: { color: theme().textMuted, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: { label: (c) => window.formatNumber(c.parsed) + ' comments' }
                    }
                }
            }
        });
    }

    function drawViewsTrendChart(canvas, videos) {
        if (state.viewsTrendChartInstance) {
            state.viewsTrendChartInstance.destroy();
        }

        if (videos.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
            return;
        }

        const points = videos
            .map(v => ({
                date: v.published_at ? new Date(v.published_at) : null,
                views: window.toNumber(v.views)
            }))
            .filter(v => v.date && !Number.isNaN(v.date.getTime()))
            .sort((a, b) => a.date - b.date);

        if (points.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No timeline data available</p>';
            return;
        }

        const labels = points.map(p => p.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        const data = points.map(p => p.views);

        const ctx = canvas.getContext('2d');
        const avgViews = data.reduce((s, v) => s + v, 0) / (data.length || 1);

        state.viewsTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Views',
                    data,
                    borderColor: theme().brandBlue,
                    backgroundColor: theme().brandBlueLight,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }, {
                    label: 'Average',
                    data: labels.map(() => avgViews),
                    borderColor: 'rgba(120, 130, 140, 0.9)',
                    borderDash: [6, 4],
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Publishing Timeline (Views)', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: `Benchmark: Average views • Sample size: ${data.length}`, color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
                    legend: { position: 'bottom', labels: { color: theme().textMuted, font: { size: 11, weight: '600' } } },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: { label: (c) => window.formatNumber(c.parsed.y) + ' views' }
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

    function drawEngagementTrendChart(canvas, videos) {
        if (state.engagementTrendChartInstance) {
            state.engagementTrendChartInstance.destroy();
        }

        if (videos.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
            return;
        }

        const monthly = {};
        videos.forEach(v => {
            if (!v.published_at) return;
            const date = new Date(v.published_at);
            if (Number.isNaN(date.getTime())) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const views = window.toNumber(v.views);
            const likes = window.toNumber(v.likes);
            const comments = window.toNumber(v.comments);
            if (!monthly[key]) {
                monthly[key] = { views: 0, likes: 0, comments: 0 };
            }
            monthly[key].views += views;
            monthly[key].likes += likes;
            monthly[key].comments += comments;
        });

        const keys = Object.keys(monthly).sort();
        if (keys.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No timeline data available</p>';
            return;
        }

        const labels = keys.map(k => {
            const [y, m] = k.split('-');
            const date = new Date(Number(y), Number(m) - 1, 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        });
        const data = keys.map(k => {
            const row = monthly[k];
            return row.views > 0 ? ((row.likes + row.comments) / row.views * 100) : 0;
        });

        const ctx = canvas.getContext('2d');
        state.engagementTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Engagement Rate (%)',
                    data,
                    borderColor: theme().brandGreen,
                    backgroundColor: theme().brandGreenLight,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Engagement Rate Over Time', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: { label: (c) => c.parsed.y.toFixed(2) + '%' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: theme().text, font: { size: 12, weight: '600' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                    }
                }
            }
        });
    }

    function drawCtrProxyChart(canvas, videos) {
        if (state.ctrProxyChartInstance) {
            state.ctrProxyChartInstance.destroy();
        }

        if (videos.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
            return;
        }

        const byRate = videos.map(v => {
            const views = window.toNumber(v.views);
            const likes = window.toNumber(v.likes);
            return {
                title: (v.title || 'Video').substring(0, 18),
                rate: views > 0 ? (likes / views * 100) : 0
            };
        }).sort((a, b) => b.rate - a.rate).slice(0, 8);

        const ctx = canvas.getContext('2d');
        state.ctrProxyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: byRate.map(v => v.title),
                datasets: [{
                    label: 'Likes per View (%)',
                    data: byRate.map(v => v.rate),
                    backgroundColor: theme().brandBlueLight,
                    borderColor: theme().brandBlue,
                    borderWidth: 2,
                    borderRadius: 10,
                    borderSkipped: false,
                    hoverBackgroundColor: theme().brandBlue,
                    hoverBorderWidth: 2.5
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'CTR Proxy (Likes per View)', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 14,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12, weight: '500' },
                        borderColor: theme().border,
                        borderWidth: 1,
                        callbacks: { label: (c) => c.parsed.x.toFixed(2) + '%' }
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

    function drawOutliersChart(canvas, videos) {
        if (state.outliersChartInstance) {
            state.outliersChartInstance.destroy();
        }

        if (videos.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
            return;
        }

        const viewsList = videos.map(v => window.toNumber(v.views)).filter(v => v > 0).sort((a, b) => a - b);
        if (viewsList.length === 0) {
            canvas.parentElement.innerHTML = '<p class="placeholder">No view data available</p>';
            return;
        }

        const idx = Math.floor(viewsList.length * 0.95);
        const threshold = viewsList[Math.min(idx, viewsList.length - 1)];

        let outliers = videos
            .map(v => {
                const views = window.toNumber(v.views);
                const likes = window.toNumber(v.likes);
                const comments = window.toNumber(v.comments);
                const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;
                return {
                    title: (v.title || 'Video').substring(0, 20),
                    views,
                    likes,
                    comments,
                    engagement
                };
            })
            .filter(v => v.views >= threshold)
            .sort((a, b) => b.views - a.views)
            .slice(0, 12);

        if (outliers.length === 0) {
            outliers = videos
                .map(v => {
                    const views = window.toNumber(v.views);
                    const likes = window.toNumber(v.likes);
                    const comments = window.toNumber(v.comments);
                    const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;
                    return {
                        title: (v.title || 'Video').substring(0, 20),
                        views,
                        likes,
                        comments,
                        engagement
                    };
                })
                .sort((a, b) => b.views - a.views)
                .slice(0, 6);
        }

        const ctx = canvas.getContext('2d');
        state.outliersChartInstance = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Outliers',
                    data: outliers.map(v => ({
                        x: Math.max(v.views, 1),
                        y: v.engagement,
                        r: Math.max(6, Math.sqrt(v.comments || 0)),
                        title: v.title,
                        views: v.views,
                        likes: v.likes,
                        comments: v.comments
                    })),
                    backgroundColor: theme().brandGoldLight,
                    borderColor: theme().brandGold,
                    borderWidth: 2,
                    hoverBackgroundColor: theme().brandGold
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Outlier Matrix (Views × Engagement)', color: theme().text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                    subtitle: { display: true, text: 'Bubble size = comments • X axis = views (log) • Y axis = engagement rate', color: theme().textMuted, font: { size: 11, weight: '500' }, padding: { bottom: 8 } },
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
                            title: (items) => items[0].raw.title || 'Video',
                            label: (item) => {
                                const d = item.raw;
                                return [
                                    `Views: ${window.formatNumber(d.views)}`,
                                    `Engagement: ${d.y.toFixed(2)}%`,
                                    `Likes: ${window.formatNumber(d.likes)}`,
                                    `Comments: ${window.formatNumber(d.comments)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'logarithmic',
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => window.formatNumber(v), padding: 10 },
                        title: { display: true, text: 'Views (log scale)', color: theme().textMuted, font: { size: 11, weight: '600' } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: theme().grid, drawBorder: true, borderColor: theme().border },
                        ticks: { color: theme().textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 },
                        title: { display: true, text: 'Engagement Rate (%)', color: theme().textMuted, font: { size: 11, weight: '600' } }
                    }
                }
            }
        });
    }

    window.ChannelCharts = {
        drawTopVideosChart,
        drawEngagementChart,
        drawCommentsChart,
        drawViewsTrendChart,
        drawEngagementTrendChart,
        drawCtrProxyChart,
        drawOutliersChart
    };
})();
