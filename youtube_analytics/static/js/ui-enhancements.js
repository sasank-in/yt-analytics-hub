/* UI enhancements layered on top of app.js — runs after it. */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        wireHashRouting();
        wireKeyboardShortcuts();
        wireGlobalSearch();
        wireDashboardJumps();
        wireChannelsFilterSort();
        wireSettingsFilters();
        wireSettingsTableActions();
        markActiveNav();
    });

    // ---------- Hash routing ----------
    function wireHashRouting() {
        const apply = () => {
            const hash = (location.hash || '').replace(/^#/, '');
            const valid = ['dashboard', 'channels', 'videos', 'settings'];
            if (valid.includes(hash)) {
                if (typeof window.showSection === 'function') {
                    window.showSection(hash);
                }
                document.querySelectorAll('.nav-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.section === hash);
                });
                updatePageTitle(hash);
            }
        };

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                if (section) {
                    location.hash = section;
                    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b === btn));
                    updatePageTitle(section);
                }
            });
        });

        window.addEventListener('hashchange', apply);
        apply();
    }

    function updatePageTitle(section) {
        const titles = {
            dashboard: 'Dashboard',
            channels: 'Channels',
            videos: 'Video Analytics',
            settings: 'Settings',
        };
        const el = document.getElementById('page-title');
        if (el) el.textContent = titles[section] || 'YouTube Analytics';
        const crumb = document.getElementById('page-breadcrumb');
        if (crumb) crumb.textContent = '';
    }

    function markActiveNav() {
        const hash = (location.hash || '#dashboard').replace(/^#/, '');
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === hash);
        });
    }

    // ---------- Keyboard shortcuts ----------
    function wireKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const target = e.target;
            const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

            // "/" focuses the global search (or the current page's primary input)
            if (e.key === '/' && !inField) {
                e.preventDefault();
                const global = document.getElementById('global-search');
                if (global && !global.classList.contains('hidden')) {
                    global.focus();
                    global.select();
                }
            }

            // Esc — back from channel detail, or blur input
            if (e.key === 'Escape') {
                const detail = document.getElementById('channel-details');
                if (detail && !detail.classList.contains('hidden')) {
                    const back = document.getElementById('back-btn');
                    if (back) back.click();
                } else if (inField) {
                    target.blur();
                }
            }
        });
    }

    // ---------- Global header search ----------
    // Live filter of saved channels — not a YouTube search.
    function wireGlobalSearch() {
        const input = document.getElementById('global-search');
        if (!input) return;
        const apply = () => {
            const q = input.value;
            if (location.hash !== '#channels') location.hash = 'channels';
            const filter = document.getElementById('channels-filter');
            if (filter && filter.value !== q) {
                filter.value = q;
                if (typeof window.renderSavedChannels === 'function') {
                    window.renderSavedChannels();
                }
            }
        };
        input.addEventListener('input', apply);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                apply();
                const filter = document.getElementById('channels-filter');
                if (filter) filter.focus();
            }
        });
    }

    // ---------- Dashboard jump links ----------
    function wireDashboardJumps() {
        document.querySelectorAll('[data-jump]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.jump;
                if (target) location.hash = target;
            });
        });
    }

    // ---------- Channels filter/sort ----------
    function wireChannelsFilterSort() {
        const filter = document.getElementById('channels-filter');
        const sort = document.getElementById('channels-sort');
        const handler = () => {
            if (typeof window.renderSavedChannels === 'function') window.renderSavedChannels();
        };
        if (filter) filter.addEventListener('input', handler);
        if (sort) sort.addEventListener('change', handler);
    }

    // ---------- Settings filters ----------
    function wireSettingsFilters() {
        const cf = document.getElementById('settings-channels-filter');
        if (cf) cf.addEventListener('input', () => {
            // Reset to page 1 when filter changes
            if (typeof window.settingsPageChange === 'function') {
                // Force page = 1 by calling a delta that lands there: cleaner is a dedicated reset.
            }
            if (typeof window.resetSettingsChannelsPage === 'function') window.resetSettingsChannelsPage();
            if (typeof window.renderSettingsChannels === 'function') window.renderSettingsChannels();
        });
        const vf = document.getElementById('settings-videos-filter');
        if (vf) vf.addEventListener('input', () => {
            if (typeof window.resetSettingsVideosPage === 'function') window.resetSettingsVideosPage();
            if (typeof window.renderSettingsVideos === 'function') window.renderSettingsVideos();
        });
    }

    // ---------- Settings table delegated actions ----------
    function wireSettingsTableActions() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const id = btn.dataset.id;
            switch (btn.dataset.action) {
                case 'delete-channel':
                    if (typeof window.deleteChannelById === 'function') window.deleteChannelById(id);
                    break;
                case 'delete-video':
                    if (typeof window.deleteVideoById === 'function') window.deleteVideoById(id);
                    break;
                case 'view-channel':
                    if (typeof window.selectChannel === 'function') {
                        location.hash = 'channels';
                        window.selectChannel(id);
                    }
                    break;
                case 'page-prev':
                    if (typeof window.settingsPageChange === 'function') window.settingsPageChange(btn.dataset.table, -1);
                    break;
                case 'page-next':
                    if (typeof window.settingsPageChange === 'function') window.settingsPageChange(btn.dataset.table, 1);
                    break;
            }
        });
    }
})();
