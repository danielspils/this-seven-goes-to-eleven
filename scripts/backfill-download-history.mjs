// Rebuild .github/download-history.jsonl from what git already holds.
//
//   node scripts/backfill-download-history.mjs --dry-run   # print, write nothing
//   node scripts/backfill-download-history.mjs             # write the file
//
// WHY THIS EXISTS AND WHY IT IS URGENT RATHER THAN TIDY. GitHub reports a
// download counter's value TODAY and keeps no history of its own, so a daily
// curve can only be built by writing a row down every day. Nothing here ever
// did, which is why /metrics/ shows totals and no trend.
//
// What CAN be recovered is that `.github/download-stats.json` — the snapshot
// the daily email diffs against — has been committed every day for weeks. Each
// commit is a dated reading of every asset counter. Walking those commits
// reconstructs the series that was never written down.
//
// IT IS NOT A COMPLETE SERIES AND MUST NOT BE PRESENTED AS ONE. The workflow
// has not run every day, so there are gaps — and days with no row are LEFT
// OUT rather than interpolated. A straight line drawn between two real
// readings is a claim nobody measured, and this project has a rule about that.
//
// RUN IT EVERY DAY, not once. It rebuilds from git plus the snapshot in the
// working tree, so today's reading lands without an append step.
//
// IT MERGES. A ROW ONCE WRITTEN IS NEVER REMOVED, and that is not caution —
// it is a repair. The first version replaced the file outright, reasoning that
// deriving it from git meant it could never drift. Then the daily workflow ran
// on GitHub's default SHALLOW CHECKOUT, where `git log` sees one commit, and
// six days of history became two. Derived from a source the caller may not be
// able to see in full is strictly worse than append-only (2026-08-24).
//
// So: existing rows are kept, re-derived rows win where both exist, and the
// checkout is deepened in the workflow as well. Either fix alone would have
// been enough; a history that cannot be rebuilt is worth both.
//
// Matches the row shape JP Patches uses (.github/download-history.jsonl), so
// one page and one builder can read either project's history.

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SNAPSHOT = '.github/download-stats.json';
const OUT = '.github/download-history.jsonl';

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

// WHICH ASSETS ARE DOWNLOADS, and which are something else entirely.
//
//   .dmg / .exe   a person installing
//   -mac.zip      the macOS UPDATER, not a person — electron-updater reads the
//                 zip, never the dmg
//   latest*.yml   an installed copy asking whether there is a new version.
//                 Counted as a download it dwarfs everything: on 2026-08-23
//                 latest.yml read 37 against the Mac zip's 2.
//   .blockmap     a delta-update side file, never a download anybody made
//
// Kept apart, never summed. "Page views and downloads are never added
// together" is already this project's rule; this is the same rule one level in.
const kindOf = (name) => {
  if (name.endsWith('.blockmap')) return null;
  if (/^latest(-mac)?\.yml$/.test(name)) return null;
  if (name.endsWith('.dmg')) return 'mac_new';
  if (name.endsWith('-mac.zip')) return 'mac_upd';
  if (name.endsWith('.exe')) return 'pc_new';
  return null;
};

// AN EMPTY SNAPSHOT IS NOT A READING OF ZERO. The file was committed for days
// before it held anything — 2026-08-11, 08-17 and 08-18 all have `assets: {}`,
// while 1.0.0 had already shipped on the 17th and been downloaded. Emitting
// those as zeroes drew a curve that sat on the floor and then jumped to 8 on
// the 19th, which reads as eight downloads that day and is a spike nobody
// measured. They are absence of a reading, so they are left out entirely —
// same rule as the gaps.
const totalsFrom = (snapshot) => {
  const assets = snapshot.assets || {};
  if (!Object.keys(assets).length) return null;
  const out = { mac_new: 0, mac_upd: 0, pc_new: 0 };
  for (const a of Object.values(assets)) {
    const kind = kindOf(a.name || '');
    if (kind) out[kind] += Number(a.count) || 0;
  }
  return out;
};

// A READING IS DATED BY WHEN IT WAS TAKEN, which the snapshot records in its
// own `date` field. Not by the commit, which can land later, and emphatically
// not by "now" — dating the working-tree snapshot that way produced a row for
// today carrying yesterday's numbers, a reading nobody took.
const dayOf = (snapshot, fallbackIso) => {
  const when = snapshot && snapshot.date ? snapshot.date : fallbackIso;
  return new Date(when).toISOString().slice(0, 10);
};

// Oldest first. One row per DAY, last reading wins: the counters only go up,
// so the latest of a day is the most complete.
const log = sh(`git log --reverse --format=%H%x09%cI -- ${SNAPSHOT}`).trim().split('\n');
const readings = [];
for (const line of log) {
  if (!line) continue;
  const [sha, iso] = line.split('\t');
  try {
    const snapshot = JSON.parse(sh(`git show ${sha}:${SNAPSHOT}`));
    readings.push({ day: dayOf(snapshot, iso), snapshot });
  } catch { /* a commit where the file was absent or unreadable */ }
}

// THE WORKING TREE COUNTS TOO, because the daily workflow writes the snapshot
// and runs this in the same job, before any commit of it exists. It is dated
// by its own timestamp like every other reading, so a stale file on disk
// cannot become a row for today.
try {
  const live = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  readings.push({ day: dayOf(live, new Date().toISOString()), snapshot: live });
} catch { /* no snapshot on disk yet */ }

const byDay = new Map();
for (const r of readings) byDay.set(r.day, r.snapshot);   // last wins

// EVERYTHING ALREADY WRITTEN DOWN, kept whatever this run can see.
const existing = new Map();
try {
  for (const line of readFileSync(OUT, 'utf8').trim().split('\n')) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (row && row.date) existing.set(row.date, row);
  }
} catch { /* no history yet */ }

const rows = [];
let prev = null;
for (const [date, snapshot] of [...byDay.entries()].sort()) {
  const t = totalsFrom(snapshot);
  if (!t) continue;   // nothing was read that day
  // THE FIRST ROW'S DELTAS ARE ZERO, NOT ITS TOTALS. Those downloads happened
  // before anybody was writing this down; attributing them to one day would
  // invent a spike that never occurred.
  const d = prev
    ? {
      d_mac_new: t.mac_new - prev.mac_new,
      d_mac_upd: t.mac_upd - prev.mac_upd,
      d_pc_new: t.pc_new - prev.pc_new,
    }
    : { d_mac_new: 0, d_mac_upd: 0, d_pc_new: 0 };
  rows.push({ date, ...d, ...t });
  prev = t;
}

// Re-derived rows win where both exist — they come from the snapshots and are
// reproducible — but a day only the old file knows about survives.
const merged = new Map(existing);
for (const r of rows) merged.set(r.date, r);
const out = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));

const dropped = [...existing.keys()].filter((d) => !merged.has(d));
if (dropped.length) process.stderr.write(`refusing to drop: ${dropped.join(', ')}\n`);

const text = `${out.map((r) => JSON.stringify(r)).join('\n')}\n`;
if (DRY) {
  process.stdout.write(text);
  const days = out.length;
  const span = days ? `${out[0].date} … ${out[days - 1].date}` : '(none)';
  process.stderr.write(`\n${days} daily readings, ${span}\n`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  process.stdout.write(`wrote ${out.length} rows to ${OUT} (${rows.length} re-derived)\n`);
}
