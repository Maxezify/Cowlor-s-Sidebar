// Le tableau de suivi : où vivent ses fichiers, comment ils se lisent, et ce
// qu'on en tire. Partagé par lancer.mjs, mutants.mjs et serveur.mjs.
//
// Tout est dans tests/suivi/.etat/ (ignoré par git), ou dans TSE_SUIVI_DIR :
//   banc.jsonl          la dernière vérification lancée par lancer.mjs :
//                       ses étapes (debut, phase, fin) et, par TSE_SUIVI, les
//                       scénarios et assertions que tests/run.mjs y ajoute ;
//   banc.log            sa sortie brute, telle que le terminal l'aurait vue ;
//   mutants.jsonl       la dernière campagne de mutants (plan, chacun, fin) ;
//   mutant-banc.jsonl   le banc du mutant en cours ;
//   historique.json     la durée de chaque scénario et de chaque étape à la
//                       dernière mesure, et les vingt dernières courses —
//                       de quoi estimer le temps restant.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
export const RACINE = join(ICI, '..', '..');
export const ETAT = process.env.TSE_SUIVI_DIR || join(ICI, '.etat');
export const F = {
  banc: join(ETAT, 'banc.jsonl'),
  bancLog: join(ETAT, 'banc.log'),
  mutants: join(ETAT, 'mutants.jsonl'),
  mutantBanc: join(ETAT, 'mutant-banc.jsonl'),
  historique: join(ETAT, 'historique.json'),
};
export const preparer = () => mkdirSync(ETAT, { recursive: true });

// Une ligne coupée (écrite à l'instant de la lecture) est ignorée, pas fatale.
export const lireJsonl = (f) => {
  if (!existsSync(f)) return [];
  const out = [];
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    if (!l) continue;
    try { out.push(JSON.parse(l)); } catch { /* ligne en cours d'écriture */ }
  }
  return out;
};
export const lireJson = (f, defaut) => {
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return defaut; }
};
// Écrite à côté puis renommée : le serveur ne lit jamais un fichier à moitié.
export const ecrireJson = (f, v) => {
  writeFileSync(f + '.tmp', JSON.stringify(v, null, 1));
  renameSync(f + '.tmp', f);
};

export const vivant = (pid) => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

// Ce que l'arbre dit de lui-même, pour l'en-tête du tableau.
export const identite = (arbre) => {
  const git = (...a) => { try { return execFileSync('git', a, { cwd: arbre, encoding: 'utf8' }).trim(); } catch { return null; } };
  const pkg = lireJson(join(arbre, 'package.json'), {});
  let attendus = null;
  try {
    // La même ligne que vérifie le scénario 68.
    const m = /(\d+)\s+(?:scénarios|scenarios),\s*(\d+)\s+assertions/.exec(readFileSync(join(arbre, 'README.md'), 'utf8'));
    if (m) attendus = { scenarios: Number(m[1]), assertions: Number(m[2]) };
  } catch { /* pas de README */ }
  return { version: pkg.version || null, commit: git('rev-parse', '--short', 'HEAD'), branche: git('branch', '--show-current'),
           modifie: (git('status', '--porcelain', '--untracked-files=no') || '').length > 0, attendus };
};

// La clé d'un scénario : son numéro s'il en a un, son titre sinon.
export const cle = (titre) => /^(\d+)\. /.exec(titre)?.[1] ?? titre;
// Sa durée habituelle vue d'une course : la mesure d'avant, si c'est elle qui vient de l'écrire.
export const habituel = (h, k, course) => {
  const x = h.scenarios[k];
  if (!x) return null;
  return course !== null && course !== undefined && x.course === course ? x.avant ?? null : x.ms;
};

/* LE DÉROULÉ D'UN BANC, à partir de ses événements (ceux de tests/run.mjs, et
   ceux de lancer.mjs quand il l'a lancé). `fin` : l'instant où il s'est
   arrêté, s'il s'est arrêté. Chaque scénario dure jusqu'au suivant, le
   dernier jusqu'au bilan. */
export const derouler = (ev) => {
  const scenarios = [];
  const echecs = [];
  let reussis = 0, echoues = 0, bilan = null, moteur = null, courant = null;
  for (const e of ev) {
    if (e.type === 'moteur') moteur = { nom: e.moteur, version: e.version };
    else if (e.type === 'scenario') {
      if (courant) courant.fin = e.t;
      courant = { titre: e.titre, cle: cle(e.titre), debut: e.t, fin: null, ok: 0, ko: 0 };
      scenarios.push(courant);
    } else if (e.type === 'assertion') {
      if (e.ok) reussis++; else echoues++;
      if (courant) { if (e.ok) courant.ok++; else courant.ko++; }
      if (!e.ok) echecs.push({ scenario: courant ? courant.titre : '(hors scénario)', nom: e.nom, detail: e.detail || '' });
    } else if (e.type === 'bilan') {
      bilan = e;
      if (courant) courant.fin = e.t;
    }
  }
  return { scenarios, echecs, reussis, echoues, bilan, moteur };
};

/* L'HISTORIQUE se nourrit des bancs lancés par lancer.mjs, jamais de ceux
   des mutants (un code muté peut attendre des délais entiers). Un scénario
   garde sa dernière durée mesurée ; l'ordre est celui de la dernière course
   complète, celui dans lequel les restants viendront. */
export const enrichirHistorique = (evBanc, finInfo) => {
  const h = lireJson(F.historique, { scenarios: {}, ordre: [], phases: {}, courses: [] });
  const d = derouler(evBanc);
  const debut = evBanc.find((e) => e.type === 'debut');
  /* `avant` : la mesure qu'elle remplace. Le tableau la montre comme
     « d'habitude » pour la course qui vient de mesurer — sinon, une course
     finie se comparerait à elle-même. */
  for (const s of d.scenarios) {
    if (s.fin === null) continue;
    const ancien = h.scenarios[s.cle];
    h.scenarios[s.cle] = { titre: s.titre, ms: s.fin - s.debut, assertions: s.ok + s.ko, course: debut?.t ?? null,
                           avant: ancien ? (ancien.course === (debut?.t ?? null) ? ancien.avant : ancien.ms) : null };
  }
  if (d.bilan && debut?.attendus && d.bilan.scenarios === debut.attendus.scenarios) h.ordre = d.scenarios.map((s) => s.cle);
  const phases = evBanc.filter((e) => e.type === 'phase');
  phases.forEach((p, i) => {
    const suite = phases[i + 1]?.t ?? finInfo.t;
    if (suite) h.phases[p.nom] = suite - p.t;
  });
  h.courses.unshift({
    debut: debut?.t ?? null, fin: finInfo.t, code: finInfo.code, signal: finInfo.signal || null,
    commande: debut?.commande ?? null, version: debut?.version ?? null, commit: debut?.commit ?? null,
    reussis: d.reussis, echoues: d.echoues, scenarios: d.scenarios.length,
  });
  h.courses = h.courses.slice(0, 20);
  ecrireJson(F.historique, h);
};

/* LE TEMPS RESTANT. Les scénarios pas encore vus, dans l'ordre de la dernière
   course complète, comptent leur dernière durée ; celui en cours, ce qui lui
   reste de la sienne ; un scénario jamais mesuré, la moyenne de ceux de cette
   course. Avant le banc, les étapes restantes comptent aussi. Sans aucune
   mesure : pas d'estimation — rien d'inventé. */
export const restant = ({ d, maintenant, h, attendus, phase, phasesRestantes, phaseDebut, sousEnsemble }) => {
  const moy = (() => {
    const finis = d.scenarios.filter((s) => s.fin !== null);
    return finis.length ? finis.reduce((a, s) => a + (s.fin - s.debut), 0) / finis.length : null;
  })();
  let ms = 0, connu = true;
  const vus = new Set(d.scenarios.map((s) => s.cle));
  const courant = d.scenarios.at(-1);
  if (courant && courant.fin === null) {
    const m = h.scenarios[courant.cle]?.ms ?? moy;
    if (m === null) connu = false; else ms += Math.max(0, m - (maintenant - courant.debut));
  }
  const restants = sousEnsemble
    ? sousEnsemble.filter((k) => !vus.has(k))
    : h.ordre.length ? h.ordre.filter((k) => !vus.has(k)) : null;
  if (restants) {
    for (const k of restants) {
      const m = h.scenarios[k]?.ms ?? moy;
      if (m === null) { connu = false; break; }
      ms += m;
    }
  } else if (attendus) {
    const n = Math.max(0, attendus.scenarios - d.scenarios.length);
    if (n && moy === null) connu = false; else ms += n * (moy || 0);
  } else connu = false;
  if (phase && phase !== 'test') {
    const p = h.phases[phase];
    if (p === undefined) connu = false; else ms += Math.max(0, p - (maintenant - phaseDebut));
    for (const q of phasesRestantes) {
      if (q === 'test') continue;
      if (h.phases[q] === undefined) { connu = false; break; }
      ms += h.phases[q];
    }
  }
  return connu ? Math.round(ms) : null;
};
