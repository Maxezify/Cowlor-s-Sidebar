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
    attente.repondre({ ok: !!m.ok, data: m.data, erreur: m.erreur });
  });
});

chrome.runtime.onMessage.addListener((msg, _expediteur, repondre) => {
  if (!msg || msg.type !== CANAL) return false;

  const port = ports.get(msg.tabId);
  if (!port) {
    /* Trois causes, et le panneau les distingue par ce seul mot : l'onglet
       n'est pas une page Twitch, l'extension vient d'être rechargée sans que
       la page le soit, ou l'onglet n'était pas encore revenu au premier plan
       quand le clic est parti. Le panneau réessaie une fois avant de le dire. */
    repondre({ ok: false, erreur: 'absent' });
    return false;
  }

  const reqId = ++suivant;
  const minuteur = setTimeout(() => {
    enVol.delete(reqId);
    repondre({ ok: false, erreur: 'expiration' });
  }, EXPIRATION);
  enVol.set(reqId, { repondre, minuteur });

  try {
    port.postMessage({ reqId, section: msg.section, action: msg.action, arg: msg.arg });
  } catch {
    // Port mort entre la lecture et l'envoi : on rend la main tout de suite.
    enVol.delete(reqId);
    clearTimeout(minuteur);
    repondre({ ok: false, erreur: 'absent' });
    return false;
  }
  return true;                             // réponse asynchrone
});
