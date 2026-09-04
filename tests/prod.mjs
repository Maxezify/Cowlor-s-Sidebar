/* ============================================================
 *  PUBLICATION D'UNE BRANCHE PRÊTE POUR LA PRODUCTION
 *  ------------------------------------------------------------
 *  Fabrique une branche dont l'ARBRE EST EXACTEMENT LE PAQUET :
 *  manifest.json, content.js, adblock.js, icons/, _locales/.
 *  Rien d'autre. Pas de harnais, pas d'outillage de promo, pas de
 *  package.json, pas même un README — télécharger la branche et
 *  soumettre le zip doivent être la même chose.
 *
 *  Pourquoi un script plutôt qu'un `git rm` à la main : une
 *  branche fabriquée une fois à la main dérive dès la version
 *  suivante, et personne ne s'en aperçoit avant le refus du
 *  magasin. Ici la branche est REGÉNÉRÉE depuis `dist/paquet/`,
 *  lui-même assemblé par tests/addon.mjs depuis la liste blanche.
 *  Il n'y a donc qu'un seul endroit où dire ce qui part.
 *
 *  L'arbre est construit par PLOMBERIE git — index temporaire,
 *  write-tree, commit-tree — et non par des checkouts. Le
 *  répertoire de travail et l'index réel ne sont jamais touchés :
 *  ce script est sûr à lancer au milieu d'autre chose, et il ne
 *  peut pas emporter un fichier non commité au passage.
 *
 *  La branche garde son HISTOIRE : chaque publication est un
 *  commit de plus, avec pour parent la publication précédente.
 *  On peut donc lire le diff d'une version à l'autre — ce qui est
 *  précisément ce qu'on veut relire avant de soumettre.
 *
 *  Usage :  node tests/prod.mjs <branche-cible>
 *  Le script ne pousse RIEN. Il dit quoi pousser.
 * ============================================================ */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';

const ICI    = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const PAQUET = join(RACINE, 'dist', 'paquet');

const cible = process.argv[2];
if (!cible) {
  console.error('usage : node tests/prod.mjs <branche-cible>');
  process.exit(1);
}
const git = (args, env) => execFileSync('git', args, {
  cwd: RACINE, encoding: 'utf8', env: { ...process.env, ...env },
}).trim();

/* 1. Le paquet doit être frais ET valide. On relance l'assembleur plutôt que
      de faire confiance à ce qui traîne dans dist/ : publier un paquet périmé
      est exactement le genre d'erreur que ce script existe pour empêcher. */
console.log('→ assemblage et vérification du paquet…');
try {
  execFileSync('node', [join(ICI, 'addon.mjs')], { cwd: RACINE, stdio: 'inherit' });
} catch {
  console.error('\n✗ le paquet ne passe pas ses propres contrôles — rien n\'est publié.');
  process.exit(1);
}

/* 1 bis. Et le banc, sur le fichier TEL QU'IL PART.
   Depuis que le paquet est dégraissé de ses commentaires, le fichier publié
   n'est plus, octet pour octet, celui que `npm test` éprouve. L'égalité des
   flux de jetons, vérifiée à l'assemblage, dit que c'est le même programme —
   mais c'est une affirmation sur la grammaire. Les 556 assertions en sont une
   sur le comportement, et c'est celle-là qu'on publie. Une publication est
   rare ; les cinq minutes que ça coûte sont le meilleur marché du dépôt. */
console.log('\n→ banc complet sur le code livré (sans commentaires)…');
try {
  execFileSync('node', [join(ICI, 'build.mjs'), '--sans-commentaires'], { cwd: RACINE, stdio: 'inherit' });
  execFileSync('node', [join(ICI, 'run.mjs')], { cwd: RACINE, stdio: 'inherit' });
} catch {
  console.error('\n✗ le code livré ne passe pas le banc — rien n\'est publié.');
  process.exit(1);
}

/* 2. L'arbre, construit dans un index TEMPORAIRE. */
const lister = (racine, base = racine) => readdirSync(racine).flatMap((e) => {
  const p = join(racine, e);
  return statSync(p).isDirectory() ? lister(p, base) : [relative(base, p).split(sep).join('/')];
});
const fichiers = lister(PAQUET).sort();

const index = join(tmpdir(), `tse-prod-index-${process.pid}`);
rmSync(index, { force: true });
const env = { GIT_INDEX_FILE: index };
for (const f of fichiers) {
  const sha = git(['hash-object', '-w', join(PAQUET, f)]);
  git(['update-index', '--add', '--cacheinfo', `100644,${sha},${f}`], env);
}
const arbre = git(['write-tree'], env);
rmSync(index, { force: true });

/* 3. Le commit. Parent = la publication précédente si la branche existe, sinon
      aucun : la toute première publication est orpheline, et c'est voulu —
      l'histoire de développement n'a rien à faire dans une branche d'artefact. */
const existe = (() => {
  try { git(['rev-parse', '--verify', '--quiet', `refs/heads/${cible}`]); return true; }
  catch { return false; }
})();
const parent = existe ? git(['rev-parse', `refs/heads/${cible}`]) : null;

const version = JSON.parse(execFileSync('node',
  ['-e', 'process.stdout.write(require("fs").readFileSync("manifest.json","utf8"))'],
  { cwd: RACINE, encoding: 'utf8' })).version;
const source = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const sourceSha = git(['rev-parse', '--short', 'HEAD']);

/* Si l'arbre est identique au précédent, republier ne dirait rien : un commit
   vide sur une branche d'artefact est du bruit qu'on relira un jour comme un
   changement. */
if (parent && git(['rev-parse', `${parent}^{tree}`]) === arbre) {
  console.log(`\n= ${cible} est déjà à jour (arbre identique à ${parent.slice(0, 7)}). Rien à faire.`);
  process.exit(0);
}

const message = `${version} — paquet prêt pour la production\n\n`
  + `Arbre généré par tests/prod.mjs depuis ${source} (${sourceSha}).\n`
  + `Contenu : ${fichiers.length} fichiers, exactement ceux qui sont livrés.\n`
  + `Ne pas éditer cette branche à la main : elle est régénérée.\n`;

const commit = git(['commit-tree', arbre, ...(parent ? ['-p', parent] : []), '-m', message]);
git(['update-ref', `refs/heads/${cible}`, commit]);

console.log(`\n✓ ${cible} ${existe ? 'mise à jour' : 'créée'} → ${commit.slice(0, 7)}`);
console.log(`  ${fichiers.length} fichiers : ${fichiers.join(', ')}`);
console.log(`\n  git push -u origin ${cible}`);
if (!existsSync(join(RACINE, '.git'))) process.exit(1);
