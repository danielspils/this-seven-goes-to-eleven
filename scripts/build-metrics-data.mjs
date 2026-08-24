// Assemble everything /metrics/ reads into one same-origin file,
// docs/metrics/data.json.
//
//   node scripts/build-metrics-data.mjs            # write it
//   node scripts/build-metrics-data.mjs --dry-run  # print it, write nothing
//
// FOUR SOURCES, AND THEY ANSWER DIFFERENT QUESTIONS. Keeping them apart is the
// whole point of this file, because the tempting thing — one big "downloads"
// number — destroys the only interesting part:
//
//   .github/download-history.jsonl   GitHub's counters, day by day. A
//                                    COMPLETED transfer. No geography, ever.
//   GitHub releases API              today's per-asset counters, for the
//                                    per-release table
//   relay /totals                    active installs: one ping per install
//                                    per day, by month and country, permanent
//   relay /ping/stats                the 90-day window, with the per-version
//                                    detail the monthly rollups drop
//
// GoatCounter is deliberately NOT read here. Page views and download-button
// presses live there and are read there — they are a different measurement
// (intent, and browsing) and this file would only invite somebody to add them
// to the download totals.
//
// Best-effort by source: if the relay is unreachable the page still gets the
// download curve, and says so rather than showing zero.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const DRY = process.argv.includes('--dry-run');
const APP_REPO = 'danielspils/crumar-seven-editor';
const RELAY = 'https://ping.thissevengoestoeleven.com';
const OUT = 'docs/metrics/data.json';

// ── The download curve, from the history this repo keeps ────────────────
let series = [];
try {
  series = readFileSync('.github/download-history.jsonl', 'utf8')
    .trim().split('\n').filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((r) => ({
      date: r.date,
      mac: r.mac_new || 0,
      pc: r.pc_new || 0,
      upd: r.mac_upd || 0,
    }));
} catch { /* no history yet → no curve, and the page says so */ }
const latest = series[series.length - 1] || { mac: 0, pc: 0, upd: 0 };

// ── Per-asset counters, for the table ───────────────────────────────────
const headers = { Accept: 'application/vnd.github+json' };
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

let releases = [];
try {
  const res = await fetch(`https://api.github.com/repos/${APP_REPO}/releases`, { headers });
  if (res.ok) releases = await res.json();
} catch { /* the page falls back to the curve */ }

const assets = releases.flatMap((r) =>
  (r.assets || []).map((a) => ({
    name: a.name, tag: r.tag_name, count: a.download_count, published: r.published_at,
  })));

// ── Active installs, from the relay ─────────────────────────────────────
async function relay(path) {
  try {
    const res = await fetch(`${RELAY}${path}`, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
const totals = await relay('/totals');
// 90 days is the relay's own retention for the per-day keys; asking for more
// would quietly return a partial answer dressed as a complete one.
const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
const pings = await relay(`/ping/stats?since=${since}`);

// REACHABLE IS ITS OWN FIELD. Without it, a relay that is down and a relay
// with nothing in it look identical on the page — and one of those is a
// broken deployment while the other is a quiet week.
const active = {
  reachable: !!(totals && totals.ok),
  total: (totals && totals.active && totals.active.total) || 0,
  byMonth: (totals && totals.active && totals.active.byMonth) || {},
  byCountry: (totals && totals.active && totals.active.byCountry) || {},
  window: {
    reachable: !!(pings && pings.ok),
    days: 90,
    total: (pings && pings.total) || 0,
    byDay: (pings && pings.byDay) || {},
    byVersion: (pings && pings.byVersion) || {},
    byPlatform: (pings && pings.byPlatform) || {},
  },
};

const data = {
  generated: new Date().toISOString(),
  // WHAT EACH NUMBER MEANS, carried in the file rather than left to the page.
  // Anybody reading this JSON on its own should not have to guess, and the
  // page renders these as its captions.
  meaning: {
    downloads: 'Completed downloads counted by GitHub. No geography.',
    updates: 'The macOS updater fetching the zip — not a person installing.',
    active: 'Installs that opened the app that day. One ping per install per '
      + 'day, no identifier. Not users, not people, not sales.',
  },
  downloads: { mac: latest.mac, pc: latest.pc, upd: latest.upd, series },
  releases: releases.length,
  assets,
  active,
};

const text = `${JSON.stringify(data, null, 1)}\n`;
if (DRY) {
  process.stdout.write(text);
} else {
  mkdirSync('docs/metrics', { recursive: true });
  writeFileSync(OUT, text);
  process.stdout.write(
    `wrote ${OUT}: ${series.length} days, ${assets.length} assets, `
    + `active ${active.reachable ? active.total : 'RELAY UNREACHABLE'}\n`
  );
}
