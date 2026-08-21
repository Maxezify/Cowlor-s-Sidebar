/* Petite tuile promotionnelle du Chrome Web Store — 440 x 280, sans texte.
   Rendue à l'échelle 1:1 et non en 2x : le logo source fait 128 px, l'afficher
   à sa taille native le garde net, là où un aller-retour 2x le ramollirait. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.PROMO_OUT || join(ICI, 'promo');
mkdirSync(OUT, { recursive: true });

const LOGO = 'data:image/png;base64,' +
  readFileSync(join(ICI, 'icons', 'icon128.png')).toString('base64');

// Palette co-stream de l'extension : c'est SA signature visuelle, et elle
// répond aux couleurs du logo sans les concurrencer.
const PALETTE = ['#f5c518', '#7ee081', '#26d4c8', '#4d8cff', '#c77dff', '#ff7a8a'];

const BASE = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:440px;height:280px;overflow:hidden;background:#0a0a0c}
  .tuile{position:relative;width:440px;height:280px;overflow:hidden;
    background:#0d0d10}
  .halo{position:absolute;inset:0}
  .logo{position:absolute;width:128px;height:128px;border-radius:28px;
    /* Ombre volontairement légère : à 440x280 une ombre marquée devient une
       tache sombre autour du logo. C'est le halo violet qui doit le porter. */
    box-shadow:0 14px 30px rgba(0,0,0,.46), 0 0 0 1px rgba(255,255,255,.13),
               0 0 90px rgba(145,71,255,.50);}
  /* Les cartes se dissolvent vers les bords : un motif, pas des pavés. */
  .pile{position:absolute;inset:0;
    -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 15%,#000 85%,transparent 100%);
    mask-image:linear-gradient(180deg,transparent 0,#000 15%,#000 85%,transparent 100%)}
  .sheen{position:absolute;inset:0;background:
    linear-gradient(118deg, rgba(255,255,255,.055) 0%, transparent 34%)}
  /* Cartes abstraites : la silhouette d'une liste à liseré coloré, sans un
     mot — c'est ce que l'extension dessine, réduit à sa forme. */
  .carte{position:absolute;height:26px;border-radius:6px;
    background:linear-gradient(90deg, rgba(255,255,255,.10), rgba(255,255,255,.03) 58%, transparent);
    overflow:hidden}
  .carte::before{content:'';position:absolute;left:0;top:4px;bottom:4px;width:3px;
    border-radius:2px;background:var(--c);box-shadow:0 0 10px var(--c)}
  .carte::after{content:'';position:absolute;left:13px;top:7px;width:12px;height:12px;
    border-radius:50%;background:rgba(255,255,255,.20)}
`;

const carte = (c, style) => `<div class="carte" style="--c:${c};${style}"></div>`;

const VARIANTES = {
  // A — le logo seul, porté par un halo. Sobre, et c'est ce qui tient le mieux
  //     à la taille où la tuile est réellement vue dans le store.
  'A-halo': `
    <div class="tuile">
      <div class="halo" style="background:
        radial-gradient(300px 240px at 50% 45%, rgba(160,90,255,.46), transparent 68%),
        radial-gradient(340px 260px at 94% 104%, rgba(38,212,200,.16), transparent 62%),
        radial-gradient(280px 220px at 4% -4%, rgba(255,122,138,.12), transparent 60%),
        linear-gradient(155deg,#141119 0%,#0b0b0e 58%,#150f1c 100%)"></div>
      <div class="sheen"></div>
      <div class="logo" style="left:156px;top:76px;background:url('${LOGO}') center/cover"></div>
    </div>`,

  // B — le logo encadré par la silhouette d'une liste à liseré coloré : on
  //     devine le produit sans qu'un mot soit écrit.
  'B-liste': `
    <div class="tuile">
      <div class="halo" style="background:
        radial-gradient(300px 250px at 50% 45%, rgba(160,90,255,.44), transparent 70%),
        linear-gradient(155deg,#141119 0%,#0b0b0e 60%,#150f1c 100%)"></div>
      <div class="pile">
        ${[0,1,2,3,4,5].map((i) => carte(PALETTE[i],
          `left:${18 + i * 3}px; top:${20 + i * 42}px; width:${150 - i * 5}px;
           opacity:${(0.92 - i * 0.11).toFixed(2)}`)).join('')}
        ${[0,1,2,3,4,5].map((i) => carte(PALETTE[5 - i],
          `right:${18 + i * 3}px; top:${41 + i * 42}px; width:${150 - i * 5}px;
           opacity:${(0.78 - i * 0.11).toFixed(2)}; transform:scaleX(-1)`)).join('')}
      </div>
      <div class="sheen"></div>
      <div class="logo" style="left:156px;top:76px;background:url('${LOGO}') center/cover"></div>
    </div>`,

  // C — composition décalée : la liste franche à gauche, le logo à droite.
  'C-cote': `
    <div class="tuile">
      <div class="halo" style="background:
        radial-gradient(310px 260px at 76% 48%, rgba(160,90,255,.48), transparent 68%),
        radial-gradient(270px 210px at 6% 98%, rgba(38,212,200,.15), transparent 62%),
        linear-gradient(150deg,#151119 0%,#0b0b0e 62%,#140f1b 100%)"></div>
      <div style="position:absolute;inset:0;
        -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 86%,transparent 100%),
                           linear-gradient(90deg,#000 0,#000 46%,transparent 70%);
        -webkit-mask-composite:source-in;
        mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 86%,transparent 100%),
                   linear-gradient(90deg,#000 0,#000 46%,transparent 70%);
        mask-composite:intersect">
        ${[0,1,2,3,4,5].map((i) => carte(PALETTE[i],
          `left:26px; top:${22 + i * 40}px; width:${188 - i * 3}px;
           opacity:${(0.96 - i * 0.10).toFixed(2)}`)).join('')}
      </div>
      <div class="sheen"></div>
      <div class="logo" style="left:256px;top:76px;background:url('${LOGO}') center/cover"></div>
    </div>`,
};

const browser = await chromium.launch();
console.log('Tuiles 440 x 280 :');
for (const [nom, html] of Object.entries(VARIANTES)) {
  const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
  await page.setContent(`<style>${BASE}</style>${html}`);
  await page.waitForTimeout(250);
  writeFileSync(join(OUT, `tuile-${nom}.png`), await page.screenshot());
  await page.close();
  console.log('  ✓', `tuile-${nom}.png`);
}
await browser.close();
