// Sammenligner to fotobog-mapper og lister de billeder, der er ændret. Mønsteret er Huginn and Muninns
// tests/ui/fotobog-diff.mjs (kun læst): SHA-256 af hver PNG-fil. Er hashen en anden, afkodes begge billeder (node:zlib, ingen
// pakker), og forskellen siges i pixels: antal, største forskel i en farvekanal (0–255) og området (x, y).
// Brug: node tests/ui/fotobog-diff.mjs <gammel mappe> <ny mappe>. Exit 0: ingen ændringer (kun ens eller støj).
// Exit 1: ændret, nye eller væk. Exit 2: forkert brug.
// Støj: højst STOEJ_DELTA i hver farvekanal (8 af 255, ca. 3 %, kan ikke ses). Headless Chrome tegner ikke altid bit for bit
// ens (kantudglatning; V-DOK.1: samme post kørt alene gav to varianter), så en hash alene siger "ændret" for meget. En
// forskel over STOEJ_DELTA er "ændret", også når den er lille: se selv på billedet.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';

const STOEJ_DELTA = 8;
const [gammel, ny] = process.argv.slice(2);
if (!gammel || !ny || ![gammel, ny].every(m => fs.existsSync(m) && fs.statSync(m).isDirectory())) { console.log('Brug: node tests/ui/fotobog-diff.mjs <gammel mappe> <ny mappe>'); process.exit(2); }

/* PNG med 8 bit pr. kanal, RGB eller RGBA, uden interlace (det, Chrome skriver). Svarer med bredde, højde og pixels. */
function afkod(buf) {
  let o = 8, w = 0, h = 0, kanaler = 0;
  const idat = [];
  while (o < buf.length) {
    const n = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + n);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4);
      kanaler = { 2: 3, 6: 4 }[d[9]] || 0;
      if (d[8] !== 8 || !kanaler || d[12] !== 0) throw new Error(`PNG-formatet kan ikke læses (bit ${d[8]}, farve ${d[9]}, interlace ${d[12]})`);
    }
    if (type === 'IDAT') idat.push(d);
    o += 12 + n;
  }
  const raa = zlib.inflateSync(Buffer.concat(idat)), linje = w * kanaler, px = Buffer.alloc(h * linje);
  for (let y = 0; y < h; y++) {
    const filter = raa[y * (linje + 1)], r = raa.subarray(y * (linje + 1) + 1, (y + 1) * (linje + 1));
    for (let x = 0; x < linje; x++) {
      const a = x >= kanaler ? px[y * linje + x - kanaler] : 0, b = y ? px[(y - 1) * linje + x] : 0, c = x >= kanaler && y ? px[(y - 1) * linje + x - kanaler] : 0;
      let v = r[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * linje + x] = v & 255;
    }
  }
  return { w, h, kanaler, px };
}
/* Forskellen i pixels: antal, største forskel i en farvekanal og området. */
function forskel(a, b) {
  if (a.w !== b.w || a.h !== b.h) return { px: a.w * a.h, delta: 255, omraade: `størrelsen ${a.w}×${a.h} → ${b.w}×${b.h}` };
  let n = 0, delta = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    let d = 0;
    for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(a.px[(y * a.w + x) * a.kanaler + k] - b.px[(y * b.w + x) * b.kanaler + k]));
    if (!d) continue;
    n++; delta = Math.max(delta, d); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { px: n, delta, omraade: n ? `x ${x0}–${x1}, y ${y0}–${y1}` : '' };
}

const laes = mappe => new Map(fs.readdirSync(mappe).filter(f => f.endsWith('.png')).map(f => { const b = fs.readFileSync(path.join(mappe, f)); return [f, { bytes: b.length, hash: createHash('sha256').update(b).digest('hex'), fil: path.join(mappe, f) }]; }));
const a = laes(gammel), b = laes(ny), navne = [...new Set([...a.keys(), ...b.keys()])].sort();
let ens = 0, stoej = 0, aendret = 0, nye = 0, vaek = 0;
for (const f of navne) {
  const x = a.get(f), y = b.get(f);
  if (!x) { nye++; console.log(`ny      ${f}`); continue; }
  if (!y) { vaek++; console.log(`væk     ${f}`); continue; }
  if (x.hash === y.hash) { ens++; continue; }
  const d = forskel(afkod(fs.readFileSync(x.fil)), afkod(fs.readFileSync(y.fil)));
  const tekst = `${f} (${x.bytes} → ${y.bytes} bytes; ${d.px} px, største forskel ${d.delta}/255, ${d.omraade})`;
  if (!d.px) ens++;
  else if (d.delta <= STOEJ_DELTA) { stoej++; console.log(`støj    ${tekst}`); }
  else { aendret++; console.log(`ændret  ${tekst}`); }
}
console.log(`${ens} ens, ${stoej} støj (højst ${STOEJ_DELTA}/255), ${aendret} ændret, ${nye} nye, ${vaek} væk`);
process.exit(aendret + nye + vaek ? 1 : 0);
