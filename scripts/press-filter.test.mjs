// What the relay counts as a download-button press. Run with:
//   node --test "scripts/*.test.mjs"
//
// Counting lives in relay/worker.js, which had no tests at all. This file
// covers the one decision that changes a published number.

import test from 'node:test';
import assert from 'node:assert';
import { countsAsPress } from '../relay/worker.js';

// Real strings, from JP Patches' /download/agents fingerprints on 2026-11-04.
// Every mobile agent there pressed BOTH buttons exactly once; the only uneven
// splits were desktop. Nobody takes a .dmg and an .exe on the same phone.
const MOBILE = [
  'Mozilla/5.0 (Linux; Android 4.4.2; 4024D) AppleWebKit/537.36 (KHTML, like Gecko)',
  'Mozilla/5.0 (Linux; Android 10; SM-A715F) AppleWebKit/537.36',
  'Mozilla/5.0 (Linux; Android 9; BND-L21 Build/HONORBND-L21) AppleWebKit/537.36',
  'Mozilla/5.0 (Linux; U; Android 9; it-it; Redmi Note 7 Build/PKQ1) AppleWebKit/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
];

const DESKTOP = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130',
  'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:60.0) Gecko/20100101 Firefox/60.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
];

// Not a browser at all. Pressing both buttons on BOTH sites, 2/2 here and 3/2
// on JP, announcing nothing DL_BOT_RE could match. Found 9 Nov 2026 in the
// fingerprints this file's rule was added to collect.
const NOT_BROWSER_SHAPED = [
  'MSH PDFMIN/1',
  'riverbot/1.0 (https://river.ai/bot)',
  'CCBot/2.0 (https://commoncrawl.org/faq)',
  'SomeAgent/3.1',
];

const ANNOUNCED_BOTS = [
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
  'curl/8.4.0',
  'python-requests/2.31.0',
  'HeadlessChrome/120.0.0.0',
];

test('a phone is never a press — neither installer runs there', () => {
  for (const ua of MOBILE) {
    assert.equal(countsAsPress(ua), false, ua);
  }
});

test('anything without a Mozilla/ token is a program, named or not', () => {
  // Every real browser still sends it. Default-deny catches the agents that
  // announce nothing — which is what DL_BOT_RE could never do.
  for (const ua of NOT_BROWSER_SHAPED) {
    assert.equal(countsAsPress(ua), false, ua);
  }
});

test('a desktop browser is a press', () => {
  for (const ua of DESKTOP) {
    assert.equal(countsAsPress(ua), true, ua);
  }
});

test('agents that announce themselves are not presses', () => {
  for (const ua of ANNOUNCED_BOTS) {
    assert.equal(countsAsPress(ua), false, ua);
  }
});

test('no user-agent at all is not a person', () => {
  assert.equal(countsAsPress(''), false);
  assert.equal(countsAsPress(null), false);
  assert.equal(countsAsPress(undefined), false);
});

test('"Mobile" inside a desktop Safari string does not disqualify it', () => {
  // Guard against widening the mobile pattern until it eats desktop traffic.
  // Linux x86_64 is a desktop; the word "Mobile" appears in no part of it.
  assert.equal(
    countsAsPress('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'),
    true,
  );
});

// ── The wiring, not just the rule ─────────────────────────────────────
// countsAsPress being right is worth nothing if handleDownload stops asking
// it. Deleting `human &&` from the call site leaves every test above green,
// so these drive the handler itself against a fake KV and assert on the keys
// that actually get written.

import { handleDownload } from '../relay/worker.js';

const fakeEnv = () => {
  const store = new Map([['dlurl:mac', 'https://example.test/app.dmg']]);
  return {
    PINGS: {
      get: async (k) => (store.has(k) ? store.get(k) : null),
      put: async (k, v) => { store.set(k, v); },
      list: async () => ({ keys: [], list_complete: true }),
    },
    _store: store,
  };
};

const fakeCtx = () => {
  const waits = [];
  return { waitUntil: (p) => waits.push(p), settle: () => Promise.all(waits) };
};

const req = (ua) => ({
  headers: { get: (h) => (h.toLowerCase() === 'user-agent' ? ua : null) },
  cf: { country: 'SE' },
});

const dlKeys = (env) => [...env._store.keys()].filter((k) => k.startsWith('dl:') || k.startsWith('dlm:'));

test('a phone press redirects but is not counted', async () => {
  const env = fakeEnv(); const ctx = fakeCtx();
  const res = await handleDownload(req('Mozilla/5.0 (Linux; Android 10; SM-A715F)'), env, ctx, 'mac');
  await ctx.settle();
  assert.equal(res.status, 302, 'the download still works');
  assert.deepEqual(dlKeys(env), [], 'nothing was counted');
});

test('a desktop press is counted', async () => {
  const env = fakeEnv(); const ctx = fakeCtx();
  const res = await handleDownload(req('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605'), env, ctx, 'mac');
  await ctx.settle();
  assert.equal(res.status, 302);
  assert.deepEqual(dlKeys(env).sort(), ['dl:' + new Date().toISOString().slice(0,10).replace(/-/g,'') + ':mac:SE',
                                        'dlm:' + new Date().toISOString().slice(0,7) + ':mac:SE'].sort());
});

test('every press is fingerprinted, counted or not', async () => {
  const env = fakeEnv(); const ctx = fakeCtx();
  await handleDownload(req('Mozilla/5.0 (Linux; Android 10; SM-A715F)'), env, ctx, 'mac');
  await ctx.settle();
  const ua = [...env._store.keys()].filter((k) => k.startsWith('ua:'));
  assert.equal(ua.length, 1, 'the excluded press is still visible');
  assert.match(ua[0], /:filtered:mac:/);
});
