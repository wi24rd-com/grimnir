// V-KIT.1: Wi24rd UI Kit 2 som pakke (design/ui-kit-2/pakke/). Uden at starte programmet og uden netværk.
// Kontrollerer: at pakken er den ene kilde (kopierne i ui/assets/ er byte for byte ens, tokens.css og Tokens.xaml svarer
// til tokens.json), at kittets web-filer ikke kender programmet, de blev udskilt fra, at demosiden ikke henter noget
// udefra og faktisk kører med pakkens filer i begge temaer og sprog, at Tokens.xaml er velformet og har hver token i
// begge ordbøger med samme farver som CSS, og at KOMPONENTER.md og koden nævner de samme klasser og funktioner.
// Brug: node tests/ui/kit-pakke.mjs (npm run test:kit). Exit 1 ved fejl. Kun opdigtede data.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { laesTokens, bygCss, bygXaml, temaVaerdier, pascal, argb, KILDE, MAAL, MAAL_XAML, PAKKE, XAML_TEMA, pakkeVersion } from '../../design/build-tokens.mjs';
import { afvigelser, par } from '../../design/build-kit.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pk = p => fs.readFileSync(path.join(PAKKE, p), 'utf8');
let ok = 0, fejl = 0;
const tjek = (navn, betingelse, detalje = '') => {
  if (betingelse) { ok++; console.log('ok   ' + navn); } else { fejl++; console.log('FEJL ' + navn + (detalje ? ' — ' + detalje : '')); }
};
const vent = (ms = 0) => new Promise(r => setTimeout(r, ms));
const tokens = laesTokens();
const VERSION = pakkeVersion();
// Pakke 2.3.0 (K10–K17): de nye navne i kittet. Det, der ikke står her, V200_* eller 2.2.0's lister, må ikke findes.
const V230_FUNKTIONER = ['Kit.filterchip', 'Kit.filterchips', 'Kit.kasse', 'Kit.statusflise', 'Kit.statusfliser', 'Kit.tomTilstand', 'Kit.fremdrift', 'Kit.vaerktoejstip', 'Kit.afkrydsning', 'Kit.kontakt', 'Kit.radiogruppe', 'Kit.valgliste', 'Kit.dialog', 'Kit.bekraeft', 'Kit.sideskift'];
// K15: en tabel bygget af 2.0.0's kit.js (git show 64c0cce:design/ui-kit-2/pakke/web/kit.js) med bygTabel i 2.3.0-blokken: efter
// oprettelsen og efter vaelg(1). Uden de nye indstillinger skal tabellen være byte for byte den samme.
const V200_TABEL = {"tabel": "<table class=\"tabel\" role=\"grid\" data-t-aria=\"tabelAria\"><thead><tr><th data-t=\"kolVaerdi\" scope=\"col\"></th><th scope=\"col\">Status</th><th class=\"r\" data-t=\"kolAntal\" scope=\"col\"></th></tr></thead><tbody><tr class=\"gruppe\"><td colspan=\"3\"><b data-t=\"grpAdresser\"></b> <span class=\"muted\">2 rækker</span></td></tr><tr tabindex=\"0\" aria-selected=\"false\"><td class=\"mono\">192.0.2.17</td><td><span class=\"chip ok\"><span aria-hidden=\"true\">✓</span><span class=\"ord\">Maskeres</span></span></td><td class=\"r\">4</td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">2001:db8::17</td><td></td><td class=\"r\">12</td></tr><tr class=\"gruppe\"><td colspan=\"3\"><b>Navne</b></td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">srv-app01.eksempel.dk</td><td><span class=\"chip warn\"><span aria-hidden=\"true\">!</span><span class=\"ord\" data-t=\"cWarn\"></span></span></td><td class=\"r\">0</td></tr></tbody></table>", "tabelValgt": "<table class=\"tabel\" role=\"grid\" data-t-aria=\"tabelAria\"><thead><tr><th data-t=\"kolVaerdi\" scope=\"col\"></th><th scope=\"col\">Status</th><th class=\"r\" data-t=\"kolAntal\" scope=\"col\"></th></tr></thead><tbody><tr class=\"gruppe\"><td colspan=\"3\"><b data-t=\"grpAdresser\"></b> <span class=\"muted\">2 rækker</span></td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">192.0.2.17</td><td><span class=\"chip ok\"><span aria-hidden=\"true\">✓</span><span class=\"ord\">Maskeres</span></span></td><td class=\"r\">4</td></tr><tr tabindex=\"0\" aria-selected=\"true\" class=\"sel\"><td class=\"mono\">2001:db8::17</td><td></td><td class=\"r\">12</td></tr><tr class=\"gruppe\"><td colspan=\"3\"><b>Navne</b></td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">srv-app01.eksempel.dk</td><td><span class=\"chip warn\"><span aria-hidden=\"true\">!</span><span class=\"ord\" data-t=\"cWarn\"></span></span></td><td class=\"r\">0</td></tr></tbody></table>"};
// Pakke 2.4.0 (K36–K38, K18–K21, K29, K30): de nye navne. Det, der ikke står her, V200_*, 2.2.0's eller V230_*, må ikke findes.
const V240_FUNKTIONER = ['Kit.tabelRul'];
const V240_KLASSER = ['uden-valg', 'kol-xs', 'kol-s', 'kol-m', 'kol-l', 'kol-xl', 'kol-skille', 'layout-auto', 'tabel-rul', 'fast-foerste'];
// Pakke 2.5.0 (K22–K26, K28, K31–K35, G1–G11): de nye navne. Det, der ikke står her, V200_*, 2.2.0's, V230_* eller V240_*, må ikke findes.
const V250_FUNKTIONER = ['Kit.fodstatus'];
const V250_KLASSER = ['mrk-billede', 'mrk-maske', 'ant-kraever', 'fodstatus', 'fodstatus-maal', 'fodstatus-mrk', 'fodstatus-tekst', 'fodstatus-bjaelke', 'fchip-fjern', 'fchip-x', 'kasse-ikon', 'sflise-to', 'sflise-maal', 'sflise-under-maal', 'sflise-indhold', 'tomt-handlinger', 'tomt-modtager', 'tomt-slip', 'modal-fejl', 'modal-foer', 'modal-guide'];
// Pakke 2.6.0 (visningerne som faner øverst, NavPane uden visningsskift, valgt række under musen): de nye navne. Ingen nye
// funktioner. Det, der ikke står her eller i de ældre lister, må ikke findes.
const V260_FUNKTIONER = [];
const V260_KLASSER = ['vfaner', 'vf', 'vf-navn'];
// V-FANER.1: syv eksempler som Huginn and Muninn bygger dem (otte visninger nederst med genveje, tal og punkter slået fra,
// bånd uden faner med hvorforTip og en segmentknap, træ, der bygges om, tabel med valg) og et bånd med to faner, bygget
// af 2.5.0's kit.js (git show a1700dc:design/ui-kit-2/pakke/web/kit.js) med bygV250 herunder. 2.6.0 skal bygge dem byte
// for byte ens. V250_CSS er de 409 regelsæt i 2.5.0's kit.css (uden kommentarer, mellemrum samlet), hver som de første
// 12 tegn af sin sha256: hvert af dem skal stå uændret i 2.6.0's kit.css (kun tilføjelser).
const V250_UDSEENDE = {"hamSkift": "<div class=\"skift taet\" role=\"group\" data-t-aria=\"navH\"><a class=\"vs\" href=\"#overblik\" data-visning=\"overblik\" aria-keyshortcuts=\"Meta+1\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>Overblik</span><kbd aria-hidden=\"true\">⌘1</kbd></a><a class=\"vs on\" href=\"#siden\" data-visning=\"siden\" aria-keyshortcuts=\"Meta+2\" aria-current=\"page\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"1.5\"></rect><path d=\"M4 10h16M8 3v4M16 3v4\"></path></svg><span>Siden sidst</span><span class=\"ant ant-kraever\" data-ant=\"\" aria-hidden=\"true\">3</span><span class=\"skjult-tekst\" data-t=\"kraever\" data-ant=\"\" data-v=\"3\"></span><kbd aria-hidden=\"true\">⌘2</kbd></a><span class=\"tip-plads\"><a class=\"vs\" href=\"#angreb\" data-visning=\"angreb\" aria-keyshortcuts=\"Meta+3\" aria-disabled=\"true\" aria-describedby=\"kit-tip1\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z\"></path></svg><span>Angreb</span><span class=\"ant\" data-ant=\"\">7</span><kbd aria-hidden=\"true\">⌘3</kbd></a><span class=\"tip\" data-t=\"hvorforToken\" id=\"kit-tip1\" role=\"tooltip\" hidden=\"\"></span></span><a class=\"vs\" href=\"#robotter\" data-visning=\"robotter\" aria-keyshortcuts=\"Meta+4\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 5h16l-6 7v6l-4 2v-8z\"></path></svg><span>Robotter</span><kbd aria-hidden=\"true\">⌘4</kbd></a><span class=\"tip-plads\"><a class=\"vs\" href=\"#login\" data-visning=\"login\" aria-keyshortcuts=\"Meta+5\" aria-disabled=\"true\" aria-describedby=\"kit-tip2\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"></rect><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"></path></svg><span>Login</span><kbd aria-hidden=\"true\">⌘5</kbd></a><span class=\"tip\" data-t=\"hvorforToken\" id=\"kit-tip2\" role=\"tooltip\" hidden=\"\"></span></span><a class=\"vs\" href=\"#land\" data-visning=\"land\" aria-keyshortcuts=\"Meta+6\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M3 12h18\"></path><path d=\"M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z\"></path></svg><span>Land</span><kbd aria-hidden=\"true\">⌘6</kbd></a><a class=\"vs\" href=\"#besoeg\" data-visning=\"besoeg\" aria-keyshortcuts=\"Meta+7\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z\"></path><circle cx=\"12\" cy=\"12\" r=\"2.5\"></circle></svg><span>Besøgende</span><kbd aria-hidden=\"true\">⌘7</kbd></a><a class=\"vs\" href=\"#tek\" data-visning=\"tek\" aria-keyshortcuts=\"Meta+8\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M9.4 5.2L10.1 2.2L13.9 2.2L14.6 5.2A7.3 7.3 0 0 1 16.6 6.3L19.6 5.4L21.5 8.7L19.2 10.9A7.3 7.3 0 0 1 19.2 13.1L21.5 15.3L19.6 18.6L16.6 17.7A7.3 7.3 0 0 1 14.6 18.8L13.9 21.8L10.1 21.8L9.4 18.8A7.3 7.3 0 0 1 7.4 17.7L4.5 18.6L2.5 15.3L4.8 13.1A7.3 7.3 0 0 1 4.8 10.9L2.5 8.7L4.5 5.4L7.4 6.3A7.3 7.3 0 0 1 9.4 5.2z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle></svg><span>Teknologi</span><kbd aria-hidden=\"true\">⌘8</kbd></a></div>", "hamSkiftEfter": "<div class=\"skift taet\" role=\"group\" data-t-aria=\"navH\"><a class=\"vs\" href=\"#overblik\" data-visning=\"overblik\" aria-keyshortcuts=\"Meta+1\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>Overblik</span><kbd aria-hidden=\"true\">⌘1</kbd></a><a class=\"vs\" href=\"#siden\" data-visning=\"siden\" aria-keyshortcuts=\"Meta+2\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"1.5\"></rect><path d=\"M4 10h16M8 3v4M16 3v4\"></path></svg><span>Siden sidst</span><span class=\"ant\" data-ant=\"\" aria-hidden=\"true\">0</span><span class=\"skjult-tekst\" data-t=\"kraever\" data-ant=\"\" data-v=\"0\"></span><kbd aria-hidden=\"true\">⌘2</kbd></a><a class=\"vs on\" href=\"#angreb\" data-visning=\"angreb\" aria-keyshortcuts=\"Meta+3\" aria-current=\"page\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z\"></path></svg><span>Angreb</span><span class=\"ant\" data-ant=\"\">7</span><kbd aria-hidden=\"true\">⌘3</kbd></a><a class=\"vs\" href=\"#robotter\" data-visning=\"robotter\" aria-keyshortcuts=\"Meta+4\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 5h16l-6 7v6l-4 2v-8z\"></path></svg><span>Robotter</span><kbd aria-hidden=\"true\">⌘4</kbd></a><span class=\"tip-plads\"><a class=\"vs\" href=\"#login\" data-visning=\"login\" aria-keyshortcuts=\"Meta+5\" aria-disabled=\"true\" aria-describedby=\"kit-tip2\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"></rect><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"></path></svg><span>Login</span><kbd aria-hidden=\"true\">⌘5</kbd></a><span class=\"tip\" data-t=\"hvorforToken\" id=\"kit-tip2\" role=\"tooltip\" hidden=\"\"></span></span><a class=\"vs\" href=\"#land\" data-visning=\"land\" aria-keyshortcuts=\"Meta+6\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M3 12h18\"></path><path d=\"M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z\"></path></svg><span>Land</span><kbd aria-hidden=\"true\">⌘6</kbd></a><a class=\"vs\" href=\"#besoeg\" data-visning=\"besoeg\" aria-keyshortcuts=\"Meta+7\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z\"></path><circle cx=\"12\" cy=\"12\" r=\"2.5\"></circle></svg><span>Besøgende</span><kbd aria-hidden=\"true\">⌘7</kbd></a><a class=\"vs\" href=\"#tek\" data-visning=\"tek\" aria-keyshortcuts=\"Meta+8\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M9.4 5.2L10.1 2.2L13.9 2.2L14.6 5.2A7.3 7.3 0 0 1 16.6 6.3L19.6 5.4L21.5 8.7L19.2 10.9A7.3 7.3 0 0 1 19.2 13.1L21.5 15.3L19.6 18.6L16.6 17.7A7.3 7.3 0 0 1 14.6 18.8L13.9 21.8L10.1 21.8L9.4 18.8A7.3 7.3 0 0 1 7.4 17.7L4.5 18.6L2.5 15.3L4.8 13.1A7.3 7.3 0 0 1 4.8 10.9L2.5 8.7L4.5 5.4L7.4 6.3A7.3 7.3 0 0 1 9.4 5.2z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle></svg><span>Teknologi</span><kbd aria-hidden=\"true\">⌘8</kbd></a></div>", "skiftTo": "<div class=\"skift\" role=\"group\"><a class=\"vs\" href=\"#a\" data-visning=\"a\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"vA\"></span></a><a class=\"vs on\" href=\"#b\" data-visning=\"b\" aria-current=\"page\"><span data-t=\"vB\"></span></a></div>", "hamBaand": "<div class=\"cmd enkel\" role=\"group\" data-t-aria=\"baandAria\"><div class=\"grupper\" id=\"kit-cb1-panel-start\" data-fane=\"start\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-1\"><div class=\"kn\"><span class=\"tip-plads\"><button class=\"cb pri\" type=\"button\" data-kommando=\"hent\" aria-disabled=\"true\" aria-describedby=\"kit-tip4\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7 5l12 7-12 7z\"></path></svg><span data-t=\"kHent\"></span></button><span class=\"tip\" data-t=\"hvorforVent\" id=\"kit-tip4\" role=\"tooltip\" hidden=\"\"></span></span><button class=\"cb\" type=\"button\" data-kommando=\"eks\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 15V4\"></path><path d=\"M7 9l5-5 5 5\"></path><path d=\"M5 14v6h14v-6\"></path></svg><span data-t=\"kEks\"></span></button></div><span class=\"cap\" data-t=\"gData\" id=\"kit-cb1-grp-1\"></span></div><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-2\"><div class=\"kn\"><div class=\"baand-el\"><div class=\"seg\" role=\"radiogroup\" aria-label=\"P\"><button class=\"seg-v\" data-t=\"p7\" type=\"button\" role=\"radio\" data-valg=\"7\" aria-checked=\"true\" tabindex=\"0\"></button><button class=\"seg-v\" data-t=\"p30\" type=\"button\" role=\"radio\" data-valg=\"30\" aria-checked=\"false\" tabindex=\"-1\"></button></div></div></div><span class=\"cap\" data-t=\"gPeriode\" id=\"kit-cb1-grp-2\"></span></div></div></div>", "baandFaner": "<div class=\"cmd\"><div class=\"tabs\" role=\"tablist\" data-t-aria=\"c\"><button class=\"tab\" data-t=\"faneStart\" type=\"button\" id=\"kit-cb2-fane-start\" role=\"tab\" aria-controls=\"kit-cb2-panel-start\" data-fane=\"start\" aria-selected=\"false\" tabindex=\"-1\"></button><button class=\"tab on\" data-t=\"faneVis\" type=\"button\" id=\"kit-cb2-fane-vis\" role=\"tab\" aria-controls=\"kit-cb2-panel-vis\" data-fane=\"vis\" aria-selected=\"true\" tabindex=\"0\"></button></div><div class=\"grupper\" id=\"kit-cb2-panel-start\" role=\"tabpanel\" aria-labelledby=\"kit-cb2-fane-start\" data-fane=\"start\" hidden=\"\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb2-grp-1\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"k\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"></path></svg><span data-t=\"k\"></span></button></div><span class=\"cap\" data-t=\"g\" id=\"kit-cb2-grp-1\"></span></div></div><div class=\"grupper\" id=\"kit-cb2-panel-vis\" role=\"tabpanel\" aria-labelledby=\"kit-cb2-fane-vis\" data-fane=\"vis\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb2-grp-2\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"lys\" aria-pressed=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"></path></svg><span data-t=\"kLys\"></span></button></div><span class=\"cap\" data-t=\"g2\" id=\"kit-cb2-grp-2\"></span></div></div></div>", "hamTrae": "<ul class=\"trae\" role=\"tree\" data-t-aria=\"t\"><li role=\"none\"><button class=\"tr on\" type=\"button\" data-punkt=\"samlet\" role=\"treeitem\" aria-level=\"1\" tabindex=\"0\" aria-expanded=\"true\" aria-current=\"true\" aria-selected=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 9l6 6 6-6\"></path></svg><span data-t=\"tSamlet\"></span><span class=\"ant\">1</span></button><ul role=\"group\"><li role=\"none\"><button class=\"tr\" type=\"button\" data-punkt=\"a\" role=\"treeitem\" aria-level=\"2\" tabindex=\"-1\" aria-selected=\"false\"><span>eksempel.dk</span></button></li></ul></li></ul>", "tabelValgt": "<table class=\"tabel\" role=\"grid\" data-t-aria=\"x\"><thead><tr><th data-t=\"kolDomaene\" scope=\"col\"></th><th class=\"r\" data-t=\"kolAntal\" scope=\"col\"></th></tr></thead><tbody><tr tabindex=\"-1\" aria-selected=\"false\"><td>eksempel.dk</td><td class=\"r\">4</td></tr><tr tabindex=\"0\" aria-selected=\"true\" class=\"sel\"><td>shop.eksempel.dk</td><td class=\"r\">2</td></tr></tbody></table>"};
const V250_CSS = 'b190a4ef6d78 409377812557 d1f2fba0fee4 924c8f394378 ec4b4383b83e 0143fe6bf004 35536ac589ba 30f14d46d775 6624c59b1dda 6ea6907e8bf8 3793d111fa24 984ea12ba4ba 6258e84a1b6a ad5bcb4996f1 6887ca054512 461477af8c96 a63a3a4a42d9 f4b74169d18b 23e7dce574fb ef561db9f258 5932ecd9b430 4acb95b7e823 50fef3ae45f9 d11de26b222a 0b475e80baee 7a759713688d 4c1f316f40be cde81eecc6c9 4b1772b092f1 309327801d65 411bb3d20631 e7ea6ce7526b f46c3da72ee4 0cd03c31cd27 6a50500acd65 25400fc1ffa7 ed49f487cfb2 d149e08dafc8 3230f5dfe710 882c2d62daf2 0c7941af3149 6e08cc21aa7a ae03b46128f1 7d479d36932a 13ad0510f046 97c93a14fc6c c4f0fb911a5f e7e7c196bfab d5b3ed75e9ba be44149f96e8 82937e7f2fb5 4093dc3a78e3 fe7962986e3d 4a7a6f70ae4e 8724ac29b7aa c9efdadb7fdb fb825e6aca7a 290155dbd7b2 5679ed9e9148 3d63e1d73ff2 f0978d077b7a 41771f787729 39cc6c1d6f17 df25cf69e096 0bae53a29990 8c881bacdd88 7ffbc0eea02f 892c38f0d160 fee7dbe59bed 60f0b6dd4822 58a4e3de5ada dd3be7ff0585 4267f57e49c2 b84f2e47d40c 9b4bc25dc04c 0afd187b0d7f f1aa38e27148 94dab5879c17 137019628abd cd71e47a708c 209375a8a752 b2d05b8b3b50 e6ce25f732cf f7a3eeb2b285 91fbeac243d3 69ab9d08fdc6 177894c15dc1 3505d04c9e52 ae48175dd362 4e4925e67d0e 5f543e1217db 713cd42a0391 0f49519987f0 b1c54bb7f3c5 6f0e6a8fd2b1 17d75932ba1c 115e40a28f03 25e374e0738f 84e6b900d215 a815fb6f2442 334364b43e74 263a8067dc4d ac8725ecd8c5 5ac5d197f8ea 1a53e4f7f56f ecc609f64065 0ef0e07379c4 284668c27492 d5d19afa859a 24b787134cee 3357e64f464f 2bb429ca8da1 e81cfce9f2f5 0dea90d65476 797318bde205 2c7bd0abd66a 76769cd390e9 2e19a229cbf1 2746ccea05f5 fef7cc48eca5 3d130f39b8d8 aa678e720616 e6949c94f0e0 65453d5c3fb9 2bb26a310ee5 78655e5cf7fb d08d8ff9d091 465bc54ce53e 2e5415fa2e47 6d8721a8057e d9dda73d7168 b24e81ee91fc b6060c702302 c136c038edeb 7b38fe385404 bbca3f3427c4 493e9fc39d3e 7c78a24d9b47 a0cca174a853 defdd4ce0195 3d35b39b9366 89993201dab1 a28f8541ce1e bf2808bd8f73 9ec9c37adcd7 84fa9ba397a1 a883cc71cd9b c00ab124c17c b66508277fcd a0263fec4e4f 5b745b9c3987 b2e4bd0b51c5 8039c9c621f3 e57ce32dd366 4543aeccd3ba d73d63697ed2 f06170329e34 3bedabff7584 3278d0ab0376 e5c92fc21db4 282e0857e5e3 adc5f48eb4ec 04a291c6d307 7bb895cb3c7b a7337386b5b7 ea9d1063b81f 95e4833d5011 c67b0ba95ad8 8f0b47b2b730 d48d6a948d89 f8baae03570c 6d4779f90b70 896ffaf32e37 35d67bdf65dd 884d5fa4b25d faec89a0a013 c5747a92d409 b501dbcdaf3b 7769eaaa9d19 8f9ff39024aa 2ae8e80ca28b d075df8c1855 c2c39e8fd684 a99a3f3fddf7 0a207469f6d2 11f82fc57689 9aafd4778abc b4b86e647a1e 26d2b6936cfe 05fe13dc43e8 a542cbf168e0 ee3bb335f4c2 b3976c8c5a4b 122825554c01 0401d094e821 ecf3eedbfda8 030c6181d018 899f796fdb47 e676a9ec7450 2464f974fa73 cb17c7c795de 9ecb0c2f6df5 35756666dc27 835314f5b2bb 8408a6595ec9 0bb5a16c6dcf 7af4ef6997a6 16f02fb1593b 7c3d3f793d0f 8c04e6ab91ff 3cff18cfd75e d101f3b872f1 8dd6d629a4f1 9ed3d52c251d bf29e1b0be06 5b70721323fc 1d77b0fed7c0 21638a31e852 39e808599140 a7dfbd1d5095 4543899ecb75 ff468e679756 61dc7ffde18a 3fc901e105ff f47f024b0704 e02094fc1b3b 0fe1ace9b301 7ea8b7f6ce67 5beabb8fa16f ce8a78d7e268 717f696c5077 b2bef74511d0 bc09dcf79023 ccd74ede1ede 1901cc4669f8 66656c4a984f 1b35cb7c30b6 edce040e535a 24ee1f3ca490 51b2a1dccf89 685b60f4e253 ff5cebfc0fc0 5727efb6e335 c76e5d6b7438 717abd1bf6de ace6d58385bc e70ab8eb8088 1a463ebb48e3 cf454ca8329c 639ea8b614f4 74f8965076a1 5500039c3654 3aa25df0d9cf debbbc1543ab 51468f27ca60 9a70191e7705 8acf3d5fcb19 aeaa125379e9 6e231331a761 3db30fd8f6be 52040de8b213 cebfce58b90c 8150a60cce65 4d5414aeaa1e e16d3fdb4c6d 63c3fba4f115 f75714dca935 523ab8a43949 d9811186f5da 6db1f62e0aed 7353fc47ad9d 25e88fa359a8 ad9369e607f4 82c341d94ca7 07ee1d29ec08 33e8982e41a1 3fc26df4707a 37fa1f76f344 1b3d73a79e95 c0636c5d7a02 98a997ac3a29 77b781480735 de900e9c0032 ad8b9eb74097 5866a508c8dc 3dbbe95f20c9 6acb7b415f18 0520d2d1d203 e0b0a850c8c4 55da6355a712 1b1e1cb8cdc9 dfbaafe8158a dc6463b8219a d33367fd8be2 d366dcb3fcfd 73bf6386e037 0966364b9b4d 32b580a307a1 10b0cfce811a e90a7cbaf40e b31c6ed3cb96 b91a6005b873 99814ba10c3c eabc92a61135 47467690b67d dcedc9b057ab 5c25fa196964 73737ba6b65e 1317c98c00c8 c440c7cfe35e ae6653284738 e8cf78279f79 e0af9167c8b9 314a7982fd8d b475a4e3cc5d c7f202e9a81e d91fdda4798c 583fce862fad 8b137904e118 75c9bfe2472f da13505695cf 7f287ce582b7 e1c596a489e8 b8c2e2cbbfb7 11b88541d331 95831ee430d4 72f444d728dc 9af52163e19f 5f573258f928 1221eacc313f 6a30b46ef62e 94575ecd3cc0 7ff55fcbf19b 5ee9b951ba9f ac8862c4dd48 c9225a36c000 29865614dd5f faf459681a38 96ef10cb11fd d41b559c1506 3d55930e6154 24c35a38d634 73c7d18e755b 5028aa2de4aa 72b48de84219 e57b2294d0e4 3fc41a242034 2a4a4f699336 61ad74317522 c3cbe2183517 d42c1e03c362 5d4cf771279e a20e1aa903a6 a657ad1c1a97 66042d8d1de3 c28074ec32aa 574857d3ebab e0c077813c0d 334d5f7a646a bb34754b77e2 e3948830670d d38f9a5cd091 91debb9b0280 c3ce26bff44b 8157d2cb8841 f1f4a94d072c 366958f260c8 76c679abb5f4 eeacccda9e9f 0cd547e415cd 20a233ec4d72 10e4419d3462 bd23855b000e 6f9cca07ebf0 7e17cdbd5d5b fb08b4961555 b85397905a1f 2fbf9c11162d 06e02f5b683d f374dc4e7747 ba8ca11749fe 8ebd26d26924 3f24c19324ab c2ca69303549 ce20ba43b580 e90015459634 0bce4fe15bd2 5402d3f9258f ffc35358d5fc 332f87ce484a 9e226be92266 5a1d0c7d67e4 ca974a4e4483 c834639652da 042bec9a6b25 d93302577e9d 07284a92cdab b7d0fead6a8c 703903c942bc 3c151da6d997 f54b70238033 1cb771de32cc de168055e22a cb129956abe1 ee0525fea661 579d6e607070 295561e9864d b99c4df2d65d c833b58f411c'.split(' ');
function bygV250(K, d) {
  const u = {};
  const s1 = d.createElement('div');
  const sk = K.visningsskift(s1, [
    { id: 'overblik', tekst: 'Overblik', ikon: 'mappe', genvej: '⌘1', genvejAria: 'Meta+1' },
    { id: 'siden', tekst: 'Siden sidst', ikon: 'kalender', genvej: '⌘2', genvejAria: 'Meta+2', antal: 3, kraever: true, antalAriaT: 'kraever' },
    { id: 'angreb', tekst: 'Angreb', ikon: 'skjold', genvej: '⌘3', genvejAria: 'Meta+3', deaktiveret: true, hvorfor: 'hvorforToken', antal: 7 },
    { id: 'robotter', tekst: 'Robotter', ikon: 'filter', genvej: '⌘4', genvejAria: 'Meta+4' },
    { id: 'login', tekst: 'Login', ikon: 'laas', genvej: '⌘5', genvejAria: 'Meta+5', deaktiveret: true, hvorfor: 'hvorforToken' },
    { id: 'land', tekst: 'Land', ikon: 'sprog', genvej: '⌘6', genvejAria: 'Meta+6' },
    { id: 'besoeg', tekst: 'Besøgende', ikon: 'oeje', genvej: '⌘7', genvejAria: 'Meta+7' },
    { id: 'tek', tekst: 'Teknologi', ikon: 'tandhjul', genvej: '⌘8', genvejAria: 'Meta+8' },
  ], { ariaT: 'navH' });
  sk.markér('siden');
  u.hamSkift = s1.outerHTML;
  sk.saetPunkt('angreb', { deaktiveret: false });
  sk.saetPunkt('siden', { antal: 0, kraever: false });
  sk.markér('angreb');
  u.hamSkiftEfter = s1.outerHTML;
  const s2 = d.createElement('div');
  K.visningsskift(s2, [{ id: 'a', t: 'vA', ikon: 'mappe' }, { id: 'b', t: 'vB' }]).markér('b');
  u.skiftTo = s2.outerHTML;
  const b1 = d.createElement('div');
  const bd = K.commandBar(b1, { ariaT: 'baandAria', udenFaner: true, hvorforTip: true, faner: [{ id: 'start', t: 'baandAria', grupper: [
    { t: 'gData', knapper: [{ id: 'hent', t: 'kHent', ikon: 'afspil', pri: true }, { id: 'eks', t: 'kEks', ikon: 'eksport', deaktiveret: true, hvorfor: 'hvorforIngen' }] },
    { t: 'gPeriode', knapper: [{ id: 'periode', element: K.segment({ aria: 'P', valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }], valgt: '7' }).rod }] },
  ] }] });
  bd.saetDeaktiveret('eks', false);
  bd.saetDeaktiveret('hent', true, 'hvorforVent');
  u.hamBaand = b1.outerHTML;
  const b2 = d.createElement('div');
  const bf = K.commandBar(b2, { ariaT: 'c', faner: [{ id: 'start', t: 'faneStart', grupper: [{ t: 'g', knapper: [{ id: 'k', t: 'k', ikon: 'kopier' }] }] }, { id: 'vis', t: 'faneVis', grupper: [{ t: 'g2', knapper: [{ id: 'lys', t: 'kLys', ikon: 'sol', trykket: true }] }] }] });
  bf.vaelgFane('vis');
  u.baandFaner = b2.outerHTML;
  const ul = d.createElement('ul');
  const tr = K.navTrae(ul, [{ id: 'samlet', t: 'tSamlet', antal: 2, boern: [{ id: 'a', tekst: 'eksempel.dk' }, { id: 'b', tekst: 'shop.eksempel.dk' }] }], { ariaT: 't', valgt: 'samlet', kunBrugerValg: true });
  tr.saetPunkter([{ id: 'samlet', t: 'tSamlet', antal: 1, boern: [{ id: 'a', tekst: 'eksempel.dk' }] }]);
  u.hamTrae = ul.outerHTML;
  const tab = K.tabel({ ariaT: 'x', kolonner: [{ t: 'kolDomaene' }, { t: 'kolAntal', tal: true }], raekker: [{ celler: ['eksempel.dk', 4], data: 1 }, { celler: ['shop.eksempel.dk', 2], data: 2 }] });
  tab.vaelg(1);
  u.tabelValgt = tab.outerHTML;
  return u;
}
// Pakke 2.7.0 (V-FANER.2: visningerne i båndet, aria-current på en båndknap, Mere, programmets mindstemål): de nye navne.
// Ingen nye funktioner og intet nyt ikon. Det, der ikke står her eller i de ældre lister, må ikke findes.
const V270_FUNKTIONER = [];
const V270_KLASSER = ['vk', 'vk-navn', 'vk-tip-navn', 'tip-tom', 'med-mere', 'mere-vist', 'mere-plads', 'mere-menu', 'mere-punkt', 'mere-tekst', 'mere-hvorfor', 'mere-navn'];
// V-FANER.2: fire eksempler (Huginn and Muninns bånd med syv visninger som almindelige knapper, som i commit 7ce5bdd;
// Grimnirs bånd med hvorforTip; et bånd med faner og trykkede knapper; fanerækken med faner: true), bygget af 2.6.0's
// kit.js (git show 2425f1a:design/ui-kit-2/pakke/web/kit.js) med bygV260 herunder. 2.7.0 skal bygge dem byte for byte
// ens. V260_CSS er de 428 regelsæt i 2.6.0's kit.css (som V250_CSS): hvert af dem skal stå uændret i 2.7.0's kit.css.
const V260_UDSEENDE = {"hamBaand260":"<div class=\"cmd enkel\" role=\"group\" data-t-aria=\"baandAria\"><div class=\"grupper\" id=\"kit-cb1-panel-start\" data-fane=\"start\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-1\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"vis-overblik\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"nav0\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"vis-siden\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"1.5\"></rect><path d=\"M4 10h16M8 3v4M16 3v4\"></path></svg><span data-t=\"nav1\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"vis-vaernet\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z\"></path></svg><span data-t=\"nav2\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"vis-robotter\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 5h16l-6 7v6l-4 2v-8z\"></path></svg><span data-t=\"nav3\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"vis-login\" aria-disabled=\"true\" data-t-title=\"navUdenToken\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"></rect><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"></path></svg><span data-t=\"nav4\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"vis-land\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M3 12h18\"></path><path d=\"M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z\"></path></svg><span data-t=\"nav5\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"vis-besoeg\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z\"></path><circle cx=\"12\" cy=\"12\" r=\"2.5\"></circle></svg><span data-t=\"nav6\"></span></button></div><span class=\"cap\" data-t=\"navH\" id=\"kit-cb1-grp-1\"></span></div><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-2\"><div class=\"kn\"><button class=\"cb pri\" type=\"button\" data-kommando=\"hent\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7 5l12 7-12 7z\"></path></svg><span data-t=\"hentNu\"></span></button></div><span class=\"cap\" data-t=\"gData\" id=\"kit-cb1-grp-2\"></span></div><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-3\"><div class=\"kn\"><div class=\"baand-el\"><div class=\"seg\" role=\"radiogroup\" aria-label=\"L\"><button class=\"seg-v\" data-t=\"dk\" type=\"button\" role=\"radio\" data-valg=\"dk\" aria-checked=\"true\" tabindex=\"0\"></button><button class=\"seg-v\" data-t=\"se\" type=\"button\" role=\"radio\" data-valg=\"se\" aria-checked=\"false\" tabindex=\"-1\"></button></div></div></div><span class=\"cap\" data-t=\"gLand\" id=\"kit-cb1-grp-3\"></span></div><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-4\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"vejledning\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z\"></path><path d=\"M9 8h6M9 12h6\"></path></svg><span data-t=\"vejledningAabn\"></span></button></div><span class=\"cap\" data-t=\"gHjaelp\" id=\"kit-cb1-grp-4\"></span></div><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-5\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"indst\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M9.4 5.2L10.1 2.2L13.9 2.2L14.6 5.2A7.3 7.3 0 0 1 16.6 6.3L19.6 5.4L21.5 8.7L19.2 10.9A7.3 7.3 0 0 1 19.2 13.1L21.5 15.3L19.6 18.6L16.6 17.7A7.3 7.3 0 0 1 14.6 18.8L13.9 21.8L10.1 21.8L9.4 18.8A7.3 7.3 0 0 1 7.4 17.7L4.5 18.6L2.5 15.3L4.8 13.1A7.3 7.3 0 0 1 4.8 10.9L2.5 8.7L4.5 5.4L7.4 6.3A7.3 7.3 0 0 1 9.4 5.2z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle></svg><span data-t=\"navIndst\"></span></button></div><span class=\"cap\" data-t=\"gProgram\" id=\"kit-cb1-grp-5\"></span></div></div></div>","grimnirBaand260":"<div class=\"cmd enkel\" role=\"group\" data-t-aria=\"cmdAria\"><div class=\"grupper\" id=\"kit-cb2-panel-start\" data-fane=\"start\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb2-grp-1\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"indsaet\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M9 4h6v3H9z\"></path><path d=\"M9 5H6v15h12V5h-3\"></path></svg><span data-t=\"kIndsaet\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"aabn-fil\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 3h8l4 4v14H6z\"></path><path d=\"M14 3v4h4\"></path></svg><span data-t=\"kAabnFil\"></span></button><span class=\"tip-plads\"><button class=\"cb\" type=\"button\" data-kommando=\"ryd\" aria-disabled=\"true\" aria-describedby=\"kit-tip1\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 7h16\"></path><path d=\"M9 7V4h6v3\"></path><path d=\"M6 7l1 13h10l1-13\"></path></svg><span data-t=\"kRyd\"></span></button><span class=\"tip\" data-t=\"hvorforIndsaetFoerst\" id=\"kit-tip1\" role=\"tooltip\" hidden=\"\"></span></span></div><span class=\"cap\" data-t=\"gTekst\" id=\"kit-cb2-grp-1\"></span></div><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb2-grp-2\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"analyser\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"11\" cy=\"11\" r=\"6.5\"></circle><path d=\"M20 20l-4.2-4.2\"></path></svg><span data-t=\"kAnalyser\"></span></button><span class=\"tip-plads\"><button class=\"cb pri\" type=\"button\" data-kommando=\"gem\" aria-disabled=\"true\" aria-describedby=\"kit-tip3\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z\"></path></svg><span data-t=\"kGemMasker\"></span></button><span class=\"tip\" data-t=\"hvorforIndsaetFoerst\" id=\"kit-tip3\" role=\"tooltip\" hidden=\"\"></span></span></div><span class=\"cap\" data-t=\"gMaskering\" id=\"kit-cb2-grp-2\"></span></div><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb2-grp-3\"><div class=\"kn\"><span class=\"tip-plads\"><button class=\"cb\" type=\"button\" data-kommando=\"kopier\" aria-disabled=\"true\" aria-describedby=\"kit-tip4\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"></path></svg><span data-t=\"kKopier\"></span></button><span class=\"tip\" data-t=\"hvorforIntet\" id=\"kit-tip4\" role=\"tooltip\" hidden=\"\"></span></span></div><span class=\"cap\" data-t=\"gResultat\" id=\"kit-cb2-grp-3\"></span></div></div></div>","baandFaner260":"<div class=\"cmd\"><div class=\"tabs\" role=\"tablist\" data-t-aria=\"c\"><button class=\"tab\" data-t=\"faneStart\" type=\"button\" id=\"kit-cb3-fane-start\" role=\"tab\" aria-controls=\"kit-cb3-panel-start\" data-fane=\"start\" aria-selected=\"false\" tabindex=\"-1\"></button><button class=\"tab on\" data-t=\"faneVis\" type=\"button\" id=\"kit-cb3-fane-vis\" role=\"tab\" aria-controls=\"kit-cb3-panel-vis\" data-fane=\"vis\" aria-selected=\"true\" tabindex=\"0\"></button></div><div class=\"grupper\" id=\"kit-cb3-panel-start\" role=\"tabpanel\" aria-labelledby=\"kit-cb3-fane-start\" data-fane=\"start\" hidden=\"\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb3-grp-1\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"k\" aria-disabled=\"true\" data-t-title=\"hvorforY\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"></path></svg><span data-t=\"k\"></span></button></div><span class=\"cap\" data-t=\"g\" id=\"kit-cb3-grp-1\"></span></div></div><div class=\"grupper\" id=\"kit-cb3-panel-vis\" role=\"tabpanel\" aria-labelledby=\"kit-cb3-fane-vis\" data-fane=\"vis\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb3-grp-2\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"lys\" aria-pressed=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"></path></svg><span data-t=\"kLys\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"moerk\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z\"></path></svg><span data-t=\"kMoerk\"></span></button></div><span class=\"cap\" data-t=\"g2\" id=\"kit-cb3-grp-2\"></span></div></div></div>","faner260":"<div class=\"vfaner\" role=\"tablist\" data-t-aria=\"visninger\"><span class=\"tip-plads\"><a class=\"vf\" href=\"#a\" data-visning=\"a\" id=\"kit-vf1-a\" role=\"tab\" aria-selected=\"false\" tabindex=\"-1\" aria-controls=\"p-a\" aria-keyshortcuts=\"Meta+1\" aria-describedby=\"kit-tip5\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span class=\"vf-navn\">Maskér</span></a><span class=\"tip\" id=\"kit-tip5\" role=\"tooltip\" hidden=\"\">⌘1</span></span><span class=\"tip-plads\"><a class=\"vf on\" href=\"#b\" data-visning=\"b\" id=\"kit-vf1-b\" role=\"tab\" aria-selected=\"true\" tabindex=\"0\" aria-keyshortcuts=\"Meta+2\" aria-describedby=\"kit-tip6\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z\"></path><circle cx=\"12\" cy=\"12\" r=\"2.5\"></circle></svg><span class=\"vf-navn\">Demaskér</span><span class=\"ant ant-kraever\" data-ant=\"\" aria-hidden=\"true\">3</span><span class=\"skjult-tekst\" data-t=\"kraever\" data-ant=\"\" data-v=\"3\"></span></a><span class=\"tip\" id=\"kit-tip6\" role=\"tooltip\" hidden=\"\">⌘2</span></span><span class=\"tip-plads\"><a class=\"vf\" href=\"#c\" data-visning=\"c\" id=\"kit-vf1-c\" role=\"tab\" aria-selected=\"false\" tabindex=\"-1\" aria-keyshortcuts=\"Meta+3\" aria-describedby=\"kit-tip9\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span class=\"vf-navn\">Sager</span></a><span class=\"tip\" id=\"kit-tip9\" role=\"tooltip\" hidden=\"\">⌘3</span></span><span class=\"tip-plads\"><a class=\"vf\" href=\"#e\" data-visning=\"e\" id=\"kit-vf1-e\" role=\"tab\" aria-selected=\"false\" tabindex=\"-1\" aria-keyshortcuts=\"Meta+4\" aria-describedby=\"kit-tip8\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z\"></path><path d=\"M9 8h6M9 12h6\"></path></svg><span class=\"vf-navn\" data-t=\"vOrdbog\"></span></a><span class=\"tip\" id=\"kit-tip8\" role=\"tooltip\" hidden=\"\">⌘4</span></span></div>"};
const V260_CSS = 'b190a4ef6d78 409377812557 d1f2fba0fee4 924c8f394378 ec4b4383b83e 0143fe6bf004 35536ac589ba 30f14d46d775 6624c59b1dda 6ea6907e8bf8 3793d111fa24 984ea12ba4ba 6258e84a1b6a ad5bcb4996f1 6887ca054512 461477af8c96 a63a3a4a42d9 f4b74169d18b 23e7dce574fb ef561db9f258 5932ecd9b430 4acb95b7e823 50fef3ae45f9 d11de26b222a 0b475e80baee 7a759713688d 4c1f316f40be cde81eecc6c9 4b1772b092f1 309327801d65 411bb3d20631 e7ea6ce7526b f46c3da72ee4 0cd03c31cd27 6a50500acd65 25400fc1ffa7 ed49f487cfb2 d149e08dafc8 3230f5dfe710 882c2d62daf2 0c7941af3149 6e08cc21aa7a ae03b46128f1 7d479d36932a 13ad0510f046 97c93a14fc6c c4f0fb911a5f e7e7c196bfab d5b3ed75e9ba be44149f96e8 82937e7f2fb5 4093dc3a78e3 fe7962986e3d 4a7a6f70ae4e 8724ac29b7aa c9efdadb7fdb fb825e6aca7a 290155dbd7b2 5679ed9e9148 3d63e1d73ff2 f0978d077b7a 41771f787729 39a3bb761aae 39cc6c1d6f17 df25cf69e096 0bae53a29990 8c881bacdd88 7ffbc0eea02f 892c38f0d160 fee7dbe59bed 60f0b6dd4822 58a4e3de5ada dd3be7ff0585 4267f57e49c2 b84f2e47d40c 9b4bc25dc04c 0afd187b0d7f f1aa38e27148 94dab5879c17 137019628abd cd71e47a708c 209375a8a752 b2d05b8b3b50 e6ce25f732cf f7a3eeb2b285 91fbeac243d3 69ab9d08fdc6 177894c15dc1 3505d04c9e52 ae48175dd362 4e4925e67d0e 5f543e1217db 713cd42a0391 0f49519987f0 b1c54bb7f3c5 6f0e6a8fd2b1 17d75932ba1c 115e40a28f03 25e374e0738f 84e6b900d215 f28df7225655 a815fb6f2442 334364b43e74 263a8067dc4d ac8725ecd8c5 5ac5d197f8ea 1a53e4f7f56f ecc609f64065 0ef0e07379c4 284668c27492 d5d19afa859a 24b787134cee 3357e64f464f 2bb429ca8da1 e81cfce9f2f5 0dea90d65476 797318bde205 2c7bd0abd66a 76769cd390e9 2e19a229cbf1 2746ccea05f5 fef7cc48eca5 3d130f39b8d8 aa678e720616 e6949c94f0e0 65453d5c3fb9 2bb26a310ee5 78655e5cf7fb d08d8ff9d091 465bc54ce53e 2e5415fa2e47 6d8721a8057e d9dda73d7168 b24e81ee91fc b6060c702302 c136c038edeb 7b38fe385404 bbca3f3427c4 493e9fc39d3e 7c78a24d9b47 a0cca174a853 defdd4ce0195 3d35b39b9366 89993201dab1 a28f8541ce1e bf2808bd8f73 9ec9c37adcd7 84fa9ba397a1 a883cc71cd9b c00ab124c17c b66508277fcd a0263fec4e4f 5b745b9c3987 b2e4bd0b51c5 8039c9c621f3 e57ce32dd366 4543aeccd3ba d73d63697ed2 f06170329e34 3bedabff7584 3278d0ab0376 e5c92fc21db4 282e0857e5e3 adc5f48eb4ec 04a291c6d307 7bb895cb3c7b a7337386b5b7 ea9d1063b81f 95e4833d5011 c67b0ba95ad8 8f0b47b2b730 d48d6a948d89 f8baae03570c 6d4779f90b70 896ffaf32e37 35d67bdf65dd 884d5fa4b25d faec89a0a013 c5747a92d409 b501dbcdaf3b 7769eaaa9d19 b608345f7e46 cd49f6e190fc c6d8f486098e 8bba4bdc2dd2 3373b5c9269c c7a3e1c69891 59d772711ccb fe34d04ca0ab 5c7a162882dd ca3d1b1e1266 36a4e3133b3d 58c9f0850ab1 6785cfaa8005 d578c044a037 923f052a9401 a407258b352b c40dc0f78133 8f9ff39024aa 2ae8e80ca28b d075df8c1855 c2c39e8fd684 a99a3f3fddf7 0a207469f6d2 11f82fc57689 9aafd4778abc b4b86e647a1e 26d2b6936cfe 05fe13dc43e8 a542cbf168e0 ee3bb335f4c2 b3976c8c5a4b 122825554c01 0401d094e821 ecf3eedbfda8 030c6181d018 899f796fdb47 e676a9ec7450 2464f974fa73 cb17c7c795de 9ecb0c2f6df5 35756666dc27 835314f5b2bb 8408a6595ec9 0bb5a16c6dcf 7af4ef6997a6 16f02fb1593b 7c3d3f793d0f 8c04e6ab91ff 3cff18cfd75e d101f3b872f1 8dd6d629a4f1 9ed3d52c251d bf29e1b0be06 5b70721323fc 1d77b0fed7c0 21638a31e852 39e808599140 a7dfbd1d5095 4543899ecb75 ff468e679756 61dc7ffde18a 3fc901e105ff f47f024b0704 e02094fc1b3b 0fe1ace9b301 7ea8b7f6ce67 5beabb8fa16f ce8a78d7e268 717f696c5077 b2bef74511d0 bc09dcf79023 ccd74ede1ede 1901cc4669f8 66656c4a984f 1b35cb7c30b6 edce040e535a 24ee1f3ca490 51b2a1dccf89 685b60f4e253 ff5cebfc0fc0 5727efb6e335 c76e5d6b7438 717abd1bf6de ace6d58385bc e70ab8eb8088 1a463ebb48e3 cf454ca8329c 639ea8b614f4 74f8965076a1 5500039c3654 3aa25df0d9cf debbbc1543ab 51468f27ca60 9a70191e7705 8acf3d5fcb19 aeaa125379e9 6e231331a761 3db30fd8f6be 52040de8b213 cebfce58b90c 8150a60cce65 4d5414aeaa1e e16d3fdb4c6d 63c3fba4f115 f75714dca935 523ab8a43949 d9811186f5da 6db1f62e0aed 7353fc47ad9d 25e88fa359a8 ad9369e607f4 82c341d94ca7 07ee1d29ec08 33e8982e41a1 3fc26df4707a 37fa1f76f344 1b3d73a79e95 c0636c5d7a02 98a997ac3a29 77b781480735 de900e9c0032 ad8b9eb74097 5866a508c8dc 3dbbe95f20c9 6acb7b415f18 0520d2d1d203 e0b0a850c8c4 55da6355a712 1b1e1cb8cdc9 dfbaafe8158a dc6463b8219a d33367fd8be2 d366dcb3fcfd 73bf6386e037 0966364b9b4d 32b580a307a1 10b0cfce811a e90a7cbaf40e b31c6ed3cb96 b91a6005b873 99814ba10c3c eabc92a61135 47467690b67d dcedc9b057ab 5c25fa196964 73737ba6b65e 1317c98c00c8 c440c7cfe35e ae6653284738 e8cf78279f79 e0af9167c8b9 314a7982fd8d b475a4e3cc5d c7f202e9a81e d91fdda4798c 583fce862fad 8b137904e118 75c9bfe2472f da13505695cf 7f287ce582b7 e1c596a489e8 b8c2e2cbbfb7 11b88541d331 95831ee430d4 72f444d728dc 9af52163e19f 5f573258f928 1221eacc313f 6a30b46ef62e 94575ecd3cc0 7ff55fcbf19b 5ee9b951ba9f ac8862c4dd48 c9225a36c000 29865614dd5f faf459681a38 96ef10cb11fd d41b559c1506 3d55930e6154 24c35a38d634 73c7d18e755b 5028aa2de4aa 72b48de84219 e57b2294d0e4 3fc41a242034 2a4a4f699336 61ad74317522 c3cbe2183517 d42c1e03c362 5d4cf771279e a20e1aa903a6 a657ad1c1a97 66042d8d1de3 c28074ec32aa 574857d3ebab e0c077813c0d 334d5f7a646a bb34754b77e2 e3948830670d d38f9a5cd091 91debb9b0280 c3ce26bff44b 8157d2cb8841 f1f4a94d072c 366958f260c8 76c679abb5f4 eeacccda9e9f 0cd547e415cd 20a233ec4d72 10e4419d3462 bd23855b000e 6f9cca07ebf0 7e17cdbd5d5b fb08b4961555 b85397905a1f 2fbf9c11162d 06e02f5b683d f374dc4e7747 ba8ca11749fe 8ebd26d26924 3f24c19324ab c2ca69303549 ce20ba43b580 e90015459634 0bce4fe15bd2 5402d3f9258f ffc35358d5fc 332f87ce484a 9e226be92266 5a1d0c7d67e4 ca974a4e4483 c834639652da 042bec9a6b25 d93302577e9d 07284a92cdab b7d0fead6a8c 703903c942bc 3c151da6d997 f54b70238033 1cb771de32cc de168055e22a cb129956abe1 ee0525fea661 579d6e607070 295561e9864d b99c4df2d65d c833b58f411c'.split(' ');
function bygV260(K, d) {
  const u = {};
  // Huginn and Muninns bånd i 2.6.0 (commit 7ce5bdd): syv visninger som almindelige .cb, Hent nu, en vælger-plads, vejledning og Indstillinger.
  const b1 = d.createElement('div');
  const ham = K.commandBar(b1, { ariaT: 'baandAria', udenFaner: true, faner: [{ id: 'start', t: 'baandAria', grupper: [
    { t: 'navH', knapper: ['overblik', 'siden', 'vaernet', 'robotter', 'login', 'land', 'besoeg'].map((id, i) => ({ id: 'vis-' + id, t: 'nav' + i, ikon: ['mappe', 'kalender', 'skjold', 'filter', 'laas', 'sprog', 'oeje'][i], ved: () => { } })) },
    { t: 'gData', knapper: [{ id: 'hent', t: 'hentNu', ikon: 'afspil', pri: true }] },
    { t: 'gLand', knapper: [{ id: 'land', element: K.segment({ aria: 'L', valg: [{ id: 'dk', t: 'dk' }, { id: 'se', t: 'se' }], valgt: 'dk' }).rod }] },
    { t: 'gHjaelp', knapper: [{ id: 'vejledning', t: 'vejledningAabn', ikon: 'bog' }] },
    { t: 'gProgram', knapper: [{ id: 'indst', t: 'navIndst', ikon: 'tandhjul' }] },
  ] }] });
  ham.saetDeaktiveret('vis-login', true, 'navUdenToken');
  ham.saetDeaktiveret('vis-robotter', true, 'navUdenToken');
  ham.saetDeaktiveret('vis-robotter', false);
  u.hamBaand260 = b1.outerHTML;
  // Grimnirs bånd i 2.6.0 (Maskér): hvorforTip, fire grupper, kommandoer slået fra med hvorfor, slået til og fra udefra.
  const b2 = d.createElement('div');
  const gr = K.commandBar(b2, { ariaT: 'cmdAria', hvorforTip: true, udenFaner: true, faner: [{ id: 'start', grupper: [
    { t: 'gTekst', knapper: [{ id: 'indsaet', t: 'kIndsaet', ikon: 'indsaet' }, { id: 'aabn-fil', t: 'kAabnFil', ikon: 'fil' }, { id: 'ryd', t: 'kRyd', ikon: 'slet', deaktiveret: true, hvorfor: 'hvorforIndsaetFoerst' }] },
    { t: 'gMaskering', knapper: [{ id: 'analyser', t: 'kAnalyser', ikon: 'soeg', deaktiveret: true, hvorfor: 'hvorforIndsaetFoerst' }, { id: 'gem', t: 'kGemMasker', ikon: 'skjold', pri: true, deaktiveret: true, hvorfor: 'hvorforIndsaetFoerst' }] },
    { t: 'gResultat', knapper: [{ id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true }] },
  ] }] });
  gr.saetDeaktiveret('analyser', false);
  gr.saetDeaktiveret('kopier', true, 'hvorforIntet');
  u.grimnirBaand260 = b2.outerHTML;
  // Et bånd med faner og trykket knap; et bånd uden hvorforTip (hvorfor i title).
  const b3 = d.createElement('div');
  const bf = K.commandBar(b3, { ariaT: 'c', faner: [{ id: 'start', t: 'faneStart', grupper: [{ t: 'g', knapper: [{ id: 'k', t: 'k', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorforX' }] }] }, { id: 'vis', t: 'faneVis', grupper: [{ t: 'g2', knapper: [{ id: 'lys', t: 'kLys', ikon: 'sol', trykket: true }, { id: 'moerk', t: 'kMoerk', ikon: 'maane', trykket: false }] }] }] });
  bf.vaelgFane('vis');
  bf.saetDeaktiveret('k', false);
  bf.saetDeaktiveret('k', true, 'hvorforY');
  u.baandFaner260 = b3.outerHTML;
  // Fanerækken fra 2.6.0 (faner: true) med genveje, tal, punkt slået fra og panel.
  const f1 = d.createElement('div');
  const vf = K.visningsskift(f1, [
    { id: 'a', tekst: 'Maskér', ikon: 'mappe', genvej: '⌘1', genvejAria: 'Meta+1', panel: 'p-a' },
    { id: 'b', tekst: 'Demaskér', ikon: 'oeje', genvej: '⌘2', genvejAria: 'Meta+2', antal: 3, kraever: true, antalAriaT: 'kraever' },
    { id: 'c', tekst: 'Sager', ikon: 'mappe', genvej: '⌘3', genvejAria: 'Meta+3', deaktiveret: true, hvorfor: 'hvorforToken' },
    { id: 'e', t: 'vOrdbog', ikon: 'bog', genvej: '⌘4', genvejAria: 'Meta+4' },
  ], { ariaT: 'visninger', faner: true });
  vf.markér('b');
  vf.saetPunkt('c', { deaktiveret: false });
  u.faner260 = f1.outerHTML;
  return u;
}
const V240_FARVER = ['text-disabled', 'ok-mark-hover', 'warn-mark-hover', 'danger-mark-hover', 'info-mark-hover', 'none-mark-hover'];
const V230_KLASSER = ['fchips', 'fchip', 'fchip-mark', 'kasse', 'kasse-top', 'kasse-handling', 'kasse-indhold', 'fyld', 'kasse-fod', 'sfliser', 'sflise', 'sflise-navn', 'sflise-tal', 'sflise-under', 'sflise-pil', 'tomt', 'tomt-ikon', 'tomt-h', 'tomt-p', 'lille', 'frem', 'ubestemt', 'frem-tekst', 'frem-bjaelke', 'snurr', 'tip-plads', 'tip', 'under', 'venstre-kant', 'afk-felt', 'afk', 'afk-boks', 'afk-tekst', 'afk-hj', 'valgsaet', 'vandret', 'tilfra', 'tilfra-ord', 'tilfra-til', 'tilfra-fra', 'vliste', 'modal', 'bred', 'modal-top', 'modal-luk', 'modal-tekst', 'modal-indhold', 'modal-fod', 'sorter', 'sorter-pil', 'kolgruppe', 'sideskift', 'sideskift-nr', 'sideskift-pr'];

// V-KIT.6: 26 eksempler bygget af 2.4.0's kit.js (git show 48b8dbd:design/ui-kit-2/pakke/web/kit.js) med bygV240 herunder,
// uden 2.5.0's indstillinger. 2.5.0 skal bygge dem byte for byte ens.
const V240_UDSEENDE = {"dialog":"<dialog class=\"modal\" aria-labelledby=\"kit-dlg1-h\" aria-describedby=\"kit-dlg1-p\"><div class=\"modal-top\"><h2 data-t=\"h\" id=\"kit-dlg1-h\" tabindex=\"-1\"></h2><button class=\"modal-luk\" type=\"button\" data-t-aria=\"luk\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></button></div><p class=\"modal-tekst\" data-t=\"p\" id=\"kit-dlg1-p\"></p><div class=\"modal-indhold\"><div></div></div><div class=\"modal-fod\"><button class=\"btn\" type=\"button\" data-svar=\"annuller\"><span data-t=\"annuller\"></span></button><button class=\"btn danger\" type=\"button\" data-svar=\"slet\"><span data-t=\"slet\"></span></button><button class=\"btn primary\" type=\"button\" data-svar=\"gem\"><span data-t=\"gem\"></span></button></div></dialog>","dialogTekst":"<dialog class=\"modal bred\" aria-labelledby=\"kit-dlg2-h\" aria-describedby=\"kit-dlg2-p\"><div class=\"modal-top\"><h2 id=\"kit-dlg2-h\" tabindex=\"-1\">Omdøb</h2></div><p class=\"modal-tekst\" id=\"kit-dlg2-p\">Navnet ses kun her.</p><div class=\"modal-indhold\"></div><div class=\"modal-fod\"><button class=\"btn\" type=\"button\" data-svar=\"ok\"><span>OK</span></button></div></dialog>","bekraeft":"<dialog class=\"modal\" aria-labelledby=\"kit-dlg3-h\" aria-describedby=\"kit-dlg3-p\" open=\"\"><div class=\"modal-top\"><h2 data-t=\"h\" id=\"kit-dlg3-h\" tabindex=\"-1\"></h2></div><p class=\"modal-tekst\" data-t=\"p\" id=\"kit-dlg3-p\"></p><div class=\"modal-indhold\"></div><div class=\"modal-fod\"><button class=\"btn\" type=\"button\" data-svar=\"nej\"><span data-t=\"nej\"></span></button><button class=\"btn danger\" type=\"button\" data-svar=\"ja\"><span data-t=\"ja\"></span></button></div></dialog>","kontakt":"<div class=\"afk-felt\"><label class=\"afk\"><input type=\"checkbox\" id=\"kit-tf-1\" class=\"tilfra\" role=\"switch\" aria-describedby=\"kit-tf-1-hj\"><span class=\"afk-tekst\" data-t=\"k\"></span><span class=\"tilfra-ord\" aria-hidden=\"true\"><span class=\"tilfra-til\" data-t=\"til\"></span><span class=\"tilfra-fra\" data-t=\"fra\"></span></span></label><span class=\"afk-hj\" data-t=\"hj\" id=\"kit-tf-1-hj\"></span></div>","kontaktUden":"<div class=\"afk-felt\"><label class=\"afk\"><input type=\"checkbox\" id=\"kit-tf-2\" class=\"tilfra\" role=\"switch\"><span class=\"afk-tekst\"></span></label></div>","radio":"<fieldset class=\"valgsaet vandret\" aria-describedby=\"kit-radio-3-hj\"><legend class=\"label\" data-t=\"e\"></legend><div class=\"afk-felt\"><label class=\"afk\"><input type=\"radio\" id=\"kit-radio-3-1\" class=\"afk-boks\" name=\"kit-radio-3\" value=\"a\"><span class=\"afk-tekst\" data-t=\"a\"></span></label></div><div class=\"afk-felt\"><label class=\"afk\"><input type=\"radio\" id=\"kit-radio-3-2\" class=\"afk-boks\" name=\"kit-radio-3\" value=\"b\" aria-describedby=\"kit-radio-3-2-hj\"><span class=\"afk-tekst\">B</span></label><span class=\"afk-hj\" id=\"kit-radio-3-2-hj\">x</span></div><span class=\"afk-hj\" data-t=\"hj\" id=\"kit-radio-3-hj\"></span></fieldset>","radioUden":"<fieldset class=\"valgsaet\"><legend class=\"label\"></legend><div class=\"afk-felt\"><label class=\"afk\"><input type=\"radio\" id=\"kit-radio-4-1\" class=\"afk-boks\" name=\"kit-radio-4\" value=\"a\"><span class=\"afk-tekst\">A</span></label></div></fieldset>","valgliste":"<div class=\"felt\"><label class=\"label\" data-t=\"e\" for=\"kit-vl-5\"></label><span class=\"vliste\"><select id=\"kit-vl-5\" aria-describedby=\"kit-vl-5-hj\" aria-invalid=\"true\"><option value=\"1\" data-t=\"en\"></option><option value=\"2\" disabled=\"\">To</option></select><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 9l6 6 6-6\"></path></svg></span><span class=\"hj fejltekst\" data-t=\"f\" id=\"kit-vl-5-hj\"></span></div>","afk":"<div class=\"afk-felt\"><label class=\"afk\"><input type=\"checkbox\" id=\"kit-afk-6\" class=\"afk-boks\" aria-describedby=\"kit-afk-6-hj\"><span class=\"afk-tekst\" data-t=\"a\"></span></label><span class=\"afk-hj\" data-t=\"hj\" id=\"kit-afk-6-hj\"></span></div>","afkAria":"<div class=\"afk-felt\"><label class=\"afk\"><input type=\"checkbox\" id=\"kit-afk-7\" class=\"afk-boks\"><span class=\"afk-tekst\" data-t=\"b\"></span></label></div>","flise":"<button class=\"sflise warn\" type=\"button\" data-t-aria=\"x\"><span class=\"sflise-navn\" data-t=\"n\"></span><span class=\"sflise-tal\">3</span><span class=\"chip warn\"><span aria-hidden=\"true\">!</span><span class=\"ord\" data-t=\"s\"></span></span><span class=\"sflise-under\" data-t=\"u\"></span></button>","fliseHref":"<a class=\"sflise\" href=\"#a\"><span class=\"sflise-navn\">N</span><span class=\"sflise-tal\">–</span><span class=\"sflise-under\"><span class=\"sflise-pil\" aria-hidden=\"true\">↑</span><span data-t=\"u\"></span></span></a>","fliseDiv":"<div class=\"sflise\"><span class=\"sflise-navn\" data-t=\"n\"></span><span class=\"sflise-tal\">0</span><span class=\"sflise-under\">tekst</span></div>","fliser":"<ul class=\"sfliser\" role=\"list\" data-t-aria=\"a\"><li><div class=\"sflise\"><span class=\"sflise-navn\" data-t=\"n\"></span><span class=\"sflise-tal\">1</span></div></li></ul>","tom":"<div class=\"tomt\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\" class=\"tomt-ikon\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><h2 class=\"tomt-h\" data-t=\"h\"></h2><p class=\"tomt-p\" data-t=\"p\"></p><button class=\"btn primary\" type=\"button\"><span data-t=\"h\"></span></button></div>","tomLille":"<div class=\"tomt lille\" role=\"status\"><p class=\"tomt-h\" data-t=\"h\"></p><p class=\"tomt-p\">tekst</p></div>","kasse":"<section class=\"kasse\" id=\"k\" aria-labelledby=\"k-h\"><div class=\"kasse-top\"><h3 data-t=\"h\" id=\"k-h\"></h3><div class=\"kasse-handling\"><button></button></div></div><div class=\"kasse-indhold fyld\"><p></p></div><div class=\"kasse-fod\"><span></span></div></section>","fchip":"<button class=\"fchip\" type=\"button\" data-chip=\"a\" aria-pressed=\"true\"><span class=\"fchip-mark\" aria-hidden=\"true\">✓</span><span data-t=\"a\"></span><span class=\"ant\">3</span></button>","fchips":"<div class=\"fchips\" role=\"group\" aria-label=\"Vis\"><button class=\"fchip\" type=\"button\" data-chip=\"a\" aria-pressed=\"false\"><span class=\"fchip-mark\" aria-hidden=\"true\">✓</span><span>A</span></button><button class=\"fchip\" type=\"button\" data-chip=\"b\" aria-pressed=\"true\" disabled=\"\"><span class=\"fchip-mark\" aria-hidden=\"true\">✓</span><span>B</span></button></div>","seg":"<div class=\"seg\" role=\"radiogroup\" aria-label=\"P\"><button class=\"seg-v\" data-t=\"p7\" type=\"button\" role=\"radio\" data-valg=\"7\" aria-checked=\"false\" tabindex=\"-1\"></button><button class=\"seg-v\" data-t=\"p30\" type=\"button\" role=\"radio\" data-valg=\"30\" aria-checked=\"true\" tabindex=\"0\"></button></div>","segUden":"<div class=\"seg\" role=\"radiogroup\" aria-label=\"P\"><button class=\"seg-v\" data-t=\"p7\" type=\"button\" role=\"radio\" data-valg=\"7\" aria-checked=\"true\" tabindex=\"0\"></button><button class=\"seg-v\" data-t=\"p30\" type=\"button\" role=\"radio\" data-valg=\"30\" aria-checked=\"false\" tabindex=\"-1\"></button></div>","skift8":"<div class=\"skift taet\" role=\"group\"><a class=\"vs\" href=\"#v0\" data-visning=\"v0\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V0</span><kbd aria-hidden=\"true\">0</kbd></a><a class=\"vs\" href=\"#v1\" data-visning=\"v1\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V1</span><kbd aria-hidden=\"true\">1</kbd></a><a class=\"vs\" href=\"#v2\" data-visning=\"v2\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V2</span><kbd aria-hidden=\"true\">2</kbd></a><a class=\"vs on\" href=\"#v3\" data-visning=\"v3\" aria-current=\"page\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V3</span><kbd aria-hidden=\"true\">3</kbd></a><a class=\"vs\" href=\"#v4\" data-visning=\"v4\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V4</span><kbd aria-hidden=\"true\">4</kbd></a><a class=\"vs\" href=\"#v5\" data-visning=\"v5\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V5</span><kbd aria-hidden=\"true\">5</kbd></a><a class=\"vs\" href=\"#v6\" data-visning=\"v6\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V6</span><kbd aria-hidden=\"true\">6</kbd></a><a class=\"vs\" href=\"#v7\" data-visning=\"v7\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span>V7</span><kbd aria-hidden=\"true\">7</kbd></a></div>","trae":"<ul class=\"trae\" role=\"tree\" data-t-aria=\"t\"><li role=\"none\"><button class=\"tr\" type=\"button\" data-punkt=\"a\" role=\"treeitem\" aria-level=\"1\" tabindex=\"-1\" aria-expanded=\"true\" aria-selected=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 9l6 6 6-6\"></path></svg><span data-t=\"a\"></span><span class=\"ant\">2</span></button><ul role=\"group\"><li role=\"none\"><button class=\"tr\" type=\"button\" data-punkt=\"b\" role=\"treeitem\" aria-level=\"2\" tabindex=\"-1\" aria-selected=\"false\"><span data-t=\"b\"></span></button></li><li role=\"none\"><button class=\"tr\" type=\"button\" data-punkt=\"c\" role=\"treeitem\" aria-level=\"2\" tabindex=\"-1\" aria-expanded=\"true\" aria-selected=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 9l6 6 6-6\"></path></svg><span data-t=\"c\"></span></button><ul role=\"group\"><li role=\"none\"><button class=\"tr on\" type=\"button\" data-punkt=\"d\" role=\"treeitem\" aria-level=\"3\" tabindex=\"0\" aria-selected=\"true\" aria-current=\"true\"><span>D</span></button></li></ul></li></ul></li></ul>","baandEnkel":"<div class=\"cmd enkel\" role=\"group\" data-t-aria=\"c\"><div class=\"grupper\" id=\"kit-cb1-panel-a\" data-fane=\"a\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-1\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"k\" aria-disabled=\"true\" data-t-title=\"hv\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"></path></svg><span data-t=\"k\"></span></button><div class=\"baand-el\"><span></span></div></div><span class=\"cap\" data-t=\"g\" id=\"kit-cb1-grp-1\"></span></div></div></div>","tip":"<span class=\"tip-plads\"><button aria-describedby=\"kit-tip1\"></button><span class=\"tip\" data-t=\"tip\" id=\"kit-tip1\" role=\"tooltip\" hidden=\"\"></span></span>","frem":"<div class=\"frem\"><span class=\"frem-tekst\" data-t=\"f\" id=\"kit-frem1\" role=\"status\"></span><progress class=\"frem-bjaelke\" max=\"8\" value=\"3\" aria-labelledby=\"kit-frem1\"></progress></div>"};
function bygV240(K, d) {
  const u = {};
  u.dialog = K.dialog({ t: 'h', p: { t: 'p' }, indhold: d.createElement('div'), luk: { ariaT: 'luk' }, knapper: [{ id: 'gem', t: 'gem', variant: 'primary' }, { id: 'annuller', t: 'annuller' }, { id: 'slet', t: 'slet', variant: 'danger' }] }).rod.outerHTML;
  u.dialogTekst = K.dialog({ tekst: 'Omdøb', p: 'Navnet ses kun her.', bred: true, knapper: [{ id: 'ok', tekst: 'OK' }] }).rod.outerHTML;
  K.bekraeft({ t: 'h', p: { t: 'p' }, nej: { t: 'nej' }, ja: { t: 'ja' }, farlig: true });
  u.bekraeft = d.querySelector('dialog[open]').outerHTML;
  d.querySelector('dialog[open]').close();
  u.kontakt = K.kontakt({ t: 'k', til: true, ord: { til: { t: 'til' }, fra: { t: 'fra' } }, hjaelp: { t: 'hj' } }).rod.outerHTML;
  u.kontaktUden = K.kontakt({}).rod.outerHTML;
  u.radio = K.radiogruppe({ etiket: { t: 'e' }, vandret: true, valgt: 'b', hjaelp: { t: 'hj' }, valg: [{ id: 'a', t: 'a' }, { id: 'b', tekst: 'B', hjaelp: 'x' }] }).rod.outerHTML;
  u.radioUden = K.radiogruppe({ valg: [{ id: 'a', tekst: 'A' }] }).rod.outerHTML;
  u.valgliste = K.valgliste({ etiket: { t: 'e' }, fejl: { t: 'f' }, valgt: '2', valg: [{ id: '1', t: 'en' }, { id: '2', tekst: 'To', deaktiveret: true }] }).rod.outerHTML;
  u.afk = K.afkrydsning({ t: 'a', valgt: true, delvis: true, hjaelp: { t: 'hj' } }).rod.outerHTML;
  u.afkAria = K.afkrydsning({ ariaT: 'a', t: 'b' }).rod.outerHTML;
  u.flise = K.statusflise({ t: 'n', tal: 3, status: { variant: 'warn', t: 's' }, under: { t: 'u' }, ved: () => {}, ariaT: 'x' }).outerHTML;
  u.fliseHref = K.statusflise({ tekst: 'N', tal: null, udvikling: { retning: 'op', t: 'u' }, href: '#a' }).outerHTML;
  u.fliseDiv = K.statusflise({ t: 'n', tal: 0, under: 'tekst' }).outerHTML;
  u.fliser = K.statusfliser({ ariaT: 'a', fliser: [{ t: 'n', tal: 1 }] }).outerHTML;
  u.tom = K.tomTilstand({ ikon: 'mappe', t: 'h', p: { t: 'p' }, handling: { t: 'h', variant: 'primary' } }).outerHTML;
  u.tomLille = K.tomTilstand({ lille: true, t: 'h', p: 'tekst', niveau: 3 }).outerHTML;
  u.kasse = K.kasse({ id: 'k', t: 'h', niveau: 3, handling: d.createElement('button'), indhold: d.createElement('p'), fod: d.createElement('span'), fyld: true }).rod.outerHTML;
  u.fchip = K.filterchip({ id: 'a', t: 'a', antal: 3, valgt: true }).outerHTML;
  u.fchips = K.filterchips({ aria: 'Vis', chips: [{ id: 'a', tekst: 'A' }, { id: 'b', tekst: 'B', deaktiveret: true }], valgt: ['b'] }).rod.outerHTML;
  u.seg = K.segment({ aria: 'P', valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }], valgt: '30' }).rod.outerHTML;
  u.segUden = K.segment({ aria: 'P', valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }] }).rod.outerHTML;
  const s8 = d.createElement('div');
  K.visningsskift(s8, Array.from({ length: 8 }, (_, i) => ({ id: 'v' + i, tekst: 'V' + i, ikon: 'mappe', genvej: String(i) }))).markér('v3');
  u.skift8 = s8.outerHTML;
  const ul = d.createElement('ul');
  const tr = K.navTrae(ul, [{ id: 'a', t: 'a', antal: 2, boern: [{ id: 'b', t: 'b' }, { id: 'c', t: 'c', boern: [{ id: 'd', tekst: 'D' }] }] }], { ariaT: 't', valgt: 'c' });
  tr.vaelg('d');
  u.trae = ul.outerHTML;
  const cb = d.createElement('div');
  K.commandBar(cb, { ariaT: 'c', udenFaner: true, faner: [{ id: 'a', t: 'a', grupper: [{ t: 'g', knapper: [{ id: 'k', t: 'k', ikon: 'kopier', deaktiveret: true, hvorfor: 'hv' }, { id: 'e', element: d.createElement('span') }] }] }] });
  u.baandEnkel = cb.outerHTML;
  const maal = d.createElement('button');
  d.body.appendChild(maal);
  K.vaerktoejstip(maal, { t: 'tip' });
  u.tip = maal.parentElement.outerHTML;
  const fr = d.createElement('div');
  u.frem = K.fremdrift({ t: 'f', maks: 8, vaerdi: 3, omraade: fr }).rod.outerHTML;
  return u;
}
// ── N1: én kilde ──
{
  tjek('pakken ligger i design/ui-kit-2/pakke', path.relative(repo, PAKKE) === path.join('design', 'ui-kit-2', 'pakke'));
  tjek('tokens.json læses fra pakken (samme sti, som kontrasttesten får fra build-tokens.mjs)', path.relative(PAKKE, KILDE) === path.join('tokens', 'wi24rd-ui-kit-2.tokens.json') && fs.existsSync(KILDE));
  tjek('den gamle kopi design/wi24rd-ui-kit-2.tokens.json findes ikke længere (én kilde)', !fs.existsSync(path.join(repo, 'design', 'wi24rd-ui-kit-2.tokens.json')));
  const kontrast = fs.readFileSync(path.join(repo, 'tests', 'ui', 'kontrast.mjs'), 'utf8');
  tjek('kontrasttesten bruger pakkens tokens (laesTokens() uden egen sti)', /import \{[^}]*laesTokens[^}]*\} from '\.\.\/\.\.\/design\/build-tokens\.mjs'/.test(kontrast) && /const tokens = laesTokens\(\);/.test(kontrast) && !/tokens\.json'\)/.test(kontrast));
  tjek('tokens --check: tokens.css svarer til tokens.json', fs.readFileSync(MAAL, 'utf8') === bygCss(tokens));
  tjek('tokens --check: Tokens.xaml svarer til tokens.json', fs.readFileSync(MAAL_XAML, 'utf8') === bygXaml(tokens));
  const a = afvigelser();
  tjek('kit --check: kopierne i ui/assets er byte for byte som pakken', a.length === 0, a.join('; '));
  const kopier = par().map(([, k]) => path.relative(path.join(repo, 'ui', 'assets'), k)).sort();
  tjek('kit: de kopierede filer er tokens.css, de fire web-filer og seks filer i fonts/', JSON.stringify(kopier) === JSON.stringify(['fonts/OFL-Inter.txt', 'fonts/OFL-JetBrainsMono.txt', 'fonts/inter-latin-ext-wght-normal.woff2', 'fonts/inter-latin-wght-normal.woff2', 'fonts/jetbrains-mono-latin-ext-wght-normal.woff2', 'fonts/jetbrains-mono-latin-wght-normal.woff2', 'kit.css', 'kit.js', 'sprogmotor.js', 'tema.js', 'tokens.css']), kopier.join(', '));
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  tjek('package.json: npm run kit og npm run tokens findes', pkg.scripts.kit === 'node design/build-kit.mjs' && pkg.scripts.tokens === 'node design/build-tokens.mjs');
  tjek('package.json: npm run tjek kører tokens --check og kit --check i samme kørsel', /build-tokens\.mjs --check && node design\/build-kit\.mjs --check/.test(pkg.scripts.tjek || ''), pkg.scripts.tjek);
  tjek('package.json: ingen nye afhængigheder', JSON.stringify(Object.keys(pkg.devDependencies).sort()) === JSON.stringify(['@tauri-apps/cli', 'jsdom']) && !pkg.dependencies);
}

// ── N3: pakkens indhold ──
{
  const skal = ['VERSION', 'CHANGELOG.md', 'README.md', 'KOMPONENTER.md', 'LICENSE.md', 'tokens/wi24rd-ui-kit-2.tokens.json', 'tokens/tokens.css', 'tokens/Tokens.xaml',
    'web/kit.css', 'web/kit.js', 'web/tema.js', 'web/sprogmotor.js', 'web/fonts/OFL-Inter.txt', 'web/fonts/OFL-JetBrainsMono.txt', 'demo/index.html', 'demo/demo.js',
    'flytning/HUGINN-MUNINN.md', 'flytning/WI24RD-FTP.md', 'LICENSE', 'flytning/WI24RD-SANDBOX.md'];
  const mangler = skal.filter(f => !fs.existsSync(path.join(PAKKE, f)));
  tjek('pakken har alle sine filer', mangler.length === 0, mangler.join(', '));
  // V-KVIT.1 N4: pakken er 2.0.1 (kun dokumenter: licensteksten, beslutningen om Huginn and Muninn, noten om Sandbox).
  tjek('VERSION er 2.7.0', VERSION === '2.7.0' && pk('VERSION') === '2.7.0\n', JSON.stringify(pk('VERSION')));
  const log = pk('CHANGELOG.md');
  const foerste = /^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/m.exec(log);
  tjek('CHANGELOG: første post er pakkens version med en dato', Boolean(foerste) && foerste[1] === VERSION, foerste ? foerste[0] : 'ingen post');
  tjek('CHANGELOG: kun dato, ingen klokkeslæt', !/\d{1,2}[:.]\d{2}(?![\d.])\s*(?:$|[^\d-])/m.test(log.replace(/\d+\.\d+\.\d+/g, '')) && !/T\d{2}:\d{2}|\bkl\.\s*\d/.test(log));
  tjek('fire skriftfiler (woff2) ligger i pakken', fs.readdirSync(path.join(PAKKE, 'web', 'fonts')).filter(f => f.endsWith('.woff2')).length === 4);
  tjek('begge OFL-licenser nævner SIL Open Font License', ['OFL-Inter.txt', 'OFL-JetBrainsMono.txt'].every(f => /SIL OPEN FONT LICENSE/i.test(pk('web/fonts/' + f))));
  const lic = pk('LICENSE.md'), readme = pk('README.md');
  tjek('V-KVIT.1: CHANGELOG har posterne 2.0.1 og 2.0.0, nyeste først, og 2.0.1 nævner de tre tilføjelser', log.indexOf('## 2.0.1 — ') > 0 && log.indexOf('## 2.0.1 — ') < log.indexOf('## 2.0.0 — ') && ['`LICENSE`', 'HUGINN-MUNINN.md', 'WI24RD-SANDBOX.md'].every(o => log.slice(log.indexOf('## 2.0.1'), log.indexOf('## 2.0.0')).includes(o)));
  tjek('V-KVIT.1: hele Apache-2.0-teksten ligger i pakken (LICENSE, byte for byte som repoets), og LICENSE.md og README peger på den', pk('LICENSE') === fs.readFileSync(path.join(repo, 'LICENSE'), 'utf8') && /Apache License\s+Version 2\.0, January 2004/.test(pk('LICENSE')) && /END OF TERMS AND CONDITIONS/.test(pk('LICENSE')) && /`LICENSE` i denne mappe/.test(lic) && /`LICENSE`/.test(readme));
  tjek('LICENSE.md: Apache-2.0 som repoet, skrifterne under OFL', /Apache License 2\.0/.test(lic) && /SIL Open Font License 1\.1/.test(lic) && /Apache License/.test(fs.readFileSync(path.join(repo, 'LICENSE'), 'utf8')));
  tjek('README: web (rækkefølge, tema, sprog), WPF (flet ind, ingen komponenter), opdatering og hvad der mangler', ['## Sådan tager et webbaseret program kittet i brug', 'data-kit-praefiks', 'Tema.saet(', 'KitSprog.opret(', '## Sådan tager et WPF-program tokens i brug', 'Komponenterne findes ikke til WPF endnu', 'MergedDictionaries', 'DynamicResource', '## Sådan opdaterer du til en ny version', '## Hvad pakken ikke indeholder'].every(s => readme.includes(s)));
  tjek('README: navnereglen for XAML står der (Wi24rd + PascalCase, fx Wi24rdAccentBrush)', /`Wi24rd` \+ tokenets navn i PascalCase/.test(readme) && readme.includes('Wi24rdAccentBrush'));
  const raekkefoelge = ['tokens.css', 'kit.css', 'tema.js', 'sprogmotor.js', 'kit.js'].map(f => readme.indexOf(`assets/${f}"`));
  tjek('README: filerne står i den rækkefølge, de skal indlæses', raekkefoelge.every((x, i) => x > 0 && (i === 0 || x > raekkefoelge[i - 1])), raekkefoelge.join(','));
  const gammel = fs.readFileSync(path.join(repo, 'design', 'ui-kit-2', 'README.md'), 'utf8');
  tjek('kittets README: listen "Det mangler" siger ikke længere, at der ingen pakket kode er', !/ingen pakket kode endnu/.test(gammel) && /pakke\//.test(gammel));
}

// ── N2/N5: kittets web-filer kender ikke det program, de blev udskilt fra ──
{
  /* En oprindelseskommentar er en kommentar, der indeholder ordet "Oprindelse:"; kun dér må navnet stå. */
  const udenOprindelse = t => t.replace(/\/\*[\s\S]*?\*\//g, k => (/Oprindelse:/.test(k) ? '' : k));
  const NAVN = /grimnir/i;
  const filer = par().map(([kilde]) => kilde).filter(f => /\.(css|js|txt)$/.test(f) && f.includes(path.join('pakke', 'web')));
  tjek('pakkens web/ har tekstfilerne (kit.css, kit.js, tema.js, sprogmotor.js og to licenser)', filer.length === 6, filer.map(f => path.basename(f)).join(', '));
  const med = filer.filter(f => NAVN.test(udenOprindelse(fs.readFileSync(f, 'utf8'))));
  tjek('ingen fil i pakkens web/ nævner Grimnir uden for en oprindelseskommentar', med.length === 0, med.map(f => path.relative(PAKKE, f)).join(', '));
  tjek('kontrol: reglen fanger navnet i kode og i en almindelig kommentar, men ikke i en oprindelseskommentar', NAVN.test(udenOprindelse("const N = 'grimnir-tema';")) && NAVN.test(udenOprindelse('/* Grimnirs tabel */ a{}')) && NAVN.test(udenOprindelse('// GRIMNIR')) && !NAVN.test(udenOprindelse('/* Oprindelse: udskilt fra Wi24rd Grimnir. */ a{}')));
  tjek('tokens.css og Tokens.xaml nævner heller ikke programmet', !NAVN.test(pk('tokens/tokens.css')) && !NAVN.test(pk('tokens/Tokens.xaml')) && !NAVN.test(pk('tokens/wi24rd-ui-kit-2.tokens.json')));
  const js = ['kit.js', 'tema.js', 'sprogmotor.js'].map(f => pk('web/' + f)).join('\n');
  tjek('kittet kender ikke Tauri eller programmets kommandoer (ingen __TAURI__, invoke eller data-platform)', !/__TAURI__|invoke\(|data-platform|data-tauri/.test(js + pk('web/kit.css')));
  tjek('tema.js og sprogmotor.js har ikke et fast navn i localStorage: præfikset kommer fra <html data-kit-praefiks>', /getAttribute\('data-kit-praefiks'\) \|\| 'wi24rd'\) \+ '-tema'/.test(pk('web/tema.js')) && /getAttribute\('data-kit-praefiks'\) \|\| 'wi24rd'\) \+ '-sprog'/.test(pk('web/sprogmotor.js')));
  tjek('ingen console.* og ingen farvekoder i kittets kode', !/\bconsole\s*\./.test(js) && !/#[0-9a-fA-F]{3,8}(?![\w-])|\brgba?\(|\bhsla?\(/.test(js.replace(/url\(#\$\{id\}\)/g, '') + pk('web/kit.css')));
  const css = pk('web/kit.css');
  const urler = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
  tjek('kit.css henter kun skrifterne i fonts/ ved siden af sig selv', urler.length === 4 && urler.every(u => /^fonts\/[a-z0-9-]+\.woff2$/.test(u) && fs.existsSync(path.join(PAKKE, 'web', u))) && !/@import/.test(css));
  // Det, der blev flyttet ud til programmet, står nu i programmets egne filer.
  const ui = p => fs.readFileSync(path.join(repo, 'ui', p), 'utf8');
  // V-KITBRUG.1: Grimnir deler de 80 px med tekststørrelsen (80 px på skærmen i alle trin). V-KITBRUG.2 (G10): med kittets
  // --tekst-zoom i stedet for Grimnirs egen --z.
  tjek('flyttet: pladsen til macOS-knapperne står i programmets app.css, ikke i kit.css', /\[data-platform="macos"\] \.titel \{ padding-left: (80px|calc\(80px \/ var\(--tekst-zoom\)\)); \}/.test(ui('assets/app.css')) && !/data-platform/.test(css));
  tjek('flyttet: de fire programikoner registreres i app.js, og kit.js har dem ikke', /K\.registrerIkoner\(\{\s*foerefter: [\s\S]*?kvittering: [\s\S]*?maske: [\s\S]*?naeste: /.test(ui('assets/app.js')) && !/^\s+(foerefter|kvittering|maske|naeste): \[/m.test(pk('web/kit.js')));
  tjek('omdøbt: .titel .sag hedder .titel .hoejre i kittet og i programmets index.html', /\.titel \.hoejre \{ margin-left: auto;/.test(css) && !/\.sag\b/.test(css) && /<span class="hoejre">/.test(ui('index.html')) && !/class="sag"/.test(ui('index.html')));
  tjek('programmet giver sit præfiks og indlæser sprogmotor.js før sprog.js', /<html[^>]* data-kit-praefiks="grimnir"/.test(ui('index.html')) && ui('index.html').indexOf('assets/sprogmotor.js') > 0 && ui('index.html').indexOf('assets/sprogmotor.js') < ui('index.html').indexOf('assets/sprog.js'));
  tjek('programmets sprog.js har teksterne og bruger kittets mekanik (ingen egen localStorage eller anvend)', /window\.KitSprog\.opret\(\{ tekst: TEKST, standard: 'da', noegle: NOEGLE, haendelse: NOEGLE, titel: 'dokTitel' \}\)/.test(ui('assets/sprog.js')) && !/localStorage\s*\./.test(ui('assets/sprog.js')) && !/function anvend/.test(ui('assets/sprog.js')));
}

// ── N3/N5: demosiden henter intet udefra og kører med pakkens rigtige filer ──
const demoFil = path.join(PAKKE, 'demo', 'index.html');
{
  const html = pk('demo/index.html'), script = pk('demo/demo.js');
  const begge = html + '\n' + script;
  const UDEFRA = /https?:|\bwss?:|\bftp:|(^|[^:\w/])\/\/[\w-]+(\.[\w-]+)+|\bcdn\b|@import|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bimport\s*\(|<iframe|<object|<embed|<link[^>]+rel="(?:preconnect|dns-prefetch|preload)"/i;
  tjek('demo: ingen http, //-adresser, CDN eller kode, der henter noget', !UDEFRA.test(begge), (UDEFRA.exec(begge) || [''])[0]);
  tjek('kontrol: mønsteret fanger https://, //cdn.example.com, fetch( og @import, men ikke stier og adresser i eksemplerne', ['src="https://example.com/a.js"', 'href="//cdn.example.com/a.css"', "fetch('a')", '@import "a.css"', 'new WebSocket(u)'].every(s => UDEFRA.test(s)) && !UDEFRA.test('href="../web/kit.css" 192.0.2.0/24 2001:db8::17 srv-app01.eksempel.dk'));
  const henvisninger = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  const lokale = henvisninger.filter(h => !h.startsWith('#'));
  tjek('demo: alle src og href er relative stier til filer i pakken', lokale.length === 6 && lokale.every(h => !/^[a-z]+:|^\//i.test(h) && path.resolve(PAKKE, 'demo', h).startsWith(PAKKE + path.sep) && fs.existsSync(path.resolve(PAKKE, 'demo', h))), lokale.join(', '));
  tjek('demo: bruger pakkens rigtige filer i den rækkefølge, README beskriver', JSON.stringify(lokale) === JSON.stringify(['../tokens/tokens.css', '../web/kit.css', '../web/tema.js', '../web/sprogmotor.js', '../web/kit.js', 'demo.js']));
  tjek('demo: tema.js står uden defer i <head>; resten har defer', /<script src="\.\.\/web\/tema\.js"><\/script>/.test(html) && /<script src="\.\.\/web\/kit\.js" defer><\/script>/.test(html));
  tjek('demo: ingen farvekoder (kun tokens)', !/#[0-9a-fA-F]{3,8}(?![\w-])|\brgba?\(|\bhsla?\(/.test(begge));
  tjek('demo: versionen på siden er pakkens', (html.match(/data-v="(\d+\.\d+\.\d+)"/g) || []).length === 3 && (html.match(/data-v="(\d+\.\d+\.\d+)"/g) || []).every(m => m === `data-v="${VERSION}"`));
  const liste = navn => JSON.parse(new RegExp(`const ${navn} = (\\[[^\\]]*\\]);`).exec(script)[1].replace(/'/g, '"'));
  tjek('demo: farverne på Tokens-visningen er dem i tokens.json', JSON.stringify(liste('FARVER')) === JSON.stringify(tokens.color.tokens.map(t => t.name)));
  tjek('demo: skriftstile, luft og radier er dem i tokens.json', JSON.stringify(liste('STILE')) === JSON.stringify(tokens.type.groups.flatMap(g => g.styles.map(s => s.name))) && JSON.stringify(liste('LUFT')) === JSON.stringify(tokens.spacing.tokens.map(t => t.name)) && JSON.stringify(liste('RADIER')) === JSON.stringify(tokens.radius.tokens.map(t => t.name)));
  tjek('demo: kun opdigtede adresser og navne (dokumentationsnet og eksempel.dk)', (begge.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || []).every(ip => ip.startsWith('192.0.2.')) && (begge.match(/[\w-]+\.[\w-]+\.(?:dk|com|net|org)\b|\b[\w-]+\.(?:dk|com|net|org)\b/g) || []).every(d => /(?:^|\.)eksempel\.dk$|(?:^|\.)example\.com$/.test(d)));
}
{
  // Siden indlæses, som en browser gør det fra disken: jsdom henter kun filerne ved siden af (file:), aldrig noget andet.
  const hentet = [], fejlListe = [];
  const konsol = new VirtualConsole();
  konsol.on('jsdomError', e => fejlListe.push(String(e && (e.detail || e.message))));
  konsol.on('error', e => fejlListe.push(String(e)));
  const { ResourceLoader } = await import('jsdom');
  class KunDisk extends ResourceLoader {
    fetch(url, o) {
      hentet.push(url);
      if (!url.startsWith('file:')) return Promise.reject(new Error('ikke fra disken: ' + url));
      return super.fetch(url, o);
    }
  }
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: new KunDisk(), pretendToBeVisual: true, virtualConsole: konsol });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  tjek('demo: indlæses uden fejl', fejlListe.length === 0 && Boolean(w.Kit && w.Tema && w.KitSprog && w.Sprog), fejlListe.join(' | ').slice(0, 300));
  const pakkeUrl = pathToFileURL(PAKKE).href;
  tjek('demo: alt, siden hentede, ligger i pakken (2 stilark og 4 scripts; skrifterne henter jsdom ikke)', hentet.length === 6 && hentet.every(u => u.startsWith(pakkeUrl + '/')), hentet.map(u => u.replace(pakkeUrl, '')).join(', '));
  const KOMPONENT = { AppShell: '.vindue > .titel', CommandBar: '#demo-baand.cmd .cb', NavPane: '#demo-trae.trae .tr', Visningsskift: '#demo-skift.skift .vs', StatusFooter: '.demo-ramme > .fodl', DataTable: '#demo-tabel table.tabel tbody tr', TabelNy: '#demo-tabel-ny table.tabel thead th[aria-sort] button.sorter', Sideskift: '#demo-tabel-ny nav.sideskift .sideskift-nr', StatusChip: '#demo-chips .chip', Banner: '#demo-bannere .ban', Wizard: '#demo-guide.wiz .trin .t', Button: '#demo-knapper .btn', TextField: '#demo-felter .felt input', Ikoner: '#demo-ikoner svg', Fletbaand: '#demo-flet svg.flet', Grundlag: '.skjult-tekst', Vælger: '#demo-vaelger-titel .vlg .vlg-knap', Sidepanel: '#demo-sidepanel.sidepanel .sp-top h2', Segmentknap: '#demo-segment .seg .seg-v', BaandUdenFaner: '#demo-baand-enkel.cmd.enkel .baand-el .seg', OtteVisninger: '#demo-skift-otte.skift.taet .vs', Filterchip: '#demo-filterchips .fchips .fchip', Kasse: '#demo-kasser section.kasse .kasse-top h2', StatusTile: '#demo-fliser ul.sfliser > li > button.sflise', TomTilstand: '#demo-tom-stor .tomt h2.tomt-h', Fremdrift: '#demo-frem .frem.ubestemt .snurr', Vaerktoejstip: '#demo-tip .tip-plads .tip[role="tooltip"]', Afkrydsning: '#demo-afk .afk input.afk-boks[type="checkbox"]', Kontakt: '#demo-kontakt input.tilfra[role="switch"]', Radiogruppe: '#demo-radio fieldset.valgsaet input[type="radio"]', Valgliste: '#demo-valgliste .vliste select', Dialog: '#demo-dialog .btn', Tekststoerrelse: '#demo-tekst .seg .seg-v' };
  const tomme = Object.entries(KOMPONENT).filter(([, v]) => !d.querySelector(v)).map(([k]) => k);
  tjek('demo: hver komponent er på siden, bygget af kittet', tomme.length === 0, tomme.join(', '));
  tjek('demo: hver sektion på Komponenter-visningen har en komponent fra KOMPONENTER.md', [...d.querySelectorAll('#v-komponenter .demo-sektion')].length === 28);
  tjek('demo: alle fem chips, fire bannere, fire knapvarianter og tre felter', d.querySelectorAll('#demo-chips .chip').length === 5 && d.querySelectorAll('#demo-bannere .ban').length === 4 && ['primary', 'danger', 'ghost'].every(v => d.querySelector(`#demo-knapper .btn.${v}`)) && d.querySelectorAll('#demo-knapper .btn').length === 4 && d.querySelectorAll('#demo-felter .felt').length === 3 && d.querySelector('#demo-felter [aria-invalid="true"]'));
  tjek('demo: alle kittets ikoner vises', d.querySelectorAll('#demo-ikoner .demo-ikon').length === Object.keys(w.Kit.IKONER).length && Object.keys(w.Kit.IKONER).length === 27, String(Object.keys(w.Kit.IKONER).length));

  // Begge temaer: valget sætter <html data-tema>, huskes under sidens eget præfiks og kan ses på knapperne.
  // jsdom giver ingen localStorage til en side fra disken (file:). Det er samme vilkår som en browser i privat tilstand:
  // siden skal virke alligevel, og valget gælder så kun denne gang. At valget huskes under præfikset, prøves længere nede.
  let lager = null;
  try { lager = w.localStorage || null; } catch (e) { lager = null; }
  tjek('demo: virker uden lagring (ingen localStorage på file: i jsdom)', lager === null && w.Tema.valg === 'system' && w.Sprog.lang === 'da');
  tjek('demo: starter i system', d.documentElement.getAttribute('data-tema') === 'system' && w.Tema.valg === 'system');
  d.querySelector('#baand [data-kommando="tema-moerk"]').click();
  tjek('demo: Mørk sætter data-tema="moerk", og knapperne viser valget', d.documentElement.getAttribute('data-tema') === 'moerk' && w.Tema.valg === 'moerk' && d.querySelector('#baand [data-kommando="tema-moerk"]').getAttribute('aria-pressed') === 'true' && d.querySelector('#baand [data-kommando="tema-system"]').getAttribute('aria-pressed') === 'false');
  d.querySelector('#baand [data-kommando="tema-lys"]').click();
  tjek('demo: Lys sætter data-tema="lys"', d.documentElement.getAttribute('data-tema') === 'lys' && w.Tema.valg === 'lys');
  d.getElementById('skift-tema').click();
  tjek('demo: knappen i titellinjen går videre til næste tema', d.documentElement.getAttribute('data-tema') === 'moerk');
  tjek('demo: siden har sit eget præfiks (kit-demo), så den ikke deler valg med et program', d.documentElement.getAttribute('data-kit-praefiks') === 'kit-demo' && /addEventListener\('kit-demo-tema'/.test(pk('demo/demo.js')) && /addEventListener\('kit-demo-sprog'/.test(pk('demo/demo.js')));

  // Begge sprog: hver nøgle findes, og intet element står tomt.
  const T = w.Sprog.TEKST;
  const da = Object.keys(T.da).sort(), en = Object.keys(T.en).sort();
  tjek('demo: dansk og engelsk har de samme nøgler', JSON.stringify(da) === JSON.stringify(en), da.filter(k => !en.includes(k)).concat(en.filter(k => !da.includes(k))).join(', '));
  const ukendte = () => [...d.querySelectorAll('[data-t],[data-t-aria],[data-t-title],[data-t-ph]')].flatMap(e => ['data-t', 'data-t-aria', 'data-t-title', 'data-t-ph'].map(a => e.getAttribute(a)).filter(Boolean)).filter(k => !(k in T.da) || !(k in T.en));
  tjek('demo: ingen nøgle på siden mangler i et af sprogene', ukendte().length === 0, [...new Set(ukendte())].join(', '));
  const tomt = () => [...d.querySelectorAll('[data-t]')].filter(e => !e.textContent.trim()).map(e => e.getAttribute('data-t'));
  tjek('demo (dansk): intet element med data-t står tomt', tomt().length === 0 && d.documentElement.lang === 'da' && d.title === 'Wi24rd UI Kit 2 — demo', tomt().join(', '));
  tjek('demo (dansk): ental og flertal (28 komponenter vises)', d.getElementById('fod-antal').textContent === '28 komponenter vises' && d.querySelector('#status-chip .ord').textContent === '28 komponenter');
  d.getElementById('skift-sprog').click();
  tjek('demo (English): sproget skifter uden genindlæsning', d.documentElement.lang === 'en' && w.Sprog.lang === 'en' && d.getElementById('fod-antal').textContent === '28 components shown' && d.querySelector('#demo-knapper .btn.primary span').textContent === 'Save and mask');
  tjek('demo (English): intet element med data-t står tomt', tomt().length === 0, tomt().join(', '));

  // Kittets opførsel på siden: træet filtrerer, søgningen filtrerer, tabellen vælger, guiden går frem.
  const punkt = id => d.querySelector(`#trae [data-punkt="${id}"]`);
  punkt('kontroller').click();
  const synlige = () => [...d.querySelectorAll('#v-komponenter .demo-sektion')].filter(s => !s.hidden).map(s => s.dataset.navn);
  tjek('demo: træet filtrerer arbejdsfladen (Controls: Vælger, Segmentknap, Filterchip, Afkrydsning, Kontakt, Radiogruppe, Valgliste, Button og TextField)', JSON.stringify(synlige()) === JSON.stringify(['Vælger', 'Segmentknap', 'Filterchip', 'Afkrydsning', 'Kontakt', 'Radiogruppe', 'Valgliste', 'Button', 'TextField']) && d.getElementById('fod-antal').textContent === '9 components shown', JSON.stringify(synlige()));
  d.getElementById('ryd').click();
  d.getElementById('soeg').value = 'banner';
  d.getElementById('soeg').dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('demo: søgefeltet filtrerer (banner → Banner, ental; "chip" rammer fra 2.3.0 også Filterchip)', JSON.stringify(synlige()) === JSON.stringify(['Banner']) && d.getElementById('fod-antal').textContent === '1 component shown');
  d.getElementById('ryd').click();
  tjek('demo: Ryd filter viser alle igen', synlige().length === 28);
  const raekker = [...d.querySelectorAll('#demo-tabel tbody tr:not(.gruppe)')];
  raekker[0].click();
  raekker[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  tjek('demo: tabellen vælger med klik og pil ned', raekker[1].classList.contains('sel') && raekker[1].getAttribute('aria-selected') === 'true' && d.getElementById('tabel-valgt').textContent === 'Selected: 2001:db8::17');
  const frem = d.querySelector('#demo-guide .fod .btn.primary');
  frem.click();
  tjek('demo: guiden går til trin 2 og udfylder teksterne', d.querySelector('#demo-guide .t.now').textContent.includes('Your domains') && d.querySelector('#demo-guide h2').textContent === 'Your domains' && d.querySelectorAll('#demo-guide .t.done').length === 1 && d.querySelector('#demo-guide .felt input'));
  frem.click();
  tjek('demo: i sidste trin hedder den primære knap Done', frem.querySelector('span').textContent === 'Done');
  w.location.hash = '#tokens';
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  tjek('demo: visningsskiftet viser Tokens (54 farver fra 2.4.0, 8 skriftstile) og markerer den', !d.getElementById('v-tokens').hidden && d.getElementById('v-komponenter').hidden && d.querySelectorAll('#demo-farver .demo-farve').length === 54 && d.querySelectorAll('#demo-skrift > div').length === 8 && d.querySelector('#skift .vs.on').dataset.visning === 'tokens' && d.querySelector('#skift .vs.on').getAttribute('aria-current') === 'page');
  tjek('demo: stadig ingen fejl efter brug', fejlListe.length === 0, fejlListe.join(' | ').slice(0, 300));
  w.close();
}

// ── N3/N5: Tokens.xaml ──
{
  const xaml = pk('tokens/Tokens.xaml');
  let doc = null, xmlFejl = '';
  try { doc = new JSDOM(xaml, { contentType: 'application/xml' }).window.document; } catch (e) { xmlFejl = String(e && e.message); }
  tjek('Tokens.xaml er velformet XML', Boolean(doc), xmlFejl);
  let daarlig = true;
  try { new JSDOM(xaml.replace('</ResourceDictionary>', ''), { contentType: 'application/xml' }); daarlig = false; } catch (e) { /* forventet */ }
  tjek('kontrol: XML-læseren afviser en fil med et manglende sluttag', daarlig);
  const WPF = 'http://schemas.microsoft.com/winfx/2006/xaml/presentation', X = 'http://schemas.microsoft.com/winfx/2006/xaml';
  const rod = doc.documentElement;
  tjek('Tokens.xaml: roden er en WPF ResourceDictionary', rod.localName === 'ResourceDictionary' && rod.namespaceURI === WPF && rod.getAttribute('xmlns:x') === X);
  const ordboeger = [...rod.children];
  tjek('Tokens.xaml: præcis to ordbøger, Wi24rdLys og Wi24rdMoerk', ordboeger.length === 2 && ordboeger.every(o => o.localName === 'ResourceDictionary') && JSON.stringify(ordboeger.map(o => o.getAttributeNS(X, 'Key'))) === JSON.stringify([XAML_TEMA.light, XAML_TEMA.dark]));
  const laes = o => {
    const m = new Map();
    let dobbelt = 0;
    for (const e of o.children) {
      const k = e.getAttributeNS(X, 'Key');
      if (m.has(k)) dobbelt++;
      m.set(k, e);
    }
    return { m, dobbelt };
  };
  const lys = laes(ordboeger[0]), moerk = laes(ordboeger[1]);
  tjek('Tokens.xaml: ingen nøgle står to gange i samme ordbog', lys.dobbelt === 0 && moerk.dobbelt === 0);
  tjek('Tokens.xaml: de to ordbøger har præcis de samme nøgler (163 hver fra 2.4.0)', lys.m.size === 163 && JSON.stringify([...lys.m.keys()]) === JSON.stringify([...moerk.m.keys()]), `${lys.m.size} / ${moerk.m.size}`);
  tjek('Tokens.xaml: alle nøgler følger navnereglen (Wi24rd + PascalCase)', [...lys.m.keys()].every(k => /^Wi24rd[A-Z][A-Za-z0-9]*$/.test(k)));
  tjek('kontrol: navnereglen (surface-raised → Wi24rdSurfaceRaised, space-1 → Wi24rdSpace1, accent → Wi24rdAccent)', pascal('surface-raised') === 'Wi24rdSurfaceRaised' && pascal('space-1') === 'Wi24rdSpace1' && pascal('accent') + 'Brush' === 'Wi24rdAccentBrush');

  // Hver token i JSON findes i begge ordbøger, med den type WPF skal bruge.
  const forventet = [];
  for (const t of tokens.color.tokens) forventet.push([pascal(t.name) + 'Brush', 'SolidColorBrush'], [pascal(t.name) + 'Color', 'Color']);
  for (const t of tokens.shadow.tokens) forventet.push([pascal(t.name), 'DropShadowEffect']);
  for (const k of Object.keys(tokens.type.families)) forventet.push([pascal('font-' + k), 'FontFamily']);
  for (const g of tokens.type.groups) for (const s of g.styles) {
    forventet.push([pascal(s.name) + 'Size', 'Double'], [pascal(s.name) + 'Line', 'Double'], [pascal(s.name) + 'Weight', 'FontWeight'], [pascal(s.name) + 'Family', 'FontFamily']);
    if (s.letterSpacing) forventet.push([pascal(s.name) + 'Tracking', 'Double']);
  }
  for (const t of tokens.spacing.tokens) forventet.push([pascal(t.name), 'Double'], [pascal(t.name) + 'Thickness', 'Thickness']);
  for (const t of tokens.radius.tokens) forventet.push([pascal(t.name), 'CornerRadius']);
  for (const [navn, o] of [['Wi24rdLys', lys], ['Wi24rdMoerk', moerk]]) {
    const mangler = forventet.filter(([k, type]) => !o.m.has(k) || o.m.get(k).localName !== type).map(([k]) => k);
    tjek(`Tokens.xaml (${navn}): hver token i JSON findes med rigtig type (${forventet.length} nøgler)`, mangler.length === 0 && forventet.length === o.m.size, mangler.join(', '));
  }

  // Hver CSS-variabel har en nøgle efter navnereglen, og farver, tal og skrift er de samme som i tokens.css.
  const css = pk('tokens/tokens.css');
  const blok = (start) => { const i = css.indexOf(start); return Object.fromEntries([...css.slice(i, css.indexOf('}', i)).matchAll(/--([a-z0-9-]+): ([^;]+);/g)].map(m => [m[1], m[2]])); };
  const faelles = blok(':root {\n  --font-sans'), cssLys = blok(':root {\n  color-scheme: light;'), cssMoerk = blok(':root[data-tema="moerk"] {');
  tjek('tokens.css: 47 fælles variabler og 56 pr. tema fra 2.4.0 (kontrol af læsningen)', Object.keys(faelles).length === 47 && Object.keys(cssLys).length === 56 && Object.keys(cssMoerk).length === 56, [faelles, cssLys, cssMoerk].map(b => Object.keys(b).length).join('/'));
  const farveNavne = tokens.color.tokens.map(t => t.name);
  for (const [navn, o, c, tema] of [['Wi24rdLys', lys, cssLys, 'light'], ['Wi24rdMoerk', moerk, cssMoerk, 'dark']]) {
    const uens = farveNavne.filter(n => {
      const brush = o.m.get(pascal(n) + 'Brush'), color = o.m.get(pascal(n) + 'Color');
      const v = argb(c[n], n);
      return !brush || !color || brush.getAttribute('Color') !== v || color.textContent !== v;
    });
    tjek(`Tokens.xaml (${navn}): de 54 farver (fra 2.4.0) er de samme som i tokens.css (pensel og farve)`, farveNavne.length === 54 && uens.length === 0, uens.join(', '));
    tjek(`Tokens.xaml (${navn}): farverne er også dem i tokens.json (${tema})`, temaVaerdier(tokens, tema).filter(([n]) => farveNavne.includes(n)).every(([n, v]) => o.m.get(pascal(n) + 'Brush').getAttribute('Color') === '#FF' + v.slice(1).toUpperCase()));
    const tal = Object.entries(faelles).filter(([, v]) => /^-?[\d.]+px$/.test(v));
    const talUens = tal.filter(([n, v]) => { const e = o.m.get(pascal(n)); return !e || e.textContent !== v.replace('px', ''); }).map(([n]) => n);
    tjek(`Tokens.xaml (${navn}): størrelser, linjehøjder, luft og radier er tallene fra tokens.css (${tal.length} værdier)`, tal.length === 26 && talUens.length === 0, talUens.join(', '));
    const skygger = tokens.shadow.tokens.map(t => {
      const e = o.m.get(pascal(t.name)), m = /^0 (\d+)px (\d+)px(?: -?\d+px)? rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(c[t.name]);
      return e && m && e.getAttribute('ShadowDepth') === m[1] && e.getAttribute('BlurRadius') === m[2] && e.getAttribute('Opacity') === m[6] && e.getAttribute('Direction') === '270'
        && e.getAttribute('Color') === '#' + [m[3], m[4], m[5]].map(x => Number(x).toString(16).padStart(2, '0')).join('').toUpperCase();
    });
    tjek(`Tokens.xaml (${navn}): de to skygger har samme afstand, sløring, farve og styrke som i tokens.css`, skygger.length === 2 && skygger.every(Boolean));
    const alleCss = [...Object.keys(faelles), ...Object.keys(c)];
    const udenNoegle = alleCss.filter(n => !(o.m.has(pascal(n)) || o.m.has(pascal(n) + 'Brush')));
    tjek(`Tokens.xaml (${navn}): hver CSS-variabel har en nøgle efter navnereglen (${alleCss.length} variabler)`, alleCss.length === 103 && udenNoegle.length === 0, udenNoegle.join(', '));
  }
  tjek('Tokens.xaml: skriftvægte og familier (Normal/SemiBold; Inter, Segoe UI; ingen CSS-ord som system-ui)', lys.m.get('Wi24rdBodyWeight').textContent === 'Normal' && lys.m.get('Wi24rdH1Weight').textContent === 'SemiBold' && lys.m.get('Wi24rdFontSans').textContent === 'Inter, Segoe UI' && lys.m.get('Wi24rdFontMono').textContent === 'JetBrains Mono, Cascadia Mono, Menlo' && lys.m.get('Wi24rdMonoFamily').textContent === lys.m.get('Wi24rdFontMono').textContent && !/system-ui|sans-serif|monospace|&quot;/.test(xaml));
  tjek('Tokens.xaml: lyst og mørkt tema har forskellige farver, men samme tal', lys.m.get('Wi24rdSurfaceBrush').getAttribute('Color') === '#FFFFFFFF' && moerk.m.get('Wi24rdSurfaceBrush').getAttribute('Color') === '#FF121C29' && lys.m.get('Wi24rdSpace4').textContent === moerk.m.get('Wi24rdSpace4').textContent);
  tjek('Tokens.xaml: ingen farve i CSS-form (#RGB uden alfa i pensler, rgba) og ingen px', !/rgba?\(|px\b/.test(xaml.replace(/<!--[\s\S]*?-->/g, '')) && [...xaml.matchAll(/<SolidColorBrush [^>]*Color="([^"]+)"/g)].every(m => /^#FF[0-9A-F]{6}$/.test(m[1])));
}

// ── N3/N5: KOMPONENTER.md og koden nævner det samme ──
{
  const md = pk('KOMPONENTER.md');
  const afsnit = md.split(/^## /m).slice(1).map(a => ({ navn: a.slice(0, a.indexOf('\n')).trim(), tekst: a })).filter(a => a.navn !== 'Findes ikke endnu' && a.navn !== 'Hvilken kontrol hvornår');
  const klasserI = a => { const m = /^\*\*Klasser:\*\* (.*)$/m.exec(a.tekst); return m ? [...m[1].matchAll(/`\.([a-z][a-z0-9-]*)`/g)].map(x => x[1]) : []; };
  const funktionerI = a => { const m = /^\*\*Funktioner:\*\* (.*)$/m.exec(a.tekst); return m ? [...m[1].matchAll(/`(Kit|Tema|KitSprog|Tekst)\.([A-Za-zéø]+)`/g)].map(x => x[1] + '.' + x[2]) : []; };
  tjek('KOMPONENTER.md: 30 komponenter', afsnit.length === 30, afsnit.map(a => a.navn).join(', '));
  const DELE = ['**Formål:**', '**Markup:**', '**Tilstande:**', '**Tastatur:**', '**Kræver af programmet:**'];
  const ufuldstaendige = afsnit.filter(a => !DELE.every(d => a.tekst.includes(d))).map(a => a.navn);
  tjek('KOMPONENTER.md: hver komponent har formål, markup, tilstande, tastatur og hvad den kræver', ufuldstaendige.length === 0, ufuldstaendige.join(', '));

  // Klasserne i kit.css (vælgerne, uden kommentarer og erklæringer) og dem, kit.js selv sætter.
  const css = pk('web/kit.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  const kitJs = pk('web/kit.js');
  // Det, kittet stiller til rådighed: læst ved at køre de tre filer i en tom side.
  const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/' });
  for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
  const w = dom.window;
  const kodeFunktioner = new Set([...Object.keys(w.Kit).map(k => 'Kit.' + k), ...Object.keys(w.Tema).map(k => 'Tema.' + k), ...Object.keys(w.KitSprog).map(k => 'KitSprog.' + k), ...Object.keys(w.Tekst).map(k => 'Tekst.' + k)]);
  tjek('kittet stiller Kit (34 navne fra 2.5.0), Tema (3), KitSprog (1) og fra 2.3.0 Tekst (6) til rådighed', Object.keys(w.Kit).length === 34 && Object.keys(w.Tema).length === 3 && Object.keys(w.KitSprog).length === 1 && Object.keys(w.Tekst).length === 6, [...kodeFunktioner].join(', '));
  tjek('kit.css har 190 klasser i sine vælgere fra 2.7.0 (kontrol af læsningen)', cssKlasser.size === 190 && cssKlasser.has('btn') && cssKlasser.has('skjult-tekst') && !cssKlasser.has('woff2'), String(cssKlasser.size));

  const uden = afsnit.filter(a => klasserI(a).length + funktionerI(a).length === 0).map(a => a.navn);
  tjek('hver komponent i KOMPONENTER.md nævner mindst én klasse eller funktion', uden.length === 0, uden.join(', '));
  const ukendteKlasser = afsnit.flatMap(a => klasserI(a).filter(k => !cssKlasser.has(k)).map(k => `${a.navn}: .${k}`));
  tjek('hver klasse i KOMPONENTER.md findes i kit.css', ukendteKlasser.length === 0, ukendteKlasser.join(', '));
  const ukendteFunktioner = afsnit.flatMap(a => funktionerI(a).filter(f => !kodeFunktioner.has(f)).map(f => `${a.navn}: ${f}`));
  tjek('hver funktion i KOMPONENTER.md findes i kittet', ukendteFunktioner.length === 0, ukendteFunktioner.join(', '));
  const dokKlasser = new Set(afsnit.flatMap(klasserI)), dokFunktioner = new Set(afsnit.flatMap(funktionerI));
  const udokKlasser = [...cssKlasser].filter(k => !dokKlasser.has(k));
  tjek('omvendt: hver klasse i kit.css står under en komponent i KOMPONENTER.md', udokKlasser.length === 0, udokKlasser.map(k => '.' + k).join(', '));
  const udokFunktioner = [...kodeFunktioner].filter(f => !dokFunktioner.has(f));
  tjek('omvendt: hver funktion i Kit, Tema, KitSprog og Tekst står under en komponent i KOMPONENTER.md', udokFunktioner.length === 0, udokFunktioner.join(', '));
  // Hver komponentoverskrift i kit.css (/* ── Navn ── */) har et afsnit, og omvendt for dem, der har CSS.
  const cssAfsnit = [...pk('web/kit.css').matchAll(/\/\* ── ([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå ]*?) ──/g)].map(m => m[1]).filter(n => n !== 'Skrifter');
  const navne = afsnit.map(a => a.navn);
  tjek('hvert afsnit i kit.css er en komponent i KOMPONENTER.md', cssAfsnit.length === 27 && cssAfsnit.every(n => navne.includes(n)), cssAfsnit.filter(n => !navne.includes(n)).join(', '));
  const ikoner = Object.keys(w.Kit.IKONER);
  const ikonAfsnit = afsnit.find(a => a.navn === 'Ikoner').tekst;
  const ikonLinje = /^Kittets ikoner: (.*)$/m.exec(ikonAfsnit);
  const dokIkoner = ikonLinje ? [...ikonLinje[1].matchAll(/`([a-z]+)`/g)].map(m => m[1]) : [];
  tjek('KOMPONENTER.md: listen over ikoner er kittets (27)', JSON.stringify(dokIkoner) === JSON.stringify(ikoner), ikoner.filter(i => !dokIkoner.includes(i)).concat(dokIkoner.filter(i => !ikoner.includes(i))).join(', '));
  // De eksempler, der kalder kittet i KOMPONENTER.md og README.md, bruger kun navne, der findes.
  const kald = [...(md + pk('README.md')).matchAll(/\b(Kit|Tema|KitSprog|Tekst)\.([A-Za-zéø]+)/g)].map(m => m[1] + '.' + m[2]);
  const forkerte = [...new Set(kald.filter(k => !kodeFunktioner.has(k)))];
  tjek('eksemplerne i KOMPONENTER.md og README.md kalder kun navne, kittet har', kald.length > 30 && forkerte.length === 0, forkerte.join(', '));
  tjek('registrerIkoner: et nyt ikon kan bruges, og et af kittets navne kan ikke overtages', (() => {
    w.Kit.registrerIkoner({ proeve: [['path', { d: 'M4 12h16' }]] });
    let afvist = false;
    try { w.Kit.registrerIkoner({ sol: [['path', { d: 'M4 12h16' }]] }); } catch (e) { afvist = true; }
    return w.Kit.ikon('proeve').querySelector('path').getAttribute('d') === 'M4 12h16' && afvist && w.Kit.IKONER.sol.length === 2;
  })());
  tjek('tema.js: præfikset fra <html data-kit-praefiks> bruges til lager og hændelse', (() => {
    let meldt = 0;
    w.document.addEventListener('proeve-tema', () => meldt++);
    w.Tema.saet('moerk');
    return w.localStorage.getItem('proeve-tema') === 'moerk' && meldt === 1 && w.document.documentElement.getAttribute('data-tema') === 'moerk';
  })());
  tjek('sprogmotor.js: opret, t (ental/flertal), anvend og saet; ukendt sprog giver standardsproget', (() => {
    const S = w.KitSprog.opret({ standard: 'da', tekst: { da: { antal: '{v} {v:fil|filer}', gem: 'Gem' }, en: { antal: '{v} {v:file|files}', gem: 'Save' } } });
    w.document.body.innerHTML = '<button data-t="gem" data-t-aria="gem"></button><span data-t="antal" data-v="1"></span>';
    S.anvend(w.document);
    const b = w.document.querySelector('button'), s = w.document.querySelector('span');
    const foer = b.textContent === 'Gem' && b.getAttribute('aria-label') === 'Gem' && s.textContent === '1 fil' && S.t('antal', 3) === '3 filer';
    let meldt = 0;
    w.document.addEventListener('proeve-sprog', () => meldt++);
    S.saet('en');
    const efter = b.textContent === 'Save' && s.textContent === '1 file' && w.localStorage.getItem('proeve-sprog') === 'en' && meldt === 1 && w.document.documentElement.lang === 'en';
    S.saet('tysk');
    return foer && efter && S.lang === 'da' && b.textContent === 'Gem';
  })());
  w.close();
}

// ── Pakke 2.1.0 (K1–K4): ok, mærker, dataserier, skala og kort ──
{
  const farve = Object.fromEntries(tokens.color.tokens.map(t => [t.name, t.value]));
  // Intet er omdøbt eller fjernet i forhold til 2.0.0: de 22 farver findes stadig med samme værdier.
  const V200 = {"bg": {"light": "#F3F5F8", "dark": "#0B131E"}, "surface": {"light": "#FFFFFF", "dark": "#121C29"}, "surface-raised": {"light": "#F8FAFB", "dark": "#192433"}, "rail": {"light": "#0B1F33", "dark": "#070E17"}, "rail-text": {"light": "#C9D5E2", "dark": "#B9C6D6"}, "rail-strong": {"light": "#FFFFFF", "dark": "#FFFFFF"}, "rail-active": {"light": "#16364F", "dark": "#13293D"}, "accent-on-rail": {"light": "#35D6B3", "dark": "#35D6B3"}, "border": {"light": "#D8DEE6", "dark": "#263345"}, "border-strong": {"light": "#7C8A99", "dark": "#6B7C90"}, "text": {"light": "#17212B", "dark": "#E8EEF4"}, "text-muted": {"light": "#4F5E6D", "dark": "#A6B4C3"}, "accent": {"light": "#007864", "dark": "#35D6B3"}, "accent-hover": {"light": "#006050", "dark": "#6BE5CA"}, "on-accent": {"light": "#FFFFFF", "dark": "#04231D"}, "accent-soft": {"light": "#E2F4F0", "dark": "#0F322D"}, "info": {"light": "#1B5CC8", "dark": "#86B4FF"}, "info-soft": {"light": "#E7EFFD", "dark": "#13284A"}, "warn": {"light": "#8A5300", "dark": "#FFC66E"}, "warn-soft": {"light": "#FFF2DA", "dark": "#39290C"}, "danger": {"light": "#B3261E", "dark": "#FF9E96"}, "danger-soft": {"light": "#FDEBE9", "dark": "#3E1613"}};
  const aendret = Object.keys(V200).filter(n => !farve[n] || farve[n].light !== V200[n].light || farve[n].dark !== V200[n].dark);
  tjek('2.1.0: de 22 farver fra 2.0.0 findes stadig med samme værdier (intet omdøbt eller fjernet)', Object.keys(V200).length === 22 && aendret.length === 0, aendret.join(', '));
  const NYE = ['ok', 'ok-soft', 'ok-mark', 'warn-mark', 'danger-mark', 'info-mark', 'none-mark', 'data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-6', 'data-axis', 'data-grid', 'data-label',
    'seq-1', 'seq-2', 'seq-3', 'seq-4', 'seq-5', 'map-sea', 'map-land', 'map-border', 'map-ring', 'map-arc'];
  const mangler = NYE.filter(n => !farve[n] || !/^#[0-9A-F]{6}$/.test(farve[n].light) || !/^#[0-9A-F]{6}$/.test(farve[n].dark));
  tjek('2.1.0: de 26 nye farver findes i lyst og mørkt tema (i alt 54 fra 2.4.0)', mangler.length === 0 && tokens.color.tokens.length === 54, mangler.join(', '));
  tjek('2.1.0 (K1): ok og ok-soft har samme værdier som accent og accent-soft, men er egne tokens', ['light', 'dark'].every(t => farve.ok[t] === farve.accent[t] && farve['ok-soft'][t] === farve['accent-soft'][t]));
  const css = pk('web/kit.css');
  tjek('2.1.0 (K1): OK-chip og OK-banner bruger ok, ikke accent', /\.chip\.ok \{ background: var\(--ok-soft\); color: var\(--ok\); \}/.test(css) && /\.ban\.ok \{ background: var\(--ok-soft\); \} \.ban\.ok \.s \{ background: var\(--ok\);/.test(css));
  tjek('2.1.0: primær knap, valgt række og aktiv fane bruger stadig accent', /\.btn\.primary \{ background: var\(--accent\)/.test(css) && /\.tabel tr\.sel td[^{]*\{ background: var\(--accent-soft\)/.test(css) && /\.tab\.on \{ border-bottom-color: var\(--accent\)/.test(css));
  tjek('2.1.0 (K2): mærkefarverne er ikke tekstfarverne (egne værdier i lyst tema)', ['warn', 'danger', 'info'].every(n => farve[n + '-mark'].light !== farve[n].light) && farve['ok-mark'].light !== farve.ok.light);
  tjek('2.1.0 (K3): seks dataserier med forskellige farver i begge temaer; besøg/oplysning er samme blå som data-1', ['light', 'dark'].every(t => new Set([1, 2, 3, 4, 5, 6].map(n => farve['data-' + n][t])).size === 6 && farve['data-1'][t] === farve['info-mark'][t]));
  tjek('2.1.0 (K3): akse, gitter og etiket følger kittets kanter og sekundære tekst', ['light', 'dark'].every(t => farve['data-axis'][t] === farve['border-strong'][t] && farve['data-grid'][t] === farve.border[t] && farve['data-label'][t] === farve['text-muted'][t]));
  tjek('2.1.0 (K4): angrebets ring er fejlens mærke, buen oplysningens', ['light', 'dark'].every(t => farve['map-ring'][t] === farve['danger-mark'][t] && farve['map-arc'][t] === farve['info-mark'][t]));
  const tcss = pk('tokens/tokens.css'), xaml = pk('tokens/Tokens.xaml');
  tjek('2.1.0: hver ny farve står i tokens.css (tre blokke) og i Tokens.xaml (pensel og farve i begge ordbøger)', NYE.every(n => (tcss.match(new RegExp('--' + n + ': #', 'g')) || []).length === 3 && (xaml.match(new RegExp('x:Key="' + pascal(n) + 'Brush"', 'g')) || []).length === 2 && (xaml.match(new RegExp('x:Key="' + pascal(n) + 'Color"', 'g')) || []).length === 2));
  tjek('kontrol: navnereglen for de nye (ok-mark → Wi24rdOkMark, data-1 → Wi24rdData1, map-sea → Wi24rdMapSea)', pascal('ok-mark') === 'Wi24rdOkMark' && pascal('data-1') === 'Wi24rdData1' && pascal('map-sea') === 'Wi24rdMapSea');
  const log = pk('CHANGELOG.md');
  const post = log.slice(log.indexOf('## 2.1.0'), log.indexOf('\n## ', log.indexOf('## 2.1.0') + 1));
  tjek('CHANGELOG 2.1.0: nævner K1–K4, de nye tokens, og at intet er omdøbt eller fjernet', ['(K1)', '(K2)', '(K3)', '(K4)', '--ok-soft', '--none-mark', '--data-6', '--seq-5', '--map-arc', 'Intet er omdøbt eller fjernet'].every(o => post.includes(o)));
  const md = pk('KOMPONENTER.md');
  const grundlag = md.slice(md.indexOf('\n## Grundlag'), md.indexOf('\n## AppShell'));
  tjek('KOMPONENTER.md (Grundlag): hver ny farve er nævnt eller dækket af en række, og reglerne står der', ['--ok-soft', '--ok-mark', '--none-mark', '--data-1', '--data-6', '--data-axis', '--data-grid', '--data-label', '--seq-1', '--seq-5', '--map-sea', '--map-arc', 'Aldrig farve alene', 'Faste betydninger', 'Accent og ok'].every(o => grundlag.includes(o)));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K1–K4 står som opfyldt i 2.1.0, og tavlens farver står ikke længere som umulige at flytte', ['K1', 'K2', 'K3', 'K4'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.1\\.0 \\|').test(hm)) && !/Kit 2 har ingen farver til diagrammer og kort/.test(hm));
  // Demoen viser de nye tokens med pakkens rigtige filer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const baggrund = v => [...d.querySelectorAll(v + ' i')].map(i => i.style.background);
  tjek('demo 2.1.0: fem mærker, seks søjler, fem trin og fem kortfarver, hver med sit token og sit navn', JSON.stringify(baggrund('#demo-maerker')) === JSON.stringify(['ok', 'warn', 'danger', 'info', 'none'].map(n => `var(--${n}-mark)`))
    && JSON.stringify(baggrund('#demo-data')) === JSON.stringify([1, 2, 3, 4, 5, 6].map(n => `var(--data-${n})`)) && JSON.stringify(baggrund('#demo-seq')) === JSON.stringify([1, 2, 3, 4, 5].map(n => `var(--seq-${n})`))
    && d.querySelectorAll('#demo-kortfarver i').length === 5 && [...d.querySelectorAll('#demo-maerker-sektion .mono')].length === 21);
  const kort = d.querySelector('#demo-kort svg');
  tjek('demo 2.1.0: kortet er tegnet med kortets tokens (hav, land, grænse, trin, ring og bue)', Boolean(kort) && ['--map-sea', '--map-land', '--map-border', '--seq-3', '--seq-5', '--map-ring', '--map-arc'].every(t => kort.outerHTML.includes(`var(${t})`)));
  tjek('demo 2.1.0: sektionen har overskrift og tekst i begge sprog', d.querySelector('#demo-maerker-sektion h2').textContent === 'Mærker, data, skala og kort' && d.querySelector('#demo-maerker-sektion p').textContent.startsWith('Fra 2.1.0') && w.Sprog.TEKST.en.hMaerker === 'Marks, data, scale and map');
  w.close();
}

// ── Pakke 2.2.0 (K5–K9): skallen. Flere visninger, vælger, regel for træet, sidepanel, bånd uden faner og segmentknap ──
{
  // Intet er omdøbt eller fjernet i forhold til 2.0.0: listerne er læst fra 2.0.0 (git show 64c0cce:design/ui-kit-2/pakke/web/kit.css
  // og kit.js, tema.js, sprogmotor.js) og står her som faste lister. V200_UDSEENDE er det, 2.0.0's kit.js byggede af de
  // tre eksempler i bygEksempler herunder (et bånd med to faner, seks visninger, et træ).
  const V200_KLASSER = ["ant","arb","ban","btn","cap","cb","chip","cmd","danger","done","fejl","fejltekst","felt","fl","flade","flet","fod","fodl","ghost","grp","gruppe","grupper","gv","h","hj","hoejre","ik","indhold","info","kn","label","luft","midte","mono","mrk","muted","n","nav","none","now","ok","on","ord","pri","primary","r","rk","s","sel","skift","skjult-tekst","soeg","t","tab","tabel","tabs","titel","tr","trae","trin","vindue","vl","vs","warn","wiz"];
  const V200_FUNKTIONER = ["Kit.IKONER","Kit.ikon","Kit.registrerIkoner","Kit.chip","Kit.knap","Kit.felt","Kit.banner","Kit.tabel","Kit.commandBar","Kit.navTrae","Kit.visningsskift","Kit.guide","Kit.fletbaand","Kit.SYMBOL","Tema.VALG","Tema.valg","Tema.saet","KitSprog.opret"];
  const V200_IKONER = ["indsaet","fil","soeg","skjold","kopier","oeje","mappe","bog","gem","plus","aabn","eksport","import","slet","afspil","sol","maane","skaerm","sprog","laas","tandhjul","ned","hoejre","filter","luk","rediger","kalender"];
  const V200_UDSEENDE = {"baand":"<div class=\"cmd\"><div class=\"tabs\" role=\"tablist\" data-t-aria=\"cmdAria\"><button class=\"tab\" data-t=\"faneStart\" type=\"button\" id=\"kit-cb1-fane-start\" role=\"tab\" aria-controls=\"kit-cb1-panel-start\" data-fane=\"start\" aria-selected=\"false\" tabindex=\"-1\"></button><button class=\"tab on\" data-t=\"faneVis\" type=\"button\" id=\"kit-cb1-fane-vis\" role=\"tab\" aria-controls=\"kit-cb1-panel-vis\" data-fane=\"vis\" aria-selected=\"true\" tabindex=\"0\"></button></div><div class=\"grupper\" id=\"kit-cb1-panel-start\" role=\"tabpanel\" aria-labelledby=\"kit-cb1-fane-start\" data-fane=\"start\" hidden=\"\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-1\"><div class=\"kn\"><button class=\"cb pri\" type=\"button\" data-kommando=\"aabn\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 3h8l4 4v14H6z\"></path><path d=\"M14 3v4h4\"></path></svg><span data-t=\"kAabn\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"kopier\" aria-disabled=\"true\" data-t-title=\"hvorfor\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"></path></svg><span data-t=\"kKopier\"></span></button></div><span class=\"cap\" data-t=\"gFil\" id=\"kit-cb1-grp-1\"></span></div></div><div class=\"grupper\" id=\"kit-cb1-panel-vis\" role=\"tabpanel\" aria-labelledby=\"kit-cb1-fane-vis\" data-fane=\"vis\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-2\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"lys\" aria-pressed=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"></path></svg><span data-t=\"kLys\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"moerk\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z\"></path></svg><span data-t=\"kMoerk\"></span></button></div><span class=\"cap\" data-t=\"gTema\" id=\"kit-cb1-grp-2\"></span></div></div></div>","skift":"<div class=\"skift\" role=\"group\" data-t-aria=\"visninger\"><a class=\"vs\" href=\"#v1\" data-visning=\"v1\" aria-keyshortcuts=\"Meta+1\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v1\"></span><kbd aria-hidden=\"true\">⌘1</kbd></a><a class=\"vs on\" href=\"#v2\" data-visning=\"v2\" aria-keyshortcuts=\"Meta+2\" aria-current=\"page\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v2\"></span><kbd aria-hidden=\"true\">⌘2</kbd></a><a class=\"vs\" href=\"#v3\" data-visning=\"v3\" aria-keyshortcuts=\"Meta+3\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v3\"></span><kbd aria-hidden=\"true\">⌘3</kbd></a><a class=\"vs\" href=\"#v4\" data-visning=\"v4\" aria-keyshortcuts=\"Meta+4\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v4\"></span><kbd aria-hidden=\"true\">⌘4</kbd></a><a class=\"vs\" href=\"#v5\" data-visning=\"v5\" aria-keyshortcuts=\"Meta+5\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v5\"></span><kbd aria-hidden=\"true\">⌘5</kbd></a><a class=\"vs\" href=\"#v6\" data-visning=\"v6\" aria-keyshortcuts=\"Meta+6\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v6\"></span><kbd aria-hidden=\"true\">⌘6</kbd></a></div>","trae":"<ul class=\"trae\" role=\"tree\" data-t-aria=\"traeAria\"><li role=\"none\"><button class=\"tr\" type=\"button\" data-punkt=\"alle\" role=\"treeitem\" aria-level=\"1\" tabindex=\"-1\" aria-expanded=\"true\" aria-selected=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 9l6 6 6-6\"></path></svg><span data-t=\"tAlle\"></span><span class=\"ant\">3</span></button><ul role=\"group\"><li role=\"none\"><button class=\"tr on\" type=\"button\" data-punkt=\"a\" role=\"treeitem\" aria-level=\"2\" tabindex=\"0\" aria-current=\"true\" aria-selected=\"true\"><span data-t=\"tA\"></span><span class=\"ant\">1</span></button></li></ul></li></ul>"};
  const css = pk('web/kit.css'), kitJs = pk('web/kit.js');
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const w = ny(), d = w.document, K = w.Kit;
  const fn = [...Object.keys(w.Kit).map(k => 'Kit.' + k), ...Object.keys(w.Tema).map(k => 'Tema.' + k), ...Object.keys(w.KitSprog).map(k => 'KitSprog.' + k)];
  const mKl = V200_KLASSER.filter(k => !cssKlasser.has(k)), mFn = V200_FUNKTIONER.filter(f => !fn.includes(f)), mIk = V200_IKONER.filter(i => !(i in K.IKONER));
  tjek('2.2.0: hver klasse i kit.css fra 2.0.0 findes stadig (65)', V200_KLASSER.length === 65 && mKl.length === 0, mKl.join(', '));
  tjek('2.2.0: hver funktion i Kit, Tema og KitSprog fra 2.0.0 findes stadig (18)', V200_FUNKTIONER.length === 18 && mFn.length === 0, mFn.join(', '));
  tjek('2.2.0: hvert ikon fra 2.0.0 findes stadig (27), og der er ingen nye', V200_IKONER.length === 27 && mIk.length === 0 && JSON.stringify(Object.keys(K.IKONER)) === JSON.stringify(V200_IKONER), mIk.join(', '));
  tjek('2.2.0: de nye navne er Kit.vaelger, Kit.sidepanel og Kit.segment (og fra 2.3.0, 2.4.0, 2.5.0 og 2.6.0 kun dem i V230_FUNKTIONER, V240_FUNKTIONER, V250_FUNKTIONER og V260_FUNKTIONER)', JSON.stringify(fn.filter(f => !V200_FUNKTIONER.includes(f) && !V230_FUNKTIONER.includes(f) && !V240_FUNKTIONER.includes(f) && !V250_FUNKTIONER.includes(f) && !V260_FUNKTIONER.includes(f))) === JSON.stringify(['Kit.vaelger', 'Kit.sidepanel', 'Kit.segment']), fn.filter(f => !V200_FUNKTIONER.includes(f)).join(', '));
  const nyeKl = ['enkel', 'baand-el', 'taet', 'vlg', 'vlg-knap', 'vlg-vaerdi', 'vlg-pop', 'op', 'hoejre-kant', 'vlg-soeg', 'vlg-liste', 'vlg-p', 'aktiv', 'vlg-mark', 'vlg-boks', 'vlg-alle', 'vlg-navn', 'vlg-ingen', 'sidepanel', 'over', 'sp-top', 'sp-luk', 'sp-indhold', 'seg', 'seg-v'];
  tjek('2.2.0: kit.css har de 25 nye klasser og ingen andre nye (ud over dem i V230_KLASSER fra 2.3.0, V240_KLASSER fra 2.4.0, V250_KLASSER fra 2.5.0, V260_KLASSER fra 2.6.0 og V270_KLASSER fra 2.7.0)', nyeKl.length === 25 && JSON.stringify([...cssKlasser].filter(k => !V200_KLASSER.includes(k) && !V230_KLASSER.includes(k) && !V240_KLASSER.includes(k) && !V250_KLASSER.includes(k) && !V260_KLASSER.includes(k) && !V270_KLASSER.includes(k)).sort()) === JSON.stringify([...nyeKl].sort()), [...cssKlasser].filter(k => !V200_KLASSER.includes(k)).join(', '));
  function bygEksempler(K2, d2) {
    const b = d2.createElement('div');
    K2.commandBar(b, { ariaT: 'cmdAria', valgt: 'vis', faner: [
      { id: 'start', t: 'faneStart', grupper: [{ t: 'gFil', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true }, { id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorfor' }] }] },
      { id: 'vis', t: 'faneVis', grupper: [{ t: 'gTema', knapper: [{ id: 'lys', t: 'kLys', ikon: 'sol', trykket: true }, { id: 'moerk', t: 'kMoerk', ikon: 'maane', trykket: false }] }] },
    ] });
    const s = d2.createElement('div');
    K2.visningsskift(s, [1, 2, 3, 4, 5, 6].map(i => ({ id: 'v' + i, t: 'v' + i, ikon: 'mappe', genvej: '⌘' + i, genvejAria: 'Meta+' + i })), { ariaT: 'visninger' }).markér('v2');
    const t = d2.createElement('ul');
    K2.navTrae(t, [{ id: 'alle', t: 'tAlle', antal: 3, boern: [{ id: 'a', t: 'tA', antal: 1 }] }], { ariaT: 'traeAria', valgt: 'a' });
    return { baand: b.outerHTML, skift: s.outerHTML, trae: t.outerHTML };
  }
  const w2 = ny(), nu = bygEksempler(w2.Kit, w2.document);
  tjek('2.2.0 (K9): et bånd med to faner bygges præcis som i 2.0.0 (samme markup, byte for byte; Grimnirs bånd har to faner)', nu.baand === V200_UDSEENDE.baand);
  tjek('2.2.0 (K5): seks visninger bygges præcis som i 2.0.0 (ingen taet)', nu.skift === V200_UDSEENDE.skift && !/taet/.test(nu.skift));
  tjek('2.2.0 (K7): træet bygges præcis som i 2.0.0', nu.trae === V200_UDSEENDE.trae);
  tjek('2.2.0: kittet sætter ingen inline-stil (Grimnirs CSP er style-src \'self\', og dets UI-test forbyder .style.)', !/\.style\.|setAttribute\(\s*['"]style['"]|\.cssText/.test(kitJs));

  // ── K5: op til otte visninger ──
  const vis = n => Array.from({ length: n }, (_, i) => ({ id: 'v' + i, tekst: 'Visning ' + (i + 1), ikon: 'mappe', genvej: String(i + 1) }));
  const s7 = d.createElement('div'), s8 = d.createElement('div'), s9 = d.createElement('div');
  K.visningsskift(s7, vis(7));
  const skift8 = K.visningsskift(s8, vis(8));
  skift8.markér('v7');
  let fejl9 = '';
  try { K.visningsskift(s9, vis(9)); } catch (e) { fejl9 = String(e.message); }
  tjek('K5: syv og otte visninger virker og får klassen taet; otte links med aria-current på den aktive', s7.classList.contains('taet') && s8.className === 'skift taet' && s8.querySelectorAll('a.vs').length === 8 && s8.querySelector('[aria-current="page"]').dataset.visning === 'v7');
  tjek('K5: ni afvises tydeligt med en fejl (som et ukendt ikon), og elementet røres ikke', /højst otte visninger \(fik 9\)/.test(fejl9) && s9.outerHTML === '<div></div>', fejl9);
  tjek('K5: et skift, der bygges om fra otte til seks, mister taet', (() => { K.visningsskift(s8, vis(6)); return !s8.classList.contains('taet') && s8.classList.contains('skift'); })());
  // Det mindste vindue, kittet lover (.vindue), og målene i kit.css og tokens.css. Regnet her; jsdom tegner ikke.
  const tcss = pk('tokens/tokens.css');
  const tok = n => Number((new RegExp(`--${n}: (\\d+)px;`).exec(tcss) || [])[1]);
  const regel = (vaelger, egenskab) => {
    const m = new RegExp('(?:^|\\n)' + vaelger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css);
    const v = m && new RegExp('(?:^|[;\\s])' + egenskab + ': ([^;]+);').exec(m[1]);
    if (!v) return NaN;
    const x = v[1].trim(), t = /^var\(--([a-z0-9-]+)\)$/.exec(x);
    return t ? tok(t[1]) : parseFloat(x);
  };
  const vindue = /\.vindue \{[^}]*min-width: (\d+)px; min-height: (\d+)px;/.exec(css);
  const [minB, minH] = [Number(vindue[1]), Number(vindue[2])];
  const titel = regel('.titel', 'height');
  const baand = regel('.tab', 'height') + 1 + tok('space-2') + tok('space-1') + regel('.cb', 'height') + 2 + 14 + 1;
  const h3 = tok('space-3') + tok('space-2') + tok('h3-line');
  const vsTaet = regel('.skift.taet .vs', 'height');
  const skiftH = 1 + 2 * tok('space-1') + 8 * vsTaet + 7 * 1;
  const traeH = minH - titel - baand - h3 - skiftH;
  const tretr = 3 * regel('.tr', 'height') + 2 * 1 + tok('space-3');
  tjek(`K5: ved det mindste vindue (${minB} × ${minH}) er der plads til otte visninger og mindst tre punkter i træet (titel ${titel} + bånd ${baand} + overskrift ${h3} + skift ${skiftH}; træet får ${traeH} px, tre punkter kræver ${tretr})`,
    minB === 900 && minH === 560 && titel === 34 && baand === 116 && h3 === 40 && vsTaet === 30 && skiftH === 256 && traeH === 114 && traeH >= tretr, [titel, baand, h3, vsTaet, skiftH, traeH, tretr].join('/'));
  tjek('K5: seks visninger er stadig 38 px (uændret), og 30 px er over WCAG 2.5.8 (24 px)', regel('.vs', 'height') === 38 && vsTaet >= 24);
  const navB = Number(/\.nav \{[^}]*width: (\d+)px;/.exec(css)[1]);
  const tekstB = navB - 1 - 2 * tok('space-1') - 2 * tok('space-3') - 18 - tok('space-3') - tok('space-3') - Math.ceil(2 * 11 * 0.6);
  const tegn = Math.floor(tekstB / (13 * 0.62));
  tjek(`K5: navnet har ${tekstB} px i bredden, det er ${tegn} tegn à 0,62 em i 13 px; et længere navn afkortes med … (ingen ombrydning ud af punktet)`, tekstB === 143 && tegn === 17 && /\.skift\.taet \.vs > span \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/.test(css));
  tjek('K5: kontrol: de længste navne i Huginn and Muninns visningsskift kan stå uafkortet (Indstillinger, Since last time, Land lige nu)', ['Indstillinger', 'Since last time', 'Land lige nu', 'Besøgende', 'Technology'].every(n => n.length <= tegn));
  const md = pk('KOMPONENTER.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return md.slice(i, md.indexOf('\n## ', i + 1)); };
  const navpane = afsnitAf('NavPane');
  tjek('K5: KOMPONENTER.md: reglen er højst otte (ikke seks), ni giver en fejl, og anbefalingen (Indstillinger i titellinjen, opsætningsguide i Wizard) og det mindste vindue står der', /Højst otte visninger/.test(navpane) && !/Højst seks visninger/.test(navpane) && /Ni eller flere giver en fejl/.test(navpane) && /Indstillinger hører til i titellinjen/.test(navpane) && /opsætningsguide hører til i Wizard/.test(navpane) && /900 × 560 px/.test(navpane) && /17 tegn/.test(navpane) && /\(højst otte, altid samme rækkefølge\)/.test(kitJs));

  // ── K7: træet vælger ét punkt ──
  tjek('K7: reglen står under NavPane og under Vælger: træet vælger ét punkt, "et, flere eller alle" hører til i vælgeren', /Træet vælger ét punkt/.test(navpane) && /"Et, flere eller alle"/.test(navpane) && /hører til i en vælger med flere valg/.test(navpane) && /Det er ikke en valgliste i en formular/.test(afsnitAf('Vælger')) && /flere valg/.test(afsnitAf('Vælger')));
  tjek('K7: navTrae er uændret i koden (ingen afkrydsning, ét valgt punkt)', (() => {
    const ul = d.createElement('ul');
    const t = K.navTrae(ul, [{ id: 'a', tekst: 'A' }, { id: 'b', tekst: 'B' }]);
    t.vaelg('b');
    return ul.querySelectorAll('[aria-selected="true"]').length === 1 && !ul.querySelector('input,[role="checkbox"],[aria-checked]') && !ul.hasAttribute('aria-multiselectable');
  })());

  // ── K6: vælger ──
  const tast = (el, key, x = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }));
  const mus = (el, type) => el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true }));
  const aktivt = v => d.getElementById(v.liste.getAttribute('aria-activedescendant'));
  const navn = li => li.querySelector('.vlg-navn').textContent;
  const PUNKTER = [{ id: 'dk', tekst: 'Danmark', antal: 12 }, { id: 'se', tekst: 'Sverige' }, { id: 'no', tekst: 'Norge' }, { id: 'de', tekst: 'Tyskland' }, { id: 'fi', tekst: 'Finland' }];
  const kald = [];
  const v1 = K.vaelger({ etiket: 'Land', punkter: PUNKTER, valgt: 'se', vedValg: x => kald.push(x) });
  d.body.appendChild(v1.rod);
  tjek('K6: knappen har aria-haspopup="listbox", aria-expanded="false" og aria-controls til listen, og viser etiket og den aktuelle værdi', v1.knap.getAttribute('aria-haspopup') === 'listbox' && v1.knap.getAttribute('aria-expanded') === 'false' && v1.knap.getAttribute('aria-controls') === v1.liste.id && v1.knap.querySelector('.skjult-tekst').textContent === 'Land' && v1.knap.querySelector('.vlg-vaerdi').textContent === 'Sverige' && v1.knap.type === 'button');
  tjek('K6 (ét valg): listen er role="listbox" uden aria-multiselectable, navngivet af etiketten; punkterne er role="option" med aria-selected', v1.liste.getAttribute('role') === 'listbox' && !v1.liste.hasAttribute('aria-multiselectable') && v1.liste.getAttribute('aria-labelledby') === v1.knap.querySelector('.skjult-tekst').id && [...v1.liste.children].every(li => li.getAttribute('role') === 'option') && [...v1.liste.children].map(li => li.getAttribute('aria-selected')).join() === 'false,true,false,false,false' && v1.liste.querySelector('.ant').textContent === '12');
  tast(v1.knap, 'ArrowDown');
  tjek('K6: pil ned på knappen åbner; fokus går til listen, og det valgte punkt er aktivt (aria-activedescendant, .aktiv)', v1.aaben && v1.knap.getAttribute('aria-expanded') === 'true' && d.activeElement === v1.liste && navn(aktivt(v1)) === 'Sverige' && aktivt(v1).classList.contains('aktiv'));
  tast(v1.liste, 'ArrowDown'); tast(v1.liste, 'ArrowDown');
  const efterPile = navn(aktivt(v1));
  tast(v1.liste, 'End'); const efterEnd = navn(aktivt(v1));
  tast(v1.liste, 'Home'); const efterHome = navn(aktivt(v1));
  tast(v1.liste, 'ArrowUp'); const vedToppen = navn(aktivt(v1));
  tjek('K6: pilene flytter (og stopper ved enderne), Home og End går til første og sidste', efterPile === 'Tyskland' && efterEnd === 'Finland' && efterHome === 'Danmark' && vedToppen === 'Danmark' && kald.length === 0);
  tast(v1.liste, 't');
  const efterT = navn(aktivt(v1));
  tast(v1.liste, 'n');
  tjek('K6: et bogstav hopper til næste punkt, der begynder med det', efterT === 'Tyskland' && navn(aktivt(v1)) === 'Norge');
  tast(v1.liste, 'Enter');
  tjek('K6 (ét valg): Enter vælger, listen lukker, fokus går tilbage til knappen, og vedValg får id', !v1.aaben && v1.knap.getAttribute('aria-expanded') === 'false' && d.activeElement === v1.knap && v1.valgt === 'no' && JSON.stringify(kald) === '["no"]' && v1.knap.querySelector('.vlg-vaerdi').textContent === 'Norge');
  tast(v1.knap, 'ArrowDown'); tast(v1.liste, 'ArrowDown'); tast(v1.liste, 'Escape');
  tjek('K6: Esc lukker uden at vælge og giver fokus tilbage til knappen', !v1.aaben && d.activeElement === v1.knap && v1.valgt === 'no' && kald.length === 1);
  v1.knap.click();
  const aabnetMedKlik = v1.aaben;
  tast(v1.liste, ' ');
  tjek('K6: klik åbner, og mellemrum vælger ved ét valg (samme punkt igen: ingen vedValg)', aabnetMedKlik && !v1.aaben && kald.length === 1);
  v1.knap.click();
  v1.liste.children[0].click();
  tjek('K6: klik på et punkt vælger det', v1.valgt === 'dk' && !v1.aaben && JSON.stringify(kald) === '["no","dk"]');
  v1.knap.click(); mus(v1.knap, 'mousedown'); v1.knap.click();
  tjek('K6: klik på knappen lukker en åben liste (også hvor knappen ikke får fokus ved klik)', !v1.aaben);
  v1.knap.click();
  const ude = d.createElement('button'); d.body.appendChild(ude);
  mus(ude, 'mousedown');
  tjek('K6: et klik uden for lukker listen', !v1.aaben);
  v1.knap.click();
  v1.liste.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true, relatedTarget: ude }));
  tjek('K6: når fokus går uden for (Tab), lukker listen', !v1.aaben);
  v1.saetPunkter([{ id: 'x', tekst: 'Xland' }, { id: 'y', tekst: 'Yland' }], 'y');
  v1.saetValgt('x');
  tjek('K6: saetPunkter og saetValgt sætter værdier og valg udefra uden at kalde vedValg; et ukendt valg giver første punkt', v1.liste.children.length === 2 && v1.valgt === 'x' && v1.knap.querySelector('.vlg-vaerdi').textContent === 'Xland' && kald.length === 2 && (v1.saetValgt('findes-ikke'), v1.valgt === 'x'));
  // Tekster som nøgler: knappen arver punktets data-t, så sprogskift udfylder den.
  const vt = K.vaelger({ etiket: { t: 'eti' }, punkter: [{ id: 'a', t: 'pA' }], valgt: 'a' });
  tjek('K6: nøgler giver data-t på etiket, punkter og knappens værdi (kittet har ingen tekster)', vt.knap.querySelector('.skjult-tekst').getAttribute('data-t') === 'eti' && vt.liste.querySelector('.vlg-navn').getAttribute('data-t') === 'pA' && vt.knap.querySelector('.vlg-vaerdi').getAttribute('data-t') === 'pA');

  const kaldF = [];
  const v2 = K.vaelger({ etiket: 'Domæner', flere: true, alle: 'Alle domæner', nValgt: { t: 'nValgt' }, soeg: { ph: 'soegPh', aria: 'Søg i domænerne' }, ingen: 'Ingen passer',
    punkter: [{ id: 'a', tekst: 'eksempel.dk' }, { id: 'b', tekst: 'shop.eksempel.dk' }, { id: 'c', tekst: 'blog.eksempel.dk' }], valgt: ['a', 'b', 'c'], vedValg: x => kaldF.push(x) });
  d.body.appendChild(v2.rod);
  const alle = v2.liste.querySelector('.vlg-alle'), felt = v2.rod.querySelector('.vlg-soeg input');
  tjek('K6 (flere valg): aria-multiselectable, "Alle" øverst og valgt, afkrydsningsbokse, og knappen viser alle-teksten', v2.liste.getAttribute('aria-multiselectable') === 'true' && v2.liste.firstElementChild === alle && alle.getAttribute('aria-selected') === 'true' && v2.liste.querySelectorAll('.vlg-boks').length === 4 && v2.knap.querySelector('.vlg-vaerdi').textContent === 'Alle domæner');
  v2.knap.click();
  tjek('K6: med søgefelt går fokus til feltet ved åbning; feltet styrer listen (aria-controls, aria-activedescendant) og har programmets tekster', d.activeElement === felt && felt.getAttribute('aria-controls') === v2.liste.id && felt.getAttribute('aria-activedescendant') === aktivt(v2).id && felt.getAttribute('data-t-ph') === 'soegPh' && felt.getAttribute('aria-label') === 'Søg i domænerne' && felt.spellcheck === false);
  tast(felt, 'ArrowDown'); tast(felt, 'Enter');
  tjek('K6 (flere valg): Enter krydser af, listen bliver åben, vedValg får listen af id, og knappen viser "N valgt" (nøgle med data-v)', v2.aaben && JSON.stringify(kaldF.at(-1)) === '["a","c"]' && alle.getAttribute('aria-selected') === 'false' && v2.knap.querySelector('.vlg-vaerdi').getAttribute('data-t') === 'nValgt' && v2.knap.querySelector('.vlg-vaerdi').getAttribute('data-v') === '2');
  tast(felt, ' ');
  tjek('K6: mellemrum i søgefeltet skrives (krydser ikke af)', kaldF.length === 1);
  v2.liste.focus(); tast(v2.liste, ' ');
  tjek('K6 (flere valg): mellemrum i listen krydser af', JSON.stringify(kaldF.at(-1)) === '["a","b","c"]' && alle.getAttribute('aria-selected') === 'true' && v2.aaben);
  alle.click();
  tjek('K6 (flere valg): "Alle" fravælger alle, når alle er valgt, og vælger alle ellers', JSON.stringify(kaldF.at(-1)) === '[]' && (alle.click(), JSON.stringify(kaldF.at(-1)) === '["a","b","c"]'));
  v2.liste.children[2].click(); v2.liste.children[3].click();
  tjek('K6 (flere valg): ét valgt viser det ene navn', JSON.stringify(v2.valgt) === '["a"]' && v2.knap.querySelector('.vlg-vaerdi').textContent === 'eksempel.dk' && !v2.knap.querySelector('.vlg-vaerdi').hasAttribute('data-t'));
  felt.value = 'shop'; felt.dispatchEvent(new w.Event('input', { bubbles: true }));
  const synligeP = () => [...v2.liste.children].filter(li => !li.hidden).map(navn);
  const ingenP = v2.rod.querySelector('.vlg-ingen');
  tjek('K6: søgefeltet filtrerer, skjuler "Alle" under søgning og gør det første synlige punkt aktivt', JSON.stringify(synligeP()) === '["shop.eksempel.dk"]' && alle.hidden && navn(aktivt(v2)) === 'shop.eksempel.dk' && ingenP.hidden);
  felt.value = 'zzz'; felt.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('K6: når intet passer, vises programmets tekst for ingen, og intet er aktivt', synligeP().length === 0 && !ingenP.hidden && !v2.liste.hasAttribute('aria-activedescendant'));
  tast(felt, 'Escape');
  tjek('K6: Esc lukker også fra søgefeltet, og feltet er tomt næste gang', !v2.aaben && d.activeElement === v2.knap && (v2.knap.click(), felt.value === '' && synligeP().length === 4));
  v2.luk();
  // Placering: listen åbner opad og står ved knappens højre kant, når der ikke er plads; kun klasser (ingen inline-stil).
  const placer = (k, p, vb, vh) => {
    Object.defineProperty(w, 'innerWidth', { value: vb, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: vh, configurable: true });
    v1.knap.getBoundingClientRect = () => ({ left: k[0], top: k[1], right: k[0] + k[2], bottom: k[1] + 26, width: k[2], height: 26 });
    v1.rod.querySelector('.vlg-pop').getBoundingClientRect = () => ({ left: 0, top: 0, right: p[0], bottom: p[1], width: p[0], height: p[1] });
    v1.knap.click();
    const pop = v1.rod.querySelector('.vlg-pop'), ud = [pop.classList.contains('op'), pop.classList.contains('hoejre-kant'), pop.hasAttribute('style')];
    v1.luk();
    return ud.join();
  };
  tjek('K6: i titellinjen til højre (900 × 560): listen står under knappen og ved dens højre kant, så vinduets kant ikke klipper den', placer([800, 4, 90], [240, 220], 900, 560) === 'false,true,false');
  tjek('K6: til venstre øverst: under og ved knappens venstre kant', placer([20, 4, 120], [240, 220], 900, 560) === 'false,false,false');
  tjek('K6: nederst i vinduet: listen åbner opad', placer([20, 500, 120], [240, 220], 900, 560) === 'true,false,false');
  tjek('K6 (CSS): listen ligger over siden (absolute, z-index) under knappen, opad med .op, ved højre kant med .hoejre-kant, højst 360 px og et halvt vindue minus 48 px, og rulles', /\.vlg \{ position: relative;/.test(css) && /\.vlg-pop \{\s*position: absolute; top: calc\(100% \+ 4px\); left: 0; z-index: 20;[^}]*max-height: min\(360px, calc\(50vh - 48px\)\);/.test(css) && /\.vlg-pop\.op \{ top: auto; bottom: calc\(100% \+ 4px\); \}/.test(css) && /\.vlg-pop\.hoejre-kant \{ left: auto; right: 0; \}/.test(css) && /\.vlg-liste \{[^}]*min-height: 0; overflow: auto;/.test(css));
  tjek('K6 (CSS): titellinjen, værktøjslinjen og båndet klipper ikke listen (ingen overflow i .titel, .hoejre, .vl, .cmd, .grupper, .grp, .kn, .baand-el)', ['.titel', '.titel .hoejre', '.vl', '.cmd', '.grupper', '.grp', '.grp .kn', '.baand-el'].every(v => { const m = new RegExp('(?:^|\\n)' + v.replace(/\./g, '\\.') + ' \\{([^}]*)\\}').exec(css); return m && !/overflow/.test(m[1]); }));
  tjek('K6 (CSS): udseendet følger fladen: lys knap med kant (surface, border-strong) og mørk på titellinjen (rail, rail-text; hover rail-active, rail-strong)', /\.vlg-knap \{[^}]*border: 1px solid var\(--border-strong\);[^}]*background: var\(--surface\); color: var\(--text\);/.test(css) && /\.titel \.vlg-knap \{[^}]*border-color: var\(--rail-text\); background: var\(--rail\); color: var\(--rail-text\);/.test(css) && /\.titel \.vlg-knap:hover, \.titel \.vlg-knap\[aria-expanded="true"\] \{ background: var\(--rail-active\); color: var\(--rail-strong\); \}/.test(css));
  tjek('K6 (CSS): valgt er aldrig farve alene (flueben og fed skrift; afkrydset boks), og det aktive punkt har fokusringen i info', /\.vlg-p\[aria-selected="true"\] \{ font-weight: 600; \}/.test(css) && /\.vlg-p\[aria-selected="true"\] \.vlg-mark \{ visibility: visible; \}/.test(css) && /\.vlg-p\[aria-selected="true"\] \.vlg-boks \{ background: var\(--accent\); border-color: var\(--accent\); color: var\(--on-accent\); \}/.test(css) && /\.vlg-pop:focus-within \.vlg-p\.aktiv \{ outline: 2px solid var\(--info\);/.test(css));

  // ── K8: sidepanel ──
  const midte = d.createElement('div');
  midte.className = 'midte';
  midte.innerHTML = '<main class="arb"><button id="sp-aabner" aria-controls="sp-proeve" aria-expanded="false">?</button><button id="sp-andet">x</button></main><aside id="sp-proeve"></aside>';
  d.body.appendChild(midte);
  const spLuk = [];
  const aside = d.getElementById('sp-proeve'), aabner = d.getElementById('sp-aabner');
  const sp = K.sidepanel(aside, { tekst: 'Hjælp', lukAria: 'Luk hjælpen', indhold: d.createTextNode('Forklaring'), vedLuk: a => spLuk.push(a) });
  const h = aside.querySelector('.sp-top h2'), lukK = aside.querySelector('.sp-luk');
  tjek('K8: role="complementary" med navn fra overskriften, lukkeknap med navn, indhold, og lukket fra start', aside.getAttribute('role') === 'complementary' && aside.getAttribute('aria-labelledby') === h.id && h.textContent === 'Hjælp' && lukK.getAttribute('aria-label') === 'Luk hjælpen' && lukK.type === 'button' && sp.indhold.textContent === 'Forklaring' && aside.hidden && !sp.aaben && !aside.hasAttribute('aria-modal'));
  const bredde = b => Object.defineProperty(w, 'innerWidth', { value: b, configurable: true });
  bredde(1400); aabner.focus(); sp.aabn();
  tjek('K8: åbnes ved bredt vindue (1400 px): skubber (ingen .over), fokus på overskriften, aria-expanded="true" på knappen, der styrer det', sp.aaben && !sp.overlagt && !aside.classList.contains('over') && d.activeElement === h && aabner.getAttribute('aria-expanded') === 'true');
  bredde(1000); w.dispatchEvent(new w.Event('resize'));
  tjek('K8: under grænsen (1000 < 1200 px) lægger det sig over (.over), også når vinduet ændres, mens det er åbent', sp.overlagt && aside.classList.contains('over'));
  bredde(1200); w.dispatchEvent(new w.Event('resize'));
  tjek('K8: grænsen er 1200 px: ved præcis 1200 skubber det', !sp.overlagt);
  tast(h, 'Escape');
  tjek('K8: Esc i panelet lukker; fokus går tilbage til det, der åbnede; vedLuk("esc"); aria-expanded="false"', !sp.aaben && aside.hidden && d.activeElement === aabner && spLuk.join() === 'esc' && aabner.getAttribute('aria-expanded') === 'false');
  aabner.focus(); sp.aabn(); lukK.focus(); lukK.click();
  tjek('K8: lukkeknappen lukker, og fokus går tilbage (vedLuk("knap"))', !sp.aaben && d.activeElement === aabner && spLuk.at(-1) === 'knap');
  bredde(1400); sp.aabn(); d.getElementById('sp-andet').focus();
  tast(d.getElementById('sp-andet'), 'Escape');
  tjek('K8: ikke modalt: når panelet skubber, kan resten bruges, og Esc uden for panelet lukker det ikke', sp.aaben && d.activeElement === d.getElementById('sp-andet'));
  sp.luk();
  tjek('K8: luk() fra koden flytter ikke fokus, når fokus ikke var i panelet (vedLuk("kode"))', !sp.aaben && d.activeElement === d.getElementById('sp-andet') && spLuk.at(-1) === 'kode');
  bredde(1000); sp.aabn(); d.getElementById('sp-andet').focus();
  tjek('K8: når panelet ligger over, fanges fokus ikke (fokus kan gå uden for)', sp.aaben && sp.overlagt && d.activeElement === d.getElementById('sp-andet'));
  tast(d.getElementById('sp-andet'), 'Escape');
  tjek('K8: når panelet ligger over, lukker Esc også uden for panelet', !sp.aaben && spLuk.at(-1) === 'esc');
  const aside2 = d.createElement('aside'); midte.appendChild(aside2);
  const sp2 = K.sidepanel(aside2, { tekst: 'Detaljer', lukAria: 'Luk', overlaeg: true });
  bredde(1600); sp2.aabn();
  tjek('K8: overlaeg: true lægger altid over (også ved 1600 px); id gives, hvis elementet ikke har et', sp2.overlagt && /^kit-sp\d+$/.test(aside2.id) && (sp2.skift(), !sp2.aaben));
  tjek('K8 (CSS): 320 px i rækken (skubber); .over ligger over med skygge; .midte bliver positioneret kun med et sidepanel (Grimnirs .midte er uændret); indholdet ruller', /\.sidepanel \{[^}]*width: 320px;[^}]*flex: none;/.test(css) && /\.sidepanel\.over \{ position: absolute; top: 0; right: 0; bottom: 0; z-index: 10; box-shadow: var\(--shadow-pop\); \}/.test(css) && /\.midte:has\(> \.sidepanel\) \{ position: relative; \}/.test(css) && /(?:^|\n)\.midte \{ display: flex; flex: 1; min-height: 0; \}/.test(css) && /\.sp-indhold \{[^}]*min-height: 0; overflow: auto;/.test(css));
  tjek('K8: grænsen 1200 px står i koden og i KOMPONENTER.md', /const SP_GRAENSE = 1200;/.test(kitJs) && /smallere end \*\*1200 px\*\*/.test(afsnitAf('Sidepanel')));

  // ── K9: bånd uden faner og segmentknap ──
  const seg = K.segment({ aria: 'Periode', valg: [{ id: '7', tekst: '7 dage' }, { id: '30', tekst: '30 dage' }, { id: 'aar', tekst: 'År' }], valgt: '30', vedValg: x => kald.push('seg:' + x) });
  const vb = K.vaelger({ etiket: 'Domæne', punkter: [{ id: 'a', tekst: 'eksempel.dk' }] });
  const enkelt = d.createElement('div');
  const be = K.commandBar(enkelt, { ariaT: 'cmdAria', udenFaner: true, faner: [{ id: 'start', t: 'faneStart', grupper: [
    { t: 'gData', knapper: [{ id: 'opdater', t: 'kOpdater', ikon: 'afspil', pri: true }] },
    { t: 'gPeriode', knapper: [{ id: 'periode', element: seg.rod }] },
    { t: 'gDomaene', knapper: [{ id: 'domaene', element: vb.rod }] },
  ] }] });
  tjek('K9: udenFaner: ingen fanerække, ingen tab/tabpanel; båndet er en navngiven gruppe (.cmd.enkel, role="group", data-t-aria)', enkelt.className === 'cmd enkel' && !enkelt.querySelector('.tabs,[role="tab"],[role="tablist"],[role="tabpanel"]') && enkelt.getAttribute('role') === 'group' && enkelt.getAttribute('data-t-aria') === 'cmdAria' && enkelt.querySelectorAll('.grupper').length === 1);
  tjek('K9: grupper og gruppenavne som i dag; en vælger og en segmentknap står i båndet (.baand-el), og knap(id) giver elementet', enkelt.querySelectorAll('.grp[role="group"] .cap').length === 3 && enkelt.querySelector('.cb.pri') && enkelt.querySelectorAll('.baand-el').length === 2 && be.knap('periode') === seg.rod && be.knap('domaene') === vb.rod && seg.rod.parentElement.className === 'baand-el');
  let fejlTo = '';
  try { K.commandBar(d.createElement('div'), { udenFaner: true, faner: [{ id: 'a', t: 'a', grupper: [] }, { id: 'b', t: 'b', grupper: [] }] }); } catch (e) { fejlTo = String(e.message); }
  tjek('K9: udenFaner med to faner giver en fejl', /udenFaner kræver præcis én fane \(fik 2\)/.test(fejlTo), fejlTo);
  const enFane = d.createElement('div');
  K.commandBar(enFane, { faner: [{ id: 'a', t: 'a', grupper: [] }] });
  tjek('K9: et bånd med én fane uden indstillingen har stadig fanerækken (som i 2.0.0)', enFane.querySelector('.tabs [role="tab"]') && !enFane.classList.contains('enkel'));
  tjek('K9: segmentknappen er role="radiogroup" med navn og role="radio" med aria-checked; kun den valgte kan nås med Tab', seg.rod.getAttribute('role') === 'radiogroup' && seg.rod.getAttribute('aria-label') === 'Periode' && seg.knapper.every(b => b.getAttribute('role') === 'radio' && b.type === 'button') && seg.knapper.map(b => b.getAttribute('aria-checked') + b.tabIndex).join() === 'false-1,true0,false-1' && seg.valgt === '30');
  d.body.appendChild(enkelt);
  seg.knapper[1].focus(); tast(seg.knapper[1], 'ArrowRight');
  tjek('K9: pil højre flytter og vælger; fokus følger; vedValg får id', seg.valgt === 'aar' && d.activeElement === seg.knapper[2] && kald.at(-1) === 'seg:aar' && seg.knapper[2].tabIndex === 0 && seg.knapper[1].tabIndex === -1);
  tast(seg.knapper[2], 'ArrowRight');
  const rundt = seg.valgt;
  tast(seg.knapper[0], 'ArrowUp');
  tjek('K9: pilene går rundt (højre fra sidste til første, op fra første til sidste)', rundt === '7' && seg.valgt === 'aar');
  tast(seg.knapper[2], 'Home'); const home = seg.valgt; tast(seg.knapper[0], 'End');
  tjek('K9: Home og End vælger første og sidste', home === '7' && seg.valgt === 'aar');
  seg.knapper[1].click();
  const n = kald.length;
  seg.knapper[1].click(); seg.vaelg('7');
  tjek('K9: klik vælger; samme valg igen kalder ikke vedValg; vaelg(id) udefra kalder den ikke', kald[n - 1] === 'seg:30' && kald.length === n && seg.valgt === '7' && seg.knapper[0].getAttribute('aria-checked') === 'true');
  const forMange = [1, 6].map(antal => { try { K.segment({ valg: Array.from({ length: antal }, (_, i) => ({ id: String(i), tekst: String(i) })) }); return ''; } catch (e) { return String(e.message); } });
  tjek('K9: færre end to eller flere end fem valg giver en fejl', forMange.every(f => /to til fem valg/.test(f)), forMange.join(' | '));
  tjek('K9 (CSS): valgt har flade, fed skrift og streg (ikke farve alene); fokusring i info; et bånd uden faner har luft foroven og forneden', /\.seg-v\[aria-checked="true"\] \{ background: var\(--accent-soft\); font-weight: 600; box-shadow: inset 0 -2px 0 var\(--accent\); \}/.test(css) && /\.seg-v:focus-visible \{ outline: 2px solid var\(--info\);/.test(css) && /\.cmd\.enkel \.grupper \{ padding: var\(--space-2\) var\(--space-3\); \}/.test(css) && /\.baand-el \{[^}]*height: 54px;/.test(css));
  const cb = afsnitAf('CommandBar');
  tjek('K9: KOMPONENTER.md (CommandBar): reglen for et bånd med få kommandoer, valget af indstilling frem for automatik med begrundelse, og element i en gruppe', /### Bånd til programmer med få kommandoer/.test(cb) && /udenFaner: true/.test(cb) && /Valgt som indstilling/.test(cb) && /præcis som i 2\.0\.0, også med én fane/.test(cb) && /\{ id, element \}/.test(cb));
  w.close(); w2.close();

  // ── Dokumenterne ──
  const DELE = ['**Klasser:**', '**Funktioner:**', '**Formål:**', '**Markup:**', '**Tilstande:**', '**Tastatur:**', '**Kræver af programmet:**'];
  const mangler = ['Vælger', 'Sidepanel', 'Segmentknap'].flatMap(nv => DELE.filter(x => !afsnitAf(nv).includes(x)).map(x => nv + ': ' + x));
  tjek('KOMPONENTER.md: Vælger, Sidepanel og Segmentknap har alle syv dele', mangler.length === 0, mangler.join(', '));
  tjek('KOMPONENTER.md: Vælger nævner tastaturet og ARIA, som prompten kræver', ['Enter', 'mellemrum', 'pil ned', 'Esc', 'et bogstav', 'aria-haspopup="listbox"', 'aria-expanded', 'role="listbox"', 'role="option"', 'aria-multiselectable', 'aria-selected'].every(o => afsnitAf('Vælger').includes(o)));
  const findes = md.slice(md.indexOf('## Findes ikke endnu'));
  tjek('KOMPONENTER.md: "Findes ikke endnu" er rettet (vælgeren og segmentknappen nævnt ved menu og valgliste)', /Vælgeren \(2\.2\.0\)/.test(findes) && /segmentknappen \(2\.2\.0\)/.test(findes));
  const log = pk('CHANGELOG.md');
  const post = log.slice(log.indexOf('## 2.2.0'), log.indexOf('\n## ', log.indexOf('## 2.2.0') + 1));
  tjek('CHANGELOG 2.2.0: første post, kun dato, nævner K5–K9, de nye funktioner, og at intet er omdøbt eller fjernet', log.indexOf('## 2.2.0 — 2026-11-11') > 0 && log.indexOf('## 2.2.0') < log.indexOf('## 2.1.0') && ['(K5)', '(K6)', '(K7)', '(K8)', '(K9)', 'Kit.vaelger', 'Kit.sidepanel', 'Kit.segment', 'udenFaner', 'Intet er omdøbt eller fjernet'].every(o => post.includes(o)));
  const readme = pk('README.md');
  tjek('README: indholdslisten og "Hvad pakken ikke indeholder" passer med 2.2.0', /Kit\.vaelger`, `Kit\.sidepanel` og `Kit\.segment` fra 2\.2\.0/.test(readme) && /Vælgeren, sidepanelet og segmentknappen findes fra 2\.2\.0/.test(readme) && /\*\*Flervalg i træet\.\*\*/.test(readme));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K5–K9 står som opfyldt i 2.2.0 med hvad de afløser, og hjælpeskuffen og vælgerne står ikke længere som umulige at flytte', ['K5', 'K6', 'K7', 'K8', 'K9'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.2\\.0 \\|[^\\n]*Afløser').test(hm)) && !/\| Hjælpeskuffen, dialoger/.test(hm) && !/højst seks visninger/.test(hm) && /Kit\.vaelger/.test(hm) && /Kit\.sidepanel/.test(hm));
}
{
  // Demoen 2.2.0 med pakkens rigtige filer: sektionerne, båndet med én fane og de otte visninger, i begge sprog.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const sektion = n => d.querySelector(`#v-komponenter .demo-sektion[data-navn="${n}"]`);
  tjek('demo 2.2.0: en sektion for Vælger, Sidepanel og Segmentknap, med overskrift og tekst', ['Vælger', 'Sidepanel', 'Segmentknap'].every(n => sektion(n) && sektion(n).querySelector('h2').textContent && sektion(n).querySelector('p').textContent.startsWith('Fra 2.2.0')));
  tjek('demo 2.2.0: et bånd med én fane, en vælger og en segmentknap (og ingen fanerække)', Boolean(d.querySelector('#demo-baand-enkel.cmd.enkel .baand-el .vlg') && d.querySelector('#demo-baand-enkel .baand-el .seg')) && !d.querySelector('#demo-baand-enkel .tabs'));
  tjek('demo 2.2.0: visningsskift med otte punkter (taet)', d.querySelectorAll('#demo-skift-otte.taet .vs').length === 8);
  tjek('demo 2.2.0: en vælger i titellinjen (ét valg) og en i værktøjslinjen (flere valg med søgefelt)', Boolean(d.querySelector('#demo-vaelger-titel .hoejre .vlg .vlg-knap') && d.querySelector('#demo-vaelger-vl .vlg [aria-multiselectable="true"]') && d.querySelector('#demo-vaelger-vl .vlg-soeg input')));
  const knapLand = d.querySelector('#demo-vaelger-titel .vlg-knap');
  knapLand.click();
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  tjek('demo 2.2.0: vælgeren vælger og melder valget (dansk)', d.getElementById('vaelger-valgt').textContent === 'Valgt: Sverige' && knapLand.querySelector('.vlg-vaerdi').textContent === 'Sverige');
  d.getElementById('demo-sp-aabn').focus();
  d.getElementById('demo-sp-aabn').click();
  tjek('demo 2.2.0: sidepanelet åbner, får fokus og navn, og knappen får aria-expanded', !d.getElementById('demo-sidepanel').hidden && d.activeElement === d.querySelector('#demo-sidepanel h2') && d.querySelector('#demo-sidepanel h2').textContent === 'Hjælp' && d.getElementById('demo-sp-aabn').getAttribute('aria-expanded') === 'true');
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  tjek('demo 2.2.0: Esc lukker sidepanelet og fokus går tilbage', d.getElementById('demo-sidepanel').hidden && d.activeElement === d.getElementById('demo-sp-aabn') && d.getElementById('sp-valgt').textContent === 'Panelet blev lukket (esc).');
  d.querySelector('#demo-segment .seg-v[aria-checked="false"]').click();
  tjek('demo 2.2.0: segmentknappen vælger og melder valget', /^Valgt: (30 dage|År)$/.test(d.getElementById('segment-valgt').textContent));
  w.Sprog.saet('en');
  const tomme = [...d.querySelectorAll('#demo-baand-enkel [data-t], #v-komponenter [data-navn="Vælger"] [data-t], #v-komponenter [data-navn="Sidepanel"] [data-t], #v-komponenter [data-navn="Segmentknap"] [data-t], #demo-skift-otte [data-t]')].filter(e => !e.textContent.trim()).map(e => e.getAttribute('data-t'));
  tjek('demo 2.2.0 (English): de nye dele har tekst, og vælgerens knap følger sproget', tomme.length === 0 && knapLand.querySelector('.vlg-vaerdi').textContent === 'Sweden' && d.querySelector('#demo-sidepanel h2').textContent === 'Help' && d.querySelector('#demo-segment .seg-v').textContent === '7 days', tomme.join(', '));
  w.Tema.saet('moerk');
  tjek('demo 2.2.0: mørkt tema sættes på siden med de nye komponenter (kun tokens i kit.css, se farvetjekket)', d.documentElement.getAttribute('data-tema') === 'moerk');
  w.close();
}

// ── Pakke 2.3.0 (K10–K17): komponenterne. Filterchip, kasse, statusflise, tom tilstand, fremdrift, værktøjstip,
// afkrydsning, kontakt, radiogruppe, valgliste, dialog, tabellens nye indstillinger og tekststørrelsen. ──
{
  const css = pk('web/kit.css'), kitJs = pk('web/kit.js'), md = pk('KOMPONENTER.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return i < 0 ? '' : md.slice(i, md.indexOf('\n## ', i + 1)); };
  const DELE = ['**Klasser:**', '**Funktioner:**', '**Formål:**', '**Markup:**', '**Tilstande:**', '**Tastatur:**', '**Kræver af programmet:**'];
  const harDele = (navn, dele = DELE) => { const a = afsnitAf(navn); return a.length > 0 && dele.every(x => a.includes(x)); };
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const w = ny(), d = w.document, K = w.Kit;
  const tast = (el, key, x = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }));
  const TIP_VENT_MS = Number(/const TIP_VENT = (\d+), TIP_SLIP = (\d+)/.exec(kitJs)[1]);
  const fn = Object.keys(K).map(k => 'Kit.' + k);
  tjek('2.3.0: hvert nyt navn i V230_FUNKTIONER findes i Kit', V230_FUNKTIONER.every(f => fn.includes(f)), V230_FUNKTIONER.filter(f => !fn.includes(f)).join(', '));
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  tjek('2.3.0: hver ny klasse i V230_KLASSER findes i kit.css', V230_KLASSER.every(k => cssKlasser.has(k)), V230_KLASSER.filter(k => !cssKlasser.has(k)).join(', '));
  // Kittet bruger ikke de klassenavne, programmerne allerede har til noget andet (Grimnirs app.css og HAM's app.css og vagt.css).
  const OPTAGET = ['kort', 'flise', 'fliser', 'tom', 'dlg', 'dlg-knapper', 'afkryds', 'valg', 'panel', 'kontakt', 'boks', 'sort', 'sider', 'dialog', 'tal', 'etik', 'pille', 'arbejder'];
  tjek('2.3.0: kittet bruger ingen af de klassenavne, Grimnir og Huginn and Muninn har til noget andet (.kort, .tom, .dlg, .flise, .kontakt …)', OPTAGET.every(k => !cssKlasser.has(k)), OPTAGET.filter(k => cssKlasser.has(k)).join(', '));

  // Reglen: kittet sætter aldrig inline-stil, så det virker under style-src 'self'. Over alle tekstfiler i web/.
  const INLINE = /\.style\.|\bstyle\s*=\s*["'`]|setAttribute\(\s*['"`]style['"`]|\.cssText|setProperty\(/;
  const webFiler = (function alle(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? alle(path.join(dir, e.name)) : [path.join(dir, e.name)]); })(path.join(PAKKE, 'web')).filter(f => /\.(js|css|html|txt)$/.test(f));
  const medInline = webFiler.filter(f => INLINE.test(fs.readFileSync(f, 'utf8')));
  tjek(`2.3.0: ingen fil i web/ sætter inline-stil (.style., style="", setAttribute('style'), cssText; ${webFiler.length} filer)`, webFiler.length >= 6 && medInline.length === 0, medInline.map(f => path.relative(PAKKE, f)).join(', '));
  tjek('kontrol: inline-mønsteret fanger .style.color, style="x", setAttribute(\'style\', …) og .cssText, men ikke klassen .stylet', ["e.style.color = 'x'", '<i style="x">', "e.setAttribute('style', 'x')", 'e.style.cssText = s', "e.style.setProperty('--a', 1)"].every(s => INLINE.test(s)) && !INLINE.test("e.classList.add('stylet'); el('span', 'stilart')"));
  tjek('2.3.0: reglen om inline-stil står i README', /\*\*Kittet sætter aldrig inline-stil\*\*/.test(pk('README.md')) && /style-src 'self'/.test(pk('README.md')));

  // ── K16: filterchip ──
  const skift = [];
  const fc = K.filterchip({ id: 'nye', tekst: 'Nye', antal: 4, vedSkift: (til, id) => skift.push(til + ':' + id) });
  d.body.appendChild(fc);
  tjek('K16: filterchip er en knap (type="button") med aria-pressed="false", flueben (aria-hidden), ord og antal', fc.tagName === 'BUTTON' && fc.type === 'button' && fc.className === 'fchip' && fc.getAttribute('aria-pressed') === 'false' && fc.querySelector('.fchip-mark').getAttribute('aria-hidden') === 'true' && fc.querySelector('.fchip-mark').textContent === '✓' && fc.children[1].textContent === 'Nye' && fc.querySelector('.ant').textContent === '4' && fc.dataset.chip === 'nye');
  fc.click();
  const efterEt = fc.getAttribute('aria-pressed');
  fc.click();
  tjek('K16: klik slår til og fra (aria-pressed) og melder til/fra og id', efterEt === 'true' && fc.getAttribute('aria-pressed') === 'false' && skift.join() === 'true:nye,false:nye');
  tjek('K16: deaktiveret er disabled; nøgle giver data-t', K.filterchip({ t: 'cNoegle', deaktiveret: true }).disabled && K.filterchip({ t: 'cNoegle' }).children[1].getAttribute('data-t') === 'cNoegle');
  const fv = [];
  const fg = K.filterchips({ aria: 'Vis', chips: [{ id: 'a', tekst: 'Fejl', antal: 3 }, { id: 'b', tekst: 'Advarsler' }, { id: 'c', tekst: 'Oplysninger' }], valgt: ['a'], vedValg: ids => fv.push(ids.join('+')) });
  d.body.appendChild(fg.rod);
  tjek('K16: filterchips er en navngiven gruppe (role="group", aria-label) med én knap pr. chip; valgt fra start', fg.rod.className === 'fchips' && fg.rod.getAttribute('role') === 'group' && fg.rod.getAttribute('aria-label') === 'Vis' && fg.chips.length === 3 && fg.chips.map(b => b.getAttribute('aria-pressed')).join() === 'true,false,false' && JSON.stringify(fg.valgt) === '["a"]');
  fg.chips[2].click(); fg.chips[0].click();
  tjek('K16: hver chip slås til og fra for sig; vedValg får listen af de valgte ved hvert klik (også ingen)', fv.join() === 'a+c,c' && (fg.chips[2].click(), fv.at(-1) === '' && JSON.stringify(fg.valgt) === '[]'));
  fg.saetValgt(['b', 'c']);
  tjek('K16: saetValgt sætter valget udefra uden at kalde vedValg', JSON.stringify(fg.valgt) === '["b","c"]' && fv.length === 3);
  tjek('K16: ariaT giver data-t-aria på gruppen', K.filterchips({ ariaT: 'filterAria', chips: [] }).rod.getAttribute('data-t-aria') === 'filterAria');
  tjek('K16: den almindelige chip er uændret og kan ikke klikkes (samme markup som 2.0.0, ingen knap, tabindex eller rolle)', K.chip('ok', 'Maskeres').outerHTML === '<span class="chip ok"><span aria-hidden="true">✓</span><span class="ord">Maskeres</span></span>' && /(?:^|\n)\.chip \{\n  display: inline-flex; align-items: center; gap: var\(--space-1\);\n  height: 22px; padding: 0 9px; border-radius: var\(--radius-pill\);\n  font-size: var\(--small-size\); font-weight: 600; white-space: nowrap;\n\}/.test(css) && !/\.chip[^{]*\{[^}]*cursor/.test(css));
  tjek('K16 (CSS): valgt er ikke farve alene (flade, kant i accent, fed skrift og flueben); 28 px høj; deaktiveret nedtonet', /\.fchip\[aria-pressed="true"\] \{ background: var\(--accent-soft\); border-color: var\(--accent\); font-weight: 600; \}/.test(css) && /\.fchip\[aria-pressed="true"\] \.fchip-mark \{ display: inline; \}/.test(css) && /\.fchip-mark \{ display: none;/.test(css) && /\.fchip \{[^}]*height: 28px;[^}]*border: 1px solid var\(--border-strong\);/.test(css) && /\.fchip\[disabled\] \{ opacity: \.55;/.test(css));
  // ── K13: kasse (kittets kort) ──
  const knapH = K.knap({ tekst: 'Vis alle', variant: 'ghost' });
  const k1 = K.kasse({ tekst: 'Seneste sager', handling: knapH, indhold: d.createTextNode('Indhold'), fod: d.createTextNode('Fod') });
  tjek('K13: <section class="kasse"> med navn fra overskriften (aria-labelledby → h2 med id), hoved, indhold og fodlinje', k1.rod.tagName === 'SECTION' && k1.rod.className === 'kasse' && k1.rod.getAttribute('aria-labelledby') === k1.overskrift.id && k1.overskrift.tagName === 'H2' && k1.overskrift.textContent === 'Seneste sager' && /^kit-kasse\d+-h$/.test(k1.overskrift.id) && k1.rod.children.length === 3 && k1.rod.children[0].className === 'kasse-top' && k1.indhold.className === 'kasse-indhold' && k1.indhold.textContent === 'Indhold' && k1.fod.className === 'kasse-fod' && k1.fod.textContent === 'Fod');
  tjek('K13: handlingen står i hovedet efter overskriften (.kasse-handling)', knapH.parentElement.className === 'kasse-handling' && knapH.parentElement.parentElement === k1.rod.children[0] && k1.rod.children[0].firstElementChild === k1.overskrift);
  const k2 = K.kasse({ t: 'kNoegle', id: 'mit-kort', niveau: 3, fyld: true });
  tjek('K13: uden handling og fodlinje er der kun hoved og indhold; niveau 3 giver h3; id og nøgle; fyld giver .fyld', k2.rod.children.length === 2 && k2.fod === null && !k2.rod.querySelector('.kasse-handling') && k2.overskrift.tagName === 'H3' && k2.rod.id === 'mit-kort' && k2.overskrift.id === 'mit-kort-h' && k2.overskrift.getAttribute('data-t') === 'kNoegle' && k2.indhold.className === 'kasse-indhold fyld' && K.kasse({ tekst: 'x', niveau: 7 }).overskrift.tagName === 'H2');
  tjek('K13 (CSS): klassen er ikke .kort; flade med kant og radius, hoved og fod på surface-raised; ingen overflow (en vælger i hovedet klippes ikke); overskriften i h3-størrelse', !/\.kort\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && /\.kasse \{[^}]*background: var\(--surface\); border: 1px solid var\(--border\); border-radius: var\(--radius-md\);[^}]*\}/.test(css) && !/\.kasse[^{]*\{[^}]*overflow/.test(css) && /\.kasse-top \{[^}]*background: var\(--surface-raised\);/.test(css) && /\.kasse-top > h2, \.kasse-top > h3, \.kasse-top > h4 \{[^}]*font-size: var\(--h3-size\);/.test(css) && /\.kasse-indhold\.fyld \{ padding: 0; \}/.test(css));
  tjek('KOMPONENTER.md: Kasse har alle syv dele og skriver valget af navn (.kasse, ikke .kort)', harDele('Kasse') && /ikke `\.kort`/.test(afsnitAf('Kasse')) && /navneskik/.test(afsnitAf('Kasse')));
  // ── K12: StatusTile ──
  const flKald = [];
  const fl = K.statusflise({ tekst: 'Venter på dig', tal: 2, status: { variant: 'warn', tekst: 'Tjek selv' }, udvikling: { retning: 'op', tekst: '1 mere end i går' }, ved: () => flKald.push('ja') });
  d.body.appendChild(fl);
  tjek('K12: med ved er hele flisen en knap (type="button") med etiket, tal, statuschip og udvikling i den rækkefølge; streg efter status (.warn)', fl.tagName === 'BUTTON' && fl.type === 'button' && fl.className === 'sflise warn' && [...fl.children].map(c => c.className).join() === 'sflise-navn,sflise-tal,chip warn,sflise-under' && fl.querySelector('.sflise-tal').textContent === '2' && fl.querySelector('.chip .ord').textContent === 'Tjek selv' && fl.querySelector('.chip [aria-hidden="true"]').textContent === '!');
  tjek('K12: udviklingen er en pil (aria-hidden) og en tekst; knappens indhold er etiket, tal, status og udvikling', fl.querySelector('.sflise-pil').textContent === '↑' && fl.querySelector('.sflise-pil').getAttribute('aria-hidden') === 'true' && fl.querySelector('.sflise-under').textContent === '↑1 mere end i går' && fl.textContent.replace(/[!↑]/g, '') === 'Venter på dig2Tjek selv1 mere end i går');
  fl.click();
  tjek('K12: klik på flisen kalder ved', flKald.join() === 'ja');
  const flA = K.statusflise({ t: 'flNoegle', tal: 13, status: { variant: 'ok', t: 'stKlar' }, href: '#maskeres' });
  const flD = K.statusflise({ tekst: 'Rester', tal: null, under: 'efter maskering' });
  tjek('K12: med href er flisen et link; uden ved og href en div (ikke klikbar; intet tal giver –); undertekst; nøgler giver data-t', flA.tagName === 'A' && flA.getAttribute('href') === '#maskeres' && flA.querySelector('.sflise-navn').getAttribute('data-t') === 'flNoegle' && flA.querySelector('.chip .ord').getAttribute('data-t') === 'stKlar' && flD.tagName === 'DIV' && flD.className === 'sflise' && !flD.querySelector('.chip') && flD.querySelector('.sflise-tal').textContent === '–' && flD.querySelector('.sflise-under').textContent === 'efter maskering' && !flD.hasAttribute('tabindex'));
  const fejlFl = [() => K.statusflise({ tekst: 'x', tal: 1, status: { variant: 'groen', tekst: 'x' } }), () => K.statusflise({ tekst: 'x', tal: 1, udvikling: { retning: 'skraat', tekst: 'x' } })].map(f => { try { f(); return ''; } catch (e) { return e.message; } });
  tjek('K12: en ukendt status eller udvikling giver en fejl', /ukendt status: groen/.test(fejlFl[0]) && /ukendt udvikling: skraat/.test(fejlFl[1]), fejlFl.join(' | '));
  const raekke = K.statusfliser({ aria: 'Status', fliser: [{ tekst: 'A', tal: 1, ved: () => {} }, flD] });
  tjek('K12: en række er <ul role="list"> med navn og én <li> pr. flise (også en færdig flise)', raekke.tagName === 'UL' && raekke.className === 'sfliser' && raekke.getAttribute('role') === 'list' && raekke.getAttribute('aria-label') === 'Status' && raekke.children.length === 2 && [...raekke.children].every(li => li.tagName === 'LI' && li.children.length === 1) && raekke.children[1].firstChild === flD);
  tjek('K12 (CSS): stregen har statussens mærkefarve (fem varianter), kun knap og link har hover og markør, rækken ombrydes (grid, auto-fill), tallet i h1-størrelse', ['ok', 'warn', 'danger', 'info', 'none'].every(v => new RegExp('\\.sflise\\.' + v + ' \\{ border-left-color: var\\(--' + v + '-mark\\); \\}').test(css)) && /button\.sflise, a\.sflise \{ cursor: pointer; \}/.test(css) && /button\.sflise:hover, a\.sflise:hover \{/.test(css) && !/(?:^|\n)\.sflise:hover/.test(css) && /\.sfliser \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(176px, 1fr\)\);/.test(css) && /\.sflise-tal \{ font-size: var\(--h1-size\);/.test(css) && /\.sflise \{[^}]*border-left: 4px solid var\(--border\);/.test(css));
  tjek('KOMPONENTER.md: StatusTile har alle syv dele og reglen "En flise findes kun, når brugeren handler på tallet"', harDele('StatusTile') && /En flise findes kun, når brugeren handler på tallet/.test(afsnitAf('StatusTile')) && /role="list"/.test(afsnitAf('StatusTile')));
  // ── K14: tom tilstand ──
  const tomKald = [];
  const tomS = K.tomTilstand({ ikon: 'mappe', tekst: 'Ingen sager endnu', p: 'Indsæt en tekst.', handling: { tekst: 'Ny sag', variant: 'primary', ved: () => tomKald.push('ny') } });
  tjek('K14 (tom): ikon (aria-hidden), overskrift (h2), én sætning og én handling (knap) i den rækkefølge; ingen role', tomS.className === 'tomt' && [...tomS.children].map(c => c.tagName.toLowerCase() + '.' + (c.getAttribute('class') || '')).join() === 'svg.tomt-ikon,h2.tomt-h,p.tomt-p,button.btn primary' && tomS.querySelector('svg').getAttribute('aria-hidden') === 'true' && tomS.querySelector('h2').textContent === 'Ingen sager endnu' && !tomS.hasAttribute('role') && (tomS.querySelector('button').click(), tomKald.join() === 'ny'));
  const tomL = K.tomTilstand({ lille: true, t: 'ingenTraef', p: { t: 'ingenTraefP' } });
  tjek('K14 (tom): den lille udgave har role="status", overskriften er et afsnit, og ikon og handling er valgfri; niveau 3 giver h3', tomL.className === 'tomt lille' && tomL.getAttribute('role') === 'status' && [...tomL.children].map(c => c.tagName + '.' + c.className).join() === 'P.tomt-h,P.tomt-p' && tomL.firstChild.getAttribute('data-t') === 'ingenTraef' && tomL.lastChild.getAttribute('data-t') === 'ingenTraefP' && K.tomTilstand({ tekst: 'x', niveau: 3 }).querySelector('.tomt-h').tagName === 'H3');
  tjek('K14 (tom, CSS): midt på fladen, højst 520 px, ikon 40 px (24 px i den lille), samme mål som Grimnirs .tom (V-KITBRUG.1: Grimnir bruger nu kittets; ingen .tom i app.css)', /\.tomt \{ display: flex; flex-direction: column; align-items: center; gap: var\(--space-2\); max-width: 520px; margin: 0 auto; padding: var\(--space-8\) var\(--space-6\); text-align: center; \}/.test(css) && /\.tomt-ikon \{ width: 40px; height: 40px;/.test(css) && /\.tomt\.lille \.tomt-ikon \{ width: 24px; height: 24px; \}/.test(css) && !/(^|\n)\.tom \{/.test(fs.readFileSync(path.join(repo, 'ui', 'assets', 'app.css'), 'utf8')));
  // ── K14: fremdrift ──
  const omr = d.createElement('div');
  d.body.appendChild(omr);
  const fu = K.fremdrift({ tekst: 'Analyserer filen …', omraade: omr });
  tjek('K14 (fremdrift, ubestemt): ring (aria-hidden) og tekst med role="status"; ringen er aldrig alene; området får aria-busy', fu.rod.className === 'frem ubestemt' && fu.rod.children[0].className === 'snurr' && fu.rod.children[0].getAttribute('aria-hidden') === 'true' && fu.rod.children[1].className === 'frem-tekst' && fu.rod.children[1].getAttribute('role') === 'status' && fu.rod.children[1].textContent === 'Analyserer filen …' && fu.bjaelke === null && omr.getAttribute('aria-busy') === 'true');
  fu.faerdig();
  tjek('K14 (fremdrift): faerdig() fjerner aria-busy', !omr.hasAttribute('aria-busy'));
  const fb = K.fremdrift({ t: 'nAfM', maks: 8, vaerdi: 3 });
  const fbT = fb.rod.querySelector('.frem-tekst');
  tjek('K14 (fremdrift, bestemt): <progress> med max og value, navngivet af teksten (aria-labelledby); teksten som nøgle', fb.rod.className === 'frem' && fb.bjaelke.tagName === 'PROGRESS' && fb.bjaelke.className === 'frem-bjaelke' && fb.bjaelke.max === 8 && fb.bjaelke.value === 3 && fb.bjaelke.getAttribute('aria-labelledby') === fbT.id && fbT.getAttribute('data-t') === 'nAfM' && !fb.rod.querySelector('.snurr'));
  fb.saet(5, { t: 'nAfM', v: 5, w: 8 });
  const efterNoegle = fb.bjaelke.value === 5 && fbT.getAttribute('data-v') === '5' && fbT.getAttribute('data-w') === '8';
  fb.saet(null, 'Færdig');
  tjek('K14 (fremdrift): saet(værdi, tekst) sætter værdien og en ny tekst (nøgle med data-v og data-w, eller færdig tekst)', efterNoegle && fb.bjaelke.value === 5 && fbT.textContent === 'Færdig' && !fbT.hasAttribute('data-t') && !fbT.hasAttribute('data-v'));
  tjek('K14 (fremdrift, CSS): ringen snurrer og står stille ved prefers-reduced-motion; bjælken har kant og fyld i accent', /\.snurr \{[^}]*animation: kit-snurr \.9s linear infinite;/.test(css) && /@keyframes kit-snurr \{ to \{ transform: rotate\(360deg\); \} \}/.test(css) && /@media \(prefers-reduced-motion: reduce\) \{ \.snurr \{ animation: none; \} \}/.test(css) && /\.frem-bjaelke::-webkit-progress-value \{ background: var\(--accent\); \}/.test(css) && /\.frem-bjaelke \{[^}]*border: 1px solid var\(--border-strong\);/.test(css));
  // ── K14: værktøjstip ──
  const raekkeT = d.createElement('div');
  const tipM = d.createElement('button');
  tipM.setAttribute('aria-describedby', 'andet');
  tipM.textContent = 'Kopiér';
  raekkeT.appendChild(tipM);
  d.body.appendChild(raekkeT);
  const tp = K.vaerktoejstip(tipM, { tekst: 'Vælg en række først.' });
  tjek('K14 (tip): role="tooltip", skjult fra start; elementet ligger i .tip-plads og får aria-describedby (tilføjet til det, der var)', tp.tip.getAttribute('role') === 'tooltip' && tp.tip.hidden && tp.tip.textContent === 'Vælg en række først.' && tipM.parentElement === tp.plads && tp.plads.className === 'tip-plads' && tp.plads.parentElement === raekkeT && tp.tip.parentElement === tp.plads && tipM.getAttribute('aria-describedby') === 'andet ' + tp.tip.id && !tp.synlig);
  tipM.focus();
  const vedFokus = tp.synlig;
  tast(tipM, 'Escape');
  const efterEsc = tp.synlig;
  tjek('K14 (tip): tastaturfokus viser tippet; Esc skjuler det uden at flytte fokus', vedFokus && !efterEsc && d.activeElement === tipM);
  tipM.blur();
  tp.plads.dispatchEvent(new w.MouseEvent('mouseenter'));
  const straks = tp.synlig;
  await vent(TIP_VENT_MS + 50);
  const efterVent = tp.synlig;
  tp.plads.dispatchEvent(new w.MouseEvent('mouseleave'));
  await vent(50);
  tp.plads.dispatchEvent(new w.MouseEvent('mouseenter'));
  await vent(200);
  const holdt = tp.synlig;
  tp.plads.dispatchEvent(new w.MouseEvent('mouseleave'));
  await vent(200);
  tjek('K14 (tip): hover viser efter 300 ms; musen kan flyttes op på tippet uden at det forsvinder (inden for 150 ms); det forsvinder, når musen går', !straks && efterVent && holdt && !tp.synlig);
  const andenEsc = [];
  d.addEventListener('keydown', e => andenEsc.push(e.defaultPrevented));
  tp.vis();
  tast(d.body, 'Escape');
  tast(d.body, 'Escape');
  tjek('K14 (tip): Esc bruges kun til at skjule tippet (andre lyttere får den ikke), og næste Esc går videre som før', !tp.synlig && andenEsc.length === 1 && andenEsc[0] === false);
  const tp2 = K.vaerktoejstip(tipM, { t: 'tNoegle' });
  tjek('K14 (tip): et element med to tip genbruger .tip-plads; nøgle giver data-t', tp2.plads === tp.plads && tp2.tip.getAttribute('data-t') === 'tNoegle' && tipM.getAttribute('aria-describedby').split(' ').length === 3);
  const placerTip = (m, t, vb) => {
    Object.defineProperty(w, 'innerWidth', { value: vb, configurable: true });
    tipM.getBoundingClientRect = () => ({ left: m[0], top: m[1], right: m[0] + m[2], bottom: m[1] + 30, width: m[2], height: 30 });
    tp.tip.getBoundingClientRect = () => ({ left: 0, top: 0, right: t[0], bottom: t[1], width: t[0], height: t[1] });
    tp.skjul(); tp.vis();
    const k = ['under', 'venstre-kant', 'hoejre-kant'].filter(x => tp.tip.classList.contains(x)).join('+') || 'over';
    return k + (tp.tip.hasAttribute('style') ? '+stil' : '');
  };
  tjek('K14 (tip): placering med klasser: midt over; under ved toppen; venstre-kant og hoejre-kant ved vinduets kanter; ingen inline-stil', placerTip([400, 300, 80], [200, 40], 900) === 'over' && placerTip([400, 20, 80], [200, 40], 900) === 'under' && placerTip([10, 300, 40], [200, 40], 900) === 'venstre-kant' && placerTip([840, 300, 50], [200, 40], 900) === 'hoejre-kant' && placerTip([840, 10, 50], [200, 40], 900) === 'under+hoejre-kant');
  tp.skjul();
  tjek('K14 (tip, CSS): over som standard, .under, .venstre-kant og .hoejre-kant; mørk flade i begge temaer; højst 280 px', /\.tip \{\n  position: absolute; bottom: calc\(100% \+ 6px\); left: 50%; z-index: 30; transform: translateX\(-50%\);/.test(css) && /\.tip\.under \{ bottom: auto; top: calc\(100% \+ 6px\); \}/.test(css) && /\.tip\.venstre-kant \{ left: 0; transform: none; \}/.test(css) && /\.tip\.hoejre-kant \{ left: auto; right: 0; transform: none; \}/.test(css) && /background: var\(--rail\); color: var\(--rail-strong\);/.test(css) && /max-width: 280px;/.test(css) && /\.tip-plads \{ position: relative;/.test(css));
  tjek('KOMPONENTER.md: Tom tilstand, Fremdrift og Værktøjstip har alle syv dele; reglen for title og værktøjstip, WCAG 1.4.13, aria-busy og prefers-reduced-motion står der', ['Tom tilstand', 'Fremdrift', 'Værktøjstip'].every(n => harDele(n)) && /Hvornår `title`, og hvornår et værktøjstip/.test(afsnitAf('Værktøjstip')) && /beholder de/.test(afsnitAf('Værktøjstip')) && /1\.4\.13/.test(afsnitAf('Værktøjstip')) && /aria-busy/.test(afsnitAf('Fremdrift')) && /prefers-reduced-motion/.test(afsnitAf('Fremdrift')) && /ingen træffere/i.test(afsnitAf('Tom tilstand')) && /tom tabel/.test(afsnitAf('Tom tilstand')));
  // ── K11: afkrydsning, kontakt, radiogruppe og valgliste ──
  const afkKald = [];
  const afk = K.afkrydsning({ tekst: 'Maskér fremmede', hjaelp: 'Adresser, der ikke er dine.', valgt: true, vedSkift: v => afkKald.push(v) });
  d.body.appendChild(afk.rod);
  const afkIn = afk.input, afkHj = afk.rod.querySelector('.afk-hj');
  tjek('K11 (afkrydsning): browserens <input type="checkbox"> (ingen egen rolle) i en <label> med teksten; hjælp under med aria-describedby', afkIn.tagName === 'INPUT' && afkIn.type === 'checkbox' && !afkIn.hasAttribute('role') && afkIn.className === 'afk-boks' && afkIn.parentElement.tagName === 'LABEL' && afkIn.parentElement.className === 'afk' && afkIn.nextElementSibling.className === 'afk-tekst' && afkIn.nextElementSibling.textContent === 'Maskér fremmede' && afkIn.checked && afk.valgt && afkHj.textContent === 'Adresser, der ikke er dine.' && afkIn.getAttribute('aria-describedby') === afkHj.id && !afkIn.hasAttribute('aria-invalid'));
  afkIn.click();
  tjek('K11 (afkrydsning): klik slår fra og kalder vedSkift(false); et klik på teksten virker også (etiketten)', !afk.valgt && afkKald.join() === 'false' && (afkIn.nextElementSibling.click(), afk.valgt && afkKald.join() === 'false,true'));
  const afkD = K.afkrydsning({ t: 'vaelgAlle', delvis: true });
  const delvisFoer = afkD.input.indeterminate;
  afkD.saetValgt(true);
  const efterSaet = !afkD.input.indeterminate && afkD.valgt;
  afkD.saetDelvis();
  tjek('K11 (afkrydsning): delvis valgt (indeterminate) fra start, saetValgt fjerner det, saetDelvis sætter det igen; nøgle giver data-t', delvisFoer && efterSaet && afkD.input.indeterminate && afkD.rod.querySelector('.afk-tekst').getAttribute('data-t') === 'vaelgAlle');
  const afkF = K.afkrydsning({ tekst: 'Jeg har læst', fejl: { t: 'fejlX' }, deaktiveret: true, navn: 'vilkaar', vaerdi: 'ja', id: 'mit-felt' });
  tjek('K11 (afkrydsning): fejl giver aria-invalid og fejltekst (.fejltekst, nøgle); deaktiveret, navn, værdi og id', afkF.input.getAttribute('aria-invalid') === 'true' && afkF.rod.querySelector('.afk-hj.fejltekst').getAttribute('data-t') === 'fejlX' && afkF.input.disabled && afkF.input.name === 'vilkaar' && afkF.input.value === 'ja' && afkF.input.id === 'mit-felt' && afkF.input.getAttribute('aria-describedby') === 'mit-felt-hj');
  const tfKald = [];
  const tf = K.kontakt({ tekst: 'Lås efter 5 minutter', til: true, ord: { til: 'Til', fra: 'Fra' }, vedSkift: v => tfKald.push(v) });
  d.body.appendChild(tf.rod);
  const tfIn = tf.input, tfOrd = tf.rod.querySelector('.tilfra-ord');
  tjek('K11 (kontakt): <input type="checkbox" role="switch"> i en <label> med teksten; ordene til og fra står begge i markup (aria-hidden)', tfIn.type === 'checkbox' && tfIn.getAttribute('role') === 'switch' && tfIn.className === 'tilfra' && tfIn.parentElement.tagName === 'LABEL' && tfIn.checked && tf.til && tfOrd.getAttribute('aria-hidden') === 'true' && tfOrd.querySelector('.tilfra-til').textContent === 'Til' && tfOrd.querySelector('.tilfra-fra').textContent === 'Fra' && tfIn.parentElement.contains(tfOrd));
  tfIn.click();
  tf.saet(true);
  tjek('K11 (kontakt): klik slår fra og kalder vedSkift(false); saet(true) udefra kalder den ikke', tfKald.join() === 'false' && tf.til);
  tjek('K11 (kontakt, CSS): til og fra ses på knoppens plads (left 2 px / 18 px) og fladen; ordet vises efter :checked; glider ikke ved prefers-reduced-motion', /\.tilfra::before \{[^}]*left: 2px;[^}]*background: var\(--border-strong\);[^}]*\}/.test(css) && /\.tilfra:checked::before \{ left: 18px; background: var\(--on-accent\); \}/.test(css) && /\.tilfra:checked \{ border-color: var\(--accent\); background: var\(--accent\); \}/.test(css) && /\.tilfra:checked ~ \.tilfra-ord > \.tilfra-fra, \.tilfra:not\(:checked\) ~ \.tilfra-ord > \.tilfra-til \{ display: none; \}/.test(css) && /@media \(prefers-reduced-motion: reduce\) \{ \.tilfra::before \{ transition: none; \} \}/.test(css));
  tjek('K11 (kontakt): valget (input frem for button) står med begrundelse i kit.js og KOMPONENTER.md', /Valgt frem for <button role="switch" aria-checked>/.test(kitJs) && /\*\*Valget af element:\*\* `<input type="checkbox" role="switch">`, ikke `<button role="switch" aria-checked>`/.test(afsnitAf('Kontakt')));
  const rgKald = [];
  const rg = K.radiogruppe({ etiket: 'Tema', valgt: 'moerk', vandret: true, hjaelp: 'Gælder kun dette vindue.', valg: [{ id: 'lys', tekst: 'Lys' }, { id: 'moerk', tekst: 'Mørk' }, { id: 'system', tekst: 'System', hjaelp: 'Følger macOS.' }], vedValg: id => rgKald.push(id) });
  d.body.appendChild(rg.rod);
  tjek('K11 (radiogruppe): <fieldset> med <legend> og browserens <input type="radio"> med samme name; den valgte er checked; hjælp med aria-describedby på gruppen', rg.rod.tagName === 'FIELDSET' && rg.rod.className === 'valgsaet vandret' && rg.rod.firstElementChild.tagName === 'LEGEND' && rg.rod.firstElementChild.textContent === 'Tema' && rg.inputs.length === 3 && rg.inputs.every(i => i.type === 'radio' && i.name === rg.inputs[0].name && !i.hasAttribute('role')) && rg.inputs.map(i => i.value).join() === 'lys,moerk,system' && rg.valgt === 'moerk' && rg.rod.getAttribute('aria-describedby') === rg.rod.lastElementChild.id && rg.rod.lastElementChild.textContent === 'Gælder kun dette vindue.' && rg.inputs[2].getAttribute('aria-describedby') && !rg.rod.hasAttribute('aria-invalid'));
  rg.inputs[2].click();
  rg.vaelg('lys');
  tjek('K11 (radiogruppe): et valg kalder vedValg(id); vaelg(id) udefra kalder den ikke; én valgt ad gangen', rgKald.join() === 'system' && rg.valgt === 'lys' && rg.inputs.filter(i => i.checked).length === 1);
  const rgF = K.radiogruppe({ etiket: { t: 'temaEt' }, fejl: 'Vælg et tema.', valg: [{ id: 'a', t: 'a' }, { id: 'b', t: 'b' }] });
  tjek('K11 (radiogruppe): fejl står under gruppen (fejltekst, aria-describedby) uden aria-invalid på gruppe eller knapper; ingen valgt giver null; to grupper får hver sit name', rgF.rod.querySelector(':scope > .afk-hj.fejltekst').textContent === 'Vælg et tema.' && !rgF.rod.hasAttribute('aria-invalid') && rgF.inputs.every(i => !i.hasAttribute('aria-invalid')) && rgF.valgt === null && rgF.inputs[0].name !== rg.inputs[0].name && rgF.rod.querySelector('legend').getAttribute('data-t') === 'temaEt' && /\.valgsaet:has\(> \.afk-hj\.fejltekst\) \.afk-boks \{ border-color: var\(--danger\); \}/.test(css));
  const vlKald = [];
  const vl = K.valgliste({ etiket: 'Udløber efter', hjaelp: 'Sagen slettes derefter.', valgt: '30', valg: [{ id: '7', tekst: '7 dage' }, { id: '30', tekst: '30 dage' }, { id: 'x', t: 'aldrig', deaktiveret: true }], vedValg: id => vlKald.push(id) });
  d.body.appendChild(vl.rod);
  const sel = vl.select;
  tjek('K11 (valgliste): browserens <select> i .felt med <label for>, kittets pil (aria-hidden) og hjælp under med aria-describedby', vl.rod.className === 'felt' && sel.tagName === 'SELECT' && sel.parentElement.className === 'vliste' && sel.nextElementSibling.tagName === 'svg' && sel.nextElementSibling.getAttribute('aria-hidden') === 'true' && vl.rod.querySelector('label').htmlFor === sel.id && vl.rod.querySelector('label').className === 'label' && sel.options.length === 3 && sel.options[2].disabled && sel.options[2].getAttribute('data-t') === 'aldrig' && vl.valgt === '30' && sel.getAttribute('aria-describedby') === vl.rod.querySelector('.hj').id);
  sel.value = '7';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  vl.vaelg('30');
  tjek('K11 (valgliste): et valg kalder vedValg(id); vaelg(id) udefra kalder den ikke; fejl giver aria-invalid', vlKald.join() === '7' && vl.valgt === '30' && K.valgliste({ etiket: 'x', fejl: 'Vælg.', valg: [{ id: 'a', tekst: 'a' }] }).select.getAttribute('aria-invalid') === 'true');
  tjek('K11 (CSS): boksen er appearance: none med kant i border-strong, valgt fyldt med accent og flueben, delvis med en streg, radioknappen rund med prik; valglisten har appearance: none og plads til pilen', /\.afk-boks \{\n  -webkit-appearance: none; appearance: none;[^}]*border: 1px solid var\(--border-strong\);/.test(css) && /\.afk-boks:checked, \.afk-boks:indeterminate \{ background: var\(--accent\); border-color: var\(--accent\); \}/.test(css) && /\.afk-boks\[type="checkbox"\]:checked::before \{ content: "";/.test(css) && /\.afk-boks\[type="checkbox"\]:indeterminate::before \{ content: ""; width: 8px; height: 2px;/.test(css) && /\.afk-boks\[type="radio"\] \{ border-radius: 50%; \}/.test(css) && /\.vliste select \{\n  -webkit-appearance: none; appearance: none;[^}]*padding: 0 32px 0 10px;/.test(css) && /\.afk \{[^}]*min-height: 24px;/.test(css));
  tjek('KOMPONENTER.md: Afkrydsning, Radiogruppe, Kontakt og Valgliste har alle syv dele, og "Hvilken kontrol hvornår" nævner valgliste, vælger, radiogruppe og segmentknap', ['Afkrydsning', 'Radiogruppe', 'Kontakt', 'Valgliste'].every(n => harDele(n)) && (() => { const o = afsnitAf('Hvilken kontrol hvornår'); return ['Valgliste (`Kit.valgliste`', 'Vælger (`Kit.vaelger`)', 'Radiogruppe (`Kit.radiogruppe`)', 'Segmentknap (`Kit.segment`)', 'Kontakt (`Kit.kontakt`)', 'Afkrydsning (`Kit.afkrydsning`)', 'Filterchip'].every(x => o.includes(x)); })() && /en hjemmebygget listeboks laves kun, hvis et program viser/i.test(afsnitAf('Valgliste')));
  // ── K10: dialog ── jsdom har ikke showModal og close; de efterlignes her som i Grimnirs UI-test (open, returnValue,
  // cancel og close). Fokusfælden og Esc er browserens og kan ikke prøves i jsdom; testen holder, at kittet bruger dem.
  const modaler = [];
  w.HTMLDialogElement.prototype.showModal = function () { modaler.push(this); this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function (v) { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); if (v !== undefined) this.returnValue = v; this.dispatchEvent(new w.Event('close')); };
  const escDialog = dlgEl => { if (dlgEl.dispatchEvent(new w.Event('cancel', { cancelable: true }))) dlgEl.close(); };
  const dlgSvar = [];
  const aabner = d.createElement('button');
  aabner.textContent = 'Omdøb';
  d.body.appendChild(aabner);
  const navnF = K.felt({ etiket: 'Navn', vaerdi: 'Sag' });
  let gyldig = false;
  const dl = K.dialog({ tekst: 'Omdøb sagen', p: 'Navnet ses kun her.', indhold: navnF, luk: { aria: 'Luk' }, knapper: [{ id: 'gem', tekst: 'Gem', variant: 'primary', ved: () => gyldig }, { id: 'annuller', tekst: 'Annullér' }], vedLuk: s => dlgSvar.push(s) });
  const dlH = dl.overskrift, dlP = dl.rod.querySelector('.modal-tekst');
  tjek('K10: browserens <dialog class="modal"> med aria-labelledby (h2) og aria-describedby (sætningen); ikke på siden før aabn()', dl.rod.tagName === 'DIALOG' && dl.rod.className === 'modal' && dl.rod.getAttribute('aria-labelledby') === dlH.id && dlH.tagName === 'H2' && dlH.textContent === 'Omdøb sagen' && dl.rod.getAttribute('aria-describedby') === dlP.id && dlP.textContent === 'Navnet ses kun her.' && !dl.rod.isConnected && !dl.aaben);
  const fodKn = [...dl.rod.querySelectorAll('.modal-fod .btn')];
  tjek('K10: fodlinjen har knapperne med den primære yderst til højre (også når den står først i listen); lukkeknap med navn', fodKn.map(b => b.dataset.svar).join() === 'annuller,gem' && fodKn[1].classList.contains('primary') && dl.knap('gem') === fodKn[1] && dl.rod.querySelector('.modal-top .modal-luk').getAttribute('aria-label') === 'Luk' && dl.rod.querySelector('.modal-top .modal-luk').type === 'button');
  aabner.focus();
  dl.aabn();
  tjek('K10: aabn() sætter dialogen ind i <body> og åbner med showModal (modal: fokusfælde og Esc fra browseren); fokus på det første felt', dl.rod.parentElement === d.body && modaler.at(-1) === dl.rod && dl.aaben && d.activeElement === navnF.querySelector('input') && /rod\.showModal\(\)/.test(kitJs) && !/\.show\(\)/.test(kitJs));
  dl.knap('gem').click();
  const holdtAaben = dl.aaben && dlgSvar.length === 0;
  gyldig = true;
  dl.knap('gem').click();
  tjek('K10: ved, der giver false, holder dialogen åben; ellers lukker den med knappens id som svar; fokus tilbage til det, der åbnede; returnValue', holdtAaben && !dl.aaben && dlgSvar.join() === 'gem' && d.activeElement === aabner && dl.rod.returnValue === 'gem');
  dl.aabn();
  escDialog(dl.rod);
  dl.aabn();
  dl.rod.querySelector('.modal-luk').click();
  dl.aabn();
  dl.luk();
  tjek('K10: Esc giver svaret "esc", lukkeknappen "luk", luk() fra koden "kode"; fokus går tilbage hver gang', dlgSvar.join() === 'gem,esc,luk,kode' && d.activeElement === aabner);
  const dlF = K.dialog({ tekst: 'Slet?', knapper: [{ id: 'nej', tekst: 'Annullér' }, { id: 'ja', tekst: 'Slet', variant: 'danger' }] });
  dlF.aabn();
  const fokusFarlig = d.activeElement === dlF.knap('nej');
  dlF.luk();
  const dlP2 = K.dialog({ tekst: 'Gem?', knapper: [{ id: 'nej', tekst: 'Nej' }, { id: 'ja', tekst: 'Ja', variant: 'primary' }] });
  dlP2.aabn();
  const fokusPri = d.activeElement === dlP2.knap('ja');
  dlP2.luk();
  dlP2.aabn('nej');
  const fokusValgt = d.activeElement === dlP2.knap('nej');
  dlP2.luk();
  let lukUdenNavn = '';
  try { K.dialog({ tekst: 'x', luk: true }); } catch (e) { lukUdenNavn = e.message; }
  tjek('K10: en lukkeknap uden navn (luk: true) giver en fejl; med ariaT får den data-t-aria', /lukkeknappen skal have et navn/.test(lukUdenNavn) && K.dialog({ tekst: 'x', luk: { ariaT: 'lukAria' } }).rod.querySelector('.modal-luk').getAttribute('data-t-aria') === 'lukAria', lukUdenNavn);
  const dlTom = K.dialog({ tekst: 'Kun tekst' });
  dlTom.aabn();
  tjek('K10: fokus ved åbning: ved en farlig handling på knappen, der ikke er farlig; ellers den primære; aabn(id) peger selv; uden knapper overskriften', fokusFarlig && fokusPri && fokusValgt && d.activeElement === dlTom.overskrift && dlTom.overskrift.tabIndex === -1 && !dlTom.rod.querySelector('.modal-fod') && !dlTom.rod.hasAttribute('aria-describedby'));
  dlTom.luk();
  const bekSvar = [];
  aabner.focus();
  const b1 = K.bekraeft({ tekst: 'Slet sagen?', p: 'Det kan ikke fortrydes.', nej: { t: 'annuller' }, ja: 'Slet', farlig: true, udfyld: rod => bekSvar.push('udfyldt:' + rod.tagName) }).then(v => bekSvar.push(v));
  const bDlg = modaler.at(-1);
  const bKn = [...bDlg.querySelectorAll('.modal-fod .btn')];
  const bFokus = d.activeElement === bKn[0];
  bKn[1].click();
  await b1;
  const b2 = K.bekraeft({ tekst: 'Gem?', nej: 'Nej', ja: 'Ja' }).then(v => bekSvar.push(v));
  const b2Dlg = modaler.at(-1);
  const b2Pri = b2Dlg.querySelector('.modal-fod .btn.primary') && d.activeElement === b2Dlg.querySelector('.modal-fod .btn.primary');
  escDialog(b2Dlg);
  await b2;
  tjek('K10 (bekraeft): to knapper, nej til venstre og ja til højre; farlig giver .btn.danger og fokus på nej; ellers primær med fokus; løftet giver true ved ja og false ved Esc; udfyld før åbning; dialogen fjernes bagefter', bKn.map(b => b.className + ':' + b.dataset.svar).join() === 'btn:nej,btn danger:ja' && bKn[0].querySelector('span').getAttribute('data-t') === 'annuller' && bFokus && b2Pri && bekSvar.join() === 'udfyldt:DIALOG,true,false' && !bDlg.isConnected && !b2Dlg.isConnected && d.activeElement === aabner);
  tjek('K10 (CSS): målene fra Grimnirs .dlg (480 px, luft 24 px, radius-lg, shadow-pop, baggrunden rail 45 %); .bred 620 px; ruller ved for lidt højde; fodlinjen til højre; .modal selv sætter ikke display (en lukket dialog forbliver skjult)', /\.modal \{\n  width: min\(480px, calc\(100vw - 2 \* var\(--space-6\)\)\); max-height: calc\(100vh - 2 \* var\(--space-6\)\);\n  padding: var\(--space-6\); border: 1px solid var\(--border\); border-radius: var\(--radius-lg\);\n  background: var\(--surface\); color: var\(--text\); box-shadow: var\(--shadow-pop\); overflow: auto;\n\}/.test(css) && /\.modal::backdrop \{ background: var\(--rail\); opacity: \.45; \}/.test(css) && /\.modal\.bred \{ width: min\(620px,/.test(css) && /\.modal-fod \{ display: flex; flex-wrap: wrap; justify-content: flex-end;/.test(css) && !/(^|\n|,\s*)\.dlg(?![\w-])/.test(fs.readFileSync(path.join(repo, 'ui', 'assets', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')) && !/(?:^|\n)\.modal(?:\.bred)? \{[^}]*display:/.test(css) && /(?:^|\n)\.modal-top \{ display: flex;/.test(css));
  tjek('KOMPONENTER.md: Dialog har alle syv dele og siger, hvor fokus går hen, at den primære står til højre, og hvad Esc giver', harDele('Dialog') && /Fokus ved åbning/.test(afsnitAf('Dialog')) && /Fokus ved lukning/.test(afsnitAf('Dialog')) && /yderst til højre/.test(afsnitAf('Dialog')) && /`\.btn\.danger`/.test(afsnitAf('Dialog')) && /'esc'/.test(afsnitAf('Dialog')) && /`Kit\.bekraeft`/.test(afsnitAf('Dialog')));
  // ── K15: tabel med sortering, to hovedrækker og sideskift ──
  const bygTabel = K2 => {
    const t = K2.tabel({ ariaT: 'tabelAria', kolonner: [{ t: 'kolVaerdi' }, { tekst: 'Status' }, { t: 'kolAntal', tal: true }], raekker: [
      { gruppe: { t: 'grpAdresser' }, note: '2 rækker' },
      { celler: ['192.0.2.17', K2.chip('ok', 'Maskeres'), 4], mono: [0], data: 1 },
      { celler: ['2001:db8::17', null, 12], mono: [0], data: 2 },
      { gruppe: 'Navne' },
      { celler: ['srv-app01.eksempel.dk', K2.chip('warn', { t: 'cWarn' }), 0], mono: [0], data: 3 },
    ] });
    const foer = t.outerHTML;
    t.vaelg(1);
    return { tabel: foer, tabelValgt: t.outerHTML, t };
  };
  const nuT = bygTabel(K);
  tjek('K15: uden de nye indstillinger er tabellen byte for byte som i 2.0.0 (bygget og efter vaelg; snapshot fra 2.0.0\'s kit.js)', nuT.tabel === V200_TABEL.tabel && nuT.tabelValgt === V200_TABEL.tabelValgt && !/sorter|aria-sort|colgroup|kolgruppe/.test(nuT.tabel));
  const sKald = [];
  const valgtT = [];
  const st = K.tabel({ kolonner: [{ tekst: 'Navn', sort: true }, { tekst: 'Antal', tal: true, sort: true, sortStart: 'faldende' }, { tekst: 'Note' }], sortering: { kolonne: 0, retning: 'stigende' }, raekker: [{ celler: ['a', 1, 'x'], data: 'a' }, { celler: ['b', 2, 'y'], data: 'b' }, { celler: ['c', 3, 'z'], data: 'c' }], vedSortering: (k, r) => sKald.push(k + ':' + r), vedValg: (tr, data) => valgtT.push(data) });
  d.body.appendChild(st);
  const ths = [...st.querySelectorAll('thead th')];
  const knapS = i => ths[i].querySelector('button.sorter');
  const pilS = i => ths[i].querySelector('.sorter-pil').textContent;
  tjek('K15 (sortering): en kolonne med sort er en knap (type="button") i hovedet med navn og pil (aria-hidden); en uden er tekst som før', knapS(0) && knapS(0).type === 'button' && knapS(0).firstChild.textContent === 'Navn' && ths[0].querySelector('.sorter-pil').getAttribute('aria-hidden') === 'true' && !knapS(2) && ths[2].textContent === 'Note' && ths.every(th => th.scope === 'col') && ths[1].className === 'r');
  tjek('K15 (sortering): den sorterede kolonne har aria-sort="ascending" og ▲; de andre ingen aria-sort og ↕ (kan sorteres)', ths[0].getAttribute('aria-sort') === 'ascending' && pilS(0) === '▲' && !ths[1].hasAttribute('aria-sort') && pilS(1) === '↕' && !ths[2].hasAttribute('aria-sort'));
  knapS(0).focus();
  knapS(0).click();
  const efterVend = ths[0].getAttribute('aria-sort') === 'descending' && pilS(0) === '▼';
  knapS(1).click();
  tjek('K15 (sortering): klik på den sorterede vender retningen (descending, ▼); en ny kolonne begynder med sortStart (faldende); vedSortering får kolonne og retning', efterVend && sKald.join() === '0:faldende,1:faldende' && ths[1].getAttribute('aria-sort') === 'descending' && !ths[0].hasAttribute('aria-sort') && pilS(0) === '↕');
  knapS(1).focus();
  st.saetRaekker([{ celler: ['c', 3, 'z'], data: 'c' }, { celler: ['b', 2, 'y'], data: 'b' }]);
  const rk = [...st.querySelectorAll('tbody tr')];
  tjek('K15: saetRaekker bygger rækkerne om uden at røre hovedet (fokus bliver på sorteringsknappen); den første række kan nås med Tab', d.activeElement === knapS(1) && rk.length === 2 && rk[0].textContent === 'c3z' && rk[0].tabIndex === 0 && rk[1].tabIndex === -1 && ths[1].getAttribute('aria-sort') === 'descending');
  rk[0].click();
  rk[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  const nedOk = rk[1].classList.contains('sel') && d.activeElement === rk[1];
  rk[1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  tjek('K15: tastaturet fra 2.0.0 virker stadig efter saetRaekker (klik, pil ned, Home); vedValg får rækkens data', nedOk && rk[0].classList.contains('sel') && rk[0].getAttribute('aria-selected') === 'true' && valgtT.join() === 'c,b,c');
  st.saetSortering(2, 'stigende');
  const n0 = sKald.length;
  st.saetSortering(0, 'faldende');
  tjek('K15: saetSortering sætter sorteringen udefra uden at kalde vedSortering (også på en kolonne uden knap: ingen aria-sort)', sKald.length === n0 && n0 === 2 && ths[0].getAttribute('aria-sort') === 'descending' && st.querySelectorAll('[aria-sort]').length === 1);
  const gt = K.tabel({ kolonnegrupper: [{ id: 'af', tekst: 'Afvist' }, { id: 'an', t: 'thAngreb' }], kolonner: [{ tekst: 'Domæne', sort: true }, { tekst: 'Status' }, { tekst: 'I går', tal: true, gruppe: 'af' }, { tekst: '7 dage', tal: true, gruppe: 'af' }, { tekst: '30 dage', tal: true, gruppe: 'af' }, { tekst: 'Uge', tal: true, gruppe: 'an' }, { tekst: 'Åbn' }], raekker: [{ celler: ['eksempel.dk', 'ok', 1, 2, 3, 4, '›'] }] });
  const [gr1, gr2] = gt.querySelectorAll('thead tr');
  const cgs = [...gt.querySelectorAll(':scope > colgroup')];
  tjek('K15 (to hovedrækker): én <colgroup> pr. gruppe (span) og pr. kolonne uden gruppe, før <thead>', cgs.map(c => c.span).join() === '1,1,3,1,1' && gt.firstElementChild.tagName === 'COLGROUP' && cgs.length === 5 && gt.querySelector('thead').previousElementSibling === cgs[4] && cgs[2].getAttribute('span') === '3' && !cgs[0].hasAttribute('span'));
  tjek('K15 (to hovedrækker): første række har kolonnerne uden gruppe (rowspan="2", scope="col") og gruppeoverskrifterne (.kolgruppe, scope="colgroup", colspan); anden række gruppernes kolonner (scope="col")', [...gr1.children].map(th => (th.rowSpan === 2 ? 'r2:' : '') + th.scope + ':' + (th.colSpan || 1) + ':' + th.textContent).join('|') === 'r2:col:1:Domæne↕|r2:col:1:Status|colgroup:3:Afvist|colgroup:1:|r2:col:1:Åbn' && gr1.children[2].className === 'kolgruppe' && gr1.children[3].getAttribute('data-t') === 'thAngreb' && [...gr2.children].map(th => th.scope + ':' + th.textContent + ':' + th.className).join('|') === 'col:I går:r|col:7 dage:r|col:30 dage:r|col:Uge:r' && gt.querySelectorAll('tbody td').length === 7);
  const sdKald = [], prKald = [];
  const sd = K.sideskift({ aria: 'Sider', side: 1, sider: 3, forrige: 'Forrige', naeste: 'Næste', sideAf: 'Side {v} af {w}', valg: [25, 50, 100], prSide: 50, prSideEtiket: 'Pr. side', vedSide: n => sdKald.push(n), vedPrSide: n => prKald.push(n) });
  d.body.appendChild(sd.rod);
  const [sdF, sdN] = sd.rod.querySelectorAll('button.btn');
  const sdNr = sd.rod.querySelector('.sideskift-nr');
  tjek('K15 (sideskift): <nav> med navn, Forrige, "Side 1 af 3" (role="status"), Næste og antal pr. side (<select> i .vliste med etiket); Forrige har aria-disabled på første side', sd.rod.tagName === 'NAV' && sd.rod.className === 'sideskift' && sd.rod.getAttribute('aria-label') === 'Sider' && sdF.dataset.side === 'forrige' && sdF.textContent === 'Forrige' && sdF.getAttribute('aria-disabled') === 'true' && sdN.getAttribute('aria-disabled') === 'false' && sdNr.textContent === 'Side 1 af 3' && sdNr.getAttribute('role') === 'status' && sd.rod.querySelector('label.sideskift-pr .vliste select').value === '50' && sd.prSide === 50 && sd.rod.querySelector('label.sideskift-pr > span').textContent === 'Pr. side');
  sdF.click();
  sdN.focus(); sdN.click(); sdN.click();
  const ved3 = sdNr.textContent === 'Side 3 af 3' && sdN.getAttribute('aria-disabled') === 'true' && d.activeElement === sdN;
  sdN.click();
  tjek('K15 (sideskift): Forrige på første side gør intet; Næste flytter og kalder vedSide(n); på sidste side har Næste aria-disabled og beholder fokus, og et klik gør intet', ved3 && sdKald.join() === '2,3' && sd.side === 3);
  sd.saet(1, 5);
  const sel2 = sd.rod.querySelector('select');
  sel2.value = '100'; sel2.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('K15 (sideskift): saet(side, sider) udefra kalder ikke vedSide; antal pr. side kalder vedPrSide(n)', sdNr.textContent === 'Side 1 af 5' && sd.sider === 5 && sdKald.length === 2 && prKald.join() === '100');
  const sdT = K.sideskift({ ariaT: 'siderAria', side: 2, sider: 9, forrige: { t: 'forrige' }, naeste: { t: 'naeste' }, sideAf: { t: 'sideAf' } });
  const sdTnr = sdT.rod.querySelector('.sideskift-nr');
  tjek('K15 (sideskift): nøgler giver data-t (og data-v/data-w med side og sider); uden valg intet antal pr. side', sdT.rod.getAttribute('data-t-aria') === 'siderAria' && sdTnr.getAttribute('data-t') === 'sideAf' && sdTnr.getAttribute('data-v') === '2' && sdTnr.getAttribute('data-w') === '9' && !sdT.rod.querySelector('select') && sdT.prSide === null && sdT.rod.querySelector('[data-side="forrige"] span').getAttribute('data-t') === 'forrige');
  tjek('K15 (CSS): sorteringsknappen arver hovedets udseende (font, store bogstaver) uden egen flade; den sorterede står i tekstens farve; gruppeoverskriften er centreret; sideskiftet står under tabellen med en kant', /\.tabel th \.sorter \{[^}]*border: 0; background: none; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; cursor: pointer;/.test(css) && /\.tabel th \.sorter:hover, \.tabel th\[aria-sort\] \{ color: var\(--text\); \}/.test(css) && /\.tabel th\.kolgruppe \{ text-align: center; \}/.test(css) && /\.sideskift \{[^}]*border-top: 1px solid var\(--border\);/.test(css) && css.indexOf('.tabel th .sorter') > css.indexOf('/* ── DataTable ── */') && css.indexOf('.tabel th .sorter') < css.indexOf('/* ── AppShell ── */'));
  tjek('KOMPONENTER.md (DataTable): Kit.sideskift, de nye klasser, valget "programmet sorterer selv" med begrundelse, og at uden indstillingerne er tabellen som i 2.0.0', /\*\*Funktioner:\*\* `Kit\.tabel`, `Kit\.sideskift`/.test(afsnitAf('DataTable')) && /### Sortering, to hovedrækker og sideskift \(fra 2\.3\.0\)/.test(afsnitAf('DataTable')) && /\*\*Programmet sorterer selv\*\*/.test(afsnitAf('DataTable')) && /byte for byte som i 2\.0\.0/.test(afsnitAf('DataTable')) && /aria-sort/.test(afsnitAf('DataTable')) && /scope="colgroup"/.test(afsnitAf('DataTable')) && /\*\*programmet leverer siderne\*\*/.test(afsnitAf('DataTable')));
  // ── K17: tekststørrelse i tre trin ──
  const temaJs = pk('web/tema.js');
  const T = w.Tekst, html = d.documentElement;
  const tekstMeld = [];
  d.addEventListener('proeve-tekst', () => tekstMeld.push(T.valg));
  tjek('K17: tema.js giver Tekst med TRIN (lille, normal, stor), valg, saet, større, mindre og nulstil; uden valg er det normal og <html> har ingen data-tekst (som før)', JSON.stringify(T.TRIN) === '["lille","normal","stor"]' && T.valg === 'normal' && !html.hasAttribute('data-tekst') && ['saet', 'større', 'mindre', 'nulstil'].every(f => typeof T[f] === 'function') && w.localStorage.getItem('proeve-tekst') === null);
  T.saet('stor');
  const efterStor = html.getAttribute('data-tekst') === 'stor' && w.localStorage.getItem('proeve-tekst') === 'stor';
  T.større();
  const ved = [T.valg];
  T.mindre(); ved.push(T.valg); T.mindre(); ved.push(T.valg); T.mindre(); ved.push(T.valg, html.getAttribute('data-tekst'));
  T.nulstil();
  tjek('K17: saet husker under præfikset (<præfiks>-tekst) og sætter data-tekst; større og mindre stopper ved enderne; nulstil giver normal uden attribut; hvert skift melder <præfiks>-tekst', efterStor && ved.join() === 'stor,normal,lille,lille,lille' && T.valg === 'normal' && !html.hasAttribute('data-tekst') && w.localStorage.getItem('proeve-tekst') === 'normal' && tekstMeld.join() === 'stor,stor,normal,lille,lille,normal');
  T.saet('kæmpe');
  tjek('K17: et ukendt trin giver normal', T.valg === 'normal' && !html.hasAttribute('data-tekst'));
  const wGemt = (() => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><head></head><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    dom.window.localStorage.setItem('proeve-tekst', 'lille');
    dom.window.eval(temaJs);
    return dom.window;
  })();
  tjek('K17: et gemt valg sættes, så snart tema.js kører (i <head>, før første tegning)', wGemt.document.documentElement.getAttribute('data-tekst') === 'lille' && wGemt.Tekst.valg === 'lille' && /getAttribute\('data-kit-praefiks'\) \|\| 'wi24rd'\) \+ '-tekst'/.test(temaJs));
  wGemt.close();
  tjek('K17 (CSS): én fælles skala med zoom på roden (.9 og 1.125); normal har ingen regel; .vindue, vælgerens liste og dialogen deler de mål, der følger vinduet, med trinnet; .vindue selv er uændret', /:root\[data-tekst="lille"\] \{ zoom: \.9; \}/.test(css) && /:root\[data-tekst="stor"\] \{ zoom: 1\.125; \}/.test(css) && !/data-tekst="normal"/.test(css) && /:root\[data-tekst="stor"\] \.vindue \{ height: calc\(100vh \/ 1\.125\); min-width: calc\(900px \/ 1\.125\); min-height: calc\(560px \/ 1\.125\); \}/.test(css) && /:root\[data-tekst="lille"\] \.vindue \{ height: calc\(100vh \/ \.9\); min-width: calc\(900px \/ \.9\); min-height: calc\(560px \/ \.9\); \}/.test(css) && /:root\[data-tekst="stor"\] \.vlg-pop \{/.test(css) && /:root\[data-tekst="lille"\] \.modal \{/.test(css) && /(?:^|\n)\.vindue \{ display: flex; flex-direction: column; height: 100vh; min-width: 900px; min-height: 560px; background: var\(--bg\); overflow: hidden; \}/.test(css) && (css.match(/(?<![\w-])zoom:/g) || []).length === 2);
  const tekstAfsnit = afsnitAf('Tekststørrelse');
  tjek('KOMPONENTER.md: Tekststørrelse har formål, markup, tilstande, tastatur og krav; mekanismen (zoom), målingen i WKWebView og at WebView2 ikke er målt', harDele('Tekststørrelse', DELE.filter(x => x !== '**Klasser:**')) && /zoom/.test(tekstAfsnit) && /\*\*Målt i WKWebView\*\*/.test(tekstAfsnit) && /\*\*WebView2 \(Chromium, Windows\) er ikke målt\.\*\*/.test(tekstAfsnit) && /900 × 560/.test(tekstAfsnit) && /Jans valg/.test(tekstAfsnit));
  // ── Pakken 2.3.0: CHANGELOG, README, KOMPONENTER og flyttevejledningen ──
  const log = pk('CHANGELOG.md');
  const post = log.slice(log.indexOf('## 2.3.0'), log.indexOf('\n## ', log.indexOf('## 2.3.0') + 1));
  tjek('CHANGELOG 2.3.0: første post med kun dato, nævner K10–K17, de nye funktioner, og at intet er omdøbt eller fjernet', log.indexOf('## 2.3.0 — 2026-11-11') > 0 && log.indexOf('## 2.3.0') < log.indexOf('## 2.2.0') && ['(K10)', '(K11)', '(K12)', '(K13)', '(K14)', '(K15)', '(K16)', '(K17)', 'Intet er omdøbt eller fjernet', 'byte for byte som i 2.0.0', 'style-src \'self\''].every(o => post.includes(o)) && V230_FUNKTIONER.every(f => post.includes('`' + f + '`')) && ['Tekst', 'saetRaekker', 'saetSortering'].every(o => post.includes(o)), V230_FUNKTIONER.filter(f => !post.includes('`' + f + '`')).join(', '));
  const readme = pk('README.md');
  const ikke = readme.slice(readme.indexOf('## Hvad pakken ikke indeholder'), readme.indexOf('## Licens'));
  tjek('README 2.3.0: indholdslisten nævner de nye funktioner og Tekst; "Hvad pakken ikke indeholder" nævner ikke længere dialog, værktøjstip, tom tilstand, fremdrift, afkrydsning, kontakt, valgliste, StatusTile eller tekststørrelse som manglende', V230_FUNKTIONER.every(f => readme.includes('`' + f + '`')) && /`window\.Tekst`/.test(readme) && /\*\*Menu, Cover og en egen listeboks\.\*\*/.test(ikke) && !/\*\*Dialog, menu, værktøjstip/.test(ikke) && !/Tekststørrelse eller tæthed som valg|Kittet har én størrelse/.test(ikke) && /fra 2\.3\.0/.test(ikke) && /Tekst\.saet\('stor'\)/.test(readme));
  const findes = md.slice(md.indexOf('## Findes ikke endnu'));
  tjek('KOMPONENTER.md: "Findes ikke endnu" er rettet: StatusTile, Dialog, Værktøjstip, Tom tilstand, Fremdrift, afkrydsning, kontakt og valgliste står ikke længere som manglende', !/\| (StatusTile|Dialog|Værktøjstip|Tom tilstand|Fremdrift) \|/.test(findes) && !/\| Afkrydsning, kontakt/.test(findes) && /\| Cover \|/.test(findes) && /\| Menu \|/.test(findes) && /Fra 2\.3\.0 er Dialog, Afkrydsning, Kontakt, Radiogruppe, Valgliste, StatusTile, Kasse \(kort\), Tom tilstand, Fremdrift, Værktøjstip, Filterchip og Tekststørrelse kode/.test(findes));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K10–K17 står som opfyldt i 2.3.0 med hvad de afløser; det siges, at alle 17 er opfyldt; tekststørrelse og komponenterne står ikke længere som umulige at flytte', ['K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.3\\.0 \\|[^\\n]*Afløser').test(hm)) && /\*\*Alle 17 ønsker \(K1–K17\) er opfyldt med 2\.3\.0\.\*\*/.test(hm) && !/\| Tekststørrelse i tre trin \(`data-density`\) \| Kit 2 har én størrelse/.test(hm) && !/\| Dialoger, afkrydsning/.test(hm) && /compact` → `lille`/.test(hm) && /K18–K21/.test(hm));
  tjek('demo 2.3.0: versionen på siden er 2.3.0 eller nyere (fra 2.7.0: 2.7.0)', (pk('demo/index.html').match(/data-v="2\.[34567]\.0"/g) || []).length === 3);
  tjek('KOMPONENTER.md: Filterchip har alle syv dele og siger, at .chip ikke kan klikkes', harDele('Filterchip') && /aria-pressed/.test(afsnitAf('Filterchip')) && /kan ikke klikkes/.test(afsnitAf('Filterchip')));

  w.close();
}
{
  // Demoen 2.3.0 med pakkens rigtige filer, i begge sprog og temaer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const sektion = n => d.querySelector(`#v-komponenter .demo-sektion[data-navn="${n}"]`);
  const NYE = ['Filterchip', 'Kasse', 'StatusTile', 'Tom tilstand', 'Fremdrift', 'Værktøjstip', 'Afkrydsning', 'Kontakt', 'Radiogruppe', 'Valgliste', 'Dialog', 'Tekststørrelse'];
  tjek('demo 2.3.0: en sektion for hver ny komponent, med overskrift og en tekst, der begynder med "Fra 2.3.0"', NYE.every(n => sektion(n) && sektion(n).querySelector('h2').textContent && sektion(n).querySelector('p').textContent.startsWith('Fra 2.3.0')), NYE.filter(n => !(sektion(n) && sektion(n).querySelector('p').textContent.startsWith('Fra 2.3.0'))).join(', '));
  const chips = [...d.querySelectorAll('#demo-filterchips .fchip')];
  chips[1].click();
  tjek('demo 2.3.0 (K16): filterchips i en gruppe; et klik slår til og melder de valgte (dansk)', chips.length === 3 && d.querySelector('#demo-filterchips .fchips[role="group"]') && chips[1].getAttribute('aria-pressed') === 'true' && d.getElementById('filterchip-valgt').textContent === 'Valgt: Fejl, Advarsler');
  const afkDemo = [...d.querySelectorAll('#demo-afk input.afk-boks')];
  const alleDemo = afkDemo[0];
  const delvisDemo = alleDemo.indeterminate;
  alleDemo.click();
  tjek('demo 2.3.0 (K11): "Vælg alle typer" er delvis valgt fra start; et klik vælger alle tre og melder dem (dansk)', delvisDemo && !alleDemo.indeterminate && alleDemo.checked && afkDemo.slice(1, 4).every(i => i.checked) && d.getElementById('afk-valgt').textContent === 'Valgt: IP-adresser, Værtsnavne, Brugernavne');
  afkDemo[2].click();
  tjek('demo 2.3.0 (K11): fravælges én, bliver "Vælg alle" delvis igen; feltet med fejl har aria-invalid', alleDemo.indeterminate && Boolean(d.querySelector('#demo-afk .afk-hj.fejltekst')) && afkDemo[5].getAttribute('aria-invalid') === 'true');
  const tfDemo = d.querySelector('#demo-kontakt input.tilfra');
  tfDemo.click();
  tjek('demo 2.3.0 (K11): kontakten slår fra og melder det; den deaktiverede kan ikke bruges', !tfDemo.checked && d.getElementById('kontakt-valgt').textContent === 'Valgt: Fra' && d.querySelectorAll('#demo-kontakt input.tilfra')[1].disabled);
  d.querySelectorAll('#demo-radio fieldset')[0].querySelectorAll('input')[1].click();
  const selDemo = d.querySelector('#demo-valgliste select');
  selDemo.value = '90'; selDemo.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('demo 2.3.0 (K11): radiogruppen og valglisten melder valget; den vandrette gruppe og valglisten med fejl står der', d.getElementById('radio-valgt').textContent === 'Valgt: Kun hemmeligheder' && d.getElementById('valgliste-valgt').textContent === 'Valgt: 90 dage' && Boolean(d.querySelector('#demo-radio fieldset.valgsaet.vandret')) && d.querySelectorAll('#demo-valgliste select')[1].getAttribute('aria-invalid') === 'true' && selDemo.options[0].textContent === '7 dage');
  const tnRaekker = () => [...d.querySelectorAll('#demo-tabel-ny tbody tr')].map(tr => tr.firstChild.textContent);
  const tnFoer = tnRaekker();
  const tnTh = [...d.querySelectorAll('#demo-tabel-ny thead th')];
  const tnNaeste = d.querySelector('#demo-tabel-ny .sideskift [data-side="naeste"]');
  tnNaeste.click();
  const tnSide2 = tnRaekker();
  d.querySelector('#demo-tabel-ny thead th:first-child .sorter').click();
  tjek('demo 2.3.0 (K15): to hovedrækker (Afvist over to kolonner, Angreb over én), side 1 af 3 med fem rækker; Næste viser de næste fem; et klik på Domæne vender sorteringen og går til side 1 (dansk)', tnTh.length === 6 && tnTh[1].textContent === 'Afvist' && tnTh[1].colSpan === 2 && tnTh[2].textContent === 'Angreb' && tnFoer.length === 5 && tnFoer[0] === 'api.eksempel.dk' && tnSide2[0] === 'intra.eksempel.dk' && tnRaekker()[0] === 'www.eksempel.dk' && d.querySelector('#demo-tabel-ny thead th:first-child').getAttribute('aria-sort') === 'descending' && d.querySelector('#demo-tabel-ny .sideskift-nr').textContent === 'Side 1 af 3');
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function (v) { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); if (v !== undefined) this.returnValue = v; this.dispatchEvent(new w.Event('close')); };
  const [dlgOmdoeb, dlgSlet] = d.querySelectorAll('#demo-dialog .btn');
  dlgOmdoeb.focus(); dlgOmdoeb.click();
  const omdDlg = d.querySelector('dialog.modal[open]');
  const omdInp = omdDlg.querySelector('input');
  const omdFokus = d.activeElement === omdInp && omdDlg.querySelector('h2').textContent === 'Omdøb sagen';
  omdInp.value = '';
  omdDlg.querySelector('.btn.primary').click();
  const omdFejl = omdDlg.open && omdInp.getAttribute('aria-invalid') === '' && omdDlg.querySelector('.hj.fejltekst').textContent === 'Skriv et navn.';
  omdInp.value = 'Leverandør 0007';
  omdDlg.querySelector('.btn.primary').click();
  tjek('demo 2.3.0 (K10): Omdøb åbner med fokus i feltet, holder sig åben ved et tomt navn (fejl), lukker ved Gem og melder svaret; fokus tilbage (dansk)', omdFokus && omdFejl && !omdDlg.open && d.getElementById('dialog-valgt').textContent === 'Svaret var: gem' && d.activeElement === dlgOmdoeb);
  dlgSlet.click();
  const sletDlg = d.querySelector('dialog.modal[open]');
  const sletOk = sletDlg && sletDlg.querySelector('h2').textContent === 'Slet sagen?' && d.activeElement === sletDlg.querySelector('.btn:not(.danger)') && sletDlg.querySelector('.btn.danger span').textContent === 'Slet sag';
  sletDlg.querySelector('.btn:not(.danger)').click();
  await vent(0);
  tjek('demo 2.3.0 (K10): Slet bekræftes i en dialog med fokus på Annullér; nej giver false, og dialogen fjernes', sletOk && !sletDlg.isConnected && d.getElementById('dialog-valgt').textContent === 'Svaret var: false');
  d.querySelector('#demo-tom-tabel .tomt.lille .btn').click();
  tjek('demo 2.3.0 (K14): en stor tom tilstand med handling, en tom tabel med den lille udgave under, fremdrift i begge former og to værktøjstip (dansk)', Boolean(d.querySelector('#demo-tom-stor .tomt:not(.lille) .btn.primary')) && d.querySelectorAll('#demo-tom-tabel table.tabel tbody tr').length === 0 && Boolean(d.querySelector('#demo-tom-tabel .tomt.lille[role="status"]')) && d.getElementById('tom-valgt').textContent === 'Valgt: Ryd filter' && d.querySelector('#demo-frem .frem-bjaelke').value === 3 && d.querySelector('#demo-frem .frem:not(.ubestemt) .frem-tekst').textContent === '3 af 8 filer' && d.getElementById('demo-frem').getAttribute('aria-busy') === 'true' && d.querySelectorAll('#demo-tip .tip[role="tooltip"]').length === 2);
  d.querySelector('#demo-frem-knapper .btn').click();
  tjek('demo 2.3.0 (K14): et trin frem opdaterer bjælken og teksten', d.querySelector('#demo-frem .frem-bjaelke').value === 4 && d.querySelector('#demo-frem .frem:not(.ubestemt) .frem-tekst').textContent === '4 af 8 filer');
  d.querySelectorAll('#demo-fliser .sflise')[1].click();
  tjek('demo 2.3.0 (K12): fire fliser i en liste; en flise melder sit mål (dansk)', d.querySelectorAll('#demo-fliser ul.sfliser[role="list"] > li > button.sflise').length === 4 && d.getElementById('flise-valgt').textContent === 'Valgt: Venter på dig' && Boolean(d.querySelector('#demo-fliser .sflise.warn .sflise-pil')));
  d.querySelector('#demo-kasser .kasse-handling .btn').click();
  tjek('demo 2.3.0 (K13): to kasser, den ene med handling og fodlinje; handlingen melder (dansk)', d.querySelectorAll('#demo-kasser .kasse').length === 2 && d.querySelector('#demo-kasser .kasse-fod') && d.getElementById('kasse-valgt').textContent === 'Valgt: Vis alle');
  const tekstSeg = [...d.querySelectorAll('#demo-tekst .seg-v')];
  const tekstStart = w.Tekst.valg === 'normal' && tekstSeg.map(b => b.getAttribute('aria-checked')).join() === 'false,true,false';
  tekstSeg[2].click();
  const tekstStor = d.documentElement.getAttribute('data-tekst') === 'stor' && d.getElementById('tekst-valgt').textContent === 'Valgt: Stor';
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '-', metaKey: true, bubbles: true, cancelable: true }));
  const efterMinus = w.Tekst.valg === 'normal' && tekstSeg[1].getAttribute('aria-checked') === 'true';
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true, cancelable: true }));
  const efterMinus2 = d.documentElement.getAttribute('data-tekst') === 'lille';
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true, cancelable: true }));
  tjek('demo 2.3.0 (K17): segmentknappen og genvejene (⌘− og Ctrl+−, ⌘0) sætter trinnet med kittets funktioner, og knappen følger med', tekstStart && tekstStor && efterMinus && efterMinus2 && !d.documentElement.hasAttribute('data-tekst') && tekstSeg[1].getAttribute('aria-checked') === 'true');
  w.Sprog.saet('en');
  const tomme = () => NYE.flatMap(n => [...sektion(n).querySelectorAll('[data-t]')]).filter(e => !e.textContent.trim()).map(e => e.getAttribute('data-t'));
  tjek('demo 2.3.0 (English): de nye sektioner har tekst', tomme().length === 0 && chips[0].children[1].textContent === 'Errors' && sektion('Filterchip').querySelector('h2').textContent === 'Filter chip' && selDemo.options[0].textContent === '7 days' && d.querySelector('#demo-kontakt .tilfra-fra').textContent === 'Off', tomme().join(', '));
  w.Tema.saet('moerk');
  tjek('demo 2.3.0: mørkt tema sættes på siden med de nye komponenter', d.documentElement.getAttribute('data-tema') === 'moerk');
  w.close();
}

// ── Pakke 2.4.0 (K36–K38, K18–K21, K29, K30): tabellen, farverne og to ændringer, Jan har sagt ja til. ──
{
  const css = pk('web/kit.css'), kitJs = pk('web/kit.js'), md = pk('KOMPONENTER.md'), readme = pk('README.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return i < 0 ? '' : md.slice(i, md.indexOf('\n## ', i + 1)); };
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const w = ny(), d = w.document, K = w.Kit;
  const tast = (el, key) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
  const fejlAf = f => { try { f(); return ''; } catch (e) { return String(e.message); } };
  const fn = Object.keys(K).map(k => 'Kit.' + k);
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  tjek('2.4.0: de nye navne i V240_FUNKTIONER og V240_KLASSER findes i Kit og kit.css', V240_FUNKTIONER.every(f => fn.includes(f)) && V240_KLASSER.every(k => cssKlasser.has(k)), [...V240_FUNKTIONER.filter(f => !fn.includes(f)), ...V240_KLASSER.filter(k => !cssKlasser.has(k))].join(', '));
  // Huginn and Muninns egne tabelklasser (app.css, vagt.css): kittet må ikke tage dem, mens programmet flytter.
  const HAM_TABEL = ['sep', 'tal-kol', 'chev', 'st', 'hv', 'v', 'sr-only', 'vg-tabel', 'vg-tabel-rul', 'domaene'];
  tjek('2.4.0: tabellens nye klasser støder ikke sammen med Huginn and Muninns tabelklasser (.sep, .tal-kol, .chev …) eller de optagne', HAM_TABEL.every(k => !cssKlasser.has(k)) && ['kort', 'tom', 'tal', 'sort', 'sider'].every(k => !cssKlasser.has(k)));

  const kol = [{ t: 'kolNavn' }, { t: 'kolStatus' }, { t: 'kolAntal', tal: true }];
  const rk = () => [{ gruppe: { t: 'grp' } }, { celler: ['a.eksempel.dk', 'ok', 1], data: 'a' }, { celler: ['b.eksempel.dk', 'warn', 2], data: 'b' }, { celler: ['c.eksempel.dk', 'ok', 3], data: 'c' }];
  // Uden de nye indstillinger og med raekkeHandling: 'vaelg' er tabellen den samme (2.0.0-snapshot står i K15).
  tjek('K36: raekkeHandling: \'vaelg\' giver præcis samme markup som uden indstillingen (standard)', K.tabel({ ariaT: 'x', kolonner: kol, raekker: rk(), raekkeHandling: 'vaelg' }).outerHTML === K.tabel({ ariaT: 'x', kolonner: kol, raekker: rk() }).outerHTML);
  tjek('K36: en ukendt raekkeHandling, et ukendt layout og en ukendt bredde giver en fejl', /ukendt raekkeHandling: vælg/.test(fejlAf(() => K.tabel({ kolonner: kol, raekker: [], raekkeHandling: 'vælg' }))) && /ukendt layout: flyd/.test(fejlAf(() => K.tabel({ kolonner: kol, raekker: [], layout: 'flyd' }))) && /ukendt bredde: 87/.test(fejlAf(() => K.tabel({ kolonner: [{ t: 'a', bredde: 87 }], raekker: [] }))));

  // ── K36 'aabn' ──
  const aabnet = [];
  const ta = K.tabel({ ariaT: 'x', kolonner: kol, raekker: rk(), raekkeHandling: 'aabn', vedAabn: (tr, data) => aabnet.push(data) });
  d.body.appendChild(ta);
  const rA = () => [...ta.querySelectorAll('tbody tr:not(.gruppe)')];
  tjek('K36 (aabn): role="grid"; én række har tabindex 0, de andre -1; ingen aria-selected og ingen .sel', ta.getAttribute('role') === 'grid' && rA().map(r => r.tabIndex).join() === '0,-1,-1' && rA().every(r => !r.hasAttribute('aria-selected') && !r.classList.contains('sel')) && !ta.classList.contains('uden-valg'));
  rA()[1].querySelector('td').click();
  tjek('K36 (aabn): klik kalder vedAabn(række, data); rækken bliver Tab-stop; intet bliver valgt', aabnet.join() === 'b' && rA()[1].tabIndex === 0 && rA()[0].tabIndex === -1 && rA().every(r => !r.hasAttribute('aria-selected') && !r.classList.contains('sel')));
  rA()[1].focus();
  const ned = tast(rA()[1], 'ArrowDown');
  const efterNed = d.activeElement === rA()[2] && rA()[2].tabIndex === 0 && aabnet.length === 1 && ned.defaultPrevented;
  tast(rA()[2], 'Home');
  const efterHome = d.activeElement === rA()[0] && aabnet.length === 1;
  tast(rA()[0], 'End');
  tjek('K36 (aabn): pil ned, Home og End flytter kun fokus (og Tab-stoppet); intet kaldes', efterNed && efterHome && d.activeElement === rA()[2] && aabnet.length === 1);
  const enter = tast(rA()[2], 'Enter');
  tast(rA()[0], ' ');
  tjek('K36 (aabn): Enter og mellemrum på rækken kalder vedAabn (og forhindrer standarden)', aabnet.join() === 'b,c,a' && enter.defaultPrevented);
  // Et link og en knap i en celle er deres egne mål.
  const iCelle = [];
  const knapI = d.createElement('button'); knapI.type = 'button'; knapI.textContent = '3'; knapI.addEventListener('click', () => iCelle.push('knap'));
  const linkI = d.createElement('a'); linkI.href = '#x'; linkI.textContent = 'mere'; linkI.addEventListener('click', e => { e.preventDefault(); iCelle.push('link'); });
  const indenI = d.createElement('span'); indenI.textContent = 'tekst';
  const tc = K.tabel({ kolonner: kol, raekker: [{ celler: [indenI, knapI, linkI], data: 'k' }], raekkeHandling: 'aabn', vedAabn: (tr, data) => iCelle.push('række:' + data) });
  d.body.appendChild(tc);
  knapI.click(); linkI.click();
  const foerEnter = iCelle.join();
  knapI.focus();
  tast(knapI, 'Enter'); tast(knapI, ' ');
  indenI.click();
  tjek('K36 (aabn): et klik på en knap eller et link i en celle åbner ikke rækken, og Enter/mellemrum på knappen går ikke til rækken; et klik på tekst i cellen åbner', foerEnter === 'knap,link' && iCelle.join() === 'knap,link,række:k');
  // saetRaekker: fokus bliver på rækken med samme data, ellers samme plads.
  rA()[2].focus();
  ta.saetRaekker([{ celler: ['c.eksempel.dk', 'ok', 3], data: 'c' }, { celler: ['a.eksempel.dk', 'ok', 1], data: 'a' }]);
  const sammeData = d.activeElement === rA()[0] && rA()[0].__data === 'c' && rA().map(r => r.tabIndex).join() === '0,-1';
  rA()[1].focus();
  ta.saetRaekker([{ celler: ['x', 'ok', 1], data: 'x' }, { celler: ['y', 'ok', 1], data: 'y' }, { celler: ['z', 'ok', 1], data: 'z' }]);
  const sammePlads = d.activeElement === rA()[1] && rA()[1].tabIndex === 0;
  ta.vaelg(0);
  tjek('K36 (aabn): saetRaekker beholder fokus på rækken med samme data, ellers samme plads; tabel.vaelg gør intet', sammeData && sammePlads && rA().every(r => !r.classList.contains('sel') && !r.hasAttribute('aria-selected')) && aabnet.length === 3);
  // Sortering, to hovedrækker og sideskift i 'aabn'.
  const sorteret = [];
  const tas = K.tabel({ raekkeHandling: 'aabn', vedAabn: (tr, data) => sorteret.push('å:' + data), kolonnegrupper: [{ id: 'g', t: 'g' }], kolonner: [{ t: 'n', sort: true }, { t: 'a', tal: true, gruppe: 'g', sort: true }, { t: 'b', tal: true, gruppe: 'g' }], sortering: { kolonne: 0 }, vedSortering: (k, r) => sorteret.push(k + ':' + r), raekker: [{ celler: ['p', 1, 2], data: 'p' }] });
  d.body.appendChild(tas);
  tas.querySelector('.sorter[data-kolonne="1"]').click();
  tas.saetRaekker([{ celler: ['q', 5, 6], data: 'q' }]);
  tas.querySelector('tbody tr').click();
  const sd = K.sideskift({ side: 1, sider: 2, forrige: 'F', naeste: 'N', vedSide: n => { sorteret.push('side' + n); tas.saetRaekker([{ celler: ['r', 7, 8], data: 'r' }]); } });
  sd.rod.querySelector('[data-side="naeste"]').click();
  tas.querySelector('tbody tr').click();
  tjek('K36 (aabn): sortering, to hovedrækker og sideskift virker (vedSortering, saetRaekker, vedAabn efter hver)', sorteret.join() === '1:stigende,å:q,side2,å:r' && tas.querySelectorAll('thead tr').length === 2 && tas.querySelector('tbody tr').tabIndex === 0);

  // ── K36 'ingen' ──
  const tiKnap = K.knap({ tekst: 'Vis' });
  let tiKlik = 0;
  tiKnap.addEventListener('click', () => tiKlik++);
  const ti = K.tabel({ ariaT: 'laes', kolonner: kol, raekker: [{ gruppe: 'g' }, { celler: ['a', tiKnap, 1], data: 'a' }, { celler: ['b', 'x', 2], data: 'b' }], raekkeHandling: 'ingen', kolonnegrupper: [{ id: 'g', t: 'g' }] });
  d.body.appendChild(ti);
  const rI = [...ti.querySelectorAll('tbody tr:not(.gruppe)')];
  rI[1].querySelector('td').click();
  tast(rI[0], 'ArrowDown');
  tiKnap.click();
  tjek('K36 (ingen): en almindelig <table class="tabel uden-valg"> uden role, uden tabindex og aria-selected på rækkerne; klik og piletaster gør intet; knappen i cellen virker og kan nås med Tab', !ti.hasAttribute('role') && ti.className === 'tabel uden-valg' && ti.getAttribute('data-t-aria') === 'laes' && rI.every(r => !r.hasAttribute('tabindex') && !r.hasAttribute('aria-selected') && !r.classList.contains('sel')) && tiKlik === 1 && tiKnap.tabIndex === 0 && !ti.querySelector('[tabindex="-1"]'));
  const tis = K.tabel({ raekkeHandling: 'ingen', kolonner: [{ t: 'n', sort: true }], vedSortering: () => tiKlik++, raekker: [] });
  tis.querySelector('.sorter').click();
  tis.saetRaekker([{ celler: ['n'] }]);
  tjek('K36 (ingen): sortering og saetRaekker virker; rækkerne får stadig ingen tabindex', tiKlik === 2 && !tis.querySelector('tbody tr').hasAttribute('tabindex'));
  tjek('K36 (CSS): .uden-valg har ingen markør og ingen hover (stærkere vælgere end tabellens hover; kun nye vælgere)', /\.tabel\.uden-valg tbody tr:not\(\.gruppe\) \{ cursor: auto; \}/.test(css) && /\.tabel\.uden-valg tbody tr:not\(\.gruppe\):hover > \* \{ background: none; \}/.test(css) && /\.tabel tbody tr:not\(\.gruppe\) \{ cursor: pointer; \}/.test(css) && /\.tabel tbody tr:not\(\.gruppe\):hover td \{ background: var\(--surface-raised\); \}/.test(css));
  tjek('KOMPONENTER.md (DataTable): raekkeHandling med de tre værdier, hvorfor navnet ikke er raekker, rollen (grid) med begrundelse, og hvad en skærmlæser hører (ikke prøvet)', /`raekkeHandling`/.test(afsnitAf('DataTable')) && /fordi `raekker` er listen/.test(afsnitAf('DataTable')) && /\*\*Rollen for en række, der åbner\.\*\*/.test(afsnitAf('DataTable')) && /`role="link"` på rækken er fravalgt/.test(afsnitAf('DataTable')) && /Hvad en skærmlæser hører/.test(afsnitAf('DataTable')) && /\*\*ikke prøvet\*\*/.test(afsnitAf('DataTable')));

  // ── K37 ──
  const tk37 = K.tabel({
    titelT: 'tNavn', kolonnegrupper: [{ id: 'g1', t: 'G1', skille: true }, { id: 'g2', t: 'G2' }],
    kolonner: [{ t: 'dom', hoved: true, klasse: 'dom' }, { t: 'st', klasse: 'st', bredde: 'm' }, { t: 'a', tal: true, gruppe: 'g1', bredde: 's' }, { t: 'b', tal: true, gruppe: 'g1', bredde: 's', klasse: 'ekstra' }, { t: 'c', tal: true, gruppe: 'g2', bredde: 'xs' }],
    raekker: [{ celler: ['eksempel.dk', 'ok', 1, 2, 3], mono: [0], data: 'z1', attr: { 'data-zone': 'z1', 'data-n': 7 }, titel: 'Hentet i dag' }, { celler: ['shop.eksempel.dk', 'ok', 4, 5, 6], data: 'z2', titelT: 'hentetT' }],
  });
  const kb = [...tk37.querySelector('tbody tr').children];
  tjek('K37 (hoved): kolonnen med hoved: true er <th scope="row"> i rækkerne og <th scope="col"> i hovedet', kb[0].tagName === 'TH' && kb[0].scope === 'row' && kb.slice(1).every(c => c.tagName === 'TD') && tk37.querySelector('thead th[data-t="dom"]').scope === 'col');
  tjek('K37 (klasse): klassen står på hovedcellen og hver kropscelle, efter r og mono og før bredden og skillelinjen', kb[0].className === 'mono dom' && kb[1].className === 'st kol-m' && kb[3].className === 'r ekstra kol-s' && kb[2].className === 'r kol-s kol-skille' && tk37.querySelector('thead th[data-t="b"]').className === 'r ekstra kol-s' && tk37.querySelector('thead th[data-t="dom"]').className === 'dom');
  const cols = [...tk37.querySelectorAll('colgroup')].map(cg => [...cg.children].map(c => c.className || '-').join('+'));
  tjek('K37 (bredde): én <col> pr. kolonne i gruppernes <colgroup> (uden span), med kol-xs/s/m (samme klasse på cellerne); en kolonne uden bredde har en tom <col>', cols.join(' | ') === '- | kol-m | kol-s+kol-s | kol-xs' && [...tk37.querySelectorAll('colgroup')].every(cg => !cg.hasAttribute('span')));
  const t1 = K.tabel({ kolonner: [{ t: 'a', bredde: 'l' }, { t: 'b' }, { t: 'c', bredde: 'xl' }], raekker: [] });
  tjek('K37 (bredde): uden kolonnegrupper én <colgroup> med en <col> pr. kolonne, før <thead>; uden bredde ingen <colgroup> (som før)', t1.firstElementChild.tagName === 'COLGROUP' && [...t1.querySelectorAll('col')].map(c => c.className || '-').join() === 'kol-l,-,kol-xl' && !K.tabel({ kolonner: [{ t: 'a' }], raekker: [] }).querySelector('colgroup'));
  const skille = [...tk37.querySelectorAll('th.kol-skille, td.kol-skille')].map(e => (e.getAttribute('data-t') || e.textContent) + ':' + e.tagName.toLowerCase());
  tjek('K37 (skille): skille: true giver .kol-skille på gruppens overskrift, dens første kolonnes hoved og første kolonnes celler; ikke på gruppen uden skille', skille.join() === 'G1:th,a:th,1:td,4:td');
  const tr0 = tk37.querySelector('tbody tr'), tr1 = tk37.querySelectorAll('tbody tr')[1];
  tjek('K37 (attr, titel): data-* sættes på rækken (værdien som tekst); titel giver title, titelT giver data-t-title', tr0.getAttribute('data-zone') === 'z1' && tr0.getAttribute('data-n') === '7' && tr0.title === 'Hentet i dag' && tr1.getAttribute('data-t-title') === 'hentetT' && !tr1.hasAttribute('title'));
  const afvist = ['onclick', 'role', 'tabindex', 'aria-label', 'class', 'style', 'data-', 'data-Zone', 'id'].map(n => fejlAf(() => K.tabel({ kolonner: kol, raekker: [{ celler: [1, 2, 3], attr: { [n]: 'x' } }] })));
  tjek('K37 (attr): alt andet end data-* giver en fejl (on*, role, tabindex, aria-*, class, style, id, tomt og store bogstaver)', afvist.every(f => /kun data-\*-attributter/.test(f)), afvist.join(' | '));
  tjek('K37 (begrundelse): afvisningen er begrundet i kit.js og KOMPONENTER.md', /role, tabindex, aria-\*, class og style er\s+kittets tilstand/.test(kitJs) && /\*\*Kun `data-\*`\*\*; et andet navn giver en fejl\. Begrundelse/.test(afsnitAf('DataTable')));
  tjek('K37 (caption): titelT giver <caption class="skjult-tekst" data-t> som tabellens første barn (kun for skærmlæsere, begrundet); titel giver tekst', tk37.firstElementChild.tagName === 'CAPTION' && tk37.firstElementChild.className === 'skjult-tekst' && tk37.firstElementChild.getAttribute('data-t') === 'tNavn' && K.tabel({ titel: 'Domæner', kolonner: kol, raekker: [] }).querySelector('caption').textContent === 'Domæner' && /\*\*Kun for skærmlæsere:\*\*/.test(afsnitAf('DataTable')));
  tjek('K37 (CSS): rækkehovedet ligner en celle (tekstens farve og størrelse, ingen store bogstaver, vægt 600) og følger hover og valg; faste bredder 40/72/112/160/240 px på klasser; skillelinjen 2 px border-strong', /\.tabel tbody th \{[^}]*font-size: var\(--body-size\); font-weight: 600; letter-spacing: normal; text-transform: none; color: var\(--text\);/.test(css) && /\.tabel tbody tr:not\(\.gruppe\):hover > th \{ background: var\(--surface-raised\); \}/.test(css) && /\.tabel tbody tr\.sel > th \{ background: var\(--accent-soft\); \}/.test(css) && [['xs', 40], ['s', 72], ['m', 112], ['l', 160], ['xl', 240]].every(([k, px]) => new RegExp(`\\.tabel \\.kol-${k} \\{ width: ${px}px; \\}`).test(css) && new RegExp(`\\.tabel\\.layout-auto \\.kol-${k} \\{ min-width: ${px}px; \\}`).test(css)) && /\.tabel \.kol-skille \{ border-left: 2px solid var\(--border-strong\); \}/.test(css));
  tjek('KOMPONENTER.md (DataTable): bredder kun som faste klasser (ingen inline-stil), og hvordan en anden bredde gives', /\*\*Kun faste bredder:\*\* kittet sætter aldrig inline-stil/.test(afsnitAf('DataTable')));

  // ── K38 ──
  const t38 = K.tabel({ kolonner: kol, raekker: rk(), layout: 'auto', fastFoerste: true });
  tjek('K38: layout: \'auto\' giver .layout-auto, fastFoerste giver .fast-foerste (begge kun med indstillingen); første kolonne i en gruppe giver en fejl', t38.className === 'tabel layout-auto fast-foerste' && K.tabel({ kolonner: kol, raekker: [], layout: 'fast' }).className === 'tabel' && /første kolonne må ikke være i en kolonnegruppe/.test(fejlAf(() => K.tabel({ fastFoerste: true, kolonnegrupper: [{ id: 'g' }], kolonner: [{ t: 'a', gruppe: 'g' }], raekker: [] }))));
  tjek('K38: Kit.tabelRul uden navn giver en fejl', /rullerammen skal have et navn/.test(fejlAf(() => K.tabelRul(K.tabel({ kolonner: kol, raekker: [] })))));
  const rul = K.tabelRul(t38, { ariaT: 'rulAria' });
  d.body.appendChild(rul.rod);
  let sw = 900, cw = 400;
  Object.defineProperty(rul.rod, 'scrollWidth', { get: () => sw });
  Object.defineProperty(rul.rod, 'clientWidth', { get: () => cw });
  const ruller = rul.maal();
  const naarRuller = rul.rod.getAttribute('role') === 'region' && rul.rod.tabIndex === 0 && rul.rod.getAttribute('data-t-aria') === 'rulAria';
  sw = 400;
  const ikke = rul.maal();
  tjek('K38 (tabelRul): <div class="tabel-rul"> om tabellen; når den ruller: role="region", tabindex 0 og navn; ellers hverken rolle eller Tab-stop (navnet bliver)', rul.rod.className === 'tabel-rul' && rul.tabel === t38 && t38.parentElement === rul.rod && ruller === true && naarRuller && ikke === false && !rul.rod.hasAttribute('role') && !rul.rod.hasAttribute('tabindex') && rul.rod.getAttribute('data-t-aria') === 'rulAria' && K.tabelRul(K.tabel({ kolonner: kol, raekker: [] }), { aria: 'Domæner' }).rod.getAttribute('aria-label') === 'Domæner');
  tjek('K38 (tabelRul): måles igen, når rammen eller tabellen skifter størrelse (ResizeObserver, når den findes)', /new ResizeObserver\(\(\) => maal\(\)\)/.test(kitJs) && /ro\.observe\(rod\);\s*ro\.observe\(tabelEl\);/.test(kitJs) && /typeof ResizeObserver === 'function'/.test(kitJs));
  tjek('K38 (CSS): layout-auto er table-layout: auto; rullerammen ruller vandret (position: relative, så en skjult caption ikke ruller siden); fokusringen ligger inden for rammen', /\.tabel\.layout-auto \{ table-layout: auto; \}/.test(css) && /\.tabel-rul \{ position: relative; overflow-x: auto;/.test(css) && /\.tabel-rul:focus-visible \{ outline-offset: -2px; \}/.test(css));
  tjek('K38 (CSS): fast første kolonne: sticky, left 0, kant til højre; flade surface (accent-soft i en valgt række, surface-raised ved hover, også i hovedet); kanterne pr. celle (separate)', /\.tabel\.fast-foerste \{ border-collapse: separate; border-spacing: 0; \}/.test(css) && /\.tabel\.fast-foerste thead tr:first-child > th:first-child,\n\.tabel\.fast-foerste tbody tr:not\(\.gruppe\) > :first-child \{ position: sticky; left: 0; z-index: 1; border-right: 1px solid var\(--border\); \}/.test(css) && /\.tabel\.fast-foerste tbody tr:not\(\.gruppe\) > :first-child \{ background: var\(--surface\); \}/.test(css) && /\.tabel\.fast-foerste tbody tr\.sel > :first-child \{ background: var\(--accent-soft\); \}/.test(css) && /\.tabel\.fast-foerste:not\(\.uden-valg\) tbody tr:not\(\.gruppe\):hover > :first-child \{ background: var\(--surface-raised\); \}/.test(css));
  // Rækkefølgen i kit.css afgør, hvilken flade den faste celle får, når vælgerne er lige stærke.
  const iCss = s => css.indexOf(s);
  tjek('K38 (CSS): den faste celles flade står efter .uden-valg-nulstillingen og før valgt/hover (samme styrke: rækkefølgen afgør)', iCss('.tabel.uden-valg tbody tr:not(.gruppe):hover > *') < iCss('.tabel.fast-foerste tbody tr:not(.gruppe) > :first-child { background') && iCss('.tabel.fast-foerste tbody tr:not(.gruppe) > :first-child { background') < iCss('.tabel.fast-foerste tbody tr.sel > :first-child'));

  // ── K18–K21: farverne ──
  const farve = Object.fromEntries(tokens.color.tokens.map(t => [t.name, t.value]));
  tjek('2.4.0: de seks nye farver findes i begge temaer som #RRGGBB, og de 48 fra før har samme værdier som i 2.3.0 (ingen ændret)', V240_FARVER.every(n => farve[n] && /^#[0-9A-F]{6}$/.test(farve[n].light) && /^#[0-9A-F]{6}$/.test(farve[n].dark)) && tokens.color.tokens.length === 54 && tokens.color.tokens.filter(t => !V240_FARVER.includes(t.name)).length === 48);
  const kanal = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const bland = (a, p, b) => [0, 1, 2].map(i => kanal(a, i) * p + kanal(b, i) * (1 - p));
  const afvig = ['ok', 'warn', 'danger', 'info', 'none'].flatMap(m => ['light', 'dark'].map(t => { const r = bland(farve[m + '-mark'][t], 0.78, farve.text[t]); return Math.max(...[0, 1, 2].map(i => Math.abs(kanal(farve[m + '-mark-hover'][t], i) - r[i]))); }));
  tjek('K19: hver *-mark-hover er mærket 78 % blandet med text i srgb (som color-mix), højst en halv enhed fra pr. kanal, i begge temaer', afvig.every(x => x <= 0.5), afvig.map(x => x.toFixed(2)).join(','));
  const xaml = pk('tokens/Tokens.xaml');
  tjek('K18/K19: Tokens.xaml har Wi24rdTextDisabledBrush og fem Wi24rd*MarkHoverBrush i begge ordbøger', (xaml.match(/x:Key="Wi24rdTextDisabledBrush"/g) || []).length === 2 && ['Ok', 'Warn', 'Danger', 'Info', 'None'].every(m => (xaml.match(new RegExp(`x:Key="Wi24rd${m}MarkHoverBrush"`, 'g')) || []).length === 2));
  const grundlag = afsnitAf('Grundlag');
  tjek('K18 (regel): --text-disabled er til tekst, der er slået fra, ikke til tekst, der skal læses; aldrig farve alene; kittets knapper nedtones fortsat med opacity (og gør det)', /\*\*Tekst, der er slået fra\*\* \(K18\)/.test(grundlag) && /ikke til tekst, der skal læses/.test(grundlag) && /\*\*Kittets egne knapper nedtones fortsat som i dag\*\*/.test(grundlag) && /\.btn\[disabled\], \.btn\[aria-disabled="true"\] \{ opacity: \.55;/.test(css) && !/--text-disabled/.test(css));
  tjek('K19 (regel): mærket blandet med --text (78 %), tokens fordi Tokens.xaml ikke kan blande, og at hover aldrig står alene (lille forskel i mørkt tema)', /\*\*Hover på et mærke\*\* \(K19\)/.test(grundlag) && /78 % mærke og 22 % tekst/.test(grundlag) && /ikke kan blande to farver/.test(grundlag) && /hover må aldrig være det eneste/.test(grundlag));
  tjek('K20 (regel): en bue tager betydningens mærkefarve (angreb --danger-mark); --map-arc er standard; ingen token ændret (map-arc er stadig info-mark)', /\*\*Buer på kort\*\* \(K20\)/.test(grundlag) && /`--danger-mark`/.test(grundlag) && /`--map-arc` \(oplysningens blå\) er standard/.test(grundlag) && ['light', 'dark'].every(t => farve['map-arc'][t] === farve['info-mark'][t]));
  tjek('K21 (regel): to faste trin med color-mix og transparent (18 % mærke, 92 % surface), ingen tokens, og hvordan WPF gør det (Opacity); README har eksemplet', /\*\*Svag flade af et mærke\*\* \(K21\)/.test(grundlag) && /color-mix\(in srgb, var\(--danger-mark\) 18%, transparent\)/.test(grundlag) && /color-mix\(in srgb, var\(--surface\) 92%, transparent\)/.test(grundlag) && /Opacity="0\.18"/.test(grundlag) && /### Farver, der regnes \(fra 2\.4\.0\)/.test(readme) && /Opacity="0\.18"/.test(readme) && /Opacity="0\.92"/.test(readme) && !tokens.color.tokens.some(t => /svag|soft-mark|-18/.test(t.name)));

  // ── K29 og K30 ──
  tjek('K29: .btn har white-space: nowrap (i selve .btn-reglen); KOMPONENTER.md (Button) siger det', /\.btn \{\n[^}]*white-space: nowrap;[^}]*\}/.test(css) && /ombrydes teksten aldrig \(`white-space: nowrap`\)/.test(afsnitAf('Button')));
  tjek('K30: SYMBOL.danger er × (de andre som før), chippen viser det; bannerets danger er stadig !', K.SYMBOL.danger === '×' && [K.SYMBOL.ok, K.SYMBOL.warn, K.SYMBOL.info, K.SYMBOL.none].join('') === '✓!i–' && K.chip('danger', 'Fejl').firstChild.textContent === '×' && K.banner({ variant: 'danger', tekst: 'x' }).querySelector('.s').textContent === '!');
  tjek('K30: KOMPONENTER.md (StatusChip) siger `danger` (×) og ikke længere (?)', /`danger` \(×\)/.test(afsnitAf('StatusChip')) && !/`danger` \(\?\)/.test(afsnitAf('StatusChip')));

  // ── Pakken ──
  const log = pk('CHANGELOG.md');
  const a240 = log.slice(log.indexOf('## 2.4.0'), log.indexOf('## 2.3.0'));
  tjek('CHANGELOG 2.4.0: første post med kun dato; Nyt og Ændret; K29 og K30 under Ændret; K36–K38 og K18–K21 under Nyt; intet omdøbt eller fjernet', log.indexOf('## 2.4.0 — 2026-11-12') > 0 && log.indexOf('## 2.4.0') < log.indexOf('## 2.3.0') && /### Nyt[\s\S]*### Ændret/.test(a240) && /### Ændret[\s\S]*\(K29\)[\s\S]*\(K30\)/.test(a240) && ['K36', 'K37', 'K38', 'K18', 'K19', 'K20', 'K21'].every(k => a240.slice(0, a240.indexOf('### Ændret')).includes(k)) && /Intet er omdøbt eller fjernet/.test(a240));
  tjek('CHANGELOG: "Ikke udgivet endnu" er lagt ind under 2.4.0 (dokumentrettelserne efter Wi24rd FTP\'s fase A)', !/## Ikke udgivet endnu/.test(log) && /### Dokumenter/.test(a240) && /Wi24rd FTP's fase A/.test(a240) && /`flytning\/WI24RD-FTP\.md`: det gamle trin 2/.test(a240));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K18–K21, K29, K30 og K36–K38 står som opfyldt i 2.4.0; B2d kan flyttes; K22–K26, K28 og K31–K35 (fra 2.5.0: opfyldt i 2.5.0); K27 er 3.0.0', ['K18', 'K19', 'K20', 'K21', 'K29', 'K30', 'K36', 'K37', 'K38'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.4\\.0 \\|').test(hm)) && /\*\*B2d\*\*/.test(hm) && ['K22', 'K23', 'K24', 'K25', 'K26', 'K28', 'K31', 'K32', 'K33', 'K34', 'K35'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.5\\.0 \\|').test(hm)) && /\*\*K27\*\* \(præfiks på kittets klasser\), der kræver 3\.0\.0/.test(hm));
  tjek('README 2.4.0: indholdslisten nævner Kit.tabelRul; "Byg skærmen" nævner raekkeHandling og Kit.tabelRul', /`Kit\.sideskift`, og fra 2\.4\.0 `Kit\.tabelRul`/.test(readme) && /\(`raekkeHandling`\)/.test(readme) && /\(`Kit\.tabelRul`\)/.test(readme));
}
{
  // Demoen 2.4.0 med pakkens rigtige filer, i begge sprog og temaer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const html = pk('demo/index.html');
  const ta = d.querySelector('#demo-tabel-aabn > .tabel-rul > table.tabel');
  const rA = ta ? [...ta.querySelectorAll('tbody tr')] : [];
  tjek('demo 2.4.0 (K36–K38): tabellen med rækker, der åbner, står i en rulleramme med navn; layout-auto og fast-foerste; caption; rækkehoved; skillelinjer; bredder; data-zone og title (dansk)', Boolean(ta) && ta.className === 'tabel layout-auto fast-foerste' && ta.getAttribute('role') === 'grid' && ta.querySelector('caption').textContent === 'Domæner, der kan åbnes' && ta.parentElement.getAttribute('aria-label') === 'Domæner, ruller vandret' && rA.length === 8 && rA[0].firstElementChild.tagName === 'TH' && rA[0].firstElementChild.scope === 'row' && ta.querySelectorAll('thead .kol-skille').length === 4 && ta.querySelectorAll('col.kol-s').length === 3 && rA[0].getAttribute('data-zone') === 'z1' && rA[0].title === 'Hentet i dag' && rA.every(r => !r.hasAttribute('aria-selected')));
  rA[1].querySelector('td').click();
  const efterKlik = d.getElementById('tabel-aabn-valgt').textContent;
  rA[2].querySelector('.demo-tal').click();
  const efterTal = d.getElementById('tabel-aabn-valgt').textContent;
  rA[3].focus();
  rA[3].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  tjek('demo 2.4.0 (K36): klik på en række åbner den, et klik på tallet åbner den ikke (tallet melder sig selv), Enter åbner (dansk); den sidste celle siger "Åbn …" til skærmlæseren', efterKlik === 'Åbnet: shop.eksempel.dk' && efterTal === 'Tallet for blog.eksempel.dk (rækken blev ikke åbnet)' && d.getElementById('tabel-aabn-valgt').textContent === 'Åbnet: api.eksempel.dk' && rA[0].lastElementChild.querySelector('.skjult-tekst').textContent === 'Åbn eksempel.dk');
  const tl = d.querySelector('#demo-tabel-laes > table.tabel');
  tl.querySelectorAll('tbody tr')[1].querySelector('.btn').click();
  tjek('demo 2.4.0 (K36): tabellen, der kun skal læses, har ingen rolle og ingen Tab-stop på rækkerne; knappen i rækken virker og har et navn (dansk)', tl.className === 'tabel uden-valg' && !tl.hasAttribute('role') && [...tl.querySelectorAll('tbody tr')].every(r => !r.hasAttribute('tabindex')) && d.getElementById('tabel-laes-valgt').textContent === 'Vist: shop.eksempel.dk' && tl.querySelectorAll('tbody tr')[1].querySelector('.btn').getAttribute('aria-label') === 'Vis shop.eksempel.dk');
  tjek('demo 2.4.0 (K18): tekst, der er slået fra, i --text-disabled under Grundlag', d.getElementById('demo-fra').textContent.startsWith('Kopiér') && /\.demo-fra \{ color: var\(--text-disabled\); \}/.test(html));
  tjek('demo 2.4.0 (K19, K21): fem søjler, der skifter til *-mark-hover under musen, og fem svage flader (color-mix 18 %) med tekst; forklaringen på kortet står på surface 92 %', d.querySelectorAll('#demo-hover i').length === 5 && ['ok', 'warn', 'danger', 'info', 'none'].every(m => new RegExp(`\\.demo-hover \\.${m}:hover \\{ background: var\\(--${m}-mark-hover\\); \\}`).test(html) && new RegExp(`\\.demo-svag \\.${m} \\{ background: color-mix\\(in srgb, var\\(--${m}-mark\\) 18%, transparent\\); \\}`).test(html)) && d.querySelectorAll('#demo-svag span').length === 5 && /background: color-mix\(in srgb, var\(--surface\) 92%, transparent\)/.test(html));
  const buer = [...d.querySelectorAll('#demo-kort240 path[data-bue]')].map(p => p.getAttribute('data-bue') + ':' + /stroke: var\(--([a-z-]+)\)/.exec(p.getAttribute('style'))[1]);
  tjek('demo 2.4.0 (K20, K21): kortet har en bue, der er et angreb (--danger-mark), og en uden betydning (--map-arc); ringen har mærkets svage flade (18 %)', buer.join() === 'angreb:danger-mark,neutral:map-arc' && /color-mix\(in srgb, var\(--map-ring\) 18%, transparent\)/.test(d.querySelector('#demo-kort240 circle[data-ring]').getAttribute('style')) && d.querySelector('#demo-kort240 .demo-forklaring .angreb').textContent === 'Angreb (danger-mark)');
  tjek('demo 2.4.0 (K30): chippen danger viser × i demoen', d.querySelector('#demo-chips .chip.danger').firstChild.textContent === '×');
  w.Sprog.saet('en');
  tjek('demo 2.4.0 (English): de nye dele har tekst', ta.querySelector('caption').textContent === 'Domains that can be opened' && d.getElementById('tabel-aabn-valgt').textContent === 'Opened: api.eksempel.dk' && d.querySelector('[data-t="hTabelAabn"]').textContent === 'Rows that open, and a table without row selection' && d.querySelector('[data-t="h240"]').textContent === 'Hover, arcs and faint surfaces' && rA[0].lastElementChild.querySelector('.skjult-tekst').textContent === 'Open eksempel.dk' && tl.querySelector('caption').textContent === 'Latest events');
  w.Tema.saet('moerk');
  tjek('demo 2.4.0: mørkt tema sættes på siden med de nye dele', d.documentElement.getAttribute('data-tema') === 'moerk' && Boolean(d.querySelector('#demo-tabel-aabn .tabel-rul')));
  const da = Object.keys(w.Sprog.TEKST.da), en = Object.keys(w.Sprog.TEKST.en);
  tjek('demo 2.4.0: dansk og engelsk har de samme nøgler', JSON.stringify(da.slice().sort()) === JSON.stringify(en.slice().sort()), da.filter(k => !en.includes(k)).concat(en.filter(k => !da.includes(k))).join(', '));
}

// ── Pakke 2.5.0 (K22–K26, K28, K31–K35, G1–G11): skallen, kontrollerne, fliserne og dialogen. ──
{
  const css = pk('web/kit.css'), kitJs = pk('web/kit.js'), md = pk('KOMPONENTER.md'), readme = pk('README.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return i < 0 ? '' : md.slice(i, md.indexOf('\n## ', i + 1)); };
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    dom.window.HTMLDialogElement.prototype.close = function (v) { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); if (v !== undefined) this.returnValue = v; this.dispatchEvent(new dom.window.Event('close')); };
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const w = ny(), d = w.document, K = w.Kit;
  const tast = (el, key) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
  const fejlAf = f => { try { f(); return ''; } catch (e) { return String(e.message); } };
  const fn = Object.keys(K).map(k => 'Kit.' + k);
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  const regel = (vaelger) => { const i = css.indexOf('\n' + vaelger + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i) + 1); };
  tjek('2.5.0: de nye navne i V250_FUNKTIONER og V250_KLASSER findes i Kit og kit.css', V250_FUNKTIONER.every(f => fn.includes(f)) && V250_KLASSER.every(k => cssKlasser.has(k)), [...V250_FUNKTIONER.filter(f => !fn.includes(f)), ...V250_KLASSER.filter(k => !cssKlasser.has(k))].join(', '));
  // Huginn and Muninns egne klasser (fra Fase A) og generiske ord må kittet ikke tage (K27 er 3.0.0).
  const HAM = ['hm-mrk', 'tal', 'pille', 'pille-ikon', 'pille-bar', 'henter', 'gul', 'roed', 'vg-hoved', 'dyk-flise-to', 'dyk-flise-aabn', 'dyk-filter', 'dyk-filter-x', 'sti-chip', 'dyk-datoer', 'dyk-dato', 'raekke', 'etik', 'guide', 'valgt', 'fejl-felt', 'link'];
  tjek('2.5.0: de nye klasser støder ikke sammen med Huginn and Muninns (.hm-mrk, .pille, .henter, .dyk-filter …) eller generiske ord (.guide, .valgt, .link)', V250_KLASSER.every(k => !HAM.includes(k)) && HAM.every(k => !cssKlasser.has(k)));

  // Uden de nye indstillinger bygger kittet præcis det samme som 2.4.0 (V240_UDSEENDE er lavet med 2.4.0's kit.js fra
  // HEAD 48b8dbd og samme byg-funktion).
  const nu = bygV240(K, d);
  const forskel = Object.keys(V240_UDSEENDE).filter(k => nu[k] !== V240_UDSEENDE[k]);
  tjek(`2.5.0: uden de nye indstillinger er ${Object.keys(V240_UDSEENDE).length} eksempler byte for byte som i 2.4.0 (dialog, bekræftelse, kontakt, radiogruppe, valgliste, afkrydsning, fliser, tom tilstand, kasse, filterchips, segmentknap, visningsskift, træ, bånd, værktøjstip, fremdrift)`, Object.keys(V240_UDSEENDE).length === 26 && forskel.length === 0, forskel.join(', '));
  for (const v of [...d.querySelectorAll('dialog')]) v.remove();

  // ── K25: status med fremdrift i fodlinjen ──
  const klik = [];
  const fs = K.fodstatus({ status: 'henter', t: 'koeHenter', fremdrift: { maks: 8, vaerdi: 3 }, handling: { t: 'aabnOverblik', ved: () => klik.push('aabn') } });
  d.body.appendChild(fs.rod);
  const meld = () => fs.rod.querySelector('.fodstatus-meld');
  const maal = () => fs.rod.querySelector('.fodstatus-maal');
  const bj = () => fs.rod.querySelector('.fodstatus-bjaelke');
  tjek('K25: <span class="fodstatus" data-status="henter"> med en knap (aria-labelledby: tekst og handling), ring (snurr, aria-hidden), tekst (aria-hidden), <progress> 3/8 og et skjult live-område (role="status")', fs.rod.className === 'fodstatus' && fs.rod.dataset.status === 'henter' && maal().tagName === 'BUTTON' && maal().type === 'button' && maal().getAttribute('aria-labelledby') === meld().id + ' ' + maal().querySelector('.skjult-tekst').id && maal().querySelector('.skjult-tekst').getAttribute('data-t') === 'aabnOverblik' && fs.rod.querySelector('.fodstatus-mrk').className === 'fodstatus-mrk snurr' && fs.rod.querySelector('.fodstatus-mrk').getAttribute('aria-hidden') === 'true' && fs.rod.querySelector('.fodstatus-tekst').getAttribute('aria-hidden') === 'true' && fs.rod.querySelector('.fodstatus-tekst').getAttribute('data-t') === 'koeHenter' && !bj().hidden && bj().max === 8 && bj().value === 3 && bj().getAttribute('aria-labelledby') === meld().id && meld().getAttribute('role') === 'status' && meld().classList.contains('skjult-tekst') && meld().getAttribute('data-t') === 'koeHenter' && meld().parentElement === fs.rod && !maal().contains(meld()));
  maal().click();
  tjek('K25: et klik på knappen kalder handlingens ved', klik.join() === 'aabn');
  // Hvad der læses op: live-området skrives kun ved en ny tekst. Et trin og samme tekst igen rører det ikke.
  let skrevet = 0;
  new w.MutationObserver(m => { skrevet += m.length; }).observe(meld(), { attributes: true, childList: true, characterData: true, subtree: true });
  fs.saet({ fremdrift: { vaerdi: 4 } });
  fs.saet({ t: 'koeHenter' });
  await vent(0);
  const efterTrin = skrevet;
  fs.saet({ status: 'ok', t: 'koeFaerdig', fremdrift: null });
  await vent(0);
  tjek('K25: et trin i fremdriften og samme tekst igen skriver intet i live-området; en ny tekst gør (og status, mærke og linje skifter)', efterTrin === 0 && bj().value === 4 && skrevet > 0 && meld().getAttribute('data-t') === 'koeFaerdig' && fs.rod.dataset.status === 'ok' && fs.rod.querySelector('.fodstatus-mrk').textContent === '✓' && !fs.rod.querySelector('.fodstatus-mrk').classList.contains('snurr') && bj().hidden && fs.status === 'ok');
  maal().focus();
  fs.saet({ handling: null });
  const somTekst = maal().tagName === 'SPAN' && !maal().hasAttribute('aria-labelledby') && !fs.rod.querySelector('.fodstatus-maal .skjult-tekst');
  fs.saet({ handling: { tekst: 'Åbn', ved: () => klik.push('igen') }, fremdrift: 'ubestemt', status: 'danger', tekst: 'Fejl' });
  maal().click();
  tjek('K25: handling: null gør delen til tekst (span); en ny handling til en knap igen; ubestemt fremdrift har ingen value; færdig tekst og danger (×)', somTekst && maal().tagName === 'BUTTON' && klik.join() === 'aabn,igen' && !bj().hidden && !bj().hasAttribute('value') && fs.rod.querySelector('.fodstatus-mrk').textContent === '×' && meld().textContent === 'Fejl' && fs.rod.querySelector('.fodstatus-tekst').textContent === 'Fejl');
  tjek('K25: en ukendt status og en forkert fremdrift giver en fejl; uden noget er status none (–) uden linje og uden knap', /ukendt status: gul/.test(fejlAf(() => K.fodstatus({ status: 'gul' }))) && /fremdrift er/.test(fejlAf(() => K.fodstatus({ fremdrift: 5 }))) && (() => { const t = K.fodstatus(); return t.rod.dataset.status === 'none' && t.rod.querySelector('.fodstatus-mrk').textContent === '–' && t.rod.querySelector('.fodstatus-bjaelke').hidden && t.maal.tagName === 'SPAN'; })());
  tjek('K25 (CSS): mærket i statussens tekstfarve (ok, warn, danger, info, none), ringen 10 px, linjen 64 × 4 px i accent på border, den ubestemte glider og står stille ved prefers-reduced-motion; knappens fokusring inden for fodlinjen', ['ok', 'warn', 'danger', 'info'].every(v => css.includes(`.fodstatus[data-status="${v}"] .fodstatus-mrk { color: var(--${v}); }`)) && css.includes('.fodstatus[data-status="none"] .fodstatus-mrk { color: var(--text-muted); }') && /\.fodstatus-mrk\.snurr \{ width: 10px; height: 10px; \}/.test(css) && /\.fodstatus-bjaelke \{[^}]*width: 64px; height: 4px;[^}]*background: var\(--border\);/.test(css) && /\.fodstatus-bjaelke::-webkit-progress-value \{ background: var\(--accent\); \}/.test(css) && /animation: kit-glid/.test(css) && /@media \(prefers-reduced-motion: reduce\) \{ \.fodstatus-bjaelke:indeterminate[^}]*animation: none;/.test(css) && /button\.fodstatus-maal:focus-visible \{ outline-offset: -2px; \}/.test(css));

  // ── K22 og K23: titellinjen ──
  tjek('K22 (CSS): .mrk-billede er 20 px høj med fri bredde i mærkefarven; .mrk-maske er en flade i --accent-on-rail med maskens plads, størrelse og gentagelse (billedet og bredden er programmets); kittet henter intet', /(?:^|\n)\.mrk-billede \{ display: block; flex: none; height: 20px; width: auto; color: var\(--accent-on-rail\); \}/.test(css) && /(?:^|\n)\.mrk-maske \{[^}]*height: 20px; background: var\(--accent-on-rail\);[^}]*-webkit-mask-size: contain;[^}]*mask-repeat: no-repeat;[^}]*\}/.test(css) && !/mask-image/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && (css.match(/url\(/g) || []).length === 4);
  tjek('K23 (CSS): .rk slået fra (disabled og aria-disabled: nedtonet, ingen hover), aria-current (aktiv flade og streg forneden) og aria-expanded (aktiv flade og ring); a.rk uden understregning', /\.titel \.rk:disabled, \.titel \.rk\[aria-disabled="true"\] \{ opacity: \.6; cursor: default; \}/.test(css) && /\.titel \.rk:disabled:hover, \.titel \.rk\[aria-disabled="true"\]:hover \{ background: var\(--rail\); color: var\(--rail-text\); \}/.test(css) && /\.titel \.rk\[aria-current\]:not\(\[aria-current="false"\]\) \{ background: var\(--rail-active\); color: var\(--rail-strong\); box-shadow: inset 0 -2px 0 var\(--accent-on-rail\); \}/.test(css) && /\.titel \.rk\[aria-expanded="true"\] \{ background: var\(--rail-active\); color: var\(--rail-strong\); box-shadow: inset 0 0 0 1px var\(--rail-text\); \}/.test(css) && /\.titel a\.rk \{ text-decoration: none; \}/.test(css));
  tjek('K23: den eksisterende .rk-regel og hover er uændrede', /\.titel \.rk \{\n  display: inline-flex; align-items: center; justify-content: center; gap: var\(--space-1\);\n  height: 26px; min-width: 26px; padding: 0 var\(--space-2\);\n  border: 0; border-radius: var\(--radius-sm\); background: var\(--rail\); color: var\(--rail-text\); cursor: pointer;\n\}/.test(css) && /\.titel \.rk:hover \{ background: var\(--rail-active\); color: var\(--rail-strong\); \}/.test(css));

  // ── K24: visningsskift ──
  const sv = d.createElement('div');
  d.body.appendChild(sv);
  const skift = K.visningsskift(sv, [{ id: 'a', tekst: 'Oversigt', ikon: 'mappe', genvej: '1' }, { id: 'b', tekst: 'Siden sidst', ikon: 'mappe', genvej: '2', antal: 3, kraever: true, antalAriaT: 'kraever' }, { id: 'c', tekst: 'Angreb', ikon: 'mappe', deaktiveret: true, hvorfor: 'hvorforToken', antal: 7 }]);
  const lk = id => skift.links.find(a => a.dataset.visning === id);
  const antB = lk('b').querySelector(':scope > .ant');
  tjek('K24: antal står før genvejen; kraever giver .ant .ant-kraever (aria-hidden) og skjult tekst med nøgle og data-v', antB && antB.className === 'ant ant-kraever' && antB.textContent === '3' && antB.getAttribute('aria-hidden') === 'true' && antB.nextElementSibling.className === 'skjult-tekst' && antB.nextElementSibling.getAttribute('data-t') === 'kraever' && antB.nextElementSibling.getAttribute('data-v') === '3' && antB.nextElementSibling.nextElementSibling.tagName === 'KBD');
  const c = lk('c');
  let navigeret = 0;
  sv.addEventListener('click', e => { if (!e.defaultPrevented) navigeret++; });
  c.click();
  const tipC = d.getElementById(c.getAttribute('aria-describedby'));
  tjek('K24: et punkt slået fra har aria-disabled og href (kan nås med Tab), et klik gør intet (preventDefault), og hvorfor står i et værktøjstip (ikke title)', c.getAttribute('aria-disabled') === 'true' && c.getAttribute('href') === '#c' && navigeret === 0 && tipC && tipC.getAttribute('role') === 'tooltip' && tipC.getAttribute('data-t') === 'hvorforToken' && !c.hasAttribute('title') && !c.hasAttribute('data-t-title') && c.parentElement.className === 'tip-plads' && c.querySelector(':scope > .ant').className === 'ant' && !c.querySelector(':scope > .ant').hasAttribute('aria-hidden'));
  skift.saetPunkt('c', { deaktiveret: false });
  lk('a').click();
  skift.saetPunkt('b', { antal: null });
  tjek('K24: saetPunkt slår punktet til (tip og aria-describedby væk, ude af .tip-plads), og antal: null fjerner tallet og den skjulte tekst; et klik på et punkt, der er slået til, går igennem', !c.hasAttribute('aria-disabled') && !c.hasAttribute('aria-describedby') && c.parentElement === sv && !sv.querySelector('[role="tooltip"]') && !lk('b').querySelector('[data-ant]') && navigeret === 1);
  tjek('K24: en ukendt visning i saetPunkt giver en fejl; markér virker stadig efter tippet', /ukendt visning: x/.test(fejlAf(() => skift.saetPunkt('x', {}))) && (skift.markér('c'), c.getAttribute('aria-current') === 'page'));
  tjek('K24 (CSS): punkt slået fra er nedtonet uden hover; .ant-kraever er en fyldt pille med kant og fed skrift i danger (ikke kun farve); tippets plads fylder bredden', /\.vs\[aria-disabled="true"\] \{ opacity: \.5; cursor: default; \}/.test(css) && /\.vs \.ant-kraever \{[^}]*border: 1px solid var\(--danger\);[^}]*background: var\(--danger-soft\); color: var\(--danger\); font-weight: 700;/.test(css) && /\.skift > \.tip-plads \{ display: flex; \}/.test(css));

  // ── K26: træet ──
  const valgT = [];
  const tu = d.createElement('ul');
  d.body.appendChild(tu);
  const tr = K.navTrae(tu, [{ id: 'alle', tekst: 'Alle', boern: [{ id: 'a', tekst: 'a.eksempel.dk' }, { id: 'b', tekst: 'b.eksempel.dk' }] }, { id: 'g', tekst: 'Gruppe', boern: [{ id: 'g1', tekst: 'g1' }] }], { valgt: 'b', kunBrugerValg: true, vedValg: id => valgT.push(id) });
  tr.vaelg('a');
  const efterKode = valgT.length;
  const knapT = id => tu.querySelector(`[data-punkt="${id}"]`);
  knapT('b').click();
  tast(knapT('alle'), 'Enter');
  tjek('K26 (kunBrugerValg): intet vedValg ved start og ved vaelg(id); klik og Enter kalder det', efterKode === 0 && valgT.join() === 'b,alle');
  // Fold Gruppe ind og sæt fokus på b; byg om med en ny liste.
  tast(knapT('g'), 'ArrowLeft');
  knapT('b').focus();
  const ulFoer = tu;
  let lyttere = 0;
  const orgAdd = tu.addEventListener;
  tu.addEventListener = function (...a) { lyttere++; return orgAdd.apply(this, a); };
  tr.saetPunkter([{ id: 'alle', tekst: 'Alle', boern: [{ id: 'b', tekst: 'b.eksempel.dk' }, { id: 'c', tekst: 'c.eksempel.dk' }] }, { id: 'g', tekst: 'Gruppe', boern: [{ id: 'g1', tekst: 'g1' }] }]);
  tu.addEventListener = orgAdd;
  tjek('K26: saetPunkter bygger om i samme <ul> uden nye lyttere og uden vedValg; valget (alle) bliver, Gruppe er stadig foldet, og b har fokus igen', ulFoer === tu && lyttere === 0 && valgT.length === 2 && knapT('alle').classList.contains('on') && knapT('g').getAttribute('aria-expanded') === 'false' && tu.querySelector('[data-punkt="g"] + ul').hidden && d.activeElement === knapT('b') && knapT('b').tabIndex === 0 && tr.punkter.length === 5 && tr.punkter.includes(knapT('c')));
  tr.saetPunkter([{ id: 'x', tekst: 'x' }, { id: 'y', tekst: 'y' }], 'y');
  tast(knapT('y'), 'ArrowUp');
  tjek('K26: saetPunkter med valgt vælger det (uden vedValg); tastaturet virker på de nye punkter; et ukendt valg giver det første', knapT('y').getAttribute('aria-selected') === 'true' && valgT.length === 2 && d.activeElement === knapT('x') && (tr.saetPunkter([{ id: 'p', tekst: 'p' }], 'findes-ikke'), knapT('p').classList.contains('on')));
  const valgGl = [];
  const tg = K.navTrae(d.createElement('ul'), [{ id: 'a', tekst: 'A' }, { id: 'b', tekst: 'B' }], { vedValg: id => valgGl.push(id) });
  tg.vaelg('b');
  tjek('K26: uden indstillingen kaldes vedValg ved start og ved vaelg(id) som før (Grimnir og demoen bruger det)', valgGl.join() === 'a,b');

  // ── K28: segmentknap uden valg ──
  const segK = [];
  const sg = K.segment({ aria: 'Periode', valgt: null, valg: [{ id: '7', tekst: '7 dage' }, { id: '30', tekst: '30 dage' }], vedValg: id => segK.push(id) });
  d.body.appendChild(sg.rod);
  const udenValg = sg.valgt === null && sg.knapper.every(b => b.getAttribute('aria-checked') === 'false') && sg.knapper.map(b => b.tabIndex).join() === '0,-1';
  sg.knapper[0].click();
  const foersteMeldt = segK.join() === '7' && sg.valgt === '7';
  sg.vaelg(null);
  const nulstillet = sg.valgt === null && sg.knapper[0].getAttribute('aria-checked') === 'false' && segK.length === 1;
  sg.knapper[0].focus();
  tast(sg.knapper[0], 'ArrowRight');
  tjek('K28: valgt: null giver intet valgt (første kan nås med Tab); et klik på den første vælger og meldes; vaelg(null) fjerner valget uden at melde; en pil vælger og meldes', udenValg && foersteMeldt && nulstillet && segK.join() === '7,30' && d.activeElement === sg.knapper[1]);
  tjek('K28: uden valgt (og med et ukendt id) er den første valgt som før', K.segment({ valg: [{ id: 'a', tekst: 'a' }, { id: 'b', tekst: 'b' }] }).valgt === 'a' && K.segment({ valgt: 'x', valg: [{ id: 'a', tekst: 'a' }, { id: 'b', tekst: 'b' }] }).valgt === 'a');

  // ── G1, G3, G5, G6: dialogen ──
  const vedLukS = [];
  let loes = null;
  const dlg = K.dialog({ id: 'dlg-ny', t: 'nyH', p: { t: 'nyP' }, fejl: true, udfyld: el => el.setAttribute('data-udfyldt', '1'), foer: d.createElement('svg'),
    knapper: [{ id: 'annuller', t: 'annuller' }, { id: 'opret', knapId: 'ny-opret', t: 'opret', variant: 'primary', ved: () => { const l = new Promise((ok, nej) => { loes = { ok, nej }; }); l.catch(() => {}); return l; } }], vedLuk: s => vedLukS.push(s) });
  const fejlEl = dlg.rod.querySelector('.modal-fejl');
  tjek('G3/G5: id på dialogen og <id>-h, <id>-p, <id>-fejl; knapId på knappen (svaret er stadig id); foer står først (.modal-foer), og overskriften navngiver stadig dialogen', dlg.rod.id === 'dlg-ny' && dlg.overskrift.id === 'dlg-ny-h' && dlg.rod.getAttribute('aria-labelledby') === 'dlg-ny-h' && dlg.rod.getAttribute('aria-describedby') === 'dlg-ny-p' && fejlEl.id === 'dlg-ny-fejl' && dlg.knap('opret').id === 'ny-opret' && dlg.knap('opret').dataset.svar === 'opret' && dlg.rod.firstElementChild.className === 'modal-foer' && dlg.rod.children[1].className === 'modal-top');
  tjek('G1: fejlfeltet er <p class="modal-fejl" role="alert"> lige før fodlinjen og tomt', fejlEl.getAttribute('role') === 'alert' && fejlEl.nextElementSibling.className === 'modal-fod' && fejlEl.textContent === '');
  dlg.aabn();
  dlg.fejl({ t: 'fejlNavn' });
  const noegle = fejlEl.getAttribute('data-t') === 'fejlNavn' && fejlEl.getAttribute('data-udfyldt') === '1';
  dlg.fejl('Navnet findes.');
  const tekst = fejlEl.textContent === 'Navnet findes.' && !fejlEl.hasAttribute('data-t');
  dlg.fejl(null);
  tjek('G1: d.fejl sætter en nøgle (og kalder udfyld) eller en tekst; d.fejl(null) rydder', noegle && tekst && fejlEl.textContent === '' && !fejlEl.hasAttribute('data-t'));
  const opret = dlg.knap('opret');
  opret.click();
  const venter = opret.getAttribute('aria-busy') === 'true' && opret.getAttribute('aria-disabled') === 'true' && dlg.aaben;
  const l1 = loes;
  opret.click();
  const ikkeIgen = loes === l1;
  l1.nej(new Error('Sagen findes allerede.'));
  await vent(0);
  const afvist = dlg.aaben && fejlEl.textContent === 'Sagen findes allerede.' && !opret.hasAttribute('aria-busy') && !opret.hasAttribute('aria-disabled');
  opret.click();
  loes.ok(false);
  await vent(0);
  const falsk = dlg.aaben;
  opret.click();
  loes.ok(true);
  await vent(0);
  tjek('G1: et løfte fra ved: knappen venter (aria-busy, aria-disabled) og kan ikke trykkes igen; afvist: åben med fejlen; false: åben; true: lukket med knappens svar', venter && ikkeIgen && afvist && falsk && !dlg.aaben && vedLukS.join() === 'opret');
  dlg.aabn();
  dlg.fejl('x');
  dlg.luk();
  dlg.aabn();
  tjek('G1: aabn() rydder fejlen; uden fejl: true findes d.fejl ikke', fejlEl.textContent === '' && dlg.luk() === undefined && !('fejl' in K.dialog({ t: 'a' })));
  const gr = d.createElement('div');
  const gh = d.createElement('h2');
  gh.id = 'gd-h';
  gh.tabIndex = -1;
  gr.appendChild(gh);
  const fldIGuide = d.createElement('input');
  gr.appendChild(fldIGuide);
  const gSvar = [];
  const gd = K.dialog({ guide: true, ariaLabelledby: 'gd-h', indhold: gr, vedLuk: s => gSvar.push(s) });
  gd.aabn();
  const fokusGuide = d.activeElement === gh;
  gd.rod.dispatchEvent(new w.Event('cancel'));
  gd.rod.close('esc');
  gd.aabn();
  gd.luk();
  tjek('G6: guide: true giver <dialog class="modal modal-guide"> uden overskrift, sætning og fod; navngivet af guidens overskrift; fokus på den; Esc og luk() meldes som i de andre', gd.rod.className === 'modal modal-guide' && gd.rod.getAttribute('aria-labelledby') === 'gd-h' && !gd.rod.querySelector('.modal-top, .modal-tekst, .modal-fod') && gd.overskrift === null && gd.indhold.firstChild === gr && fokusGuide && gSvar.join() === 'esc,kode');
  tjek('G6: en guide uden ariaLabelledby, eller med knapper, sætning eller lukkeknap, giver en fejl', /guidens overskrift \(ariaLabelledby\)/.test(fejlAf(() => K.dialog({ guide: true }))) && /egne knapper/.test(fejlAf(() => K.dialog({ guide: true, ariaLabelledby: 'x', knapper: [{ id: 'a' }] }))) && /egne knapper/.test(fejlAf(() => K.dialog({ guide: true, ariaLabelledby: 'x', p: 'p' }))));
  tjek('G1/G5/G6 (CSS): fejlfeltet i danger og skjult, når det er tomt; guiden 820 px uden luft (også delt med trinnet); en ventende knap har markøren progress', /\.modal-fejl \{[^}]*color: var\(--danger\);/.test(css) && /\.modal-fejl:empty \{ display: none; \}/.test(css) && /\.modal\.modal-guide \{ width: min\(820px, calc\(100vw - 2 \* var\(--space-6\)\)\); padding: 0; \}/.test(css) && /:root\[data-tekst="stor"\] \.modal\.modal-guide \{ width: min\(820px, calc\(100vw \/ 1\.125 - 48px\)\); \}/.test(css) && /\.modal \.btn\[aria-busy="true"\] \{ cursor: progress; \}/.test(css));

  // ── G2: bekræftelse, der kan fejle ──
  let sletLoes = null;
  const bSvar = K.bekraeft({ t: 'sletH', p: 'p', nej: { t: 'nej' }, ja: { t: 'ja' }, farlig: true, ved: () => new Promise((ok, nej) => { sletLoes = { ok, nej }; }) });
  const bRod = [...d.querySelectorAll('dialog[open]')].at(-1);
  const ja = bRod.querySelector('[data-svar="ja"]'), bFejl = bRod.querySelector('.modal-fejl');
  ja.click();
  const bVenter = ja.getAttribute('aria-busy') === 'true';
  await vent(0);
  sletLoes.nej('Sagen kunne ikke slettes.');
  await vent(0);
  const bAaben = bRod.hasAttribute('open') && Boolean(bFejl) && bFejl.textContent === 'Sagen kunne ikke slettes.';
  ja.click();
  await vent(0);
  sletLoes.ok();
  const svarB = await bSvar;
  tjek('G2: Kit.bekraeft med ved: ja venter; afvist: åben med fejlen i et felt med role="alert"; opfyldt: lukket, fjernet og true', bVenter && bAaben && Boolean(bFejl) && bFejl.getAttribute('role') === 'alert' && svarB === true && !bRod.isConnected);
  const uden = K.bekraeft({ t: 'h', p: 'p', nej: { t: 'nej' }, ja: { t: 'ja' } });
  const uRod = [...d.querySelectorAll('dialog[open]')].at(-1);
  const udenFejl = !uRod.querySelector('.modal-fejl');
  uRod.querySelector('[data-svar="ja"]').click();
  tjek('G2: uden ved er Kit.bekraeft som før (intet fejlfelt, ja lukker straks og giver true)', udenFejl && (await uden) === true);

  // ── K31: navn uden for komponenten ──
  const rgU = K.radiogruppe({ ariaLabelledby: 'raekke-tema', vandret: true, valg: [{ id: 'a', tekst: 'A' }, { id: 'b', tekst: 'B' }], valgt: 'b', hjaelp: 'Note' });
  const vlU = K.valgliste({ ariaLabelledby: 'raekke-sprog', valg: [{ id: 'da', tekst: 'Dansk' }] });
  const tfU = K.kontakt({ ariaLabelledby: 'raekke-auto', til: true, ord: { til: 'Til', fra: 'Fra' } });
  const rgA = K.radiogruppe({ etiket: null, aria: 'Tema', valg: [{ id: 'a', tekst: 'A' }] });
  tjek('K31: radiogruppe med ariaLabelledby er <div class="valgsaet vandret" role="radiogroup" aria-labelledby> uden <legend> (hjælpen med aria-describedby); etiket: null med aria giver aria-label', rgU.rod.tagName === 'DIV' && rgU.rod.className === 'valgsaet vandret' && rgU.rod.getAttribute('role') === 'radiogroup' && rgU.rod.getAttribute('aria-labelledby') === 'raekke-tema' && !rgU.rod.querySelector('legend') && rgU.inputs.length === 2 && rgU.valgt === 'b' && rgU.rod.getAttribute('aria-describedby') && rgA.rod.getAttribute('aria-label') === 'Tema' && rgA.rod.getAttribute('role') === 'radiogroup');
  tjek('K31: valgliste med ariaLabelledby har ingen <label> (select har aria-labelledby); kontakt har ingen synlig tekst (input har aria-labelledby), ordene står der stadig', !vlU.rod.querySelector('label') && vlU.select.getAttribute('aria-labelledby') === 'raekke-sprog' && tfU.input.getAttribute('aria-labelledby') === 'raekke-auto' && !tfU.rod.querySelector('.afk-tekst') && tfU.rod.querySelector('.tilfra-ord') && tfU.input.getAttribute('role') === 'switch');
  tjek('K31: uden noget navn (etiket: null) og med to navne giver det en fejl i alle tre', ['radiogruppe', 'valgliste'].every(f => /skal have et navn/.test(fejlAf(() => K[f]({ etiket: null, valg: [] }))) && /ikke begge/.test(fejlAf(() => K[f]({ etiket: 'X', ariaLabelledby: 'y', valg: [] })))) && /skal have et navn/.test(fejlAf(() => K.kontakt({ etiket: null }))) && /ikke begge/.test(fejlAf(() => K.kontakt({ tekst: 'X', ariaLabelledby: 'y' }))));

  // ── K32: kassens ikon ──
  const ks = K.kasse({ t: 'h', ikon: 'laas' });
  tjek('K32: ikon står foran overskriften (svg.kasse-ikon, aria-hidden), og overskriften navngiver stadig kassen; CSS: 18 px i accent', ks.rod.querySelector('.kasse-top').firstElementChild.getAttribute('class') === 'kasse-ikon' && ks.rod.querySelector('.kasse-ikon').getAttribute('aria-hidden') === 'true' && ks.rod.querySelector('.kasse-ikon').nextElementSibling === ks.overskrift && ks.rod.getAttribute('aria-labelledby') === ks.overskrift.id && /\.kasse-ikon \{ width: 18px; height: 18px;[^}]*stroke: var\(--accent\);/.test(css));

  // ── K33 og K35: fliserne ──
  const fk = [];
  const fv = K.statusflise({ t: 'n', tal: 2, valgt: true, ved: () => fk.push('flise') });
  const fd = K.statusflise({ t: 'n', tal: 2, valgt: 'date' });
  tjek('K33: valgt giver aria-current på målet (true, eller værdien, fx date)', fv.getAttribute('aria-current') === 'true' && fv.tagName === 'BUTTON' && fd.getAttribute('aria-current') === 'date');
  const f2 = K.statusflise({ t: 'n', tal: 12, status: { variant: 'warn', t: 's' }, valgt: true, ariaT: 'fAria', ved: () => fk.push('flise'), under: { t: 'iDag', ariaT: 'iDagAria', ved: () => fk.push('under') } });
  d.body.appendChild(f2);
  const m2 = f2.querySelector('.sflise-maal'), u2 = f2.querySelector('.sflise-under-maal');
  tjek('K33: under: { t, ved } giver <div class="sflise sflise-to warn"> med to knapper ved siden af hinanden (aldrig knap i knap): målet (navn, tal, chip; aria og aria-current) og underteksten (eget navn)', f2.tagName === 'DIV' && f2.className === 'sflise sflise-to warn' && [...f2.children].map(c => c.tagName + '.' + c.className).join() === 'BUTTON.sflise-maal,BUTTON.sflise-under sflise-under-maal' && !m2.querySelector('button') && !u2.querySelector('button') && [...m2.children].map(c => c.className).join() === 'sflise-navn,sflise-tal,chip warn' && m2.getAttribute('data-t-aria') === 'fAria' && m2.getAttribute('aria-current') === 'true' && !f2.hasAttribute('aria-current') && u2.getAttribute('data-t') === 'iDag' && u2.getAttribute('data-t-aria') === 'iDagAria' && u2.type === 'button');
  m2.click(); u2.click();
  tjek('K33: hvert mål kalder sit eget ved; to Tab-stop i rækkefølgen flise, undertekst', fk.join() === 'flise,under' && [...f2.querySelectorAll('button')].length === 2 && f2.querySelector('button') === m2);
  const dat = d.createElement('div');
  const lnk = d.createElement('button');
  dat.appendChild(lnk);
  const f3 = K.statusflise({ t: 'set', indhold: dat });
  tjek('K35: indhold står, hvor tallet ellers står (.sflise-indhold), og flisen er en div; indhold med egne mål i en flise, der selv er et mål, giver en fejl', f3.tagName === 'DIV' && [...f3.children].map(c => c.className).join() === 'sflise-navn,sflise-indhold' && f3.querySelector('.sflise-indhold').firstChild === dat && !f3.querySelector('.sflise-tal') && /egne mål/.test(fejlAf(() => K.statusflise({ t: 'x', indhold: dat, ved: () => {} }))) && !fejlAf(() => K.statusflise({ t: 'x', indhold: d.createElement('span'), ved: () => {} })));
  tjek('K33 (CSS): valgt har blød accentflade, kant og indre streg i accent (stregen til venstre beholder statussens farve), også når målet er inde i flisen; målet dækker flisen (::after) med fokusringen; underteksten ligger ovenpå i info, understreget', /\.sflise\[aria-current\]:not\(\[aria-current="false"\]\),\n\.sflise:has\(> \.sflise-maal\[aria-current\]:not\(\[aria-current="false"\]\)\) \{\n  background: var\(--accent-soft\); border-top-color: var\(--accent\); border-right-color: var\(--accent\); border-bottom-color: var\(--accent\);\n  box-shadow: inset 0 0 0 1px var\(--accent\);\n\}/.test(css) && /\.sflise-maal::after \{ content: ""; position: absolute; inset: 0;/.test(css) && /\.sflise-maal:focus-visible::after \{ outline: 2px solid var\(--info\);/.test(css) && /\.sflise-under-maal \{[^}]*position: relative; z-index: 1;[^}]*color: var\(--info\); text-decoration: underline;/.test(css) && /\.sflise-to \{ position: relative; \}/.test(css) && !/border-left-color: var\(--accent\)/.test(css));

  // ── K34: filter, der kan fjernes ──
  const rm = d.createElement('div');
  rm.className = 'fchips';
  d.body.appendChild(rm);
  const fjernet = [];
  const lav = (id, t) => { const ch = K.filterchip({ id, tekst: t, ariaT: 'fjernFilter', ariaV: t, vedFjern: x => { fjernet.push(x); ch.remove(); } }); rm.appendChild(ch); return ch; };
  const c1 = lav('land', 'Danmark'), c2 = lav('dato', '1.–4. november');
  tjek('K34: én knap (.fchip.fchip-fjern) med ordet og et × (svg.fchip-x, aria-hidden), navn fra programmet (data-t-aria, data-v), uden aria-pressed', c1.tagName === 'BUTTON' && c1.className === 'fchip fchip-fjern' && c1.dataset.chip === 'land' && c1.firstElementChild.textContent === 'Danmark' && c1.lastElementChild.getAttribute('class') === 'fchip-x' && c1.lastElementChild.getAttribute('aria-hidden') === 'true' && c1.getAttribute('data-t-aria') === 'fjernFilter' && c1.getAttribute('data-v') === 'Danmark' && !c1.hasAttribute('aria-pressed'));
  c1.focus();
  c1.click();
  const naboFokus = d.activeElement === c2;
  c2.click();
  tjek('K34: et klik kalder vedFjern(id); var chippen fokuseret og er den væk, får nabochippen fokus', fjernet.join() === 'land,dato' && naboFokus);
  tjek('K34: et filter, der kan fjernes, uden navn giver en fejl; den almindelige filterchip er uændret (aria-pressed)', /skal have et navn/.test(fejlAf(() => K.filterchip({ tekst: 'x', vedFjern: () => {} }))) && K.filterchip({ tekst: 'x' }).getAttribute('aria-pressed') === 'false');
  tjek('K34 (CSS): blød accentflade, kant i accent og fed skrift; under musen streges ordet over (ikke kun farve); × 14 px', /\.fchip-fjern \{[^}]*background: var\(--accent-soft\); border-color: var\(--accent\); font-weight: 600; \}/.test(css) && /\.fchip-fjern:hover > span \{ text-decoration: line-through; \}/.test(css) && /\.fchip-x \{ width: 14px; height: 14px;/.test(css));

  // ── G7: afkrydsning i en tabelrække ──
  const afkS = [];
  const a7 = K.afkrydsning({ ariaT: 'ariaMasker', ariaV: '192.0.2.17', valgt: true, vedSkift: v => afkS.push(v) });
  d.body.appendChild(a7.rod);
  a7.input.click();
  tjek('G7: aria uden tekst giver boksen alene (<input class="afk-boks"> = rod, 16 px fra .afk-boks), med navn og data-v; vedSkift virker', a7.rod === a7.input && a7.rod.outerHTML === '<input type="checkbox" class="afk-boks" data-t-aria="ariaMasker" data-v="192.0.2.17">' && afkS.join() === 'false' && a7.valgt === false && /\.afk-boks \{[^}]*width: 16px; height: 16px;/.test(css) && /\.tabel td input\.afk-boks \{ width: 16px; height: 16px; padding: 0; margin: 0; \}/.test(css));
  tjek('G7: hjælp eller fejl uden synlig tekst giver en fejl; aria med tekst er som før (rækken med tekst)', /kræver en synlig tekst/.test(fejlAf(() => K.afkrydsning({ aria: 'x', fejl: 'f' }))) && K.afkrydsning({ aria: 'x', tekst: 'Y' }).rod.className === 'afk-felt');

  // ── G8: tom tilstand ──
  const tomS = [];
  const tm = K.tomTilstand({ ikon: 'indsaet', t: 'h', p: { t: 'p' }, handling: { t: 'aabn', ved: () => tomS.push('aabn') }, anden: { t: 'sager', variant: 'ghost', ved: () => tomS.push('sager') }, modtager: { ariaT: 'ariaIndsaet', ariaV: '⌘V', vedIndsaet: t => tomS.push('indsat:' + t) } });
  d.body.appendChild(tm);
  tjek('G8: modtager giver .tomt.tomt-modtager med tabindex 0, role="region" og navn (data-t-aria, data-v); to handlinger i .tomt-handlinger (den anden er ikke primær)', tm.className === 'tomt tomt-modtager' && tm.tabIndex === 0 && tm.getAttribute('role') === 'region' && tm.getAttribute('data-t-aria') === 'ariaIndsaet' && tm.getAttribute('data-v') === '⌘V' && tm.querySelector('.tomt-handlinger').children.length === 2 && tm.querySelector('.tomt-handlinger .btn.ghost') && !tm.querySelector('.tomt-handlinger .btn.primary'));
  const ind = new w.Event('paste', { bubbles: true, cancelable: true });
  ind.clipboardData = { getData: type => (type === 'text/plain' ? 'logtekst' : '') };
  tm.dispatchEvent(ind);
  const traek = new w.Event('dragover', { bubbles: true, cancelable: true });
  traek.dataTransfer = { types: ['Files'] };
  tm.dispatchEvent(traek);
  tm.querySelectorAll('.btn').forEach(b => b.click());
  tjek('G8: indsæt kalder vedIndsaet med teksten; kittet tager ikke imod et træk (ingen preventDefault, ingen .tomt-slip): det gør programmet; begge handlinger virker', ind.defaultPrevented && !traek.defaultPrevented && !tm.classList.contains('tomt-slip') && tomS.join() === 'indsat:logtekst,aabn,sager');
  tjek('G8: kittet har intet fil-API (FileReader, dataTransfer.files, input type=file), som programmernes webvisning kan forbyde (Grimnirs UI-test gør)', !/FileReader|dataTransfer\.files|type=["']file["']|\.files\b/.test(kitJs));
  tjek('G8: den lille udgave kan ikke tage imod; modtager uden navn, anden uden den første og en primær anden giver en fejl', /lille udgave/.test(fejlAf(() => K.tomTilstand({ lille: true, t: 'h', modtager: { aria: 'x' } }))) && /skal have et navn/.test(fejlAf(() => K.tomTilstand({ t: 'h', modtager: {} }))) && /kræver den første/.test(fejlAf(() => K.tomTilstand({ t: 'h', anden: { t: 'a' } }))) && /ikke være primær/.test(fejlAf(() => K.tomTilstand({ t: 'h', handling: { t: 'a' }, anden: { t: 'b', variant: 'primary' } }))));
  tjek('G8 (CSS): to handlinger side om side; modtageren har runde hjørner til fokusringen; .tomt-slip er en stiplet kant i accent og en blød flade (ikke kun farve)', /\.tomt-handlinger \{ display: flex;/.test(css) && /\.tomt-modtager \{ border-radius: var\(--radius-md\); \}/.test(css) && /\.tomt-modtager\.tomt-slip \{ outline: 2px dashed var\(--accent\); outline-offset: -2px; background: var\(--accent-soft\); \}/.test(css));

  // ── G10: --tekst-zoom ──
  tjek('G10: --tekst-zoom er 1 på roden, .9 ved lille og 1.125 ved stor (sat ved siden af zoom); zoom-reglerne er uændrede', /:root \{ --tekst-zoom: 1; \}/.test(css) && /:root\[data-tekst="lille"\] \{ --tekst-zoom: \.9; \}/.test(css) && /:root\[data-tekst="stor"\] \{ --tekst-zoom: 1\.125; \}/.test(css) && /:root\[data-tekst="lille"\] \{ zoom: \.9; \}/.test(css) && /:root\[data-tekst="stor"\] \{ zoom: 1\.125; \}/.test(css));
  const tz = afsnitAf('Tekststørrelse');
  tjek('G10: KOMPONENTER.md (Tekststørrelse) siger, at @media og @container ikke følger zoom, og hvad et program gør (grænse pr. trin, --tekst-zoom i JavaScript)', /\*\*`@media` og `@container` følger ikke `zoom`\*\*/.test(tz) && /`--tekst-zoom`/.test(tz) && /1350px/.test(tz) && /getPropertyValue\('--tekst-zoom'\)/.test(tz));

  // ── G11: hvorfor i båndet ──
  const bd = d.createElement('div');
  d.body.appendChild(bd);
  const b11 = K.commandBar(bd, { hvorforTip: true, udenFaner: true, faner: [{ id: 'a', t: 'a', grupper: [{ t: 'g', knapper: [{ id: 'k', t: 'k', ikon: 'kopier', deaktiveret: true, hvorfor: 'hv' }, { id: 'l', t: 'l', ikon: 'kopier' }] }] }] });
  const kk = b11.knap('k');
  const tip11 = d.getElementById(kk.getAttribute('aria-describedby'));
  tjek('G11: hvorforTip: hvorfor står i et værktøjstip (role="tooltip", data-t) og ikke i title; knappen er stadig aria-disabled', kk.getAttribute('aria-disabled') === 'true' && !kk.hasAttribute('data-t-title') && tip11 && tip11.getAttribute('role') === 'tooltip' && tip11.getAttribute('data-t') === 'hv' && kk.parentElement.className === 'tip-plads');
  b11.saetDeaktiveret('k', false);
  const slaaet = !kk.hasAttribute('aria-disabled') && !kk.hasAttribute('aria-describedby') && !bd.querySelector('.tip') && kk.parentElement.className === 'kn';
  b11.saetDeaktiveret('l', true, 'hv2');
  tjek('G11: saetDeaktiveret slår til (tippet væk) og fra med hvorfor (nyt tip); en ukendt kommando giver en fejl', slaaet && b11.knap('l').getAttribute('aria-disabled') === 'true' && d.getElementById(b11.knap('l').getAttribute('aria-describedby')).getAttribute('data-t') === 'hv2' && /ukendt kommando/.test(fejlAf(() => b11.saetDeaktiveret('x', true))));
  const bu = d.createElement('div');
  const bUden = K.commandBar(bu, { faner: [{ id: 'a', t: 'a', grupper: [{ t: 'g', knapper: [{ id: 'k', t: 'k', ikon: 'kopier' }] }] }] });
  bUden.saetDeaktiveret('k', true, 'hv');
  const medTitel = bUden.knap('k').getAttribute('data-t-title') === 'hv' && !bu.querySelector('.tip');
  bUden.knap('k').setAttribute('title', 'Hvorfor');
  bUden.saetDeaktiveret('k', false);
  tjek('G11: uden indstillingen flytter saetDeaktiveret hvorfor i data-t-title (og fjerner title igen)', medTitel && !bUden.knap('k').hasAttribute('data-t-title') && !bUden.knap('k').hasAttribute('title') && !bUden.knap('k').hasAttribute('aria-disabled'));

  // Værktøjstippets nye saetTekst og fjern.
  const tm2 = d.createElement('button');
  const pl = d.createElement('div');
  pl.appendChild(tm2);
  d.body.appendChild(pl);
  tm2.setAttribute('aria-describedby', 'andet');
  const tp = K.vaerktoejstip(tm2, { t: 'a' });
  tp.saetTekst({ t: 'b' });
  const nyT = tp.tip.getAttribute('data-t') === 'b';
  tp.fjern();
  tjek('Værktøjstip (2.5.0): saetTekst skifter teksten; fjern tager tippet væk, beholder et andet aria-describedby og pakker kittets .tip-plads ud', nyT && !tp.tip.isConnected && tm2.getAttribute('aria-describedby') === 'andet' && tm2.parentElement === pl && !pl.querySelector('.tip-plads'));

  // ── G9 og G4: dokumentationen ──
  const dlgMd = afsnitAf('Dialog'), tomMd = afsnitAf('Tom tilstand');
  tjek('G9: eksemplerne i KOMPONENTER.md for Tom tilstand, Dialog og Kit.bekraeft bruger p: { t: … } (en streng er færdig tekst); demoen gør det samme; koden læser stadig en streng som tekst', !/\bp: '[a-zA-Z]+'/.test(dlgMd + tomMd) && /p: \{ t: 'tomSagerP' \}/.test(tomMd) && /p: \{ t: 'sletP' \}/.test(dlgMd) && !/K\.(?:tomTilstand|dialog|bekraeft)\(\{[^)]*\bp: '/.test(pk('demo/demo.js')) && K.tomTilstand({ t: 'h', p: 'Færdig tekst' }).querySelector('.tomt-p').textContent === 'Færdig tekst');
  tjek('G4: reglen for et spørgsmål med tre svar står under Dialog (rækkefølge, fokus aldrig på den farlige, skjulte knapper tæller ikke)', /### Et spørgsmål med tre svar \(regel, fra 2\.5\.0, G4\)/.test(dlgMd) && /\*\*Annullér, den farlige, den primære\*\*/.test(dlgMd) && /aldrig på den farlige/.test(dlgMd) && /\*\*tæller ikke med\*\*/.test(dlgMd));

  // ── Pakken ──
  const log = pk('CHANGELOG.md');
  const a250 = log.slice(log.indexOf('## 2.5.0'), log.indexOf('## 2.4.0'));
  tjek('CHANGELOG 2.5.0: første post med kun dato; Nyt og Ændret; alle ønsker nævnt; K28, G1 og G9 under Ændret; intet omdøbt eller fjernet', log.indexOf('## 2.5.0 — 2026-11-12') > 0 && log.indexOf('## 2.5.0') < log.indexOf('## 2.4.0') && /### Nyt[\s\S]*### Ændret/.test(a250) && ['K22', 'K23', 'K24', 'K25', 'K26', 'K31', 'K32', 'K33', 'K34', 'K35', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G10', 'G11'].every(k => a250.slice(0, a250.indexOf('### Ændret')).includes('(' + k) || a250.slice(0, a250.indexOf('### Ændret')).includes(k + ')') || a250.slice(0, a250.indexOf('### Ændret')).includes(', ' + k)) && ['(K28)', '(G1)', '(G9)'].every(k => a250.slice(a250.indexOf('### Ændret')).includes(k)) && /Intet er omdøbt eller fjernet/.test(a250) && a250.includes('`Kit.fodstatus`'));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K22–K26, K28 og K31–K35 står som opfyldt i 2.5.0; K27 kræver 3.0.0; navnene, der afviger, står der', ['K22', 'K23', 'K24', 'K25', 'K26', 'K28', 'K31', 'K32', 'K33', 'K34', 'K35'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.5\\.0 \\|').test(hm)) && /opfyldt med 2\.5\.0\*\*, undtagen \*\*K27\*\*/.test(hm) && ['`Kit.fodstatus`', '`kunBrugerValg`', '`.ant-kraever`', '`.fchip-fjern`'].every(n => hm.includes(n)) && !/Venter på 2\.5\.0/.test(hm));
  tjek('README 2.5.0: indholdslisten nævner Kit.fodstatus; afsnittet om, hvad Grimnir selv kan skifte til (dialogerne, afkrydsningen, den tomme tilstand, --tekst-zoom)', /fra 2\.5\.0 `Kit\.fodstatus`/.test(readme) && /### Det, Grimnir selv kan skifte til \(fra 2\.5\.0\)/.test(readme) && ['`fejl: true`', '`Kit.afkrydsning({ ariaT, ariaV })`', '`modtager: { ariaT, ariaV }`', '`--tekst-zoom`', 'guide: true, ariaLabelledby'].every(o => readme.includes(o)));
  tjek('KOMPONENTER.md: hver ny indstilling har sit afsnit (fra 2.5.0) under sin komponent', [['AppShell', 'K22'], ['AppShell', 'K23'], ['CommandBar', 'G11'], ['NavPane', 'K24'], ['NavPane', 'K26'], ['StatusFooter', 'K25'], ['Segmentknap', 'K28'], ['Filterchip', 'K34'], ['Kasse', 'K32'], ['StatusTile', 'K33'], ['StatusTile', 'K35'], ['Tom tilstand', 'G8'], ['Afkrydsning', 'G7'], ['Radiogruppe', 'K31'], ['Dialog', 'G1'], ['Dialog', 'G2'], ['Dialog', 'G6'], ['Tekststørrelse', 'G10']].every(([a, k]) => afsnitAf(a).includes(k)));
}
{
  // Demoen 2.5.0 med pakkens rigtige filer, i begge sprog og temaer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function (v) { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); if (v !== undefined) this.returnValue = v; this.dispatchEvent(new w.Event('close')); };
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const tekst = id => d.getElementById(id).textContent;
  const titel = d.getElementById('demo-titel250');
  tjek('demo 2.5.0 (K22, K23): titellinjen har en maske som mærke og tre knapper: frem slået fra, tandhjulet med aria-current og hjælp med aria-expanded (dansk)', titel.querySelector('.mrk-maske.demo-maske[aria-hidden="true"]') && titel.querySelector('.rk:disabled').getAttribute('aria-label') === 'Frem' && titel.querySelector('.rk[aria-current="page"]').getAttribute('aria-label') === 'Indstillinger' && titel.querySelector('.rk[aria-expanded="true"]').getAttribute('aria-label') === 'Hjælp');
  titel.querySelector('.rk[aria-expanded]').click();
  tjek('demo 2.5.0 (K23): et klik på hjælp skifter aria-expanded og melder det', titel.querySelector('.rk[aria-expanded]').getAttribute('aria-expanded') === 'false' && tekst('titel250-valgt') === 'Valgt: Hjælp: panelet er lukket');
  const kop = d.querySelector('#demo-baand-tip [data-kommando="kopier"]');
  tjek('demo 2.5.0 (G11): Kopiér er slået fra med hvorfor i et værktøjstip (dansk)', kop.getAttribute('aria-disabled') === 'true' && d.getElementById(kop.getAttribute('aria-describedby')).textContent === 'Vælg en række i tabellen først' && !kop.hasAttribute('title'));
  d.querySelector('#demo-baand-tip-knapper .btn').click();
  tjek('demo 2.5.0 (G11): knappen slår Kopiér til (tippet væk)', !kop.hasAttribute('aria-disabled') && !d.querySelector('#demo-baand-tip .tip'));
  const sk = d.getElementById('demo-skift250');
  const ang = sk.querySelector('[data-visning="angreb"]'), sid = sk.querySelector('[data-visning="siden"]');
  ang.click();
  tjek('demo 2.5.0 (K24): Siden sidst har et tal, der kræver handling (skjult tekst "3 kræver handling"); Angreb er slået fra med et værktøjstip, og et klik gør intet', sid.querySelector('.ant-kraever').textContent === '3' && sid.querySelector('.skjult-tekst').textContent === '3 kræver handling' && ang.getAttribute('aria-disabled') === 'true' && d.getElementById(ang.getAttribute('aria-describedby')).textContent === 'Kræver en API-nøgle under Indstillinger.' && !ang.classList.contains('on'));
  const knapper = [...d.querySelectorAll('#demo-nav250-knapper .btn')];
  const tu = d.getElementById('demo-trae250');
  tu.querySelector('[data-punkt="shop.eksempel.dk"]').click();
  const efterKlik = tekst('nav250-valgt');
  knapper[0].click();
  tjek('demo 2.5.0 (K26): træet melder brugerens valg; Byg om giver fire domæner, beholder valget og melder intet', efterKlik === 'Valgt: shop.eksempel.dk' && tu.querySelectorAll('.tr').length === 5 && tu.querySelector('.tr.on').dataset.punkt === 'shop.eksempel.dk' && tekst('nav250-valgt') === 'Valgt: shop.eksempel.dk' && tu.querySelector('[data-punkt="samlet"] .ant').textContent === '4');
  knapper[1].click();
  tjek('demo 2.5.0 (K24): Angreb slås til (intet tip), og et klik markerer den', !ang.hasAttribute('aria-disabled') && (ang.click(), ang.classList.contains('on')) && tekst('nav250-valgt') === 'Valgt: Angreb');
  const fod = d.getElementById('demo-fod250');
  const fk = [...d.querySelectorAll('#demo-fod250-knapper .btn')];
  tjek('demo 2.5.0 (K25): fodlinjen har statusdelen (henter, 3 af 8, knap "Åbn Overblik") og antallet (dansk)', fod.querySelector('.fodstatus').dataset.status === 'henter' && fod.querySelector('.fodstatus-bjaelke').value === 3 && fod.querySelector('.fodstatus-meld').textContent === 'Henter …' && fod.querySelector('button.fodstatus-maal .skjult-tekst').textContent === 'Åbn Overblik');
  fk[0].click(); fk[2].click();
  tjek('demo 2.5.0 (K25): et trin flytter linjen; Færdig giver ok, ny tekst og ingen knap', fod.querySelector('.fodstatus').dataset.status === 'ok' && fod.querySelector('.fodstatus-meld').textContent === 'Alt er hentet' && fod.querySelector('.fodstatus-maal').tagName === 'SPAN' && fod.querySelector('.fodstatus-bjaelke').hidden);
  const fl = d.getElementById('demo-fliser250');
  const [mI, mD] = [fl.querySelector('.sflise-maal'), fl.querySelector('button.sflise')];
  mD.click();
  tjek('demo 2.5.0 (K33, K35): tre fliser: valgt med to mål, en almindelig og en med to datoer; et klik flytter aria-current', fl.querySelectorAll('.sflise').length === 3 && fl.querySelector('.sflise-to .sflise-under-maal').textContent === 'I dag hidtil: 3' && mD.getAttribute('aria-current') === 'true' && !mI.hasAttribute('aria-current') && fl.querySelectorAll('.sflise-indhold .demo-tal').length === 2 && tekst('fliser250-valgt') === 'Valgt: Afvist i dag');
  tjek('demo 2.5.0 (K32): kassen har et ikon foran overskriften', d.querySelector('#demo-kasser250 .kasse-top .kasse-ikon + h3').textContent === 'Lås');
  const tom = d.querySelector('#demo-tom250 .tomt');
  tjek('demo 2.5.0 (G8): den tomme flade tager imod (fokus, navn "Indsæt tekst med ⌘V") og har to handlinger; sætningen er teksten, ikke nøglen (G9)', tom.tabIndex === 0 && tom.getAttribute('aria-label') === 'Indsæt tekst med ⌘V' && tom.querySelectorAll('.tomt-handlinger .btn').length === 2 && tom.querySelector('.tomt-p').textContent === 'Klik her og tryk ⌘V.' && d.querySelector('#demo-tom-stor .tomt-p').textContent !== 'tomSagerP' && d.querySelector('#demo-tom-stor .tomt-p').textContent.length > 20);
  const dk = [...d.querySelectorAll('#demo-dialog250 .btn')];
  dk[0].click();
  const ny = d.getElementById('demo-dlg-ny');
  const opret = d.getElementById('demo-dlg-ny-opret');
  opret.click();
  const venter = opret.getAttribute('aria-busy') === 'true';
  await vent(450);
  const fejlVist = ny.hasAttribute('open') && ny.querySelector('.modal-fejl').textContent === 'Der findes allerede en sag med det navn.';
  opret.click();
  await vent(450);
  tjek('demo 2.5.0 (G1, G3): Ny sag har id; første forsøg venter og fejler med teksten over fodlinjen; andet lukker dialogen', ny.getAttribute('aria-labelledby') === 'demo-dlg-ny-h' && venter && fejlVist && !ny.hasAttribute('open') && tekst('dialog250-valgt').includes('opret'));
  dk[2].click();
  const om = [...d.querySelectorAll('dialog[open]')].at(-1);
  tjek('demo 2.5.0 (G5): Om har fletbåndet over overskriften', om.firstElementChild.className === 'modal-foer' && om.querySelector('.modal-foer svg.flet') && om.querySelector('h2').textContent === 'Om demoen');
  om.close('luk');
  dk[3].click();
  const gd = [...d.querySelectorAll('dialog[open]')].at(-1);
  tjek('demo 2.5.0 (G6): guiden står i en bred dialog (modal-guide), navngivet af guidens overskrift, med fokus på den', gd.className === 'modal modal-guide' && gd.getAttribute('aria-labelledby') === 'demo-guide250-h' && d.activeElement === d.getElementById('demo-guide250-h') && gd.querySelector('.wiz'));
  gd.close('esc');
  dk[4].click();
  const tre = [...d.querySelectorAll('dialog[open]')].at(-1);
  tjek('demo 2.5.0 (G4): tre svar i rækkefølgen Annullér, Kassér (farlig), Gem som sag (primær); fokus på den primære', [...tre.querySelectorAll('.modal-fod .btn')].map(b => b.dataset.svar).join() === 'annuller,kasser,gem' && d.activeElement === tre.querySelector('[data-svar="gem"]'));
  tre.close('annuller');
  const sg = d.querySelector('#demo-segment250 .seg');
  tjek('demo 2.5.0 (K28): segmentknappen uden valg', [...sg.querySelectorAll('.seg-v')].every(b => b.getAttribute('aria-checked') === 'false'));
  const fc = () => [...d.querySelectorAll('#demo-fjern250 .fchip-fjern')];
  const foer = fc().length;
  fc()[0].click();
  tjek('demo 2.5.0 (K34): tre aktive filtre med navnet "Fjern filter: …"; et klik fjerner et', foer === 3 && fc().length === 2 && fc()[0].getAttribute('aria-label') === 'Fjern filter: shop.eksempel.dk' && tekst('fjern250-valgt') === 'Fjernet: Danmark');
  tjek('demo 2.5.0 (G7): tabellen har en afkrydsning pr. række med navnet "Maskér …"', [...d.querySelectorAll('#demo-afk250 tbody input.afk-boks')].map(i => i.getAttribute('aria-label')).join() === 'Maskér 192.0.2.17,Maskér 192.0.2.44,Maskér srv-app01.eksempel.dk');
  tjek('demo 2.5.0 (K31): tre rækker med etiketten til venstre: radiogruppe, valgliste og kontakt med aria-labelledby til den', d.querySelector('#demo-raekker250 [role="radiogroup"]').getAttribute('aria-labelledby') === 'demo-r-tema' && d.querySelector('#demo-raekker250 select').getAttribute('aria-labelledby') === 'demo-r-sprog' && d.querySelector('#demo-raekker250 input[role="switch"]').getAttribute('aria-labelledby') === 'demo-r-auto' && d.getElementById('demo-r-tema').textContent === 'Tema');
  tjek('demo 2.5.0 (G10): --tekst-zoom står på siden', /^--tekst-zoom er /.test(tekst('tekstzoom250')));
  w.Sprog.saet('en');
  tjek('demo 2.5.0 (English): de nye dele har tekst', d.querySelector('[data-t="h250Fod"]').textContent === 'Status with progress (from 2.5.0)' && sid.querySelector('.skjult-tekst').textContent === '3 require action' && fc()[0].getAttribute('aria-label') === 'Remove filter: Denmark' && tom.getAttribute('aria-label') === 'Paste text with ⌘V' && d.getElementById('demo-r-tema').textContent === 'Theme');
  w.Tema.saet('moerk');
  tjek('demo 2.5.0: mørkt tema sættes på siden med de nye dele', d.documentElement.getAttribute('data-tema') === 'moerk' && Boolean(d.querySelector('#demo-fod250 .fodstatus')));
  const da = Object.keys(w.Sprog.TEKST.da), en = Object.keys(w.Sprog.TEKST.en);
  tjek('demo 2.5.0: dansk og engelsk har de samme nøgler, og ingen nøgle på siden mangler', JSON.stringify(da.slice().sort()) === JSON.stringify(en.slice().sort()) && [...d.querySelectorAll('[data-t],[data-t-aria]')].every(e => ['data-t', 'data-t-aria'].every(a => !e.hasAttribute(a) || e.getAttribute(a) in w.Sprog.TEKST.da)));
}

// ── Pakke 2.6.0 (V-FANER.1): visningerne som faner øverst, NavPane uden visningsskift, valgt række under musen ──
{
  const css = pk('web/kit.css'), md = pk('KOMPONENTER.md'), readme = pk('README.md'), log = pk('CHANGELOG.md'), hm = pk('flytning/HUGINN-MUNINN.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return i < 0 ? '' : md.slice(i, md.indexOf('\n## ', i + 1)); };
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const fejlAf = f => { try { f(); return ''; } catch (e) { return String(e.message); } };
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  tjek('2.6.0: de nye klasser (V260_KLASSER) findes i kit.css, og der er ingen nye funktioner (Kit har stadig 34 navne)', V260_KLASSER.every(k => cssKlasser.has(k)) && V260_FUNKTIONER.length === 0 && Object.keys(ny().Kit).length === 34);

  // Huginn and Muninns opsætning og 2.5.0's CSS er uændrede.
  {
    const w = ny();
    const nu = bygV250(w.Kit, w.document);
    const forskel = Object.keys(V250_UDSEENDE).filter(k => nu[k] !== V250_UDSEENDE[k]);
    tjek(`2.6.0: uden faner bygger kittet ${Object.keys(V250_UDSEENDE).length} eksempler byte for byte som 2.5.0 (Huginn and Muninns visningsskift med otte visninger, genveje, tal og punkter slået fra, før og efter saetPunkt; båndet uden faner med hvorforTip; træet, der bygges om; tabel med valg; bånd med to faner)`, Object.keys(V250_UDSEENDE).length === 7 && forskel.length === 0, forskel.join(', '));
    const regler = [];
    const ren = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let dybde = 0, start = 0;
    for (let i = 0; i < ren.length; i++) {
      if (ren[i] === '{') dybde++;
      else if (ren[i] === '}') { dybde--; if (dybde === 0) { regler.push(ren.slice(start, i + 1).replace(/\s+/g, ' ').trim()); start = i + 1; } }
    }
    const nuH = new Set(regler.map(r => crypto.createHash('sha256').update(r).digest('hex').slice(0, 12)));
    const borte = V250_CSS.filter(h => !nuH.has(h));
    tjek(`2.6.0: alle ${V250_CSS.length} regelsæt i 2.5.0's kit.css står uændrede (kun tilføjelser; i alt ${regler.length})`, V250_CSS.length === 409 && borte.length === 0 && regler.length >= 428, borte.length + ' ændret eller fjernet');
  }

  // ── Fanerne ──
  const w = ny(), d = w.document, K = w.Kit;
  const rod = d.createElement('div');
  d.body.appendChild(rod);
  const VIS = [
    { id: 'a', tekst: 'Maskér', ikon: 'mappe', genvej: '⌘1', genvejAria: 'Meta+1', panel: 'p-a' },
    { id: 'b', tekst: 'Demaskér', ikon: 'oeje', genvej: '⌘2', genvejAria: 'Meta+2', antal: 3, kraever: true, antalAriaT: 'kraever' },
    { id: 'c', tekst: 'Sager', ikon: 'mappe', genvej: '⌘3', genvejAria: 'Meta+3', deaktiveret: true, hvorfor: 'hvorforToken' },
    { id: 'e', t: 'vOrdbog', ikon: 'bog', genvej: '⌘4', genvejAria: 'Meta+4' },
  ];
  const f = K.visningsskift(rod, VIS, { ariaT: 'visninger', faner: true });
  const fane = id => f.links.find(a => a.dataset.visning === id);
  const tipAf = a => { const t = d.getElementById(a.getAttribute('aria-describedby') || ''); return t && t.getAttribute('role') === 'tooltip' ? t : null; };
  const a = fane('a');
  tjek('faner: rækken er .vfaner med role="tablist" og navnet fra ariaT; ikke .skift, ikke tæt ved fire', rod.className === 'vfaner' && rod.getAttribute('role') === 'tablist' && rod.getAttribute('data-t-aria') === 'visninger');
  tjek('faner: hver fane er et link til #id med .vf, role="tab", id kit-vf<nr>-<id>, aria-selected="false", tabindex −1 (undtagen den første, se næste), ikon og .vf-navn; ingen <kbd> og ingen aria-current', f.links.length === 4 && f.links.every((x, i) => x.tagName === 'A' && x.classList.contains('vf') && x.getAttribute('role') === 'tab' && /^kit-vf\d+-[a-e]$/.test(x.id) && x.id.endsWith('-' + x.dataset.visning) && x.getAttribute('href') === '#' + x.dataset.visning && x.getAttribute('aria-selected') === 'false' && (i === 0 || x.tabIndex === -1) && x.querySelector(':scope > svg') && x.querySelector(':scope > span.vf-navn') && !x.querySelector('kbd') && !x.hasAttribute('aria-current')) && a.querySelector('.vf-navn').textContent === 'Maskér' && fane('e').querySelector('.vf-navn').getAttribute('data-t') === 'vOrdbog');
  tjek('faner: genvejen er hjælpetekst i et værktøjstip (role="tooltip", aria-describedby) med aria-keyshortcuts; panel giver aria-controls', tipAf(a) && tipAf(a).textContent === '⌘1' && tipAf(a).hidden && a.getAttribute('aria-keyshortcuts') === 'Meta+1' && a.getAttribute('aria-controls') === 'p-a' && !fane('b').hasAttribute('aria-controls') && a.parentElement.className === 'tip-plads' && a.parentElement.parentElement === rod);
  tjek('faner: uden valgt fane er den første i Tab-rækkefølgen (tabindex 0), så rækken kan nås', a.tabIndex === 0 && f.links.filter(x => x.tabIndex === 0).length === 1);
  f.markér('b');
  tjek('faner: markér sætter .on og aria-selected="true" på én, tabindex 0 kun på den (de andre −1) og aldrig aria-current', fane('b').classList.contains('on') && fane('b').getAttribute('aria-selected') === 'true' && fane('b').tabIndex === 0 && f.links.filter(x => x !== fane('b')).every(x => x.getAttribute('aria-selected') === 'false' && x.tabIndex === -1 && !x.classList.contains('on')) && !rod.querySelector('[aria-current]'));
  const antB = fane('b').querySelector(':scope > .ant');
  tjek('faner: antal og kraever som i visningsskiftet (.ant .ant-kraever, aria-hidden, og skjult tekst med nøglen)', antB && antB.className === 'ant ant-kraever' && antB.textContent === '3' && antB.getAttribute('aria-hidden') === 'true' && antB.nextElementSibling.className === 'skjult-tekst' && antB.nextElementSibling.getAttribute('data-t') === 'kraever');
  const c = fane('c');
  tjek('faner: en fane slået fra har aria-disabled, og tippet siger hvorfor i stedet for genvejen (ingen title)', c.getAttribute('aria-disabled') === 'true' && tipAf(c) && tipAf(c).getAttribute('data-t') === 'hvorforToken' && !tipAf(c).textContent && !c.hasAttribute('title') && c.parentElement.querySelectorAll('.tip').length === 1);
  // Klik og piletaster. Siden navigerer til #id (jsdom følger et klik på et link); en lytter tæller klik, der går igennem.
  const gik = [];
  rod.addEventListener('click', e => { const x = e.target.closest('.vf'); if (x) gik.push((e.defaultPrevented ? '!' : '') + x.dataset.visning); });
  const tast = (el, key, x = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }); el.dispatchEvent(e); return e; };
  c.click();
  tjek('faner: et klik på en fane slået fra gør intet (preventDefault)', gik.join() === '!c' && w.location.hash === '');
  gik.length = 0;
  fane('b').focus();
  const hoejre = tast(fane('b'), 'ArrowRight');
  tjek('faner: pil højre flytter fokus til næste fane og klikker den (her en fane slået fra: fokus, men intet valg)', hoejre.defaultPrevented && d.activeElement === c && gik.join() === '!c');
  tast(c, 'ArrowRight');
  await vent(5);
  tjek('faner: pil højre igen vælger næste (klik, der går igennem, og adressen bliver #e)', d.activeElement === fane('e') && gik.join() === '!c,e' && w.location.hash === '#e');
  tast(fane('e'), 'ArrowRight');
  tjek('faner: pil højre fra den sidste går rundt til den første', d.activeElement === a && gik.at(-1) === 'a');
  tast(a, 'ArrowLeft');
  tjek('faner: pil venstre fra den første går rundt til den sidste', d.activeElement === fane('e') && gik.at(-1) === 'e');
  tast(fane('e'), 'Home');
  const foerEnd = gik.length;
  tast(a, 'End');
  tjek('faner: Home går til den første, End til den sidste (og vælger)', gik[foerEnd - 1] === 'a' && d.activeElement === fane('e') && gik.at(-1) === 'e');
  const n = gik.length;
  const mel = tast(fane('e'), ' ');
  tjek('faner: mellemrum vælger fanen (klik) og ruller ikke siden', mel.defaultPrevented && gik.length === n + 1 && gik.at(-1) === 'e');
  const m2 = gik.length;
  const medMeta = tast(fane('e'), 'ArrowLeft', { metaKey: true }), medCtrl = tast(fane('e'), 'ArrowRight', { ctrlKey: true }), medAlt = tast(fane('e'), 'Home', { altKey: true });
  tjek('faner: ⌘, Ctrl og Alt med en piletast gør intet i rækken (ikke stoppet, intet klik)', !medMeta.defaultPrevented && !medCtrl.defaultPrevented && !medAlt.defaultPrevented && gik.length === m2 && d.activeElement === fane('e'));
  const andet = tast(fane('e'), 'ArrowDown');
  tjek('faner: pil ned og andre taster bruges ikke af rækken', !andet.defaultPrevented && gik.length === m2);
  f.saetPunkt('c', { deaktiveret: false });
  tjek('faner: slået til igen står genvejen i tippet (samme tip-plads, ét tip), og et klik går igennem', !c.hasAttribute('aria-disabled') && tipAf(c) && tipAf(c).textContent === '⌘3' && c.parentElement.querySelectorAll('.tip').length === 1 && (c.click(), gik.at(-1) === 'c'));
  f.saetPunkt('c', { deaktiveret: true, hvorfor: 'hvorforToken' });
  tjek('faner: slået fra igen står hvorfor i tippet', tipAf(c) && tipAf(c).getAttribute('data-t') === 'hvorforToken' && c.parentElement.querySelectorAll('.tip').length === 1);
  const r2 = d.createElement('div');
  const uden = K.visningsskift(r2, [{ id: 'x', tekst: 'X' }, { id: 'y', tekst: 'Y' }], { faner: true });
  tjek('faner: uden genvej og uden hvorfor er der intet tip og ingen tip-plads', !r2.querySelector('.tip') && !r2.querySelector('.tip-plads') && uden.links.every(x => x.parentElement === r2));
  const r8 = d.createElement('div');
  K.visningsskift(r8, Array.from({ length: 8 }, (_, i) => ({ id: 'v' + i, tekst: 'V' + i })), { faner: true });
  const r7 = d.createElement('div');
  K.visningsskift(r7, Array.from({ length: 7 }, (_, i) => ({ id: 'v' + i, tekst: 'V' + i })), { faner: true });
  tjek('faner: syv og otte faner er tætte (.vfaner.taet); ni afvises som før', r8.className === 'vfaner taet' && r7.className === 'vfaner taet' && /højst otte visninger \(fik 9\)/.test(fejlAf(() => K.visningsskift(d.createElement('div'), Array.from({ length: 9 }, (_, i) => ({ id: 'v' + i, tekst: 'V' })), { faner: true }))));
  const fa = d.createElement('div'), fb = d.createElement('div');
  K.visningsskift(fa, [{ id: 'x', tekst: 'X' }], { faner: true });
  K.visningsskift(fb, [{ id: 'x', tekst: 'X' }], { faner: true });
  tjek('faner: to fanerækker på samme side får forskellige id\'er', fa.querySelector('.vf').id !== fb.querySelector('.vf').id);

  // ── CSS ──
  const regel = vaelger => { const i = css.indexOf('\n' + vaelger + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i) + 1); };
  tjek('faner (CSS): rækken er flex uden at krympe i højden, med kant forneden på fladen og ingen overflow: hidden (tippet under fanen må ikke skæres af)', /display: flex; flex: none;/.test(regel('.vfaner')) && /border-bottom: 1px solid var\(--border\); background: var\(--surface\);/.test(regel('.vfaner')) && !/overflow/.test(regel('.vfaner')));
  tjek('faner (CSS): en fane er 28 px høj (rækken 29 px med kanten; med båndet uden faners 4 px ekstra luft er det båndets fanerække på 33 px), krymper (flex 0 1 auto, min-width 0) og bryder ikke; navnet afkortes med …', /height: 28px;/.test(regel('.vf')) && /padding: var\(--space-2\) var\(--space-3\) var\(--space-1\);/.test(regel('.grupper')) && /\.cmd\.enkel \.grupper \{ padding: var\(--space-2\) var\(--space-3\); \}/.test(css) && /\n\.tab \{\n  height: 32px;/.test(css) && /flex: 0 1 auto; min-width: 0;/.test(regel('.vf')) && /white-space: nowrap;/.test(regel('.vf')) && /border-bottom: 2px solid var\(--surface\);/.test(regel('.vf')) && /\.vf-navn \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; \}/.test(css) && /\.vfaner > \.tip-plads \{ flex: 0 1 auto; min-width: 0; \}/.test(css) && /\.vfaner > \.tip-plads > \.vf \{ flex: 1 1 auto; \}/.test(css) && /\.vf svg \{[^}]*flex: none;/.test(css) && /\.vf \.ant \{ flex: none;/.test(css));
  tjek('faner (CSS): den valgte har streg i accent og fed skrift (ikke kun farve) og ikonet i accent; fokusring i info inden for fanen', /\.vf\.on \{ border-bottom-color: var\(--accent\); color: var\(--text\); font-weight: 600; \}/.test(css) && /\.vf\.on svg \{ stroke: var\(--accent\); \}/.test(css) && /\.vf:focus-visible \{ outline: 2px solid var\(--info\); outline-offset: -2px; \}/.test(css));
  tjek('faner (CSS): en fane slået fra er brødteksten nedtonet (opacity .5) uden hover; tallet, der kræver handling, er en pille med kant og fed skrift; tæt ved syv og otte', /\.vf\[aria-disabled="true"\] \{ color: var\(--text\); opacity: \.5; cursor: default; \}/.test(css) && /\.vf\[aria-disabled="true"\]:hover \{ color: var\(--text\); \}/.test(css) && /\.vf \.ant-kraever \{[^}]*border: 1px solid var\(--danger\);[^}]*font-weight: 700;/.test(css) && /\.vfaner\.taet \.vf \{ gap: 6px; padding: 0 var\(--space-2\); \}/.test(css));
  tjek('NavPane uden visningsskift (CSS): et .trae direkte i .nav uden .skift fylder resten af ruden og ruller selv; med .skift gælder reglen ikke, og .skift og .trae er som før', /\n\.nav:not\(:has\(> \.skift\)\) > \.trae \{ flex: 1 1 auto; min-height: 0; \}/.test(css) && /\n\.skift \{ margin-top: auto;/.test(css) && /\n\.trae \{ list-style: none; margin: 0; padding: 0 var\(--space-2\) var\(--space-3\); display: flex; flex-direction: column; gap: 1px; overflow: auto; \}/.test(css));
  // Valgt række under musen: den nye regel har mere vægt end hover-reglen (regnet efter CSS' regel for vægt).
  const vaegt = sel => {
    let a = 0, b = 0, c2 = 0;
    const s = sel.replace(/:not\(([^()]*)\)/g, (m, x) => { const v = vaegt(x); a += v[0]; b += v[1]; c2 += v[2]; return ''; });
    a += (s.match(/#[\w-]+/g) || []).length;
    b += (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
    c2 += (s.replace(/\[[^\]]+\]/g, '').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return [a, b, c2];
  };
  const tungere = (x, y) => { const [p, q] = [vaegt(x), vaegt(y)]; return p[0] - q[0] || p[1] - q[1] || p[2] - q[2]; };
  tjek('kontrol: vægtregningen (.tabel tbody tr:not(.gruppe):hover td = 0,3,3; #x .y = 1,1,0)', JSON.stringify(vaegt('.tabel tbody tr:not(.gruppe):hover td')) === '[0,3,3]' && JSON.stringify(vaegt('#x .y')) === '[1,1,0]');
  tjek('DataTable 2.6.0 (CSS): en valgt række under musen viser valget (accent-soft), og reglen vejer mere end hover på celler og rækkehoved; den gamle regel for .sel står uændret', /\n\.tabel tbody tr\.sel:not\(\.gruppe\):hover > \* \{ background: var\(--accent-soft\); \}/.test(css) && tungere('.tabel tbody tr.sel:not(.gruppe):hover > *', '.tabel tbody tr:not(.gruppe):hover td') > 0 && tungere('.tabel tbody tr.sel:not(.gruppe):hover > *', '.tabel tbody tr:not(.gruppe):hover > th') > 0 && /\n\.tabel tr\.sel td, \.tabel tr\.sel:hover td \{ background: var\(--accent-soft\); \}/.test(css));
  tjek('DataTable 2.6.0 (CSS): også den faste første kolonne (fastFoerste) viser valget under musen, og reglen vejer mere end dens hover', /\n\.tabel\.fast-foerste:not\(\.uden-valg\) tbody tr\.sel:not\(\.gruppe\):hover > :first-child \{ background: var\(--accent-soft\); \}/.test(css) && tungere('.tabel.fast-foerste:not(.uden-valg) tbody tr.sel:not(.gruppe):hover > :first-child', '.tabel.fast-foerste:not(.uden-valg) tbody tr:not(.gruppe):hover > :first-child') > 0);
  tjek('kontrol: før vandt hover-reglen over 2.0.0\'s .sel-regel (det, der er rettet)', tungere('.tabel tbody tr:not(.gruppe):hover td', '.tabel tr.sel:hover td') > 0);

  // ── Dokumenterne ──
  const a260 = log.slice(log.indexOf('## 2.6.0'), log.indexOf('\n## 2.5.0'));
  tjek('CHANGELOG 2.6.0: første post med kun dato; Nyt (faner: true, NavPane uden visningsskift) og Ændret (valgt række vinder over hover); intet omdøbt eller fjernet; HAM uændret', log.indexOf('## 2.6.0 — 2026-11-12') > 0 && log.indexOf('## 2.6.0') < log.indexOf('## 2.5.0') && /### Nyt[\s\S]*### Ændret/.test(a260) && /faner: true/.test(a260.slice(0, a260.indexOf('### Ændret'))) && /uden visningsskift/.test(a260.slice(0, a260.indexOf('### Ændret'))) && /Valgt række vinder over hover/.test(a260.slice(a260.indexOf('### Ændret'))) && /Intet er omdøbt eller fjernet/.test(a260) && /Huginn and Muninns opsætning/.test(a260));
  tjek('KOMPONENTER.md: AppShell, NavPane og DataTable har 2.6.0 (fanerne øverst, ruden uden visningsskift, valgt række under musen); NavPane nævner de nye klasser', /### Visningerne som faner øverst \(fra 2\.6\.0\)/.test(afsnitAf('AppShell')) && /### Visningerne som faner øverst \(fra 2\.6\.0\)/.test(afsnitAf('NavPane')) && /### NavPane uden visningsskift \(fra 2\.6\.0\)/.test(afsnitAf('NavPane')) && /fra 2\.6\.0 viser en valgt række under musen valget/.test(afsnitAf('DataTable')) && ['`.vfaner`', '`.vf`', '`.vf-navn`'].every(k => afsnitAf('NavPane').includes(k)));
  tjek('KOMPONENTER.md (NavPane 2.6.0): rollerne er valgt og begrundet, hvad en skærmlæser hører, tastaturet, mere end farve og det smalle vindue', ['`tablist`', '`tab`', 'aria-current', 'skærmlæser', 'faneliste', 'pil', 'Home', 'mellemrum', 'ikke kun farve', 'afkortes med …', 'titellinjen'].every(o => afsnitAf('NavPane').includes(o)));
  tjek('flytning/HUGINN-MUNINN.md: muligheden findes, Huginn and Muninns opsætning er uændret, og valgt række under musen er nævnt', /Fra 2\.6\.0 kan visningerne stå som faner øverst/.test(hm) && /opsætning \([^)]*\) er uændret/.test(hm) && /valgt tabelrække under musen/.test(hm));
  tjek('README 2.6.0: indholdslisten og "Byg skærmen" nævner fanerne øverst (faner: true)', /fra 2\.6\.0 kan `Kit\.visningsskift` stå som faner øverst \(`faner: true`\)/.test(readme) && /Fra 2\.6\.0 kan visningerne stå som faner øverst/.test(readme));
}
{
  // Demoen 2.6.0 med pakkens rigtige filer, i begge sprog og temaer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const tekst = id => d.getElementById(id).textContent;
  const fr = d.getElementById('demo-faner260');
  const fn = () => [...fr.querySelectorAll('.vf')];
  const synligt = () => [...d.querySelectorAll('#demo-baand260 > [data-visning]')].filter(b => !b.hidden).map(b => b.dataset.visning);
  tjek('demo 2.6.0: fire faner øverst i en lille skal (tablist med navn, faner med ikon og navn), Oversigt er valgt, og kun dens bånd vises (uden fanerække)', fr.getAttribute('role') === 'tablist' && fr.getAttribute('aria-label') === 'Visninger' && fn().map(a => a.querySelector('.vf-navn').textContent).join() === 'Oversigt,Siden sidst,Angreb,Login' && fn()[0].getAttribute('aria-selected') === 'true' && JSON.stringify(synligt()) === '["oversigt"]' && !d.querySelector('#demo-baand260 .tabs') && d.querySelectorAll('#demo-baand260 .cmd.enkel').length === 4 && fr.previousElementSibling.classList.contains('titel'));
  tjek('demo 2.6.0: navigationsruden har kun overskrift og træ (intet visningsskift)', !d.querySelector('#demo-trae260').closest('.nav').querySelector('.skift, .vfaner') && d.querySelector('#demo-trae260').parentElement.classList.contains('nav') && d.querySelector('#demo-trae260').parentElement.lastElementChild.id === 'demo-trae260');
  fn()[1].click();
  tjek('demo 2.6.0: et klik på Siden sidst vælger den, og båndet følger fanen (adressen ændres ikke)', fn()[1].getAttribute('aria-selected') === 'true' && JSON.stringify(synligt()) === '["siden"]' && tekst('faner260-valgt') === 'Valgt: Siden sidst' && w.location.hash === '');
  fn()[1].focus();
  fn()[1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  tjek('demo 2.6.0: pil højre vælger Angreb; båndet følger', fn()[2].getAttribute('aria-selected') === 'true' && d.activeElement === fn()[2] && JSON.stringify(synligt()) === '["angreb"]');
  fn()[3].click();
  tjek('demo 2.6.0: Login er slået fra (hvorfor i tippet), og et klik gør intet', fn()[3].getAttribute('aria-disabled') === 'true' && d.getElementById(fn()[3].getAttribute('aria-describedby'))?.textContent === 'Login kræver en API-nøgle under Indstillinger.' && JSON.stringify(synligt()) === '["angreb"]');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '¡', code: 'Digit1', altKey: true, bubbles: true, cancelable: true }));
  tjek('demo 2.6.0: genvejen Alt+1 står i tippet og vælger Oversigt', d.getElementById(fn()[0].getAttribute('aria-describedby'))?.textContent === 'Alt+1' && fn()[0].getAttribute('aria-keyshortcuts') === 'Alt+1' && fn()[0].getAttribute('aria-selected') === 'true' && JSON.stringify(synligt()) === '["oversigt"]');
  const otte = d.getElementById('demo-faner260-otte');
  tjek('demo 2.6.0: otte faner i en smal række (tæt) under en titellinje; et klik vælger', otte.className === 'vfaner taet' && otte.querySelectorAll('.vf').length === 8 && otte.closest('.demo-faner-smal') && (otte.querySelectorAll('.vf')[5].click(), otte.querySelectorAll('.vf')[5].getAttribute('aria-selected') === 'true') && tekst('faner260-otte-valgt') === 'Valgt: Land lige nu');
  tjek('demo 2.6.0: DataTable siger, at den valgte række viser valget under musen', d.querySelector('[data-t="h260Valgt"]').textContent === 'Valgt række under musen (fra 2.6.0)' && d.querySelector('[data-t="h260Valgt"]').closest('[data-navn="DataTable"]'));
  w.Sprog.saet('en');
  tjek('demo 2.6.0 (English): fanerne, båndet og teksterne følger sproget', fr.getAttribute('aria-label') === 'Views' && fn().map(a => a.querySelector('.vf-navn').textContent).join() === 'Overview,Since last time,Attacks,Login' && d.querySelector('[data-t="h260Faner"]').textContent === 'The views as tabs at the top (from 2.6.0)' && d.getElementById(fn()[3].getAttribute('aria-describedby'))?.textContent === 'Login requires an API key under Settings.');
  w.Tema.saet('moerk');
  tjek('demo 2.6.0: mørkt tema sættes på siden med fanerne', d.documentElement.getAttribute('data-tema') === 'moerk' && Boolean(d.querySelector('#demo-faner260 .vf.on')));
  const da = Object.keys(w.Sprog.TEKST.da), en = Object.keys(w.Sprog.TEKST.en);
  tjek('demo 2.6.0: dansk og engelsk har de samme nøgler, og ingen nøgle på siden mangler', JSON.stringify(da.slice().sort()) === JSON.stringify(en.slice().sort()) && [...d.querySelectorAll('[data-t],[data-t-aria]')].every(e => ['data-t', 'data-t-aria'].every(x => !e.hasAttribute(x) || e.getAttribute(x) in w.Sprog.TEKST.da)));
  w.close();
}

// ── Pakke 2.7.0 (V-FANER.2, D26): ét bånd, visningerne som store knapper i det, aria-current på en båndknap, Mere og programmets mindstemål ──
{
  const css = pk('web/kit.css'), md = pk('KOMPONENTER.md'), readme = pk('README.md'), log = pk('CHANGELOG.md'), hm = pk('flytning/HUGINN-MUNINN.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return i < 0 ? '' : md.slice(i, md.indexOf('\n## ', i + 1)); };
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const fejlAf = f => { try { f(); return ''; } catch (e) { return String(e.message); } };
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  tjek('2.7.0: de nye klasser (V270_KLASSER) findes i kit.css, og der er ingen nye funktioner og intet nyt ikon (Kit har stadig 34 navne, 27 ikoner)', V270_KLASSER.every(k => cssKlasser.has(k)) && V270_FUNKTIONER.length === 0 && Object.keys(ny().Kit).length === 34 && Object.keys(ny().Kit.IKONER).length === 27, V270_KLASSER.filter(k => !cssKlasser.has(k)).join());

  // Huginn and Muninns og Grimnirs bånd fra 2.6.0, fanerækken og 2.6.0's CSS er uændrede.
  {
    const w = ny();
    const nu = bygV260(w.Kit, w.document);
    const forskel = Object.keys(V260_UDSEENDE).filter(k => nu[k] !== V260_UDSEENDE[k]);
    tjek(`2.7.0: uden de nye indstillinger bygger kittet ${Object.keys(V260_UDSEENDE).length} eksempler byte for byte som 2.6.0 (Huginn and Muninns bånd med syv visninger som knapper, Grimnirs bånd med hvorforTip, bånd med faner, fanerækken med faner: true)`, Object.keys(V260_UDSEENDE).length === 4 && forskel.length === 0, forskel.join(', '));
    const w2 = ny();
    const nu250 = bygV250(w2.Kit, w2.document);
    tjek('2.7.0: og 2.5.0-eksemplerne er stadig byte for byte de samme', Object.keys(V250_UDSEENDE).every(k => nu250[k] === V250_UDSEENDE[k]));
    const regler = [];
    const ren = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let dybde = 0, start = 0;
    for (let i = 0; i < ren.length; i++) {
      if (ren[i] === '{') dybde++;
      else if (ren[i] === '}') { dybde--; if (dybde === 0) { regler.push(ren.slice(start, i + 1).replace(/\s+/g, ' ').trim()); start = i + 1; } }
    }
    const nuH = new Set(regler.map(r => crypto.createHash('sha256').update(r).digest('hex').slice(0, 12)));
    const borte = V260_CSS.filter(h => !nuH.has(h));
    tjek(`2.7.0: alle ${V260_CSS.length} regelsæt i 2.6.0's kit.css står uændrede (kun tilføjelser; i alt ${regler.length})`, V260_CSS.length === 428 && borte.length === 0 && regler.length === 459, borte.length + ' ændret eller fjernet');
  }

  // ── Visningerne i båndet ──
  const w = ny(), d = w.document, K = w.Kit;
  const tipAf = a => { const t = d.getElementById(a.getAttribute('aria-describedby') || ''); return t && t.getAttribute('role') === 'tooltip' ? t : null; };
  const tast = (el, key, x = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }); el.dispatchEvent(e); return e; };
  const VIS = [
    { id: 'a', tekst: 'Oversigt', ikon: 'mappe', genvej: '⌘1', genvejAria: 'Meta+1' },
    { id: 'b', tekst: 'Siden sidst', ikon: 'kalender', genvej: '⌘2', genvejAria: 'Meta+2', antal: 3, kraever: true, antalAriaT: 'kraever' },
    { id: 'c', tekst: 'Login', ikon: 'laas', genvej: '⌘3', genvejAria: 'Meta+3', deaktiveret: true, hvorfor: 'hvorforToken' },
    { id: 'e', t: 'vLand', ikon: 'sprog' },
  ];
  const rod = d.createElement('div');
  d.body.appendChild(rod);
  const bar = K.commandBar(rod, { ariaT: 'cmdAria', udenFaner: true, hvorforTip: true, visninger: { t: 'gVisninger', punkter: VIS }, faner: [{ id: 'start', grupper: [
    { t: 'gData', knapper: [{ id: 'hent', t: 'kHent', ikon: 'afspil', pri: true }, { id: 'eks', t: 'kEks', ikon: 'eksport', deaktiveret: true, hvorfor: 'hvorforIngen' }] },
    { t: 'gProgram', knapper: [{ id: 'indst', t: 'kIndst', ikon: 'tandhjul' }] },
  ] }] });
  const v = bar.visninger, lk = id => v.links.find(a => a.dataset.visning === id);
  const grp = [...rod.querySelectorAll('.grupper > .grp')];
  tjek('visninger: første gruppe i båndet (.grp-visninger, role="group", navnet fra programmet), adskilt fra kommandoerne med båndets gruppeskille; båndet er stadig .cmd.enkel med role="group"', grp[0].classList.contains('grp-visninger') && grp[0].getAttribute('role') === 'group' && d.getElementById(grp[0].getAttribute('aria-labelledby'))?.getAttribute('data-t') === 'gVisninger' && grp[0].lastElementChild.className === 'cap' && grp.length === 3 && rod.className === 'cmd enkel' && rod.getAttribute('role') === 'group');
  tjek('visninger: én stor knap pr. visning i fast rækkefølge: et link til #id (<a class="cb vk">, data-visning) med ikon over navn (.vk-navn); ingen rolle, ingen faneattributter', v.links.length === 4 && v.links.every((a, i) => a.tagName === 'A' && a.className === 'cb vk' && a.getAttribute('href') === '#' + VIS[i].id && a.dataset.visning === VIS[i].id && a.firstElementChild.tagName.toLowerCase() === 'svg' && a.children[1].className === 'vk-navn' && !a.hasAttribute('role') && !a.hasAttribute('aria-selected') && !a.hasAttribute('tabindex')) && lk('a').children[1].textContent === 'Oversigt' && lk('e').children[1].getAttribute('data-t') === 'vLand' && !lk('e').querySelector('svg + svg'));
  tjek('visninger: genvejen står i et værktøjstip (role="tooltip", aria-describedby) og i aria-keyshortcuts; uden genvej intet aria-keyshortcuts', tipAf(lk('a'))?.querySelector('.vk-tip-tekst').textContent === '⌘1' && tipAf(lk('a')).hidden && lk('a').getAttribute('aria-keyshortcuts') === 'Meta+1' && !lk('e').hasAttribute('aria-keyshortcuts'));
  tjek('visninger: uden genvej, hvorfor og et afkortet navn vises tippet ikke (.tip-tom)', tipAf(lk('e'))?.classList.contains('tip-tom') && !tipAf(lk('a')).classList.contains('tip-tom'));
  const antB = lk('b').querySelector(':scope > .ant');
  tjek('visninger: antal og kraever på knappen (.ant .ant-kraever, aria-hidden, og skjult tekst med nøglen og tallet)', antB && antB.className === 'ant ant-kraever' && antB.textContent === '3' && antB.getAttribute('aria-hidden') === 'true' && antB.nextElementSibling?.className === 'skjult-tekst' && antB.nextElementSibling.getAttribute('data-t') === 'kraever' && antB.nextElementSibling.getAttribute('data-v') === '3');
  tjek('visninger: en visning slået fra har aria-disabled, kan stadig nås med Tab, og tippet siger hvorfor i stedet for genvejen (ingen title)', lk('c').getAttribute('aria-disabled') === 'true' && lk('c').tabIndex === 0 && tipAf(lk('c'))?.querySelector('.vk-tip-tekst').getAttribute('data-t') === 'hvorforToken' && !tipAf(lk('c')).querySelector('.vk-tip-tekst').textContent && !lk('c').hasAttribute('title'));
  tjek('visninger: ingen er åben fra start (programmet kalder markér)', !v.links.some(a => a.hasAttribute('aria-current')));
  v.markér('b');
  tjek('visninger: markér sætter aria-current="page" på én og fjerner det fra de andre (ingen klasse on, ingen aria-selected)', lk('b').getAttribute('aria-current') === 'page' && v.links.filter(a => a.hasAttribute('aria-current')).length === 1 && !v.links.some(a => a.classList.contains('on') || a.hasAttribute('aria-selected')));
  v.markér(null);
  tjek('visninger: markér(null) fjerner aria-current fra alle (fx mens Indstillinger er åben)', !v.links.some(a => a.hasAttribute('aria-current')));
  v.markér('a');
  v.saetPunkt('b', { antal: 0, kraever: false, antalAriaT: null });
  tjek('visninger: saetPunkt ændrer tallet uden at bygge båndet om (samme link, et .ant uden pille og uden skjult tekst)', lk('b') === v.links[1] && lk('b').querySelectorAll(':scope > [data-ant]').length === 1 && lk('b').querySelector(':scope > .ant').className === 'ant' && lk('b').querySelector(':scope > .ant').textContent === '0' && !lk('b').querySelector('.skjult-tekst'));
  v.saetPunkt('b', { antal: null });
  tjek('visninger: antal: null fjerner tallet', !lk('b').querySelector('[data-ant]'));
  v.saetPunkt('c', { deaktiveret: false });
  tjek('visninger: slået til igen: genvejen står i tippet (samme tip-plads, ét tip), og aria-disabled er væk', !lk('c').hasAttribute('aria-disabled') && tipAf(lk('c'))?.querySelector('.vk-tip-tekst').textContent === '⌘3' && lk('c').parentElement.querySelectorAll('.tip').length === 1);
  v.saetPunkt('c', { deaktiveret: true, hvorfor: { tekst: 'Mangler en nøgle' } });
  tjek('visninger: slået fra igen med en færdig tekst: tippet siger den', lk('c').getAttribute('aria-disabled') === 'true' && tipAf(lk('c'))?.querySelector('.vk-tip-tekst').textContent === 'Mangler en nøgle');
  tjek('visninger: en ukendt visning i saetPunkt giver en fejl', /ukendt visning: x/.test(fejlAf(() => v.saetPunkt('x', { antal: 1 }))));
  // Klik, mellemrum, piletaster.
  const gik = [];
  rod.addEventListener('click', e => { const x = e.target.closest('.vk'); if (x) gik.push((e.defaultPrevented ? '!' : '') + x.dataset.visning); });
  lk('c').click();
  tjek('visninger: et klik på en visning slået fra gør intet (preventDefault)', gik.join() === '!c' && w.location.hash === '');
  lk('e').focus();
  const mel = tast(lk('e'), ' ');
  tjek('visninger: mellemrum på en visning klikker den (som Enter på et link) og ruller ikke siden', mel.defaultPrevented && gik.at(-1) === 'e');
  const medMeta = tast(lk('e'), ' ', { metaKey: true }), pil = tast(lk('e'), 'ArrowLeft'), enter = tast(lk('e'), 'Enter');
  tjek('visninger: ⌘ + mellemrum, piletaster og Enter (linkets egen) håndteres ikke af kittet', !medMeta.defaultPrevented && !pil.defaultPrevented && !enter.defaultPrevented && gik.length === 2);
  // Et afkortet navn: det fulde navn står øverst i tippet (kittet ser efter, lige før tippet vises).
  const navnE = lk('e').querySelector('.vk-navn');
  navnE.textContent = 'Danmark og et meget langt land';
  w.Range.prototype.getBoundingClientRect = function () { return { width: this.startContainer === navnE ? 200 : 10 }; };
  navnE.getBoundingClientRect = () => ({ width: 152 });
  lk('e').dispatchEvent(new w.Event('mouseenter'));
  const tipE = tipAf(lk('e'));
  tjek('visninger: et afkortet navn står helt øverst i tippet (.vk-tip-navn), og tippet vises (ikke .tip-tom)', !tipE.querySelector('.vk-tip-navn').hidden && tipE.querySelector('.vk-tip-navn').textContent === 'Danmark og et meget langt land' && !tipE.classList.contains('tip-tom'));
  navnE.getBoundingClientRect = () => ({ width: 300 });
  lk('e').dispatchEvent(new w.Event('focus'));
  tjek('visninger: når navnet ikke længere er afkortet, er det væk fra tippet igen (og tippet uden genvej vises ikke)', tipE.querySelector('.vk-tip-navn').hidden && tipE.classList.contains('tip-tom'));
  delete w.Range.prototype.getBoundingClientRect;
  // saetAktuel (K41)
  bar.saetAktuel('indst', true);
  tjek('saetAktuel: en kommando får aria-current="page" (fx Indstillinger, mens den er åben) og mister den igen; en ukendt giver en fejl', bar.knap('indst').getAttribute('aria-current') === 'page' && (bar.saetAktuel('indst', false), !bar.knap('indst').hasAttribute('aria-current')) && /ukendt kommando: x/.test(fejlAf(() => bar.saetAktuel('x', true))));
  tjek('visninger og mere kræver udenFaner, og højst otte visninger', /kræver udenFaner/.test(fejlAf(() => K.commandBar(d.createElement('div'), { faner: [{ id: 's', grupper: [] }], visninger: { punkter: [] } }))) && /kræver udenFaner/.test(fejlAf(() => K.commandBar(d.createElement('div'), { faner: [{ id: 's', grupper: [] }], mere: { t: 'm' } }))) && /højst otte visninger \(fik 9\)/.test(fejlAf(() => K.commandBar(d.createElement('div'), { udenFaner: true, faner: [{ id: 's', grupper: [] }], visninger: { punkter: Array.from({ length: 9 }, (_, i) => ({ id: 'v' + i, tekst: 'V' })) } }))));
  const b2a = d.createElement('div'), b2b = d.createElement('div');
  K.commandBar(b2a, { udenFaner: true, faner: [{ id: 's', grupper: [{ t: 'g', knapper: [{ id: 'k', t: 'k' }] }] }] });
  tjek('uden de nye indstillinger har båndet ingen visninger, ingen Mere og ingen saetAktuel/tilpas (som 2.6.0)', !b2a.querySelector('.vk, .mere-plads') && !b2a.classList.contains('med-mere') && (() => { const r = K.commandBar(b2b, { udenFaner: true, faner: [{ id: 's', grupper: [] }] }); return !('visninger' in r) && !('saetAktuel' in r) && !('tilpas' in r) && !('mere' in r); })());

  // ── Mere ──
  // Placeringer regnet i jsdom: hver knap er B px bred (2 px mellem knapperne), en gruppe har 12 px luft til højre og 1 px
  // skille, 12 px mellem grupperne og 12 px i hver side af rækken (0 til højre, når Mere vises; Mere-pladsen er 88 px).
  const rodM = d.createElement('div');
  d.body.appendChild(rodM);
  const KN = n => Array.from({ length: n }, (_, i) => i);
  const mb = K.commandBar(rodM, { ariaT: 'c', udenFaner: true, hvorforTip: true, visninger: { t: 'gV', punkter: [{ id: 'a', tekst: 'A', ikon: 'mappe' }, { id: 'b', tekst: 'B', ikon: 'oeje' }] }, mere: { t: 'kMere' }, faner: [{ id: 's', grupper: [
    { t: 'g1', knapper: [{ id: 'k1', tekst: 'K1', ikon: 'fil', pri: true }, { id: 'k2', tekst: 'K2', ikon: 'gem' }] },
    { t: 'g2', knapper: [{ id: 'k3', tekst: 'K3', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorforK3' }, { id: 'el', element: K.segment({ aria: 'S', valg: [{ id: 'x', t: 'x' }, { id: 'y', t: 'y' }], valgt: 'x' }).rod }, { id: 'k4', tekst: 'K4', ikon: 'sol', trykket: true }] },
    { t: 'g3', knapper: [{ id: 'k5', tekst: 'K5', ikon: 'slet' }, { id: 'k6', tekst: 'K6', ikon: 'plus' }] },
  ] }] });
  const panelM = rodM.querySelector('.grupper'), plads = rodM.querySelector('.mere-plads'), mk = mb.mere.knap, menu = mb.mere.menu;
  tjek('mere: Mere-knappen står sidst i båndet efter rækken (.mere-plads), med aria-haspopup="menu", aria-expanded="false", aria-controls til menuen (role="menu", navngivet af knappen) og ikonet ned; båndet har .med-mere', rodM.classList.contains('med-mere') && rodM.lastElementChild === plads && mk.className === 'cb cb-mere' && mk.getAttribute('aria-haspopup') === 'menu' && mk.getAttribute('aria-expanded') === 'false' && d.getElementById(mk.getAttribute('aria-controls')) === menu && menu.getAttribute('role') === 'menu' && menu.getAttribute('aria-labelledby') === mk.id && menu.hidden && mk.querySelector('svg path')?.getAttribute('d') === K.IKONER.ned[0][1].d && mk.querySelector('span').getAttribute('data-t') === 'kMere');
  tjek('mere: uden layout (bredde 0) er Mere skjult, og intet flyttes', plads.hidden && mb.mere.flyttet.length === 0 && !rodM.classList.contains('mere-vist'));
  let W = 2000;
  const B = 60;
  const grpM = [...panelM.querySelectorAll(':scope > .grp')];
  const lag = () => {
    const vist = rodM.classList.contains('mere-vist'), pos = new Map();
    let x = 12, n = 0;
    grpM.forEach((g, i) => {
      if (g.hasAttribute('data-mere-tom') || g.hidden) return;
      const synlige = [...g.querySelector('.kn').children].filter(c => !(c.matches('[data-i-mere]') || c.querySelector(':scope > [data-i-mere]')));
      const b = synlige.length * B + (synlige.length - 1) * 2 + 12 + (i < grpM.length - 1 || vist ? 1 : 0);
      if (n++) x += 12;
      pos.set(g, [x, x + b]);
      x += b;
    });
    return { pos, indhold: x + (vist ? 0 : 12) };
  };
  const rect = (l, r) => ({ left: l, right: r, width: r - l, top: 0, bottom: 54, height: 54 });
  panelM.getBoundingClientRect = () => rect(0, Math.min(lag().indhold, W - (rodM.classList.contains('mere-vist') ? 88 : 0)));
  for (const g of grpM) g.getBoundingClientRect = () => { const p = lag().pos.get(g) || [0, 0]; return rect(p[0], p[1]); };
  const sidsteHoejre = () => [...lag().pos.values()].at(-1)[1];
  mb.tilpas();
  const naturlig = lag().indhold;
  tjek('mere: er der plads til alt, er Mere skjult, og intet flyttes (kontrol af regnestykket: rækken er ' + naturlig + ' px)', naturlig === 12 + (122 + 12 + 1) + 12 + (122 + 12 + 1) + 12 + (184 + 12 + 1) + 12 + (122 + 12) + 12 && plads.hidden && mb.mere.flyttet.length === 0);
  W = naturlig - 12;
  mb.tilpas();
  const kunLuft = plads.hidden && mb.mere.flyttet.length === 0;
  W = naturlig - 14;
  mb.tilpas();
  tjek('mere: rækken passer, så længe den sidste gruppe (med sin egen luft) er inden for båndet: 12 px for lidt fjerner kun rækkens luft til højre; 14 px for lidt: Mere vises, og kommandoerne flyttes bagfra, til rækken passer (k6, k5; gruppen g3 er tom og skjult)', kunLuft && !plads.hidden && rodM.classList.contains('mere-vist') && JSON.stringify(mb.mere.flyttet) === '["k5","k6"]' && grpM[3].hasAttribute('data-mere-tom') && sidsteHoejre() <= W - 88 + 1, JSON.stringify(mb.mere.flyttet));
  W = 520;
  mb.tilpas();
  const ved520 = JSON.stringify(mb.mere.flyttet) === '["k3","k4","k5","k6"]';
  W = 440;
  mb.tilpas();
  tjek('mere: smallere (520 px: k3–k6; 440 px: også k2): den primære flyttes sidst, et element (vælger/segment) og visningerne flyttes aldrig, og en gruppe med et element bliver stående', ved520 && JSON.stringify(mb.mere.flyttet) === '["k2","k3","k4","k5","k6"]' && !mb.knap('k1').hasAttribute('data-i-mere') && !rodM.querySelector('.vk[data-i-mere]') && !grpM[2].hasAttribute('data-mere-tom') && grpM[1].hasAttribute('data-mere-tom') === false && sidsteHoejre() <= W - 88 + 1, JSON.stringify(mb.mere.flyttet));
  W = 400;
  mb.tilpas();
  tjek('mere: endnu smallere: også den primære flyttes, når alle andre er flyttet; gruppen g1 er så tom og skjult', JSON.stringify(mb.mere.flyttet) === '["k1","k2","k3","k4","k5","k6"]' && grpM[1].hasAttribute('data-mere-tom'), JSON.stringify(mb.mere.flyttet));
  tjek('mere (CSS): en flyttet knap er skjult i båndet (også i sin .tip-plads), og en tom gruppe skjules', /\n\.cmd\.med-mere \.kn > \[data-i-mere\], \.cmd\.med-mere \.kn > \.tip-plads:has\(> \[data-i-mere\]\), \.cmd\.med-mere \.grp\[data-mere-tom\] \{ display: none; \}/.test(css) && mb.knap('k3').hasAttribute('data-i-mere') && mb.knap('k3').parentElement.classList.contains('tip-plads'));
  W = 440;
  mb.tilpas();
  // Menuen med tastaturet. (Tippets tekst sættes her i hånden; testen kører ikke sprogmodulet.)
  tipAf(mb.knap('k3')).textContent = 'Vælg en række først';
  mk.focus();
  mk.click();
  const p = () => [...menu.querySelectorAll('.mere-punkt')];
  tjek('mere: Enter/mellemrum på Mere (et klik uden mus) åbner menuen med fokus på første punkt; aria-expanded="true"', !menu.hidden && mk.getAttribute('aria-expanded') === 'true' && d.activeElement === p()[0]);
  tjek('mere: punkterne er de flyttede i båndets rækkefølge, med samme navn og ikon; tabindex −1 (fokus flyttes med piletasterne)', p().map(x => x.dataset.kommando).join() === 'k2,k3,k4,k5,k6' && p().every(x => x.querySelector('.mere-navn').textContent === x.dataset.kommando.toUpperCase() && x.querySelector('svg') && x.tabIndex === -1) && p()[0].querySelector('svg path').getAttribute('d') === K.IKONER.gem[0][1].d);
  const k3 = p()[1], k4 = p()[2];
  tjek('mere: en kommando slået fra er aria-disabled med hvorfor under navnet (.mere-hvorfor, aria-describedby; teksten fra knappens tip)', k3.getAttribute('aria-disabled') === 'true' && d.getElementById(k3.getAttribute('aria-describedby'))?.className === 'mere-hvorfor' && d.getElementById(k3.getAttribute('aria-describedby')).textContent === tipAf(mb.knap('k3')).textContent);
  tjek('mere: en kommando, der kan trykkes ind, er et menuitemcheckbox med aria-checked; de andre menuitem', k4.getAttribute('role') === 'menuitemcheckbox' && k4.getAttribute('aria-checked') === 'true' && p().filter(x => x !== k4).every(x => x.getAttribute('role') === 'menuitem'));
  tast(p()[0], 'ArrowDown');
  const ned1 = d.activeElement === p()[1];
  tast(p()[1], 'ArrowUp');
  tast(p()[0], 'ArrowUp');
  const rundt = d.activeElement === p().at(-1);
  tast(d.activeElement, 'Home');
  const home = d.activeElement === p()[0];
  tast(d.activeElement, 'End');
  tjek('mere: pil ned og op flytter (rundt), Home og End går til første og sidste', ned1 && rundt && home && d.activeElement === p().at(-1));
  const esc = tast(d.activeElement, 'Escape');
  tjek('mere: Esc lukker menuen med fokus på Mere (og stopper tastetrykket)', esc.defaultPrevented && menu.hidden && d.activeElement === mk && mk.getAttribute('aria-expanded') === 'false');
  tast(mk, 'ArrowUp');
  tjek('mere: pil op på Mere åbner med fokus på sidste punkt; Tab lukker og går videre (ikke stoppet)', !menu.hidden && d.activeElement === p().at(-1) && (() => { const t = tast(d.activeElement, 'Tab'); return !t.defaultPrevented && menu.hidden; })());
  // Menuen med musen: fokus og markering bliver, et klik udenfor lukker.
  const felt = d.createElement('input');
  d.body.appendChild(felt);
  felt.focus();
  const ned = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  mk.dispatchEvent(ned);
  mk.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  tjek('mere: med musen åbner menuen uden at flytte fokus (mousedown stoppes; G23: en markering i teksten bliver)', ned.defaultPrevented && !menu.hidden && d.activeElement === felt);
  const escUde = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  felt.dispatchEvent(escUde);
  tjek('mere: Esc lukker også, når fokus ikke er i menuen', escUde.defaultPrevented && menu.hidden);
  mk.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  d.body.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  tjek('mere: et klik uden for menuen lukker den', menu.hidden);
  // Et punkt klikker den skjulte knap; et punkt slået fra gør intet.
  const klik = [];
  for (const id of ['k2', 'k3']) mb.knap(id).addEventListener('click', () => klik.push(id));
  mk.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  p()[1].click();
  const efterFra = !menu.hidden && klik.length === 0;
  p()[0].click();
  tjek('mere: et punkt slået fra gør intet (menuen bliver); et punkt slået til lukker menuen og klikker den skjulte knap (samme handling)', efterFra && JSON.stringify(klik) === '["k2"]' && menu.hidden);
  mk.focus();
  mk.click();
  mb.saetDeaktiveret('k3', false);
  tjek('mere: saetDeaktiveret med menuen åben bygger den om (k3 er slået til, uden hvorfor)', !menu.hidden && !p()[1].hasAttribute('aria-disabled') && !p()[1].querySelector('.mere-hvorfor'));
  mb.tilpas();
  tjek('mere: tilpas lukker en åben menu', menu.hidden);
  // Den primære flyttes sidst, også når den ikke står først: tre knapper på 60 px i én gruppe (p2 er primær).
  {
    const rp = d.createElement('div');
    d.body.appendChild(rp);
    const bp = K.commandBar(rp, { udenFaner: true, mere: { t: 'kMere' }, faner: [{ id: 's', grupper: [{ t: 'g', knapper: [{ id: 'p1', tekst: 'P1' }, { id: 'p2', tekst: 'P2', pri: true }, { id: 'p3', tekst: 'P3' }] }] }] });
    const pp = rp.querySelector('.grupper'), gp = pp.querySelector('.grp');
    const synl = () => [...gp.querySelectorAll('.cb')].filter(b => !b.hasAttribute('data-i-mere')).length;
    const hoejre = () => 12 + synl() * 60 + (synl() - 1) * 2 + 12 + (rp.classList.contains('mere-vist') ? 1 : 0);
    const Wp = 12 + 60 + 12 + 1 + 88;
    pp.getBoundingClientRect = () => rect(0, Math.min(hoejre() + 12, Wp - (rp.classList.contains('mere-vist') ? 88 : 0)));
    gp.getBoundingClientRect = () => rect(12, hoejre());
    bp.tilpas();
    tjek('mere: den primære flyttes sidst, også når den står i midten (plads til én knap: P1 og P3 i Mere, P2 i båndet)', JSON.stringify(bp.mere.flyttet) === '["p1","p3"]' && !bp.knap('p2').hasAttribute('data-i-mere'), JSON.stringify(bp.mere.flyttet));
  }
  // Programmets egen hidden røres ikke.
  grpM[3].hidden = true;
  W = 2000;
  mb.tilpas();
  tjek('mere: en gruppe, programmet selv har skjult (hidden), røres ikke og står ikke i menuen', grpM[3].hidden && !grpM[3].hasAttribute('data-mere-tom') && plads.hidden && mb.mere.flyttet.length === 0);

  // ── CSS ──
  const regel = vaelger => { const i = css.indexOf('\n' + vaelger + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i) + 1); };
  tjek('CSS: aria-current="page" på en båndknap har flade og vægt som trykket og en streg på 2 px i accent (ikke kun farve) og ikonet i accent; aria-pressed er uændret', /\{ background: var\(--accent-soft\); border-color: var\(--accent-soft\); font-weight: 600; box-shadow: inset 0 -2px 0 var\(--accent\); \}/.test(regel('.cb[aria-current="page"]')) && /\n\.cb\[aria-current="page"\] svg \{ stroke: var\(--accent\); \}/.test(css) && /\n\.cb\[aria-pressed="true"\] \{ background: var\(--accent-soft\); border-color: var\(--accent-soft\); font-weight: 600; \}/.test(css));
  tjek('CSS: en visningsknap er et link uden understregning; navnet afkortes med … ved 152 px; tallet står øverst til højre, en pille ved kraever', /\na\.cb \{ text-decoration: none; \}/.test(css) && /\n\.vk-navn \{ max-width: 152px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/.test(css) && /\n\.cb\.vk \{ position: relative; \}/.test(css) && /position: absolute; top: 2px; right: 4px;/.test(regel('.cb.vk > .ant')) && /border: 1px solid var\(--danger\); border-radius: var\(--radius-pill\);/.test(regel('.cb.vk > .ant-kraever')) && /font-weight: 700;/.test(regel('.cb.vk > .ant-kraever')));
  tjek('CSS: Mere: båndet står på én række (nowrap, grupperne krymper ikke), Mere sidst efter et skille, menuen under Mere ved dens højre kant og inden for vinduet ved alle trin', /\n\.cmd\.med-mere \{ display: flex; align-items: flex-start; \}/.test(css) && /\n\.cmd\.med-mere > \.grupper \{ flex: 0 1 auto; min-width: 0; flex-wrap: nowrap; \}/.test(css) && /\n\.cmd\.med-mere > \.grupper > \.grp \{ flex: none; \}/.test(css) && /\n\.cmd\.mere-vist > \.grupper > \.grp:last-child \{ border-right: 1px solid var\(--border\); \}/.test(css) && /position: absolute; top: calc\(100% - var\(--space-1\)\); right: var\(--space-3\);/.test(regel('.mere-menu')) && /max-height: calc\(100vh \/ var\(--tekst-zoom\) - 160px\)/.test(regel('.mere-menu')));
  tjek('CSS: menupunktet slået fra: ikon og navn nedtonet (.5), hvorfor i sekundær tekst uden nedtoning; fokusring i info', /\n\.mere-punkt\[aria-disabled="true"\] > svg, \.mere-punkt\[aria-disabled="true"\] \.mere-navn \{ opacity: \.5; \}/.test(css) && /color: var\(--text-muted\);/.test(regel('.mere-hvorfor')) && !/opacity/.test(regel('.mere-hvorfor')) && /\n\.mere-punkt:focus-visible \{ outline: 2px solid var\(--info\); outline-offset: -2px; \}/.test(css));
  tjek('CSS: programmets eget mindstemål: én regel efter tekststørrelsens, der deler --vindue-min-bredde og --vindue-min-hoejde (standard 900 og 560 px) med --tekst-zoom for .vindue og :root[data-tekst] .vindue; de gamle regler står', css.lastIndexOf('\n.vindue, :root[data-tekst] .vindue { min-width: calc(var(--vindue-min-bredde, 900px) / var(--tekst-zoom)); min-height: calc(var(--vindue-min-hoejde, 560px) / var(--tekst-zoom)); }') > css.indexOf(':root[data-tekst="stor"] .vindue {') && css.indexOf(':root[data-tekst="stor"] .vindue {') > 0);
  tjek('CSS: et værktøjstip med .tip-tom vises aldrig', /\n\.tip\.tip-tom \{ display: none; \}/.test(css));
  // Programmets mindstemål regnet: med --vindue-min-bredde 1024px er vinduet 1024 px på skærmen i alle tre trin.
  const regn = (bredde, zoom) => bredde / zoom * zoom;
  tjek('regnet: med --vindue-min-bredde 1024px er .vindue 1024/0,9 = 1137,8 px ved lille og 1024/1,125 = 910,2 px ved stor i layoutet, altså 1024 px på skærmen; uden variablen 900 px som før', Math.abs(1024 / 0.9 - 1137.78) < 0.01 && Math.abs(1024 / 1.125 - 910.22) < 0.01 && [0.9, 1, 1.125].every(z => Math.abs(regn(1024, z) - 1024) < 1e-9 && Math.abs(regn(900, z) - 900) < 1e-9));

  // ── Dokumenterne ──
  const a270 = log.slice(log.indexOf('## 2.7.0'), log.indexOf('\n## 2.6.0'));
  tjek('CHANGELOG 2.7.0: første post med kun dato; Nyt (visninger, aria-current/saetAktuel, Mere, mindstemålet, reglen, .tip-tom); intet omdøbt eller fjernet; fanerækken virker som før', log.indexOf('## 2.7.0 — 2026-11-12') > 0 && log.indexOf('## 2.7.0') < log.indexOf('## 2.6.0') && /### Nyt/.test(a270) && ['visninger', 'saetAktuel', 'mere', '--vindue-min-bredde', 'ét bånd', '.tip-tom', 'K41', 'K42', 'G21', 'D26'].every(o => a270.includes(o)) && /Intet er omdøbt eller fjernet/.test(a270) && /`faner: true`\) virker som før/.test(a270));
  tjek('KOMPONENTER.md (AppShell): reglen "ét bånd; ingen række over det", hvornår fanerækken fra 2.6.0 må bruges, og programmets eget mindstemål', /### Ét bånd; ingen række over det \(regel fra 2\.7\.0, D26\)/.test(afsnitAf('AppShell')) && /### Programmets eget mindstemål \(fra 2\.7\.0\)/.test(afsnitAf('AppShell')) && /Fanerækken virker som før og fjernes ikke, men den må kun bruges/.test(afsnitAf('AppShell')) && /--vindue-min-bredde/.test(afsnitAf('AppShell')));
  tjek('KOMPONENTER.md (CommandBar): visningerne og Mere har afsnit med rollerne, hvad en skærmlæser hører, mere end farve, tal, tip, afkortning, tastatur og regel for én række; de nye klasser står i klasselisten', /### Visningerne som store knapper forrest i båndet \(fra 2\.7\.0, D26, K41, K42\)/.test(afsnitAf('CommandBar')) && /### Mere: båndet står altid på én række \(fra 2\.7\.0, G21\)/.test(afsnitAf('CommandBar')) && ['aria-current="page"', 'skærmlæser', 'ikke prøvet', 'streg på 2 px', 'Tab-stop', 'mellemrum', 'piletaster bruges ikke', 'afkortes med …', 'saetAktuel', 'menuitemcheckbox', 'Esc', 'getBoundingClientRect', 'primære'].every(o => afsnitAf('CommandBar').includes(o)) && V270_KLASSER.filter(k => k !== 'tip-tom').every(k => afsnitAf('CommandBar').includes('`.' + k + '`')) && afsnitAf('Værktøjstip').includes('`.tip-tom`'));
  tjek('README 2.7.0: indholdslisten og "Byg skærmen" nævner visningerne i båndet, Mere og mindstemålet', /fra 2\.7\.0 kan `Kit\.commandBar` have visningerne forrest \(`visninger`\) og Mere \(`mere`\)/.test(readme) && /Fra 2\.7\.0 er reglen ét bånd og ingen række over det/.test(readme) && /--vindue-min-bredde/.test(readme));
  tjek('flytning/HUGINN-MUNINN.md: D26, udskiftningen punkt for punkt (syv punkter), K41 og K42 opfyldt, og det, der står tilbage (K39, K40)', /### Fra 2\.7\.0: ét bånd, visningerne i det \(D26, K41, K42\)/.test(hm) && /Jans beslutning D26/.test(hm) && [1, 2, 3, 4, 5, 6, 7].every(n => new RegExp('\\n' + n + '\\. \\*\\*').test(hm.slice(hm.indexOf('### Fra 2.7.0')))) && /\*\*K41 og K42 er opfyldt med 2\.7\.0\.\*\*/.test(hm) && /K39 og K40/.test(hm.slice(hm.indexOf('### Fra 2.7.0'))) && /ramme\.js/.test(hm) && /fanerækken fra 2\.6\.0 \(`faner: true`\) virker stadig/i.test(hm));
}
{
  // Demoen 2.7.0 med pakkens rigtige filer, i begge sprog og temaer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const tekst = id => d.getElementById(id).textContent;
  const synligt = () => [...d.querySelectorAll('#demo-baand270 > [data-visning]')].filter(b => !b.hidden);
  const vk = () => [...synligt()[0].querySelectorAll('.vk')];
  tjek('demo 2.7.0: ét bånd under titellinjen (ingen række over), Oversigt åben (aria-current), fire visninger med navn forrest og gruppen Visninger, Siden sidst med tal, Login slået fra', synligt().length === 1 && synligt()[0].dataset.visning === 'oversigt' && d.getElementById('demo-baand270').previousElementSibling.className === 'titel' && vk().map(a => a.querySelector('.vk-navn').textContent).join() === 'Oversigt,Siden sidst,Angreb,Login' && vk()[0].getAttribute('aria-current') === 'page' && synligt()[0].querySelector('.grp-visninger .cap').textContent === 'Visninger' && vk()[1].querySelector('.ant-kraever')?.textContent === '3' && vk()[3].getAttribute('aria-disabled') === 'true' && d.getElementById(vk()[3].getAttribute('aria-describedby'))?.textContent === 'Login kræver en API-nøgle under Indstillinger.');
  vk()[2].click();
  tjek('demo 2.7.0: et klik på Angreb åbner den: dens bånd vises, og aria-current flytter', synligt()[0].dataset.visning === 'angreb' && vk()[2].getAttribute('aria-current') === 'page' && tekst('baand270-valgt') === 'Valgt: Angreb' && w.location.hash === '');
  vk()[3].click();
  tjek('demo 2.7.0: et klik på Login (slået fra) gør intet', synligt()[0].dataset.visning === 'angreb');
  synligt()[0].querySelector('[data-kommando="indst"]').click();
  tjek('demo 2.7.0: Indstillinger er en kommando med aria-current, mens den er åben, og ingen visning er åben imens', synligt()[0].querySelector('[data-kommando="indst"]').getAttribute('aria-current') === 'page' && !vk().some(a => a.hasAttribute('aria-current')) && tekst('baand270-valgt') === 'Valgt: Indstillinger er åben');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '¡', code: 'Digit1', altKey: true, bubbles: true, cancelable: true }));
  tjek('demo 2.7.0: genvejen Alt+1 står i tippet og åbner Oversigt (Indstillinger lukker)', synligt()[0].dataset.visning === 'oversigt' && vk()[0].getAttribute('aria-current') === 'page' && !synligt()[0].querySelector('[data-kommando="indst"]').hasAttribute('aria-current') && d.getElementById(vk()[0].getAttribute('aria-describedby'))?.textContent === 'Alt+1');
  const smal = d.getElementById('demo-baand270-mere'), otte = d.getElementById('demo-baand270-otte');
  tjek('demo 2.7.0: et smalt bånd med Mere (de fire visninger, ni kommandoer) og otte visninger som Huginn and Muninn (Hent nu, Vejledning, Indstillinger, Mere)', smal.classList.contains('med-mere') && smal.closest('.demo-baand-smal') && smal.querySelectorAll('.vk').length === 4 && smal.querySelectorAll('.grupper .cb:not(.vk)').length === 8 && smal.querySelector('.cb-mere').textContent === 'Mere' && otte.querySelectorAll('.vk').length === 8 && otte.querySelector('.vk[aria-current="page"]').dataset.visning === 'overblik' && otte.querySelector('.vk[data-visning="siden"] .ant-kraever')?.textContent === '4' && [...otte.querySelectorAll('.grupper .cb:not(.vk)')].map(b => b.dataset.kommando).join() === 'hent,vejledning,indst');
  w.Sprog.saet('en');
  tjek('demo 2.7.0 (English): knapperne, gruppen, Mere og teksterne følger sproget', vk().map(a => a.querySelector('.vk-navn').textContent).join() === 'Overview,Since last time,Attacks,Login' && synligt()[0].querySelector('.grp-visninger .cap').textContent === 'Views' && smal.querySelector('.cb-mere').textContent === 'More' && d.querySelector('[data-t="h270Baand"]').textContent === 'One command bar: the views as large buttons (from 2.7.0)');
  w.Tema.saet('moerk');
  tjek('demo 2.7.0: mørkt tema sættes på siden med båndet', d.documentElement.getAttribute('data-tema') === 'moerk' && Boolean(d.querySelector('#demo-baand270 .vk[aria-current="page"]')));
  const da = Object.keys(w.Sprog.TEKST.da), en = Object.keys(w.Sprog.TEKST.en);
  tjek('demo 2.7.0: dansk og engelsk har de samme nøgler, og ingen nøgle på siden mangler', JSON.stringify(da.slice().sort()) === JSON.stringify(en.slice().sort()) && [...d.querySelectorAll('[data-t],[data-t-aria]')].every(e => ['data-t', 'data-t-aria'].every(x => !e.hasAttribute(x) || e.getAttribute(x) in w.Sprog.TEKST.da)));
  w.close();
}

// ── N4: flyttevejledningerne ──
{
  for (const [fil, ord] of [['flytning/HUGINN-MUNINN.md', ['manual', 'fotobog']], ['flytning/WI24RD-FTP.md', ['Tokens.xaml', 'DynamicResource']]]) {
    const t = pk(fil);
    const DELE = ['## Hvad programmet har i dag', '## Rækkefølgen', '## Det, der ikke kan flyttes endnu', '## Det, der skal tages om bagefter', '## Forslag til cyklusser', '## Ikke undersøgt'];
    const mangler = DELE.filter(d => !t.includes(d));
    tjek(`${fil}: har alle afsnit`, mangler.length === 0 && ord.every(o => t.includes(o)), mangler.join(', '));
  }
}

// ── V-KVIT.1 N4: beslutningen om Huginn and Muninn og noten om Sandbox ──
{
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('V-KVIT.1: HUGINN-MUNINN.md: beslutningen (hele Kit 2-skallen, 2026-11-11) står der, og valget er ikke længere åbent', /## Beslutning: hele skallen/.test(hm) && /Jan har besluttet 2026-11-11/.test(hm) && /hele Kit 2-skallen/.test(hm) && ['mørk titellinje', 'handlingsbånd', 'træ', 'fodlinje'].every(o => hm.includes(o)) && !/kun hvis Jan vælger|kun ved hele skallen|Jan vælger: hele skallen eller/.test(hm));
  const cyk = hm.slice(hm.indexOf('## Forslag til cyklusser'), hm.indexOf('## Ikke undersøgt'));
  tjek('V-KVIT.1: HUGINN-MUNINN.md: cyklusserne er dem for hele skallen (A, B1–B6; skallen i B3 og B4)', ['| A (undersøgelse) |', '| B1 |', '| B2 |', '| B3 |', '| B4 |', '| B5 |', '| B6 |'].every(o => cyk.includes(o)) && !cyk.includes('| B7 |') && /\| B3 \| Trin 7, rammen/.test(cyk) && /\| B4 \| Trin 7, visningerne/.test(cyk));
  const sb = pk('flytning/WI24RD-SANDBOX.md');
  tjek('V-KVIT.1: WI24RD-SANDBOX.md: kun Windows, venter, ikke undersøgt, samme vej som FTP (XAML)', /kun et Windows-program/.test(sb) && /ligger og venter/.test(sb) && /ikke undersøgt/.test(sb) && /samme vej som Wi24rd FTP/.test(sb) && sb.includes('XAML') && sb.includes('WI24RD-FTP.md') && sb.length < 2000);
  tjek('V-KVIT.1: WI24RD-FTP.md peger på noten om Sandbox', pk('flytning/WI24RD-FTP.md').includes('WI24RD-SANDBOX.md'));
}

console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
