/* Bannière promotionnelle « en haut de la page » — 1400 x 560.

   C'est l'image que le Chrome Web Store affiche en tête de la fiche. Elle est
   soumise à la même contrainte de format que les captures et la tuile — JPEG,
   ou PNG 24 bits SANS canal alpha — et c'est en l'écrivant qu'on s'est aperçu
   que personne ne l'honorait : les images sortaient en RGBA. L'encodage sans
   alpha vit donc dans promo.mjs (png24 / reduireEnPng24), partagé par les
   trois formats, avec son contrôle d'en-tête.

   La mise en scène reprend celle des captures 1280 x 800 — barre réelle à
   gauche, discours à droite — pour que la fiche se tienne d'une image à
   l'autre. La barre est agrandie puis recadrée par le haut, comme sur la
   tuile ; où exactement, c'est toute l'affaire du commentaire sur ECHELLE
   ci-dessous. Et les deux blocs sont ramenés vers le centre : le Store
   recadre cette bannière selon les mises en page, et ce qui touche un bord
   peut disparaître. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pageProduit, browser, ABOS, CSS_TWITCH, reduireEnPng24,
         glyphesManquants } from './promo.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.PROMO_OUT || join(ICI, 'promo');
mkdirSync(OUT, { recursive: true });
const LOGO = 'data:image/png;base64,' +
  readFileSync(join(ICI, 'icons', 'icon128.png')).toString('base64');

const LARGEUR = 1400, HAUTEUR = 560;

/* L'agrandissement de la barre. Il se paie en cartes : la liste commence à
   152 px du sommet et chaque carte en fait 43. À 1,5, cinq cartes entières
   tiennent dans les 500 px du cadre, avec des pseudos à 19,5 px et cinquante
   pixels de marge — de quoi ne pas dépendre du pixel près.

   Le RECADRAGE, lui, ne peut pas être un nombre écrit ici, et il a fallu trois
   essais pour l'admettre. Écrit en dur — 38 px, la hauteur du titre de section
   — la bannière ANGLAISE sortait avec une carte de moins que les six autres :
   sous Inter, « Followed Channels / Top Channels » ne tient pas côte à côte
   dans 240 px, et la bascule passe sur deux rangs. Déduit du DOM mais mesuré
   trop tôt, c'est l'ESPAGNOLE qui décrochait : « Todas las categorías » et le
   globe se replient eux aussi, mais seulement une fois la police en place.

   Le recadrage est donc mesuré APRÈS la feuille de style ET après
   document.fonts.ready, et il s'ancre sur la première carte — pas sur ce qui
   la précède. Ce qui la précède varie ; elle, non. Le garde-fou vérifie
   l'invariant qui compte : la première carte tombe à 69 px du haut du cadre
   dans les douze langues — le russe, le polonais et le japonais replient eux
   aussi la bascule, et « coupe » passe de 159 à 200 px sans que la première
   carte bouge d'un pixel. C'est exactement ce qu'on lui demande. */
const ECHELLE = 1.5;

// Chaînes INVENTÉES, comme partout ailleurs : aucune identité empruntée.
const DECOR = () => {
  const h = (m) => new Date(Date.now() - m * 60_000).toISOString();
  window.__fx = {
    novaflux:    { id:'101', createdAt:h(259), viewers:18420, game:'Just Chatting',     tags:['Français'] },
    kiraplays:   { id:'102', createdAt:h(132), viewers:9310,  game:'League of Legends', tags:['Français'] },
    atlasgaming: { id:'103', createdAt:h(94),  viewers:6240,  game:'Valorant',          tags:['Français'] },
    mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',               tags:['Français'] },
    orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',         tags:['Français'] },
    duskraven:   { id:'106', createdAt:h(47),  viewers:1960,  game:'Elden Ring',        tags:['English'] },
    lumenkai:    { id:'107', createdAt:h(76),  viewers:980,   game:'Just Chatting',     tags:['Deutsch'] },
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
  window.__addCard('lumenkai','Just Chatting','980');
};

/* Le discours, par fiche. Volontairement COURT : le Store recommande une
   bannière graphique, pas une affiche de texte, et celle-ci est de toute façon
   souvent réduite. Une accroche, une ligne de rassurance, rien de plus. */
const T = {
  fr:    { ui:'fr', section:'fr',
           phrase:'Votre sidebar vous dit tout.',
           pied:'gratuit · sans compte · sans pub' },
  en:    { ui:'en', section:'en',
           phrase:'Your sidebar tells you everything.',
           pied:'free · no account · no ads' },
  de:    { ui:'de', section:'de',
           phrase:'Deine Sidebar sagt dir alles.',
           pied:'gratis · ohne Konto · ohne Werbung' },
  es:    { ui:'es', section:'es',
           phrase:'Tu barra lateral te lo cuenta todo.',
           pied:'gratis · sin cuenta · sin anuncios' },
  es419: { ui:'es', section:'es',
           phrase:'Tu barra lateral te lo cuenta todo.',
           pied:'gratis · sin cuenta · sin publicidad' },
  ptbr:  { ui:'pt', section:'ptbr',
           phrase:'Sua barra lateral te conta tudo.',
           pied:'grátis · sem conta · sem anúncios' },
  ptpt:  { ui:'pt', section:'ptpt',
           phrase:'A tua barra lateral diz-te tudo.',
           pied:'grátis · sem conta · sem publicidade' },
  it:    { ui:'it', section:'it',
           phrase:'La tua sidebar ti dice tutto.',
           pied:'gratis · senza account · senza pubblicità' },
  pl:    { ui:'pl', section:'pl',
           phrase:'Twój pasek boczny mówi ci wszystko.',
           pied:'za darmo · bez konta · bez reklam' },
  ru:    { ui:'ru', section:'ru',
           phrase:'Ваша панель расскажет вам всё.',
           pied:'бесплатно · без аккаунта · без рекламы' },
  ja:    { ui:'ja', section:'ja',
           phrase:'サイドバーがすべて教えます。',
           pied:'無料 · アカウント不要 · 広告なし' },
  zh:    { ui:'zh', section:'zh',
           phrase:'侧边栏什么都告诉你。',
           pied:'免费 · 无需账号 · 没有广告' },
};

/* Le recadrage vertical, appelé APRÈS composer ET après document.fonts.ready.
   Il l'était d'abord dans composer, et l'espagnol sortait avec trente-six
   pixels de trop au-dessus de la première carte : la rangée de filtres s'y
   replie, mais seulement une fois la police en place. Mesurer avant, c'est
   mesurer une mise en page qui va encore bouger. */
function recadrer(ECHELLE) {
  const nav = document.getElementById("side-nav");
  const rn = nav.getBoundingClientRect();
  const rc1 = document.querySelector(".side-nav-card")?.getBoundingClientRect();
  const bande = 46 * ECHELLE;   // la rangée de tri (32 px) plus un peu d'air
  const coupe = rc1 ? Math.round(rc1.top - rn.top - bande)
                    : Math.round(110 * ECHELLE);
  nav.style.top = (-coupe) + "px";
  window.__coupe = coupe;   // relu par le bilan, pour que le journal le dise
}

function composer({ CSS, LOGO, ECHELLE, LARGEUR, HAUTEUR, phrase, pied }) {
  const nav = document.getElementById('side-nav');
  document.querySelector('[data-tse-stories="row"]')?.remove();

  const st = document.createElement('style');
  st.textContent = CSS + `
    html,body{margin:0;padding:0;width:${LARGEUR}px;height:${HAUTEUR}px;overflow:hidden;
      background:#0a0a0c}
    #root{position:fixed;left:0;top:0;opacity:0;pointer-events:none}
    #fond{position:fixed;left:0;top:0;width:${LARGEUR}px;height:${HAUTEUR}px;z-index:0;
      background:
        radial-gradient(760px 620px at 21% 44%, rgba(145,71,255,.30), transparent 64%),
        radial-gradient(680px 520px at 88% 88%, rgba(38,212,200,.11), transparent 62%),
        radial-gradient(560px 460px at 74% 6%,  rgba(255,122,138,.09), transparent 60%),
        linear-gradient(158deg,#121016 0%,#0a0a0c 54%,#141019 100%)}

    /* Le conteneur découpe, la barre est mise à l'échelle dedans : c'est lui
       qui porte le cadre, l'ombre et le fondu. Sans cette séparation, le fondu
       serait calculé AVANT la mise à l'échelle et tomberait hors de l'image. */
    /* Les deux blocs sont ramenés vers le CENTRE, avec des marges égales à
       gauche et à droite. Le Store recadre cette bannière selon les mises en
       page : ce qui touche un bord peut disparaître, et une composition collée
       à gauche laisserait le milieu — c'est-à-dire le vide entre les deux
       blocs — comme seule chose sûre de survivre. */
    #cadre{position:fixed;z-index:2;left:190px;top:${Math.round((HAUTEUR - 500) / 2)}px;
      width:${Math.round(240 * ECHELLE)}px;height:500px;overflow:hidden;
      border-radius:18px;background:#1f1f23;
      border:1px solid rgba(255,255,255,.09);
      box-shadow:0 40px 90px rgba(0,0,0,.72), 0 0 0 1px rgba(145,71,255,.13);
      /* Fondu EN HAUT aussi : la coupe tombe une vingtaine de pixels au-dessus
         de la rangée de tri, et le bas de la rangée précédente y dépassait —
         un liseré qui avait l'air d'un défaut plutôt que d'un cadrage. Le
         fondu s'arrête à 4 %, soit 20 px, juste avant la rangée de tri. */
      -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 4%,#000 84%,transparent 99%);
      mask-image:linear-gradient(180deg,transparent 0,#000 4%,#000 84%,transparent 99%)}
    /* Le décalage vertical n'est PAS écrit ici : il est mesuré plus bas, une
       fois cette feuille appliquée. Le mesurer avant reviendrait à mesurer une
       barre qui n'a pas encore la largeur de Twitch — donc une bascule qui ne
       s'est pas encore repliée là où elle se repliera. */
    #side-nav{position:absolute!important;left:0;
      width:240px;transform:scale(${ECHELLE});transform-origin:left top}

    #dire{position:fixed;z-index:3;left:${190 + Math.round(240 * ECHELLE) + 90}px;
      top:50%;transform:translateY(-50%);width:580px;color:#efeff1}
    #dire .logo{width:96px;height:96px;border-radius:22px;
      background:url('${LOGO}') center/cover;margin:0 0 24px;
      box-shadow:0 18px 36px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.22),
                 0 0 64px rgba(190,130,255,.42)}
    #dire h1{margin:0 0 18px;font-size:68px;line-height:1.05;font-weight:800;
      letter-spacing:-2px}
    #dire h1 em{font-style:normal;color:#a970ff}
    #dire p{margin:0;font-size:30px;line-height:1.4;color:#bcbcc8;font-weight:400}
    #dire .pied{margin:22px 0 0;font-size:21px;color:#7c7c90;font-weight:600;
      letter-spacing:.02em}
  `;
  document.head.appendChild(st);

  const fond = document.createElement('div');
  fond.id = 'fond';
  document.body.appendChild(fond);

  // #root est masqué par opacity:0, et l'opacité masque TOUS ses descendants,
  // fût-ce en position:fixed. La barre doit donc en sortir.
  const cadre = document.createElement('div');
  cadre.id = 'cadre';
  document.body.appendChild(cadre);
  cadre.appendChild(nav);

  const dire = document.createElement('div');
  dire.id = 'dire';
  dire.innerHTML = `<div class="logo"></div>` +
    `<h1>Cowlor's <em>Sidebar</em></h1>` +
    `<p>${phrase}</p><p class="pied">${pied}</p>`;
  document.body.appendChild(dire);
}

const LANGUES = process.env.PROMO_LANGS ? process.env.PROMO_LANGS.split(',') : Object.keys(T);
console.log(`Bannières ${LARGEUR} x ${HAUTEUR} (PNG 24 bits, sans alpha) :`);

for (const L of LANGUES) {
  const S = T[L];
  if (!S) throw new Error('fiche inconnue : ' + L);

  const page = await pageProduit({
    lang: S.ui, section: S.section, stockage: ABOS,
    viewport: { width: LARGEUR, height: HAUTEUR }, deviceScaleFactor: 2,
  });
  await page.evaluate(DECOR);
  await page.waitForTimeout(2400);
  // Tri « abonnements en tête » : seules cinq cartes entrent, autant que ce
  // soient celles qui portent l'or.
  await page.evaluate(() => {
    const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]');
    if (!b) throw new Error('bouton de tri « abonnements » absent');
    if (b.disabled) throw new Error('bouton de tri « abonnements » grisé');
    b.click();
  });
  await page.waitForTimeout(1200);
  await page.evaluate(composer,
    { CSS: CSS_TWITCH, LOGO, ECHELLE, LARGEUR, HAUTEUR, phrase: S.phrase, pied: S.pied });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.evaluate(recadrer, ECHELLE);
  await page.waitForTimeout(200);

  /* Ce que la bannière porte vraiment, mesuré dans son propre repère. Une
     image qui sortirait sans or, avec des pseudos illisibles ou un discours
     qui déborde serait une image ratée que rien ne signalerait. */
  const bilan = await page.evaluate(({ ECHELLE, LARGEUR, HAUTEUR }) => {
    const rc = document.getElementById('cadre').getBoundingClientRect();
    const entiere = (el) => {
      const r = el.getBoundingClientRect();
      return r.top >= rc.top && r.bottom <= rc.bottom && r.right <= rc.right;
    };
    const visibles = [...document.querySelectorAll('.side-nav-card')].filter(entiere);
    const titre = visibles[0]?.querySelector('[data-a-target="side-nav-title"]');
    const d = document.getElementById('dire').getBoundingClientRect();
    const h1 = document.querySelector('#dire h1');
    const st = h1 ? getComputedStyle(h1) : null;
    const inter = st ? (parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.05) : 1;
    const largeur = (f) => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '600 13px ' + f;
      return c.measureText('Chaînes suivies — kiraplays 18,4 k').width;
    };
    return {
      coupe: window.__coupe,
      premiere: visibles[0] ? Math.round(visibles[0].getBoundingClientRect().top - rc.top) : -1,
      hCarte: visibles[0] ? Math.round(visibles[0].getBoundingClientRect().height) : -1,
      cartes: visibles.length,
      // La rangée de tri doit être ENTIÈRE : c'est elle qui porte la pastille
      // du total, et une rangée coupée par le haut aurait l'air d'un bug.
      tri: (() => { const r = document.getElementById("tse-sort-row")?.getBoundingClientRect();
                    return !!r && r.top >= rc.top - 1 && r.bottom <= rc.bottom; })(),
      dorees: visibles.filter(c => c.classList.contains('tse-sub')).length,
      pseudo: titre
        ? +(parseFloat(getComputedStyle(titre).fontSize) * ECHELLE).toFixed(1) : 0,
      police: largeur('Inter, sans-serif') !== largeur('__absente__, sans-serif'),
      // Le titre de la bannière tient sur UNE ligne : « Cowlor's Sidebar » n'a
      // pas de coupure écrite, et se replier lui ferait perdre son allure de
      // logotype.
      vers: h1 ? Math.round(h1.getBoundingClientRect().height / inter) : 0,
      hors: d.top < 10 || d.bottom > HAUTEUR - 10 || d.right > LARGEUR - 10
            || d.left < rc.right + 24,
      gouttiere: Math.round(d.left - rc.right),
    };
  }, { ECHELLE, LARGEUR, HAUTEUR });

  console.log('  ' + L + ' — cadrage :', JSON.stringify(bilan));
  if (bilan.cartes < 5)   throw new Error(`cartes entières attendues : au moins 5, vues : ${bilan.cartes}`);
  if (bilan.dorees < 4)   throw new Error(`cartes dorées attendues : au moins 4, vues : ${bilan.dorees}`);
  if (bilan.pseudo < 18)  throw new Error(`pseudo attendu à 18 px au moins, mesuré : ${bilan.pseudo}`);
  if (!bilan.police)      throw new Error('Inter n\'a pas été chargée');
  if (bilan.vers !== 1)   throw new Error(`titre attendu sur une ligne, mesuré : ${bilan.vers}`);
  if (!bilan.tri)         throw new Error('la rangée de tri est coupée par le cadre');
  // L'invariant qui fait que les douze bannières se ressemblent : la première
  // carte tombe au même endroit dans toutes. C'est lui, et non « coupe », qui
  // doit être constant — « coupe », lui, absorbe justement les replis de la
  // bascule anglaise et des filtres espagnols.
  if (Math.abs(bilan.premiere - 69) > 3)
    throw new Error(`première carte attendue à 69 px du haut du cadre, mesurée : ${bilan.premiere}`);
  if (bilan.hors)         throw new Error('le discours sort du cadre ou touche la barre');
  // Un tofu ne se rattrape pas après publication : on refuse de photographier.
  const manquants = await glyphesManquants(page);
  if (manquants.length) {
    throw new Error(`aucune police embarquée ne couvre « ${manquants.join('')} » — ` +
                    'relancer « npm run polices » après avoir changé un texte');
  }

  // Rendu en 2x puis réduit par Chromium lui-même : le texte y gagne un piqué
  // qu'un rendu direct en 1x ne donne pas.
  const brut = await page.screenshot();
  await page.close();

  // Réduction 2x -> 1x puis encodage en PNG 24 bits sans alpha : partagé avec
  // les captures et la tuile, contrôle d'en-tête compris.
  const fichier = await reduireEnPng24(brut, LARGEUR, HAUTEUR);

  const nom = `00-banniere-${L}.png`;
  writeFileSync(join(OUT, nom), fichier);
  console.log(`  ✓ ${nom} — ${LARGEUR} x ${HAUTEUR}, 24 bits sans alpha, ${(fichier.length / 1024).toFixed(0)} Ko`);
}

await browser.close();
