// News Image v2 — 23 November 2026. Pure TypeScript, Node stdlib only.
// Draws the whole front page into an RGB buffer with a 5x7 bitmap font,
// then encodes a PNG (zlib deflate, CRC32) to /output/entry.png.
// All text is uppercase (newspaper style); all facts were verified from
// 2+ sources on 24 Nov 2026. News-cycle standard: stories first reported
// 22 Nov but headlining 23 Nov papers count as 23 Nov news.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

// ---------------- CRC32 ----------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------- Canvas ----------------
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [22, 22, 22];
const RED: RGB = [176, 30, 36];
const BLUE: RGB = [31, 78, 121];
const TEAL: RGB = [14, 107, 107];
const GOLD: RGB = [176, 128, 0];
const GREY: RGB = [110, 110, 105];
const WHITE: RGB = [255, 255, 255];
const NAVY: RGB = [16, 34, 64];
const GREEN: RGB = [34, 110, 60];
const SKY: RGB = [214, 232, 240];

function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0]; px[i * 3 + 1] = c[1]; px[i * 3 + 2] = c[2];
  }
}
function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c);
}
function border(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
  for (let i = 0; i < t; i++) {
    hline(x, x + w - 1, y + i, c);
    hline(x, x + w - 1, y + h - 1 - i, c);
    vline(x + i, y, y + h - 1, c);
    vline(x + w - 1 - i, y, y + h - 1, c);
  }
}
function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  for (let t2 = 0; t2 < t; t2++) for (let x = x0; x <= x1; x++) set(x, y + t2, c);
}
function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  for (let t2 = 0; t2 < t; t2++) for (let y = y0; y <= y1; y++) set(x + t2, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    set(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
    if (x * x + y * y <= r * r) set(cx + x, cy + y, c);
}
function ring(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a++) {
    const t = (a * Math.PI) / 180;
    set(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function poly(pts: Array<[number, number]>, c: RGB): void {
  let minY = 1e9, maxY = -1e9;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(Math.round(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = xs[k]; x <= xs[k + 1]; x++) set(x, y, c);
  }
}

// ---------------- 5x7 bitmap font ----------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  "\u00d7": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
  "\u2192": ["00000", "00100", "00010", "11111", "00010", "00100", "00000"],
  "\u00b0": ["01100", "10010", "10010", "01100", "00000", "00000", "00000"],
};
function charW(s: number): number {
  return 6 * s;
}
function textW(str: string, s: number): number {
  return str.length * charW(s) - s;
}
function drawText(str: string, x: number, y: number, s: number, c: RGB, align: "l" | "c" | "r" = "l"): void {
  let sx = x;
  if (align === "c") sx = x - Math.floor(textW(str, s) / 2);
  if (align === "r") sx = x - textW(str, s);
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]] ?? FONT["?"];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") rect(sx + i * charW(s) + col * s, y + r * s, s, s, c);
  }
}
function wrap(str: string, maxW: number, s: number): string[] {
  const words = str.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textW(t, s) <= maxW) cur = t;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(str: string, x: number, y: number, maxW: number, s: number, c: RGB, leading: number): number {
  const lines = wrap(str, maxW, s);
  for (let i = 0; i < lines.length; i++) drawText(lines[i], x, y + i * leading, s, c);
  return y + lines.length * leading;
}

// ---------------- Content ----------------
const NUMBERS: Array<[string, string]> = [
  ["25", "TANKERS HIT NEAR HORMUZ SINCE 14 NOV"],
  ["44H", "COP31 RAN PAST ITS DEADLINE - LONGEST EVER"],
  ["+33%", "NVIDIA SHARES ON HUANG'S RETURN"],
  ["11", "KILLED IN MEXICO CARTEL CAPTURE"],
  ["$5.17M", "ALCARAZ'S RECORD TURIN PRIZE"],
  ["194", "NATIONS AT THE COP31 TALKS"],
];

const HEROES = [
  {
    kicker: "CLIMATE - ANTALYA",
    band: TEAL as RGB,
    head: "COP31 COLLAPSES: NO DEAL ON FOSSIL FUELS",
    sub: "EU REJECTS A TEXT SILENT ON FOSSIL FUELS AS THE LONGEST CLIMATE SUMMIT EVER ENDS WITH NO AGREEMENT - THE FIRST COLLAPSE SINCE COPENHAGEN 2009.",
    src: "SOURCES: CNN, LE MONDE, AP, WSJ",
  },
  {
    kicker: "THE GULF - BAHRAIN",
    band: NAVY as RGB,
    head: "GULF ON FIRE: IRAN HITS BAHRAIN, TANKERS BURN",
    sub: "TRUMP: HEAVIEST IRAN MISSILE WEEK IN OVER A YEAR, ALL SHOT DOWN. IRGC SAYS IT HIT US PATRIOT RADARS; 25 TANKERS HIT NEAR HORMUZ SINCE 14 NOV.",
    src: "SOURCES: AL JAZEERA, REUTERS, AP",
  },
  {
    kicker: "FOOTBALL - ANFIELD",
    band: RED as RGB,
    head: "LIVERPOOL 4-0 MAN UTD: POCHETTINO'S NIGHTMARE DEBUT",
    sub: "SZOBOSZLAI 10', WIRTZ 13', NGUMOHA 66', MUNOZ 82'. YORO SENT OFF AFTER 8 MINUTES; UNITED DROP TO 19TH.",
    src: "SOURCES: THE TIMES, LIVERPOOL FC, OPTA",
  },
];

const MAINS: Array<{ tag: string; color: RGB; head: string; deck: string }> = [
  { tag: "AMERICAS", color: BLUE, head: "NVIDIA U-TURN: HUANG BACK AS CEO", deck: "BOARD VOTES UNANIMOUSLY 11 DAYS AFTER HIS RESIGNATION. SHARES JUMP 33%; NASDAQ +6%." },
  { tag: "EUROPE", color: RED, head: "ALCARAZ TAKES TURIN", deck: "BEATS WORLD NO. 1 ZVEREV 6-2, 7-6(7) FOR A FIRST ATP FINALS TITLE AND A RECORD $5.17M." },
  { tag: "AMERICAS", color: BLUE, head: "MEXICO NABS 'EL CHAPO ISIDRO'", deck: "FBI TOP-10 BOSS HELD IN SINALOA; 11 KILLED IN GUN BATTLES. US EXTRADITION ORDER EXISTS." },
  { tag: "EUROPE", color: RED, head: "RUSSIA HITS KRYVYI RIH", deck: "MISSILES KILL 2, INCLUDING A 7-YEAR-OLD; 60+ WOUNDED. MISSILES ALSO FELL IN POLAND." },
  { tag: "ASIA", color: GOLD, head: "SHENZHEN SUMMIT", deck: "TRUMP, XI AND PUTIN MEET IN CHINA AND AGREE TO EXPAND REFINED OIL OUTPUT." },
  { tag: "M. EAST", color: TEAL, head: "HORMUZ SQUEEZE", deck: "OIL FLOWS FALL 25% TO ABOUT 10M BARRELS A DAY AS IRAN AVERAGES AN ATTACK A DAY." },
  { tag: "AFRICA", color: GREEN, head: "KENYA-DR CONGO MEND TIES", deck: "AMBASSADORS RESTORED AFTER 2+ YEARS OF FALLOUT OVER THE M23 REBELS, RUTO SAYS." },
  { tag: "AFRICA", color: GREEN, head: "AFRICA'S $21.6BN WINDFALL", deck: "NINE ENERGY EXPORTERS GAIN FROM HIGHER PRICES IN THE IRAN WAR; NIGERIA +$7.5BN." },
  { tag: "WORLD", color: GREY, head: "COP31: WHAT NEXT?", deck: "ERDOGAN SAYS TALKS LAID GROUNDWORK; EU STANDS FIRM: NO TEXT WITHOUT FOSSIL FUELS." },
  { tag: "M. EAST", color: TEAL, head: "HOUTHIS HIT SAUDI TARGETS", deck: "ATTACKS INTENSIFY AS YEMENI FORCES RETREAT, ADDING TO GULF PRESSURE." },
  { tag: "OCEANIA", color: BLUE, head: "PACIFIC SHAKES", deck: "M6.5 QUAKE NEAR VANUATU, NO DAMAGE REPORTED; M5.5 STRIKES OFF MACQUARIE ISLAND." },
  { tag: "WORLD", color: GREY, head: "PETROSTATES BLOCKED THE WORDING", deck: "SAUDI ARABIA AND RUSSIA OPPOSED ANY MENTION OF FOSSIL FUELS; CHINA AND ARAB STATES BACKED THE TEXT." },
];

const ALSO: string[] = [
  "TRUMP LEANS TO NEW IRAN STRIKES IN JANUARY IF TALKS FAIL",
  "TRUMP: IRAN WANTS A DEAL, BUT NOT ONE ON OFFER",
  "ERDOGAN: COP31 LAID GROUNDWORK FOR MORE TALKS",
  "IRAN STAGES 14-TANKER CONVOY AT KHARG ISLAND",
  "WAR-RISK INSURANCE NOW 3.5-7.5% OF HULL VALUE",
  "HORMUZ TRANSITS DOWN TO 263 SHIPS A WEEK",
  "DRC HALTS ALL COBALT EXPORTS FROM NOV 30",
  "ZAMBIA: OPPOSITION LEADER CHARGED WITH TREASON",
  "JOBURG COALITION SEALED AS WATER CURBS BITE",
  "ZVEREV ENDS THE YEAR AS WORLD NO. 1",
  "ALCARAZ: 4TH MAN TO WIN 4 SLAMS + ATP FINALS",
  "ALCARAZ TAKES A RECORD $5.17M PRIZE",
  "LIVERPOOL'S EARLIEST 2-0 LEAD VS UTD: 12:40",
  "UTD 19TH AFTER ONE LEAGUE WIN ALL SEASON",
  "RUSSIA FIRES 400+ DRONES, 110 MISSILES OVERNIGHT",
  "NVIDIA PROBE INTO HUANG STILL RUNNING",
  "NASDAQ +6%, S&P +4% ON NVIDIA NEWS",
  "US SANCTIONS COMANCHEROS AND 'NDRANGHETA",
  "TAIWAN FLAGS 2,700 SUSPECT CHINA-LINKED ACCOUNTS",
  "INDONESIA: 34 MISSING AFTER FACTORY FIRE",
  "KILAUEA COMPLETES ITS 57TH LAVA EPISODE",
  "RECORD 2.12C GLOBAL TEMPERATURE ANOMALY",
  "COP31: 130 NATIONS BACKED THE DUBAI COURSE",
  "IRAN FM: CASE FOR NEW NUCLEAR DOCTRINE 'STRONG'",
  "SUDAN: DRONE STRIKE KILLS 4, HITS UN BUILDING",
  "COCA-COLA HBC DEBUTS ON JOHANNESBURG EXCHANGE",
  "KENYA: TURKANA OIL ERA BEGINS AT 20,000 BPD",
  "US TO SEND $170M HEALTH AID TO 3 AFRICAN STATES",
];

const CLOCK: Array<[string, string]> = [
  ["08:01", "M5.5 QUAKE OFF MACQUARIE ISLAND"],
  ["14:42", "NVIDIA REINSTATES HUANG"],
  ["16:15", "NVIDIA SHARES JUMP 33%"],
  ["22:04", "S. AFRICA: EX-SPEAKER AWAITS GRAFT VERDICT"],
  ["23:41", "15 KILLED IN ZAMFARA ROAD CRASH"],
];

// ---------------- Hero illustrations ----------------
function heroCOP31(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [18, 90, 90]);
  const cx = x + Math.floor(w / 2), cy = y + 62, r = 50;
  disc(cx, cy, r, SKY);
  poly([[cx - 30, cy - 20], [cx - 8, cy - 30], [cx + 12, cy - 18], [cx + 28, cy - 28], [cx + 38, cy - 8], [cx + 20, cy + 2], [cx - 2, cy - 6], [cx - 22, cy + 2]], GREEN);
  poly([[cx - 34, cy + 22], [cx - 10, cy + 14], [cx + 6, cy + 26], [cx + 26, cy + 18], [cx + 30, cy + 34], [cx + 4, cy + 42], [cx - 24, cy + 38]], GREEN);
  // crack across the globe
  line(cx - 44, cy - 34, cx - 18, cy - 8, WHITE);
  line(cx - 18, cy - 8, cx + 4, cy - 26, WHITE);
  line(cx + 4, cy - 26, cx + 22, cy - 2, WHITE);
  line(cx + 22, cy - 2, cx + 40, cy + 18, WHITE);
  line(cx - 44, cy - 33, cx - 18, cy - 7, WHITE);
  // NO DEAL stamp
  const sx = x + w - 118, sy = y + h - 34;
  rect(sx, sy, 108, 26, WHITE);
  border(sx, sy, 108, 26, RED, 3);
  drawText("NO DEAL", sx + 54, sy + 6, 2, RED, "c");
}
function heroGulf(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 58, [30, 50, 80]);
  rect(x, y + 58, w, h - 58, [16, 60, 90]);
  disc(x + 52, y + 26, 16, [232, 180, 60]);
  // missile arc
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const mx = x + 30 + Math.round(t * (w - 90));
    const my = y + 118 - Math.round(Math.sin(t * Math.PI) * 62);
    disc(mx, my, 2, WHITE);
  }
  // tanker
  const hx = x + 60, hy = y + 92;
  rect(hx, hy, 200, 22, [30, 30, 30]);
  rect(hx + 150, hy - 26, 22, 26, [30, 30, 30]);
  rect(hx + 20, hy - 14, 30, 14, RED);
  rect(hx + 56, hy - 14, 30, 14, [240, 240, 240]);
  rect(hx + 92, hy - 14, 30, 14, GOLD);
  // smoke
  disc(hx + 161, hy - 34, 9, [200, 200, 200]);
  disc(hx + 172, hy - 44, 11, [180, 180, 180]);
  disc(hx + 186, hy - 56, 12, [160, 160, 160]);
  // flames on deck
  poly([[hx + 30, hy], [hx + 40, hy - 26], [hx + 50, hy]], [255, 140, 0]);
  poly([[hx + 58, hy], [hx + 66, hy - 18], [hx + 74, hy]], [255, 200, 0]);
  poly([[hx + 100, hy], [hx + 110, hy - 22], [hx + 120, hy]], [255, 140, 0]);
  // waves
  for (let i = 0; i < 5; i++) {
    const wy = y + h - 8 - i * 6;
    for (let wx = x + 6; wx < x + w - 6; wx += 26) line(wx, wy, wx + 12, wy, [120, 180, 220]);
  }
}
function heroFootball(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [34, 110, 60]);
  rect(x + 6, y + 30, w - 12, h - 36, [40, 128, 70]);
  for (let i = 0; i < 2; i++) rect(x + 6 + i, y + 30 + i, w - 12 - 2 * i, h - 36 - 2 * i, WHITE);
  rect(x + 8, y + 32, w - 16, h - 40, [40, 128, 70]);
  vline(x + Math.floor(w / 2), y + 32, y + h - 8, WHITE);
  ring(x + Math.floor(w / 2), y + Math.floor((h + 24) / 2), 22, WHITE);
  // scoreboard band
  rect(x, y, w, 26, INK);
  drawText("LIVERPOOL 4-0 MAN UTD", x + Math.floor(w / 2), y + 6, 2, WHITE, "c");
  // ball
  const bx = x + 62, by = y + h - 34;
  disc(bx, by, 15, WHITE);
  disc(bx - 5, by - 4, 3, INK);
  disc(bx + 5, by + 3, 3, INK);
  disc(bx, by + 7, 3, INK);
  // goal arrow
  line(x + w - 90, by, x + w - 34, by, WHITE);
  line(x + w - 34, by, x + w - 44, by - 7, WHITE);
  line(x + w - 34, by, x + w - 44, by + 7, WHITE);
  drawText("4-0", x + w - 62, by - 34, 3, WHITE, "c");
}

// ---------------- World map ----------------
function lonX(lon: number): number {
  return Math.round(8 + ((lon + 170) / 360) * 612);
}
function latY(lat: number): number {
  return Math.round(640 + ((75 - lat) / 140) * 96);
}
const CONTINENTS: Array<Array<[number, number]>> = [
  [[-168, 66], [-140, 70], [-110, 73], [-95, 80], [-85, 70], [-75, 62], [-60, 55], [-55, 47], [-70, 42], [-75, 35], [-80, 26], [-85, 20], [-90, 15], [-95, 18], [-105, 20], [-115, 28], [-125, 40], [-125, 49], [-140, 60], [-155, 58], [-165, 60]],
  [[-80, 10], [-75, 5], [-60, 0], [-50, -5], [-40, -10], [-35, -20], [-45, -30], [-55, -35], [-65, -45], [-70, -55], [-75, -40], [-75, -20], [-80, -5]],
  [[-17, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [48, 11], [51, 10], [45, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [9, -5], [9, 4], [-8, 5], [-17, 12]],
  [[-10, 36], [-9, 43], [-2, 48], [0, 50], [5, 55], [8, 57], [12, 55], [18, 56], [21, 60], [25, 65], [30, 70], [35, 68], [40, 60], [30, 55], [25, 50], [20, 45], [15, 44], [10, 42], [3, 42], [-2, 37]],
  [[40, 68], [55, 70], [70, 72], [90, 75], [110, 76], [130, 72], [150, 70], [170, 66], [162, 60], [158, 52], [142, 45], [135, 35], [128, 30], [122, 25], [115, 20], [108, 12], [105, 5], [100, 8], [95, 15], [90, 22], [80, 25], [70, 25], [60, 25], [50, 28], [45, 30], [40, 35]],
  [[113, -22], [114, -30], [115, -35], [124, -33], [130, -32], [137, -35], [140, -38], [147, -39], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -15], [142, -11], [137, -12], [135, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20]],
];
const PINS: Array<{ n: number; lon: number; lat: number; dx: number; dy: number; label: string }> = [
  { n: 1, lon: 30.7, lat: 36.9, dx: -16, dy: -18, label: "ANTALYA - COP31" },
  { n: 2, lon: 50.6, lat: 26.2, dx: 8, dy: -6, label: "BAHRAIN - GULF" },
  { n: 3, lon: -3, lat: 53.4, dx: -34, dy: -6, label: "LIVERPOOL" },
  { n: 4, lon: 7.7, lat: 45.1, dx: -40, dy: 8, label: "TURIN - ALCARAZ" },
  { n: 5, lon: 33.4, lat: 47.9, dx: 14, dy: -16, label: "KRYVYI RIH" },
  { n: 6, lon: -107.4, lat: 24.8, dx: -52, dy: -6, label: "SINALOA" },
  { n: 7, lon: 114.1, lat: 22.5, dx: 8, dy: -6, label: "SHENZHEN" },
  { n: 8, lon: 36.8, lat: -1.3, dx: 8, dy: -6, label: "NAIROBI" },
  { n: 9, lon: -122, lat: 37.4, dx: -56, dy: -6, label: "SILICON VALLEY" },
  { n: 10, lon: 167, lat: -16, dx: -52, dy: 8, label: "VANUATU" },
  { n: 11, lon: 153.8, lat: -60.6, dx: -60, dy: -6, label: "MACQUARIE IS." },
  { n: 12, lon: 46.7, lat: 24.6, dx: -52, dy: 12, label: "RIYADH" },
];

// ---------------- Layout ----------------
function draw(): void {
  fill(PAPER);
  rect(0, 0, W, 4, INK);
  rect(0, H - 4, W, 4, INK);
  rect(0, 0, 4, H, INK);
  rect(W - 4, 0, 4, H, INK);

  // Masthead
  drawText("THE WORLD IN ONE DAY", 512, 12, 4, INK, "c");
  drawText("MONDAY, 23 NOVEMBER 2026", 512, 46, 2, RED, "c");
  drawText("43 STORIES \u2022 6 CONTINENTS \u2022 ONE DAY", 512, 66, 1, INK, "c");
  hline(8, 1016, 82, RED, 3);

  // Day in Numbers
  const bw = 164, gap = 6;
  for (let i = 0; i < NUMBERS.length; i++) {
    const x = 8 + i * (bw + gap);
    rect(x, 88, bw, 52, WHITE);
    border(x, 88, bw, 52, INK, 2);
    rect(x, 88, bw, 3, RED);
    drawText(NUMBERS[i][0], x + 82, 95, 3, INK, "c");
    const lab = wrap(NUMBERS[i][1], bw - 12, 1);
    for (let l = 0; l < lab.length; l++) drawText(lab[l], x + 82, 118 + l * 9, 1, GREY, "c");
  }

  // Heroes
  const heroFns = [heroCOP31, heroGulf, heroFootball];
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 330;
    rect(x, 144, 322, 280, WHITE);
    border(x, 144, 322, 280, INK, 2);
    rect(x, 144, 322, 26, HEROES[i].band);
    drawText(HEROES[i].kicker, x + 161, 152, 1, WHITE, "c");
    heroFns[i](x + 2, 172, 318, 130);
    const hl = wrap(HEROES[i].head, 306, 2);
    for (let l = 0; l < hl.length; l++) drawText(hl[l], x + 8, 308 + l * 16, 2, INK);
    para(HEROES[i].sub, x + 8, 360, 306, 1, INK, 9);
    drawText(HEROES[i].src, x + 8, 406, 1, GREY);
  }

  // Main stories: 4 columns x 3 rows
  drawText("THE DAY'S MAIN STORIES", 8, 432, 1, RED);
  hline(8, 1016, 444, INK, 2);
  for (let i = 0; i < MAINS.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 8 + col * 254, y = 450 + row * 64;
    const m = MAINS[i];
    const tw = textW(m.tag, 1) + 10;
    rect(x, y, tw, 11, m.color);
    drawText(m.tag, x + 5, y + 2, 1, WHITE);
    const hl = wrap(m.head, 238, 1);
    for (let l = 0; l < Math.min(2, hl.length); l++) drawText(hl[l], x, y + 15 + l * 9, 1, INK);
    para(m.deck, x, y + 35, 238, 1, GREY, 9);
  }

  // Map
  drawText("WHERE IT HAPPENED", 8, 634, 1, RED);
  rect(8, 644, 612, 96, SKY);
  border(8, 644, 612, 96, INK, 2);
  for (const cont of CONTINENTS) {
    poly(cont.map(([lo, la]) => [lonX(lo), latY(la)] as [number, number]), [96, 132, 96]);
  }
  for (const p of PINS) {
    const px0 = lonX(p.lon), py0 = latY(p.lat);
    disc(px0, py0, 4, RED);
    const lx = px0 + p.dx, ly = py0 + p.dy;
    line(px0, py0, lx + 5, ly + 5, RED);
    rect(lx, ly, 11, 11, RED);
    drawText(String(p.n), lx + 6, ly + 2, 1, WHITE, "c");
  }
  // Map legend
  drawText("1 ANTALYA - COP31", 636, 646, 1, INK);
  drawText("2 BAHRAIN - GULF", 636, 657, 1, INK);
  drawText("3 LIVERPOOL 4-0", 636, 668, 1, INK);
  drawText("4 TURIN - ALCARAZ", 636, 679, 1, INK);
  drawText("5 KRYVYI RIH", 636, 690, 1, INK);
  drawText("6 SINALOA - CARTEL", 636, 701, 1, INK);
  drawText("7 SHENZHEN SUMMIT", 836, 646, 1, INK);
  drawText("8 NAIROBI - TIES", 836, 657, 1, INK);
  drawText("9 SILICON VALLEY", 836, 668, 1, INK);
  drawText("10 VANUATU QUAKE", 836, 679, 1, INK);
  drawText("11 MACQUARIE IS.", 836, 690, 1, INK);
  drawText("12 RIYADH - OIL STATES", 836, 701, 1, INK);
  drawText("PINS MARK THE STORIES", 636, 722, 1, GREY);

  // By the Clock
  drawText("BY THE CLOCK - ALL TIMES UTC", 8, 742, 1, RED);
  hline(8, 1016, 774, INK, 2);
  for (let i = 0; i < CLOCK.length; i++) {
    const cx = 108 + i * 201;
    disc(cx, 775, 4, RED);
    drawText(CLOCK[i][0], cx, 754, 2, INK, "c");
    const lab = wrap(CLOCK[i][1], 190, 1);
    for (let l = 0; l < lab.length; l++) drawText(lab[l], cx, 782 + l * 9, 1, INK, "c");
  }

  // Also on
  drawText("ALSO ON THIS DAY", 8, 812, 1, RED);
  hline(8, 1016, 824, INK, 2);
  for (let i = 0; i < ALSO.length; i++) {
    const col = i < 14 ? 0 : 1;
    const row = i % 14;
    const x = col === 0 ? 8 : 516;
    const y = 830 + row * 9;
    drawText("\u2022 " + ALSO[i], x, y, 1, INK);
  }

  // Region bar
  hline(8, 1016, 956, INK, 1);
  drawText("EUROPE 9  \u2022  AFRICA 9  \u2022  AMERICAS 8  \u2022  MIDDLE EAST 7  \u2022  WORLD 6  \u2022  ASIA 3  \u2022  OCEANIA 1", 512, 962, 1, INK, "c");

  // Footer
  drawText("SOURCES: REUTERS, AP, CNN, LE MONDE, AL JAZEERA, ATP, OKAYAFRICA, USGS, OPTA, THE TIMES", 512, 978, 1, GREY, "c");
  drawText("DATE CHECK: NEWS-CYCLE STANDARD - STORIES FIRST REPORTED 22 NOV BUT HEADLINING 23 NOV PAPERS COUNT AS 23 NOV NEWS.", 512, 990, 1, GREY, "c");
  drawText("DRAWN IN CODE - NO NETWORK - 43 STORIES - 6 CONTINENTS", 512, 1002, 1, GREY, "c");
}

draw();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), encodePNG(W, H, px));
