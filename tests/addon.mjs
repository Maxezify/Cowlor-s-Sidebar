/* ============================================================
 *  LE PAQUET D'EXTENSION — CE QUI PART, ET CE QU'AMO EN DIT
 *  ------------------------------------------------------------
 *  Ce script fait trois choses, dans cet ordre :
 *
 *   1. Il ASSEMBLE le paquet dans `dist/paquet/`, à partir d'une
 *      LISTE BLANCHE. C'est le point important, et il vient d'une
 *      erreur réelle : le premier envoi à AMO contenait tout le
 *      dépôt — l'outillage de promo, le harnais de test, sa page
 *      HTML à scripts en ligne — et le validateur a rendu cinq
 *      avertissements pour des fichiers qui ne s'exécutent jamais
 *      chez personne.
 *
 *      Une liste NOIRE (« ignore ceci, ignore cela ») aurait
 *      recréé le défaut au premier fichier ajouté : ce qu'on
 *      oublie d'exclure part. Une liste blanche a le défaut
 *      inverse, qui est le bon : ce qu'on oublie d'inclure
 *      MANQUE, et le contrôle 2 le voit tout de suite.
 *
 *   2. Il vérifie que le paquet est COMPLET et RIEN DE PLUS :
 *      chaque fichier que le manifeste nomme est présent, et
 *      aucun fichier hors liste ne s'est glissé dedans.
 *
 *   3. Il passe le paquet à l'addons-linter de Mozilla — celui
 *      qu'AMO applique à la soumission — et aux invariants que ce
 *      linter ne peut pas connaître, parce qu'ils appartiennent à
 *      ce dépôt (la version suit package.json, le plancher reste
 *      cohérent, le bloc content_scripts est mot pour mot celui
 *      de l'autre branche).
 *
 *  Le linter tourne sur le PAQUET, jamais sur le dépôt avec des
 *  exclusions. C'est toute la différence entre valider ce qu'on
 *  envoie et valider ce qu'on aurait aimé envoyer.
 *
 *  UN SEUL FICHIER POUR LES DEUX BRANCHES. Il lit le manifeste
 *  qu'il trouve : avec un bloc `browser_specific_settings.gecko`
 *  il joue les contrôles Firefox et appelle l'addons-linter ;
 *  sans, il s'en tient à l'assemblage et aux invariants communs —
 *  l'addons-linter est l'outil d'AMO, et il réclamerait à un
 *  manifeste Chrome un identifiant que Chrome n'utilise pas.
 *  Deux versions de ce script auraient divergé ; celle-ci ne le
 *  peut pas.
 * ============================================================ */
import { readFileSync, rmSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ICI    = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const PAQUET = join(RACINE, 'dist', 'paquet');
const lire = (f) => JSON.parse(readFileSync(join(RACINE, f), 'utf8'));

/* LA LISTE BLANCHE. Tout ce qui part, et rien d'autre. Ajouter un fichier au
   produit se fait ICI, sans quoi il ne sera pas dans le paquet — et le
   contrôle 2 le dira. */
const LIVRE = ['manifest.json', 'content.js', 'adblock.js', 'icons', '_locales'];

let echecs = 0;
const ok = (nom, cond, detail = '') => {
  if (cond) { console.log('  ✓', nom); return; }
  echecs++; console.log('  ✗', nom, detail ? '—  ' + detail : '');
};

// ── 1. Assemblage ────────────────────────────────────────────────────────
rmSync(PAQUET, { recursive: true, force: true });
mkdirSync(PAQUET, { recursive: true });
for (const f of LIVRE) {
  const src = join(RACINE, f);
  if (!existsSync(src)) continue;         // signalé par le contrôle 2
  cpSync(src, join(PAQUET, f), { recursive: true });
}

const listerTout = (racine, base = racine) => {
  const out = [];
  for (const e of readdirSync(racine)) {
    const p = join(racine, e);
    if (statSync(p).isDirectory()) out.push(...listerTout(p, base));
    else out.push(relative(base, p).split(sep).join('/'));
  }
  return out;
};
const dedans = listerTout(PAQUET);

const man = lire('manifest.json');
const pkg = lire('package.json');
const gecko = man.browser_specific_settings?.gecko ?? null;
const CIBLE = gecko ? 'Firefox' : 'Chrome';

console.log(`\nPaquet ${CIBLE} — assemblé dans dist/paquet (${dedans.length} fichiers)`);

// ── 2. Complet, et rien de plus ──────────────────────────────────────────
/* Tout ce que le manifeste NOMME doit être là. C'est ce qui empêche la liste
   blanche de devenir un piège : oublier d'inclure un fichier casse ici, fort. */
const nommes = [
  ...(man.content_scripts ?? []).flatMap(c => c.js ?? []),
  ...Object.values(man.icons ?? {}),
  `_locales/${man.default_locale}/messages.json`,
];
const manquants = nommes.filter(f => !dedans.includes(f));
ok('tout ce que le manifeste nomme est dans le paquet',
   manquants.length === 0, JSON.stringify(manquants));

/* Et rien d'autre : aucun fichier ne doit venir d'ailleurs que de la liste. */
const horsListe = dedans.filter(f => !LIVRE.some(r => f === r || f.startsWith(r + '/')));
ok('et rien qui ne vienne de la liste blanche',
   horsListe.length === 0, JSON.stringify(horsListe));

/* Les traductions vont par paires : une locale sans messages.json ferait une
   extension sans nom dans cette langue. */
const locales = readdirSync(join(PAQUET, '_locales'));
const sansMessages = locales.filter(l => !dedans.includes(`_locales/${l}/messages.json`));
ok(`les ${locales.length} locales ont toutes leur messages.json`,
   sansMessages.length === 0, JSON.stringify(sansMessages));

// ── 3a. Invariants du dépôt ──────────────────────────────────────────────
console.log(`\nManifeste ${CIBLE} — invariants du dépôt`);

ok('la version du manifeste suit celle de package.json',
   man.version === pkg.version, `${man.version} / ${pkg.version}`);

if (gecko) {
  /* L'identifiant est OBLIGATOIRE en MV3 : AMO n'en attribue plus. Sans lui,
     ADDON_ID_REQUIRED, et la soumission est refusée. */
  ok('un identifiant d\'extension est déclaré, au format attendu par AMO',
     typeof gecko.id === 'string' && /^[a-zA-Z0-9\-._]*@[a-zA-Z0-9\-._]+$/.test(gecko.id),
     gecko.id ?? '(absent)');

  /* Le plancher est DÉDUIT : world:"MAIN" demande 128,
     data_collection_permissions demande 140. C'est donc 140 qui commande. */
  ok('le plancher Firefox couvre la clé la plus récente du manifeste',
     parseInt(gecko.strict_min_version, 10) >= 140, gecko.strict_min_version ?? '(absent)');

  /* Obligatoire pour toute NOUVELLE extension depuis le 3 novembre 2025. La
     valeur honnête est « none » : rien n'est collecté, rien ne sort. */
  ok('la collecte de données est déclarée, et déclarée nulle',
     gecko.data_collection_permissions?.required?.length === 1
     && gecko.data_collection_permissions.required[0] === 'none',
     JSON.stringify(gecko.data_collection_permissions));
} else {
  /* Branche Chrome : le manifeste ne doit PAS porter les clés Firefox. Les
     laisser traîner ferait passer un paquet Chrome pour un paquet AMO. */
  ok('aucune clé Firefox ne traîne dans un manifeste Chrome',
     !man.browser_specific_settings, JSON.stringify(man.browser_specific_settings));
}

ok('aucune permission n\'est demandée, comme sur l\'autre branche',
   !man.permissions && !man.host_permissions && !man.optional_permissions,
   JSON.stringify({ p: man.permissions, h: man.host_permissions }));

/* Le cœur du portage : le bloc content_scripts doit être MOT POUR MOT le même
   d'une branche à l'autre, sans quoi les deux extensions cessent d'être le même
   produit — la seule chose que l'auteur a demandé de garantir. */
const CS_ATTENDU = {
  matches: ['https://www.twitch.tv/*', 'https://twitch.tv/*', 'https://player.twitch.tv/*'],
  js: ['adblock.js', 'content.js'],
  run_at: 'document_start',
  world: 'MAIN',
  all_frames: true,
};
ok('le bloc content_scripts est identique à celui de l\'autre branche',
   man.content_scripts?.length === 1
   && JSON.stringify(man.content_scripts[0]) === JSON.stringify(CS_ATTENDU),
   JSON.stringify(man.content_scripts));

// ── 3b. Le juge extérieur ────────────────────────────────────────────────
if (!gecko) {
  /* L'addons-linter est l'outil d'AMO. Le lancer sur un manifeste Chrome
     rendrait ADDON_ID_REQUIRED — une erreur vraie pour Firefox, sans objet
     pour le Chrome Web Store. On s'arrête donc ici, en le disant. */
  console.log('\nPaquet Chrome — addons-linter non applicable (outil d\'AMO), ignoré.');
  console.log(`\n${echecs ? `${echecs} ÉCHEC(S)` : 'paquet Chrome OK'}\n`);
  process.exit(echecs ? 1 : 0);
}

console.log('\nPaquet Firefox — verdict de web-ext (addons-linter, celui d\'AMO)');
let rapport;
try {
  const sortie = execFileSync('npx', ['web-ext', 'lint', '--source-dir', PAQUET, '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
  rapport = JSON.parse(sortie);
} catch (e) {
  // web-ext sort en code non nul dès qu'il trouve quelque chose ; le JSON est
  // sur stdout malgré tout, et c'est lui qui fait foi.
  try { rapport = JSON.parse(e.stdout || ''); }
  catch { console.log('  ✗ web-ext n\'a pas pu être exécuté —', e.message); process.exit(1); }
}
const { errors = 0, warnings = 0 } = rapport.summary ?? {};
for (const e of rapport.errors ?? []) console.log('    ERREUR', e.code, '—', e.message);
ok('zéro erreur : le paquet est recevable par AMO', errors === 0, String(errors));

/* Le cliquet est maintenant à ZÉRO partout. Il a d'abord servi à tenir les
   douze avertissements du rendu pendant qu'ils existaient ; ils ont été
   supprimés en 3.56.0 (le rendu construit des nœuds, plus des chaînes), et le
   plafond descend avec eux. Un plafond qu'on ne resserre pas après une
   correction cesse d'être un cliquet pour devenir une permission. */
const PLAFOND = {};
const parFichier = {};
for (const w of rapport.warnings ?? []) {
  const f = w.file || '(paquet)';
  (parFichier[f] = parFichier[f] || {});
  parFichier[f][w.code] = (parFichier[f][w.code] || 0) + 1;
}
const depassements = [];
for (const [f, codes] of Object.entries(parFichier)) {
  const total = Object.values(codes).reduce((a, b) => a + b, 0);
  const autres = Object.keys(codes).filter(c => c !== 'UNSAFE_VAR_ASSIGNMENT');
  if (autres.length) depassements.push([f, 'code inattendu', autres]);
  else if (total > (PLAFOND[f] ?? 0)) depassements.push([f, total, '>', PLAFOND[f] ?? 0]);
}
ok('aucun fichier au-dessus de son plafond d\'avertissements connus',
   depassements.length === 0, JSON.stringify(depassements));

/* Et surtout : plus AUCUN avertissement venu de l'outillage. C'est le contrôle
   qui aurait attrapé le premier envoi. */
const outillage = Object.keys(parFichier).filter(f => f !== 'content.js' && f !== '(paquet)');
ok('aucun avertissement venu de l\'outillage — il n\'est plus dans le paquet',
   outillage.length === 0, JSON.stringify(outillage));

console.log(`\n${echecs ? `${echecs} ÉCHEC(S)` : 'paquet Firefox OK'}  (${warnings} avertissement${warnings > 1 ? 's' : ''})\n`);
process.exit(echecs ? 1 : 0);
