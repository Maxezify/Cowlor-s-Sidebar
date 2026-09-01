/* Tuile promotionnelle « produit » — 440 x 280, sans texte.
   Contrairement aux variantes A–D, celle-ci ne met pas en scène le seul logo :
   elle montre l'extension EN FONCTIONNEMENT. La barre latérale et l'aperçu au
   survol sont rendus par le vrai code, puis composés en profondeur. Ce qu'on
   voit est ce que l'utilisateur verra — c'est ce qui donne envie de cliquer,
   et c'est aussi ce que le Chrome Web Store attend d'une image promotionnelle. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pageProduit, browser, ABOS } from './promo.mjs';

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
const CSS_TWITCH = readFileSync(join(ICI, 'promo.mjs'), 'utf8')
  .split('const CSS_TWITCH = `')[1].split('\n`;')[0];

function composer({ CSS, LOGO, GRAIN }) {
  const nav = document.getElementById('side-nav');
  const pop = document.querySelector('.tse-preview');
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

    /* Les deux panneaux sont les nœuds VIVANTS produits par l'extension. On ne
       les reparente pas : déplacer une iframe dans le DOM la recharge, et
       l'aperçu perdait son image. On les positionne là où ils sont. */
    #side-nav{position:fixed!important;z-index:2;
      left:9px;top:7px;width:240px;height:300px;overflow:hidden;
      border-radius:13px;background:#1f1f23;
      border:1px solid rgba(255,255,255,.09);
      box-shadow:0 26px 54px rgba(0,0,0,.66);
      transform:perspective(1100px) rotateY(12deg) rotateX(2.5deg) scale(.78);
      transform-origin:left top;
      -webkit-mask-image:linear-gradient(180deg,#000 76%,transparent 99%);
      mask-image:linear-gradient(180deg,#000 76%,transparent 99%)}
    .tse-preview{position:fixed!important;z-index:3;
      left:188px!important;top:8px!important;right:auto!important;bottom:auto!important;
      width:480px!important;max-width:none!important;
      border-radius:14px;overflow:hidden;
      border:1px solid rgba(255,255,255,.11);
      box-shadow:0 30px 62px rgba(0,0,0,.70);
      transform:perspective(1100px) rotateY(12deg) rotateX(2.5deg) scale(.52);
      transform-origin:left top}

    .logo-wrap{position:absolute;right:10px;bottom:9px;width:86px;height:86px}
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
  // contient aucune iframe, la déplacer ne coûte rien. L'aperçu, lui, vit déjà
  // sur <body> : on n'y touche pas, c'est justement ce qui préserve sa vidéo.
  document.body.appendChild(nav);
  if (!pop) console.log('  ⚠ aperçu absent : la tuile est rendue sans lui');
}

// La mémoire d'abonnements est posée ici comme dans les captures : la tuile
// montre la barre telle qu'un abonné la voit — noms dorés, anneau doré,
// pastille sur le tri — et l'aperçu porte son badge d'ancienneté.
const page = await pageProduit({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, stockage: ABOS });
await page.evaluate(DECOR);
await page.waitForTimeout(2400);
await page.evaluate(() => {
  const c = [...document.querySelectorAll('.side-nav-card')]
    .find(x => x.dataset.tseLogin === 'kiraplays');
  c?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
});
await page.waitForTimeout(2600);
await page.evaluate(composer, { CSS: CSS_TWITCH, LOGO, GRAIN });
await page.waitForTimeout(600);

const brut = await page.screenshot({ clip: { x: 0, y: 0, width: 440, height: 280 } });
await page.close();

// Réduction 2x -> 1x par Chromium : la barre latérale, rendue deux fois trop
// grande puis rééchantillonnée, en ressort nette au lieu de baver.
const p2 = await browser.newPage({ viewport: { width: 440, height: 280 } });
const b64 = await p2.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = 440; c.height = 280;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, 440, 280);
  return c.toDataURL('image/png').split(',')[1];
}, 'data:image/png;base64,' + brut.toString('base64'));
await p2.close();
writeFileSync(join(OUT, 'tuile-E-produit.png'), Buffer.from(b64, 'base64'));
console.log('  ✓ tuile-E-produit.png');
await browser.close();
