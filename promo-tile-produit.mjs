/* Tuile promotionnelle « produit » — 440 x 280, sans texte de présentation.
   Contrairement aux variantes A–D, celle-ci ne met pas en scène le seul logo :
   elle montre la barre latérale EN FONCTIONNEMENT, rendue par le vrai code.

   Elle a d'abord porté deux panneaux — la barre et l'aperçu au survol — posés
   en perspective, l'un à 0,78 et l'autre à 0,52. C'était joli et illisible :
   les pseudos y tombaient à 10 px sur une image que le Store affiche plus
   petite encore. L'aperçu fait 480 px de large à lui seul, soit plus que la
   tuile entière ; il n'existe aucune échelle à laquelle il soit lisible ici.
   Il a donc été retiré, et toute la place rendue à la barre, agrandie jusqu'à
   ce que ses pseudos se lisent. Ce que l'aperçu montrait, les captures
   1280 x 800 le montrent en grand.

   Ce qui reste se vérifie plutôt que de se juger à l'œil : le bilan mesuré
   plus bas compte les cartes entières, celles qui portent l'or, et la taille
   RENDUE des pseudos. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pageProduit, browser, ABOS, CSS_TWITCH, reduireEnPng24 } from './promo.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.PROMO_OUT || join(ICI, 'promo');
mkdirSync(OUT, { recursive: true });
const LOGO = 'data:image/png;base64,' +
  readFileSync(join(ICI, 'icons', 'icon128.png')).toString('base64');
const GRAIN = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
     <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/>
     </filter><rect width='200' height='200' filter='url(#n)'/></svg>`);

// Décor : chaînes inventées, un vrai co-stream, un stream tout juste démarré.
const DECOR = () => {
  const h = (m) => new Date(Date.now() - m * 60_000).toISOString();
  window.__fx = {
    novaflux:    { id:'101', createdAt:h(259), viewers:18420, game:'Just Chatting',     tags:['Français'],
                   title:'On refait le monde avant le sub-ton de ce soir' },
    kiraplays:   { id:'102', createdAt:h(132), viewers:9310,  game:'League of Legends', tags:['Français'],
                   title:'Objectif Master avant la fin du mois — jour 12' },
    atlasgaming: { id:'103', createdAt:h(94),  viewers:6240,  game:'Valorant',          tags:['Français'] },
    mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',               tags:['Français'] },
    orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',         tags:['Français'] },
    duskraven:   { id:'106', createdAt:h(47),  viewers:1960,  game:'Elden Ring',        tags:['English'] },
  };
  const g = [{ id:'102', login:'kiraplays', viewers:9310, combined:15570 },
             { id:'103', login:'atlasgaming', viewers:6240, combined:15570 }];
  window.__gs = { '102': { hostId:'102', hostLogin:'kiraplays', guests:g },
                  '103': { hostId:'102', hostLogin:'kiraplays', guests:g } };
  window.__addCard('novaflux','Just Chatting','18,4 k');
  window.__addCard('kiraplays','League of Legends','15,5 k');
  window.__addCard('atlasgaming','League of Legends','15,5 k');
  window.__addCard('mirabelle','Art','4,1 k');
  window.__addCard('orionwave','Minecraft','2,8 k');
  window.__addCard('duskraven','Elden Ring','1,9 k');
};

// Habillage de Twitch : la page de test porte la structure, pas l'apparence.
// IMPORTÉ, et non plus découpé dans le texte source de promo.mjs : depuis que
// cet habillage embarque la police en base64, il n'existe plus tel quel dans la
// source — le découpage aurait rendu un « ${...} » littéral, et la tuile serait
// repartie sans police.

function composer({ CSS, LOGO, GRAIN, ECHELLE, COUPE }) {
  const nav = document.getElementById('side-nav');
  document.querySelector('[data-tse-stories="row"]')?.remove();

  const st = document.createElement('style');
  st.textContent = CSS + `
    html,body{margin:0;padding:0;background:#08080a;overflow:hidden}
    #root{position:fixed;left:0;top:0;opacity:0;pointer-events:none}
    #fond,#dessus{position:fixed;left:0;top:0;width:440px;height:280px;overflow:hidden}
    #fond{z-index:0;background:
      radial-gradient(320px 250px at 84% 74%, rgba(178,110,255,.40), transparent 70%),
      radial-gradient(280px 230px at 2% 2%,   rgba(38,212,200,.15), transparent 64%),
      radial-gradient(300px 240px at 16% 108%,rgba(255,122,138,.12), transparent 62%),
      conic-gradient(from 205deg at 84% 72%, rgba(145,71,255,.16), rgba(38,212,200,.06),
                     rgba(255,122,138,.09), rgba(145,71,255,.16)),
      linear-gradient(152deg,#131020 0%,#08070c 56%,#120c19 100%)}
    #dessus{z-index:9;pointer-events:none}
    .bokeh{position:absolute;border-radius:50%;filter:blur(46px)}

    /* La barre est le nœud VIVANT produit par l'extension : elle n'est pas
       redessinée, seulement cadrée. Le cadrage est tout le sujet de cette
       tuile — 440 px de large, et une barre latérale qui en fait 240 : à
       l'échelle 1 son texte tombe à 13 px, et le Store affiche la tuile plus
       petite encore. On l'agrandit donc, et on paie cet agrandissement en
       hauteur : ce qui ne tient plus est coupé PAR LE HAUT, où se trouve le
       titre de section — la seule chose que la tuile n'a pas besoin de dire,
       puisqu'elle montre déjà une barre latérale.

       Le conteneur découpe, la barre est mise à l'échelle dedans : c'est lui
       qui porte le cadre, l'ombre et le fondu, sans quoi le fondu serait
       calculé avant la mise à l'échelle et tomberait hors de la tuile. */
    #tuile-barre{position:fixed;z-index:2;left:6px;top:6px;
      width:${Math.round(240 * ECHELLE)}px;height:268px;overflow:hidden;
      border-radius:14px;background:#1f1f23;
      border:1px solid rgba(255,255,255,.09);
      box-shadow:0 26px 54px rgba(0,0,0,.66);
      -webkit-mask-image:linear-gradient(180deg,#000 82%,transparent 99%);
      mask-image:linear-gradient(180deg,#000 82%,transparent 99%)}
    #side-nav{position:absolute!important;left:0;top:${-Math.round(COUPE * ECHELLE)}px;
      width:240px;
      transform:scale(${ECHELLE});transform-origin:left top}

    /* La marque se pose dans la bande laissée libre par le cadre, centrée
       dedans plutôt que jetée dans un coin : la bande fait
       ${440 - 6 - Math.round(240 * ECHELLE)} px, le logo 86. */
    .logo-wrap{position:absolute;right:24px;top:50%;margin-top:-43px;
      width:86px;height:86px}
    .logo-glow{position:absolute;inset:-30px;border-radius:44px;
      background:conic-gradient(from 25deg,#c77dff 0deg,#ff5f8f 78deg,#9147ff 150deg,
        #26d4c8 230deg,#4d8cff 300deg,#c77dff 360deg);
      filter:blur(21px) saturate(1.55);opacity:.72}
    .logo{position:absolute;inset:0;border-radius:20px;
      background:url('${LOGO}') center/cover;
      box-shadow:0 16px 32px rgba(0,0,0,.64), 0 0 0 1px rgba(255,255,255,.28),
                 0 0 0 5px rgba(255,255,255,.055), 0 0 60px rgba(190,130,255,.50)}

    .rai{position:absolute;inset:-40% -10%;
      background:linear-gradient(108deg, rgba(255,255,255,.05) 4%, rgba(255,255,255,.012) 17%, transparent 30%);
      transform:rotate(-3deg)}
    .grain{position:absolute;inset:0;background-image:url("${GRAIN}");background-size:200px 200px;
      opacity:.055;mix-blend-mode:overlay}
    .vignette{position:absolute;inset:0;
      box-shadow:inset 0 0 78px 22px rgba(0,0,0,.62), inset 0 0 0 1px rgba(255,255,255,.06)}
  `;
  document.head.appendChild(st);

  const fond = document.createElement('div');
  fond.id = 'fond';
  fond.innerHTML =
    `<div class="bokeh" style="left:-54px;top:190px;width:150px;height:150px;background:#26d4c8;opacity:.11"></div>
     <div class="bokeh" style="right:-64px;top:-60px;width:180px;height:180px;background:#c77dff;opacity:.13"></div>`;
  document.body.appendChild(fond);

  const dessus = document.createElement('div');
  dessus.id = 'dessus';
  dessus.innerHTML =
    `<div class="logo-wrap"><div class="logo-glow"></div><div class="logo"></div></div>
     <div class="rai"></div><div class="grain"></div><div class="vignette"></div>`;
  document.body.appendChild(dessus);

  // #root est masqué par opacity:0, et l'opacité masque TOUS les descendants,
  // fût-ce en position:fixed. La barre latérale doit donc en sortir — elle ne
  // contient aucune iframe, la déplacer ne coûte rien.
  const cadre = document.createElement('div');
  cadre.id = 'tuile-barre';
  document.body.appendChild(cadre);
  cadre.appendChild(nav);
}

/* Les deux nombres qui décident de tout.

   ECHELLE : l'agrandissement de la barre. Il ne se choisit pas au goût — il se
   paie. La barre mesure 240 px de large et le haut de sa liste tombe à 152 px
   de son sommet ; chaque carte en fait 43. Agrandir de x, c'est donc perdre
   des cartes : à 1,45 il n'en resterait qu'une et demie, à 1 le texte
   retombe aux 13 px illisibles qu'on cherche à quitter.

   COUPE : ce qu'on retire par le haut, en pixels non mis à l'échelle. 38, soit
   exactement la hauteur du titre de section — la seule chose qu'une tuile
   montrant une barre latérale n'a pas besoin d'écrire. Tout le reste survit :
   la bascule Suivis / Top Chaînes, les deux filtres, les six tris avec leur
   pastille, et les cartes.

   Le garde-fou plus bas vérifie que le compte y est. */
const ECHELLE = 1.22;
const COUPE   = 38;

// La mémoire d'abonnements est posée ici comme dans les captures : la tuile
// montre la barre telle qu'un abonné la voit — noms dorés, catégories dorées,
// anneau autour de l'avatar, et le total sur la pastille du tri.
const page = await pageProduit({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, stockage: ABOS });
await page.evaluate(DECOR);
await page.waitForTimeout(2400);
// Tri « mes abonnements en tête ». Deux cartes seulement entrent dans la tuile :
// autant que ce soient celles qui portent l'or, sinon l'agrandissement aurait
// servi à mieux lire des cartes ordinaires.
await page.evaluate(() => {
  const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]');
  if (!b) throw new Error('bouton de tri « abonnements » absent');
  if (b.disabled) throw new Error('bouton de tri « abonnements » grisé');
  b.click();
});
await page.waitForTimeout(1200);
await page.evaluate(composer, { CSS: CSS_TWITCH, LOGO, GRAIN, ECHELLE, COUPE });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

/* Une tuile qui ne montrerait ni or ni cartes lisibles serait une tuile ratée,
   et rien dans le rendu ne le dirait. On mesure donc ce qu'elle porte vraiment,
   dans le repère de la tuile : combien de cartes entrent en entier, combien
   sont dorées, et à quelle taille leur pseudo s'affiche. */
const bilan = await page.evaluate((ECHELLE) => {
  // Le conteneur découpe : une carte dont le bas dépasse SON bord est coupée,
  // même si elle tient encore dans les 280 px de la tuile. C'est donc à lui
  // qu'on compare, pas au bord de l'image.
  const rc = document.getElementById('tuile-barre').getBoundingClientRect();
  const entiere = (el) => {
    const r = el.getBoundingClientRect();
    return r.top >= rc.top && r.bottom <= rc.bottom && r.right <= rc.right;
  };
  const dansCadre = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= rc.top && r.bottom <= rc.bottom;
  };
  const visibles = [...document.querySelectorAll('.side-nav-card')].filter(entiere);
  const titre = visibles[0]?.querySelector('[data-a-target="side-nav-title"]');
  // Inter a-t-elle vraiment été prise ? Une police absente ne casse rien : le
  // navigateur retombe sur son défaut, et la tuile sort avec le mauvais dessin.
  // On compare donc la même chaîne demandée à Inter et à une famille qui
  // n'existe pas ; largeurs égales = repli des deux côtés.
  const largeur = (f) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '600 13px ' + f;
    return c.measureText('Chaînes suivies — kiraplays 18,4 k').width;
  };
  return {
    cartes: visibles.length,
    police: largeur('Inter, sans-serif') !== largeur('__absente__, sans-serif'),
    // Ce que le pseudo REND vraiment, famille comprise : si la barre affichait
    // autre chose qu'Inter, ce nom-là le dirait.
    rendue: titre ? getComputedStyle(titre).fontFamily.split(',')[0].replace(/["']/g, '') : '',
    dorees: visibles.filter(c => c.classList.contains('tse-sub')).length,
    // Taille RENDUE : la mise à l'échelle ne touche pas au font-size calculé,
    // et c'est pourtant elle qu'on lit sur la tuile.
    pseudo: titre
      ? +(parseFloat(getComputedStyle(titre).fontSize) * ECHELLE).toFixed(1) : 0,
    tri: dansCadre(document.querySelector('#tse-sort-row .tse-sort-count')),
  };
}, ECHELLE);
console.log('  cadrage :', JSON.stringify(bilan));
if (bilan.cartes < 2)  throw new Error(`cartes entières attendues : au moins 2, vues : ${bilan.cartes}`);
if (bilan.dorees < bilan.cartes) throw new Error(`cartes dorées attendues : toutes (${bilan.cartes}), vues : ${bilan.dorees}`);
if (bilan.pseudo < 15) throw new Error(`pseudo attendu à 15 px au moins, mesuré : ${bilan.pseudo}`);
if (!bilan.tri)        throw new Error('la pastille du tri des abonnements est hors cadre');
if (!bilan.police)     throw new Error('Inter n\'a pas été chargée : la tuile sortirait dans la police par défaut');
if (bilan.rendue !== 'Inter') throw new Error(`police rendue attendue : Inter, mesurée : « ${bilan.rendue} »`);

const brut = await page.screenshot({ clip: { x: 0, y: 0, width: 440, height: 280 } });
await page.close();

// Réduction 2x -> 1x par Chromium — la barre, rendue deux fois trop grande
// puis rééchantillonnée, en ressort nette au lieu de baver — puis encodage en
// PNG 24 bits SANS alpha. Cette tuile sortait en RGBA : opaque, mais avec un
// canal alpha que le Store est en droit de refuser sur cet emplacement.
const fichier = await reduireEnPng24(brut, 440, 280);
writeFileSync(join(OUT, 'tuile-E-produit.png'), fichier);
console.log(`  ✓ tuile-E-produit.png — ${(fichier.length / 1024).toFixed(0)} Ko, 24 bits sans alpha`);
await browser.close();
