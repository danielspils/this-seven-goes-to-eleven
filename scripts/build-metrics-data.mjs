// Refresh docs/metrics/data.json, which the /metrics page reads. Runs every
// day whether or not there were downloads — the page shouldn't go stale on
// quiet days. Placeholder alongside download-report.mjs: correct today, and
// it starts producing real numbers as soon as releases exist.
import { writeFileSync, mkdirSync } from 'node:fs';

const APP_REPO = 'danielspils/crumar-seven-editor';
const headers = { Accept: 'application/vnd.github+json' };
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

const res = await fetch(`https://api.github.com/repos/${APP_REPO}/releases`, { headers });
const releases = res.ok ? await res.json() : [];

const assets = releases.flatMap((r) =>
  (r.assets || []).map((a) => ({
    name: a.name, tag: r.tag_name, count: a.download_count, published: r.published_at,
  })));

mkdirSync('docs/metrics', { recursive: true });
writeFileSync('docs/metrics/data.json', JSON.stringify({
  generated: new Date().toISOString(),
  downloads: assets.reduce((n, a) => n + a.count, 0),
  releases: releases.length,
  assets,
}, null, 2) + '\n');
console.log(`metrics data written — ${releases.length} release(s)`);
