/* ============================================================
 *  PONT — content script en monde ISOLATED
 *  ------------------------------------------------------------
 *  POURQUOI CE FICHIER EXISTE, et pourquoi il ne peut pas être
 *  une fonction de content.js.
 *
 *  content.js tourne en monde MAIN. C'est ce qui lui permet
 *  d'exposer `window.tse` et de lire le JavaScript de Twitch —
 *  et c'est aussi ce qui lui interdit toute API `chrome.*` : le
 *  monde MAIN est le contexte de la PAGE, où l'extension n'a
 *  aucune existence.
 *
 *  Le panneau, lui, est une page d'extension : il a `chrome.*`
 *  et n'a pas la page. Les deux ne se voient donc jamais. Leur
 *  seul terrain commun est le DOM, et ce fichier est le seul
 *  endroit du produit qui touche aux deux : monde ISOLATED, donc
 *  `chrome.*` disponible, et même fenêtre que content.js, donc
 *  `window.postMessage` audible des deux côtés.
 *
 *  AUCUNE PERMISSION N'EST DEMANDÉE, et le sens de la connexion
 *  en est la raison. Un panneau qui appellerait
 *  `chrome.tabs.sendMessage` exigerait une permission d'hôte sur
 *  l'onglet visé — ce que la fiche du Store promet précisément de
 *  ne pas demander. C'est donc CE fichier qui ouvre le canal, par
 *  `chrome.runtime.connect()`, qu'un content script a le droit
 *  d'appeler sans rien réclamer. Le service worker garde le port
 *  et s'en sert pour répondre au panneau. L'inversion du sens de
 *  connexion est tout ce qui sépare « zéro permission » de
 *  « permission d'hôte sur twitch.tv ».
 *
 *  CE FICHIER NE LIT RIEN. Il ne connaît ni les sections, ni leur
 *  contenu : il transporte un nom, un argument, et ce qui revient.
 *  La liste de ce qui est appelable est déclarée dans content.js,
 *  et nulle part ailleurs.
 * ============================================================ */
(() => {
  'use strict';

  /* Cadre principal seulement. Le manifeste injecte dans toutes les frames —
     l'aperçu vidéo en est une — et sans cette garde chaque iframe ouvrirait
     son propre port. Le service worker en verrait plusieurs pour le même
     onglet et répondrait par celui qu'il a retenu en dernier, c'est-à-dire
     par une iframe de lecteur qui n'a pas de sidebar à décrire. */
  if (window.top !== window) return;

  const REQ = 'tse-panneau-req';
  const RES = 'tse-panneau-res';
  /* Au-delà, on rend la main. La page peut ne jamais répondre — content.js
     pas encore démarré, ou remplacé par une navigation — et un panneau qui
     tourne indéfiniment ne dit rien à personne. Large exprès : un relevé
     d'abonnements traverse trois pages complètes. */
  const EXPIRATION = 30_000;

  let port = null;
  let suivant = 0;
  let reprises = 0;             // reconnexions depuis le chargement de la page
  const NE = Date.now();
  const attentes = new Map();   // id local → { reqId du panneau, minuteur }

  /* ── CE QUE CE FICHIER PEUT DIRE TOUT SEUL ────────────────────────────────
     Il ne lit rien de la page, et ce n'est pas ce qui change ici : il ne lit
     toujours ni sections, ni contenu. Mais il PARTAGE LE DOM avec content.js,
     et c'est la seule chose qu'il puisse observer sans lui.

     Pourquoi c'est nécessaire. Un rapport d'utilisateur est revenu avec
     « expiration » pour tout contenu. Cela voulait dire : port branché, page
     silencieuse — et rien de plus. Or « content.js n'a jamais tourné » et
     « content.js a tourné puis est tombé » sont deux pannes qui se réparent
     autrement (recharger la page contre corriger un bogue), et elles étaient
     indiscernables. L'attribut posé sur <html> par content.js les sépare :
     absent, il n'est jamais entré ; présent, il dit jusqu'où il est allé. */
  const marque = () => {
    try { return document.documentElement.getAttribute('data-tse-boot'); }
    catch { return null; }
  };

  const observations = () => ({
    marque: marque(),
    etat: document.readyState,
    hote: location.hostname,
    cachee: document.hidden,
    pont: port ? 'branché' : 'coupé',
    reprises,
    pageMs: Date.now() - NE,
  });

  /* La réponse de la page. On ne répond QUE sur un identifiant qu'on a
     nous-même émis : un script de la page peut poster ce qu'il veut, mais il
     ne peut pas deviner un compteur qu'il ne voit pas passer — et s'il le
     devinait, il n'obtiendrait que de faire répondre son propre onglet à son
     propre panneau, avec des données que `window.tse` lui rend déjà. */
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.tse !== RES || typeof d.id !== 'number') return;
    const attente = attentes.get(d.id);
    if (!attente) return;
    attentes.delete(d.id);
    clearTimeout(attente.minuteur);
    /* La réponse ENTIÈRE, moins ce qui n'appartient qu'à ce saut. Recopier
       `ok`, `data`, `erreur` un par un est le défaut qui a rendu le rapport de
       diagnostic inutilisable — trois fichiers tenaient chacun leur liste de
       champs, et le troisième saut jetait ce que les deux autres avaient
       laissé passer. Ici, ce serait `partiel` : le journal d'erreurs d'un
       démarrage inachevé, c'est-à-dire le seul contenu utile d'un rapport
       quand la page va mal. Le banc l'a pris en flagrant délit. */
    const { tse: _t, id: _i, ...reponse } = d;
    envoyer({ reqId: attente.reqId, ...reponse, ok: !!d.ok });
  });

  /* Le port peut mourir sous nos pieds : le service worker s'endort, l'onglet
     navigue. On ne laisse pas cette erreur remonter — elle n'apprendrait rien
     à personne et casserait le gestionnaire pour les messages suivants. */
  const envoyer = (charge) => {
    try { port?.postMessage(charge); } catch { /* port fermé */ }
  };

  /* ── LE PORT NE VIT QUE PENDANT QUE L'ONGLET EST VISIBLE ────────────────
     Un port ouvert MAINTIENT LE SERVICE WORKER ÉVEILLÉ. Le garder branché en
     permanence tiendrait donc un worker en vie tant qu'un onglet Twitch est
     ouvert — c'est-à-dire, pour beaucoup de gens, tout le temps. Ce serait
     l'exact contraire de ce que fait le reste du produit, qui coupe tout ce
     qu'il peut dès que l'onglet passe en arrière-plan.

     Or le panneau s'ouvre depuis la barre d'outils, au-dessus de l'onglet
     ACTIF : le seul instant où l'on peut cliquer sur l'icône est un instant
     où l'onglet est visible. Lier le port à la visibilité rend donc au
     navigateur tout ce qu'il peut endormir sans rien retirer au panneau.

     LE COMPROMIS, QU'IL FAUT DIRE EN ENTIER. La première rédaction affirmait
     que cela « ne retire rien ». C'était faux, et un rapport d'utilisateur l'a
     montré : Chrome termine le worker après une trentaine de secondes
     d'inactivité MÊME sous un port ouvert, et la reconnexion qui suit ouvre
     une fenêtre aveugle. Elle était d'une seconde ; le panneau, lui, ne
     réessayait qu'une fois à 500 ms — donc entièrement à l'intérieur. Le
     panneau annonçait « aucun onglet Twitch » à quelqu'un qui en regardait un.

     La reprise est donc RAPIDE, et c'est ce qui décide du compromis réel : un
     onglet Twitch au premier plan garde le worker éveillé ; dès qu'il passe en
     arrière-plan, le port tombe et tout s'endort. C'est le bon partage — on ne
     dépense que pendant qu'on regarde, et l'icône est cliquable à cet
     instant-là précisément. */
  const REPRISE = 200;
  let minuteurReprise = null;

  const debrancher = () => {
    clearTimeout(minuteurReprise); minuteurReprise = null;
    try { port?.disconnect(); } catch { /* déjà fermé */ }
    port = null;
    for (const [, a] of attentes) clearTimeout(a.minuteur);
    attentes.clear();
  };

  const brancher = () => {
    if (port || document.hidden) return;
    try {
      port = chrome.runtime.connect({ name: 'tse-panneau' });
    } catch {
      // Extension rechargée ou désactivée : rien à relayer, on s'arrête.
      port = null;
      return;
    }
    port.onDisconnect.addListener(() => {
      port = null;
      /* Reprise seulement si l'onglet est encore regardé : sinon on laisserait
         le worker se rendormir puis le réveillerait aussitôt, en boucle. */
      if (!document.hidden && !minuteurReprise) {
        reprises++;
        minuteurReprise = setTimeout(() => { minuteurReprise = null; brancher(); }, REPRISE);
      }
    });
    port.onMessage.addListener((m) => {
      /* Même règle qu'au saut précédent : on ne connaît PAS la liste des
         champs d'une demande, on la transporte. La version qui exigeait
         `m.section || m.action` rejetait sans un mot la demande de rapport,
         qui n'a ni l'un ni l'autre. Ce qu'on vérifie, c'est qu'il y a un
         identifiant à qui répondre et quelque chose à demander. */
      if (!m || typeof m.reqId !== 'number') return;
      const { reqId: _r, ...demande } = m;
      if (!Object.keys(demande).length) return;

      /* PAS DE CONTENT.JS, PAS D'ATTENTE. Sans le jalon, personne ne peut
         répondre dans le monde MAIN — le message partirait pour ne jamais
         revenir, et le panneau attendrait trente secondes avant d'annoncer
         un silence qu'on connaissait déjà à cet instant précis. On rend la
         main tout de suite, en disant ce qu'on a vu. */
      if (!marque()) {
        envoyer({ reqId: m.reqId, ok: false, erreur: 'page-absente',
                  observations: observations() });
        return;
      }

      const id = ++suivant;
      const minuteur = setTimeout(() => {
        attentes.delete(id);
        /* NOMMÉ, et pas simplement « expiration » : background.js a lui aussi
           un garde-fou qui rend ce mot-là. Les deux répondaient à l'identique,
           donc un rapport ne disait pas lequel avait lâché — c'est-à-dire ne
           disait pas si le silence venait de la page ou du port. */
        envoyer({ reqId: m.reqId, ok: false, erreur: 'expiration-page',
                  observations: observations() });
      }, EXPIRATION);
      attentes.set(id, { reqId: m.reqId, minuteur });
      /* targetOrigin '*' pour la même raison que dans content.js : la cible
         est CE document, et `location.origin` vaut la chaîne "null" sur une
         origine opaque — le message serait jeté sans un mot. */
      window.postMessage({ tse: REQ, id, ...demande }, '*');
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) debrancher(); else brancher();
  });
  /* Un onglet peut NAÎTRE caché — lien ouvert en arrière-plan, session
     restaurée. On ne branche donc pas d'office : on demande son état. */
  brancher();
})();
