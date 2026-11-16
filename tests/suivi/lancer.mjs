// Lance une vérification sous le regard du tableau de suivi.
//   node tests/suivi/lancer.mjs                 → npm run check
//   node tests/suivi/lancer.mjs -- node tests/_extrait.mjs
// La sortie reste celle du terminal (et va aussi dans .etat/banc.log) ; le
// code de sortie est celui de la commande. Les étapes de npm (« > paquet@x.y
// lint ») deviennent des phases ; le banc, par TSE_SUIVI, ajoute ses
// scénarios et ses assertions au même fichier.
import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { F, preparer, identite, lireJsonl, enrichirHistorique } from './etat.mjs';

const i = process.argv.indexOf('--');
const commande = i >= 0 ? process.argv.slice(i + 1) : ['npm', 'run', 'check'];
if (!commande.length) { console.error('commande vide après --'); process.exit(2); }

preparer();
writeFileSync(F.banc, '');
const noter = (o) => appendFileSync(F.banc, JSON.stringify({ t: Date.now(), ...o }) + '\n');
const arbre = process.cwd();
noter({ type: 'debut', commande: commande.join(' '), pid: process.pid, arbre, ...identite(arbre) });

const journal = createWriteStream(F.bancLog);
const dernieres = [];
const RE_PHASE = /^> \S+@\S+ (\S+)$/;
const lignes = (flux, sortie) => {
  let reste = '';
  flux.on('data', (b) => {
    sortie.write(b);
    journal.write(b);
    const t = reste + b.toString('utf8');
    const ls = t.split('\n');
    reste = ls.pop();
    for (const l of ls) {
      const m = RE_PHASE.exec(l);
      if (m && m[1] !== 'check') noter({ type: 'phase', nom: m[1] });
      dernieres.push(l);
      if (dernieres.length > 60) dernieres.shift();
    }
  });
};
const enfant = spawn(commande[0], commande.slice(1), { cwd: arbre, env: { ...process.env, TSE_SUIVI: F.banc }, stdio: ['ignore', 'pipe', 'pipe'] });
lignes(enfant.stdout, process.stdout);
lignes(enfant.stderr, process.stderr);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => enfant.kill(s));
enfant.on('close', (code, signal) => {
  const fin = { t: Date.now(), code, signal };
  noter({ type: 'fin', code, signal, dernieres });
  try { enrichirHistorique(lireJsonl(F.banc), fin); } catch (e) { console.error('historique non mis à jour :', e.message); }
  journal.end(() => process.exit(code ?? 1));
});
