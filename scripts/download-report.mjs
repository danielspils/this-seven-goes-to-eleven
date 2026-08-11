// Daily download delta for This Seven Goes to Eleven.
//
// PLACEHOLDER, but real: it works the moment the app repo has releases with
// assets. Today there are none, so it reports nothing and exits quietly.
//
// GitHub only exposes a CUMULATIVE per-asset counter, so the delta lives in
// .github/download-stats.json — committed after a successful send, which is
// what makes "since your last report" mean something.
//
// Preview without sending:  node scripts/download-report.mjs --dry-run
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';

const APP_REPO = 'danielspils/crumar-seven-editor'; // downloads live there
const SNAPSHOT = '.github/download-stats.json';
const dryRun = process.argv.includes('--dry-run');

const headers = { Accept: 'application/vnd.github+json' };
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

const res = await fetch(`https://api.github.com/repos/${APP_REPO}/releases`, { headers });
const releases = res.ok ? await res.json() : [];

// asset id -> { name, tag, count }
const current = {};
for (const r of releases) {
  for (const a of r.assets || []) {
    current[a.id] = { name: a.name, tag: r.tag_name, count: a.download_count };
  }
}

const previous = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')) : {};
const rows = [];
let total = 0;
for (const [id, asset] of Object.entries(current)) {
  const before = previous[id]?.count ?? 0;
  const delta = asset.count - before;
  if (delta > 0) {
    rows.push({ ...asset, delta });
    total += delta;
  }
}

const out = process.env.GITHUB_OUTPUT;
const emit = (k, v) => {
  if (!out) return;
  // Multi-line values need the heredoc form.
  appendFileSync(out, `${k}<<__EOF__\n${v}\n__EOF__\n`);
};

if (!rows.length) {
  console.log(releases.length
    ? 'No new downloads since the last report.'
    : 'No releases yet — nothing to report.');
  if (out) appendFileSync(out, 'send=false\n');
  if (!dryRun) writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + '\n');
  process.exit(0);
}

const width = Math.max(...rows.map((r) => r.name.length));
const lines = rows
  .sort((a, b) => b.delta - a.delta)
  .map((r) => `${r.name.padEnd(width)}  +${String(r.delta).padStart(4)}   (${r.tag}, ${r.count} total)`);
const body = [`New downloads: ${total}`, '', ...lines].join('\n');

console.log(body);
if (dryRun) process.exit(0);

if (out) appendFileSync(out, 'send=true\n');
emit('body', body);
emit('html', `<pre style="font:13px/1.5 ui-monospace,Menlo,monospace">${body
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`);
writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + '\n');
