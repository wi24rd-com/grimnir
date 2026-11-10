/* Grimnir — tema. localStorage['grimnir-tema'] = lys | moerk | system (standard: system) → <html data-tema>, som vælger
   farverne i tokens.css. Står uden defer i <head>, så temaet er sat, før siden tegnes første gang (intet hvidt blink i
   mørkt tema). Mønsteret er Huginn and Muninns (ui/assets/tema.js). Et skift melder 'grimnir-tema' på document. */
(function () {
  'use strict';
  const NOEGLE = 'grimnir-tema';
  const VALG = ['lys', 'moerk', 'system'];
  let valg = 'system';
  try {
    const v = localStorage.getItem(NOEGLE);
    if (VALG.includes(v)) valg = v;
  } catch (e) { /* ingen lagring (fx privat tilstand): temaet følger systemet */ }
  document.documentElement.setAttribute('data-tema', valg);
  window.Tema = {
    VALG,
    get valg() { return valg; },
    saet(v) {
      valg = VALG.includes(v) ? v : 'system';
      try { localStorage.setItem(NOEGLE, valg); } catch (e) { /* valget gælder kun denne gang */ }
      document.documentElement.setAttribute('data-tema', valg);
      document.dispatchEvent(new CustomEvent('grimnir-tema'));
    },
  };
})();
