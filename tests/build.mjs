import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { degraisser } from './degraisser.mjs';

// Chemins résolus depuis CE fichier, jamais depuis le répertoire courant :
// `npm test` s'exécute à la racine, un lancement direct depuis tests/ ne s'y
// trouve pas, et les deux doivent marcher.
const ICI    = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');

let src = readFileSync(join(RACINE, 'content.js'), 'utf8');

/* TSE_SANS_COMMENTAIRES=1 fait tourner le banc sur le fichier tel qu'il est
   LIVRÉ, c'est-à-dire dégraissé de ses commentaires par tests/addon.mjs.
   L'égalité des flux de jetons, vérifiée à l'assemblage, dit déjà que le
   programme est le même ; mais « le même programme » est une affirmation sur
   la grammaire, et 555 assertions sont une affirmation sur le comportement.
   Les deux ne coûtent pas cher, et la seconde est celle qu'on publie. */
/* Deux formes, et la seconde n'est pas un luxe : `VAR=1 npm run …` ne
   fonctionne pas dans le cmd de Windows, où ce dépôt est aussi ouvert. Le
   drapeau, lui, traverse. */
const SANS_COMMENTAIRES = process.env.TSE_SANS_COMMENTAIRES === '1'
  || process.argv.includes('--sans-commentaires');
if (SANS_COMMENTAIRES) src = degraisser(src);

// SEULE transformation : accélération des constantes de temps, pour ne pas
// attendre 30 s réelles par cycle. La logique testée est celle du dépôt.
const subs = [
  [/LIVE_TTL:\s*[\d_]+/,        'LIVE_TTL:       600'],
  [/REFRESH_TICK:\s*[\d_]+/,    'REFRESH_TICK:   100'],
  [/GQL_ERROR_COOLDOWN:\s*30_000/, 'GQL_ERROR_COOLDOWN: 1500'],
  [/MAINTENANCE_TICK:\s*5 \* 60_000/, 'MAINTENANCE_TICK: 30_000'],
  [/LOADING_TIMEOUT_MS:\s*15_000/, 'LOADING_TIMEOUT_MS: 1_200'],
  [/LOADING_STABILITY_MS:\s*1_500/, 'LOADING_STABILITY_MS: 300'],
  [/MAINTENANCE_TICK: 30_000/,     'MAINTENANCE_TICK: 1_200'],
  [/LAG_SETTLE_MS:\s*60_000/,      'LAG_SETTLE_MS:        700'],
  // Tranche de cache des miniatures : 2 min 30 en production. Réduite ici pour
  // qu'un changement de tranche — et donc la purge du registre de préchargement
  // — se produise pendant un test au lieu d'après.
  [/PREVIEW_THUMB_CACHE_MS:\s*[\d_]+/, 'PREVIEW_THUMB_CACHE_MS: 3_000'],
  // Le debounce de scan et le regroupement en lot sont la LATENCE DE PIPELINE :
  // c'est elle qui décale l'écriture d'une entrée par rapport au réveil qui l'a
  // demandée. À l'échelle accélérée du harnais, les garder à 250 ms les rendrait
  // aussi lourds que le TTL lui-même et fausserait toute mesure de cadence.
  // Chaînes globales : la cadence structurelle (30 s) et la marche complète
  // (2 min 30) sont des durées de production. Réduites d'un facteur 50 pour
  // que plusieurs cycles tiennent dans un test, en gardant le RAPPORT entre
  // les deux (1:5) — c'est lui, et non les valeurs absolues, qui décide
  // combien de passes légères s'intercalent entre deux marches.
  [/GLOBAL_STRUCT_TICK:\s*[\d_]+/,   'GLOBAL_STRUCT_TICK:      600'],
  [/GLOBAL_FULL_WALK_MS:\s*[\d_]+/,  'GLOBAL_FULL_WALK_MS:     3_000'],
  [/GLOBAL_ERROR_COOLDOWN:\s*[\d_]+/, 'GLOBAL_ERROR_COOLDOWN:   1_500'],
  // Relevé complet des abonnements. Le TTL de 6 h est une durée de production,
  // réduite pour qu'un test puisse observer qu'un second relevé ne repart pas.
  // Le DÉCLENCHEMENT, lui, n'a plus de constante à régler : il ne dépend plus
  // d'un délai mais d'un fait — la première carte suivie vue par un scan.
  // SUBS_PAGE_HOLD_MAX (4 s) n'est pas accéléré non plus : dans le harnais
  // c'est LOADING_TIMEOUT_MS (1,2 s) qui borne la retenue le premier, et c'est
  // bien cette souveraineté du délai dur qu'on veut voir à l'œuvre.
  [/SUBS_PAGE_TTL:\s*6 \* 60 \* 60_000/, 'SUBS_PAGE_TTL:        4_000'],
  [/SUBS_PAGE_TIMEOUT:\s*[\d_]+/, 'SUBS_PAGE_TIMEOUT:    6_000'],
  // Délai d'apaisement d'un onglet vide. Réduit dans le même rapport que le
  // garde-fou (5 s / 25 s en production, 1,2 s / 6 s ici) : c'est le RAPPORT
  // qui décide si un onglet vide coûte une fraction du garde-fou ou sa totalité.
  [/SUBS_PAGE_SETTLE:\s*[\d_]+/,  'SUBS_PAGE_SETTLE:     2_600'],
  // Stabilité du contenu. Gardée à 900 ms — soit PLUS que le décalage de
  // 700 ms entre squelette et corps que le harnais simule : c'est ce rapport,
  // et lui seul, qui décide si le relevé attend le corps ou conclut sans lui.
  [/SUBS_PAGE_STABLE:\s*[\d_]+/,  'SUBS_PAGE_STABLE:     900'],
  [/SUBS_PAGE_STAGGER:\s*[\d_]+/, 'SUBS_PAGE_STAGGER:    200'],
  [/SUBS_PAGE_HOLD_GRACE:\s*[\d_]+/, 'SUBS_PAGE_HOLD_GRACE: 400'],
  // Durée de vie du badge « Vient de passer sur … » : dix minutes en
  // production. Réduite ici pour qu'un test puisse observer sa PÉREMPTION,
  // qui est la moitié de son comportement — un badge qui ne s'efface pas
  // finirait par mentir sur la fraîcheur de ce qu'il annonce.
  [/CATEGORY_SWITCH_TTL:\s*10 \* 60_000/, 'CATEGORY_SWITCH_TTL: 2_500'],
  // Absence au-delà de laquelle le retour sur l'onglet vaut un redémarrage :
  // une minute en production. Réduite ici pour qu'un test puisse observer LES
  // DEUX branches — la courte absence, qui rattrape en silence, et la longue,
  // qui repose le voile et repeuple tout.
  [/REVISIT_RELOAD_MS:\s*60_000/, 'REVISIT_RELOAD_MS: 1_500'],
  [/SCAN_DEBOUNCE:\s*[\d_]+/,     'SCAN_DEBOUNCE:  40'],
  [/BATCH_DELAY:\s*[\d_]+/,       'BATCH_DELAY:    40'],
];
for (const [re, to] of subs) {
  if (!re.test(src)) { console.error('SUBSTITUTION INTROUVABLE:', re); process.exit(1); }
  src = src.replace(re, to);
}
writeFileSync(join(ICI, 'content.test.js'), src);

/* VARIANTE FIREFOX — une seule ligne change, et il faut expliquer pourquoi
   elle ne peut pas être obtenue autrement.

   Firefox n'implémente pas `location.ancestorOrigins` avant la 148 ; sur le
   plancher que le manifeste déclare (140), le pont d'aperçu retombe donc sur
   les origines du manifeste pour viser son postMessage. C'est LA divergence de
   plateforme du portage, et un repli cassé ne se verrait nulle part : l'aperçu
   ne se dévoilerait simplement jamais sous Firefox.

   On ne peut pas la simuler à l'exécution. `ancestorOrigins` est déclarée
   [LegacyUnforgeable] : propriété PROPRE et NON CONFIGURABLE de l'objet
   location — ni `delete`, ni `defineProperty`. Mesuré, pas supposé : `delete
   location.ancestorOrigins` rend false, `delete Location.prototype.
   ancestorOrigins` rend true en ne retirant rien (la propriété n'est pas sur
   le prototype), et redéfinir lève un TypeError. Un test bâti là-dessus
   passerait en ne testant rien — c'est exactement ce qui est arrivé.

   La lecture est donc neutralisée ICI, à la construction, sur une COPIE. Le
   produit livré n'en sait rien ; la substitution est vérifiée comme les
   autres, et `undefined` est précisément ce que rend la lecture d'une
   propriété absente. */
const RE_ANCETRES = /const a = location\.ancestorOrigins;/;
if (!RE_ANCETRES.test(src)) {
  console.error('SUBSTITUTION INTROUVABLE (variante Firefox):', RE_ANCETRES);
  process.exit(1);
}
writeFileSync(join(ICI, 'content.firefox.test.js'),
  src.replace(RE_ANCETRES, 'const a = undefined; /* Firefox < 148 */'));
// Le module anti-pub est copié TEL QUEL : il ne porte aucune constante de temps
// à régler, et c'est justement son comportement d'origine qu'on veut éprouver —
// à savoir qu'il ne fait STRICTEMENT RIEN hors iframe.
const adb = readFileSync(join(RACINE, 'adblock.js'), 'utf8');
writeFileSync(join(ICI, 'adblock.test.js'), SANS_COMMENTAIRES ? degraisser(adb) : adb);
console.log(`content.test.js construit (${subs.length} constantes de temps accélérées) + adblock.test.js copié tel quel`
  + (SANS_COMMENTAIRES ? ' — SANS COMMENTAIRES, comme le paquet livré' : ''));
