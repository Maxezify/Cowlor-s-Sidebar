

'use strict';

const API = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

const T = (cle, sub) => API.i18n.getMessage(cle, sub) || cle;

try {
  if (window.top !== window) document.documentElement.setAttribute('data-vue', 'incruste');
} catch {

  document.documentElement.setAttribute('data-vue', 'incruste');
}

const THEME_CLE = 'tse:theme';
const appliquerThemePanneau = (t) => {
  if (t !== 'light' && t !== 'dark') return;
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_CLE, t); } catch {   }
};
try {
  const su = localStorage.getItem(THEME_CLE);
  if (su === 'light' || su === 'dark') document.documentElement.setAttribute('data-theme', su);
} catch {   }

const LOCALE = (() => {
  const servie = (API.i18n.getMessage && API.i18n.getMessage('panelLocale')) || 'en';
  let ui = null;
  try { ui = Intl.getCanonicalLocales((API.i18n.getUILanguage && API.i18n.getUILanguage()) || '')[0] || null; }
  catch { ui = null; }
  if (!ui || servie.includes('-')) return servie;
  return ui.split('-')[0].toLowerCase() === servie.toLowerCase() ? ui : servie;
})();
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

  jour: (v) => {
    const d = new Date(v || NaN);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';
  },
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
  echeance:  { cle: 'colDue',       f: fmt.jour },

  fin:       { cle: 'colEnd',       f: fmt.oui },
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

  { id: 'guide',   groupe: 'grpGuide', statique: true },

  { id: 'options', groupe: 'grpOptions', reglages: true,
    actions: [{ id: 'resetOptions', cle: 'btnOptReset', confirme: 'optReset' }],
    tuiles: (r) => [
      ['sumSettings', fmt.nombre(r.reglages)],
      ['sumChanged',  fmt.nombre(r.modifies), r.modifies ? 'or' : ''],
    ] },

  { id: 'semaine',   groupe: 'grpAgenda', agenda: true,
    actions: [{ id: 'actualiserAgenda', cle: 'btnRefresh' }],
    tuiles: (r) => [
      ['sumLive',       fmt.nombre(r.directs), r.directs ? 'direct' : ''],
      ['sumBroadcasts', fmt.nombre(r.diffusions)],
      ['sumPlanned',    fmt.nombre(r.prevues)],
      ['sumChannels',   fmt.nombre(r.chaines)],
    ] },
  { id: 'horsLigne', groupe: 'grpAgenda', agenda: true,
    actions: [{ id: 'actualiserAgenda', cle: 'btnRefresh' }],
    tuiles: (r) => [
      ['sumOffline',   fmt.nombre(r.horsLigne)],
      ['sumScheduled', fmt.nombre(r.programmees)],
      ['sumLive',      fmt.nombre(r.directs), r.directs ? 'direct' : ''],
    ] },

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

const elt = (nom, classe, texte) => {
  const e = document.createElement(nom);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
};

const badgeDemo = (mod, cle) =>
  elt('span', 'd-badge' + (mod ? ' d-badge--' + mod : ''), T(cle));

const demoCarte = (o) => {
  const carte = div('d-carte' + (o.frais ? ' d-carte--frais' : '')
                              + (o.or ? ' d-carte--or' : '')
                              + (o.costream ? ' d-carte--costream' : ''));

  if (o.costream) {
    const noeud = div('d-noeud');
    noeud.appendChild(elt('span', ''));
    carte.appendChild(noeud);
  }
  carte.appendChild(div('d-avatar'));

  const texte = div('d-carte-texte');
  const nom = div('d-nom');
  nom.appendChild(document.createTextNode(o.nom));
  if (o.jour) nom.appendChild(elt('span', 'd-jour', T('guideDemoJour')));
  texte.append(nom, div('d-cat', o.cat));
  carte.appendChild(texte);

  const droite = div('d-droite');
  const vues = div('d-vues');
  vues.append(elt('span', 'd-point'), document.createTextNode(NOMBRE.format(o.vues)));
  droite.append(vues, div('d-uptime' + (o.fini ? ' d-uptime--fini' : ''),
                          o.fini ? T('guideDemoEnded') : o.duree));
  carte.appendChild(droite);
  return carte;
};

const demoApercu = () => {
  const hote = div('d-apercu');
  const video = div('d-video');

  video.appendChild(elt('span', 'd-live', 'LIVE'));
  hote.append(video, elt('p', 'd-titre', T('guideDemoTitre')));
  const rangee = div('d-badges');
  rangee.append(badgeDemo('switch', 'guideBadgeSwitch'),
                badgeDemo('sub', 'guideBadgeSub'));
  hote.appendChild(rangee);
  return hote;
};

const BADGES_DEMO = [
  ['ccl',      'guideBadgeCcl'],
  ['reprise',  'guideBadgeReprise'],
  ['switch',   'guideBadgeSwitch'],
  ['costream', 'guideBadgeCostream'],
  ['squad',    'guideBadgeSquad'],

  ['muet',     'guideBadgeMuet'],
  ['sub',      'guideBadgeSub'],
  ['exsub',    'guideBadgeExsub'],
  ['sponsor',  'guideBadgeSponsor'],
  ['hype',     'guideBadgeHype'],
  ['discount', 'guideBadgeDiscount'],
  ['',         'guideBadgeAutre'],
  ['subathon', 'guideBadgeSubathon'],
];

const demoBadges = () => {
  const rangee = div('d-badges');
  for (const [mod, cle] of BADGES_DEMO) rangee.appendChild(badgeDemo(mod, cle));
  return rangee;
};

const FRISE_DEMO = [
  { jeu: 'Elden Ring', part: 52, duree: '2h10', teinte: '#9147ff' },
  { jeu: 'Valorant',   part: 26, duree: '1h05', fois: 3, teinte: '#1f69ff' },
  { jeu: 'Minecraft',  part: 22, duree: '~55m', flou: true, teinte: '#00b85a' },
];

const demoFrise = () => {
  const hote = div('d-frise');
  const ruban = div('d-ruban');
  for (const b of FRISE_DEMO) {
    const bande = div('d-bande' + (b.flou ? ' d-bande--flou' : ''));
    bande.style.width = b.part + '%';
    bande.style.background = b.flou
      ? `linear-gradient(90deg, ${b.teinte}, rgba(0, 0, 0, 0))` : b.teinte;
    ruban.appendChild(bande);
  }
  hote.appendChild(ruban);
  for (const b of FRISE_DEMO) {
    const ligne = div('d-frise-ligne');
    const pastille = div('d-puce');
    pastille.style.background = b.teinte;
    ligne.append(pastille,
                 div('d-frise-jeu', b.jeu + (b.fois ? ` ×${b.fois}` : '')),
                 div('d-frise-duree', b.flou ? `${b.duree} · ${T('guideDemoEnCours')}` : b.duree));
    hote.appendChild(ligne);
  }
  return hote;
};

const demoOnglets = () => {
  const hote = div('d-onglets');
  hote.append(elt('span', 'd-onglet', T('guideDemoSuivies')),
              elt('span', 'd-onglet d-onglet--actif', T('grpGlobal')));
  return hote;
};

const carteEtBadge = (carte, mod, cle) => {
  const hote = div('d-pile');
  hote.append(carte, badgeDemo(mod, cle));
  return hote;
};

const GUIDE = [
  { titre: 'guideRoueTitre',     texte: 'guideRoueTexte' },

  { titre: 'guideViteTitre',     texte: 'guideViteTexte', renvoi: 'guideBadgesTitre' },
  { titre: 'guideDureeTitre',    texte: 'guideDureeTexte',
    demo: () => {
      const hote = div('d-pile');
      hote.append(demoCarte({ nom: 'Nyxaria', cat: 'Elden Ring', vues: 1243, duree: '4h19' }),
                  demoCarte({ nom: 'Korbek', cat: 'Minecraft', vues: 318, fini: true }));
      return hote;
    } },
  { titre: 'guideDebutTitre',    texte: 'guideDebutTexte',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Aeltris', cat: 'Elden Ring', vues: 87, duree: '4m', frais: true }),
      'reprise', 'guideBadgeReprise') },
  { titre: 'guideAboTitre',      texte: 'guideAboTexte',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Nyxaria', cat: 'Elden Ring', vues: 1243, duree: '4h19', or: true }),
      'sub', 'guideBadgeSub') },

  { titre: 'guideCostreamTitre', texte: 'guideCostreamTexte', renvoi: 'guideTriTitre',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Korbek', cat: 'Valorant', vues: 962, duree: '1h47', costream: true }),
      'costream', 'guideBadgeCostream') },

  { titre: 'guideSalleTitre',    texte: 'guideSalleTexte' },
  { titre: 'guideSubathonTitre', texte: 'guideSubathonTexte',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Velmoria', cat: 'Minecraft', vues: 4820, duree: '61h04', jour: true }),
      'subathon', 'guideBadgeSubathon') },
  { titre: 'guideHoverTitre',    texte: 'guideHoverTexte',    demo: () => demoApercu() },
  { titre: 'guideBadgesTitre',   texte: 'guideBadgesTexte',   demo: () => demoBadges() },
  { titre: 'guideFriseTitre',    texte: 'guideFriseTexte',    demo: () => demoFrise() },
  { titre: 'guideTriTitre',      texte: 'guideTriTexte' },
  { titre: 'guideTopTitre',      texte: 'guideTopTexte',      demo: () => demoOnglets() },
  { titre: 'guideReglagesTitre', texte: 'guideReglagesTexte' },
  { titre: 'guidePanneauTitre',  texte: 'guidePanneauTexte' },

  { titre: 'guideAgendaTitre',   texte: 'guideAgendaTexte' },
  { titre: 'guideVieTitre',      texte: 'guideVieTexte' },
];

const corpsGuide = (texte) => {
  const out = [];
  let liste = null;
  for (const brut of String(texte).split('\n')) {
    const ligne = brut.trim();
    if (!ligne) continue;
    if (ligne.startsWith('•')) {
      if (!liste) { liste = elt('ul', 'guide-liste'); out.push(liste); }
      liste.appendChild(elt('li', '', ligne.replace(/^•\s*/, '')));
      continue;
    }
    liste = null;
    out.push(elt('p', 'guide-p', ligne));
  }
  return out;
};

const construireGuide = () => {
  const blocs = [elt('p', 'guide-intro', T('guideIntro'))];
  GUIDE.forEach((chapitre, i) => {
    const section = elt('section', 'guide-chapitre');
    const titre = elt('h3', 'guide-titre');
    titre.append(elt('span', 'guide-num', String(i + 1)),
                 document.createTextNode(T(chapitre.titre)));
    section.appendChild(titre);
    if (chapitre.demo) {
      const cadre = div('d-cadre');
      cadre.setAttribute('aria-hidden', 'true');
      cadre.appendChild(chapitre.demo());
      section.appendChild(cadre);
    }

    const vise = chapitre.renvoi
      ? String(GUIDE.findIndex((c) => c.titre === chapitre.renvoi) + 1) : undefined;
    section.append(...corpsGuide(T(chapitre.texte, vise)));
    blocs.push(section);
  });
  return blocs;
};

let ongletP = null;
const idOnglet = () => (ongletP ??= API.tabs
  .query({ active: true, currentWindow: true })
  .then(([t]) => (t ? t.id : undefined))
  .catch(() => undefined));

const EN_CADRE = document.documentElement.getAttribute('data-vue') === 'incruste';
const INCRUSTE_REQ = 'tse-incruste-req';
const INCRUSTE_RES = 'tse-incruste-res';

const EXPIRATION_CADRE = 30_000;
let suivantCadre = 0;
const attentesCadre = new Map();

window.addEventListener('message', (e) => {

  if (e.source !== window.parent) return;
  const d = e.data;
  if (!d || d.tse !== INCRUSTE_RES || typeof d.id !== 'number') return;
  const attente = attentesCadre.get(d.id);
  if (!attente) return;
  attentesCadre.delete(d.id);
  clearTimeout(attente.minuteur);

  const { tse: _t, id: _i, ...reponse } = d;
  attente.resoudre(reponse);
});

const demanderCadre = (charge) => new Promise((resoudre) => {
  const id = ++suivantCadre;
  const minuteur = setTimeout(() => {
    attentesCadre.delete(id);
    resoudre({ ok: false, erreur: 'expiration-page',
               detail: 'la page n\'a pas répondu' });
  }, EXPIRATION_CADRE);
  attentesCadre.set(id, { resoudre, minuteur });

  try { window.parent.postMessage({ tse: INCRUSTE_REQ, id, ...charge }, '*'); }
  catch {
    clearTimeout(minuteur);
    attentesCadre.delete(id);
    resoudre({ ok: false, erreur: 'absent', detail: 'parent inatteignable' });
  }
});

const ATTENTES = [250, 750, 1800];

const etatFond = () => API.runtime.sendMessage({ type: 'tse-panneau-etat' })
  .catch((e) => ({ ok: false, erreur: 'fond', detail: String((e && e.message) || e) }));

const demander = async (charge, essai = 0, trace = []) => {
  const t0 = Date.now();

  if (EN_CADRE) {
    const r = await demanderCadre(charge);
    trace.push({ essai, ms: Date.now() - t0, voie: 'cadre',
                 erreur: r && r.ok ? 'ok' : ((r && r.erreur) || 'vide'),
                 detail: r && r.detail });

    if (r && r.erreur === 'demarrage' && essai < ATTENTES.length) {
      await new Promise((res) => setTimeout(res, ATTENTES[essai]));
      return demander(charge, essai + 1, trace);
    }
    return { ...(r || { ok: false, erreur: 'absent' }), trace };
  }
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

try {
  const relayer = (commande) => async (...args) => {
    const r = await demander({ action: 'salle', arg: { commande, args: args.slice(0, 3) } });
    const resultat = r && r.ok ? r.data : { erreur: (r && r.erreur) || 'absent' };
    console.info(`[tse] ${commande} →`, resultat);
    return resultat;
  };
  Object.defineProperty(window, 'tse', {
    value: Object.freeze({ salle: Object.freeze(Object.fromEntries(
      ['auto', 'recul', 'avance', 'ecoute', 'rapport'].map((c) => [c, relayer(c)]))) }),
    writable: false, configurable: false,
  });
} catch {   }

const $ = (id) => document.getElementById(id);
let courante = SECTIONS[0].id;

const montrerMessage = (cle, bouton, detail) => {
  $('tableau-cadre').hidden = true;

  $('agenda').hidden = true;

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

const GROUPES_OPT = [
  ['optGrpApercu',  ['apercu', 'apercuVideo', 'apercuQualite', 'apercuTaille']],

  ['optGrpMultistream', ['salle', 'salleAuto']],
  ['optGrpBadges',  ['badges']],
  ['optGrpCarte',   ['duree', 'dureeFormat', 'fresh', 'abonnes', 'subathonJour']],
  ['optGrpListe',   ['tris', 'filtreCategorie', 'filtreLangue', 'topOnglet', 'topN']],
  ['optGrpTwitch',  ['stories', 'serie']],
  ['optGrpAbos',    ['abosPeriode']],
  ['optGrpTheme',   ['theme']],
];

const LIBELLE_MEMBRE = {
  ccl: 'guideBadgeCcl',         costream: 'guideBadgeCostream',
  squad: 'guideBadgeSquad',     sub: 'guideBadgeSub',
  exsub: 'guideBadgeExsub',     sponsor: 'guideBadgeSponsor',
  hype: 'guideBadgeHype',       discount: 'guideBadgeDiscount',
  switch: 'guideBadgeSwitch',   reprise: 'guideBadgeReprise',
  subathon: 'guideBadgeSubathon',
  viewers: 'optTriViewers',     subs: 'optTriSubs',
  popular: 'optTriPopular',     uptime: 'optTriUptime',
  alpha: 'optTriAlpha',         costream_tri: 'optTriCostream',
};

const libelleMembre = (jeu, m) =>
  T(LIBELLE_MEMBRE[jeu === 'tris' && m === 'costream' ? 'costream_tri' : m] || m);

const MOTS_VALEUR = {
  plein: 'optValPlein',   discret: 'optValDiscret', aucun: 'optValAucun',
  petit: 'optValPetit',   normal: 'optValNormal',   grand: 'optValGrand',
  auto: 'optValAuto',     dark: 'optValDark',       light: 'optValLight',
  twitch: 'optValTwitch', integree: 'optValIntegree', masquee: 'optValMasquee',
};
const EXEMPLES_DUREE = { hm: '4h19', colon: '4:19', min: '259 min' };

const libelleValeur = (id, v) => {
  if (id === 'dureeFormat') return EXEMPLES_DUREE[v] || String(v);
  if (id === 'abosPeriode') return T('optHeures', String(v));
  if (MOTS_VALEUR[v]) return T(MOTS_VALEUR[v]);
  return String(v);
};

const DIAG_CLE = 'tse:diag';
const lireLocal = (cle, defaut) => {
  try { const v = localStorage.getItem(cle); return v === null ? defaut : v; }
  catch { return defaut; }
};
const ecrireLocal = (cle, v) => {
  try { localStorage.setItem(cle, v); } catch {   }
};

const diagVisible = () => lireLocal(DIAG_CLE, 'non') === 'oui';
const themePanneau = () => lireLocal(THEME_CLE, 'auto');

const interrupteur = (coche, surChangement) => {
  const l = elt('label', 'reg-bascule');
  const i = document.createElement('input');
  i.type = 'checkbox';
  i.checked = coche;
  i.addEventListener('change', () => surChangement(i.checked));
  const piste = elt('span', 'reg-piste');
  l.append(i, piste);
  return l;
};

const menu = (valeurs, courante, libelle, surChangement) => {
  const sel = document.createElement('select');
  sel.className = 'reg-menu';
  for (const v of valeurs) {
    const o = document.createElement('option');

    o.value = String(v);
    o.textContent = libelle(v);
    o.selected = String(courante) === String(v);
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    surChangement(valeurs.find((v) => String(v) === sel.value));
  });
  return sel;
};

const cases = (jeu, membres, actifs, surChangement) => {
  const hote = div('reg-cases');
  for (const m of membres) {
    const l = elt('label', 'reg-case');
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = actifs.includes(m);
    i.addEventListener('change', () => {
      const suivant = membres.filter((x) => (x === m ? i.checked : actifs.includes(x)));
      surChangement(suivant);
    });
    l.append(i, elt('span', 'reg-case-nom', libelleMembre(jeu, m)));
    hote.appendChild(l);
  }
  return hote;
};

let etatOpt = null;

const poserOption = async (id, valeur) => {
  const r = await demander({ action: 'setOption', arg: { id, valeur } });
  if (!r.ok) { montrerEchec(r); return; }
  etatOpt = r.data;
  peindreReglages();
};

const ligneReglage = (id) => {
  const d = etatOpt.defs[id];
  if (!d) return null;
  const v = etatOpt.valeurs[id];
  const ligne = div('reg-ligne' + (etatOpt.modifies.includes(id) ? ' reg-ligne--modifie' : ''));
  const texte = div('reg-texte');
  texte.appendChild(elt('span', 'reg-nom', T('opt' + MAJ(id))));
  const desc = T('optDesc' + MAJ(id));

  if (desc !== 'optDesc' + MAJ(id)) texte.appendChild(elt('span', 'reg-desc', desc));
  ligne.appendChild(texte);

  const ctrl = div('reg-ctrl');
  if (d.type === 'bool') {
    ctrl.appendChild(interrupteur(v, (b) => poserOption(id, b)));
  } else if (d.type === 'choix') {
    ctrl.appendChild(menu(d.valeurs, v, (x) => libelleValeur(id, x), (x) => poserOption(id, x)));
  } else if (d.type === 'jeu') {

    const actifs = d.valeurs.filter((m) => !v.includes(m));
    ligne.classList.add('reg-ligne--large');
    ctrl.appendChild(cases(id, d.valeurs, actifs,
      (gardes) => poserOption(id, d.valeurs.filter((m) => !gardes.includes(m)))));
  }
  ligne.appendChild(ctrl);
  return ligne;
};

const groupeLocal = () => {
  const sec = elt('section', 'reg-groupe');
  sec.dataset.grp = 'panneau';
  sec.appendChild(elt('h3', 'reg-titre', T('optGrpPanneau')));

  const ligneTheme = div('reg-ligne');
  const tt = div('reg-texte');
  tt.appendChild(elt('span', 'reg-nom', T('optPanneauTheme')));
  tt.appendChild(elt('span', 'reg-desc', T('optDescPanneauTheme')));
  ligneTheme.appendChild(tt);
  const ct = div('reg-ctrl');
  ct.appendChild(menu(['auto', 'dark', 'light'], themePanneau(),
    (v) => libelleValeur('theme', v),
    (v) => {
      if (v === 'auto') {
        document.documentElement.removeAttribute('data-theme');
        try { localStorage.removeItem(THEME_CLE); } catch {   }
      } else { appliquerThemePanneau(v); }
    }));
  ligneTheme.appendChild(ct);
  sec.appendChild(ligneTheme);

  const ligneDiag = div('reg-ligne');
  const td = div('reg-texte');
  td.appendChild(elt('span', 'reg-nom', T('optPanneauDiag')));
  td.appendChild(elt('span', 'reg-desc', T('optDescPanneauDiag')));
  ligneDiag.appendChild(td);
  const cd = div('reg-ctrl');
  cd.appendChild(interrupteur(diagVisible(), (b) => {
    ecrireLocal(DIAG_CLE, b ? 'oui' : 'non');
    appliquerDiag();
  }));
  ligneDiag.appendChild(cd);
  sec.appendChild(ligneDiag);
  return sec;
};

const groupeEchange = () => {
  const sec = elt('section', 'reg-groupe');
  sec.dataset.grp = 'echange';
  sec.appendChild(elt('h3', 'reg-titre', T('optGrpEchange')));
  const zone = document.createElement('textarea');
  zone.className = 'reg-zone';
  zone.spellcheck = false;
  zone.setAttribute('aria-label', T('optGrpEchange'));
  const pied = div('reg-boutons');

  const bExp = elt('button', 'bouton bouton--fantome', T('btnOptExport'));
  bExp.type = 'button';
  bExp.addEventListener('click', () => {

    const ecarts = {};
    for (const id of etatOpt.modifies) ecarts[id] = etatOpt.valeurs[id];
    zone.value = JSON.stringify(ecarts, null, 2);
    zone.focus(); zone.select();
  });

  const bImp = elt('button', 'bouton', T('btnOptImport'));
  bImp.type = 'button';
  bImp.addEventListener('click', async () => {
    let objet = null;
    try { objet = JSON.parse(zone.value || 'null'); }
    catch { noterReglage(T('optImportInvalide'), true); return; }
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) {
      noterReglage(T('optImportInvalide'), true); return;
    }
    const r = await demander({ action: 'importOptions', arg: { valeurs: objet } });
    if (!r.ok) { montrerEchec(r); return; }
    etatOpt = r.data;
    peindreReglages();
    noterReglage(T('optImportFait', [String(r.data.pris), String(r.data.refuses)]),
                 r.data.refuses > 0);
  });

  pied.append(bExp, bImp);
  const note = elt('p', 'reg-note', '');
  note.hidden = true;
  sec.append(zone, pied, note);
  return sec;
};

let noteMinuteur = null;
const noterReglage = (texte, erreur) => {
  const n = document.querySelector('#reglages .reg-note');
  if (!n) return;
  n.textContent = texte;
  n.className = 'reg-note' + (erreur ? ' reg-note--erreur' : '');
  n.hidden = false;
  clearTimeout(noteMinuteur);
  noteMinuteur = setTimeout(() => { n.hidden = true; }, 6000);
};

const PURGES = [
  ['visites', 'btnPurgeVisits',  'purgeVisitsTitle', 'purgeVisitsText'],
  ['subs',    'btnPurgeSubs',    'purgeSubsTitle',   'purgeSubsText'],
  ['roster',  'btnPurgeRoster',  'purgeRosterTitle', 'purgeRosterText'],
];
const groupePurges = () => {
  const sec = elt('section', 'reg-groupe');
  sec.dataset.grp = 'purges';
  sec.appendChild(elt('h3', 'reg-titre', T('optGrpPurge')));
  sec.appendChild(elt('p', 'reg-desc', T('optDescPurge')));
  const rangee = div('reg-boutons');
  for (const [quoi, cle, titre, texte] of PURGES) {
    const b = elt('button', 'bouton bouton--danger', T(cle));
    b.type = 'button';
    b.addEventListener('click', () => confirmer(titre, texte, async () => {
      b.disabled = true;
      const r = await demander({ action: 'purge', arg: { quoi } });
      b.disabled = false;
      if (!r.ok) { montrerEchec(r); return; }
      noterReglage(T('optPurgeFaite'), false);
    }));
    rangee.appendChild(b);
  }
  sec.appendChild(rangee);
  return sec;
};

const peindreReglages = () => {
  const hote = $('reglages');

  const avant = document.activeElement;
  const repere = avant && avant.closest && avant.closest('[data-reg]')
    ? avant.closest('[data-reg]').dataset.reg : null;

  const blocs = [];
  for (const [titre, ids] of GROUPES_OPT) {
    const sec = elt('section', 'reg-groupe');
    sec.appendChild(elt('h3', 'reg-titre', T(titre)));
    let posees = 0;
    for (const id of ids) {
      const l = ligneReglage(id);
      if (!l) continue;
      l.dataset.reg = id;
      sec.appendChild(l); posees++;
    }
    if (posees) blocs.push(sec);
  }
  blocs.push(groupeLocal(), groupePurges(), groupeEchange());
  hote.replaceChildren(...blocs);
  hote.hidden = false;

  const section = SECTIONS.find((x) => x.id === 'options');
  $('resume').replaceChildren(
    ...(section && section.tuiles ? section.tuiles(etatOpt.resume) : []).map((t) => tuile(t)));

  if (repere) {
    const cible = hote.querySelector(`[data-reg="${CSS.escape(repere)}"] input, `
                                   + `[data-reg="${CSS.escape(repere)}"] select`);
    if (cible) cible.focus();
  }
};

const montrerReglages = (paquet) => {
  $('message').hidden = true;
  $('visuel').hidden = true;
  $('visuel').replaceChildren();
  $('tableau-cadre').hidden = true;
  etatOpt = paquet;
  peindreReglages();
  $('reglages').scrollTop = 0;
};

const appliquerDiag = () => {
  document.documentElement.toggleAttribute('data-sans-diag', !diagVisible());
};

const montrerGuide = () => {
  $('message').hidden = true;
  $('resume').replaceChildren();
  $('visuel').hidden = true;
  $('visuel').replaceChildren();
  $('tableau-cadre').hidden = true;
  const g = $('guide');
  g.replaceChildren(...construireGuide());
  g.hidden = false;
  g.scrollTop = 0;
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

const tuile = ([cle, val, ton]) => {
  const d = document.createElement('div');
  d.className = 'tuile' + (ton ? ' tuile--' + ton : '');
  const v = document.createElement('div'); v.className = 'tuile-val'; v.textContent = val;
  const k = document.createElement('div'); k.className = 'tuile-cle'; k.textContent = T(cle);
  d.append(v, k);
  return d;
};

const peindre = (section, paquet) => {
  const { colonnes = [], lignes = [], resume = {} } = paquet || {};

  const tuiles = section.tuiles ? section.tuiles(resume) : [];
  $('resume').replaceChildren(...tuiles.map((t) => tuile(t)));

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

  clearTimeout(etatAgenda.minuteur);
  const section = SECTIONS.find((s) => s.id === id);

  $('guide').hidden = true;
  $('reglages').hidden = true;
  $('agenda').hidden = true;
  for (const b of document.querySelectorAll('.rail-item')) {
    b.setAttribute('aria-current', String(b.dataset.id === id));
  }
  $('vue-titre').textContent = T(cleNav(id));
  $('vue-desc').textContent  = T(cleDesc(id));

  $('vue-actions').replaceChildren(...(section.actions || []).map((a) => {
    const b = document.createElement('button');
    b.className = 'bouton bouton--fantome';
    b.textContent = T(a.cle);

    b.addEventListener('click', () => (a.confirme
      ? confirmer(a.confirme + 'Title', a.confirme + 'Text', () => lancer(a.id, b))
      : lancer(a.id, b)));
    return b;
  }));

  if (section.statique) { montrerGuide(); return; }

  if (section.agenda) { await chargerAgenda(section); return; }

  montrerMessage('stateLoading');
  const r = await demander({ section: id });
  if (courante !== id) return;
  if (!r.ok) { montrerEchec(r); return; }

  if (section.reglages) { montrerReglages(r.data); return; }
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

  const section = SECTIONS.find((s) => s.id === courante);
  if (section && section.agenda) { relireAgenda(); return; }
  await charger(courante);
};

const AGENDA_PASSE = 8;
const AGENDA_FUTUR = 2;
const RELECTURE_AGENDA = 1000;

const etatAgenda = { decalage: 0, chaine: null, minuteur: null, jeton: 0,
                     cible: 'auj', defileAuto: 0, noeuds: new Map(), signature: null,
                     charpente: null, menu: { chaines: [], chaine: null } };
const CIBLE_LIEN = EN_CADRE ? '_top' : '_blank';

const HEURE = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const JOUR_TITRE = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const JOUR_ABREGE = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const DATE_PLAGE = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_COMPLETE = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'full', timeStyle: 'short' });
const COMPACT = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
const PLURIEL = new Intl.PluralRules(LOCALE);
const RELATIF = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const ORDRE_NOMS = new Intl.Collator(LOCALE, { sensitivity: 'base' });

const PREMIER_DU_MOIS = /^fr(?:-|$)/i.test(LOCALE) ? '1er' : null;
const jourEcrit = (p) => (PREMIER_DU_MOIS && p.type === 'day' && p.value === '1' ? PREMIER_DU_MOIS : p.value);
const dater = (format, t) => format.formatToParts(t).map(jourEcrit).join('');
const daterPlage = (format, a, b) => format.formatRangeToParts(a, b).map(jourEcrit).join('');

const VUES = { one: 'valViewsOne', few: 'valViewsFew', many: 'valViewsMany', other: 'valViewsOther' };
const vuesTexte = (n) => {
  if (!Number.isFinite(n)) return '';
  return T(VUES[PLURIEL.select(n >= 1000 ? 5000 : n)] || VUES.other, COMPACT.format(n));
};

const dureeHms = (s) => {
  if (!Number.isFinite(s) || s < 0) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const minuitDe = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

const ilYa = (t, maintenant) => {
  const ecart = maintenant - t;
  if (ecart < 3_600_000) return RELATIF.format(-Math.max(1, Math.round(ecart / 60_000)), 'minute');
  if (ecart < 86_400_000) return RELATIF.format(-Math.round(ecart / 3_600_000), 'hour');
  const jours = Math.max(1, Math.round((minuitDe(maintenant) - minuitDe(t)) / 86_400_000));
  if (jours < 7) return RELATIF.format(-jours, 'day');
  if (jours < 35) return RELATIF.format(-Math.round(jours / 7), 'week');
  return RELATIF.format(-Math.round(jours / 30), 'month');
};

const bornesSemaine = (decalage) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - PREMIER_JOUR + 7) % 7) + 7 * decalage);
  const f = new Date(d);
  f.setDate(f.getDate() + 7);
  return { debut: d.getTime(), fin: f.getTime() };
};
const jourDe = (debut, i) => { const d = new Date(debut); d.setDate(d.getDate() + i); return d.getTime(); };

const decalageDe = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - PREMIER_JOUR + 7) % 7));
  return Math.round((d.getTime() - bornesSemaine(0).debut) / 604_800_000);
};
const plageSemaine = (debut, fin) => {
  const dernier = new Date(fin);
  dernier.setDate(dernier.getDate() - 1);
  try { return daterPlage(DATE_PLAGE, new Date(debut), dernier); }
  catch { return `${dater(DATE_PLAGE, debut)} – ${dater(DATE_PLAGE, dernier)}`; }
};
const argAgenda = (id) => (id === 'semaine'
  ? { ...bornesSemaine(etatAgenda.decalage), chaine: etatAgenda.chaine }
  : {});

const RE_LOGIN_PANNEAU = /^[a-z0-9_]{1,25}$/;
const lienAgenda = (e) => {
  if (!RE_LOGIN_PANNEAU.test(e.login || '')) return null;
  if (e.type === 'rediffusion') return /^\d+$/.test(e.id || '') ? `https://www.twitch.tv/videos/${e.id}` : null;
  if (e.type === 'direct') return `https://www.twitch.tv/${e.login}`;
  if (e.type === 'prevu') return `https://www.twitch.tv/${e.login}/schedule`;
  return null;
};
const poserLien = (a, href, ongletNeuf = false) => {
  a.href = href;
  a.target = ongletNeuf ? '_blank' : CIBLE_LIEN;
  if (a.target === '_blank') a.rel = 'noopener noreferrer';
};

const HOTE_IMAGE = /(?:^|\.)(?:jtvnw\.net|twitch\.tv)$/;
const imageAgenda = (src, classe) => {
  if (typeof src !== 'string' || !/^https:\/\//.test(src)) return null;
  let hote = '';
  try { hote = new URL(src).hostname; } catch { return null; }
  if (!HOTE_IMAGE.test(hote)) return null;
  const img = document.createElement('img');
  img.className = classe;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => img.remove(), { once: true });
  img.src = src;
  return img;
};

const fermee = (v, abonne) => !!(v && v.restreinte) && abonne !== true;
const pastilleAbonnes = () => {
  const p = elt('span', 'ag-abo');
  p.setAttribute('role', 'img');
  p.setAttribute('aria-label', T('valSubOnly'));
  p.title = T('valSubOnlyLocked');
  const svg = svgEl('svg', { class: 'ag-cadenas', viewBox: '0 0 12 12', 'aria-hidden': 'true' });
  svg.append(
    svgEl('path', { d: 'M3.5 5.5V3.75a2.5 2.5 0 0 1 5 0V5.5',
                    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    svgEl('rect', { x: 2, y: 5.5, width: 8, height: 5.5, rx: 1.2, fill: 'currentColor' }));
  p.appendChild(svg);
  return p;
};

const MARQUE = { direct: 'valLive', prevu: 'valPlanned', sansRediffusion: 'valNoReplay' };
const plageHoraire = (e) => {
  const de = HEURE.format(e.debut);
  if (e.type === 'direct') return `${de} – ${T('valOngoing')}`;
  return e.fin > e.debut ? `${de} – ${HEURE.format(e.fin)}` : de;
};

const entreeAgenda = (e, nom) => {
  const lien = lienAgenda(e);
  const el = document.createElement(lien ? 'a' : 'div');
  el.className = 'ag-ent ag-ent--' + e.type;
  if (lien) poserLien(el, lien, e.type === 'rediffusion');
  const vig = div('ag-vig');
  if (e.type === 'rediffusion') {
    const img = imageAgenda(e.vignette, 'ag-img');
    if (img) vig.appendChild(img);
    if (Number.isFinite(e.duree)) vig.appendChild(elt('span', 'ag-duree', dureeHms(e.duree)));
  } else {
    vig.appendChild(elt('span', 'ag-marque ag-marque--' + e.type, T(MARQUE[e.type] || 'valPlanned')));
  }
  const l1 = div('ag-l1');
  l1.appendChild(elt('span', 'ag-nom', nom));
  if (e.libelle) l1.appendChild(elt('span', 'ag-jeu', e.libelle));
  l1.appendChild(elt('span', 'ag-heure', plageHoraire(e)));
  const l2 = div('ag-l2');
  l2.appendChild(elt('span', 'ag-titre', e.titre || '—'));
  if (e.type === 'rediffusion' && fermee(e, e.abonne)) l2.appendChild(pastilleAbonnes());
  if (e.type === 'rediffusion' && Number.isFinite(e.vues)) {
    l2.appendChild(elt('span', 'ag-meta', vuesTexte(e.vues)));
  } else if (e.type === 'direct' && Number.isFinite(e.spectateurs)) {
    const m = elt('span', 'ag-meta');
    m.append(elt('span', 'ag-point'), document.createTextNode(COMPACT.format(e.spectateurs)));
    l2.appendChild(m);
  }
  const corps = div('ag-corps');
  corps.append(l1, l2);
  el.append(vig, corps);
  el.title = [e.titre, dater(DATE_COMPLETE, e.debut)].filter(Boolean).join('\n');
  return el;
};

const noeud = (suivant, cle, sig, faire) => {
  if (suivant.has(cle)) return faire();
  const ancien = etatAgenda.noeuds.get(cle);
  const n = ancien && ancien.sig === sig ? ancien : { sig, el: faire() };
  n.el.dataset.ancre = cle;
  suivant.set(cle, n);
  return n.el;
};

const noteAgenda = (texte, ton) => elt('p', 'ag-note' + (ton ? ' ag-note--' + ton : ''), texte);

const notesAgenda = (data) => {
  const out = [];
  const n = data.notes || {};
  const p = data.progression || {};

  if (data.enCours && p.lues < p.aLire) {
    out.push({ cle: 'lecture', ton: 'charge', texte: T('stateAgendaLoading', [fmt.nombre(p.lues), fmt.nombre(p.aLire)]),
               part: p.aLire ? Math.round((100 * p.lues) / p.aLire) : 0 });
  } else if (data.enCours && p.aCouvrir > 0) {
    out.push({ cle: 'rediffusions', ton: 'charge', texte: T('stateAgendaLoadingReplays', fmt.nombre(p.aCouvrir)) });
  }

  if (n.releve) out.push({ cle: 'releve', ton: 'charge', texte: T('stateAgendaFollowSweep') });
  if (n.limite) out.push({ cle: 'limite', texte: T('stateAgendaCapped', [fmt.nombre(n.limite.retenues), fmt.nombre(n.limite.total)]) });

  if (n.incompletes && data.vue === 'semaine') {
    out.push({ cle: 'incompletes', texte: T('stateAgendaIncomplete', fmt.nombre(n.incompletes)) });
  }
  if (n.planning === 'indisponible') out.push({ cle: 'planning', texte: T('stateAgendaNoSchedule') });

  if (n.refus === 'diffusions' && data.vue === 'semaine') out.push({ cle: 'refus', ton: 'alerte', texte: T('stateAgendaNoReplays') });
  if (n.echouees) out.push({ cle: 'echouees', ton: 'alerte', texte: T('stateAgendaPartial', fmt.nombre(n.echouees)) });
  if (n.reseau) out.push({ cle: 'reseau', ton: 'alerte', texte: T('stateAgendaNetwork') });
  return out;
};

const poserNotes = (conteneur, data) => {
  const avant = new Map([...conteneur.children].map((el) => [el.dataset.cle, el]));
  const notes = notesAgenda(data);
  conteneur.replaceChildren(...notes.map((n) => {
    let el = avant.get(n.cle);
    if (!el) {
      el = noteAgenda('', n.ton);
      el.dataset.cle = n.cle;
      el.appendChild(elt('span', 'ag-note-texte'));
      if (n.part !== undefined) {
        const barre = div('ag-prog');
        barre.appendChild(div('ag-prog-rempli'));
        el.appendChild(barre);
      }
    }
    el.firstChild.textContent = n.texte;
    if (n.part !== undefined) el.querySelector('.ag-prog-rempli').style.width = n.part + '%';
    return el;
  }));
  conteneur.hidden = !notes.length;
};

const boutonAgenda = (texte, surClic, inactif, etiquette, classe = '') => {
  const b = elt('button', 'bouton bouton--fantome' + classe, texte);
  b.type = 'button';
  b.disabled = !!inactif;
  if (etiquette) { b.setAttribute('aria-label', etiquette); b.title = etiquette; }
  b.addEventListener('click', surClic);
  return b;
};
const relireAgenda = () => {
  const section = SECTIONS.find((s) => s.id === courante);
  if (section && section.agenda) chargerAgenda(section, true);
};

const allerSemaine = (d) => {
  etatAgenda.decalage = Math.max(-AGENDA_PASSE, Math.min(AGENDA_FUTUR, d));
  etatAgenda.cible = 'auj';
  relireAgenda();
};

const entrerAgenda = (id) => {
  if (id === 'semaine') { etatAgenda.decalage = 0; etatAgenda.chaine = null; }
  etatAgenda.cible = id === 'semaine' ? 'auj' : 'haut';
};

const remplirMenu = (b, quitte = false) => {
  const { chaines, chaine } = etatAgenda.menu;
  const liste = chaines.slice().sort((x, y) => ORDRE_NOMS.compare(x.nom, y.nom));

  if (chaine && !liste.some((c) => c.login === chaine)) liste.unshift({ login: chaine, nom: chaine });
  const sig = liste.map((c) => `${c.login}\u0001${c.nom}`).join('\u0002');
  if (sig !== b.sig) {
    if (!quitte && document.activeElement === b.menu) return;
    const tout = document.createElement('option');
    tout.value = '';
    tout.textContent = T('valAllChannels');
    b.menu.replaceChildren(tout, ...liste.map((c) => {
      const o = document.createElement('option');
      o.value = c.login;
      o.textContent = c.nom;
      return o;
    }));
    b.sig = sig;
  }
  b.menu.value = chaine || '';
};
const barreSemaine = () => {
  const b = { sig: null };
  b.auj = boutonAgenda(T('btnToday'), () => allerSemaine(0));
  b.prec = boutonAgenda('‹', () => allerSemaine(etatAgenda.decalage - 1), false, T('btnWeekPrev'), ' ag-fleche');
  b.suiv = boutonAgenda('›', () => allerSemaine(etatAgenda.decalage + 1), false, T('btnWeekNext'), ' ag-fleche');
  b.plage = elt('span', 'ag-plage');
  b.menu = document.createElement('select');
  b.menu.className = 'reg-menu ag-chaine';
  b.menu.setAttribute('aria-label', T('valChannel'));

  b.menu.addEventListener('change', () => {
    etatAgenda.chaine = b.menu.value || null;
    etatAgenda.cible = 'auj';
    relireAgenda();
  });
  b.menu.addEventListener('blur', () => remplirMenu(b, true));
  b.el = div('ag-barre');
  b.el.append(b.auj, b.prec, b.suiv, b.plage, b.menu);
  return b;
};
const majBarre = (b, data) => {
  b.plage.textContent = plageSemaine(data.semaine.debut, data.semaine.fin);
  b.prec.disabled = etatAgenda.decalage <= -AGENDA_PASSE;
  b.suiv.disabled = etatAgenda.decalage >= AGENDA_FUTUR;
  etatAgenda.menu = { chaines: data.chaines || [], chaine: data.chaine || null };
  remplirMenu(b);
};

const charpente = (vue) => {
  const c = etatAgenda.charpente;
  if (c && c.vue === vue) return c;
  const tete = div('ag-tete');
  const barre = vue === 'semaine' ? barreSemaine() : null;
  const notes = div('ag-notes');
  notes.hidden = true;
  if (barre) tete.appendChild(barre.el);
  tete.appendChild(notes);
  const liste = div('ag-liste');
  $('agenda').replaceChildren(tete, liste);
  etatAgenda.noeuds = new Map();
  etatAgenda.signature = null;
  etatAgenda.charpente = { vue, tete, barre, notes, liste };
  return etatAgenda.charpente;
};

const listeSemaine = (data, suivant) => {
  const { debut, fin } = data.semaine;
  const entrees = data.entrees || [];
  if (!entrees.length) {
    return data.enCours ? [] : [noteAgenda(T(data.chaine ? 'stateAgendaEmptyChannel' : 'stateAgendaEmpty'))];
  }
  const noms = new Map((data.chaines || []).map((c) => [c.login, c.nom]));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const jour = jourDe(debut, i);
    const finJour = i < 6 ? jourDe(debut, i + 1) : fin;
    const section = elt('section', 'ag-jour');
    section.dataset.jour = String(jour);
    section.dataset.fin = String(finJour);
    const titre = elt('h3', 'ag-jour-titre', dater(JOUR_TITRE, jour));
    titre.dataset.ancre = 'j:' + jour;
    if (data.maintenant >= jour && data.maintenant < finJour) {
      section.classList.add('ag-jour--auj');
      titre.appendChild(elt('span', 'ag-auj', T('btnToday')));
    }
    section.appendChild(titre);
    const du = entrees.filter((e) => e.debut >= jour && e.debut < finJour);
    if (!du.length) section.appendChild(elt('p', 'ag-vide', '—'));
    for (const e of du) {
      const nom = noms.get(e.login) || e.login;
      section.appendChild(noeud(suivant, `e:${e.type}:${e.login}:${e.id || ''}:${e.debut}`,
                                JSON.stringify(e) + nom, () => entreeAgenda(e, nom)));
    }
    out.push(section);
  }
  return out;
};

const voirSemaineDe = (l) => {
  const t = l.dernier ? (l.dernier.debut ?? l.dernier.t) : null;
  etatAgenda.chaine = l.login;
  etatAgenda.decalage = t === null ? 0 : Math.max(-AGENDA_PASSE, Math.min(0, decalageDe(t)));
  etatAgenda.cible = t === null ? 'auj' : t;
  charger('semaine');
};

const ligneHorsLigne = (l, quand) => {
  const ligne = div('hl-ligne' + (l.indisponible ? ' hl-ligne--indisponible' : ''));
  const avatar = imageAgenda(l.avatar, 'hl-avatar') || div('hl-avatar');
  const corps = div('hl-corps');
  const l1 = div('hl-l1');
  l1.appendChild(elt('span', 'hl-nom', l.nom));
  const q = elt('span', 'hl-quand', quand);
  if (l.indisponible) {
    q.title = T('valUnavailableTip', dater(DATE_COMPLETE, l.indisponible));
    l1.appendChild(q);
    corps.appendChild(l1);
    ligne.append(avatar, corps);
    return ligne;
  }

  if (l.dernier) {
    q.title = l.dernier.debut !== null
      ? `${dater(DATE_COMPLETE, l.dernier.debut)} – ${HEURE.format(l.dernier.t)}`
      : `– ${dater(DATE_COMPLETE, l.dernier.t)}`;
  }
  l1.appendChild(q);
  corps.appendChild(l1);
  const revoir = !!(l.dernier && l.dernier.revoir && l.derniere);

  const enEntier = (classe, texte) => { const e = elt('div', classe, texte); e.title = texte; return e; };
  const sous = [l.titre, revoir ? l.derniere.libelle : null].filter(Boolean).join(' · ');
  if (sous) corps.appendChild(enEntier('hl-titre', sous));
  if (l.prochain) {
    const quandProchain = `${dater(JOUR_ABREGE, l.prochain.debut)}, ${HEURE.format(l.prochain.debut)}`;
    corps.appendChild(enEntier('hl-prochain',
      T('valNext', quandProchain + (l.prochain.titre ? ` — ${l.prochain.titre}` : ''))));
  }
  const actions = div('hl-actions');
  if (revoir && /^\d+$/.test(l.derniere.id || '')) {
    if (fermee(l.derniere, l.abonne)) actions.appendChild(pastilleAbonnes());
    const a = elt('a', 'bouton bouton--fantome', T('btnReplay'));
    poserLien(a, `https://www.twitch.tv/videos/${l.derniere.id}`, true);
    a.title = [l.derniere.titre, dureeHms(l.derniere.duree)].filter(Boolean).join(' · ');
    actions.appendChild(a);
  }
  actions.appendChild(boutonAgenda(T('btnSeeWeek'), () => voirSemaineDe(l)));
  ligne.append(avatar, corps, actions);
  return ligne;
};
const listeHorsLigne = (data, suivant) => {
  const lignes = data.lignes || [];
  if (!lignes.length) {
    return data.enCours ? []
      : [noteAgenda(T(data.resume && data.resume.directs ? 'stateAgendaNoOffline' : 'stateEmpty'))];
  }
  const liste = div('hl-liste');
  const groupe = (l) => (l.indisponible ? 2 : l.prochain ? 0 : 1);
  let avant = null;
  for (const l of lignes) {

    const quand = l.indisponible ? T('valUnavailable')
      : l.dernier ? T('valLastLive', ilYa(l.dernier.t, data.maintenant)) : T('valLastLiveUnknown');
    const el = noeud(suivant, 'l:' + l.login, JSON.stringify(l) + quand, () => ligneHorsLigne(l, quand));
    el.classList.toggle('hl-ligne--suite', !!(avant && groupe(avant) !== groupe(l)));
    liste.appendChild(el);
    avant = l;
  }
  return [liste];
};

const reperer = (hote, tete) => {
  const bas = tete.getBoundingClientRect().bottom;
  for (const el of hote.querySelectorAll('[data-ancre]')) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= bas) continue;
    const jour = el.closest('[data-jour]');
    return { cle: el.dataset.ancre, ecart: r.top - bas,
             jour: jour ? jour.dataset.jour : null, ecartJour: jour ? jour.getBoundingClientRect().top - bas : 0 };
  }
  return null;
};
const retablir = (hote, tete, rep) => {
  const parValeur = (attr, v) => [...hote.querySelectorAll(`[${attr}]`)].find((x) => x.getAttribute(attr) === v);
  const el = parValeur('data-ancre', rep.cle);
  const jour = el || !rep.jour ? null : parValeur('data-jour', rep.jour);
  if (!el && !jour) return;
  hote.scrollTop += (el || jour).getBoundingClientRect().top - tete.getBoundingClientRect().bottom
    - (el ? rep.ecart : rep.ecartJour);
};

const viser = (hote, tete, cible) => {
  const jours = [...hote.querySelectorAll('.ag-jour')];
  const jour = cible === 'auj' ? jours.find((s) => s.classList.contains('ag-jour--auj'))
    : typeof cible === 'number' ? jours.find((s) => Number(s.dataset.jour) <= cible && cible < Number(s.dataset.fin))
    : null;
  if (!jour) { hote.scrollTop = 0; return; }
  hote.scrollTop += jour.getBoundingClientRect().top - tete.getBoundingClientRect().bottom;
};

const suivreDefilement = () => {
  if (Math.abs($('agenda').scrollTop - etatAgenda.defileAuto) > 1) etatAgenda.cible = null;
};

const montrerAgenda = (section, data) => {
  const n = data.notes || {};
  if (n.rosterVide) { montrerMessage('stateAgendaNoRoster'); return; }
  if (n.refus === 'chaines') { montrerMessage('stateAgendaRefused'); return; }
  const hote = $('agenda');
  const visible = !hote.hidden;
  const c = charpente(section.id);

  const cadenas = (data.entrees || []).map((e) => (fermee(e, e.abonne) ? 1 : 0)).join('')
    + (data.lignes || []).map((l) => (fermee(l.derniere, l.abonne) ? 1 : 0)).join('');
  const signature = JSON.stringify([data.version, data.enCours, data.progression, data.notes,
                                    data.chaine, data.semaine, Math.floor((data.maintenant || 0) / 60_000), cadenas]);
  if (!visible || signature !== etatAgenda.signature) {
    const repere = visible && etatAgenda.cible === null ? reperer(hote, c.tete) : null;
    $('message').hidden = true;
    $('visuel').hidden = true;
    $('visuel').replaceChildren();
    $('tableau-cadre').hidden = true;
    $('resume').replaceChildren(...(section.tuiles ? section.tuiles(data.resume || {}) : []).map((t) => tuile(t)));
    if (c.barre) majBarre(c.barre, data);
    poserNotes(c.notes, data);
    const suivant = new Map();
    c.liste.replaceChildren(...(section.id === 'semaine' ? listeSemaine(data, suivant) : listeHorsLigne(data, suivant)));
    etatAgenda.noeuds = suivant;
    etatAgenda.signature = signature;
    hote.hidden = false;
    if (repere) retablir(hote, c.tete, repere);
  }
  if (etatAgenda.cible !== null) viser(hote, c.tete, etatAgenda.cible);
  etatAgenda.defileAuto = hote.scrollTop;
};

const chargerAgenda = async (section, relecture = false) => {
  clearTimeout(etatAgenda.minuteur);
  const jeton = ++etatAgenda.jeton;
  if (!relecture) {
    montrerMessage('stateLoading');

    if (etatAgenda.cible === null) etatAgenda.cible = section.id === 'semaine' ? 'auj' : 'haut';
  }
  const r = await demander({ section: section.id, arg: argAgenda(section.id) });

  if (courante !== section.id || jeton !== etatAgenda.jeton) return;
  if (!r.ok) { montrerEchec(r); return; }
  montrerAgenda(section, r.data || {});

  if (r.data && (r.data.enCours || r.data.attente)) {
    etatAgenda.minuteur = setTimeout(() => {
      if (courante === section.id && jeton === etatAgenda.jeton) chargerAgenda(section, true);
    }, RELECTURE_AGENDA);
  }
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

const doublonDe = (e, enPage) => {
  if (!/has already been declared|redeclaration of/i.test(e?.message || '')) return null;
  const m = /^(?:chrome|moz|safari-web)-extension:\/\/([^/]+)\/content\.js/.exec(e?.detail || '');
  if (!m) return null;
  if (enPage && m[1] === enPage) {
    return `            ↳ content.js évalué deux fois par l'exemplaire de la page (${enPage}) / content.js evaluated twice by the page's copy`;
  }
  return `            ↳ la copie d'un second exemplaire (${m[1]}) n'a pas démarré : deux exemplaires de l'extension sont actifs — n'en garder qu'un / a second copy (${m[1]}) did not start: two copies of the extension are enabled — keep only one`;
};

const blocErreurs = (liste, origine, bilan, enPage = null) => bloc(
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
      ? liste.flatMap(e => [
          `  ${String(e.t).padStart(8)} ms  ${String(e.source).padEnd(10)}`
          + `${e.n > 1 ? ` ×${e.n}` : '   '}  ${e.message}${e.detail ? '  — ' + e.detail : ''}`
          + (e.dernier && e.n > 1 ? `  (dernière : ${e.dernier} ms)` : ''),
          ...(doublonDe(e, enPage) ? [doublonDe(e, enPage)] : [])])
      : ['  (aucune / none)']),
  ]);

const adressePanneau = () => {
  try { return new URL(API.runtime.getURL('')).host || null; }
  catch { return null; }
};

const construireRapport = (r, transport, fond) => {

  if (r?.page?.theme) appliquerThemePanneau(r.page.theme);
  const m = API.runtime.getManifest();
  const adresse = adressePanneau();
  const moi = adresse || API.runtime?.id || null;
  const d = new Date();
  const L = [
    `Cowlor's Sidebar — rapport de diagnostic / diagnostic report`,
    `généré / generated : ${d.toISOString()}`,
    '',

    `CE FICHIER NE CONTIENT AUCUNE LISTE PERSONNELLE : ni les chaînes visitées,`,
    `ni les abonnements, ni le roster — seulement leurs COMPTES. Il nomme en`,
    `revanche les chaînes ouvertes dans cette page par l'aperçu ou la salle, et`,
    `porte tout le diagnostic technique. Relisez-le avant de l'envoyer.`,
    '',
    `THIS FILE CONTAINS NO PERSONAL LISTS: not the channels you visit, not your`,
    `subscriptions, not the roster — only their COUNTS. It does name the channels`,
    `opened in this page by the preview or the room, and carries the full`,
    `technical diagnostic. Read it before sending it.`,
    '',
  ];

  L.push(...bloc('ENVIRONNEMENT / ENVIRONMENT', [
    paire('extension', `${m.version} (${m.browser_specific_settings ? 'firefox' : 'chrome'})`),

    paire('identifiant / id', API.runtime?.id || '—'),
    ...(adresse && adresse !== API.runtime?.id ? [paire('adresse / host', adresse)] : []),
    ...(r?.exemplaire ? [paire('page — exemplaire', r.exemplaire)] : []),
    ...(r?.exemplaire && moi && r.exemplaire !== moi
      ? ['  ⚠ la page tourne sous un AUTRE exemplaire que ce panneau : deux exemplaires actifs — n\'en garder qu\'un',
         '  ⚠ the page runs another copy than this panel: two copies enabled — keep only one']
      : []),
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

  const parCadre = (transport.trace || []).some(t => t.voie === 'cadre');
  L.push(...bloc('DIAGNOSTIC HORS PAGE / OFF-PAGE DIAGNOSTIC', [
    paire('worker — ponts', fond?.ok ? (fond.ponts.join(', ') || 'aucun / none')
                                     : `injoignable (${fond?.erreur || '—'})`),
    ...(fond?.ok ? [paire('worker — âge', `${fond.workerMs} ms`),
                    paire('worker — en vol', fond.enVol)] : []),
    paire('essais / attempts', (transport.trace || [])
      .map(t => `#${t.essai} ${t.erreur} (${t.ms} ms${t.voie ? ', ' + t.voie : ''})`)
      .join('  →  ') || '—'),

    ...(obs ? [
      paire('page — jalon / marker', obs.marque || 'ABSENT'),
      paire('page — readyState', obs.etat),
      paire('page — hôte / host', obs.hote),
      paire('page — cachée / hidden', obs.cachee),
      paire('pont / bridge', `${obs.pont}, ${obs.reprises} reprise(s)`),
      paire('page — âge / age', `${obs.pageMs} ms`),
    ] : [paire('observations du pont', parCadre
      ? 'sans objet — panneau incrusté, la page répond sans le pont / n/a — embedded panel, no bridge on the path'
      : 'aucune — le pont lui-même n\'a rien rendu / bridge silent')]),
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

  L.push(...bloc('SECTION SUIVIE / FOLLOWED SECTION', aplatir(r.sectionSuivie)));

  L.push(...bloc('CO-STREAM — SESSION CONTRE LISTE / SESSION VS LIST',
                 aplatir(r.coStream)));
  L.push(...bloc('LANGUE / LANGUAGE', aplatir(r.langue)));
  L.push(...bloc('MODE', aplatir(r.mode)));
  L.push(...bloc('COMPTEURS / COUNTS', aplatir(r.compteurs)));
  L.push(...bloc('FRISE DES CATÉGORIES / CATEGORY TRAIL', aplatir(r.frise)));

  L.push(...bloc('CENTRAGE SANS CATÉGORIE / UNCATEGORISED CENTRING',
                 aplatir(r.centrage)));

  L.push(...bloc('LIGNES DE CARTE / CARD LINES', aplatir(r.lignes)));

  L.push(...bloc('CARTES SPONSORISÉES / SPONSORED CARDS', aplatir(r.promues)));

  L.push(...bloc('SÉRIE DE VISIONNAGE / WATCH STREAK', aplatir(r.serie)));

  L.push(...bloc('RANGÉE DES STORIES / STORIES ROW', aplatir(r.stories)));

  L.push(...bloc('ALIGNEMENT DU BLOC / BLOCK ALIGNMENT', aplatir(r.alignement)));

  L.push(...bloc('TITRE / TITLE', aplatir(r.titre)));

  L.push(...bloc('LECTEUR PRINCIPAL / MAIN PLAYER', aplatir(r.lecteur)));

  L.push(...bloc('SALLE MULTISTREAM / MULTISTREAM ROOM', aplatir(r.salle)));

  L.push(...bloc('SUBATHONS', aplatir(r.subathons)));

  L.push(...bloc('SURVOL — DÉLAI D\'INTENTION / HOVER INTENT', aplatir(r.survol)));
  L.push(...bloc('ABONNEMENTS — RELEVÉ / SUBSCRIPTIONS SWEEP', [
    paire('horodatage', r.relevesAbonnements?.horodatage
      ? new Date(r.relevesAbonnements.horodatage).toISOString() : 'jamais / never'),
    paire('en attente / pending', r.relevesAbonnements?.enAttente),

    paire('rangé derrière un autre onglet / stood down',
          r.relevesAbonnements?.differes ?? 0),

    paire('relevés vides d\'affilée / empty sweeps in a row',
          r.relevesAbonnements?.videsDeSuite ?? 0),
    paire('prochain relevé dans / next sweep in',
          Number.isFinite(r.relevesAbonnements?.prochainDansMs)
            ? `${Math.round(r.relevesAbonnements.prochainDansMs / 60_000)} min` : '—'),

    paire('rendues à leur passé / moved to former',
          !r.relevesAbonnements?.fini ? '—'
            : r.relevesAbonnements.revolus === null || r.relevesAbonnements.revolus === undefined
              ? 'non jugé — un onglet en cours n\'a pas été lu / not judged — a current tab was not read'
              : r.relevesAbonnements.revolus),

    paire('bascule abandonnée / tab switch dropped',
          r.relevesAbonnements?.bascule || 'non / no'),

    ...((r.relevesAbonnements?.onglets || []).map((o) => paire(
      `onglet ${o.onglet}`,
      `${o.voie || 'page'}${o.preuve ? ` (${o.preuve})` : ''}`
      + ` · ${o.charge ? 'affiché' : 'jamais chargé'} · ${o.noeuds} nœuds`
      + ` · barre ${o.barre ? 'oui' : 'non'} · ${o.cartes} carte(s)`
      + ` · ${o.logins} chaîne(s)`

      + (Number.isFinite(o.echeances) && o.logins ? ` · ${o.echeances}/${o.logins} échéance(s) lue(s)` : '')
      + (o.liens ? ` · ${o.liens} lien(s) de chaîne hors carte` : '')
      + (o.blanc ? ' · rien sous les onglets' : '')
      + (o.texte ? ` · la page dit : « ${o.texte} »` : '')))),
  ]));

  const rs = r.relevesSuivies || {};
  const dernier = rs.dernier;
  L.push(...bloc('CHAÎNES SUIVIES — RELEVÉ / FOLLOWED-CHANNEL SWEEP', [
    paire('horodatage', rs.horodatage ? new Date(rs.horodatage).toISOString() : 'jamais / never'),
    paire('en attente / pending', rs.enAttente),
    paire('en cours / running', rs.enCours),
    paire('rangé derrière un autre onglet / stood down', rs.differes ?? 0),
    paire('relevés incomplets d\'affilée / incomplete sweeps in a row', rs.incompletsDeSuite ?? 0),
    paire('prochain relevé dans / next sweep in',
          rs.horodatage && Number.isFinite(rs.prochainDansMs) ? `${Math.round(rs.prochainDansMs / 60_000)} min` : '—'),
    paire('relevé de cette page / this page\'s sweep', !dernier ? 'aucun / none'
      : `${dernier.chaines} chaîne(s) · ${dernier.pages} page(s) · ${dernier.complet ? 'complet' : 'incomplet'}`
        + ` · ${dernier.arret || 'en cours'} · ${Math.round((dernier.dureeMs || 0) / 1000)} s`),
    ...(dernier ? [paire('ajoutées · retirées / added · removed', `${dernier.ajoutees} · ${dernier.retirees}`),
                   paire('lots illisibles / unreadable batches', dernier.illisibles)] : []),
  ]));
  L.push(...bloc('RÉSEAU / NETWORK', [
    ...aplatir(r.reseau),
    paire('retards.medianeMs', r.retards?.medianeMs),
    paire('retards.p90Ms', r.retards?.p90Ms),
  ]));
  L.push(...bloc('TOP CHAÎNES / TOP CHANNELS', aplatir(r.global)));

  L.push(...bloc('AGENDA', aplatir(r.agenda)));

  L.push(...blocErreurs(r.erreurs, '', r.bilanErreurs, r.exemplaire));

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

      h.dataset.groupe = groupe;
      rail.appendChild(h);
    }
    const b = document.createElement('button');
    b.className = 'rail-item';
    b.dataset.id = s.id;
    b.dataset.groupe = s.groupe;
    b.type = 'button';
    b.textContent = T(cleNav(s.id));
    b.setAttribute('aria-current', 'false');
    b.addEventListener('click', () => { if (s.agenda) entrerAgenda(s.id); charger(s.id); });
    rail.appendChild(b);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = LOCALE;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = T(el.dataset.i18n);
  }
  construireRail();
  appliquerDiag();

  $('message-bouton').addEventListener('click', () => charger(courante));

  const lacher = () => { etatAgenda.cible = null; };
  for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    $('agenda').addEventListener(ev, lacher, { passive: true });
  }
  $('agenda').addEventListener('scroll', suivreDefilement, { passive: true });
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
    if (!$('rapport').hidden) { fermerRapport(); return; }

    if (document.documentElement.getAttribute('data-vue') !== 'incruste') return;

    try { window.parent.postMessage({ tse: 'tse-panneau-fermer' }, '*'); }
    catch {   }
  });

  charger(courante);
});
