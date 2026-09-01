/* Captures de présentation pour le Chrome Web Store (1280 x 800).
   L'extension RÉELLE tourne dans Chromium, sur la page de test fidèle au DOM
   de Twitch : ce qu'on photographie est ce que le code produit, pas une
   maquette. Seules les données sont des fixtures, et les chaînes sont
   inventées pour n'emprunter l'identité de personne. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI  = dirname(fileURLToPath(import.meta.url));
const T    = join(ICI, 'tests');
const OUT  = process.env.PROMO_OUT || join(ICI, 'promo');
mkdirSync(OUT, { recursive: true });
const lire = (n) => readFileSync(join(T, n), 'utf8');

// ── Palette d'avatars : SVG déterministe par login, sans emprunter de visage
const AV = ['#9147ff','#26d4c8','#f5c518','#7ee081','#4d8cff','#ff7a8a','#c77dff','#ff9f43'];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const avatar = (login) => {
  const c = AV[hash(login) % AV.length];
  const l = (login[0] || '?').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#18181b"/></linearGradient></defs>
    <rect width="70" height="70" rx="35" fill="url(#g)"/>
    <text x="35" y="46" font-family="Inter,Helvetica,Arial" font-size="30" font-weight="700"
          fill="#fff" text-anchor="middle" opacity=".92">${l}</text></svg>`;
};
// Vignette d'aperçu : dégradé abstrait. Volontairement NON figuratif — une
// fausse image de jeu laisserait croire à un contenu qui n'existe pas.
const vignette = (login) => {
  const c = AV[hash(login) % AV.length], d = AV[(hash(login) + 3) % AV.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c}" stop-opacity=".55"/>
      <stop offset=".55" stop-color="#1f1f23"/>
      <stop offset="1" stop-color="${d}" stop-opacity=".35"/></linearGradient></defs>
    <rect width="480" height="270" fill="#0e0e10"/><rect width="480" height="270" fill="url(#g)"/>
    </svg>`;
};


/* Reconstruction de l'habillage de Twitch pour le markup de tests/page.html.
   La page de test reproduit la STRUCTURE du DOM, pas l'apparence : sans ces
   règles, les cartes s'affichent en liens bleus soulignés. Les décorations de
   l'extension (durée, couleurs de co-stream, barre « stream frais », bloc
   filtre, aperçu) sont, elles, produites par le code réel. */
const CSS_TWITCH = `
  #side-nav { width:240px; background:#1f1f23; padding:0 0 6px; }
  .side-nav__title { padding:14px 10px 8px; }
  .side-nav__title h3 { margin:0; font-size:13px; font-weight:600; color:#efeff1;
    text-transform:uppercase; letter-spacing:.4px; }
  .side-nav-section { padding:0 6px; }
  #cards, #reco { display:flex; flex-direction:column; }
  .side-nav-card { border-radius:4px; }
  .side-nav-card:hover { background:rgba(255,255,255,.06); }
  .side-nav-card__link { display:flex; align-items:center; gap:9px;
    padding:5px 6px; text-decoration:none; color:inherit; }
  .side-nav-card__avatar { flex:0 0 auto; }
  /* La marge par défaut du navigateur sur <figure> vaut 1em 40px : sans cette
     remise à zéro, l'avatar occupait 104 px au lieu de 30 et écrasait la
     colonne du pseudo. Twitch, lui, a son propre reset. */
  .side-nav-card__avatar figure, .tw-avatar { display:block; margin:0; }
  .side-nav-card__avatar { width:30px; height:30px; position:relative; }
  .side-nav-card__avatar img { display:block; width:30px; height:30px; border-radius:50%; }
  .side-nav-card__avatar--offline img { opacity:.5; filter:grayscale(1); }
  .mainblock { flex:1 1 auto; min-width:0; width:100%; display:flex;
    align-items:center; gap:8px; }
  .metacell { flex:1 1 auto; min-width:0; width:100%; display:flex;
    align-items:center; justify-content:space-between; gap:10px; }
  [data-a-target="side-nav-card-metadata"] { flex:1 1 auto; min-width:0; }
  .side-nav-card__live-status { flex:0 0 auto; }
  [data-a-target="side-nav-title"] { margin:0; font-size:13px; font-weight:600;
    color:#efeff1; line-height:1.25; white-space:nowrap; overflow:hidden;
    text-overflow:ellipsis; }
  [data-a-target="side-nav-card-metadata"] p + p { margin:0; font-size:12px;
    color:#adadb8; line-height:1.25; white-space:nowrap; overflow:hidden;
    text-overflow:ellipsis; }
  .side-nav-card__live-status { flex:0 0 auto; text-align:right; }
  .side-nav-card__live-status > div > div { display:flex; align-items:center;
    justify-content:flex-end; gap:5px; font-size:12px; color:#adadb8;
    font-variant-numeric:tabular-nums; }
  .tw-channel-status-indicator { width:8px; height:8px; border-radius:50%;
    background:#eb0400; display:inline-block; }
  .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  button[data-a-target="side-nav-show-more-button"] { display:none; }
  .side-nav-header h4 { margin:0; padding:12px 10px 6px; font-size:13px;
    font-weight:600; color:#efeff1; text-transform:uppercase; letter-spacing:.4px; }
`;

/* Mémoire d'abonnements : exactement ce que le relevé de /subscriptions aurait
   écrit chez quelqu'un qui revient sur Twitch. POSÉE plutôt que relevée, pour
   deux raisons — la page de test sert cet onglet avec de VRAIS pseudos, que ces
   captures n'empruntent jamais (d'où aussi le __noSubsPage de pageProduit) ; et
   une capture ne doit pas dépendre d'une course entre le relevé et l'obturateur.
   Le format est celui de subs.save() : par chaîne, [abonné, horodatage, mois,
   révolu]. Partagée entre les captures et la tuile, qui montrent la même
   mémoire. */
export const ABOS = (() => {
  const N = Date.now();
  // En cours. Les quatre premiers sont suivis — ce sont eux que la barre dore.
  // Les huit autres n'émettent pas et ne se voient que par le total porté par
  // la pastille du tri : c'est justement ce que cette pastille compte.
  const encours = { lumenkai:26, mirabelle:12, kiraplays:9, duskraven:4,
                    solstice_tv:31, valehart:18, zephyrlane:14, ravencourt:11,
                    brumefall:7, ombrelune:5, cendrelune:3, halcyonis:1 };
  // Révolu : ni doré, ni compté. Présent pour que la capture montre un état
  // réel — on a été abonné à atlasgaming, on ne l'est plus, et sa carte reste
  // une carte ordinaire.
  const revolus = { atlasgaming:6 };
  const o = {};
  for (const [l, m] of Object.entries(encours)) o[l] = [1, N, m, 0];
  for (const [l, m] of Object.entries(revolus)) o[l] = [0, N, m, 1];
  return {
    'tse:subs': JSON.stringify(o),
    // Horodatage du relevé, au format du lecteur courant. Il n'est pas seulement
    // là pour éviter une visite : il dit à la barre qu'elle SAIT déjà, ce qui
    // lui évite de retenir le voile au démarrage.
    'tse:substs': '2:' + N,
  };
})();

const browser = await chromium.launch();

// Libellé natif de la section suivie, par langue d'interface. detectLanguage()
// le cherche AVANT de regarder <html lang> : sans cette substitution, toutes
// les scènes rendraient en français quelle que soit la langue demandée.
// Clé = code de FICHE (es419 et ptpt sont des fiches distinctes), pas code de
// langue de l'extension : es-419 partage l'interface espagnole, pt-PT et pt-BR
// partagent l'interface portugaise mais PAS ce libellé, que Twitch traduit
// différemment de part et d'autre de l'Atlantique.
const SECTION = {
  fr: 'Chaînes suivies', en: 'Followed Channels', de: 'Kanäle, denen du folgst',
  es: 'Canales que sigues', es419: 'Canales que sigues',
  ptbr: 'Canais seguidos', ptpt: 'Canais que segues',
};

/**
 * Ouvre une page qui fait tourner l'extension RÉELLE contre le faux Twitch.
 * Extraite de scene() parce que la tuile promotionnelle en a besoin à
 * l'identique : mêmes routes, mêmes avatars, même stub, même historique.
 */
export async function pageProduit({ lang = 'fr', section = null, visites = null,
                                    stockage = null,
                                    viewport = { width: 1280, height: 800 },
                                    deviceScaleFactor = 2 } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  page.on('pageerror', e => console.log('  ERREUR PAGE:', e.message));
  await page.route('https://www.twitch.tv/**', (r) => {
    const n = r.request().url().split('/').pop().split('?')[0];
    if (n.endsWith('.js')) return r.fulfill({ contentType: 'application/javascript; charset=utf-8', body: lire(n) });
    const libelle = SECTION[section || lang];
    if (!libelle) throw new Error('libellé de section inconnu pour : ' + (section || lang));
    return r.fulfill({ contentType: 'text/html; charset=utf-8',
                       body: lire('page.html')
                         .replace('<html lang="fr">', `<html lang="${lang}">`)
                         .replaceAll('Chaînes suivies', libelle) });
  });
  // Zone vidéo de l'aperçu. Un dégradé abstrait, volontairement NON figuratif :
  // une fausse image de jeu ferait croire à un contenu qui n'existe pas.
  await page.route('https://player.twitch.tv/**', (r) =>
    r.fulfill({ contentType: 'text/html; charset=utf-8', body:
      '<body style="margin:0;height:100vh;background:' +
      'radial-gradient(120% 90% at 22% 18%, rgba(145,71,255,.55), transparent 62%),' +
      'radial-gradient(110% 80% at 82% 88%, rgba(38,212,200,.38), transparent 60%),' +
      'linear-gradient(145deg,#241a3d 0%,#14131c 52%,#1b2b32 100%)"></body>' }));
  const svg = (body) => ({ contentType: 'image/svg+xml; charset=utf-8', body });
  const loginDe = (u) => (/\/(?:api-)?([a-z0-9_]+)\.png/i.exec(u) || [, 'x'])[1];
  await page.route('https://static-cdn.jtvnw.net/**', (r) => {
    const u = r.request().url();
    const m = /previews-ttv\/live_user_([a-z0-9_]+)/i.exec(u);
    return r.fulfill(svg(m ? vignette(m[1]) : avatar(loginDe(u))));
  });
  // Deux formes d'URL cohabitent : celle du markup de la page de test
  // (« /login.png ») et celle que rend l'API sur les cartes fabriquées
  // (« /api-login.png »). Sans le préfixe optionnel, les secondes tombaient
  // toutes sur le même avatar de repli.
  await page.route('https://cdn/**', (r) => r.fulfill(svg(avatar(loginDe(r.request().url())))));
  // Le relevé de /subscriptions est COUPÉ pour toutes les captures. La page de
  // test sert cet onglet avec de VRAIS pseudos — c'est ce qu'il faut pour
  // éprouver le module, et c'est exactement ce qu'une image publiée ne doit pas
  // porter. Le drapeau vaut aussi dans l'iframe : addInitScript s'installe sur
  // toutes les frames de la page. Ce que les captures montrent d'abonnements
  // vient donc de `stockage`, et de lui seul.
  await page.addInitScript(() => { window.__noSubsPage = true; });
  // L'historique de visites doit exister AVANT le démarrage du script, sinon
  // le tri « popularité perso » n'a rien à classer.
  if (visites) await page.addInitScript((v) => {
    try { localStorage.setItem('tse:visits', JSON.stringify(v)); } catch {}
  }, visites);
  // Mémoire arbitraire, posée avant le démarrage du script — même raison que
  // l'historique ci-dessus. Sert au relevé des abonnements : la scène veut un
  // navigateur qui SAIT déjà, pas un qui va aller lire. Poser aussi
  // l'horodatage du relevé est indispensable, sinon le module repart en visite
  // et l'iframe rendrait la page de test avec SES chaînes — de vrais pseudos,
  // que ces captures n'empruntent jamais.
  if (stockage) await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch {}
  }, stockage);
  await page.goto('https://www.twitch.tv/');
  return page;
}

export async function scene({ nom, lang = 'fr', section = null, titre, sousTitre, jeu, jeuArg = null, apres,
                             echelleMax = 1.42, texteEtroit = false, visites = null, stockage = null }) {
  const page = await pageProduit({ lang, section, visites, stockage });
  await page.evaluate(jeu, jeuArg);
  await page.waitForTimeout(2200);
  if (apres) await apres(page);
  await page.evaluate(habiller, { titre, sousTitre, CSS: CSS_TWITCH, echelleMax, texteEtroit });
  await page.waitForTimeout(500);
  if (process.env.PROMO_DEBUG) {
    console.log(JSON.stringify(await page.evaluate(() => {
      const c = document.querySelector('.side-nav-card');
      const w = (s) => { const e = c.querySelector(s); return e ? +e.getBoundingClientRect().width.toFixed(1) : null; };
      const cadre = document.getElementById('promo-cadre').getBoundingClientRect();
      const nav = document.getElementById('side-nav').getBoundingClientRect();
      return { cadre: [Math.round(cadre.top), Math.round(cadre.bottom), Math.round(cadre.width)],
               navH: Math.round(nav.height), cartes: document.querySelectorAll('.side-nav-card').length,
               av: w('.side-nav-card__avatar'), img: w('.side-nav-card__avatar img'),
               lien: w('.side-nav-card__link'), main: w('.mainblock'), meta: w('.metacell'),
               titre: w('[data-a-target="side-nav-title"]'), statut: w('.side-nav-card__live-status') };
    })));
  }
  // Rendu en 2x pour la finesse du texte, puis RÉDUIT à 1280x800 : le Chrome
  // Web Store exige cette taille EXACTE et refuse tout le reste. Le
  // rééchantillonnage est fait par Chromium lui-même (canvas, lissage haute
  // qualité) — aucune dépendance de plus, et un piqué bien meilleur qu'un
  // rendu direct en 1x.
  // Le texte grandit : un débordement doit se voir ici, pas dans une image
  // publiée. On mesure la colonne de droite et le bandeau de marque.
  const trop = await page.evaluate(() => {
    const t = document.getElementById('promo-texte');
    const m = document.getElementById('promo-marque');
    const rt = t.getBoundingClientRect(), rm = m.getBoundingClientRect();
    const h1 = t.querySelector('h1');
    // Le plancher se DÉDUIT du cadre au lieu d'être un nombre écrit à la main :
    // l'échelle du cadre dépend de la hauteur de la liste, donc son bord droit
    // bouge d'une scène à l'autre. Une constante devait valoir pour la scène la
    // plus large, et interdisait donc au texte des autres scènes la place qu'il
    // avait pourtant. Vingt-quatre pixels : la gouttière minimale sous laquelle
    // les deux blocs cessent de se lire comme deux blocs.
    const plancher = Math.round(
      document.getElementById('promo-cadre').getBoundingClientRect().right + 24);
    // La fenêtre d'aperçu, quand la scène en pose une. Elle est reposée à la
    // main dans promo-run.mjs, donc rien ne l'empêche de venir mordre sur la
    // colonne de texte — sauf cette mesure. Elle vaut la distance qui les
    // sépare : négative, elles se chevauchent.
    const pv = document.querySelector('.tse-preview');
    // Le chapô est une pastille : sur deux lignes, ce n'en est plus une, et
    // rien dans les mesures de la colonne ne le dirait — un retour à la ligne
    // ne déborde de rien. On lui interdit donc de se replier le temps d'une
    // mesure, et on regarde de combien il dépasserait. Le style est rendu
    // avant la capture, qui reste donc celle de la mise en page réelle.
    const k = t.querySelector('.kicker');
    let chapo = 0;
    if (k) {
      const avant = k.style.whiteSpace;
      k.style.whiteSpace = 'nowrap';
      chapo = Math.round(k.getBoundingClientRect().width - rt.width);
      k.style.whiteSpace = avant;
    }
    return {
      plancher, chapo,
      hors: rt.top < 8 || rt.bottom > 792 || rt.right > 1274 || rt.left < plancher,
      coupe: h1 ? Math.round(h1.scrollWidth - h1.clientWidth) : 0,
      chevauche: rt.bottom > rm.top - 8,
      marque: Math.round(rm.left) < plancher,
      ecart: pv ? Math.round(rt.left - pv.getBoundingClientRect().right) : null,
    };
  });
  if (trop.hors || trop.coupe > 0 || trop.chapo > 0 || trop.chevauche || trop.marque ||
      (trop.ecart !== null && trop.ecart < 12)) {
    console.log('  ⚠ mise en page :', nom, JSON.stringify(trop));
  }

  const brut = await page.screenshot();
  await page.close();
  const reduite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const b64 = await reduite.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 800;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, 1280, 800);
    return c.toDataURL('image/png').split(',')[1];
  }, 'data:image/png;base64,' + brut.toString('base64'));
  await reduite.close();
  writeFileSync(join(OUT, `${nom}.png`), Buffer.from(b64, 'base64'));
  console.log('  ✓', `${nom}.png`);
}

/* Mise en scène : fond sombre, halo violet, la sidebar RÉELLE agrandie dans un
   cadre, et le discours à droite. Rien n'est redessiné — on déplace et on
   agrandit le nœud que l'extension a produit. */
function habiller({ titre, sousTitre, CSS, echelleMax, texteEtroit }) {
  const nav = document.getElementById('side-nav');
  const stories = document.querySelector('[data-tse-stories="row"]');
  const bloc = document.createElement('div');
  bloc.id = 'promo-cadre';
  const st = document.createElement('style');
  st.textContent = CSS + `
    html, body { margin:0; padding:0; width:1280px; height:800px; overflow:hidden;
      background:#0a0a0c; font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;
      -webkit-font-smoothing:antialiased; }
    body::before { content:''; position:fixed; inset:0;
      background:
        radial-gradient(900px 640px at 20% 34%, rgba(145,71,255,.26), transparent 62%),
        radial-gradient(720px 520px at 92% 92%, rgba(38,212,200,.10), transparent 60%),
        linear-gradient(158deg,#111014 0%,#0a0a0c 55%,#131017 100%); }
    #root { position:fixed; inset:0; pointer-events:none; }
    #promo-cadre { position:absolute; left:80px; top:400px;
      transform:translateY(-50%) scale(var(--promo-scale,1.4)); transform-origin:left center;
      width:264px; max-height:var(--promo-max,520px); overflow:hidden;
      padding:10px 6px 12px; border-radius:14px;
      background:#1f1f23; border:1px solid rgba(255,255,255,.08);
      box-shadow:0 34px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(145,71,255,.13); }
    /* La colonne de texte occupe la place LAISSÉE par le cadre : celui-ci
       s'arrête vers 475 px, et le texte commençait à 680 — deux cent
       cinquante pixels de vide au milieu, payés par une typographie plus
       petite qu'elle n'avait besoin de l'être. Élargie, elle porte des
       corps plus grands sans que rien ne se rapproche du cadre. */
    #promo-texte { position:fixed; right:46px; top:50%; transform:translateY(-50%);
      width:690px; color:#efeff1; }
    /* Variante étroite : la scène de l'aperçu pose la fenêtre de survol au
       milieu, et c'est ELLE qui borne la colonne, pas le cadre. La marge y
       est donc gagnée au pixel près (cf. la repose de l'aperçu dans
       promo-run.mjs), et les corps grandissent moins qu'à côté. */
    body.promo-etroit #promo-texte { right:40px; width:378px; }
    body.promo-etroit #promo-texte h1 { font-size:54px; letter-spacing:-1.5px; }
    body.promo-etroit #promo-texte p { font-size:24px; max-width:372px; }
    /* Le chapô ne suit pas les autres corps dans la variante étroite : c'est
       une pastille, et une pastille sur deux lignes n'est plus une pastille.
       « PRÉ-VISUALIZAÇÃO AO PASSAR » est le plus long des sept, et c'est lui
       qui fixe ce nombre. Le garde-fou « chapo » de scene() vérifie qu'aucun
       autre ne passe à la ligne. */
    body.promo-etroit #promo-texte .kicker { font-size:17px; }
    #promo-texte .kicker { display:inline-block; padding:8px 17px; border-radius:999px;
      background:rgba(145,71,255,.16); border:1px solid rgba(145,71,255,.40);
      color:#c9a6ff; font-size:19px; font-weight:700; letter-spacing:.10em;
      text-transform:uppercase; margin-bottom:28px; }
    #promo-texte h1 { margin:0 0 24px; font-size:78px; line-height:1.04;
      font-weight:800; letter-spacing:-2.2px; }
    #promo-texte h1 em { font-style:normal; color:#a970ff; }
    #promo-texte p { margin:0; font-size:29px; line-height:1.5; color:#bcbcc8;
      font-weight:400; max-width:674px; }
    #promo-marque { position:fixed; right:46px; bottom:36px; color:#707082;
      font-size:20px; font-weight:600; }
    #promo-marque b { color:#dedee3; font-weight:800; }
  `;
  document.head.appendChild(st);
  document.body.appendChild(bloc);
  if (stories) stories.remove();
  bloc.appendChild(nav);

  if (texteEtroit) document.body.classList.add('promo-etroit');

  const txt = document.createElement('div');
  txt.id = 'promo-texte';
  txt.innerHTML = titre;
  document.body.appendChild(txt);

  /* L'échelle n'est pas choisie à l'avance : elle se déduit de la hauteur
     réelle de la liste, pour que le cadre tienne dans les 800 px sans jamais
     couper une carte en deux. Au-delà, un fondu en bas dit que la liste
     continue — plutôt qu'une coupe nette qui aurait l'air d'un bug. */
  requestAnimationFrame(() => {
    // Mesure à l'échelle 1, sinon on mesurerait le résultat de l'échelle qu'on
    // cherche justement à calculer.
    bloc.style.setProperty('--promo-scale', '1');
    bloc.style.setProperty('--promo-max', 'none');
    void bloc.offsetHeight;
    const h = nav.getBoundingClientRect().height;
    const DISPO = 700;
    const echelle = Math.max(1, Math.min(echelleMax, DISPO / h));
    bloc.style.setProperty('--promo-scale', echelle.toFixed(3));
    // Débordement : plutôt qu'une coupe nette qui aurait l'air d'un bug, un
    // fondu en bas — la liste continue, et ça se voit.
    if (h * echelle > DISPO) {
      bloc.style.setProperty('--promo-max', Math.round(DISPO / echelle) + 'px');
      bloc.style.maskImage = 'linear-gradient(#000 76%, transparent 99%)';
      bloc.style.webkitMaskImage = 'linear-gradient(#000 76%, transparent 99%)';
    }
  });

  const marque = document.createElement('div');
  marque.id = 'promo-marque';
  marque.innerHTML = sousTitre;
  document.body.appendChild(marque);
}

export { browser };
