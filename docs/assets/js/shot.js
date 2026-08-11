// Click any screenshot to open it full size. A native <dialog> gives Escape,
// focus handling and backdrop dismissal for free.
(function () {
  const openers = document.querySelectorAll('.shot-open');
  if (!openers.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'shot-modal';
  const img = document.createElement('img');
  dialog.appendChild(img);
  document.body.appendChild(dialog);

  for (const opener of openers) {
    opener.addEventListener('click', () => {
      const source = opener.querySelector('img');
      img.src = source.src;
      img.alt = source.alt;
      dialog.showModal();
    });
  }
  img.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
})();
