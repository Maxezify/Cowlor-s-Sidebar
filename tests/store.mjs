/* ============================================================
 *  LES FICHES DE DESCRIPTION — CE QU'UNE MACHINE PEUT EN DIRE
 *  ------------------------------------------------------------
 *  Douze fiches, douze langues, deux cents lignes chacune. Aucune
 *  relecture humaine ne tient ça dans sa tête, et personne ne
 *  relit une fiche russe pour vérifier qu'il ne manque pas une
 *  section au milieu.
 *
 *  Ce script ne juge PAS les traductions — il n'en a pas les
 *  moyens. Il vérifie leur SQUELETTE, qui doit être identique
 *  d'une langue à l'autre parce que toutes disent la même chose :
 *  même nombre de sections, de séparateurs, de puces, d'étoiles,
 *  et la même liste de dix langues. Une section oubliée en
 *  traduisant se voit là, immédiatement.
 *
 *  Il vérifie aussi ce que la session a appris à ses dépens : la
 *  fiche a promis un badge qui n'existait pas pendant dix
 *  versions. Les libellés que le produit affiche vraiment sont
 *  donc confrontés à content.js — pas tous, seulement ceux qui
 *  sont cités mot pour mot.
 * ============================================================ */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI    = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const STORE  = join(RACINE, 'store');

let echecs = 0;
const ok = (nom, cond, detail = '') => {
  if (cond) { console.log('  ✓', nom); return; }
  echecs++; console.log('  ✗', nom, detail ? '—  ' + detail : '');
};

const fiches = readdirSync(STORE)
  .filter(f => /^description-.+\.txt$/.test(f))
  .sort();
const lu = new Map(fiches.map(f => [f, readFileSync(join(STORE, f), 'utf8')]));

console.log(`\nFiches de description — ${fiches.length} langues`);

/* Le squelette. La fiche anglaise fait référence : c'est d'elle que partent
   toutes les autres, et le README du dossier le dit. */
const REF = 'description-en.txt';
const profil = (s) => ({
  sections:     s.split('\n➤ ').length - 1,
  separateurs:  s.split('_______________________________').length - 1,
  puces:        s.split('\n').filter(l => l.startsWith('- ')).length,
  etoiles:      s.split('★').length - 1,
});
const attendu = profil(lu.get(REF));
const differents = fiches.filter(f => {
  const p = profil(lu.get(f));
  return Object.keys(attendu).some(k => p[k] !== attendu[k]);
});
ok(`toutes ont le squelette de la fiche anglaise (${attendu.sections} sections, `
   + `${attendu.puces} puces, ${attendu.etoiles} étoiles)`,
   differents.length === 0,
   differents.map(f => `${f} ${JSON.stringify(profil(lu.get(f)))}`).join(' | '));

/* La liste des langues annoncées doit être celle des tables de content.js.
   C'est le contrôle qui aurait évité de promettre cinq langues quand le
   produit en parlait déjà dix. */
const content = readFileSync(join(RACINE, 'content.js'), 'utf8');
const tables = [...content.matchAll(/^ {4}([a-z_]{2,5}): Object\.freeze\(\{$/gm)].map(m => m[1]);
const DRAPEAUX = ['🇬🇧', '🇫🇷', '🇩🇪', '🇪🇸', '🇧🇷🇵🇹', '🇮🇹', '🇵🇱', '🇷🇺', '🇯🇵', '🇨🇳'];
ok(`content.js porte ${DRAPEAUX.length} tables de langue`,
   tables.length === DRAPEAUX.length, tables.join(','));
const sansToutes = fiches.filter(f => DRAPEAUX.some(d => !lu.get(f).includes('\n- ' + d)));
ok('et chaque fiche les annonce toutes', sansToutes.length === 0, sansToutes.join(', '));

/* Le magasin visé. Une fiche AMO qui dit « Ajouter à Chrome » est un
   copier-coller raté, et l'inverse aussi. Le polonais décline le nom
   (« Firefoksa »), donc on cherche la RACINE, pas le mot entier — un contrôle
   naïf aurait déclaré la fiche polonaise fautive alors qu'elle est juste. */
const gecko = JSON.parse(readFileSync(join(RACINE, 'manifest.json'), 'utf8'))
  .browser_specific_settings?.gecko;
const attenduRacine = gecko ? 'Firefo' : 'Chrome';
const interdit     = gecko ? 'Chrome' : 'Firefo';
const install = (s) => s.split('\n').find(l => /^1\. /.test(l)) ?? '';
const mauvaises = fiches.filter(f => {
  const l = install(lu.get(f));
  return !l.includes(attenduRacine) || l.includes(interdit);
});
ok(`la ligne d'installation nomme ${gecko ? 'Firefox' : 'Chrome'} dans les ${fiches.length} fiches`,
   mauvaises.length === 0,
   mauvaises.map(f => `${f} : ${install(lu.get(f))}`).join(' | '));

/* Ce que le produit affiche VRAIMENT. La fiche a promis un badge d'étiquettes
   pendant dix versions avant qu'il n'existe ; on ne recommence pas.

   La liste ci-dessous est un CONTRAT À DEUX SENS : chaque libellé doit être
   dans la fiche anglaise ET dans content.js. La première écriture ne vérifiait
   qu'un sens — « si la fiche le dit, le code doit l'avoir » — et se
   désamorçait toute seule dès qu'on renommait le libellé dans la fiche, qui
   sortait alors du champ. La mutation l'a montré : renommer « Just switched
   to » en « Just moved onto » ne faisait rien échouer.
   La liste ne contient QUE des libellés cités mot pour mot des deux côtés.
   « Co-stream of » et « Sponsored by » en ont été retirés : la fiche les écrit
   en capitales dans ses intertitres (« ★ SPONSORED BY ★ »), donc la chaîne
   exacte n'y figure pas. Les y laisser aurait fait un contrôle rouge en
   permanence — c'est-à-dire un contrôle qu'on finit par ignorer. */
const CITES = [
  ['Just switched to', 'uiBadgeCategorySwitch'],
  ['Formerly subscribed', 'uiBadgeExSubMonths'],
  ['Live with', 'uiBadgeLiveWith'],
];
const en = lu.get(REF);
const rompus = CITES.flatMap(([texte, cle]) => {
  const dansFiche = en.includes(texte);
  const dansCode  = content.includes(texte);
  if (dansFiche && dansCode) return [];
  return [`${cle} « ${texte} » ${dansFiche ? 'absent de content.js' : 'absent de la fiche'}`];
});
ok('les libellés du contrat sont dans la fiche anglaise ET dans content.js',
   rompus.length === 0, rompus.join(' | '));

/* ============================================================
 *  LES IMAGES DE PRÉSENTATION
 *  ------------------------------------------------------------
 *  Une fiche sans image n'est pas une fiche : le tableau de bord
 *  en demande une bannière et cinq captures, et une langue qui
 *  n'aurait pas les siennes serait publiée avec celles d'une
 *  autre. C'est exactement ce qui s'est passé quand les cinq
 *  langues de la 3.57 sont arrivées : douze fiches de texte, sept
 *  jeux d'images. Rien ne le disait — les images sont des
 *  artefacts, elles ne sont pas dans le dépôt, et personne ne
 *  compte des fichiers PNG qu'il ne voit pas.
 *
 *  Ce qui EST dans le dépôt, c'est le discours de chaque langue :
 *  la table T de promo-run.mjs, celle de promo-marquee.mjs, et la
 *  table SECTION de promo.mjs. Les trois doivent couvrir les mêmes
 *  langues que store/, sans quoi `npm run promo` sortira un jeu
 *  incomplet — ou s'arrêtera sur « fiche inconnue ».
 * ============================================================ */
console.log('\nImages de présentation');

/* La correspondance fiche → clé de capture ne se déduit pas du nom de fichier,
   et une normalisation « à la main » s'y casserait : es-419 devient « es419 »,
   mais zh-CN devient « zh » et non « zhcn ». On l'écrit donc, et on vérifie
   qu'elle décrit exactement les fiches présentes. */
const IMAGES = {
  'description-en.txt': 'en',      'description-fr.txt': 'fr',
  'description-de.txt': 'de',      'description-es.txt': 'es',
  'description-es-419.txt': 'es419', 'description-pt-BR.txt': 'ptbr',
  'description-pt-PT.txt': 'ptpt', 'description-it.txt': 'it',
  'description-pl.txt': 'pl',      'description-ru.txt': 'ru',
  'description-ja.txt': 'ja',      'description-zh-CN.txt': 'zh',
};
const sansImage = fiches.filter(f => !IMAGES[f]);
const sansFiche = Object.keys(IMAGES).filter(f => !lu.has(f));
ok('chaque fiche a une clé de capture, et réciproquement',
   sansImage.length === 0 && sansFiche.length === 0,
   [...sansImage.map(f => `${f} sans clé`),
    ...sansFiche.map(f => `${f} sans fiche`)].join(', '));

const attenduCles = new Set(Object.values(IMAGES));
const lireCles = (fichier, motif) => {
  const src = readFileSync(join(RACINE, fichier), 'utf8');
  return new Set([...src.matchAll(motif)].map(m => m[1]));
};
const memeJeu = (a, b) => a.size === b.size && [...a].every(k => b.has(k));
const manque = (a) => [...attenduCles].filter(k => !a.has(k)).join(',') || '—';
const enTrop = (a) => [...a].filter(k => !attenduCles.has(k)).join(',') || '—';

for (const [fichier, motif] of [
  ['promo-run.mjs',     /^ {2}([a-z0-9]+): \{ ui:/gm],
  ['promo-marquee.mjs', /^ {2}([a-z0-9]+):\s+\{ ui:/gm],
]) {
  const cles = lireCles(fichier, motif);
  ok(`${fichier} porte le discours des ${attenduCles.size} langues`,
     memeJeu(cles, attenduCles), `manquantes : ${manque(cles)} — en trop : ${enTrop(cles)}`);
}

/* La table SECTION, et ce qu'elle promet. Ses six premières entrées sont les
   libellés natifs de Twitch que detectLanguage() compare mot pour mot : elles
   doivent être dans DOM.followedLabels, sinon la scène rendrait en français.
   Les cinq dernières sont le libellé de l'extension, `followedLabel`. Dans les
   deux cas la chaîne doit exister dans content.js — une faute de frappe ici ne
   se verrait que sur l'image publiée. */
const bloc = /const SECTION = \{([\s\S]*?)\n\};/.exec(
  readFileSync(join(RACINE, 'promo.mjs'), 'utf8'));
const section = new Map([...(bloc?.[1] ?? '').matchAll(/([a-z0-9]+): '([^']+)'/g)]
  .map(m => [m[1], m[2]]));
ok(`promo.mjs nomme la section dans les ${attenduCles.size} langues`,
   memeJeu(new Set(section.keys()), attenduCles),
   `manquantes : ${manque(new Set(section.keys()))} — en trop : ${enTrop(new Set(section.keys()))}`);
const inconnus = [...section].filter(([, libelle]) => !content.includes(`'${libelle}'`));
ok('et chacun de ces libellés existe dans content.js',
   inconnus.length === 0, inconnus.map(([k, v]) => `${k} : « ${v} »`).join(' | '));

console.log(`\n${echecs ? `${echecs} ÉCHEC(S)` : 'fiches et images OK'}\n`);
process.exit(echecs ? 1 : 0);
