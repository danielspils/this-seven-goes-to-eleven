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

<h2>Where it's running</h2>
<p class="m-pop">Installs running 1.5.3 or later that opened the app and haven't opted out. Older versions don't report, so this grows as people update.</p>
<p class="m-big"><span id="m-active">—</span> <span class="m-big-unit" id="m-active-unit">check-ins</span></p>
<div class="m-ctl m-ctl-run" id="m-window">
  <button data-w="1" class="on">Today</button>
  <button data-w="7">7 days</button>
  <button data-w="30">30 days</button>
  <button data-w="all">All time</button>
</div>
<p class="muted m-sub" id="m-active-sub">Reading the relay…</p>
<div id="m-countries"></div>

<h2>All downloads</h2>
<p class="m-pop">Every copy that left GitHub, from any route — this site, the releases page, a direct link. Installers only; the updater's own feed files are excluded.</p>
<p class="m-big"><span id="m-dl">—</span> <span class="m-big-unit" id="m-dl-split"></span></p>
<div class="m-ctl" id="m-range">
  <button data-r="all" class="on">All time</button>
  <button data-r="30">Last 30 days</button>
  <button data-r="7">Last 7 days</button>
</div>
<div class="m-legend" id="m-legend"></div>
<div class="m-chart"><canvas id="m-curve" role="img" aria-label="Downloads over time, Mac and Windows."></canvas></div>

<h2>Started from the website</h2>
<p class="m-pop">Download button presses on this site. Includes presses that never finished downloading, and people who never installed.</p>
<p class="m-big"><span id="m-press">—</span> <span class="m-big-unit">button presses</span></p>
<p class="muted m-sub" id="m-press-sub">By country</p>
<div class="m-chart" id="m-press-wrap"><canvas id="m-press-chart" role="img" aria-label="Download button presses by country, ranked."></canvas></div>

<h2>Which version people are on</h2>
<p class="m-pop">Installers downloaded per release. Newest first.</p>
<div id="m-versions"><p class="muted">—</p></div>

<h2>Site visits</h2>

<p class="muted">Counted by <a href="https://{{ site.goatcounter }}.goatcounter.com">GoatCounter</a>
(no cookies, nothing to consent to) and read there rather than repeated here.
Page views and downloads are never added together: a visit and a completed
download are different facts.</p>

<h2>How this is counted</h2>

<p class="muted">Four different things are counted here and <strong>none of them
should ever be added to another</strong>.</p>

<ul class="m-note">
  <li><b>Where it's running</b> — one check-in per install per day, sent by the app itself. No identifier, so two installs behind one router count as two, and an install opened five times in a day counts once. Over a longer window it counts once <i>per day</i>, which is why the figure is labelled check-ins and not installs. It measures where the app is being used, not how many people own it. <b>The windows are calendar days in UTC, not the last N hours</b> — the relay stores a count per day and nothing finer, so "Today" means since midnight UTC and an evening session on the US west coast lands on the next day's count.</li>
  <li><b>All downloads</b> — GitHub's own counter for the installer files. A completed transfer, with no geography attached. The updater's feed files and blockmaps are machine traffic and are left out.</li>
  <li><b>Started from the website</b> — button presses here, counted the moment this site sends the browser to the file. Always larger than the downloads that came through this site, because a press is not a finished transfer.</li>
  <li><b>Site visits</b> — page views in GoatCounter, which is a different question again.</li>
</ul>

<p class="muted">The first is every download. The second is the ones that came
through this site.</p>

<style>
/* This page borrows its STRUCTURE from jx-3p.com/metrics and none of its
   colours. The two sites share no CSS, and a cream Roland panel dropped onto
   this white one would read as somebody else's page. */
.m-sub { margin-top: -.4rem; font-size: .9rem; }
/* EACH SECTION LEADS WITH ONE NUMBER. The old page opened with a grid of five
   tiles of equal weight, which made "Releases: 10" look as important as how
   many people are running the app. */
.m-big { font-size: 2.6rem; font-weight: 600; line-height: 1.1; margin: .2rem 0 .6rem; }
.m-big-unit { font-size: .95rem; font-weight: 400; color: var(--muted); }
/* WHAT POPULATION A SECTION COUNTS, directly under its heading. Two country
   tables from two sources sit on this page and they disagree — a handful of
   check-ins against dozens of presses — because they observe different people.
   Unlabelled they read as a contradiction, and the small one reads as low
   adoption rather than a young measurement. */
.m-pop { color: var(--text); font-size: .92rem; margin: -.4rem 0 .3rem; }
.m-ctl { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0 0 .9rem; }
.m-ctl button {
  font: inherit; font-size: .85rem; padding: .3rem .75rem; cursor: pointer;
  border: 1px solid var(--line); background: var(--bg); color: var(--text);
  border-radius: 6px;
}
.m-ctl button.on { background: var(--m-scope, #c8862a); border-color: var(--m-scope, #c8862a); color: #fff; }
/* The downloads controls recolour themselves per range through --m-scope, a
   variable set on :root. The ping controls are a DIFFERENT section reading a
   different source, so they take a fixed colour rather than inheriting a
   scope that belongs to the section below them. */
.m-ctl-run button.on { background: #b8362b; border-color: #b8362b; }
.m-legend { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0 0 .6rem; font-size: .82rem; color: var(--muted); }
.m-legend span[data-di] { display: flex; align-items: center; gap: .35rem; cursor: pointer; }
.m-legend span[data-di]:hover { color: var(--text); text-decoration: underline; }
.m-legend i { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
.m-chart { position: relative; width: 100%; height: 300px; margin: 0 0 2rem; }
.m-note { color: var(--muted); font-size: .92rem; }
.m-note b { color: var(--text); }
.m-dead { color: var(--felt); }
</style>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
// FOUR SOURCES, FOUR SECTIONS, IN THE SAME ORDER AS jx-3p.com/metrics — the two
// pages are meant to be readable as one thing by one person.
//
// The downloads half comes from docs/metrics/data.json, rebuilt daily whether
// or not there were downloads, so this page is current on quiet days too. The
// ping and press halves are read LIVE from the relay, which is what its CORS
// headers exist for. WHICH ONE IS SHOWING IS ALWAYS STATED: a live number and
// a day-old number look identical, and only one answers "right now".
(function () {
  const RELAY = 'https://ping.thissevengoestoeleven.com';
  const el = (id) => document.getElementById(id);
  const NAMES = {US:'United States',GB:'Great Britain',DE:'Germany',JP:'Japan',CA:'Canada',AU:'Australia',FR:'France',NL:'Netherlands',SE:'Sweden',IT:'Italy',ES:'Spain',BR:'Brazil',MX:'Mexico',PL:'Poland',NO:'Norway',DK:'Denmark',FI:'Finland',BE:'Belgium',CH:'Switzerland',AT:'Austria',IE:'Ireland',NZ:'New Zealand',RU:'Russia',UA:'Ukraine',CZ:'Czechia',PT:'Portugal',GR:'Greece',TR:'Turkey',IN:'India',CN:'China',KR:'South Korea',TW:'Taiwan',AR:'Argentina',CL:'Chile',CO:'Colombia',ZA:'South Africa',IL:'Israel',SG:'Singapore',HK:'Hong Kong',HU:'Hungary',RO:'Romania',TH:'Thailand',ID:'Indonesia',PH:'Philippines',VN:'Vietnam',MY:'Malaysia',EE:'Estonia',LT:'Lithuania',LV:'Latvia',SK:'Slovakia',SI:'Slovenia',HR:'Croatia',RS:'Serbia',BG:'Bulgaria',IS:'Iceland',LU:'Luxembourg',XX:'Unknown'};

  // The site's own Mac/PC pair, lifted from the download buttons rather than
  // chosen again here.
  const MAC = '#4caf6d', PC = '#5b8fd9', UPD = '#8d8d97', FELT = '#b8362b';
  const INK = '#5f5f68', GRID = 'rgba(27,27,31,.14)';

  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  // The relay stamps its day keys in UTC, so "today" is asked in UTC too.
  const utcKey = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

  let D = null, activeLive = false, presses = null;
  let curve = null, pressChart = null, preset = 'all';
  // One entry per window button. null means "not read", which renders as an
  // em dash and a sentence saying so — never as 0.
  let runWin = '1';
  const runData = { 1: null, 7: null, 30: null, all: null };

  const opts = (stacked, zero) => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      y: { stacked, beginAtZero: zero, grid: { color: GRID, z: 1 }, ticks: { color: INK, precision: 0 } },
      x: { stacked, grid: { display: false }, ticks: { color: INK, maxRotation: 0, autoSkip: true } },
    },
  });
  const swatches = (rows) => {
    el('m-legend').innerHTML = rows.map(([c, n, di]) => `<span data-di="${di}"><i style="background:${c}"></i>${n}</span>`).join('');
  };
  const bar = (id, cc, colour) => new Chart(el(id), {
    type: 'bar',
    data: { labels: cc.map((c) => NAMES[c[0]] || c[0]), datasets: [{ data: cc.map((c) => c[1]), backgroundColor: colour, borderColor: colour, borderWidth: 1, borderRadius: 4, barThickness: 20 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, grid: { color: GRID, z: 1 }, ticks: { color: INK, precision: 0 } }, y: { grid: { display: false }, ticks: { color: INK } } } },
  });

  // ── 1. WHERE IT'S RUNNING — the daily ping ──────────────────────────
  //
  // THE NOUN IS "CHECK-INS", NOT "INSTALLS", and the distinction is the whole
  // reason the unit is printed beside the number. The app checks in once per
  // install per day, so over ONE day the two are the same figure — but over
  // seven, an install opened on five of them contributes five. A headline
  // saying "installs" would then overstate by however loyal the users are,
  // which is the direction that flatters the author.
  //
  // WINDOWS ARE UTC CALENDAR DAYS, NOT ROLLING HOURS. The relay's finest
  // stored resolution is a day — `pg:<YYYYMMDD>:…` — so "the last 24 hours"
  // is not a question this data can answer, and a button promising it would
  // be a label the numbers cannot honour. The shortest window is therefore
  // called "Today" and means since midnight UTC. Its cost is real and is
  // stated under "How this is counted": an evening session on the US west
  // coast is already tomorrow in UTC and lands on the next day's count.
  const WIN_UNIT = {
    1: 'check-ins today', 7: 'check-ins · last 7 days',
    30: 'check-ins · last 30 days', all: 'check-ins · all time',
  };
  function renderRunning() {
    const src = runData[runWin];
    el('m-active-unit').textContent = WIN_UNIT[runWin];
    el('m-active').textContent = src ? src.total : '—';

    const cc = Object.entries((src && src.byCountry) || {}).sort((a, b) => b[1] - a[1]);
    const many = runWin !== '1';
    el('m-active-sub').textContent = !src
      ? 'The relay could not be read, so this is missing rather than empty.'
      : cc.length
        ? `${cc.length} ${cc.length === 1 ? 'country' : 'countries'}`
          + (many ? ' · an install that opened on five days counts five times' : '')
        : 'No check-ins in this window.';

    // A LIST, NOT A BAR CHART. Page rule: nothing gets a chart below five
    // categories. One bar is a chart of nothing, and it spent its life here
    // rendering a single red stripe labelled "United States" — which reads as
    // a broken chart rather than as the finding that there is one country.
    el('m-countries').innerHTML = cc.length
      ? '<table class="m-table"><thead><tr><th>Country</th><th class="num">Check-ins</th>'
        + '</tr></thead><tbody>'
        + cc.map(([c, n]) => `<tr><td>${NAMES[c] || c}</td><td class="num">${n}</td></tr>`).join('')
        + '</tbody></table>'
      : '';
  }

  // ── 2. ALL DOWNLOADS — GitHub, installers only ──────────────────────
  function renderDownloads() {
    const d = D.downloads || { mac: 0, pc: 0, series: [] };
    let s = d.series || [], base = null;
    if (preset !== 'all' && s.length) {
      const last = s[s.length - 1].date;
      const [y, m, dd] = last.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, dd));
      dt.setUTCDate(dt.getUTCDate() - Number(preset));
      const cutoff = dt.toISOString().slice(0, 10);
      const before = s.filter((p) => p.date < cutoff);
      base = before.length ? before[before.length - 1] : { mac: 0, pc: 0 };
      s = s.filter((p) => p.date >= cutoff);
    }
    const mac = base && s.length ? s[s.length - 1].mac - base.mac : d.mac;
    const pc = base && s.length ? s[s.length - 1].pc - base.pc : d.pc;
    el('m-dl').textContent = mac + pc;
    el('m-dl-split').textContent = `installers  ·  ${mac} Mac / ${pc} Windows`;

    const SCOPE = { all: '#c8862a', 30: FELT, 7: '#4caf6d' };
    document.documentElement.style.setProperty('--m-scope', SCOPE[preset] || '#c8862a');
    if (curve) curve.destroy();
    if (!s.length) { swatches([]); return; }

    // A windowed view plots NEW downloads per day. A cumulative curve cropped
    // to seven days is a zoomed-in All time, and it contradicts the number
    // above it.
    if (base) {
      let prev = base; const perMac = [], perPc = [];
      for (const p of s) { perMac.push(p.mac - prev.mac); perPc.push(p.pc - prev.pc); prev = p; }
      swatches([[MAC, 'Mac', 1], [PC, 'Windows', 0]]);
      curve = new Chart(el('m-curve'), {
        type: 'bar',
        data: { labels: s.map((p) => fmtDate(p.date)), datasets: [
          { label: 'Windows', data: perPc, backgroundColor: PC, borderColor: PC, borderWidth: 1 },
          { label: 'Mac', data: perMac, backgroundColor: MAC, borderColor: MAC, borderWidth: 1 }] },
        options: { ...opts(true, true), plugins: { legend: { display: false }, tooltip: { itemSort: (a, b) => b.datasetIndex - a.datasetIndex } } },
      });
      return;
    }
    swatches([[MAC, 'Mac', 1], [PC, 'Windows', 0], [UPD, 'Updater', 2]]);
    curve = new Chart(el('m-curve'), {
      type: 'line',
      data: { labels: s.map((p) => fmtDate(p.date)), datasets: [
        { label: 'Windows', data: s.map((p) => p.pc), borderColor: PC, backgroundColor: 'rgba(91,143,217,.75)', fill: true, tension: .25, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Mac', data: s.map((p) => p.mac), borderColor: MAC, backgroundColor: 'rgba(76,175,109,.75)', fill: true, tension: .25, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 5 },
        // The updater rides as a dashed line and is NEVER stacked into the
        // total: it is a machine fetching a zip, and adding it would let one
        // laptop polling for updates inflate "downloads" forever.
        { label: 'Updater', data: s.map((p) => p.upd), borderColor: UPD, backgroundColor: UPD, fill: false, tension: .25, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, pointHoverRadius: 5 }] },
      options: { ...opts(false, true), plugins: { legend: { display: false }, tooltip: { itemSort: (a, b) => b.datasetIndex - a.datasetIndex } } },
    });
  }

  // ── 3. STARTED FROM THE WEBSITE — the relay ─────────────────────────
  function renderPresses() {
    el('m-press').textContent = presses ? presses.total : '—';
    const cc = Object.entries((presses && presses.byCountry) || {}).sort((a, b) => b[1] - a[1]);
    el('m-press-sub').textContent = !presses
      ? 'The relay could not be read, so this is missing rather than empty.'
      : cc.length ? `By country · ${cc.length} ${cc.length === 1 ? 'country' : 'countries'}`
        : 'No button presses recorded yet.';
    if (!cc.length) { el('m-press-wrap').style.display = 'none'; return; }
    el('m-press-wrap').style.display = '';
    el('m-press-wrap').style.height = Math.max(140, cc.length * 38 + 60) + 'px';
    if (pressChart) pressChart.destroy();
    pressChart = bar('m-press-chart', cc, PC);
  }

  // ── 4. WHICH VERSION PEOPLE ARE ON ──────────────────────────────────
  //
  // REPLACES the old "Every asset" table, which sorted every release asset by
  // download count — so latest.yml and latest-mac.yml, the updater's own feed
  // files, sat at the top with 144 fetches between them. Machine traffic
  // presented as the most popular downloads. Installers only here, grouped by
  // release rather than by file, because "which version are people on" is the
  // question that table looked like it was answering and never was.
  function renderVersions() {
    const rows = {};
    for (const a of D.assets || []) {
      const isMac = /\.dmg$/.test(a.name);
      const isWin = /\.exe$/.test(a.name);
      if (!isMac && !isWin) continue;               // installers only
      const tag = (a.tag || '').replace(/^v/, '');
      rows[tag] = rows[tag] || { mac: 0, win: 0 };
      rows[tag][isMac ? 'mac' : 'win'] += a.count || 0;
    }
    const cmp = (a, b) => {
      const A = a.split('.').map(Number), B = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if ((A[i] || 0) !== (B[i] || 0)) return (B[i] || 0) - (A[i] || 0);
      return 0;
    };
    const list = Object.keys(rows).sort(cmp);
    el('m-versions').innerHTML = list.length
      ? '<table class="m-table"><thead><tr><th>Version</th><th class="num">Mac</th>'
        + '<th class="num">Windows</th><th class="num">Total</th></tr></thead><tbody>'
        + list.map((v) => `<tr><td>${v}</td><td class="num">${rows[v].mac}</td>`
          + `<td class="num">${rows[v].win}</td><td class="num">${rows[v].mac + rows[v].win}</td></tr>`).join('')
        + '</tbody></table>'
      : '<p class="muted">No releases yet.</p>';
  }

  function paint() {
    const gen = D.generated ? new Date(D.generated) : null;
    const when = gen ? gen.toLocaleString() : 'the last build';
    el('m-asof').textContent =
      `GitHub's own counters as of ${when}, rebuilt daily. `
      + (activeLive ? 'Check-ins and button presses are live from the relay.'
        : 'The relay could not be reached just now, so those are missing rather than zero.');
    el('m-asof').classList.toggle('m-dead', !activeLive);
    renderRunning();
    renderDownloads();
    renderPresses();
    renderVersions();
  }

  // THE WINDOW IS ASKED FOR, NOT SLICED HERE. /ping/stats returns byCountry
  // already summed over everything at or after `since`, so a single response
  // cannot be re-cut client-side into a shorter window — the day dimension is
  // gone by the time it arrives. One request per window is the cost of that,
  // and at this key count it is three scans of a handful of keys. If the pg:
  // space ever grows large enough for that to bite, the fix is a byDayCountry
  // cross-tab in the Worker and ONE request, not a clever guess here.
  const statsSince = (days) => {
    const d = new Date(Date.now() - (days - 1) * 86400000);
    return fetch(`${RELAY}/ping/stats?since=${utcKey(d)}`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  };

  function live() {
    return Promise.all([
      fetch(`${RELAY}/totals`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${RELAY}/downloads`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      statsSince(1), statsSince(7), statsSince(30),
    ]).then(([t, dl, w1, w7, w30]) => {
      if (dl && dl.ok) presses = dl.downloads;
      // "All time" comes from /totals — the permanent monthly rollup — and not
      // from a 90-day stats call. The pg: day keys expire at 90 days, so once
      // this project is older than that the two would quietly disagree and the
      // longest window would be the one that had lost data.
      if (t && t.ok) runData.all = { total: t.active.total, byCountry: t.active.byCountry };
      for (const [k, p] of [['1', w1], ['7', w7], ['30', w30]]) {
        if (p && p.ok) runData[k] = { total: p.total, byCountry: p.byCountry };
      }
      activeLive = !!(t && t.ok && w1 && w1.ok);
    });
  }

  fetch('{{ "/metrics/data.json" | relative_url }}?cb=' + Date.now())
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => { D = d; return live(); })
    .then(() => { paint(); })
    .catch((e) => {
      el('m-asof').textContent = 'Could not read the figures just now. They are rebuilt daily.';
      el('m-asof').classList.add('m-dead');
      // NEVER SILENT. A page that fails quietly looks like a quiet week — and
      // this exact catch once swallowed a ReferenceError and blanked the page.
      console.error('[metrics]', e);
    });

  el('m-window').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    el('m-window').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); runWin = b.dataset.w; renderRunning();
  });

  el('m-range').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    el('m-range').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); preset = b.dataset.r; renderDownloads();
  });

  // Hovering a legend entry keeps that line in full colour and fades the rest,
  // so telling two datasets apart never depends on colour alone.
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
