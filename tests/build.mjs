import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Chemins résolus depuis CE fichier, jamais depuis le répertoire courant :
// `npm test` s'exécute à la racine, un lancement direct depuis tests/ ne s'y
// trouve pas, et les deux doivent marcher.
const ICI    = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');

let src = readFileSync(join(RACINE, 'content.js'), 'utf8');
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
  [/SCAN_DEBOUNCE:\s*[\d_]+/,     'SCAN_DEBOUNCE:  40'],
  [/BATCH_DELAY:\s*[\d_]+/,       'BATCH_DELAY:    40'],
];
for (const [re, to] of subs) {
  if (!re.test(src)) { console.error('SUBSTITUTION INTROUVABLE:', re); process.exit(1); }
  src = src.replace(re, to);
}
writeFileSync(join(ICI, 'content.test.js'), src);
// Le module anti-pub est copié TEL QUEL : il ne porte aucune constante de temps
// à régler, et c'est justement son comportement d'origine qu'on veut éprouver —
// à savoir qu'il ne fait STRICTEMENT RIEN hors iframe.
writeFileSync(join(ICI, 'adblock.test.js'), readFileSync(join(RACINE, 'adblock.js'), 'utf8'));
console.log(`content.test.js construit (${subs.length} constantes de temps accélérées) + adblock.test.js copié tel quel`);
