// Names the version on the page, and counts the press.
//
// WHAT THIS NO LONGER DOES: resolve the installer. It used to ask GitHub's
// API, from the visitor's browser, which file the newest release held, and
// rewrite each button's href to point at it. That worked, and it had a floor
// nobody could see: the API allows 60 unauthenticated requests an hour PER
// ADDRESS, and on failure the buttons silently stayed pointing at the release
// page — where Mac and PC land identically, on a list of eight files. One
// visitor never approached that limit. An office behind a single outbound
// address does, and a manufacturer clicking "PC" and getting an asset list is
// a worse first impression than it needs to be.
//
// The relay does the resolving now, server-side, cached, in a 302 — so the
// buttons are correct with JavaScript off, with this file blocked, and with
// GitHub's API refusing everyone. See relay/worker.js.
//
// So this file is left with the two jobs that genuinely need a browser:
// showing which version the button will hand you, and counting the press.
(function () {
  const RELAY = 'https://ping.thissevengoestoeleven.com';

  // ── THE VERSION, NAMED BEFORE YOU DOWNLOAD ────────────────────────────
  //
  // The page named no version at all, so a visitor could not tell what they
  // were about to install, or whether it was newer than what they had.
  //
  // It is READ, never written down here. No version string appears anywhere in
  // this repo — the relay reports the tag it actually resolved, so the number
  // on the page is by construction the number the button hands you, and a
  // release never needs a site edit. A hardcoded version is a lie waiting for
  // the next release.
  //
  // If the relay cannot answer, the line stays hidden and the page says
  // nothing. An absent version is a small loss; a WRONG one, left over from a
  // previous release, is the thing worth avoiding.
  const line = document.getElementById('dl-version');
  const buttons = [...document.querySelectorAll('a.panel-btn, a.dl-link')];

  const platformOf = (a) =>
    (a.classList.contains('btn-mac') || a.classList.contains('dl-mac')) ? 'mac'
      : (a.classList.contains('btn-pc') || a.classList.contains('dl-pc')) ? 'pc'
        : null;

  fetch(`${RELAY}/version`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((v) => {
      if (!v || !v.ok || !v.tag) return;
      // The tag carries a leading v; the sentence reads better without it.
      const version = String(v.tag).replace(/^v/, '');
      // Recorded on the buttons so a click is attributed to the release it
      // would actually have fetched, not to whatever is newest by the time
      // anybody reads the figures.
      for (const button of buttons) {
        if (platformOf(button)) button.setAttribute('data-version', v.tag);
      }
      if (line) {
        line.textContent = `Version ${version}`;
        line.hidden = false;
      }
    })
    .catch(() => { /* no version shown, and the buttons work regardless */ });

  // ── COUNTING THE PRESS ────────────────────────────────────────────────
  //
  // A CLICK IS NOT A DOWNLOAD, and the two are never added together. GitHub's
  // counter is the completed transfer; this is the intent. They will disagree,
  // and the difference is itself worth having: presses that never became
  // installs. Same rule this site already applies to page views.
  //
  // The relay now counts these too, server-side, and that count is the more
  // complete one — it survives this file being blocked. This stays because it
  // is the only one that can see the version, and because GoatCounter is where
  // the site's other numbers already live.
  //
  // Fire-and-forget by construction: `count` is queued and the navigation
  // proceeds regardless. If GoatCounter is blocked, slow, or absent, this does
  // nothing at all and the download is untouched — the button's job is the
  // download, and no measurement may stand in front of it.
  for (const button of buttons) {
    const platform = platformOf(button);
    if (!platform) continue;
    button.addEventListener('click', () => {
      try {
        if (!window.goatcounter || typeof window.goatcounter.count !== 'function') return;
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
