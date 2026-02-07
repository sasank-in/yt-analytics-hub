/**
 * YouTube Analytics Pro - Frontend Application
 * Vanilla JavaScript + FastAPI Integration
 */

// ==================== CONFIGURATION ====================

const API_BASE_URL = 'http://localhost:3000/api';
let currentChannelId = null;
let allChannels = [];
let savedVideos = []; // Store analyzed videos
let currentChannelVideos = []; // Store channel videos for quick access

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
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

    // View Toggle Dropdown for Channels
    const viewToggle = document.getElementById('channels-view-toggle');
    if (viewToggle) {
        viewToggle.addEventListener('change', (e) => {
            switchChannelsView(e.target.value);
        });
    }

    // View Toggle Dropdown for Videos
    const videoViewToggle = document.getElementById('videos-view-toggle');
    if (videoViewToggle) {
        videoViewToggle.addEventListener('change', (e) => {
            switchVideosView(e.target.value);
        });
    }

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

    // Saved Video Selection
    const loadSavedVideoBtn = document.getElementById('load-saved-video-btn');
    if (loadSavedVideoBtn) {
        loadSavedVideoBtn.addEventListener('click', loadSelectedSavedVideo);
    }

    // Channel Video Analysis
    const analyzeChannelVideoBtn = document.getElementById('analyze-channel-video-btn');
    if (analyzeChannelVideoBtn) {
        analyzeChannelVideoBtn.addEventListener('click', handleAnalyzeChannelVideo);
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
        
        // Populate saved videos dropdown
        populateSavedVideosDropdown();
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
        const channels = await fetchAPI('/channels');
        const totalChannels = channels.count || 0;
        
        let totalVideos = 0;
        channels.channels.forEach(ch => {
            totalVideos += parseInt(ch.total_videos) || 0;
        });

        document.getElementById('total-channels').textContent = totalChannels;
        document.getElementById('total-videos').textContent = totalVideos;
        
        // Load recent channels
        loadRecentChannels(channels.channels.slice(0, 5));
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

// ==================== SEARCH ====================

async function handleChannelSearch() {
    const query = document.getElementById('search-query').value.trim();
    const searchType = document.querySelector('input[name="search_type"]:checked').value;
    
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
                search_type: searchType
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
            const engagement = stats.average_engagement_rate || 0;
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

        const tbody = document.getElementById('videos-tbody');
        
        if (videos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="placeholder">No videos found. Click "Fetch Videos" to load data.</td></tr>';
            return;
        }

        tbody.innerHTML = videos.slice(0, 20).map(video => `
            <tr>
                <td>${video.title}</td>
                <td>${formatNumber(video.views)}</td>
                <td>${formatNumber(video.likes)}</td>
                <td>${formatNumber(video.comments)}</td>
                <td>${formatDate(video.published_at)}</td>
            </tr>
        `).join('');

        // Populate video dropdown
        const videoSelect = document.getElementById('channel-video-select');
        if (videoSelect) {
            videoSelect.innerHTML = '<option value="">-- Select a video to analyze --</option>';
            videos.forEach((video, index) => {
                const option = document.createElement('option');
                option.value = index; // Store index for easy access
                const title = (video.title || 'Video').substring(0, 50);
                option.text = `${title} (${formatNumber(video.views)} views)`;
                videoSelect.appendChild(option);
            });
        }

        // Draw charts with video data
        setTimeout(() => {
            const topVideosCanvas = document.getElementById('top-videos-canvas');
            const engagementCanvas = document.getElementById('engagement-canvas');
            
            if (topVideosCanvas && topVideosCanvas.getContext) {
                drawTopVideosChart(topVideosCanvas, videos);
            }
            if (engagementCanvas && engagementCanvas.getContext) {
                drawEngagementChart(engagementCanvas, videos);
            }
        }, 100);
    } catch (error) {
        document.getElementById('videos-tbody').innerHTML = 
            `<tr><td colspan="5" class="placeholder">Error loading videos: ${error.message}</td></tr>`;
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
    const views = parseInt(video.views || 0);
    const likes = parseInt(video.likes || 0);
    const comments = parseInt(video.comments || 0);
    
    // Calculate engagement rate
    const engagementRate = views > 0 ? ((likes + comments) / views * 100).toFixed(2) : 0;
    
    // Update statistics
    document.getElementById('video-views').textContent = formatNumber(views);
    document.getElementById('video-likes').textContent = formatNumber(likes);
    document.getElementById('video-comments').textContent = formatNumber(comments);
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
    
    // Update engagement chart (canvas-based)
    const chartDiv = document.getElementById('video-engagement-chart');
    const canvas = document.getElementById('video-engagement-canvas');
    
    if (canvas && canvas.getContext) {
        const totalEngagement = likes + comments;
        const data = {
            likes: likes,
            comments: comments,
            views: views
        };
        drawVideoEngagementChart(canvas, data);
    } else {
        // Fallback to simple visualization
        const totalEngagement = likes + comments;
        const likePercent = totalEngagement > 0 ? (likes / totalEngagement * 100).toFixed(1) : 0;
        const commentPercent = totalEngagement > 0 ? (comments / totalEngagement * 100).toFixed(1) : 0;
        
        chartDiv.innerHTML = `
            <div class="engagement-breakdown">
                <div class="engagement-stat">
                    <strong>Likes: ${likePercent}%</strong>
                    <div class="bar" style="width: ${likePercent}%; background: #4CAF50;"></div>
                </div>
                <div class="engagement-stat">
                    <strong>Comments: ${commentPercent}%</strong>
                    <div class="bar" style="width: ${commentPercent}%; background: #2196F3;"></div>
                </div>
            </div>
        `;
    }
}

// ==================== CHART FUNCTIONS ====================

function drawVideoEngagementChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth || 300;
    const height = canvas.offsetHeight || 200;
    
    canvas.width = width;
    canvas.height = height;
    
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const maxValue = Math.max(data.likes, data.comments, data.views);
    const scale = chartHeight / maxValue;
    
    // Background
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(0, 0, width, height);
    
    // Grid lines
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw bars
    const barWidth = chartWidth / 3;
    const spacing = 10;
    
    // Likes bar
    const likesHeight = data.likes * scale;
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(padding + spacing, height - padding - likesHeight, barWidth - spacing * 2, likesHeight);
    
    // Comments bar
    const commentsHeight = data.comments * scale;
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(padding + barWidth + spacing, height - padding - commentsHeight, barWidth - spacing * 2, commentsHeight);
    
    // Views bar (scaled down for visibility)
    const viewsHeight = (data.views / 100) * scale;
    ctx.fillStyle = '#FF9800';
    ctx.fillRect(padding + barWidth * 2 + spacing, height - padding - viewsHeight, barWidth - spacing * 2, viewsHeight);
    
    // Labels
    ctx.fillStyle = '#2c3e50';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    
    ctx.fillText('Likes', padding + barWidth / 2, height - padding + 20);
    ctx.fillText('Comments', padding + barWidth * 1.5, height - padding + 20);
    ctx.fillText('Views (÷100)', padding + barWidth * 2.5, height - padding + 20);
    
    // Values on bars
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(formatNumber(data.likes), padding + barWidth / 2, height - padding - likesHeight + 20);
    ctx.fillText(formatNumber(data.comments), padding + barWidth * 1.5, height - padding - commentsHeight + 20);
}

function drawEngagementChart(canvas, videos) {
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth || 300;
    const height = canvas.offsetHeight || 200;
    
    canvas.width = width;
    canvas.height = height;
    
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    if (videos.length === 0) {
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No video data available', width / 2, height / 2);
        return;
    }
    
    // Get engagement rates
    const engagements = videos.map(v => {
        const views = parseInt(v.views) || 0;
        const likes = parseInt(v.likes) || 0;
        const comments = parseInt(v.comments) || 0;
        return {
            title: (v.title || 'Video').substring(0, 10),
            rate: views > 0 ? ((likes + comments) / views * 100) : 0
        };
    }).slice(0, 5);
    
    const maxRate = Math.max(...engagements.map(e => e.rate));
    const scale = chartHeight / (maxRate || 1);
    
    // Background
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(0, 0, width, height);
    
    // Grid lines
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw bars
    const barWidth = chartWidth / engagements.length;
    const spacing = 5;
    
    engagements.forEach((eng, i) => {
        const barHeight = eng.rate * scale;
        const x = padding + (barWidth * i) + spacing;
        
        ctx.fillStyle = '#0066cc';
        ctx.fillRect(x, height - padding - barHeight, barWidth - spacing * 2, barHeight);
        
        // Labels
        ctx.fillStyle = '#2c3e50';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(eng.title, x + (barWidth - spacing * 2) / 2, height - padding + 20);
        
        // Values
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        if (barHeight > 20) {
            ctx.fillText(eng.rate.toFixed(1) + '%', x + (barWidth - spacing * 2) / 2, height - padding - barHeight + 15);
        }
    });
}

function drawTopVideosChart(canvas, videos) {
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth || 300;
    const height = canvas.offsetHeight || 200;
    
    canvas.width = width;
    canvas.height = height;
    
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    if (videos.length === 0) {
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No video data available', width / 2, height / 2);
        return;
    }
    
    // Get top 5 videos by views
    const topVideos = videos
        .map(v => ({
            title: (v.title || 'Video').substring(0, 12),
            views: parseInt(v.views) || 0
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);
    
    const maxViews = Math.max(...topVideos.map(v => v.views));
    const scale = chartHeight / (maxViews || 1);
    
    // Background
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(0, 0, width, height);
    
    // Grid lines
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw bars
    const barWidth = chartWidth / topVideos.length;
    const spacing = 5;
    
    topVideos.forEach((vid, i) => {
        const barHeight = vid.views * scale;
        const x = padding + (barWidth * i) + spacing;
        
        // Gradient color
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(x, height - padding - barHeight, barWidth - spacing * 2, barHeight);
        
        // Labels
        ctx.fillStyle = '#2c3e50';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(vid.title, x + (barWidth - spacing * 2) / 2, height - padding + 20);
        
        // Values
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        if (barHeight > 20) {
            ctx.fillText(formatNumber(vid.views), x + (barWidth - spacing * 2) / 2, height - padding - barHeight + 15);
        }
    });
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
    }
}

function populateSavedVideosDropdown() {
    const select = document.getElementById('saved-video-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select a video --</option>';
    
    if (savedVideos.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.text = 'No saved videos. Search for videos first.';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    savedVideos.forEach((video, index) => {
        const option = document.createElement('option');
        option.value = index;
        const title = (video.title || 'Video').substring(0, 40);
        option.text = `${title} (${formatNumber(video.views)} views)`;
        select.appendChild(option);
    });
}

function loadSelectedSavedVideo() {
    const select = document.getElementById('saved-video-select');
    const index = select.value;
    
    if (index === '' || !savedVideos[index]) {
        showToast('Please select a video', 'warning');
        return;
    }
    
    const video = savedVideos[index];
    displayVideoAnalytics(video);
    
    const resultsDiv = document.getElementById('saved-video-results');
    resultsDiv.style.display = 'block';
}

function handleAnalyzeChannelVideo() {
    const select = document.getElementById('channel-videos-select');
    const index = parseInt(select.value);
    
    if (select.value === '' || isNaN(index) || !currentChannelVideos[index]) {
        showToast('Please select a video from the list', 'warning');
        return;
    }
    
    const video = currentChannelVideos[index];
    
    // Switch to video analytics tab
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-section') === 'videos') {
            btn.classList.add('active');
        }
    });
    
    showSection('videos');
    switchVideosView('search');
    
    // Display the video analysis
    displayVideoAnalytics(video);
    addToSavedVideos(video);
    document.getElementById('video-results').style.display = 'block';
    showToast('Video analysis loaded and saved', 'success');
}

function formatNumber(num) {
    if (!num) return '0';
    const n = parseInt(num);
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
