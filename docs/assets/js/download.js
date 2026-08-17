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
        button.href = asset.browser_download_url;
        button.setAttribute('data-version', release.tag_name || '');
      }
    })
    .catch(() => { /* the button already points at the release page */ });
})();
