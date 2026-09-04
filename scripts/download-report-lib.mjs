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
const LINE_W = 38;   // where a header's figure ends, so every total shares a column

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

export function renderBody({ since, delta, lifetime, latest }) {
  const sections = [];
  const sinceLabel = since ? ` SINCE ${formatDate(since).toUpperCase()}` : '';

  sections.push([
    header(`NEW DOWNLOADS${sinceLabel}`, delta.mac.total + delta.pc.total),
    '',
    row('Mac', delta.mac.total, offLatest(delta.mac.byVersion, latest)),
    row('PC', delta.pc.total, offLatest(delta.pc.byVersion, latest)),
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

  sections.push([
    header('TOTAL DOWNLOADS', lifetime.mac + lifetime.pc),
    '',
    row('Mac', lifetime.mac),
    row('PC', lifetime.pc),
  ]);

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
