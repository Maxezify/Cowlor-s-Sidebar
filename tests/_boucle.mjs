import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ICI = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', e.message));
await p.goto(pathToFileURL(join(ICI, 'page.html')).href);
await p.evaluate(() => {
  const h = new Date(Date.now() - 60 * 60_000).toISOString();
  window.__fx = { abo: { id: '1', createdAt: h, viewers: 900, game: 'G', tags: [] } };
  window.__addCard('abo', 'G', '900');
});
await p.waitForTimeout(3000);
console.log(JSON.stringify(await p.evaluate(() => {
  const carte = [...document.querySelectorAll('.side-nav-card')]
    .find((c) => c.dataset.tseLogin === 'abo');
  if (!carte) return { erreur: 'carte absente' };
  /* La classe est posée ICI, dans la même évaluation que la mesure : le scan
     suivant la retirerait (applySubStyle nettoie ce qui ne lui revient pas).
     Ce qu'on mesure est le CSS seul — les images-clés de la lueur de fond. */
  carte.classList.add('tse-sub');
  void carte.offsetHeight;
  const anims = carte.getAnimations({ subtree: true })
    .filter((a) => a.animationName === 'tse-sub-lueur');
  if (!anims.length) return { erreur: 'animation absente',
                              vues: carte.getAnimations({ subtree: true }).map((a) => a.animationName) };
  const a = anims[0];
  const duree = a.effect.getTiming().duration;
  const lire = (t) => { a.currentTime = t;
                        return getComputedStyle(carte, '::after').backgroundPosition; };
  const debut = lire(0);
  const milieu = lire(duree / 2);
  const fin = lire(duree - 1);   // la DERNIÈRE image, pas le rebouclage
  const nb = (s) => s.split(",").map((x) => parseFloat(x));
  const d = nb(debut), f = nb(fin);
  const ecarts = d.map((v, i) => Math.abs(v - f[i]));
  return { duree, debut, milieu, fin, ecartMax: Math.max(...ecarts.slice(1)) };
}), null, 1));
await b.close();
