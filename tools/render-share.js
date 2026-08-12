'use strict';

// Renders tools/share-card.html to a PNG at exactly the size link previews
// want (1200x630). Uses Electron from the editor repo — the card is built from
// the site's own stylesheet and the app's own panel artwork, so this stays
// truthful when either changes: re-run it rather than editing a picture.
//
//   npx --prefix ~/crumar-seven-editor electron tools/render-share.js

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.join(__dirname, '..', 'docs', 'assets', 'img', 'share.png');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 630,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadFile(path.join(__dirname, 'share-card.html'));
  // Web fonts and the script face need a beat to settle before capture.
  await new Promise((r) => setTimeout(r, 1200));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(OUT, image.toPNG());
  console.log(`wrote ${OUT} (${image.getSize().width}x${image.getSize().height})`);
  app.exit(0);
});
