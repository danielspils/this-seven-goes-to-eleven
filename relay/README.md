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
