// Daily download delta for This Seven Goes to Eleven.
//
// Thin driver: fetch the releases, diff them against the last snapshot, hand
// the rows to scripts/download-report-lib.mjs, and decide whether there is
// anything worth an email. All the shaping — and the ALLOW-LIST that decides
// what counts as a download at all — lives in the lib, where it can be read
// and tested.
//
// The app lives in a SEPARATE repository; only the site lives here.
//
// GitHub only exposes a CUMULATIVE per-asset counter, so the delta lives in
// .github/download-stats.json — rewritten every run, which is what "since"
// means on the email.
//
// Preview without sending:  node scripts/download-report.mjs --dry-run
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { tally, hasActivity, renderBody, htmlBody, subject, version } from './download-report-lib.mjs';

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

// The snapshot grew a wrapper so it can carry the date the counts were taken —
// otherwise "since" on the email is a guess. The old flat shape (id -> asset,
// no metadata) is still read, so the first run after this change diffs against
// real numbers instead of starting from zero and reporting every download ever
// made as new.
const raw = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')) : {};
const previous = raw.assets || raw;
const since = raw.date || null;

const rows = Object.entries(current).map(([id, a]) => ({
  ...a, before: previous[id]?.count ?? 0,
}));

const { delta, lifetime, ignored } = tally(rows);

// WHAT "LATEST" IS, resolved rather than written down: the newest release at
// report time. Sorted by version rather than trusting the API's order, so a
// re-tagged or back-dated release cannot quietly make an old version look
// current — which would disarm the one anomaly this email can detect.
const latest = version([...releases]
  .sort((a, b) => versionKey(b.tag_name) - versionKey(a.tag_name))[0]?.tag_name);

function versionKey(tag) {
  const [maj = 0, min = 0, pat = 0] = String(tag || '')
    .replace(/^v/, '').replace(/-.*$/, '').split('.').map(Number);
  return (maj || 0) * 10000 + (min || 0) * 100 + (pat || 0);
}

const out = process.env.GITHUB_OUTPUT;
const saveSnapshot = () => {
  if (dryRun) return;
  writeFileSync(SNAPSHOT, `${JSON.stringify({
    date: new Date().toISOString(), assets: current,
  }, null, 2)}\n`);
};

// NO EMAIL WHEN NOTHING HAPPENED. Ignored assets moving is not something
// happening: the updater polling latest-mac.yml three times used to be worth
// an email, which is how an inbox learns to skip this sender. The snapshot is
// still written, so those movements are never re-counted.
if (!hasActivity({ delta })) {
  const why = ignored.total > 0
    ? `Nothing to report — ${ignored.total} update-check/blockmap fetch${ignored.total === 1 ? '' : 'es'}, no downloads.`
    : (releases.length ? 'No new downloads since the last report.' : 'No releases yet — nothing to report.');
  console.log(why);
  if (ignored.names.length) console.log(`  (ignored: ${ignored.names.join(', ')})`);
  if (out) appendFileSync(out, 'send=false\n');
  saveSnapshot();
  process.exit(0);
}

const body = renderBody({ since, delta, lifetime, latest });
console.log(body);
if (ignored.total > 0) {
  // JOB LOG ONLY — this line is printed after the body and is never part of
  // it, so it cannot reach the email. It exists for the day a number looks
  // lower than expected and the answer is "those were update checks".
  console.log(`(not counted: ${ignored.names.join(', ')})`);
}
if (dryRun) process.exit(0);

if (out) {
  appendFileSync(out, 'send=true\n');
  const emit = (k, v) => appendFileSync(out, `${k}<<__EOF__\n${v}\n__EOF__\n`);
  emit('subject', subject({ delta }));
  emit('body', body);
  emit('html', htmlBody(body));
}
saveSnapshot();
