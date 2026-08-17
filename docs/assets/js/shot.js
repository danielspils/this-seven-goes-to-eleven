// Click any screenshot to open it full size, then page through the set with
// the arrow keys or the on-screen controls. A native <dialog> supplies
// Escape, focus handling and the backdrop.
(function () {
  const openers = [...document.querySelectorAll('.shot-open')];
  if (!openers.length) return;

  // No captions under the thumbnails — the screenshots are the point and a
  // line of type under each put the page height back where it started
  // (Daniel, 2026-08-12). The enlarged view keeps its position counter, which
  // is the one thing a reader cannot work out from the picture.
  // The strip shows small JPEGs; the enlarged view loads the full PNG. Three
  // full-size screenshots came to 1.5MB, all of it downloaded to draw
  // thumbnails a few hundred pixels wide — on a phone the dialog opened onto a
  // dimmed screen and sat there waiting for an image (Daniel, 2026-08-12).
  const shots = openers.map((o) => {
    const img = o.querySelector('img');
    return { thumb: img.src, full: img.dataset.full || img.src, alt: img.alt };
  });
  let index = 0;

  const dialog = document.createElement('dialog');
  dialog.className = 'shot-modal';
  dialog.innerHTML =
    '<button class="shot-nav prev" aria-label="Previous">‹</button>' +
    '<img alt="">' +
    '<button class="shot-nav next" aria-label="Next">›</button>' +
    '<p class="shot-caption"></p>';
  document.body.appendChild(dialog);

  const img = dialog.querySelector('img');
  const caption = dialog.querySelector('.shot-caption');
  const show = (i) => {
    index = (i + shots.length) % shots.length;   // wraps both ways
    const shot = shots[index];
    // The thumbnail first — it is already downloaded, so the dialog has
    // something in it the instant it opens — then the full image swapped in
    // behind it once it arrives. The guard matters: on a slow connection you
    // can page past a picture before it loads, and without it a late arrival
    // would replace whatever you had moved on to.
    img.src = shot.thumb;
    img.alt = shot.alt;
    caption.textContent = shots.length > 1 ? `${index + 1} of ${shots.length}` : '';
    if (shot.full !== shot.thumb) {
      const full = new Image();
      full.onload = () => { if (shots[index] === shot) img.src = shot.full; };
      full.src = shot.full;
    }
  };

  // Background scrolling is locked in CSS, off the [open] attribute the
  // browser maintains itself — deliberately not a class toggled from here,
  // which would leave the page unscrollable if any exit path missed it.
  openers.forEach((o, i) => o.addEventListener('click', () => { show(i); dialog.showModal(); }));
  dialog.querySelector('.prev').addEventListener('click', (e) => { e.stopPropagation(); show(index - 1); });
  dialog.querySelector('.next').addEventListener('click', (e) => { e.stopPropagation(); show(index + 1); });
  img.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
  });
})();
