// Click the screenshot to open it full size. Uses a native <dialog>, so
// Escape, focus trapping and the backdrop are the browser's job, not ours.
(function () {
  const opener = document.querySelector('.shot-open');
  if (!opener) return;
  const src = opener.querySelector('img').src;
  const alt = opener.querySelector('img').alt;

  const dialog = document.createElement('dialog');
  dialog.className = 'shot-modal';
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  dialog.appendChild(img);
  document.body.appendChild(dialog);

  opener.addEventListener('click', () => dialog.showModal());
  img.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
})();
