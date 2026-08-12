'use strict';

// Draws the site's favicon set from one description, in plain Node — no image
// tools, no hand-edited bitmaps. Re-run it rather than touching a PNG:
//
//   node tools/make-favicons.js
//
// The mark is a knob seen head on, pointing up: a Crumar-green disc with a
// darker rim and the indicator slot CUT OUT of it. Cut out rather than drawn
// dark, so the icon carries no background of its own — at 16px on a light tab
// bar the slot reads white, on a dark one it reads dark, and the knob itself is
// the only thing the icon asserts. Green is the panel's DEPTH/RATE legend
// (#4fb96a), the same one the editor uses for actions.
//
// The indicator must not reach the rim. A slot that breaks the outer edge is
// the universal power glyph, and that is what the eye reports at 16px however
// the rest of it is drawn.
//
// Why a generator: the old favicon.ico was a PNG with an .ico name, which
// Safari refuses (it wants a real ICO container). Getting that right by hand
// once is how it silently rots the next time.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT_IMG = path.join(__dirname, '..', 'docs', 'assets', 'img');
const OUT_ICO = path.join(__dirname, '..', 'docs', 'favicon.ico');

const GREEN = [0x4f, 0xb9, 0x6a];
const RIM = [0x35, 0x8e, 0x50];
const PANEL = [0x0b, 0x0b, 0x0c]; // only for the Apple touch icon, which cannot be transparent

// Geometry in unit coordinates, so every size is the same drawing.
const R_OUT = 0.46;
const R_RIM = 0.38;   // inside this is the face; between the two is the rim
const SLOT_HALF = 0.055;
// The indicator stops WELL SHORT of the rim. Run it to the edge and the mark
// stops being a knob and becomes the power symbol — which is what the first
// version did.
const SLOT_TOP = 0.18;
const SLOT_BOT = 0.42;

// 4x supersampling: the whole legibility of a 16px icon lives in its edges.
const SS = 4;

function sample(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const r = Math.hypot(dx, dy);
  if (r > R_OUT) return null;
  // The indicator: a capsule from SLOT_TOP to SLOT_BOT, removed from the disc.
  const cy = Math.min(Math.max(v, SLOT_TOP), SLOT_BOT);
  if (Math.hypot(dx, v - cy) <= SLOT_HALF) return null;
  return r > R_RIM ? RIM : GREEN;
}

function draw(size, { background = null, inset = 0 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  const scale = 1 - inset * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size - 0.5) / scale + 0.5;
          const v = ((y + (sy + 0.5) / SS) / size - 0.5) / scale + 0.5;
          const c = sample(u, v);
          if (c) { hit++; r += c[0]; g += c[1]; b += c[2]; }
        }
      }
      const i = (y * size + x) * 4;
      const a = hit / n;
      if (background) {
        // Composite over the background: an Apple touch icon with alpha gets a
        // black square from iOS anyway, so it is better to choose the colour.
        px[i] = Math.round((r / (hit || 1)) * a + background[0] * (1 - a));
        px[i + 1] = Math.round((g / (hit || 1)) * a + background[1] * (1 - a));
        px[i + 2] = Math.round((b / (hit || 1)) * a + background[2] * (1 - a));
        px[i + 3] = 255;
      } else if (hit) {
        px[i] = Math.round(r / hit);
        px[i + 1] = Math.round(g / hit);
        px[i + 2] = Math.round(b / hit);
        px[i + 3] = Math.round(a * 255);
      }
    }
  }
  return px;
}

// --- PNG (8-bit RGBA, one filter-0 scanline per row) -------------------------

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- ICO (a real container, with PNG payloads) -------------------------------

function ico(entries) {
  const dir = Buffer.alloc(6 + entries.length * 16);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(entries.length, 4);
  let offset = dir.length;
  entries.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    dir[e] = size === 256 ? 0 : size;
    dir[e + 1] = size === 256 ? 0 : size;
    dir[e + 2] = 0; // palette
    dir[e + 3] = 0;
    dir.writeUInt16LE(1, e + 4);   // planes
    dir.writeUInt16LE(32, e + 6);  // bits per pixel
    dir.writeUInt32BE(0, e + 8);
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([dir, ...entries.map((e) => e.data)]);
}

// --- SVG: the same drawing, for browsers that take one ----------------------

const svg = () => {
  const c = (n) => +(n * 64).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- Generated by tools/make-favicons.js — edit that script, not this file.
       A knob seen head on, pointing up: Crumar green (#4fb96a, the panel's
       DEPTH/RATE legend) with a darker rim and the indicator slot cut out, so
       the icon carries no background and reads on a light or dark tab bar. -->
  <mask id="slot">
    <rect width="64" height="64" fill="#fff"/>
    <path d="M32 ${c(SLOT_TOP)}V${c(SLOT_BOT)}" stroke="#000"
          stroke-width="${c(SLOT_HALF * 2)}" stroke-linecap="round"/>
  </mask>
  <g mask="url(#slot)">
    <circle cx="32" cy="32" r="${c(R_OUT)}" fill="#358e50"/>
    <circle cx="32" cy="32" r="${c(R_RIM)}" fill="#4fb96a"/>
  </g>
</svg>`;
};

const write = (file, data) => {
  fs.writeFileSync(file, data);
  console.log(`${path.relative(process.cwd(), file)}  ${data.length} bytes`);
};

const sizes = [16, 32, 48];
const icoEntries = sizes.map((size) => ({ size, data: png(size, draw(size)) }));

write(OUT_ICO, ico(icoEntries));
write(path.join(OUT_IMG, 'favicon-32.png'), png(32, draw(32)));
write(path.join(OUT_IMG, 'favicon.svg'), Buffer.from(svg(), 'utf8'));
// Apple touch icons are composited onto a solid background by iOS, so this one
// picks the panel black rather than letting the OS choose.
write(
  path.join(OUT_IMG, 'apple-touch-icon.png'),
  png(180, draw(180, { background: PANEL, inset: 0.14 }))
);
