// Parité des locales : extrait les blocs de STRINGS et compare les jeux de clés.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ICI = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(ICI, '..', 'content.js'), 'utf8');
const lines = src.split('\n');

// Repère les ouvertures de bloc locale : "    fr: {" (indentation 4)
const starts = [];
lines.forEach((l, i) => {
  const m = /^ {4}(fr|en|de|es|pt|it|pl|ru|ja|zh): Object\.freeze\(\{\s*$/.exec(l);
  if (m) starts.push({ lang: m[1], line: i });
});
if (starts.length !== 10) { console.error('Blocs trouvés :', starts.map(s => s.lang)); process.exit(1); }

const keysOf = (from) => {
  const out = [];
  for (let i = from + 1; i < lines.length; i++) {
    if (/^ {4}\}\)/.test(lines[i])) break;
    const m = /^ {6}([A-Za-z0-9_]+):/.exec(lines[i]); // clé de 1er niveau
    if (m) out.push(m[1]);
  }
  return out;
};

const byLang = new Map(starts.map(s => [s.lang, keysOf(s.line)]));
let bad = 0;

for (const [lang, keys] of byLang) {
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) { console.error(`✗ ${lang} : clés dupliquées → ${[...new Set(dupes)].join(', ')}`); bad++; }
}

const ref = byLang.get('fr');
for (const [lang, keys] of byLang) {
  if (lang === 'fr') continue;
  const missing = ref.filter(k => !keys.includes(k));
  const extra   = keys.filter(k => !ref.includes(k));
  if (missing.length) { console.error(`✗ ${lang} : manque → ${missing.join(', ')}`); bad++; }
  if (extra.length)   { console.error(`✗ ${lang} : en trop → ${extra.join(', ')}`); bad++; }
}

console.log(`STRINGS  : ${[...byLang].map(([l, k]) => `${l}=${k.length}`).join('  ')}`);

/* ============================================================
 *  LE PANNEAU — DOUZE LOCALES, ET AUCUNE CLÉ MANQUANTE
 *  ------------------------------------------------------------
 *  Ce sont DEUX SURFACES DE TRADUCTION DIFFÉRENTES, et il faut le
 *  garder en tête : ci-dessus, les dix blocs STRINGS de content.js
 *  servent la barre latérale et la console ; ici, les douze
 *  _locales/ servent le panneau de la barre d'outils, qui est une
 *  page d'extension et n'a pas accès à STRINGS.
 *
 *  Deux tables, deux contrôles. Celui-ci vérifie deux choses que
 *  rien d'autre ne peut voir :
 *
 *    1. les douze locales portent EXACTEMENT les mêmes clés ;
 *    2. chaque clé que le panneau DEMANDE existe vraiment.
 *
 *  Le second point est le vrai risque. chrome.i18n.getMessage()
 *  d'une clé inconnue ne lève pas : elle rend la chaîne vide. Un
 *  libellé oublié donne donc un bouton VIDE, sans erreur, sans
 *  console, sans rien — et seulement dans la langue oubliée, que
 *  l'auteur ne parle pas. C'est le défaut parfait : invisible à
 *  celui qui pourrait le corriger.
 * ============================================================ */
const LOCALES = readdirSync(join(ICI, '..', '_locales'));
const messages = new Map(LOCALES.map(l =>
  [l, JSON.parse(readFileSync(join(ICI, '..', '_locales', l, 'messages.json'), 'utf8'))]));

const refLoc = Object.keys(messages.get('en'));
for (const [loc, m] of messages) {
  if (loc === 'en') continue;
  const cles = Object.keys(m);
  const manque = refLoc.filter(k => !cles.includes(k));
  const trop   = cles.filter(k => !refLoc.includes(k));
  if (manque.length) { console.error(`✗ _locales/${loc} : manque → ${manque.join(', ')}`); bad++; }
  if (trop.length)   { console.error(`✗ _locales/${loc} : en trop → ${trop.join(', ')}`); bad++; }
  const vides = cles.filter(k => !String(m[k].message || '').trim());
  if (vides.length)  { console.error(`✗ _locales/${loc} : message vide → ${vides.join(', ')}`); bad++; }
}

/* LES CLÉS QUE LE PANNEAU DEMANDE, relevées dans son code.

   Première écriture, je ne cherchais que `T('…')`, `data-i18n` et les tables
   déclaratives. Douze clés y échappaient — celles passées à un ternaire, comme
   `T(valeur === 'ok' ? 'statusOk' : 'statusBroken')` — et le contrôle les
   déclarait orphelines alors qu'elles s'affichent. Suivre chaque expression
   demanderait d'analyser le JavaScript ; on s'appuie donc sur une CONVENTION,
   et on la fait respecter juste en dessous.

   Toute clé de traduction du panneau commence par l'un de ces préfixes suivi
   d'une majuscule. Un littéral qui a cette forme est une clé, où qu'il soit
   écrit — ternaire compris ; et une clé qui a cette forme sans exister dans
   _locales est une faute de frappe, que ce relevé attrape aussi. */
const PREFIXES = /^(nav|desc|col|sum|btn|state|status|val|health|reset|report|grp|panel|ext)[A-Z]/;
const html = readFileSync(join(ICI, '..', 'panneau.html'), 'utf8');
const js   = readFileSync(join(ICI, '..', 'panneau.js'), 'utf8');
const MAJ  = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const demandees = new Set([
  ...[...html.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)].map(m => m[1]),
  ...[...js.matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1]).filter(k => PREFIXES.test(k)),
]);
/* Les sections dérivent leurs clés de leur identifiant — nav+Id et desc+Id.
   On reconstitue ici exactement ce que font cleNav et cleDesc, sinon ces
   vingt clés passeraient pour orphelines. */
for (const m of js.matchAll(/\{ id: '([A-Za-z0-9_]+)',\s+groupe:/g)) {
  demandees.add('nav' + MAJ(m[1]));
  demandees.add('desc' + MAJ(m[1]));
}
/* La convention doit valoir dans les deux sens : une clé de _locales qui ne
   la suivrait pas ne serait jamais relevée par le filtre ci-dessus, et
   passerait donc pour demandée sans que personne ne l'affiche. */
const horsConvention = refLoc.filter(k => !PREFIXES.test(k));
if (horsConvention.length) {
  console.error(`✗ clés hors convention de préfixe → ${horsConvention.join(', ')}`);
  bad++;
}
/* Un relevé qui ne trouverait plus rien passerait en ne vérifiant rien —
   c'est la panne la plus discrète qu'un contrôle puisse avoir. On exige donc
   d'en avoir trouvé un nombre plausible avant de conclure quoi que ce soit. */
if (demandees.size < 60) {
  console.error(`✗ relevé des clés du panneau : ${demandees.size} trouvées, c'est trop peu — la lecture ne reconnaît plus le code`);
  bad++;
}
const inconnues = [...demandees].filter(k => !refLoc.includes(k));
if (inconnues.length) {
  console.error(`✗ le panneau demande des clés qui n'existent pas → ${inconnues.join(', ')}`);
  bad++;
}
/* L'inverse aussi : une clé traduite douze fois que plus personne n'affiche
   est du poids mort dans chaque installation, et une piste fausse pour qui
   relit. extName et extDescription sont lues par le manifeste, pas par le
   panneau — elles n'ont donc pas à y figurer. */
const DU_MANIFESTE = ['extName', 'extDescription'];
const orphelines = refLoc.filter(k => !demandees.has(k) && !DU_MANIFESTE.includes(k));
if (orphelines.length) {
  console.error(`✗ clés traduites que le panneau n'affiche plus → ${orphelines.join(', ')}`);
  bad++;
}

console.log(`_locales : ${LOCALES.length} locales × ${refLoc.length} clés — `
  + `${demandees.size} demandées par le panneau`);
console.log(bad ? `✗ ${bad} problème(s)` : '✓ parité des locales OK');
process.exit(bad ? 1 : 0);
