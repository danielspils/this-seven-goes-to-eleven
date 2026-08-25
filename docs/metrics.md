---
layout: default
permalink: /metrics/
title: Metrics
sitemap: false
robots: noindex, nofollow
description: Usage and download figures for This Seven Goes to Eleven.
---

# Metrics

<p class="muted" id="m-asof">Reading the latest figures…</p>

<div class="stats" id="m-stats"></div>

<h2 id="m-chart-title">Cumulative downloads over time</h2>
<p class="muted m-sub" id="m-chart-sub">GitHub's own counters · the running total to date</p>

<div class="m-ctl" id="m-range">
  <button data-r="all" class="on">All time</button>
  <button data-r="30">Last 30 days</button>
  <button data-r="7">Last 7 days</button>
</div>

<div class="m-legend" id="m-legend"></div>
<div class="m-chart"><canvas id="m-curve" role="img" aria-label="Downloads over time, Mac and PC."></canvas></div>

<h2>Where it's being used</h2>
<p class="muted m-sub" id="m-country-sub">Check-ins by country</p>
<div class="m-chart" id="m-country-wrap"><canvas id="m-country" role="img" aria-label="Check-ins by country, ranked."></canvas></div>

<h2>Every asset</h2>

<div id="m-assets"><p class="muted">—</p></div>

<h2>How this is counted</h2>

<ul class="m-note" id="m-meaning"></ul>

<p class="muted">Three different things are counted here and <strong>none of them
should ever be added to another</strong>. A download is a completed transfer and
has no geography. An update is the macOS updater fetching a zip, which is a
machine, not a person. A check-in is one install opening the app on one day —
so an install that gets opened every day for a week is seven check-ins, and two
installs behind one router are two. It measures where the app is being used, not
how many people use it.</p>

<h2>Site visits</h2>

<p class="muted">Counted by <a href="https://{{ site.goatcounter }}.goatcounter.com">GoatCounter</a>
(no cookies, nothing to consent to) and read there rather than repeated here.
Page views and downloads are never added together: a visit and a completed
download are different facts.</p>

<p class="muted">Download <em>button presses</em> are counted there too, as
events under <code>download/mac/&lt;version&gt;</code> and
<code>download/pc/&lt;version&gt;</code> — that is the intent to install, and
GoatCounter's own country reading comes with it. It is a fourth figure and not a
substitute for any of the others: a press that never finishes is not a download,
and an install from a link that never touched this site is a download with no
press behind it.</p>

<style>
/* This page borrows its STRUCTURE from jx-3p.com/metrics and none of its
   colours. The two sites share no CSS, and a cream Roland panel dropped onto
   this white one would read as somebody else's page. */
.m-sub { margin-top: -.9rem; font-size: .9rem; }
.m-ctl { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0 0 .9rem; }
.m-ctl button {
  font: inherit; font-size: .85rem; padding: .3rem .75rem; cursor: pointer;
  border: 1px solid var(--line); background: var(--bg); color: var(--text);
  border-radius: 6px;
}
/* The selected range and the tiles it governs share one colour, so the tie
   between "Last 7 days" and the number above it never has to be explained. */
.m-ctl button.on { background: var(--m-scope, #c8862a); border-color: var(--m-scope, #c8862a); color: #fff; }
.m-legend { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0 0 .6rem; font-size: .82rem; color: var(--muted); }
.m-legend span[data-di] { display: flex; align-items: center; gap: .35rem; cursor: pointer; }
.m-legend span[data-di]:hover { color: var(--text); text-decoration: underline; }
.m-legend i { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
.m-chart { position: relative; width: 100%; height: 300px; margin: 0 0 2rem; }
/* Tiles that drive the chart are buttons in everything but name. */
.stat[data-mode] { cursor: pointer; }
.stat.m-on { box-shadow: inset 0 -3px 0 rgba(0,0,0,.22); }
.stat.m-scoped { background: var(--m-scope, #c8862a); border-color: var(--m-scope, #c8862a); }
.stat.m-scoped .lbl { color: rgba(255,255,255,.8); }
.stat.m-scoped .val { color: #fff; }
.stat-hero { grid-column: span 2; flex-direction: row; gap: 2rem; }
@media (max-width: 30rem) { .stat-hero { grid-column: 1 / -1; } }
.m-note { color: var(--muted); font-size: .92rem; }
.m-note b { color: var(--text); }
.m-dead { color: var(--felt); }
</style>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
// The downloads half comes from docs/metrics/data.json, rebuilt daily by the
// Download report workflow whether or not there were downloads — so this page
// is current on quiet days too.
//
// The ACTIVE half is read LIVE from the relay, which is what its CORS headers
// exist for. data.json carries a copy taken at build time, and that copy is the
// fallback: a relay that cannot be reached leaves yesterday's figure on screen
// with its date, rather than a zero that reads as "nobody opened the app".
// WHICH ONE IS SHOWING IS ALWAYS STATED — a live number and a day-old number
// look identical, and only one of them answers "who is using this right now".
(function () {
  const RELAY = 'https://ping.thissevengoestoeleven.com';
  const el = (id) => document.getElementById(id);
  const NAMES = {US:'United States',GB:'Great Britain',DE:'Germany',JP:'Japan',CA:'Canada',AU:'Australia',FR:'France',NL:'Netherlands',SE:'Sweden',IT:'Italy',ES:'Spain',BR:'Brazil',MX:'Mexico',PL:'Poland',NO:'Norway',DK:'Denmark',FI:'Finland',BE:'Belgium',CH:'Switzerland',AT:'Austria',IE:'Ireland',NZ:'New Zealand',RU:'Russia',UA:'Ukraine',CZ:'Czechia',PT:'Portugal',GR:'Greece',TR:'Turkey',IN:'India',CN:'China',KR:'South Korea',TW:'Taiwan',AR:'Argentina',CL:'Chile',CO:'Colombia',ZA:'South Africa',IL:'Israel',SG:'Singapore',HK:'Hong Kong',HU:'Hungary',RO:'Romania',TH:'Thailand',ID:'Indonesia',PH:'Philippines',VN:'Vietnam',MY:'Malaysia',EE:'Estonia',LT:'Lithuania',LV:'Latvia',SK:'Slovakia',SI:'Slovenia',HR:'Croatia',RS:'Serbia',BG:'Bulgaria',IS:'Iceland',LU:'Luxembourg',XX:'Unknown'};

  // The site's own Mac/PC pair, lifted from the download buttons rather than
  // chosen again here — the colours on this chart are the colours of the
  // buttons the downloads came from.
  const MAC = '#4caf6d', PC = '#5b8fd9', UPD = '#8d8d97', FELT = '#b8362b';
  const INK = '#5f5f68', GRID = 'rgba(27,27,31,.14)';

  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  // The relay stamps its day keys in UTC, so "today" has to be asked in UTC
  // too. Asking locally would read the wrong bucket for anybody west of
  // Greenwich for the first hours of their evening.
  const utcKey = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const keyToIso = (k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;

  let D = null, active = null, activeLive = false, curve = null, country = null;
  let mode = 'downloads', preset = 'all';

  fetch('{{ "/metrics/data.json" | relative_url }}?cb=' + Date.now())
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => {
      D = d;
      active = d.active || { reachable: false, byCountry: {}, window: { byDay: {}, byVersion: {} } };
      return refreshActive();
    })
    .then(() => { paint(); })
    .catch(() => {
      el('m-asof').textContent = 'Could not read the figures just now. They are rebuilt daily.';
      el('m-asof').classList.add('m-dead');
    });

  // Live active installs, best-effort. Two calls because they answer different
  // questions: /totals is the permanent monthly rollup (where, ever) and
  // /ping/stats is the 90-day window (which version, which day).
  function refreshActive() {
    const since = utcKey(new Date(Date.now() - 90 * 86400000));
    return Promise.all([
      fetch(`${RELAY}/totals`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${RELAY}/ping/stats?since=${since}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([t, p]) => {
      if (!t || !t.ok || !p || !p.ok) return;
      activeLive = true;
      active = {
        reachable: true,
        total: t.active.total, byMonth: t.active.byMonth, byCountry: t.active.byCountry,
        window: { reachable: true, days: 90, total: p.total, byDay: p.byDay, byVersion: p.byVersion, byPlatform: p.byPlatform },
      };
    });
  }

  function paint() {
    const gen = D.generated ? new Date(D.generated) : null;
    const when = gen ? gen.toLocaleString() : 'the last build';
    const activeWord = !active.reachable
      ? 'The relay could not be read, so check-ins are missing rather than zero.'
      : activeLive
        ? 'Check-ins are live from the relay.'
        : 'The relay could not be reached just now, so check-ins are from that same build.';
    el('m-asof').textContent = `GitHub's own counters as of ${when}, rebuilt daily. ${activeWord}`;
    el('m-asof').classList.toggle('m-dead', !active.reachable);

    // The meanings travel INSIDE data.json so the file explains itself to
    // anybody who opens it directly; the page renders them rather than keeping
    // a second copy that could drift.
    const M = D.meaning || {};
    el('m-meaning').innerHTML = [
      ['Downloads', M.downloads], ['Updates', M.updates], ['Check-ins', M.active],
    ].filter(([, v]) => v).map(([k, v]) => `<li><b>${k}</b> — ${v}</li>`).join('');

    renderCountries();
    renderAssets();
    render();
  }

  // ── The tiles ─────────────────────────────────────────────────────────
  function renderTiles(dMac, dPc) {
    const windowed = dMac !== null;
    const mac = windowed ? dMac : D.downloads.mac;
    const pc = windowed ? dPc : D.downloads.pc;
    const sc = windowed ? ' m-scoped' : '';
    const on = (m) => (mode === m ? ' m-on' : '');

    const versions = active.window && active.window.byVersion ? Object.keys(active.window.byVersion).length : 0;
    const countries = active.byCountry ? Object.keys(active.byCountry).length : 0;
    // A relay we could not read must not render as 0. Nothing on this page is
    // allowed to state a number it did not get.
    const q = (n) => (active.reachable ? n : '—');
    // "TODAY" IS ONLY ANSWERABLE LIVE. data.json's copy was taken when the
    // workflow last ran, so after midnight UTC it holds no key for today and
    // the lookup returns 0 — a file built yesterday stating that nobody has
    // opened the app today. Measured on the fallback path, 2026-08-25.
    // Without a live read the honest answer is that there isn't one.
    const today = activeLive
      ? ((active.window && active.window.byDay && active.window.byDay[utcKey(new Date())]) || 0)
      : null;

    el('m-stats').innerHTML =
      `<div class="stat stat-hero${sc}${on('downloads')}" data-mode="downloads">` +
        `<div><div class="lbl">Downloads</div><div class="val">${mac + pc}</div></div>` +
        `<div><div class="lbl">Mac / PC</div><div class="val">${mac} / ${pc}</div></div>` +
      `</div>` +
      [
        ['Releases', D.releases ?? '—', '', ''],
        ['Active today', today === null ? '—' : q(today), on('active'), ' data-mode="active"'],
        ['Versions running', q(versions), on('versions'), ' data-mode="versions"'],
        ['Countries', q(countries), '', ''],
      ].map(([l, v, c, m]) => `<div class="stat${c}"${m}><div class="lbl">${l}</div><div class="val">${v}</div></div>`).join('');
  }

  const baseOpts = (stacked, beginAtZero) => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      y: { stacked, beginAtZero, grid: { color: GRID, z: 1 }, ticks: { color: INK, precision: 0 } },
      x: { stacked, grid: { display: false }, ticks: { color: INK, maxRotation: 0, autoSkip: true } },
    },
  });
  const swatches = (rows) => {
    el('m-legend').innerHTML = rows.map(([c, n, di]) => `<span data-di="${di}"><i style="background:${c}"></i>${n}</span>`).join('');
  };

  function render() {
    const SCOPE = { all: '#c8862a', 30: FELT, 7: '#4caf6d' };
    document.documentElement.style.setProperty('--m-scope', SCOPE[preset] || '#c8862a');
    // The range control governs the DOWNLOAD series and nothing else. Check-ins
    // and versions come from the relay's own 90-day retention and cannot be
    // re-cut here — so rather than leave buttons that silently do nothing, the
    // control is hidden and the sub-line states the window those charts cover.
    el('m-range').style.display = mode === 'downloads' ? '' : 'none';
    if (curve) { curve.destroy(); curve = null; }

    if (mode === 'active') return renderActive();
    if (mode === 'versions') return renderVersions();
    return renderDownloads();
  }

  function renderDownloads() {
    let s = D.downloads.series || [], base = null, cutoff = null;
    if (preset !== 'all' && s.length) {
      const last = s[s.length - 1].date;
      const [y, m, d] = last.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - Number(preset));
      cutoff = dt.toISOString().slice(0, 10);
      const before = s.filter((p) => p.date < cutoff);
      // The last point BEFORE the window is the baseline, so day one's own
      // additions are counted. Nothing before it → the window covers the lot.
      base = before.length ? before[before.length - 1] : { mac: 0, pc: 0 };
      s = s.filter((p) => p.date >= cutoff);
    }

    let dMac = null, dPc = null;
    if (base && s.length) {
      const last = s[s.length - 1];
      dMac = last.mac - base.mac; dPc = last.pc - base.pc;
    }
    renderTiles(dMac, dPc);

    if (!s.length) {
      el('m-chart-title').textContent = 'Downloads over time';
      el('m-chart-sub').textContent = 'No history yet.';
      swatches([]);
      return;
    }

    // A windowed view plots NEW downloads per day. A cumulative curve cropped
    // to seven days is just a zoomed-in All time, and it contradicts the tile
    // above it — "Downloads 9" over a line running 26 to 35.
    if (base) {
      let prev = base;
      const perMac = [], perPc = [];
      for (const p of s) { perMac.push(p.mac - prev.mac); perPc.push(p.pc - prev.pc); prev = p; }
      el('m-chart-title').textContent = 'New downloads over time';
      el('m-chart-sub').textContent = "GitHub's own counters · new each day in this window";
      swatches([[MAC, 'Mac', 1], [PC, 'PC', 0]]);
      curve = new Chart(el('m-curve'), {
        type: 'bar',
        data: { labels: s.map((p) => fmtDate(p.date)), datasets: [
          { label: 'PC', data: perPc, backgroundColor: PC, borderColor: PC, borderWidth: 1 },
          { label: 'Mac', data: perMac, backgroundColor: MAC, borderColor: MAC, borderWidth: 1 },
        ] },
        // Tooltip rows mirror the visual stack: Mac on top, PC beneath.
        options: { ...baseOpts(true, true), plugins: { legend: { display: false }, tooltip: { itemSort: (a, b) => b.datasetIndex - a.datasetIndex } } },
      });
      return;
    }

    el('m-chart-title').textContent = 'Cumulative downloads over time';
    el('m-chart-sub').textContent = "GitHub's own counters · the running total to date";
    swatches([[MAC, 'Mac', 1], [PC, 'PC', 0], [UPD, 'Updater', 2]]);
    curve = new Chart(el('m-curve'), {
      type: 'line',
      data: { labels: s.map((p) => fmtDate(p.date)), datasets: [
        { label: 'PC', data: s.map((p) => p.pc), borderColor: PC, backgroundColor: 'rgba(91,143,217,.75)', fill: true, tension: .25, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Mac', data: s.map((p) => p.mac), borderColor: MAC, backgroundColor: 'rgba(76,175,109,.75)', fill: true, tension: .25, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 5 },
        // The updater rides as a plain line, never stacked into the total: it
        // is a machine fetching a zip, and adding it to downloads would let one
        // laptop polling for updates inflate "downloads" forever.
        { label: 'Updater', data: s.map((p) => p.upd), borderColor: UPD, backgroundColor: UPD, fill: false, tension: .25, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, pointHoverRadius: 5 },
      ] },
      options: { ...baseOpts(false, true), plugins: { legend: { display: false }, tooltip: { itemSort: (a, b) => b.datasetIndex - a.datasetIndex } } },
    });
  }

  function renderActive() {
    renderTiles(null, null);
    const byDay = (active.window && active.window.byDay) || {};
    const keys = Object.keys(byDay).sort();
    el('m-chart-title').textContent = 'Active installs by day';
    el('m-chart-sub').textContent = !active.reachable
      ? 'The relay could not be read.'
      : activeLive
        ? 'One check-in per install per day · the relay keeps 90 days'
        : 'One check-in per install per day · as of the last build, not live';
    if (!keys.length) { swatches([]); return; }
    // Gaps are real zeros — a day nobody opened the app has no key at all —
    // so the axis is filled in rather than drawn from the keys that exist,
    // which would silently close the gaps and flatter a quiet week.
    const first = Date.parse(keyToIso(keys[0]));
    const last = Date.parse(keyToIso(keys[keys.length - 1]));
    const days = [];
    for (let t = first; t <= last; t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
    swatches([[FELT, 'Check-ins', 0]]);
    curve = new Chart(el('m-curve'), {
      type: 'bar',
      data: { labels: days.map(fmtDate), datasets: [{ label: 'Check-ins', data: days.map((iso) => byDay[iso.replace(/-/g, '')] || 0), backgroundColor: FELT, borderColor: FELT, borderWidth: 1 }] },
      options: baseOpts(false, true),
    });
  }

  function renderVersions() {
    renderTiles(null, null);
    const byVer = (active.window && active.window.byVersion) || {};
    // Newest first, compared as numbers so 1.5.10 sorts above 1.5.9.
    const cmp = (a, b) => { const A = a.split('.').map(Number), B = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return B[i] - A[i]; return 0; };
    const rows = Object.keys(byVer).sort(cmp);
    el('m-chart-title').textContent = 'Which version people are running';
    el('m-chart-sub').textContent = active.reachable
      ? 'Check-ins over the last 90 days · newest at the top'
      : 'The relay could not be read.';
    if (!rows.length) { swatches([]); return; }
    swatches([[PC, 'Check-ins', 0]]);
    curve = new Chart(el('m-curve'), {
      type: 'bar',
      data: { labels: rows, datasets: [{ data: rows.map((v) => byVer[v]), backgroundColor: PC, borderColor: PC, borderWidth: 1, borderRadius: 4, barThickness: 20 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: { color: GRID, z: 1 }, ticks: { color: INK, precision: 0 } }, y: { grid: { display: false }, ticks: { color: INK } } } },
    });
  }

  function renderCountries() {
    const by = active.byCountry || {};
    const cc = Object.entries(by).sort((a, b) => b[1] - a[1]);
    el('m-country-sub').textContent = !active.reachable
      ? 'The relay could not be read, so this is missing rather than empty.'
      : cc.length
        ? 'Check-ins by country, all time · somebody who opens the app daily counts once a day, so this shows where it is used rather than how many own it'
        : 'No check-ins recorded yet.';
    if (!cc.length) { el('m-country-wrap').style.display = 'none'; return; }
    el('m-country-wrap').style.display = '';
    el('m-country-wrap').style.height = Math.max(140, cc.length * 38 + 60) + 'px';
    if (country) country.destroy();
    country = new Chart(el('m-country'), {
      type: 'bar',
      data: { labels: cc.map((c) => NAMES[c[0]] || c[0]), datasets: [{ data: cc.map((c) => c[1]), backgroundColor: FELT, borderColor: FELT, borderWidth: 1, borderRadius: 4, barThickness: 20 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: { color: GRID, z: 1 }, ticks: { color: INK, precision: 0 } }, y: { grid: { display: false }, ticks: { color: INK } } } },
    });
  }

  function renderAssets() {
    const assets = (D.assets || []).slice().sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const rows = assets.map((a) => `<tr><td>${a.name}</td><td>${a.tag}</td><td class="num">${a.count}</td></tr>`).join('');
    el('m-assets').innerHTML = rows
      ? `<table class="m-table"><thead><tr><th>Asset</th><th>Release</th><th class="num">Downloads</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="muted">No releases yet.</p>';
  }

  // ── Interaction ───────────────────────────────────────────────────────
  el('m-range').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    el('m-range').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); preset = b.dataset.r; render();
  });
  el('m-stats').addEventListener('click', (e) => {
    const t = e.target.closest('.stat[data-mode]'); if (!t) return;
    mode = t.dataset.mode;
    // Leaving the downloads chart drops the window with it, so returning to
    // Downloads never lands on a filter the chart above is not honouring.
    if (mode !== 'downloads') { preset = 'all'; el('m-range').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.r === 'all')); }
    render();
  });

  // Hovering a legend entry keeps that line in full colour and fades the rest
  // to grey, so telling two datasets apart never depends on colour alone.
  const spot = (di) => {
    if (!curve) return;
    curve.data.datasets.forEach((ds, i) => {
      if (ds._c === undefined) { ds._c = ds.borderColor; ds._bg = ds.backgroundColor; ds._w = ds.borderWidth; }
      const dim = 'rgba(120,116,108,.18)';
      ds.borderColor = (di === null || i === di) ? ds._c : dim;
      ds.backgroundColor = (di === null || i === di) ? ds._bg : dim;
      ds.borderWidth = (i === di) ? 3.5 : ds._w;
    });
    curve.update('none');
  };
  el('m-legend').addEventListener('mouseover', (e) => { const s = e.target.closest('span[data-di]'); if (s) spot(Number(s.dataset.di)); });
  el('m-legend').addEventListener('mouseout', (e) => { const s = e.target.closest('span[data-di]'); if (s) spot(null); });
})();
</script>
