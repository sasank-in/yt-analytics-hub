/**
 * Advanced analytics renderers.
 *
 * Pulls `/api/channel/{id}/analytics` and paints into the eight slots
 * under #advanced-analytics. Each renderer is defensive: if the backend
 * returns a `null` field (not enough data), it shows a skeleton/empty
 * state instead of throwing.
 *
 * Exports: window.AdvancedAnalytics.render(channelId)
 */
(function () {
    'use strict';

    const state = window.AdvancedAnalyticsState || (window.AdvancedAnalyticsState = {});
    const theme = () => window.CHART_THEME;
    const fmt = (n) => window.formatNumber(n);

    const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    function destroyChart(key) {
        if (state[key]) {
            try { state[key].destroy(); } catch (_e) { /* ignore */ }
            state[key] = null;
        }
    }

    function setSubtitle(el, text) {
        if (el) el.textContent = text;
    }

    function emptyMessage(canvas, msg) {
        if (canvas) canvas.parentElement.innerHTML = `<p class="placeholder">${msg}</p>`;
    }

    // ---------------------------------------------------------------------
    // Top-level render
    // ---------------------------------------------------------------------
    async function render(channelId) {
        const container = document.getElementById('advanced-analytics');
        if (!container || !channelId) return;
        container.classList.remove('hidden');

        let data;
        try {
            data = await window.fetchAPI(`/channel/${channelId}/analytics`);
        } catch (e) {
            console.warn('AdvancedAnalytics fetch failed:', e.message);
            return;
        }

        // Each renderer is wrapped so one failure doesn't wipe the panel.
        // Previously the catch clobbered container.innerHTML, blowing away
        // the very elements the renderers need on the next call.
        const safe = (label, fn) => {
            try { fn(); }
            catch (e) { console.warn(`AdvancedAnalytics.${label} failed:`, e.message); }
        };
        safe('insights',     () => renderInsights(data.insights));
        safe('health',       () => renderHealthScore(data.health_score, data.sample_size));
        safe('cadence',      () => renderCadence(data.cadence));
        safe('heatmap',      () => renderHeatmap(data.publish_pattern, data.best_slot));
        safe('correlation',  () => renderEngagementCorrelation(data.engagement_vs_views));
        safe('title_length', () => renderTitleLength(data.title_length));
        safe('decay',        () => renderDecay(data.decay));
        safe('earnings',     () => renderEarningsCone(data.earnings_cone));
        safe('composite',    () => renderComposite(data.composite_ranking));
    }

    // ---------------------------------------------------------------------
    // Key insights panel — plain-language conclusions
    // ---------------------------------------------------------------------
    function renderInsights(insights) {
        const ul = document.getElementById('aa-insights');
        if (!ul) return;
        if (!insights) { ul.innerHTML = '<li class="text-slate-400">No insights available</li>'; return; }
        const order = ['health', 'cadence', 'best_slot', 'outperformers', 'correlation', 'decay', 'title_length'];
        const icons = {
            health: '◆', cadence: '⏱', best_slot: '◷', outperformers: '★',
            correlation: '↔', decay: '⤵', title_length: '✎',
        };
        const items = order
            .filter((k) => insights[k])
            .map((k) => `<li class="flex gap-2"><span class="text-brand-500">${icons[k] || '·'}</span><span>${escapeHtml(insights[k])}</span></li>`);
        ul.innerHTML = items.length
            ? items.join('')
            : '<li class="text-slate-400">Not enough data yet — try fetching more videos for this channel.</li>';
    }

    // ---------------------------------------------------------------------
    // B6 — Health score (big number + breakdown)
    // ---------------------------------------------------------------------
    function renderHealthScore(hs, n) {
        const scoreEl = document.getElementById('aa-health-score');
        const subEl = document.getElementById('aa-health-sub');
        const barsEl = document.getElementById('aa-health-bars');
        if (!scoreEl) return;
        if (!hs || hs.score === null) {
            scoreEl.textContent = '–';
            setSubtitle(subEl, `Need at least one video (n=${n})`);
            if (barsEl) barsEl.innerHTML = '';
            return;
        }
        scoreEl.textContent = hs.score;
        // Tint by score band
        const colour = hs.score >= 70 ? '#15803d' : hs.score >= 40 ? '#b08530' : '#b91c1c';
        scoreEl.style.color = colour;
        setSubtitle(subEl, `Composite of engagement, consistency, and cadence • n=${n}`);

        if (barsEl) {
            const c = hs.components || {};
            barsEl.innerHTML = ['engagement', 'consistency', 'cadence'].map((k) => {
                const v = c[k];
                const pct = v === null || v === undefined ? 0 : Math.round(v * 100);
                return `
                    <div class="aa-bar-row">
                        <span class="aa-bar-label">${k}</span>
                        <div class="aa-bar-track"><div class="aa-bar-fill" style="width:${pct}%"></div></div>
                        <span class="aa-bar-value">${pct}%</span>
                    </div>
                `;
            }).join('');
        }
    }

    // ---------------------------------------------------------------------
    // B1 — Cadence histogram
    // ---------------------------------------------------------------------
    function renderCadence(c) {
        const canvas = document.getElementById('aa-cadence-canvas');
        const statsEl = document.getElementById('aa-cadence-stats');
        if (!canvas) return;
        destroyChart('cadenceChart');

        if (!c || c.median_days === null) {
            emptyMessage(canvas, 'Need ≥2 videos to compute cadence');
            if (statsEl) statsEl.textContent = '';
            return;
        }

        if (statsEl) {
            statsEl.innerHTML = `
                <span><strong>${c.median_days}</strong> days median</span>
                <span><strong>${c.longest_gap_days}</strong> days longest gap</span>
                <span><strong>${c.current_streak_days}</strong> days since last upload</span>
            `;
        }

        // Bin intervals into a histogram
        const intervals = c.intervals || [];
        const max = Math.max(...intervals, 1);
        const binCount = Math.min(10, intervals.length);
        const binSize = Math.ceil(max / binCount);
        const bins = Array.from({ length: binCount }, () => 0);
        intervals.forEach((iv) => {
            const idx = Math.min(Math.floor(iv / binSize), binCount - 1);
            bins[idx] += 1;
        });
        const labels = bins.map((_, i) => `${i * binSize}–${(i + 1) * binSize}d`);

        state.cadenceChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Inter-upload gap (videos)',
                    data: bins,
                    backgroundColor: theme().brandBlueLight,
                    borderColor: theme().brandBlue,
                    borderWidth: 2,
                    borderRadius: 6,
                }],
            },
            options: simpleBarOptions('Inter-Upload Gap Distribution', 'Bin size auto-scaled • median dashed'),
        });
    }

    // ---------------------------------------------------------------------
    // B2 — Day-of-week × hour heatmap (rendered via CSS grid, not Chart.js)
    // ---------------------------------------------------------------------
    function renderHeatmap(p, slot) {
        const container = document.getElementById('aa-heatmap');
        if (!container) return;
        if (!p) {
            container.innerHTML = '<p class="placeholder">No publish-time data</p>';
            return;
        }
        const counts = p.weekday_counts || [0, 0, 0, 0, 0, 0, 0];
        const hourMatrix = p.hour_mean_views || Array(24).fill(0);
        const bestDay = slot?.best_weekday;
        const bestHour = slot?.best_hour;

        const maxCount = Math.max(...counts, 1);
        const maxHourViews = Math.max(...hourMatrix, 1);

        const dayBars = counts.map((c, i) => {
            const isWinner = WEEKDAYS[i] === bestDay?.substring(0, 3);
            return `
                <div class="aa-heat-day${isWinner ? ' aa-best' : ''}">
                    <span class="aa-heat-label">${WEEKDAYS[i]}</span>
                    <div class="aa-heat-track">
                        <div class="aa-heat-fill" style="width:${(c / maxCount) * 100}%"></div>
                    </div>
                    <span class="aa-heat-value">${c}</span>
                </div>
            `;
        }).join('');

        const hourCells = hourMatrix.map((views, h) => {
            const t = views / maxHourViews;
            const opacity = 0.08 + 0.92 * t;
            const isWinner = h === bestHour;
            return `
                <div class="aa-hour-cell${isWinner ? ' aa-best' : ''}" style="background: rgba(37, 99, 235, ${opacity});" title="${h}:00 UTC → ${fmt(views)} mean views">
                    <span class="aa-hour-h">${h}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="aa-heat-section">
                <h4 class="aa-sub-h">Uploads by weekday</h4>
                <div class="aa-heat-bars">${dayBars}</div>
            </div>
            <div class="aa-heat-section">
                <h4 class="aa-sub-h">Mean views by publish hour (UTC)</h4>
                <div class="aa-hour-grid">${hourCells}</div>
            </div>
        `;
    }

    // ---------------------------------------------------------------------
    // B3 — Engagement vs views correlation
    // ---------------------------------------------------------------------
    function renderEngagementCorrelation(c) {
        const rEl = document.getElementById('aa-corr-r');
        const interpEl = document.getElementById('aa-corr-interp');
        if (!rEl) return;
        if (!c || c.pearson_r === null) {
            rEl.textContent = '–';
            setSubtitle(interpEl, `Need ≥3 videos with views (n=${c?.n || 0})`);
            return;
        }
        const r = c.pearson_r;
        rEl.textContent = r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2);
        rEl.style.color = Math.abs(r) >= 0.4 ? '#1d4ed8' : '#64748b';
        let msg;
        if (Math.abs(r) < 0.2) msg = 'Engagement is essentially independent of view count.';
        else if (r >= 0.2 && r < 0.6) msg = 'Higher-view videos engage somewhat more.';
        else if (r >= 0.6) msg = 'Engagement rises strongly with view count.';
        else if (r > -0.6) msg = 'Higher-view videos engage somewhat less (mass-audience dilution).';
        else msg = 'Engagement collapses on viral videos — strong negative correlation.';
        setSubtitle(interpEl, `${msg} (Pearson r over log-views, n=${c.n})`);
    }

    // ---------------------------------------------------------------------
    // B4 — Title length impact
    // ---------------------------------------------------------------------
    function renderTitleLength(buckets) {
        const canvas = document.getElementById('aa-title-canvas');
        const noteEl = document.getElementById('aa-title-note');
        if (!canvas) return;
        destroyChart('titleChart');

        if (!buckets || buckets.every((b) => b.n === 0)) {
            emptyMessage(canvas, 'No title data');
            if (noteEl) noteEl.textContent = '';
            return;
        }

        const unreliable = buckets.filter((b) => !b.reliable && b.n > 0).map((b) => b.bucket);
        if (noteEl) {
            noteEl.textContent = unreliable.length
                ? `Buckets with <3 videos (${unreliable.join(', ')}) are unreliable.`
                : 'All buckets have ≥3 videos.';
        }

        state.titleChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: buckets.map((b) => `${b.bucket} (n=${b.n})`),
                datasets: [{
                    label: 'Median views',
                    data: buckets.map((b) => b.median_views),
                    backgroundColor: buckets.map((b) => b.reliable ? theme().brandBlueLight : 'rgba(148,163,184,0.4)'),
                    borderColor: buckets.map((b) => b.reliable ? theme().brandBlue : 'rgba(148,163,184,0.9)'),
                    borderWidth: 2,
                    borderRadius: 6,
                }],
            },
            options: simpleBarOptions('Views by Title Length', 'Median views per bucket • greyed = unreliable'),
        });
    }

    // ---------------------------------------------------------------------
    // B7 — Power-law decay
    // ---------------------------------------------------------------------
    function renderDecay(d) {
        const expEl = document.getElementById('aa-decay-exp');
        const r2El = document.getElementById('aa-decay-r2');
        const interpEl = document.getElementById('aa-decay-interp');
        if (!expEl) return;

        if (!d || d.fit_quality === 'insufficient_data') {
            expEl.textContent = '–';
            r2El.textContent = '–';
            setSubtitle(interpEl, `Need ≥5 dated videos (n=${d?.n || 0})`);
            return;
        }
        if (d.exponent === null) {
            // Slope was wild or fit was poor — don't report the number.
            expEl.textContent = '–';
            r2El.textContent = d.r_squared.toFixed(2);
            expEl.style.color = '#94a3b8';
            setSubtitle(interpEl, `No usable signal (R²=${d.r_squared.toFixed(2)}). Either views aren't age-driven, or the sample is too noisy.`);
            return;
        }
        expEl.style.color = '';
        expEl.textContent = d.exponent.toFixed(2);
        r2El.textContent = d.r_squared.toFixed(2);
        let interp;
        const b = d.exponent;
        if (b > 0.3) interp = 'Older videos accumulate substantially more views — strong "long tail."';
        else if (b > 0.1) interp = 'Older videos slightly favoured. Long-tail effect is mild.';
        else if (b > -0.1) interp = 'Roughly flat: video age has little effect on view count.';
        else if (b > -0.3) interp = 'Recent uploads slightly favoured over older ones.';
        else interp = 'Strong recency effect: newer videos dominate.';
        setSubtitle(interpEl, `${interp} R²=${d.r_squared.toFixed(2)} · fit quality: ${d.fit_quality} · n=${d.n}.`);
    }

    // ---------------------------------------------------------------------
    // B9 — Earnings cone
    // ---------------------------------------------------------------------
    function renderEarningsCone(e) {
        const wrap = document.getElementById('aa-earnings');
        if (!wrap) return;
        if (!e) {
            wrap.innerHTML = '<p class="placeholder">Set an RPM on the channel detail page to estimate earnings.</p>';
            return;
        }
        wrap.innerHTML = `
            <div class="aa-earnings-row">
                <span class="aa-earnings-low">$${fmt(Math.round(e.low))}</span>
                <span class="aa-earnings-mid">$${fmt(Math.round(e.mid))}</span>
                <span class="aa-earnings-high">$${fmt(Math.round(e.high))}</span>
            </div>
            <div class="aa-earnings-bar">
                <div class="aa-earnings-fill"></div>
            </div>
            <p class="text-xs text-slate-500 mt-2">
                Low / mid / high lifetime earnings at RPM $${e.rpm}
                (±30% band reflecting real-world RPM variability).
                Based on ${fmt(e.lifetime_views)} total views.
            </p>
        `;
    }

    // ---------------------------------------------------------------------
    // B10 — Composite ranking
    // ---------------------------------------------------------------------
    function renderComposite(rows) {
        const tbody = document.getElementById('aa-composite-body');
        if (!tbody) return;
        if (!rows || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="placeholder">No videos to rank yet</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map((r, i) => {
            const dim = r.outperformer ? '' : ' text-slate-400';
            const badge = r.outperformer
                ? '<span class="aa-rank-pill" style="background:#fef3c7;color:#92400e">★ #' + (i + 1) + '</span>'
                : `<span class="aa-rank-pill" style="background:#f1f5f9;color:#64748b">#${i + 1}</span>`;
            return `
                <tr class="${dim ? 'opacity-70' : ''}">
                    <td>${badge}</td>
                    <td class="truncate${dim}" title="${escapeHtml(r.title || '')}">${escapeHtml(r.title || 'Video')}</td>
                    <td class="num"><strong>${r.score}</strong></td>
                    <td class="num text-slate-500">${r.ranks.views_pct.toFixed(0)}%</td>
                    <td class="num text-slate-500">${r.ranks.engagement_pct.toFixed(0)}%</td>
                </tr>
            `;
        }).join('');
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
        );
    }

    function simpleBarOptions(title, subtitle) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, color: theme().text, font: { size: 14, weight: '600' }, padding: { bottom: 8 } },
                subtitle: { display: !!subtitle, text: subtitle || '', color: theme().textMuted, font: { size: 11 }, padding: { bottom: 6 } },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    borderColor: theme().border,
                    borderWidth: 1,
                },
            },
            scales: {
                y: { beginAtZero: true, grid: { color: theme().grid }, ticks: { color: theme().textMuted, callback: (v) => fmt(v) } },
                x: { grid: { display: false }, ticks: { color: theme().text } },
            },
        };
    }

    window.AdvancedAnalytics = { render };
})();
