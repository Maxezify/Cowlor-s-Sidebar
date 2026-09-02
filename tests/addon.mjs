/* ============================================================
 *  VÉRIFICATION DU MANIFESTE FIREFOX
 *  ------------------------------------------------------------
 *  Deux choses, et elles ne se remplacent pas :
 *
 *   1. `web-ext lint` — l'outil de Mozilla, qui embarque le MÊME
 *      addons-linter qu'AMO applique à la soumission. C'est le
 *      juge extérieur : il connaît les règles d'AMO, pas nous.
 *      Zéro erreur est la condition de publication.
 *
 *   2. Les invariants que le linter ne connaît PAS, parce qu'ils
 *      appartiennent à ce dépôt : la version du manifeste doit
 *      suivre celle de package.json, le plancher Firefox doit
 *      rester cohérent avec ce que le code exige, et le bloc
 *      content_scripts doit rester identique à celui de la
 *      branche Chrome — c'est toute la promesse du portage.
 *
 *  Le second point est le vrai garde-fou. Un manifeste peut être
 *  parfaitement valide pour AMO et avoir silencieusement divergé
 *  de la branche Chrome ; le linter n'y verrait rien.
 * ============================================================ */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI    = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const lire = (f) => JSON.parse(readFileSync(join(RACINE, f), 'utf8'));

let echecs = 0;
const ok = (nom, cond, detail = '') => {
  if (cond) { console.log('  ✓', nom); return; }
  echecs++; console.log('  ✗', nom, detail ? '—  ' + detail : '');
};

const man = lire('manifest.json');
const pkg = lire('package.json');
const gecko = man.browser_specific_settings?.gecko ?? {};

console.log('\nManifeste Firefox — invariants du dépôt');

ok('la version du manifeste suit celle de package.json',
   man.version === pkg.version, `${man.version} / ${pkg.version}`);

/* L'identifiant est OBLIGATOIRE en MV3 : AMO n'en attribue plus.
   Sans lui, `web-ext lint` rend ADDON_ID_REQUIRED et la soumission est
   refusée — c'était la seule erreur du manifeste Chrome tel quel. */
ok('un identifiant d\'extension est déclaré, au format attendu par AMO',
   typeof gecko.id === 'string' && /^[a-zA-Z0-9\-._]*@[a-zA-Z0-9\-._]+$/.test(gecko.id),
   gecko.id ?? '(absent)');

/* Le plancher n'est pas un chiffre décoratif, il est DÉDUIT :
     • world: "MAIN" dans content_scripts .............. Firefox 128
     • data_collection_permissions ..................... Firefox 140
   C'est donc 140 qui commande. Le descendre rendrait le manifeste
   incohérent avec lui-même, et `web-ext lint` le dit. */
ok('le plancher Firefox couvre la clé la plus récente du manifeste',
   parseInt(gecko.strict_min_version, 10) >= 140, gecko.strict_min_version ?? '(absent)');

/* Obligatoire pour toute NOUVELLE extension depuis le 3 novembre 2025.
   Ici la valeur honnête est « none » : l'extension ne collecte ni ne
   transmet rien. C'est vérifié par ailleurs — aucune permission déclarée. */
ok('la collecte de données est déclarée, et déclarée nulle',
   Array.isArray(gecko.data_collection_permissions?.required)
   && gecko.data_collection_permissions.required.length === 1
   && gecko.data_collection_permissions.required[0] === 'none',
   JSON.stringify(gecko.data_collection_permissions));

ok('aucune permission n\'est demandée, comme sur la branche Chrome',
   !man.permissions && !man.host_permissions && !man.optional_permissions,
   JSON.stringify({ p: man.permissions, h: man.host_permissions }));

/* Le cœur du portage : le bloc content_scripts doit être MOT POUR MOT
   celui de la branche Chrome. S'il divergeait, les deux extensions ne
   seraient plus le même produit — et c'est la seule chose que l'auteur
   a demandé de garantir. */
const CS_ATTENDU = {
  matches: ['https://www.twitch.tv/*', 'https://twitch.tv/*', 'https://player.twitch.tv/*'],
  js: ['adblock.js', 'content.js'],
  run_at: 'document_start',
  world: 'MAIN',
  all_frames: true,
};
ok('le bloc content_scripts est identique à celui de la branche Chrome',
   man.content_scripts?.length === 1
   && JSON.stringify(man.content_scripts[0]) === JSON.stringify(CS_ATTENDU),
   JSON.stringify(man.content_scripts));

console.log('\nManifeste Firefox — verdict de web-ext (addons-linter, celui d\'AMO)');
const IGNORER = ['node_modules/**', 'tests/**', 'promo*/**', 'promo*.mjs', 'store/**',
                 '*.md', 'eslint.config.mjs', 'package*.json', '.gitignore'];
let rapport;
try {
  const sortie = execFileSync('npx', ['web-ext', 'lint', '--source-dir', RACINE,
    '--ignore-files', ...IGNORER, '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
  rapport = JSON.parse(sortie);
} catch (e) {
  // web-ext sort en code non nul dès qu'il trouve quelque chose : le JSON
  // est sur stdout malgré tout, et c'est lui qui fait foi.
  try { rapport = JSON.parse(e.stdout || ''); }
  catch { console.log('  ✗ web-ext n\'a pas pu être exécuté —', e.message); process.exit(1); }
}
const { errors = 0, warnings = 0 } = rapport.summary ?? {};
for (const e of rapport.errors ?? []) console.log('    ERREUR', e.code, '—', e.message);
ok('zéro erreur : le paquet est recevable par AMO', errors === 0, String(errors));

/* Les avertissements NE SONT PAS mis à zéro, et ce serait malhonnête de le
   prétendre : il en reste douze, tous UNSAFE_VAR_ASSIGNMENT, sur les
   écritures innerHTML / insertAdjacentHTML du rendu. Le linter ne sait pas
   traverser une fonction d'échappement ; chaque site a été relu, et toute
   donnée externe y passe par escapeHtml, y compris en contexte d'attribut.
   Ils sont IDENTIQUES sur la branche Chrome — ce n'est pas une dette du
   portage. Le seuil interdit seulement qu'il en apparaisse de NOUVEAUX. */
const parCode = {};
for (const w of rapport.warnings ?? []) parCode[w.code] = (parCode[w.code] || 0) + 1;
const inattendus = Object.entries(parCode).filter(([c]) => c !== 'UNSAFE_VAR_ASSIGNMENT');
ok('aucun avertissement d\'une autre nature que les écritures HTML connues',
   inattendus.length === 0, JSON.stringify(inattendus));
ok('et leur nombre n\'a pas augmenté (12 sites, tous échappés)',
   (parCode.UNSAFE_VAR_ASSIGNMENT ?? 0) <= 12, String(parCode.UNSAFE_VAR_ASSIGNMENT ?? 0));

console.log(`\n${echecs ? `${echecs} ÉCHEC(S)` : 'manifeste Firefox OK'}  (${warnings} avertissements)\n`);
process.exit(echecs ? 1 : 0);
