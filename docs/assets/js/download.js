// Points each download button at the right FILE in the newest release.
//
// No version is written down anywhere on this site. The buttons ship pointing
// at /releases/latest, which GitHub redirects to whatever the newest release
// is — so with JavaScript off, or if any of this fails, the button still lands
// somewhere correct and a release never needs a site edit. What this adds is
// the last hop: resolving that release to the actual .dmg or .exe, so a
// visitor gets the installer rather than a page of assets to choose from.
//
// GitHub's API allows cross-origin reads and permits 60 unauthenticated
// requests an hour per address, which is far more than this page will use.
// Every failure path is the same: leave the button exactly as it was.
(function () {
  const REPO = 'danielspils/crumar-seven-editor';

  // Every download control on the page: the panel buttons in the header, the
  // big pair on the landing page, and the phone strip's two links. All of them
  // ship pointing at /releases/latest, so all of them get the same last hop.
  const buttons = [...document.querySelectorAll('a.panel-btn, a.dl-link')];
  if (!buttons.length) return;

  const wanted = (a) => {
    if (a.classList.contains('btn-mac') || a.classList.contains('dl-mac')) {
      return (name) => name.endsWith('.dmg');
    }
    if (a.classList.contains('btn-pc') || a.classList.contains('dl-pc')) {
      return (name) => name.endsWith('.exe');
    }
    return null;
  };
  if (!buttons.some(wanted)) return;

  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((release) => {
      const assets = release.assets || [];
      for (const button of buttons) {
        const match = wanted(button);
        if (!match) continue;
        // .blockmap sits beside each installer and ends in .exe.blockmap —
        // endsWith('.exe') would take it. Exclude it explicitly.
        const asset = assets.find((a) => match(a.name) && !a.name.endsWith('.blockmap'));
        if (!asset) continue;
        // setAttribute, NOT `.href =`. The panel buttons are SVG anchors, and
        // an SVGAElement's href is a read-only SVGAnimatedString: assigning to
        // it fails silently, which left those two buttons on the release page
        // while the plain links resolved (measured on the live site).
        button.setAttribute('href', asset.browser_download_url);
        button.setAttribute('data-version', release.tag_name || '');
      }
    })
    .catch(() => { /* the button already points at the release page */ });

  // ── COUNTING THE CLICK ────────────────────────────────────────────────
  //
  // GitHub reports a number and nothing else — never where a download came
  // from, and never how many people pressed a button without finishing. This
  // records the PRESS, which is the only half this site can see.
  //
  // A CLICK IS NOT A DOWNLOAD, and the two are never added together. GitHub's
  // counter is the completed transfer; this is the intent. They will disagree,
  // and the difference is itself worth having: presses that never became
  // installs. Same rule this site already applies to page views.
  //
  // GoatCounter, so it stays cookieless and there is nothing to consent to. It
  // is the same script the layout already loads, asked to record an event
  // rather than a page — and the country comes from GoatCounter's own reading
  // of the request, not from anything stored on the visitor.
  //
  // Fire-and-forget by construction: `count` is queued and the navigation
  // proceeds regardless. If GoatCounter is blocked, slow, or absent, this does
  // nothing at all and the download is untouched — the button's job is the
  // download, and no measurement may stand in front of it.
  const platformOf = (a) =>
    (a.classList.contains('btn-mac') || a.classList.contains('dl-mac')) ? 'mac'
      : (a.classList.contains('btn-pc') || a.classList.contains('dl-pc')) ? 'pc'
        : null;

  for (const button of buttons) {
    const platform = platformOf(button);
    if (!platform) continue;
    button.addEventListener('click', () => {
      try {
        if (!window.goatcounter || typeof window.goatcounter.count !== 'function') return;
        // The version is whatever the button actually resolved to, so a click
        // is attributed to the release it would have fetched — not to whatever
        // is newest by the time anybody reads the figures.
        const version = button.getAttribute('data-version') || 'unresolved';
        window.goatcounter.count({
          path: `download/${platform}/${version}`,
          title: `Download ${platform} ${version}`,
          event: true,
        });
      } catch { /* never let counting break a download */ }
    });
  }
})();
