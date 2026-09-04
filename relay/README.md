# Active-install relay

One Cloudflare Worker. The app checks in once a day; this counts the check-in
and nothing else.

It exists because neither of the other two sources can answer "how many
installs are actually running, and on which version". A website sees visits.
GitHub sees a download counter with no geography and no idea whether anybody
kept the app. Only the app can say it is still here.

## What it stores

    pg:<YYYYMMDD>:<platform>:<version>:<country>   count, 90-day TTL
    pgm:<YYYY-MM>:<platform>:<country>             count, permanent

No identifier, and none derived. See the privacy note at the top of
`worker.js` before changing anything in here — the design depends on the app's
once-a-day rule, and adding a field to the payload is a decision, not a tweak.

## Deploy

Needs a Cloudflare account with the `thissevengoestoeleven.com` zone on it.

    npm install -g wrangler          # once
    wrangler login                   # opens a browser; no token is stored here

    # 1. Create the KV namespace and paste the id into wrangler.toml
    wrangler kv namespace create PINGS

    # 2. Deploy
    cd relay && wrangler deploy

    # 3. Check it is alive — expect {"ok":true,"active":{...}}
    curl -s https://ping.thissevengoestoeleven.com/totals

**`/totals` lags by up to a minute.** KV's `list` is eventually consistent, so
a ping shows up in `/ping/stats` immediately and in `/totals` about 45 seconds
later — measured on the first deploy, 2026-08-24. It reads as a bug the first
time you see it and is not one; don't go looking for a fault in `bumpMonthly`.

**`wrangler kv` reads a LOCAL store unless you say `--remote`.** In Wrangler 4
every `kv key list|get|delete` defaults to the simulated namespace under
`.wrangler/`, not the one the deployed Worker uses. On 2026-09-03 that reported
this namespace EMPTY while `/ping/stats` was returning three pings — which
reads as "the data is already gone" and stops you looking. Every KV command
against this relay takes `--remote`:

    wrangler kv key list --namespace-id=<id> --remote --prefix=pg

And check the id against the DEPLOYED Worker rather than wrangler.toml, since
a binding can be changed in the dashboard without touching the file:

    wrangler versions view <version-id> --name seven-relay

**Two stores, and one of them is not derived.** `/ping/stats` sums the `pg:`
day keys at read time, so removing those changes it. `pgm:` is a separate
permanent rollup incremented at WRITE time, and `/totals` reads it directly —
so deleting the day keys alone leaves the monthly and country totals unchanged
and the two halves disagreeing. Anything that removes pings has to remove
both.

**No secrets.** Nothing here needs a token, and nothing here should ever be
given one. The Worker holds counts of app launches; that is the whole reason
it can be published in full and read by anybody.

## Endpoints

| | |
| --- | --- |
| `POST /ping` | `{ platform, version }` — the app, once a day |
| `GET /ping/stats?since=YYYYMMDD` | 90-day window, with per-version detail |
| `GET /totals` | permanent monthly aggregate, by month and country |

The two GETs allow cross-origin reads from the site so `/metrics/` can use
them. `POST /ping` does not, and does not need to: the app sends no Origin,
and a browser being unable to post a ping is a feature.
