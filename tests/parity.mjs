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
const PREFIXES = /^(nav|desc|col|sum|btn|state|status|val|health|reset|report|grp|panel|ext|guide|opt|purge)[A-Z]/;
const html = readFileSync(join(ICI, '..', 'panneau.html'), 'utf8');
const js   = readFileSync(join(ICI, '..', 'panneau.js'), 'utf8');
const MAJ  = (x) => x.charAt(0).toUpperCase() + x.slice(1);
/* TROIS SORTES DE LITTÉRAUX RESSEMBLENT À DES CLÉS SANS EN ÊTRE, et le relevé
   large les ramassait toutes les trois :

     — les FRAGMENTS de composition. « 'optDesc' + MAJ(id) » laisse traîner
       « optDesc », qui suit la convention et n'est pourtant la clé de rien ;
     — les IDENTIFIANTS D'ACTION. « resetOptions » commence par « reset » suivi
       d'une capitale : il passe le filtre alors qu'il nomme une fonction de
       content.js, pas un message ;
     — les RACINES DE CONFIRMATION. « optReset » ne s'affiche jamais seul ;
       seuls « optResetTitle » et « optResetText » existent.

   ON LES EXCLUT PAR CONSTRUCTION plutôt que par une liste de noms : une liste
   aurait vieilli au premier renommage, et vieilli en SILENCE — un faux positif
   de moins, c'est un vrai positif de moins aussi. */
const fragment = new Set([...js.matchAll(/'([A-Za-z0-9_]+)'\s*\+\s*MAJ\(/g)].map(m => m[1]));
const idAction = new Set([...js.matchAll(/\{ id: '([A-Za-z0-9_]+)', cle:/g)].map(m => m[1]));
const racineOk = new Set([...js.matchAll(/confirme: '([A-Za-z0-9_]+)'/g)].map(m => m[1]));
const structurel = (k) => fragment.has(k) || idAction.has(k) || racineOk.has(k);

const demandees = new Set([
  ...[...html.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)].map(m => m[1]),
  ...[...js.matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1])
      .filter(k => PREFIXES.test(k) && !structurel(k)),
]);
/* Les sections dérivent leurs clés de leur identifiant — nav+Id et desc+Id.
   On reconstitue ici exactement ce que font cleNav et cleDesc, sinon ces
   vingt clés passeraient pour orphelines. */
for (const m of js.matchAll(/\{ id: '([A-Za-z0-9_]+)',\s+groupe:/g)) {
  demandees.add('nav' + MAJ(m[1]));
  demandees.add('desc' + MAJ(m[1]));
}
/* ── LES RÉGLAGES : UN CONTRAT ENTRE content.js ET _locales ─────────────────
   Les libellés des réglages ne sont pas des littéraux dans panneau.js — ils se
   composent, « opt » + l'identifiant en capitale initiale, exactement comme
   nav et desc se composent pour les sections. Le relevé ci-dessus ne peut donc
   pas les voir, et les vingt-deux clés passeraient pour orphelines.

   ON NE LES AJOUTE PAS À LA MAIN, ON LES DÉDUIT DE LA TABLE DE content.js.
   C'est ce qui en fait un contrôle et non une liste : ajouter un réglage à
   OPT_DEFS sans lui écrire de libellé fait échouer la parité, dans les douze
   langues d'un coup. Sans ce lien, un réglage neuf se serait affiché sous son
   identifiant brut — « optApercuVideo » — et rien ne l'aurait dit.

   LES DESCRIPTIONS SONT TOLÉRÉES, PAS EXIGÉES. Toutes les lignes n'en ont pas
   besoin, et en réclamer une pour chacune aurait produit vingt-deux phrases
   dont la moitié n'auraient répété que le libellé. Elles échappent donc au
   relevé des orphelines sans entrer dans celui des manquantes. */
const contenu = readFileSync(join(ICI, '..', 'content.js'), 'utf8');
const blocOpt = /const OPT_DEFS = Object\.freeze\(\{([\s\S]*?)\n  \}\);/.exec(contenu);
if (!blocOpt) {
  console.error("✗ OPT_DEFS introuvable dans content.js — le contrat des réglages ne peut pas être vérifié");
  bad++;
}
const idsOpt = blocOpt
  ? [...blocOpt[1].matchAll(/^ {4}([a-zA-Z]+):\s+\{/gm)].map(m => m[1]) : [];
if (blocOpt && idsOpt.length < 10) {
  console.error(`✗ relevé des réglages : ${idsOpt.length} trouvés, c'est trop peu — la lecture ne reconnaît plus OPT_DEFS`);
  bad++;
}
const TOLEREES = new Set();
for (const id of idsOpt) {
  demandees.add('opt' + MAJ(id));
  TOLEREES.add('optDesc' + MAJ(id));
}
/* Les confirmations d'action se composent elles aussi — « confirme » + Title
   et + Text — au même titre que nav et desc. */
for (const m of js.matchAll(/confirme: '([A-Za-z0-9_]+)'/g)) {
  demandees.add(m[1] + 'Title');
  demandees.add(m[1] + 'Text');
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
/* `extActionTitle` rejoint les deux autres : elle est lue par la clé
   `action.default_title` du manifeste, et par personne d'autre. Sans elle ici,
   le relevé des orphelines la dénoncerait à chaque passage — une clé traduite
   douze fois que le panneau n'affiche jamais, pour la bonne raison qu'elle
   s'affiche AILLEURS : dans l'infobulle de l'icône. */
const DU_MANIFESTE = ['extName', 'extDescription', 'extActionTitle'];
const orphelines = refLoc.filter(k => !demandees.has(k) && !DU_MANIFESTE.includes(k)
                                     && !TOLEREES.has(k));
if (orphelines.length) {
  console.error(`✗ clés traduites que le panneau n'affiche plus → ${orphelines.join(', ')}`);
  bad++;
}

console.log(`_locales : ${LOCALES.length} locales × ${refLoc.length} clés — `
  + `${demandees.size} demandées par le panneau`);
console.log(bad ? `✗ ${bad} problème(s)` : '✓ parité des locales OK');
process.exit(bad ? 1 : 0);
