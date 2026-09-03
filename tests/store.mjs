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

console.log(`\n${echecs ? `${echecs} ÉCHEC(S)` : 'fiches de description OK'}\n`);
process.exit(echecs ? 1 : 0);
