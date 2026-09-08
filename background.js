/* ============================================================
 *  SERVICE WORKER — l'aiguilleur, et rien d'autre
 *  ------------------------------------------------------------
 *  Le panneau et la page ne peuvent pas se parler. Le panneau est
 *  une page d'extension : il a `chrome.*`, pas la page. content.js
 *  tourne en monde MAIN : il a la page, pas `chrome.*`. bridge.js
 *  joint les deux mondes DANS l'onglet ; ce fichier joint l'onglet
 *  et le panneau.
 *
 *  POURQUOI L'ONGLET APPELLE, ET NON L'INVERSE. Le chemin naturel
 *  serait que le panneau appelle `chrome.tabs.sendMessage`. Il
 *  exige une permission d'hôte sur l'onglet visé — exactement ce
 *  que la fiche du Store promet de ne pas demander, et ce que
 *  `npm run addon` vérifie (aucune clé `permissions`). On inverse
 *  donc le sens : c'est bridge.js qui ouvre le port, ce qu'un
 *  content script fait sans rien réclamer, et ce fichier garde le
 *  port pour s'en servir quand le panneau demande. Toute
 *  l'architecture tient à cette inversion.
 *
 *  CE FICHIER NE COMPREND RIEN À CE QU'IL TRANSPORTE. Il ne
 *  connaît ni les sections, ni leur contenu, ni leur forme : un
 *  nom, un argument, une réponse. La liste de ce qui est appelable
 *  est déclarée dans content.js, et nulle part ailleurs — trois
 *  fichiers qui décideraient chacun de ce qui est permis
 *  finiraient par ne plus être d'accord.
 *
 *  IL NE PERSISTE RIEN, et c'est voulu : un service worker meurt
 *  et renaît. Tout ce qu'il tient — les ports, les demandes en
 *  vol — n'a de sens que le temps d'un aller-retour. Rien ici ne
 *  doit survivre à son sommeil, donc rien n'y est écrit.
 * ============================================================ */
'use strict';

const CANAL = 'tse-panneau';
/* Au-delà, le panneau reçoit un échec plutôt qu'un silence. Plus large que
   l'expiration de bridge.js (30 s) : c'est LUI qui doit rendre le verdict, et
   deux garde-fous qui expirent ensemble ne diraient pas lequel a lâché. */
const EXPIRATION = 35_000;

/** Instant de démarrage de CETTE instance du worker. Chrome en tue une toutes
 *  les trente secondes d'inactivité et en refait une à la demande : savoir
 *  qu'elle a deux cents millisecondes explique à elle seule un port pas encore
 *  rebranché, et c'est une information qu'aucun rapport ne portait. */
const NE = Date.now();
/** Ports vivants, un par onglet. Un onglet dont la page est cachée n'y est
 *  pas : bridge.js se débranche pour laisser ce worker s'endormir. */
const ports = new Map();          // tabId → Port
/** Demandes du panneau en attente de réponse de l'onglet. */
const enVol = new Map();          // reqId → { repondre, minuteur }
let suivant = 0;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== CANAL) return;
  const tabId = port.sender?.tab?.id;
  if (typeof tabId !== 'number') return;   // pas un onglet : rien à aiguiller

  /* Un onglet qui se rebranche remplace son port. L'ancien est explicitement
     fermé : le laisser ouvert tiendrait ce worker éveillé pour un canal dont
     plus personne ne se sert. */
  const ancien = ports.get(tabId);
  if (ancien && ancien !== port) { try { ancien.disconnect(); } catch { /* déjà fermé */ } }
  ports.set(tabId, port);

  port.onDisconnect.addListener(() => {
    if (ports.get(tabId) === port) ports.delete(tabId);
  });

  port.onMessage.addListener((m) => {
    if (!m || typeof m.reqId !== 'number') return;
    const attente = enVol.get(m.reqId);
    if (!attente) return;                  // déjà expirée, ou déjà répondue
    enVol.delete(m.reqId);
    clearTimeout(attente.minuteur);
    /* Même raison qu'à l'aller : on rend la réponse ENTIÈRE. La rédaction qui
       recopiait `ok`, `data`, `erreur` aurait jeté en silence les champs
       ajoutés depuis — `detail`, `partiel`, `observations` — c'est-à-dire
       exactement ce qui est là pour expliquer un échec. */
    const { reqId: _r, ...reponse } = m;
    attente.repondre({ ...reponse, ok: !!m.ok });
  });
});

/* ── DEUX DIALECTES POUR RÉPONDRE, ET ILS NE SONT PAS INTERCHANGEABLES ──────
   Une réponse ASYNCHRONE à `runtime.onMessage` se signale de deux façons qui
   s'excluent : Chrome veut qu'on garde `sendResponse` et qu'on retourne `true` ;
   Firefox veut qu'on retourne une PROMESSE. Retourner une promesse sur Chrome
   ne signale rien — le canal se ferme et l'appelant reçoit `undefined` ; et
   `return true` n'a été honoré sur Firefox qu'à partir d'une version que je
   n'ai PAS PU VÉRIFIER ici, faute de Firefox sur cette machine.

   Ce fichier ne faisait que le premier. Plutôt que de parier sur la seconde
   moitié de la phrase, on parle les deux dialectes : le travail est écrit une
   fois, sous forme de promesse, et seul le geste final change. `browser`
   n'existe que sur Firefox, ce qui suffit à choisir. */
const PROMESSE = typeof browser !== 'undefined' && !!browser.runtime;

const traiter = (msg) => new Promise((repondre) => {
  /* ── CE QUE LE WORKER SAIT DE LUI-MÊME ────────────────────────────────────
     Demandé par le rapport de diagnostic, et par lui seul. Il ne traverse
     aucun pont : c'est exprès, puisqu'on s'en sert justement quand le pont
     ne répond pas. Sans cela, un rapport d'échec ne disait pas si le worker
     venait de naître (auquel cas il faut attendre) ou s'il tournait depuis
     longtemps sans jamais avoir vu un seul pont (auquel cas il faut recharger
     la page) — deux réparations opposées, aucun moyen de choisir. */
  if (msg.type === CANAL + '-etat') {
    repondre({ ok: true, ponts: [...ports.keys()], enVol: enVol.size,
               workerMs: Date.now() - NE });
    return;
  }

  const port = ports.get(msg.tabId);
  if (!port) {
    /* CE QU'ON SAIT, ET QU'ON DIT. « Absent » couvre plusieurs situations très
       différentes, et sans ce détail elles étaient indiscernables depuis le
       panneau :

         — AUCUN pont connu : bridge.js n'a jamais réussi à se brancher, ou ce
           worker vient de redémarrer et n'a pas encore été recontacté ;
         — des ponts, mais pas celui-là : l'onglet actif n'est pas une page
           Twitch, ou sa page a été ouverte avant l'installation de
           l'extension — les content scripts n'entrent pas dans un onglet déjà
           ouvert.

       Le premier cas se répare en attendant une seconde, le second en
       rechargeant la page. Les confondre envoyait chercher au mauvais endroit,
       et c'est exactement ce qui est arrivé. */
    repondre({ ok: false, erreur: 'absent',
               detail: `onglet ${msg.tabId} — ponts connus : `
                     + ([...ports.keys()].join(', ') || 'aucun') });
    return;
  }

  const reqId = ++suivant;
  const minuteur = setTimeout(() => {
    enVol.delete(reqId);
    /* NOMMÉ. bridge.js a son propre garde-fou, qui rendait lui aussi le mot
       « expiration » : les deux étaient indiscernables dans un rapport, donc
       on ne savait pas si le silence venait de la page ou du port. Atteindre
       CELUI-CI veut dire que le pont n'a même pas rendu le sien — le port est
       mort entre-temps, ou l'onglet a disparu. */
    repondre({ ok: false, erreur: 'expiration-pont',
               detail: `${EXPIRATION} ms sans réponse du pont` });
  }, EXPIRATION);
  enVol.set(reqId, { repondre, minuteur });

  try {
    /* ON RELAIE LA DEMANDE ENTIÈRE, moins ce qui n'appartient qu'à ce saut.
       La première rédaction recopiait les champs un par un — `section`,
       `action`, `arg` — et c'était un bogue en attente : le panneau a plus
       tard gagné un quatrième champ, `rapport`, que cette ligne ne connaissait
       pas et jetait donc en silence. Le rapport de diagnostic ne pouvait PAS
       fonctionner, jamais : la demande partait, n'arrivait nulle part, et le
       panneau attendait l'expiration de 35 s pour n'afficher que son propre
       bloc TRANSPORT. Un utilisateur l'a signalé ; aucun test ne l'avait vu,
       parce que le banc branchait le panneau sur un `chrome` simulé et
       sautait précisément ces deux sauts.

       Trois fichiers énuméraient chacun la même liste de champs. Il suffisait
       qu'un seul en oublie un. Aucun des trois n'a besoin de cette liste :
       le contenu de la demande ne regarde que le panneau et content.js. */
    const { type: _t, tabId: _o, ...demande } = msg;
    port.postMessage({ reqId, ...demande });
  } catch {
    // Port mort entre la lecture et l'envoi : on rend la main tout de suite.
    enVol.delete(reqId);
    clearTimeout(minuteur);
    repondre({ ok: false, erreur: 'absent' });
  }
});

chrome.runtime.onMessage.addListener((msg, _expediteur, repondre) => {
  if (!msg || (msg.type !== CANAL && msg.type !== CANAL + '-etat')) return false;
  const promesse = traiter(msg);
  if (PROMESSE) return promesse;           // Firefox
  promesse.then(repondre);                 // Chrome
  return true;                             // réponse asynchrone
});
