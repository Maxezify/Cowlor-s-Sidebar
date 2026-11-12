// Une campagne de mutants, suivie au tableau.
//   node tests/suivi/mutants.mjs LISTE.mjs [--copie DOSSIER] [--seuls id,id]
// LISTE.mjs exporte par défaut un tableau de mutants :
//   { id: 'p1', nom: "l'adresse prise telle quelle", fichier: 'panneau.js',
//     avant: '…texte exact, présent une seule fois…', apres: '…', scenarios: [120] }
// Chacun est appliqué seul à une copie de l'arbre (le dépôt n'est jamais
// touché), éprouvé par ses scénarios, puis retiré. PRIS : au moins une
// assertion tombe (même si le banc plante ensuite : noté). VIVANT : toutes
// passent — un trou du banc. INTROUVABLE :
// le texte `avant` n'est pas là une fois et une seule. ERREUR : le banc n'a
// pas rendu de bilan (plantage, délai dépassé) sans qu'aucune assertion soit
// tombée ; ce n'est pas une prise.
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync, readFileSync, cpSync, rmSync, symlinkSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { F, ETAT, preparer, identite, lireJsonl, derouler } from './etat.mjs';
import { extraire } from './extrait.mjs';

const args = process.argv.slice(2);
const opt = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args.splice(i, 2)[1] : null; };
const copie = resolve(opt('--copie') || join(tmpdir(), 'tse-mutants'));
const seuls = (opt('--seuls') || '').split(',').filter(Boolean);
if (args.length !== 1) { console.error('usage : node tests/suivi/mutants.mjs LISTE.mjs [--copie DOSSIER] [--seuls id,id]'); process.exit(2); }
const arbre = process.cwd();
const liste = (await import(pathToFileURL(resolve(args[0])).href)).default
  .filter((m) => !seuls.length || seuls.includes(m.id));

preparer();
writeFileSync(F.mutants, '');
const noter = (o) => appendFileSync(F.mutants, JSON.stringify({ t: Date.now(), ...o }) + '\n');
noter({ type: 'debut', pid: process.pid, source: resolve(args[0]), arbre, ...identite(arbre),
        liste: liste.map(({ id, nom, fichier, scenarios }) => ({ id, nom, fichier, scenarios })) });

// La copie : tout l'arbre sauf ce qui est dérivé ou propre à la machine.
const ecarte = new Set(['.git', 'node_modules', 'dist', 'promo', 'test-results']);
const etatRel = relative(arbre, ETAT);
rmSync(copie, { recursive: true, force: true });
cpSync(arbre, copie, {
  recursive: true, verbatimSymlinks: true,
  filter: (src) => {
    const r = relative(arbre, src);
    if (!r) return true;
    if (ecarte.has(r.split(sep)[0])) return false;
    return !(etatRel && !etatRel.startsWith('..') && (r === etatRel || r.startsWith(etatRel + sep)));
  },
});
symlinkSync(realpathSync(join(arbre, 'node_modules')), join(copie, 'node_modules'));

const bilans = [];
for (const m of liste) {
  const t0 = Date.now();
  // Vidé d'abord : le tableau ne doit pas lire les résultats du précédent sous le nom de celui-ci.
  writeFileSync(F.mutantBanc, '');
  noter({ type: 'mutant', id: m.id, phase: 'debut' });
  const fichier = join(copie, m.fichier);
  const src = existsSync(join(arbre, m.fichier)) ? readFileSync(join(arbre, m.fichier), 'utf8') : '';
  const n = src.split(m.avant).length - 1;
  let res;
  if (n !== 1) {
    res = { etat: 'introuvable', fois: n };
  } else {
    writeFileSync(fichier, src.replace(m.avant, () => m.apres));
    try {
      // Une construction ratée laisserait le banc sur l'ancien content.test.js : erreur, pas verdict.
      const b = spawnSync('node', ['tests/build.mjs'], { cwd: copie, encoding: 'utf8' });
      if (b.status !== 0) throw new Error(`tests/build.mjs : ${((b.stderr || '') + (b.stdout || '')).trim().split('\n').at(-1)}`);
      extraire(copie, m.scenarios);
      const r = spawnSync('node', ['tests/_extrait.mjs'], { cwd: copie, encoding: 'utf8', timeout: 30 * 60_000,
                                                             env: { ...process.env, TSE_SUIVI: F.mutantBanc } });
      const d = derouler(lireJsonl(F.mutantBanc));
      if (!d.bilan && d.echoues) {
        // Une assertion est tombée, puis le banc a planté : le mutant est pris, le plantage noté.
        res = { etat: 'pris', plante: true, reussis: d.reussis, echoues: d.echoues, rates: d.echecs.slice(0, 6).map((e) => e.nom) };
      } else if (!d.bilan) {
        res = { etat: 'erreur', sortie: ((r.stderr || '') + (r.stdout || '')).split('\n').slice(-25).join('\n') };
      } else {
        res = { etat: d.bilan.echoues ? 'pris' : 'vivant', reussis: d.bilan.reussis, echoues: d.bilan.echoues,
                rates: d.echecs.slice(0, 6).map((e) => e.nom) };
      }
    } catch (e) {
      res = { etat: 'erreur', sortie: String(e.message || e) };
    } finally {
      writeFileSync(fichier, src);
    }
  }
  res.ms = Date.now() - t0;
  noter({ type: 'mutant', id: m.id, phase: 'fin', ...res });
  bilans.push({ m, res });
  const etiquette = { pris: 'PRIS       ', vivant: 'VIVANT     ', introuvable: 'INTROUVABLE', erreur: 'ERREUR     ' }[res.etat];
  const detail = res.etat === 'introuvable' ? `${res.fois} fois`
    : res.etat === 'erreur' ? res.sortie.split('\n').filter(Boolean).at(-1) || ''
    : `${res.reussis} réussis, ${res.echoues} échoués${res.plante ? ', puis le banc a planté' : ''}${res.rates.length ? ' | ' + res.rates.join(' ‖ ') : ''}`;
  console.log(`${etiquette} | ${m.id} ${m.nom} | ${detail}`);
}
rmSync(join(copie, 'tests', '_extrait.mjs'), { force: true });
const compte = (e) => bilans.filter((b) => b.res.etat === e).length;
noter({ type: 'fin', pris: compte('pris'), vivants: compte('vivant'), introuvables: compte('introuvable'), erreurs: compte('erreur') });
console.log(`FIN — ${compte('pris')} pris, ${compte('vivant')} vivants, ${compte('introuvable')} introuvables, ${compte('erreur')} erreurs`);
process.exit(compte('pris') === bilans.length ? 0 : 1);
