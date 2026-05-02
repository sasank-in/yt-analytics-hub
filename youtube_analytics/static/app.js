/**
 * YouTube Analytics Pro - Frontend Application
 * Vanilla JavaScript + FastAPI Integration
 */

// ==================== CONFIGURATION ====================

const API_BASE_URL = `${window.location.origin}/api`;
let currentChannelId = null;
let allChannels = [];
let savedVideos = []; // Store analyzed videos
let currentChannelVideos = []; // Store channel videos for quick access
let dashboardSubscribersChartInstance = null;
let dashboardViewsChartInstance = null;
let currentVideoAnalytics = null;


const CHART_THEME = {
    text: '#1b2b3a',
    textMuted: '#5b6b7a',
    grid: 'rgba(226, 231, 236, 0.8)',
    border: '#d6dde5',
    brandBlue: '#0f4c81',
    brandBlueLight: 'rgba(15, 76, 129, 0.15)',
    brandGreen: '#1f7a55',
    brandGreenLight: 'rgba(31, 122, 85, 0.18)',
    brandGold: '#b0874a',
    brandGoldLight: 'rgba(176, 135, 74, 0.18)',
    shadow: 'rgba(9, 30, 66, 0.15)'
};

window.CHART_THEME = CHART_THEME;
window.ChannelChartsState = window.ChannelChartsState || {};
window.VideoChartsState = window.VideoChartsState || {};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    applyChartTheme();
    initializeEventListeners();
    loadSavedVideos();
    await checkAPIHealth();
    await loadDashboard();
    // Always preload saved channels list for the channels page
    await loadSavedChannels();
});

function initializeEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', handleNavigation);
    });

    // Search
    document.getElementById('search-btn').addEventListener('click', handleChannelSearch);
    document.getElementById('search-query').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChannelSearch();
    });

    // Video Search
    const videoSearchBtn = document.getElementById('video-search-btn');
    if (videoSearchBtn) {
        videoSearchBtn.addEventListener('click', handleVideoSearch);
        const videoInput = document.getElementById('video-search-input');
        if (videoInput) {
            videoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleVideoSearch();
            });
        }
    }

    const rpmInput = document.getElementById('video-rpm-input');
    if (rpmInput) {
        rpmInput.addEventListener('input', () => {
            const rpm = Math.max(0, parseFloat(rpmInput.value || '0'));
            if (currentVideoAnalytics) {
                window.VideoCharts.drawVideoVelocityChart(document.getElementById('video-velocity-canvas'), currentVideoAnalytics);
            }
            saveChannelRpm(rpm);
        });
    }

    // Quick Select Boxes
    const quickChannelSelect = document.getElementById('quick-channel-select');
    if (quickChannelSelect) {
        quickChannelSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                selectChannel(e.target.value);
                e.target.value = '';  // Reset dropdown
            }
        });
    }

    const quickVideoSelect = document.getElementById('quick-video-select');
    if (quickVideoSelect) {
        quickVideoSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadVideoFromDbOnly(e.target.value);
                e.target.value = '';  // Reset dropdown
            }
        });
    }

    document.getElementById('back-btn').addEventListener('click', () => {
        showSection('channels');
    });

    document.getElementById('fetch-videos-btn').addEventListener('click', handleFetchVideos);
    document.getElementById('clear-cache-btn').addEventListener('click', clearCache);
    document.getElementById('export-data-btn').addEventListener('click', exportData);
}

// ==================== NAVIGATION ====================

function handleNavigation(e) {
    const btn = e.currentTarget;
    const section = btn.getAttribute('data-section');
    if (!section) return;
    showSection(section);

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));

    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');

        if (sectionId === 'dashboard') loadDashboard();
        if (sectionId === 'channels') loadSavedChannels();
        if (sectionId === 'settings') {
            checkAPIHealth();
            loadSettingsData();
        }
        if (sectionId === 'videos') {
            const results = document.getElementById('video-results');
            const input = document.getElementById('video-search-input');
            if (results) results.classList.add('hidden');
            if (input) input.value = '';
            refreshVideosQuickSelect();
        }
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
        const channels = await fetchAPI('/channels');
        const totalChannels = channels.count || 0;
        
        // Store for use in other functions
        allChannels = channels.channels || [];
        
        let totalVideos = 0;
        channels.channels.forEach(ch => {
            totalVideos += parseInt(ch.total_videos) || 0;
        });

        document.getElementById('total-channels').textContent = totalChannels;
        document.getElementById('total-videos').textContent = formatNumber(totalVideos);

        updateNavBadges(totalChannels, totalVideos);

        // Load recent channels
        loadRecentChannels(channels.channels.slice(0, 5));
        
        // Populate quick select box with channels
        populateQuickChannelSelect(allChannels);

        drawDashboardCharts(allChannels);
        updateDashboardHighlights(allChannels);
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Error loading dashboard', 'error');
    }
}

function loadRecentChannels(channels) {
    const container = document.getElementById('recent-channels');
    
    if (channels.length === 0) {
        container.innerHTML = '<p class="placeholder">No channels yet. Search for a channel to get started.</p>';
        return;
    }

    container.innerHTML = channels.map(ch => `
        <div class="channel-card-scroll" onclick="selectChannel('${ch.channel_id}')">
            <img src="${ch.profile_image || ''}" alt="${(ch.title || '').replace(/"/g, '&quot;')}">
            <h4>${ch.title || 'Channel'}</h4>
            <p>${formatNumber(ch.subscribers)} subs · ${formatNumber(ch.total_videos)} videos</p>
        </div>
    `).join('');
}

function drawDashboardCharts(channels) {
    const subscribersCanvas = document.getElementById('dashboard-subscribers-canvas');
    const viewsCanvas = document.getElementById('dashboard-views-canvas');

    if (!subscribersCanvas || !viewsCanvas) return;

    if (dashboardSubscribersChartInstance) dashboardSubscribersChartInstance.destroy();
    if (dashboardViewsChartInstance) dashboardViewsChartInstance.destroy();

    if (!channels || channels.length === 0) {
        subscribersCanvas.parentElement.innerHTML = '<p class="placeholder">No channel data available</p>';
        viewsCanvas.parentElement.innerHTML = '<p class="placeholder">No channel data available</p>';
        return;
    }

    const topBySubscribers = [...channels]
        .map(c => ({ title: (c.title || 'Channel').substring(0, 18), subscribers: toNumber(c.subscribers) }))
        .sort((a, b) => b.subscribers - a.subscribers)
        .slice(0, 8);

    const topByViews = [...channels]
        .map(c => ({ title: (c.title || 'Channel').substring(0, 18), views: toNumber(c.total_views) }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 6);

    const subsCtx = subscribersCanvas.getContext('2d');
    dashboardSubscribersChartInstance = new Chart(subsCtx, {
        type: 'bar',
        data: {
            labels: topBySubscribers.map(c => c.title),
            datasets: [{
                label: 'Subscribers',
                data: topBySubscribers.map(c => c.subscribers),
                backgroundColor: CHART_THEME.brandBlueLight,
                borderColor: CHART_THEME.brandBlue,
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
                hoverBackgroundColor: CHART_THEME.brandBlue,
                hoverBorderWidth: 2.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Top Channels by Subscribers', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => formatNumber(c.parsed.y) + ' subs' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: CHART_THEME.grid, drawBorder: true, borderColor: CHART_THEME.border },
                    ticks: { color: CHART_THEME.textMuted, font: { size: 12, weight: '500' }, callback: (v) => formatNumber(v), padding: 10 }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, padding: 10 }
                }
            }
        }
    });

    const viewsCtx = viewsCanvas.getContext('2d');
    dashboardViewsChartInstance = new Chart(viewsCtx, {
        type: 'doughnut',
        data: {
            labels: topByViews.map(c => c.title),
            datasets: [{
                label: 'Views Share',
                data: topByViews.map(c => c.views),
                backgroundColor: [
                    'rgba(15, 76, 129, 0.85)',
                    'rgba(31, 122, 85, 0.85)',
                    'rgba(176, 135, 74, 0.85)',
                    'rgba(45, 120, 190, 0.85)',
                    'rgba(95, 166, 127, 0.85)',
                    'rgba(196, 170, 123, 0.85)'
                ],
                borderColor: CHART_THEME.border,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Portfolio Views Mix', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { position: 'bottom', labels: { color: CHART_THEME.textMuted, font: { size: 11, weight: '600' } } },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => formatNumber(c.parsed) + ' views' }
                }
            }
        }
    });
}

function updateDashboardHighlights(channels) {
    const topChannelEl = document.getElementById('highlight-top-channel');
    const topChannelMetricEl = document.getElementById('highlight-top-channel-metric');
    const topEngagementEl = document.getElementById('highlight-top-engagement');
    const topEngagementMetricEl = document.getElementById('highlight-top-engagement-metric');
    const totalAudienceEl = document.getElementById('highlight-total-audience');
    const avgViewsEl = document.getElementById('highlight-avg-views');

    if (!channels || channels.length === 0) {
        if (topChannelEl) topChannelEl.textContent = 'No data';
        if (topChannelMetricEl) topChannelMetricEl.textContent = 'Search a channel to populate';
        if (topEngagementEl) topEngagementEl.textContent = 'No data';
        if (topEngagementMetricEl) topEngagementMetricEl.textContent = 'Add channels to analyze';
        if (totalAudienceEl) totalAudienceEl.textContent = '0';
        if (avgViewsEl) avgViewsEl.textContent = '0';
        return;
    }

    const topChannel = [...channels].sort((a, b) => toNumber(b.subscribers) - toNumber(a.subscribers))[0];
    const topEngagement = [...channels].map(c => {
        const views = toNumber(c.total_views);
        const videos = toNumber(c.total_videos);
        const rate = videos > 0 ? (views / videos) : 0;
        return { title: c.title || 'Channel', rate };
    }).sort((a, b) => b.rate - a.rate)[0];

    const totalAudience = channels.reduce((sum, c) => sum + toNumber(c.subscribers), 0);
    const totalViews = channels.reduce((sum, c) => sum + toNumber(c.total_views), 0);
    const totalVideos = channels.reduce((sum, c) => sum + toNumber(c.total_videos), 0);
    const avgViews = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;

    if (topChannelEl) topChannelEl.textContent = topChannel?.title || '-';
    if (topChannelMetricEl) topChannelMetricEl.textContent = topChannel ? `${formatNumber(topChannel.subscribers)} subscribers` : '-';
    if (topEngagementEl) topEngagementEl.textContent = topEngagement?.title || '-';
    if (topEngagementMetricEl) topEngagementMetricEl.textContent = topEngagement ? `${formatNumber(Math.round(topEngagement.rate))} views/video` : '-';
    if (totalAudienceEl) totalAudienceEl.textContent = formatNumber(totalAudience);
    if (avgViewsEl) avgViewsEl.textContent = formatNumber(avgViews);
}

// ==================== QUICK SELECT BOXES ====================

function populateQuickChannelSelect(channels = null) {
    const select = document.getElementById('quick-channel-select');
    if (!select) return;

    // Use passed channels or fetch all channels
    const channelsToUse = channels || allChannels;
    
    // Clear existing options except first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add recent/saved channels to dropdown
    if (channelsToUse && channelsToUse.length > 0) {
        channelsToUse.slice(0, 8).forEach(ch => {
            const option = document.createElement('option');
            option.value = ch.channel_id || '';
            const title = (ch.title || 'Unknown').substring(0, 35);
            option.text = `📺 ${title}`;
            select.appendChild(option);
        });
    }
}

function populateQuickVideoSelect(videos = null) {
    const select = document.getElementById('quick-video-select');
    if (!select) return;

    const videosToUse = videos || savedVideos;

    while (select.options.length > 1) {
        select.remove(1);
    }

    if (videosToUse && videosToUse.length > 0) {
        videosToUse.slice(0, 12).forEach((video) => {
            const option = document.createElement('option');
            option.value = video.video_id || '';
            const title = (video.title || 'Video').substring(0, 32);
            option.text = title;
            select.appendChild(option);
        });
    }
}

// Merge localStorage saved videos with the top N DB videos (sorted by views desc)
// so the Videos page dropdown is useful on a fresh browser session.
async function refreshVideosQuickSelect() {
    let dbVideos = [];
    try {
        const resp = await fetchAPI('/videos');
        dbVideos = (resp.videos || [])
            .map(v => ({ ...v, _views: toNumber(v.views) }))
            .sort((a, b) => b._views - a._views)
            .slice(0, 12);
    } catch (e) {
        // ignore — fall through with whatever we have
    }
    const seen = new Set();
    const merged = [];
    [...savedVideos, ...dbVideos].forEach(v => {
        if (!v.video_id || seen.has(v.video_id)) return;
        seen.add(v.video_id);
        merged.push(v);
    });
    populateQuickVideoSelect(merged);
}

// ==================== SEARCH ====================

async function handleChannelSearch() {
    const query = document.getElementById('search-query').value.trim();
    
    if (!query) {
        showToast('Please enter a search query', 'info');
        return;
    }

    const localMatch = findLocalChannel(query);
    if (localMatch) {
        currentChannelId = localMatch.channel_id;
        await selectChannel(localMatch.channel_id);
        showToast('Loaded from local database', 'success');
        await loadDashboard();
        document.getElementById('search-query').value = '';
        return;
    }

    showLoading(true, 'Searching for channel...');

    try {
        const response = await fetchAPI('/channel/search', {
            method: 'POST',
            body: JSON.stringify({
                query,
                search_type: 'name'  // Default to name search
            })
        });

        document.getElementById('channel-result').innerHTML = formatChannelResult(response);
        document.getElementById('search-results').classList.remove('hidden');

        // Auto-save to database
        currentChannelId = response.channel_id;
        showToast('Channel found and saved', 'success');
        await loadDashboard();
        
        // Clear search input
        document.getElementById('search-query').value = '';
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function formatChannelResult(channel) {
    return `
        <div class="panel">
            <div class="panel-body flex flex-col sm:flex-row gap-5">
                <img src="${channel.profile_image || ''}" alt="" class="w-24 h-24 rounded-lg object-cover bg-slate-100 shrink-0">
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-semibold text-slate-900">${channel.title || ''}</h3>
                    <p class="text-sm text-slate-500 mt-1 line-clamp-2">${channel.description || ''}</p>
                    <div class="grid grid-cols-3 gap-4 mt-3">
                        <div><p class="kpi-label">Subscribers</p><p class="text-base font-semibold text-slate-900 tabular-nums">${formatNumber(channel.subscribers)}</p></div>
                        <div><p class="kpi-label">Views</p><p class="text-base font-semibold text-slate-900 tabular-nums">${formatNumber(channel.total_views)}</p></div>
                        <div><p class="kpi-label">Videos</p><p class="text-base font-semibold text-slate-900 tabular-nums">${formatNumber(channel.total_videos)}</p></div>
                    </div>
                    <button class="btn btn-primary mt-4" onclick="selectChannel('${channel.channel_id}')">View analytics</button>
                </div>
            </div>
        </div>
    `;
}

// ==================== CHANNELS ====================

async function loadSavedChannels() {
    try {
        const response = await fetchAPI('/channels');
        allChannels = response.channels || [];
        renderSavedChannels();
        populateQuickChannelSelect(allChannels);
    } catch (error) {
        showToast('Error loading channels', 'error');
    }
}

function renderSavedChannels() {
    const container = document.getElementById('channels-list');
    const countEl = document.getElementById('channels-count');
    if (!container) return;

    const filterEl = document.getElementById('channels-filter');
    const sortEl = document.getElementById('channels-sort');
    const q = (filterEl?.value || '').trim().toLowerCase();
    const sort = sortEl?.value || 'recent';

    let rows = allChannels.filter(ch =>
        !q ||
        (ch.title || '').toLowerCase().includes(q) ||
        (ch.custom_url || '').toLowerCase().includes(q) ||
        (ch.channel_id || '').toLowerCase().includes(q)
    );

    rows = [...rows].sort((a, b) => {
        switch (sort) {
            case 'subscribers': return toNumber(b.subscribers) - toNumber(a.subscribers);
            case 'views':       return toNumber(b.total_views) - toNumber(a.total_views);
            case 'title':       return (a.title || '').localeCompare(b.title || '');
            case 'recent':
            default:
                return new Date(b.last_searched_at || b.fetched_at || 0) - new Date(a.last_searched_at || a.fetched_at || 0);
        }
    });

    if (countEl) countEl.textContent = rows.length;

    if (rows.length === 0) {
        container.innerHTML = `<p class="placeholder col-span-full">${q ? 'No channels match your filter.' : 'No channels saved yet. Use the search above to add one.'}</p>`;
        return;
    }

    container.innerHTML = rows.map(ch => `
        <div class="channel-card" onclick="selectChannel('${ch.channel_id}')">
            <img src="${ch.profile_image || ''}" alt="" class="channel-card-image">
            <div class="channel-card-body">
                <h4 class="channel-card-title">${ch.title || 'Channel'}</h4>
                <p class="channel-card-meta">${ch.custom_url || ch.channel_id}</p>
                <div class="channel-card-stats">
                    <div class="channel-stat-item">
                        <p class="channel-stat-label">Subscribers</p>
                        <p class="channel-stat-value">${formatNumber(ch.subscribers)}</p>
                    </div>
                    <div class="channel-stat-item">
                        <p class="channel-stat-label">Videos</p>
                        <p class="channel-stat-value">${formatNumber(ch.total_videos)}</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

window.renderSavedChannels = renderSavedChannels;
window.renderSettingsChannels = renderSettingsChannels;
window.renderSettingsVideos = renderSettingsVideos;
window.deleteChannelById = deleteChannelById;
window.deleteVideoById = deleteVideoById;
window.settingsPageChange = (table, delta) => settingsPageChange(table, delta);
window.resetSettingsChannelsPage = () => { _channelsPage = 1; };
window.resetSettingsVideosPage = () => { _videosPage = 1; };

async function selectChannel(channelId) {
    currentChannelId = channelId;
    
    try {
        showLoading(true, 'Loading channel details...');
        
        const response = await fetchAPI(`/channel/${channelId}`);
        const channel = response.channel;
        const stats = response.statistics;
        
        // Update channel header
        document.getElementById('channel-name').textContent = channel.title;
        document.getElementById('channel-id-display').textContent = channel.channel_id;
        document.getElementById('channel-description').textContent = channel.description;
        document.getElementById('channel-image').src = channel.profile_image;
        const ytLink = document.getElementById('channel-youtube-link');
        if (ytLink) ytLink.href = `https://www.youtube.com/channel/${encodeURIComponent(channel.channel_id)}`;
        
        // Update stats
        document.getElementById('channel-subscribers').textContent = formatNumber(channel.subscribers);
        document.getElementById('channel-views').textContent = formatNumber(channel.total_views);
        document.getElementById('channel-video-count').textContent = channel.total_videos;
        
        if (stats) {
            const totalViews = Number(stats.total_views || 0);
            const totalLikes = Number(stats.total_likes || 0);
            const totalComments = Number(stats.total_comments || 0);
            const engagement = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100) : 0;
            document.getElementById('channel-engagement').textContent = engagement.toFixed(2) + '%';
        }

        await loadChannelRpm(channelId);
        
        // Load videos
        await loadChannelVideos(channelId);
        
        // Show channel details view
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.getElementById('channel-details').classList.remove('hidden');
        
    } catch (error) {
        showToast(`Error loading channel: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function loadChannelVideos(channelId, options = {}) {
    try {
        const { allowAutoFetch = true } = options;
        const response = await fetchAPI(`/channel/${channelId}/videos`);
        const videos = response.videos || [];
        
        // Store for quick access
        currentChannelVideos = videos;

        const scroller = document.getElementById('videos-scroller');
        
        if (videos.length === 0) {
            scroller.innerHTML = '<p class="placeholder">No videos found. Click "Fetch Videos" to load data.</p>';
            if (!allowAutoFetch) return;

            showLoading(true, 'Fetching top videos...');
            try {
                await fetchAPI(`/channel/${channelId}/videos/fetch?sync=true`, { method: 'POST' });
                return await loadChannelVideos(channelId, { allowAutoFetch: false });
            } catch (error) {
                showToast(`Error fetching videos: ${error.message}`, 'error');
                return;
            } finally {
                showLoading(false);
            }
        }

        scroller.innerHTML = videos.map(video => {
            const safeTitle = (video.title || 'Video').replace(/"/g, '&quot;');
            const ytUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.video_id || '')}`;
            return `
            <a href="${ytUrl}" target="_blank" rel="noopener" class="channel-card-scroll no-underline">
                <img src="${video.thumbnail || ''}" alt="${safeTitle}">
                <div class="px-3 py-2 flex flex-col gap-1.5">
                    <h4 class="!p-0">${video.title || 'Video'}</h4>
                    <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-500 tabular-nums">
                        <span><strong class="text-slate-900">${formatNumber(video.views)}</strong> views</span>
                        <span><strong class="text-slate-900">${formatNumber(video.likes)}</strong> likes</span>
                        <span><strong class="text-slate-900">${formatNumber(video.comments)}</strong> comments</span>
                        <span>${formatDate(video.published_at)}</span>
                    </div>
                </div>
            </a>`;
        }).join('');

        // Draw charts with video data
        setTimeout(() => {
            const topVideosCanvas = document.getElementById('top-videos-canvas');
            const engagementCanvas = document.getElementById('engagement-canvas');
            const commentsCanvas = document.getElementById('comments-canvas');
            const viewsTrendCanvas = document.getElementById('views-trend-canvas');
            const engagementTrendCanvas = document.getElementById('engagement-trend-canvas');
            const ctrProxyCanvas = document.getElementById('ctr-proxy-canvas');
            const outliersCanvas = document.getElementById('outliers-canvas');
            
            if (topVideosCanvas && topVideosCanvas.getContext) {
                window.ChannelCharts.drawTopVideosChart(topVideosCanvas, videos);
            }
            if (engagementCanvas && engagementCanvas.getContext) {
                window.ChannelCharts.drawEngagementChart(engagementCanvas, videos);
            }
            if (commentsCanvas && commentsCanvas.getContext) {
                window.ChannelCharts.drawCommentsChart(commentsCanvas, videos);
            }
            if (viewsTrendCanvas && viewsTrendCanvas.getContext) {
                window.ChannelCharts.drawViewsTrendChart(viewsTrendCanvas, videos);
            }
            if (engagementTrendCanvas && engagementTrendCanvas.getContext) {
                window.ChannelCharts.drawEngagementTrendChart(engagementTrendCanvas, videos);
            }
            if (ctrProxyCanvas && ctrProxyCanvas.getContext) {
                window.ChannelCharts.drawCtrProxyChart(ctrProxyCanvas, videos);
            }
            if (outliersCanvas && outliersCanvas.getContext) {
                window.ChannelCharts.drawOutliersChart(outliersCanvas, videos);
            }
        }, 100);
    } catch (error) {
        document.getElementById('videos-scroller').innerHTML = 
            `<p class="placeholder">Error loading videos: ${error.message}</p>`;
    }
}

async function handleFetchVideos() {
    if (!currentChannelId) return;

    showLoading(true, 'Fetching videos...');

    try {
        const result = await fetchAPI(`/channel/${currentChannelId}/videos/fetch?sync=true`, {
            method: 'POST'
        });

        const saved = result && typeof result.saved === 'number' ? result.saved : null;
        showToast(saved !== null ? `Fetched ${saved} videos` : 'Videos fetched', 'success');
        await loadChannelVideos(currentChannelId, { allowAutoFetch: false });
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== SETTINGS ====================

async function checkAPIHealth() {
    const setStatus = (ok) => {
        const badge = document.getElementById('api-status');
        if (badge) {
            badge.textContent = ok ? 'Connected' : 'Disconnected';
            badge.className = 'status-badge ' + (ok ? 'success' : 'error');
        }
        const dot = document.getElementById('api-status-dot');
        const ping = document.getElementById('api-status-dot-ping');
        const text = document.getElementById('api-status-text');
        if (dot) dot.style.backgroundColor = ok ? '#22c55e' : '#dc2626';
        if (ping) {
            if (ok) {
                ping.classList.add('live');
            } else {
                ping.classList.remove('live');
                ping.style.backgroundColor = '#dc2626';
            }
        }
        if (text) {
            text.textContent = ok ? 'Online' : 'Offline';
            text.style.color = ok ? '#15803d' : '#b91c1c';
        }
    };
    try {
        await fetchAPI('/health');
        setStatus(true);
    } catch (error) {
        setStatus(false);
    }
}

function updateNavBadges(channelsCount, videosCount) {
    const ch = document.getElementById('nav-channels-count');
    const vd = document.getElementById('nav-videos-count');
    if (ch) ch.textContent = formatNumber(channelsCount);
    if (vd) vd.textContent = formatNumber(videosCount);
}

async function clearCache() {
    if (!confirm('Clear locally cached video history and per-channel RPM settings? Database data is not affected.')) return;
    try {
        localStorage.removeItem('youtube_analytics_saved_videos');
        localStorage.removeItem('youtube_analytics_channel_rpm');
        savedVideos = [];
        populateQuickVideoSelect([]);
        showToast('Local cache cleared', 'success');
        await loadDashboard();
    } catch (e) {
        showToast('Failed to clear cache: ' + e.message, 'error');
    }
}

async function exportData() {
    try {
        const [channelsResp, videosResp] = await Promise.all([
            fetchAPI('/channels'),
            fetchAPI('/videos'),
        ]);
        let rpmMap = {};
        try {
            rpmMap = JSON.parse(localStorage.getItem('youtube_analytics_channel_rpm') || '{}');
        } catch (e) { /* ignore */ }

        const bundle = {
            exported_at: new Date().toISOString(),
            version: '2.0',
            channels: channelsResp.channels || [],
            videos: videosResp.videos || [],
            rpm_settings: rpmMap,
        };

        const data = JSON.stringify(bundle, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-analytics-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Exported ${bundle.channels.length} channels, ${bundle.videos.length} videos`, 'success');
    } catch (error) {
        showToast('Error exporting data: ' + error.message, 'error');
    }
}

let _settingsChannels = [];
let _settingsVideos = [];
const PAGE_SIZE = 25;
let _channelsPage = 1;
let _videosPage = 1;

async function loadSettingsData() {
    _channelsPage = 1;
    _videosPage = 1;
    await Promise.all([loadSettingsChannels(), loadSettingsVideos()]);
}

async function loadSettingsChannels() {
    const container = document.getElementById('settings-channels-table');
    if (!container) return;
    try {
        const response = await fetchAPI('/channels');
        _settingsChannels = response.channels || [];
        renderSettingsChannels();
    } catch (e) {
        container.innerHTML = '<p class="placeholder">Failed to load channels</p>';
    }
}

function paginationBar(table, total, page, totalPages) {
    const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return `
        <div class="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <span>${total === 0 ? '0 results' : `${start}–${end} of ${total}`}</span>
            <div class="flex items-center gap-1">
                <button class="btn btn-ghost text-xs" data-action="page-prev" data-table="${table}" ${page <= 1 ? 'disabled' : ''}>Prev</button>
                <span class="px-2 tabular-nums">Page ${page} / ${Math.max(totalPages, 1)}</span>
                <button class="btn btn-ghost text-xs" data-action="page-next" data-table="${table}" ${page >= totalPages ? 'disabled' : ''}>Next</button>
            </div>
        </div>
    `;
}

function renderSettingsChannels() {
    const container = document.getElementById('settings-channels-table');
    if (!container) return;
    const filterEl = document.getElementById('settings-channels-filter');
    const q = (filterEl?.value || '').trim().toLowerCase();
    const filtered = _settingsChannels.filter(ch =>
        !q || (ch.title || '').toLowerCase().includes(q) || (ch.channel_id || '').toLowerCase().includes(q)
    );

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
    if (_channelsPage > totalPages) _channelsPage = totalPages;
    if (_channelsPage < 1) _channelsPage = 1;

    if (total === 0) {
        container.innerHTML = '<p class="placeholder">No channels match.</p>';
        return;
    }

    const start = (_channelsPage - 1) * PAGE_SIZE;
    const rows = filtered.slice(start, start + PAGE_SIZE);

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Channel</th>
                    <th>ID</th>
                    <th class="num">Subscribers</th>
                    <th class="num">Videos</th>
                    <th class="actions"></th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(ch => `
                    <tr>
                        <td>${ch.title || ''}</td>
                        <td><code class="text-xs text-slate-500">${ch.channel_id}</code></td>
                        <td class="num">${formatNumber(ch.subscribers)}</td>
                        <td class="num">${formatNumber(ch.total_videos)}</td>
                        <td class="actions">
                            <button class="btn btn-ghost text-xs" data-action="view-channel" data-id="${ch.channel_id}">View</button>
                            <button class="btn btn-danger text-xs" data-action="delete-channel" data-id="${ch.channel_id}">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${paginationBar('channels', total, _channelsPage, totalPages)}
    `;
}

async function loadSettingsVideos() {
    const container = document.getElementById('settings-videos-table');
    if (!container) return;
    try {
        const response = await fetchAPI('/videos');
        _settingsVideos = response.videos || [];
        renderSettingsVideos();
    } catch (e) {
        container.innerHTML = '<p class="placeholder">Failed to load videos</p>';
    }
}

function renderSettingsVideos() {
    const container = document.getElementById('settings-videos-table');
    if (!container) return;
    const filterEl = document.getElementById('settings-videos-filter');
    const q = (filterEl?.value || '').trim().toLowerCase();
    const filtered = _settingsVideos.filter(v =>
        !q || (v.title || '').toLowerCase().includes(q) || (v.video_id || '').toLowerCase().includes(q)
    );

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
    if (_videosPage > totalPages) _videosPage = totalPages;
    if (_videosPage < 1) _videosPage = 1;

    if (total === 0) {
        container.innerHTML = '<p class="placeholder">No videos match.</p>';
        return;
    }

    const start = (_videosPage - 1) * PAGE_SIZE;
    const rows = filtered.slice(start, start + PAGE_SIZE);

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Video ID</th>
                    <th class="num">Views</th>
                    <th class="num">Likes</th>
                    <th class="actions"></th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(v => `
                    <tr>
                        <td class="max-w-md truncate">${v.title || ''}</td>
                        <td><code class="text-xs text-slate-500">${v.video_id}</code></td>
                        <td class="num">${formatNumber(v.views)}</td>
                        <td class="num">${formatNumber(v.likes)}</td>
                        <td class="actions">
                            <button class="btn btn-danger text-xs" data-action="delete-video" data-id="${v.video_id}">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${paginationBar('videos', total, _videosPage, totalPages)}
    `;
}

function settingsPageChange(table, delta) {
    if (table === 'channels') {
        _channelsPage += delta;
        renderSettingsChannels();
    } else if (table === 'videos') {
        _videosPage += delta;
        renderSettingsVideos();
    }
}

async function deleteChannelById(channelId) {
    if (!channelId) return;
    if (!confirm('Delete this channel and all its videos?')) return;
    try {
        await fetchAPI(`/channel/${channelId}`, { method: 'DELETE' });
        showToast('Channel deleted', 'success');
        await loadSettingsData();
        await loadDashboard();
        await loadSavedChannels();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function deleteVideoById(videoId) {
    if (!videoId) return;
    if (!confirm('Delete this video?')) return;
    try {
        await fetchAPI(`/video/${videoId}`, { method: 'DELETE' });
        showToast('Video deleted', 'success');
        await loadSettingsData();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

// ==================== API CALLS ====================

async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    const response = await fetch(url, config);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `API error: ${response.status}`);
    }

    return await response.json();
}

// ==================== UI UTILITIES ====================

function showLoading(show = true, _text = '') {
    const loading = document.getElementById('loading');
    if (!loading) return;
    if (show) loading.classList.remove('hidden');
    else loading.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        error:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" aria-label="Dismiss">×</button>
    `;
    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ==================== VIDEO ANALYTICS ====================

async function handleVideoSearch() {
    const videoId = document.getElementById('video-search-input')?.value?.trim();

    if (!videoId) {
        showToast('Please enter a video ID', 'error');
        return;
    }

    showLoading(true);
    try {
        // 1. In-memory cache (this session)
        const cachedVideo = findLocalVideo(videoId);
        if (cachedVideo) {
            await analyzeVideo(cachedVideo);
            showToast('Loaded from local cache', 'success');
            return;
        }

        // 2. Server-side DB
        const localVideo = await fetchVideoFromDb(videoId);
        if (localVideo) {
            await analyzeVideo(localVideo);
            showToast('Loaded from local database', 'success');
            return;
        }

        // 3. YouTube API (saves to DB on hit)
        const response = await fetchAPI(`/video/search?q=${encodeURIComponent(videoId)}`);
        if (response && response.videos && response.videos.length > 0) {
            await analyzeVideo(response.videos[0]);
            showToast('Video analysis loaded and saved', 'success');
        } else {
            showToast('Video not found', 'error');
            document.getElementById('video-results').classList.add('hidden');
        }
    } catch (error) {
        showToast(`Error searching video: ${error.message}`, 'error');
        document.getElementById('video-results').classList.add('hidden');
    } finally {
        showLoading(false);
    }
}

// Renders the analysis for a single video. Pulls minimal channel context
// (RPM + sibling videos for the trend chart) WITHOUT drawing channel-detail
// charts, which live on a different section.
async function analyzeVideo(video) {
    if (!video) return;
    if (video.channel_id) {
        currentChannelId = video.channel_id;
        loadChannelRpm(currentChannelId);
        try {
            const resp = await fetchAPI(`/channel/${currentChannelId}/videos`);
            currentChannelVideos = resp.videos || [];
        } catch (e) {
            currentChannelVideos = [];
        }
    } else {
        currentChannelVideos = [];
    }
    displayVideoAnalytics(video);
    addToSavedVideos(video);
    document.getElementById('video-results').classList.remove('hidden');
}

function findLocalChannel(query) {
    if (!allChannels || allChannels.length === 0) return null;
    const q = query.toLowerCase();
    return allChannels.find(ch =>
        (ch.title && ch.title.toLowerCase() === q) ||
        (ch.custom_url && ch.custom_url.toLowerCase() === q) ||
        (ch.channel_id && ch.channel_id.toLowerCase() === q)
    ) || null;
}

async function fetchVideoFromDb(videoId) {
    try {
        const video = await fetchAPI(`/video/${encodeURIComponent(videoId)}`);
        return video;
    } catch (error) {
        return null;
    }
}

function findLocalVideo(videoId) {
    if (!savedVideos || savedVideos.length === 0) return null;
    const id = videoId.toLowerCase();
    return savedVideos.find(v => (v.video_id || '').toLowerCase() === id) || null;
}

async function loadVideoFromDbOnly(videoId) {
    const id = (videoId || '').trim();
    if (!id) return;
    showLoading(true, 'Loading saved video...');
    try {
        const cached = findLocalVideo(id);
        if (cached) {
            await analyzeVideo(cached);
            showToast('Loaded from local cache', 'success');
            return;
        }
        const fromDb = await fetchVideoFromDb(id);
        if (fromDb) {
            await analyzeVideo(fromDb);
            showToast('Loaded from local database', 'success');
            return;
        }
        showToast('Video not found in local database', 'error');
    } catch (error) {
        showToast('Error loading saved video: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayVideoAnalytics(video) {
    currentVideoAnalytics = video;
    document.getElementById('video-stats-section').classList.remove('hidden');
    document.getElementById('video-advanced-charts-section').classList.remove('hidden');
    document.getElementById('video-insights-charts-section').classList.remove('hidden');
    document.getElementById('video-trend-charts-section').classList.remove('hidden');

    const views = toNumber(video.views);
    const likes = toNumber(video.likes);
    const comments = toNumber(video.comments);
    const engagementRate = views > 0 ? ((likes + comments) / views * 100).toFixed(2) : '0.00';

    document.getElementById('video-views').textContent = formatNumber(video.views);
    document.getElementById('video-likes').textContent = formatNumber(video.likes);
    document.getElementById('video-comments').textContent = formatNumber(video.comments);
    document.getElementById('video-engagement').textContent = engagementRate + '%';

    const description = video.description || 'No description';
    const truncated = description.length > 200 ? description.substring(0, 200) + '…' : description;
    const ytUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.video_id || '')}`;
    document.getElementById('video-details').innerHTML = `
        <div class="space-y-1.5">
            <p><span class="font-medium text-slate-900">${video.title || 'Untitled'}</span></p>
            <p class="text-xs text-slate-500">
                <code>${video.video_id || 'N/A'}</code>
                · ${formatDate(video.published_at)}
                · <a href="${ytUrl}" target="_blank" rel="noopener" class="text-brand-600 hover:underline">Open on YouTube ↗</a>
            </p>
            <p class="text-sm text-slate-600">${truncated}</p>
        </div>
    `;

    // Draw the 6 video-detail charts. Chart helpers handle null canvases gracefully.
    const data = { likes, comments, views };
    const drawSafe = (fn, ...args) => {
        try { fn(...args); } catch (e) { console.warn('Chart draw failed:', e.message); }
    };
    drawSafe(window.VideoCharts.drawVideoCompositionChart, document.getElementById('video-composition-canvas'), data);
    drawSafe(window.VideoCharts.drawVideoBenchmarkChart, document.getElementById('video-benchmark-canvas'), data);
    drawSafe(window.VideoCharts.drawVideoEngagementRateChart, document.getElementById('video-engagement-rate-canvas'), data);
    drawSafe(window.VideoCharts.drawVideoPercentileChart, document.getElementById('video-percentile-canvas'), data);
    drawSafe(window.VideoCharts.drawVideoChannelTrendChart, document.getElementById('video-channel-trend-canvas'), video, currentChannelVideos);
    drawSafe(window.VideoCharts.drawVideoVelocityChart, document.getElementById('video-velocity-canvas'), video);
}

function applyChartTheme() {
    if (!window.Chart) return;
    Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    Chart.defaults.color = CHART_THEME.textMuted;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.elements.bar.borderSkipped = false;
    Chart.defaults.elements.bar.borderRadius = 10;
}

// ==================== VIDEO MANAGEMENT ====================

function saveSavedVideos() {
    localStorage.setItem('youtube_analytics_saved_videos', JSON.stringify(savedVideos));
}

function loadSavedVideos() {
    const stored = localStorage.getItem('youtube_analytics_saved_videos');
    if (stored) {
        try {
            savedVideos = JSON.parse(stored);
            // Populate quick select with saved videos
            populateQuickVideoSelect(savedVideos);
        } catch (e) {
            savedVideos = [];
        }
    }
}

function addToSavedVideos(videoData) {
    if (!videoData) return;
    const normalized = {
        ...videoData,
        video_id: videoData.video_id || videoData.id || videoData.videoId,
        title: videoData.title || (videoData.snippet && videoData.snippet.title) || 'Video'
    };
    if (!normalized.video_id) return;

    const index = savedVideos.findIndex(v => v.video_id === normalized.video_id);
    if (index === -1) {
        savedVideos.push(normalized);
    } else {
        savedVideos[index] = { ...savedVideos[index], ...normalized };
    }
    saveSavedVideos();
    populateQuickVideoSelect(savedVideos);
}

function getSavedBenchmarks() {
    const values = { views: [], likes: [], comments: [] };
    if (Array.isArray(savedVideos)) {
        savedVideos.forEach(v => {
            values.views.push(toNumber(v.views));
            values.likes.push(toNumber(v.likes));
            values.comments.push(toNumber(v.comments));
        });
    }

    const median = (arr) => {
        if (!arr.length) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2) return sorted[mid];
        return (sorted[mid - 1] + sorted[mid]) / 2;
    };

    return {
        views: median(values.views),
        likes: median(values.likes),
        comments: median(values.comments)
    };
}

function toNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'private') return 0;
        const parsed = parseFloat(value.replace(/,/g, ''));
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    if (typeof num === 'string' && num.toLowerCase() === 'private') return 'Private';
    const n = parseInt(num, 10);
    if (Number.isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function loadChannelRpm(channelId) {
    if (!channelId) return 0;
    const rpmInput = document.getElementById('video-rpm-input');
    let rpmValue = 2.0;

    try {
        const stored = localStorage.getItem('youtube_analytics_channel_rpm');
        if (stored) {
            const map = JSON.parse(stored);
            if (map && typeof map === 'object' && map[channelId] != null) {
                rpmValue = parseFloat(map[channelId]) || rpmValue;
            }
        }
    } catch (e) {
        console.warn('Failed to read RPM cache:', e);
    }

    if (rpmInput) rpmInput.value = rpmValue;

    if (currentVideoAnalytics) {
        window.VideoCharts.drawVideoVelocityChart(document.getElementById('video-velocity-canvas'), currentVideoAnalytics);
    }

    return rpmValue;
}

function saveChannelRpm(rpm) {
    if (!currentChannelId) return;
    try {
        const stored = localStorage.getItem('youtube_analytics_channel_rpm');
        const map = stored ? JSON.parse(stored) : {};
        map[currentChannelId] = rpm;
        localStorage.setItem('youtube_analytics_channel_rpm', JSON.stringify(map));
    } catch (e) {
        console.warn('Failed to save RPM cache:', e);
    }
}

window.toNumber = toNumber;
window.formatNumber = formatNumber;
window.formatDate = formatDate;
window.getSavedBenchmarks = getSavedBenchmarks;
window.showSection = showSection;
window.selectChannel = selectChannel;

// ==================== ERROR HANDLING ====================

window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    showToast('An error occurred. Check console for details.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});
