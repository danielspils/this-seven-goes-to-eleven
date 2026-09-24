// The classification and the send gate. Run with:  node --test scripts/
//
// This runs in the Download report workflow BEFORE the report is built, so a
// broken allow-list fails the job rather than sending a wrong number. There is
// no package.json here and no other test runner — this file plus that step is
// the whole arrangement.

import test from 'node:test';
import assert from 'node:assert';

import { classify, tally, hasActivity, renderBody, subject } from './download-report-lib.mjs';

// The real filenames, from danielspils/crumar-seven-editor. Not invented:
// every pattern in the lib was checked against these.
const V11 = 'This-Seven-Goes-to-Eleven-1.1.0';
const V10 = 'This-Seven-Goes-to-Eleven-1.0.0';

test('every real asset name lands in the right category', () => {
  assert.strictEqual(classify(`${V11}.dmg`), 'mac');
  assert.strictEqual(classify(`${V11}-universal-mac.zip`), 'macUpdate');
  assert.strictEqual(classify(`${V11}-x64-win.exe`), 'pc');
  // The three that were being counted as downloads.
  assert.strictEqual(classify('latest-mac.yml'), null);
  assert.strictEqual(classify('latest.yml'), null);
  assert.strictEqual(classify(`${V11}.dmg.blockmap`), null);
  assert.strictEqual(classify(`${V11}-universal-mac.zip.blockmap`), null);
  assert.strictEqual(classify(`${V11}-x64-win.exe.blockmap`), null);
});

// THE ALLOW-LIST IS THE FIX, not the specific patterns. Something nobody has
// classified must contribute nothing — a deny-list would count the next thing
// electron-builder invents as a download by default.
test('an asset type nobody has heard of is not a download', () => {
  assert.strictEqual(classify(`${V11}.pkg`), null);
  assert.strictEqual(classify(`${V11}-arm64.appimage`), null);
  assert.strictEqual(classify('RELEASES'), null);
  assert.strictEqual(classify(''), null);
  assert.strictEqual(classify(undefined), null);
});

// This morning's actual email said "New downloads: 14". These are the actual
// numbers behind it.
test('the report that said 14 was four downloads and one update', () => {
  const rows = [
    { name: 'latest-mac.yml', tag: 'v1.1.0', count: 3, before: 0 },
    { name: 'latest.yml', tag: 'v1.1.0', count: 2, before: 0 },
    { name: `${V11}-universal-mac.zip`, tag: 'v1.1.0', count: 1, before: 0 },
    { name: `${V11}-universal-mac.zip.blockmap`, tag: 'v1.1.0', count: 1, before: 0 },
    { name: `${V11}-x64-win.exe`, tag: 'v1.1.0', count: 1, before: 0 },
    { name: `${V11}-x64-win.exe.blockmap`, tag: 'v1.1.0', count: 1, before: 0 },
    { name: `${V11}.dmg`, tag: 'v1.1.0', count: 2, before: 0 },
    { name: `${V11}.dmg.blockmap`, tag: 'v1.1.0', count: 1, before: 0 },
    { name: `${V10}.dmg`, tag: 'v1.0.0', count: 1, before: 0 },
  ];
  const { delta, lifetime, ignored } = tally(rows);
  assert.strictEqual(delta.mac.total, 3, 'two on 1.1.0, one on 1.0.0');
  assert.strictEqual(delta.pc.total, 1);
  assert.strictEqual(delta.macUpdate.total, 1);
  assert.strictEqual(ignored.total, 8, 'the updater polls and the blockmaps');
  assert.deepStrictEqual(delta.mac.byVersion, { '1.1.0': 2, '1.0.0': 1 });
  assert.strictEqual(lifetime.mac, 3);
});

// THE ONE THAT MATTERS MOST. An email that arrives when nothing happened is an
// email that stops being read.
test('updater polls alone are not activity, and send nothing', () => {
  const rows = [
    { name: 'latest-mac.yml', tag: 'v1.1.0', count: 6, before: 3 },
    { name: 'latest.yml', tag: 'v1.1.0', count: 4, before: 2 },
    { name: `${V11}.dmg.blockmap`, tag: 'v1.1.0', count: 2, before: 1 },
    { name: `${V11}.dmg`, tag: 'v1.1.0', count: 2, before: 2 },   // unmoved
  ];
  const t = tally(rows);
  assert.strictEqual(hasActivity(t), false, 'six ignored fetches are not an email');
  assert.strictEqual(t.ignored.total, 6);
});

test('one real download is activity; so is one mac auto-update on its own', () => {
  const one = (name) => tally([{ name, tag: 'v1.1.0', count: 1, before: 0 }]);
  assert.strictEqual(hasActivity(one(`${V11}.dmg`)), true);
  assert.strictEqual(hasActivity(one(`${V11}-x64-win.exe`)), true);
  // Somebody's installed app moved to a new version. Real, just not a download.
  assert.strictEqual(hasActivity(one(`${V11}-universal-mac.zip`)), true);
  assert.strictEqual(hasActivity(one('latest-mac.yml')), false);
});

// The everyday shape. Every download on the current version, which is what
// /releases/latest guarantees — so no version detail anywhere.
const NORMAL = () => tally([
  { name: `${V11}.dmg`, tag: 'v1.1.0', count: 3, before: 0 },
  { name: `${V11}-x64-win.exe`, tag: 'v1.1.0', count: 1, before: 0 },
  { name: 'latest.yml', tag: 'v1.1.0', count: 9, before: 0 },
]);

test('each section leads with its own total, right-aligned', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0' });
  // The figure you read first is the one you would otherwise add up yourself.
  assert.match(body, /^ALL DOWNLOADS SINCE 17 AUG {17}4$/m);
  assert.match(body, /^ALL DOWNLOADS, LIFETIME {20}4$/m);
  // Both figures end in the same column, which is what makes them scannable.
  const cols = body.split('\n')
    .filter((l) => /^ALL DOWNLOADS/.test(l)).map((l) => l.length);
  assert.deepStrictEqual(cols, [44, 44]);
  // The breakdown is still there, underneath.
  assert.match(body, /^ {2}Mac {3}3$/m);
  assert.match(body, /^ {2}PC {4}1$/m);
});

test('the date is the snapshot’s, in the header', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0' });
  assert.match(body, /SINCE 17 AUG/);
  assert.ok(!/the last time this ran/.test(body), 'the vague phrasing is gone');
  // The footnote no longer repeats it. The header already says the window, and
  // a start date in the caveat answered a question nobody asks daily
  // (Daniel, 2026-08-20).
  assert.ok(!/Counted since/.test(body), 'the start date is not repeated below');
});

test('a blank line separates every section', () => {
  const { delta, lifetime } = NORMAL();
  const lines = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0' })
    .split('\n');
  for (const [i, line] of lines.entries()) {
    if (i > 0 && /^[A-Z][A-Z ’]+/.test(line) && !line.startsWith(' ')) {
      assert.strictEqual(lines[i - 1], '', `blank line before "${line.trim()}"`);
    }
  }
});

// EVERYTHING ON LATEST: no version detail at all. The site buttons resolve to
// /releases/latest, so this is every ordinary day and the version is noise.
test('no version detail when everything landed on the newest release', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0' });
  assert.ok(!/1\.1\.0/.test(body), `no version anywhere:\n${body}`);
  // Scoped to the GitHub blocks. It used to cover everything above the
  // footnote, which was the same statement until the press sections arrived
  // carrying a population line that is legitimately parenthesised. What the
  // assertion always meant is "no VERSION parenthetical" — say that instead of
  // letting a broader wording forbid a later, unrelated feature.
  assert.ok(!/\(/.test(body.split('STARTED FROM THE WEBSITE')[0]),
    'no version parentheticals in the download blocks');
  assert.ok(!/MAC AUTO-UPDATES/.test(body), 'and no update block when there were none');
});

// ANYTHING OFF LATEST: say so. A download of an old version has no innocent
// explanation, and the morning after a release it means the button is not
// resolving or the release did not publish. Suppress this and the test fails —
// which is the point of having it.
test('a download on an older release is called out, and only that part', () => {
  const { delta, lifetime } = tally([
    { name: `${V11}.dmg`, tag: 'v1.1.0', count: 2, before: 0 },
    { name: `${V10}.dmg`, tag: 'v1.0.0', count: 1, before: 0 },
    { name: `${V11}-x64-win.exe`, tag: 'v1.1.0', count: 1, before: 0 },
  ]);
  const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0' });
  assert.match(body, /^ {2}Mac {3}3 {3}\(1 on 1\.0\.0\)$/m);
  // The two on the current version are NOT itemised — only the anomaly is.
  assert.ok(!/1\.1\.0/.test(body), 'the current version is never printed');
  assert.match(body, /^ {2}PC {4}1$/m, 'and a clean platform stays clean');
});

test('an auto-update to something other than latest is called out too', () => {
  const clean = tally([{ name: `${V11}-universal-mac.zip`, tag: 'v1.1.0', count: 1, before: 0 }]);
  const cleanBody = renderBody({ since: null, ...clean, latest: '1.1.0' });
  assert.match(cleanBody, /^MAC AUTO-UPDATES {27}1$/m, 'count on the header, not hanging below it');
  assert.ok(!/\(to /.test(cleanBody), 'nothing to say when it went to latest');

  const odd = tally([{ name: `${V10}-universal-mac.zip`, tag: 'v1.0.0', count: 1, before: 0 }]);
  const oddBody = renderBody({ since: null, ...odd, latest: '1.1.0' });
  assert.match(oddBody, /\(1 to 1\.0\.0\)/);
});

// TWO LINES, unconditional. The one caveat that changes how a number is READ
// is that the PC figure is not comparable to the Mac one; everything else the
// long footnote carried explained why a number is not in the number, which is
// not a daily question (Daniel, 2026-08-20). His wording, so this pins it
// verbatim — an expansion here is a regression.
test('the footnote is always there, and is exactly the two lines', () => {
  for (const latest of ['1.1.0', '9.9.9']) {
    const { delta, lifetime } = NORMAL();
    const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest });
    assert.match(body, /^HOW THIS IS COUNTED$/m);
    assert.match(body, /^ {4}Mac counts new downloads$/m);
    assert.match(body, /^ {4}PC combines new downloads \+ updates \(GitHub can't distinguish\)$/m);
    assert.strictEqual((body.match(/^ {2}• /gm) || []).length, 0, 'no bullets survive');
    // A "no geography here" assertion used to sit on this line. It was written
    // when the site had no click relay, and it outlived its reason by a
    // fortnight: the relay landed on 2026-09-08 and began counting presses by
    // country, and the assertion went on forbidding the email from showing
    // them. A test that pins the absence of a feature DEFENDS that absence —
    // the fourth time that shape has cost something here. It is gone, and the
    // block below is what replaced it.
  }
});

// The "(not counted: …)" line is printed by the DRIVER after the body. It must
// never be inside it — the reader gets the number, the job log gets the reason.
test('nothing about ignored assets reaches the email body', () => {
  const { delta, lifetime } = NORMAL();   // includes latest.yml +9
  const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0' });
  assert.ok(!/not counted/.test(body));
  assert.ok(!/latest\.yml/.test(body.split('HOW THIS IS COUNTED')[0]),
    'the feed file is named only in the footnote that explains the rule');
});

test('the subject line carries the count', () => {
  const { delta } = NORMAL();
  assert.strictEqual(subject({ delta }), 'Seven→11 — 4 new downloads');

  const one = tally([{ name: `${V11}.dmg`, tag: 'v1.1.0', count: 1, before: 0 }]);
  assert.strictEqual(subject(one), 'Seven→11 — 1 new download', 'singular');

  // An update-only day still says what happened rather than "0 new downloads".
  const upd = tally([{ name: `${V11}-universal-mac.zip`, tag: 'v1.1.0', count: 2, before: 0 }]);
  assert.strictEqual(subject(upd), 'Seven→11 — 2 Mac auto-updates');
});

// ── THE RELAY'S HALF ────────────────────────────────────────────────────────

// Countries as they'd arrive from /downloads?since=…, which splits by
// platform, and from /downloads, which cannot and is a bare count.
const WEEK = { US: { mac: 2, pc: 1, total: 3 }, DE: { mac: 0, pc: 2, total: 2 } };
const LIFE = { US: 31, DE: 7, T1: 2 };

// THE GUARD DANIEL ASKED FOR: if the relay has country data, the email shows
// it. The failure being prevented is an empty country block sitting where a
// populated one should be — which looks exactly like a quiet week and is the
// one output nobody would question.
//
// MUTATION-PROVED: delete either countryTable call in renderBody and this
// fails. Not the header, not the population line — the TABLE, which is the
// part a well-meaning refactor drops.
test('country data in, country block out', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({
    since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0',
    press: { week: WEEK, lifetime: LIFE, weekNote: null, lifetimeStale: false },
  });

  const week = body.split('STARTED FROM THE WEBSITE — LAST 7 DAYS')[1].split('STARTED FROM THE WEBSITE — TOTAL')[0];
  assert.match(week, /^ {2}United States 3 {2}Mac 2 {3}PC 1$/m, 'the week splits by platform');
  assert.match(week, /^ {2}Germany 2 {16}PC 2$/m, 'a platform with none leaves its cell blank');
  assert.ok(!/none/.test(week), 'a populated week never also says none');

  const total = body.split('STARTED FROM THE WEBSITE — TOTAL')[1];
  assert.match(total, /^ {2}United States {2}31$/m);
  assert.match(total, /^ {2}Germany {8}7$/m);
  // Biggest first, and names never codes.
  assert.ok(total.indexOf('United States') < total.indexOf('Germany'), 'ranked by count');
  assert.ok(!/\bUS\b|\bDE\b/.test(body), 'country CODES never reach the reader');
  // T1 is Cloudflare's Tor marker and arrives shaped exactly like a country.
  assert.match(total, /^ {2}Tor network {4}2$/m, 'Tor is named, not printed as a country called T1');
});

// NEVER "DOWNLOADS". The relay counts presses; GitHub counts completions. The
// two stood at 76 and 41 on 2026-09-09 and read as a discrepancy.
test('the relay figures are never labelled downloads', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({
    since: null, delta, lifetime, latest: '1.1.0',
    press: { week: WEEK, lifetime: LIFE, weekNote: null, lifetimeStale: false },
  });
  for (const heading of ['STARTED FROM THE WEBSITE — LAST 7 DAYS', 'STARTED FROM THE WEBSITE — TOTAL']) {
    const section = body.split(heading)[1].split('\n\n')[0];
    assert.ok(!/download(s|ed)?\b(?! button)/i.test(section.replace(/download button presses/gi, '')),
      `"${heading}" calls them presses, never downloads`);
    assert.match(section, /includes presses that never finished/,
      'and states what population it counts, under its own heading');
  }
});

// A SOURCE THAT COULD NOT BE READ SAYS SO. An empty country block and a quiet
// week are indistinguishable, so the notice is the whole defence.
test('a stale total leads with the notice, and never renders as none', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({
    since: null, delta, lifetime, latest: '1.1.0',
    press: { week: null, lifetime: LIFE, weekNote: 'the relay could not be read just now', lifetimeStale: true },
  });
  const total = body.split('STARTED FROM THE WEBSITE — TOTAL')[1];
  const notice = total.indexOf('live press data unavailable');
  assert.ok(notice > -1, 'the notice is there');
  assert.ok(notice < total.indexOf('United States'), 'and it LEADS, before any number it qualifies');

  const week = body.split('LAST 7 DAYS')[1].split('STARTED FROM THE WEBSITE — TOTAL')[0];
  assert.match(week, /the relay could not be read just now/);
  assert.match(week, /^ {2}none$/m, 'the window renders none — it has no stored fallback');
});

// THE THIRD STATE, and the one that would be silent. A relay that predates
// `since` ignores it and answers with the all-time total: a 200, real numbers,
// and catastrophically wrong under a "LAST 7 DAYS" heading. The driver detects
// it by the missing `window` echo and passes a note instead of a table.
test('an un-upgraded relay is named, not printed as a week', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({
    since: null, delta, lifetime, latest: '1.1.0',
    press: {
      week: null, lifetime: LIFE, lifetimeStale: false,
      weekNote: 'this relay does not answer windowed queries yet — deploy relay/worker.js',
    },
  });
  const week = body.split('LAST 7 DAYS')[1].split('STARTED FROM THE WEBSITE — TOTAL')[0];
  assert.match(week, /does not answer windowed queries yet/);
  assert.ok(!/United States/.test(week), 'and no all-time figure leaks into the week');
});

// THE SHARED FORMAT. Same sections, same order, as jx-3p.com's email. Pinned
// because "same order on both sites" is a claim that rots the first time
// somebody inserts a block in the obvious place rather than the agreed one.
test('the sections appear in the shared order', () => {
  const upd = tally([
    { name: `${V11}.dmg`, tag: 'v1.1.0', count: 3, before: 0 },
    { name: `${V11}-universal-mac.zip`, tag: 'v1.1.0', count: 2, before: 0 },
  ]);
  const body = renderBody({
    since: '2026-08-17T07:12:00Z', ...upd, latest: '1.1.0',
    press: { week: WEEK, lifetime: LIFE, weekNote: null, lifetimeStale: false },
  });
  const order = [
    'ALL DOWNLOADS SINCE',
    'ALL DOWNLOADS, LIFETIME',
    'MAC AUTO-UPDATES',
    'STARTED FROM THE WEBSITE — LAST 7 DAYS',
    'STARTED FROM THE WEBSITE — TOTAL',
    'HOW THIS IS COUNTED',
  ];
  let at = -1;
  for (const heading of order) {
    const found = body.indexOf(heading);
    assert.ok(found > at, `${heading} comes after the section before it`);
    at = found;
  }
});

// The press blocks are structural: they appear every day, with "none" when
// there is nothing, because a section that vanishes on quiet days makes the
// reader wonder whether it broke.
//
// AND AN UNREAD SOURCE GETS AN EM DASH, NOT A ZERO. The first render of this
// section put "0" on the header directly above the sentence saying the relay
// could not be read — two lines contradicting each other, the wrong one more
// believable. Zero is a measurement and is reserved for one: the relay
// answered and nobody pressed anything.
test('the press blocks appear even with no relay data at all, and claim nothing', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({ since: null, delta, lifetime, latest: '1.1.0' });
  assert.match(body, /^STARTED FROM THE WEBSITE — LAST 7 DAYS {5}—$/m);
  assert.match(body, /^STARTED FROM THE WEBSITE — TOTAL {11}—$/m);
  assert.strictEqual((body.match(/^ {2}none$/gm) || []).length, 2);
});

test('zero is reserved for a relay that answered with nothing', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({
    since: null, delta, lifetime, latest: '1.1.0',
    press: { week: {}, lifetime: {}, weekNote: null, lifetimeStale: false },
  });
  assert.match(body, /^STARTED FROM THE WEBSITE — LAST 7 DAYS {5}0$/m,
    'an empty answer is a real zero');
  assert.match(body, /^STARTED FROM THE WEBSITE — TOTAL {11}0$/m);
});

// The contradiction itself, pinned: a figure and a "could not read it" notice
// must never appear together.
test('an unreadable week never shows a number beside its notice', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({
    since: null, delta, lifetime, latest: '1.1.0',
    press: { week: null, weekNote: 'the relay could not be read just now', lifetime: LIFE, lifetimeStale: false },
  });
  const head = body.split('\n').find((l) => l.startsWith('STARTED FROM THE WEBSITE — LAST 7 DAYS'));
  assert.ok(/—$/.test(head), `the header claims nothing: "${head}"`);
});
