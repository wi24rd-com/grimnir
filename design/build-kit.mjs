// Wi24rd UI Kit 2: pakken (design/ui-kit-2/pakke/) er kittets ene kilde; programmets kopier i ui/assets/ laves her.
// Ingen afhængigheder ud over Node selv.
//   node design/build-kit.mjs          kopierer pakkens filer til ui/assets/
//   node design/build-kit.mjs --check  fejler (exit 1), hvis en kopi ikke er byte for byte som kilden
// Hvad kopieres: tokens/tokens.css og alt i web/ (kit.css, kit.js, tema.js, sprogmotor.js og fonts/). Mappen fonts/ skal
// også have præcis de samme filer: en fil, der kun findes i kopien, er en fejl. Kør design/build-tokens.mjs først, hvis
// tokens.json er rettet: dette script bygger ikke, det kopierer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAKKE = path.join(REPO, 'design', 'ui-kit-2', 'pakke');
export const MAAL = path.join(REPO, 'ui', 'assets');

function filerI(dir, rel = '') {
  const ud = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    const r = path.join(rel, e.name);
    if (e.isDirectory()) ud.push(...filerI(dir, r));
    else ud.push(r);
  }
  return ud;
}

/* [[kilde, kopi], …] med fulde stier. */
export function par() {
  const web = path.join(PAKKE, 'web');
  return [
    [path.join(PAKKE, 'tokens', 'tokens.css'), path.join(MAAL, 'tokens.css')],
    ...filerI(web).map(r => [path.join(web, r), path.join(MAAL, r)]),
  ];
}

/* Afvigelser som tekstlinjer; tom liste = alt er ens. */
export function afvigelser() {
  const ud = [];
  const rel = f => path.relative(REPO, f);
  for (const [kilde, kopi] of par()) {
    if (!fs.existsSync(kopi)) ud.push(`${rel(kopi)} mangler (kilde: ${rel(kilde)})`);
    else if (!fs.readFileSync(kilde).equals(fs.readFileSync(kopi))) ud.push(`${rel(kopi)} afviger fra ${rel(kilde)}`);
  }
  const kilder = new Set(filerI(path.join(PAKKE, 'web', 'fonts')));
  const kopiFonts = path.join(MAAL, 'fonts');
  if (fs.existsSync(kopiFonts)) for (const f of filerI(kopiFonts)) if (!kilder.has(f)) ud.push(`${rel(path.join(kopiFonts, f))} findes ikke i pakken`);
  return ud;
}

const erHoved = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (erHoved) {
  if (process.argv.includes('--check')) {
    const a = afvigelser();
    if (a.length) {
      for (const l of a) console.error(l);
      console.error('Kittets kopier i ui/assets/ svarer ikke til pakken. Ret i design/ui-kit-2/pakke/ og kør: node design/build-kit.mjs');
      process.exit(1);
    }
    console.log(`ui/assets svarer til pakken (${par().length} filer, byte for byte)`);
  } else {
    for (const [kilde, kopi] of par()) {
      fs.mkdirSync(path.dirname(kopi), { recursive: true });
      fs.copyFileSync(kilde, kopi);
    }
    console.log(`kopierede ${par().length} filer fra ${path.relative(REPO, PAKKE)} til ${path.relative(REPO, MAAL)}`);
  }
}
