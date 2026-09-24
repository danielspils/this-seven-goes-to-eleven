// The daily download report: classification and rendering.
//
// Ported from JP Patches' scripts/download-report-lib.mjs, which had already
// solved the problem this one had. Kept in a lib rather than the driver for
// the same reason it is there: the shaping is the part worth reading and the
// part worth testing, and the driver is just fetch-diff-print.
//
// WHAT WENT WRONG HERE. The first version counted every asset whose counter
// had moved, so a morning's email read "New downloads: 14" when about four
// humans had downloaded anything. The rest was an installed app checking for
// updates — latest-mac.yml and latest.yml — plus three .blockmap fetches,
// which are differential-update helpers and never a user action.
//
// THE FIX IS THE ALLOW-LIST, not the specific patterns. A deny-list of
// "ignore .blockmap and .yml" would count the next thing electron-builder
// invents as a download, by default, silently. An allow-list fails closed: an
// asset nobody has classified contributes nothing until somebody says what it
// is.

// The three categories, and nothing else counts.
//
//   DOWNLOAD    .dmg, .exe          — a person got the app
//   MAC UPDATE  -universal-mac.zip  — what electron-updater fetches
//   IGNORE      everything else     — .blockmap, latest.yml, latest-mac.yml
//
// Checked against this app's real filenames, which are not JP's:
//   This-Seven-Goes-to-Eleven-1.1.0.dmg                 → mac
//   This-Seven-Goes-to-Eleven-1.1.0-universal-mac.zip   → macUpdate
//   This-Seven-Goes-to-Eleven-1.1.0-x64-win.exe         → pc
//   …-1.1.0-x64-win.exe.blockmap                        → null
// That last one is the allow-list doing its job: it ends in .blockmap, so it
// fails /\.exe$/ and is not counted as anything.
export const ASSET_RE = {
  mac: /\.dmg$/,
  macUpdate: /mac.*\.zip$/,
  pc: /\.exe$/,
};

// COUNTRY NAMES ARE SPELLED OUT, NEVER CODES. A two-letter code is a lookup
// the reader has to do in their head every morning, and some of them are
// actively misleading — this email's own relay reports T1 for Tor exits, which
// is not a country at all and reads as one.
//
// The same list the metrics page carries, deliberately: one vocabulary across
// the email and the page, so the same visitor is named the same way in both.
// An unknown code falls through to itself rather than being dropped, because
// a country nobody has mapped is still a real press.
export const COUNTRY_NAMES = {
  US: 'United States', GB: 'Great Britain', DE: 'Germany', JP: 'Japan', CA: 'Canada',
  AU: 'Australia', FR: 'France', NL: 'Netherlands', SE: 'Sweden', IT: 'Italy',
  ES: 'Spain', BR: 'Brazil', MX: 'Mexico', PL: 'Poland', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', BE: 'Belgium', CH: 'Switzerland', AT: 'Austria', IE: 'Ireland',
  NZ: 'New Zealand', RU: 'Russia', UA: 'Ukraine', CZ: 'Czechia', PT: 'Portugal',
  GR: 'Greece', TR: 'Turkey', IN: 'India', CN: 'China', KR: 'South Korea',
  TW: 'Taiwan', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', ZA: 'South Africa',
  IL: 'Israel', SG: 'Singapore', HK: 'Hong Kong', HU: 'Hungary', RO: 'Romania',
  TH: 'Thailand', ID: 'Indonesia', PH: 'Philippines', VN: 'Vietnam', MY: 'Malaysia',
  EE: 'Estonia', LT: 'Lithuania', LV: 'Latvia', SK: 'Slovakia', SI: 'Slovenia',
  HR: 'Croatia', RS: 'Serbia', BG: 'Bulgaria', IS: 'Iceland', LU: 'Luxembourg',
  // Not countries, and both arrive from Cloudflare looking exactly like one.
  T1: 'Tor network', XX: 'Unknown',
};

export function countryName(code) {
  return COUNTRY_NAMES[code] || String(code || '?');
}

export function classify(name) {
  const n = String(name || '').toLowerCase();
  if (ASSET_RE.mac.test(n)) return 'mac';
  if (ASSET_RE.macUpdate.test(n)) return 'macUpdate';
  if (ASSET_RE.pc.test(n)) return 'pc';
  return null;
}

// "v1.1.0" → "1.1.0". The tag is what the email shows beside a count, and the
// leading v is noise to a reader.
export function version(tag) {
  return String(tag || '').replace(/^v/, '') || '?';
}

// Newest version first, so a release day's activity leads.
function byVersionDesc(a, b) {
  const key = (s) => s.split('.').map((n) => Number(n) || 0);
  const [A, B] = [key(a), key(b)];
  for (let i = 0; i < 3; i++) if ((B[i] || 0) !== (A[i] || 0)) return (B[i] || 0) - (A[i] || 0);
  return 0;
}

// rows: [{ name, tag, count, before }] — every asset on every release.
//
// Returns per-category totals for the window and for all time, plus the
// per-version breakdown the email prints in parentheses, plus what was
// ignored — which is not reported to the reader but IS what decides whether
// there is anything to say at all.
export function tally(rows) {
  const empty = () => ({ total: 0, byVersion: {} });
  const delta = { mac: empty(), pc: empty(), macUpdate: empty() };
  const lifetime = { mac: 0, pc: 0, macUpdate: 0 };
  const ignored = { total: 0, names: [] };

  for (const r of rows) {
    const kind = classify(r.name);
    const count = Number(r.count) || 0;
    const moved = count - (Number(r.before) || 0);
    if (!kind) {
      if (moved > 0) {
        ignored.total += moved;
        ignored.names.push(`${r.name} +${moved}`);
      }
      continue;
    }
    lifetime[kind] += count;
    if (moved > 0) {
      delta[kind].total += moved;
      const v = version(r.tag);
      delta[kind].byVersion[v] = (delta[kind].byVersion[v] || 0) + moved;
    }
  }
  return { delta, lifetime, ignored };
}

// IS THERE ANYTHING TO SAY? The single most important line in this file.
// Ignored assets do not count, so three updater polls do not produce an email.
// An email that arrives when nothing happened is one that stops being read,
// and then the one that mattered is missed too.
//
// A mac auto-update DOES count: somebody's installed app moved to a new
// version, which is real activity, just not a download.
export function hasActivity({ delta }) {
  return delta.mac.total + delta.pc.total + delta.macUpdate.total > 0;
}

const INDENT = '  ';
const LABEL_W = 6;
// Where a header's figure ends, so every section total shares one column. It
// was 38 until the press sections arrived: "STARTED FROM THE WEBSITE — LAST 7
// DAYS" is 38 characters on its own, so its figure fell off the end and sat
// one space after the words while every other total lined up without it. A
// column that one row opts out of is not a column. Widened rather than
// shortening the heading, because the headings are shared with JP's email
// word for word.
const LINE_W = 44;

// THE SECTION TOTAL LIVES ON THE HEADER, right-aligned. Mac and PC underneath
// are the breakdown; the number you read first should not be one you have to
// add up yourself every morning.
function header(title, n) {
  const figure = String(n);
  return title + ' '.repeat(Math.max(1, LINE_W - title.length - figure.length)) + figure;
}

function row(label, n, note) {
  return (INDENT + label.padEnd(LABEL_W) + String(n) + (note ? `   (${note})` : ''))
    .replace(/\s+$/, '');
}

// ANYTHING NOT ON THE NEWEST RELEASE, and nothing else.
//
// Normally every download lands on the current version — the site buttons
// resolve to /releases/latest — so printing the version is noise on the days
// when all is well. It is worth printing on the days it is not: a download of
// an OLD version has no innocent explanation, and the morning after a release,
// downloads still landing on the previous one mean the button is not resolving
// or the release did not publish. It is the only anomaly detector in this
// email and it costs nothing when there is nothing wrong.
function offLatest(byVersion, latest, preposition = 'on') {
  const old = Object.keys(byVersion || {}).filter((v) => v !== latest).sort(byVersionDesc);
  if (!old.length) return '';
  return old.map((v) => `${byVersion[v]} ${preposition} ${v}`).join(', ');
}

// Country rows, biggest first, then alphabetically so two equal counts have a
// stable order rather than whatever the relay's key listing happened to give.
// A row that counts nothing is dropped: a country appears because somebody
// there pressed a button.
function countryRows(byCountry) {
  return Object.entries(byCountry || {})
    .map(([cc, v]) => {
      // Two shapes reach here. The windowed relay answer splits by platform,
      // { mac, pc, total }; the all-time monthly rollup cannot and is a bare
      // number. Both are legitimate and the shape says which.
      const o = (v && typeof v === 'object') ? v : { total: Number(v) || 0 };
      const mac = Number(o.mac) || 0;
      const pc = Number(o.pc) || 0;
      return { name: countryName(cc), mac, pc, total: Number(o.total) || mac + pc };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name));
}

// LAST 7 DAYS: "United States 3   Mac 2   PC 1". The platform cells are blank
// when that platform had none, so the columns stay put and an all-Mac country
// does not print "PC 0" — a zero nobody needs to read.
function countryTableSplit(byCountry) {
  const rows = countryRows(byCountry);
  if (!rows.length) return [`${INDENT}none`];
  const first = rows.map((r) => `${r.name} ${r.total}`);
  const w1 = Math.max(LABEL_W, Math.max(...first.map((s) => s.length)) + 2);
  const macCells = rows.map((r) => (r.mac > 0 ? `Mac ${r.mac}` : ''));
  const w2 = Math.max(...macCells.map((s) => s.length)) + 3;
  return rows.map((r, i) => (
    INDENT + first[i].padEnd(w1) + macCells[i].padEnd(w2) + (r.pc > 0 ? `PC ${r.pc}` : '')
  ).replace(/\s+$/, ''));
}

// TOTAL: country then one count. No platform split, because the permanent
// monthly rollup this reads does not carry one.
function countryTableCount(byCountry) {
  const rows = countryRows(byCountry);
  if (!rows.length) return [`${INDENT}none`];
  const w = Math.max(LABEL_W, Math.max(...rows.map((r) => r.name.length)) + 2);
  return rows.map((r) => INDENT + r.name.padEnd(w) + r.total);
}

// WHAT POPULATION A PRESS TABLE COUNTS, under its own heading. Two
// country-ish numbers from two sources read as one number contradicting
// itself unless each says who it counts — the lesson the metrics page paid
// for, applied here before it could cost anything.
const PRESS_POP = `${INDENT}(download button presses on the site — includes presses that never finished)`;

// "17 Aug" for the header, "17 Aug 2026" where the year earns its place. Fixed
// locale: this is one person's daily email, and en-GB puts the day first.
export function formatDate(iso, { year = false } = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}),
  });
}

// The subject line carries the count, so most days can be read from the
// notification without opening anything. JP's subject is static — if this
// shape works it is worth taking back there.
export function subject({ delta }) {
  const downloads = delta.mac.total + delta.pc.total;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (downloads > 0) return `Seven→11 — ${plural(downloads, 'new download')}`;
  // Only reachable when the sole activity was an update; the driver does not
  // send at all when nothing moved.
  return `Seven→11 — ${plural(delta.macUpdate.total, 'Mac auto-update')}`;
}

// "ALL DOWNLOADS" RATHER THAN "DOWNLOADS", and the word is doing work.
//
// There are two download-ish numbers in this project and they had no way to be
// told apart by name, so they read as a contradiction: GitHub's counter says
// every copy that left, by any route — the website, the releases page, a
// direct link, a forum post — while the relay counts button presses on the
// site. On 2026-09-09 they stood at 76 and 41 and looked like a discrepancy
// rather than two different events.
//
// This email carries only the GitHub side, so it says ALL DOWNLOADS and stops
// there. The explanatory line belongs where BOTH appear; adding it here would
// explain a contrast the reader cannot see.
//
// NEVER call the relay number "downloads". It counts presses, not completions.
// SECTION ORDER IS SHARED WITH jx-3p.com/metrics's email, same words in the
// same order, so one person reading both every morning reads one format twice
// rather than two formats. The one declared difference is JP's library-borrow
// blocks, which have no counterpart here; a difference that is written down is
// not drift.
//
//   1  ALL DOWNLOADS SINCE <date>
//   2  ALL DOWNLOADS, LIFETIME
//   3  MAC AUTO-UPDATES                    only when there was activity
//   4  STARTED FROM THE WEBSITE — LAST 7 DAYS
//   5  STARTED FROM THE WEBSITE — TOTAL
//   6  (JP only) library borrows
//   7  HOW THIS IS COUNTED
//
// `press` is the relay's half and may be absent in pieces:
//   { week, weekNote, lifetime, lifetimeStale }
// where `week` / `lifetime` are byCountry maps or null. A null block prints
// what it could not read instead of a table — see the notices below.
export function renderBody({ since, delta, lifetime, latest, press = null }) {
  const sections = [];
  const sinceLabel = since ? ` SINCE ${formatDate(since).toUpperCase()}` : '';

  sections.push([
    header(`ALL DOWNLOADS${sinceLabel}`, delta.mac.total + delta.pc.total),
    '',
    row('Mac', delta.mac.total, offLatest(delta.mac.byVersion, latest)),
    row('PC', delta.pc.total, offLatest(delta.pc.byVersion, latest)),
  ]);

  sections.push([
    header('ALL DOWNLOADS, LIFETIME', lifetime.mac + lifetime.pc),
    '',
    row('Mac', lifetime.mac),
    row('PC', lifetime.pc),
  ]);

  // Only when there were some: a permanent "0" beside numbers that actually
  // move is noise, and auto-updates are rare. The count sits on the header
  // like every other section rather than hanging under it in the column where
  // Mac and PC live, where it read as a value with no label.
  if (delta.macUpdate.total > 0) {
    const note = offLatest(delta.macUpdate.byVersion, latest, 'to');
    sections.push([
      header('MAC AUTO-UPDATES', delta.macUpdate.total) + (note ? `   (${note})` : ''),
    ]);
  }

  // ── THE RELAY'S HALF ────────────────────────────────────────────────────
  //
  // NEVER CALLED "DOWNLOADS", anywhere, at any length. These are button
  // presses: the browser was sent to an installer. GitHub counts the transfer
  // finishing, so its figure is smaller and the two are different events. On
  // 2026-09-09 they stood at 76 and 41 and read as a discrepancy rather than
  // as two measurements of different things.
  //
  // A STALE SOURCE SAYS SO, FIRST. Ported from JP rather than reinvented,
  // because the failure being prevented is specific and quiet: a relay that
  // cannot be read renders an EMPTY country block, which is indistinguishable
  // from a week when nobody pressed anything. The whole point of the notice is
  // that "none" and "not known" stop looking alike.
  // A HEADER FIGURE IS A CLAIM, so an unread source gets an em dash and not a
  // zero. The first render of this section printed "0" above the sentence
  // saying the relay could not be read — the two lines contradicting each
  // other, with the more believable one wrong. Zero means the relay answered
  // and nobody pressed anything; anything else says so in words.
  const weekTotal = press && press.week
    ? countryRows(press.week).reduce((n, r) => n + r.total, 0)
    : null;
  const weekBlock = [header('STARTED FROM THE WEBSITE — LAST 7 DAYS', weekTotal ?? '—'), PRESS_POP];
  if (press && press.weekNote) weekBlock.push(INDENT + `(${press.weekNote})`);
  weekBlock.push(...(press && press.week ? countryTableSplit(press.week) : [`${INDENT}none`]));
  sections.push(weekBlock);

  const lifeRows = press && press.lifetime ? countryRows(press.lifetime) : null;
  const lifeBlock = [
    header('STARTED FROM THE WEBSITE — TOTAL',
      lifeRows ? lifeRows.reduce((n, r) => n + r.total, 0) : '—'),
    PRESS_POP,
  ];
  // The fallback is the LAST REPORT'S stored table, and the notice leads so
  // the number underneath is never mistaken for a current one.
  if (press && press.lifetimeStale) {
    lifeBlock.push(`${INDENT}(live press data unavailable — totals below are from the last report)`);
  }
  lifeBlock.push(...(lifeRows && lifeRows.length ? countryTableCount(press.lifetime) : [`${INDENT}none`]));
  sections.push(lifeBlock);

  // NO RESIDUAL LINE, deliberately. "Direct from GitHub" would be downloads
  // minus presses, and subtracting a completion count from a press count
  // produces a number that describes nothing. JP removed its own for the same
  // reason. The rule is never sum, difference or percentage the two.

  // TWO LINES. The long version explained why the numbers are what they are —
  // the start date, the filenames that are not downloads, why Mac splits and PC
  // does not — and every one of those answers a question nobody asks daily.
  // What survives is the one caveat that changes how a number is READ: the PC
  // figure is not comparable to the Mac figure (Daniel, 2026-08-20). His
  // wording; do not expand it.
  sections.push([
    'HOW THIS IS COUNTED',
    '',
    '    Mac counts new downloads',
    '    PC combines new downloads + updates (GitHub can\'t distinguish)',
  ]);

  return `${sections.map((s) => s.join('\n')).join('\n\n')}\n`;
}

// The HTML half of the multipart email: the same text, escaped, in one <pre>.
// No reflow and no markdown — the alignment above is the layout.
export function htmlBody(text) {
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre style="font:13px/1.5 ui-monospace,Menlo,monospace">${esc}</pre>`;
}
