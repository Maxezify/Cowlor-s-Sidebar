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
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { degraisser, memeCode, compterCommentaires } from './degraisser.mjs';

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

/* ── Le code livré part sans ses commentaires ──────────────────────────────
   Le dépôt en porte beaucoup, et c'est voulu : la moitié de ce qu'on sait de
   ce produit est écrite dans ses marges. Cette moitié-là vit dans le dépôt,
   qui est public ; elle n'a pas à voyager dans chaque installation. Le paquet
   perd près de la moitié de son poids — le chiffre exact est celui que le
   contrôle ci-dessous imprime, et aucun autre n'est écrit ici : un nombre
   recopié dans un commentaire se périme en silence, et c'est précisément ce
   qui est arrivé aux README que ce même contrôle confronte maintenant.

   Ce que le paquet NE devient PAS : minifié ni obscurci. Les noms, les
   retours à la ligne et l'indentation sont ceux du dépôt, ligne pour ligne —
   « code source entièrement lisible », que les douze fiches promettent, reste
   vrai au mot près. La notice MIT d'adblock.js reste elle aussi, la licence
   l'exigeant de toute copie : cf. degraisser.mjs.

   Et la preuve est le contrôle ci-dessous, pas la relecture : les deux textes
   doivent rendre le MÊME flux de jetons. Un retrait qui aurait emporté autre
   chose qu'un commentaire ne peut pas y survivre. */
const degraisses = [];
for (const f of ['content.js', 'adblock.js']) {
  const p = join(PAQUET, f);
  if (!existsSync(p)) continue;
  const avant = readFileSync(p, 'utf8');
  const apres = degraisser(avant);
  const souci = memeCode(avant, apres);
  degraisses.push({ f, souci, avant: Buffer.byteLength(avant), apres: Buffer.byteLength(apres) });
  if (!souci) writeFileSync(p, apres);
}
const casses = degraisses.filter(d => d.souci);
const gagne = degraisses.reduce((n, d) => n + d.avant - d.apres, 0);
ok(`les commentaires sont retirés du code livré (${(gagne / 1024).toFixed(0)} Ko de moins)`
   + ' — mêmes jetons, donc même programme',
   casses.length === 0, casses.map(d => `${d.f} : ${d.souci}`).join(' | '));

/* ── LES CHIFFRES PUBLIÉS SONT-ILS CEUX QU'ON VIENT DE MESURER ? ───────────
   Trois README annoncent la taille du paquet, avant et après dégraissage.
   Aucun des trois ne peut la connaître : ils la RECOPIENT. Et un nombre
   recopié se périme sans bruit — store/README.md a annoncé « 687 → 391 Ko »
   pendant toute la 3.60 et la 3.61, c'est-à-dire le gain du JavaScript SEUL,
   alors que le CSS était dégraissé lui aussi depuis la 3.60. Personne ne l'a
   vu, parce que rien ne reliait la phrase à la mesure. C'est exactement le
   défaut que la liste des huit affirmations vérifiables de store/README.md
   existe pour empêcher, et il s'est produit sur l'affirmation numéro 7.

   La tolérance est de 3 %. content.js grossit à chaque version : faire
   échouer l'assemblage pour deux kilo-octets d'écart ferait de ce contrôle
   une corvée, donc un contrôle qu'on désarme. Trois pour cent valent une
   quinzaine de kilo-octets — assez pour laisser passer la croissance
   ordinaire, trop peu pour laisser passer une phrase qui décrit une AUTRE
   version du produit.

   Ce que ce contrôle NE fait donc PAS, et il faut le savoir pour ne pas lui
   faire dire plus qu'il ne dit : il n'aurait pas signalé le tableau resté à
   « 563 Ko » quand le fichier en pesait 568. Un écart de cet ordre n'est pas
   un mensonge sur le produit, et le prix à payer pour l'attraper serait un
   README à retoucher à chaque commit. Il attrape la péremption d'une
   VERSION, pas celle d'un kilo-octet.

   Le NOMBRE de confrontations est vérifié lui aussi, document par document.
   Sans lui, reformuler une ligne au point que la lecture ne la reconnaisse
   plus ferait passer ce contrôle en ne comparant rien — la panne la plus
   discrète qu'un contrôle puisse avoir, et la seule qui ne se voit jamais
   dans une sortie verte. */
const TOLERANCE = 0.03;
const DOCS = [['README.md', 3], ['README.en.md', 3], ['store/README.md', 1]];

const mesure = { '(les deux)': { avant: 0, apres: 0 } };
for (const d of degraisses) {
  mesure[d.f] = { avant: d.avant / 1024, apres: d.apres / 1024 };
  mesure['(les deux)'].avant += d.avant / 1024;
  mesure['(les deux)'].apres += d.apres / 1024;
}

/* De quoi cette ligne parle-t-elle ? Le nom d'un fichier livré, ou bien le
   total — soit la cellule en gras des deux tableaux, soit la forme
   « 692 → 363 Ko » de la fiche. Une ligne qui ne porte aucune de ces marques
   n'est pas lue : les README parlent de kilo-octets ailleurs aussi (une
   miniature décodée en pèse 506), et ces chiffres-là ne sont pas les nôtres. */
const sujetDe = (l) => l.includes('content.js') ? 'content.js'
  : l.includes('adblock.js') ? 'adblock.js'
  : /\*\*(?:les deux|both)\*\*/.test(l) || /\d+\s*→\s*\d+\s*(?:Ko|KB)\b/.test(l) ? '(les deux)'
  : null;

/* Deux écritures, parce que les documents en ont deux : la flèche de la fiche
   ne répète pas l'unité, le tableau la répète à chaque cellule. On ne prend
   que les DEUX premiers nombres — la colonne « commentaires » du tableau en
   porte d'autres, qui ne sont pas des tailles. */
const chiffresDe = (l) => {
  const fleche = l.match(/(\d+)\s*→\s*(\d+)\s*(?:Ko|KB)\b/);
  if (fleche) return [Number(fleche[1]), Number(fleche[2])];
  /* \u202f est l'espace fine insécable des milliers en français (« 2 743 ») ;
     écrite en clair, elle serait indiscernable d'une espace ordinaire à la
     relecture — et ce dépôt a déjà payé un caractère invisible une fois. */
  const tous = [...l.matchAll(/(\d[\d,\u202f ]*)\s*(?:Ko|KB)\b/g)]
    .map(m => Number(m[1].replace(/[,\u202f ]/g, '')));
  return tous.length >= 2 ? [tous[0], tous[1]] : null;
};

const perimes = [];
const comptes = [];
for (const [doc, attendu] of DOCS) {
  if (!existsSync(join(RACINE, doc))) { comptes.push(`${doc} : absent`); continue; }
  let vus = 0;
  for (const ligne of readFileSync(join(RACINE, doc), 'utf8').split('\n')) {
    const sujet = sujetDe(ligne);
    if (!sujet || !mesure[sujet]) continue;
    const dits = chiffresDe(ligne);
    if (!dits) continue;
    vus++;
    const derive = (dit, vrai) => Math.abs(dit - vrai) / vrai > TOLERANCE;
    if (derive(dits[0], mesure[sujet].avant) || derive(dits[1], mesure[sujet].apres)) {
      perimes.push(`${doc} — ${sujet} : ${dits[0]}→${dits[1]} annoncés, `
        + `${mesure[sujet].avant.toFixed(0)}→${mesure[sujet].apres.toFixed(0)} mesurés`);
    }
  }
  if (vus !== attendu) comptes.push(`${doc} : ${vus} chiffres lus, ${attendu} attendus`);
}
ok('les tailles annoncées par les README sont celles du paquet qu\'on vient d\'assembler',
   perimes.length === 0, perimes.join(' | '));
ok('et chacune a bien été confrontée — aucune ligne n\'a échappé à la lecture',
   comptes.length === 0, comptes.join(' | '));

/* LE DÉGRAISSAGE NE SORT PAS DU PAQUET. C'est la moitié de la règle, et c'est
   celle qui ne se voit pas : le retrait porte sur la COPIE assemblée dans
   dist/paquet, jamais sur les fichiers du dépôt. Les commentaires sont la
   moitié de ce qu'on sait de ce produit — les perdre du dépôt en croyant
   n'alléger qu'un paquet serait une perte sans retour, et elle passerait
   inaperçue jusqu'au jour où quelqu'un ouvrirait content.js pour comprendre
   une décision.

   Une ligne d'écriture qui viserait la racine au lieu de PAQUET suffirait, et
   rien d'autre ici ne la verrait. On relit donc les sources APRÈS l'assemblage
   pour constater qu'elles ont encore leurs commentaires. */
const intacts = ['content.js', 'adblock.js'].map((f) => {
  const src = readFileSync(join(RACINE, f), 'utf8');
  return { f, ...compterCommentaires(src) };
});
ok('les fichiers du dépôt gardent leurs commentaires — seul le paquet est dégraissé',
   intacts.every(s => s.total > s.legaux + 100),
   intacts.map(s => `${s.f} : ${s.total} commentaires`).join(', '));

/* La notice de licence du code tiers doit avoir SURVÉCU au dégraissage. Ce
   n'est pas une question de style : MIT exige que sa notice accompagne toute
   copie du logiciel, et un paquet qui la perdrait serait en infraction. */
const adb = existsSync(join(PAQUET, 'adblock.js'))
  ? readFileSync(join(PAQUET, 'adblock.js'), 'utf8') : '';
ok('la notice MIT du module anti-pub est toujours dans le paquet',
   /Licence : MIT/.test(adb) && /Copyright \(c\) 2020-present TwitchAdSolutions/.test(adb));

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
