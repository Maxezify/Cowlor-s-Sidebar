import { scene, browser } from './promo.mjs';

// Chaînes INVENTÉES : aucune identité réelle empruntée, aucun endossement suggéré.
const DECOR = () => {
  const h = (min) => new Date(Date.now() - min * 60_000).toISOString();
  window.__fx = {
    novaflux:    { id:'101', createdAt:h(259), viewers:18420, game:'Just Chatting',      tags:['Français'],
                   title:'On refait le monde avant le sub-ton de ce soir' },
    kiraplays:   { id:'102', createdAt:h(132), viewers:9310,  game:'League of Legends',  tags:['Français'],
                   title:'Objectif Master avant la fin du mois — jour 12' },
    atlasgaming: { id:'103', createdAt:h(94),  viewers:6240,  game:'Valorant',           tags:['Français'] },
    mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',                tags:['Français'] },
    orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',          tags:['Français'] },
    duskraven:   { id:'106', createdAt:h(47),  viewers:1960,  game:'Elden Ring',         tags:['English'] },
    pixelforge:  { id:'107', createdAt:h(188), viewers:1240,  game:'Software & Games',   tags:['English'] },
    lumenkai:    { id:'108', createdAt:h(76),  viewers:980,   game:'Just Chatting',      tags:['Deutsch'] },
  };
  // Un vrai co-stream Guest Star entre deux des chaînes.
  const invites = [
    { id:'102', login:'kiraplays',   viewers:9310, combined:15570 },
    { id:'103', login:'atlasgaming', viewers:6240, combined:15570 },
  ];
  window.__gs = {
    '102': { hostId:'102', hostLogin:'kiraplays', guests:invites },
    '103': { hostId:'102', hostLogin:'kiraplays', guests:invites },
  };
  const c = (l, cat, v) => window.__addCard(l, cat, v);
  c('novaflux','Just Chatting','18,4 k');
  c('kiraplays','League of Legends','15,5 k');
  c('atlasgaming','League of Legends','15,5 k');
  c('mirabelle','Art','4,1 k');
  c('orionwave','Minecraft','2,8 k');
  c('duskraven','Elden Ring','1,9 k');
  c('pixelforge','Software & Games','1,2 k');
  c('lumenkai','Just Chatting','980');
  // Classement mondial pour le mode « Top Chaînes ».
  // createdAt EXPLICITE : sans lui le stub date les streams du 1er janvier et
  // les cartes affichent des durées de plusieurs milliers d'heures.
  window.__cats = [
    { name:'Just Chatting', viewers:412_000, streams:[
      { login:'solstice_tv', viewers:64_200, createdAt:h(196), tags:['Français'] },
      { login:'novaflux',    viewers:18_420, createdAt:h(259), tags:['Français'] },
      { login:'valehart',    viewers:12_050, createdAt:h(38),  tags:['Français'] }] },
    { name:'League of Legends', viewers:288_000, streams:[
      { login:'kiraplays',   viewers:15_570, createdAt:h(132), tags:['Français'] },
      { login:'zephyrlane',  viewers:31_400, createdAt:h(87),  tags:['Français'] }] },
    { name:'GTA V', viewers:196_000, streams:[
      { login:'ravencourt',  viewers:27_800, createdAt:h(421), tags:['Français'] },
      { login:'brumefall',   viewers:9_640,  createdAt:h(12),  tags:['Français'] }] },
    { name:'Valorant', viewers:151_000, streams:[
      { login:'atlasgaming', viewers:6_240,  createdAt:h(94),  tags:['Français'] },
      { login:'ombrelune',   viewers:5_130,  createdAt:h(163), tags:['Français'] }] },
  ];
};

const T = {
  fr: {
    hero:  ['<span class="kicker">Twitch, mais en mieux</span>' +
            '<h1>Votre sidebar<br>vous <em>dit tout</em>.</h1>' +
            '<p>Durée de stream, co-streams colorés, streams qui viennent de démarrer. ' +
            'Les infos qu\'il fallait aller chercher sont déjà là.</p>',
            '<b>Cowlor\'s Sidebar</b> · gratuit, sans compte, sans pub'],
    apercu:['<span class="kicker">Aperçu au survol</span>' +
            '<h1>Regardez<br><em>avant</em> de cliquer.</h1>' +
            '<p>Une seconde de survol et le stream s\'ouvre en direct, avec son titre ' +
            'complet et le contexte : co-stream, sponsor, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · l\'aperçu marche partout dans la sidebar'],
    top:   ['<span class="kicker">Top Chaînes</span>' +
            '<h1>Tout Twitch,<br>dans <em>votre</em> sidebar.</h1>' +
            '<p>Un onglet, et les 30 chaînes les plus regardées prennent la place. ' +
            'Par catégorie, par langue, recalculé en continu.</p>',
            '<b>Cowlor\'s Sidebar</b> · un clic pour y aller, un clic pour revenir'],
    filtre:['<span class="kicker">Filtres</span>' +
            '<h1>Trouvez<br>en <em>deux clics</em>.</h1>' +
            '<p>Par catégorie, par langue — avec les drapeaux. Seules les valeurs ' +
            'réellement présentes chez vos suivis sont proposées.</p>',
            '<b>Cowlor\'s Sidebar</b> · rien à configurer, jamais'],
    tri:   ['<span class="kicker">Cinq tris</span>' +
            '<h1>Votre liste,<br><em>votre</em> ordre.</h1>' +
            '<p>Spectateurs, popularité perso, durée de stream, alphabétique — ' +
            'ou les co-streams regroupés en tête.</p>',
            '<b>Cowlor\'s Sidebar</b> · votre historique reste dans votre navigateur'],
  },
};

const L = 'fr', S = T[L];
console.log('Captures 1280 x 800 :');

await scene({ nom:`01-hero-${L}`, lang:L, jeu:DECOR, titre:S.hero[0], sousTitre:S.hero[1] });

await scene({ nom:`02-apercu-${L}`, lang:L, jeu:DECOR, titre:S.apercu[0], sousTitre:S.apercu[1],
  echelleMax:1, texteEtroit:true,
  apres: async (page) => {
    await page.evaluate(() => {
      const c = [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'kiraplays');
      c.dispatchEvent(new MouseEvent('mouseenter', { bubbles:false }));
    });
    await page.waitForTimeout(2600);
    // L'aperçu se place normalement contre la carte survolée ; ici le cadre de
    // présentation est agrandi, donc on le repose à droite de la barre — là où
    // l'utilisateur le voit réellement sur Twitch.
    await page.evaluate(() => {
      const pop = document.querySelector('.tse-preview');
      if (!pop) return;
      pop.style.left = '374px'; pop.style.top = '150px';
      pop.style.right = 'auto'; pop.style.bottom = 'auto';
    });
    await page.waitForTimeout(300);
  } });

await scene({ nom:`03-top-${L}`, lang:L, jeu:DECOR, titre:S.top[0], sousTitre:S.top[1],
  apres: async (page) => {
    await page.evaluate(() =>
      document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
    await page.waitForTimeout(2600);
  } });

await scene({ nom:`04-filtres-${L}`, lang:L, jeu:DECOR, titre:S.filtre[0], sousTitre:S.filtre[1],
  apres: async (page) => {
    await page.evaluate(() => document.querySelector('#tse-lang-dd .tse-dd-btn').click());
    await page.waitForTimeout(400);
  } });

// Un historique de visites plausible : c'est lui qui donne son sens au tri
// « popularité perso », et il ne quitte jamais le navigateur.
const J = 86_400_000, N = Date.now();
const VISITES = {
  lumenkai:  [N-2*3600e3, N-J, N-2*J, N-3*J, N-4*J, N-6*J],
  duskraven: [N-5*3600e3, N-J, N-3*J, N-5*J],
  mirabelle: [N-J, N-4*J],
  novaflux:  [N-9*J],
};

await scene({ nom:`05-tri-${L}`, lang:L, jeu:DECOR, titre:S.tri[0], sousTitre:S.tri[1],
  visites:VISITES,
  apres: async (page) => {
    await page.evaluate(() => {
      // Tri « popularité perso » : c'est celui qui montre le mieux qu'un ordre
      // AUTRE que celui de Twitch est possible. On amorce quelques visites pour
      // que le classement ait de quoi trier.
      const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="popular"]');
      if (b) b.click();
    });
    await page.waitForTimeout(1200);
  } });

await browser.close();
