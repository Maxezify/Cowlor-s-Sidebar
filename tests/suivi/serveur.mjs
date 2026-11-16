// Le tableau de suivi : une page, et l'état qu'elle relit toutes les deux
// secondes. Il ne lance rien et ne commande rien ; il lit .etat/.
//   node tests/suivi/serveur.mjs [--port 4790]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { F, lireJsonl, lireJson, vivant, derouler, restant, habituel } from './etat.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--port');
const PORT = i >= 0 ? Number(process.argv[i + 1]) : 4790;
const SEQUENCE = ['lint', 'parity', 'store', 'addon', 'test'];
// Seule une course complète a des totaux connus d'avance (ceux du README).
const complete = (commande) => /\bnpm (?:run )?(?:check|test)\b|tests\/run\.mjs/.test(commande || '');

const historique = () => lireJson(F.historique, { scenarios: {}, ordre: [], phases: {}, courses: [] });

const resumeBanc = (h, maintenant) => {
  const ev = lireJsonl(F.banc);
  if (!ev.length) return null;
  const debut = ev.find((e) => e.type === 'debut') || null;
  const fin = ev.find((e) => e.type === 'fin') || null;
  const d = derouler(ev);
  const phases = ev.filter((e) => e.type === 'phase')
    .map((p, k, a) => ({ nom: p.nom, debut: p.t, fin: a[k + 1]?.t ?? fin?.t ?? null }));
  const etat = fin ? (fin.code === 0 ? 'vert' : fin.signal ? 'interrompu' : 'rouge') : debut && !vivant(debut.pid) ? 'interrompu' : 'en-cours';
  const phase = phases.at(-1)?.nom ?? null;
  const k = SEQUENCE.indexOf(phase);
  const attendus = complete(debut?.commande) ? debut?.attendus ?? null : null;
  const dernier = d.scenarios.at(-1);
  const courant = etat === 'en-cours' && dernier && dernier.fin === null ? dernier : null;
  return {
    etat, debut: debut?.t ?? ev[0].t, fin: fin?.t ?? null, dernierSigne: ev.at(-1).t,
    commande: debut?.commande ?? null, version: debut?.version ?? null, commit: debut?.commit ?? null,
    branche: debut?.branche ?? null, modifie: debut?.modifie ?? false, moteur: d.moteur,
    sequence: debut?.commande === 'npm run check' ? SEQUENCE : null, phases, phase,
    attendus, scenariosVus: d.scenarios.length, reussis: d.reussis, echoues: d.echoues, echecs: d.echecs,
    courant: courant && { titre: courant.titre, debut: courant.debut, ok: courant.ok, ko: courant.ko,
                          habituel: habituel(h, courant.cle, debut?.t) },
    derniers: d.scenarios.filter((s) => s.fin !== null).slice(-8).reverse()
      .map((s) => ({ titre: s.titre, ms: s.fin - s.debut, ok: s.ok, ko: s.ko, habituel: habituel(h, s.cle, debut?.t) })),
    // Une course partielle (un extrait) ne dit pas ce qui lui reste : pas d'estimation.
    restantMs: etat !== 'en-cours' || !complete(debut?.commande) ? null : restant({
      d, maintenant, h, attendus, phase, phaseDebut: phases.at(-1)?.debut,
      phasesRestantes: k >= 0 ? SEQUENCE.slice(k + 1) : [], sousEnsemble: null,
    }),
    sortie: fin && fin.code !== 0 && !d.echoues ? (fin.dernieres || []).slice(-40) : null,
  };
};

const resumeMutants = (h, maintenant) => {
  const ev = lireJsonl(F.mutants);
  const debut = ev.find((e) => e.type === 'debut');
  if (!debut) return null;
  const fin = ev.find((e) => e.type === 'fin') || null;
  const liste = debut.liste.map((m) => ({ ...m, etat: 'attente' }));
  const parId = new Map(liste.map((m) => [m.id, m]));
  for (const e of ev) {
    if (e.type !== 'mutant' || !parId.has(e.id)) continue;
    const m = parId.get(e.id);
    if (e.phase === 'debut') { m.etat = 'en-cours'; m.debut = e.t; } else Object.assign(m, e, { etat: e.etat });
  }
  const etat = fin ? 'termine' : vivant(debut.pid) ? 'en-cours' : 'interrompu';
  const scen = (m) => m.scenarios.map(String);
  const estime = (m) => {
    let s = 0;
    for (const k of scen(m)) { const x = h.scenarios[k]?.ms; if (x === undefined) return null; s += x; }
    return s;
  };
  // Ce que coûte un mutant au-delà de ses scénarios (copie, construction, navigateur) : mesuré sur les finis.
  const surcouts = liste.filter((m) => m.ms !== undefined && m.etat !== 'introuvable' && estime(m) !== null)
    .map((m) => m.ms - estime(m));
  const surcout = surcouts.length ? surcouts.reduce((a, b) => a + b, 0) / surcouts.length : null;
  const c = liste.find((m) => m.etat === 'en-cours') || null;
  let courant = null, restantMs = null;
  if (c && etat === 'en-cours') {
    const d = derouler(lireJsonl(F.mutantBanc));
    courant = { id: c.id, nom: c.nom, debut: c.debut, scenarios: d.scenarios.length, sur: c.scenarios.length,
                titre: d.scenarios.at(-1)?.titre ?? null, reussis: d.reussis, echoues: d.echoues };
    const r = restant({ d, maintenant, h, attendus: null, phase: null, phasesRestantes: [], sousEnsemble: scen(c) });
    let total = r;
    for (const m of liste.filter((x) => x.etat === 'attente')) {
      const e = estime(m);
      if (e === null || total === null) { total = null; break; }
      total += e + (surcout ?? 0);
    }
    restantMs = total;
  }
  const n = (e) => liste.filter((m) => m.etat === e).length;
  return {
    etat, debut: debut.t, fin: fin?.t ?? null, source: debut.source, version: debut.version, commit: debut.commit,
    branche: debut.branche, liste, courant, restantMs, approx: surcout === null,
    compte: { total: liste.length, faits: liste.length - n('attente') - n('en-cours'), pris: n('pris'), vivants: n('vivant'),
              introuvables: n('introuvable'), erreurs: n('erreur') },
  };
};

const etat = () => {
  const maintenant = Date.now();
  const h = historique();
  return { maintenant, banc: resumeBanc(h, maintenant), mutants: resumeMutants(h, maintenant), courses: h.courses.slice(0, 10) };
};

createServer((req, res) => {
  const chemin = new URL(req.url, 'http://x').pathname;
  try {
    if (chemin.endsWith('/etat')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(etat()));
    } else if (chemin === '/' || chemin.endsWith('/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(readFileSync(join(ICI, 'page.html')));
    } else {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('introuvable');
    }
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(e.stack || e));
  }
}).listen(PORT, () => console.log(`tableau de suivi : http://localhost:${PORT}/`));

