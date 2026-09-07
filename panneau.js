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

const T = (cle, sub) => chrome.i18n.getMessage(cle, sub) || cle;

/* Locale d'affichage pour les nombres et les dates. On suit celle de
   l'INTERFACE de l'extension, pas celle du système : si le panneau parle
   allemand, ses milliers doivent se grouper comme en allemand. */
const LOCALE = (chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || 'en';
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
  { id: 'scores',  groupe: 'grpData',
    tuiles: (r) => [['sumChannels', fmt.nombre(r.chaines)]] },

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
const idOnglet = () => (ongletP ??= chrome.tabs
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
const etatFond = () => chrome.runtime.sendMessage({ type: 'tse-panneau-etat' })
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
  const r = await chrome.runtime.sendMessage({ type: 'tse-panneau', tabId: onglet, ...charge })
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

  if (!lignes.length) { montrerMessage('stateEmpty'); return; }

  $('message').hidden = true;
  $('tableau-cadre').hidden = false;

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
  const m = chrome.runtime.getManifest();
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
  L.push(...bloc('LANGUE / LANGUAGE', aplatir(r.langue)));
  L.push(...bloc('MODE', aplatir(r.mode)));
  L.push(...bloc('COMPTEURS / COUNTS', aplatir(r.compteurs)));
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
