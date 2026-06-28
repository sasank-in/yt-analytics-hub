# Creatorscope — TODO (v2 audit)

## What the analytics actually returned on real channels (Nov 5)

Sample audit on 9 real channels including 3Blue1Brown (8M subs), Google for
Developers (millions), HuggingFace, and Think Music. Findings:

| Channel | Sample | Health | Cadence median | Decay b | Verdict |
|---|---|---|---|---|---|
| 3Blue1Brown | 50 | 35 | 42d | -0.04 | Should be 60+ |
| HuggingFace | 327 | 25 | 1.0d | 0.27 | Should be 50+ |
| Google for Devs | 7003 | 11 | 0.1d | 0.19 | Should be 70+ |
| Prime Video India | 44 | 18 | 0.08d | 0.21 | Hyperactive channel, ok score |
| Netflix India | 31 | 18 | 0.1d | 9.87 (!) | Decay broken |
| Unq Gamer | 16 | 59 | 0.36d | 6.81 (!) | Decay broken |
| Think Music | 6844 | 16 | 0.29d | -0.08 | Should be 50+ |

## Bugs found

- [ ] **B-bug-1** Cadence component is **always 0** in health_score because
      _normalise(median_gap, 60.0, 7.0) reverses lo/hi but most medians are
      0.1d (sub-7d) — those clamp to 1.0, NOT zero. So why is cad=0?
      → Real bug: the API returns top-50 videos by *view count*, not in
      chronological order. Some channels have only a few videos in the
      sample with bunched dates, so the median gap looks tiny. But that's
      not the bug — let me read the actual normaliser output.

- [ ] **B-bug-2** Decay exponent goes wild (9.87, 6.81) on small samples
      because the log–log fit has zero variance protection but the OLS
      slope still explodes when r² is near 0. Need to gate on r² > 0.1
      before reporting the exponent, otherwise return "no signal".

- [ ] **B-bug-3** Title-length n=0 buckets shouldn't render. Either skip
      empty buckets or show "—" instead of "0 / 0 views".

- [ ] **B-bug-4** "Current streak" labelled positively but for old channels
      it shows time-since-last-upload — invert to "Days inactive" when
      >30 days, with red color, with copy: "channel may be dormant."

- [ ] **B-bug-5** Composite score percentile-rank against the channel
      itself means every channel will have a 99-scoring video. Need to
      either rename to "within-channel rank" or expose absolute thresholds.

## Insight generators (the real fix)

Every metric needs a "so what?" sentence. Add an `interpretations: {key: text}`
block to the analytics response, computed server-side.

- [ ] **I1** cadence → "This channel uploads on average every X days. Top
      quartile YouTube channels upload every 2–7 days; this is steady /
      sporadic / dormant."
- [ ] **I2** correlation → "Engagement falls / rises / stays flat as videos
      get bigger. Strong negative correlation suggests the channel is
      reaching audiences beyond their core; flat means consistent quality."
- [ ] **I3** decay → "Older videos accumulate views X% faster / slower than
      recent ones. Strong long-tail = evergreen content. Reverse = the
      channel is improving."  (Only show when R² ≥ 0.1.)
- [ ] **I4** title length → Compare the WINNING bucket's median to the
      OVERALL median, only declare a winner if difference > 20% AND both
      buckets have ≥5 videos. Otherwise: "Title length does not appear to
      affect view count in this sample."
- [ ] **I5** health score components → name the WEAKEST component and
      suggest a specific fix ("Engagement is your weakest area — try
      asking for comments at the end of videos").
- [ ] **I6** best day/hour → "This channel publishes most on Wednesdays at
      14:00. Best-performing day: Thursday (mean views 2.1× the median)."
- [ ] **I7** composite ranking → re-frame as "outperformers" by absolute
      thresholds (≥ 3× channel median views AND engagement above channel
      median).

## Calibration

- [ ] **C1** Health-score weights are wrong. With 5% engagement as full
      credit, 3Blue1Brown (1.5% engagement on huge views) loses points
      it shouldn't. **Normalise engagement to channel-size-appropriate
      bands**: massive channels naturally have lower engagement.
      Use bands: 100k–1M subs: 3% = good. 1M–10M: 1.5%. 10M+: 0.8%.
- [ ] **C2** Consistency component punishes any view variance. Real
      channels have viral spikes. Switch from CoV (stdev/mean) to
      **MAD/median** which ignores spikes. Or use IQR/median.
- [ ] **C3** Cadence is being computed on top-50-by-views, not full
      channel history. Fix by adding a "last 50 videos chronologically"
      field to the fetch, or detect mixed ordering and warn.

## Frontend follow-on

- [ ] **F1** Render each `interpretations.*` field as the chart subtitle
      instead of generic captions
- [ ] **F2** Add a "key insights" summary panel at the top of the
      advanced-analytics block — 3–5 bullets, plain language
- [ ] **F3** Tone down ranking labels: "Top of channel" not "Score 98.6"
