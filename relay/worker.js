// This Seven Goes to Eleven — active-install relay (Cloudflare Worker)
//
// The one question no website can answer: how many installs are actually
// running, and on which version. A site sees visits; GitHub sees a download
// counter and nothing else. Neither can tell you whether anybody kept the app
// or whether an update was ever applied.
//
// So the app checks in, once a day, and that is the entire purpose of this
// Worker. It is deliberately the smaller sibling of JP Patches' relay
// (JP-Patches-App/relay/worker.js), whose ping design this copies exactly —
// there is no lending library here, no hearts, no GitHub token, and no secret
// of any kind. If this Worker leaked in full it would tell an attacker how
// many people opened a piano editor.
//
// Deploy: see relay/README.md.
//
// API:
//   POST /ping   { platform, version }  → { ok: true }
//   GET  /ping/stats?since=YYYYMMDD     → 90-day window
//   GET  /totals                        → permanent monthly aggregate
//
// ── THE PRIVACY DESIGN, and why it needs no identifier ──────────────────
//
//   - the app sends NO id, and none is derived here. There is deliberately no
//     way to link two pings to the same install.
//   - because each install pings at most once a calendar day, a day's ping
//     COUNT is itself the active-install count. That is the whole trick: the
//     number we want falls out of counting, so identity is never needed.
//   - country comes from Cloudflare (request.cf.country). The IP is used by
//     Cloudflare's edge to resolve it and is never read, logged or stored
//     here.
//   - the once-a-day rule is enforced by the APP, not here. This Worker
//     cannot verify it and does not try: verifying it would require
//     remembering who asked, which is the thing being avoided.
//
// Consequences to stay honest about, because the number will be quoted:
//   - two installs behind one NAT still count as two; they are separate pings
//   - an install that launches five times in a day counts once
//   - reinstalls and new machines are indistinguishable from new people
//   - anybody who opts out is invisible, by design
// It measures "installs that opened This Seven Goes to Eleven today". Not
// users, not people, not sales. Say it that way wherever it is published.

const PING_TTL_SECONDS = 90 * 24 * 3600;
// Reject anything odd rather than storing it. The version becomes a KV key
// and a GoatCounter path, so it is validated at the door.
const PING_VER_RE = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

// Durable monthly rollup, deliberately never expiring. The per-day pg: keys
// roll off at 90 days and GitHub's counter has no geography at all, so this is
// the only permanent record of where the app is being used.
// Key: pgm:<YYYY-MM>:<platform>:<country>
async function bumpMonthly(env, platform, country) {
  const month = new Date().toISOString().slice(0, 7);
  const key = `pgm:${month}:${platform}:${country}`;
  const next = (Number(await env.PINGS.get(key)) || 0) + 1;
  await env.PINGS.put(key, String(next));   // no expirationTtl → permanent
}

// Mirror into GoatCounter so active installs sit beside the download events
// the site already records, and the version rides along as `ref` — expanding
// active-mac there shows which versions are actually running. Best-effort:
// GoatCounter being slow or down must never affect the ping.
async function mirrorToGoatCounter(env, platform, country, version) {
  if (!env.GOATCOUNTER_URL) return;
  try {
    const url = new URL(`${env.GOATCOUNTER_URL}/count`);
    url.searchParams.set('p', `active-${platform}`);
    url.searchParams.set('t', `Active install — ${platform}`);
    url.searchParams.set('r', version);
    await fetch(url, {
      headers: {
        // GoatCounter reads the country from this, and it is the ONLY place
        // the visitor's address is passed on. Nothing here stores it.
        'x-forwarded-for': '0.0.0.0',
        'x-goatcounter-country': country,
        'user-agent': 'seven-relay',
      },
    });
  } catch { /* best-effort by design */ }
}

async function handlePing(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }

  const platform = body && body.platform === 'win' ? 'win'
    : body && body.platform === 'mac' ? 'mac' : null;
  const version = body && typeof body.version === 'string' && PING_VER_RE.test(body.version)
    ? body.version : null;
  // NOTHING ELSE IS READ off the body. A future app version that sends more
  // does not get more recorded; adding a field here has to be deliberate.
  if (!platform || !version) return json({ ok: false, error: 'bad platform/version' }, 400);

  const country = (request.cf && request.cf.country) || 'XX';
  const key = `pg:${today()}:${platform}:${version}:${country}`;
  // Non-atomic increment. Two pings landing in the same millisecond can lose
  // one; at this scale that is a rounding error and the alternative is a
  // durable object for a number nobody makes decisions on to the unit.
  const next = (Number(await env.PINGS.get(key)) || 0) + 1;
  await env.PINGS.put(key, String(next), { expirationTtl: PING_TTL_SECONDS });
  await bumpMonthly(env, platform, country);
  if (ctx) ctx.waitUntil(mirrorToGoatCounter(env, platform, country, version));
  return json({ ok: true });
}

// GET /ping/stats?since=YYYYMMDD — the 90-day window, with the per-version
// detail the monthly rollups deliberately drop.
async function handlePingStats(request, env) {
  const url = new URL(request.url);
  const since = /^[0-9]{8}$/.test(url.searchParams.get('since') || '')
    ? url.searchParams.get('since') : '00000000';
  const out = { ok: true, total: 0, byDay: {}, byCountry: {}, byVersion: {}, byPlatform: {} };
  let cursor;
  do {
    const page = await env.PINGS.list({ prefix: 'pg:', cursor });
    for (const k of page.keys) {
      const parts = k.name.split(':');        // pg:<day>:<platform>:<version>:<country>
      if (parts.length !== 5) continue;
      const [, day, platform, version, country] = parts;
      if (day < since) continue;
      const n = Number(await env.PINGS.get(k.name)) || 0;
      if (!n) continue;
      out.total += n;
      out.byDay[day] = (out.byDay[day] || 0) + n;
      out.byCountry[country] = (out.byCountry[country] || 0) + n;
      out.byVersion[version] = (out.byVersion[version] || 0) + n;
      out.byPlatform[platform] = (out.byPlatform[platform] || 0) + n;
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return json(out);
}

// GET /totals — the permanent aggregate from the never-expiring monthly
// rollups. Public by design: it is a count of app launches by month and
// country, and there is nothing in it to protect.
async function handleTotals(env) {
  const acc = { byMonth: {}, byCountry: {}, total: 0 };
  let cursor;
  do {
    const page = await env.PINGS.list({ prefix: 'pgm:', cursor });
    for (const k of page.keys) {
      const parts = k.name.split(':');        // pgm:<YYYY-MM>:<platform>:<country>
      if (parts.length !== 4) continue;
      const [, month, , country] = parts;
      const n = Number(await env.PINGS.get(k.name)) || 0;
      if (!n) continue;
      acc.byMonth[month] = (acc.byMonth[month] || 0) + n;
      acc.byCountry[country] = (acc.byCountry[country] || 0) + n;
      acc.total += n;
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return json({ ok: true, active: acc });
}

// ── /download/mac and /download/pc ──────────────────────────────────────
//
// The site's buttons resolve the actual installer in JavaScript, which works
// and will keep working. This is the floor UNDER that: a plain href that
// lands on the right FILE for the right platform with no JavaScript at all,
// and without the visitor's browser needing to talk to GitHub's API.
//
// The API call the page makes is unauthenticated — 60 requests an hour PER
// ADDRESS. One visitor never approaches that; an office behind a single
// outbound address can, and the failure is silent by design: the button stays
// pointing at the releases page and Mac and PC both land on the same list of
// eight files. Fine for a hobbyist, wrong for the manufacturer.
//
// 302, NEVER 301. The target is a versioned URL that changes every release —
// a permanent redirect would be cached by browsers and CDNs and would keep
// handing out an old installer long after it stopped being current.

const APP_REPO = 'danielspils/crumar-seven-editor';
// The releases page: correct for a human, wrong for a platform. Used ONLY when
// the lookup fails, and never written to KV — see below.
const DL_FALLBACK = `https://github.com/${APP_REPO}/releases/latest`;
// Ten minutes. Long enough that a burst of visitors costs one API call, short
// enough that a new release is live on the buttons almost immediately.
const DL_CACHE_TTL = 600;

// RESOLVED, THEN CACHED — AND A FAILURE IS NEVER CACHED. That distinction is
// the whole function. JP Patches shipped this same endpoint and cached a
// fallback URL during a rate-limited lookup; the PC button then served that
// stale answer for as long as the entry lived, so a transient GitHub hiccup
// became a persistently wrong button. Here a miss returns null, the caller
// redirects to the releases page for that ONE request, and the next request
// tries again.
//
// TWO WAYS TO ASK, because the obvious one does not work here. The REST API is
// authoritative and was the first implementation — and it returned 403 with
// `x-ratelimit-remaining: 0` on the very first call from production. The
// unauthenticated API allows 60 requests an hour PER ADDRESS, and a Worker
// does not have its own address: it egresses from Cloudflare's shared pool,
// whose hourly budget is already spent by other tenants. Measured, not
// assumed — that is what the log line below reported.
//
// So the API is tried first and is expected to fail most of the time, and the
// real path is the plain website, which has no such limit:
//
//   1. /releases/latest       302 → …/releases/tag/<tag>     (the tag)
//   2. /releases/expanded_assets/<tag>                       (the filenames)
//
// Step 2 reads the ACTUAL asset names out of the markup rather than building
// a filename from a pattern. A guessed name that happens to be right today is
// a silent breakage the first time the naming changes; a name read from the
// page is either there or the lookup fails loudly into the fallback.
//
// `expanded_assets` is an internal GitHub fragment, not a documented API, and
// it may change without notice. That is acceptable ONLY because every failure
// path here ends at the releases page — a worse first impression, never a
// broken link — and because it says so in the log when it happens.
async function resolveDownload(env, platform) {
  const key = `dlurl:${platform}`;
  const cached = await env.PINGS.get(key);
  if (cached) return cached;

  const wanted = platform === 'mac' ? '.dmg' : '.exe';
  const url = (await viaApi(platform, wanted)) || (await viaWebsite(platform, wanted));
  if (!url) return null;

  await env.PINGS.put(key, url, { expirationTtl: DL_CACHE_TTL });
  return url;
}

async function viaApi(platform, wanted) {
  try {
    const res = await fetch(`https://api.github.com/repos/${APP_REPO}/releases/latest`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'seven-relay' },
    });
    if (!res.ok) {
      // WHY, not just that it failed. A silent fallback is indistinguishable
      // from a working button pointing at the wrong place, and the remaining
      // rate-limit budget is the one number that tells them apart.
      console.log(`[download] api ${res.status} for ${platform}`
        + ` (ratelimit-remaining: ${res.headers.get('x-ratelimit-remaining')})`);
      return null;
    }
    const release = await res.json();
    // .blockmap sits beside each installer and ends in .exe.blockmap, so a bare
    // endsWith would take it — the same trap the site's own script documents.
    const asset = (release.assets || []).find(
      (a) => a.name.endsWith(wanted) && !a.name.endsWith('.blockmap')
    );
    return (asset && asset.browser_download_url) || null;
  } catch (err) {
    console.log(`[download] api threw for ${platform}: ${err && err.message}`);
    return null;
  }
}

async function viaWebsite(platform, wanted) {
  try {
    const head = await fetch(`https://github.com/${APP_REPO}/releases/latest`, {
      redirect: 'manual',
      headers: { 'user-agent': 'seven-relay' },
    });
    const loc = head.headers.get('location') || '';
    const tag = (/\/releases\/tag\/([^/?#]+)/.exec(loc) || [])[1];
    if (!tag) {
      console.log(`[download] no tag in redirect for ${platform}: ${head.status} ${loc}`);
      return null;
    }
    const page = await fetch(`https://github.com/${APP_REPO}/releases/expanded_assets/${tag}`, {
      headers: { 'user-agent': 'seven-relay' },
    });
    if (!page.ok) {
      console.log(`[download] expanded_assets ${page.status} for ${tag}`);
      return null;
    }
    const html = await page.text();
    // Real filenames off real hrefs — never a name assembled from the tag.
    const names = [...html.matchAll(/\/releases\/download\/[^"'\s]+?\/([^"'\s\/]+)/g)]
      .map((m) => m[1]);
    const name = names.find((n) => n.endsWith(wanted) && !n.endsWith('.blockmap'));
    if (!name) {
      console.log(`[download] no ${wanted} among ${names.length} assets on ${tag}`);
      return null;
    }
    return `https://github.com/${APP_REPO}/releases/download/${tag}/${name}`;
  } catch (err) {
    console.log(`[download] website path threw for ${platform}: ${err && err.message}`);
    return null;
  }
}

// A REDIRECT SERVED IS NOT A COMPLETED DOWNLOAD, and this count must never be
// added to GitHub's. GitHub counts the transfer finishing; this counts the
// browser being sent. It is strictly larger — cancelled transfers, bots and
// link previews all land here — and its value is the thing GitHub cannot
// give at all: WHERE. Same key shape as the pings so the two read alike.
async function countDownload(env, platform, country) {
  const day = today();
  const month = new Date().toISOString().slice(0, 7);
  const bump = async (key, ttl) => {
    const next = (Number(await env.PINGS.get(key)) || 0) + 1;
    await env.PINGS.put(key, String(next), ttl ? { expirationTtl: ttl } : undefined);
  };
  await bump(`dl:${day}:${platform}:${country}`, PING_TTL_SECONDS);
  await bump(`dlm:${month}:${platform}:${country}`, null);   // permanent
}

async function handleDownload(request, env, ctx, platform, count = true) {
  const country = (request.cf && request.cf.country) || 'XX';
  const url = await resolveDownload(env, platform);
  // Counted even when the lookup failed: somebody still asked for a download,
  // and a count that quietly omits the broken days would hide exactly the
  // period worth knowing about.
  if (count && ctx) ctx.waitUntil(countDownload(env, platform, country));
  return new Response(null, {
    status: 302,
    headers: {
      location: url || DL_FALLBACK,
      // Belt and braces against an intermediary caching a versioned target.
      'cache-control': 'no-store',
    },
  });
}

// GET /version — what the buttons currently point at, for the page to SHOW.
//
// The site used to ask GitHub's API for this directly from the visitor's
// browser. That works for one person and fails for an office: 60 requests an
// hour per address, and a failure meant the page silently named no version at
// all. Asking the relay instead costs the visitor nothing, is answered from
// the same ten-minute cache the redirect uses, and means the browser never
// talks to GitHub at all.
//
// It reports the tag it RESOLVED, so the version on the page is by
// construction the version the button hands you — not a number typed into the
// site that has to be remembered at release time. Nothing here is ever
// hardcoded; if the lookup fails, the field is null and the page says nothing
// rather than something stale.
async function handleVersion(env) {
  const out = { ok: true, tag: null, mac: null, pc: null };
  for (const platform of ['mac', 'pc']) {
    const url = await resolveDownload(env, platform);
    if (!url) continue;
    const m = /\/releases\/download\/([^/]+)\/([^/]+)$/.exec(url);
    if (!m) continue;
    out.tag = out.tag || m[1];
    out[platform] = { name: m[2], url };
  }
  return json(out);
}

// GET /downloads — what the redirect has served, by month and country. Kept
// separate from /totals so nothing can accidentally sum a redirect with a
// check-in; they answer different questions.
async function handleDownloadStats(env) {
  const acc = { byMonth: {}, byCountry: {}, byPlatform: {}, total: 0 };
  let cursor;
  do {
    const page = await env.PINGS.list({ prefix: 'dlm:', cursor });
    for (const k of page.keys) {
      const parts = k.name.split(':');        // dlm:<YYYY-MM>:<platform>:<country>
      if (parts.length !== 4) continue;
      const [, month, platform, country] = parts;
      const n = Number(await env.PINGS.get(k.name)) || 0;
      if (!n) continue;
      acc.byMonth[month] = (acc.byMonth[month] || 0) + n;
      acc.byCountry[country] = (acc.byCountry[country] || 0) + n;
      acc.byPlatform[platform] = (acc.byPlatform[platform] || 0) + n;
      acc.total += n;
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return json({ ok: true, meaning: 'Redirects served by /download/*. Browsers SENT to an installer, not transfers finished. Never add to GitHub download counts.', downloads: acc });
}

// The metrics page reads /totals and /ping/stats from the site's own origin,
// so those two answer CORS. /ping is called by the APP, which sends no Origin
// and needs none — and a browser being unable to POST a ping is a feature.
const READ_CORS = {
  'access-control-allow-origin': 'https://thissevengoestoeleven.com',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: READ_CORS });
    }
    if (request.method === 'POST' && url.pathname === '/ping') {
      return handlePing(request, env, ctx);
    }
    if (request.method === 'GET' && url.pathname === '/ping/stats') {
      const res = await handlePingStats(request, env);
      for (const [k, v] of Object.entries(READ_CORS)) res.headers.set(k, v);
      return res;
    }
    if (request.method === 'GET' && url.pathname === '/totals') {
      const res = await handleTotals(env);
      for (const [k, v] of Object.entries(READ_CORS)) res.headers.set(k, v);
      return res;
    }
    // HEAD IS ANSWERED LIKE GET. A link checker sends HEAD, and a route that
    // 302s to a browser while 404ing to curl -I reads as a broken button to
    // exactly the person auditing the buttons. The response carries no body
    // either way — it is a redirect — so there is nothing to strip.
    const readMethod = request.method === 'GET' || request.method === 'HEAD';
    if (readMethod && (url.pathname === '/download/mac' || url.pathname === '/download/pc')) {
      // A HEAD is a link check, not a person downloading, so it is NOT counted.
      return handleDownload(request, env, ctx, url.pathname.endsWith('mac') ? 'mac' : 'pc',
        request.method === 'GET');
    }
    if (readMethod && url.pathname === '/version') {
      const res = await handleVersion(env);
      for (const [k, v] of Object.entries(READ_CORS)) res.headers.set(k, v);
      return res;
    }
    if (request.method === 'GET' && url.pathname === '/downloads') {
      const res = await handleDownloadStats(env);
      for (const [k, v] of Object.entries(READ_CORS)) res.headers.set(k, v);
      return res;
    }
    return json({ ok: false, error: 'not found' }, 404);
  },
};
