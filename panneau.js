/* ============================================================
 *  PANNEAU — la vue
 *  ------------------------------------------------------------
 *  Une page d'extension. Elle n'a pas la page Twitch, elle a
 *  `chrome.*` ; content.js a l'inverse. Tout ce qui s'affiche ici
 *  a donc traversé bridge.js puis background.js, et n'est arrivé
 *  que sous forme de DONNÉES NUES : des noms de champs et des
 *  valeurs, jamais des libellés.
 *
 *  C'EST DONC ICI QU'ON TRADUIT, et nulle part ailleurs. Les
 *  douze locales de `_locales/` couvrent ce fichier ; les dix
 *  blocs de STRINGS dans content.js couvrent la barre latérale et
 *  la console. Deux surfaces, deux tables, aucun libellé qui
 *  transite de l'une à l'autre — c'est la seule façon qu'elles
 *  ne se désynchronisent pas en silence.
 *
 *  RIEN N'EST ÉCRIT EN DUR DANS LE HTML : ni un titre, ni une
 *  colonne. Une page d'extension ne peut pas substituer
 *  __MSG_…__ dans son corps (seuls le manifeste et le CSS le
 *  peuvent), donc tout passe par chrome.i18n, ici.
 * ============================================================ */
'use strict';

/* ── QUEL NAMESPACE, ET POURQUOI CE N'EST PAS UN DÉTAIL ──────────────────────
   Ce fichier appelait `chrome.runtime.sendMessage(…).catch(…)` et
   `chrome.tabs.query(…).then(…)`. Sur Chrome, ces API rendent des promesses
   depuis MV3 et tout va bien. Sur Firefox, les deux namespaces coexistent et
   ne se comportent PAS de la même façon : `browser.*` rend des promesses,
   `chrome.*` est la façade de compatibilité, à rappels. Si elle ne rend rien,
   `.catch` s'applique à `undefined`, la fonction lève, et le panneau ne montre
   RIEN — aucune section, aucun rapport, aucun message d'erreur non plus,
   puisque c'est le transport lui-même qui casse.

   JE N'AI PAS PU L'EXÉCUTER : il n'y a pas de Firefox sur cette machine, et
   une extension ne se charge pas dans un navigateur qu'on n'a pas. Plutôt que
   de parier sur la réponse, on rend le code INDÉPENDANT de la question : quand
   `browser` existe — c'est-à-dire sur Firefox — on l'emploie, puisque c'est
   celui dont les promesses sont garanties. Chrome ne le définit pas et garde
   `chrome`, dont les promesses sont garanties aussi. Les deux chemins sont
   sûrs, et aucun ne dépend de ce que je n'ai pas pu vérifier. */
const API = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

const T = (cle, sub) => API.i18n.getMessage(cle, sub) || cle;

/* Locale d'affichage pour les nombres et les dates. On suit celle de
   l'INTERFACE de l'extension, pas celle du système : si le panneau parle
   allemand, ses milliers doivent se grouper comme en allemand. */
const LOCALE = (API.i18n.getUILanguage && API.i18n.getUILanguage()) || 'en';
const NOMBRE = new Intl.NumberFormat(LOCALE);

/* ── Mise en forme des valeurs ───────────────────────────────────────────── */
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
  /* Durées : secondes en dessous d'une minute, puis m:ss. Les retards de
     Twitch se comptent en minutes, les âges de bascule en secondes — une
     seule unité rendrait l'une des deux illisible. */
  duree: (ms) => {
    if (!Number.isFinite(ms)) return '—';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
  },
  dureeSec: (s) => (Number.isFinite(s) ? fmt.duree(s * 1000) : '—'),
  oui: (v) => (v ? T('valYes') : T('valNo')),
};

/* ── Les sections, et ce qu'elles montrent ───────────────────────────────────
   `colonnes` mappe un nom de champ rendu par content.js vers une clé de
   traduction et une mise en forme. Un champ absent d'ici n'est pas affiché :
   la couche de données peut donc gagner un champ sans que le panneau change
   de tête, et sans qu'un intitulé non traduit n'apparaisse. */
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
  status:    { cle: 'colStatus',    f: null },            // rendu spécial
  critical:  { cle: 'colCritical',  f: fmt.oui },
  rang:      { cle: 'colRank',      f: fmt.nombre, num: true },
  viewers:   { cle: 'colViewers',   f: fmt.nombre, num: true },
  game:      { cle: 'colGame' },
  libelle:   { cle: 'colLabel' },
  canonique: { cle: 'colCanonical', f: fmt.texte, classe: () => 'faible' },
  ageSec:    { cle: 'colAge',       f: fmt.dureeSec, num: true },
};

const SECTIONS = [
  /* LE MODE D'EMPLOI EN PREMIER, ET C'EST LUI QUI S'OUVRE. `courante` est
     amorcée sur SECTIONS[0] : mettre ce chapitre en tête suffit à en faire la
     page d'accueil du panneau, sans cas particulier au démarrage.

     `statique` est le seul drapeau de cette table, et il dit une chose : cette
     section ne passe pas par le pont. Toutes les autres commencent par
     demander leurs données à l'onglet Twitch au premier plan ; celle-ci n'a
     rien à demander, et c'est précisément ce qu'on veut de la première vue —
     quelqu'un qui vient d'installer l'extension et clique sur son icône n'a
     pas forcément Twitch devant lui, et aurait lu « ouvrez un onglet
     twitch.tv » en guise de bienvenue. */
  { id: 'guide',   groupe: 'grpGuide', statique: true },

  { id: 'scores',  groupe: 'grpData',
    tuiles: (r) => [['sumChannels', fmt.nombre(r.chaines)]] },

  /* LE RYTHME SUIT LES SCORES, et cet ordre n'est pas arbitraire : les deux
     lisent le MÊME registre de visites. Les scores en tirent qui l'on
     regarde, le rythme en tire quand — deux questions sur une seule mémoire,
     qu'il vaut mieux garder voisines.

     `visuel` est enveloppé dans une flèche plutôt que passé par son nom : les
     fonctions de dessin sont déclarées plus bas dans ce fichier, et lire leur
     référence ici, au moment où ce tableau se construit, tomberait dans leur
     zone morte. L'enveloppe ne les lit qu'à l'appel. */
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

  /* LA COURBE NE COÛTE AUCUNE DONNÉE DE PLUS. La section envoie déjà chaque
     relevé dans `lignes` — c'est ce que le tableau affiche — et la cumulée se
     construit à partir de là. Rien de neuf ne traverse les trois sauts. */
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

/* ════════════════════════════════════════════════════════════════════════════
   LES DESSINS
   ────────────────────────────────────────────────────────────────────────────
   Deux vues seulement, et pour une raison qui se dit en une phrase : une
   semaine d'habitudes et une distribution de retards sont des FORMES. Mises en
   colonnes il faudrait les relire ligne à ligne pour retrouver ce qu'un coup
   d'œil donne. Partout ailleurs le tableau reste le bon outil, et ce fichier
   n'a pas gagné une bibliothèque de graphiques pour autant : une grille CSS
   d'un côté, un SVG construit nœud par nœud de l'autre.

   AUCUN CALCUL D'ANALYSE ICI. Le pic de la semaine et les quantiles des
   retards sont calculés dans content.js, là où les données vivent, et pour la
   même raison qu'ils l'étaient déjà : deux implémentations du même maximum
   finissent par désigner deux cases différentes. Ce bloc ne fait que placer.
   ══════════════════════════════════════════════════════════════════════════ */

/* Noms de jours de la locale, indexés comme `Date.prototype.getDay` : 0 pour
   dimanche. Le 7 janvier 2024 était un dimanche, et minuit LOCAL garantit que
   `getDay` y répond 0 sous tous les fuseaux — construire ces dates en UTC les
   aurait décalées d'un jour à l'ouest de Greenwich. */
const JOURS_COURTS = (() => {
  const f = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, j) => f.format(new Date(2024, 0, 7 + j)));
})();

/* Heure telle que la locale l'écrit : « 21 h » ici, « 9 PM » ailleurs. Sert au
   cartouche du pic, jamais à l'axe — un axe est une échelle, et des chiffres
   nus s'y lisent mieux qu'une forme longue répétée huit fois. */
const heureLisible = (h) => new Intl.DateTimeFormat(LOCALE, { hour: 'numeric' })
  .format(new Date(2024, 0, 7, h));

/* PREMIER JOUR DE LA SEMAINE, demandé à la locale et non supposé. Dix des
   douze fiches commencent le lundi, mais l'anglais et le japonais commencent
   le dimanche : imposer le lundi aurait décalé la lecture pour ceux-là. L'API
   existe sous deux formes selon les moteurs — méthode ou propriété — et sous
   aucune des deux sur les plus anciens, d'où le repli sur lundi, qui est le
   défaut de la norme ISO. */
const PREMIER_JOUR = (() => {
  try {
    const l = new Intl.Locale(LOCALE);
    const info = (typeof l.getWeekInfo === 'function') ? l.getWeekInfo() : l.weekInfo;
    const d = info && info.firstDay;
    if (Number.isInteger(d) && d >= 1 && d <= 7) return d % 7;   // 7 (dimanche) → 0
  } catch { /* moteur sans weekInfo : lundi */ }
  return 1;
})();

/* Étendue de l'historique, en jours, dans l'unité de la locale. `style: unit`
   n'existe pas partout ; sans lui on rend le nombre seul, ce qui reste juste
   sous l'intitulé « Historique ». */
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

/* ── LA SEMAINE ──────────────────────────────────────────────────────────────
   Sept lignes, vingt-quatre colonnes, quatre paliers de densité. La grille est
   `aria-hidden` et les cartouches disent en toutes lettres ce qu'elle montre —
   même règle que la frise de la barre latérale : la forme pour l'œil, le texte
   pour l'information. Chaque case porte tout de même son infobulle, qui est un
   confort de souris et non le support de l'accessibilité. */
const dessinRythme = (paquet) => {
  const grille = paquet && paquet.grille;
  const r = (paquet && paquet.resume) || {};
  if (!Array.isArray(grille) || !r.visites) return null;
  const max = (r.pic && r.pic.n) || 1;

  const hote = div('rythme');
  const cases = div('rythme-grille');
  cases.setAttribute('aria-hidden', 'true');

  /* L'ordre des lignes suit la locale : `PREMIER_JOUR` dit par quel indice de
     `getDay` la semaine commence, les sept suivants s'enroulent. */
  const ordre = Array.from({ length: 7 }, (_, i) => (PREMIER_JOUR + i) % 7);
  for (const j of ordre) {
    cases.appendChild(div('rythme-jour', JOURS_COURTS[j]));
    for (let h = 0; h < 24; h++) {
      const n = grille[j][h] || 0;
      /* Quatre paliers, bornés par le pic : la case la plus dense de la
         semaine est toujours au palier 4, quelle qu'en soit la valeur
         absolue. Une échelle fixe rendrait la grille vide chez qui regarde
         peu et saturée chez qui regarde beaucoup. */
      const palier = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
      const c = div('rythme-case' + (palier ? ' rythme-case--' + palier : ''));
      c.title = `${JOURS_COURTS[j]} ${heureLisible(h)} — ${NOMBRE.format(n)}`;
      cases.appendChild(c);
    }
  }
  hote.appendChild(cases);

  /* L'axe des heures, sous la grille et dans la même grille : une colonne sur
     trois porte son numéro, les autres sont des cases vides qui tiennent
     l'alignement. Des chiffres nus plutôt que la forme longue de la locale —
     « 9 PM » huit fois de suite encombrerait un axe que « 21 » suffit à
     graduer. */
  const axe = div('rythme-grille');
  axe.setAttribute('aria-hidden', 'true');
  axe.appendChild(div('rythme-heure'));
  for (let h = 0; h < 24; h++) {
    axe.appendChild(div('rythme-heure', h % 3 === 0 ? String(h).padStart(2, '0') : ''));
  }
  hote.appendChild(axe);

  /* ── LE PROFIL HORAIRE ─────────────────────────────────────────────────────
     La projection de la grille sur ses colonnes. La grille quantifie en quatre
     paliers, ce qui efface les écarts fins entre deux heures voisines ; le
     profil les rend, sur la même donnée et les mêmes verticales. La gouttière
     porte le maximum, sans quoi les barres n'auraient pas d'échelle. */
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

/* ── LA COURBE DES RETARDS ───────────────────────────────────────────────────
   Cumulative, et c'est un choix documenté dans la feuille de style : une
   distribution de durées penche toujours à droite, un histogramme s'y écrase
   et un seul relevé lointain aplatit le reste. La courbe cumulée monte de 0 à
   100 % quoi qu'il arrive, et la médiane et le 90e centile sont les endroits
   où elle croise 50 % et 90 % — le dessin explique les deux cartouches au lieu
   de les répéter. */
const NS_SVG = 'http://www.w3.org/2000/svg';
const svgEl = (nom, attrs) => {
  const e = document.createElementNS(NS_SVG, nom);
  for (const k of Object.keys(attrs || {})) e.setAttribute(k, String(attrs[k]));
  return e;
};

/* Les graduations de l'axe : des durées RONDES, pas des puissances de dix.
   « 100 s » ne veut rien dire pour personne ; une minute, cinq minutes, une
   heure, si. On ne garde que celles qui tombent dans l'étendue mesurée. */
const PALIERS_LAG = [1e3, 5e3, 15e3, 30e3, 60e3, 5 * 60e3, 15 * 60e3,
                     30 * 60e3, 60 * 60e3, 2 * 60 * 60e3];

const dessinLag = (paquet) => {
  const lignes = (paquet && paquet.lignes) || [];
  const lags = lignes.map((s) => s.lag).filter(Number.isFinite).sort((a, b) => a - b);
  /* Sous cinq relevés, une cumulée n'est pas une courbe : c'est un escalier de
     quatre marches qui donnerait à trois mesures l'allure d'une statistique.
     Le tableau, lui, les montre telles quelles. */
  if (lags.length < 5) return null;
  const max = lags[lags.length - 1];
  if (!(max > 0)) return null;

  /* ── L'AXE EST LOGARITHMIQUE, ET LA CAPTURE L'A EXIGÉ ──────────────────────
     Première version : axe linéaire de zéro au maximum. Sur un décor réaliste
     — deux cent quarante relevés sous deux minutes et deux traînards à une
     demi-heure — la courbe montait à la verticale dans les trois premiers
     pour cent de la largeur puis courait à plat sur tout le reste. Rien ne s'y
     lisait : ni la médiane, ni le 90e centile, dont les deux étiquettes se
     chevauchaient dans le coin gauche.

     Une cumulée ne dégénère pas en ORDONNÉE — elle monte de 0 à 100 % quoi
     qu'il arrive — mais elle dégénère en ABSCISSE dès que la queue est
     lourde, et une distribution de latences l'est toujours. J'avais écrit
     l'inverse ; le dessin m'a contredit.

     Le logarithme est l'outil de ce cas exact, et il ne CACHE RIEN : les deux
     traînards restent sur le tracé, à leur place, simplement à une distance
     qui laisse voir le reste. Le prix est un axe qu'il faut graduer, sans quoi
     l'œil lirait des écarts qui n'existent pas — d'où les paliers ci-dessus.

     Le plancher est à une seconde : le retard se déduit de `createdAt`, dont
     la seconde est la résolution. Prétendre distinguer 120 ms de 300 ms serait
     donner du sens à du bruit. */
  const bas = 1000;
  /* LE HAUT DE L'AXE EST ARRONDI AU PALIER SUIVANT, et la capture l'a demandé.
     Laissé sur le maximum brut — quarante minutes, c'est-à-dire un traînard —
     la dernière graduation tombait à quelques pixels de l'avant-dernière et
     les deux étiquettes se touchaient. Portée à l'heure ronde, la dernière se
     pose exactement au bord droit, là où l'œil attend la fin d'une échelle, et
     l'avant-dernière retrouve sa place. Le tracé, lui, ne bouge pas d'un
     relevé : on étend le cadre, on ne déplace pas la mesure. */
  const brut = Math.max(max, bas * 2);
  const haut = PALIERS_LAG.find((p) => p >= brut) || brut;
  const lb = Math.log(bas), lh = Math.log(haut);

  /* Le panneau a une largeur FIXE (cf. la feuille) : le contenu de la vue en
     fait 546. Le viewBox est donc à l'échelle 1, et les traits d'un pixel
     restent des traits d'un pixel. */
  const W = 546, H = 104;
  const gx = 6, dx = 540, hy = 10, by = 80;      // bornes du tracé
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

  /* Les graduations AVANT tout le reste : elles sont le fond du dessin, et
     rien ne doit passer dessous. Deux paliers trop proches ne se lisent pas —
     on saute le second. */
  let dernierX = -Infinity;
  for (const ms of PALIERS_LAG) {
    if (ms < bas || ms > haut) continue;
    const x = X(ms);
    if (x - dernierX < 46) continue;
    dernierX = x;
    svg.appendChild(svgEl('line', { class: 'courbe-axe', x1: x, y1: hy, x2: x, y2: by,
                                    opacity: '0.45' }));
    /* Aux extrémités, l'ancrage bascule : centrée sur la première graduation,
       une étiquette sortirait du cadre à gauche et serait coupée à droite. */
    const t = svgEl('text', { class: 'courbe-texte', x: x, y: by + 13,
                              'text-anchor': x < gx + 20 ? 'start'
                                           : x > dx - 30 ? 'end' : 'middle' });
    /* « 1 min 00 » sur un axe est une graduation qui bafouille. Les paliers
       au-delà de la minute sont tous ronds : on les écrit comme tels, et
       `fmt.duree` garde les secondes, où la précision compte. */
    t.textContent = ms >= 3600e3 && ms % 3600e3 === 0 ? `${ms / 3600e3} h`
                  : ms >= 60e3 && ms % 60e3 === 0 ? `${ms / 60e3} min`
                  : fmt.duree(ms);
    svg.appendChild(t);
  }

  /* Les deux repères horizontaux, sous la courbe : c'est ce qui les rend
     discrets sans les rendre inutiles. Ils nomment ce que les cartouches
     chiffrent, et l'endroit où ils croisent le tracé se lit sur l'axe. */
  for (const [part, cle] of [[0.5, 'sumMedian'], [0.9, 'sumP90']]) {
    const y = Y(part);
    svg.appendChild(svgEl('line', { class: 'courbe-repere', x1: gx, y1: y, x2: dx, y2: y }));
    const t = svgEl('text', { class: 'courbe-texte', x: gx + 1, y: y - 3 });
    t.textContent = T(cle);
    svg.appendChild(t);
  }

  /* LA CUMULÉE. Le i-ième relevé trié atteint la part (i+1)/n : on relie ces
     points, en partant du plancher de l'axe parce qu'aucune durée n'est
     mesurable en deçà. Deux tracés pour un seul chemin — l'aire remplie et le
     trait par-dessus — de sorte que le trait garde son épaisseur au sommet. */
  const pts = [[X(bas), Y(0)]];
  for (let i = 0; i < lags.length; i++) pts.push([X(lags[i]), Y((i + 1) / lags.length)]);
  /* LE PLATEAU VA JUSQU'AU BORD, et ce n'est pas une extrapolation : une
     cumulée vaut 100 % pour toute durée supérieure au plus grand relevé, par
     définition. Sans ce point, l'aire se refermait en DIAGONALE depuis le
     dernier relevé jusqu'au coin — une pente qui se lisait comme une
     décroissance alors qu'il ne s'était rien passé. Vu sur capture, dès que
     le haut de l'axe a été arrondi au-delà du maximum. */
  pts.push([dx, Y(1)]);
  const trace = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  svg.appendChild(svgEl('path', { class: 'courbe-aire', d: `${trace} L${dx},${Y(0)} Z` }));
  svg.appendChild(svgEl('path', { class: 'courbe-trait', d: trace }));
  svg.appendChild(svgEl('line', { class: 'courbe-axe', x1: gx, y1: by, x2: dx, y2: by }));

  /* La descente des deux repères jusqu'à l'axe : c'est elle qui transforme un
     croisement en abscisse lisible. Aucune étiquette de durée ici — les
     cartouches au-dessus les donnent au chiffre près, et les répéter sur un
     axe déjà gradué ne ferait que se chevaucher quand la distribution est
     serrée, ce qu'elle est le plus souvent. */
  for (const [ms, part] of [[paquet.resume && paquet.resume.medianeLag, 0.5],
                            [paquet.resume && paquet.resume.p90Lag, 0.9]]) {
    if (!Number.isFinite(ms)) continue;
    const x = Math.min(dx, Math.max(gx, X(ms)));
    svg.appendChild(svgEl('line', { class: 'courbe-repere', x1: x, y1: Y(part), x2: x, y2: by }));
  }
  return svg;
};

/* ════════════════════════════════════════════════════════════════════════════
   LE MODE D'EMPLOI
   ────────────────────────────────────────────────────────────────────────────
   Ce produit n'a pas de réglages : ni options, ni interrupteurs, ni compte.
   Ce qui lui manquait n'était donc pas un écran de préférences, c'était la
   LISTE DE CE QUI EXISTE — la moitié de ce qu'il ajoute ne se découvre qu'en
   posant le pointeur au bon endroit, et rien nulle part ne disait de le faire.

   IL NE DEMANDE RIEN À LA PAGE, et c'est ce qui le rend lisible le premier
   jour. Les onze autres sections passent par le pont, donc par un onglet
   Twitch au premier plan ; celle-ci s'affiche toujours, y compris sur un
   navigateur qui n'a pas encore rouvert Twitch depuis l'installation.

   LES EXEMPLES SONT DESSINÉS, PAS DÉCRITS. Une pastille dorée, un ruban de
   catégories, une barre violette qui respire : ces choses-là se reconnaissent
   à l'œil et se racontent mal. Les maquettes qui suivent reprennent la
   géométrie et la palette de la barre latérale, à l'échelle du panneau, et
   elles sont `aria-hidden` — le texte de chaque chapitre dit la même chose en
   toutes lettres, comme la frise et la grille du rythme le font déjà.

   LES NOMS DE CHAÎNES SONT INVENTÉS, et les catégories choisies parmi celles
   que Twitch NE traduit PAS. Citer de vrais streamers dans une maquette les
   ferait paraître partenaires de l'extension — c'est la règle des captures de
   la fiche, et elle vaut ici. Quant aux catégories : « Just Chatting » devient
   « Discussions » en français, et une maquette qui l'afficherait en anglais au
   milieu d'un texte français se lirait comme un oubli de traduction. Les noms
   de jeux, eux, sont les mêmes dans les douze langues.
   ══════════════════════════════════════════════════════════════════════════ */

const elt = (nom, classe, texte) => {
  const e = document.createElement(nom);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
};

/* LA PALETTE DES BADGES EST RECOPIÉE DANS LA FEUILLE DU PANNEAU, et c'est la
   même frontière que pour les libellés : cette page n'a pas le CSS de
   content.js, qui vit dans la barre latérale de Twitch. On recopie donc les
   dix modificateurs, et le scénario 96 vérifie qu'ils ne se sont pas mis à
   rendre tous la même couleur — une maquette de badges monochrome
   n'expliquerait plus rien. */
const badgeDemo = (mod, cle) => elt('span', 'd-badge d-badge--' + mod, T(cle));

/* LA CARTE DE LA BARRE LATÉRALE, EN PETIT. Six chapitres en montrent une, et
   chacun n'en change qu'un détail : la durée, la pastille de jour, le compteur
   de collab, la barre violette, l'or de l'abonnement. Une seule maquette
   paramétrée plutôt que six recopiées — sans quoi la cinquième aurait fini par
   ne plus ressembler aux quatre autres. */
const demoCarte = (o) => {
  const carte = div('d-carte' + (o.frais ? ' d-carte--frais' : '')
                              + (o.or ? ' d-carte--or' : ''));
  const avatar = div('d-avatar');
  if (o.collab) avatar.appendChild(elt('span', 'd-collab', o.collab));
  carte.appendChild(avatar);

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
  /* « LIVE » n'est pas un libellé du produit mais la pastille que Twitch pose
     sur ses propres vignettes : elle n'a pas de clé, et n'en veut pas. */
  video.appendChild(elt('span', 'd-live', 'LIVE'));
  hote.append(video, elt('p', 'd-titre', T('guideDemoTitre')));
  const rangee = div('d-badges');
  rangee.append(badgeDemo('switch', 'guideBadgeSwitch'),
                badgeDemo('sub', 'guideBadgeSub'));
  hote.appendChild(rangee);
  return hote;
};

/* Les dix badges, dans l'ordre où l'aperçu les pose : l'étiquette de
   classification d'abord — elle se lit avant de regarder — puis les deux
   nouvelles qui s'effacent d'elles-mêmes, puis le contexte, et le subathon en
   dernier parce qu'il traverse toutes les couleurs. */
const BADGES_DEMO = [
  ['ccl',      'guideBadgeCcl'],
  ['reprise',  'guideBadgeReprise'],
  ['switch',   'guideBadgeSwitch'],
  ['costream', 'guideBadgeCostream'],
  ['squad',    'guideBadgeSquad'],
  ['sub',      'guideBadgeSub'],
  ['sponsor',  'guideBadgeSponsor'],
  ['hype',     'guideBadgeHype'],
  ['discount', 'guideBadgeDiscount'],
  ['subathon', 'guideBadgeSubathon'],
];

const demoBadges = () => {
  const rangee = div('d-badges');
  for (const [mod, cle] of BADGES_DEMO) rangee.appendChild(badgeDemo(mod, cle));
  return rangee;
};

/* LE RUBAN DE LA FRISE. Les largeurs sont celles des durées écrites en face —
   2 h 10, 1 h 05, 55 min sur 4 h 10 au total — parce qu'une maquette « à
   l'échelle » qui ne le serait pas contredirait le chapitre qu'elle illustre.
   La dernière bande est celle qui court : elle s'estompe, et sa durée porte le
   « ~ » que le produit met quand il ne connaît pas l'heure exacte du passage. */
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

/* Une maquette qui porte une carte ET le badge que l'aperçu montrerait dessus.
   Les deux ensemble, parce que c'est ainsi qu'on les rencontre : le signal
   discret dans la liste, et la phrase entière au survol. */
const carteEtBadge = (carte, mod, cle) => {
  const hote = div('d-pile');
  hote.append(carte, badgeDemo(mod, cle));
  return hote;
};

const GUIDE = [
  { titre: 'guideHoverTitre',    texte: 'guideHoverTexte',    demo: () => demoApercu() },
  { titre: 'guideDureeTitre',    texte: 'guideDureeTexte',
    demo: () => {
      const hote = div('d-pile');
      hote.append(demoCarte({ nom: 'Nyxaria', cat: 'Elden Ring', vues: 1243, duree: '4h19' }),
                  demoCarte({ nom: 'Korbek', cat: 'Minecraft', vues: 318, fini: true }));
      return hote;
    } },
  { titre: 'guideBadgesTitre',   texte: 'guideBadgesTexte',   demo: () => demoBadges() },
  { titre: 'guideFriseTitre',    texte: 'guideFriseTexte',    demo: () => demoFrise() },
  { titre: 'guideSubathonTitre', texte: 'guideSubathonTexte',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Velmoria', cat: 'Minecraft', vues: 4820, duree: '61h04', jour: true }),
      'subathon', 'guideBadgeSubathon') },
  { titre: 'guideCostreamTitre', texte: 'guideCostreamTexte',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Korbek', cat: 'Valorant', vues: 962, duree: '1h47', collab: '3' }),
      'squad', 'guideBadgeSquad') },
  { titre: 'guideDebutTitre',    texte: 'guideDebutTexte',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Aeltris', cat: 'Elden Ring', vues: 87, duree: '4m', frais: true }),
      'reprise', 'guideBadgeReprise') },
  { titre: 'guideAboTitre',      texte: 'guideAboTexte',
    demo: () => carteEtBadge(
      demoCarte({ nom: 'Nyxaria', cat: 'Elden Ring', vues: 1243, duree: '4h19', or: true }),
      'sub', 'guideBadgeSub') },
  { titre: 'guideTriTitre',      texte: 'guideTriTexte' },
  { titre: 'guideTopTitre',      texte: 'guideTopTexte',      demo: () => demoOnglets() },
  { titre: 'guideViteTitre',     texte: 'guideViteTexte' },
  { titre: 'guidePanneauTitre',  texte: 'guidePanneauTexte' },
  { titre: 'guideVieTitre',      texte: 'guideVieTexte' },
];

/* LE CORPS D'UN CHAPITRE EST UN SEUL MESSAGE, retours à la ligne compris, et
   ce n'est pas de la paresse : découper chaque puce en sa propre clé aurait
   donné cent soixante entrées de plus dans douze fichiers, et surtout aurait
   figé le NOMBRE de puces — une langue qui a besoin de deux phrases là où le
   français en met une n'aurait pas eu où les mettre. Une ligne qui commence
   par « • » est une puce, les autres sont des paragraphes ; c'est toute la
   grammaire, et elle tient dans la tête de qui traduit. */
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
    section.append(...corpsGuide(T(chapitre.texte)));
    blocs.push(section);
  });
  return blocs;
};

/* ── Transport ───────────────────────────────────────────────────────────── */
/* On mémorise la PROMESSE, pas la valeur. Deux sections chargées coup sur
   coup — un clic pendant que la précédente arrive — liraient sinon toutes
   deux un identifiant encore nul et interrogeraient le navigateur chacune de
   leur côté. Le linter l'a dit avant qu'on l'observe.

   `chrome.tabs.query` sans la permission `tabs` rend bien les onglets, mais
   sans leur URL. C'est sans importance ici : on n'a besoin que de l'ID, et
   c'est le service worker qui saura — ou non — trouver un pont pour cet
   onglet. Demander la permission juste pour lire une URL qu'on n'utiliserait
   pas serait le contraire de ce que la fiche promet. */
let ongletP = null;
const idOnglet = () => (ongletP ??= API.tabs
  .query({ active: true, currentWindow: true })
  .then(([t]) => (t ? t.id : undefined))
  .catch(() => undefined));

/* L'ÉCHELLE DE RÉESSAIS, ET POURQUOI ELLE NE PEUT PAS ÊTRE UN SEUL DÉLAI.

   Chrome termine le service worker après une trentaine de secondes
   d'inactivité, ports compris. bridge.js en rouvre un aussitôt (REPRISE), mais
   il existe une fenêtre pendant laquelle PERSONNE ne répond pour cet onglet —
   et un clic tombe dedans une fois de temps en temps.

   La première version réessayait UNE fois, à 500 ms, quand bridge.js
   reconnectait à 1 000 : le réessai tenait tout entier dans le trou qu'il
   devait franchir. Le panneau annonçait alors « ouvrez un onglet twitch.tv »
   à quelqu'un qui en regardait un, et le bouton « Réessayer » retombait dans
   la même fenêtre. Un rapport d'utilisateur l'a montré.

   Les trois délais couvrent donc largement la reprise (200 ms) plus le
   démarrage d'un worker froid, et s'arrêtent avant que l'attente ne devienne
   elle-même le symptôme : environ trois secondes au total, après quoi il vaut
   mieux dire ce qui ne va pas que continuer à faire tourner un voile. */
const ATTENTES = [250, 750, 1800];

/* L'ÉTAT DU SERVICE WORKER, demandé sans passer par le pont — c'est tout
   l'intérêt : on s'en sert quand le pont ne répond pas. Ne sert qu'au
   rapport. */
const etatFond = () => API.runtime.sendMessage({ type: 'tse-panneau-etat' })
  .catch((e) => ({ ok: false, erreur: 'fond', detail: String((e && e.message) || e) }));

/* LA TRACE DES ESSAIS. Un échec après quatre tentatives et un échec au premier
   coup ne se réparent pas pareil, et le panneau n'en gardait rien : le rapport
   montrait la dernière erreur comme s'il n'y en avait eu qu'une. */
const demander = async (charge, essai = 0, trace = []) => {
  const t0 = Date.now();
  const onglet = await idOnglet();
  if (typeof onglet !== 'number') {
    trace.push({ essai, ms: Date.now() - t0, erreur: 'onglet' });
    return { ok: false, erreur: 'absent', detail: 'aucun onglet actif', trace };
  }
  /* DEUX ÉCHECS QUI N'ONT RIEN À VOIR, et les confondre coûtait cher : le
     panneau disait « ouvrez un onglet twitch.tv » à quelqu'un qui en avait un
     sous les yeux, avec l'extension visiblement à l'œuvre dans sa barre
     latérale. Le message accusait l'onglet quand le fautif était ailleurs.

       — `fond` : l'envoi lui-même échoue. Personne n'écoute au bout de
         chrome.runtime, donc le service worker n'a pas démarré. Sur Chrome,
         un manifeste déclarant `background.scripts` au lieu de
         `service_worker` produit exactement cela : les content scripts
         tournent, la sidebar est décorée, et le fond de tâche n'existe pas ;
       — `absent` : le service worker répond, mais n'a AUCUN port pour cet
         onglet. C'est bridge.js qui manque — page ouverte avant l'installation
         de l'extension, ou onglet qui n'est pas une page Twitch.

     Le détail technique est conservé et affiché : c'est ce qu'on demande de
     recopier quand rien d'autre ne se voit. */
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

/* ── Rendu ───────────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
let courante = SECTIONS[0].id;

const montrerMessage = (cle, bouton, detail) => {
  $('tableau-cadre').hidden = true;
  /* Le dessin part avec le tableau. Sans cette ligne, la grille de la section
     précédente restait affichée sous « Chargement… » — un dessin qui survit à
     sa section décrit des données qui ne sont plus celles qu'on regarde. */
  $('visuel').hidden = true;
  $('visuel').replaceChildren();
  $('resume').replaceChildren();
  const m = $('message');
  m.hidden = false;
  /* Le détail technique n'est pas traduit, et c'est voulu : c'est le message
     du navigateur, mot pour mot, celui qu'on recopiera dans un rapport. Le
     traduire le rendrait introuvable. */
  $('message-texte').textContent = T(cle) + (detail ? ` (${detail})` : '');
  const b = $('message-bouton');
  b.hidden = !bouton;
  if (bouton) b.textContent = T('btnRetry');
};

/* Le mode d'emploi prend toute la vue : il n'a ni cartouches, ni dessin, ni
   tableau, et le message de chargement n'a pas lieu d'être puisque rien n'est
   chargé. On range donc les quatre blocs avant de le poser — sans quoi le
   tableau de la section précédente resterait sous le premier chapitre. */
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

/* Quel message pour quel échec. Une seule table, deux appelants — sans elle,
   les deux listes de cas divergeaient au premier ajout. */
const CAUSES = {
  fond: 'stateNoWorker',
  absent: 'stateAbsent',
  /* Trois silences, trois réparations. Ils rendaient tous le mot « expiration »
     et le panneau n'en donnait donc qu'un seul message — celui qui invite à
     patienter, y compris quand attendre ne servait à rien.
       — `demarrage`      : content.js est entré mais n'a pas fini ; il porte
                            l'étape et ses erreurs, il n'y a rien à attendre ;
       — `page-absente`   : content.js n'a jamais tourné dans cet onglet. Une
                            page ouverte avant l'installation, ou un script
                            bloqué : il faut RECHARGER ;
       — `expiration-page`: il tourne et ne répond pas — le seul des trois qui
                            soit un bogue de notre côté ;
       — `expiration-pont`: le port est mort en route. */
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
  /* textContent, jamais innerHTML : ces valeurs viennent de Twitch (pseudos,
     catégories, titres) et sont du TEXTE. Le scénario 62 tient déjà cette
     règle pour la barre latérale ; elle ne s'arrête pas à la frontière du
     panneau, où les mêmes chaînes réapparaissent. */
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

  /* LE DESSIN D'ABORD, PARCE QU'IL DÉCIDE DU VIDE. Une section peut n'avoir
     aucune ligne à tabuler et tout de même quelque chose à montrer — c'est le
     cas du rythme, dont la semaine EST le contenu. Annoncer « rien à
     afficher » au-dessus d'une grille pleine serait le genre de contradiction
     qu'un panneau ne se permet pas. La vacuité se juge donc sur les deux :
     ni ligne, ni dessin. */
  const dessin = section.visuel ? section.visuel(paquet || {}) : null;
  $('visuel').replaceChildren(...(dessin ? [dessin] : []));
  $('visuel').hidden = !dessin;

  if (!lignes.length && !dessin) { montrerMessage('stateEmpty'); return; }

  $('message').hidden = true;
  /* Le tableau se montre s'il a de quoi : une section sans colonnes n'en a
     pas, et le cadre vide laisserait un rectangle creux sous le dessin. */
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
  /* Le mode d'emploi se range ici et NULLE PART AILLEURS. Une section de
     données peut finir en tableau, en dessin, en « rien à afficher » ou en
     échec de transport : quatre sorties, qu'il aurait fallu penser à couvrir
     chacune. Le ranger à l'entrée, avant de savoir laquelle on prendra, n'en
     laisse aucune de côté. */
  $('guide').hidden = true;
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

  if (section.statique) { montrerGuide(); return; }

  montrerMessage('stateLoading');
  const r = await demander({ section: id });
  if (courante !== id) return;             // l'utilisateur a changé entre-temps
  if (!r.ok) { montrerEchec(r); return; }
  peindre(section, r.data);
  if (id === 'diagnose') marquerEtat(r.data && r.data.resume);
};

/* La pastille d'en-tête ne s'allume que lorsqu'on a REGARDÉ le diagnostic :
   afficher « tout va bien » sans l'avoir demandé serait une affirmation que
   le panneau n'a pas vérifiée. */
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
  await charger(courante);                 // la vue reflète ce qui vient d'être fait
};

/* ============================================================
 *  LE RAPPORT DE DIAGNOSTIC
 *  ------------------------------------------------------------
 *  Un fichier texte, qu'on peut relire avant de l'envoyer.
 *
 *  POURQUOI DU TEXTE, ET PAS DU JSON. Tout ce qui précède promet
 *  que ce rapport ne contient aucune liste personnelle. Une
 *  promesse qu'on ne peut pas vérifier n'est qu'une affirmation :
 *  un fichier illisible obligerait à me croire sur parole. En
 *  texte aligné, la vérification prend dix secondes.
 *
 *  POURQUOI SES INTITULÉS NE SONT PAS TRADUITS. C'est un artefact
 *  technique, destiné à être lu par quelqu'un qui débogue et qui
 *  ne parle pas forcément la langue de celui qui l'envoie. Des
 *  champs stables se cherchent et se comparent d'un rapport à
 *  l'autre ; des intitulés traduits ne se cherchent pas. C'est la
 *  même règle que pour la couche de données : des noms de champs
 *  circulent, des libellés restent dans l'interface.
 *
 *  IL DOIT MARCHER QUAND RIEN NE MARCHE. C'est même son seul
 *  moment utile. Tout ce que le panneau sait par lui-même —
 *  version, cible, navigateur, état du transport — est écrit
 *  QUOI QU'IL ARRIVE ; ce qui vient de la page est demandé, et
 *  son échec est consigné à sa place plutôt que d'interrompre le
 *  rapport. Un rapport vide le jour de la panne n'aurait servi à
 *  personne.
 * ============================================================ */
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

/* LES ERREURS SE LISENT DANS LES DEUX CAS, et c'est pour cela que ce bloc est
   une fonction. Quand la page répond, elles viennent de son journal ; quand
   elle n'a pas fini de démarrer, elle en renvoie quand même ce qu'elle a — et
   c'est alors le seul contenu du rapport qui explique quoi que ce soit. Deux
   rédactions du même bloc auraient divergé au premier champ ajouté. */
const blocErreurs = (liste, origine, bilan) => bloc(
  `ERREURS / ERRORS (${(liste || []).length})${origine ? ' — ' + origine : ''}`,
  [
    /* LE BILAN EN TÊTE DU BLOC, avant les lignes. Le journal est borné à
       quarante PROBLÈMES DISTINCTS ; ces compteurs-là, eux, ne sont jamais
       évincés. Une panne réseau qui produit trois cents lignes n'occupe
       qu'une entrée du journal — mais le total dit qu'elle a eu lieu trois
       cents fois, et la dernière apparition dit si elle dure encore. C'est
       la différence entre « il y a eu un incident » et « il est en cours ». */
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
    /* L'ÉCHELLE, et pas seulement le total. « pret en 812 ms » ne dit pas où
       ces 812 ms sont passées ; le palier qui saute d'un coup nomme le
       coupable sans qu'on ait à le deviner. Six entrées, une ligne. */
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

  /* L'ÉTAT DU TRANSPORT EN PREMIER, avant tout ce qui vient de la page : c'est
     lui qui explique pourquoi le reste manque, quand il manque. */
  L.push(...bloc('TRANSPORT', [
    paire('onglet / tab', transport.onglet),
    paire('résultat / result', transport.ok ? 'ok' : (transport.erreur || 'échec')),
    ...(transport.detail ? [paire('détail / detail', transport.detail)] : []),
  ]));

  /* ── CE QUI NE TRAVERSE PAS LE PONT ───────────────────────────────────────
     Écrit TOUJOURS, et c'est tout l'objet de ce bloc. Le rapport d'un
     utilisateur est revenu avec deux lignes utiles : « expiration », puis
     « la page n'a pas répondu ». Rien sur le nombre d'essais, rien sur ce que
     le worker connaissait comme ponts, rien sur ce que le monde ISOLATED
     voyait de la page — alors que ces trois sources répondaient, elles, et
     qu'aucune n'avait besoin de la page pour parler.

     Le rendre conditionnel à l'échec serait la même faute en plus discret :
     un champ qu'on ne voit que lorsque ça va mal ne se compare à rien. */
  const obs = transport.observations;
  L.push(...bloc('DIAGNOSTIC HORS PAGE / OFF-PAGE DIAGNOSTIC', [
    paire('worker — ponts', fond?.ok ? (fond.ponts.join(', ') || 'aucun / none')
                                     : `injoignable (${fond?.erreur || '—'})`),
    ...(fond?.ok ? [paire('worker — âge', `${fond.workerMs} ms`),
                    paire('worker — en vol', fond.enVol)] : []),
    paire('essais / attempts', (transport.trace || [])
      .map(t => `#${t.essai} ${t.erreur} (${t.ms} ms)`).join('  →  ') || '—'),
    /* Vu depuis le monde ISOLATED, qui partage le DOM avec content.js sans
       partager son contexte. `marque` est le jalon posé par content.js : vide,
       il n'a jamais tourné dans cet onglet. */
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
    /* LE JOURNAL D'ERREURS SURVIT À L'ÉCHEC quand content.js a démarré assez
       loin pour l'avoir rempli : son pont répond avant même de savoir servir
       le reste, et il joint ce qu'il a. C'est le seul bloc du rapport qui
       explique une panne de démarrage, et il manquait entièrement. */
    L.push(...blocErreurs(transport.partiel?.erreurs, 'démarrage inachevé / partial boot'));
    L.push('La page n\'a pas répondu en entier : les blocs qui suivraient',
           'manquent. Les deux blocs ci-dessus disent ce qu\'on sait sans elle.',
           'The page did not fully answer: the blocks that would follow are',
           'missing. The two blocks above say what is known without it.', '');
    return L.join('\n');
  }

  L.push(...bloc('PAGE', aplatir(r.page)));
  /* LA SECTION SUIVIE, ET COMMENT ELLE A ÉTÉ TROUVÉE. Quinze appelants en
     dépendent ; quand elle se trompe, ils se taisent tous ensemble et le
     rapport ne portait rien qui le dise. Quatre lignes, juste après PAGE
     parce que c'est du même ordre : l'état du DOM sous nos pieds. */
  L.push(...bloc('SECTION SUIVIE / FOLLOWED SECTION', aplatir(r.sectionSuivie)));
  L.push(...bloc('LANGUE / LANGUAGE', aplatir(r.langue)));
  L.push(...bloc('MODE', aplatir(r.mode)));
  L.push(...bloc('COMPTEURS / COUNTS', aplatir(r.compteurs)));
  L.push(...bloc('FRISE DES CATÉGORIES / CATEGORY TRAIL', aplatir(r.frise)));
  /* LE SUBATHON A SON PROPRE BLOC, et il en a besoin. La règle qui le
     reconnaît ne lit que le titre du direct : elle n'a jamais pu être
     exécutée contre le vrai Twitch, et ces six lignes sont la seule mesure
     qu'on en aura. `detectes` vient du cache, `marquees` du DOM : leur écart
     dit laquelle des deux moitiés est en panne. `voies.*` dit quelle règle
     porte les cas.

     ÉCRIT MÊME À ZÉRO. Un rapport où tout vaut zéro n'est pas un rapport
     vide : il dit que la sidebar de cet utilisateur ne suit aucun subathon,
     ce qui écarte d'emblée la moitié des causes qu'on chercherait sinon. */
  L.push(...bloc('SUBATHONS', aplatir(r.subathons)));
  /* LE DÉLAI D'INTENTION DU SURVOL. Le seul réglage du produit dont on ne
     puisse pas dire depuis ici s'il est bien choisi : deux cents millisecondes
     se déduisent d'une géométrie (42 px de rangée) et d'un seuil de perception,
     pas d'une mesure sur de vraies mains. `armes` contre `ouverts` donne ce que
     le filtre a épargné ; leur rapport est ce qu'il faudra lire le jour où
     quelqu'un trouvera l'aperçu trop lent — ou trop bavard. */
  L.push(...bloc('SURVOL — DÉLAI D\'INTENTION / HOVER INTENT', aplatir(r.survol)));
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

  /* LES ERREURS EN PREMIER PARMI LES JOURNAUX, et jamais repliées : c'est la
     section qu'on cherche quand on ouvre un rapport. « (aucune) » est une
     information à part entière — elle dit que le problème n'est pas une
     exception, ce qui écarte d'emblée toute une famille de causes. */
  L.push(...blocErreurs(r.erreurs, '', r.bilanErreurs));

  /* Les sondes en tableau aligné : c'est la partie qu'on lit en premier quand
     quelque chose ne va pas, et une colonne qui glisse la rend illisible. */
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

/* ── LA VUE, ET NON UN FICHIER ────────────────────────────────────────────
   Première écriture : un <a download> sur un blob. Ce n'était pas faux, mais
   c'était le mauvais objet. Ce qu'on fait d'un rapport, c'est le COLLER dans
   une conversation — pas l'attacher ; et surtout, un fichier ne se relit pas
   avant d'être envoyé. Toutes les promesses ci-dessus (aucune liste
   personnelle, du texte lisible) n'étaient alors que des affirmations : le
   seul moyen de les vérifier était d'ouvrir le fichier après coup.

   Une zone de texte, à l'écran, dans le panneau, les rend VÉRIFIABLES avant
   le geste. C'est la même raison qui avait fait choisir le texte contre le
   JSON, poussée jusqu'au bout. */
const noter = (texte, erreur) => {
  const n = $('rapport-note');
  n.textContent = texte;
  n.className = 'pied-note' + (erreur ? ' pied-note--erreur' : '');
  n.hidden = false;
};

/* Le rapport est reconstruit à CHAQUE ouverture et à chaque actualisation :
   il date l'instant où on le lit, pas celui où le panneau s'est ouvert. C'est
   tout l'objet du bouton « Actualiser » — reprendre la mesure après avoir
   rechargé la page, sans refermer la vue. */
const remplirRapport = async () => {
  const zone = $('rapport-zone');
  const boutons = [$('rapport-copier'), $('rapport-actualiser')];
  boutons.forEach(b => { b.disabled = true; });
  $('rapport-note').hidden = true;
  zone.value = T('stateLoading');
  const onglet = await idOnglet();
  /* Les deux en parallèle : l'état du worker ne dépend pas de la page, et
     l'attendre en série ajouterait son aller-retour à une demande qui peut
     déjà tenir trois secondes. */
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

/* COPIER SANS PERMISSION. navigator.clipboard est la voie propre, mais elle
   peut être refusée — document non focalisé, politique du navigateur. Le repli
   n'exige rien de plus qu'un textarea réel : on sélectionne son contenu et on
   laisse le navigateur faire ce qu'il fait depuis toujours. C'est d'ailleurs
   la raison pour laquelle cette vue utilise un <textarea> plutôt qu'un <pre> :
   un <pre> ne se sélectionne pas par programme aussi sûrement.

   Et si les deux échouent, le texte reste À L'ÉCRAN, sélectionnable à la main.
   Un outil de dépannage ne doit pas avoir de mode « rien à offrir ». */
const copierRapport = async () => {
  const zone = $('rapport-zone');
  try {
    await navigator.clipboard.writeText(zone.value);
    noter(T('reportCopied'));
    return;
  } catch { /* on tente le repli */ }
  try {
    zone.focus();
    zone.setSelectionRange(0, zone.value.length);
    if (!document.execCommand('copy')) throw new Error('refusé');
    noter(T('reportCopied'));
  } catch {
    noter(T('reportFailed'), true);
  }
};

/* ── Confirmation ────────────────────────────────────────────────────────── */
let aConfirmer = null;
const confirmer = (titre, texte, suite) => {
  aConfirmer = suite;
  $('boite-titre').textContent = T(titre);
  $('boite-texte').textContent = T(texte);
  $('voile').hidden = false;
  $('boite-ok').focus();
};

/* ── Démarrage ───────────────────────────────────────────────────────────── */
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
  /* Échap ferme ce qui est ouvert, en commençant par le plus haut : la
     confirmation est POSÉE SUR le rapport, et refermer le rapport d'abord
     laisserait une boîte flottant sur un panneau qu'elle ne concerne plus. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('voile').hidden) { $('voile').hidden = true; aConfirmer = null; return; }
    if (!$('rapport').hidden) fermerRapport();
  });

  charger(courante);
});
