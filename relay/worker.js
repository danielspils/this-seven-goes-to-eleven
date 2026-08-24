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
    return json({ ok: false, error: 'not found' }, 404);
  },
};
