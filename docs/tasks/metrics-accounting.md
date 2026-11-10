# TASK: full accounting of download metrics, then a fix proposal

Gather first. Change nothing in this pass.

Repos: crumar-seven-editor + this-seven-goes-to-eleven, JP-Patches-App,
roland-junox-editor + junox-site. Read each repo's CLAUDE.md before working in it.

## 0. Confirm today's deploy took

Both relays were redeployed on 9 Nov with a changed fingerprint key shape.

    curl -sS https://ping.thissevengoestoeleven.com/download/agents
    curl -sS https://lend.jx-3p.com/download/agents

Entries should now carry a `countries` object. Keys written before the deploy
read as `??` — expected, not a bug. If nothing carries countries, the deploy did
not take and the rest of this pass is measuring the old build.

## 1. What each project measures today

Per project, a row for every number that reaches an email or a page: the label,
the source (GitHub download_count / relay press / daily ping / GoatCounter), and
what real-world thing it counts. Name the file and line that decides it.

JUNO-Xtra has none of this yet. Say so plainly rather than inventing.

## 2. The Tor finding

Tor presses have been exactly Mac=PC on both sites for a week — 14 as 7/7 on the
Seven, 20 as 10/10 on JP. The fingerprints now carry country. Say which agents
the Tor presses come from and whether they are counted or filtered.

If a week of data cannot answer it, say that instead of guessing.

## 3. Fixable or not, per source

- Relay presses: we own the Worker. Fixable, and two rules already shipped
  (mobile excluded 4 Nov, non-browser-shaped excluded 9 Nov).
- GitHub download_count: no user-agent, no filtering, not correctable even in
  principle. Report how much of each project's headline number comes from it.
- Daily ping: counts installs that opened the app. The only source counting
  PEOPLE. Report how much of it is surfaced anywhere today.

## 4. The zero-day question

Neither app has had a zero-download day in 17 days (Seven 1-13/day, JP 1-9/day).
Either real steady interest or something on a schedule. Check what the per-asset
data supports. "Cannot tell from this" is an acceptable answer and better than a
guess.

## 5. Then propose, do not build

One proposal across all three projects: which numbers survive, what each is
called, which leads, what gets dropped.

Daniel's leaning, argue against it if the data disagrees: downloads and presses
both count REQUESTS, and requests can be machines. The ping counts people. So
the ping should lead, and the other two should be labelled traffic, not audience.

JUNO-Xtra ships with nothing yet. It is the one chance to build this right
rather than retrofit it. Include what it should launch with.

## Report

The accounting table, the Tor finding, and the proposal.
