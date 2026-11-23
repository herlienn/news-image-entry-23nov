// News Image — 23 November 2026
// "The World in One Day" — one image summing up the day's world news.
// Drawn entirely in code: own bitmap font, own PNG encoder, stdlib only.
// No network. Deterministic: two runs produce byte-identical output.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// ---------------- PNG encoder (own implementation) ----------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------- 5x7 bitmap font (own design) ----------------
// Each glyph: 7 rows, each a 5-bit number, MSB = leftmost pixel.
const FONT = {
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
  'D': [0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E],
  'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
  'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
  'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
  'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  'S': [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
  'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A],
  'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
  '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
  '3': [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
  '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
  '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
  '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0C, 0x0C],
  ',': [0, 0, 0, 0, 0x0C, 0x04, 0x08],
  ':': [0, 0x0C, 0x0C, 0, 0x0C, 0x0C, 0],
  ';': [0, 0x0C, 0x0C, 0, 0x0C, 0x04, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0E, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  '-': [0, 0, 0, 0x1F, 0, 0, 0],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  '&': [0x0C, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0D],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0A, 0x0A, 0x0A, 0, 0, 0, 0],
  '+': [0, 0x04, 0x04, 0x1F, 0x04, 0x04, 0],
  '=': [0, 0, 0x1F, 0, 0x1F, 0, 0],
  '$': [0x04, 0x0F, 0x14, 0x0E, 0x05, 0x1E, 0x04],
  '|': [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  '•': [0, 0x0E, 0x0E, 0x0E, 0, 0, 0],
  '×': [0, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0],
  '°': [0x0E, 0x11, 0x11, 0x0E, 0, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 0x1F],
  '#': [0x0A, 0x0A, 0x1F, 0x0A, 0x1F, 0x0A, 0x0A],
  '*': [0, 0x04, 0x15, 0x0E, 0x15, 0x04, 0],
  '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
};
function clean(s) {
  return s.toUpperCase()
    .replace(/[’‘]/g, "'").replace(/[—–]/g, '-').replace(/…/g, '...')
    .replace(/[ÀÁÂÃÄÅ]/g, 'A').replace(/[ÈÉÊË]/g, 'E').replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O').replace(/[ÙÚÛÜ]/g, 'U').replace(/Ñ/g, 'N').replace(/Ç/g, 'C');
}
function textW(s, sc) { return clean(s).length * 6 * sc; }

// ---------------- Canvas ----------------
class Cv {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.p = Buffer.alloc(w * h * 3, 255);
  }
  px(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.p[i] = c[0]; this.p[i + 1] = c[1]; this.p[i + 2] = c[2];
  }
  fill(x, y, w, h, c) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c);
  }
  rect(x, y, w, h, c) { // outline, 1px
    this.fill(x, y, w, 1, c); this.fill(x, y + h - 1, w, 1, c);
    this.fill(x, y, 1, h, c); this.fill(x + w - 1, y, 1, h, c);
  }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  lineW(x0, y0, x1, y1, w, c) {
    for (let i = -Math.floor(w / 2); i <= Math.floor(w / 2); i++) {
      this.line(x0 + i, y0, x1 + i, y1, c);
      this.line(x0, y0 + i, x1, y1 + i, c);
    }
  }
  circle(cx, cy, r, c, filled) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (filled ? d <= r * r : d <= r * r && d >= (r - 1) * (r - 1)) this.px(cx + x, cy + y, c);
      }
    }
  }
  tri(x0, y0, x1, y1, x2, y2, c) {
    const minX = Math.max(0, Math.min(x0, x1, x2)), maxX = Math.min(this.w - 1, Math.max(x0, x1, x2));
    const minY = Math.max(0, Math.min(y0, y1, y2)), maxY = Math.min(this.h - 1, Math.max(y0, y1, y2));
    const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
        const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
        const g = 1 - a - b;
        if (a >= 0 && b >= 0 && g >= 0) this.px(x, y, c);
      }
    }
  }
  poly(pts, c) { // filled polygon, scanline
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.max(0, Math.ceil(minY)); y <= Math.min(this.h - 1, maxY); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(Math.round(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])));
        }
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.max(0, xs[i]); x <= Math.min(this.w - 1, xs[i + 1]); x++) this.px(x, y, c);
    }
  }
  ch(ch, x, y, sc, c) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r] & (1 << (4 - col))) this.fill(x + col * sc, y + r * sc, sc, sc, c);
      }
    }
  }
  text(s, x, y, sc, c) {
    const t = clean(s);
    for (let i = 0; i < t.length; i++) this.ch(t[i], x + i * 6 * sc, y, sc, c);
    return x + t.length * 6 * sc;
  }
  textC(s, cx, y, sc, c) { // centred
    this.text(s, Math.round(cx - textW(s, sc) / 2), y, sc, c);
  }
  // single line clipped with ellipsis to maxW
  clip(s, x, y, sc, c, maxW) {
    const t = clean(s);
    const maxChars = Math.max(0, Math.floor(maxW / (6 * sc)));
    let out = t;
    if (t.length > maxChars) out = t.slice(0, Math.max(0, maxChars - 3)) + '...';
    this.text(out, x, y, sc, c);
  }
  // wrap into at most maxLines lines of maxW px; returns lines drawn
  wrap(s, x, y, sc, c, maxW, maxLines, lh) {
    const words = clean(s).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (textW(trial, sc) <= maxW) { cur = trial; continue; }
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines) {
      const last = lines[lines.length - 1];
      if (textW(last, sc) > maxW) {
        const mc = Math.max(0, Math.floor(maxW / (6 * sc)) - 3);
        lines[lines.length - 1] = last.slice(0, mc) + '...';
      }
    }
    for (let i = 0; i < lines.length; i++) this.text(lines[i], x, y + i * lh, sc, c);
    return lines.length;
  }
}

// ---------------- Palette ----------------
const PAPER = [247, 242, 231];
const INK = [20, 20, 20];
const GREY = [90, 90, 88];
const RED = [178, 32, 44];
const BLUE = [31, 78, 121];
const TEAL = [0, 120, 113];
const GOLD = [196, 141, 28];
const SKY = [207, 232, 245];
const SKY2 = [178, 216, 238];
const SEA = [158, 205, 225];
const GREEN = [46, 125, 50];
const LGREEN = [139, 195, 74];
const SAND = [232, 213, 175];
const ORANGE = [230, 126, 34];
const FLAME = [242, 101, 34];
const DARK = [38, 50, 56];
const LAND = [168, 196, 138];
const LAND2 = [140, 178, 120];

// ---------------- Scenes (all drawn, no photos) ----------------
// Each painter fills the box (x,y,w,h) with an original illustration.

// HERO 1: COP31 — globe with a crack, summit flags below. Light sky.
function heroCOP31(c, x, y, w, h) {
  c.fill(x, y, w, h, SKY);
  c.circle(x + 28, y + 24, 11, [255, 244, 190], true); // sun
  // globe
  const gx = x + w / 2, gy = y + 52, gr = 34;
  c.circle(gx, gy, gr, SEA, true);
  c.circle(gx, gy, gr, BLUE, false);
  // continents on globe (simple blobs)
  c.poly([[gx - 22, gy - 12], [gx - 6, gy - 20], [gx + 4, gy - 10], [gx - 2, gy + 2], [gx - 18, gy + 2]], LAND2);
  c.poly([[gx + 8, gy + 4], [gx + 22, gy - 2], [gx + 26, gy + 10], [gx + 12, gy + 18], [gx + 4, gy + 12]], LAND2);
  c.poly([[gx - 14, gy + 14], [gx - 2, gy + 12], [gx + 2, gy + 24], [gx - 12, gy + 26]], LAND2);
  // latitude lines
  c.line(gx - gr, gy, gx + gr, gy, [255, 255, 255]);
  c.line(gx - 28, gy - 18, gx + 28, gy - 18, [255, 255, 255]);
  c.line(gx - 28, gy + 18, gx + 28, gy + 18, [255, 255, 255]);
  // red crack across the globe
  c.lineW(gx - 30, gy - 26, gx - 8, gy - 4, 3, RED);
  c.lineW(gx - 8, gy - 4, gx + 10, gy + 8, 3, RED);
  c.lineW(gx + 10, gy + 8, gx + 30, gy + 26, 3, RED);
  // flags row at the bottom of the scene
  const fy = y + h - 16;
  for (let i = 0; i < 7; i++) {
    const fx = x + 14 + i * 44;
    c.fill(fx, fy - 12, 2, 12, INK);
    const cols = [RED, BLUE, GREEN, GOLD, TEAL, ORANGE, [120, 60, 140]];
    c.fill(fx + 2, fy - 12, 26, 8, cols[i % cols.length]);
  }
}

// HERO 2: Bahrain / Hormuz — tanker at sea, flame and smoke. Light sea.
function heroTanker(c, x, y, w, h) {
  c.fill(x, y, w, h, SKY);
  c.circle(x + w - 30, y + 22, 12, [255, 244, 190], true);
  const seaY = y + h - 34;
  c.fill(x, seaY, w, h - (seaY - y), SEA);
  for (let i = 0; i < 6; i++) c.line(x + 8 + i * 52, seaY + 8 + (i % 2) * 8, x + 34 + i * 52, seaY + 8 + (i % 2) * 8, [255, 255, 255]);
  // tanker hull
  const hx = x + 40, hy = seaY - 16;
  c.poly([[hx, hy], [hx + 220, hy], [hx + 205, hy + 22], [hx + 14, hy + 22]], [90, 40, 32]);
  c.fill(hx + 30, hy - 22, 150, 22, [196, 80, 40]); // containers
  c.fill(hx + 30, hy - 22, 150, 4, [230, 140, 60]);
  c.fill(hx + 190, hy - 34, 22, 34, [240, 240, 235]); // bridge
  c.fill(hx + 196, hy - 30, 10, 6, BLUE);
  // flame + smoke above mid-deck
  const fx = hx + 110;
  c.tri(fx - 12, hy - 20, fx + 12, hy - 20, fx, hy - 44, FLAME);
  c.tri(fx - 7, hy - 20, fx + 7, hy - 20, fx, hy - 34, GOLD);
  c.circle(fx - 16, hy - 48, 7, GREY, true);
  c.circle(fx + 2, hy - 56, 9, GREY, true);
  c.circle(fx + 18, hy - 48, 6, [120, 120, 118], true);
}

// HERO 3: Liverpool 4-0 — green pitch, goal, ball, scoreboard. Light.
function heroFootball(c, x, y, w, h) {
  c.fill(x, y, w, h, [214, 240, 200]); // light pitch
  for (let i = 0; i < 5; i++) c.fill(x, y + i * 26, w, 13, [206, 234, 190]);
  // pitch lines
  c.rect(x + 14, y + 12, w - 28, h - 40, [255, 255, 255]);
  c.line(x + w / 2, y + 12, x + w / 2, y + h - 28, [255, 255, 255]);
  c.circle(x + w / 2, y + (h - 28) / 2 + 6, 16, [255, 255, 255], false);
  // goal
  const gx = x + 26, gy = y + 18;
  c.fill(gx, gy, 4, 34, [255, 255, 255]);
  c.fill(gx, gy, 46, 4, [255, 255, 255]);
  c.fill(gx + 42, gy, 4, 34, [255, 255, 255]);
  for (let i = 0; i < 4; i++) c.line(gx + 4 + i * 10, gy + 4, gx + 4 + i * 10, gy + 32, [200, 200, 200]);
  // ball
  c.circle(x + w - 70, y + h - 58, 9, [255, 255, 255], true);
  c.circle(x + w - 70, y + h - 58, 9, INK, false);
  c.circle(x + w - 70, y + h - 58, 3, INK, true);
  // scoreboard
  const sx = x + w - 118, sy = y + 12;
  c.fill(sx, sy, 104, 26, INK);
  c.text('LIV 4-0 MUN', sx + 8, sy + 9, 1, [255, 255, 255]);
}

// ---- small thumbnails (52x52 boxes) ----
function thJail(c, x, y) { // cartel capture: bars + cuffs
  c.fill(x, y, 52, 52, [226, 232, 240]);
  c.fill(x, y, 52, 52, SKY2);
  for (let i = 0; i < 5; i++) c.fill(x + 6 + i * 10, y + 4, 4, 44, INK);
  c.fill(x, y + 4, 52, 4, INK); c.fill(x, y + 44, 52, 4, INK);
  c.circle(x + 26, y + 26, 6, GOLD, true);
}
function thSkyline(c, x, y) { // strike: skyline + smoke
  c.fill(x, y, 52, 52, SKY);
  c.fill(x + 4, y + 22, 12, 30, DARK); c.fill(x + 18, y + 12, 14, 40, [70, 80, 88]);
  c.fill(x + 34, y + 26, 12, 26, DARK);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) c.fill(x + 7 + i * 5, y + 26 + j * 6, 2, 2, GOLD);
  c.circle(x + 38, y + 10, 6, GREY, true); c.circle(x + 30, y + 6, 5, GREY, true);
  c.lineW(x + 20, y + 12, x + 26, y + 4, 2, ORANGE);
}
function thPlanet(c, x, y) { // BepiColombo: planet + probe
  c.fill(x, y, 52, 52, [24, 32, 54]);
  for (let i = 0; i < 12; i++) c.px(x + (i * 17) % 50 + 1, y + (i * 11) % 50 + 1, [255, 255, 255]);
  c.circle(x + 18, y + 32, 12, [200, 170, 140], true); // Mercury
  c.circle(x + 15, y + 29, 3, [150, 120, 100], true); c.circle(x + 22, y + 36, 2, [150, 120, 100], true);
  c.fill(x + 34, y + 10, 10, 6, GOLD); // probe body
  c.fill(x + 30, y + 11, 4, 4, BLUE); c.fill(x + 44, y + 11, 4, 4, BLUE);
  c.line(x + 34, y + 16, x + 30, y + 24, GOLD);
}
function thChartDown(c, x, y) { // stocks fall
  c.fill(x, y, 52, 52, PAPER);
  c.rect(x + 6, y + 6, 40, 40, INK);
  c.line(x + 6, y + 46, x + 46, y + 46, INK); c.line(x + 6, y + 6, x + 6, y + 46, INK);
  c.lineW(x + 10, y + 12, x + 20, y + 22, 2, RED);
  c.lineW(x + 20, y + 22, x + 30, y + 18, 2, RED);
  c.lineW(x + 30, y + 18, x + 42, y + 38, 2, RED);
  c.tri(x + 38, y + 32, x + 46, y + 32, x + 42, y + 40, RED);
}
function thFlags(c, x, y) { // Shenzhen summit: three flags
  c.fill(x, y, 52, 52, SKY);
  const cols = [RED, [222, 41, 16], BLUE];
  for (let i = 0; i < 3; i++) {
    const fx = x + 6 + i * 15;
    c.fill(fx, y + 8, 2, 34, INK);
    c.fill(fx + 2, y + 8, 12, 8, cols[i]);
    c.fill(fx + 2, y + 16, 12, 2, [255, 255, 255]);
  }
  c.fill(x + 4, y + 42, 44, 4, DARK);
}
function thCricket(c, x, y) { // bat + ball
  c.fill(x, y, 52, 52, [214, 240, 200]);
  c.lineW(x + 14, y + 10, x + 30, y + 40, 4, [210, 180, 140]); // bat
  c.fill(x + 26, y + 34, 10, 8, [210, 180, 140]);
  c.circle(x + 40, y + 14, 5, RED, true);
  c.fill(x + 4, y + 44, 44, 3, [255, 255, 255]);
  c.fill(x + 10, y + 20, 4, 18, [255, 255, 255]); // stumps
  c.fill(x + 16, y + 20, 4, 18, [255, 255, 255]);
}
function thComputer(c, x, y) { // FBI hack: screen + lock
  c.fill(x, y, 52, 52, [226, 232, 240]);
  c.fill(x + 6, y + 8, 40, 26, DARK);
  c.fill(x + 8, y + 10, 36, 22, [16, 60, 90]);
  c.text('0101', x + 10, y + 14, 1, [120, 220, 120]);
  c.text('0101', x + 10, y + 24, 1, [120, 220, 120]);
  c.fill(x + 18, y + 38, 16, 4, DARK);
  c.circle(x + 26, y + 21, 5, GOLD, true);
  c.fill(x + 23, y + 21, 6, 6, GOLD);
}
function thFire(c, x, y) { // factory fire
  c.fill(x, y, 52, 52, [40, 40, 44]);
  c.fill(x + 6, y + 28, 40, 18, [90, 90, 96]);
  c.fill(x + 10, y + 32, 6, 6, GOLD); c.fill(x + 22, y + 32, 6, 6, GOLD); c.fill(x + 34, y + 32, 6, 6, GOLD);
  c.tri(x + 12, y + 28, x + 22, y + 28, x + 17, y + 12, FLAME);
  c.tri(x + 28, y + 28, x + 38, y + 28, x + 33, y + 14, ORANGE);
  c.tri(x + 18, y + 28, x + 26, y + 28, x + 22, y + 20, GOLD);
  c.circle(x + 40, y + 10, 5, GREY, true);
}
function thMissile(c, x, y) { // Houthi strike: missile + dome
  c.fill(x, y, 52, 52, SKY);
  c.lineW(x + 10, y + 40, x + 30, y + 12, 3, [200, 200, 200]);
  c.tri(x + 28, y + 8, x + 34, y + 14, x + 28, y + 16, RED);
  c.circle(x + 12, y + 40, 4, ORANGE, true);
  c.line(x + 8, y + 44, x + 46, y + 44, DARK);
  c.line(x + 20, y + 44, x + 26, y + 30, DARK); c.line(x + 32, y + 44, x + 26, y + 30, DARK);
  c.circle(x + 26, y + 28, 3, GOLD, true);
}
function thRobot(c, x, y) { // killer robots
  c.fill(x, y, 52, 52, [226, 232, 240]);
  c.fill(x + 16, y + 10, 20, 16, [160, 170, 180]); // head
  c.fill(x + 20, y + 15, 4, 4, RED); c.fill(x + 28, y + 15, 4, 4, RED);
  c.fill(x + 20, y + 22, 12, 2, INK);
  c.line(x + 26, y + 10, x + 26, y + 4, INK); c.circle(x + 26, y + 4, 2, RED, true);
  c.fill(x + 12, y + 28, 28, 16, [140, 150, 160]); // body
  c.fill(x + 16, y + 32, 6, 6, GOLD); c.fill(x + 30, y + 32, 6, 6, GOLD);
  c.fill(x + 8, y + 28, 4, 14, INK); c.fill(x + 40, y + 28, 4, 14, INK);
}
function thHuts(c, x, y) { // South Sudan village
  c.fill(x, y, 52, 52, [250, 230, 180]);
  c.circle(x + 42, y + 10, 6, GOLD, true);
  c.tri(x + 8, y + 30, x + 24, y + 30, x + 16, y + 16, [160, 110, 60]);
  c.fill(x + 10, y + 30, 12, 12, [190, 150, 100]);
  c.tri(x + 28, y + 32, x + 44, y + 32, x + 36, y + 20, [160, 110, 60]);
  c.fill(x + 30, y + 32, 12, 10, [190, 150, 100]);
  c.fill(x + 4, y + 42, 44, 4, [120, 90, 50]);
}
function thCrowd(c, x, y) { // Lisbon march
  c.fill(x, y, 52, 52, SKY);
  for (let i = 0; i < 5; i++) {
    const px = x + 6 + i * 9;
    c.circle(px + 3, y + 26, 4, [240, 200, 160], true);
    c.fill(px, y + 31, 8, 14, [i % 2 ? BLUE : RED]);
  }
  c.fill(x + 30, y + 8, 16, 10, [255, 255, 255]); // placard
  c.rect(x + 30, y + 8, 16, 10, INK);
  c.fill(x + 37, y + 18, 2, 8, INK);
  c.fill(x + 4, y + 45, 44, 3, DARK);
}

// ---------------- World map ----------------
function drawMap(c, x, y, w, h) {
  c.fill(x, y, w, h, [190, 220, 235]); // sea
  const X = lon => x + ((lon + 180) / 360) * w;
  const Y = lat => y + ((85 - lat) / 145) * h;
  const P = pts => pts.map(p => [X(p[0]), Y(p[1])]);
  const NA = [[-168, 66], [-140, 70], [-120, 72], [-95, 80], [-80, 73], [-60, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 26], [-90, 20], [-97, 16], [-105, 20], [-115, 28], [-125, 40], [-125, 49], [-140, 60], [-165, 60]];
  const SA = [[-80, 10], [-60, 8], [-50, 0], [-40, -5], [-35, -10], [-40, -20], [-48, -28], [-58, -35], [-65, -45], [-70, -55], [-73, -40], [-75, -20], [-80, -5]];
  const EU = [[-10, 36], [-9, 43], [0, 44], [3, 43], [8, 44], [12, 44], [18, 40], [23, 36], [28, 36], [30, 41], [28, 45], [23, 45], [19, 45], [12, 50], [8, 55], [8, 57], [5, 60], [10, 64], [18, 69], [25, 71], [30, 70], [40, 68], [45, 66], [40, 60], [35, 55], [30, 50], [28, 45], [23, 40], [18, 36], [15, 38], [10, 37], [0, 36]];
  const AF = [[-17, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [43, 12], [48, 11], [51, 10], [45, 0], [40, -10], [35, -20], [32, -28], [25, -33], [18, -35], [15, -27], [12, -18], [12, -8], [9, 4], [4, 6], [-8, 5], [-13, 8], [-17, 12]];
  const AS = [[40, 68], [50, 70], [60, 69], [70, 72], [80, 73], [90, 75], [100, 77], [110, 74], [120, 73], [130, 72], [140, 72], [150, 70], [160, 66], [162, 60], [158, 52], [150, 45], [142, 40], [140, 35], [135, 33], [130, 35], [127, 40], [122, 38], [120, 32], [115, 28], [110, 20], [108, 12], [105, 8], [100, 8], [98, 12], [95, 16], [92, 20], [88, 22], [85, 19], [80, 15], [77, 8], [75, 10], [72, 20], [66, 25], [60, 25], [55, 26], [52, 28], [50, 30], [48, 30], [44, 29], [43, 35], [40, 38], [38, 42], [40, 48], [42, 55], [40, 60], [42, 65]];
  const OC = [[113, -22], [114, -30], [115, -35], [120, -34], [125, -32], [130, -32], [135, -35], [140, -38], [145, -38], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -15], [140, -12], [135, -12], [132, -11], [130, -13], [126, -14], [122, -17], [118, -20], [114, -21]];
  const GL = [[-45, 60], [-30, 68], [-20, 70], [-25, 76], [-40, 80], [-55, 76], [-58, 70], [-52, 64]];
  for (const cont of [NA, SA, EU, AF, AS, OC, GL]) c.poly(P(cont), LAND);
  return { X, Y };
}

// ---------------- The day's news (researched 23 Nov 2026) ----------------
// News-cycle standard: stories first reported 22 Nov but headlining the
// 23 Nov papers count as 23 Nov news. Stated in the footer (Date Check).
// Sports scores verified against two sources (Reuters wrapup + LiveScore /
// Sportradar + results.fast). 43 stories, 6 continents.
const REGIONS = [
  ['EUROPE', 10], ['MIDDLE EAST', 6], ['ASIA', 7], ['AFRICA', 6],
  ['AMERICAS', 8], ['OCEANIA', 2], ['WORLD', 4],
];
const NUMBERS = [
  ['0', 'COP31 DEAL REACHED'],
  ['$3.8BN', 'GTA 6 DAY-ONE SALES'],
  ['720/9', "INDIA'S FIRST INNINGS"],
  ['11', 'KILLED IN SINALOA RAID'],
  ['43', 'UAP FILES RELEASED'],
  ['1,661', 'GAZA TOLL SINCE CEASEFIRE'],
];
const HEROES = [
  { tag: 'CLIMATE', scene: heroCOP31, head: 'COP31 COLLAPSES: NO DEAL ON FOSSIL FUELS' },
  { tag: 'GULF', scene: heroTanker, head: 'IRAN STRIKES BAHRAIN AS TANKERS BURN IN HORMUZ' },
  { tag: 'SPORT', scene: heroFootball, head: 'LIVERPOOL 4-0 MAN UTD: POCH NIGHTMARE DEBUT' },
];
const MAIN = [
  { th: thJail, head: "MEXICO CAPTURES 'EL CHAPO ISIDRO'",
    body: ['Cartel boss seized in Sinaloa raid;', '11 killed, including 4 soldiers.'], tag: 'SINALOA, MEXICO' },
  { th: thSkyline, head: 'RUSSIAN STRIKE ON KRYVYI RIH',
    body: ["Missile hits Zelenskyy's hometown;", '2 killed, 60 wounded.'], tag: 'KRYVYI RIH, UKRAINE' },
  { th: thPlanet, head: 'BEPICOLOMBO REACHES MERCURY',
    body: ['Europe-Japan probe enters orbit', 'after an 8-year journey.'], tag: 'MERCURY ORBIT' },
  { th: thChartDown, head: 'US STOCKS FALL INTO CORRECTION',
    body: ["S&P 500 drops 3.7% as AI sell-off", 'spreads to Japan and Korea.'], tag: 'WALL STREET' },
  { th: thFlags, head: 'TRUMP, XI AND PUTIN MEET',
    body: ['First trilateral summit in Shenzhen;', 'joint nuclear-risk declaration.'], tag: 'SHENZHEN, CHINA' },
  { th: thCricket, head: 'INDIA 720/9 AS NZ FIGHT BACK',
    body: ['Hosts declare big; NZ 157/4 at lunch', 'on Day 5 in Wellington.'], tag: 'WELLINGTON, NZ' },
  { th: thComputer, head: 'FBI PROBES CRIME DATABASE HACK',
    body: ['Intrusion reported in the national', 'crime records system, NCIC.'], tag: 'WASHINGTON, US' },
  { th: thFire, head: 'INDONESIA FACTORY FIRE',
    body: ['Blaze at Cikande candy plant kills 3;', '36 still missing.'], tag: 'BANTEN, INDONESIA' },
  { th: thMissile, head: 'HOUTHIS HIT RIYADH, DAY 3',
    body: ['Missiles and drones fired for a third', 'day; Saudi refinery hit, 6 hurt.'], tag: 'RIYADH, SAUDI ARABIA' },
  { th: thRobot, head: "UN 'KILLER ROBOTS' TALKS FAIL",
    body: ['No binding rules agreed; talks run', 'on to 2028.'], tag: 'GENEVA, UN' },
  { th: thHuts, head: '24 CIVILIANS KILLED IN S. SUDAN',
    body: ['Fresh violence erupts despite fragile', 'peace efforts.'], tag: 'JUBA, S. SUDAN' },
  { th: thCrowd, head: 'LISBON MARCHES ON LIVING COSTS',
    body: ['Thousands protest rising prices;', 'France rallies for a 6th week.'], tag: 'LISBON, PORTUGAL' },
];
const ALSO = [
  'TWO TANKERS STRUCK IN STRAIT OF HORMUZ',
  'GAZA: 9 KILLED IN 48 HOURS; TOLL NOW 1,661',
  'NETANYAHU-EISENKOT UNITY TALKS END, NO DEAL',
  'SYRIA ARRESTS OFFICER OVER 2014 AMBUSH',
  'RUSSIAN DRONE HITS DYMER FLAT: 14 MISSING',
  'SANCTIONED SHIP SPARTA II BURNS IN BALTIC',
  'POLAND: 3 RUSSIAN MISSILES HIT ON FRIDAY',
  'HULL STUN BRIGHTON 2-0 AT HOME',
  'EU AND INDONESIA SIGN LANDMARK TRADE DEAL',
  'PL: NEWCASTLE 2-2 ARSENAL; CITY 1-1 FULHAM; LEEDS 4-1 CHELSEA',
  'PL: BOURNEMOUTH 2-0 FOREST; SPURS 2-0 IPSWICH; COVENTRY 3-2 PALACE',
  'NEPAL PM SHAH BEGINS TWO-DAY INDIA VISIT',
  'INDIA AND CHINA HOLD FRESH BORDER TALKS',
  'S. KOREA MINISTER QUITS OVER AI EXAM SCANDAL',
  'SELANGOR FLOODS: 1,800 EVACUEES AND RISING',
  "MYANMAR CALLS ASEAN DECISION 'UNFAIR'",
  'SUDAN DRONES HIT HOMES AND UN BUILDING',
  'NIGERIA BOAT CAPSIZES: AT LEAST 24 DEAD',
  'NIGERIA: 35 FULANIS KILLED IN REVENGE ATTACK',
  'WHO CHIEF PLEADS FOR PEACE IN EBOLA-HIT CONGO',
  'UKRAINIAN SEA DRONES HIT WARSHIP AT BENGHAZI',
  'ICE DETAIN FATHER AND DAUGHTER AT SEATTLE AIRPORT',
  'CALIFORNIA CONCERT SHOOTING: 9 HURT, 1 CRITICAL',
  "BOLSONARO 'STABLE' IN INTENSIVE CARE",
  'VERSTAPPEN WINS THRILLER IN LAS VEGAS GP',
  'GTA 6 SELLS $3.8BN IN A SINGLE DAY',
  'PENTAGON RELEASES 43 MORE UAP FILES',
  'SIGNAL BLOCKS MOBILE SCREENSHOTS OVER AI FEARS',
];
const CLOCK = [
  ['00:02', "UN 'KILLER ROBOTS' TALKS END WITH NO RULES"],
  ['01:02', 'SEA DRONES HIT RUSSIAN WARSHIP AT BENGHAZI'],
  ['01:03', 'INDIA CLOSE IN ON NZ: 157/4 AT LUNCH, DAY 5'],
  ['02:00', "AUSTRALIA PM: COP31 FAILURE SHOWS 'DIFFICULT TIMES'"],
  ['16:30', 'LIVERPOOL 4-0 MAN UTD AT ANFIELD'],
  ['17:04', 'COP31 COLLAPSES IN ANTALYA: NO DEAL'],
  ['23:35', 'HOUTHIS CLAIM STRIKES ON SAUDI REFINERY (22 NOV)'],
];
// [lon, lat, label, dx, dy] — dx/dy nudge the pin so crowded pins do not overlap
const PINS = [
  [30.7, 36.9, 'ANTALYA', -14, -8],
  [50.6, 26.2, 'BAHRAIN', 6, -10],
  [56.5, 26.5, 'HORMUZ', 14, 10],
  [-107.4, 24.8, 'SINALOA', 0, 0],
  [33.4, 47.9, 'KRYVYI RIH', 12, -14],
  [174.8, -41.3, 'WELLINGTON', 0, 0],
  [106.4, -6.3, 'CIKANDE', 0, 0],
  [32.5, 15.6, 'KHARTOUM', -10, 12],
  [31.6, 4.85, 'JUBA', 12, 10],
  [-9.1, 38.7, 'LISBON', -10, 0],
  [-3.0, 53.4, 'LIVERPOOL', 10, -8],
  [20.1, 32.1, 'BENGHAZI', -12, 10],
];

// ---------------- Layout ----------------
function draw() {
  const W = 1024, H = 1024;
  const c = new Cv(W, H);
  c.fill(0, 0, W, H, PAPER);
  c.rect(8, 8, W - 16, H - 16, INK);

  // Masthead
  c.textC('THE WORLD IN ONE DAY', 512, 12, 4, INK);
  c.fill(16, 46, 992, 2, RED);
  c.textC('MONDAY, 23 NOVEMBER 2026', 512, 54, 2, INK);
  c.textC('43 STORIES | 6 CONTINENTS | ONE DAY', 512, 74, 2, RED);

  // Region bar
  c.fill(16, 94, 992, 20, INK);
  const cellW = 992 / REGIONS.length;
  REGIONS.forEach((r, i) => {
    c.textC(r[0] + ' ' + r[1], 16 + cellW * (i + 0.5), 101, 1, [255, 255, 255]);
  });

  // The Day in Numbers
  c.textC('THE DAY IN NUMBERS', 512, 122, 1, RED);
  NUMBERS.forEach((n, i) => {
    const bx = 16 + i * 166;
    c.fill(bx, 134, 162, 38, [255, 255, 255]);
    c.rect(bx, 134, 162, 38, INK);
    c.textC(n[0], bx + 81, 138, 3, INK);
    c.textC(n[1], bx + 81, 161, 1, GREY);
  });

  // Heroes
  HEROES.forEach((h, i) => {
    const px = 16 + i * 335;
    c.rect(px, 180, 322, 164, INK);
    h.scene(c, px + 1, 181, 320, 114);
    // tag
    c.fill(px + 7, 187, 7 * 6 * 1 + 8, 13, RED);
    c.text(h.tag, px + 11, 189, 1, [255, 255, 255]);
    // headline bar
    c.fill(px + 1, 295, 320, 48, [255, 255, 255]);
    c.fill(px + 1, 295, 320, 2, RED);
    c.wrap(h.head, px + 10, 301, 2, INK, 302, 2, 16);
  });

  // Main story grid: 4 rows x 3 cols
  MAIN.forEach((s, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 16 + col * 335, y = 352 + row * 62;
    c.fill(x, y, 322, 56, [255, 255, 255]);
    c.rect(x, y, 322, 56, [200, 200, 195]);
    s.th(c, x + 2, y + 2);
    c.clip(s.head, x + 60, y + 4, 1, INK, 256);
    c.clip(s.body[0], x + 60, y + 14, 1, GREY, 256);
    c.clip(s.body[1], x + 60, y + 23, 1, GREY, 256);
    c.clip(s.tag, x + 60, y + 44, 1, RED, 256);
  });

  // Map panel (left) + By the Clock (right)
  c.text('WHERE IT HAPPENED', 16, 602, 2, INK);
  c.text('BY THE CLOCK - UTC', 512, 602, 2, INK);
  const map = drawMap(c, 16, 624, 480, 114);
  c.rect(16, 624, 480, 114, INK);
  PINS.forEach((p, i) => {
    const tx = Math.round(map.X(p[0])), ty = Math.round(map.Y(p[1]));
    const dx = tx + p[3], dy = ty + p[4];
    if (p[3] || p[4]) c.line(tx, ty, dx, dy, RED);
    c.circle(dx, dy, 8, RED, true);
    c.circle(dx, dy, 8, [255, 255, 255], false);
    const num = String(i + 1);
    c.text(num, dx - Math.round(textW(num, 1) / 2), dy - 3, 1, [255, 255, 255]);
  });
  // map legend: 2 columns x 6 rows
  PINS.forEach((p, i) => {
    const lx = 16 + (i < 6 ? 0 : 250);
    const ly = 744 + (i % 6) * 9;
    c.text((i + 1) + ' ' + p[2], lx, ly, 1, INK);
  });
  // clock entries
  CLOCK.forEach((e, i) => {
    const y = 626 + i * 23;
    c.text(e[0], 512, y, 1, RED);
    c.clip(e[1], 556, y, 1, INK, 452);
  });

  // Also on 23 Nov
  c.text('ALSO ON 23 NOV', 16, 800, 2, INK);
  c.fill(16, 816, 992, 2, RED);
  ALSO.forEach((s, i) => {
    const col = i < 14 ? 0 : 1;
    const row = i % 14;
    c.text('• ' + s, 16 + col * 506, 824 + row * 11, 1, INK);
  });

  // Footer
  c.fill(16, 978, 992, 1, INK);
  c.text('SOURCES: REUTERS, AP, AFP, BBC, AL JAZEERA, BLOOMBERG, THE HINDU', 16, 984, 1, GREY);
  c.text('DATE CHECK: STORIES FIRST REPORTED 22 NOV BUT HEADLINING 23 NOV PAPERS COUNT AS 23 NOV NEWS.', 16, 996, 1, GREY);
  c.text('DRAWN IN CODE. NO PHOTOS. ALL SCENES ORIGINAL.', 16, 1008, 1, GREY);

  return c;
}

// ---------------- Main ----------------
function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  fs.mkdirSync(outDir, { recursive: true });
  const cv = draw();
  const png = encodePNG(cv.w, cv.h, cv.p);
  const outPath = path.join(outDir, 'entry.png');
  fs.writeFileSync(outPath, png);
  console.log('wrote ' + outPath + ' ' + png.length + ' bytes');
}
main();
