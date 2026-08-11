// Click any screenshot to open it full size, then page through the set with
// the arrow keys or the on-screen controls. A native <dialog> supplies
// Escape, focus handling and the backdrop.
(function () {
  const openers = [...document.querySelectorAll('.shot-open')];
  if (!openers.length) return;

  const shots = openers.map((o) => {
    const img = o.querySelector('img');
    const cap = o.closest('.shot')?.querySelector('figcaption');
    return { src: img.src, alt: img.alt, caption: cap ? cap.textContent : '' };
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
    img.src = shots[index].src;
    img.alt = shots[index].alt;
    caption.textContent = shots.length > 1
      ? `${shots[index].caption} — ${index + 1} of ${shots.length}`
      : shots[index].caption;
  };

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
