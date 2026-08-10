// Header knob: drag (or arrow-key) to change the logo's colour. The hue is a
// CSS custom property the wordmark reads, and it persists per visitor.
(function () {
  const KEY = 'tsgte.hue';
  const knob = document.getElementById('hue-knob');
  if (!knob) return;

  // Flutes, drawn once so the SVG file stays readable.
  const ribs = knob.querySelector('.k-ribs');
  if (ribs) {
    for (let i = 0; i < 30; i++) {
      const a = (i * 12) * Math.PI / 180;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', 52 + 22.8 * Math.sin(a)); l.setAttribute('y1', 52 - 22.8 * Math.cos(a));
      l.setAttribute('x2', 52 + 27.3 * Math.sin(a)); l.setAttribute('y2', 52 - 27.3 * Math.cos(a));
      ribs.appendChild(l);
    }
  }

  let hue = Number(localStorage.getItem(KEY));
  if (!Number.isFinite(hue)) hue = 40;

  function apply() {
    const root = document.documentElement.style;
    root.setProperty('--seven-hue', String(Math.round(hue)));
    // The knob lights in the colour it is setting — the instrument's own idiom.
    root.setProperty('--knob-glow', `hsl(${hue} 100% 55% / .30)`);
    root.setProperty('--knob-bore', `hsl(${hue} 100% 72%)`);
    knob.setAttribute('aria-valuenow', String(Math.round(hue)));
    localStorage.setItem(KEY, String(Math.round(hue)));
  }
  apply();

  // Vertical drag reads as turning, the way a plugin knob does.
  let dragging = false, lastY = 0;
  knob.addEventListener('pointerdown', (e) => {
    dragging = true; lastY = e.clientY; knob.setPointerCapture(e.pointerId); e.preventDefault();
  });
  knob.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    hue = (hue + (lastY - e.clientY) * 2 + 360) % 360;
    lastY = e.clientY;
    apply();
  });
  const stop = () => { dragging = false; };
  knob.addEventListener('pointerup', stop);
  knob.addEventListener('pointercancel', stop);
  knob.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 8
      : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -8 : 0;
    if (!step) return;
    e.preventDefault();
    hue = (hue + step + 360) % 360;
    apply();
  });
})();
