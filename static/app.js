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
let videoEngagementChartInstance = null;
let engagementChartInstance = null;
let topVideosChartInstance = null;
let commentsChartInstance = null;
let viewsTrendChartInstance = null;
let engagementTrendChartInstance = null;
let ctrProxyChartInstance = null;
let outliersChartInstance = null;
let dashboardSubscribersChartInstance = null;
let dashboardViewsChartInstance = null;
let videoCompositionChartInstance = null;
let videoPerformanceChartInstance = null;
let videoEngagementRateChartInstance = null;
let videoBenchmarkChartInstance = null;
let videoPercentileChartInstance = null;
let videoChannelTrendChartInstance = null;
let videoVelocityChartInstance = null;

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

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    applyChartTheme();
    initializeEventListeners();
    loadSavedVideos();
    await checkAPIHealth();
    await loadDashboard();
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

    // Quick Select Boxes
    const quickChannelSelect = document.getElementById('quick-channel-select');
    if (quickChannelSelect) {
        quickChannelSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('search-query').value = e.target.value;
                e.target.value = '';  // Reset dropdown
            }
        });
    }

    const quickVideoSelect = document.getElementById('quick-video-select');
    if (quickVideoSelect) {
        quickVideoSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('video-search-input').value = e.target.value;
                e.target.value = '';  // Reset dropdown
            }
        });
    }

    // Saved Video Selection
    const loadSavedVideoBtn = document.getElementById('load-saved-video-btn');
    if (loadSavedVideoBtn) {
        loadSavedVideoBtn.addEventListener('click', loadSelectedSavedVideo);
    }

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        showSection('channels');
        document.getElementById('channel-details').style.display = 'none';
        document.getElementById('channels').style.display = 'block';
    });

    // Other buttons
    document.getElementById('fetch-videos-btn').addEventListener('click', handleFetchVideos);
    document.getElementById('clear-cache-btn').addEventListener('click', clearCache);
    document.getElementById('export-data-btn').addEventListener('click', exportData);
}

// ==================== NAVIGATION ====================

function handleNavigation(e) {
    const section = e.target.getAttribute('data-section');
    showSection(section);
    
    // Update active button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        
        // Load section-specific data
        if (sectionId === 'dashboard') loadDashboard();
        if (sectionId === 'channels') {
            // Load saved channels by default
            switchChannelsView('search');
        }
        if (sectionId === 'settings') checkAPIHealth();
        if (sectionId === 'videos') {
            // Clear video results when switching to videos section
            document.getElementById('video-results').style.display = 'none';
            document.getElementById('video-search-input').value = '';
        }
    }

    // Ensure channel details view does not overlay other tabs
    if (sectionId !== 'channel-details') {
        const details = document.getElementById('channel-details');
        if (details) details.style.display = 'none';
        const list = document.getElementById('channels-list');
        if (list) list.style.display = 'grid';
    }
}

// ==================== CHANNELS VIEW TOGGLE ====================

function switchChannelsView(view) {
    const searchView = document.getElementById('search-view');
    const savedView = document.getElementById('saved-view');
    
    if (view === 'search') {
        searchView.classList.add('active-view');
        savedView.classList.remove('active-view');
        
        // Hide saved channels view container
        searchView.style.display = 'block';
        savedView.style.display = 'none';
    } else if (view === 'saved') {
        searchView.classList.remove('active-view');
        savedView.classList.add('active-view');
        
        // Hide search view container
        searchView.style.display = 'none';
        savedView.style.display = 'block';
        
        // Load saved channels
        loadSavedChannels();
    }
}

// ==================== VIDEOS VIEW TOGGLE ====================

function switchVideosView(view) {
    const searchView = document.getElementById('video-search-view');
    const savedView = document.getElementById('video-saved-view');
    
    if (view === 'search') {
        searchView.classList.add('active-view');
        savedView.classList.remove('active-view');
        
        searchView.style.display = 'block';
        savedView.style.display = 'none';
    } else if (view === 'saved') {
        searchView.classList.remove('active-view');
        savedView.classList.add('active-view');
        
        searchView.style.display = 'none';
        savedView.style.display = 'block';
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
        document.getElementById('total-videos').textContent = totalVideos;
        
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
            <img src="${ch.profile_image || 'placeholder.jpg'}" alt="${ch.title}">
            <h4>${ch.title}</h4>
            <p>${formatNumber(parseInt(ch.subscribers))} subscribers</p>
            <p style="font-size: 0.8rem; color: #7f8c8d;">${ch.total_videos} videos</p>
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
            option.value = ch.title || ch.channel_id;
            const title = (ch.title || 'Unknown').substring(0, 35);
            option.text = `📺 ${title}`;
            select.appendChild(option);
        });
    }
}

function populateQuickVideoSelect(videos = null) {
    const select = document.getElementById('quick-video-select');
    if (!select) return;

    // Use passed videos or use saved videos
    const videosToUse = videos || savedVideos;
    
    // Clear existing options except first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add recent/saved videos to dropdown
    if (videosToUse && videosToUse.length > 0) {
        videosToUse.slice(0, 8).forEach((video, index) => {
            const option = document.createElement('option');
            option.value = video.video_id || '';
            const title = (video.title || 'Video').substring(0, 30);
            option.text = `🎬 ${title}`;
            select.appendChild(option);
        });
    }
}

// ==================== SEARCH ====================

async function handleChannelSearch() {
    const query = document.getElementById('search-query').value.trim();
    
    if (!query) {
        showToast('Please enter a search query', 'info');
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
        document.getElementById('search-results').style.display = 'block';

        // Auto-save to database
        currentChannelId = response.channel_id;
        showToast('Channel found and saved', 'success');
        
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
        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 1.5rem; align-items: start;">
            <img src="${channel.profile_image}" alt="" style="width: 150px; height: 150px; border-radius: 12px;">
            <div>
                <h3>${channel.title}</h3>
                <p style="color: #7f8c8d; margin-bottom: 1rem;">${channel.description}</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <p style="font-size: 0.9rem; color: #7f8c8d;">Subscribers</p>
                        <p style="font-size: 1.5rem; font-weight: 600; color: #0066cc;">${channel.subscribers}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.9rem; color: #7f8c8d;">Total Views</p>
                        <p style="font-size: 1.5rem; font-weight: 600; color: #0066cc;">${channel.total_views}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.9rem; color: #7f8c8d;">Videos</p>
                        <p style="font-size: 1.5rem; font-weight: 600; color: #0066cc;">${channel.total_videos}</p>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="selectChannel('${channel.channel_id}')">
                    View Analytics
                </button>
            </div>
        </div>
    `;
}

// ==================== CHANNELS ====================

async function loadSavedChannels() {
    try {
        const response = await fetchAPI('/channels');
        const channels = response.channels || [];
        allChannels = channels;

        const container = document.getElementById('channels-list');
        
        if (channels.length === 0) {
            container.innerHTML = '<p class="placeholder">No channels saved yet. Use the search to add channels.</p>';
            return;
        }

        container.innerHTML = channels.map(ch => `
            <div class="channel-card" onclick="selectChannel('${ch.channel_id}')">
                <img src="${ch.profile_image}" alt="" class="channel-card-image">
                <div class="channel-card-body">
                    <h4 class="channel-card-title">${ch.title}</h4>
                    <p class="channel-card-meta">${ch.custom_url || 'No custom URL'}</p>
                    <div class="channel-card-stats">
                        <div class="channel-stat-item">
                            <p class="channel-stat-label">Subscribers</p>
                            <p class="channel-stat-value">${ch.subscribers}</p>
                        </div>
                        <div class="channel-stat-item">
                            <p class="channel-stat-label">Videos</p>
                            <p class="channel-stat-value">${ch.total_videos}</p>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        showToast('Error loading channels', 'error');
    }
}

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
        
        // Load videos
        await loadChannelVideos(channelId);
        
        // Show channel details view
        document.getElementById('channels-list').style.display = 'none';
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('channel-details').style.display = 'block';
        
    } catch (error) {
        showToast(`Error loading channel: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function loadChannelVideos(channelId) {
    try {
        const response = await fetchAPI(`/channel/${channelId}/videos`);
        const videos = response.videos || [];
        
        // Store for quick access
        currentChannelVideos = videos;

        const scroller = document.getElementById('videos-scroller');
        
        if (videos.length === 0) {
            scroller.innerHTML = '<p class="placeholder">No videos found. Click "Fetch Videos" to load data.</p>';
            return;
        }

        scroller.innerHTML = videos.map(video => `
            <div class="channel-card-scroll" style="flex: 0 0 300px;">
                <img src="${video.thumbnail || 'placeholder.jpg'}" alt="${video.title || 'Video'}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;">
                <div style="padding: 12px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: var(--text-primary); line-height: 1.4;">${video.title}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: var(--text-secondary);">
                        <div><strong style="color: var(--primary-blue);">${formatNumber(video.views)}</strong> views</div>
                        <div><strong style="color: var(--accent-green);">${formatNumber(video.likes)}</strong> likes</div>
                        <div><strong style="color: var(--accent-orange);">${formatNumber(video.comments)}</strong> comments</div>
                        <div>${formatDate(video.published_at)}</div>
                    </div>
                </div>
            </div>
        `).join('');

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
                drawTopVideosChart(topVideosCanvas, videos);
            }
            if (engagementCanvas && engagementCanvas.getContext) {
                drawEngagementChart(engagementCanvas, videos);
            }
            if (commentsCanvas && commentsCanvas.getContext) {
                drawCommentsChart(commentsCanvas, videos);
            }
            if (viewsTrendCanvas && viewsTrendCanvas.getContext) {
                drawViewsTrendChart(viewsTrendCanvas, videos);
            }
            if (engagementTrendCanvas && engagementTrendCanvas.getContext) {
                drawEngagementTrendChart(engagementTrendCanvas, videos);
            }
            if (ctrProxyCanvas && ctrProxyCanvas.getContext) {
                drawCtrProxyChart(ctrProxyCanvas, videos);
            }
            if (outliersCanvas && outliersCanvas.getContext) {
                drawOutliersChart(outliersCanvas, videos);
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
        await fetchAPI(`/channel/${currentChannelId}/videos/fetch`, {
            method: 'POST'
        });

        showToast('Videos fetching in background', 'success');
        
        // Reload videos after delay
        setTimeout(() => loadChannelVideos(currentChannelId), 2000);
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== SETTINGS ====================

async function checkAPIHealth() {
    try {
        const response = await fetchAPI('/health');
        const badge = document.getElementById('api-status');
        badge.innerHTML = 'Connected';
        badge.classList.add('success');
    } catch (error) {
        const badge = document.getElementById('api-status');
        badge.innerHTML = 'Disconnected';
        badge.classList.add('error');
    }
}

async function clearCache() {
    if (confirm('This will clear all cached data. Continue?')) {
        showToast('Cache cleared', 'success');
        await loadDashboard();
    }
}

async function exportData() {
    try {
        const channels = await fetchAPI('/channels');
        const data = JSON.stringify(channels, null, 2);
        
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-analytics-${Date.now()}.json`;
        a.click();
        
        showToast('Data exported successfully', 'success');
    } catch (error) {
        showToast('Error exporting data', 'error');
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

function showLoading(show = true, text = 'Processing...') {
    const loading = document.getElementById('loading');
    document.getElementById('loading-text').textContent = text;
    loading.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '[SUCCESS]',
        error: '[ERROR]',
        info: '[INFO]'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
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
        const response = await fetchAPI(`/video/search?q=${encodeURIComponent(videoId)}`);
        
        if (response && response.videos && response.videos.length > 0) {
            const video = response.videos[0];
            displayVideoAnalytics(video);
            addToSavedVideos(video);
            document.getElementById('video-results').style.display = 'block';
            showToast('Video analysis loaded and saved', 'success');
        } else {
            showToast('Video not found', 'error');
            document.getElementById('video-results').style.display = 'none';
        }
    } catch (error) {
        showToast(`Error searching video: ${error.message}`, 'error');
        document.getElementById('video-results').style.display = 'none';
    } finally {
        showLoading(false);
    }
}

function displayVideoAnalytics(video) {
    // Show video statistics and chart sections
    document.getElementById('video-stats-section').style.display = 'block';
    document.getElementById('video-advanced-charts-section').style.display = 'grid';
    document.getElementById('video-insights-charts-section').style.display = 'grid';
    document.getElementById('video-trend-charts-section').style.display = 'grid';
    
    const views = toNumber(video.views);
    const likes = toNumber(video.likes);
    const comments = toNumber(video.comments);
    
    // Calculate engagement rate
    const engagementRate = views > 0 ? ((likes + comments) / views * 100).toFixed(2) : 0;
    
    // Update statistics
    document.getElementById('video-views').textContent = formatNumber(video.views);
    document.getElementById('video-likes').textContent = formatNumber(video.likes);
    document.getElementById('video-comments').textContent = formatNumber(video.comments);
    document.getElementById('video-engagement').textContent = engagementRate + '%';
    
    // Update video details
    const detailsDiv = document.getElementById('video-details');
    detailsDiv.innerHTML = `
        <div class="video-info">
            <p><strong>Title:</strong> ${video.title || 'N/A'}</p>
            <p><strong>Video ID:</strong> ${video.video_id || 'N/A'}</p>
            <p><strong>Published:</strong> ${formatDate(video.published_at)}</p>
            <p><strong>Description:</strong> ${(video.description || 'No description').substring(0, 200)}...</p>
        </div>
    `;
    
    const data = { likes, comments, views };
    drawVideoCompositionChart(document.getElementById('video-composition-canvas'), data);
    drawVideoBenchmarkChart(document.getElementById('video-benchmark-canvas'), data);
    drawVideoEngagementRateChart(document.getElementById('video-engagement-rate-canvas'), data);
    drawVideoPercentileChart(document.getElementById('video-percentile-canvas'), data);
    drawVideoChannelTrendChart(document.getElementById('video-channel-trend-canvas'), video, currentChannelVideos);
    drawVideoVelocityChart(document.getElementById('video-velocity-canvas'), video);
}

function drawVideoCompositionChart(canvas, data) {
    if (!canvas || !canvas.getContext) return;
    if (videoCompositionChartInstance) {
        videoCompositionChartInstance.destroy();
    }

    const total = data.views + data.likes + data.comments;
    const ctx = canvas.getContext('2d');
    videoCompositionChartInstance = new Chart(ctx, {
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
                borderColor: CHART_THEME.border,
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Engagement Composition', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { position: 'bottom', labels: { color: CHART_THEME.textMuted, font: { size: 11, weight: '600' } } },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: {
                        label: (c) => {
                            const pct = total > 0 ? ((c.parsed / total) * 100).toFixed(1) : '0.0';
                            return `${formatNumber(c.parsed)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function drawVideoBenchmarkChart(canvas, data) {
    if (!canvas || !canvas.getContext) return;
    if (videoBenchmarkChartInstance) {
        videoBenchmarkChartInstance.destroy();
    }

    const benchmarks = getSavedBenchmarks();
    const viewsScaled = data.views / 100;
    const viewsBaseline = benchmarks.views / 100;
    const ctx = canvas.getContext('2d');
    videoBenchmarkChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Views (÷100)', 'Likes', 'Comments'],
            datasets: [{
                label: 'This Video',
                data: [viewsScaled, data.likes, data.comments],
                backgroundColor: [CHART_THEME.brandBlueLight, CHART_THEME.brandGreenLight, CHART_THEME.brandGoldLight],
                borderColor: [CHART_THEME.brandBlue, CHART_THEME.brandGreen, CHART_THEME.brandGold],
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false
            }, {
                label: 'Saved Median',
                data: [viewsBaseline, benchmarks.likes, benchmarks.comments],
                backgroundColor: 'rgba(120, 130, 140, 0.12)',
                borderColor: 'rgba(120, 130, 140, 0.8)',
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Benchmark vs Saved Videos', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { position: 'bottom', labels: { color: CHART_THEME.textMuted, font: { size: 11, weight: '600' } } },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => formatNumber(c.parsed.y) }
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
}

// ==================== CHART FUNCTIONS ====================

function drawEngagementChart(canvas, videos) {
    if (engagementChartInstance) {
        engagementChartInstance.destroy();
    }

    if (videos.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
        return;
    }

    const engagements = videos.map(v => {
        const views = toNumber(v.views);
        const likes = toNumber(v.likes);
        const comments = toNumber(v.comments);
        return {
            title: (v.title || 'Video').substring(0, 18),
            rate: views > 0 ? ((likes + comments) / views * 100) : 0
        };
    }).sort((a, b) => b.rate - a.rate).slice(0, 8);

    const ctx = canvas.getContext('2d');
    
    engagementChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: engagements.map(e => e.title),
            datasets: [{
                label: 'Engagement Rate (%)',
                data: engagements.map(e => e.rate),
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
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Top Engagement Rates', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => c.parsed.x.toFixed(2) + '%' }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: CHART_THEME.grid, drawBorder: true, borderColor: CHART_THEME.border },
                    ticks: { color: CHART_THEME.textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 }
                },
                y: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, padding: 10 }
                }
            }
        }
    });
}

function drawVideoEngagementRateChart(canvas, data) {
    if (!canvas || !canvas.getContext) return;
    if (videoEngagementRateChartInstance) {
        videoEngagementRateChartInstance.destroy();
    }

    const engagementRate = data.views > 0 ? ((data.likes + data.comments) / data.views) * 100 : 0;
    const likeRate = data.views > 0 ? (data.likes / data.views) * 100 : 0;
    const commentRate = data.views > 0 ? (data.comments / data.views) * 100 : 0;

    const ctx = canvas.getContext('2d');
    videoEngagementRateChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Engagement', 'Like Rate', 'Comment Rate'],
            datasets: [{
                label: 'Rate (%)',
                data: [engagementRate, likeRate, commentRate],
                backgroundColor: [CHART_THEME.brandGreenLight, CHART_THEME.brandBlueLight, CHART_THEME.brandGoldLight],
                borderColor: [CHART_THEME.brandGreen, CHART_THEME.brandBlue, CHART_THEME.brandGold],
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Engagement Rate Breakdown', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => c.parsed.y.toFixed(2) + '%' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: CHART_THEME.grid, drawBorder: true, borderColor: CHART_THEME.border },
                    ticks: { color: CHART_THEME.textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, padding: 10 }
                }
            }
        }
    });
}

function drawVideoPercentileChart(canvas, data) {
    if (!canvas || !canvas.getContext) return;
    if (videoPercentileChartInstance) {
        videoPercentileChartInstance.destroy();
    }

    const percentile = getPerformancePercentile(data);
    const ctx = canvas.getContext('2d');
    videoPercentileChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Views', 'Likes', 'Comments'],
            datasets: [{
                label: 'Percentile vs Saved Videos',
                data: [percentile.views, percentile.likes, percentile.comments],
                backgroundColor: [CHART_THEME.brandBlueLight, CHART_THEME.brandGreenLight, CHART_THEME.brandGoldLight],
                borderColor: [CHART_THEME.brandBlue, CHART_THEME.brandGreen, CHART_THEME.brandGold],
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Performance Percentile', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => `${c.parsed.y.toFixed(0)}th percentile` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: CHART_THEME.grid, drawBorder: true, borderColor: CHART_THEME.border },
                    ticks: { color: CHART_THEME.textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, padding: 10 }
                }
            }
        }
    });
}

function drawVideoChannelTrendChart(canvas, video, channelVideos) {
    if (!canvas || !canvas.getContext) return;
    if (videoChannelTrendChartInstance) {
        videoChannelTrendChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    const hasChannel = Array.isArray(channelVideos) && channelVideos.length > 0;

    if (!hasChannel) {
        canvas.parentElement.innerHTML = '<p class="placeholder">Load a channel to compare trends</p>';
        return;
    }

    const sorted = channelVideos
        .map(v => ({
            date: v.published_at ? new Date(v.published_at) : null,
            views: toNumber(v.views)
        }))
        .filter(v => v.date && !Number.isNaN(v.date.getTime()))
        .sort((a, b) => a.date - b.date);

    if (sorted.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No channel timeline data available</p>';
        return;
    }

    const labels = sorted.map(p => p.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    const avg = sorted.reduce((s, p) => s + p.views, 0) / sorted.length;
    const avgLine = sorted.map(() => avg);
    const videoViews = sorted.map(p => p.views);

    videoChannelTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Channel Views',
                    data: videoViews,
                    borderColor: CHART_THEME.brandBlue,
                    backgroundColor: CHART_THEME.brandBlueLight,
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
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Trend vs Channel Average', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { position: 'bottom', labels: { color: CHART_THEME.textMuted, font: { size: 11, weight: '600' } } },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => formatNumber(c.parsed.y) + ' views' }
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
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                }
            }
        }
    });
}

function drawVideoVelocityChart(canvas, video) {
    if (!canvas || !canvas.getContext) return;
    if (videoVelocityChartInstance) {
        videoVelocityChartInstance.destroy();
    }

    const views = toNumber(video.views);
    const publishedAt = video.published_at ? new Date(video.published_at) : null;
    if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
        canvas.parentElement.innerHTML = '<p class="placeholder">Publish date required for velocity</p>';
        return;
    }

    const days = Math.max(1, Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const velocity = views / days;

    const ctx = canvas.getContext('2d');
    videoVelocityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Views / Day'],
            datasets: [{
                label: 'Velocity',
                data: [velocity],
                backgroundColor: CHART_THEME.brandGreenLight,
                borderColor: CHART_THEME.brandGreen,
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Velocity Proxy', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => `${formatNumber(Math.round(c.parsed.y))} views/day` }
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
}

function getSavedBenchmarks() {
    if (!savedVideos || savedVideos.length === 0) {
        return { views: 0, likes: 0, comments: 0 };
    }
    const views = savedVideos.map(v => toNumber(v.views)).filter(v => v > 0).sort((a, b) => a - b);
    const likes = savedVideos.map(v => toNumber(v.likes)).filter(v => v > 0).sort((a, b) => a - b);
    const comments = savedVideos.map(v => toNumber(v.comments)).filter(v => v > 0).sort((a, b) => a - b);

    const median = (arr) => {
        if (!arr.length) return 0;
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
    };

    return {
        views: median(views),
        likes: median(likes),
        comments: median(comments)
    };
}

function getPerformancePercentile(data) {
    if (!savedVideos || savedVideos.length === 0) {
        return { views: 0, likes: 0, comments: 0 };
    }

    const percentile = (arr, value) => {
        if (!arr.length) return 0;
        const below = arr.filter(v => v <= value).length;
        return Math.round((below / arr.length) * 100);
    };

    const viewsList = savedVideos.map(v => toNumber(v.views)).filter(v => v > 0);
    const likesList = savedVideos.map(v => toNumber(v.likes)).filter(v => v > 0);
    const commentsList = savedVideos.map(v => toNumber(v.comments)).filter(v => v > 0);

    return {
        views: percentile(viewsList, data.views),
        likes: percentile(likesList, data.likes),
        comments: percentile(commentsList, data.comments)
    };
}

function drawTopVideosChart(canvas, videos) {
    if (topVideosChartInstance) {
        topVideosChartInstance.destroy();
    }

    if (videos.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
        return;
    }

    const topVideos = videos.map(v => ({
        title: (v.title || 'Video').substring(0, 20),
        views: toNumber(v.views)
    })).sort((a, b) => b.views - a.views).slice(0, 8);

    const ctx = canvas.getContext('2d');
    
    topVideosChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topVideos.map(v => v.title),
            datasets: [{
                label: 'Views',
                data: topVideos.map(v => v.views),
                backgroundColor: CHART_THEME.brandGreenLight,
                borderColor: CHART_THEME.brandGreen,
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
                hoverBackgroundColor: CHART_THEME.brandGreen,
                hoverBorderWidth: 2.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Top Videos by Views', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: {
                        label: (c) => formatNumber(c.parsed.y) + ' views',
                        afterLabel: (c) => {
                            const t = topVideos.reduce((s, v) => s + v.views, 0);
                            return t > 0 ? ((c.parsed.y / t) * 100).toFixed(1) + '% of total views' : '';
                        }
                    }
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
}

function drawCommentsChart(canvas, videos) {
    if (commentsChartInstance) {
        commentsChartInstance.destroy();
    }

    if (videos.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
        return;
    }

    const topComments = videos.map(v => ({
        title: (v.title || 'Video').substring(0, 20),
        comments: toNumber(v.comments)
    })).sort((a, b) => b.comments - a.comments).slice(0, 8);

    const ctx = canvas.getContext('2d');

    commentsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topComments.map(v => v.title),
            datasets: [{
                label: 'Comments',
                data: topComments.map(v => v.comments),
                backgroundColor: CHART_THEME.brandGoldLight,
                borderColor: CHART_THEME.brandGold,
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
                hoverBackgroundColor: CHART_THEME.brandGold,
                hoverBorderWidth: 2.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Top Commented Videos', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => formatNumber(c.parsed.y) + ' comments' }
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
}

function drawViewsTrendChart(canvas, videos) {
    if (viewsTrendChartInstance) {
        viewsTrendChartInstance.destroy();
    }

    if (videos.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
        return;
    }

    const points = videos
        .map(v => ({
            date: v.published_at ? new Date(v.published_at) : null,
            views: toNumber(v.views)
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

    viewsTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Views',
                data,
                borderColor: CHART_THEME.brandBlue,
                backgroundColor: CHART_THEME.brandBlueLight,
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
                title: { display: true, text: 'Publishing Timeline (Views)', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => formatNumber(c.parsed.y) + ' views' }
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
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                }
            }
        }
    });
}

function drawEngagementTrendChart(canvas, videos) {
    if (engagementTrendChartInstance) {
        engagementTrendChartInstance.destroy();
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
        const views = toNumber(v.views);
        const likes = toNumber(v.likes);
        const comments = toNumber(v.comments);
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
    engagementTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Engagement Rate (%)',
                data,
                borderColor: CHART_THEME.brandGreen,
                backgroundColor: CHART_THEME.brandGreenLight,
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
                title: { display: true, text: 'Engagement Rate Over Time', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => c.parsed.y.toFixed(2) + '%' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: CHART_THEME.grid, drawBorder: true, borderColor: CHART_THEME.border },
                    ticks: { color: CHART_THEME.textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                }
            }
        }
    });
}

function drawCtrProxyChart(canvas, videos) {
    if (ctrProxyChartInstance) {
        ctrProxyChartInstance.destroy();
    }

    if (videos.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
        return;
    }

    const byRate = videos.map(v => {
        const views = toNumber(v.views);
        const likes = toNumber(v.likes);
        return {
            title: (v.title || 'Video').substring(0, 18),
            rate: views > 0 ? (likes / views * 100) : 0
        };
    }).sort((a, b) => b.rate - a.rate).slice(0, 8);

    const ctx = canvas.getContext('2d');
    ctrProxyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: byRate.map(v => v.title),
            datasets: [{
                label: 'Likes per View (%)',
                data: byRate.map(v => v.rate),
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
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'CTR Proxy (Likes per View)', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => c.parsed.x.toFixed(2) + '%' }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: CHART_THEME.grid, drawBorder: true, borderColor: CHART_THEME.border },
                    ticks: { color: CHART_THEME.textMuted, font: { size: 12, weight: '500' }, callback: (v) => v + '%', padding: 10 }
                },
                y: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: CHART_THEME.text, font: { size: 12, weight: '600' }, padding: 10 }
                }
            }
        }
    });
}

function drawOutliersChart(canvas, videos) {
    if (outliersChartInstance) {
        outliersChartInstance.destroy();
    }

    if (videos.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No video data available</p>';
        return;
    }

    const viewsList = videos.map(v => toNumber(v.views)).filter(v => v > 0).sort((a, b) => a - b);
    if (viewsList.length === 0) {
        canvas.parentElement.innerHTML = '<p class="placeholder">No view data available</p>';
        return;
    }

    const idx = Math.floor(viewsList.length * 0.95);
    const threshold = viewsList[Math.min(idx, viewsList.length - 1)];

    let outliers = videos
        .map(v => ({ title: (v.title || 'Video').substring(0, 20), views: toNumber(v.views) }))
        .filter(v => v.views >= threshold)
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);

    if (outliers.length === 0) {
        outliers = videos
            .map(v => ({ title: (v.title || 'Video').substring(0, 20), views: toNumber(v.views) }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 3);
    }

    const ctx = canvas.getContext('2d');
    outliersChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: outliers.map(v => v.title),
            datasets: [{
                label: 'Views',
                data: outliers.map(v => v.views),
                backgroundColor: CHART_THEME.brandGoldLight,
                borderColor: CHART_THEME.brandGold,
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
                hoverBackgroundColor: CHART_THEME.brandGold,
                hoverBorderWidth: 2.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Top 5% View Outliers', color: CHART_THEME.text, font: { size: 15, weight: '600' }, padding: { bottom: 10 } },
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12, weight: '500' },
                    borderColor: CHART_THEME.border,
                    borderWidth: 1,
                    callbacks: { label: (c) => formatNumber(c.parsed.y) + ' views' }
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
    // Check if video already exists
    const exists = savedVideos.some(v => v.video_id === videoData.video_id);
    if (!exists) {
        savedVideos.push(videoData);
        saveSavedVideos();
        // Update quick select box
        populateQuickVideoSelect(savedVideos);
    }
}

function loadSelectedSavedVideo() {
    if (savedVideos.length === 0) {
        showToast('No saved videos. Search for videos first in the search tab.', 'info');
        return;
    }
    
    // Load the first saved video or the most recent one
    const video = savedVideos[savedVideos.length - 1];
    displayVideoAnalytics(video);
    
    const resultsDiv = document.getElementById('saved-video-results');
    resultsDiv.style.display = 'block';
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

// ==================== ERROR HANDLING ====================

window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    showToast('An error occurred. Check console for details.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});
