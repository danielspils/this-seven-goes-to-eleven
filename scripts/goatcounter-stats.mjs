// What GoatCounter knows: page views, and download BUTTON PRESSES.
//
//   node scripts/goatcounter-stats.mjs                     # the Seven, 30 days
//   node scripts/goatcounter-stats.mjs --site jp           # jx-3p.com
//   node scripts/goatcounter-stats.mjs --days 90
//   node scripts/goatcounter-stats.mjs --json              # for piping
//
// THE TOKEN IS NEVER IN THIS REPO. It is read from $GOATCOUNTER_TOKEN, or from
// the file for the chosen site — see SITES below (~/.config/seven-metrics/ and
// ~/.config/jp-metrics/).
// The file lives OUTSIDE any repository on purpose. jx-3p.com once served 36
// internal documents because a file sat in a published directory and nothing
// distinguished it from a page; a credential inside a repo is the same hazard
// with a worse ending. `.gitignore` is a backstop, not a plan.
//
// It needs the "Read statistics" permission and nothing else. A token that can
// only read cannot delete a site or forge a count, so the blast radius of
// losing it is somebody learning how many people visited.
//
// FOUR COUNTS, AND THIS SCRIPT PRINTS TWO OF THEM. Page views and button
// presses live here; completed downloads live in GitHub's counter and active
// installs live in the relay. They are never added together — a press that
// never finished is not a download, and an install from a link that never
// touched this site is a download with no press behind it. The difference
// between a press and a download is the interesting figure, and summing them
// destroys exactly that.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// ONE SCRIPT, BOTH PROJECTS. A copy in each repo would drift, and the drift
// would be invisible until two numbers disagreed and neither was obviously
// wrong. Each site has its OWN token, scoped to that site alone, in its own
// directory — so the Seven's token cannot read jx-3p and vice versa. Proven,
// not assumed: the JP token returns 403 against thissevengoestoeleven.
const SITES = {
  seven: {
    url: 'https://thissevengoestoeleven.goatcounter.com',
    tokenFile: path.join(homedir(), '.config', 'seven-metrics', 'goatcounter-token'),
    // assets/js/download.js records an EVENT per press: download/mac/v1.5.4
    press: /^download\/(mac|pc)\//,
    platformOf: (p) => p.split('/')[1],
  },
  jp: {
    url: 'https://jx-3p.goatcounter.com',
    tokenFile: path.join(homedir(), '.config', 'jp-metrics', 'goatcounter-token'),
    // JP's relay mirrors each redirect as a PATH, not an event: /download-mac.
    // A pattern written for the Seven reported "0 button presses" for JP while
    // /download-pc sat in its top pages with 22 — a zero that was mine, not
    // theirs. The shapes differ per project, so each site declares its own.
    press: /^download-(mac|pc)$/,
    platformOf: (p) => p.split('-')[1],
    // And JP mirrors active installs the same way. Reported separately: an
    // install running is not somebody pressing a button.
    active: /^active-(mac|win)$/,
  },
};

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const days = Number((args[args.indexOf('--days') + 1] || 30)) || 30;
const which = args.includes('--site') ? args[args.indexOf('--site') + 1] : 'seven';
if (!SITES[which]) {
  console.error(`Unknown --site "${which}". Known: ${Object.keys(SITES).join(', ')}`);
  process.exit(2);
}
const SITE = SITES[which].url;
const TOKEN_FILE = SITES[which].tokenFile;

function token() {
  if (process.env.GOATCOUNTER_TOKEN) return process.env.GOATCOUNTER_TOKEN.trim();
  try {
    return readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    // SAY WHAT TO DO, not just that it failed. A missing token is the ordinary
    // first-run state, not a fault, and the answer is four lines away.
    console.error(
      `No GoatCounter token for "${which}".\n\n`
      + `Create one at ${SITE} — click your username in the top menu, then API,\n`
      + 'then Add token. Tick ONLY "Read statistics", and under Access to sites\n'
      + 'untick "All sites" and select this site alone.\n\n'
      + 'Then save it, without pasting it into a chat or a repo:\n\n'
      + `  mkdir -p ${path.dirname(TOKEN_FILE)}\n`
      + `  read -rs "tok?Paste token: " && printf '%s' "$tok" > ${TOKEN_FILE} \\\n`
      + `    && unset tok && chmod 600 ${TOKEN_FILE}\n`
    );
    process.exit(2);
  }
}

async function api(pathname, params = {}) {
  const url = new URL(`${SITE}/api/v0${pathname}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 401) throw new Error('401 — the token was rejected. Is it still valid?');
  if (res.status === 403) throw new Error('403 — the token lacks "Read statistics".');
  if (!res.ok) throw new Error(`${res.status} from ${pathname}`);
  return res.json();
}

const iso = (d) => d.toISOString().slice(0, 10);
const start = iso(new Date(Date.now() - days * 86_400_000));
const end = iso(new Date());

const [total, hits] = await Promise.all([
  api('/stats/total', { start, end }),
  api('/stats/hits', { start, end, limit: 100 }),
]);

// HOW A PRESS LOOKS IS PER SITE — see SITES above.
const cfg = SITES[which];
const pages = [];
const presses = [];
const actives = [];
for (const h of hits.hits || []) {
  const p = (h.path || '').replace(/^\//, '');
  const row = { path: p, count: h.count ?? h.count_unique ?? 0 };
  if (cfg.press.test(p)) presses.push(row);
  else if (cfg.active && cfg.active.test(p)) actives.push(row);
  else pages.push(row);
}
const sum = (rows) => rows.reduce((n, r) => n + r.count, 0);
const byPlatform = {};
for (const r of presses) {
  const plat = cfg.platformOf(r.path) || '?';
  byPlatform[plat] = (byPlatform[plat] || 0) + r.count;
}

const out = {
  site: SITE,
  which,
  window: { days, start, end },
  pageviews: { total: total.total ?? null, unique: total.total_unique ?? null },
  topPages: pages.sort((a, b) => b.count - a.count).slice(0, 10),
  downloadButtonPresses: { total: sum(presses), byPlatform, byVersion: presses },
  activeInstallPings: actives.length ? { total: sum(actives), rows: actives } : null,
  meaning: 'Page views and button presses. NOT downloads — GitHub counts those '
    + 'and the relay counts active installs. Never add these together.',
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
} else {
  console.log(`GoatCounter · ${which} · ${start} → ${end} (${days} days)\n`);
  console.log(`  page views        ${out.pageviews.total ?? '—'}`
    + (out.pageviews.unique != null ? `   (${out.pageviews.unique} unique)` : ''));
  console.log(`  button presses    ${out.downloadButtonPresses.total}`
    + (Object.keys(byPlatform).length ? `   ${JSON.stringify(byPlatform)}` : ''));
  console.log('\n  top pages');
  for (const r of out.topPages) console.log(`    ${String(r.count).padStart(5)}  /${r.path}`);
  if (actives.length) {
    console.log(`\n  active-install pings mirrored here  ${sum(actives)}`
      + `   ${JSON.stringify(Object.fromEntries(actives.map((r) => [r.path, r.count])))}`);
  }
  if (presses.length) {
    console.log('\n  download presses by version');
    for (const r of presses.sort((a, b) => b.count - a.count)) {
      console.log(`    ${String(r.count).padStart(5)}  ${r.path}`);
    }
  }
  console.log(`\n  ${out.meaning}`);
}
