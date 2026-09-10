

'use strict';

const API = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

const T = (cle, sub) => API.i18n.getMessage(cle, sub) || cle;

const LOCALE = (API.i18n.getUILanguage && API.i18n.getUILanguage()) || 'en';
const NOMBRE = new Intl.NumberFormat(LOCALE);

const fmt = {
  texte: (v) => (v === null || v === undefined || v === '' ? '—' : String(v)),
  nombre: (v) => (Number.isFinite(v) ? NOMBRE.format(v) : '—'),
  date: (v) => {
    if (!v) return T('valNever');
    const d = new Date(v);
    return Number.isFinite(d.getTime())
      ? d.toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric',
                                   hour: '2-digit', minute: '2-digit' })
      : '—';
  },

  duree: (ms) => {
    if (!Number.isFinite(ms)) return '—';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
  },
  dureeSec: (s) => (Number.isFinite(s) ? fmt.duree(s * 1000) : '—'),
  oui: (v) => (v ? T('valYes') : T('valNo')),
};

const COL = {
  login:     { cle: 'colLogin' },
  score:     { cle: 'colScore',     f: fmt.nombre, num: true },
  visits:    { cle: 'colVisits',    f: fmt.nombre, num: true },
  last:      { cle: 'colLast',      f: fmt.date },
  sub:       { cle: 'colSub',       f: fmt.oui, classe: (v) => (v ? 'abo' : 'faible') },
  ts:        { cle: 'colSeen',      f: fmt.date },
  mois:      { cle: 'colMonths',    f: fmt.nombre, num: true },
  ancien:    { cle: 'colFormer',    f: fmt.oui },
  origine:   { cle: 'colSource',    f: fmt.texte, classe: () => 'faible' },
  lag:       { cle: 'colLag',       f: fmt.duree, num: true },
  gain:      { cle: 'colGain',      f: fmt.duree, num: true },
  t:         { cle: 'colElapsed',   f: fmt.duree, num: true },
  evt:       { cle: 'colEvent' },
  detail:    { cle: 'colDetail',    f: fmt.texte, classe: () => 'faible' },
  label:     { cle: 'colProbe',     f: fmt.texte, classe: () => 'mono' },
  status:    { cle: 'colStatus',    f: null },
  critical:  { cle: 'colCritical',  f: fmt.oui },
  rang:      { cle: 'colRank',      f: fmt.nombre, num: true },
  viewers:   { cle: 'colViewers',   f: fmt.nombre, num: true },
  game:      { cle: 'colGame' },
  libelle:   { cle: 'colLabel' },
  canonique: { cle: 'colCanonical', f: fmt.texte, classe: () => 'faible' },
  ageSec:    { cle: 'colAge',       f: fmt.dureeSec, num: true },
};

const SECTIONS = [
  { id: 'scores',  groupe: 'grpData',
    tuiles: (r) => [['sumChannels', fmt.nombre(r.chaines)]] },

  { id: 'rythme',  groupe: 'grpData',
    visuel: (p) => dessinRythme(p),
    tuiles: (r) => [
      ['sumVisits',   fmt.nombre(r.visites)],
      ['sumChannels', fmt.nombre(r.chaines)],
      ['sumPeakSlot', r.pic && r.pic.n
        ? `${JOURS_COURTS[r.pic.jour]} ${heureLisible(r.pic.heure)}` : '—'],
      ['sumSince',    r.premier ? enJours(r.dernier - r.premier) : '—'],
    ] },

  { id: 'subs',    groupe: 'grpData',
    actions: [{ id: 'refreshSubs', cle: 'btnRefreshSubs' }],
    tuiles: (r) => [
      ['sumChannels',   fmt.nombre(r.chaines)],
      ['sumSubscribed', fmt.nombre(r.abonnees), 'or'],
      ['sumSweep',      r.releve ? fmt.date(r.releve) : T('valNever')],
    ] },

  { id: 'roster',  groupe: 'grpData',
    tuiles: (r) => [['sumChannels', fmt.nombre(r.chaines)]] },

  { id: 'diagnose', groupe: 'grpDiag',
    tuiles: (r) => [
      ['sumProbes', fmt.nombre(r.sondes)],
      ['sumBroken', fmt.nombre(r.critiquesCassees), r.casse ? 'casse' : 'ok'],
    ] },

  { id: 'lag',     groupe: 'grpDiag',
    visuel: (p) => dessinLag(p),
    tuiles: (r) => [
      ['sumSamples',    fmt.nombre(r.mesures)],
      ['sumMedian',     fmt.duree(r.medianeLag)],
      ['sumP90',        fmt.duree(r.p90Lag)],
      ['sumMedianGain', fmt.duree(r.medianeGain), 'ok'],
    ] },

  { id: 'cycles',  groupe: 'grpDiag',
    tuiles: (r) => [
      ['sumEvents', fmt.nombre(r.evenements)],
      ['sumLocks',  r.verrous && r.verrous.length ? r.verrous.join(', ') : '—'],
    ] },

  { id: 'apercu',  groupe: 'grpDiag',
    tuiles: (r) => [['sumEvents', fmt.nombre(r.evenements)]] },

  { id: 'bascules', groupe: 'grpDiag',
    tuiles: (r) => [['sumSwitches', fmt.nombre(r.bascules)]] },

  { id: 'global',  groupe: 'grpGlobal',
    actions: [{ id: 'globalOn', cle: 'btnGlobalOn' }, { id: 'globalOff', cle: 'btnGlobalOff' }],
    tuiles: (r) => [
      ['sumMode',     r.actif ? T('valOn') : T('valOff'), r.actif ? 'ok' : ''],
      ['sumComplete', fmt.oui(r.complete)],
    ] },

  { id: 'categories', groupe: 'grpGlobal',
    tuiles: (r) => [['sumCategories', fmt.nombre(r.categories)]] },
];

const MAJ = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cleNav  = (id) => 'nav'  + MAJ(id);
const cleDesc = (id) => 'desc' + MAJ(id);

const JOURS_COURTS = (() => {
  const f = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, j) => f.format(new Date(2024, 0, 7 + j)));
})();

const heureLisible = (h) => new Intl.DateTimeFormat(LOCALE, { hour: 'numeric' })
  .format(new Date(2024, 0, 7, h));

const PREMIER_JOUR = (() => {
  try {
    const l = new Intl.Locale(LOCALE);
    const info = (typeof l.getWeekInfo === 'function') ? l.getWeekInfo() : l.weekInfo;
    const d = info && info.firstDay;
    if (Number.isInteger(d) && d >= 1 && d <= 7) return d % 7;
  } catch {   }
  return 1;
})();

const enJours = (ms) => {
  const n = Math.max(1, Math.round(ms / 86_400_000));
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'unit', unit: 'day', unitDisplay: 'short' })
      .format(n);
  } catch { return NOMBRE.format(n); }
};

const div = (classe, texte) => {
  const d = document.createElement('div');
  d.className = classe;
  if (texte !== undefined) d.textContent = texte;
  return d;
};

const dessinRythme = (paquet) => {
  const grille = paquet && paquet.grille;
  const r = (paquet && paquet.resume) || {};
  if (!Array.isArray(grille) || !r.visites) return null;
  const max = (r.pic && r.pic.n) || 1;

  const hote = div('rythme');
  const cases = div('rythme-grille');
  cases.setAttribute('aria-hidden', 'true');

  const ordre = Array.from({ length: 7 }, (_, i) => (PREMIER_JOUR + i) % 7);
  for (const j of ordre) {
    cases.appendChild(div('rythme-jour', JOURS_COURTS[j]));
    for (let h = 0; h < 24; h++) {
      const n = grille[j][h] || 0;

      const palier = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
      const c = div('rythme-case' + (palier ? ' rythme-case--' + palier : ''));
      c.title = `${JOURS_COURTS[j]} ${heureLisible(h)} — ${NOMBRE.format(n)}`;
      cases.appendChild(c);
    }
  }
  hote.appendChild(cases);

  const axe = div('rythme-grille');
  axe.setAttribute('aria-hidden', 'true');
  axe.appendChild(div('rythme-heure'));
  for (let h = 0; h < 24; h++) {
    axe.appendChild(div('rythme-heure', h % 3 === 0 ? String(h).padStart(2, '0') : ''));
  }
  hote.appendChild(axe);

  const colonnes = Array.from({ length: 24 }, (_, h) =>
    ordre.reduce((s, j) => s + (grille[j][h] || 0), 0));
  const hautMax = Math.max(1, ...colonnes);
  const profil = div('rythme-profil');
  profil.setAttribute('aria-hidden', 'true');
  profil.appendChild(div('rythme-echelle', NOMBRE.format(hautMax)));
  for (let h = 0; h < 24; h++) {
    const b = div('rythme-barre');
    b.style.height = (colonnes[h] / hautMax * 100).toFixed(2) + '%';
    b.title = `${heureLisible(h)} — ${NOMBRE.format(colonnes[h])}`;
    profil.appendChild(b);
  }
  hote.appendChild(profil);

  const legende = div('rythme-legende');
  legende.setAttribute('aria-hidden', 'true');
  legende.appendChild(div('rythme-legende-mot', T('valLess')));
  for (let p = 0; p <= 4; p++) legende.appendChild(div('rythme-case' + (p ? ' rythme-case--' + p : '')));
  legende.appendChild(div('rythme-legende-mot', T('valMore')));
  hote.appendChild(legende);
  return hote;
};

const NS_SVG = 'http://www.w3.org/2000/svg';
const svgEl = (nom, attrs) => {
  const e = document.createElementNS(NS_SVG, nom);
  for (const k of Object.keys(attrs || {})) e.setAttribute(k, String(attrs[k]));
  return e;
};

const PALIERS_LAG = [1e3, 5e3, 15e3, 30e3, 60e3, 5 * 60e3, 15 * 60e3,
                     30 * 60e3, 60 * 60e3, 2 * 60 * 60e3];

const dessinLag = (paquet) => {
  const lignes = (paquet && paquet.lignes) || [];
  const lags = lignes.map((s) => s.lag).filter(Number.isFinite).sort((a, b) => a - b);

  if (lags.length < 5) return null;
  const max = lags[lags.length - 1];
  if (!(max > 0)) return null;

  const bas = 1000;

  const brut = Math.max(max, bas * 2);
  const haut = PALIERS_LAG.find((p) => p >= brut) || brut;
  const lb = Math.log(bas), lh = Math.log(haut);

  const W = 546, H = 104;
  const gx = 6, dx = 540, hy = 10, by = 80;
  const svg = svgEl('svg', { class: 'courbe', viewBox: `0 0 ${W} ${H}`,
                             width: W, height: H, 'aria-hidden': 'true' });
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id: 'tse-degrade-courbe', x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': '#9147ff', 'stop-opacity': '0.34' }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#9147ff', 'stop-opacity': '0.02' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  const X = (ms) => gx + (Math.log(Math.max(bas, ms)) - lb) / (lh - lb) * (dx - gx);
  const Y = (part) => by - part * (by - hy);

  let dernierX = -Infinity;
  for (const ms of PALIERS_LAG) {
    if (ms < bas || ms > haut) continue;
    const x = X(ms);
    if (x - dernierX < 46) continue;
    dernierX = x;
    svg.appendChild(svgEl('line', { class: 'courbe-axe', x1: x, y1: hy, x2: x, y2: by,
                                    opacity: '0.45' }));

    const t = svgEl('text', { class: 'courbe-texte', x: x, y: by + 13,
                              'text-anchor': x < gx + 20 ? 'start'
                                           : x > dx - 30 ? 'end' : 'middle' });

    t.textContent = ms >= 3600e3 && ms % 3600e3 === 0 ? `${ms / 3600e3} h`
                  : ms >= 60e3 && ms % 60e3 === 0 ? `${ms / 60e3} min`
                  : fmt.duree(ms);
    svg.appendChild(t);
  }

  for (const [part, cle] of [[0.5, 'sumMedian'], [0.9, 'sumP90']]) {
    const y = Y(part);
    svg.appendChild(svgEl('line', { class: 'courbe-repere', x1: gx, y1: y, x2: dx, y2: y }));
    const t = svgEl('text', { class: 'courbe-texte', x: gx + 1, y: y - 3 });
    t.textContent = T(cle);
    svg.appendChild(t);
  }

  const pts = [[X(bas), Y(0)]];
  for (let i = 0; i < lags.length; i++) pts.push([X(lags[i]), Y((i + 1) / lags.length)]);

  pts.push([dx, Y(1)]);
  const trace = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  svg.appendChild(svgEl('path', { class: 'courbe-aire', d: `${trace} L${dx},${Y(0)} Z` }));
  svg.appendChild(svgEl('path', { class: 'courbe-trait', d: trace }));
  svg.appendChild(svgEl('line', { class: 'courbe-axe', x1: gx, y1: by, x2: dx, y2: by }));

  for (const [ms, part] of [[paquet.resume && paquet.resume.medianeLag, 0.5],
                            [paquet.resume && paquet.resume.p90Lag, 0.9]]) {
    if (!Number.isFinite(ms)) continue;
    const x = Math.min(dx, Math.max(gx, X(ms)));
    svg.appendChild(svgEl('line', { class: 'courbe-repere', x1: x, y1: Y(part), x2: x, y2: by }));
  }
  return svg;
};

let ongletP = null;
const idOnglet = () => (ongletP ??= API.tabs
  .query({ active: true, currentWindow: true })
  .then(([t]) => (t ? t.id : undefined))
  .catch(() => undefined));

const ATTENTES = [250, 750, 1800];

const etatFond = () => API.runtime.sendMessage({ type: 'tse-panneau-etat' })
  .catch((e) => ({ ok: false, erreur: 'fond', detail: String((e && e.message) || e) }));

const demander = async (charge, essai = 0, trace = []) => {
  const t0 = Date.now();
  const onglet = await idOnglet();
  if (typeof onglet !== 'number') {
    trace.push({ essai, ms: Date.now() - t0, erreur: 'onglet' });
    return { ok: false, erreur: 'absent', detail: 'aucun onglet actif', trace };
  }

  const r = await API.runtime.sendMessage({ type: 'tse-panneau', tabId: onglet, ...charge })
    .catch((e) => ({ ok: false, erreur: 'fond', detail: String((e && e.message) || e) }));
  trace.push({ essai, ms: Date.now() - t0,
               erreur: r && r.ok ? 'ok' : ((r && r.erreur) || 'vide'),
               detail: r && r.detail });
  if (r && (r.erreur === 'absent' || r.erreur === 'fond') && essai < ATTENTES.length) {
    await new Promise((res) => setTimeout(res, ATTENTES[essai]));
    return demander(charge, essai + 1, trace);
  }
  return { ...(r || { ok: false, erreur: 'absent' }), trace };
};

const $ = (id) => document.getElementById(id);
let courante = SECTIONS[0].id;

const montrerMessage = (cle, bouton, detail) => {
  $('tableau-cadre').hidden = true;

  $('visuel').hidden = true;
  $('visuel').replaceChildren();
  $('resume').replaceChildren();
  const m = $('message');
  m.hidden = false;

  $('message-texte').textContent = T(cle) + (detail ? ` (${detail})` : '');
  const b = $('message-bouton');
  b.hidden = !bouton;
  if (bouton) b.textContent = T('btnRetry');
};

const CAUSES = {
  fond: 'stateNoWorker',
  absent: 'stateAbsent',

  demarrage: 'stateBooting',
  'page-absente': 'statePageMissing',
  'expiration-page': 'stateTimeoutPage',
  'expiration-pont': 'stateTimeoutBridge',
  expiration: 'stateTimeout',
};
const montrerEchec = (r) => montrerMessage(CAUSES[r.erreur] || 'stateError', true, r.detail);

const cellule = (nom, valeur) => {
  const td = document.createElement('td');
  const def = COL[nom];
  if (nom === 'status') {
    const sp = document.createElement('span');
    sp.className = 'etiq etiq--' + (valeur === 'ok' || valeur === 'broken' ? valeur : 'na');
    sp.textContent = T(valeur === 'ok' ? 'statusOk' : valeur === 'broken' ? 'statusBroken' : 'statusNa');
    td.appendChild(sp);
    return td;
  }
  const classes = [];
  if (def && def.num) classes.push('num');
  if (def && def.classe) classes.push(def.classe(valeur));
  if (classes.filter(Boolean).length) td.className = classes.filter(Boolean).join(' ');

  td.textContent = def && def.f ? def.f(valeur) : fmt.texte(valeur);
  return td;
};

const peindre = (section, paquet) => {
  const { colonnes = [], lignes = [], resume = {} } = paquet || {};

  const tuiles = section.tuiles ? section.tuiles(resume) : [];
  $('resume').replaceChildren(...tuiles.map(([cle, val, ton]) => {
    const d = document.createElement('div');
    d.className = 'tuile' + (ton ? ' tuile--' + ton : '');
    const v = document.createElement('div'); v.className = 'tuile-val'; v.textContent = val;
    const k = document.createElement('div'); k.className = 'tuile-cle'; k.textContent = T(cle);
    d.append(v, k);
    return d;
  }));

  const dessin = section.visuel ? section.visuel(paquet || {}) : null;
  $('visuel').replaceChildren(...(dessin ? [dessin] : []));
  $('visuel').hidden = !dessin;

  if (!lignes.length && !dessin) { montrerMessage('stateEmpty'); return; }

  $('message').hidden = true;

  $('tableau-cadre').hidden = !(colonnes.length && lignes.length);
  if ($('tableau-cadre').hidden) return;

  const affichees = colonnes.filter((c) => COL[c]);
  const tr = document.createElement('tr');
  for (const c of affichees) {
    const th = document.createElement('th');
    th.textContent = T(COL[c].cle);
    if (COL[c].num) th.className = 'num';
    tr.appendChild(th);
  }
  $('tableau-tete').replaceChildren(tr);
  $('tableau-corps').replaceChildren(...lignes.map((l) => {
    const ligne = document.createElement('tr');
    for (const c of affichees) ligne.appendChild(cellule(c, l[c]));
    return ligne;
  }));
  $('tableau-cadre').scrollTop = 0;
};

const charger = async (id) => {
  courante = id;
  const section = SECTIONS.find((s) => s.id === id);
  for (const b of document.querySelectorAll('.rail-item')) {
    b.setAttribute('aria-current', String(b.dataset.id === id));
  }
  $('vue-titre').textContent = T(cleNav(id));
  $('vue-desc').textContent  = T(cleDesc(id));

  $('vue-actions').replaceChildren(...(section.actions || []).map((a) => {
    const b = document.createElement('button');
    b.className = 'bouton bouton--fantome';
    b.textContent = T(a.cle);
    b.addEventListener('click', () => lancer(a.id, b));
    return b;
  }));

  montrerMessage('stateLoading');
  const r = await demander({ section: id });
  if (courante !== id) return;
  if (!r.ok) { montrerEchec(r); return; }
  peindre(section, r.data);
  if (id === 'diagnose') marquerEtat(r.data && r.data.resume);
};

const marquerEtat = (resume) => {
  if (!resume) return;
  const e = $('etat');
  e.hidden = false;
  $('etat-pastille').className = 'pastille pastille--' + (resume.casse ? 'casse' : 'ok');
  $('etat-texte').textContent = T(resume.casse ? 'healthBroken' : 'healthOk');
};

const lancer = async (action, bouton) => {
  if (bouton) bouton.disabled = true;
  const r = await demander({ action });
  if (bouton) bouton.disabled = false;
  if (!r.ok) { montrerEchec(r); return; }
  await charger(courante);
};

const bloc = (titre, lignes) => [`── ${titre} ${'─'.repeat(Math.max(0, 58 - titre.length))}`, ...lignes, ''];
const paire = (cle, val) => `  ${String(cle).padEnd(22)} ${val === undefined || val === null ? '—' : val}`;

const aplatir = (obj, prefixe = '') => {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...aplatir(v, prefixe + k + '.'));
    else out.push(paire(prefixe + k, Array.isArray(v) ? (v.join(', ') || '—') : v));
  }
  return out;
};

const blocErreurs = (liste, origine, bilan) => bloc(
  `ERREURS / ERRORS (${(liste || []).length})${origine ? ' — ' + origine : ''}`,
  [

    ...(bilan && bilan.total
      ? [`  total consigné / total recorded : ${bilan.total}`,
         ...bilan.sources.map(c =>
           `    ${String(c.source).padEnd(12)} ${String(c.n).padStart(5)}`
           + `   1re ${c.premiere} ms · dernière ${c.derniere} ms`),
         '']
      : []),
    ...((liste || []).length
      ? liste.map(e =>
          `  ${String(e.t).padStart(8)} ms  ${String(e.source).padEnd(10)}`
          + `${e.n > 1 ? ` ×${e.n}` : '   '}  ${e.message}${e.detail ? '  — ' + e.detail : ''}`
          + (e.dernier && e.n > 1 ? `  (dernière : ${e.dernier} ms)` : ''))
      : ['  (aucune / none)']),
  ]);

const construireRapport = (r, transport, fond) => {
  const m = API.runtime.getManifest();
  const d = new Date();
  const L = [
    `Cowlor's Sidebar — rapport de diagnostic / diagnostic report`,
    `généré / generated : ${d.toISOString()}`,
    '',
    `CE FICHIER NE CONTIENT AUCUNE LISTE PERSONNELLE : ni les chaînes visitées,`,
    `ni les abonnements, ni le roster — seulement leurs COMPTES. Il porte en`,
    `revanche tout le diagnostic technique. Relisez-le avant de l'envoyer.`,
    '',
    `THIS FILE CONTAINS NO PERSONAL LISTS: not the channels you visit, not your`,
    `subscriptions, not the roster — only their COUNTS. It does carry the full`,
    `technical diagnostic. Read it before sending it.`,
    '',
  ];

  L.push(...bloc('ENVIRONNEMENT / ENVIRONMENT', [
    paire('extension', `${m.version} (${m.browser_specific_settings ? 'firefox' : 'chrome'})`),
    paire('page ouverte depuis', r ? `${Math.round((r.ancienneteMs || 0) / 1000)} s` : '—'),
    paire('démarrage / boot', r?.demarrage
      ? `${r.demarrage.etape} (${r.demarrage.dureeMs} ms)`
      : (transport.partiel ? `${transport.partiel.etape} — INACHEVÉ / UNFINISHED` : '—')),

    ...(r?.demarrage?.etapes?.length
      ? [paire('étapes / stages',
          r.demarrage.etapes.map(e => `${e.etape} ${e.ms}`).join(' · ') + ' ms')]
      : []),
    paire('fond / background', m.background?.service_worker ? 'service_worker'
                             : m.background?.scripts ? 'scripts' : '—'),
    paire('action.popup', m.action?.default_popup ?? '—'),
    paire('permissions', (m.permissions || []).join(', ') || 'aucune / none'),
    paire('panneau / panel UI', LOCALE),
    paire('navigateur / browser', navigator.userAgent),
  ]));

  L.push(...bloc('TRANSPORT', [
    paire('onglet / tab', transport.onglet),
    paire('résultat / result', transport.ok ? 'ok' : (transport.erreur || 'échec')),
    ...(transport.detail ? [paire('détail / detail', transport.detail)] : []),
  ]));

  const obs = transport.observations;
  L.push(...bloc('DIAGNOSTIC HORS PAGE / OFF-PAGE DIAGNOSTIC', [
    paire('worker — ponts', fond?.ok ? (fond.ponts.join(', ') || 'aucun / none')
                                     : `injoignable (${fond?.erreur || '—'})`),
    ...(fond?.ok ? [paire('worker — âge', `${fond.workerMs} ms`),
                    paire('worker — en vol', fond.enVol)] : []),
    paire('essais / attempts', (transport.trace || [])
      .map(t => `#${t.essai} ${t.erreur} (${t.ms} ms)`).join('  →  ') || '—'),

    ...(obs ? [
      paire('page — jalon / marker', obs.marque || 'ABSENT'),
      paire('page — readyState', obs.etat),
      paire('page — hôte / host', obs.hote),
      paire('page — cachée / hidden', obs.cachee),
      paire('pont / bridge', `${obs.pont}, ${obs.reprises} reprise(s)`),
      paire('page — âge / age', `${obs.pageMs} ms`),
    ] : [paire('observations du pont',
               'aucune — le pont lui-même n\'a rien rendu / bridge silent')]),
    ...(transport.partiel ? [
      paire('page — étape / stage', transport.partiel.etape),
      paire('page — depuis / since', `${transport.partiel.depuisMs} ms`),
    ] : []),
  ]));

  if (!r) {

    L.push(...blocErreurs(transport.partiel?.erreurs, 'démarrage inachevé / partial boot'));
    L.push('La page n\'a pas répondu en entier : les blocs qui suivraient',
           'manquent. Les deux blocs ci-dessus disent ce qu\'on sait sans elle.',
           'The page did not fully answer: the blocks that would follow are',
           'missing. The two blocks above say what is known without it.', '');
    return L.join('\n');
  }

  L.push(...bloc('PAGE', aplatir(r.page)));
  L.push(...bloc('LANGUE / LANGUAGE', aplatir(r.langue)));
  L.push(...bloc('MODE', aplatir(r.mode)));
  L.push(...bloc('COMPTEURS / COUNTS', aplatir(r.compteurs)));
  L.push(...bloc('FRISE DES CATÉGORIES / CATEGORY TRAIL', aplatir(r.frise)));
  L.push(...bloc('ABONNEMENTS — RELEVÉ / SUBSCRIPTIONS SWEEP', [
    paire('horodatage', r.relevesAbonnements?.horodatage
      ? new Date(r.relevesAbonnements.horodatage).toISOString() : 'jamais / never'),
    paire('en attente / pending', r.relevesAbonnements?.enAttente),
  ]));
  L.push(...bloc('RÉSEAU / NETWORK', [
    ...aplatir(r.reseau),
    paire('retards.medianeMs', r.retards?.medianeMs),
    paire('retards.p90Ms', r.retards?.p90Ms),
  ]));
  L.push(...bloc('TOP CHAÎNES / TOP CHANNELS', aplatir(r.global)));

  L.push(...blocErreurs(r.erreurs, '', r.bilanErreurs));

  L.push(...bloc(`SONDES / PROBES (${(r.sondes || []).length})`,
    (r.sondes || []).map(p =>
      `  ${(p.critical ? '!' : ' ')} ${String(p.status).padEnd(7)} `
      + `${String(p.id).padEnd(16)} ${String(p.label).padEnd(34)} ${p.detail || ''}`.trimEnd())
      .concat(['', '  « ! » = sonde critique / critical probe'])));

  const journal = (nom, entrees) => bloc(nom,
    (entrees || []).length
      ? entrees.map(e => `  ${String(e.t).padStart(7)} ms  ${String(e.evt).padEnd(18)} ${e.detail || ''}`.trimEnd())
      : ['  (vide / empty)']);
  L.push(...bloc('VERROUS DE VOILE / OVERLAY HOLDS',
    [paire('verrous', (r.journaux?.verrous || []).join(', ') || 'aucun / none')]));
  L.push(...journal('JOURNAL — VOILE / OVERLAY', r.journaux?.cycles));
  L.push(...journal('JOURNAL — APERÇU / PREVIEW', r.journaux?.apercu));

  return L.join('\n');
};

const noter = (texte, erreur) => {
  const n = $('rapport-note');
  n.textContent = texte;
  n.className = 'pied-note' + (erreur ? ' pied-note--erreur' : '');
  n.hidden = false;
};

const remplirRapport = async () => {
  const zone = $('rapport-zone');
  const boutons = [$('rapport-copier'), $('rapport-actualiser')];
  boutons.forEach(b => { b.disabled = true; });
  $('rapport-note').hidden = true;
  zone.value = T('stateLoading');
  const onglet = await idOnglet();

  const [r, fond] = await Promise.all([demander({ rapport: true }), etatFond()]);
  zone.value = construireRapport(r.ok ? r.data : null,
    { onglet, ok: r.ok, erreur: r.erreur, detail: r.detail,
      trace: r.trace, observations: r.observations, partiel: r.partiel },
    fond);
  zone.scrollTop = 0;
  boutons.forEach(b => { b.disabled = false; });
};

const ouvrirRapport = async () => {
  $('rapport').hidden = false;
  $('rapport-fermer').focus();
  await remplirRapport();
};

const fermerRapport = () => {
  $('rapport').hidden = true;
  $('rapport-note').hidden = true;
  $('btn-rapport').focus();
};

const copierRapport = async () => {
  const zone = $('rapport-zone');
  try {
    await navigator.clipboard.writeText(zone.value);
    noter(T('reportCopied'));
    return;
  } catch {   }
  try {
    zone.focus();
    zone.setSelectionRange(0, zone.value.length);
    if (!document.execCommand('copy')) throw new Error('refusé');
    noter(T('reportCopied'));
  } catch {
    noter(T('reportFailed'), true);
  }
};

let aConfirmer = null;
const confirmer = (titre, texte, suite) => {
  aConfirmer = suite;
  $('boite-titre').textContent = T(titre);
  $('boite-texte').textContent = T(texte);
  $('voile').hidden = false;
  $('boite-ok').focus();
};

const construireRail = () => {
  const rail = $('rail');
  let groupe = null;
  for (const s of SECTIONS) {
    if (s.groupe !== groupe) {
      groupe = s.groupe;
      const h = document.createElement('div');
      h.className = 'rail-groupe';
      h.textContent = T(groupe);
      rail.appendChild(h);
    }
    const b = document.createElement('button');
    b.className = 'rail-item';
    b.dataset.id = s.id;
    b.type = 'button';
    b.textContent = T(cleNav(s.id));
    b.setAttribute('aria-current', 'false');
    b.addEventListener('click', () => charger(s.id));
    rail.appendChild(b);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = LOCALE;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = T(el.dataset.i18n);
  }
  construireRail();

  $('message-bouton').addEventListener('click', () => charger(courante));
  $('btn-rescan').addEventListener('click', () => lancer('rescan', $('btn-rescan')));
  $('btn-rapport').addEventListener('click', ouvrirRapport);
  $('rapport-fermer').addEventListener('click', fermerRapport);
  $('rapport-copier').addEventListener('click', copierRapport);
  $('rapport-actualiser').addEventListener('click', remplirRapport);
  $('btn-reset').addEventListener('click', () =>
    confirmer('resetTitle', 'resetText', () => lancer('reset', $('btn-reset'))));

  $('boite-annuler').addEventListener('click', () => { $('voile').hidden = true; aConfirmer = null; });
  $('boite-ok').addEventListener('click', () => {
    const suite = aConfirmer;
    $('voile').hidden = true; aConfirmer = null;
    if (suite) suite();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('voile').hidden) { $('voile').hidden = true; aConfirmer = null; return; }
    if (!$('rapport').hidden) fermerRapport();
  });

  charger(courante);
});
