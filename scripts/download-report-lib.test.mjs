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
  assert.match(body, /^NEW DOWNLOADS SINCE 17 AUG {11}4$/m);
  assert.match(body, /^TOTAL DOWNLOADS {22}4$/m);
  // Both figures end in the same column, which is what makes them scannable.
  const cols = body.split('\n')
    .filter((l) => /^(NEW DOWNLOADS|TOTAL DOWNLOADS)/.test(l)).map((l) => l.length);
  assert.deepStrictEqual(cols, [38, 38]);
  // The breakdown is still there, underneath.
  assert.match(body, /^ {2}Mac {3}3$/m);
  assert.match(body, /^ {2}PC {4}1$/m);
});

test('the date is the snapshot’s, in the header and in the footnote', () => {
  const { delta, lifetime } = NORMAL();
  const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest: '1.1.0' });
  assert.match(body, /SINCE 17 AUG/);
  assert.match(body, /Counted since 17 Aug 2026\./);
  assert.ok(!/the last time this ran/.test(body), 'the vague phrasing is gone');
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
  assert.ok(!/\(/.test(body.split('HOW THIS IS COUNTED')[0]), 'no parentheticals above the footnote');
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
  assert.match(cleanBody, /^MAC AUTO-UPDATES {21}1$/m, 'count on the header, not hanging below it');
  assert.ok(!/\(to /.test(cleanBody), 'nothing to say when it went to latest');

  const odd = tally([{ name: `${V10}-universal-mac.zip`, tag: 'v1.0.0', count: 1, before: 0 }]);
  const oddBody = renderBody({ since: null, ...odd, latest: '1.1.0' });
  assert.match(oddBody, /\(1 to 1\.0\.0\)/);
});

test('the footnote is always there, in full, and claims no geography', () => {
  for (const latest of ['1.1.0', '9.9.9']) {
    const { delta, lifetime } = NORMAL();
    const body = renderBody({ since: '2026-08-17T07:12:00Z', delta, lifetime, latest });
    assert.match(body, /^HOW THIS IS COUNTED$/m);
    assert.strictEqual((body.match(/^ {2}• /gm) || []).length, 4, 'all four bullets');
    assert.match(body, /cannot be told apart/);
    assert.ok(!/country|Country/.test(body), 'no geography — this site has no click relay');
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
