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

  // THE CLICK EVENT THAT USED TO LIVE HERE IS GONE (2026-09-09).
  //
  // It fired window.goatcounter.count() on click and then the browser navigated
  // to the relay. A fire-and-forget request racing a navigation loses, and it
  // lost almost every time: ONE press recorded in the two weeks since
  // 2026-08-23, against FORTY-ONE redirects the relay logged for the same
  // clicks. It was not misconfigured — it was counting from the wrong side of a
  // navigation, and it produced a number that looked like a count and was not.
  //
  // The relay counts the same presses server-side at the moment of redirect,
  // where nothing can race it, and carries country as well. That figure is on
  // /metrics under "Started from the website".
  //
  // GoatCounter itself stays: page views and referrers are unaffected and are
  // still recorded by the tag in the layout.
})();
