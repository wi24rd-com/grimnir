// Tjek af brugervejledningen i docs/manual/ (V-DOK.2 N5). Kun node, ingen pakker. Brug: npm run test:manual.
// Fejler med exit 1, hvis:
//   1. et kapitel i manual.json mangler på et af sprogene (eller en .md-fil ikke står i manual.json),
//   2. et billede, der henvises til, ikke findes i img/,
//   3. et billede i img/ ikke bruges,
//   4. et internt link peger på en fil, der ikke findes,
//   5. teksten har et klokkeslæt (fx 12.00 eller 08:14).
// Desuden: hvert billede har en alt-tekst, et dansk kapitel bruger kun danske billeder og et engelsk kun engelske, og
// manual.json's sha256 og titler svarer til filerne. GR_MANUAL peger på en anden mappe (mutationsprøver i en kopi).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rod = path.resolve(process.env.GR_MANUAL || path.join(repo, 'docs', 'manual'));
const SPROG = ['da', 'en'];
let ok = 0;
const fejl = [];
const tjek = (betingelse, tekst) => { if (betingelse) ok++; else fejl.push(tekst); };
const rel = f => path.relative(rod, f).split(path.sep).join('/');

const mdFiler = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? mdFiler(path.join(d, e.name)) : e.name.endsWith('.md') ? [path.join(d, e.name)] : []));

let manual = null;
try { manual = JSON.parse(fs.readFileSync(path.join(rod, 'manual.json'), 'utf8')); } catch (e) { fejl.push(`manual.json kan ikke læses: ${e.message}`); }
if (manual) {
  tjek(Array.isArray(manual.sider) && manual.sider.length > 0, 'manual.json har ingen sider');
  tjek(JSON.stringify(manual.sprog) === JSON.stringify(SPROG), `manual.json: sprog er ${JSON.stringify(manual.sprog)}, ikke ${JSON.stringify(SPROG)}`);
  tjek(typeof manual.version === 'string' && manual.titel && SPROG.every(s => manual.titel[s]), 'manual.json mangler version eller titel på et sprog');
}
const sider = manual && Array.isArray(manual.sider) ? manual.sider : [];

// 1. Hvert kapitel findes på begge sprog, og hver .md-fil står i manual.json.
const listet = new Set();
for (const s of sider) {
  for (const sp of SPROG) {
    const fil = s[sp] && s[sp].fil;
    tjek(fil === `${sp}/${s.id}.md`, `kapitel ${s.id}: ${sp}.fil er ${fil}, ikke ${sp}/${s.id}.md`);
    const f = path.join(rod, `${sp}/${s.id}.md`);
    listet.add(f);
    const findes = fs.existsSync(f);
    tjek(findes, `kapitel ${s.id} mangler på ${sp}: ${sp}/${s.id}.md findes ikke`);
    if (findes) {
      const h1 = /^# (.+)$/m.exec(fs.readFileSync(f, 'utf8'));
      tjek(h1 && s[sp].titel === h1[1], `kapitel ${s.id} (${sp}): titlen i manual.json svarer ikke til overskriften`);
    }
  }
}
const alleMd = SPROG.flatMap(sp => (fs.existsSync(path.join(rod, sp)) ? mdFiler(path.join(rod, sp)) : []));
for (const f of alleMd) tjek(listet.has(f), `${rel(f)} står ikke i manual.json`);

// 2–5 pr. fil.
const imgMappe = path.join(rod, 'img');
const billeder = fs.existsSync(imgMappe) ? fs.readdirSync(imgMappe).filter(f => !f.startsWith('.')) : [];
const brugt = new Set();
/* Et klokkeslæt: timer og minutter med punktum eller kolon, ikke en del af en adresse, et versionsnummer eller et tal
   med tusindtalspunktum (10.20.30.40, 1.0.0 og 4.000 rammes ikke). */
const KLOKKE = /(?<![\d.:])(?:[01]?\d|2[0-3])[.:][0-5]\d(?![\d]|[.:]\d)/g;
for (const f of alleMd) {
  const sp = rel(f).split('/')[0];
  const tekst = fs.readFileSync(f, 'utf8');
  // 2. Billederne findes, har en alt-tekst og er på kapitlets sprog.
  for (const [, alt, maal] of tekst.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const b = path.resolve(path.dirname(f), maal);
    tjek(fs.existsSync(b) && path.dirname(b) === imgMappe, `${rel(f)}: billedet ${maal} findes ikke i img/`);
    tjek(alt.trim().length > 0, `${rel(f)}: billedet ${maal} har ingen alt-tekst`);
    const m = /--(?:light|dark)-(da|en)-\d+x\d+\.\w+$/.exec(maal);
    tjek(!m || m[1] === sp, `${rel(f)}: billedet ${maal} er ikke på kapitlets sprog (${sp})`);
    brugt.add(path.basename(b));
  }
  // 4. Interne links (ikke billeder og ikke adresser) peger på en fil, der findes.
  for (const [, maal] of tekst.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(maal) || maal.startsWith('#')) continue;
    const m = path.resolve(path.dirname(f), maal.split('#')[0]);
    tjek(fs.existsSync(m) && (m + path.sep).startsWith(rod + path.sep), `${rel(f)}: linket ${maal} peger på en fil, der ikke findes`);
  }
  // 5. Intet klokkeslæt (også ikke i billedtekster og alt-tekster).
  const linjer = tekst.split('\n');
  linjer.forEach((l, i) => { for (const k of l.matchAll(KLOKKE)) fejl.push(`${rel(f)}:${i + 1}: klokkeslæt «${k[0]}»`); });
  ok++;
}

// 3. Hvert billede i img/ bruges, og manual.json's billeder findes med samme sha256.
for (const b of billeder) tjek(brugt.has(b), `img/${b} bruges ikke i vejledningen`);
for (const s of sider) for (const b of s.billeder || []) {
  const f = path.join(rod, b.fil);
  tjek(fs.existsSync(f) && crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') === b.sha256, `manual.json: ${b.fil} (kapitel ${s.id}) findes ikke eller har en anden sha256`);
}

for (const f of fejl) console.log('FEJL ' + f);
console.log(`${sider.length} kapitler × ${SPROG.length} sprog, ${billeder.length} billeder`);
console.log(`${ok + fejl.length} tjek: ${ok} ok, ${fejl.length} fejl`);
process.exit(fejl.length ? 1 : 0);
