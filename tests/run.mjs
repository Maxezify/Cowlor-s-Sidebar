import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Tout est résolu depuis CE fichier : `npm test` tourne à la racine du dépôt,
// un lancement direct tourne dans tests/, et les deux doivent marcher.
const ICI = dirname(fileURLToPath(import.meta.url));
const URL_PAGE = pathToFileURL(join(ICI, 'page.html')).href;
let pass = 0, fail = 0;
const ok  = (n, c, extra='') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)); };
const wait = (p, ms) => p.waitForTimeout(ms);
// Attend une CONDITION dans la page, au lieu d'une durée. Un relevé
// d'abonnements traverse trois onglets, chacun étant une page complète à
// charger : sa durée dépend de la machine, et un délai fixe finit toujours par
// être trop court un jour. Une expiration n'échoue pas ici — elle laisse
// l'assertion qui suit constater et dire ce qui manque.
const attendre = (p, fn, ms = 10_000) =>
  p.waitForFunction(fn, null, { timeout: ms }).catch(() => {});
// Intl insère une espace fine insécable (U+202F) ou insécable (U+00A0) :
// on normalise avant comparaison, l'espace exacte n'est pas l'objet du test.
const nz = (s) => (s ?? '').replace(/[\u00a0\u202f\u2009]/g, ' ');


// Survol synthétique : l'extension écoute mouseenter/mouseleave en phase de
// CAPTURE sur document, donc un événement dispatché sur la carte l'atteint.
// Plus fiable que page.hover(), qui exige une carte visible et immobile alors
// que le voile de chargement et le tri la déplacent encore.
const hoverCard = (page, i) => page.evaluate((idx) => {
  const cards = [...document.querySelectorAll('.side-nav-card')];
  const card = cards[idx];
  if (!card) throw new Error('carte ' + idx + ' absente');
  card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
}, i);
const unhoverCard = (page, i) => page.evaluate((idx) => {
  const card = [...document.querySelectorAll('.side-nav-card')][idx];
  if (card) card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
}, i);


// Harnais « origines réelles ». La page parente est servie comme
// https://www.twitch.tv et l'iframe lecteur comme https://player.twitch.tv,
// par interception réseau. C'est indispensable dès qu'on teste un postMessage
// cross-origin : en file://, l'origine du parent est opaque et un envoi ciblé
// n'a nulle part où arriver. Bonus : la garde d'hôte du pont s'applique pour
// de vrai, et location.ancestorOrigins renvoie ce qu'il renverra en production.
// Le charset est EXPLICITE dans chaque contentType servi. Sans lui, le
// navigateur renifle l'encodage du script, et un fichier riche en accents
// finit décodé en latin-1 : « Invalid or unexpected token » sur une chaîne
// coupée en plein caractère. La page file:// n'était pas concernée, d'où un
// symptôme limité aux seuls scénarios à origines réelles.
const fileText = (name) => readFileSync(join(ICI, name), 'utf8');
// PNG 1x1 transparent — la plus petite image valide qui fasse émettre `load`.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
async function freshTwitch(playerBody, cdnUrls = [], chemin = '/', init = null) {
  const page = await browser.newPage();
  page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
  await page.route('https://www.twitch.tv/**', (route) => {
    const url = route.request().url();
    const name = url.split('/').pop().split('?')[0];
    if (name.endsWith('.js')) {
      return route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: fileText(name) });
    }
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fileText('page.html') });
  });
  await page.route('https://player.twitch.tv/**', (route) => {
    const name = route.request().url().split('/').pop().split('?')[0];
    if (name.endsWith('.js')) {
      return route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: fileText(name) });
    }
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: playerBody });
  });
  // Le CDN des miniatures est inaccessible d'ici : on sert un PNG 1x1 valide,
  // ce qui déclenche un vrai événement `load` sur l'<img>. Les URLs demandées
  // sont journalisées : c'est ainsi qu'on vérifie la stabilité du cache-buster.
  await page.route('https://static-cdn.jtvnw.net/**', (route) => {
    cdnUrls.push(route.request().url());
    route.fulfill({ contentType: 'image/png', body: PIXEL,
                    headers: { 'Cache-Control': 'max-age=300' } });
  });
  // Veille du voile, posée dans toutes les pages. Elle date sa levée par
  // rapport au démarrage de LA PAGE : une assertion fondée là-dessus ne dépend
  // plus de la charge de la machine, alors qu'un « attendre 700 ms puis
  // regarder » se met à mentir dès que le test tourne à côté d'autre chose.
  // Posée sur documentElement, qui existe dès document_start, avec subtree :
  // c'est la classe de <body> qui change, et <body> n'existe pas encore.
  await page.addInitScript(() => {
    window.__voileLeve = null;
    const t0 = Date.now();
    let vu = false;
    const mo = new MutationObserver(() => {
      const pose = document.body && document.body.classList.contains('tse-loading');
      if (pose) { vu = true; return; }
      if (vu && window.__voileLeve === null) window.__voileLeve = Date.now() - t0;
    });
    // documentElement n'existe pas encore dans toutes les frames à
    // document_start — l'iframe du lecteur, notamment. On réessaie plutôt que
    // de jeter : une exception ici ferait échouer la page entière.
    const armer = () => {
      if (!document.documentElement) { setTimeout(armer, 0); return; }
      mo.observe(document.documentElement,
                 { attributes: true, subtree: true, attributeFilter: ['class'] });
    };
    armer();
  });
  // addInitScript s'exécute dans CHAQUE frame avant tout script de la page :
  // c'est le seul moyen d'atteindre l'iframe /subscriptions, qui est un
  // document neuf que le test ne peut pas préparer autrement.
  if (init) await page.addInitScript(init);
  // Le chemin compte : le relevé d'abonnement ne se déclenche que sur la
  // page d'une CHAÎNE, et c'est location.pathname qui la nomme.
  await page.goto('https://www.twitch.tv' + chemin);
  return page;
}


// Survol désigné par LOGIN et non par indice : l'extension trie les cartes, donc
// un indice ne désigne pas la même chaîne d'un instant à l'autre.
const hoverLogin = (page, login) => page.evaluate((l) => {
  const card = [...document.querySelectorAll('.side-nav-card')]
    .find(c => c.dataset.tseLogin === l);
  if (!card) throw new Error('carte ' + l + ' absente');
  card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
}, login);

// Chromium est celui que Playwright a installé (`npx playwright install
// chromium`). TSE_CHROMIUM force un binaire précis, pour les environnements
// où le navigateur est fourni autrement.
const browser = await chromium.launch(
  process.env.TSE_CHROMIUM ? { executablePath: process.env.TSE_CHROMIUM } : {});

async function fresh() {
  const page = await browser.newPage();
  page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
  await page.goto(URL_PAGE);
  return page;
}
const state = (page) => page.evaluate(() => [...document.querySelectorAll('.side-nav-card')].map(c => ({
  login:   c.dataset.tseLogin,
  offline: c.dataset.tseOffline === 'true',
  gqlOff:  c.dataset.tseGqlOffline === 'true',
  hits:    c.dataset.tseOfflineHits,
  viewers: c.dataset.tseViewers,
  shown:   c.querySelector('.tse-viewers')?.textContent ?? null,
  nativeHidden: !!c.dataset.tseViewers,
  nativeText: c.querySelector('.side-nav-card__live-status [aria-hidden="true"]:not(.tse-viewers)')?.textContent,
  uptime:  c.querySelector('.tse-uptime')?.textContent ?? null,
  cat:     c.dataset.tseCategory,
  langs:   c.dataset.tseLangs,
  order:   c.dataset.tseTwitchOrder
})));

// ═════════════ 1. Rendu initial ═════════════
console.log('\n1. Rendu initial — données API substituées au DOM');
{
  const page = await fresh();
  await page.evaluate(() => {
    const h = new Date(Date.now() - 95 * 60_000).toISOString();
    window.__fx = {
      alpha: { id:'1', createdAt:h, viewers:67312, game:'VALORANT',      tags:['Français'] },
      beta:  { id:'2', createdAt:new Date(Date.now()-5*60_000).toISOString(), viewers:4089, game:'Just Chatting', tags:['English'] },
    };
    // Le DOM Twitch est VOLONTAIREMENT périmé : vieux compteur, vieille catégorie.
    window.__addCard('alpha', 'Ancienne catégorie', '12 k');
    window.__addCard('beta',  'Just Chatting', '3 k');
  });
  await wait(page, 1500);
  const s = await state(page);
  ok('compteur remplacé par la valeur API (fr)', nz(s[0].shown) === '67,3 k', JSON.stringify(s[0]));
  ok('compteur natif masqué (marqueur posé)',    s[0].nativeHidden === true);
  ok('compteur natif toujours dans le DOM',       s[0].nativeText === '12 k');
  const disp = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.side-nav-card .side-nav-card__live-status [aria-hidden="true"]:not(.tse-viewers)')).display);
  ok('compteur natif effectivement masqué par CSS', disp === 'none', disp);
  ok('uptime calculé depuis createdAt',           s[0].uptime === '1h35', s[0].uptime);
  ok('catégorie rafraîchie depuis l\'API',        s[0].cat === 'VALORANT', s[0].cat);
  const meta = await page.evaluate(() => {
    const m = document.querySelector('.side-nav-card [data-a-target="side-nav-card-metadata"]');
    return { name: m.querySelector('p[data-a-target="side-nav-title"]').textContent,
             cat:  m.querySelector('p[title]').textContent };
  });
  ok('catégorie réécrite dans le DOM Twitch', meta.cat === 'VALORANT', meta.cat);
  ok('le pseudo, lui, n\'est pas touché', meta.name === 'alpha', meta.name);
  ok('langues résolues via la même requête',      s[0].langs === '|Français|', s[0].langs);
  const opNames = await page.evaluate(() => [...new Set(window.__calls.map(c => c.op))]);
  ok('UseLive et TseLang ont disparu (fusionnées dans TseChannels)',
     !opNames.includes('UseLive') && !opNames.includes('TseLang') && opNames.includes('TseChannels'),
     JSON.stringify(opNames));
  // Invariant : UNE opération porte toutes les chaînes. On mesure la taille
  // des opérations, pas leur nombre total — celui-ci dépend du temps écoulé.
  const sizes = await page.evaluate(() => window.__calls.filter(c => c.op === 'TseChannels').map(c => c.n));
  ok('une seule opération couvre les 2 chaînes', Math.max(...sizes) === 2, JSON.stringify(sizes));
  ok('jamais une opération par chaîne', !sizes.every(n => n === 1), JSON.stringify(sizes));
  await page.close();
}

// ═════════════ 2. Rafraîchissement périodique ═════════════
console.log('\n2. Rafraîchissement — le compteur suit l\'API');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__fx = { alpha: { id:'1', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:1000, game:'VALORANT', tags:[] } };
    window.__addCard('alpha', 'VALORANT', '1 k');
  });
  await wait(page, 1200);
  const before = (await state(page))[0].shown;
  await page.evaluate(() => { window.__fx.alpha.viewers = 25400; });
  await wait(page, 1800);
  const after = (await state(page))[0].shown;
  ok('valeur initiale', nz(before) === '1 k', before);
  ok('valeur mise à jour sans rechargement', nz(after) === '25,4 k', after);
  await page.close();
}

// ═════════════ 3. Confirmation hors-ligne ═════════════
console.log('\n3. Hors-ligne — deux réponses réseau requises, pas deux scans');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__fx = {
      alpha: { id:'1', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:1000, game:'A', tags:[] },
      beta:  { id:'2', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:2000, game:'B', tags:[] },
    };
    window.__addCard('alpha', 'A', '1 k');
    window.__addCard('beta',  'B', '2 k');
  });
  await wait(page, 1200);
  ok('les deux cartes visibles au départ', (await state(page)).every(c => !c.offline));

  // alpha coupe. Le DOM Twitch, lui, continue d'afficher "live".
  await page.evaluate(() => { window.__fx.alpha = null; });
  // Beaucoup de mutations DOM pendant un seul TTL : si les hits se comptaient
  // par scan et non par réponse, la carte serait masquée immédiatement.
  await page.evaluate(() => {
    let i = 0;
    const id = setInterval(() => { document.getElementById('cards').setAttribute('data-noise', i++); if (i > 25) clearInterval(id); }, 20);
  });
  await wait(page, 700);
  const mid = (await state(page)).find(c => c.login === 'alpha');
  ok('après 1 réponse null : encore visible', !mid.offline, JSON.stringify(mid));
  ok('compteur de confirmation à 1 malgré ~25 scans', mid.hits === '1', 'hits=' + mid.hits);

  await wait(page, 1200);
  const late = (await state(page)).find(c => c.login === 'alpha');
  ok('après 2 réponses null : masquée', late.offline && late.gqlOff, JSON.stringify(late));
  const vis = await page.evaluate(() => getComputedStyle(
    [...document.querySelectorAll('.side-nav-card')].find(c => c.dataset.tseLogin === 'alpha')).display);
  ok('masquage effectif par CSS', vis === 'none', vis);
  ok('l\'autre carte est intacte', !(await state(page)).find(c => c.login === 'beta').offline);
  await page.close();
}

// ═════════════ 4. Redémarrage (correction du bug G-1) ═════════════
console.log('\n4. Redémarrage — la carte masquée par l\'extension revient seule');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__fx = { alpha: null };
    window.__addCard('alpha', 'A', '1 k');   // DOM Twitch : toujours "live"
  });
  await wait(page, 2000);
  const hidden = (await state(page))[0];
  ok('carte masquée après confirmation', hidden.gqlOff === true, JSON.stringify(hidden));

  await page.evaluate(() => {
    window.__fx.alpha = { id:'1', createdAt:new Date(Date.now()-3*60_000).toISOString(), viewers:812, game:'Retour', tags:['Français'] };
  });
  await wait(page, 1800);
  const back = (await state(page))[0];
  ok('carte réaffichée sans intervention', !back.offline && !back.gqlOff, JSON.stringify(back));
  ok('compteur ré-affiché', nz(back.shown) === '812', back.shown);
  ok('uptime recalculé', back.uptime === '3m', back.uptime);
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('.side-nav-card')).display);
  ok('visible dans le rendu', vis !== 'none', vis);
  await page.close();
}

// ═════════════ 5. Pas de boucle de scan ═════════════
console.log('\n5. Stabilité — aucune boucle scan → écriture → scan');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__fx = {};
    for (let i = 0; i < 12; i++) {
      const l = 'chan' + i;
      window.__fx[l] = { id:'i'+i, createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:1000+i, game:'G'+(i%3), tags:['Français'] };
      window.__addCard(l, 'G'+(i%3), '1 k');
    }
  });
  await wait(page, 1500);
  const n1 = await page.evaluate(() => window.__calls.length);
  await wait(page, 3000);   // 5 périodes de rafraîchissement (600 ms)
  const n2 = await page.evaluate(() => window.__calls.length);
  const perTick = (n2 - n1) / 5;
  ok('~1 requête par période de rafraîchissement', perTick >= 0.6 && perTick <= 2.2,
     `${n2 - n1} requêtes sur 5 périodes (${perTick.toFixed(2)}/période)`);
  console.log(`     → ${n2 - n1} requêtes sur 3 s pour 12 chaînes (une boucle donnerait ~12 à 4 Hz)`);
  await page.close();
}

// ═════════════ 6. Découpage des lots (G-2) ═════════════
console.log('\n6. Découpage — aucune opération ne dépasse GQL_MAX_LOGINS');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__fx = {};
    for (let i = 0; i < 63; i++) {
      const l = 'ch' + i;
      window.__fx[l] = { id:'i'+i, createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:100+i, game:'G', tags:[] };
      window.__addCard(l, 'G', '100');
    }
  });
  await wait(page, 1600);
  // On MESURE un cycle de régime établi, pas le démarrage. Pendant que les 63
  // cartes sont insérées, un flush peut partir avec une file à moitié remplie
  // (35 puis 28, au lieu de 50 puis 13) : c'est la course entre l'insertion et
  // le debounce, pas un défaut de découpage. Mesurer ça rendait l'assertion
  // flottante — verte deux fois sur trois. On repart donc d'un journal vide,
  // une fois les 63 chaînes connues, et on observe le balayage suivant.
  await page.evaluate(() => { window.__calls.length = 0; });
  await wait(page, 1400);
  // Filtrer sur l'opération : la requête Guest Star ne porte pas de `logins`
  // et compterait pour une tranche de taille zéro.
  const calls = await page.evaluate(() => window.__calls.filter(c => c.op === 'TseChannels').map(c => c.n));
  const max = Math.max(...calls);
  ok('taille max d\'une tranche ≤ 50', max <= 50, 'max=' + max);
  // Invariant : un balayage complet des 63 chaînes tient en 2 opérations
  // (50 + 13). Indépendant du nombre de cycles observés.
  const tailles = [...new Set(calls)].sort((a, b) => b - a);
  ok('un balayage complet tient en 2 opérations (50 + 13)',
     tailles.length === 2 && tailles[0] === 50 && tailles[1] === 13, JSON.stringify(tailles));
  const covered = await page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')].filter(c => c.dataset.tseViewers).length);
  ok('les 63 chaînes sont résolues malgré le découpage', covered === 63, covered + '/63');
  console.log(`     → tailles observées : ${[...new Set(calls)].sort((a,b)=>b-a).join(', ')}`);
  await page.close();
}

// ═════════════ 7. Panne réseau ═════════════
console.log('\n7. Panne réseau — état préservé, pas de martèlement');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__fx = { alpha: { id:'1', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:5000, game:'A', tags:[] } };
    window.__addCard('alpha', 'A', '5 k');
  });
  await wait(page, 1200);
  const before = (await state(page))[0];
  ok('état sain avant la panne', nz(before.shown) === '5 k', before.shown);

  await page.evaluate(() => { window.__failNext = 9999; window.__calls.length = 0; });
  // Bruit DOM continu : sans cooldown, chaque scan relancerait un lot.
  await page.evaluate(() => {
    let i = 0;
    const id = setInterval(() => { document.getElementById('cards').setAttribute('data-noise', i++); if (i > 120) clearInterval(id); }, 20);
  });
  await wait(page, 3000);
  const during = (await state(page))[0];
  const nCalls = await page.evaluate(() => window.__calls.length);
  ok('aucun faux « Terminé »', !during.offline && !during.gqlOff, JSON.stringify(during));
  ok('dernière valeur connue conservée', nz(during.shown) === '5 k', during.shown);
  ok('requêtes bornées par le cooldown', nCalls <= 6, nCalls + ' requêtes en 3 s (sans cooldown : ~120)');
  console.log(`     → ${nCalls} requêtes pendant 3 s de panne avec bruit DOM à 50 Hz`);

  await page.evaluate(() => { window.__failNext = 0; window.__fx.alpha.viewers = 9100; });
  await wait(page, 2500);
  const after = (await state(page))[0];
  ok('reprise automatique après la panne', nz(after.shown) === '9,1 k', after.shown);
  await page.close();
}

// ═════════════ 8. Tri par viewers ═════════════
console.log('\n8. Tri — sur les nombres exacts, plus sur le texte localisé');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__fx = {
      petit: { id:'1', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:900,    game:'G', tags:[] },
      moyen: { id:'2', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:67312,  game:'G', tags:[] },
      gros:  { id:'3', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:1200000, game:'G', tags:[] },
    };
    // Ordre DOM initial volontairement faux, textes natifs trompeurs.
    window.__addCard('petit', 'G', '999 k');
    window.__addCard('moyen', 'G', '1');
    window.__addCard('gros',  'G', '2');
  });
  await wait(page, 1800);
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')].map(c => c.dataset.tseLogin));
  ok('ordre décroissant sur les vrais nombres', JSON.stringify(order) === JSON.stringify(['gros','moyen','petit']), JSON.stringify(order));
  await page.close();
}

// ═════════════ 9. Locale allemande (nombre plein) ═════════════
console.log('\n9. Locale — l\'allemand garde le nombre plein, comme Twitch');
{
  const page = await browser.newPage();
  page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
  await page.goto(URL_PAGE);
  // Bascule l'UI en allemand AVANT que l'extension ne détecte la langue.
  await page.evaluate(() => {
    document.documentElement.lang = 'de-de';
    document.querySelector('.side-nav-section').setAttribute('aria-label', 'Kanäle, denen du folgst');
    window.__fx = {
      alpha: { id:'1', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:29339, game:'G', tags:[] },
      beta:  { id:'2', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:4089,  game:'G', tags:[] },
    };
    window.__addCard('alpha', 'G', '29.339');
    window.__addCard('beta',  'G', '4.089');
  });
  await wait(page, 1500);
  const s = await state(page);
  ok('29339 → « 29.339 » (séparateur de milliers, pas d\'abréviation)', s[0].shown === '29.339', s[0].shown);
  ok('4089 → « 4.089 »', s[1].shown === '4.089', s[1].shown);
  await page.close();
}

// ═════════════ 10. Garde-fou catégorie ═════════════
console.log('\n10. Garde-fou — jamais écraser le pseudo par la catégorie');
{
  const page = await browser.newPage();
  page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
  await page.goto(URL_PAGE);
  await page.evaluate(() => {
    window.__fx = { alpha: { id:'1', createdAt:new Date(Date.now()-60*60_000).toISOString(), viewers:500, game:'VALORANT', tags:[] } };
    const c = window.__addCard('alpha', 'Just Chatting', '500');
    // Simule un remaniement du markup Twitch où le SEUL p[title] de la
    // metadata porte le nom de la chaîne et non la catégorie.
    c.querySelector('[data-a-target="side-nav-card-metadata"]').innerHTML =
      '<p title="alpha">alpha</p>';
  });
  await wait(page, 1500);
  const txt = await page.evaluate(() =>
    document.querySelector('[data-a-target="side-nav-card-metadata"] p').textContent);
  ok('le pseudo n\'est pas écrasé', txt === 'alpha', txt);
  const cat = await page.evaluate(() => document.querySelector('.side-nav-card').dataset.tseCategory);
  ok('les filtres reçoivent quand même la catégorie de l\'API', cat === 'VALORANT', cat);
  await page.close();
}

// ═════════════ 11. Roster appris sans authentification ═════════════
console.log('\n11. Roster — chaînes suivies apprises par observation');
{
  const page = await fresh();
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      alpha: { id:'1', createdAt:h, viewers:1000, game:'G', tags:[] },
      beta:  { id:'2', createdAt:h, viewers:2000, game:'G', tags:[] },
    };
    window.__addCard('alpha', 'G', '1 k');
    window.__addCard('beta',  'G', '2 k');
    // Chaîne suivie HORS LIGNE : Twitch la rend avec l'avatar grisé et le
    // libellé « Déconnecté ». L'extension la masque — mais doit la retenir.
    const c = window.__addCard('gamma', 'G', 'Déconnecté', false);
    void c;
  });
  await wait(page, 1500);
  const r = await page.evaluate(() => window.tse.roster().map(e => e[0]).sort());
  ok('les chaînes en direct sont relevées', r.includes('alpha') && r.includes('beta'), JSON.stringify(r));
  ok('la chaîne HORS LIGNE est relevée aussi', r.includes('gamma'), JSON.stringify(r));
  const hidden = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.side-nav-card')].find(x => x.querySelector('a[href="/gamma"]'));
    return getComputedStyle(c).display;
  });
  ok('…tout en restant masquée à l\'écran', hidden === 'none', hidden);

  // Persistance : le tick d'entretien écrit le roster en localStorage.
  await wait(page, 1500);
  const stored = await page.evaluate(() => {
    try { return Object.keys(JSON.parse(localStorage.getItem('tse:roster') || '{}')).sort(); }
    catch { return null; }
  });
  ok('persisté en localStorage', Array.isArray(stored) && stored.length === 3, JSON.stringify(stored));

  // Rechargement : le roster survit à la page.
  await page.reload();
  await page.evaluate(() => { window.__fx = {}; });
  await wait(page, 900);
  const after = await page.evaluate(() => window.tse.roster().map(e => e[0]).sort());
  ok('rechargé au démarrage suivant', after.length === 3, JSON.stringify(after));
  await page.close();
}

// ═════════════ 12. Mesure du retard de Twitch ═════════════
console.log('\n12. Mesure — ce qui est compté, et ce qui ne l\'est pas');
{
  const page = await fresh();
  await page.evaluate(() => {
    const vieux = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      ancre:  { id:'0', createdAt:vieux, viewers:1000, game:'G', tags:[] },
      dormant: null,   // suivie mais HORS LIGNE : Twitch la rend en « Déconnecté »
    };
    window.__addCard('ancre',   'G', '1 k');
    window.__addCard('dormant', 'G', 'Déconnecté', false);
  });
  await wait(page, 1500);   // au-delà de la fenêtre d'installation
  const early = await page.evaluate(() => window.tse.lag());
  ok('un stream démarré avant qu\'on observe est ignoré', early.length === 0, JSON.stringify(early));

  // ── Cas qui était SILENCIEUSEMENT PERDU avant correction ──
  // La chaîne était déjà là, en « Déconnecté ». Elle passe en direct, puis
  // Twitch bascule enfin sa carte. L'ancienne mesure datait la chaîne du
  // chargement de la page et jetait l'échantillon comme « négatif ».
  await page.evaluate(() => {
    window.__fx.dormant = { id:'s-dormant-1', createdAt:new Date().toISOString(), viewers:500, game:'G', tags:[] };
  });
  await wait(page, 900);
  const ahead = await page.evaluate(() => ({
    notre: !!document.querySelector('.side-nav-card[data-tse-synthetic="true"]'),
    lag:   window.tse.lag().length
  }));
  ok('notre carte est posée avant celle de Twitch', ahead.notre === true);
  ok('rien n\'est encore compté : Twitch n\'affiche pas', ahead.lag === 0, String(ahead.lag));

  await page.evaluate(() => window.__goLive('dormant'));
  await wait(page, 900);
  const got = await page.evaluate(() => window.tse.lag());
  ok('une chaîne déjà présente hors ligne EST mesurée', got.length === 1, JSON.stringify(got));
  ok('mesure attribuée à la bonne chaîne', got[0]?.login === 'dormant', JSON.stringify(got[0]));
  ok('retard plausible', got[0]?.lag > 0 && got[0]?.lag < 10_000, String(got[0]?.lag));
  ok('l\'avance prise sur Twitch est chiffrée', Number.isFinite(got[0]?.gain) && got[0].gain > 0, String(got[0]?.gain));
  ok('l\'avance est inférieure au retard de Twitch', got[0]?.gain <= got[0]?.lag, `${got[0]?.gain} / ${got[0]?.lag}`);

  // Pas de double comptage sur les scans suivants.
  await wait(page, 1200);
  ok('un stream n\'est mesuré qu\'une fois',
     (await page.evaluate(() => window.tse.lag().length)) === 1);

  const cleared = await page.evaluate(() => { window.tse.reset(); return [window.tse.lag().length, window.tse.roster().length]; });
  ok('tse.reset() efface mesures et roster', cleared[0] === 0 && cleared[1] === 0, JSON.stringify(cleared));
  await page.close();
}

// ═════════════ 12 bis. Les relevés d'une méthode antérieure sont ignorés ═════════════
console.log('\n12 bis. Stockage — un ancien format ne pollue pas la médiane');
{
  const page = await fresh();
  await page.evaluate(() => {
    // Format v1 : un tableau nu, produit par la méthode biaisée.
    localStorage.setItem('tse:livelag', JSON.stringify([{ login:'vieux', lag: 240000, ts: Date.now() }]));
  });
  await page.reload();
  await page.evaluate(() => { window.__fx = {}; });
  await wait(page, 900);
  ok('les relevés v1 sont écartés au chargement',
     (await page.evaluate(() => window.tse.lag().length)) === 0);
  await page.close();
}

// ═══════ 13. users(logins:) — ordre non garanti, logins omis ═══════
console.log('\n13. Réponse groupée — indexation par login, pas par position');
{
  const page = await fresh();
  await page.evaluate(() => {
    // Twitch renvoie le tableau dans un ordre arbitraire (ici inversé) et
    // OMET les logins inconnus. S'aligner sur l'index attribuerait les
    // données d'une chaîne à une autre.
    window.__shuffle = true;
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      petit: { id:'1', createdAt:h, viewers:111,   game:'Cat-A', tags:['Français'] },
      moyen: { id:'2', createdAt:h, viewers:2222,  game:'Cat-B', tags:['English'] },
      gros:  { id:'3', createdAt:h, viewers:33333, game:'Cat-C', tags:['Deutsch'] },
    };
    window.__addCard('petit', 'x', '0');
    window.__addCard('moyen', 'x', '0');
    window.__addCard('gros',  'x', '0');
  });
  await wait(page, 1500);
  const byLogin = Object.fromEntries((await state(page)).map(c => [c.login, c]));
  ok('chaque chaîne reçoit SES données malgré l\'ordre inversé',
     byLogin.petit?.viewers === '111' && byLogin.moyen?.viewers === '2222' && byLogin.gros?.viewers === '33333',
     JSON.stringify(Object.entries(byLogin).map(([k, v]) => [k, v.viewers])));
  ok('catégories non permutées',
     byLogin.petit?.cat === 'Cat-A' && byLogin.gros?.cat === 'Cat-C',
     `${byLogin.petit?.cat} / ${byLogin.gros?.cat}`);
  ok('langues non permutées',
     byLogin.petit?.langs === '|Français|' && byLogin.gros?.langs === '|Deutsch|',
     `${byLogin.petit?.langs} / ${byLogin.gros?.langs}`);

  // Login omis de la réponse : surtout ne PAS conclure « hors ligne ».
  await page.evaluate(() => { window.__addCard('fantome', 'x', '0'); });  // absent de __fx
  await wait(page, 2500);
  const ghost = (await state(page)).find(c => c.login === 'fantome');
  ok('un login omis n\'est jamais traité comme hors ligne',
     ghost && !ghost.gqlOff, JSON.stringify(ghost));
  ok('les autres cartes restent intactes',
     (await state(page)).find(c => c.login === 'gros')?.viewers === '33333');
  await page.close();
}

// ═════════ 14. Carte posée avant Twitch ═════════
console.log('\n14. Palier 3 — une chaîne apparaît avant que Twitch la pose');
{
  const page = await fresh();
  const h = () => new Date(Date.now() - 60 * 60_000).toISOString();
  // 1er chargement : « tardif » est suivie mais HORS LIGNE. Twitch la rend,
  // l'extension la masque — et la mémorise au roster.
  await page.evaluate((iso) => {
    window.__fx = {
      alpha:  { id:'1', createdAt:iso, viewers:1000, game:'G', tags:[] },
      tardif: null,
    };
    window.__addCard('alpha',  'G', '1 k');
    window.__addCard('tardif', 'G', 'Déconnecté', false);
  }, h());
  await wait(page, 1500);
  ok('la chaîne hors ligne est au roster',
     (await page.evaluate(() => window.tse.roster().map(e => e[0]))).includes('tardif'));

  // Twitch retire sa carte hors ligne, puis la chaîne passe en direct —
  // sans que Twitch ne repose quoi que ce soit (son retard mesuré : 2-4 min).
  await page.evaluate(() => {
    [...document.querySelectorAll('.side-nav-card')]
      .find(c => c.querySelector('a[href="/tardif"]'))?.remove();
    window.__fx.tardif = { id:'9', name:'TardifTV', createdAt:new Date(Date.now()-120_000).toISOString(),
                           viewers:4200, game:'Rocket League', tags:['Français'] };
  });
  await wait(page, 2500);

  const made = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.side-nav-card')].find(x => x.dataset.tseLogin === 'tardif');
    if (!c) return null;
    return {
      synthetic: c.dataset.tseSynthetic === 'true',
      href:      c.querySelector('a[href]')?.getAttribute('href'),
      name:      c.querySelector('p[data-a-target="side-nav-title"]')?.textContent,
      cat:       c.querySelector('p[title]')?.textContent,
      avatar:    c.querySelector('img')?.getAttribute('src'),
      viewers:   c.querySelector('.tse-viewers')?.textContent,
      uptime:    c.querySelector('.tse-uptime')?.textContent,
      fresh:     c.classList.contains('tse-fresh'),
      visible:   getComputedStyle(c).display !== 'none',
      inSection: !!c.closest('[aria-label="Chaînes suivies"]'),
      leftovers: c.querySelectorAll('.tse-collab-badge, [data-tse-extra-row]').length
    };
  });
  ok('une carte a été fabriquée', made !== null, 'aucune carte');
  ok('marquée comme fabriquée', made?.synthetic === true);
  ok('lien vers la bonne chaîne', made?.href === '/tardif', made?.href);
  ok('pseudo affiché depuis l\'API', made?.name === 'TardifTV', made?.name);
  ok('catégorie depuis l\'API', made?.cat === 'Rocket League', made?.cat);
  ok('avatar depuis l\'API', made?.avatar === 'https://cdn/api-tardif.png', made?.avatar);
  ok('compteur de viewers rendu', nz(made?.viewers) === '4,2 k', made?.viewers);
  ok('durée de stream rendue', made?.uptime === '2m', made?.uptime);
  ok('mise en avant « stream frais »', made?.fresh === true);
  ok('visible et dans la section suivie', made?.visible && made?.inSection);
  ok('clone débarrassé des restes de la carte source', made?.leftovers === 0, String(made?.leftovers));
  const hygiene = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.side-nav-card')].find(x => x.dataset.tseSynthetic === 'true');
    const ids = [...c.querySelectorAll('[id]')].map(n => n.id);
    const labels = [...c.querySelectorAll('[aria-label]')].map(n => n.getAttribute('aria-label'));
    const dupIds = ids.filter(i => document.querySelectorAll('[id="' + i + '"]').length > 1);
    const srTexts = [...c.querySelectorAll('.sr-only')].map(n => n.textContent);
    return { dupIds, labels, srTexts, text: c.textContent };
  });
  ok('aucun id dupliqué dans le document', hygiene.dupIds.length === 0, JSON.stringify(hygiene.dupIds));
  ok('aucun libellé ARIA de la chaîne source', hygiene.labels.length === 0, JSON.stringify(hygiene.labels));
  ok('aucun texte lecteur d\'écran périmé', hygiene.srTexts.length === 0, JSON.stringify(hygiene.srTexts));
  ok('le pseudo de la source n\'apparaît nulle part', !/alpha/i.test(hygiene.text), hygiene.text);
  ok('la carte source est intacte', await page.evaluate(() => {
    const a = [...document.querySelectorAll('.side-nav-card')].find(x => x.dataset.tseLogin === 'alpha');
    return a.querySelector('p[data-a-target="side-nav-title"]').textContent === 'alpha'
        && a.dataset.tseSynthetic !== 'true';
  }));

  // 2) Twitch rattrape son retard et pose SA carte → la nôtre doit partir.
  await page.evaluate(() => { window.__addCard('tardif', 'Rocket League', '4 k'); });
  await wait(page, 1500);
  const dedup = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.side-nav-card')].filter(x => x.dataset.tseLogin === 'tardif');
    return { n: l.length, synthetic: l.filter(x => x.dataset.tseSynthetic === 'true').length };
  });
  ok('une seule carte après rattrapage de Twitch', dedup.n === 1, JSON.stringify(dedup));
  ok('c\'est celle de Twitch qui reste', dedup.synthetic === 0, JSON.stringify(dedup));
  await page.close();
}

// ═════════ 15. Retraits et gardes ═════════
console.log('\n15. Palier 3 — retraits, garde du voile, carte périmée');
{
  const page = await fresh();
  await page.evaluate(() => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      alpha:  { id:'1', createdAt:iso, viewers:1000, game:'G', tags:[] },
      tardif: { id:'9', createdAt:new Date(Date.now()-120_000).toISOString(), viewers:4200, game:'G', tags:[] },
    };
    window.__addCard('alpha',  'G', '1 k');
    window.__addCard('tardif', 'G', 'Déconnecté', false);
  });
  await wait(page, 1200);
  // Twitch retire sa carte : la nôtre prend le relais.
  await page.evaluate(() => {
    [...document.querySelectorAll('.side-nav-card')]
      .find(c => c.querySelector('a[href="/tardif"]'))?.remove();
  });
  await wait(page, 1800);
  ok('carte fabriquée présente', await page.evaluate(() =>
      !!document.querySelector('.side-nav-card[data-tse-synthetic="true"]')));

  // La chaîne coupe → la carte fabriquée doit disparaître, pas rester masquée.
  await page.evaluate(() => { window.__fx.tardif = null; });
  await wait(page, 2500);
  ok('carte retirée quand la chaîne coupe', await page.evaluate(() =>
      !document.querySelector('.side-nav-card[data-tse-synthetic="true"]')));

  // Twitch garde une carte « Déconnecté » périmée alors que la chaîne reprend :
  // elle est masquée par le CSS, donc elle ne couvre rien — on doit reprendre
  // la main, sinon la chaîne n'apparaîtrait nulle part.
  await page.evaluate(() => {
    window.__addCard('tardif', 'G', 'Déconnecté', false);
    window.__fx.tardif = { id:'9', createdAt:new Date(Date.now()-60_000).toISOString(), viewers:777, game:'G', tags:[] };
  });
  await wait(page, 2500);
  const rescue = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.side-nav-card')].filter(x => x.dataset.tseLogin === 'tardif');
    return {
      synthetic: l.filter(x => x.dataset.tseSynthetic === 'true').length,
      visibles:  l.filter(x => getComputedStyle(x).display !== 'none').length
    };
  });
  ok('une carte « Déconnecté » périmée ne bloque pas la fabrication', rescue.synthetic === 1, JSON.stringify(rescue));
  ok('exactement une carte visible pour cette chaîne', rescue.visibles === 1, JSON.stringify(rescue));
  await page.close();
}

// ═════════ 16. Non-régression des compteurs internes ═════════
console.log('\n16. Palier 3 — les cartes fabriquées ne faussent rien');
{
  const page = await fresh();
  await page.evaluate(() => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { alpha: { id:'1', createdAt:iso, viewers:1000, game:'G', tags:[] } };
    window.__addCard('alpha', 'G', '1 k');
    for (let i = 0; i < 4; i++) {
      const l = 'ghost' + i;
      window.__fx[l] = { id:'g'+i, createdAt:iso, viewers:500 + i, game:'G', tags:[] };
      window.__addCard(l, 'G', 'Déconnecté', false);
    }
    // Compte les clics sur « Afficher plus » : une carte fabriquée ne doit
    // pas simuler une croissance de la sidebar et en déclencher.
    window.__moreClicks = 0;
    document.querySelector('[data-a-target="side-nav-show-more-button"]')
      .addEventListener('click', () => window.__moreClicks++);
  });
  await wait(page, 1500);
  await page.evaluate(() => {
    [...document.querySelectorAll('.side-nav-card')]
      .filter(c => /\/ghost/.test(c.querySelector('a[href]')?.getAttribute('href') || ''))
      .forEach(c => c.remove());
  });
  await wait(page, 2500);
  const n = await page.evaluate(() => document.querySelectorAll('.side-nav-card[data-tse-synthetic="true"]').length);
  ok('4 cartes fabriquées', n === 4, String(n));
  const before = await page.evaluate(() => window.__moreClicks);
  await wait(page, 2000);
  const after = await page.evaluate(() => window.__moreClicks);
  ok('aucun clic « Afficher plus » parasite', after === before, `${before} → ${after}`);
  ok('le voile de chargement s\'est bien levé', await page.evaluate(() =>
      !document.body.classList.contains('tse-loading')));
  const diag = await page.evaluate(() => window.tse.diagnose().filter(p => p.status === 'broken').length);
  ok('le diagnostic ne signale aucune casse', diag === 0, String(diag));
  await page.close();
}

// ═════════ 17. Badge collab — comportement préservé après optimisation ═════════
console.log('\n17. Badge collab — le pré-filtre ne change rien au comportement');
{
  const page = await fresh();
  await page.evaluate(() => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      solo:  { id:'1', createdAt:iso, viewers:1000, game:'G', tags:[] },
      duo:   { id:'2', createdAt:iso, viewers:2000, game:'G', tags:[] },
      trio:  { id:'3', createdAt:iso, viewers:3000, game:'G', tags:[] },
    };
    window.__addCard('solo', 'G', '1 k');
    // Forme « élément » : un nœud feuille dont tout le texte vaut « +3 ».
    const d = window.__addCard('duo', 'G', '2 k');
    const sp = document.createElement('span');
    sp.textContent = '+3';
    d.querySelector('[data-a-target="side-nav-card-metadata"]').appendChild(sp);
    // Forme « texte en fin de nœud » : « Cat +2 » dans un même nœud texte.
    const t = window.__addCard('trio', 'G', '3 k');
    t.querySelector('p[title]').textContent = 'Cat +2';
  });
  await wait(page, 1500);
  const r = await page.evaluate(() => {
    const get = (l) => [...document.querySelectorAll('.side-nav-card')].find(c => c.dataset.tseLogin === l);
    const badge = (l) => get(l)?.querySelector('.tse-collab-badge')?.textContent ?? null;
    return {
      solo: badge('solo'), duo: badge('duo'), trio: badge('trio'),
      duoHidden: [...get('duo').querySelectorAll('span')].some(s => s.textContent === '+3' && s.style.display === 'none'),
      duoHost: !!get('duo').querySelector('.tse-collab-host')
    };
  });
  ok('aucun badge sur une carte sans collab', r.solo === null, String(r.solo));
  ok('badge « 3 » détecté sur la forme élément', r.duo === '3', String(r.duo));
  ok('le « +3 » d\'origine est masqué', r.duoHidden === true);
  ok('l\'avatar porte le marqueur hôte', r.duoHost === true);
  // Forme TEXTE : le code d'origine consomme le « +N » (il tronque le nœud
  // texte), si bien que le badge n'est visible qu'au premier passage. Bug
  // PRÉEXISTANT, vérifié identique avant/après optimisation par cmp.mjs — on
  // fige ici le comportement constaté pour détecter toute dérive future.
  ok('forme texte : badge posé au premier passage puis consommé (bug préexistant)',
     r.trio === null, String(r.trio));
  const trioCat = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.side-nav-card')].find(c => c.dataset.tseLogin === 'trio');
    return { title: t.querySelector('p[title]').getAttribute('title'), data: t.dataset.tseCategory };
  });
  ok('la catégorie fraîche est portée par title', trioCat.title === 'G', trioCat.title);
  ok('…et par data-tse-category (filtres)', trioCat.data === 'G', trioCat.data);

  // Le collab disparaît → le badge doit être nettoyé, pas rester périmé.
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.side-nav-card')].find(c => c.dataset.tseLogin === 'duo');
    [...d.querySelectorAll('span')].find(s => s.textContent === '+3')?.remove();
  });
  await wait(page, 1200);
  const after = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.side-nav-card')].find(c => c.dataset.tseLogin === 'duo');
    return { badge: d.querySelector('.tse-collab-badge')?.textContent ?? null,
             host: !!d.querySelector('.tse-collab-host') };
  });
  ok('badge nettoyé quand le collab disparaît', after.badge === null, String(after.badge));
  ok('marqueur hôte retiré', after.host === false);
  await page.close();
}

// ═════════ 18. Cohérence des cinq langues ═════════
console.log('\n18. Localisation — aucune langue ne peut diverger');
// Une clé oubliée dans UNE seule langue fait planter tse.lag() ou
// tse.roster() pour ses utilisateurs, sans que rien ne le signale : c'est
// exactement ce qui était arrivé au portugais. Analyse statique de la source.
{
  const src = readFileSync(join(ICI, 'content.test.js'), 'utf8');
  const block = src.match(/const STRINGS = Object\.freeze\(\{[\s\S]*?\n  \}\);/)[0];
  const keysOf = (lang) => {
    const b = block.match(new RegExp('\\n    ' + lang + ': Object\\.freeze\\(\\{([\\s\\S]*?)\\n    \\}\\)'));
    return b ? [...b[1].matchAll(/^      ([A-Za-z0-9_]+):/gm)].map(x => x[1]) : [];
  };
  const langs = ['fr', 'en', 'de', 'es', 'pt'];
  const ref = new Set(keysOf('fr'));
  let issues = [];
  for (const l of langs) {
    const k = keysOf(l), set = new Set(k);
    const missing = [...ref].filter(x => !set.has(x));
    const extra = k.filter(x => !ref.has(x));
    const dupes = k.filter((x, i) => k.indexOf(x) !== i);
    if (missing.length) issues.push(`${l} manque ${missing}`);
    if (extra.length) issues.push(`${l} en trop ${extra}`);
    if (dupes.length) issues.push(`${l} doublons ${dupes}`);
  }
  ok('jeux de clés identiques dans les 5 langues', issues.length === 0, issues.join(' | '));
  ok(`même nombre de clés partout (${ref.size})`, keysOf('pt').length === ref.size, `pt=${keysOf('pt').length} fr=${ref.size}`);
}

// ═════════ 19. Cadence réelle de sondage ═════════
console.log('\n19. Cadence — la période réelle doit coller au TTL');
{
  const page = await fresh();
  await page.evaluate(() => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { ancre: { id:'0', createdAt:iso, viewers:1000, game:'G', tags:[] } };
    window.__addCard('ancre', 'G', '1 k');
    // Horodate chaque requête TseChannels pour mesurer l'intervalle réel.
    window.__stamps = [];
    const real = window.fetch;
    window.fetch = async (u, o) => {
      const body = JSON.parse(o.body);
      if (body[0]?.operationName === 'TseChannels') window.__stamps.push(Date.now());
      return real(u, o);
    };
  });
  await wait(page, 4000);
  const st = await page.evaluate(() => window.__stamps);
  const deltas = st.slice(1).map((t, i) => t - st[i]).filter(d => d > 20);
  const avg = deltas.reduce((a, c) => a + c, 0) / (deltas.length || 1);
  const TTL = 600;   // valeur du harnais (cf. build.mjs)
  ok('plusieurs cycles observés', deltas.length >= 3, `${deltas.length} intervalles`);
  // Un réveil aligné sur le TTL donnerait 2,00× ; on exige nettement mieux.
  // C'est ce qui garantit que « toutes les 30 s » est vrai, pas « toutes les 60 s ».
  ok('période ≤ 1,4 × LIVE_TTL', avg <= TTL * 1.4, `${Math.round(avg)} ms pour un TTL de ${TTL} ms (${(avg/TTL).toFixed(2)}×)`);
  console.log(`     → période mesurée : ${Math.round(avg)} ms (${(avg/TTL).toFixed(2)} × LIVE_TTL)`);
  await page.close();
}

// ═════════ 20. Extinction de masse — la sidebar ne doit pas se vider ═════════
console.log('\n20. Garde-fou — une API qui ment ne vide pas la sidebar');
{
  const page = await fresh();
  const warns = [];
  page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.evaluate(() => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {};
    for (let i = 0; i < 20; i++) {
      const l = 'ch' + i;
      window.__fx[l] = { id:'i'+i, createdAt:iso, viewers:1000+i, game:'G', tags:[] };
      window.__addCard(l, 'G', String(1000+i));
    }
  });
  await wait(page, 1500);
  const visibles = () => page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')].filter(c => getComputedStyle(c).display !== 'none').length);
  ok('20 chaînes visibles au départ', await visibles() === 20, String(await visibles()));

  // L'API se dégrade : elle annonce TOUT LE MONDE hors ligne, sans erreur.
  await page.evaluate(() => { for (const k of Object.keys(window.__fx)) window.__fx[k] = null; });
  await wait(page, 2500);
  const pendant = await visibles();
  ok('la sidebar reste peuplée pendant l\'anomalie', pendant === 20, `${pendant} visibles`);
  ok('un avertissement est émis en console', warns.some(w => /suspecte|suspicious/i.test(w)),
     JSON.stringify(warns.slice(0, 1)));

  // L'anomalie persiste : au-delà de la tolérance, on finit par y croire.
  await wait(page, 6000);
  const apres = await visibles();
  ok('une extinction RÉELLE finit par être acceptée', apres === 0, `${apres} visibles`);
  await page.close();
}

// ═════════ 21. Pas de faux positif du garde-fou ═════════
console.log('\n21. Garde-fou — une extinction isolée passe normalement');
{
  const page = await fresh();
  await page.evaluate(() => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {};
    for (let i = 0; i < 20; i++) {
      const l = 'ch' + i;
      window.__fx[l] = { id:'i'+i, createdAt:iso, viewers:1000+i, game:'G', tags:[] };
      window.__addCard(l, 'G', String(1000+i));
    }
  });
  await wait(page, 1500);
  // Une seule chaîne coupe : comportement normal attendu, pas de blocage.
  await page.evaluate(() => { window.__fx.ch7 = null; });
  await wait(page, 3000);
  const st = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.side-nav-card')];
    return { visibles: all.filter(c => getComputedStyle(c).display !== 'none').length,
             ch7: all.find(c => c.dataset.tseLogin === 'ch7')?.dataset.tseGqlOffline === 'true' };
  });
  ok('la chaîne qui coupe est bien masquée', st.ch7 === true);
  ok('les 19 autres restent visibles', st.visibles === 19, String(st.visibles));
  await page.close();
}

// ═════════ 22. Garde-fou dès le premier cycle (cache encore vide) ═════════
console.log('\n22. Garde-fou — protège aussi au démarrage, cache vide');
{
  const page = await fresh();
  const warns = [];
  page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  // L'API ment DÈS LA PREMIÈRE réponse : le cache n'a rien pour servir de
  // référence, seul ce que Twitch affiche fait foi.
  await page.evaluate(() => {
    window.__fx = {};
    for (let i = 0; i < 20; i++) {
      window.__fx['ch' + i] = null;                    // API : tout le monde hors ligne
      window.__addCard('ch' + i, 'G', String(1000 + i)); // Twitch : tout le monde en direct
    }
  });
  await wait(page, 2500);
  const visibles = await page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')].filter(c => getComputedStyle(c).display !== 'none').length);
  ok('la sidebar n\'est pas vidée dès le premier cycle', visibles === 20, `${visibles} visibles`);
  ok('l\'anomalie est signalée', warns.some(w => /suspecte|suspicious/i.test(w)), JSON.stringify(warns.slice(0, 1)));
  await page.close();
}

// ═════════ 23. Modèle de clonage neutre ═════════
console.log('\n23. Clonage — jamais depuis une carte décorée');
{
  const page = await fresh();
  await page.evaluate(() => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      decore: { id:'1', createdAt:iso, viewers:1000, game:'G', tags:[] },
      dormant: null,
    };
    // SEULE carte live disponible, et elle porte un badge de collaboration.
    const d = window.__addCard('decore', 'G', '1 k');
    const sp = document.createElement('span');
    sp.textContent = '+3';
    d.querySelector('[data-a-target="side-nav-card-metadata"]').appendChild(sp);
    window.__addCard('dormant', 'G', 'Déconnecté', false);
  });
  await wait(page, 1500);
  await page.evaluate(() => {
    [...document.querySelectorAll('.side-nav-card')]
      .find(c => c.querySelector('a[href="/dormant"]'))?.remove();
    window.__fx.dormant = { id:'9', createdAt:new Date(Date.now()-60_000).toISOString(), viewers:500, game:'G', tags:[] };
  });
  await wait(page, 2500);
  const n1 = await page.evaluate(() => document.querySelectorAll('.side-nav-card[data-tse-synthetic="true"]').length);
  ok('aucune carte fabriquée depuis un modèle décoré', n1 === 0, String(n1));

  // Une carte neutre apparaît : la fabrication reprend, sans décoration héritée.
  await page.evaluate(() => {
    window.__fx.neutre = { id:'2', createdAt:new Date(Date.now()-3600_000).toISOString(), viewers:900, game:'G', tags:[] };
    window.__addCard('neutre', 'G', '900');
  });
  await wait(page, 2500);
  const built = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.side-nav-card')].find(x => x.dataset.tseSynthetic === 'true');
    return c ? { login: c.dataset.tseLogin,
                 collab: !!c.querySelector('.tse-collab-badge'),
                 plus: /\+\s*3/.test(c.textContent || '') } : null;
  });
  ok('la fabrication reprend dès qu\'un modèle neutre existe', built?.login === 'dormant', JSON.stringify(built));
  ok('aucun badge de collaboration hérité', built?.collab === false, JSON.stringify(built));
  ok('aucun « +3 » hérité', built?.plus === false, JSON.stringify(built));
  await page.close();
}

// ═════════════ 24. Co-stream — compteur combiné, ET tri cohérent ═════════════
console.log('\n24. Co-stream — Twitch affiche le combiné, et le tri doit le suivre');
{
  const page = await fresh();
  await page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    // mastu 10 616 propres / hctuan 1 166 propres, session combinée ~11 8xx.
    // Les leurres encadrent le groupe : un plus gros, deux plus petits — dont
    // un à 1 700, juste au-dessus de l'audience PROPRE de hctuan. Si le tri
    // retombait sur l'individuel, hctuan glisserait sous lui (le bug observé).
    window.__fx = {
      geant:  { id:'900',       createdAt:h, viewers:13000, game:'VALORANT',      tags:[] },
      mastu:  { id:'63936838',  createdAt:h, viewers:10616, game:'Just Chatting', tags:[] },
      hctuan: { id:'175560856', createdAt:h, viewers:1166,  game:'Just Chatting', tags:[] },
      moyen:  { id:'901',       createdAt:h, viewers:3000,  game:'VALORANT',      tags:[] },
      petit:  { id:'902',       createdAt:h, viewers:1700,  game:'VALORANT',      tags:[] },
    };
    const guests = [
      { id:'63936838',  login:'mastu',  viewers:10616, combined:11736 },
      { id:'175560856', login:'hctuan', viewers:1166,  combined:11821 },
    ];
    window.__gs = {
      '63936838':  { hostId:'63936838', hostLogin:'mastu', guests },
      '175560856': { hostId:'63936838', hostLogin:'mastu', guests },
    };
    // Posées dans le désordre : c'est bien l'extension qui doit classer.
    window.__addCard('geant',  'VALORANT',      '13 k');
    window.__addCard('mastu',  'Just Chatting', '11 k');
    window.__addCard('moyen',  'VALORANT',      '3 k');
    window.__addCard('petit',  'VALORANT',      '1,7 k');
    window.__addCard('hctuan', 'Just Chatting', '11 k');
  });
  await wait(page, 3000);
  const s = await state(page);
  const by = Object.fromEntries(s.map(c => [c.login, c]));
  // Chaque participant porte SON échantillon du compteur combiné.
  ok('mastu affiche le combiné, pas ses 10,6 k',  nz(by.mastu.shown) === '11,7 k',  by.mastu.shown);
  ok('hctuan affiche le combiné, pas ses 1,2 k',  nz(by.hctuan.shown) === '11,8 k', by.hctuan.shown);
  ok('la chaîne solo affiche sa propre audience', nz(by.moyen.shown) === '3 k',     by.moyen.shown);
  // Le nombre trié est CELUI QUI EST AFFICHÉ : sans ça, la liste paraît cassée.
  ok('le dataset de mastu suit l\'affichage',  by.mastu.viewers === '11736',  by.mastu.viewers);
  ok('le dataset de hctuan suit l\'affichage', by.hctuan.viewers === '11821', by.hctuan.viewers);
  ok('hors co-stream, rien ne change',         by.moyen.viewers === '3000',   by.moyen.viewers);
  // LE BUG RAPPORTÉ : deux co-streamers marqués du même nombre doivent se
  // suivre, pas se retrouver l'un en tête et l'autre au milieu des petits.
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')].map(c => c.dataset.tseLogin));
  ok('ordre décroissant sur les nombres affichés',
     JSON.stringify(order) === JSON.stringify(['geant', 'hctuan', 'mastu', 'moyen', 'petit']),
     JSON.stringify(order));
  const iM = order.indexOf('mastu'), iH = order.indexOf('hctuan');
  ok('les deux co-streamers sont adjacents', Math.abs(iM - iH) === 1, `mastu=${iM} hctuan=${iH}`);
  ok('hctuan ne tombe pas sous le leurre à 1,7 k',
     iH < order.indexOf('petit'), JSON.stringify(order));
  await page.close();
}

// ═════════════ 25. Aucune requête ne dépend d'un hash ═════════════
console.log('\n25. Aucun hash — le module sidebar n\'a plus de persisted query');
{
  const page = await fresh();
  await page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    window.__fx = {
      mastu:  { id:'63936838',  createdAt:h, viewers:10616, game:'Just Chatting', tags:[] },
      hctuan: { id:'175560856', createdAt:h, viewers:1166,  game:'Just Chatting', tags:[] },
    };
    const guests = [
      { id:'63936838',  login:'mastu',  viewers:10616, combined:11736 },
      { id:'175560856', login:'hctuan', viewers:1166,  combined:11821 },
    ];
    window.__gs = {
      '63936838':  { hostId:'63936838', hostLogin:'mastu', guests },
      '175560856': { hostId:'63936838', hostLogin:'mastu', guests },
    };
    window.__addCard('mastu',  'Just Chatting', '11 k');
    window.__addCard('hctuan', 'Just Chatting', '11 k');
  });
  await wait(page, 3000);
  // L'invariant central : plus AUCUNE opération de la sidebar ne s'identifie
  // par un hash. Rien que Twitch puisse périmer unilatéralement. (Le module
  // anti-pub est hors de portée ici : il ne tourne qu'en iframe.)
  const calls = await page.evaluate(() => window.__calls.map(c => ({ op: c.op, form: c.form })));
  ok('au moins une requête a été émise', calls.length > 0);
  ok('aucune requête ne porte de hash', calls.every(c => c.form === 'inline'), JSON.stringify(calls));
  const gs = calls.filter(c => c.op === 'TseGuestStar' || c.op === 'GuestStarBatchCollaborationQuery');
  ok('Guest Star est interrogé', gs.length > 0, JSON.stringify(calls));
  ok('sous le nom inline, jamais persisté',
     gs.every(c => c.op === 'TseGuestStar'), JSON.stringify(gs));
  // Et le service rendu est intact.
  const s = await page.evaluate(() => [...document.querySelectorAll('.side-nav-card')].map(c => ({
    login: c.dataset.tseLogin, key: c.dataset.tseCostreamKey,
    shown: c.querySelector('.tse-viewers')?.textContent ?? null
  })));
  const by = Object.fromEntries(s.map(c => [c.login, c]));
  ok('les deux cartes sont regroupées', !!by.mastu.key && by.mastu.key === by.hctuan.key, JSON.stringify(s));
  ok('le regroupement passe bien par Guest Star', /^gs:/.test(by.mastu.key || ''), by.mastu.key);
  ok('le compteur combiné est servi', nz(by.hctuan.shown) === '11,8 k', by.hctuan.shown);
  await page.close();
}

// ═════════════ 26. Guest Star en panne — repli propre ═════════════
console.log('\n26. Guest Star en panne : repli propre, sans casse');
{
  const page = await fresh();
  await page.evaluate(() => {
    window.__gsMode = 'down';             // l'API Guest Star refuse
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    window.__fx = {
      mastu:  { id:'63936838',  createdAt:h, viewers:10616, game:'Just Chatting', tags:[] },
      hctuan: { id:'175560856', createdAt:h, viewers:1166,  game:'Just Chatting', tags:[] },
    };
    window.__addCard('mastu',  'Just Chatting', '11 k');
    window.__addCard('hctuan', 'Just Chatting', '11 k');
  });
  await wait(page, 2500);
  const s = await state(page);
  const by = Object.fromEntries(s.map(c => [c.login, c]));
  ok('les cartes restent affichées', s.length === 2 && s.every(c => !c.offline));
  ok('chacune retombe sur son audience propre', nz(by.mastu.shown) === '10,6 k', by.mastu.shown);
  ok('l\'autre aussi', nz(by.hctuan.shown) === '1,2 k', by.hctuan.shown);
  await page.close();
}

// ═════════════ 27. Session Guest Star SOLO — pas de compteur combiné ═════════════
console.log('\n27. Session solo — un host.id sans collaboration ne fabrique rien');
{
  const page = await fresh();
  await page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    // Forme observée sur trafic réel : session ouverte, UN seul participant
    // (l'hôte lui-même), et collaborationViewersCount à null — Twitch ne
    // calcule pas de combiné tant qu'il n'y a personne avec qui combiner.
    window.__fx = {
      theguill84: { id:'36318615', createdAt:h, viewers:739, game:'Minecraft', tags:[] },
      voisin:     { id:'99',       createdAt:h, viewers:739, game:'Minecraft', tags:[] },
    };
    window.__gs = {
      '36318615': { hostId:'36318615', hostLogin:'theguill84',
                    guests:[{ id:'36318615', login:'theguill84', viewers:739, combined:null }] },
    };
    window.__addCard('theguill84', 'Minecraft', '700');
    window.__addCard('voisin',     'Minecraft', '700');
  });
  await wait(page, 2500);
  const s = await page.evaluate(() => [...document.querySelectorAll('.side-nav-card')].map(c => ({
    login: c.dataset.tseLogin, key: c.dataset.tseCostreamKey,
    viewers: c.dataset.tseViewers,
    shown: c.querySelector('.tse-viewers')?.textContent ?? null
  })));
  const by = Object.fromEntries(s.map(c => [c.login, c]));
  ok('l\'audience propre est affichée, pas de NaN', nz(by.theguill84.shown) === '739', by.theguill84.shown);
  ok('le dataset reste exact',                      by.theguill84.viewers === '739', by.theguill84.viewers);
  // Un host.id existe, mais il ne couvre qu'une carte : aucun groupe ne doit
  // naître, et surtout pas avec un voisin qui affiche le même nombre.
  ok('aucun groupe de co-stream fabriqué', !by.theguill84.key, JSON.stringify(by.theguill84));
  ok('le voisin au même compteur n\'est pas happé', !by.voisin.key, JSON.stringify(by.voisin));
  await page.close();
}

// ═════════════ 28. Anti-pub — inerte hors iframe ═════════════
console.log('\n28. Anti-pub — chargé avec la sidebar, mais strictement inerte en top-level');
{
  const page = await fresh();
  const probe = await page.evaluate(() => ({
    // Le fichier a-t-il seulement été chargé ? Sans ça, tout le reste du
    // scénario passerait pour de mauvaises raisons.
    loaded:    typeof TSE_ADBLOCK_ENABLED !== 'undefined' && TSE_ADBLOCK_ENABLED === true,
    api:       typeof window.vaft2,
    marker1:   typeof window.vaftVersion,
    marker2:   typeof window.twitchAdSolutionsVersion,
    fetchKept: window.fetch === window.__mockFetch,
    workerNative: /\[native code\]/.test(String(window.Worker))
  }));
  ok('le module est bien chargé', probe.loaded === true, JSON.stringify(probe));
  ok('aucune API console posée', probe.api === 'undefined', probe.api);
  ok('le marqueur vaftVersion n\'est pas revendiqué', probe.marker1 === 'undefined', probe.marker1);
  ok('ni twitchAdSolutionsVersion', probe.marker2 === 'undefined', probe.marker2);
  // Les deux crochets que pose le module : ni l'un ni l'autre hors iframe.
  ok('fetch n\'est pas accroché',  probe.fetchKept === true, JSON.stringify(probe));
  ok('Worker n\'est pas accroché', probe.workerNative === true, String(probe.workerNative));
  await page.close();
}

// ═════════════ 29. Palette co-stream — teintes réellement distinctes ═════════════
console.log('\n29. Palette — deux collaborations voisines doivent se distinguer');
{
  // Contrôle STATIQUE : la palette est une donnée, pas un comportement. On la
  // lit dans la source plutôt que de l'exposer au global pour les besoins du test.
  const source = readFileSync(join(ICI, '..', 'content.js'), 'utf8');
  const block = source.slice(source.indexOf('const COSTREAM_PALETTE = ['));
  const entries = [...block.slice(0, block.indexOf('];')).matchAll(
    /color:\s*'#([0-9a-f]{6})'[^}]*?bg:\s*'rgba\((\d+),\s*(\d+),\s*(\d+),\s*0\.18\)'[^}]*?fade:\s*'rgba\((\d+),\s*(\d+),\s*(\d+),\s*0\.06\)'/gi)];

  ok('la palette est lisible et non vide', entries.length >= 4, `${entries.length} entrées`);

  const hexToRgb = (h) => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  const hue = (h) => {
    const [r, g, b] = hexToRgb(h).map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const t = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (t * 60 + 360) % 360;
  };

  // 1) Les rgba doivent décrire EXACTEMENT la couleur hex de leur entrée.
  //    Une coquille ici passe inaperçue à la relecture : le liseré serait d'une
  //    couleur et son halo d'une autre.
  const mismatched = entries.filter(m => {
    const [r, g, b] = hexToRgb(m[1]);
    return +m[2] !== r || +m[3] !== g || +m[4] !== b
        || +m[5] !== r || +m[6] !== g || +m[7] !== b;
  }).map(m => '#' + m[1]);
  ok('chaque rgba correspond à son hex', mismatched.length === 0, mismatched.join(', '));

  // 2) Écart de teinte minimum sur le cercle, en incluant le retour au début.
  const hues = entries.map(m => hue(m[1])).sort((a, b) => a - b);
  let worst = 360, pair = '';
  for (let i = 0; i < hues.length; i++) {
    const a = hues[i], b = hues[(i + 1) % hues.length];
    const d = ((b - a) % 360 + 360) % 360;
    if (d < worst) { worst = d; pair = `${a.toFixed(0)}° ↔ ${b.toFixed(0)}°`; }
  }
  ok('aucune paire de teintes sous 40°', worst >= 40, `pire paire ${pair} = ${worst.toFixed(0)}°`);
  console.log(`     → ${entries.length} couleurs, écart minimum ${worst.toFixed(0)}°`);
}

// ═════════════ 30. Aperçu — révélé à la PREMIÈRE IMAGE, pas au `load` ═════════════
console.log('\n30. Aperçu — l\'iframe n\'apparaît qu\'une fois une image affichée');
{
  // Le lecteur Twitch est remplacé par une page servie depuis la VRAIE origine
  // player.twitch.tv (interception réseau) : la garde d'hôte du pont s'applique
  // donc pour de bon, et le message franchit une frontière cross-origin réelle.
  // Les modules sont chargés par <script src>, dans l'ordre du manifeste, et
  // servis par la route de player.twitch.tv — donc à la bonne origine.
  const fakePlayer = (withVideo) => `<!doctype html><html><body>
    <script src="/adblock.test.js"></script>
    <script src="/content.test.js"></script>
    <script>
      ${withVideo ? `
      // Vidéo RÉELLE : un canvas animé capturé en MediaStream. Les images sont
      // donc réellement présentées, ce qui est la seule façon de déclencher
      // requestVideoFrameCallback pour de vrai.
      // La video et son flux existent TOUT DE SUITE, et play() est appele
      // aussitot : l'evenement playing et readyState peuvent donc partir tres
      // tot. Mais le canvas n'est dessine qu'apres un delai, donc AUCUNE image
      // n'est presentee avant. C'est exactement ce qui separe << la lecture a
      // demarre >> de << il y a quelque chose a voir >>.
      const c = document.createElement('canvas');
      c.width = 32; c.height = 18;
      const ctx = c.getContext('2d');
      const v = document.createElement('video');
      v.autoplay = true; v.muted = true; v.playsInline = true;
      v.srcObject = c.captureStream(25);
      document.body.appendChild(v);
      v.play().catch(() => {});
      window.__firstDrawAt = null;
      setTimeout(() => {
        window.__firstDrawAt = performance.now();
        setInterval(() => {
          ctx.fillStyle = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
          ctx.fillRect(0, 0, 32, 18);
        }, 40);
      }, 700);
      ` : '/* aucune vidéo : le signal n\'arrivera jamais */'}
    </script>
  </body></html>`;

  const loadedState = (page) => page.evaluate(() => {
    const f = document.querySelector('.tse-preview__iframe');
    return f ? (f.dataset.tseLoaded ?? null) : 'pas-d-iframe';
  });

  // ── a) cas nominal : le pont signale, le parent dévoile ──────────────────
  {
    const page = await freshTwitch(fakePlayer(true));
    await page.evaluate(() => {
      window.__fx = { alpha: { id:'1', createdAt:new Date(Date.now()-3600_000).toISOString(),
                               viewers:1000, game:'G', tags:[] } };
      window.__addCard('alpha', 'G', '1 k');
    });
    await wait(page, 2000);  // laisse le voile de chargement se lever
    await hoverCard(page, 0);

    // 300 ms : la lecture a démarré, mais le canvas n'est pas encore dessiné.
    // Si le code se contentait de `playing` ou de readyState, il dévoilerait ICI.
    await wait(page, 300);
    const early = await loadedState(page);
    ok('rien n\'est dévoilé avant qu\'une image existe', early !== 'true', String(early));

    await wait(page, 1000);  // premier dessin à 700 ms, bien avant le filet (1500 ms)
    const late = await loadedState(page);
    ok('dévoilée dès la première image', late === 'true', String(late));
    await page.close();
  }

  // ── b) le signal n'arrive jamais : le filet doit prendre le relais ───────
  {
    const page = await freshTwitch(fakePlayer(false));
    await page.evaluate(() => {
      window.__fx = { beta: { id:'2', createdAt:new Date(Date.now()-3600_000).toISOString(),
                              viewers:1000, game:'G', tags:[] } };
      window.__addCard('beta', 'G', '1 k');
    });
    await wait(page, 2000);
    await hoverCard(page, 0);

    await wait(page, 900);
    const before = await loadedState(page);
    ok('le filet ne se déclenche pas trop tôt', before !== 'true', String(before));

    await wait(page, 1400);  // au-delà de PREVIEW_REVEAL_FALLBACK_MS (1500 ms)
    const after = await loadedState(page);
    ok('sans signal, le filet dévoile quand même', after === 'true', String(after));
    await page.close();
  }

  // ── c) aucun écouteur postMessage ne doit s'accumuler d'un survol à l'autre
  {
    const page = await freshTwitch(fakePlayer(true));
    await page.evaluate(() => {
      const h = new Date(Date.now() - 3600_000).toISOString();
      window.__fx = {
        un:   { id:'1', createdAt:h, viewers:1000, game:'G', tags:[] },
        deux: { id:'2', createdAt:h, viewers:900,  game:'G', tags:[] },
      };
      // Compte les écouteurs 'message' posés sur window.
      window.__msgListeners = 0;
      const add = window.addEventListener.bind(window);
      const rem = window.removeEventListener.bind(window);
      window.addEventListener = (t, ...rest) => { if (t === 'message') window.__msgListeners++; return add(t, ...rest); };
      window.removeEventListener = (t, ...rest) => { if (t === 'message') window.__msgListeners--; return rem(t, ...rest); };
      window.__addCard('un',   'G', '1 k');
      window.__addCard('deux', 'G', '900');
    });
    await wait(page, 2000);
    for (let i = 0; i < 4; i++) {
      await hoverCard(page, i % 2);
      await wait(page, 400);
      await unhoverCard(page, i % 2);
    }
    await wait(page, 600);
    const leaked = await page.evaluate(() => window.__msgListeners);
    ok('aucun écouteur laissé derrière après 4 survols', leaked <= 1, `${leaked} restant(s)`);
    await page.close();
  }
}

// ═════════════ 31. Vignette — cache utilisable, et pas de rectangle noir ═════════════
console.log('\n31. Vignette — l\'URL doit être stable, et l\'attente ne doit pas être noire');
{
  const cdnUrls = [];
  // Ouvert AVANT la page : depuis le préchargement, les premières miniatures
  // partent sans qu'aucun survol n'ait eu lieu. La fenêtre doit les couvrir.
  const t0 = Date.now();
  const page = await freshTwitch('<!doctype html><html><body>lecteur</body></html>', cdnUrls);
  await page.evaluate(() => {
    window.__fx = {
      alpha: { id:'1', createdAt:new Date(Date.now()-3600_000).toISOString(), viewers:1000, game:'G', tags:[] },
      beta:  { id:'2', createdAt:new Date(Date.now()-3600_000).toISOString(), viewers:900,  game:'G', tags:[] },
    };
    window.__addCard('alpha', 'G', '1 k');
    window.__addCard('beta',  'G', '900');
  });
  await wait(page, 2000);

  // Trois survols d'alpha, entrecoupés d'un passage sur beta.
  for (const i of [0, 1, 0, 0]) {
    await hoverCard(page, i);
    await wait(page, 350);
    await unhoverCard(page, i);
    await wait(page, 150);
  }

  const alphaUrls = cdnUrls.filter(u => u.includes('live_user_alpha'));
  ok('la vignette d\'alpha a bien été demandée', alphaUrls.length >= 2, `${alphaUrls.length} demande(s)`);
  // LE point : DANS UNE MÊME TRANCHE, l'URL ne doit pas changer d'un survol à
  // l'autre — sinon le navigateur ne peut jamais rien resservir de son cache,
  // ce qui était le cas avec un horodatage à la milliseconde. Formulé par
  // tranche et non dans l'absolu : une tranche FINIT par changer, c'est même
  // sa raison d'être, et le harnais l'accélère justement pour l'observer.
  const distinct = [...new Set(alphaUrls)];
  const parTranche = new Map();
  for (const u of distinct) {
    const b = u.split('?_=')[1];
    if (!parTranche.has(b)) parTranche.set(b, []);
    parTranche.get(b).push(u);
  }
  const multiples = [...parTranche].filter(([, urls]) => urls.length > 1);
  ok('une seule URL par tranche', multiples.length === 0,
     multiples.map(([b, urls]) => `${b}: ${urls.length}`).join(' | '));
  ok('l\'URL ne change QUE d\'une tranche à l\'autre',
     distinct.length === parTranche.size, `${distinct.length} URLs / ${parTranche.size} tranche(s)`);

  // La tranche doit valoir Math.floor(now / PREVIEW_THUMB_CACHE_MS) : on vérifie
  // la FORMULE, pas seulement la stabilité — deux survols rapprochés seraient
  // stables même avec une tranche d'une seconde. La durée est relue dans la
  // source plutôt que recopiée ici, pour que le test suive si elle change.
  // Lue dans le fichier RÉELLEMENT exécuté : le harnais accélère cette
  // constante, comparer à la source ferait échouer le test sur un chiffre qui
  // n'est pas celui qui tourne.
  const declared = /PREVIEW_THUMB_CACHE_MS:\s*([\d_]+)/
    .exec(readFileSync(join(ICI, 'content.test.js'), 'utf8'));
  ok('la durée de tranche est déclarée', !!declared, String(declared));
  const slice = Number(declared[1].replaceAll('_', ''));
  // Comparée à la FENÊTRE pendant laquelle les survols ont eu lieu, et non à
  // l'instant de l'assertion : le scénario dure plusieurs secondes, et à
  // l'échelle accélérée du harnais la tranche a le temps de changer entre les
  // deux. Une tolérance en dur masquerait le problème au lieu de le poser.
  const bornes = [Math.floor(t0 / slice), Math.floor(Date.now() / slice)];
  const vues = [...parTranche.keys()].map(Number);
  ok(`les tranches vues tombent dans la fenêtre des survols (${slice / 1000} s)`,
     vues.every(b => b >= bornes[0] && b <= bornes[1]),
     `${vues.join(', ')} hors de [${bornes[0]}, ${bornes[1]}]`);

  // La taille demandée au CDN doit venir des constantes CDN, pas de la largeur
  // du popup : les deux ont été découplées, et rien ne doit les recoller sans
  // qu'on s'en aperçoive — un changement de mise en page changerait alors
  // l'objet réclamé au réseau.
  const conf = readFileSync(join(ICI, '..', 'content.js'), 'utf8');
  const w = /PREVIEW_THUMB_CDN_W:\s*(\d+)/.exec(conf);
  const h = /PREVIEW_THUMB_CDN_H:\s*(\d+)/.exec(conf);
  ok('les dimensions CDN sont déclarées à part', !!w && !!h, `${w && w[1]}x${h && h[1]}`);
  ok('l\'URL demandée porte bien ces dimensions',
     distinct[0].includes(`-${w[1]}x${h[1]}.jpg`), distinct[0]);

  // L'attente ne doit pas se présenter comme un rectangle noir.
  await hoverCard(page, 0);
  await wait(page, 300);
  const look = await page.evaluate(() => {
    const wrap = document.querySelector('.tse-preview__thumb-wrap');
    const img = document.querySelector('.tse-preview__thumb');
    return { bg: wrap ? getComputedStyle(wrap).backgroundColor : null,
             loaded: img ? (img.dataset.tseLoaded ?? null) : null,
             opacity: img ? getComputedStyle(img).opacity : null };
  });
  ok('le fond d\'attente n\'est pas noir', look.bg !== 'rgb(0, 0, 0)', String(look.bg));
  ok('la vignette est marquée chargée', look.loaded === 'true', String(look.loaded));
  ok('…et donc visible', Number(look.opacity) > 0.9, String(look.opacity));
  await page.close();
}

// ═════════════ 32. Aperçu — l'échelle de qualité doit être plafonnée ═════════════
console.log('\n32. Qualité — le jeton d\'accès doit être demandé en « autoplay »');
{
  // Le type de lecteur porté par la requête de jeton décide de l'ÉCHELLE que
  // Twitch renvoie. On vérifie ici la réécriture de bout en bout, à travers le
  // vrai code du module, et non la seule valeur de la constante.
  const tokenBodies = [];
  const player = `<!doctype html><html><body>
    <script src="/adblock.test.js"></script>
    <script>
      // Requête de jeton telle que le lecteur de Twitch l'émet, avec le type
      // que porterait notre iframe. Le module doit la réécrire au passage.
      setTimeout(() => {
        fetch('https://gql.twitch.tv/gql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            operationName: 'PlaybackAccessToken',
            variables: { isLive: true, login: 'alpha', isVod: false, vodID: '',
                         playerType: 'site', platform: 'web' }
          }])
        }).catch(() => {});
      }, 200);
    </script>
  </body></html>`;

  const page = await freshTwitch(player);
  await page.route('https://gql.twitch.tv/**', (route) => {
    try { tokenBodies.push(JSON.parse(route.request().postData() || '[]')); } catch { /* ignore */ }
    route.fulfill({ contentType: 'application/json',
                    body: JSON.stringify([{ data: { streamPlaybackAccessToken: null } }]) });
  });
  await page.evaluate(() => {
    window.__fx = { alpha: { id:'1', createdAt:new Date(Date.now()-3600_000).toISOString(),
                             viewers:1000, game:'G', tags:[] } };
    window.__addCard('alpha', 'G', '1 k');
  });
  await wait(page, 2000);
  await hoverCard(page, 0);
  await wait(page, 1500);

  const ops = tokenBodies.flat().filter(o => o?.operationName === 'PlaybackAccessToken');
  ok('la requête de jeton a bien été émise', ops.length >= 1, `${ops.length} requête(s)`);
  const types = [...new Set(ops.map(o => o?.variables?.playerType))];
  // 'site' serait la valeur d'origine : si elle survit, la réécriture n'a pas eu
  // lieu et l'échelle n'est pas plafonnée.
  ok('le type est réécrit en « autoplay »',
     types.length === 1 && types[0] === 'autoplay', JSON.stringify(types));

  // Et la constante doit rester en accord avec ce que le test vient de prouver.
  const declared = /ForceAccessTokenPlayerType:\s*'([a-z_]+)'/
    .exec(readFileSync(join(ICI, '..', 'adblock.js'), 'utf8'));
  ok('la constante déclare bien autoplay', declared && declared[1] === 'autoplay',
     declared ? declared[1] : 'introuvable');
  await page.close();
}

// ═════════════ 33. Préchargement des miniatures ═════════════
console.log('\n33. Préchargement — réchauffer pendant les périodes calmes');
{
  const poser = (page) => page.evaluate(() => {
    const h = new Date(Date.now() - 3600_000).toISOString();
    window.__fx = {
      un:     { id:'1', createdAt:h, viewers:1000, game:'G', tags:[] },
      deux:   { id:'2', createdAt:h, viewers:900,  game:'G', tags:[] },
      trois:  { id:'3', createdAt:h, viewers:800,  game:'G', tags:[] },
      eteint: null,                       // hors direct : pas de miniature
    };
    ['un', 'deux', 'trois'].forEach(l => window.__addCard(l, 'G', '1 k'));
    window.__addCard('eteint', 'G', '0', false);
    // Carte en direct mais ABSENTE de __fx : l'API ne la connaît pas, donc le
    // cache non plus. C'est la situation des sections « Chaînes live » et
    // « Les spectateurs de… », que le scan n'interroge jamais.
    window.__addCard('recommandee', 'G', '2 k');
    // Et une carte hors ligne pour l'API SEULEMENT le temps qu'elle le
    // confirme : tant que le DOM la montre en direct, la réchauffer est le bon
    // choix — c'est l'affichage qui fait foi pour ce que l'utilisateur peut
    // survoler.
    window.__addCard('grisee', 'G', '0', false);
  });
  const logins = (urls) => urls.map(u => u.split('live_user_')[1]?.split('-')[0]);

  // ── a) le pointeur est ailleurs : la passe doit tourner ──────────────────
  {
    const cdn = [];
    const page = await freshTwitch('<!doctype html><html><body>x</body></html>', cdn);
    await poser(page);
    await wait(page, 2500);   // aucun survol, souris jamais déplacée
    const vus = new Set(logins(cdn));
    ok('les chaînes en direct sont réchauffées',
       ['un', 'deux', 'trois'].every(l => vus.has(l)), [...vus].join(', '));
    // Une chaîne hors direct n'a pas de miniature : la demander donnerait un 404.
    ok('une chaîne hors direct n\'est pas demandée', !vus.has('eteint'), [...vus].join(', '));
    // Sections hors « suivis » : la carte est en direct dans le DOM, mais
    // l'extension ne l'a jamais interrogée. Elle doit quand même être servie.
    ok('une carte live inconnue de l\'API est réchauffée', vus.has('recommandee'), [...vus].join(', '));
    ok('une carte à l\'avatar grisé est écartée', !vus.has('grisee'), [...vus].join(', '));
    await page.close();
  }

  // ── b) l'URL préchargée doit être CELLE du survol, au caractère près ─────
  //     C'est le mode de panne évident : un écart d'un caractère et la passe
  //     réchaufferait le vide, sans que rien ne le signale.
  {
    const cdn = [];
    const page = await freshTwitch('<!doctype html><html><body>x</body></html>', cdn);
    await poser(page);
    // Se caler sur un DÉBUT de tranche. Sinon, à l'échelle accélérée du
    // harnais, la tranche peut basculer entre la passe et le survol : le popup
    // demanderait alors légitimement une URL neuve, et le test conclurait à
    // tort que la passe a réchauffé autre chose.
    const slice = Number(/PREVIEW_THUMB_CACHE_MS:\s*([\d_]+)/
      .exec(readFileSync(join(ICI, 'content.test.js'), 'utf8'))[1].replaceAll('_', ''));
    await wait(page, slice - (Date.now() % slice) + 60);
    await wait(page, 900);            // la passe tourne dans la tranche neuve
    // Sélection par TRANCHE, pas par index : la marge de calage suffit à ce
    // qu'un réveil ait déjà lancé la passe, et un découpage positionnel
    // laisserait ces requêtes-là hors du compte.
    const tranche = Math.floor(Date.now() / slice);
    const preloadees = cdn.filter(u => u.includes('live_user_un-') && u.endsWith('?_=' + tranche));
    ok('« un » a bien été préchargée', preloadees.length >= 1, String(preloadees.length));

    const avant = cdn.length;
    await hoverLogin(page, 'un');
    await wait(page, 400);
    const src = await page.evaluate(() =>
      document.querySelector('.tse-preview__thumb')?.src ?? null);
    ok('le popup demande une URL déjà préchargée',
       preloadees.includes(src), `${src}\n     vs ${preloadees[preloadees.length - 1]}`);
    // On ne peut PAS vérifier ici « aucune requête en plus » : sous interception
    // réseau, Playwright sert chaque requête lui-même et le cache HTTP du
    // navigateur n'est jamais consulté. Ce qui reste observable, et qui est le
    // vrai invariant : le survol ne réclame aucune URL INÉDITE. S'il en
    // réclamait une, c'est que la passe aurait réchauffé autre chose que ce
    // qu'il demande — la panne silencieuse qu'on veut exclure.
    const inedites = cdn.slice(avant).filter(u => !cdn.slice(0, avant).includes(u));
    ok('le survol ne réclame aucune URL inédite', inedites.length === 0, inedites.join(' | '));
    await page.close();
  }

  // ── c) la porte, dans les DEUX sens ─────────────────────────────────────
  {
    const cdn = [];
    const page = await freshTwitch('<!doctype html><html><body>x</body></html>', cdn);
    const box = await page.locator('#side-nav').boundingBox();
    ok('la sidebar a une géométrie', !!box, JSON.stringify(box));
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await poser(page);

    // ATTENDRE que le navigateur reconnaisse le survol. Chromium ne recalcule
    // pas :hover à la réception du mousemove mais au prochain événement : juste
    // après mouse.move, matches(':hover') répond encore false pendant plusieurs
    // centaines de millisecondes. Mesurer sans cette attente reviendrait à
    // observer une fenêtre où la porte est légitimement ouverte, et à conclure
    // qu'elle ne ferme pas.
    await page.waitForFunction(
      () => document.querySelector('#side-nav')?.matches(':hover') === true,
      null, { timeout: 5000 });
    ok('le survol est reconnu par le navigateur', true);

    // Porte FERMÉE : deux chaînes neuves, jamais préchargées, apparaissent
    // alors que le pointeur est sur la sidebar. Rien ne doit partir.
    const avant = cdn.length;
    await page.evaluate(() => {
      const h = new Date(Date.now() - 3600_000).toISOString();
      window.__fx.quatre = { id:'4', createdAt:h, viewers:700, game:'G', tags:[] };
      window.__fx.cinq   = { id:'5', createdAt:h, viewers:600, game:'G', tags:[] };
      window.__addCard('quatre', 'G', '700');
      window.__addCard('cinq',   'G', '600');
    });
    await wait(page, 1200);
    const pendant = logins(cdn.slice(avant));
    ok('rien n\'est réchauffé tant que le pointeur est sur la sidebar',
       !pendant.includes('quatre') && !pendant.includes('cinq'), pendant.join(', '));

    // Porte OUVERTE : on sort, la passe doit reprendre — et reprendre LÀ où
    // elle s'était arrêtée, donc servir précisément ces deux-là.
    await page.mouse.move(box.x + box.width + 200, box.y + 400);
    await page.waitForFunction(
      () => document.querySelector('#side-nav')?.matches(':hover') === false,
      null, { timeout: 5000 });
    await wait(page, 1500);
    const apres = logins(cdn.slice(avant));
    ok('la passe reprend dès la sortie',
       apres.includes('quatre') && apres.includes('cinq'), apres.join(', '));
    await page.close();
  }

  // ── d) changement de tranche : le registre est purgé, la passe repart ────
  {
    const cdn = [];
    const page = await freshTwitch('<!doctype html><html><body>x</body></html>', cdn);
    await poser(page);
    await wait(page, 2000);
    const tranches1 = new Set(cdn.map(u => u.split('?_=')[1]));
    await wait(page, 4000);          // la tranche du harnais dure 3 s
    const tranches2 = new Set(cdn.map(u => u.split('?_=')[1]));
    ok('la passe repart à la tranche suivante', tranches2.size > tranches1.size,
       `${tranches1.size} → ${tranches2.size} tranche(s)`);
    // Sans purge du registre, la seconde tranche n'aurait rien redemandé.
    const derniere = [...tranches2].sort().pop();
    const vus = new Set(logins(cdn.filter(u => u.endsWith(derniere))));
    ok('toutes les chaînes sont redemandées après la purge',
       ['un', 'deux', 'trois'].every(l => vus.has(l)), [...vus].join(', '));
    await page.close();
  }
}

// ═════════════ 34. Chaînes globales — couche de données ═════════════
console.log('\n34. Chaînes globales — classer ce que l\'API refuse de classer');
{
  // Décor commun. 10 catégories d'amorce portant 40 streams (4000, 3900, …
  // 100 spectateurs, répartis en tourniquet), puis une 11e catégorie
  // AU-DESSUS du seuil et deux AU-DESSOUS.
  //
  //   T = 30e score après l'amorce      = 4000 − 29×100 = 1100
  //   « star » (2550) entre au classement → T monte à     1200
  //
  // Le stub rend `streams` EN DÉSORDRE, comme l'API réelle : si le module se
  // contentait de recopier l'ordre reçu, tout ce scénario tomberait.
  const decor = (page) => page.evaluate(() => {
    const cats = [];
    for (let i = 0; i < 10; i++) cats.push({ name: 'c' + i, viewers: 50_000 - i, streams: [] });
    for (let k = 0; k < 40; k++) {
      cats[k % 10].streams.push({ login: 's' + String(k).padStart(2, '0'),
                                  viewers: 4000 - k * 100 });
    }
    cats.push({ name: 'cAbove',  viewers: 5000, streams: [{ login: 'star',  viewers: 2550 }] });
    cats.push({ name: 'cBelow',  viewers: 900,  streams: [{ login: 'ghost', viewers: 900  }] });
    cats.push({ name: 'cBelow2', viewers: 500,  streams: [{ login: 'dust',  viewers: 500  }] });
    window.__cats = cats;
  });
  const catsAsked = (page) => page.evaluate(() => window.__calls.flatMap(c => c.cats || []));

  // ── a) la marche complète, et sa garantie d'exactitude ──────────────────
  {
    const page = await fresh();
    await decor(page);
    const rep = await page.evaluate(() => window.tse.global.on());
    ok('la marche s\'arrête sur la condition d\'exactitude, pas sur le budget',
       rep.complete === true, JSON.stringify(rep));
    ok('le seuil T vaut ce que l\'arithmétique prévoit', rep.threshold === 1200,
       String(rep.threshold));

    const top = await page.evaluate(() => window.tse.global.top(30).map(r => `${r.login}:${r.viewers}`));
    const nums = top.map(s => Number(s.split(':')[1]));
    ok('30 chaînes exactement', nums.length === 30, String(nums.length));
    ok('le classement est strictement décroissant — c\'est NOUS qui trions',
       nums.every((v, i) => !i || nums[i - 1] > v), top.join(' '));
    ok('la chaîne d\'une catégorie HORS amorce est bien montée au classement',
       top.some(s => s.startsWith('star:')), top.join(' '));
    ok('aucune chaîne des catégories sous T n\'apparaît',
       !top.some(s => /^(ghost|dust):/.test(s)), top.join(' '));

    // LE test d'exactitude : une catégorie sous T n'est pas seulement absente
    // du résultat, elle n'est même jamais INTERROGÉE. C'est là que se paie
    // l'inégalité viewers(stream) <= viewers(catégorie).
    const cats = await catsAsked(page);
    ok('les 10 catégories d\'amorce sont interrogées',
       [...Array(10).keys()].every(i => cats.includes('c' + i)), cats.join(','));
    ok('la 11e, au-dessus de T, l\'est aussi', cats.includes('cAbove'), cats.join(','));
    ok('celles sous T ne le sont JAMAIS',
       !cats.includes('cBelow') && !cats.includes('cBelow2'), cats.join(','));

    // Coût : deux requêtes groupées, et pas onze. Le découpage en deux est
    // inhérent — la descente a besoin du T calculé sur l'amorce.
    const posts = await page.evaluate(() => window.__calls
      .filter(c => (c.names || []).includes('TseCategoryTop')).length);
    ok('les 11 opérations catégorie tiennent en 2 requêtes groupées',
       posts === 2, String(posts));
    const forms = await page.evaluate(() => window.__calls
      .filter(c => (c.names || []).some(n => n === 'TseCategories' || n === 'TseCategoryTop'))
      .map(c => c.form));
    ok('aucune opération du mode global ne porte de hash',
       forms.length > 0 && forms.every(f => f === 'inline'), forms.join(','));
    await page.close();
  }

  // ── b) l'ordre rendu par `games` n'est pas cru sur parole ───────────────
  {
    const page = await fresh();
    await decor(page);
    // Le stub sert désormais la liste des catégories À L'ENVERS. Une API qui
    // viole déjà son contrat sur `streams` ne mérite pas qu'on lui fasse
    // confiance sur `games` : le module retrie, donc le résultat est le même.
    await page.evaluate(() => { window.__catsUnsorted = true; });
    const rep = await page.evaluate(() => window.tse.global.on());
    ok('même seuil malgré une liste de catégories servie à l\'envers',
       rep.threshold === 1200, String(rep.threshold));
    const cats = await catsAsked(page);
    ok('l\'amorce reste les 10 PLUS GROSSES catégories',
       [...Array(10).keys()].every(i => cats.includes('c' + i))
       && !cats.includes('cBelow2'), cats.join(','));
    const rows = await page.evaluate(() => window.tse.global.cats(13).map(c => c.viewers));
    ok('les catégories rendues à l\'appelant sont décroissantes',
       rows.every((v, i) => !i || rows[i - 1] >= v), rows.join(','));
    await page.close();
  }

  // ── c) passe légère : elle ne refait pas la marche ──────────────────────
  {
    const page = await fresh();
    await decor(page);
    await page.evaluate(() => window.tse.global.on());
    const avant = (await catsAsked(page)).length;
    // GLOBAL_STRUCT_TICK vaut 600 ms dans le harnais, la marche complète
    // 3 000 ms : la fenêtre observée ne contient donc que des passes légères.
    await wait(page, 1500);
    const apres = await catsAsked(page);
    const delta = apres.slice(avant);
    ok('une passe légère a bien eu lieu', delta.length > 0, String(delta.length));
    ok('elle n\'interroge que l\'amorce, pas toute la descente',
       delta.every(n => /^c[0-9]$/.test(n)), delta.join(','));
    await page.close();
  }

  // ── d) une catégorie qui franchit T est rattrapée au cycle suivant ──────
  {
    const page = await fresh();
    await decor(page);
    await page.evaluate(() => window.tse.global.on());
    ok('la chaîne dormante est absente au départ',
       !(await page.evaluate(() => window.tse.global.top(30).some(r => r.login === 'ghost'))));
    // cBelow explose : son total passe au-dessus de T, et son sommet avec.
    await page.evaluate(() => {
      const c = window.__cats.find(x => x.name === 'cBelow');
      c.viewers = 9000;
      c.streams = [{ login: 'ghost', viewers: 2000 }];
    });
    await wait(page, 1500);
    const cats = await catsAsked(page);
    ok('la catégorie qui vient de franchir T est interrogée',
       cats.includes('cBelow'), cats.join(','));
    const top = await page.evaluate(() => window.tse.global.top(30).map(r => `${r.login}:${r.viewers}`));
    ok('sa chaîne entre au classement, à sa place',
       top.includes('ghost:2000'), top.join(' '));
    // Décroissance LARGE et non stricte : deux chaînes peuvent parfaitement
    // afficher le même compteur, et l'exiger strict ferait échouer le test
    // sur une égalité légitime plutôt que sur un défaut de tri.
    const nums = top.map(s => Number(s.split(':')[1]));
    ok('le classement reste décroissant',
       nums.every((v, i) => !i || nums[i - 1] >= v), top.join(' '));
    await page.close();
  }

  // ── e) un compteur frais de TseChannels reclasse, sans requête de plus ──
  {
    const page = await fresh();
    await decor(page);
    await page.evaluate(() => {
      const h = new Date(Date.now() - 30 * 60_000).toISOString();
      // s00 est en tête du classement global (4000). La sidebar, elle, va
      // apprendre qu'il n'a plus que 12 spectateurs.
      window.__fx = { s00: { id: 'id-s00', createdAt: h, viewers: 12,
                             game: 'Just Chatting', tags: [] } };
      window.__addCard('s00', 'Just Chatting', '4 k');
    });
    await page.evaluate(() => window.tse.global.on());
    ok('s00 est bien en tête après la marche',
       await page.evaluate(() => window.tse.global.top(1)[0]?.login) === 's00');
    // On fige la couche structurelle : seule la file TseChannels peut encore
    // faire bouger le classement. Sans ce gel, la marche suivante restaurerait
    // 4000 et le test mesurerait le hasard.
    const posts0 = await page.evaluate(() => {
      window.__globalFail = true;
      return window.__calls.length;
    });
    await wait(page, 1200);
    const rang = await page.evaluate(() => {
      // 41 chaînes dans le pool (40 d'amorce + « star »). Demander 40
      // trancherait précisément celle qu'on cherche, une fois qu'elle est
      // tombée en dernière position.
      const t = window.tse.global.top(50);
      const i = t.findIndex(r => r.login === 's00');
      return { i, v: t[i]?.viewers ?? null, n: t.length };
    });
    ok('le compteur frais est appliqué', rang.v === 12, JSON.stringify(rang));
    ok('et il fait redescendre la chaîne au bon rang',
       rang.i === rang.n - 1, JSON.stringify(rang));
    // Aucune requête dédiée : le classement a voyagé dans le lot TseChannels.
    const dedies = await page.evaluate((n0) => window.__calls.slice(n0)
      .filter(c => (c.names || []).some(x => x === 'TseCategories' || x === 'TseCategoryTop'))
      .length, posts0);
    const lots = await page.evaluate((n0) => window.__calls.slice(n0)
      .filter(c => (c.names || []).includes('TseChannels')).length, posts0);
    ok('des lots TseChannels ont bien circulé', lots > 0, String(lots));
    ok('et le classement n\'a coûté aucune requête supplémentaire',
       dedies > 0, `${dedies} tentative(s) structurelle(s), toutes en échec forcé`);
    await page.close();
  }

  // ── e bis) fenêtre trop courte : le module refuse de se dire complet ────
  {
    // 100 catégories — la fenêtre entière — toutes AU-DESSUS du seuil. La
    // descente les visite toutes sans jamais croiser T, donc rien ne prouve
    // qu'une 101e catégorie, invisible, n'abrite pas un membre du top 30.
    // Le module doit le dire plutôt que de se déclarer exact.
    const page = await fresh();
    await page.evaluate(() => {
      window.__cats = [...Array(100)].map((_, i) => ({
        name: 'w' + i, viewers: 6000,
        streams: [5000, 4900, 4800, 4700].map((v, k) => ({ login: `w${i}_${k}`, viewers: v }))
      }));
    });
    const rep = await page.evaluate(() => window.tse.global.on());
    ok('le plancher de fenêtre est remonté', rep.windowFloor === 6000, JSON.stringify(rep));
    ok('il est au-dessus de T', rep.windowFloor > rep.threshold,
       `${rep.windowFloor} vs ${rep.threshold}`);
    ok('donc le classement n\'est PAS déclaré complet', rep.complete === false,
       JSON.stringify(rep));
    // Et il reste servi : incomplet ne veut pas dire inutilisable.
    const n = await page.evaluate(() => window.tse.global.top(30).length);
    ok('le classement reste servi malgré tout', n === 30, String(n));
    await page.close();
  }

  // ── g) échantillonnage de l'API : une absence isolée n'évince pas ───────
  {
    // MESURÉ en production : `streams(first: 30)` omet par intermittence une
    // chaîne qui devrait y figurer — rubius, 23 608 spectateurs, présent 4
    // appels sur 6 (●○●○●●). Sans tolérance, une telle chaîne clignoterait
    // dans le classement une passe sur trois.
    const page = await fresh();
    await decor(page);
    await page.evaluate(() => window.tse.global.on());
    const present = () => page.evaluate(() =>
      window.tse.global.top(40).some(r => r.login === 's00'));
    ok('la chaîne est au classement avant de disparaître des réponses', await present());

    // L'API cesse de la rendre. c0 est une catégorie d'amorce, donc chaque
    // passe légère l'interroge et constate l'absence.
    await page.evaluate(() => { window.__hidden = ['s00']; });
    // Passes à ~600 ms d'intervalle ; GLOBAL_MISS_CONFIRM en exige trois.
    await wait(page, 900);
    ok('une absence ne suffit pas à l\'évincer', await present());
    await wait(page, 600);
    ok('deux non plus', await present());
    await wait(page, 1100);
    ok('trois d\'affilée, en revanche, l\'évincent', !(await present()));
    const rep = await page.evaluate(() => window.tse.global.report());
    ok('les absences sont comptées dans le rapport', rep.misses >= 3, JSON.stringify(rep));
    ok('et l\'éviction aussi', rep.evicted >= 1, JSON.stringify(rep));

    // Elle revient dès que l'API la rend de nouveau — c'est bien une
    // tolérance, pas une liste noire.
    await page.evaluate(() => { window.__hidden = []; });
    await wait(page, 1200);
    ok('elle revient dès que l\'API la rend à nouveau', await present());
    await page.close();
  }

  // ── h) ne pas regarder n'est pas constater ──────────────────────────────
  {
    // « star » vit dans cAbove, que la passe légère n'interroge PAS : cette
    // catégorie n'est ni dans l'amorce, ni en train de franchir T. Son absence
    // des réponses ne doit donc RIEN compter contre elle.
    const page = await fresh();
    await decor(page);
    await page.evaluate(() => window.tse.global.on());
    await page.evaluate(() => { window.__hidden = ['star']; });
    // Quatre passes légères tiennent dans cette fenêtre — et la marche
    // complète, seule à redescendre jusqu'à cAbove, n'arrive qu'à 3 000 ms.
    await wait(page, 2400);
    const cats = await page.evaluate(() => window.__calls.flatMap(c => c.cats || []));
    const apresAmorce = cats.slice(11);   // au-delà de la marche initiale
    ok('les passes légères n\'ont pas interrogé sa catégorie',
       !apresAmorce.includes('cAbove'), apresAmorce.join(','));
    ok('elle reste donc au classement, intacte',
       await page.evaluate(() => window.tse.global.top(40).some(r => r.login === 'star')));
    await page.close();
  }

  // ── f) panne confinée : la sidebar suivie ne tombe pas avec le global ───
  {
    const page = await fresh();
    await decor(page);
    const warns = [];
    page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
    await page.evaluate(() => {
      const h = new Date(Date.now() - 30 * 60_000).toISOString();
      window.__fx = { alpha: { id: 'id-alpha', createdAt: h, viewers: 777,
                               game: 'Just Chatting', tags: [] } };
      window.__addCard('alpha', 'Just Chatting', '100');
      window.__globalFail = true;           // le global échoue dès le départ
      window.tse.global.on();
    });
    // GLOBAL_ERROR_COOLDOWN vaut 1 500 ms ici, et il faut GLOBAL_FAIL_DEGRADE
    // (3) échecs consécutifs pour que la cadence se replie.
    await wait(page, 5200);
    const rep = await page.evaluate(() => window.tse.global.report());
    ok('la cadence structurelle se replie d\'elle-même', rep.degraded === true,
       JSON.stringify(rep));
    ok('et le repli est annoncé en console', warns.some(w => /\[tse\]/.test(w)),
       warns.join(' | '));
    ok('le classement reste vide plutôt que faux', rep.pool === 0, String(rep.pool));
    // L'invariant qui compte : la sidebar « Chaînes suivies » n'a rien vu.
    const carte = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'alpha');
      return c ? nzText(c) : null;
      function nzText(card) { return card.querySelector('.tse-viewers')?.textContent ?? null; }
    });
    ok('la sidebar suivie continue de se rafraîchir normalement',
       nz(carte) === '777', String(carte));
    await page.close();
  }
}

// ═════════════ 35. Top Chaînes — la bascule et les cartes ═════════════
const S_MENU_ARIA = 'Choisir ce qui s\'affiche dans la barre latérale';
console.log('\n35. Top Chaînes — basculer, afficher, revenir');
{
  const poser = (page) => page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    window.__fx = {
      suivi1: { id: 'id-suivi1', createdAt: h, viewers: 400, game: 'Just Chatting', tags: [] },
      suivi2: { id: 'id-suivi2', createdAt: h, viewers: 300, game: 'Just Chatting', tags: [] },
    };
    window.__addCard('suivi1', 'Just Chatting', '400');
    window.__addCard('suivi2', 'Just Chatting', '300');
    // Une carte dans la section de recommandation « Chaînes live ».
    window.__fx.reco1 = { id: 'id-reco1', createdAt: h, viewers: 90,
                          game: 'Just Chatting', tags: [] };
    window.__addReco('reco1', 'Just Chatting', '90');
    // Un classement mondial volontairement petit et sans ambiguïté.
    window.__cats = [
      { name: 'g1', viewers: 90_000, streams: [
        { login: 'alpha', viewers: 50_000 }, { login: 'bravo', viewers: 30_000 }] },
      { name: 'g2', viewers: 40_000, streams: [
        { login: 'charlie', viewers: 25_000 }, { login: 'delta', viewers: 9_000 }] },
      { name: 'g3', viewers: 20_000, streams: [{ login: 'echo', viewers: 12_000 }] },
    ];
  });
  // La bascule est un onglet dans NOTRE bloc filtre. Pas de menu à ouvrir,
  // donc pas d'étape intermédiaire — un seul clic, toujours au même endroit.
  const clic = (page, mode) => page.evaluate((m) => {
    const b = document.querySelector(`#tse-mode-row [data-tse-mode="${m}"]`);
    if (!b) throw new Error('onglet de mode absent : ' + m);
    b.click();
  }, mode);
  const vue = (page) => page.evaluate(() => ({
    titre: document.querySelector('#side-nav .side-nav__title h3')?.textContent?.trim(),
    // L'en-tête natif doit rester masqué dans les deux modes.
    enteteMasque: document.querySelector('.followed-side-nav-header')
                    ?.getAttribute('data-tse-native-header') === 'hidden',
    actif: [...document.querySelectorAll('#tse-mode-row [data-tse-mode]')]
      .filter(b => b.getAttribute('aria-pressed') === 'true')
      .map(b => b.dataset.tseMode),
    mode:  document.body.classList.contains('tse-global-mode'),
    ready: document.body.classList.contains('tse-global-ready'),
    natif: window.__nativeSortOpened,
    // Cartes réellement VISIBLES, dans l'ordre du DOM.
    visibles: [...document.querySelectorAll('.side-nav-card')]
      .filter(c => getComputedStyle(c).display !== 'none')
      .map(c => c.dataset.tseLogin),
  }));

  {
    const page = await fresh();
    await poser(page);
    await wait(page, 1600);

    // ── a) le contrôle nous appartient, et Twitch n'est pas touché ───────
    // Largeur réelle de la barre latérale étendue de Twitch : c'est la seule
    // condition dans laquelle « libellé entier » veut dire quelque chose.
    await page.evaluate(() => {
      const nav = document.getElementById('side-nav');
      nav.style.width = '240px';
      nav.style.boxSizing = 'border-box';
      nav.style.padding = '0 8px';
    });
    await wait(page, 300);
    const ui = await page.evaluate(() => {
      const row = document.getElementById('tse-mode-row');
      const bar = document.getElementById('tse-filter');
      const cs = (el) => {
        const s = getComputedStyle(el);
        return { fond: s.backgroundColor, image: s.backgroundImage, couleur: s.color };
      };
      const actif   = row?.querySelector('[data-tse-mode][aria-pressed="true"]');
      const inactif = row?.querySelector('[data-tse-mode][aria-pressed="false"]');
      return row ? {
        dansFiltre: row.parentElement?.id === 'tse-filter',
        premier: bar?.firstElementChild?.id === 'tse-mode-row',
        aria: row.getAttribute('aria-label'),
        // La bascule doit former UNE piste, à la même trame verticale que la
        // rangée de filtres juste en dessous.
        hauteur: Math.round(row.getBoundingClientRect().height),
        hauteurFiltres: Math.round(
          bar?.querySelector('.tse-filter-row')?.getBoundingClientRect().height || 0),
        filet: getComputedStyle(row).borderTopWidth,
        fondPiste: getComputedStyle(row).backgroundColor,
        actif:   actif   ? cs(actif)   : null,
        inactif: inactif ? cs(inactif) : null,
        onglets: [...row.querySelectorAll('[data-tse-mode]')].map(b => ({
          mode: b.dataset.tseMode,
          label: b.textContent,
          presse: b.getAttribute('aria-pressed'),
          // Débordement horizontal : > 0 signifie libellé coupé.
          coupe: b.scrollWidth - b.clientWidth })),
      } : null;
    });
    ok('la bascule est posée', !!ui, 'absente');
    ok('dans notre bloc filtre, que React ne reconstruit pas',
       ui?.dansFiltre === true, JSON.stringify(ui));
    ok('et en tête du bloc, juste sous la rangée des stories',
       ui?.premier === true, JSON.stringify(ui));
    ok('le groupe annonce son rôle', ui?.aria === S_MENU_ARIA, ui?.aria);
    // Un contrôle segmenté, et non deux pastilles flottantes : la rangée
    // porte elle-même une surface et un filet, comme les listes déroulantes.
    ok('la bascule forme une piste, pas deux boutons posés sur le fond',
       ui?.filet === '1px' && ui?.fondPiste !== 'rgba(0, 0, 0, 0)',
       JSON.stringify({ filet: ui?.filet, fond: ui?.fondPiste }));
    ok('et elle s\'aligne sur la hauteur de la rangée de filtres',
       ui?.hauteur === ui?.hauteurFiltres,
       `bascule ${ui?.hauteur}px / filtres ${ui?.hauteurFiltres}px`);
    // Le mode courant doit se voir SANS lire le texte : l'invariant est que
    // les deux segments ne peuvent pas avoir le même rendu.
    ok('le segment actif se distingue du segment inactif',
       !!ui?.actif && !!ui?.inactif &&
       JSON.stringify(ui.actif) !== JSON.stringify(ui.inactif),
       JSON.stringify({ actif: ui?.actif, inactif: ui?.inactif }));
    ok('deux onglets, dans cet ordre',
       ui?.onglets.map(o => o.mode).join(',') === 'followed,global',
       JSON.stringify(ui?.onglets));
    ok('avec les libellés attendus',
       ui?.onglets.map(o => o.label).join(' | ') === 'Chaînes suivies | Top Chaînes',
       JSON.stringify(ui?.onglets));
    // LE point demandé : aucun libellé tronqué, à largeur réelle de sidebar.
    ok('aucun libellé n\'est coupé, à 240 px de barre latérale',
       ui?.onglets.every(o => o.coupe <= 0),
       JSON.stringify(ui?.onglets.map(o => o.label + ':' + o.coupe)));
    // Les deux libellés FRANÇAIS tiennent de toute façon : mesurer ceux-là
    // ne prouve rien sur la mise en page. On éprouve donc la RÈGLE, avec un
    // libellé plus long que ne le sera jamais aucune traduction.
    const large = await page.evaluate(() => {
      const b = document.querySelector('#tse-mode-row [data-tse-mode="followed"]');
      const avant = b.textContent;
      b.textContent = 'Kanäle, denen du folgst und mehr';
      void b.offsetWidth;                       // force le recalcul
      const coupe = b.scrollWidth - b.clientWidth;
      b.textContent = avant;
      return coupe;
    });
    ok('et la mise en page ne coupe pas même un libellé démesuré',
       large <= 0, `débordement de ${large}px`);
    // Un onglet ne doit JAMAIS porter le nom d'une section : DOM.followedSelector
    // cherche aria-label="Chaînes suivies" et prendrait le bouton pour la
    // section suivie — la sidebar se croirait alors vide.
    ok('aucun onglet n\'usurpe le libellé d\'une section',
       await page.evaluate(() => ![...document.querySelectorAll('#tse-mode-row [data-tse-mode]')]
         .some(b => b.hasAttribute('aria-label'))));
    ok('et la section suivie reste correctement identifiée',
       await page.evaluate(() => document.querySelector('[aria-label="Chaînes suivies"]')
         ?.querySelectorAll('.side-nav-card').length) === 2);
    ok('le mode courant est marqué actif',
       ui?.onglets[0].presse === 'true' && ui?.onglets[1].presse === 'false',
       JSON.stringify(ui?.onglets));

    // La rangée des stories : visible en mode suivi, masquée en Top Chaînes.
    const storiesVisible = () => page.evaluate(() => {
      const el = document.querySelector('[data-tse-stories="row"]');
      return el ? getComputedStyle(el).display !== 'none' : null;
    });
    ok('la rangée des stories est repérée', await storiesVisible() !== null);
    ok('et reste visible sur les chaînes suivies', await storiesVisible() === true);
    // Twitch ne lui pose de marge qu'en haut (0,7rem, en ligne) : sans la
    // nôtre en bas, elle touche le bloc filtre. Mesuré en pixels calculés,
    // donc à l'échelle réelle de Twitch (racine à 62,5 % → 0,7rem = 7px).
    ok('elle respire autant en dessous qu\'au-dessus',
       await page.evaluate(() => {
         const cs = getComputedStyle(document.querySelector('[data-tse-stories="row"]'));
         return cs.marginBottom === cs.marginTop && cs.marginBottom === '7px';
       }),
       await page.evaluate(() => {
         const cs = getComputedStyle(document.querySelector('[data-tse-stories="row"]'));
         return `haut ${cs.marginTop} / bas ${cs.marginBottom}`;
       }));
    ok('le bloc marqué porte bien la vignette ET le libellé',
       await page.evaluate(() => {
         const el = document.querySelector('[data-tse-stories="row"]');
         return !!el?.querySelector('img') && /stories/i.test(el.textContent || '');
       }));
    ok('et il ne contient aucune carte',
       await page.evaluate(() => !document.querySelector('[data-tse-stories="row"] .side-nav-card')));

    // L'en-tête natif — titre ET bouton de tri — est masqué : plus de tri
    // Twitch en concurrence du nôtre, et plus de titre redondant.
    ok('l\'en-tête natif de Twitch est masqué',
       await page.evaluate(() => document.querySelector('.followed-side-nav-header')
         ?.getAttribute('data-tse-native-header') === 'hidden'));
    ok('rien n\'a été ajouté dans le titre racine',
       await page.evaluate(() =>
         !document.querySelector('#side-nav .side-nav__title button')));
    // On ne touche plus au bouton de Twitch : ni instrumentation, ni clic.
    ok('le bouton de tri natif n\'est plus instrumenté',
       await page.evaluate(() => !document.querySelector('[data-tse-mode-trigger]')));
    ok('et son gestionnaire n\'est jamais déclenché',
       await page.evaluate(() => window.__nativeSortOpened) === 0);

    // Recliquer l'onglet actif ne bascule pas : un mode est toujours actif.
    await clic(page, 'followed');
    ok('recliquer le mode actif est sans effet',
       await page.evaluate(() => !document.body.classList.contains('tse-global-mode')));

    const avant = await vue(page);
    ok('on part bien des chaînes suivies', avant.titre === 'Chaînes suivies', avant.titre);
    ok('et elles sont visibles',
       avant.visibles.includes('suivi1') && avant.visibles.includes('suivi2'),
       avant.visibles.join(','));

    // Un mode de tri non pertinent est choisi AVANT de basculer : le
    // classement mondial ne doit pas s'y soumettre. En alphabétique, « delta »
    // passerait devant « echo » — alors qu'il a moins de spectateurs.
    await page.evaluate(() =>
      document.querySelector('[data-tse-sort-mode="alpha"]')?.click());
    await wait(page, 300);

    // ── b) la bascule ────────────────────────────────────────────────────
    await clic(page, 'global');
    await wait(page, 1200);
    const apres = await vue(page);
    ok('le titre racine porte le nom du mode', apres.titre === 'Top Chaînes', apres.titre);
    ok('l\'en-tête natif reste masqué', apres.enteteMasque === true);
    ok('l\'onglet Top Chaînes devient actif',
       apres.actif.join(',') === 'global', apres.actif.join(','));
    ok('le menu natif n\'a toujours pas été atteint', apres.natif === 0, String(apres.natif));
    ok('la rangée des stories disparaît en Top Chaînes',
       await storiesVisible() === false);
    // Les sections de recommandation de Twitch parlent de ce que l'utilisateur
    // SUIT : elles n'ont plus de rapport avec un classement mondial.
    const recoVisible = () => page.evaluate(() => {
      const sec = document.querySelector('.side-nav-section[aria-label="Chaînes live"]');
      return sec ? getComputedStyle(sec).display !== 'none' : null;
    });
    ok('les sections de recommandation sont masquées', await recoVisible() === false);
    ok('la ligne des modes de tri est masquée',
       await page.evaluate(() => {
         const r = document.getElementById('tse-sort-row');
         return !r || getComputedStyle(r).display === 'none';
       }));

    // ── c) les cartes du classement, dans l'ordre ────────────────────────
    ok('le classement est prêt', apres.ready === true, JSON.stringify(apres));
    ok('les cartes affichées sont celles du classement, dans l\'ordre',
       apres.visibles.join(',') === 'alpha,bravo,charlie,echo,delta',
       apres.visibles.join(','));
    ok('aucune chaîne suivie ne reste visible',
       !apres.visibles.includes('suivi1') && !apres.visibles.includes('suivi2'),
       apres.visibles.join(','));
    // Le compteur ne doit PAS être celui de la carte qui a servi de modèle.
    const compteur = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'alpha');
      return c?.querySelector('.tse-viewers')?.textContent ?? null;
    });
    ok('chaque carte porte SON compteur, pas celui du modèle',
       nz(compteur) === '50 k', String(compteur));

    // ── d) retour ────────────────────────────────────────────────────────
    await clic(page, 'followed');
    await wait(page, 600);
    const retour = await vue(page);
    ok('le titre revient', retour.titre === 'Chaînes suivies', retour.titre);
    ok('l\'onglet Chaînes suivies redevient actif',
       retour.actif.join(',') === 'followed', retour.actif.join(','));
    ok('le mode de tri choisi avant la bascule est retrouvé intact',
       await page.evaluate(() =>
         document.querySelector('[data-tse-sort-mode="alpha"]')?.getAttribute('aria-pressed'))
         === 'true');
    ok('la rangée des stories revient avec les chaînes suivies',
       await storiesVisible() === true);
    ok('et les sections de recommandation aussi', await recoVisible() === true);
    ok('les chaînes suivies réapparaissent',
       retour.visibles.includes('suivi1') && retour.visibles.includes('suivi2'),
       retour.visibles.join(','));
    ok('et les cartes du classement sont retirées du DOM',
       await page.evaluate(() =>
         document.querySelectorAll('.side-nav-card[data-tse-global="true"]').length) === 0);

    // ── e) re-bascule sur un classement REFROIDI ─────────────────────────
    // Le pool n'est pas purgé en sortant du mode : y revenir reconstruit les
    // cartes à partir d'enregistrements dont l'horodatage a dépassé LIVE_TTL.
    // Le cache est alors périmé, la file TseChannels ne connaît pas ces
    // chaînes — et sans compteur écrit à la fabrication, chaque carte
    // afficherait celui de la chaîne qui lui a servi de modèle.
    // La couche structurelle est gelée : sans ce gel, la re-bascule
    // relancerait une marche qui, avec un stub instantané, rafraîchirait les
    // horodatages en 1 ms — et le cas « à froid » n'existerait jamais.
    await page.evaluate(() => { window.__globalFail = true; });
    await wait(page, 1500);          // > LIVE_TTL : les enregistrements refroidissent
    await clic(page, 'global');
    await wait(page, 400);           // court : avant qu'une nouvelle marche ne rafraîchisse
    const froid = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'alpha');
      return { compteur: c?.querySelector('.tse-viewers')?.textContent ?? null,
               // Texte brut joint au message d'échec : sans lui, un `null`
               // ne dirait pas QUEL chiffre s'affiche à la place.
               brut: (c?.textContent || '').replace(/\s+/g, ' ').trim() };
    });
    ok('même reconstruite à froid, la carte porte SON compteur',
       nz(froid.compteur) === '50 k', JSON.stringify(froid));
    await page.close();
  }

  // ── e) le bandeau d'honnêteté ────────────────────────────────────────────
  {
    const page = await fresh();
    await poser(page);
    await wait(page, 1600);
    await clic(page, 'global');
    await wait(page, 1200);
    ok('classement prouvé complet → aucun bandeau',
       await page.evaluate(() => !document.getElementById('tse-global-partial')));
    await page.close();
  }
  {
    // 100 catégories toutes au-dessus du seuil : la fenêtre est trop courte,
    // le classement est servi mais ne peut pas être déclaré complet.
    const page = await fresh();
    await page.evaluate(() => {
      window.__fx = {};
      window.__addCard('suivi1', 'Just Chatting', '400');
      window.__cats = [...Array(100)].map((_, i) => ({
        name: 'w' + i, viewers: 6000,
        streams: [5000, 4900, 4800, 4700].map((v, k) => ({ login: `w${i}_${k}`, viewers: v }))
      }));
    });
    await wait(page, 1600);
    await clic(page, 'global');
    await wait(page, 1500);
    const texte = await page.evaluate(() =>
      document.getElementById('tse-global-partial')?.textContent ?? null);
    ok('classement non prouvé complet → le bandeau le dit', !!texte, 'absent');
    ok('et il le dit dans la langue de l\'interface',
       (texte || '').startsWith('Classement partiel'), String(texte));
    await page.close();
  }
  // ── g) la bascule est couverte par le voile, pas subie à nu ─────────────
  {
    const page = await fresh();
    await poser(page);
    await page.evaluate(() => { window.__catDelay = 250; });
    await wait(page, 1600);                    // voile de démarrage levé
    ok('le voile de démarrage est bien retombé',
       await page.evaluate(() => !document.body.classList.contains('tse-loading')));

    await page.evaluate(() => {
      const b = document.querySelector('#tse-mode-row [data-tse-mode="global"]');
      b.click();
    });
    ok('le voile se lève dès le clic',
       await page.evaluate(() => document.body.classList.contains('tse-loading')));

    // Sans le verrou, le voile retomberait ICI : la liste des chaînes suivies
    // est peuplée et stable, donc « présentable » au sens du cycle de boot —
    // alors même que le classement n'existe pas encore.
    await wait(page, 450);
    const pendant = await page.evaluate(() => ({
      voile: document.body.classList.contains('tse-loading'),
      pret:  document.body.classList.contains('tse-global-ready'),
    }));
    ok('il tient tant que le classement n\'est pas rendu',
       pendant.voile === true && pendant.pret === false, JSON.stringify(pendant));

    await wait(page, 1400);
    const apres = await page.evaluate(() => ({
      voile: document.body.classList.contains('tse-loading'),
      cartes: document.querySelectorAll('.side-nav-card[data-tse-global="true"]').length,
    }));
    ok('puis retombe une fois les cartes posées',
       apres.voile === false, JSON.stringify(apres));
    ok('et le classement est bien là', apres.cartes > 0, JSON.stringify(apres));

    // Revenir est instantané : les cartes suivies n'ont jamais quitté le DOM.
    await clic(page, 'followed');
    ok('le retour ne rappelle aucun voile',
       await page.evaluate(() => !document.body.classList.contains('tse-loading')));
    await page.close();
  }

  // ── h) plus aucune chaîne suivie en direct : le mode marche quand même ──
  {
    // Le modèle de carte est cloné d'une carte native EN DIRECT. Sans mémoire
    // du modèle, un utilisateur dont personne ne streame ne verrait RIEN dans
    // Top Chaînes — alors que le classement mondial est parfaitement connu.
    const page = await fresh();
    await poser(page);
    await wait(page, 1500);
    await clic(page, 'global');
    await wait(page, 1200);
    ok('le classement s\'affiche une première fois',
       await page.evaluate(() =>
         document.querySelectorAll('.side-nav-card[data-tse-global="true"]').length) > 0);

    await clic(page, 'followed');
    await wait(page, 400);
    // Toutes les cartes natives disparaissent du DOM : plus un seul modèle.
    await page.evaluate(() => {
      document.querySelectorAll('.side-nav-card').forEach(c => {
        if (c.dataset.tseGlobal !== 'true') c.remove();
      });
    });
    await wait(page, 400);
    ok('il ne reste aucune carte native à cloner',
       await page.evaluate(() => ![...document.querySelectorAll('.side-nav-card')]
         .some(c => c.dataset.tseGlobal !== 'true' && c.dataset.tseSynthetic !== 'true')));

    await clic(page, 'global');
    await wait(page, 1200);
    const n = await page.evaluate(() =>
      document.querySelectorAll('.side-nav-card[data-tse-global="true"]').length);
    ok('le classement s\'affiche quand même, grâce au modèle mémorisé',
       n > 0, `${n} carte(s)`);
    await page.close();
  }

}


// ═════════════ 36. Top Chaînes — le filtre catégorie ═════════════
console.log('\n36. Catégories — choisir, ce n\'est pas filtrer');
{
  // Décor conçu autour d'UN point : « petite » est sous le seuil T, donc la
  // marche mondiale ne l'interroge JAMAIS et ses chaînes n'existent nulle
  // part dans le classement du monde. Si elles apparaissent après sélection,
  // c'est nécessairement qu'une requête dédiée est partie — un filtre sur les
  // cartes présentes ne pourrait pas les inventer.
  const decor36 = (page) => page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    window.__fx = {
      suivi1: { id: 'id-suivi1', createdAt: h, viewers: 400, game: 'Just Chatting', tags: [] },
    };
    window.__addCard('suivi1', 'Just Chatting', '400');
    const cats = [];
    for (let i = 0; i < 10; i++) cats.push({ name: 'c' + i, viewers: 50_000 - i, streams: [] });
    for (let k = 0; k < 40; k++) {
      cats[k % 10].streams.push({ login: 's' + String(k).padStart(2, '0'),
                                  viewers: 4000 - k * 100 });
    }
    cats.push({ name: 'petite', viewers: 900, streams: [
      { login: 'cache1', viewers: 900 }, { login: 'cache2', viewers: 800 }] });
    window.__cats = cats;
  });
  const choisirCat = (page, val) => page.evaluate((v) => {
    const opt = [...document.querySelectorAll('#tse-cat-dd .tse-dd-opt')]
      .find(o => (o.dataset.value || '') === v);
    if (!opt) throw new Error('option absente : ' + JSON.stringify(v));
    opt.click();
  }, val);
  const logins = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card[data-tse-global="true"]')]
      .map(c => c.dataset.tseLogin));

  const page = await fresh();
  await decor36(page);
  await wait(page, 1500);
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
  await wait(page, 1500);

  // ── a) la liste des catégories ─────────────────────────────────────────
  const dd = await page.evaluate(() =>
    [...document.querySelectorAll('#tse-cat-dd .tse-dd-opt')]
      .filter(o => o.dataset.value)
      .map(o => ({ val: o.dataset.value,
                   n: o.querySelector('.tse-dd-n')?.textContent?.trim(),
                   label: o.querySelector('.tse-dd-name')?.textContent })));
  ok('les catégories sont proposées', dd.length === 11, String(dd.length));
  ok('classées par audience décroissante',
     dd.map(o => o.val).join(',') === 'c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,petite',
     dd.map(o => o.val).join(','));
  ok('le compteur est une AUDIENCE, pas un nombre de chaînes',
     nz(dd[0].n) === '50 k |', dd[0].n);
  ok('même pour une petite catégorie', nz(dd[10].n) === '900 |', dd[10].n);
  ok('le libellé est le nom canonique, celui que portent les cartes',
     dd[10].label === 'petite', dd[10].label);

  // ── b) les chaînes de « petite » n'existent pas dans le monde ──────────
  const monde = await logins(page);
  ok('le classement mondial est servi', monde.length === 30, String(monde.length));
  ok('et il ignore totalement les chaînes de « petite »',
     !monde.includes('cache1') && !monde.includes('cache2'), monde.join(','));
  const catsVues = await page.evaluate(() => window.__calls.flatMap(c => c.cats || []));
  ok('sa catégorie n\'a même jamais été interrogée',
     !catsVues.includes('petite'), catsVues.join(','));

  // ── c) sélectionner la catégorie déclenche une requête dédiée ──────────
  const avant = await page.evaluate(() => window.__calls.length);
  await choisirCat(page, 'petite');
  ok('le voile couvre le changement de catégorie',
     await page.evaluate(() => document.body.classList.contains('tse-loading')));
  await wait(page, 1500);
  const apres = await logins(page);
  ok('les chaînes de la catégorie sont affichées',
     apres.join(',') === 'cache1,cache2', apres.join(','));
  ok('et rien du classement mondial ne subsiste',
     !apres.some(l => /^s\d\d$/.test(l)), apres.join(','));
  const req = await page.evaluate((n0) => window.__calls.slice(n0)
    .filter(c => (c.names || []).includes('TseCategoryTop'))
    .map(c => ({ cats: c.cats, firsts: c.firsts })), avant);
  ok('une requête dédiée est bien partie', req.length > 0, JSON.stringify(req));
  ok('elle porte sur la catégorie choisie, et sur elle seule',
     req.every(r => r.cats.length === 1 && r.cats[0] === 'petite'), JSON.stringify(req));
  ok('et demande le maximum autorisé par l\'API, soit 30',
     req.every(r => r.firsts.every(n => n === 30)), JSON.stringify(req));
  ok('le voile est retombé', await page.evaluate(() =>
     !document.body.classList.contains('tse-loading')));

  // ── d) revenir à « toutes » est IMMÉDIAT : le pool n'a pas été purgé ───
  await choisirCat(page, '');
  ok('revenir à toutes les catégories ne voile pas',
     await page.evaluate(() => !document.body.classList.contains('tse-loading')));
  // 150 ms : le temps d'un debounce de scan, très loin d'un aller-retour de
  // marche complète. Si les 30 cartes sont là, elles viennent du pool
  // conservé, pas d'une requête. Mesurer « aucune requête » serait faux ici :
  // le harnais accélère la marche complète à 3 s, donc en relancer une après
  // quelques secondes de test est le comportement CORRECT — ce serait un
  // artefact d'accélération, pas un défaut.
  await wait(page, 150);
  const retour = await logins(page);
  ok('le classement mondial est servi immédiatement, sans attendre le réseau',
     retour.length === 30 && !retour.includes('cache1'), retour.join(','));

  // ── e) en mode suivi, le compteur reste un nombre de chaînes ──────────
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="followed"]').click());
  await wait(page, 600);
  const ddSuivi = await page.evaluate(() =>
    [...document.querySelectorAll('#tse-cat-dd .tse-dd-opt')]
      .filter(o => o.dataset.value)
      .map(o => o.querySelector('.tse-dd-n')?.textContent?.trim()));
  ok('le mode suivi retrouve ses décomptes de chaînes',
     ddSuivi.length === 1 && nz(ddSuivi[0]) === '1 |', JSON.stringify(ddSuivi));
  await page.close();
}


// ═════════════ 37. Voile — un seul cycle au chargement ═════════════
console.log('\n37. Voile — la sidebar ne doit s\'initialiser qu\'une fois');
{
  const cycles = (page) => page.evaluate(() => window.tse.global && window.tse
    ? (window.tse.cycles ? window.tse.cycles() : []) : []);

  // ── a) sidebar déjà présente : un seul cycle, nommé ────────────────────
  {
    const page = await fresh();
    await wait(page, 2000);
    const j = await page.evaluate(() => window.tse.cycles());
    const démarrages = j.filter(e => e.evt === 'cycle');
    ok('un seul cycle de voile au chargement', démarrages.length === 1,
       JSON.stringify(j));
    ok('et il s\'appelle « démarrage »', démarrages[0]?.detail === 'démarrage',
       JSON.stringify(démarrages));
    await page.close();
  }

  // ── b) sidebar montée APRÈS le démarrage, en mode réduit ───────────────
  {
    // Le cas qui casse : au démarrage de l'extension, #side-nav n'existe pas
    // encore, donc l'état « réduit » se lit comme « étendu » par défaut. Quand
    // la sidebar arrive RÉDUITE, la comparaison voit une bascule qui n'a
    // jamais eu lieu et déclenche voile + purge du cache + re-scan complet —
    // l'utilisateur voit la sidebar s'initialiser deux fois.
    const page = await browser.newPage();
    page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
    await page.addInitScript(() => { window.__lateMount = true; window.__lateCollapsed = true; });
    await page.goto(URL_PAGE);
    await wait(page, 2000);
    const j = await page.evaluate(() => window.tse.cycles());
    const bascules = j.filter(e => e.detail === 'bascule réduit/étendu');
    ok('la sidebar est bien arrivée après le démarrage, et réduite',
       await page.evaluate(() => !!document.querySelector('.side-nav--collapsed #side-nav')));
    ok('aucune fausse bascule réduit/étendu n\'est déclenchée',
       bascules.length === 0, JSON.stringify(j));
    await page.close();
  }

  // ── c) une VRAIE bascule, elle, déclenche bien un cycle ────────────────
  {
    // La garde ne doit pas rendre la détection aveugle : après la ligne de
    // base, un changement réel doit toujours provoquer la ré-initialisation.
    const page = await fresh();
    await wait(page, 1800);
    const avant = await page.evaluate(() =>
      window.tse.cycles().filter(e => e.evt === 'cycle').length);
    await page.evaluate(() => {
      document.getElementById('root').classList.add('side-nav--collapsed');
      // L'observateur ne surveille PAS les attributs : poser une classe ne
      // déclenche rien par soi-même. Twitch, lui, RECONSTRUIT ses cartes en
      // basculant — c'est cette mutation-là qui porte la détection, et le
      // test doit la reproduire au lieu de compter sur un remous voisin.
      const d = document.createElement('div');
      document.getElementById('cards').appendChild(d);
      d.remove();
    });
    await wait(page, 600);
    const j = await page.evaluate(() => window.tse.cycles());
    ok('une bascule réelle relance bien un cycle',
       j.filter(e => e.evt === 'cycle').length === avant + 1, JSON.stringify(j));
    ok('et elle est nommée pour ce qu\'elle est',
       j.some(e => e.detail === 'bascule réduit/étendu'), JSON.stringify(j));
    await page.close();
  }
}


// ═════════════ 38. Monde + langue — une descente, pas un filtre ═════════════
console.log('\n38. Monde + langue — descendre en langue, pas filtrer un pool');
{
  // Le décor rend les deux approches DISCERNABLES, et c'est tout son objet.
  // Chaque grosse catégorie contient 30 chaînes anglaises devant 10 françaises
  // plus petites : la récolte toutes langues, plafonnée à 30 par l'API, ne
  // ramène donc AUCUNE française. Filtrer ce pool ne peut rendre que les trois
  // françaises de « frcat », seule catégorie où elles tiennent dans le top 30.
  // Une descente menée EN LANGUE, elle, demande à chaque catégorie son sommet
  // français et en trouve trente.
  const decor38 = (page) => page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    window.__fx = { suivi1: { id: 'id-suivi1', createdAt: h, viewers: 400,
                              game: 'Just Chatting', tags: [] } };
    window.__addCard('suivi1', 'Just Chatting', '400');
    const cats = [];
    for (let i = 0; i < 9; i++) {
      const streams = [];
      for (let k = 0; k < 30; k++) {
        streams.push({ login: `en${i}_${k}`, viewers: 9000 - i * 100 - k, tags: ['English'] });
      }
      for (let k = 0; k < 10; k++) {
        streams.push({ login: `fr${i}_${k}`, viewers: 3000 - i * 100 - k * 10, tags: ['Français'] });
      }
      cats.push({ name: 'c' + i, viewers: 500_000 - i, streams });
    }
    // Seule catégorie dont le top 30 toutes langues contient du français :
    // c'est elle qui fait exister « Français » dans la liste des langues.
    cats.push({ name: 'frcat', viewers: 499_990, streams: [
      { login: 'vis1', viewers: 100, tags: ['Français'] },
      { login: 'vis2', viewers: 90,  tags: ['Français'] },
      { login: 'vis3', viewers: 80,  tags: ['Français'] },
    ] });
    window.__cats = cats;
  });
  const logins = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card[data-tse-global="true"]')]
      .map(c => c.dataset.tseLogin));
  const choisirLangue = (page, val) => page.evaluate((v) => {
    const opt = [...document.querySelectorAll('#tse-lang-dd .tse-dd-opt')]
      .find(o => (o.dataset.value || '') === v);
    if (!opt) throw new Error('langue absente : ' + JSON.stringify(v));
    opt.click();
  }, val);

  const page = await fresh();
  await decor38(page);
  await wait(page, 1500);
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
  await wait(page, 1800);

  // ── a) le classement toutes langues ────────────────────────────────────
  const monde = await logins(page);
  ok('le classement mondial sert 30 chaînes', monde.length === 30, String(monde.length));
  ok('et elles sont anglaises, les françaises étant hors des top 30',
     monde.every(l => l.startsWith('en')), monde.slice(0, 3).join(','));
  ok('le classement est annoncé complet',
     await page.evaluate(() => window.tse.global.report().complete) === true);

  // ── b) « Français » est proposable, grâce au pool TOUTES LANGUES ───────
  const opts = await page.evaluate(() =>
    [...document.querySelectorAll('#tse-lang-dd .tse-dd-opt')]
      .filter(o => o.dataset.value).map(o => o.dataset.value));
  ok('la langue est proposée bien qu\'absente du top 30',
     opts.includes('Français'), opts.join(','));

  // ── c) la descente en langue ───────────────────────────────────────────
  await choisirLangue(page, 'Français');
  await wait(page, 2000);
  const fr = await logins(page);
  ok('trente chaînes françaises, et non les trois du pool',
     fr.length === 30, String(fr.length));
  ok('toutes françaises', fr.every(l => /^(fr\d|vis)/.test(l)), fr.slice(0, 3).join(','));
  // LE point : ces chaînes n'existaient nulle part dans le pool toutes
  // langues. Un filtre, quel qu'il soit, ne pouvait pas les inventer.
  ok('dont des chaînes que le pool toutes langues ne contenait pas',
     fr.some(l => !monde.includes(l) && l.startsWith('fr')), fr.join(','));
  ok('classées par audience', await page.evaluate(() => {
    const v = [...document.querySelectorAll('.side-nav-card[data-tse-global="true"]')]
      .map(c => Number(c.dataset.tseViewers));
    return v.every((x, i) => !i || v[i - 1] >= x);
  }));
  ok('la plus grosse est bien la plus grosse française',
     fr[0] === 'fr0_0', fr[0]);

  // ── d) l'exactitude est REVENDIQUÉE, car l'API a filtré ───────────────
  const rep = await page.evaluate(() => window.tse.global.report());
  ok('l\'API est créditée du filtre', rep.langApplied === true, JSON.stringify(rep));
  ok('et le classement reste annoncé complet', rep.complete === true, JSON.stringify(rep));
  ok('aucun bandeau d\'approximation',
     await page.evaluate(() => !document.getElementById('tse-global-partial')));

  // ── d bis) une langue non demandable dégrade, elle ne vide pas ─────────
  // Le stub ne connaît que FR, EN et DE : « IT » lui arrache la même erreur
  // qu'un code absent du schéma de Twitch. La descente ne peut alors pas
  // aboutir — et le pire serait qu'elle soit réclamée quand même, laissant la
  // barre latérale vide en attendant un classement qui n'arrivera jamais.
  await choisirLangue(page, '');
  await wait(page, 1200);
  await page.evaluate(() => {
    // « Italiano » n'est pas dans le pool : on l'y injecte le temps du test,
    // via une catégorie supplémentaire visible dans le top 30.
    window.__cats.push({ name: 'itcat', viewers: 499_985, streams: [
      { login: 'it1', viewers: 70, tags: ['Italiano'] }] });
  });
  await wait(page, 2000);
  const dispo = await page.evaluate(() =>
    [...document.querySelectorAll('#tse-lang-dd .tse-dd-opt')].map(o => o.dataset.value));
  ok('la langue non demandable est bien proposée', dispo.includes('Italiano'),
     dispo.join(','));
  await choisirLangue(page, 'Italiano');
  await wait(page, 2500);
  const it = await logins(page);
  ok('la barre latérale n\'est PAS vide', it.length > 0, String(it.length));
  ok('elle sert le repli par tags', it.every(l => l.startsWith('it')), it.join(','));
  ok('et cesse de revendiquer l\'exactitude',
     await page.evaluate(() => window.tse.global.report().complete) === false);

  // ── e) revenir à « toutes les langues » est instantané ─────────────────
  await choisirLangue(page, '');
  ok('aucun voile au retour',
     await page.evaluate(() => !document.body.classList.contains('tse-loading')));
  await wait(page, 150);
  const retour = await logins(page);
  ok('le classement toutes langues est servi sans attendre le réseau',
     retour.length === 30 && retour.every(l => l.startsWith('en')), retour.slice(0, 3).join(','));
  await page.close();
}

// ═════════════ 39. Catégorie + langue — une requête dédiée ═════════════
console.log('\n39. Catégorie + langue — demander, pas filtrer');
{
  // MESURÉ sur quatre catégories réelles : `game(name:){ streams(options:
  // {broadcasterLanguages:[FR]}) }` rend LE SOMMET FRANÇAIS de la catégorie.
  // Aucune chaîne française du top 30 brut ne manque, et la requête en révèle
  // 23 à 29 de plus. Filtrer les trente cartes n'en laissait que sept.
  //
  // Le décor pousse le contraste à l'extrême : les 30 plus grosses chaînes de
  // la catégorie sont TOUTES anglaises. Filtrer l'affichage donnerait zéro
  // résultat ; demander à l'API en donne trente.
  const decor39 = (page) => page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    window.__fx = { suivi1: { id: 'id-suivi1', createdAt: h, viewers: 400,
                              game: 'Just Chatting', tags: [] } };
    window.__addCard('suivi1', 'Just Chatting', '400');
    const streams = [];
    for (let i = 0; i < 30; i++) streams.push({ login: 'en' + i, viewers: 9000 - i * 10, tags: ['English'] });
    for (let i = 0; i < 30; i++) streams.push({ login: 'fr' + i, viewers: 3000 - i * 10, tags: ['Français'] });
    window.__cats = [
      { name: 'grosse', viewers: 400_000, streams },
      // Une seconde catégorie porte du français : c'est elle qui fait
      // apparaître « Français » dans le pool mondial, donc dans la liste des
      // langues proposables. Sans elle, la langue qu'on veut demander à
      // « grosse » ne serait proposée nulle part.
      { name: 'autre',  viewers: 10_000, streams: [
        { login: 'x1', viewers: 500, tags: ['English'] },
        { login: 'x2', viewers: 400, tags: ['Français'] },
        // L'italien sert au test de repli : le stub ne connaît que FR, EN et
        // DE, donc « IT » lui arrache la même erreur qu'un code absent du
        // schéma de Twitch.
        { login: 'x3', viewers: 300, tags: ['Italiano'] },
      ] },
    ];
  });
  const logins = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card[data-tse-global="true"]')]
      .map(c => c.dataset.tseLogin));
  const choisir = (page, sel, val) => page.evaluate(([s, v]) => {
    const opt = [...document.querySelectorAll(s + ' .tse-dd-opt')]
      .find(o => (o.dataset.value || '') === v);
    if (!opt) throw new Error('option absente : ' + v);
    opt.click();
  }, [sel, val]);

  const page = await fresh();
  await decor39(page);
  await wait(page, 1500);
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
  await wait(page, 1200);
  await choisir(page, '#tse-cat-dd', 'grosse');
  await wait(page, 1200);

  const brut = await logins(page);
  ok('la catégorie sert ses 30 plus grosses chaînes',
     brut.length === 30 && brut.every(l => l.startsWith('en')), brut.slice(0, 3).join(','));
  ok('dont aucune française', !brut.some(l => l.startsWith('fr')));

  await choisir(page, '#tse-lang-dd', 'Français');
  await wait(page, 1200);
  const fr = await logins(page);
  ok('choisir la langue rend 30 chaînes, pas zéro', fr.length === 30, String(fr.length));
  ok('et elles sont toutes françaises',
     fr.every(l => l.startsWith('fr')), fr.slice(0, 3).join(','));
  ok('classées par audience', await page.evaluate(() => {
    const v = [...document.querySelectorAll('.side-nav-card[data-tse-global="true"]')]
      .map(c => Number(c.dataset.tseViewers));
    return v.every((x, i) => !i || v[i - 1] >= x);
  }));

  // La requête porte bien l'option, et sur la seule catégorie choisie.
  const req = await page.evaluate(() => window.__calls
    .filter(c => (c.names || []).includes('TseCategoryTop'))
    .slice(-3).map(c => ({ cats: c.cats, fr: /broadcasterLanguages/.test(c.q || '') })));
  ok('une requête de catégorie a bien été émise', req.length > 0, JSON.stringify(req));

  // C'est bien l'API qui a filtré : le classement reste annoncé EXACT, alors
  // qu'un filtre par pool sous langue renoncerait à la complétude.
  ok('l\'exactitude reste revendiquée, car l\'API a filtré elle-même',
     await page.evaluate(() => window.tse.global.report().langApplied) === true);

  await choisir(page, '#tse-lang-dd', '');
  await wait(page, 800);
  ok('retirer la langue rend les 30 plus grosses',
     (await logins(page)).every(l => l.startsWith('en')));

  // ── Repli : un code de langue refusé par le schéma ─────────────────────
  // Ma table LANG_API est écrite d'après l'ISO 639-1 ; si Twitch nommait une
  // langue autrement, la requête entière échouerait. Le module doit
  // l'apprendre UNE fois et retomber sur le filtre par tags, pas répéter
  // indéfiniment une requête vouée à l'échec.
  const avantIT = await page.evaluate(() => window.__calls.length);
  await choisir(page, '#tse-lang-dd', 'Italiano');
  await wait(page, 2000);
  const tentatives = await page.evaluate((k) => window.__calls.slice(k)
    .flatMap(c => c.langs || []).filter(l => l === 'IT').length, avantIT);
  ok('le code refusé n\'est tenté qu\'une seule fois', tentatives === 1,
     `${tentatives} tentative(s)`);
  ok('et la portée est bien re-demandée sans lui',
     await page.evaluate(() => window.tse.global.report().langApplied) === false);
  ok('le classement n\'est plus annoncé exact',
     await page.evaluate(() => window.tse.global.report().complete) === false);
  ok('rien n\'a planté : le module répond toujours',
     await page.evaluate(() => Array.isArray(window.tse.global.top(30))));

  await choisir(page, '#tse-lang-dd', '');
  await wait(page, 1000);
  ok('et l\'on retrouve la catégorie complète',
     (await logins(page)).length === 30);

  // ── Une COUPURE RÉSEAU ne vaut pas un rejet du serveur ─────────────────
  // Les deux se ressemblent — dans les deux cas la requête ne rend rien —
  // mais un rejet est un verdict sur la requête, une coupure n'apprend rien.
  // Les confondre condamnerait la langue pour toute la session sur un simple
  // hoquet réseau.
  await page.evaluate(() => { window.__failLang = 1; });
  const avantNet = await page.evaluate(() => window.__calls.length);
  await choisir(page, '#tse-lang-dd', 'Français');
  await wait(page, 3000);          // > GLOBAL_ERROR_COOLDOWN du harnais
  const essaisFR = await page.evaluate((k) => window.__calls.slice(k)
    .flatMap(c => c.langs || []).filter(l => l === 'FR').length, avantNet);
  ok('la langue est REDEMANDÉE après la coupure', essaisFR >= 2,
     `${essaisFR} tentative(s)`);
  const apresNet = await logins(page);
  ok('et le classement français finit par s\'afficher',
     apresNet.length === 30 && apresNet.every(l => l.startsWith('fr')),
     apresNet.slice(0, 3).join(','));
  ok('l\'API est bien créditée du filtre',
     await page.evaluate(() => window.tse.global.report().langApplied) === true);
  await page.close();
}

// ═════════════ 40. Top Chaînes — ni trou dans la liste, ni barre en travers ═════════════
console.log('\n40. Top Chaînes — ce qui est demandé s\'affiche, et rien ne déborde');
{
  // Deux défauts observés en mode « Top Chaînes », de même racine : le code
  // continuait de traiter le classement comme une liste de chaînes suivies —
  // à filtrer, et dont les cartes masquées seraient encore là.
  const page = await fresh();
  await page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    // Deux chaînes SUIVIES, en co-stream Guest Star avéré.
    window.__fx = {
      mastu:  { id: '63936838',  createdAt: h, viewers: 10616, game: 'Just Chatting', tags: [] },
      // Audience PROPRE choisie au-dessus du compteur combiné de mastu, tout
      // comme son propre combiné : quel que soit l'instant où la réponse Guest
      // Star arrive, hctuan se classe entre le dernier « fr » et les cartes
      // « mastu ». C'est ce qui rend l'adjacence — donc la mesure de la
      // jointure — reproductible d'une exécution à l'autre.
      hctuan: { id: '175560856', createdAt: h, viewers: 11900, game: 'Just Chatting', tags: [] },
    };
    const guests = [
      { id: '63936838',  login: 'mastu',  viewers: 10616, combined: 11736 },
      { id: '175560856', login: 'hctuan', viewers: 11900, combined: 11821 },
    ];
    window.__gs = {
      '63936838':  { hostId: '63936838', hostLogin: 'mastu', guests },
      '175560856': { hostId: '63936838', hostLogin: 'mastu', guests },
    };
    window.__addCard('mastu',  'Just Chatting', '11 k');
    window.__addCard('hctuan', 'Just Chatting', '11,9 k');

    // Le classement mondial. « fr* » DIFFUSE en français sans porter le tag
    // « Français » — c'est le cas courant, et exactement ce que Twitch sert
    // quand on demande broadcasterLanguages: [FR]. « tag1 » porte le tag :
    // c'est lui, et lui seul, qui fait exister « Français » dans la liste des
    // langues proposées (laquelle se lit sur le pool TOUTES LANGUES).
    const frs = [];
    for (let k = 0; k < 6; k++) {
      frs.push({ login: 'fr' + k, viewers: 30_000 - k * 1_000, lang: 'FR', tags: [] });
      // Ces chaînes RÉPONDENT aussi à TseChannels, qui fait autorité sur les
      // tags et rafraîchit toute carte affichée. Sans cette moitié du décor,
      // le tag posé par la descente survivrait indéfiniment et le défaut
      // resterait invisible.
      window.__fx['fr' + k] = { id: 'id-fr' + k, createdAt: h,
                                viewers: 30_000 - k * 1_000, game: 'g1', tags: [] };
    }
    window.__cats = [
      { name: 'g1', viewers: 90_000, streams: [
        { login: 'en1',  viewers: 50_000, tags: ['English'] },
        { login: 'tag1', viewers: 31_000, tags: ['Français'] },
        ...frs,
        // Une des deux chaînes suivies figure AUSSI au classement français :
        // le mode global lui fabrique alors une carte, tandis que la carte
        // native de Twitch reste là, masquée. Deux cartes pour une chaîne,
        // même clé de co-stream, l'une visible et l'autre non — la situation
        // qui produisait une barre de plusieurs centaines de pixels.
        { login: 'mastu', viewers: 11_000, lang: 'FR', tags: [] },
      ] },
    ];
  });
  await wait(page, 1500);
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
  await wait(page, 1800);
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('#tse-lang-dd .tse-dd-opt')]
      .find(o => (o.dataset.value || '') === 'Français');
    if (!opt) throw new Error('« Français » absent de la liste des langues');
    opt.click();
  });
  await wait(page, 2500);

  const etat = () => page.evaluate(() => [...document.querySelectorAll('.side-nav-card')].map(c => ({
    login:   c.dataset.tseLogin,
    global:  c.dataset.tseGlobal === 'true',
    affiche: getComputedStyle(c).display !== 'none',
    cle:     c.dataset.tseCostreamKey || null,
    barre:   c.classList.contains('tse-costream'),
    h:       c.getBoundingClientRect().height,
    jt:      c.style.getPropertyValue('--tse-costream-jt'),
    jb:      c.style.getPropertyValue('--tse-costream-jb'),
  })));

  // ── a) une carte sans boîte n'est pas un membre de co-stream ───────────
  // L'invariant est énoncé sur le style CALCULÉ : c'est la seule façon de
  // vérifier que notre prédicat interne dit bien la même chose que la règle
  // CSS de classe qu'il recopie.
  const g0 = await etat();
  ok('le classement est bien à l\'écran au moment de la mesure',
     g0.filter(c => c.global && c.affiche).length >= 7,
     JSON.stringify(g0.map(c => [c.login, c.affiche])));
  const fantomes = g0.filter(c => !c.affiche && (c.cle || c.barre));
  ok('aucune carte masquée ne porte de marque de co-stream',
     fantomes.length === 0, JSON.stringify(fantomes));
  ok('et toute carte colorée est bien à l\'écran',
     g0.filter(c => c.cle).every(c => c.affiche),
     JSON.stringify(g0.filter(c => c.cle)));
  // Un seul membre visible ⇒ aucun groupe : colorer une carte isolée
  // annoncerait un co-stream dont on ne montre pas l'autre moitié.
  ok('la carte globale du co-streamer n\'est pas colorée toute seule',
     g0.filter(c => c.login === 'mastu' && c.affiche).every(c => !c.barre),
     JSON.stringify(g0.filter(c => c.login === 'mastu')));

  // ── b) aucune barre ne déborde de sa carte ─────────────────────────────
  // L'extension d'une barre vaut la moitié de l'interstice entre deux cartes
  // voisines : quelques pixels. Mesurée contre un rectangle nul — celui d'une
  // carte masquée par une classe — elle valait la moitié de la page, soit un
  // trait vertical en travers de tout le classement.
  const debords = [];
  for (const c of g0) {
    for (const [nom, v] of [['jt', c.jt], ['jb', c.jb]]) {
      if (!v) continue;
      const px = Math.abs(parseFloat(v));
      if (px > Math.max(c.h, 1)) debords.push({ login: c.login, nom, px, h: c.h });
    }
  }
  ok('aucune barre ne s\'étend au-delà de la hauteur d\'une carte',
     debords.length === 0, JSON.stringify(debords));

  // ── c) le classement demandé s'affiche EN ENTIER ───────────────────────
  // La langue a été appliquée par l'API. La descente pose le tag canonique sur
  // ses enregistrements, mais TseChannels fait autorité sur les tags et le
  // remplace par les freeformTags réels — ici, aucun. En régime nominal la
  // marche réécrit l'entrée juste avant qu'elle ne périme (LIVE_TTL et
  // GLOBAL_STRUCT_TICK valent tous deux 30 s) : la fenêtre existe, mais elle
  // est étroite et l'attendre rendrait le test capricieux. On la force donc
  // en coupant les marches — l'entrée cesse d'être rafraîchie, périme, et
  // TseChannels reprend la main. C'est le même état, atteint à coup sûr.
  await page.evaluate(() => { window.__globalFail = true; });
  // Le témoin est la RÉPONSE elle-même : dès que TseChannels a parlé de ces
  // chaînes, le cache partagé porte leurs tags réels — aucun — et c'est cet
  // état-là que le filtre de langue voyait.
  let ecrase = false;
  for (let i = 0; i < 60 && !ecrase; i++) {
    ecrase = await page.evaluate(() => {
      const dits = new Set(window.__calls.flatMap(c => c.ops || []));
      return [0, 1, 2, 3, 4, 5].every(k => dits.has('fr' + k));
    });
    if (!ecrase) await wait(page, 200);
  }
  ok('TseChannels a répondu sur les chaînes du classement, sans tag de langue',
     ecrase);

  const g = await etat();
  const vus = g.filter(c => c.affiche).map(c => c.login);
  const attendus = ['tag1', 'fr0', 'fr1', 'fr2', 'fr3', 'fr4', 'fr5', 'mastu'];
  ok('le classement français reste affiché en entier',
     attendus.every(l => vus.includes(l)),
     `manquantes : ${attendus.filter(l => !vus.includes(l)).join(',') || '—'} / vues : ${vus.join(',')}`);
  ok('et aucune chaîne anglaise ne s\'y est glissée', !vus.includes('en1'), vus.join(','));
  ok('les cartes suivies, elles, restent effacées',
     g.filter(c => !c.global && c.affiche).length === 0,
     JSON.stringify(g.filter(c => !c.global && c.affiche)));

  // ── d) le retour en mode suivi rend le co-stream intact ────────────────
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="followed"]').click());
  await wait(page, 1200);
  const f = await etat();
  const parLogin = Object.fromEntries(f.filter(c => !c.global).map(c => [c.login, c]));
  ok('les deux co-streamers sont de nouveau regroupés',
     !!parLogin.mastu?.cle && parLogin.mastu.cle === parLogin.hctuan?.cle,
     JSON.stringify([parLogin.mastu, parLogin.hctuan]));
  ok('et bien colorés', parLogin.mastu?.barre === true && parLogin.hctuan?.barre === true,
     JSON.stringify([parLogin.mastu, parLogin.hctuan]));
  ok('la jointure est de quelques pixels, pas de quelques centaines',
     Math.abs(parseFloat(parLogin.mastu.jb || parLogin.mastu.jt || '0')) <= parLogin.mastu.h,
     JSON.stringify(parLogin.mastu));
  await page.close();
}

// ═════════ 41. Le classement n'écrit pas dans le cache des chaînes suivies ═════════
console.log('\n41. Cache — le mode global ne doit rien laisser derrière lui');
{
  // « mastu » est SUIVI et figure AUSSI au classement français. Deux
  // conséquences à vérifier, l'une visuelle et l'autre invisible :
  //   • une seule carte doit le servir — celle de Twitch, empruntée, et non
  //     une contrefaçon posée à côté d'une carte native masquée ;
  //   • la descente en langue pose le tag « Français » sur SON enregistrement
  //     (l'API vient d'affirmer la langue de diffusion), alors que TseChannels
  //     ne lui connaît aucun tag. Ce tag ne doit pas survivre au mode : sinon
  //     la chaîne repart rangée sous un filtre de langue qu'elle n'a jamais
  //     porté, dans une liste qui n'a rien demandé au classement.
  const page = await fresh();
  await page.evaluate(() => {
    const h = new Date(Date.now() - 30 * 60_000).toISOString();
    window.__fx = {
      mastu: { id: 'id-mastu', createdAt: h, viewers: 12000, game: 'Just Chatting', tags: [] },
      zeta:  { id: 'id-zeta',  createdAt: h, viewers: 300,   game: 'Just Chatting', tags: ['English'] },
    };
    window.__addCard('mastu', 'Just Chatting', '12 k');
    window.__addCard('zeta',  'Just Chatting', '300');
    window.__cats = [{ name: 'g1', viewers: 90_000, streams: [
      { login: 'tag1',  viewers: 31_000, tags: ['Français'] },   // fait exister « Français »
      { login: 'mastu', viewers: 12_000, lang: 'FR', tags: [] }, // diffuse en FR, sans le tag
    ] }];
  });
  await wait(page, 1500);

  // ── a) en mode suivi, la langue proposée est celle des tags réels ───────
  const avant = await page.evaluate(() => ({
    langs: [...document.querySelectorAll('.side-nav-card')]
      .filter(c => c.dataset.tseLogin === 'mastu').map(c => c.dataset.tseLangs),
    options: [...document.querySelectorAll('#tse-lang-dd .tse-dd-opt')].map(o => o.dataset.value),
  }));
  ok('au départ, la chaîne suivie ne porte aucune langue',
     avant.langs.every(l => l === ''), JSON.stringify(avant));
  ok('et « Français » n\'est pas proposé dans la liste suivie',
     !avant.options.includes('Français'), avant.options.join(','));

  // ── b) une seule carte par chaîne dans le classement ───────────────────
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
  await wait(page, 1800);
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('#tse-lang-dd .tse-dd-opt')]
      .find(o => (o.dataset.value || '') === 'Français');
    if (!opt) throw new Error('« Français » absent de la liste des langues');
    opt.click();
  });
  await wait(page, 2500);
  const cartes = await page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')]
      .filter(c => c.dataset.tseLogin === 'mastu')
      .map(c => ({ synthetique: c.dataset.tseSynthetic === 'true',
                   global: c.dataset.tseGlobal === 'true',
                   affiche: getComputedStyle(c).display !== 'none' })));
  ok('une seule carte sert la chaîne, pas deux', cartes.length === 1, JSON.stringify(cartes));
  ok('et c\'est celle de Twitch, empruntée plutôt que contrefaite',
     cartes[0]?.synthetique === false && cartes[0]?.global === true && cartes[0]?.affiche === true,
     JSON.stringify(cartes));

  // ── c) rien de tout cela ne doit rester en sortant ──────────────────────
  // On coupe TseChannels — et lui seul — avant de sortir, puis on attend une
  // marche complète de plus. L'horodatage du cache partagé est alors figé
  // pendant que celui du classement avance : c'est la condition exacte dans
  // laquelle une amorce écrite dans ce cache prend le dessus sur la réponse
  // de Twitch, et elle ne survient autrement qu'au hasard d'une course.
  // La coupure sert aussi après la bascule : plus rien ne peut effacer la
  // trace, donc ce que porte le cache est exactement ce que le mode global y
  // a laissé.
  const marches = () => page.evaluate(() => window.tse.global.report().walks);
  const avantMarche = await marches();
  await page.evaluate(() => { window.__failChannels = true; });
  for (let i = 0; i < 60 && (await marches()) <= avantMarche; i++) await wait(page, 200);
  ok('une marche a bien eu lieu pendant que TseChannels était coupé',
     (await marches()) > avantMarche, `${avantMarche} → ${await marches()}`);
  await page.evaluate(() =>
    document.querySelector('#tse-mode-row [data-tse-mode="followed"]').click());
  await wait(page, 1500);
  const apres = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('.side-nav-card')]
      .filter(c => c.dataset.tseLogin === 'mastu');
    return {
      n: cs.length,
      synthetique: cs.map(c => c.dataset.tseSynthetic === 'true'),
      marque: cs.map(c => c.dataset.tseGlobal ?? null),
      affiche: cs.map(c => getComputedStyle(c).display !== 'none'),
      langs: cs.map(c => c.dataset.tseLangs),
      options: [...document.querySelectorAll('#tse-lang-dd .tse-dd-opt')].map(o => o.dataset.value),
    };
  });
  ok('la carte native est rendue, pas supprimée',
     apres.n === 1 && apres.synthetique[0] === false && apres.affiche[0] === true,
     JSON.stringify(apres));
  ok('elle ne porte plus la marque du classement',
     apres.marque[0] === null, JSON.stringify(apres));
  // LE point : le tag posé par la descente ne doit pas avoir déteint.
  ok('la chaîne suivie ne repart pas avec un tag posé par la descente',
     !(apres.langs[0] || '').includes('Français'), JSON.stringify(apres));
  ok('et la liste suivie ne propose toujours pas « Français »',
     !apres.options.includes('Français'), apres.options.join(','));
  await page.close();
}

// ═════════ 42. Abonnements — lus sur la page, jamais demandés ═════════
console.log('\n42. Abonnements — le tri « mes abos en tête », sans une requête');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  // Ce scénario éprouve la lecture PAR VISITE. Le relevé complet, testé
  // au scénario 43, verserait ses propres chaînes et fausserait les comptes.
  const SANS_PAGE = () => { window.__noSubsPage = true; };
  const decor = (page) => page.evaluate(() => {
    const h = (m) => new Date(Date.now() - m * 60_000).toISOString();
    window.__fx = {
      gros:      { id:'1', createdAt:h(120), viewers:9000, game:'Just Chatting', tags:[] },
      moyen:     { id:'2', createdAt:h(90),  viewers:4000, game:'Just Chatting', tags:[] },
      omofficial:{ id:'3', createdAt:h(30),  viewers:120,  game:'Just Chatting', tags:[] },
    };
    window.__addCard('gros',       'Just Chatting', '9 k');
    window.__addCard('moyen',      'Just Chatting', '4 k');
    window.__addCard('omofficial', 'Just Chatting', '120');
  });
  const boutons = (page) => page.evaluate(() =>
    [...document.querySelectorAll('#tse-sort-row button[data-tse-sort-mode]')]
      .map(b => ({ mode: b.dataset.tseSortMode, off: b.disabled, titre: b.title })));
  const ordre = (page) => page.evaluate(() =>
    [...document.querySelectorAll('#side-nav .side-nav-card')].map(c => c.dataset.tseLogin));

  // ── a) rien de connu : le bouton est là, à sa place, et il est grisé ────
  {
    const page = await freshTwitch(PLAYER, [], '/', SANS_PAGE);
    await decor(page);
    await wait(page, 1800);
    const b = await boutons(page);
    ok('six modes de tri, dans l\'ordre attendu',
       b.map(x => x.mode).join(',') === 'viewers,subs,popular,uptime,alpha,costream',
       b.map(x => x.mode).join(','));
    const sub = b.find(x => x.mode === 'subs');
    // Sans une seule chaîne repérée, le tri ne trierait rien : il doit se
    // griser et DIRE pourquoi, plutôt que d'offrir un bouton inerte.
    ok('grisé tant qu\'aucun abonnement n\'est repéré', sub?.off === true, JSON.stringify(sub));
    ok('et le survol explique pourquoi',
       /abonnement/i.test(sub?.titre || ''), sub?.titre);
    await page.close();
  }

  // ── b) sur la page d'une chaîne abonnée, l'extension le relève ──────────
  {
    const page = await freshTwitch(PLAYER, [], '/omofficial', SANS_PAGE);
    await decor(page);
    // Le marqueur MESURÉ sur Twitch : abonné → data-a-target="manage-sub-button".
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.setAttribute('data-a-target', 'manage-sub-button');
      b.textContent = 'Gérer';
      document.body.appendChild(b);
    });
    const avant = await page.evaluate(() => window.__calls.length);
    await wait(page, 1500);
    const memoire = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('tse:subs') || 'null'); }
      catch { return 'illisible'; }
    });
    ok('l\'abonnement est mémorisé', !!memoire?.omofficial, JSON.stringify(memoire));
    ok('avec l\'état « abonné »', memoire?.omofficial?.[0] === 1, JSON.stringify(memoire));

    // LE point qui justifie toute cette voie : aucune requête n'a été émise
    // pour l'obtenir. Le statut a été LU sur la page, pas demandé au réseau.
    const requetes = await page.evaluate((k) => window.__calls.slice(k)
      .flatMap(c => c.names || []), avant);
    ok('aucune requête n\'a servi à l\'apprendre',
       !requetes.some(n => /sub/i.test(n)), JSON.stringify([...new Set(requetes)]));

    // ── c) le tri met l'abonné en tête, malgré ses 120 spectateurs ────────
    const b = await boutons(page);
    ok('le bouton s\'active une fois un abonnement connu',
       b.find(x => x.mode === 'subs')?.off === false, JSON.stringify(b));
    ok('avant le tri, l\'abonné est bon dernier',
       (await ordre(page)).at(-1) === 'omofficial', (await ordre(page)).join(','));
    await page.evaluate(() =>
      document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]').click());
    await wait(page, 900);
    const apres = await ordre(page);
    ok('après le tri, il passe en tête', apres[0] === 'omofficial', apres.join(','));
    ok('et les autres gardent l\'ordre par spectateurs',
       apres.slice(1).join(',') === 'gros,moyen', apres.join(','));

    // ── d) une visite ultérieure corrige un désabonnement ─────────────────
    // C'est ce qui rend la mémoire honnête : on mémorise aussi le NON.
    await page.evaluate(() => {
      document.querySelector('[data-a-target="manage-sub-button"]').remove();
      const b = document.createElement('button');
      b.setAttribute('data-a-target', 'subscribe-button');
      document.body.appendChild(b);
    });
    await wait(page, 1200);
    const apresDesabo = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tse:subs') || 'null'));
    ok('le désabonnement est enregistré à la visite suivante',
       apresDesabo?.omofficial?.[0] === 0, JSON.stringify(apresDesabo));
    await page.close();
  }

  // ── f) la pastille de comptage ─────────────────────────────────────────
  {
    const pastille = (page) => page.evaluate(() => {
      const el = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"] .tse-sort-count');
      return el ? el.textContent : null;
    });
    const page = await freshTwitch(PLAYER, [], '/omofficial', SANS_PAGE);
    await decor(page);
    await wait(page, 1500);
    ok('aucune pastille tant qu\'aucun abonnement n\'est connu',
       (await pastille(page)) === null, String(await pastille(page)));

    await page.evaluate(() => {
      const b = document.createElement('button');
      b.setAttribute('data-a-target', 'manage-sub-button');
      document.body.appendChild(b);
    });
    await wait(page, 1200);
    ok('elle affiche 1 dès le premier abonnement repéré',
       (await pastille(page)) === '1', String(await pastille(page)));

    // Deux abonnements de plus, injectés dans la mémoire : on teste le
    // COMPTAGE, pas une seconde fois la détection. « moyen » a une carte dans
    // la sidebar, « autrechaine » n'en a pas — et la pastille les compte tous
    // les deux, parce qu'elle dit à combien de chaînes on est abonné, pas
    // combien émettent.
    await page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem('tse:subs'));
      m.moyen = [1, Date.now()];
      m.autrechaine = [1, Date.now()];
      localStorage.setItem('tse:subs', JSON.stringify(m));
    });
    await page.reload();
    await decor(page);
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.setAttribute('data-a-target', 'manage-sub-button');
      document.body.appendChild(b);
    });
    await wait(page, 1800);
    ok('et 3 quand trois abonnements sont connus, à l\'antenne ou non',
       (await pastille(page)) === '3', String(await pastille(page)));

    // La pastille ne doit pas entretenir de boucle de scan : son texte n'est
    // réécrit que s'il change. On vérifie que le nombre de scans se calme.
    const compte = () => page.evaluate(() => window.__calls.length);
    const a1 = await compte();
    await wait(page, 1500);
    const a2 = await compte();
    ok('elle n\'entretient pas de boucle de re-scan', a2 - a1 <= 4,
       `${a2 - a1} requête(s) en 1,5 s`);
    await page.close();
  }

  // ── e) hors d'une page de chaîne, on n'invente rien ─────────────────────
  {
    const page = await freshTwitch(PLAYER, [], '/directory', SANS_PAGE);
    await decor(page);
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.setAttribute('data-a-target', 'manage-sub-button');
      document.body.appendChild(b);
    });
    await wait(page, 1400);
    const memoire = await page.evaluate(() =>
      localStorage.getItem('tse:subs'));
    // « directory » est un chemin RÉSERVÉ : ce n'est pas une chaîne, et
    // enregistrer « abonné à directory » polluerait la mémoire pour toujours.
    ok('un chemin réservé n\'est jamais pris pour une chaîne',
       memoire === null || !JSON.parse(memoire).directory, String(memoire));
    await page.close();
  }
}

// ═════ 43. Relevé complet des abonnements via /subscriptions ═════
console.log('\n43. Abonnements — la liste complète, lue dans une iframe');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const memoire = (page) => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('tse:subs') || 'null'); }
    catch { return null; }
  });

  const page = await freshTwitch(PLAYER, [], '/');
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { omofficial: { id:'1', createdAt:h, viewers:500, game:'G', tags:[] } };
    window.__addCard('omofficial', 'G', '500');
  });
  // Le relevé part PENDANT le chargement, et non après un délai : à 250 ms
  // l'iframe est déjà en place, alors que la page de test ne rendra ses
  // cartes qu'à 600 ms. Rien n'est donc encore mémorisé, mais le travail,
  // lui, a commencé.
  await wait(page, 250);
  const enCours = await page.evaluate(() => [...document.querySelectorAll('iframe')]
    .filter(f => (f.src || '').includes('/subscriptions')).length);
  ok('le relevé est en cours dès le chargement de la sidebar', enCours === 1, String(enCours));
  ok('et rien n\'est encore mémorisé', (await memoire(page)) === null,
     JSON.stringify(await memoire(page)));

  await attendre(page, () => !!localStorage.getItem('tse:substs'));
  const m = await memoire(page);
  const trouves = Object.keys(m || {}).sort();
  // Les trois onglets configurés : trois cartes en « paid », une en « gifts »,
  // une en « mobile ». La page de test en sert deux autres — « turbo » et
  // « expired » — qui ne doivent PAS remonter : un abonnement expiré n'en est
  // plus un, et le relevé étant additif, le lire marquerait « abonné » pour
  // 120 jours quelqu'un qu'on ne l'est plus.
  const abonnes = Object.entries(m || {}).filter(([, v]) => v[0] === 1).map(([k]) => k).sort();
  ok('les cinq abonnements des trois onglets sont relevés',
     abonnes.join(',') === 'clem_mlrt,etoiles,omofficial,roicheese,zerator', JSON.stringify(abonnes));
  ok('Turbo n\'est pas lu', !trouves.includes('jamais_turbo'), JSON.stringify(trouves));
  // Les EXPIRÉS entrent en mémoire — c'est ce qui nourrit « anciennement
  // abonné » — mais jamais comme des abonnements en cours.
  ok('les expirés sont mémorisés sans être comptés pour abonnés',
     trouves.includes('jenfirer') && !abonnes.includes('jenfirer'), JSON.stringify(trouves));
  ok('et tous marqués « abonné »',
     abonnes.length === 5, JSON.stringify(m));

  // L'iframe est un moyen, pas une trace : elle ne doit rien laisser derrière.
  ok('aucune iframe ne reste accrochée à la page',
     await page.evaluate(() => document.querySelectorAll('iframe').length) === 0,
     String(await page.evaluate(() => document.querySelectorAll('iframe').length)));

  // La pastille suit : quatre abonnements connus, quatre sur le bouton.
  const pastille = () => page.evaluate(() => {
    const el = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"] .tse-sort-count');
    return el ? el.textContent : null;
  });
  // La pastille compte le TOTAL des abonnements connus, pas ceux qui émettent :
  // c'est un fait sur le compte, pas sur l'antenne. Cinq relevés, cinq
  // affichés, alors qu'une seule de ces chaînes a une carte dans la sidebar.
  // Les onglets rentrant l'un après l'autre depuis la 3.50, la pastille EXISTE
  // dès le premier — avec un compte partiel. On attend donc qu'elle se pose,
  // pas qu'elle apparaisse. L'attente est bornée : une pastille qui n'atteint
  // jamais la bonne valeur fait échouer l'assertion, simplement plus tard.
  await attendre(page, () => {
    const el = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"] .tse-sort-count');
    return el && el.textContent === '5';
  });
  ok('la pastille affiche le total des abonnements connus',
     (await pastille()) === '5', String(await pastille()));

  // Le relevé est horodaté : dans le TTL, il ne doit pas recommencer.
  const stamp = await page.evaluate(() => localStorage.getItem('tse:substs'));
  // L'horodatage porte le NUMÉRO DU LECTEUR qui l'a produit : « 2:<date> ».
  // C'est ce qui permet à une correction du relevé de périmer d'office les
  // relevés des versions antérieures, au lieu d'attendre six heures.
  ok('le relevé est horodaté, avec son numéro de lecteur',
     /^2:\d+$/.test(stamp || ''), String(stamp));
  const avant = await page.evaluate(() => window.__calls.length);
  await wait(page, 1500);
  ok('et ne recommence pas dans le délai',
     (await page.evaluate(() => localStorage.getItem('tse:substs'))) === stamp,
     'horodatage modifié');
  void avant;

  // Forcer le relevé doit, lui, repasser outre le délai.
  const forcees = await page.evaluate(() => window.tse.subs.refresh());
  ok('tse.subs.refresh() force un nouveau relevé',
     Array.isArray(forcees) && forcees.length === 5, JSON.stringify(forcees));
  await page.close();
}

console.log('\n44. Abonnements — le relevé part avec la sidebar, pas avec un minuteur');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const cadres = (page) => page.evaluate(() => [...document.querySelectorAll('iframe')]
    .filter(f => (f.src || '').includes('/subscriptions')).length);
  const stamp = (page) => page.evaluate(() => localStorage.getItem('tse:substs'));

  // ── a) Sidebar sans chaîne suivie : le relevé ne part JAMAIS. ──────────
  // C'est la garde « session déconnectée » : personne n'a de chaînes suivies
  // sans compte, donc la page authentifiée n'est jamais demandée. Une carte
  // de RECOMMANDATION ne compte pas — elle ne porte pas le marqueur « suivi ».
  {
    const page = await freshTwitch(PLAYER, [], '/');
    await page.evaluate(() => {
      const h = new Date(Date.now() - 60 * 60_000).toISOString();
      window.__fx = { reco1: { id: '9', createdAt: h, viewers: 20, game: 'G', tags: [] } };
      window.__addReco('reco1', 'G', '20');
    });
    await wait(page, 1500);
    ok('sans chaîne suivie, aucune iframe n\'est ouverte', (await cadres(page)) === 0,
       String(await cadres(page)));
    ok('et aucun relevé n\'est horodaté', (await stamp(page)) === null,
       String(await stamp(page)));

    // La première carte SUIVIE, elle, déclenche le relevé. Le même document,
    // le même instant : seule la nature de la carte a changé.
    await page.evaluate(() => {
      const h = new Date(Date.now() - 60 * 60_000).toISOString();
      window.__fx.omofficial = { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] };
      window.__addCard('omofficial', 'G', '500');
    });
    await wait(page, 300);
    ok('la première carte suivie déclenche le relevé', (await cadres(page)) === 1,
       String(await cadres(page)));
    await attendre(page, () => !!localStorage.getItem('tse:substs'));
    const su = await page.evaluate(() => Object.keys(
      JSON.parse(localStorage.getItem('tse:subs') || '{}')).sort().join(','));
    ok('et il aboutit',
       su === 'antoinedaniel,clem_mlrt,etoiles,jenfirer,omofficial,roicheese,zerator', su);
    await page.close();
  }

  // ── b) Premier démarrage : le voile ATTEND le relevé. ──────────────────
  // Page d'abonnements ralentie à 500 ms par onglet (≈ 1,1 s pour les deux).
  // Sans retenue, le voile se lèverait dès la sidebar stable, ~350 ms après
  // le premier scan. À 700 ms, il doit donc être encore là.
  const LENT = () => { window.__subsDelay = 500; };
  {
    const page = await freshTwitch(PLAYER, [], '/', LENT);
    await page.evaluate(() => {
      const h = new Date(Date.now() - 60 * 60_000).toISOString();
      window.__fx = { omofficial: { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] } };
      window.__addCard('omofficial', 'G', '500');
    });
    // Sans retenue, le voile se lève dès la sidebar stable, ~350 ms après le
    // premier scan. Avec, il va jusqu'à son délai dur (1,2 s dans le harnais).
    // On mesure QUAND il s'est levé, pas s'il l'était à un instant choisi :
    // l'assertion ne dépend plus de la vitesse de la machine.
    // Le verrou est POSÉ — constaté, pas déduit. Il l'est au premier scan qui
    // voit une carte suivie, donc on l'attend au lieu de le lire à l'aveugle.
    let pose = [];
    for (let i = 0; i < 60; i++) {
      pose = await page.evaluate(() => window.tse.verrous());
      if (pose.includes('subs')) break;
      await wait(page, 40);
    }
    ok('rien en mémoire : le voile retient', pose.includes('subs'), JSON.stringify(pose));
    await attendre(page, () => window.__voileLeve !== null, 8000);
    const leve = await page.evaluate(() => window.__voileLeve);
    ok('et il attend le relevé', leve !== null && leve > 900,
       `voile levé après ${leve} ms`);
    // Et le délai dur reste souverain : la retenue ne peut pas l'éterniser
    // (1,2 s dans le harnais, 15 s en production).
    ok('mais le délai dur du voile reste souverain', leve !== null && leve < 4000,
       `voile levé après ${leve} ms`);
    await page.close();
  }

  // ── c) Démarrage suivant : rien à attendre. ────────────────────────────
  // Un abonnement est déjà connu du disque, donc la décoration est posée dès
  // la première carte. Faire patienter la sidebar pour un simple
  // rafraîchissement serait une rançon sans contrepartie — même page lente,
  // et cette fois le voile se lève à l'heure.
  {
    const TIEDE = () => {
      try {
        localStorage.setItem('tse:subs',
          JSON.stringify({ omofficial: [1, Date.now()] }));
        // Un démarrage TIÈDE, c'est un relevé qui a DÉJÀ abouti : son
        // horodatage est là, au format du lecteur courant. C'est lui, et non
        // la présence d'abonnements, qui dit qu'il n'y a rien à attendre.
        // Daté d'il y a 10 s, donc hors du TTL du harnais (4 s) : un
        // rafraîchissement de routine part quand même — et ne doit rien
        // retenir, puisque ce qu'il rafraîchit est déjà à l'écran.
        localStorage.setItem('tse:substs', '2:' + (Date.now() - 10_000));
      } catch { /* stockage refusé : le test échouera, et c'est correct */ }
    };
    const page = await freshTwitch(PLAYER, [], '/', TIEDE);
    await page.evaluate(() => {
      const h = new Date(Date.now() - 60 * 60_000).toISOString();
      window.__fx = { omofficial: { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] } };
      window.__addCard('omofficial', 'G', '500');
    });
    // On observe le VERROU, pas l'instant où le voile se lève. Le relevé fait
    // démarrer plusieurs pages en arrière-plan ; sous cette charge, le voile
    // peut atteindre son délai dur pour des raisons qui n'ont rien à voir avec
    // une retenue. Mesurer la décision plutôt que son effet rend l'assertion
    // indépendante de la machine — et c'est bien la décision qu'on a changée.
    let poses = null;
    for (let i = 0; i < 40; i++) {
      poses = await page.evaluate(() => window.tse.verrous());
      if (await page.evaluate(() => [...document.querySelectorAll('iframe')]
        .some(f => (f.src || '').includes('/subscriptions')))) break;
      await wait(page, 50);
    }
    ok('un abonnement déjà connu : le voile ne retient rien',
       Array.isArray(poses) && !poses.includes('subs'), JSON.stringify(poses));
    // Le rafraîchissement de routine, lui, part quand même — simplement sans
    // rien retenir. Les onglets partant ENSEMBLE depuis la 3.49, plusieurs
    // iframes coexistent, là où il n'y en avait qu'une à la fois.
    await attendre(page, () => [...document.querySelectorAll('iframe')]
      .some(f => (f.src || '').includes('/subscriptions')), 8000);
    ok('et le rafraîchissement de routine tourne quand même en arrière-plan',
       (await cadres(page)) >= 1, String(await cadres(page)));
    await page.close();
  }
}

console.log('\n45. Abonnements — le tri se grise quand aucun abonné n\'émet');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  // Relevé complet coupé : ce scénario décide de la DISPONIBILITÉ du tri à
  // partir de ce qui est en mémoire, et la page /subscriptions y verserait
  // ses propres chaînes.
  const SANS_PAGE = () => { window.__noSubsPage = true; };
  // Deux abonnements connus dès le départ, dont un seul aura une carte.
  const MEMOIRE = () => {
    window.__noSubsPage = true;
    try {
      localStorage.setItem('tse:subs', JSON.stringify({
        omofficial: [1, Date.now()],
        absente:    [1, Date.now()],
      }));
    } catch { /* stockage refusé : le test échouera, et c'est correct */ }
  };
  const bouton = (page) => page.evaluate(() => {
    const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]');
    const p = b && b.querySelector('.tse-sort-count');
    return b ? { off: b.disabled, titre: b.title, pastille: p ? p.textContent : null } : null;
  });

  // ── a) des abonnements connus, mais aucun à l'antenne ──────────────────
  {
    const page = await freshTwitch(PLAYER, [], '/', MEMOIRE);
    await page.evaluate(() => {
      const h = new Date(Date.now() - 60 * 60_000).toISOString();
      window.__fx = { autre: { id: '9', createdAt: h, viewers: 300, game: 'G', tags: [] } };
      window.__addCard('autre', 'G', '300');
    });
    await wait(page, 1800);
    const b = await bouton(page);
    ok('deux abonnements connus, aucun en direct : le bouton est grisé',
       b?.off === true, JSON.stringify(b));
    // L'explication doit être la BONNE des deux : inviter à ouvrir une chaîne
    // quelqu'un dont le relevé est déjà fait serait un contresens.
    ok('et l\'explication parle du direct, pas du relevé',
       /direct/i.test(b?.titre || ''), b?.titre);
    // ET POURTANT la pastille reste, avec le total : le grisé dit « rien à
    // trier maintenant », la pastille dit « vous avez deux abonnements ». Les
    // effacer ensemble perdrait la seconde information avec la première.
    ok('mais la pastille reste, et donne le total', b?.pastille === '2', JSON.stringify(b));

    // La chaîne abonnée entre en direct : le bouton s'ouvre, sans rien d'autre
    // qu'une carte de plus. C'est ce qui donne des dents aux trois assertions
    // précédentes — le grisé vient bien de l'antenne, pas de la mémoire.
    await page.evaluate(() => {
      const h = new Date(Date.now() - 60 * 60_000).toISOString();
      window.__fx.omofficial = { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] };
      window.__addCard('omofficial', 'G', '500');
    });
    await wait(page, 1200);
    const c = await bouton(page);
    ok('un abonné passe en direct : le bouton s\'ouvre', c?.off === false, JSON.stringify(c));
    ok('et la pastille affiche toujours le total', c?.pastille === '2', JSON.stringify(c));

    // Puis il s'éteint. Twitch garde la carte quelques minutes ; l'extension,
    // elle, l'a déjà marquée hors ligne — et le tri redevient sans objet.
    await page.evaluate(() => {
      window.__fx.omofficial = null;
      const c2 = [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'omofficial');
      c2.querySelector('.side-nav-card__avatar').classList.add('side-nav-card__avatar--offline');
    });
    await wait(page, 1500);
    const d = await bouton(page);
    ok('il s\'éteint : le bouton se regrise', d?.off === true, JSON.stringify(d));
    ok('sans que la pastille bouge', d?.pastille === '2', JSON.stringify(d));
    // La pastille doit être LISIBLE sur un bouton grisé, pas seulement
    // présente : l'opacité du grisé porte sur l'icône, pas sur le groupe — une
    // opacité posée sur le bouton emporterait la pastille avec elle.
    const opacites = await page.evaluate(() => {
      const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]');
      return {
        bouton:   getComputedStyle(b).opacity,
        icone:    getComputedStyle(b.querySelector('svg')).opacity,
        pastille: getComputedStyle(b.querySelector('.tse-sort-count')).display,
      };
    });
    ok('et le grisé ne l\'éteint pas',
       opacites.bouton === '1' && opacites.icone !== '1' && opacites.pastille !== 'none',
       JSON.stringify(opacites));
    await page.close();
  }

  // ── b) rien en mémoire : l'autre explication ──────────────────────────
  {
    const page = await freshTwitch(PLAYER, [], '/', SANS_PAGE);
    await page.evaluate(() => {
      const h = new Date(Date.now() - 60 * 60_000).toISOString();
      window.__fx = { autre: { id: '9', createdAt: h, viewers: 300, game: 'G', tags: [] } };
      window.__addCard('autre', 'G', '300');
    });
    await wait(page, 1800);
    const b = await bouton(page);
    ok('aucun abonnement connu : le bouton est grisé aussi', b?.off === true, JSON.stringify(b));
    ok('mais l\'explication invite à ouvrir une chaîne',
       /ouvrez|repér/i.test(b?.titre || ''), b?.titre);
    await page.close();
  }
}

console.log('\n46. Abonnements — un onglet vide ne coûte pas le garde-fou');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  // « gifts » et « mobile » ne rendront aucune carte : c'est le cas d'un compte
  // qui n'a que des abonnements payants. Rien ne distingue un onglet vide d'une
  // page lente, sinon la barre latérale — rendue par la même application.
  const VIDES = () => { window.__subsVides = ['gifts', 'mobile']; };
  const page = await freshTwitch(PLAYER, [], '/', VIDES);
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { omofficial: { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] } };
    window.__addCard('omofficial', 'G', '500');
  });
  const debut = Date.now();
  // LE point de la levée anticipée : l'onglet peuplé rentre vite, les deux
  // onglets vides s'attardent jusqu'à leur apaisement. Le verrou du voile doit
  // tomber AVEC le premier — pas avec le dernier. On compare deux événements
  // entre eux (verrou levé / relevé horodaté) et non à une horloge : un onglet
  // vide n'a rien à montrer, il n'a donc rien à retenir.
  let verrouVu = false;
  let verrouLeveAvantLaFin = null;
  for (let i = 0; i < 300; i++) {
    const [verrous, stamp] = await page.evaluate(() => [
      window.tse.verrous(), localStorage.getItem('tse:substs')]);
    const pose = verrous.includes('subs');
    if (pose) verrouVu = true;
    // On ne conclut qu'APRÈS avoir vu le verrou posé : sans cette condition,
    // la boucle répondait « levé » au premier tour, avant même que le relevé
    // n'ait démarré — une assertion qui ne prouvait rien.
    if (verrouVu && !pose && verrouLeveAvantLaFin === null) verrouLeveAvantLaFin = !stamp;
    if (stamp) break;
    await wait(page, 50);
  }
  ok('la retenue a bien été posée', verrouVu === true, 'verrou jamais observé');
  const duree = Date.now() - debut;
  ok('le voile est levé dès le premier onglet peuplé, sans attendre les vides',
     verrouLeveAvantLaFin === true, String(verrouLeveAvantLaFin));
  const trouves = await page.evaluate(() => Object.keys(
    JSON.parse(localStorage.getItem('tse:subs') || '{}')).sort().join(','));
  ok('l\'onglet peuplé est relevé quand même',
     trouves === 'antoinedaniel,etoiles,jenfirer,omofficial,roicheese', trouves);
  // Budget du relevé complet dans le harnais : deux onglets PEUPLÉS (rendu à
  // 600 ms + 900 ms de stabilité chacun) et deux onglets VIDES. Ces derniers
  // coûtent 1,2 s d'apaisement pièce, soit ~2,4 s — contre 12 s si chacun
  // attendait le garde-fou de 6 s. La borne est posée entre les deux totaux,
  // assez large pour ne pas dépendre de la charge de la machine, assez serrée
  // pour tomber si l'apaisement disparaît (vérifié par mutation).
  // Mesuré : 5,2 s avec les onglets lancés ensemble, 8,3 s en les enchaînant,
  // 15,0 s sans l'apaisement des onglets vides. La borne est posée entre les
  // deux dernières valeurs : elle tombe si l'apaisement disparaît, et laisse
  // assez de marge pour ne pas dépendre de la charge de la machine.
  ok('et les deux onglets vides n\'ont pas attendu le garde-fou',
     duree < 11_000, `relevé complet en ${duree} ms`);
  ok('aucune iframe ne reste accrochée',
     await page.evaluate(() => document.querySelectorAll('iframe').length) === 0);
  await page.close();
}

console.log('\n47. Tri — le mode choisi revient quand il redevient possible');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const MEMOIRE = () => {
    window.__noSubsPage = true;
    try {
      localStorage.setItem('tse:subs', JSON.stringify({ omofficial: [1, Date.now()] }));
    } catch { /* stockage refusé : le test échouera, et c'est correct */ }
  };
  const page = await freshTwitch(PLAYER, [], '/', MEMOIRE);
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      omofficial: { id: '1', createdAt: h, viewers: 100, game: 'G', tags: [] },
      autre:      { id: '2', createdAt: h, viewers: 900, game: 'G', tags: [] },
    };
    window.__addCard('omofficial', 'G', '100');
    window.__addCard('autre', 'G', '900');
  });
  await wait(page, 1500);
  const mode = () => page.evaluate(() => {
    const b = document.querySelector('#tse-sort-row [aria-pressed="true"]');
    return b ? b.dataset.tseSortMode : null;
  });

  await page.evaluate(() => {
    document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]').click();
  });
  await wait(page, 300);
  ok('le tri « mes abonnements » est choisi', (await mode()) === 'subs', String(await mode()));

  // Le seul abonné s'éteint. Le tri n'a plus rien à faire : il retombe sur
  // « spectateurs », et le bouton se grise.
  await page.evaluate(() => {
    window.__fx.omofficial = null;
    [...document.querySelectorAll('.side-nav-card')]
      .find(c => c.dataset.tseLogin === 'omofficial')
      .querySelector('.side-nav-card__avatar').classList.add('side-nav-card__avatar--offline');
  });
  await wait(page, 1500);
  ok('il s\'éteint : le tri retombe sur « spectateurs »',
     (await mode()) === 'viewers', String(await mode()));

  // Il revient. LE point de ce scénario : le choix de l'utilisateur revient
  // avec lui. Sans mémoire du souhait, le repli serait définitif — on aurait
  // perdu un réglage parce qu'un streamer avait éteint quelques minutes.
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx.omofficial = { id: '1', createdAt: h, viewers: 100, game: 'G', tags: [] };
    window.__goLive('omofficial');
  });
  await wait(page, 1800);
  ok('il revient : le tri choisi revient aussi', (await mode()) === 'subs', String(await mode()));
  await page.close();
}

console.log('\n48. Abonnements — l\'ancienneté, lue sans lire le français');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const page = await freshTwitch(PLAYER, [], '/');
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      omofficial: { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] },
      roicheese:  { id: '2', createdAt: h, viewers: 400, game: 'G', tags: [] },
    };
    window.__addCard('omofficial', 'G', '500');
    window.__addCard('roicheese', 'G', '400');
  });
  await attendre(page, () => !!localStorage.getItem('tse:substs'));
  await wait(page, 400);
  const mem = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tse:subs') || '{}'));

  // LE point du scénario. La carte payante de « roicheese » porte QUATRE
  // nombres : 9 jours avant l'anniversaire, 4 mois au total, 3 mois à la
  // suite, une date d'expiration. Prendre le premier venu donnerait 9 ;
  // prendre le dernier « N mois » donnerait 3. Seule l'étiquette — apprise
  // sur une carte expirée, où elle est seule — donne 4.
  ok('l\'ancienneté totale est lue, pas le compte à rebours',
     mem.roicheese?.[2] === 4, JSON.stringify(mem.roicheese));
  ok('ni la série en cours', mem.roicheese?.[2] !== 3, JSON.stringify(mem.roicheese));
  ok('un abonnement d\'un mois est lu comme tel',
     mem.omofficial?.[2] === 1, JSON.stringify(mem.omofficial));

  // Les cartes expirées, elles, n'ont qu'une paire : c'est ce qui les rend
  // enseignables. On vérifie qu'elles sont relevées, et marquées « ancien ».
  ok('un ancien abonnement porte son ancienneté',
     mem.antoinedaniel?.[2] === 29, JSON.stringify(mem.antoinedaniel));
  ok('et la marque « ancien abonné »',
     mem.antoinedaniel?.[3] === 1, JSON.stringify(mem.antoinedaniel));
  ok('sans être compté comme abonné en cours',
     mem.antoinedaniel?.[0] === 0, JSON.stringify(mem.antoinedaniel));

  // Le réabonnement : « etoiles » figure dans les expirés ET dans les payants.
  // La lecture des expirés ne doit pas dégrader un abonnement en cours — et
  // c'est bien pour ça qu'elle ne touche jamais à l'état d'abonnement.
  ok('une chaîne réabonnée reste abonnée', mem.etoiles?.[0] === 1, JSON.stringify(mem.etoiles));
  ok('avec son ancienneté', mem.etoiles?.[2] === 12, JSON.stringify(mem.etoiles));

  // L'ancienneté survit à une observation de visite, qui vient d'une AUTRE
  // source et n'a rien à dire sur le nombre de mois.
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.setAttribute('data-a-target', 'manage-sub-button');
    document.body.appendChild(b);
    history.pushState({}, '', '/roicheese');
  });
  await wait(page, 800);
  const apres = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tse:subs') || '{}'));
  ok('une visite n\'efface pas l\'ancienneté',
     apres.roicheese?.[2] === 4, JSON.stringify(apres.roicheese));
  await page.close();
}

console.log('\n49. Abonnements — une liste qui s\'écrit par morceaux');
{
  // Une liste React n'apparaît pas d'un bloc : le lien d'une carte peut être
  // rendu avant son ancienneté. Un relevé qui conclut au PREMIER passage où
  // il voit une carte lit donc la chaîne, et rien d'autre — l'étiquette n'est
  // jamais apprise, et plus aucun badge n'apparaît nulle part.
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const MORCEAUX = () => { window.__subsProgressif = 700; };
  const page = await freshTwitch(PLAYER, [], '/', MORCEAUX);
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { roicheese: { id: '2', createdAt: h, viewers: 400, game: 'G', tags: [] } };
    window.__addCard('roicheese', 'G', '400');
  });
  await attendre(page, () => !!localStorage.getItem('tse:substs'), 20_000);
  await wait(page, 400);
  const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('tse:subs') || '{}'));
  ok('les chaînes sont relevées malgré le rendu en deux temps',
     mem.roicheese?.[0] === 1, JSON.stringify(mem.roicheese));
  ok('et leur ancienneté aussi', mem.roicheese?.[2] === 4, JSON.stringify(mem.roicheese));
  ok('y compris celle apprise sur les expirés',
     mem.antoinedaniel?.[2] === 29, JSON.stringify(mem.antoinedaniel));
  await page.close();
}

// Une correction du relevé doit atteindre les mémoires déjà écrites. Un
// horodatage laissé par un lecteur ANTÉRIEUR — la 3.48.0 relevait les chaînes
// sans leur ancienneté — ne doit pas interdire le nouveau relevé pendant six
// heures, sinon la correction ne se voit qu'au lendemain.
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const VIEUX = () => {
    // Format nu, sans numéro de lecteur : celui d'avant la 3.48.1. Et tout
    // frais, donc parfaitement dans le TTL.
    try { localStorage.setItem('tse:substs', String(Date.now())); } catch {}
  };
  const page = await freshTwitch(PLAYER, [], '/', VIEUX);
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { roicheese: { id: '2', createdAt: h, viewers: 400, game: 'G', tags: [] } };
    window.__addCard('roicheese', 'G', '400');
  });
  await attendre(page, () => /^2:/.test(localStorage.getItem('tse:substs') || ''), 20_000);
  const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('tse:subs') || '{}'));
  ok('un relevé d\'un lecteur antérieur ne bloque pas la correction',
     mem.roicheese?.[2] === 4, JSON.stringify(mem.roicheese));
  ok('et le nouvel horodatage porte son numéro de lecteur',
     /^2:\d+$/.test(await page.evaluate(() => localStorage.getItem('tse:substs'))),
     await page.evaluate(() => localStorage.getItem('tse:substs')));

  // tse.reset() doit aussi emporter cet horodatage : effacer les abonnements
  // puis s'interdire d'aller les rechercher n'est pas une remise à zéro.
  await page.evaluate(() => window.tse.reset());
  ok('tse.reset() emporte l\'horodatage du relevé',
     (await page.evaluate(() => localStorage.getItem('tse:substs'))) === null,
     String(await page.evaluate(() => localStorage.getItem('tse:substs'))));
  await page.close();
}

// LE cas signalé : des abonnements DÉJÀ connus, mais un relevé produit par un
// lecteur devenu périmé. La sidebar a donc de quoi s'afficher tout de suite —
// et pourtant il manque l'ancienneté, que seul un nouveau relevé apportera.
// Le voile doit le couvrir, sans quoi le badge arrive après lui.
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const CONNUS_MAIS_PERIMES = () => {
    window.__subsDelay = 500;
    try {
      localStorage.setItem('tse:subs', JSON.stringify({ roicheese: [1, Date.now()] }));
      localStorage.setItem('tse:substs', String(Date.now()));   // format sans lecteur
    } catch { /* stockage refusé : le test échouera, et c'est correct */ }
  };
  const page = await freshTwitch(PLAYER, [], '/', CONNUS_MAIS_PERIMES);
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { roicheese: { id: '2', createdAt: h, viewers: 400, game: 'G', tags: [] } };
    window.__addCard('roicheese', 'G', '400');
  });
  await attendre(page, () => window.__voileLeve !== null, 8000);
  const leve = await page.evaluate(() => window.__voileLeve);
  ok('abonnements connus mais relevé périmé : le voile attend quand même',
     leve !== null && leve > 900, `voile levé après ${leve} ms`);
  await page.close();
}

console.log('\n50. Aperçu — le badge d\'abonnement');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const page = await freshTwitch(PLAYER, [], '/');
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      roicheese:     { id: '2', createdAt: h, viewers: 400, game: 'G', tags: [] },
      antoinedaniel: { id: '3', createdAt: h, viewers: 300, game: 'G', tags: [] },
      inconnue:      { id: '4', createdAt: h, viewers: 200, game: 'G', tags: [] },
    };
    window.__addCard('roicheese', 'G', '400');
    window.__addCard('antoinedaniel', 'G', '300');
    window.__addCard('inconnue', 'G', '200');
  });
  await attendre(page, () => !!localStorage.getItem('tse:substs'));
  await wait(page, 500);

  const badge = async (login) => {
    await hoverLogin(page, login);
    await wait(page, 500);
    const b = await page.evaluate(() => {
      const el = document.querySelector('.tse-preview__badge--sub, .tse-preview__badge--exsub');
      return el ? { classe: el.className, texte: el.textContent.trim() } : null;
    });
    await unhoverCard(page, 0);
    await wait(page, 200);
    return b;
  };

  const abo = await badge('roicheese');
  ok('un abonnement en cours affiche sa durée',
     abo?.texte === 'Abonné 4 mois', JSON.stringify(abo));
  ok('avec la teinte « abonné »',
     (abo?.classe || '').includes('--sub'), JSON.stringify(abo));

  const ancien = await badge('antoinedaniel');
  ok('un ancien abonnement le dit, au passé',
     ancien?.texte === 'Anciennement abonné 29 mois', JSON.stringify(ancien));
  ok('avec sa propre teinte, désaturée',
     (ancien?.classe || '').includes('--exsub'), JSON.stringify(ancien));

  // Une chaîne dont on ne sait rien : PAS de badge. Un « Abonné » sans durée
  // n'apprendrait rien que le filet doré de la carte ne dise déjà.
  const rien = await badge('inconnue');
  ok('une chaîne sans historique n\'affiche aucun badge', rien === null, JSON.stringify(rien));
  await page.close();
}

console.log('\n51. Abonnements — la carte d\'une chaîne abonnée');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const page = await freshTwitch(PLAYER, [], '/');
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      omofficial: { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] },
      inconnue:   { id: '2', createdAt: h, viewers: 900, game: 'G', tags: [] },
    };
    window.__addCard('omofficial', 'G', '500');
    window.__addCard('inconnue', 'G', '900');
  });
  await attendre(page, () => !!localStorage.getItem('tse:substs'));
  await wait(page, 400);   // le scan qui applique la décoration suit le relevé

  const marque = (login) => page.evaluate((l) => {
    const c = [...document.querySelectorAll('.side-nav-card')].find(x => x.dataset.tseLogin === l);
    if (!c) return null;
    const apres = getComputedStyle(c, '::after');
    const av = c.querySelector('.side-nav-card__avatar figure, .side-nav-card__avatar .tw-avatar');
    const avApres = av ? getComputedStyle(av, '::after') : null;
    return {
      classe:    c.classList.contains('tse-sub'),
      phase:     c.style.getPropertyValue('--tse-sub-phase'),
      anim:      apres.animationName,
      pointeur:  apres.pointerEvents,
      halo:      getComputedStyle(c).boxShadow,
      avatar:    avApres ? avApres.animationName : null,
      avatarSens: avApres ? avApres.animationDirection : null,
    };
  }, login);

  const abo = await marque('omofficial');
  const non = await marque('inconnue');
  ok('la chaîne abonnée porte la marque', abo && abo.classe === true, JSON.stringify(abo));
  ok('la chaîne non abonnée ne la porte pas', non && non.classe === false, JSON.stringify(non));
  // La décoration EXISTE vraiment côté rendu : deux animations nommées sur le
  // ::after, et un halo sur la carte. Sans ça, la classe ne prouverait rien.
  // Trois animations sur le liseré de la carte : la comète, le métal qui
  // dérive, et la respiration. C'est leur superposition qui fait la matière —
  // une seule donnerait un néon.
  ok('le liseré porte ses trois mouvements', !!abo && abo.anim.includes('tse-sub-turn')
     && abo.anim.includes('tse-sub-metal') && abo.anim.includes('tse-sub-breathe'),
     String(abo && abo.anim));
  // L'avatar porte le même liseré — c'est le SEUL élément qui subsiste en mode
  // réduit, donc le seul qui puisse y porter le signal — et il tourne à
  // l'envers de celui de la carte.
  ok('l\'avatar porte le même liseré', !!abo && (abo.avatar || '').includes('tse-sub-turn'),
     String(abo && abo.avatar));
  ok('et il tourne à l\'envers de la carte',
     (abo?.avatarSens || '').startsWith('reverse'), String(abo && abo.avatarSens));
  ok('la chaîne non abonnée n\'a pas d\'anneau d\'avatar',
     !non || non.avatar === 'none', String(non && non.avatar));
  ok('la carte porte le halo', !!abo && abo.halo !== 'none', String(abo && abo.halo));
  ok('et le décor ne capte pas les clics', !!abo && abo.pointeur === 'none',
     String(abo && abo.pointeur));
  ok('la chaîne non abonnée n\'anime rien', !!non && non.anim === 'none',
     String(non && non.anim));

  // La phase vient du LOGIN, pas du rang : elle doit survivre à un changement
  // de tri. Sans quoi l'animation repartirait de zéro à chaque reclassement.
  const avant = abo.phase;
  ok('la phase est posée', /^\d+$/.test(avant), String(avant));
  await page.evaluate(() => {
    const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]');
    if (b) b.click();
  });
  await wait(page, 400);
  const apresTri = await marque('omofficial');
  ok('et ne bouge pas quand le tri change', apresTri.phase === avant,
     avant + ' -> ' + apresTri.phase);
  ok('la marque non plus', apresTri.classe === true, JSON.stringify(apresTri));

  // Mouvement réduit : le filet reste (c'est l'information), il ne tourne plus.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const calme = await marque('omofficial');
  ok('mouvement réduit : plus d\'animation', calme.anim === 'none', String(calme.anim));
  ok('sur l\'avatar non plus', calme.avatar === 'none', String(calme.avatar));
  ok('mais la marque demeure', calme.classe === true, JSON.stringify(calme));
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // La décoration suit la CHAÎNE, pas la carte : React recycle ses cartes
  // d'une chaîne à l'autre, et une marque oubliée décorerait un inconnu.
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.side-nav-card')]
      .find(x => x.dataset.tseLogin === 'omofficial');
    c.querySelector('a[href="/omofficial"]').setAttribute('href', '/recyclee');
  });
  await wait(page, 600);
  const recyclee = await marque('recyclee');
  ok('carte recyclée sur une autre chaîne : la marque tombe',
     !!recyclee && recyclee.classe === false, JSON.stringify(recyclee));
  await page.close();
}

console.log('\n53. Abonnements — les onglets partent ensemble, l\'étiquette est retenue');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const poser = (page) => page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { roicheese: { id: '2', createdAt: h, viewers: 400, game: 'G', tags: [] } };
    window.__addCard('roicheese', 'G', '400');
  });
  // Nombre maximal d'iframes /subscriptions coexistant pendant le relevé.
  // C'est la mesure directe du parallélisme : à une par instant, le relevé
  // durait la SOMME des onglets et ne pouvait pas tenir sous le voile.
  const compter = (page) => page.evaluate(() => [...document.querySelectorAll('iframe')]
    .filter(f => (f.src || '').includes('/subscriptions')).length);
  const pic = async (page, ms) => {
    let max = 0;
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      max = Math.max(max, await compter(page));
      await wait(page, 100);
    }
    return max;
  };
  // Pic mesuré à partir de la PREMIÈRE iframe, sur une fenêtre courte. C'est
  // ce qui distingue les deux cas : sans étiquette connue, l'onglet des
  // expirés tourne SEUL pendant ce temps-là ; avec, toute la volée est déjà
  // partie. Les départs étant décalés (SUBS_PAGE_STAGGER), on ne regarde pas
  // le tout premier instant mais une fenêtre qui les couvre.
  const picInitial = async (page, ms) => {
    await attendre(page, () => [...document.querySelectorAll('iframe')]
      .some(f => (f.src || '').includes('/subscriptions')), 8000);
    return pic(page, ms);
  };

  // ── a) profil neuf : l'étiquette est apprise, puis mémorisée ───────────
  {
    const page = await freshTwitch(PLAYER, [], '/');
    await poser(page);
    const debut = await picInitial(page, 900);
    const max = await pic(page, 5000);
    await attendre(page, () => !!localStorage.getItem('tse:substs'));
    ok('plusieurs onglets sont lus en même temps', max >= 2, `pic de ${max} iframe(s)`);
    // Étiquette inconnue : l'onglet des expirés doit passer SEUL d'abord.
    ok('mais l\'étiquette inconnue impose une passe préalable, seule',
       debut === 1, `pic initial de ${debut} iframe(s)`);
    const etiq = await page.evaluate(() => localStorage.getItem('tse:submois'));
    ok('l\'étiquette apprise est mémorisée',
       etiq === 'Nombre total de mois abonné :', String(etiq));
    // tse.reset() doit l'emporter : elle vient de la même lecture.
    await page.evaluate(() => window.tse.reset());
    ok('et tse.reset() l\'emporte',
       (await page.evaluate(() => localStorage.getItem('tse:submois'))) === null,
       String(await page.evaluate(() => localStorage.getItem('tse:submois'))));
    await page.close();
  }

  // ── b) étiquette déjà connue : plus de passe préalable ─────────────────
  // Sans elle, l'onglet des expirés doit passer SEUL en premier — les autres
  // ne sauraient pas quoi chercher. Avec elle, tout part d'un bloc, et c'est
  // ce qui fait tenir le relevé sous la retenue du voile.
  {
    const SU = () => {
      try { localStorage.setItem('tse:submois', 'Nombre total de mois abonné :'); } catch {}
    };
    const page = await freshTwitch(PLAYER, [], '/', SU);
    await poser(page);
    // Même fenêtre, même mesure : cette fois toute la volée est déjà partie.
    const dabord = await picInitial(page, 900);
    ok('l\'étiquette connue supprime la passe préalable', dabord >= 3,
       `pic initial de ${dabord} iframe(s)`);
    await attendre(page, () => !!localStorage.getItem('tse:substs'));
    await wait(page, 400);
    const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('tse:subs') || '{}'));
    ok('et l\'ancienneté est lue quand même', mem.roicheese?.[2] === 4,
       JSON.stringify(mem.roicheese));
    await page.close();
  }
}

await browser.close();
console.log(`\n${'═'.repeat(50)}\n${pass} réussis, ${fail} échoués\n`);
process.exit(fail ? 1 : 0);
