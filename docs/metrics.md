---
layout: default
permalink: /metrics/
title: Metrics
sitemap: false
robots: noindex, nofollow
description: Usage and download figures for This Seven Goes to Eleven.
---

# Metrics

<p class="muted" id="m-generated">Reading the latest figures…</p>

<div class="stats">
  <div class="stat"><span class="lbl">Installers downloaded</span><span class="val" id="m-installers">—</span></div>
  <div class="stat"><span class="lbl">Mac</span><span class="val" id="m-mac">—</span></div>
  <div class="stat"><span class="lbl">Windows</span><span class="val" id="m-win">—</span></div>
  <div class="stat"><span class="lbl">Releases</span><span class="val" id="m-releases">—</span></div>
  <div class="stat"><span class="lbl">Notes posts</span><span class="val">{{ site.posts.size }}</span></div>
</div>

<h2>Every asset</h2>

<div id="m-assets"><p class="muted">—</p></div>

<h2>Site visits</h2>

<p class="muted">Counted by <a href="https://{{ site.goatcounter }}.goatcounter.com">GoatCounter</a>
(no cookies, nothing to consent to) and read there rather than repeated here.
Page views and downloads are never added together: a visit and a completed
download are different facts.</p>

<p class="muted">Download <em>button presses</em> are counted there too, as
events under <code>download/mac/&lt;version&gt;</code> and
<code>download/pc/&lt;version&gt;</code> — that is the intent to install, and
GoatCounter's own country reading comes with it. It is a third figure and not a
substitute for either of the others: a press that never finishes is not a
download, and an install from a link that never touched this site is a download
with no press behind it.</p>

<script>
// The numbers come from docs/metrics/data.json, refreshed daily by the
// Download report workflow whether or not there were downloads — so this page
// is current on quiet days too. Fetched rather than baked in at build time
// because the data file changes on its own schedule, and a stale page that
// looks live is worse than one that says it could not read.
(function () {
  const el = (id) => document.getElementById(id);
  const isInstaller = (name) => name.endsWith('.dmg') || name.endsWith('.exe');

  fetch('{{ "/metrics/data.json" | relative_url }}?cb=' + Date.now())
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => {
      const assets = d.assets || [];
      const sum = (pick) => assets.filter(pick).reduce((n, a) => n + a.count, 0);

      // INSTALLERS ONLY in the headline. The raw total counts latest.yml and
      // the blockmaps, which are the updater checking in, not a person
      // downloading the app — and one machine polling for updates would
      // quietly inflate "downloads" forever.
      el('m-installers').textContent = sum((a) => isInstaller(a.name));
      el('m-mac').textContent = sum((a) => a.name.endsWith('.dmg'));
      el('m-win').textContent = sum((a) => a.name.endsWith('.exe'));
      el('m-releases').textContent = d.releases ?? '—';

      const when = d.generated ? new Date(d.generated) : null;
      el('m-generated').textContent = when
        ? `GitHub's own counters, as of ${when.toLocaleString()}.`
        : "GitHub's own counters.";

      const rows = assets
        .slice()
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map((a) => `<tr><td>${a.name}</td><td>${a.tag}</td><td class="num">${a.count}</td></tr>`)
        .join('');
      el('m-assets').innerHTML = rows
        ? `<table class="m-table"><thead><tr><th>Asset</th><th>Release</th><th class="num">Downloads</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="muted">No releases yet.</p>';
    })
    .catch(() => {
      el('m-generated').textContent =
        'Could not read the figures just now. They are regenerated daily.';
    });
})();
</script>
