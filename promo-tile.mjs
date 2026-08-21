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
// Grain : un bruit fractal SVG, posé très bas en opacité. C'est ce qui fait la
// différence entre « un dégradé CSS » et « une image » — sans lui, les grands
// aplats sombres se voient comme des bandes.
const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
     <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/>
     </filter><rect width='200' height='200' filter='url(#n)' opacity='1'/></svg>`);

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

  /* ---- Version « tout » -------------------------------------------------- */
  .bokeh{position:absolute;border-radius:50%;filter:blur(42px);pointer-events:none}
  .scene{position:absolute;left:-4px;top:26px;width:212px;height:256px;
    perspective:820px;perspective-origin:0% 50%;
    -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 78%,transparent 100%);
    mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 78%,transparent 100%)}
  .pile3d{position:absolute;inset:0;transform:rotateY(-15deg) rotateX(5deg) rotateZ(-1.5deg);
    transform-style:preserve-3d}
  /* Cartes de verre : le fond translucide et le filet clair sur l'arête haute
     font toute la matière. Le liseré coloré garde son halo — c'est la marque
     de fabrique de l'extension, elle ne doit pas se perdre dans l'effet. */
  .verre{position:absolute;left:0;height:30px;border-radius:8px;
    background:linear-gradient(100deg, rgba(22,20,30,.86), rgba(18,17,24,.62) 60%, rgba(16,15,21,.34));
    border:1px solid rgba(255,255,255,.09);
    border-top-color:rgba(255,255,255,.17);
    box-shadow:0 10px 26px rgba(0,0,0,.50);
    backdrop-filter:blur(5px);overflow:hidden}
  .verre::before{content:'';position:absolute;left:0;top:4px;bottom:4px;width:3px;
    border-radius:2px;background:var(--c);
    box-shadow:0 0 14px var(--c), 0 0 4px var(--c), 0 0 30px var(--c)}
  .verre::after{content:'';position:absolute;left:15px;top:9px;width:12px;height:12px;
    border-radius:50%;background:rgba(255,255,255,.22);
    box-shadow:22px 3px 0 -4px rgba(255,255,255,.13), 46px 3px 0 -4px rgba(255,255,255,.09)}
  .logo-wrap{position:absolute;width:140px;height:140px}
  .logo-glow{position:absolute;inset:-42px;border-radius:62px;
    background:conic-gradient(from 25deg,
      #c77dff 0deg, #ff5f8f 78deg, #9147ff 150deg,
      #26d4c8 230deg, #4d8cff 300deg, #c77dff 360deg);
    filter:blur(26px) saturate(1.5);opacity:.72}
  .logo-wrap .logo{position:absolute;inset:0;width:140px;height:140px;border-radius:31px;
    box-shadow:0 22px 40px rgba(0,0,0,.58), 0 0 0 1px rgba(255,255,255,.26),
               0 0 0 6px rgba(255,255,255,.05), 0 0 78px rgba(190,130,255,.50)}
  /* Une flaque de lumière plutôt qu'un miroir : le reflet retourné rendait un
     SECOND VISAGE sous le logo, reconnaissable et parasite. La flaque donne le
     même appui au sol sans le sosie. */
  .flaque{position:absolute;left:-16px;top:138px;width:172px;height:36px;border-radius:50%;
    background:radial-gradient(closest-side, rgba(190,130,255,.42), rgba(120,70,200,.14) 62%, transparent);
    filter:blur(9px)}
  .rai{position:absolute;inset:-40% -10%;pointer-events:none;
    background:linear-gradient(108deg, rgba(255,255,255,.05) 4%, rgba(255,255,255,.012) 17%,
               transparent 30%);
    transform:rotate(-3deg)}
  .grain{position:absolute;inset:0;background-image:var(--grain);
    background-size:200px 200px;opacity:.055;mix-blend-mode:overlay;pointer-events:none}
  .vignette{position:absolute;inset:0;pointer-events:none;
    box-shadow:inset 0 0 78px 22px rgba(0,0,0,.60), inset 0 0 0 1px rgba(255,255,255,.055)}
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


  // D — la version « tout ». Profondeur réelle (pile en perspective), verre,
  //     grain, halo chromatique repris du logo, reflet, vignette. Le logo
  //     reste net et dominant : tout le reste travaille pour lui.
  'D-premium': `
    <div class="tuile">
      <div class="halo" style="background:
        radial-gradient(300px 230px at 71% 44%, rgba(178,110,255,.44), transparent 70%),
        radial-gradient(260px 210px at 10% 6%,   rgba(255,122,138,.10), transparent 64%),
        radial-gradient(300px 230px at 4% 106%,  rgba(38,212,200,.13), transparent 62%),
        conic-gradient(from 210deg at 71% 44%, rgba(145,71,255,.16), rgba(38,212,200,.06),
                       rgba(255,122,138,.09), rgba(145,71,255,.16)),
        linear-gradient(152deg,#120e19 0%,#07070a 56%,#100b17 100%)"></div>

      <div class="bokeh" style="left:-44px; top:172px; width:150px;height:150px;background:#26d4c8;opacity:.09"></div>
      <div class="bokeh" style="right:-56px;top:-52px; width:170px;height:170px;background:#c77dff;opacity:.11"></div>

      <div class="scene">
        <div class="pile3d">
          ${[0,1,2,3,4,5].map((i) => `
            <div class="verre" style="--c:${PALETTE[i]}; top:${i * 41}px;
                 width:${170 - i * 7}px; opacity:${(0.80 - i * 0.115).toFixed(2)}"></div>`).join('')}
        </div>
      </div>

      <div class="logo-wrap" style="left:248px;top:66px">
        <div class="logo-glow"></div>
        <div class="logo" style="background:url('${LOGO}') center/cover"></div>
        <div class="flaque"></div>
      </div>

      <div class="rai"></div>
      <div class="grain"></div>
      <div class="vignette"></div>
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
  await page.setContent(
    `<style>:root{--grain:url("${GRAIN}")}${BASE}</style>${html}`);
  await page.waitForTimeout(250);
  writeFileSync(join(OUT, `tuile-${nom}.png`), await page.screenshot());
  await page.close();
  console.log('  ✓', `tuile-${nom}.png`);
}
await browser.close();
