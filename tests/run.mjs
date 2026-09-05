import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { degraisser, degraisserJs, memeCode, compterCommentaires,
         sansCommentairesCss } from './degraisser.mjs';

// Tout est résolu depuis CE fichier : `npm test` tourne à la racine du dépôt,
// un lancement direct tourne dans tests/, et les deux doivent marcher.
const ICI = dirname(fileURLToPath(import.meta.url));
const URL_PAGE = pathToFileURL(join(ICI, 'page.html')).href;
let pass = 0, fail = 0;
// Les échecs sont RETENUS, pas seulement imprimés au fil de l'eau, et
// récapitulés à la fin. Un échec intermittent noyé au milieu de cinq cents
// lignes est un échec qu'on ne saura pas nommer le lendemain — c'est arrivé,
// et la cause a mis une session à être retrouvée. Le récapitulatif porte
// aussi le scénario en cours : « ✗ et son halo respire » ne dit rien sans lui.
const echecs = [];
let scenario = '(hors scénario)';
const titre = (t) => { scenario = t; console.log('\n' + t); };
const ok  = (n, c, extra='') => {
  if (c) { pass++; console.log('  ✓', n); return; }
  fail++;
  echecs.push({ scenario, assertion: n, detail: String(extra) });
  console.log('  ✗', n, extra);
};
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
titre('1. Rendu initial — données API substituées au DOM');
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
titre('2. Rafraîchissement — le compteur suit l\'API');
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
titre('3. Hors-ligne — deux réponses réseau requises, pas deux scans');
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
titre('4. Redémarrage — la carte masquée par l\'extension revient seule');
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
titre('5. Stabilité — aucune boucle scan → écriture → scan');
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
titre('6. Découpage — aucune opération ne dépasse GQL_MAX_LOGINS');
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
  // ON PROVOQUE UN BALAYAGE COMPLET, on ne l'attend pas.
  //
  // Observer un cycle de régime établi ne marche pas : les 63 entrées de cache
  // ont été écrites à l'arrivée de DEUX réponses, donc elles ne périment pas
  // au même instant. La file part alors à moitié pleine — 42 puis 21, 49 puis
  // 14, 32 puis 31 — et le découpage a beau être correct, la MESURE varie.
  // C'est ce qui rendait cette assertion intermittente : elle encodait un
  // accident de minutage, pas un invariant.
  //
  // tse.rescan() purge le cache d'un coup : les 63 chaînes sont remises en
  // file dans la même passe synchrone, et flushQueue découpe la file entière.
  // Le 50 + 13 devient alors ce qu'il prétend être — l'invariant d'un
  // balayage complet.
  await page.evaluate(() => { window.__calls.length = 0; window.tse.rescan(); });
  // Assez pour le debounce (40 ms) et la réponse du stub, trop peu pour qu'une
  // seconde péremption (LIVE_TTL = 600 ms) ne vienne s'ajouter au journal.
  await wait(page, 300);
  // Filtrer sur l'opération : la requête Guest Star ne porte pas de `logins`
  // et compterait pour une tranche de taille zéro.
  const calls = await page.evaluate(() => window.__calls.filter(c => c.op === 'TseChannels').map(c => c.n));
  const max = Math.max(...calls);
  ok('taille max d\'une tranche ≤ 50', max <= 50, 'max=' + max);
  // Invariant : un balayage complet des 63 chaînes tient en 2 opérations,
  // 50 + 13 — le minimum possible pour GQL_MAX_LOGINS = 50.
  const tailles = [...new Set(calls)].sort((a, b) => b - a);
  ok('un balayage complet tient en 2 opérations (50 + 13)',
     calls.length === 2 && tailles.length === 2 && tailles[0] === 50 && tailles[1] === 13,
     JSON.stringify(calls));
  const covered = await page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')].filter(c => c.dataset.tseViewers).length);
  ok('les 63 chaînes sont résolues malgré le découpage', covered === 63, covered + '/63');
  console.log(`     → tailles observées : ${[...new Set(calls)].sort((a,b)=>b-a).join(', ')}`);
  await page.close();
}

// ═════════════ 7. Panne réseau ═════════════
titre('7. Panne réseau — état préservé, pas de martèlement');
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
titre('8. Tri — sur les nombres exacts, plus sur le texte localisé');
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
titre('9. Locale — l\'allemand garde le nombre plein, comme Twitch');
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
titre('10. Garde-fou — jamais écraser le pseudo par la catégorie');
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
titre('11. Roster — chaînes suivies apprises par observation');
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
titre('12. Mesure — ce qui est compté, et ce qui ne l\'est pas');
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
  /* On attend le FAIT — la carte fabriquée — et non une durée. Ces deux
     assertions ont lâché sous charge avec un `wait(900)` : la fabrication
     dépend d'un debounce de scan et d'un aller-retour de lot, donc de la
     machine. C'est le travers contre lequel l'en-tête de ce fichier met en
     garde, présent ici depuis l'origine. L'expiration n'échoue pas d'elle-même :
     elle laisse l'assertion suivante constater et nommer ce qui manque. */
  await attendre(page, () =>
    !!document.querySelector('.side-nav-card[data-tse-synthetic="true"]'), 5000);
  const ahead = await page.evaluate(() => ({
    notre: !!document.querySelector('.side-nav-card[data-tse-synthetic="true"]'),
    lag:   window.tse.lag().length
  }));
  ok('notre carte est posée avant celle de Twitch', ahead.notre === true);
  ok('rien n\'est encore compté : Twitch n\'affiche pas', ahead.lag === 0, String(ahead.lag));

  await page.evaluate(() => window.__goLive('dormant'));
  // Même raison : c'est l'ARRIVÉE de la mesure qu'on attend, pas 900 ms.
  await attendre(page, () => window.tse.lag().length > 0, 5000);
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
titre('13. Réponse groupée — indexation par login, pas par position');
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
titre('14. Palier 3 — une chaîne apparaît avant que Twitch la pose');
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
titre('15. Palier 3 — retraits, garde du voile, carte périmée');
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
titre('16. Palier 3 — les cartes fabriquées ne faussent rien');
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
titre('17. Badge collab — le pré-filtre ne change rien au comportement');
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

// ═════════ 18. Cohérence des dix langues ═════════
titre('18. Localisation — aucune langue ne peut diverger');
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
  const langs = ['fr', 'en', 'de', 'es', 'pt', 'it', 'pl', 'ru', 'ja', 'zh'];
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
  ok(`jeux de clés identiques dans les ${langs.length} langues`, issues.length === 0, issues.join(' | '));
  ok(`même nombre de clés partout (${ref.size})`,
     langs.every(l => keysOf(l).length === ref.size),
     langs.map(l => `${l}=${keysOf(l).length}`).join(' '));
}

// ═════════ 19. Cadence réelle de sondage ═════════
titre('19. Cadence — la période réelle doit coller au TTL');
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
titre('20. Garde-fou — une API qui ment ne vide pas la sidebar');
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
titre('21. Garde-fou — une extinction isolée passe normalement');
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
titre('22. Garde-fou — protège aussi au démarrage, cache vide');
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
titre('23. Clonage — jamais depuis une carte décorée');
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
titre('24. Co-stream — Twitch affiche le combiné, et le tri doit le suivre');
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
titre('25. Aucun hash — le module sidebar n\'a plus de persisted query');
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
titre('26. Guest Star en panne : repli propre, sans casse');
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
titre('27. Session solo — un host.id sans collaboration ne fabrique rien');
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
titre('28. Anti-pub — chargé avec la sidebar, mais strictement inerte en top-level');
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
titre('29. Palette — deux collaborations voisines doivent se distinguer');
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
titre('30. Aperçu — l\'iframe n\'apparaît qu\'une fois une image affichée');
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

    // On ATTEND le dévoilement au lieu de l'échantillonner à date fixe. Le
    // premier dessin a lieu à 700 ms et le filet de sécurité à 1500 ms, mais
    // sous charge un « attendre 1000 ms » s'étire : le prélèvement tombait
    // avant que le message de l'iframe n'ait été traité, et l'assertion
    // constatait un non-dévoilement qui n'existait pas. L'attente est bornée —
    // si le dévoilement n'a jamais lieu, elle expire et l'assertion tombe.
    await attendre(page, () => {
      const f = document.querySelector('.tse-preview__iframe');
      return !!f && f.dataset.tseLoaded === 'true';
    }, 6000);
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

    // Le filet se déclenche à PREVIEW_REVEAL_FALLBACK_MS (1500 ms). On l'ATTEND
    // au lieu de prélever après 1400 ms de plus : sous charge, ce prélèvement
    // arrive avant que le minuteur de la page n'ait été servi. Borné — sans
    // filet, l'attente expire et l'assertion tombe.
    await attendre(page, () => {
      const f = document.querySelector('.tse-preview__iframe');
      return !!f && f.dataset.tseLoaded === 'true';
    }, 6000);
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
titre('31. Vignette — l\'URL doit être stable, et l\'attente ne doit pas être noire');
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
  // La vignette apparaît EN FONDU. Prélever son opacité 300 ms après le survol
  // revenait à l'attraper en pleine transition : 0,885 relevé sous charge, pour
  // un seuil de 0,9. On attend donc la fin du fondu — bornée. Le seuil garde
  // ses dents : une vignette qui resterait invisible ne l'atteindrait jamais.
  await attendre(page, () => {
    const i = document.querySelector('.tse-preview__thumb');
    return !!i && i.dataset.tseLoaded === 'true' && Number(getComputedStyle(i).opacity) > 0.9;
  }, 5000);
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
titre('32. Qualité — le jeton d\'accès doit être demandé en « autoplay »');
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
titre('33. Préchargement — réchauffer pendant les périodes calmes');
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
    //
    // On ATTEND que la tranche la plus récente soit complète au lieu de la
    // prélever au vol : elle vient peut-être de commencer, et n'avoir que deux
    // chaînes sur trois à cet instant ne dit rien de la purge. L'attente est
    // bornée — si la purge n'a pas lieu, elle expire et l'assertion tombe avec
    // ce qui a été vu.
    let vus = new Set();
    for (let i = 0; i < 50; i++) {
      const tr = new Set(cdn.map(u => u.split('?_=')[1]));
      const derniere = [...tr].sort().pop();
      vus = new Set(logins(cdn.filter(u => u.endsWith(derniere))));
      if (['un', 'deux', 'trois'].every(l => vus.has(l))) break;
      await wait(page, 100);
    }
    ok('toutes les chaînes sont redemandées après la purge',
       ['un', 'deux', 'trois'].every(l => vus.has(l)), [...vus].join(', '));
    await page.close();
  }
}

// ═════════════ 34. Chaînes globales — couche de données ═════════════
titre('34. Chaînes globales — classer ce que l\'API refuse de classer');
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
    // ORDRE IMPORTANT. La carte de s00 n'est posée qu'APRÈS la vérification
    // de l'état de départ. Elle l'était avant, et sa file TseChannels courait
    // alors contre la marche : sous charge, le compteur frais (12) arrivait
    // parfois AVANT l'assertion, qui trouvait s00 déjà rétrogradé et tombait.
    // Le défaut était dans la mise en scène, pas dans le classement — la
    // rétrogradation est précisément ce que le reste du bloc éprouve, il ne
    // faut donc pas la déclencher avant d'avoir constaté le point de départ.
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
    // MAINTENANT la sidebar apprend que s00 n'a plus que 12 spectateurs.
    await page.evaluate(() => {
      const h = new Date(Date.now() - 30 * 60_000).toISOString();
      window.__fx = { s00: { id: 'id-s00', createdAt: h, viewers: 12,
                             game: 'Just Chatting', tags: [] } };
      window.__addCard('s00', 'Just Chatting', '4 k');
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
titre('35. Top Chaînes — basculer, afficher, revenir');
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

    // On observe un ORDRE, pas un état à un instant choisi. Prélever « le voile
    // est-il encore là ? » 450 ms après le clic revenait à parier que la
    // marche n'a pas fini — et sous charge, c'est le PRÉLÈVEMENT qui arrive en
    // retard, pas la marche qui va vite. Le témoin ci-dessous date les deux
    // événements dans la page elle-même : la question « le voile a-t-il tenu
    // jusqu'au classement ? » se répond alors sans dépendre d'aucune horloge
    // extérieure.
    await page.evaluate(() => {
      window.__ordre = { pret: null, leve: null };
      const t0 = Date.now();
      const mo = new MutationObserver(() => {
        const c = document.body.classList;
        if (window.__ordre.pret === null && c.contains('tse-global-ready')) {
          window.__ordre.pret = Date.now() - t0;
        }
        if (window.__ordre.leve === null && !c.contains('tse-loading')) {
          window.__ordre.leve = Date.now() - t0;
        }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      document.querySelector('#tse-mode-row [data-tse-mode="global"]').click();
    });
    ok('le voile se lève dès le clic',
       await page.evaluate(() => document.body.classList.contains('tse-loading')));

    // Sans le verrou, le voile retomberait AVANT le classement : la liste des
    // chaînes suivies est peuplée et stable, donc « présentable » au sens du
    // cycle de boot — alors même que le classement n'existe pas encore.
    await attendre(page, () => window.__ordre.leve !== null, 8000);
    const ordre = await page.evaluate(() => window.__ordre);
    ok('il tient tant que le classement n\'est pas rendu',
       ordre.pret !== null && ordre.leve !== null && ordre.pret <= ordre.leve,
       JSON.stringify(ordre));

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
titre('36. Catégories — choisir, ce n\'est pas filtrer');
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
titre('37. Voile — la sidebar ne doit s\'initialiser qu\'une fois');
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
titre('38. Monde + langue — descendre en langue, pas filtrer un pool');
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
titre('39. Catégorie + langue — demander, pas filtrer');
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
titre('40. Top Chaînes — ce qui est demandé s\'affiche, et rien ne déborde');
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
titre('41. Cache — le mode global ne doit rien laisser derrière lui');
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
titre('42. Abonnements — le tri « mes abos en tête », sans une requête');
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
titre('43. Abonnements — la liste complète, lue dans une iframe');
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
  await wait(page, 1500);
  ok('et ne recommence pas dans le délai',
     (await page.evaluate(() => localStorage.getItem('tse:substs'))) === stamp,
     'horodatage modifié');

  // Forcer le relevé doit, lui, repasser outre le délai.
  const forcees = await page.evaluate(() => window.tse.subs.refresh());
  ok('tse.subs.refresh() force un nouveau relevé',
     Array.isArray(forcees) && forcees.length === 5, JSON.stringify(forcees));
  await page.close();
}

titre('44. Abonnements — le relevé part avec la sidebar, pas avec un minuteur');
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

titre('45. Abonnements — le tri se grise quand aucun abonné n\'émet');
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
  // Le survol donne le TOTAL, celui de la pastille — qui, elle, tronque au-delà
  // de 99 et ne dit pas ce qu'elle compte.
  ok('et son survol annonce le total des abonnements',
     /2 abonnements au total/.test(c?.titre || ''), String(c && c.titre));
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

titre('46. Abonnements — un onglet vide ne coûte pas le garde-fou');
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

titre('47. Tri — le mode choisi revient quand il redevient possible');
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

titre('48. Abonnements — l\'ancienneté, lue sans lire le français');
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

titre('49. Abonnements — une liste qui s\'écrit par morceaux');
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

titre('50. Aperçu — le badge d\'abonnement');
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

titre('51. Abonnements — la carte d\'une chaîne abonnée');
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
    const nom = c.querySelector('p[data-a-target="side-nav-title"]');
    const nomStyle = nom ? getComputedStyle(nom) : null;
    // La catégorie est désormais DÉSIGNÉE par une classe, posée en JS d'après
    // cardCategoryEl() : plus de cascade à recopier ici non plus.
    const cat = c.querySelector('.tse-sub-cat');
    const catStyle = cat ? getComputedStyle(cat) : null;
    return {
      classe:    c.classList.contains('tse-sub'),
      phase:     c.style.getPropertyValue('--tse-sub-phase'),
      anim:      apres.animationName,
      pointeur:  apres.pointerEvents,
      // La lueur se peint SOUS le contenu : un z-index négatif dans le
      // contexte d'empilement de la carte. C'est ce qui lui permet de
      // cohabiter avec le fond de « frais » et du co-stream.
      plan:      apres.zIndex,
      avatar:    avApres ? avApres.animationName : null,
      nomAnim:   nomStyle ? nomStyle.animationName : null,
      nomFill:   nomStyle ? nomStyle.webkitTextFillColor : null,
      nomPoids:  nomStyle ? nomStyle.fontWeight : null,
      catTexte:  cat ? cat.textContent : null,
      catAnim:   catStyle ? catStyle.animationName : null,
      catFill:   catStyle ? catStyle.webkitTextFillColor : null,
      catDuree:  catStyle ? catStyle.animationDuration : null,
      nomDuree:  nomStyle ? nomStyle.animationDuration : null,
      avSouffle: av ? getComputedStyle(av).animationName : null,
    };
  }, login);

  const abo = await marque('omofficial');
  const non = await marque('inconnue');
  ok('la chaîne abonnée porte la marque', abo && abo.classe === true, JSON.stringify(abo));
  ok('la chaîne non abonnée ne la porte pas', non && non.classe === false, JSON.stringify(non));
  // La décoration EXISTE vraiment côté rendu : deux animations nommées sur le
  // ::after, et un halo sur la carte. Sans ça, la classe ne prouverait rien.
  ok('la lueur de fond est animée', abo?.anim === 'tse-sub-lueur', String(abo && abo.anim));
  // Elle se peint SOUS le contenu de la carte, et sous la barre de gauche de
  // « frais » et du co-stream : c'est ce plan négatif qui rend la cohabitation
  // possible sans une seule règle de départage.
  ok('et posée sous le contenu de la carte', abo?.plan === '-1', String(abo && abo.plan));
  // Le nom passe à l'or, et le dégradé le traverse.
  ok('le nom porte le dégradé doré',
     (abo?.nomAnim || '').includes('tse-sub-titre'), String(abo && abo.nomAnim));
  ok('en découpe dans le texte',
     (abo?.nomFill || '').includes('rgba(0, 0, 0, 0)'), String(abo && abo.nomFill));
  ok('et il est mis en gras', abo?.nomPoids === '700', String(abo && abo.nomPoids));
  // La catégorie reçoit le même traitement, en plus sourd et plus lent : les
  // deux rangs doivent rester distincts, sans quoi la hiérarchie que Twitch
  // installe par la taille et la couleur s'aplatit.
  ok('la catégorie est bien celle visée, pas le nom',
     abo?.catTexte === 'G', String(abo && abo.catTexte));
  ok('elle porte elle aussi le dégradé', abo?.catAnim === 'tse-sub-titre',
     String(abo && abo.catAnim));
  ok('en découpe dans le texte',
     (abo?.catFill || '').includes('rgba(0, 0, 0, 0)'), String(abo && abo.catFill));
  // Le nom porte DEUX animations (reflet + halo), la catégorie une seule ; et
  // le reflet du nom est plus rapide. C'est cette différence qui tient la
  // hiérarchie.
  ok('le nom porte en plus un halo qui respire',
     (abo?.nomAnim || '').includes('tse-sub-halo'), String(abo && abo.nomAnim));
  ok('et son reflet va plus vite que celui de la catégorie',
     parseFloat(abo?.nomDuree) < parseFloat(abo?.catDuree),
     `${abo && abo.nomDuree} contre ${abo && abo.catDuree}`);
  ok('la catégorie, elle, n\'a qu\'une animation',
     (abo?.catAnim || '').split(',').length === 1, String(abo && abo.catAnim));
  ok('la catégorie d\'une chaîne non abonnée n\'est même pas marquée',
     non !== null && non.catAnim === null, String(non && non.catAnim));
  // La catégorie est DÉSIGNÉE par cardCategoryEl, plus cherchée par un
  // sélecteur qui exigeait un attribut title : c'est ce qui la met à l'abri
  // du défaut signalé sur l'avatar. On vérifie qu'elle porte bien la marque
  // et que c'est le bon élément.
  ok('la catégorie est marquée par la fonction de référence',
     await page.evaluate(() => {
       const c = [...document.querySelectorAll('.side-nav-card')]
         .find(x => x.dataset.tseLogin === 'omofficial');
       const marque = c.querySelectorAll('.tse-sub-cat');
       return marque.length === 1 && marque[0].textContent === 'G';
     }));
  ok('le nom d\'une chaîne non abonnée est laissé tel quel',
     !non || (non.nomAnim === 'none' && non.nomPoids !== '700'),
     JSON.stringify(non && { a: non.nomAnim, p: non.nomPoids }));
  // L'avatar garde son anneau : c'est le SEUL élément qui subsiste en mode
  // réduit, où il n'y a ni fond ni nom à colorer.
  ok('l\'avatar garde son anneau tournant', !!abo && (abo.avatar || '').includes('tse-sub-turn'),
     String(abo && abo.avatar));
  ok('et son halo respire', abo?.avSouffle === 'tse-sub-souffle', String(abo && abo.avSouffle));
  ok('la chaîne non abonnée n\'a pas d\'anneau d\'avatar',
     !non || non.avatar === 'none', String(non && non.avatar));
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
  ok('ni sur le nom', calme.nomAnim === 'none', String(calme.nomAnim));
  ok('ni sur la catégorie', calme.catAnim === 'none', String(calme.catAnim));
  ok('et la catégorie reste marquée', calme.catTexte === 'G', String(calme.catTexte));
  ok('ni sur l\'avatar', calme.avatar === 'none', String(calme.avatar));
  ok('ni sur son halo', calme.avSouffle === 'none', String(calme.avSouffle));
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

titre('53. Abonnements — les onglets partent ensemble, l\'étiquette est retenue');
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

titre('54. Abonnements — l\'origine est retenue, la teinte reste l\'or');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const page = await freshTwitch(PLAYER, [], '/');
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      omofficial: { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] },  // payant
      clem_mlrt:  { id: '5', createdAt: h, viewers: 150, game: 'G', tags: [] },  // offert
      zerator:    { id: '6', createdAt: h, viewers: 840, game: 'G', tags: [] },  // mobile
      inconnue:   { id: '4', createdAt: h, viewers: 900, game: 'G', tags: [] },
    };
    for (const l of ['omofficial', 'clem_mlrt', 'zerator', 'inconnue']) {
      window.__addCard(l, 'G', '100');
    }
  });
  await attendre(page, () => !!localStorage.getItem('tse:substs'));
  await wait(page, 500);

  const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('tse:subs') || '{}'));
  // L'origine est le CINQUIÈME champ de la forme compacte. Aucune interface ne
  // s'en sert — la teinte par origine a été essayée puis retirée — mais elle
  // est relevée sans requête supplémentaire et tse.subs() la montre.
  ok('l\'onglet d\'origine est mémorisé', mem.omofficial?.[4] === 'paid',
     JSON.stringify(mem.omofficial));
  ok('un abonnement offert le sait', mem.clem_mlrt?.[4] === 'gifts', JSON.stringify(mem.clem_mlrt));
  ok('un abonnement mobile aussi', mem.zerator?.[4] === 'mobile', JSON.stringify(mem.zerator));
  ok('les expirés ne posent pas d\'origine', !mem.antoinedaniel?.[4],
     JSON.stringify(mem.antoinedaniel));
  ok('et tse.subs() la rend lisible',
     (await page.evaluate(() => window.tse.subs().find(e => e.login === 'clem_mlrt')?.origine))
       === 'gifts');

  // L'OR POUR TOUS, quelle que soit l'origine : c'est ce que l'interface dit.
  const teinte = (login) => page.evaluate((l) => {
    const c = [...document.querySelectorAll('.side-nav-card')].find(x => x.dataset.tseLogin === l);
    return c ? getComputedStyle(c).getPropertyValue('--tse-sub-or').trim() : null;
  }, login);
  const teintes = [await teinte('omofficial'), await teinte('clem_mlrt'), await teinte('zerator')];
  ok('les trois origines portent le même or', new Set(teintes).size === 1,
     JSON.stringify(teintes));
  ok('et c\'est bien de l\'or', /255,\s*196,\s*92/.test(teintes[0] || ''), String(teintes[0]));
  ok('aucune carte ne porte d\'attribut d\'origine',
     await page.evaluate(() => document.querySelectorAll('[data-tse-sub-src]').length) === 0);
  await page.close();
}

titre('55. Abonnements — l\'anneau suit l\'avatar, quelle que soit sa forme');
{
  // Twitch ne rend pas toujours le même markup d'avatar : avatarOf() en
  // couvre cinq formes. Le CSS n'en recopiait que trois — d'où un anneau
  // présent sur une carte et absent sur sa voisine, pour la même raison
  // invisible : un <figure> ici, un simple <div class="tw-avatar"> là.
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const NU = () => {
    window.__noSubsPage = true;
    // Quatre cartes, quatre formes d'avatar. La dernière — hors du bloc
    // habituel ET sans <figure> — est celle qu'aucun sélecteur de la feuille
    // de style n'atteignait : c'est la quatrième branche de avatarOf().
    window.__avatarNu = ['clem_mlrt', 'domingo'];
    window.__avatarStories = ['hasanabi', 'domingo'];
    try {
      localStorage.setItem('tse:subs', JSON.stringify({
        etoiles: [1, Date.now()], clem_mlrt: [1, Date.now()],
        hasanabi: [1, Date.now()], domingo: [1, Date.now()],
      }));
    } catch { /* stockage refusé : le test échouera, et c'est correct */ }
  };
  const page = await freshTwitch(PLAYER, [], '/', NU);
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = {
      etoiles:   { id: '3', createdAt: h, viewers: 2600, game: 'G', tags: [] },
      clem_mlrt: { id: '5', createdAt: h, viewers: 174,  game: 'G', tags: [] },
      hasanabi:  { id: '7', createdAt: h, viewers: 29800, game: 'G', tags: [] },
      domingo:   { id: '8', createdAt: h, viewers: 14200, game: 'G', tags: [] },
    };
    window.__addCard('etoiles', 'G', '2,6 k');
    window.__addCard('clem_mlrt', 'G', '174');
    window.__addCard('hasanabi', 'G', '29,8 k');
    window.__addCard('domingo', 'G', '14,2 k');
  });
  await wait(page, 1800);

  const anneau = (login) => page.evaluate((l) => {
    const c = [...document.querySelectorAll('.side-nav-card')].find(x => x.dataset.tseLogin === l);
    if (!c) return null;
    // La cascade COMPLÈTE de avatarOf() : c'est elle qui fait autorité sur
    // « où est l'avatar », et c'est elle que la décoration doit suivre.
    const av = c.querySelector('.side-nav-card__avatar figure')
            || c.querySelector('.side-nav-card__avatar .tw-avatar')
            || c.querySelector('figure.tw-avatar')
            || c.querySelector('.tw-avatar')
            || c.querySelector('img.tw-image-avatar')?.closest('figure, .tw-avatar, div');
    if (!av) return { forme: 'introuvable' };
    const ap = getComputedStyle(av, '::after');
    return {
      forme:  av.tagName.toLowerCase(),
      anneau: ap.content !== 'none',
      anim:   ap.animationName,
      halo:   getComputedStyle(av).animationName,
    };
  }, login);

  const avecFigure = await anneau('etoiles');
  const sansFigure = await anneau('clem_mlrt');
  const horsBloc  = await anneau('hasanabi');
  ok('le harnais sert bien trois formes différentes',
     avecFigure?.forme === 'figure' && sansFigure?.forme === 'div'
     && horsBloc?.forme === 'figure',
     JSON.stringify([avecFigure?.forme, sansFigure?.forme, horsBloc?.forme]));
  ok('l\'avatar enveloppé d\'un <figure> porte l\'anneau',
     avecFigure?.anneau === true && avecFigure?.anim === 'tse-sub-turn',
     JSON.stringify(avecFigure));
  ok('celui qui n\'en a pas le porte aussi',
     sansFigure?.anneau === true && sansFigure?.anim === 'tse-sub-turn',
     JSON.stringify(sansFigure));
  ok('et son halo respire de même', sansFigure?.halo === 'tse-sub-souffle',
     JSON.stringify(sansFigure));
  // LE cas signalé : un avatar rendu hors du bloc habituel — une chaîne qui
  // publie des stories — n'avait pas d'anneau, alors que sa voisine en avait un.
  ok('et celui qui est rendu hors du bloc habituel aussi',
     horsBloc?.anneau === true && horsBloc?.anim === 'tse-sub-turn',
     JSON.stringify(horsBloc));
  ok('avec son halo', horsBloc?.halo === 'tse-sub-souffle', JSON.stringify(horsBloc));
  // LA forme qu'aucun sélecteur n'atteignait : hors du bloc ET sans <figure>.
  const nulPart = await anneau('domingo');
  ok('et celui qui cumule les deux différences aussi',
     nulPart?.anneau === true && nulPart?.anim === 'tse-sub-turn', JSON.stringify(nulPart));
  // La marque suit l'avatar, et elle est UNIQUE dans la carte : une carte
  // recyclée ne doit pas garder l'ancienne.
  ok('une seule marque d\'avatar par carte',
     await page.evaluate(() => [...document.querySelectorAll('.side-nav-card')]
       .every(c => c.querySelectorAll('.tse-sub-avatar').length <= 1)));
  // La marque doit TOMBER quand la carte cesse d'être abonnée — sinon un
  // anneau doré survivrait sur une chaîne quelconque, la carte ayant été
  // recyclée par React.
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.side-nav-card')]
      .find(x => x.dataset.tseLogin === 'etoiles');
    c.querySelector('a[href="/etoiles"]').setAttribute('href', '/recyclee');
  });
  await wait(page, 600);
  ok('et elle tombe quand la carte change de chaîne',
     await page.evaluate(() => {
       const c = [...document.querySelectorAll('.side-nav-card')]
         .find(x => x.dataset.tseLogin === 'recyclee');
       return !!c && c.querySelectorAll('.tse-sub-avatar').length === 0;
     }));
  await page.close();
}

titre('56. Filtres — la rangée de tri est alignée sur celle des filtres');
{
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const page = await freshTwitch(PLAYER, [], '/');
  await page.evaluate(() => {
    const h = new Date(Date.now() - 60 * 60_000).toISOString();
    window.__fx = { alpha: { id: '1', createdAt: h, viewers: 500, game: 'G', tags: [] } };
    window.__addCard('alpha', 'G', '500');
  });
  await wait(page, 1500);
  const bords = await page.evaluate(() => {
    const filtres = document.querySelector('.tse-filter-row');
    const boutons = [...document.querySelectorAll('#tse-sort-row button[data-tse-sort-mode]')];
    if (!filtres || boutons.length < 2) return null;
    const f = filtres.getBoundingClientRect();
    const p = boutons[0].getBoundingClientRect();
    const d = boutons[boutons.length - 1].getBoundingClientRect();
    return { gauche: +(p.left - f.left).toFixed(2), droite: +(f.right - d.right).toFixed(2),
             largeur: +p.width.toFixed(2), n: boutons.length };
  });
  // Les deux rangées vivent dans le même conteneur : leurs bords doivent
  // coïncider. Un pixel de tolérance pour l'arrondi de rendu.
  ok('le premier bouton touche le bord gauche des filtres',
     bords !== null && Math.abs(bords.gauche) <= 1, JSON.stringify(bords));
  ok('le dernier touche le bord droit',
     bords !== null && Math.abs(bords.droite) <= 1, JSON.stringify(bords));
  ok('et les marges gauche et droite sont égales',
     bords !== null && Math.abs(bords.gauche - bords.droite) <= 1, JSON.stringify(bords));
  // La contrepartie assumée : des boutons un peu plus larges que les 28 px
  // d'origine, sans devenir des pavés.
  ok('les boutons se sont élargis en conséquence',
     bords !== null && bords.largeur > 28 && bords.largeur <= 44, JSON.stringify(bords));
  await page.close();
}

titre('57. Mémoire — un abonnement en cours passe avant un abonnement révolu');
{
  // Depuis que l'onglet des expirés est lu, des dizaines d'entrées arrivent
  // dans la même milliseconde que les abonnements en cours. Trier la purge sur
  // la seule date perdait alors des abonnements ACTIFS — ceux qui portent le
  // tri, la pastille et le style — au profit de révolus qui ne nourrissent
  // qu'un badge au survol.
  const PLAYER = '<!doctype html><html><body>x</body></html>';
  const TROP = () => {
    window.__noSubsPage = true;
    const m = {};
    const t = Date.now();
    // 420 révolus, au-delà de la borne de 400, tous datés du même instant.
    for (let i = 0; i < 420; i++) m['revolu' + i] = [0, t, 3, 1];
    // Et cinq abonnements EN COURS, noyés dedans.
    for (let i = 0; i < 5; i++) m['actif' + i] = [1, t];
    try { localStorage.setItem('tse:subs', JSON.stringify(m)); } catch {}
  };
  const page = await freshTwitch(PLAYER, [], '/', TROP);
  await wait(page, 1200);
  const vue = await page.evaluate(() => window.tse.subs());
  const actifs = vue.filter(e => e.sub).map(e => e.login).sort();
  ok('la mémoire est bien ramenée sous la borne', vue.length <= 400, String(vue.length));
  ok('et les cinq abonnements en cours ont tous survécu',
     actifs.join(',') === 'actif0,actif1,actif2,actif3,actif4', JSON.stringify(actifs));
  await page.close();
}

// ═════════ 58. Aperçu — l'interstitielle de classification est levée ═════════
titre('58. Aperçu — l\'écran « Commencer à regarder » ne doit plus figer la vignette');
{
  /* Le lecteur étiqueté, reproduit d'après la capture du 02/09/2026 : un
     sur-cadre [data-a-target="content-classification-gate-overlay"] contenant
     le bouton « Commencer à regarder ». La vidéo n'existe QU'APRÈS le clic —
     c'est tout le problème qu'on corrige : sans clic, aucune image, donc aucun
     signal de première image, donc une vignette figée pour toujours.

     `cedeAuClic` sépare les deux mondes : à true le bouton fait son office ;
     à false il est là mais ne ferme rien, ce qui modélise le jour où Twitch
     changera son interstitielle sans changer le nom du bouton. Le harnais ne
     peut pas prédire ce jour-là ; il peut vérifier qu'on y dégrade proprement. */
  const lecteurEtiquete = (cedeAuClic) => `<!doctype html><html><body>
    <div data-a-target="content-classification-gate-overlay">
      <p>Le contenu de cette chaîne est destiné à certains publics</p>
      <button data-a-target="content-classification-gate-overlay-start-watching-button">
        Commencer à regarder
      </button>
      <button data-a-target="content-classification-gate-overlay-go-home-button">
        Aller sur l'accueil
      </button>
    </div>
    <script>
      /* L'écouteur est posé AVANT les modules, et l'ordre est tout sauf un
         détail : à l'inverse, le pont cliquait un bouton encore sourd, la
         modale ne se fermait pas, et le harnais accusait le produit d'un défaut
         qui n'était que le sien. Sur le vrai Twitch, React attache son
         gestionnaire en rendant l'interstitielle — donc bien avant qu'un
         script tiers ne puisse cliquer. */
      window.__clics = 0;
      const zone = document.querySelector('[data-a-target="content-classification-gate-overlay"]');
      zone.querySelector('button').addEventListener('click', () => {
        window.__clics++;
        ${cedeAuClic ? `
        zone.remove();
        // La vidéo n'arrive qu'ici : c'est l'acquittement qui la débloque.
        const c = document.createElement('canvas');
        c.width = 32; c.height = 18;
        const ctx = c.getContext('2d');
        const v = document.createElement('video');
        v.autoplay = true; v.muted = true; v.playsInline = true;
        v.srcObject = c.captureStream(25);
        document.body.appendChild(v);
        v.play().catch(() => {});
        setInterval(() => {
          ctx.fillStyle = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
          ctx.fillRect(0, 0, 32, 18);
        }, 40);
        ` : '/* le bouton ne ferme rien : la modale tient bon */'}
      });
    </script>
    <script src="/adblock.test.js"></script>
    <script src="/content.test.js"></script>
  </body></html>`;

  const etatIframe = (page) => page.evaluate(() => {
    const f = document.querySelector('.tse-preview__iframe');
    return f ? (f.dataset.tseLoaded ?? 'posee') : 'pas-d-iframe';
  });
  // Le compteur de clics vit dans l'iframe : on va le chercher par sa frame.
  const clics = async (page) => {
    const f = page.frames().find(x => x.url().startsWith('https://player.twitch.tv/'));
    if (!f) return -1;
    try { return await f.evaluate(() => window.__clics ?? -1); } catch { return -1; }
  };
  const poserCarte = (page, login) => page.evaluate((l) => {
    window.__fx = { [l]: { id:'1', createdAt:new Date(Date.now()-3600_000).toISOString(),
                           viewers:1000, game:'G', tags:[],
                           // L'étiquette qui, jusqu'ici, suffisait à supprimer l'iframe.
                           ccl: [{ id: 'MatureGame' }] } };
    window.__addCard(l, 'G', '1 k');
  }, login);

  // ── a) l'interstitielle cède : la vidéo part, l'aperçu se dévoile ────────
  {
    const page = await freshTwitch(lecteurEtiquete(true));
    await poserCarte(page, 'alpha');
    await wait(page, 2000);
    await hoverCard(page, 0);

    // Avant tout : l'iframe doit exister. Jusqu'à la 3.54, une étiquette de
    // classification la faisait annuler — c'est le renoncement qu'on lève.
    await attendre(page, () => !!document.querySelector('.tse-preview__iframe'), 4000);
    ok('une chaîne étiquetée reçoit bien une iframe',
       (await etatIframe(page)) !== 'pas-d-iframe', await etatIframe(page));

    // La question qui compte pour l'œil : rien ne doit changer AVANT que la
    // vidéo ne parte. La vignette est dans le même conteneur que l'iframe, qui
    // se pose PAR-DESSUS et reste transparente jusqu'à sa première image — le
    // même enchaînement que sur une chaîne sans étiquette. C'est structurel, pas
    // une affaire d'instant : on le vérifie comme tel.
    const socle = await page.evaluate(() => {
      const wrap = document.querySelector('.tse-preview__thumb-wrap');
      const img = wrap && wrap.querySelector('.tse-preview__thumb');
      const f = wrap && wrap.querySelector('.tse-preview__iframe');
      return { vignette: !!img, chargee: img ? (img.dataset.tseLoaded ?? null) : null,
               memeConteneur: !!(img && f) };
    });
    ok('la vignette est posée sous l\'iframe, comme sans modale',
       socle.vignette && socle.memeConteneur && socle.chargee === 'true',
       JSON.stringify(socle));

    await attendre(page, () => {
      const f = document.querySelector('.tse-preview__iframe');
      return !!f && f.dataset.tseLoaded === 'true';
    }, 8000);
    ok('et elle se dévoile, donc la vidéo joue', (await etatIframe(page)) === 'true',
       await etatIframe(page));

    const n = await clics(page);
    ok('le bouton « Commencer à regarder » a bien été cliqué', n >= 1, String(n));
    ok('et une seule fois, sans boucle', n === 1, String(n));
    await page.close();
  }

  /* ── a bis) L'ORDRE DE LA PRODUCTION : la <video> AVANT la modale ─────────

     Le cas qui a échappé à la 3.55, et le seul qui compte vraiment : Twitch
     pose son élément <video> avec le lecteur, puis rend l'écran d'acquittement
     par-dessus. La veille du pont s'arrêtait alors juste avant — « une vidéo
     est sous surveillance, aucune modale à l'écran, il n'y a plus rien à
     faire » — et la modale apparaissait dans une frame que plus personne ne
     regardait. Le harnais ne pouvait pas le voir : il rendait sa modale
     d'emblée, donc AVANT la vidéo.

     La <video> est ici présente dès le départ mais SANS flux : readyState 0,
     aucun `playing`. Elle ne reçoit son canvas qu'au clic. C'est exactement ce
     que fait un lecteur bloqué par son écran d'acquittement. */
  {
    const lecteurVideoDAbord = `<!doctype html><html><body>
      <video id="v" autoplay muted playsinline></video>
      <script>
        window.__clics = 0;
        window.__modaleA = null;
        // La modale n'arrive qu'APRÈS : 400 ms, largement de quoi laisser la
        // veille se retirer si elle a le droit de le faire.
        setTimeout(() => {
          const zone = document.createElement('div');
          zone.setAttribute('data-a-target', 'content-classification-gate-overlay');
          zone.innerHTML = '<p>destiné à certains publics</p>' +
            '<button data-a-target="content-classification-gate-overlay-start-watching-button"' +
            ' style="width:120px;height:32px">Commencer à regarder</button>';
          document.body.appendChild(zone);
          window.__modaleA = performance.now();
          zone.querySelector('button').addEventListener('click', () => {
            window.__clics++;
            zone.remove();
            const c = document.createElement('canvas');
            c.width = 32; c.height = 18;
            const ctx = c.getContext('2d');
            const v = document.getElementById('v');
            v.srcObject = c.captureStream(25);
            v.play().catch(() => {});
            setInterval(() => {
              ctx.fillStyle = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
              ctx.fillRect(0, 0, 32, 18);
            }, 40);
          });
        }, 400);
      </script>
      <script src="/adblock.test.js"></script>
      <script src="/content.test.js"></script>
    </body></html>`;

    const page = await freshTwitch(lecteurVideoDAbord);
    await poserCarte(page, 'omega');
    await wait(page, 2000);
    await hoverCard(page, 0);

    await attendre(page, () => {
      const f = document.querySelector('.tse-preview__iframe');
      return !!f && f.dataset.tseLoaded === 'true';
    }, 9000);
    /* Dévoilée ET en train de jouer. La seule chose dévoilée ne prouve rien :
       sous la régression, le filet ordinaire dévoilait AUSSI — sauf qu'il
       dévoilait la modale. C'est la lecture effective qui sépare les deux. */
    const lecture = await (async () => {
      const f = page.frames().find(x => x.url().startsWith('https://player.twitch.tv/'));
      if (!f) return null;
      try {
        return await f.evaluate(() => {
          const v = document.getElementById('v');
          return v ? { pause: v.paused, pret: v.readyState } : null;
        });
      } catch { return null; }
    })();
    ok('modale rendue APRÈS la vidéo : l\'aperçu se dévoile ET la vidéo joue',
       (await etatIframe(page)) === 'true'
       && !!lecture && lecture.pause === false && lecture.pret >= 2,
       JSON.stringify({ iframe: await etatIframe(page), lecture }));
    const n = await clics(page);
    ok('et le bouton a bien été cliqué, la veille ne s\'était pas retirée',
       n === 1, String(n));

    // Le journal de diagnostic doit raconter la même histoire, dans l'ordre.
    const journal = await page.evaluate(() => window.tse.apercu().map(e => e.evt));
    ok('le journal note le pont, la modale, puis la première image',
       journal.includes('pont') && journal.includes('modale')
       && journal.indexOf('modale') < journal.indexOf('premiere-image'),
       JSON.stringify(journal));
    await page.close();
  }

  /* ── a ter) LE NŒUD <video> EST REMPLACÉ APRÈS L'ACQUITTEMENT ────────────

     Un lecteur ne garde pas forcément le même élément vidéo d'un bout à
     l'autre : quand la source repart — ce qui est précisément ce que fait
     l'acquittement de l'interstitielle — Twitch peut jeter son <video> et en
     poser un neuf. Le pont surveillait « une vidéo, la première trouvée » ; il
     restait alors accroché à un nœud détaché, où `playing` n'arrive jamais.
     Aucune première image annoncée, donc le filet d'interstitielle rend la main
     à la vignette — au moment même où la vidéo joue à côté, dans l'autre nœud.

     Le harnais force ce remplacement au clic. Sans le correctif, l'iframe
     disparaît ; avec, elle se dévoile et c'est le NOUVEAU nœud qui joue. */
  {
    const lecteurVideoRemplacee = `<!doctype html><html><body>
      <video id="v1" autoplay muted playsinline></video>
      <script>
        window.__clics = 0;
        setTimeout(() => {
          const zone = document.createElement('div');
          zone.setAttribute('data-a-target', 'content-classification-gate-overlay');
          zone.innerHTML = '<p>destiné à certains publics</p>' +
            '<button data-a-target="content-classification-gate-overlay-start-watching-button"' +
            ' style="width:120px;height:32px">Commencer à regarder</button>';
          document.body.appendChild(zone);
          zone.querySelector('button').addEventListener('click', () => {
            window.__clics++;
            zone.remove();
            // Le point du scénario : l'ancien nœud s'en va, un neuf le remplace.
            document.getElementById('v1').remove();
            const c = document.createElement('canvas');
            c.width = 32; c.height = 18;
            const ctx = c.getContext('2d');
            const v = document.createElement('video');
            v.id = 'v2';
            v.autoplay = true; v.muted = true; v.playsInline = true;
            v.srcObject = c.captureStream(25);
            document.body.appendChild(v);
            v.play().catch(() => {});
            setInterval(() => {
              ctx.fillStyle = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
              ctx.fillRect(0, 0, 32, 18);
            }, 40);
          });
        }, 400);
      </script>
      <script src="/adblock.test.js"></script>
      <script src="/content.test.js"></script>
    </body></html>`;

    const page = await freshTwitch(lecteurVideoRemplacee);
    await poserCarte(page, 'sigma');
    await wait(page, 2000);
    await hoverCard(page, 0);

    await attendre(page, () => {
      const f = document.querySelector('.tse-preview__iframe');
      return !!f && f.dataset.tseLoaded === 'true';
    }, 9000);
    const relais = await (async () => {
      const f = page.frames().find(x => x.url().startsWith('https://player.twitch.tv/'));
      if (!f) return null;
      try {
        return await f.evaluate(() => {
          const v = document.querySelector('video');
          return v ? { id: v.id, pause: v.paused, pret: v.readyState } : null;
        });
      } catch { return null; }
    })();
    ok('un <video> remplacé est repris en surveillance : l\'aperçu joue quand même',
       (await etatIframe(page)) === 'true'
       && !!relais && relais.id === 'v2' && relais.pause === false && relais.pret >= 2,
       JSON.stringify({ iframe: await etatIframe(page), relais }));
    await page.close();
  }

  // ── b) l'interstitielle tient bon : retour à la vignette, pas de modale ──
  {
    const page = await freshTwitch(lecteurEtiquete(false));
    await poserCarte(page, 'beta');
    await wait(page, 2000);
    await hoverCard(page, 0);

    await attendre(page, () => !!document.querySelector('.tse-preview__iframe'), 4000);
    ok('l\'iframe est tentée malgré tout', (await etatIframe(page)) !== 'pas-d-iframe',
       await etatIframe(page));

    // Le filet ORDINAIRE (1,5 s) dévoilerait ici. Il ne doit pas : ce qu'il
    // dévoilerait n'est pas un lecteur noir mais une modale en travers de
    // l'aperçu. C'est l'assertion qui distingue les deux filets.
    await wait(page, 2000);
    ok('le filet ordinaire ne dévoile pas la modale', (await etatIframe(page)) !== 'true',
       await etatIframe(page));

    // Et pendant ces deux secondes, ce que l'utilisateur voit est la vignette :
    // l'iframe est bien là, mais transparente. C'est ce qui distingue « pas
    // encore de vidéo » de « une modale en travers de l'aperçu ».
    const dessous = await page.evaluate(() => {
      const img = document.querySelector('.tse-preview__thumb');
      const f = document.querySelector('.tse-preview__iframe');
      return { chargee: img ? (img.dataset.tseLoaded ?? null) : null,
               opaciteIframe: f ? getComputedStyle(f).opacity : null };
    });
    ok('la vignette reste visible et l\'iframe transparente',
       dessous.chargee === 'true' && dessous.opaciteIframe === '0',
       JSON.stringify(dessous));

    // Et le filet d'interstitielle rend la main à la vignette.
    await attendre(page, () => !document.querySelector('.tse-preview__iframe'), 6000);
    ok('l\'iframe est retirée, la vignette reprend la main',
       (await etatIframe(page)) === 'pas-d-iframe', await etatIframe(page));
    const vignette = await page.evaluate(() =>
      !!document.querySelector('.tse-preview__thumb'));
    ok('et la vignette est toujours là pour la remplacer', vignette, String(vignette));
    await page.close();
  }
}

// ═════════ 59. Aperçu — le badge des étiquettes de classification ═════════
titre('59. Aperçu — ce que l\'interstitielle disait, le badge le dit maintenant');
{
  /* Lever l'écran d'acquittement sans afficher les étiquettes reviendrait à
     SUPPRIMER l'information au lieu de la déplacer. Ce scénario vérifie qu'elle
     est bien déplacée — et qu'un identifiant inconnu ne fuit pas brut dans
     l'interface. Le harnais tourne en français : les libellés attendus sont
     ceux de la table française. */
  const PLAYER_NU = '<!doctype html><html><body>lecteur</body></html>';
  const badgeCcl = (page) => page.evaluate(() => {
    const b = document.querySelector('.tse-preview__badge--ccl');
    if (!b) return null;
    const zone = b.parentElement;
    return {
      texte: b.querySelector('.tse-preview__badge-text').textContent.trim(),
      // Un avertissement se lit avant le contexte : il doit être le premier.
      premier: zone.firstElementChild === b,
      // La composition interne du badge, dans l'ordre du DOM.
      enfants: [...b.children].map(n => ({
        classe: n.className, texte: n.textContent.trim(),
        muet: n.getAttribute('aria-hidden'),
      })),
    };
  });
  const poser = (page, fixtures) => page.evaluate((fx) => {
    const h = new Date(Date.now() - 3600_000).toISOString();
    window.__fx = {};
    for (const [login, ccl] of Object.entries(fx)) {
      window.__fx[login] = { id: 'id-' + login, createdAt: h, viewers: 1000,
                             game: 'G', tags: [], ccl };
      window.__addCard(login, 'G', '1 k');
    }
  }, fixtures);

  {
    const page = await freshTwitch(PLAYER_NU);
    await poser(page, {
      alpha: [{ id: 'MatureGame' }],
      beta:  [{ id: 'Gambling' }, { id: 'SexualThemes' }],
      gamma: [{ id: 'UneEtiquetteQueTwitchAjouteraUnJour' }],
      delta: [],
    });
    await wait(page, 2000);

    await hoverCard(page, 0);
    await attendre(page, () => !!document.querySelector('.tse-preview__badge--ccl'), 5000);
    const un = await badgeCcl(page);
    ok('une étiquette connue est traduite', un && un.texte === 'Jeux matures',
       JSON.stringify(un));
    ok('et le badge passe en tête des autres', !!un && un.premier === true,
       JSON.stringify(un));
    /* Le pictogramme encadre le texte des DEUX côtés. À gauche seulement, il
       passerait pour une puce de liste ; de part et d'autre, il fait un
       panneau. Et il est aria-hidden : une synthèse vocale doit lire « Jeux
       matures », pas « avertissement Jeux matures avertissement ». */
    const marques = (un && un.enfants) || [];
    ok('un pictogramme ⚠️ de chaque côté du texte, muet pour les lecteurs d\'écran',
       marques.length === 3
       && marques[0].classe === 'tse-preview__badge-mark' && marques[0].texte === '⚠️'
       && marques[1].classe === 'tse-preview__badge-text'
       && marques[2].classe === 'tse-preview__badge-mark' && marques[2].texte === '⚠️'
       && marques[0].muet === 'true' && marques[2].muet === 'true',
       JSON.stringify(marques));
    await unhoverCard(page, 0);

    await hoverCard(page, 1);
    await attendre(page, () => !!document.querySelector('.tse-preview__badge--ccl'), 5000);
    const deux = await badgeCcl(page);
    ok('deux étiquettes tiennent dans un seul badge',
       !!deux && deux.texte === 'Jeux d\'argent · Thèmes sexuels', JSON.stringify(deux));
    await unhoverCard(page, 1);

    await hoverCard(page, 2);
    await attendre(page, () => !!document.querySelector('.tse-preview__badge--ccl'), 5000);
    const trois = await badgeCcl(page);
    // Le point qui compte : « UneEtiquetteQueTwitchAjouteraUnJour » dans une
    // interface française serait pire que rien.
    ok('une étiquette inconnue passe au libellé générique, jamais son identifiant',
       !!trois && trois.texte === 'Contenu classifié', JSON.stringify(trois));
    await unhoverCard(page, 2);

    await hoverCard(page, 3);
    await wait(page, 1500);
    const quatre = await badgeCcl(page);
    ok('et une chaîne sans étiquette n\'a pas de badge du tout', quatre === null,
       JSON.stringify(quatre));
    await page.close();
  }
}

// ═════════ 60. Aperçu — chaque type de badge a SA couleur ═════════
titre('60. Aperçu — chaque type de badge a sa couleur, et elles sont distinctes');
{
  /* Le défaut que ce scénario existe pour empêcher est déjà arrivé : le badge
     d'étiquettes est né ambre, à 2° de teinte du badge hype train — la même
     couleur à l'œil, sur deux badges qui peuvent coexister. Personne ne l'avait
     vu, parce que « ambre » et « orange » sont deux mots différents et que
     personne n'avait sorti la calculatrice.

     Deux choses sont vérifiées, et il faut les deux :
      a) chaque type a une couleur DÉFINIE — une classe sans règle héritera du
         gris de base sans que rien ne proteste ;
      b) les couleurs sont DISTINCTES — deux règles peuvent exister et dire la
         même chose.

     Le type « other » (ligne annexe non identifiée, cf. markExtraRows) est
     volontairement absent de la liste : il n'a pas de modificateur et tombe sur
     le gris de base, ce qui est sa couleur définie. */
  const TYPES = ['hype', 'discount', 'costream', 'squad', 'sponsor', 'sub', 'exsub', 'ccl'];

  const page = await freshTwitch('<!doctype html><html><body>lecteur</body></html>');
  await wait(page, 2000);
  const releve = await page.evaluate((types) => {
    // Les badges sont mesurés DANS le popup : sa couleur de fond compose les
    // fonds translucides, et c'est la composition qui se voit, pas le rgba.
    const hote = document.createElement('div');
    hote.className = 'tse-preview';
    hote.style.cssText = 'opacity:1;left:0;top:0';
    hote.innerHTML = '<div class="tse-preview__body"><div class="tse-preview__badges">' +
      types.map(t => `<span class="tse-preview__badge tse-preview__badge--${t}">x</span>`).join('') +
      '<span class="tse-preview__badge">base</span>' +
      '</div></div>';
    document.body.appendChild(hote);
    const lus = [...hote.querySelectorAll('.tse-preview__badge')].map(el => {
      const cs = getComputedStyle(el);
      return { fond: cs.backgroundColor, texte: cs.color };
    });
    const popup = getComputedStyle(hote).backgroundColor;
    hote.remove();
    return { lus, popup };
  }, TYPES);

  const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const composer = ([r, g, b, a = 1], base) =>
    [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
  const teinte = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return null;                       // gris : pas de teinte à comparer
    const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2)
                                                                    : ((r - g) / d + 4);
    return Math.round(h * 60);
  };
  const ecart = (a, b) => { const d = Math.abs(a - b) % 360; return Math.round(d > 180 ? 360 - d : d); };
  const fondPopup = rgba(releve.popup);
  const base = releve.lus[TYPES.length];       // le badge sans modificateur
  const badges = TYPES.map((t, i) => ({
    type: t,
    fond: releve.lus[i].fond, texte: releve.lus[i].texte,
    hFond: teinte(composer(rgba(releve.lus[i].fond), fondPopup)),
    hTexte: teinte(rgba(releve.lus[i].texte)),
  }));

  // a) une couleur DÉFINIE : ni le fond ni le texte ne doivent être ceux du
  //    badge de base, sinon la classe n'a simplement pas de règle.
  const sansRegle = badges.filter(b => b.fond === base.fond || b.texte === base.texte);
  ok('les huit types de badge ont chacun une couleur définie',
     sansRegle.length === 0, JSON.stringify(sansRegle.map(b => b.type)));

  // b) DISTINCTES : deux règles peuvent exister et dire la même chose.
  const doublons = [];
  for (let i = 0; i < badges.length; i++) for (let j = i + 1; j < badges.length; j++) {
    if (badges[i].fond === badges[j].fond) doublons.push([badges[i].type, badges[j].type, 'fond']);
    if (badges[i].texte === badges[j].texte) doublons.push([badges[i].type, badges[j].type, 'texte']);
  }
  ok('et aucune paire ne partage exactement la même couleur',
     doublons.length === 0, JSON.stringify(doublons));

  /* c) L'écart de TEINTE, qui est ce que l'œil lit vraiment, avec le seuil de
        20° sous lequel deux teintes cessent d'être deux couleurs.

        Trois paires en sont dispensées, et aucune ne l'est par commodité :

         • sub ↔ exsub (2°) — c'est le MÊME or à dessein. « Abonné » et « ancien
           abonné » sont le même signal, l'un désaturé ; les distinguer par la
           teinte contredirait ce qu'ils disent.

         • hype ↔ sub (13°) et hype ↔ exsub (15°) — les deux teintes sont
           ANCRÉES hors de la palette : l'orange du hype est celui de Twitch
           (rgb 255,105,5), l'or du badge d'abonnement est celui du filet des
           cartes abonnées (--tse-sub-or, 38°), qui existe précisément pour
           qu'on reconnaisse le signal d'une surface à l'autre. Les écarter
           demanderait de rompre l'un des deux ancrages — un arbitrage de
           produit, pas une correction, et il n'a pas été rendu.

        La différence avec l'ambre que le rouge remplace est là : l'ambre
        n'était ancrée à rien. Elle était libre, et elle s'était posée à 2° du
        hype train. Cette liste ne doit donc s'allonger que pour une couleur
        qui, elle aussi, tient à quelque chose d'extérieur. */
  const ANCREES = new Set(['sub|exsub', 'hype|sub', 'hype|exsub']);
  const trop = [];
  for (let i = 0; i < badges.length; i++) for (let j = i + 1; j < badges.length; j++) {
    const a = badges[i], b = badges[j];
    if (ANCREES.has(`${a.type}|${b.type}`)) continue;
    if (a.hTexte == null || b.hTexte == null) continue;
    const d = ecart(a.hTexte, b.hTexte);
    if (d < 20) trop.push([a.type, b.type, d + '°']);
  }
  ok('aucune paire librement choisie sous 20° de teinte',
     trop.length === 0, JSON.stringify(trop));

  /* d) La paire qui a motivé le rouge, nommée explicitement. Le badge
        d'étiquettes et le hype train peuvent coexister sur la même chaîne, et
        ils étaient à 2°. Sur le TEXTE comme sur le FOND : la 3.55 les avait
        rapprochés des deux côtés à la fois. */
  const ccl = badges.find(b => b.type === 'ccl');
  const hype = badges.find(b => b.type === 'hype');
  ok('le badge d\'étiquettes est franchement rouge, loin de l\'orange du hype train',
     ecart(ccl.hTexte, hype.hTexte) >= 20 && ecart(ccl.hFond, hype.hFond) >= 20
     && (ccl.hTexte >= 330 || ccl.hTexte <= 10),
     JSON.stringify({ texte: [ccl.hTexte, hype.hTexte, ecart(ccl.hTexte, hype.hTexte) + '°'],
                      fond:  [ccl.hFond,  hype.hFond,  ecart(ccl.hFond,  hype.hFond)  + '°'] }));
  await page.close();
}

// ═════════ 61. Firefox — le pont privé des API que Chrome a en plus ═════════
titre('61. Firefox — l\'aperçu tient sans les API que Chrome a en plus');
{
  /* Ce dépôt ne peut pas lancer Firefox : la politique réseau de
     l'environnement bloque le téléchargement du binaire de Playwright. On ne
     va donc PAS prétendre avoir vérifié le portage bout en bout. Ce qu'on peut
     faire — et qui vaut mieux qu'une lecture — c'est reproduire dans Chromium
     les manques exacts de Firefox et regarder le code s'en sortir.

     Deux API que Chrome a et que Firefox n'a pas au plancher déclaré (140),
     retirées par DEUX mécanismes différents, et la différence n'est pas un
     détail de mise en œuvre :

      • location.ancestorOrigins — jamais implémentée par Firefox avant ~148
        (Mozilla la tenait pour une fuite de vie privée). Le pont s'en sert
        pour VISER son postMessage ; sans elle, il retombe sur les deux
        origines que le manifeste déclare. C'est LA divergence du portage, et
        un repli cassé ne se verrait nulle part : l'aperçu ne se dévoilerait
        simplement jamais sous Firefox.

        Elle est [LegacyUnforgeable] — propriété propre, non configurable —
        donc impossible à retirer depuis la page. Le retrait se fait à la
        construction, sur une copie (cf. tests/build.mjs), et ce scénario
        charge cette variante : /content.firefox.test.js.

      • requestVideoFrameCallback — arrivée en Firefox 132, donc présente au
        plancher. Elle est tout de même retirée ici, et celle-là POUR DE VRAI
        depuis la page : le réglage media.rvfc.enabled peut la couper, et la
        course à trois signaux du pont doit tenir sur les deux qui restent.

     Le décor est VÉRIFIÉ avant tout le reste (window.__fxSansApi). La première
     version de ce scénario croyait retirer ancestorOrigins par `delete` et ne
     retirait rien : ses deux assertions vertes ne testaient personne. */
  const lecteurFirefox = `<!doctype html><html><body>
    <script>
      // rVFC vit sur le prototype et s'y supprime pour de bon. ancestorOrigins,
      // elle, résiste — c'est la variante de build qui s'en charge.
      delete HTMLVideoElement.prototype.requestVideoFrameCallback;
      window.__fxSansApi = {
        rvfc: !('requestVideoFrameCallback' in HTMLVideoElement.prototype),
      };
    </script>
    <script>
      const c = document.createElement('canvas');
      c.width = 32; c.height = 18;
      const ctx = c.getContext('2d');
      const v = document.createElement('video');
      v.autoplay = true; v.muted = true; v.playsInline = true;
      v.srcObject = c.captureStream(25);
      document.body.appendChild(v);
      v.play().catch(() => {});
      setInterval(() => {
        ctx.fillStyle = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 32, 18);
      }, 40);
    </script>
    <script src="/adblock.test.js"></script>
    <script src="/content.firefox.test.js"></script>
  </body></html>`;

  const page = await freshTwitch(lecteurFirefox);
  await page.evaluate(() => {
    window.__fx = { renard: { id: 'r1', createdAt: new Date(Date.now() - 3600_000).toISOString(),
                              viewers: 1000, game: 'G', tags: [] } };
    window.__addCard('renard', 'G', '1 k');
  });
  await wait(page, 2000);
  await hoverCard(page, 0);

  await attendre(page, () => {
    const f = document.querySelector('.tse-preview__iframe');
    return !!f && f.dataset.tseLoaded === 'true';
  }, 9000);

  // D'abord : le décor est-il bien celui qu'on croit ? Un `delete` qui aurait
  // échoué rendrait tout le reste du scénario complaisant.
  const decor = await (async () => {
    const f = page.frames().find(x => x.url().startsWith('https://player.twitch.tv/'));
    if (!f) return null;
    try {
      return await f.evaluate(() => ({
        rvfc: window.__fxSansApi?.rvfc ?? null,
        // La variante de build est-elle bien celle qui tourne ? On lit la
        // ligne substituée dans le source servi, pas une intention.
        variante: [...document.scripts].some(s => s.src.endsWith('/content.firefox.test.js')),
      }));
    } catch { return null; }
  })();
  ok('le décor est bien celui qu\'on croit : rVFC retirée, variante Firefox chargée',
     !!decor && decor.rvfc === true && decor.variante === true,
     JSON.stringify(decor));

  const etat = await page.evaluate(() => {
    const f = document.querySelector('.tse-preview__iframe');
    return f ? (f.dataset.tseLoaded ?? 'posee') : 'pas-d-iframe';
  });
  ok('sans ancestorOrigins ni rVFC, l\'aperçu se dévoile quand même',
     etat === 'true', etat);

  /* Le postMessage a bien traversé : c'est LE point du repli d'origines. Le
     journal ne peut porter « pont » que si un message est arrivé au parent,
     donc si la cible de repli était la bonne. */
  const journal = await page.evaluate(() => window.tse.apercu().map(e => e.evt));
  ok('le pont a parlé et la première image est passée par les origines de repli',
     journal.includes('pont') && journal.includes('premiere-image'),
     JSON.stringify(journal));
  await page.close();
}

// ═════════ 62. Le rendu ne construit plus de balisage ═════════
titre('62. Rendu — une donnée de Twitch est du TEXTE, jamais du balisage');
{
  /* Ce scénario existe pour une raison précise. Jusqu'ici le rendu assemblait
     des chaînes HTML et comptait sur `escapeHtml` à chaque point d'insertion.
     C'était correct — on l'a relu site par site — mais la correction tenait à
     ce qu'aucun appel n'oublie l'échappement, et aucune relecture ne garantit
     ça pour l'avenir. Le rendu construit maintenant des NŒUDS : les valeurs
     venues de Twitch passent par textContent ou setAttribute, qui ne peuvent
     rien interpréter. `escapeHtml` a disparu du fichier faute d'appelant.

     Le banc ne couvrait ni le contenu de ces badges ni cette propriété : la
     refonte aurait pu perdre le <strong> des noms, ou pire, sans rien casser
     de visible. Trois choses sont donc vérifiées ici — la phrase traduite, le
     <strong> autour du nom, et qu'un nom hostile reste du texte. */
  const PIEGE = '<img src=x onerror="window.__injecte=1">Marmotte';

  const page = await freshTwitch('<!doctype html><html><body>lecteur</body></html>');
  await page.evaluate(() => { window.__injecte = 0; });

  // Carte « squad » : le badge « En live avec … » se déclenche sur un
  // mini-avatar dont l'alt porte le nom de l'invité (cf. getSquadInfo).
  await page.evaluate((piege) => {
    const h = new Date(Date.now() - 3600_000).toISOString();
    window.__fx = {
      corbeau: { id: 'c1', createdAt: h, viewers: 1000, game: 'G', tags: [] },
      // La CATÉGORIE vient de l'API et alimente la liste déroulante des
      // filtres : c'est l'autre chemin par lequel du texte de Twitch atteint
      // le DOM, et il passe par le code refondu des options.
      belette: { id: 'b1', createdAt: h, viewers: 900, game: piege, tags: [] },
    };
    window.__addCard('corbeau', 'G', '1 k');
    window.__addCard('belette', 'G', '900');
    const carte = [...document.querySelectorAll('.side-nav-card')]
      .find(c => c.querySelector('a')?.getAttribute('href') === '/corbeau');
    const mini = document.createElement('div');
    mini.className = 'primary-with-small-avatar__mini-avatar';
    const img = document.createElement('img');
    img.setAttribute('alt', piege);       // le nom de l'invité, piégé
    mini.appendChild(img);
    carte.querySelector('a').appendChild(mini);
  }, PIEGE);
  await wait(page, 2500);

  await hoverCard(page, 0);
  await attendre(page, () => !!document.querySelector('.tse-preview__badge--squad'), 5000);
  const squad = await page.evaluate(() => {
    const b = document.querySelector('.tse-preview__badge--squad');
    if (!b) return null;
    const fort = b.querySelector('strong');
    return {
      texte: b.textContent.trim(),
      nomEnGras: fort ? fort.textContent : null,
      // Le piège a-t-il produit un ÉLÉMENT ? C'est la question qui compte.
      imgInjectee: !!b.querySelector('img'),
      injecte: window.__injecte,
    };
  });

  /* La phrase traduite doit être intacte : le <strong> est sorti des tables de
     locale, mais pas un mot du libellé. Le harnais tourne en français. */
  ok('la phrase traduite a survécu à la sortie du HTML des locales',
     !!squad && squad.texte.startsWith('En live avec '), JSON.stringify(squad?.texte));

  ok('le nom de l\'invité est bien en gras, via la fente',
     !!squad && squad.nomEnGras === PIEGE, JSON.stringify(squad?.nomEnGras));

  /* LE point du scénario. Sous l'ancien rendu, oublier un escapeHtml ici
     insérait une <img> et exécutait son onerror. Avec textContent, le même
     nom est affiché caractère pour caractère et rien ne s'exécute. */
  ok('un nom hostile reste du texte : aucune balise, aucun code exécuté',
     !!squad && squad.imgInjectee === false && squad.injecte === 0,
     JSON.stringify({ img: squad?.imgInjectee, injecte: squad?.injecte }));
  await unhoverCard(page, 0);

  // L'autre chemin : la catégorie que Twitch renvoie, affichée dans la liste
  // déroulante des filtres (code des options, refondu lui aussi).
  const option = await page.evaluate((piege) => {
    const opts = [...document.querySelectorAll('.tse-dd--cat .tse-dd-opt')];
    const cible = opts.find(o => o.dataset.value === piege);
    if (!cible) return { trouvee: false, valeurs: opts.map(o => o.dataset.value) };
    return {
      trouvee: true,
      texte: cible.querySelector('.tse-dd-name')?.textContent ?? null,
      imgInjectee: !!cible.querySelector('img'),
      injecte: window.__injecte,
    };
  }, PIEGE);
  ok('une catégorie hostile s\'affiche en toutes lettres, sans rien exécuter',
     option.trouvee && option.texte === PIEGE
     && option.imgInjectee === false && option.injecte === 0,
     JSON.stringify(option));
  await page.close();
}

// ═════════ 63. Basculement de catégorie ═════════
titre('63. Aperçu — « Vient de passer sur … », et seulement quand c\'en est un');
{
  /* Twitch n'annonce nulle part qu'une chaîne vient de changer de catégorie :
     l'information naît de la COMPARAISON de deux relevés, que le pipeline fait
     déjà toutes les 30 s et jetait jusqu'ici.

     Tout le scénario porte sur la DISTINCTION demandée : un basculement en
     cours de session mérite le badge, un début de stream non. La différence se
     lit sur `stream.id`, que le harnais sait maintenant piloter (`sid`).

     Le badge est aussi PÉRISSABLE, et sa péremption est vérifiée par le temps
     réel du navigateur — pas par une horloge simulée : le harnais accélère les
     cadences du pipeline, jamais Date.now(). On abaisse donc le TTL depuis la
     page pour que dix minutes tiennent dans un test. */
  const page = await freshTwitch('<!doctype html><html><body>lecteur</body></html>');
  const badgeSwitch = (page) => page.evaluate(() => {
    const b = document.querySelector('.tse-preview__badge--switch');
    if (!b) return null;
    const zone = b.parentElement;
    return { texte: b.textContent.trim(),
             gras: b.querySelector('strong')?.textContent ?? null,
             premier: zone.firstElementChild === b };
  });

  const h = () => new Date(Date.now() - 3600_000).toISOString();
  await page.evaluate((ts) => {
    const vieux = new Date(Date.now() - 3600_000).toISOString();
    window.__fx = {
      // Bascule en cours de session : même sid, catégorie qui change.
      renard:  { id: 'r', sid: 's-fixe', createdAt: vieux, viewers: 1000, game: 'Pêche', tags: [] },
      // Nouvelle session : le sid changera EN MÊME TEMPS que la catégorie.
      blaireau:{ id: 'b', sid: 'sess-1',  createdAt: vieux, viewers: 900,  game: 'Pêche', tags: [] },
      // Témoin : ne bouge pas du tout.
      loutre:  { id: 'l', sid: 's-loutre', createdAt: vieux, viewers: 800, game: 'Pêche', tags: [] },
    };
    window.__addCard('renard', 'Pêche', '1 k');
    window.__addCard('blaireau', 'Pêche', '900');
    window.__addCard('loutre', 'Pêche', '800');
  }, h());
  await wait(page, 2500);

  // ── a) le témoin, avant tout : aucun badge sans changement ──────────────
  await hoverCard(page, 2);
  await wait(page, 1500);
  ok('une chaîne qui ne change pas de catégorie n\'a pas de badge',
     (await badgeSwitch(page)) === null, JSON.stringify(await badgeSwitch(page)));
  await unhoverCard(page, 2);

  // ── b) LE cas : bascule en cours de session ─────────────────────────────
  await page.evaluate(() => { window.__fx.renard.game = 'Elden Ring'; });
  await attendre(page, () => (window.tse.bascules?.() || []).length > 0, 6000);
  await hoverCard(page, 0);
  await attendre(page, () => !!document.querySelector('.tse-preview__badge--switch'), 5000);
  const bascule = await badgeSwitch(page);
  ok('un changement en cours de session affiche « Vient de passer sur … »',
     !!bascule && bascule.texte === 'Vient de passer sur Elden Ring', JSON.stringify(bascule));
  ok('le nom du jeu est en gras, via la fente',
     !!bascule && bascule.gras === 'Elden Ring', JSON.stringify(bascule?.gras));
  ok('et le badge est en tête : une nouvelle se lit avant le contexte',
     !!bascule && bascule.premier === true, JSON.stringify(bascule));
  await unhoverCard(page, 0);

  // ── c) un DÉBUT de stream n'est pas un basculement ──────────────────────
  /* Le sid change en même temps que la catégorie : c'est une nouvelle session,
     pas un streamer qui bascule. C'est exactement la confusion que le badge ne
     doit pas faire, et le seul point où `stream.id` gagne son existence. */
  await page.evaluate(() => {
    window.__fx.blaireau.sid = 'sess-2';
    window.__fx.blaireau.game = 'Minecraft';
  });
  await wait(page, 3000);
  await hoverCard(page, 1);
  await wait(page, 1500);
  const debut = await badgeSwitch(page);
  ok('une NOUVELLE session ne déclenche pas le badge, même si la catégorie diffère',
     debut === null, JSON.stringify(debut));
  await unhoverCard(page, 1);

  /* ── d) la péremption ────────────────────────────────────────────────────

     Le badge est PÉRISSABLE, et c'est la moitié de son comportement : celui
     qui ne s'efface pas finit par mentir sur la fraîcheur de ce qu'il annonce.

     tests/build.mjs ramène CATEGORY_SWITCH_TTL de dix minutes à 2,5 s, comme
     il le fait pour les autres durées de production. C'est donc la MÊME
     horloge et le MÊME code qui périment l'entrée — on ne déplace pas un
     horodatage à la main.

     Ce cas a d'ailleurs corrigé sa première écriture : le basculement de (b)
     avait déjà péri pendant les 3 s du cas (c), et l'assertion « encore
     frais » tombait. Elle mesurait l'ordre du scénario, pas le registre. D'où
     un basculement NEUF, déclenché ici. */
  await page.evaluate(() => { window.__fx.loutre.game = 'Factorio'; });
  await attendre(page, () =>
    window.tse.bascules().some(b => b['passée sur'] === 'Factorio'), 6000);
  const frais = await page.evaluate(() =>
    window.tse.bascules().find(b => b['passée sur'] === 'Factorio') ?? null);
  ok('un basculement neuf est listé, avec sa catégorie et son âge',
     !!frais && frais['il y a (s)'] >= 0, JSON.stringify(frais));

  await hoverCard(page, 2);
  await attendre(page, () => !!document.querySelector('.tse-preview__badge--switch'), 5000);
  ok('et son badge est bien à l\'écran avant la péremption',
     (await badgeSwitch(page))?.texte === 'Vient de passer sur Factorio',
     JSON.stringify(await badgeSwitch(page)));
  await unhoverCard(page, 2);

  await wait(page, 3000);
  const apres = await page.evaluate(() =>
    window.tse.bascules().filter(b => b['passée sur'] === 'Factorio').length);
  ok('passé le délai, le basculement n\'est plus listé', apres === 0, String(apres));

  await hoverCard(page, 2);
  await wait(page, 1500);
  ok('et le badge a disparu de l\'aperçu', (await badgeSwitch(page)) === null,
     JSON.stringify(await badgeSwitch(page)));
  await page.close();
}

// ═════════ 64. Les cinq langues ajoutées ═════════
titre('64. Localisation — italien, polonais, russe, japonais, chinois');
{
  /* La parité des clés (scénario 18) dit qu'aucune table n'a de trou. Elle ne
     dit rien de ce qui compte ici : que la langue se DÉTECTE, et que ce qui
     s'affiche soit juste dans cette langue.

     a) La DÉTECTION s'observe par un effet mesurable plutôt que par une
        variable interne : la clé `locale` de chaque table pilote le formatage
        des nombres. Si la table choisie est la bonne, 29339 s'écrit avec le
        séparateur du pays ; sinon, avec celui de l'anglais.

     b) Le PLURIEL SLAVE est le point aveugle du lot. Le français et l'anglais
        n'ont que deux formes ; le polonais et le russe en ont TROIS, et la
        troisième reprend la main sur 11-14 malgré leur chiffre des unités.
        Aucune relecture non slavophone ne repère une branche fausse — seul un
        tableau de valeurs le fait. Il est écrit à la main d'après la
        grammaire, JAMAIS recopié de la sortie du code : un tableau produit par
        le code ne ferait que confirmer son propre bug. */

  // ── a) la détection, lue dans deux effets mesurables ─────────────────────
  /* Le libellé français est RETIRÉ du DOM, et c'est le cœur du montage. La
     détection consulte d'abord les libellés natifs de Twitch ; le harnais en
     porte un en français, qui gagnerait sur html.lang et rendrait le test muet
     — première écriture de ce scénario, six assertions vertes en apparence et
     « 29,3 k » partout, c'est-à-dire du français.

     Sans ce libellé, on reproduit exactement la situation d'un utilisateur
     italien, polonais, russe, japonais ou chinois : l'interface de Twitch est
     dans une langue dont l'extension ne connaît AUCUN libellé, la détection
     passe donc par html.lang, et la sidebar tient sur son ancre structurelle
     (followed-side-nav-header). Les deux mécanismes de repli sont éprouvés
     ensemble, ce qui est bien ce qu'on veut vérifier. */
  const rendusDe = async (htmlLang) => {
    const page = await browser.newPage();
    page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
    await page.goto(URL_PAGE);
    await page.evaluate((l) => {
      document.querySelector('.side-nav-section').removeAttribute('aria-label');
      document.documentElement.lang = l;
      window.__fx = { alpha: { id: '1', createdAt: new Date(Date.now() - 3600_000).toISOString(),
                               viewers: 29339, game: 'G', tags: [] } };
      window.__addCard('alpha', 'G', '29 339');
    }, htmlLang);
    await wait(page, 2000);
    const s = await state(page);
    const onglet = await page.evaluate(() =>
      document.querySelector('.tse-mode-tab')?.textContent ?? null);
    await page.close();
    return { nombre: nz(s[0]?.shown ?? ''), onglet };
  };

  /* Deux signaux, et il faut les deux. Le LIBELLÉ prouve que c'est la bonne
     table qui est branchée ; le NOMBRE prouve que sa clé `locale` est juste —
     une table peut être choisie correctement et porter un mauvais code de
     locale, auquel cas les chiffres sortiraient dans la convention d'un autre
     pays sans que le texte le laisse voir.

     Les formats sont relevés DANS CHROMIUM, et il fallait le faire : l'ICU de
     Node rend « 29,3K » pour l'italien là où celle du navigateur rend
     « 29.339 ». Une valeur attendue prise dans le mauvais moteur fait échouer
     un test qui n'a rien à reprocher au code — c'est arrivé ici. Le japonais
     et le chinois comptent par myriades (2.9万), le polonais et le russe
     écrivent leur abréviation en toutes lettres. */
  for (const [htmlLang, libelle, nombre, nom] of [
    ['it-IT', 'Canali seguiti',        '29.339',    'italien'],
    ['pl-PL', 'Obserwowane kanały',    '29,3 tys.', 'polonais'],
    ['ru-RU', 'Отслеживаемые каналы',  '29,3 тыс.', 'russe'],
    ['ja-JP', 'フォロー中のチャンネル',      '2.9万',      'japonais'],
    ['zh-CN', '关注的频道',              '2.9万',      'chinois'],
  ]) {
    const r = await rendusDe(htmlLang);
    ok(`${nom} : le libellé vient de la bonne table`, r.onglet === libelle, String(r.onglet));
    ok(`${nom} : et sa clé locale formate les nombres du pays (${nombre})`,
       r.nombre === nombre, r.nombre);
  }

  /* zh-TW n'a pas sa table : il retombe sur `zh` par le préfixe à deux lettres,
     et non sur l'anglais. Mieux vaut du chinois simplifié que de l'anglais pour
     un lecteur de Taïwan. */
  const tw = await rendusDe('zh-TW');
  ok('zh-TW retombe sur la table chinoise, pas sur l\'anglais',
     tw.onglet === '关注的频道', String(tw.onglet));

  /* Et une langue vraiment inconnue retombe sur l'anglais — le défaut, qui
     doit rester atteignable maintenant que neuf préfixes le précèdent. */
  const xx = await rendusDe('xx-XX');
  ok('une langue inconnue retombe toujours sur l\'anglais',
     xx.onglet === 'Followed Channels', String(xx.onglet));

  // ── b) le pluriel slave, par analyse statique ────────────────────────────
  {
    const src = readFileSync(join(ICI, 'content.test.js'), 'utf8');
    const regle = src.match(/const plurielSlave = \([\s\S]*?\n {2}\};/)[0];
    const subMonthsDe = (lang) => {
      const bloc = src.match(new RegExp('\\n    ' + lang + ': Object\\.freeze\\(\\{([\\s\\S]*?)\\n    \\}\\)'))[1];
      return bloc.match(/uiBadgeSubMonths:\s*(\(n\) => `[^`]*`)/)[1];
    };
    const fabriquer = (lang) => new Function(`${regle}\nreturn ${subMonthsDe(lang)};`)();

    const attendus = {
      pl: { 1: '1 miesiąc', 2: '2 miesiące', 4: '4 miesiące', 5: '5 miesięcy',
            11: '11 miesięcy', 12: '12 miesięcy', 14: '14 miesięcy',
            21: '21 miesiąc', 22: '22 miesiące', 25: '25 miesięcy',
            111: '111 miesięcy', 122: '122 miesiące' },
      ru: { 1: '1 месяц', 2: '2 месяца', 4: '4 месяца', 5: '5 месяцев',
            11: '11 месяцев', 12: '12 месяцев', 14: '14 месяцев',
            21: '21 месяц', 22: '22 месяца', 25: '25 месяцев',
            111: '111 месяцев', 122: '122 месяца' },
    };
    for (const [lang, table] of Object.entries(attendus)) {
      const f = fabriquer(lang);
      const faux = [];
      for (const [n, attendu] of Object.entries(table)) {
        const rendu = f(Number(n));
        if (!rendu.endsWith(attendu)) faux.push(`${n} → « ${rendu} », attendu « …${attendu} »`);
      }
      ok(`pluriel ${lang} : les trois formes, y compris le piège des 11-14`,
         faux.length === 0, faux.join(' | '));
    }
  }
}

// ═════════ 65. Nom canonique et nom traduit ═════════
titre('65. Catégories — l\'identité décide, la traduction s\'affiche');
{
  /* Le défaut, tel qu'il se voyait : sous une interface française, la carte
     annonçait « Just Chatting » là où Twitch écrivait « Discussions ». La
     sidebar prenait le nom que rend `game.name` — le nom CANONIQUE, celui des
     URL — et l'écrivait par-dessus le libellé traduit que Twitch avait déjà
     posé. L'extension remplaçait donc du français par de l'anglais.

     Le nom canonique n'est pas pour autant à jeter : c'est lui, et lui seul,
     que `game(name:)` accepte, et c'est de lui que dépendent le filtre, le
     regroupement des co-streams et la détection d'un basculement. Les deux
     valeurs existent donc côte à côte — `game` pour l'identité, `gameLabel`
     pour l'affichage — et ce scénario vérifie qu'aucune des deux ne prend le
     travail de l'autre.

     Le stub traduit d'après Accept-Language, comme Twitch. Sans cela rien ne
     distinguerait une extension qui affiche la traduction d'une qui affiche
     l'anglais : les deux chaînes seraient égales, et six assertions vertes
     n'auraient rien prouvé. */

  const cartes = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')].map(c => {
      const el = c.querySelector('[data-a-target="side-nav-card-metadata"] p[title]');
      return { login: c.dataset.tseLogin,
               texte: el?.textContent?.trim() ?? null,
               infobulle: el?.getAttribute('title') ?? null,
               identite: c.dataset.tseCategory ?? null,
               libelle: c.dataset.tseCategoryLabel ?? null };
    }));

  const options = (page) => page.evaluate(() =>
    [...document.querySelectorAll('#tse-cat-dd .tse-dd-opt')]
      .filter(o => o.dataset.value)
      .map(o => ({ valeur: o.dataset.value,
                   libelle: o.querySelector('.tse-dd-name')?.textContent ?? null })));

  const monter = async (htmlLang) => {
    const page = await browser.newPage();
    page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
    await page.goto(URL_PAGE);
    await page.evaluate((l) => {
      // Le libellé natif du harnais est français et gagnerait sur html.lang :
      // on le retire pour que la langue demandée soit bien celle qui décide
      // (même montage qu'au scénario 64).
      document.querySelector('.side-nav-section').removeAttribute('aria-label');
      document.documentElement.lang = l;
      const vieux = new Date(Date.now() - 3600_000).toISOString();
      window.__fx = {
        alpha: { id: 'a', sid: 's-a', createdAt: vieux, viewers: 1000,
                 game: 'Just Chatting', tags: [] },
        beta:  { id: 'b', sid: 's-b', createdAt: vieux, viewers: 900,
                 game: 'Elden Ring', tags: [] },
      };
      // Le DOM porte le nom canonique : c'est le cas le PLUS défavorable, celui
      // où l'extension doit écrire quelque chose plutôt que se taire.
      window.__addCard('alpha', 'Just Chatting', '1 k');
      window.__addCard('beta',  'Elden Ring',    '900');
    }, htmlLang);
    /* On attend que TseChannels ait RÉPONDU et que sa réponse soit posée, pas
       seulement que les cartes existent : data-tse-category est amorcé depuis
       le DOM avant toute requête, et s'y fier faisait tout lire une seconde
       trop tôt — première écriture de ce scénario, quatre assertions rouges
       qui décrivaient l'état d'avant la réponse. Le compteur repris par
       l'extension est le signal neutre : il ne peut venir que de l'API, et il
       ne dit rien des catégories qu'on s'apprête à juger. */
    await attendre(page, () => document.querySelectorAll('[data-tse-viewers]').length === 2);
    return page;
  };

  // ── a) l'en-tête, puisque c'est lui qui décide ──────────────────────────
  const page = await monter('fr');
  const entete = await page.evaluate(() => window.__lastAcceptLanguage);
  ok('la requête annonce la langue de l\'interface, pas celle du navigateur',
     entete === 'fr-FR', String(entete));

  // ── b) ce que la carte montre, et ce qu'elle retient ────────────────────
  const fr = await cartes(page);
  ok('la carte affiche la catégorie traduite',
     fr[0]?.texte === 'Discussions', JSON.stringify(fr[0]));
  ok('et son infobulle aussi — c\'est elle que relit getCardCategory',
     fr[0]?.infobulle === 'Discussions', JSON.stringify(fr[0]?.infobulle));
  ok('l\'identité, elle, reste le nom canonique',
     fr[0]?.identite === 'Just Chatting', JSON.stringify(fr[0]?.identite));
  ok('une catégorie que Twitch ne traduit pas s\'écrit telle quelle',
     fr[1]?.texte === 'Elden Ring' && fr[1]?.identite === 'Elden Ring',
     JSON.stringify(fr[1]));

  // ── c) le menu déroulant : libellé traduit, valeur canonique ────────────
  const opts = await options(page);
  const oJC = opts.find(o => o.valeur === 'Just Chatting');
  ok('le menu propose la traduction…', oJC?.libelle === 'Discussions',
     JSON.stringify(opts));
  ok('…sous la valeur canonique, qui est ce que le clic filtrera',
     !!oJC, JSON.stringify(opts.map(o => o.valeur)));

  // ── d) et le filtre marche toujours ─────────────────────────────────────
  await page.evaluate(() => {
    const o = [...document.querySelectorAll('#tse-cat-dd .tse-dd-opt')]
      .find(x => x.dataset.value === 'Just Chatting');
    if (!o) throw new Error('option « Just Chatting » absente');
    o.click();
  });
  await wait(page, 600);
  const visibles = await page.evaluate(() =>
    [...document.querySelectorAll('.side-nav-card')]
      .filter(c => c.style.display !== 'none').map(c => c.dataset.tseLogin));
  ok('choisir la catégorie traduite filtre bien sur son identité',
     visibles.length === 1 && visibles[0] === 'alpha', JSON.stringify(visibles));
  await page.evaluate(() => {
    document.querySelector('#tse-cat-dd .tse-dd-opt[data-value=""]')?.click();
  });
  await wait(page, 600);

  // ── e) le badge de basculement parle la même langue ─────────────────────
  await page.evaluate(() => { window.__fx.beta.game = 'Just Chatting'; });
  await attendre(page, () => (window.tse.bascules?.() || []).length > 0, 8000);
  await hoverCard(page, 1);
  await attendre(page, () => !!document.querySelector('.tse-preview__badge--switch'), 6000);
  const badge = await page.evaluate(() => {
    const b = document.querySelector('.tse-preview__badge--switch');
    return b ? { texte: b.textContent.trim(), gras: b.querySelector('strong')?.textContent } : null;
  });
  ok('« Vient de passer sur … » nomme la catégorie dans la langue de l\'interface',
     badge?.gras === 'Discussions', JSON.stringify(badge));
  await unhoverCard(page, 1);

  // ── f) LE piège : changer de langue n'est pas changer de catégorie ──────
  /* C'est l'assertion qui tient toute la séparation. Si le registre des
     basculements comparait les LIBELLÉS, passer l'interface en allemand
     ferait passer « Discussions » à « Nur Chatten » et l'extension
     annoncerait, sur les deux chaînes à la fois, un changement de catégorie
     que personne n'a fait. Comparer des noms canoniques est ce qui l'en
     empêche — et rien d'autre ne l'en empêche. */
  const avant = await page.evaluate(() => (window.tse.bascules() || []).length);
  await page.evaluate(() => { document.documentElement.lang = 'de'; });
  // Signal neutre là encore : l'en-tête du lot suivant, qui ne dit rien de ce
  // qui sera écrit sur les cartes.
  await attendre(page, () => window.__lastAcceptLanguage === 'de-DE', 10_000);
  await wait(page, 800);
  const de = await cartes(page);
  ok('la même catégorie repasse en allemand quand l\'interface change',
     de[0]?.texte === 'Nur Chatten' && de[0]?.identite === 'Just Chatting',
     JSON.stringify(de[0]));
  const apres = await page.evaluate(() => (window.tse.bascules() || []).length);
  ok('et ce changement de langue ne fabrique aucun faux basculement',
     apres <= avant, `avant=${avant} après=${apres}`);
  await page.close();

  // ── g) les DIX langues, et pas seulement celles qu'on a sous la main ────
  /* La question posée est « les catégories ont-elles bien la traduction de
     Twitch dans les autres langues ». Ce banc ne peut pas répondre pour
     Twitch — il ne l'appelle pas. Il répond pour NOTRE moitié, qui est la
     seule qu'on écrive : chaque langue demande-t-elle sa propre locale, et
     affiche-t-elle ce que le serveur lui rend pour cette locale-là ?

     La catégorie témoin n'a pas de nom réel et sa traduction est fabriquée
     depuis la langue demandée. C'est délibéré : inventer dix noms que Twitch
     n'a jamais écrits donnerait un test qui a l'air de connaître les
     traductions de Twitch, ce qu'aucune ligne d'ici ne peut savoir. Ce qu'on
     éprouve est le CHEMIN, langue par langue. */
  const LOCALES = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-MX', pt: 'pt-BR',
                    it: 'it-IT', pl: 'pl-PL', ru: 'ru-RU', ja: 'ja-JP', zh: 'zh-CN' };
  const boiteux = [];
  for (const [lang, locale] of Object.entries(LOCALES)) {
    const p = await browser.newPage();
    p.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
    await p.goto(URL_PAGE);
    await p.evaluate(({ l, langues }) => {
      document.querySelector('.side-nav-section').removeAttribute('aria-label');
      document.documentElement.lang = l;
      const t = {};
      for (const x of langues) t[x] = 'témoin-' + x;
      window.__i18nCats = { 'Catégorie témoin': t };
      window.__fx = { seul: { id: 's', createdAt: new Date(Date.now() - 3600_000).toISOString(),
                              viewers: 1000, game: 'Catégorie témoin', tags: [] } };
      window.__addCard('seul', 'Catégorie témoin', '1 k');
    }, { l: lang, langues: Object.keys(LOCALES) });
    await attendre(p, () => document.querySelectorAll('[data-tse-viewers]').length === 1);
    const vu = await p.evaluate(() => {
      const c = document.querySelector('.side-nav-card');
      const el = c.querySelector('[data-a-target="side-nav-card-metadata"] p[title]');
      return { entete: window.__lastAcceptLanguage,
               texte: el?.textContent?.trim() ?? null,
               identite: c.dataset.tseCategory ?? null };
    });
    await p.close();
    if (vu.entete !== locale || vu.texte !== 'témoin-' + lang
        || vu.identite !== 'Catégorie témoin') {
      boiteux.push(`${lang} → ${JSON.stringify(vu)}`);
    }
  }
  ok('les dix langues demandent leur locale et affichent ce qu\'elle rend',
     boiteux.length === 0, boiteux.join(' | '));
}

// ═════════ 66. Le dégraissage du code livré ═════════
titre('66. Paquet — retirer les commentaires sans toucher au programme');
{
  /* Le paquet part sans ses commentaires depuis la 3.59 : 687 Ko deviennent
     391. Le gain est réel, et le risque aussi — un découpage naïf casserait le
     fichier en silence, et il n'y a pas de « silence » plus complet qu'une
     extension qui ne démarre plus chez l'utilisateur.

     Deux garde-fous, et ils ne prouvent PAS la même chose.

     Le premier est le flux de JETONS, vérifié à chaque assemblage : si les
     deux textes rendent les mêmes jetons dans le même ordre, rien d'autre
     qu'un commentaire n'est parti. C'est nécessaire, et ce n'est pas
     suffisant : l'insertion automatique de points-virgules ne se voit PAS
     dans le flux de jetons. « return /* saut de ligne *\/ 5 » et « return 5 »
     ont exactement les mêmes jetons et ne rendent pas la même chose — le
     premier rend undefined. C'est pourquoi un bloc multiligne est remplacé
     par un saut de ligne au lieu d'être supprimé.

     Le second garde-fou est donc l'EXÉCUTION : on fait tourner des extraits
     choisis pour leurs pièges, avant et après, et on compare ce qu'ils
     rendent. */

  const rend = (src) => { try { return JSON.stringify(Function(src)()); }
                          catch (e) { return 'ERREUR: ' + e.message; } };

  const PIEGES = [
    ['l\'ASI d\'un return coupé par un bloc multiligne',
     'return /*\n*/ 5;'],
    /* Le saut de ligne qui SUIT un commentaire de ligne ne lui appartient pas,
       et c'est tout sauf un détail : l'emporter avec lui recolle « return » et
       ce qui vient après, donc rend 5 là où le programme rendait undefined.
       Deux jetons identiques, deux résultats différents — ce piège-là est le
       seul qui distingue un découpage juste d'un découpage qui mord. */
    ['le saut de ligne après un commentaire de ligne ne part pas avec lui',
     'return // fin\n5;'],
    ['deux jetons séparés par le seul commentaire ne se recollent pas',
     'const x = 1; return typeof/* c */x;'],
    ['un « // » dans une chaîne n\'est pas un commentaire',
     'return "https://gql.twitch.tv/gql";'],
    ['un début de bloc dans une chaîne non plus',
     'return "a /* b */ c";'],
    ['ni dans un littéral de gabarit',
     'const x = 1; return `v=${x} // pas un commentaire`;'],
    ['une expression régulière qui contient des barres obliques',
     'return "https://x/y".replace(/\\/\\//, "@").length;'],
    ['un commentaire de ligne en fin de fichier, sans saut final',
     'const a = 1; return a; // fin'],
  ];
  const faux = [];
  for (const [nom, src] of PIEGES) {
    const avant = rend(src), apres = rend(degraisser(src));
    if (avant !== apres) faux.push(`${nom} : ${avant} → ${apres}`);
  }
  ok('les pièges du découpage rendent la même chose avant et après',
     faux.length === 0, faux.join(' | '));

  /* Un dégraisseur qui ne ferait RIEN passerait tout ce qui précède. On mesure
     donc qu'il enlève vraiment quelque chose, et sur les vrais fichiers. */
  const RACINE = join(ICI, '..');
  const mesures = ['content.js', 'adblock.js'].map((f) => {
    const src = readFileSync(join(RACINE, f), 'utf8');
    const out = degraisser(src);
    return { f, souci: memeCode(src, out),
             avant: Buffer.byteLength(src), apres: Buffer.byteLength(out) };
  });
  const abimes = mesures.filter(m => m.souci);
  ok('content.js et adblock.js gardent leur flux de jetons exact',
     abimes.length === 0, abimes.map(m => `${m.f} : ${m.souci}`).join(' | '));
  const gain = 1 - mesures.reduce((n, m) => n + m.apres, 0)
                 / mesures.reduce((n, m) => n + m.avant, 0);
  ok(`et le paquet perd au moins un tiers de son poids (${(gain * 100).toFixed(0)} %)`,
     gain > 0.33, mesures.map(m => `${m.f} ${m.avant}→${m.apres}`).join(' | '));

  /* La notice MIT du code tiers doit survivre : la licence l'exige de toute
     copie, et un dégraisseur zélé en ferait une infraction sans rien casser
     de visible. */
  const adbNu = degraisser(readFileSync(join(RACINE, 'adblock.js'), 'utf8'));
  ok('la notice MIT du module anti-pub survit au dégraissage',
     /Licence : MIT/.test(adbNu)
     && /Copyright \(c\) 2020-present TwitchAdSolutions/.test(adbNu));

  /* …et le reste doit bien être parti, sinon « conserver les mentions
     légales » deviendrait « ne rien enlever ». La mesure est exacte : après
     dégraissage, il ne doit rester QUE les notices, ni plus ni moins.
     content.js passe de 2721 commentaires à 2 — les deux crédits OpenMoji,
     dont la licence CC BY-SA exige l'attribution — et adblock.js de 290 à 2,
     qui portent la notice MIT d'amont. */
  const restants = ['content.js', 'adblock.js'].map((f) => {
    const src = readFileSync(join(RACINE, f), 'utf8');
    const a = compterCommentaires(src);
    const b = compterCommentaires(degraisser(src));
    return { f, avant: a.total, legaux: a.legaux, apres: b.total };
  });
  const boiteuses = restants.filter(r => r.apres !== r.legaux || r.legaux === 0
                                      || r.avant < r.legaux + 100);
  ok('après dégraissage il ne reste QUE les notices, dans les deux fichiers',
     boiteuses.length === 0,
     restants.map(r => `${r.f} ${r.avant}→${r.apres} (légaux ${r.legaux})`).join(' | '));

  /* ── Le CSS, qui n'est pas du JavaScript ────────────────────────────────
     La feuille de style vit dans un littéral de gabarit : pour acorn, c'est
     une chaîne, et ses 77 commentaires ne sont pas des commentaires JS. Un
     second passage les retire, et il a ses propres pièges — un « /* » dans
     une chaîne CSS n'ouvre rien, et un commentaire collé à un jeton des deux
     côtés ne peut pas être retiré sans changer la règle. */
  const PIEGES_CSS = [
    ['un commentaire ordinaire part',
     '.a { color: red; /* rouge */ }', '.a { color: red;  }'],
    ['une séquence /* dans une chaîne CSS n\'ouvre pas de commentaire',
     '.a::after { content: "/* pas un commentaire */"; }',
     '.a::after { content: "/* pas un commentaire */"; }'],
    ['ni dans une chaîne à apostrophes',
     '.a::after { content: \'/*\'; color: red; }',
     '.a::after { content: \'/*\'; color: red; }'],
    ['un commentaire collé des deux côtés est CONSERVÉ, faute de pouvoir le retirer',
     '.a/*x*/.b { color: red; }', '.a/*x*/.b { color: red; }'],
    ['mais une espace d\'un seul côté suffit à le retirer',
     '.a /*x*/.b { color: red; }', '.a .b { color: red; }'],
    ['un commentaire non fermé ne fait rien perdre',
     '.a { color: red; /* ouvert', '.a { color: red; /* ouvert'],
  ];
  const fauxCss = [];
  for (const [nom, entree, attendu] of PIEGES_CSS) {
    const rendu = sansCommentairesCss(entree);
    if (rendu !== attendu) fauxCss.push(`${nom} : « ${rendu} »`);
  }
  ok('les pièges du CSS sont traités comme du CSS, pas comme du texte',
     fauxCss.length === 0, fauxCss.join(' | '));

  const cssAvant = readFileSync(join(RACINE, 'content.js'), 'utf8');
  const gainCss = Buffer.byteLength(degraisserJs(cssAvant))
                - Buffer.byteLength(degraisser(cssAvant));
  ok(`le passage CSS retire à lui seul plus de 20 Ko (${(gainCss / 1024).toFixed(0)} Ko)`,
     gainCss > 20 * 1024, String(gainCss));

  /* LA preuve, et elle ne se fait pas dans Node : c'est le navigateur qui lit
     ce CSS, donc c'est LUI qu'on interroge. On prend la feuille que
     l'extension a réellement injectée — interpolations résolues comprises —,
     on la dégraisse, et on demande à Chromium de parser les deux. S'il rend
     les mêmes règles, dans le même ordre, avec les mêmes déclarations, les
     deux feuilles sont la même feuille.

     Les règles sont comparées après un retrait de commentaires des DEUX
     côtés, et il a fallu une première écriture rouge pour comprendre
     pourquoi. Chromium NORMALISE ce qu'il ressert — « #fff » devient
     « rgb(255, 255, 255) », les raccourcis sont éclatés — SAUF les valeurs qui
     contiennent un `var()` : celles-là, il les rend telles qu'on les a
     écrites, commentaire au milieu compris. La règle 58 en porte un dans son
     `background`, et deux textes bruts ne pouvaient donc pas être égaux.

     Normaliser des deux côtés n'affaiblit pas le contrôle : là où Chromium
     normalise, il a déjà retiré les commentaires pour nous, et tout écart de
     sélecteur, de valeur ou de nombre de règles reste visible. Le seul cas
     vraiment dangereux — un commentaire retiré ENTRE deux jetons d'une valeur,
     « foo/*x*\/bar » devenant « foobar » au lieu de « foo bar » — tombe
     précisément là où Chromium normalise, donc il est vu. */
  const pageCss = await browser.newPage();
  pageCss.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
  await pageCss.goto(URL_PAGE);
  await attendre(pageCss, () => !!document.getElementById('tse-css'));
  const feuille = await pageCss.evaluate(() => document.getElementById('tse-css').textContent);
  const [avantR, apresR] = await pageCss.evaluate(({ avant, apres }) => {
    // `media="not all"` : les deux sondes sont analysées sans rien peindre.
    const regles = (texte) => {
      const s = document.createElement('style');
      s.media = 'not all';
      s.textContent = texte;
      document.head.appendChild(s);
      const out = [...s.sheet.cssRules].map(r => r.cssText);
      s.remove();
      return out;
    };
    return [regles(avant), regles(apres)];
  }, { avant: feuille, apres: sansCommentairesCss(feuille) });
  await pageCss.close();

  let ecart = avantR.length !== apresR.length
    ? `${avantR.length} règles avant, ${apresR.length} après` : null;
  for (let i = 0; !ecart && i < avantR.length; i++) {
    const a = sansCommentairesCss(avantR[i]), b = sansCommentairesCss(apresR[i]);
    if (a !== b) ecart = `règle ${i} : « ${a.slice(0, 90)} » → « ${b.slice(0, 90)} »`;
  }
  ok(`Chromium rend les MÊMES règles avant et après (${avantR.length} règles)`,
     !ecart, ecart ?? '');
  /* Et la feuille dégraissée n'en porte plus aucun. Le contrôle ci-dessus
     normalise les deux côtés : à lui seul, il passerait aussi pour un
     dégraisseur inerte. Celui-ci ferme la porte — et il ne se prononce QUE sur
     la sortie, car l'entrée n'a déjà plus de commentaires quand le banc tourne
     sur le code livré (`npm run test-livre`). Le cas « ne fait rien » est
     couvert deux lignes plus haut, sur le fichier du dépôt, où la mesure vaut
     dans les deux modes. */
  ok('…et la feuille servie au navigateur ne porte plus un seul commentaire CSS',
     !sansCommentairesCss(feuille).includes('/*'),
     `${(sansCommentairesCss(feuille).match(/\/\*/g) || []).length} restants`);
}

// ═════════ 67. L'onglet qu'on ne regarde plus ═════════
titre('67. Arrière-plan — ce qui s\'arrête, et ce qui repart');
{
  /* Soixante-cinq scénarios, et aucun ne parlait de l'onglet caché. C'était le
     trou le plus large du banc : tout le chemin de retour — voile, purge,
     repeuplement — n'avait jamais été joué une seule fois.

     CE QUE CE SCÉNARIO SIMULE, ET CE QU'IL NE SIMULE PAS. Il pose le SIGNAL
     que le navigateur envoie : `document.hidden`, `visibilityState`,
     l'événement `visibilitychange`. C'est ce que l'extension lit, et c'est
     donc sa logique à elle qui est éprouvée. Il ne reproduit PAS le
     ralentissement que Chrome inflige aux minuteurs d'un onglet caché — cela
     ne se simule pas depuis la page. Le dernier cas va plus loin et gèle
     vraiment la page par le protocole DevTools, ce qui est la chose réelle. */

  const cacher = (page, cache) => page.evaluate((c) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => c });
    Object.defineProperty(document, 'visibilityState',
      { configurable: true, get: () => (c ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, cache);

  /* Attendre que le pipeline se taise AVANT de cacher l'onglet. Sans cela le
     test est une course, et il l'a été : un balayage encore programmé, ou un
     lot encore en vol, retombait pendant la mesure et faisait échouer le
     scénario UNE FOIS SUR TROIS — sur du code sain. Un banc intermittent est
     pire qu'un banc absent : il apprend à ignorer ses propres échecs.

     Le silence se constate sur le compteur de requêtes du stub : deux relevés
     consécutifs identiques, et plus rien ne peut retomber. */
  const calme = async (page) => {
    let precedent = -1;
    for (let i = 0; i < 40; i++) {
      const n = await page.evaluate(() => window.__calls.length);
      if (n === precedent) return true;
      precedent = n;
      await wait(page, 250);
    }
    return false;
  };

  /* Combien de fois le relevé « sidebar réduite ? » interroge le document.
     C'est un COMPTEUR, pas un chronomètre : une assertion de coût fondée sur
     le temps serait à la merci de la charge de la machine, et deviendrait le
     genre d'échec qu'on finit par ignorer. */
  const compterReplis = () => {
    const vrai = Document.prototype.querySelector;
    window.__replis = 0;
    Document.prototype.querySelector = function (sel) {
      if (typeof sel === 'string' && sel.includes('side-nav--collapsed')) window.__replis++;
      return vrai.call(this, sel);
    };
    /* Les minuteurs armés, aussi. La porte de scheduleScan et celle de son
       rappel font la même promesse — « pas de balayage en arrière-plan » — et
       la seconde suffit à la tenir : retirer la première ne fait donc tomber
       aucun test de comportement. Ce qu'elle apporte en propre est de ne pas
       ARMER de minuteur du tout, et cela ne se voit qu'ici. */
    const vraiTO = window.setTimeout;
    window.__armes = 0;
    window.setTimeout = function (...args) { window.__armes++; return vraiTO.apply(this, args); };
  };

  const monter = async () => {
    const page = await browser.newPage();
    page.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
    await page.addInitScript(compterReplis);
    await page.goto(URL_PAGE);
    await page.evaluate(() => {
      const h = new Date(Date.now() - 3600_000).toISOString();
      window.__fx = {
        alpha: { id: 'a', createdAt: h, viewers: 1000, game: 'Just Chatting', tags: [] },
        beta:  { id: 'b', createdAt: h, viewers: 900,  game: 'Elden Ring',    tags: [] },
      };
      window.__addCard('alpha', 'Just Chatting', '1 k');
      window.__addCard('beta',  'Elden Ring',    '900');
    });
    await attendre(page, () => document.querySelectorAll('[data-tse-viewers]').length === 2);
    return page;
  };

  // ── a) caché : plus de requêtes, plus de décoration ─────────────────────
  const page = await monter();
  ok('le pipeline se tait avant qu\'on cache l\'onglet', await calme(page));

  /* ── LA COURSE, reconstruite exprès ────────────────────────────────────
     Entre la programmation d'un balayage et son départ il s'écoule
     SCAN_DEBOUNCE, et l'onglet peut se cacher dans cet intervalle. Le
     minuteur, lui, est déjà armé : sans porte dans son rappel, il part quand
     même, avec son balayage complet et ses requêtes.

     Ce cas n'a pas été trouvé en lisant le code : c'est le banc qui échouait
     UNE FOIS SUR TROIS sur du code sain, parce qu'il tombait par hasard dans
     cette fenêtre. Trois écritures ont raté sa reconstruction, et les deux
     premières PASSAIENT — la pire façon de rater :

       1. mutation et masquage dans une seule évaluation synchrone. Le rappel
          d'un MutationObserver est une microtâche : il ne tournait qu'APRÈS
          le masquage, prenait sa propre porte, et n'armait donc rien ;
       2. un tour complet cédé entre les deux. Mesuré : l'observateur n'arme
          son minuteur que ~19 ms après la mutation, bien après le tour ;
       3. accrochée à l'armement, mais la carte posée trop tôt — un balayage
          d'une activité précédente l'a décorée avant qu'on ait rien caché.

     Les deux premières ne testaient rien du tout, et la mutation qui retire
     la porte du rappel y a survécu deux rondes complètes.

     CE QUI MARCHE, et pourquoi il n'y a plus d'horloge dans le raisonnement :
     on s'accroche à l'ÉVÉNEMENT « un balayage vient d'être armé » — observable,
     c'est un setTimeout au délai de SCAN_DEBOUNCE — puis on fait TOUT le reste
     dans UNE SEULE microtâche : poser la carte, puis cacher l'onglet. Rien ne
     peut s'intercaler entre les deux, donc aucun balayage ne peut voir la
     carte tant que l'onglet est visible. Le balayage en attente, lui, expirera
     forcément onglet caché. La microtâche plutôt que l'appel direct : se
     glisser au milieu de scheduleScan produirait une réentrance que la
     production ne connaît pas.

     ON NE PEUT PAS ATTENDRE LE SILENCE D'ABORD — mesuré aussi : au repos, le
     banc accéléré arme un balayage toutes les 100 ms (REFRESH_TICK), et le
     plus grand trou observé sur 3 s est de 131 ms. Il n'existe aucun instant
     tranquille où se placer ; c'est bien pour cela qu'il faut s'accrocher à
     l'événement plutôt qu'à une accalmie.

     TROIS TÉMOINS pour un seul fait, parce qu'un fait à un seul témoin dans un
     test asynchrone est une coïncidence en puissance : aucune requête, la
     carte non décorée, et AUCUN relevé du repli — ce dernier étant le plus
     direct, puisque scanSidebar commence par refreshSidebarCollapsed et qu'un
     balayage qui tourne ne peut pas le cacher.

     Le délai est LU dans le fichier construit. build.mjs donne à SCAN_DEBOUNCE
     une valeur distincte de BATCH_DELAY précisément pour que ces lignes
     puissent nommer leur minuteur au lieu d'en attraper un autre. */
  const DEBOUNCE = Number(/SCAN_DEBOUNCE:\s*([\d_]+)/
    .exec(readFileSync(join(ICI, 'content.test.js'), 'utf8'))[1].replaceAll('_', ''));
  const course = await page.evaluate((debounce) => new Promise((resolve) => {
    const vraiTO = window.setTimeout;          // le compteur posé par compterReplis
    let pris = false;
    window.setTimeout = function (fn, d, ...r) {
      const id = vraiTO.call(this, fn, d, ...r);
      if (d === debounce && !pris) {
        pris = true;
        queueMicrotask(() => {
          window.setTimeout = vraiTO;
          // La carte, PUIS le masquage — sans rien entre les deux.
          window.__fx.delta = { id: 'd', createdAt: new Date(Date.now() - 600_000).toISOString(),
                                viewers: 400, game: 'Art', tags: [] };
          window.__addCard('delta', 'Art', '400');
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          Object.defineProperty(document, 'visibilityState',
            { configurable: true, get: () => 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
          // Les témoins sont remis à zéro APRÈS le masquage : tout ce qu'ils
          // compteront désormais aura eu lieu dans un onglet caché.
          window.__replis = 0;
          const appels0 = window.__calls.length;
          vraiTO(() => resolve({
            arme: true,
            replis: window.__replis,
            appels: window.__calls.length - appels0,
            delta: !!document.querySelector('[data-tse-login="delta"]'),
          }), debounce * 8);                   // très au-delà de l'échéance
        });
      }
      return id;
    };
    vraiTO(() => { window.setTimeout = vraiTO; resolve({ arme: false }); }, 3000);
  }), DEBOUNCE);
  /* LA PRÉCONDITION, et elle vaut assertion à part entière : sans balayage
     armé, il n'y a pas de course, et ce qui suit ne prouve rien. C'est
     exactement le piège dans lequel les deux premières écritures sont
     tombées — en vert. */
  ok(`la course est bien armée : l'onglet se cache pendant qu'un balayage attend (${DEBOUNCE} ms)`,
     course.arme === true, 'aucun balayage n\'a été armé en 3 s');
  ok('un balayage déjà armé ne part pas si l\'onglet se cache avant son échéance',
     course.replis === 0 && course.appels === 0 && course.delta === false,
     JSON.stringify(course));

  const appelsAvant = await page.evaluate(() => window.__calls.length);
  /* Twitch continue de vivre pendant l'absence : une carte apparaît. Avant
     cette version, chaque mutation de ce genre déclenchait un balayage complet
     et son lot de requêtes, dans un onglet que personne ne regarde. */
  await page.evaluate(() => {
    window.__fx.gamma = { id: 'g', createdAt: new Date(Date.now() - 600_000).toISOString(),
                          viewers: 500, game: 'Art', tags: [] };
    window.__addCard('gamma', 'Art', '500');
  });
  await wait(page, 1000);
  const pendant = await page.evaluate(() => ({
    appels: window.__calls.length,
    decoree: !!document.querySelector('[data-tse-login="gamma"]'),
  }));
  ok('onglet caché : aucune requête ne part',
     pendant.appels === appelsAvant, `${appelsAvant} → ${pendant.appels}`);
  ok('onglet caché : la carte apparue n\'est pas traitée',
     pendant.decoree === false, JSON.stringify(pendant));

  /* ── le COÛT, et pas seulement le comportement ──────────────────────────
     Le relevé « sidebar réduite ? » coûte 130 µs sur un DOM de la taille de
     celui de Twitch : un sélecteur de classe sans correspondance oblige le
     moteur à parcourir tout le document. Il se faisait à CHAQUE lot de
     mutations, chat compris.

     Deux portes le bornent désormais, et aucune ne se voit dans un test de
     comportement — c'est pourquoi la première mutation de ce lot n'était
     tombée nulle part. On compte donc les relevés pendant 300 lots de
     mutations HORS sidebar, comme en produit un chat qui défile. */
  const churn = (page) => page.evaluate(async () => {
    const bruit = document.createElement('div');
    document.body.appendChild(bruit);
    window.__replis = 0; window.__armes = 0;
    for (let i = 0; i < 300; i++) {
      const d = document.createElement('div');
      d.innerHTML = '<span>message ' + i + '</span>';
      bruit.appendChild(d);
      if (bruit.childElementCount > 40) bruit.firstElementChild.remove();
      await null;                       // un lot par message, comme un vrai chat
    }
    bruit.remove();
    return { replis: window.__replis, armes: window.__armes };
  });

  const caches = await churn(page);
  ok('onglet caché : le relevé du repli ne tourne pas une seule fois',
     caches.replis === 0, `${caches.replis} relevés pour 300 lots`);
  ok('onglet caché : aucun minuteur de balayage n\'est même armé',
     caches.armes === 0, `${caches.armes} minuteurs armés pour 300 lots`);

  // ── b) retour COURT : le balayage retenu est rejoué ─────────────────────
  /* L'absence dure moins que REVISIT_RELOAD_MS : pas de voile, pas de purge —
     mais la carte arrivée pendant l'absence doit être rattrapée. C'est
     exactement ce que le drapeau « scan en retard » existe pour garantir. */
  /* On redevient visible ET on lit DANS LA MÊME évaluation : aucun minuteur
     n'a pu s'exécuter entre les deux, donc ce qu'on trouve vient forcément du
     gestionnaire de retour. Sans cette précaution le test ne prouvait rien —
     le réveil périodique (5 s en production, 100 ms dans le banc accéléré)
     finissait par balayer de toute façon, et retirer le rattrapage ne faisait
     tomber aucune assertion. La différence est pourtant réelle : jusqu'à cinq
     secondes de sidebar périmée à chaque retour sur l'onglet. */
  const apresCourt = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState',
      { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    return { gamma: !!document.querySelector('[data-tse-login="gamma"]'),
             delta: !!document.querySelector('[data-tse-login="delta"]'),
             cartes: document.querySelectorAll('[data-tse-login]').length };
  });
  ok('retour court : les deux balayages retenus sont rejoués DANS le gestionnaire',
     apresCourt.gamma && apresCourt.delta && apresCourt.cartes === 4,
     JSON.stringify(apresCourt));

  /* Onglet VISIBLE, et du bruit hors sidebar : le relevé ne doit presque
     jamais tourner. Première écriture de cette assertion, je l'attendais
     « échantillonnée, entre 1 et 30 » — elle rend zéro, et c'est elle qui
     avait tort : 300 lots passent en bien moins d'une seconde, donc le filet
     d'une seconde n'a aucune raison de se déclencher. Sans la porte, ce même
     bruit produisait 300 relevés à 130 µs.

     Le seuil laisse passer le filet au cas où la rafale chevaucherait une
     seconde ; ce test compte un ordre de grandeur, il ne chronomètre pas une
     machine. */
  await calme(page);
  const visible = await churn(page);
  ok('onglet visible : le bruit hors sidebar ne déclenche presque aucun relevé',
     visible.replis <= 5, `${visible.replis} relevés pour 300 lots`);

  /* LE CONTRÔLE POSITIF, et il est indispensable : sans lui, « ne relève
     presque jamais » serait aussi satisfait par une porte qui ne s'ouvre
     jamais — c'est-à-dire par un repli/dépli qu'on ne verrait plus. Une
     mutation DANS la sidebar doit relever tout de suite. */
  const replisSidebar = await page.evaluate(async () => {
    window.__replis = 0;
    const nav = document.getElementById('side-nav');
    const d = document.createElement('div');
    nav.appendChild(d); await null;
    d.remove(); await null;
    return window.__replis;
  });
  ok('…mais une mutation DANS la sidebar le déclenche immédiatement',
     replisSidebar > 0, `${replisSidebar} relevés`);

  // ── c) retour LONG : voile, purge, repeuplement ─────────────────────────
  await cacher(page, true);
  await wait(page, 2200);            // > REVISIT_RELOAD_MS accéléré (1,5 s)
  await cacher(page, false);
  await attendre(page, () =>
    document.querySelectorAll('[data-tse-login][data-tse-viewers]').length === 4, 8000);
  const apresLong = await page.evaluate(() => ({
    cartes: document.querySelectorAll('[data-tse-login][data-tse-viewers]').length,
    uptime: [...document.querySelectorAll('.tse-uptime')].map(e => e.textContent).filter(Boolean).length,
  }));
  ok('retour après une longue absence : les quatre cartes sont repeuplées',
     apresLong.cartes === 4, JSON.stringify(apresLong));
  ok('…durées de stream comprises',
     apresLong.uptime === 4, JSON.stringify(apresLong));
  await page.close();

  // ── d) l'onglet qui NAÎT caché ──────────────────────────────────────────
  /* Cas oublié par l'écriture d'origine : `hiddenSince` valait 0, donc le
     retour ne faisait rien du tout. Une page ouverte dans un onglet
     d'arrière-plan — un lien ouvert en nouvel onglet, une session restaurée —
     n'avait alors aucun chemin de rattrapage. */
  const p2 = await browser.newPage();
  p2.on('pageerror', e => { fail++; console.log('  ✗ ERREUR PAGE:', e.message); });
  await p2.addInitScript(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  });
  await p2.goto(URL_PAGE);
  await p2.evaluate(() => {
    const h = new Date(Date.now() - 3600_000).toISOString();
    window.__fx = { seul: { id: 's', createdAt: h, viewers: 700, game: 'Art', tags: [] } };
    window.__addCard('seul', 'Art', '700');
  });
  await wait(p2, 1200);
  const neCache = await p2.evaluate(() => window.__calls.length);
  // Lecture synchrone, même raison qu'au retour court : c'est le gestionnaire
  // qu'on éprouve, pas la patience du réveil périodique.
  const ne = await p2.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState',
      { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    return { balaye: !!document.querySelector('[data-tse-login="seul"]') };
  });
  /* Le balayage est synchrone, les DONNÉES ne le sont pas : viewers et durée
     viennent d'une réponse réseau. Exiger les deux dans la même évaluation —
     première écriture — revenait à demander au gestionnaire de faire un
     aller-retour GraphQL sans rendre la main. Deux assertions, donc : le
     gestionnaire balaie, puis les données arrivent. */
  ok('un onglet né caché est balayé dès le premier regard',
     ne.balaye, `${JSON.stringify(ne)} — ${neCache} requêtes pendant l'absence`);
  await attendre(p2, () => !!document.querySelector('[data-tse-login="seul"][data-tse-viewers]'), 8000);
  const peuple = await p2.evaluate(() => {
    const c = document.querySelector('[data-tse-login="seul"]');
    return { viewers: c?.dataset.tseViewers ?? null,
             uptime: c?.querySelector('.tse-uptime')?.textContent ?? null };
  });
  ok('…et se peuple ensuite comme n\'importe quel onglet',
     !!peuple.viewers && !!peuple.uptime, JSON.stringify(peuple));
  await p2.close();

  // ── e) un vrai gel, par le protocole DevTools ───────────────────────────
  /* Ici on ne simule plus : Chrome gèle réellement la page — minuteurs
     suspendus, rien ne tourne — puis la réveille. C'est ce que fait le
     navigateur à un onglet d'arrière-plan qu'il juge inutile, et c'est le seul
     moyen de vérifier que l'extension survit à autre chose qu'un drapeau. */
  const p3 = await monter();
  const cdp = await p3.context().newCDPSession(p3);
  await cacher(p3, true);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await new Promise(r => setTimeout(r, 2500));
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await cacher(p3, false);
  await attendre(p3, () =>
    document.querySelectorAll('[data-tse-login][data-tse-viewers]').length === 2, 10_000);
  const degele = await p3.evaluate(() => ({
    cartes: document.querySelectorAll('[data-tse-login][data-tse-viewers]').length,
    tri: !!document.getElementById('tse-sort-row'),
    filtre: !!document.getElementById('tse-filter'),
  }));
  ok('après un gel RÉEL de la page, la sidebar repart entière',
     degele.cartes === 2 && degele.tri && degele.filtre, JSON.stringify(degele));
  await p3.close();
}

await browser.close();
console.log(`\n${'═'.repeat(50)}`);
if (echecs.length) {
  console.log(`${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) {
    console.log(`  • ${e.scenario}`);
    console.log(`      ${e.assertion}${e.detail ? '  —  ' + e.detail : ''}`);
  }
  console.log('═'.repeat(50));
}
console.log(`${pass} réussis, ${fail} échoués\n`);
process.exit(fail ? 1 : 0);
