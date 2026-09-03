/* Captures de présentation pour le Chrome Web Store (1280 x 800).
   L'extension RÉELLE tourne dans Chromium, sur la page de test fidèle au DOM
   de Twitch : ce qu'on photographie est ce que le code produit, pas une
   maquette. Seules les données sont des fixtures, et les chaînes sont
   inventées pour n'emprunter l'identité de personne. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI  = dirname(fileURLToPath(import.meta.url));
const T    = join(ICI, 'tests');
const OUT  = process.env.PROMO_OUT || join(ICI, 'promo');
mkdirSync(OUT, { recursive: true });
const lire = (n) => readFileSync(join(T, n), 'utf8');

/* ── Avatars : image déterministe par login, sans emprunter de visage.
   Ils portaient l'initiale de la chaîne sur un dégradé. C'était lisible, et
   c'était visiblement un bouche-trou : sur une vraie barre latérale, ces
   trente pixels portent une photo, et une lettre disait « capture d'essai ».
   Ce sont donc maintenant des compositions abstraites — deux teintes tirées du
   pseudo, un foyer clair et un foyer sombre placés par le même hachage, un
   liseré. À la taille où on les voit, elles se lisent comme des photos qu'on
   ne distingue pas ; c'est exactement ce qu'on veut, et personne n'y est
   représenté. */
const AV = ['#9147ff','#26d4c8','#f5c518','#7ee081','#4d8cff','#ff7a8a','#c77dff','#ff9f43'];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const avatar = (login) => {
  const h = hash(login);
  const a = AV[h % AV.length];
  const b = AV[(h >> 3) % AV.length];
  // Positions tirées du hachage : deux chaînes voisines n'ont pas la même
  // image, et la même chaîne a toujours la sienne — une capture reprise
  // demain rend le même fichier.
  const p = (n, min, max) => min + ((h >> n) % 1000) / 1000 * (max - min);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70">
    <defs>
      <!-- Le fond couvre le disque ENTIER : un dégradé radial y laissait des
           coins morts, et l'avatar sortait presque noir. -->
      <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <radialGradient id="h" cx="${p(2, 22, 62).toFixed(1)}%" cy="${p(5, 14, 46).toFixed(1)}%" r="58%">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".42"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
      <radialGradient id="o" cx="${p(11, 48, 92).toFixed(1)}%" cy="${p(14, 58, 96).toFixed(1)}%" r="62%">
        <stop offset="0" stop-color="#0b0a0f" stop-opacity=".55"/>
        <stop offset="1" stop-color="#0b0a0f" stop-opacity="0"/></radialGradient>
      <clipPath id="d"><circle cx="35" cy="35" r="35"/></clipPath>
    </defs>
    <g clip-path="url(#d)">
      <rect width="70" height="70" fill="url(#f)"/>
      <rect width="70" height="70" fill="url(#o)"/>
      <rect width="70" height="70" fill="url(#h)"/>
    </g>
    <circle cx="35" cy="35" r="34.5" fill="none" stroke="#000" stroke-opacity=".3"/>
  </svg>`;
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


/* Inter — la police de l'interface de Twitch, embarquée.

   Sans elle, rien de ce qui est photographié n'a le bon dessin : le conteneur
   n'a ni Inter, ni Helvetica, ni Arial, et tout retombait sur DejaVu Sans, une
   police qui n'est celle de personne. Le défaut se voyait deux fois — sur le
   markup de Twitch, et sur l'extension elle-même, dont le CSS demande
   `var(--font-base, "Inter", sans-serif)`.

   Embarquée en base64 plutôt que chargée d'un CDN : une capture ne doit pas
   dépendre du réseau pour être reproductible. Quatre sous-ensembles — latin,
   latin étendu, cyrillique et cyrillique étendu — en fichier VARIABLE : un seul
   fichier par sous-ensemble couvre toutes les graisses, ce qui coûte moins que
   quatre fichiers statiques. Le cyrillique étendu ne sert à AUCUN texte
   d'aujourd'hui : le russe tient entièrement dans le bloc de base. Il est là
   parce qu'il est le pendant naturel du latin étendu, qu'il coûte vingt-cinq
   kilo-octets, et qu'une fiche ukrainienne ou serbe le demanderait sans
   prévenir. Ce n'est pas un besoin, c'est une provision — et c'est dit.

   Le cyrillique n'était pas là avant la douzième fiche : sans lui, le russe
   sortait en DejaVu Sans, la police par défaut du conteneur — un dessin qui
   n'est celui de personne, et que rien ne signalait puisque le contrôle de
   police mesurait une chaîne latine, servie par Inter comme il se doit.

   Inter n'a en revanche AUCUN idéogramme, et ce n'est pas un manque : Twitch
   non plus. Sa pile est « Inter, Roobert, Helvetica Neue, Helvetica, Arial,
   sans-serif », dont aucun ne couvre le CJK ; sur une vraie machine japonaise,
   le navigateur descend jusqu'à la police système. On reproduit donc ce
   comportement, avec Noto Sans JP et Noto Sans SC en DERNIER recours, taillées
   aux caractères de ces captures par `npm run polices`. Le latin des mêmes
   pages continue de venir d'Inter, qui passe en premier.

   SIL Open Font License 1.1 pour les trois familles — les textes complets sont
   dans promo-fonts/OFL.txt et promo-fonts/OFL-noto.txt, comme l'exige la
   licence pour toute redistribution. */
const woff2 = (n) => 'data:font/woff2;base64,' +
  readFileSync(join(ICI, 'promo-fonts', n)).toString('base64');
const POLICE = `
  @font-face { font-family:'Inter'; font-style:normal; font-weight:100 900;
    src:url(${woff2('inter-latin.woff2')}) format('woff2');
    unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,
      U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,
      U+FEFF,U+FFFD; }
  @font-face { font-family:'Inter'; font-style:normal; font-weight:100 900;
    src:url(${woff2('inter-latin-ext.woff2')}) format('woff2');
    unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,
      U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,
      U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
  @font-face { font-family:'Inter'; font-style:normal; font-weight:100 900;
    src:url(${woff2('inter-cyrillic.woff2')}) format('woff2');
    unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
  @font-face { font-family:'Inter'; font-style:normal; font-weight:100 900;
    src:url(${woff2('inter-cyrillic-ext.woff2')}) format('woff2');
    unicode-range:U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,
      U+FE2E-FE2F; }
  @font-face { font-family:'Noto Sans JP'; font-style:normal; font-weight:100 900;
    src:url(${woff2('noto-sans-jp-cjk.woff2')}) format('woff2'); }
  @font-face { font-family:'Noto Sans SC'; font-style:normal; font-weight:100 900;
    src:url(${woff2('noto-sans-sc-cjk.woff2')}) format('woff2'); }
`;

/* Reconstruction de l'habillage de Twitch pour le markup de tests/page.html.
   La page de test reproduit la STRUCTURE du DOM, pas l'apparence : sans ces
   règles, les cartes s'affichent en liens bleus soulignés. Les décorations de
   l'extension (durée, couleurs de co-stream, barre « stream frais », bloc
   filtre, aperçu) sont, elles, produites par le code réel. */
export const CSS_TWITCH = POLICE + `
  /* La pile de Twitch, à l'identique, et posée là où Twitch la pose : sur la
     racine, en variable. L'extension lit --font-base — c'est donc le VRAI
     chemin qu'on éprouve, pas un repli qui n'existerait qu'ici. */
  :root { --font-base: Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif; }
  /* Le CJK est ajouté APRÈS toute la pile de Twitch, et par :lang() plutôt que
     par un réglage passé au script : c'est la langue du document qui décide,
     comme chez le navigateur. Deux raisons de ne pas mettre les deux familles
     dans la même pile — la première gagnerait toujours, et le chinois sortirait
     avec les formes japonaises ; et l'ordre importe aussi pour le latin, qui
     doit continuer de venir d'Inter sur ces deux pages-là. */
  :root:lang(ja) { --font-base: Inter, Roobert, "Helvetica Neue", Helvetica, Arial,
                                "Noto Sans JP", sans-serif; }
  :root:lang(zh) { --font-base: Inter, Roobert, "Helvetica Neue", Helvetica, Arial,
                                "Noto Sans SC", sans-serif; }
  /* Twitch lisse ses polices ; sans cette ligne le même texte sort plus gras
     ici que là-bas, ce qui se voit surtout sur les petits corps de la barre. */
  html, body { font-family: var(--font-base); -webkit-font-smoothing: antialiased; }
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

/* ── Encodeur PNG 24 bits, SANS canal alpha ───────────────────────────────
   Le Chrome Web Store demande la même chose des trois formats qu'il accepte —
   captures 1280 x 800, tuile 440 x 280, bannière 1400 x 560 : « JPEG ou PNG
   24 bits (sans alpha) ». Or une capture de Playwright est un PNG RGBA :
   opaque, mais avec un canal alpha quand même. Les images sortaient donc en
   type 6, et le Store était en droit de les refuser — ce qu'il fait selon les
   emplacements. Le JPEG serait la réponse facile, mais son sous-échantillonnage
   de chrominance abîme précisément ce qui compte ici, les bords colorés du
   texte doré et du violet.

   D'où cet encodeur : type 2 (truecolor), 8 bits par canal, aucun entrelacement.
   Chaque ligne est essayée avec les cinq filtres du format et l'on garde celui
   dont la somme des écarts absolus est la plus faible — l'heuristique de la
   spécification. Sur un dégradé, elle divise le poids par plus de deux face au
   filtre « None » systématique. */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const bloc = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td  = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
};
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
};
export function png24(rgba, w, h) {
  const bpl = w * 3;                 // octets par ligne, alpha retiré
  const brut = Buffer.alloc(h * (1 + bpl));
  const cour = Buffer.alloc(bpl);    // ligne courante, non filtrée
  const prec = Buffer.alloc(bpl);    // ligne précédente, non filtrée elle aussi :
                                     // les filtres PNG se réfèrent au signal
                                     // reconstruit, pas au signal encodé.
  const essai = Array.from({ length: 5 }, () => Buffer.alloc(bpl));
  let o = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, j = x * 3;
      cour[j] = rgba[i]; cour[j + 1] = rgba[i + 1]; cour[j + 2] = rgba[i + 2];
    }
    let meilleur = 0, meilleureSomme = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = essai[f];
      let somme = 0;
      for (let j = 0; j < bpl; j++) {
        const a = j >= 3 ? cour[j - 3] : 0;
        const b = prec[j];
        const c = j >= 3 ? prec[j - 3] : 0;
        const v = f === 0 ? cour[j]
                : f === 1 ? cour[j] - a
                : f === 2 ? cour[j] - b
                : f === 3 ? cour[j] - ((a + b) >> 1)
                :           cour[j] - paeth(a, b, c);
        out[j] = v & 0xFF;
        somme += out[j] < 128 ? out[j] : 256 - out[j];
      }
      if (somme < meilleureSomme) { meilleureSomme = somme; meilleur = f; }
    }
    brut[o++] = meilleur;
    essai[meilleur].copy(brut, o); o += bpl;
    cour.copy(prec);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;    // 8 bits par canal
  ihdr[9] = 2;    // type 2 : truecolor, SANS alpha — toute la raison de ce code
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const fichier = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);
  // Contrôle de l'en-tête PRODUIT, pas de l'intention : on relit ce qu'on
  // s'apprête à rendre. C'est la seule preuve qui vaille pour la contrainte du
  // Store, et elle ne coûte rien.
  if (fichier.readUInt32BE(16) !== w || fichier.readUInt32BE(20) !== h) {
    throw new Error(`taille encodée : ${fichier.readUInt32BE(16)} x ${fichier.readUInt32BE(20)}`);
  }
  if (fichier[24] !== 8) throw new Error(`profondeur encodée : ${fichier[24]} bits`);
  if (fichier[25] !== 2) throw new Error(`type de couleur encodé : ${fichier[25]} (2 attendu)`);
  return fichier;
}

const browser = await chromium.launch();

/**
 * Réduit une capture rendue en 2x à sa taille finale, puis l'encode en PNG 24
 * bits sans alpha. Le rééchantillonnage est fait par Chromium (canvas, lissage
 * haute qualité) : aucune dépendance de plus, et un piqué bien meilleur qu'un
 * rendu direct en 1x.
 */
export async function reduireEnPng24(brut, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const b64 = await page.evaluate(async ({ src, w, h }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    // alpha:false : le canvas est opaque, donc rien ne peut se glisser sous
    // l'image. L'absence d'alpha du FICHIER, elle, est garantie par png24 et
    // par son contrôle d'en-tête, pas par ce drapeau.
    const g = c.getContext('2d', { alpha: false });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    // Transfert en base64 : un tableau typé rendu tel quel deviendrait un objet
    // à plusieurs millions de clés numériques.
    let s = '';
    const pas = 0x8000;
    for (let i = 0; i < px.length; i += pas) {
      s += String.fromCharCode.apply(null, px.subarray(i, Math.min(i + pas, px.length)));
    }
    return btoa(s);
  }, { src: 'data:image/png;base64,' + brut.toString('base64'), w, h });
  await page.close();
  const rgba = Buffer.from(b64, 'base64');
  if (rgba.length !== w * h * 4) {
    throw new Error(`pixels attendus : ${w * h * 4} octets, reçus : ${rgba.length}`);
  }
  return png24(rgba, w, h);
}

/**
 * Les caractères que la page ÉCRIT et qu'aucune police embarquée ne couvre.
 *
 * Une police manquante ne casse rien : le navigateur descend jusqu'à ce qu'il
 * trouve un dessin, et l'image sort avec la police du conteneur — ou avec un
 * carré vide. Rien dans le rendu ne le dit, et une fiche publiée le dirait à
 * tout le monde. Le contrôle qui existait comparait la LARGEUR d'une chaîne
 * latine demandée à Inter puis à une famille absente : il prouve qu'Inter est
 * là, et c'est tout ce qu'il prouve. Il ne pouvait rien dire du cyrillique, ni
 * du CJK — où il aurait même menti, les idéogrammes faisant exactement un cadratin
 * de large dans toutes les polices : deux largeurs égales, donc « absent »,
 * dans une police qui a pourtant le glyphe.
 *
 * On compare donc des PIXELS. Chaque caractère est dessiné deux fois : avec la
 * pile de la page, puis avec une famille qui n'existe pas — c'est-à-dire avec
 * la police par défaut du navigateur. Deux rendus identiques veulent dire que
 * la pile n'a rien apporté : personne, dans ce qu'on embarque, ne connaît ce
 * caractère.
 *
 * Encore faut-il comparer la bonne pile, et il a fallu DEUX mutations pour
 * trouver laquelle. On a d'abord dessiné avec `--font-base` telle quelle : elle
 * finit par `sans-serif`, que le conteneur résout en DejaVu Sans, lequel répond
 * donc à la place d'Inter — en retirant à Inter sa plage cyrillique, le russe
 * sortait en DejaVu et la capture passait. Retirer les génériques n'a pas suffi
 * pour autant : fontconfig aliase `Arial` et `Helvetica` sur Liberation Sans,
 * qui a le cyrillique lui aussi. Deux noms de la pile de Twitch, qu'on croyait
 * absents, ne l'étaient pas.
 *
 * La pile de contrôle ne se déduit donc pas de ce que la page DEMANDE mais de
 * ce qu'on EMBARQUE : `document.fonts` porte exactement les @font-face de
 * POLICE, et on n'en garde que celles que la page nomme, dans son ordre. Sur
 * une page japonaise cela fait « Inter, Noto Sans JP » ; sur une page française,
 * « Inter ». Aucune police du système ne peut plus répondre à leur place.
 */
export async function glyphesManquants(page) {
  return page.evaluate(() => {
    // Ce que la page ÉCRIT, et non ce qu'elle CONTIENT : le premier relevé
    // remontait les filets « ── » des commentaires du script inline de
    // page.html, qui sont bien des nœuds texte de <body> et ne se dessinent
    // nulle part. Un <script> n'a pas de boîte ; on ne garde que les nœuds dont
    // le parent en a une.
    const MUETS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE']);
    const vus = new Set();
    const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = marche.nextNode(); n; n = marche.nextNode()) {
      const p = n.parentElement;
      if (!p || MUETS.has(p.tagName) || !p.getClientRects().length) continue;
      for (const c of n.nodeValue) if (!/\s/.test(c)) vus.add(c);
    }
    const sansGuillemets = (s) => s.trim().replace(/^["']|["']$/g, '');
    const embarquees = new Set([...document.fonts].map((f) => sansGuillemets(f.family)));
    const pile = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-base')
      .split(',').map(sansGuillemets)
      .filter((f) => embarquees.has(f))
      .map((f) => `"${f}"`)
      .concat('__absente__').join(', ');
    const cv = document.createElement('canvas');
    cv.width = 80; cv.height = 80;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const empreinte = (famille, c) => {
      g.clearRect(0, 0, 80, 80);
      g.font = '64px ' + famille;
      g.fillStyle = '#000';
      g.fillText(c, 8, 64);
      return g.getImageData(0, 0, 80, 80).data.join(',');
    };
    return [...vus].filter((c) => empreinte(pile, c) === empreinte('__absente__', c));
  });
}

/* Libellé de la section suivie, par langue d'interface, substitué dans
   page.html. Clé = code de FICHE (es419 et ptpt sont des fiches distinctes),
   pas code de langue de l'extension.

   Les SIX premiers sont les libellés NATIFS de Twitch, ceux que
   detectLanguage() cherche mot pour mot avant de regarder <html lang> : sans
   cette substitution, les scènes fr/en/de/es/pt rendraient toutes en français
   quelle que soit la langue demandée. es-419 partage l'interface espagnole ;
   pt-PT et pt-BR partagent l'interface portugaise mais PAS ce libellé, que
   Twitch traduit différemment de part et d'autre de l'Atlantique.

   Les CINQ derniers (it, pl, ru, ja, zh) ne peuvent pas être des libellés
   natifs : content.js n'en liste aucun pour ces langues, délibérément — en
   inventer un reviendrait à écrire une comparaison qui ne matchera jamais.
   Ces cinq scènes sont donc détectées par <html lang>, et ce que porte cette
   table est le libellé de l'EXTENSION, `followedLabel`. C'est de toute façon
   celui qu'on photographie : renameRootTitle() réécrit le titre de section
   avec S.followedLabel dès le premier balayage. Le contrôle de tests/store.mjs
   vérifie que ces cinq chaînes existent bien dans content.js. */
const SECTION = {
  fr: 'Chaînes suivies', en: 'Followed Channels', de: 'Kanäle, denen du folgst',
  es: 'Canales que sigues', es419: 'Canales que sigues',
  ptbr: 'Canais seguidos', ptpt: 'Canais que segues',
  it: 'Canali seguiti', pl: 'Obserwowane kanały', ru: 'Отслеживаемые каналы',
  ja: 'フォロー中のチャンネル', zh: '关注的频道',
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
  // Catégories NON traduites dans les captures. Le stub sait traduire — le
  // produit affiche désormais `game.displayName`, et c'est bien ce qu'on veut
  // voir sur un vrai Twitch — mais on ne dispose pas des traductions réelles de
  // Twitch pour les douze langues de fiche, et publier une traduction inventée
  // serait pire que publier l'anglais. Les images gardent donc le nom canonique
  // dans toutes les langues, ce qui les laisse cohérentes entre elles.
  await page.addInitScript(() => { window.__i18nCats = {}; });
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
  // La police est embarquée, donc immédiate — mais « immédiate » n'est pas
  // « déjà là ». Attendre ici, et non après la mesure, évite d'aller mesurer
  // des largeurs de repli qui ne seront pas celles de l'image.
  await page.evaluate(() => document.fonts.ready);
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
  // Rendu en 2x pour la finesse du texte, puis réduit à 1280x800 — la taille
  // EXACTE qu'exige le Store — par reduireEnPng24, qui encode aussi sans alpha.
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
    // Inter a-t-elle VRAIMENT été prise ? Une police absente ne casse rien :
    // le navigateur retombe sur son défaut, et l'image sort avec le mauvais
    // dessin sans que personne ne s'en aperçoive. On compare donc la largeur
    // d'une même chaîne demandée à Inter et à une famille qui n'existe pas :
    // si les deux se valent, c'est que le repli a servi les deux fois.
    const largeur = (f) => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '600 13px ' + f;
      return c.measureText('Chaînes suivies — kiraplays 18,4 k').width;
    };
    const police = largeur('Inter, sans-serif') !== largeur('__absente__, sans-serif');
    // Le titre se replie où il veut, et ça ne déborde de rien : `coupe` ne peut
    // pas le voir. Or les coupures sont ÉCRITES, une par <br> — un vers de plus
    // que prévu, et le rythme voulu n'est plus celui qu'on photographie. On
    // compte donc les lignes par la hauteur, l'interligne étant fixé juste
    // au-dessus dans la même feuille.
    let vers = 0;
    if (h1) {
      const st = getComputedStyle(h1);
      const inter = parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.04;
      vers = Math.round(h1.getBoundingClientRect().height / inter)
           - (1 + h1.querySelectorAll('br').length);
    }
    return {
      plancher, chapo, police, vers,
      hors: rt.top < 8 || rt.bottom > 792 || rt.right > 1274 || rt.left < plancher,
      coupe: h1 ? Math.round(h1.scrollWidth - h1.clientWidth) : 0,
      chevauche: rt.bottom > rm.top - 8,
      marque: Math.round(rm.left) < plancher,
      ecart: pv ? Math.round(rt.left - pv.getBoundingClientRect().right) : null,
    };
  });
  // Un vers de plus est TOLÉRÉ dans la variante étroite, et là seulement : sa
  // colonne fait 378 px, et aucune taille lisible n'y tient « avant de cliquer »
  // d'un seul tenant. Le repli y est donc voulu, et le <br> n'est qu'un premier
  // point de coupure. Dans la colonne large, en revanche, un vers de plus veut
  // dire que la taille a dépassé ce que la mesure autorisait.
  const versMax = texteEtroit ? 1 : 0;
  if (trop.hors || trop.coupe > 0 || trop.chapo > 0 || trop.vers > versMax || trop.chevauche ||
      trop.marque || !trop.police || (trop.ecart !== null && trop.ecart < 12)) {
    console.log('  ⚠ mise en page :', nom, JSON.stringify(trop));
  }

  // Un tofu ne se rattrape pas après publication : on refuse de photographier.
  const manquants = await glyphesManquants(page);
  if (manquants.length) {
    throw new Error(`${nom} : aucune police embarquée ne couvre « ${manquants.join('')} ` +
                    `» — relancer « npm run polices » après avoir changé un texte`);
  }

  const brut = await page.screenshot();
  await page.close();
  const fichier = await reduireEnPng24(brut, 1280, 800);
  writeFileSync(join(OUT, `${nom}.png`), fichier);
  console.log('  ✓', `${nom}.png`, `— ${(fichier.length / 1024).toFixed(0)} Ko, 24 bits sans alpha`);
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
      background:#0a0a0c; font-family:var(--font-base);
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
       « PRÉ-VISUALIZAÇÃO AO PASSAR » est le plus long des douze, et c'est lui
       qui fixe ce nombre. Le garde-fou « chapo » de scene() vérifie qu'aucun
       autre ne passe à la ligne. */
    body.promo-etroit #promo-texte .kicker { font-size:17px; }
    #promo-texte .kicker { display:inline-block; padding:8px 17px; border-radius:999px;
      background:rgba(145,71,255,.16); border:1px solid rgba(145,71,255,.40);
      color:#c9a6ff; font-size:19px; font-weight:700; letter-spacing:.10em;
      text-transform:uppercase; margin-bottom:28px; }
    #promo-texte h1 { margin:0 0 24px; font-size:72px; line-height:1.04;
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
