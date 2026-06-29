/**
 * Per-video advanced analytics renderer.
 *
 * Pulls /api/video/{id}/analytics and paints:
 *   - Verdict KPI card (label + color)
 *   - Rate sub-text on each KPI (per-day, like rate, comment rate, age)
 *   - Key insights bullet list
 *   - Percentile bars (views, engagement, like rate, comment rate)
 *   - Earnings cone
 *
 * Defensive: every block handles null fields (sample-too-small case) by
 * showing a graceful empty state instead of crashing.
 */
(function () {
    'use strict';

    const fmt = (n) => window.formatNumber(n);

    const VERDICT_COLORS = {
        green: { bg: '#15803d', tint: '#dcfce7' },
        blue:  { bg: '#1d4ed8', tint: '#dbeafe' },
        slate: { bg: '#475569', tint: '#f1f5f9' },
        amber: { bg: '#b08530', tint: '#fef3c7' },
    };

    async function render(videoId) {
        if (!videoId) return;
        try {
            const data = await window.fetchAPI(`/video/${encodeURIComponent(videoId)}/analytics`);
            renderVerdict(data.verdict);
            renderRates(data.rates, data.age_days);
            renderInsights(data.insights);
            renderPercentiles(data.vs_channel);
            renderEarnings(data.earnings);
        } catch (e) {
            console.warn('Video advanced analytics failed:', e.message);
        }
    }

    // ---------------------------------------------------------------------
    // Verdict KPI card
    // ---------------------------------------------------------------------
    function renderVerdict(verdict) {
        const labelEl = document.getElementById('va-verdict-label');
        const scoreEl = document.getElementById('va-verdict-score');
        if (!labelEl) return;

        const v = verdict || {};
        labelEl.textContent = v.label || '—';
        scoreEl.textContent = v.score == null ? '—' : v.score;

        const colors = VERDICT_COLORS[v.color] || VERDICT_COLORS.slate;
        labelEl.style.color = colors.bg;
    }

    // ---------------------------------------------------------------------
    // Per-KPI sub-text (rates)
    // ---------------------------------------------------------------------
    function renderRates(rates, ageDays) {
        if (!rates) return;
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        set('va-views-per-day',   `${fmt(Math.round(rates.views_per_day))} /day`);
        set('va-like-rate',       `${rates.like_rate_pct.toFixed(2)}% rate`);
        set('va-comment-rate',    `${rates.comment_rate_pct.toFixed(2)}% rate`);
        if (ageDays != null) {
            const label = ageDays === 1 ? '1 day old' : `${ageDays.toLocaleString()} days old`;
            set('va-age', label);
        }
    }

    // ---------------------------------------------------------------------
    // Key insights
    // ---------------------------------------------------------------------
    function renderInsights(insights) {
        const panel = document.getElementById('video-insights-panel');
        const ul = document.getElementById('va-insights');
        if (!panel || !ul) return;

        if (!insights || insights.length === 0) {
            panel.classList.add('hidden');
            return;
        }
        panel.classList.remove('hidden');

        ul.innerHTML = insights.map((text) => {
            // Convert **bold** markers to <strong>
            const html = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            return `<li class="flex gap-2"><span class="text-brand-500">•</span><span>${html}</span></li>`;
        }).join('');
    }

    // ---------------------------------------------------------------------
    // Percentile bars
    // ---------------------------------------------------------------------
    function renderPercentiles(vs) {
        const panel = document.getElementById('video-percentile-panel');
        const wrap  = document.getElementById('va-percentile-bars');
        const countEl = document.getElementById('va-siblings-count');
        if (!panel || !wrap) return;

        if (!vs || vs.views_pctile == null) {
            // Not enough siblings — hide the panel cleanly.
            panel.classList.add('hidden');
            return;
        }
        panel.classList.remove('hidden');
        if (countEl) {
            countEl.textContent = `${vs.n_siblings} sibling${vs.n_siblings === 1 ? '' : 's'}`;
        }

        const rows = [
            { label: 'Views',         pct: vs.views_pctile,        suffix: vs.views_vs_median != null ? ` · ${vs.views_vs_median.toFixed(1)}× median` : '' },
            { label: 'Engagement',    pct: vs.engagement_pctile,   suffix: vs.engagement_vs_median != null ? ` · ${vs.engagement_vs_median.toFixed(1)}× median` : '' },
            { label: 'Like rate',     pct: vs.like_rate_pctile,    suffix: '' },
            { label: 'Comment rate',  pct: vs.comment_rate_pctile, suffix: '' },
        ];

        wrap.innerHTML = rows.filter((r) => r.pct != null).map((r) => {
            const color = pctColor(r.pct);
            return `
                <div class="va-pct-row">
                    <span class="va-pct-label">${r.label}</span>
                    <div class="va-pct-track">
                        <div class="va-pct-fill" style="width:${r.pct}%; background:${color}"></div>
                    </div>
                    <span class="va-pct-value">${Math.round(r.pct)}<sup>th</sup>${r.suffix}</span>
                </div>
            `;
        }).join('');
    }

    function pctColor(p) {
        if (p >= 80) return '#15803d';
        if (p >= 60) return '#1d4ed8';
        if (p >= 40) return '#64748b';
        if (p >= 20) return '#b08530';
        return '#b91c1c';
    }

    // ---------------------------------------------------------------------
    // Earnings cone
    // ---------------------------------------------------------------------
    function renderEarnings(earnings) {
        const panel = document.getElementById('video-earnings-panel');
        if (!panel) return;
        if (!earnings) { panel.classList.add('hidden'); return; }
        panel.classList.remove('hidden');

        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        set('va-earnings-low',     fmt(Math.round(earnings.low_usd)));
        set('va-earnings-mid',     fmt(Math.round(earnings.lifetime_usd)));
        set('va-earnings-high',    fmt(Math.round(earnings.high_usd)));
        set('va-earnings-rpm',     earnings.rpm.toFixed(2));
        set('va-earnings-per-day', `$${earnings.per_day_usd.toFixed(2)}`);
    }

    // ---------------------------------------------------------------------
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
        );
    }

    window.VideoAdvancedAnalytics = { render };
})();
