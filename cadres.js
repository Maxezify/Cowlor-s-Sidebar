/* ============================================================
 *  Cowlor's Sidebar for Twitch — LES PONTS D'IFRAME
 *  -------------------------------------------------------------
 *  Ce qui doit tourner DANS une iframe, et rien d'autre. Quatre
 *  ponts, chacun gardé par le nom que le module principal donne à
 *  SA frame : une frame qui ne le porte pas les laisse tous inertes.
 *
 *   • l'APERÇU (« tse-apercu ») : la première image affichée, et
 *     l'interstitielle de classification levée ;
 *   • les LECTEURS DE LA SALLE (« tse-salle ») : leur état chaque
 *     seconde, et les ordres de la salle ;
 *   • les CHATS DE LA SALLE (« tse-salle-chat ») : la console ;
 *   • le RELEVÉ DES CHAÎNES SUIVIES (« tse-suivies ») : les
 *     réponses que la page reçoit.
 *
 *  POURQUOI UN FICHIER À PART (4.25.0.9). Ces ponts vivaient en tête
 *  de content.js, et le manifeste injectait donc le module principal
 *  dans TOUTES les frames Twitch : un aperçu à chaque survol, chaque
 *  tuile et chaque chat de la salle, les cadres cachés des relevés
 *  analysaient et compilaient ses 740 Ko pour s'arrêter à sa première
 *  ligne. Mesuré à l'audit de la 4.25.0.8 : 25 à 47 ms de travail
 *  synchrone par iframe, sur le fil principal de la page qui la porte
 *  — player.twitch.tv est du même site que www.twitch.tv, donc du même
 *  processus. Le manifeste injecte maintenant ce fichier-ci, après
 *  l'anti-pub, dans toutes les frames ; et content.js dans le cadre
 *  principal seulement.
 *
 *  DEUX PORTÉES, ET ELLES SONT PORTEUSES. Les scripts du monde MAIN
 *  partagent la portée globale de la page : une `const` de premier
 *  niveau y devient une globale, et une seconde déclaration du même
 *  nom fait échouer TOUT le script qui la porte, avant sa première
 *  ligne (cf. les README, « Un second exemplaire dans la page »).
 *  C'est à la fois un piège et une garde :
 *
 *   — le PIÈGE : dans le cadre principal, ce fichier et content.js
 *     tournent ensemble. Les quatorze noms qu'ils partagent — celui
 *     de chaque frame, le type de chaque message — ne peuvent donc
 *     être globaux que d'un côté. Ils le sont dans content.js ; ici,
 *     ils vivent dans le bloc plus bas, hors de la portée de la page.
 *     Leurs valeurs sont recopiées, et `npm run addon` vérifie
 *     qu'elles sont égales et que la répartition tient ;
 *   — la GARDE : les six noms que les ponts sont seuls à employer
 *     restent globaux, ICI. Deux exemplaires de l'extension actifs à
 *     la fois — c'est arrivé — ne lancent donc qu'un jeu de ponts par
 *     frame : le second échoue sur le premier de ces noms. La garde
 *     tient aussi contre une version d'avant ce découpage, dont le
 *     content.js déclarait ces six noms dans toutes les frames.
 *
 *  Le bloc n'est qu'une portée, pas une fonction : son contenu est
 *  celui qu'il était dans content.js, indenté d'un cran — sauf
 *  l'intérieur du gabarit du worklet (MODULE_ENVELOPPE), dont les
 *  espaces font partie de la chaîne. Un renvoi à ce qui n'est pas
 *  ici — injectIframe, caler, surMessage, MARCHE_MS, le module
 *  SUIVIES — vise content.js : c'est lui qui pose ces frames et les
 *  écoute.
 * ============================================================ */

/* ── CE QUE LES PONTS SONT SEULS À EMPLOYER : GLOBAL, ET C'EST LA GARDE ───
   (cf. l'en-tête). Leur place naturelle est à côté du pont qui s'en sert ;
   ils sont rassemblés ici pour que la frontière entre les deux portées se
   lise d'un coup d'œil. */

// Les pages qui posent l'aperçu : les deux formes que le manifeste déclare.
const TSE_PREVIEW_PARENTS = ['https://www.twitch.tv', 'https://twitch.tv'];

/* L'ORIGINE DU PARENT IMMÉDIAT, quand le navigateur la donne ; null sinon.
   `ancestorOrigins` est ordonné du parent IMMÉDIAT vers le sommet : c'est
   bien l'indice 0 qu'il faut — le dernier viserait la page du haut, qui n'est
   le parent que dans le cas d'une iframe non imbriquée. Firefox ne
   l'implémente pas avant la 148.

   UNE SEULE LECTURE POUR LES DEUX PONTS (aperçu, salle) : la variante
   Firefox du banc neutralise cette ligne-ci, et elle seule
   (cf. tests/build.mjs). Deux lectures, et le second pont aurait gardé
   ancestorOrigins dans un banc censé reproduire Firefox. */
const tseOrigineParent = () => {
  try {
    const a = location.ancestorOrigins;
    return a && a.length ? a[0] : null;
  } catch { return null; }
};

// Le sélecteur de FFZ, à l'identique. C'est le seul point de contact avec le
// lecteur, et il est donc aussi étroit que possible.
const TSE_GATE_BUTTON =
  'button[data-a-target="content-classification-gate-overlay-start-watching-button"]';
// Repli si Twitch renomme le bouton : n'importe quel bouton, mais UNIQUEMENT
// dans le sous-arbre de l'interstitielle. Cliquer un bouton quelconque du
// lecteur couperait le son, ouvrirait les réglages, ou pire.
const TSE_GATE_ZONE = '[data-a-target^="content-classification-gate"]';
// Borne dure du nombre de clics. Un clic qui ne ferme pas l'interstitielle
// provoque des mutations, que l'observateur relit, qui recliquent : sans borne,
// c'est une boucle entretenue par elle-même.
const TSE_GATE_MAX_CLICKS = 5;

/* Les repères d'une pub, RELEVÉS sur le vrai Twitch par la troisième sonde
   (4.24.0.5) : ils paraissent ensemble au début d'une pub et partent
   ensemble à sa fin. Ce ne sont plus des mots cherchés, ce sont des noms.
   LEUR PRÉSENCE, ET NON PLUS LEUR VISIBILITÉ (4.24.0.27) : au journal de
   cette sonde, ils n'existaient que pendant la pub — jamais restés cachés
   entre deux coupures, sur deux pubs de 189 s en quatorze minutes. Un
   bloqueur qui les CACHE par une règle d'affichage laisse la pub jouer, et
   la visibilité seule ne la voyait plus. */
const TSE_PUB_REPERES = '[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"], '
  + '[data-test-selector="ad-banner-default-text"]';

/* ── CE QUE content.js EMPLOIE AUSSI : DANS UN BLOC, HORS DE LA PAGE ──────
   Les quatorze noms partagés sont déclarés ici en `const` de bloc : dans le
   cadre principal, content.js les déclare au premier niveau, et une seconde
   déclaration globale du même nom y ferait échouer l'un des deux fichiers.
   Tout ce qui suit les emploie, et vit donc dans la même portée. */
{
  /* ============================================================
   *  PONT D'APERÇU — dans le lecteur de l'aperçu au survol
   *  -------------------------------------------------------------
   *  Problème : `iframe.onload` signale la fin du chargement du DOCUMENT
   *  du lecteur, pas l'arrivée d'une image. Révéler l'iframe à ce
   *  moment-là posait un lecteur encore noir par-dessus la vignette,
   *  environ une seconde durant.
   *
   *  L'iframe étant cross-origin, le parent ne peut rien observer de son
   *  contenu. C'est donc l'iframe qui parle : à la première image
   *  réellement présentée, elle poste un message, et le parent fait
   *  alors son fondu (cf. injectIframe).
   *
   *  Ce module ne touche ni à la visibilité, ni au réseau — rien qui
   *  puisse entrer en conflit avec le module anti-pub, qui vit dans la
   *  même frame. Il touche au lecteur en UN point, et un seul : le bouton
   *  de l'interstitielle de classification (cf. ci-dessous).
   *
   *  L'INTERSTITIELLE DE CLASSIFICATION
   *  -------------------------------------------------------------
   *  Depuis les Content Classification Labels (2023), un stream étiqueté
   *  fait afficher au lecteur un écran « Commencer à regarder » qu'il faut
   *  acquitter avant que la vidéo ne parte. Dans un aperçu au survol, cet
   *  écran ne sera jamais cliqué : personne ne clique dans une vignette
   *  qu'on effleure. L'aperçu restait donc figé sur son JPEG — et
   *  l'extension, jusqu'ici, n'injectait même pas l'iframe dans ce cas.
   *
   *  Rien dans l'URL d'embed ne permet de l'éviter : Twitch le dit sur son
   *  forum développeurs, un embed non interactif ne peut pas lire un
   *  stream étiqueté. Le seul chemin est de cliquer le bouton, et il
   *  demande d'être DANS la frame du lecteur — ce que le manifeste nous
   *  donne (`player.twitch.tv` y est déclaré, `all_frames: true`).
   *
   *  C'est exactement ce que fait FrankerFaceZ, sous le réglage
   *  `player.disable-content-warnings` :
   *
   *      const btn = cont.querySelector('button[data-a-target=
   *          "content-classification-gate-overlay-start-watching-button"]');
   *      if (btn) btn.click();
   *
   *      — FrankerFaceZ, src/sites/shared/player.jsx, skipContentWarnings()
   *
   *  Deux différences avec FFZ, toutes deux voulues :
   *
   *   • FFZ passe par l'instance React pour trouver le nœud hôte ; ici
   *     l'iframe EST le lecteur, un querySelector sur le document suffit.
   *   • FFZ laisse le réglage à `false` par défaut. Ici il est actif : la
   *     vignette d'aperçu est muette, en 360p, et l'extension AFFICHE
   *     elle-même les étiquettes de classification dans le même encadré
   *     (badge « Étiquettes de contenu »). Ce que l'interstitielle sert à
   *     dire est donc dit — par nous, avant même le survol. Pour revenir
   *     au comportement de FFZ, passer TSE_GATE_ENABLED à false.
   * ============================================================ */
  const TSE_PREVIEW_FIRST_FRAME_MSG = 'tse:preview-first-frame';
  // Signalé au parent dès qu'une interstitielle est VUE. Le parent en a besoin :
  // son filet de révélation dévoilerait sinon la modale à la place de la vidéo.
  const TSE_PREVIEW_GATE_MSG = 'tse:preview-gate';
  // Signe de vie du pont, posté à son démarrage. Il ne change aucun comportement ;
  // il rend seulement distinguables deux pannes qui se ressemblent — « le pont ne
  // tourne pas dans cette iframe » et « il tourne mais ne trouve pas la modale ».
  const TSE_PREVIEW_HELLO_MSG = 'tse:preview-hello';

  /* L'IFRAME D'APERÇU SE RECONNAÎT À SON NOM (4.24.0.1, phase 0 du multistream).

     Le manifeste injecte l'extension dans TOUT lecteur player.twitch.tv, sur
     n'importe quel site : c'est ce qu'il faut pour atteindre l'iframe d'aperçu,
     et c'est bien plus qu'elle. Jusqu'ici, ce pont et le module anti-pub
     agissaient dans chacun de ces lecteurs : un lecteur Twitch intégré à un
     site d'actualité voyait sa pub bloquée et son interstitielle de
     classification levée. La fiche du Store promet pourtant que le blocage
     « s'applique à la vignette d'aperçu au survol, et à rien d'autre ».

     L'aperçu porte donc un nom, posé par injectIframe, et les deux modules
     n'agissent que dans une frame qui le porte ET dont le parent est une page
     twitch.tv. Le nom d'une frame se lit de l'intérieur dès document_start, ne
     part pas au serveur comme le ferait un paramètre d'adresse, et survit à
     une navigation interne du lecteur. adblock.js, chargé avant ce fichier, ne
     peut pas lire ces constantes : il en recopie les valeurs, et le banc
     vérifie qu'elles sont égales. */
  const TSE_PREVIEW_FRAME_NAME = 'tse-apercu';

  // Le levage de l'interstitielle. À false, on retrouve le comportement de la
  // 3.54 : les streams étiquetés restent sur leur vignette.
  const TSE_GATE_ENABLED = true;

  (() => {
    'use strict';

    // Uniquement dans NOTRE iframe d'aperçu : un lecteur, qui porte le nom que
    // lui donne injectIframe. Le try/catch couvre la SecurityError théorique sur
    // window.top en cross-origin.
    try {
      if (window.top === window) return;
      if (location.hostname !== 'player.twitch.tv') return;
      if (window.name !== TSE_PREVIEW_FRAME_NAME) return;
    } catch { return; }

    // Origines destinataires : le parent immédiat quand on le connaît, sinon
    // les deux formes que le manifeste déclare. Un envoi vers une origine qui
    // ne correspond pas est simplement ignoré par le navigateur. Jamais '*' :
    // le message ne porte aucune donnée, mais diffuser à l'aveugle reste une
    // habitude à ne pas prendre.
    const parentConnu = tseOrigineParent();
    // Un parent CONNU qui n'est pas twitch.tv : ce n'est pas notre aperçu, quel
    // que soit son nom — un site tiers peut nommer son iframe comme il veut. Sans
    // ancestorOrigins (Firefox avant la 148), le nom seul tranche.
    if (parentConnu && !TSE_PREVIEW_PARENTS.includes(parentConnu)) return;
    const targets = parentConnu ? [parentConnu] : TSE_PREVIEW_PARENTS;

    const poster = (quoi) => {
      for (const origin of targets) {
        try { window.parent.postMessage({ tse: quoi }, origin); } catch { /* origine refusée */ }
      }
    };

    // Signe de vie, posté au démarrage. Il ne sert qu'au diagnostic (tse.apercu),
    // et il sert à trancher LA question qu'on ne pouvait pas trancher autrement :
    // « le pont tourne-t-il seulement dans cette iframe ? ». Sans lui, un pont
    // muet et un pont qui ne trouve rien se ressemblent exactement.
    poster(TSE_PREVIEW_HELLO_MSG);

    /* Le bouton d'acquittement, s'il est VISIBLE.
       La visibilité n'est pas un détail : Twitch peut laisser le sur-cadre dans
       le DOM après coup. Le chercher sans regarder sa taille ferait croire à une
       modale éternelle, et l'aperçu ne se dévoilerait alors plus jamais — on
       aurait remplacé un défaut par son symétrique. */
    const gateBouton = () => {
      const visible = (b) => {
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return (r.width > 0 && r.height > 0) ? b : null;
      };
      const direct = visible(document.querySelector(TSE_GATE_BUTTON));
      if (direct) return direct;
      const zone = document.querySelector(TSE_GATE_ZONE);
      return zone ? visible(zone.querySelector('button')) : null;
    };

    let sent = false, imagePrete = false;
    /* Le signal de première image, RETENU tant qu'une modale est à l'écran.
       Sans cette retenue, un lecteur qui pose son élément <video> avant que
       l'écran d'acquittement n'apparaisse — ce que Twitch fait — annonçait une
       image que personne ne voyait, et le parent dévoilait la modale. */
    const annoncer = () => {
      if (sent || !imagePrete) return;
      if (gateBouton()) return;
      sent = true;
      poster(TSE_PREVIEW_FIRST_FRAME_MSG);
    };
    const announce = () => { imagePrete = true; annoncer(); };

    /* L'interstitielle de classification. Cf. l'en-tête du module pour le
       pourquoi ; ici, le comment.

       Un clic par BOUTON, jamais deux : React remonte parfois l'overlay, et le
       nouveau bouton mérite son clic, mais recliquer le même n'apporte rien et
       nourrit la boucle décrite plus haut. D'où le WeakSet, doublé d'une borne
       dure sur le total. */
    const cliques = new WeakSet();
    let clics = 0, gateVue = false;
    const lever = () => {
      // Rien de plus à faire : la modale a été signalée, et soit le levage est
      // coupé, soit la borne de clics est atteinte. Sortir ici épargne deux
      // querySelector à CHAQUE lot de mutations du lecteur, qui en produit
      // beaucoup — et `annoncer` garde de son côté ce qu'il lui faut.
      if (gateVue && (!TSE_GATE_ENABLED || clics >= TSE_GATE_MAX_CLICKS)) return;
      const btn = gateBouton();
      if (!btn) return;

      /* SIGNALER d'abord, et TOUJOURS — même quand le levage est coupé.

         C'est ce qui rend TSE_GATE_ENABLED honnête. Le drapeau à false a d'abord
         coupé le signalement avec le clic : le parent ne savait alors rien de
         l'interstitielle, son filet ordinaire jouait, et l'aperçu dévoilait la
         modale en travers de la vignette. « Revenir au comportement d'avant »
         donnait donc pire qu'avant. Le banc l'a dit en mutation, pas la relecture.

         Signaler sans cliquer, c'est l'ancien comportement pour de bon : pas de
         vidéo sur les chaînes étiquetées, la vignette à la place. */
      if (!gateVue) { gateVue = true; poster(TSE_PREVIEW_GATE_MSG); }

      if (!TSE_GATE_ENABLED || clics >= TSE_GATE_MAX_CLICKS) return;
      if (cliques.has(btn)) return;
      cliques.add(btn);
      clics += 1;
      try { btn.click(); } catch { /* nœud retiré entre-temps */ }
    };

    const watch = (video) => {
      // Les trois signaux sont posés EN CONCURRENCE, à dessein : on dévoile au
      // premier qui parle. requestVideoFrameCallback est le plus juste — il dit
      // qu'une image a été PRÉSENTÉE — mais `playing` (la lecture démarre) et
      // `readyState` (des données existent) peuvent arriver avant lui.
      //
      // La 3.28.1 avait resserré ce choix : rVFC seul, puis attente de
      // HAVE_FUTURE_DATA, pour éviter de dévoiler pendant que le lecteur affiche
      // encore son propre voile de chargement. Retour à la course sur demande,
      // après essai. Ne pas « corriger » ce point sans mesure : la variante
      // stricte a été essayée, elle est dans l'historique (3.28.1).
      if (typeof video.requestVideoFrameCallback === 'function') {
        try { video.requestVideoFrameCallback(announce); } catch { /* ignore */ }
      }
      video.addEventListener('playing', announce, { once: true });
      if (video.readyState >= 2) announce();   // HAVE_CURRENT_DATA : une image existe
    };

    /* Le nœud <video> SOUS SURVEILLANCE, et non un simple booléen.
       Un booléen supposait que l'élément vidéo, une fois trouvé, restait le même.
       Twitch le remplace — notamment quand la source repart après l'acquittement
       de l'interstitielle. On aurait alors continué d'écouter un nœud détaché :
       `playing` n'y arrive jamais, la première image n'est jamais annoncée, et
       l'aperçu retombe sur sa vignette alors que la vidéo joue juste à côté. */
    let vue = null;
    const scan = () => {
      lever();
      const v = document.querySelector('video');
      if (v && v !== vue) { vue = v; watch(v); }
      // Le signal a pu être retenu par une modale que le passage précédent vient
      // de lever : on le rejoue à chaque tour.
      annoncer();

      /* On ne se retire QUE sur la première image annoncée.
         La 3.55 se retirait dès qu'une <video> était sous surveillance et
         qu'aucune modale n'était à l'écran. C'était fondé sur une idée fausse —
         « sur un stream étiqueté, la <video> n'existe qu'une fois l'écran
         acquitté ». Twitch pose son élément <video> avec le lecteur, AVANT que
         l'écran d'acquittement ne se rende. La veille s'arrêtait donc juste avant
         ce qu'elle attendait : la modale apparaissait dans une frame que plus
         personne ne regardait, n'était ni cliquée ni signalée, et le filet
         ordinaire du parent la dévoilait. Vu en production, pas au banc — le
         harnais rendait sa modale AVANT la vidéo, l'ordre inverse. */
      return sent;
    };

    // À document_start il n'y a ni <video> ni interstitielle. On les attend, sans
    // surveiller indéfiniment : passé le délai, l'observation cesse et le parent
    // tranche de lui-même par ses propres filets.
    if (!scan()) {
      const root = document.documentElement;
      if (!root) return;
      const mo = new MutationObserver(() => { if (scan()) mo.disconnect(); });
      mo.observe(root, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 15_000);
    }
  })();

  /* ============================================================
   *  LE PONT DES LECTEURS DE LA SALLE (4.24.0.6, phase 1 du multistream)
   *  -------------------------------------------------------------
   *  La salle pose de vrais lecteurs intégrés, nommés « tse-salle », et CE
   *  pont, dans chacun, dit ce qui s'y passe et exécute ce qu'elle demande.
   *
   *  UN NOM À LUI, et pas celui de l'aperçu : ni l'anti-pub ni le pont
   *  d'aperçu ne s'éveillent ici. Le lecteur est tel que Twitch le sert.
   *
   *  CE QU'IL RAPPORTE, chaque seconde : la vidéo (lecture, son, volume,
   *  vitesse), ses images et ses octets décodés, la qualité, la latence et le
   *  tampon selon le lecteur de Twitch, une pub (TSE_PUB_REPERES), un
   *  avertissement de contenu, les gestes de l'utilisateur ; et, à la demande
   *  de la salle, un relevé daté — position, plages, essais, enveloppe du son.
   *
   *  CE QU'IL ACCEPTE, de son parent seul et d'une page twitch.tv seulement :
   *  le son et le silence, la pause et la reprise — par les boutons du
   *  lecteur, comme Twitch le recommande, à défaut par l'élément vidéo —, la
   *  qualité, le relevé, un recul ou une avance dans le tampon, la faible
   *  latence retirée.
   *
   *  LA SONDE DE PHASE 0 (4.24.0.3 à 4.24.0.5) partageait ce pont : ses
   *  questions — pubs, son, points, charge, Chat partagé — sont tranchées
   *  depuis, et elle est partie à l'audit de la 4.24.0.24. Ce qu'elle seule
   *  mesurait et qui sert encore — le débit, les images perdues, les tâches
   *  longues par coupable, l'avertissement de contenu — est passé au rapport
   *  de la salle.
   * ============================================================ */
  const TSE_SALLE_FRAME_NAME = 'tse-salle';
  const TSE_SALLE_ETAT_MSG = 'tse:salle-etat';
  const TSE_SALLE_ORDRE_MSG = 'tse:salle-ordre';
  // La réponse d'un lecteur à un relevé demandé par la salle (4.24.0.11).
  const TSE_SALLE_RELEVE_MSG = 'tse:salle-releve';
  // Une commande tapée dans la console d'une tuile, relayée à la salle, et sa
  // réponse (4.24.0.12).
  const TSE_SALLE_CONSOLE_MSG = 'tse:salle-console';
  const TSE_SALLE_CONSOLE_REPONSE = 'tse:salle-console-reponse';
  const TSE_SALLE_CHAT_NAME = 'tse-salle-chat';

  (() => {
    'use strict';

    try {
      if (window.top === window) return;
      if (location.hostname !== 'player.twitch.tv') return;
      if (window.name !== TSE_SALLE_FRAME_NAME) return;
    } catch { return; }
    const parentConnu = tseOrigineParent();
    if (parentConnu && !TSE_PREVIEW_PARENTS.includes(parentConnu)) return;
    const cibles = parentConnu ? [parentConnu] : TSE_PREVIEW_PARENTS;

    const BOUTON_SON = 'button[data-a-target="player-mute-unmute-button"]';
    const BOUTON_LECTURE = 'button[data-a-target="player-play-pause-button"]';
    const enPub = () => document.querySelector(TSE_PUB_REPERES) !== null;
    let ordre = null;
    let numeroOrdre = 0;

    /* LES GESTES DE L'UTILISATEUR DANS LE LECTEUR (4.24.0.8), comptés — un
       clic, une touche, jamais ce qu'ils visent. La salle relance le son d'une
       tuile que Twitch a remise en muet après coup ; un geste dans ce lecteur
       veut dire que l'utilisateur a pris la main, et elle cesse. Seuls les
       événements de confiance comptent : nos propres clics sur les boutons du
       lecteur n'en sont pas. */
    let gestes = 0;
    const compterGeste = (e) => { if (e.isTrusted) gestes += 1; };
    window.addEventListener('pointerdown', compterGeste, true);
    window.addEventListener('keydown', compterGeste, true);
    /* L'AVERTISSEMENT DE CONTENU (4.24.0.24, à l'audit). L'aperçu le lève
       depuis la 3.55 ; la salle, jamais : une tuile dont la chaîne porte un
       label de classification restait sur son écran d'acquittement — ni
       image, ni son, rien à caler —, et la prise, posée sur toute tuile
       muette, prenait le clic que l'utilisateur lui destinait. Levé ici comme
       dans l'aperçu, par le même bouton — l'utilisateur a choisi ces streams
       en ouvrant la salle —, un clic par bouton, cinq au plus ; au rapport,
       qu'il a été vu, et combien de clics. TSE_GATE_ENABLED à false : vu, pas
       levé. */
    const leves = new WeakSet();
    let avertissementVu = false, avertissementClics = 0;
    const leverAvertissement = () => {
      // Visible comme dans l'aperçu : un sur-cadre resté dans le DOM n'en est pas un.
      const visible = (b) => { if (!b) return null; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? b : null; };
      const zone = document.querySelector(TSE_GATE_ZONE);
      const bouton = visible(document.querySelector(TSE_GATE_BUTTON)) || (zone ? visible(zone.querySelector('button')) : null);
      if (!bouton) return false;
      avertissementVu = true;
      if (!TSE_GATE_ENABLED || avertissementClics >= TSE_GATE_MAX_CLICKS || leves.has(bouton)) return true;
      leves.add(bouton);
      avertissementClics += 1;
      try { bouton.click(); } catch { /* retiré entre-temps */ }
      return true;
    };
    /* ── LE LECTEUR DE TWITCH LUI-MÊME (4.24.0.10) ──────────────────────────
       La qualité se choisit par l'instance du lecteur, pas par l'URL : le
       paramètre « quality » n'est qu'une préférence que l'adaptation de débit
       dépasse (mesuré en 3.26 pour l'aperçu). `setQuality` sur l'instance, lui,
       fixe la qualité et sort le lecteur du mode automatique — c'est le chemin
       du module anti-pub, repris de TwitchAdSolutions et éprouvé dans ce même
       lecteur intégré. On l'atteint de la même façon : par l'arbre React de la
       page du lecteur, jusqu'au composant qui porte `mediaPlayerInstance`.
       Introuvable (Twitch a changé), le rapport le dit, et rien ne casse. */
    let instanceLecteur = null;
    // Une minute de recherche au plus, depuis la première : le temps que le
    // lecteur se monte. Au-delà, l'arbre a changé, et le parcourir à chaque
    // relevé, dans chaque tuile, ne coûterait que du temps.
    let rechercheDepuis = 0;
    const lecteurTwitch = () => {
      if (instanceLecteur) return instanceLecteur;
      if (!rechercheDepuis) rechercheDepuis = Date.now();
      else if (Date.now() - rechercheDepuis > 60_000) return null;
      try {
        const racine = document.getElementById('root');
        if (!racine) return null;
        let fibre = racine._reactRootContainer?._internalRoot?.current || null;
        if (!fibre) {
          const cle = Object.keys(racine).find((k) => k.startsWith('__reactContainer'));
          fibre = cle ? racine[cle] : null;
        }
        if (!fibre) return null;
        // En largeur, pas en profondeur récursive : l'arbre d'une page de
        // lecteur est profond, et une pile épuisée ne doit rien casser.
        const file = [fibre];
        for (let i = 0; i < file.length && i < 20_000; i++) {
          const n = file[i];
          const inst = n.stateNode && n.stateNode.props && n.stateNode.props.mediaPlayerInstance;
          if (inst && n.stateNode.setPlayerActive) {
            instanceLecteur = inst.playerInstance || inst;
            return instanceLecteur;
          }
          if (n.child) file.push(n.child);
          if (n.sibling) file.push(n.sibling);
        }
      } catch { /* arbre illisible : pas de lecteur */ }
      return null;
    };
    /* LA QUALITÉ VOULUE : une HAUTEUR en pixels d'écran, donnée par la salle.
       Le pont choisit dans l'échelle RÉELLE de la chaîne — elle varie d'une
       chaîne à l'autre — la qualité la plus proche, la plus haute à égalité,
       et la pose. PROCHE EN PROPORTION, pas en pixels : une tuile de 308 px
       est à 148 px de 160p et à 172 de 480p, mais 160p y serait agrandie deux
       fois, et 480p réduite d'un tiers — c'est 480p qui est la plus proche de
       ce que l'œil voit. Reposée si le lecteur revient en automatique, cinq fois au
       plus par demande, jamais deux fois en trois secondes.
       UN CRAN AU-DESSUS (4.24.0.19) : à la demande — « ça pixellise » —, la
       hauteur suivante de l'échelle, au-dessus de la plus proche : 720p pour
       les tuiles de 551 px de la salle à trois, qui étaient en 480p. Rien
       au-dessus de la plus haute. */
    let hauteurVoulue = null;
    let qualiteEssais = 0;
    let qualiteT = 0;
    // La meilleure d'une hauteur : la plus fluide.
    const meilleureA = (echelle, hauteur) => echelle.filter((q) => q && q.height === hauteur)
      .reduce((p, q) => (!p || (q.framerate || 0) > (p.framerate || 0) ? q : p), null);
    const choisirQualite = (echelle, h) => {
      let meilleure = null;
      for (const q of echelle) {
        if (!q || !Number.isFinite(q.height)) continue;
        const ecart = Math.abs(Math.log(q.height / h));
        if (!meilleure || ecart < meilleure.ecart
          || (ecart === meilleure.ecart && (q.height > meilleure.q.height
            || (q.height === meilleure.q.height && (q.framerate || 0) > (meilleure.q.framerate || 0))))) {
          meilleure = { q, ecart };
        }
      }
      if (!meilleure) return null;
      const dessus = echelle.filter((q) => q && Number.isFinite(q.height) && q.height > meilleure.q.height)
        .reduce((p, q) => (p === null || q.height < p ? q.height : p), null);
      return dessus === null ? meilleure.q : meilleureA(echelle, dessus);
    };
    /* PAS PENDANT UNE PUB (4.24.0.27) : le lecteur y joue l'image de la pub —
       1920 × 1080 au relevé réel, quelle que soit la qualité posée —, et
       chaque essai usé là manquerait après : une pub d'entrée de quatorze
       secondes prenait les cinq, à trois secondes l'un de l'autre. */
    const tenirQualite = () => {
      if (!hauteurVoulue || qualiteEssais >= 5 || Date.now() - qualiteT < 3000 || enPub()) return;
      const lecteur = lecteurTwitch();
      if (!lecteur || typeof lecteur.setQuality !== 'function') return;
      let echelle = [];
      try { echelle = lecteur.getQualities() || []; } catch { return; }
      const cible = choisirQualite(echelle, hauteurVoulue);
      if (!cible) return;
      let actuelle = null, auto = null;
      try { actuelle = lecteur.getQuality && lecteur.getQuality(); } catch { /* ignore */ }
      try { auto = lecteur.isAutoQualityMode ? lecteur.isAutoQualityMode() : null; } catch { /* ignore */ }
      if (actuelle && actuelle.name === cible.name && auto === false) return;
      try {
        lecteur.setQuality(cible);
        qualiteEssais += 1;
        qualiteT = Date.now();
      } catch { qualiteEssais += 1; qualiteT = Date.now(); }
    };
    // Relevés en lecture seule, pour l'étude de la synchronisation (4.24.0.10) :
    // la latence du direct selon le lecteur, son tampon, la vitesse de lecture.
    const releveLecteur = () => {
      const lecteur = lecteurTwitch();
      if (!lecteur) return { lecteur: false };
      const lire = (f) => { try { const x = f(); return Number.isFinite(x) ? Math.round(x * 100) / 100 : null; } catch { return null; } };
      let nom = null, auto = null;
      try { nom = lecteur.getQuality ? (lecteur.getQuality() || {}).name || null : null; } catch { /* ignore */ }
      try { auto = lecteur.isAutoQualityMode ? !!lecteur.isAutoQualityMode() : null; } catch { /* ignore */ }
      return {
        lecteur: true, qualite: nom, auto,
        latence: lecteur.getLiveLatency ? lire(() => lecteur.getLiveLatency()) : null,
        tampon: lecteur.getBufferDuration ? lire(() => lecteur.getBufferDuration()) : null,
      };
    };
    // Ce que la salle affiche et ce qu'elle tient, chaque seconde.
    const etatSalle = () => {
      const v = document.querySelector('video');
      tenirQualite();
      const avertissement = leverAvertissement();
      /* LA CHARGE D'UN LECTEUR (4.24.0.24, reprise de la sonde de phase 0) :
         les images décodées et perdues — un lecteur qui en perd, c'est une
         machine qui ne suit pas tant de streams —, et les octets décodés,
         d'où son débit (Chromium seul). Des compteurs, que la salle cumule. */
      const q = v && typeof v.getVideoPlaybackQuality === 'function' ? v.getVideoPlaybackQuality() : null;
      return {
        ...releveLecteur(),
        qualiteVoulue: hauteurVoulue,
        vitesse: v ? v.playbackRate : null,
        video: !!v,
        lecture: !!v && !v.paused,
        muet: v ? v.muted : null,
        // Au rapport seulement : un lecteur non muet à volume nul se tait aussi.
        volume: v ? Math.round(v.volume * 100) / 100 : null,
        images: q ? q.totalVideoFrames : null,
        perdues: q ? q.droppedVideoFrames : null,
        octets: v && typeof v.webkitVideoDecodedByteCount === 'number'
          ? v.webkitVideoDecodedByteCount + (Number(v.webkitAudioDecodedByteCount) || 0) : null,
        // Présente, la pub (4.24.0.27) ; visible, au rapport seulement — un bloqueur peut la cacher.
        pub: enPub(),
        pubVisible: [...document.querySelectorAll(TSE_PUB_REPERES)].some((el) => el.getClientRects().length > 0),
        boutonSon: !!document.querySelector(BOUTON_SON),
        avertissement, avertissementVu, avertissementClics,
        gestes,
        ordre,
      };
    };

    /* ── LA SONDE DU MÊME INSTANT (4.24.0.11) ───────────────────────────────
       Le premier rapport réel a donné UNE valeur de latence par tuile, lue à
       des instants différents : chaque pont envoie son état à son rythme, et
       le rapport garde le dernier. Pour mesurer un écart entre tuiles, il faut
       les lire ENSEMBLE — c'est la salle qui demande désormais un relevé, à
       toutes à la fois, et chacune répond sur-le-champ, avec l'heure de sa
       réponse : le rapport dit de combien les relevés d'un même tour se sont
       écartés. Lecture seule, sauf ce que la salle demande : un déplacement,
       la faible latence retirée, et l'écoute (S9), allumée par elle. */
    const lireNombre = (f, chiffres = 3) => {
      try {
        const x = f();
        const p = 10 ** chiffres;
        return Number.isFinite(x) ? Math.round(x * p) / p : null;
      } catch { return null; }
    };
    /* L'API DU LECTEUR : les noms de ses fonctions, les siennes et celles de
       ses prototypes — c'est là que vivent les méthodes d'une classe. Lus par
       leurs descripteurs, sans jamais appeler un accesseur. Pour savoir quels
       leviers existent vraiment chez Twitch, pas dans une documentation. */
    const lireApi = (lecteur) => {
      const noms = new Set();
      for (let o = lecteur; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
        for (const k of Object.getOwnPropertyNames(o)) {
          if (k === 'constructor') continue;
          const d = Object.getOwnPropertyDescriptor(o, k);
          if (d && typeof d.value === 'function') noms.add(k);
        }
      }
      return [...noms].sort();
    };
    /* LE DERNIER ESSAI : un déplacement demandé par la salle — recul ou
       avance —, ou la faible latence retirée (4.24.0.21). Le pont le garde ; la
       salle le note avec la latence du moment. */
    let essai = null;
    let numeroEssai = 0;
    /* LE RECUL DANS LE TAMPON (4.24.0.13). La pause, au rapport réel, a fait
       RECHARGER le lecteur : il est revenu au direct. Reculer d'une seconde —
       de 0,2 à 5 à la console — dans ce qui est déjà téléchargé, par `seekTo`,
       retient-il la tuile, ou le lecteur y revient-il aussi ? La position
       avant et, une demi-seconde après, la position obtenue. Le troisième
       rapport réel a répondu : 1,104 s obtenue, tenue plus de deux minutes.
       L'AVANCE (4.24.0.14), l'inverse : sauter en avant dans le tampon — sans
       jamais y entrer à moins d'une demi-seconde de son bout, faute de quoi
       la tuile calerait. `sens` : 1 recule, −1 avance. */
    const deplacer = (s, sens = 1) => {
      const lecteur = lecteurTwitch();
      const v = document.querySelector('video');
      const type = sens > 0 ? 'recul' : 'avance';
      /* JAMAIS PENDANT UNE PUB (4.24.0.27). La salle n'en demande pas (cf.
         caler) ; ceci est la seconde garde, pour un ordre parti juste avant le
         début de la pub. Déplacer la pub ne cale rien — elle n'est pas le
         direct —, et ce que le lecteur en ferait n'a jamais été mesuré. */
      if (enPub()) {
        essai = { n: ++numeroEssai, type, valeur: s, voie: 'refusé : pub', t: Date.now(), fin: Date.now(),
                  avant: null, apres: null };
        return;
      }
      if (sens < 0) {
        const tampon = lecteur && typeof lecteur.getBufferDuration === 'function' ? lireNombre(() => lecteur.getBufferDuration()) : null;
        if (tampon !== null && tampon < s + 0.5) {
          essai = { n: ++numeroEssai, type, valeur: s, voie: `refusé : tampon ${tampon} s`, t: Date.now(), fin: Date.now(),
                    avant: null, apres: null };
          return;
        }
      }
      let voie = null, avant = null;
      const t0 = performance.now();
      if (lecteur && typeof lecteur.seekTo === 'function' && typeof lecteur.getPosition === 'function') {
        try { avant = lecteur.getPosition(); lecteur.seekTo(avant - sens * s); voie = 'instance'; } catch { /* voie suivante */ }
      }
      if (!voie && v) { avant = v.currentTime; v.currentTime = avant - sens * s; voie = 'video'; }
      const e = { n: ++numeroEssai, type, valeur: s, voie: voie || 'sans-video', t: Date.now(), fin: null,
                  avant: Number.isFinite(avant) ? Math.round(avant * 1000) / 1000 : null, apres: null };
      essai = e;
      if (!voie) return;
      setTimeout(() => {
        const p = voie === 'instance' ? lireNombre(() => lecteur.getPosition()) : (v ? v.currentTime : null);
        e.apres = Number.isFinite(p) ? Math.round(p * 1000) / 1000 : null;
        // Le temps écoulé depuis le recul : la lecture a continué pendant ce
        // temps, et la salle en tient compte (recul obtenu).
        e.ecouleS = Math.round(performance.now() - t0) / 1000;
        e.fin = Date.now();
      }, 500);
    };
    /* LA FAIBLE LATENCE RETIRÉE (4.24.0.21). Au quatorzième rapport réel, une
       tuile en faible latence, reculée de 4,9 s, est repartie d'elle-même à
       1,03 et a repris ces 4,4 s en 146 secondes — son lecteur vise sa latence
       basse, et défait tout recul. Une salle calée n'en veut pas : la salle
       la retire, une fois, par setLiveLowLatencyEnabled(false) — un booléen,
       que l'instance sait passer (cf. setLiveMaxLatency, qu'elle ne savait
       pas). « instance » dit seulement qu'aucune exception n'est revenue ici ;
       ce qu'il a fait, isLiveLowLatency le dit au relevé suivant. */
    const retirerFaibleLatence = () => {
      const lecteur = lecteurTwitch();
      let voie;
      if (!lecteur || typeof lecteur.setLiveLowLatencyEnabled !== 'function') voie = 'absent';
      else {
        try { lecteur.setLiveLowLatencyEnabled(false); voie = 'instance'; } catch (err) { voie = `refusé : ${(err && err.name) || 'erreur'}`; }
      }
      essai = { n: ++numeroEssai, type: 'faible-latence', valeur: false, voie, t: Date.now(), fin: Date.now() };
    };
    /* LE TAMPON EN ARRIÈRE (4.24.0.17) : jusqu'où un recul peut aller dans ce
       que le lecteur garde. Aux rapports réels, aucun recul n'a dépassé
       1,4 s ; une salle qui mêle faible latence et latence normale en
       demanderait 3 à 5. Par l'élément : le début de la plage qui contient la
       lecture. Par l'instance : getBufferedRanges, sous la forme qu'il rend —
       paires, objets {start, end} ou TimeRanges —, huit plages au plus. */
    const arriereElement = (v) => {
      try {
        if (!v || !v.buffered || !Number.isFinite(v.currentTime)) return null;
        for (let i = 0; i < v.buffered.length; i++) {
          const s = v.buffered.start(i), e = v.buffered.end(i);
          if (v.currentTime >= s && v.currentTime <= e + 0.1) return Math.round((v.currentTime - s) * 1000) / 1000;
        }
      } catch { /* ignore */ }
      return null;
    };
    /* LA FORME DE CE QU'IL REND (4.24.0.18) : aux huitième et neuvième
       rapports réels, « forme object » sur toutes les tuiles — ni paires, ni {start, end}, ni
       TimeRanges. Désormais son constructeur et ses clés, six au plus, chacune
       avec son type ; et si l'une d'elles — « video » d'abord — tient un
       tableau de plages, on le lit. */
    const formeDe = (r) => {
      if (!r || typeof r !== 'object') return `forme ${r === null ? 'null' : typeof r}`;
      const proto = Object.getPrototypeOf(r);
      const nom = proto && proto.constructor && proto.constructor.name;
      const cles = [];
      for (const k in r) {
        if (cles.length >= 6) break;
        const v = r[k];
        cles.push(`${k}:${Array.isArray(v) ? `tableau ${v.length}` : typeof v}`);
      }
      return (`forme ${Array.isArray(r) ? 'tableau' : 'object'}${nom && nom !== 'Object' && nom !== 'Array' ? ` ${nom}` : ''}`
        + ` · ${cles.length ? cles.join(', ') : 'aucune clé'}`).slice(0, 160);
    };
    const lirePlages = (lecteur) => {
      let r;
      try { r = lecteur.getBufferedRanges(); } catch { return { plages: 'erreur', forme: null }; }
      const paire = (x) => (Array.isArray(x) && x.length >= 2 ? [x[0], x[1]]
        : x && typeof x === 'object' && 'start' in x && 'end' in x ? [x.start, x.end] : null);
      let l = null;
      if (Array.isArray(r)) l = r.map(paire);
      else if (r && typeof r.length === 'number' && typeof r.start === 'function') {
        l = [];
        try { for (let i = 0; i < Math.min(r.length, 8); i++) l.push([r.start(i), r.end(i)]); } catch { return { plages: 'erreur', forme: formeDe(r) }; }
      } else if (r && typeof r === 'object') {
        let cles = [];
        try { cles = ['video', ...Object.keys(r)]; } catch { /* rien */ }
        const tab = cles.map((k) => r[k]).find((v) => Array.isArray(v) && v.length && paire(v[0]));
        if (tab) l = tab.map(paire);
      }
      const forme = Array.isArray(r) || r === undefined || r === null ? null : formeDe(r);
      if (!l) return { plages: r === undefined || r === null ? null : forme, forme };
      return { plages: l.slice(0, 8).map((x) => (x && x.every(Number.isFinite) ? x.map((y) => Math.round(y * 1000) / 1000) : null)), forme };
    };
    /* ── L'ÉCOUTE (S9) : LE DÉCALAGE RÉEL, MESURÉ PAR LE SON ──────────────────
       Deux co-streamers qui se parlent diffusent chacun la voix de l'autre :
       le même son passe dans les deux streams. Le décalage entre deux tuiles se
       mesure alors là où l'œil le voit, part du diffuseur comprise — ce que la
       latence du lecteur ne voit pas.

       MESURÉ SOUS CHROMIUM AVANT D'ÊTRE ÉCRIT (cf. README) :
         — `captureStream()` rend le son d'un élément MUET ou à volume nul, tel
           quel ; `createMediaElementSource`, lui, rend du silence pour un
           élément muet, et détourne la sortie du lecteur. D'où la capture ;
         — un AudioContext d'iframe démarre suspendu, et `resume()` n'aboutit
           qu'après un geste dans la page parente, délégué par l'attribut
           `allow="autoplay"` que portent les tuiles. D'où le `resume()` redit
           à chaque relevé tant qu'il est suspendu.

       CE QUI EN SORT : l'ENVELOPPE du son — le niveau moyen de chaque bloc de
       1024 échantillons (~21 ms), rien d'autre. Chaque bloc est daté par son
       RANG : un bloc dure exactement 1024 échantillons, et le n-ième commence
       n × 1024 échantillons après le premier. Ce temps est ramené à l'heure
       commune par le plus petit écart observé entre l'heure du rappel et la
       fin du bloc, sur les dix à vingt dernières secondes : un rappel ne peut
       qu'être en retard, jamais en avance, et le plus petit retard est la
       meilleure ancre — tant que l'horloge audio ne saute pas (4.24.0.31, cf.
       MARCHE_MS). Ni le son ni l'enveloppe ne quittent la page ; le
       rapport ne porte que le décalage calculé.

       PAS `playbackTime` (4.24.0.13). Il datait les blocs jusqu'ici, et le banc
       a montré qu'il porte, sous Chromium, une gigue de ±4 ms — des pas de 17 à
       32 ms pour une période de 23,22 — IDENTIQUE dans toutes les tuiles, au
       dixième de milliseconde. Sur le banc à deux voix, six passes datées par
       lui ont donné trois calculs sur trente-six avec un pic parasite (à
       −10 ms, z 16,5 ; à −2 580 ms) ; neuf passes datées par le rang, aucun
       sur cinquante-quatre. Il ne sert plus qu'à compter un bloc perdu.

       L'AMORCE (4.24.0.13). L'écoute démarre dans toutes les tuiles au même
       ordre, donc au même instant, et chaque capture commence par un bloc muet
       (le plancher, −8) avant le son : un saut commun à toutes, qui pesait plus
       que tout le reste — un pic à 0 ms, r 0,62, au banc. Une capture ne
       compte qu'une seconde après son premier son.

       JAMAIS `mozCaptureStream` : sous Firefox, il coupe le son de l'élément. */
    /* LA CAPTURE SUIT LA PISTE COURANTE (4.24.0.22). Le second rapport réel
       de la 4.24.0.21 : 702 s d'écoute, ZÉRO calcul, la tuile muette à
       « silence 100 % ». Mesuré sous Chromium (cf. README) : quand le lecteur
       CHANGE DE SOURCE — un rechargement de son flux, sans recharger la page —,
       la capture d'un élément lui AJOUTE une piste ; l'ancienne reste « live »,
       et muette. La capture restait branchée sur elle, se croyait vivante, et
       n'entendait plus que du silence. Et deux pièges de plus, mesurés de même :
       une SECONDE capture du même élément rend la première muette ; arrêter
       les pistes d'une capture peut rendre muette celle qui lui succède. D'où
       la règle : une seule capture par élément, branchée sur sa piste la plus
       récente ; on ne recapture que si l'élément a changé, ou si toutes ses
       pistes sont finies.

       L'AUDIOWORKLET (4.24.0.22). Chrome signale `ScriptProcessorNode` comme
       déprécié, et l'inscrit aux erreurs de l'extension — un utilisateur l'a
       vu. Le module est chargé d'un blob ; si la page le refuse, ou si le
       navigateur n'a pas d'AudioWorklet, on garde l'ancien nœud. Le rapport dit
       lequel (`worklet` ou `script`). Même bloc de 1024 échantillons, même
       niveau, même datation : le rang d'un bloc vient de `currentFrame`, le
       compte exact des échantillons du contexte — plus juste encore que le rang
       compté à la main, qui devinait les blocs perdus. */
    const MODULE_ENVELOPPE = `registerProcessor('tse-enveloppe', class extends AudioWorkletProcessor {
  constructor() { super(); this.s = 0; this.n = 0; }
  process(entrees) {
    const x = entrees[0] && entrees[0][0];
    const q = x ? x.length : 128;
    if (x) for (let i = 0; i < q; i++) this.s += x[i] * x[i];
    this.n += q;
    if (this.n >= 1024) { this.port.postMessage([currentFrame + q, this.s / this.n]); this.s = 0; this.n = 0; }
    return true;
  }
});`;
    const ecoute = (() => {
      const B = 1024;
      let actif = false, ac = null, proc = null, nul = null, source = null, flux = null, video = null, piste = null;
      let etat = 'inactive', reliaisons = 0, sr = null, voie = null;
      let ancreCour = Infinity, ancrePrec = Infinity, ancreT = 0;
      /* L'HORLOGE QUI SAUTE (4.24.0.31). Le plus petit écart ne suivait une
         heure audio qui PERD du temps qu'au renouvellement de sa fenêtre, dix
         à vingt secondes plus tard : il gardait l'ancien. Or une horloge audio
         perd des échantillons quand son fil manque son rendez-vous — mesuré
         sous Chromium (cf. README) : des marches de 10 à 300 ms, plusieurs par
         minute, sur une machine dont le processeur est pris par à-coups —, et
         le CONTENU, lui, reste à l'heure : derrière la marche, le vrai écart
         est le nouveau. Pendant ces vingt secondes, la tuile datait son son
         trop tôt d'autant, et la fenêtre de corrélation, de vingt secondes
         elle aussi, le voyait presque entière. Désormais : UNE seconde pleine
         dont le plus petit écart dépasse l'ancre de plus de MARCHE_MS — sans
         marche, il ne bouge que d'une ou deux ms d'une seconde à l'autre —,
         et l'ancre le prend. Une tâche longue du fil principal n'y ressemble
         pas : la seconde qui la précède a ses blocs à l'heure, et la file
         qu'elle a retenue se vide jusqu'au plus récent, à l'heure lui aussi.
         Les marches suivies vont au rapport (`horloge`). */
      const MARCHE_MS = 15;
      let secMin = Infinity, secT = 0, marches = 0, marchesMs = [];
      // Le rang du bloc, et l'heure audio du précédent pour compter les pertes
      // (l'ancien nœud seulement : le worklet sait son rang).
      let rang = -1, dernierPt = null;
      // L'amorce d'une capture : pas encore de son, puis les blocs d'une seconde.
      let sonVu = false, amorce = 0;
      let lot = [];
      // Blocs et blocs silencieux, par seconde, sur les dix dernières.
      let secondes = [], blocs = 0, muets = 0;
      // Le branchement seul ; la capture, elle, reste.
      const debrancher = () => {
        try { if (source) source.disconnect(); } catch { /* ignore */ }
        source = null; piste = null;
      };
      // La capture entière : seulement si l'élément a changé, ou à l'arrêt.
      const detacher = () => {
        debrancher();
        if (flux) for (const p of flux.getTracks()) { try { p.stop(); } catch { /* ignore */ } }
        flux = null; video = null;
      };
      const relier = () => {
        const v = document.querySelector('video');
        if (!v) { etat = 'sans-video'; return; }
        if (typeof v.captureStream !== 'function') { etat = 'indisponible'; return; }
        // Le nœud n'est pas encore là (le module se charge) : au prochain relevé.
        if (!proc) return;
        if (v !== video) {
          detacher();
          try { flux = v.captureStream(); } catch (e) { etat = `erreur:${(e && e.name) || 'capture'}`; return; }
          video = v;
        }
        const vivantes = flux.getAudioTracks().filter((p) => p.readyState === 'live');
        const derniere = vivantes[vivantes.length - 1] || null;
        if (!derniere) {
          // Aucune piste vivante — pas encore de son, ou une source finie : on
          // lâche cette capture, ses pistes arrêtées AVANT d'en prendre une
          // autre (cf. plus haut), et on recapture au prochain relevé.
          detacher();
          etat = 'sans-piste';
          return;
        }
        if (derniere === piste && source) return;
        debrancher();
        try {
          source = ac.createMediaStreamSource(new MediaStream([derniere]));
          source.connect(proc);
          piste = derniere;
          reliaisons += 1;
          sonVu = false; amorce = Math.ceil(sr / B);
        } catch (e) { etat = `erreur:${(e && e.name) || 'source'}`; source = null; piste = null; }
      };
      // Un bloc de 1024 échantillons fini : `finMs`, sa fin en ms d'horloge audio.
      const surFin = (finMs, puissance, mur) => {
        const ecart = mur - finMs;
        // La seconde écoulée : son plus petit écart, face à l'ancre d'alors.
        if (mur - secT >= 1_000) {
          const avant = Math.min(ancreCour, ancrePrec);
          if (secT && secMin - avant > MARCHE_MS) {
            marches += 1;
            marchesMs.push(Math.round(secMin - avant));
            if (marchesMs.length > 4) marchesMs.shift();
            ancreCour = secMin; ancrePrec = Infinity; ancreT = mur;
          }
          secMin = Infinity; secT = mur;
        }
        secMin = Math.min(secMin, ecart);
        if (mur - ancreT > 10_000) { ancrePrec = ancreCour; ancreCour = Infinity; ancreT = mur; }
        ancreCour = Math.min(ancreCour, ecart);
        const ancre = Math.min(ancreCour, ancrePrec);
        // log10 de la puissance moyenne : -8 est le plancher, -7 ≈ -70 dBFS.
        const niveau = Math.log10(puissance + 1e-8);
        blocs += 1;
        if (niveau < -7) muets += 1;
        if (!sonVu) { if (niveau < -7) return; sonVu = true; }
        if (amorce > 0) { amorce -= 1; return; }
        // Le milieu du bloc, au dixième de milliseconde.
        lot.push([Math.round((ancre + finMs - ((B / sr) * 1000) / 2) * 10) / 10, Math.round(niveau * 1000) / 1000]);
        // Borné : si la salle ne relève plus (onglet gelé), on garde le plus récent.
        if (lot.length > 600) lot.splice(0, lot.length - 600);
      };
      // L'ancien nœud : un bloc de plus — ou plusieurs, si l'horloge audio a sauté (blocs perdus).
      const surBloc = (e) => {
        const mur = Date.now();
        const periode = (B / sr) * 1000;
        rang += dernierPt === null ? 1 : Math.max(1, Math.round(((e.playbackTime - dernierPt) * 1000) / periode));
        dernierPt = e.playbackTime;
        const x = e.inputBuffer.getChannelData(0);
        let s = 0;
        for (let i = 0; i < x.length; i++) s += x[i] * x[i];
        surFin((rang + 1) * periode, s / x.length, mur);
      };
      const demarrer = () => {
        actif = true;
        voie = null;
        const AC = window.AudioContext;
        if (!AC) { etat = 'indisponible'; return; }
        let ctx;
        try {
          ctx = ac = new AC();
          sr = ac.sampleRate;
          nul = ac.createGain();
          nul.gain.value = 0;
          nul.connect(ac.destination);
        } catch (e) { etat = `erreur:${(e && e.name) || 'contexte'}`; ac = null; return; }
        const parScript = (pourquoi) => {
          if (ac !== ctx) return;
          try {
            proc = ac.createScriptProcessor(B, 1, 1);
            proc.onaudioprocess = surBloc;
            proc.connect(nul);
          } catch (e) { etat = `erreur:${(e && e.name) || 'processeur'}`; proc = null; return; }
          voie = pourquoi ? `script (${pourquoi})` : 'script';
          relier();
        };
        if (!ac.audioWorklet || typeof AudioWorkletNode !== 'function') { parScript('sans worklet'); return; }
        // Le rapport dit qu'on attend le module, plutôt qu'« inactive ».
        etat = 'module';
        let url = null;
        try { url = URL.createObjectURL(new Blob([MODULE_ENVELOPPE], { type: 'application/javascript' })); } catch { parScript('sans blob'); return; }
        ac.audioWorklet.addModule(url).then(() => {
          if (ac !== ctx) return;
          try {
            proc = new AudioWorkletNode(ac, 'tse-enveloppe', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
                                                                channelCount: 1, channelCountMode: 'explicit' });
            proc.port.onmessage = (m) => { const [fin, puissance] = m.data; surFin((fin / sr) * 1000, puissance, Date.now()); };
            proc.connect(nul);
          } catch (e) { proc = null; parScript(`nœud refusé : ${(e && e.name) || 'erreur'}`); return; }
          voie = 'worklet';
          relier();
        }).catch((e) => parScript(`module refusé : ${(e && e.name) || 'erreur'}`))
          .finally(() => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } });
      };
      const arreter = () => {
        actif = false;
        detacher();
        try {
          if (proc) {
            if (proc.port) proc.port.onmessage = null;
            else proc.onaudioprocess = null;
            proc.disconnect();
          }
        } catch { /* ignore */ }
        try { if (nul) nul.disconnect(); } catch { /* ignore */ }
        try { if (ac) ac.close(); } catch { /* ignore */ }
        ac = null; proc = null; nul = null; lot = []; secondes = []; blocs = 0; muets = 0;
        ancreCour = Infinity; ancrePrec = Infinity; ancreT = 0; rang = -1; dernierPt = null;
        secMin = Infinity; secT = 0; marches = 0; marchesMs = [];
        sonVu = false; amorce = 0;
        etat = 'inactive';
      };
      // À chaque relevé : suivre le souhait de la salle, relancer un contexte
      // suspendu, relier de nouveau si l'élément ou sa piste ont changé.
      const tenir = (voulu) => {
        if (voulu && !actif) demarrer();
        else if (!voulu && actif) arreter();
        if (!actif || !ac) return;
        if (ac.state === 'suspended') ac.resume().catch(() => {});
        relier();
        if (source) etat = ac.state;
        secondes.push([blocs, muets]);
        if (secondes.length > 10) secondes.shift();
        blocs = 0; muets = 0;
      };
      const bilan = () => {
        if (!actif) return { etat };
        const b = secondes.reduce((x, y) => x + y[0], 0);
        const m = secondes.reduce((x, y) => x + y[1], 0);
        return { etat, sr, reliaisons, voie, pistes: flux ? flux.getAudioTracks().length : 0,
                 blocs: b, silence: b ? Math.round((m / b) * 100) / 100 : null, marches, marchesMs: [...marchesMs] };
      };
      const prendre = () => { const l = lot; lot = []; return l; };
      return { tenir, bilan, prendre };
    })();

    const repondreReleve = (d) => {
      ecoute.tenir(d.ecoute === true);
      const lecteur = lecteurTwitch();
      const v = document.querySelector('video');
      const f = (nom) => lecteur && typeof lecteur[nom] === 'function';
      const r = {
        tse: TSE_SALLE_RELEVE_MSG,
        n: d.n,
        t: Date.now(),
        latence: f('getLiveLatency') ? lireNombre(() => lecteur.getLiveLatency()) : null,
        tampon: f('getBufferDuration') ? lireNombre(() => lecteur.getBufferDuration()) : null,
        vitesse: v ? v.playbackRate : null,
        vitesseLecteur: f('getPlaybackRate') ? lireNombre(() => lecteur.getPlaybackRate()) : null,
        /* Deux fonctions que le premier rapport a révélées dans l'API
           (4.24.0.12), lues telles quelles : getSyncTime — une horloge du
           flux ? — et getPosition. Leur nature se lira à leur pente. */
        sync: f('getSyncTime') ? lireNombre(() => lecteur.getSyncTime()) : null,
        position: f('getPosition') ? lireNombre(() => lecteur.getPosition()) : null,
        // Le tampon en arrière (4.24.0.17), par l'élément et par l'instance.
        arriere: arriereElement(v),
        ...(f('getBufferedRanges') ? (() => { const x = lirePlages(lecteur); return { plages: x.plages, plagesForme: x.forme }; })()
          : { plages: null, plagesForme: null }),
        lecture: !!v && !v.paused,
        faibleLatence: f('isLiveLowLatency') ? (() => { try { return !!lecteur.isLiveLowLatency(); } catch { return null; } })() : null,
        essai,
        ecoute: ecoute.bilan(),
        /* LA PUB, AVEC L'ENVELOPPE QU'ELLE ACCOMPAGNE (4.24.0.27) : la salle
           écarte celle-ci dès le relevé qui la voit, sans attendre l'état de
           la seconde. */
        pub: enPub(),
        env: ecoute.prendre(),
      };
      if (d.api === true && lecteur) r.api = lireApi(lecteur);
      for (const o of cibles) {
        try { window.parent.postMessage(r, o); } catch { /* origine refusée */ }
      }
    };

    /* ── LA CONSOLE DANS UNE TUILE (4.24.0.12) ──────────────────────────────
       RAPPORT RÉEL : « tse is not defined ». `window.tse` n'existe que dans la
       page elle-même ; or un clic droit → Inspecter sur une tuile met la
       console dans le cadre du lecteur, où il n'y avait rien. Désormais, dans
       une tuile de la salle, `tse.salle` relaie la commande à la salle, qui
       l'exécute — sur CETTE tuile quand la commande n'en nomme pas — et renvoie
       sa réponse, affichée ici. Les arguments ne passent que s'ils sont
       simples ; la salle ne reçoit que de ses propres tuiles (cf. surMessage),
       et ses commandes restent bornées. */
    let numeroConsole = 0;
    const simple = (x) => (x === null || x === undefined || ['number', 'string', 'boolean'].includes(typeof x) ? x : String(x));
    const relayer = (commande) => (...args) => {
      const n = ++numeroConsole;
      for (const o of cibles) {
        try {
          window.parent.postMessage({ tse: TSE_SALLE_CONSOLE_MSG, n, commande, args: args.slice(0, 3).map(simple) }, o);
        } catch { /* origine refusée */ }
      }
      return `[tse] ${commande} → envoyé à la salle / sent to the room`;
    };
    try {
      Object.defineProperty(window, 'tse', {
        value: Object.freeze({ salle: Object.freeze(Object.fromEntries(
          ['auto', 'recul', 'avance', 'ecoute', 'rapport'].map((c) => [c, relayer(c)]))) }),
        writable: false, configurable: false,
      });
    } catch { /* déjà posé */ }

    const poster = () => {
      const e = etatSalle();
      for (const o of cibles) {
        try { window.parent.postMessage({ tse: TSE_SALLE_ETAT_MSG, etat: e }, o); } catch { /* origine refusée */ }
      }
    };

    /* QUATRE ORDRES : le son et le silence, la pause et la reprise — ces deux
       derniers quand l'onglet passe en arrière-plan, la salle mettant en pause
       ses tuiles muettes. Chacun par le bouton du lecteur, comme Twitch le
       recommande, et à défaut par l'élément vidéo. */
    const ORDRES = ['son', 'muet', 'pause', 'lecture'];
    window.addEventListener('message', (e) => {
      if (e.source !== window.parent || !TSE_PREVIEW_PARENTS.includes(e.origin)) return;
      const d = e.data;
      /* LA QUALITÉ (4.24.0.10) : un ordre à part, qui ne passe ni par un bouton
         ni par le verdict des quatre autres. */
      if (d && d.tse === TSE_SALLE_ORDRE_MSG && d.ordre === 'qualite') {
        const h = Math.round(Number(d.hauteur));
        if (h >= 100 && h <= 4320 && h !== hauteurVoulue) {
          hauteurVoulue = h; qualiteEssais = 0; qualiteT = 0; tenirQualite();
        }
        return;
      }
      // La réponse de la salle à une commande tapée ici (4.24.0.12).
      if (d && d.tse === TSE_SALLE_CONSOLE_REPONSE) {
        console.info(`[tse] ${d.commande} →`, d.resultat);
        return;
      }
      /* LE RELEVÉ, sur-le-champ (4.24.0.11) ; les déplacements, bornés ici
         comme dans la salle ; la faible latence retirée (4.24.0.21). Des noms
         à eux : « pause » est déjà l'ordre de l'onglet caché. */
      if (d && d.tse === TSE_SALLE_ORDRE_MSG && ['releve', 'essai-recul', 'essai-avance', 'faible-latence'].includes(d.ordre)) {
        if (d.ordre === 'releve' && Number.isFinite(d.n)) repondreReleve(d);
        else if (d.ordre === 'faible-latence') retirerFaibleLatence();
        else {
          /* De 0,05 à 60 s : le calage recule d'un écart entre tuiles —
             parfois plus de 5 s —, et ses corrections descendent à 0,05 s ; une
             tuile retombée de 23 s derrière le direct reprend sa place d'un
             geste (4.24.0.27). La console, elle, reste bornée à 0,2–5 s par la
             salle ; l'avance, par son tampon. */
          const s = Number(d.duree);
          if (s >= 0.05 && s <= 60) deplacer(s, d.ordre === 'essai-recul' ? 1 : -1);
        }
        return;
      }
      if (!d || d.tse !== TSE_SALLE_ORDRE_MSG || !ORDRES.includes(d.ordre)) return;
      const v = document.querySelector('video');
      let voie = 'deja';
      if (!v) voie = 'sans-video';
      else if (d.ordre === 'son' || d.ordre === 'muet') {
        const veutSon = d.ordre === 'son';
        if (v.muted === veutSon) {
          const b = document.querySelector(BOUTON_SON);
          if (b) { b.click(); voie = 'bouton'; } else { v.muted = !veutSon; voie = 'video'; }
        }
      } else {
        const veutLecture = d.ordre === 'lecture';
        if (v.paused === veutLecture) {
          const b = document.querySelector(BOUTON_LECTURE);
          if (b) { b.click(); voie = 'bouton'; }
          else { if (veutLecture) v.play().catch(() => {}); else v.pause(); voie = 'video'; }
        }
      }
      // Numéroté : le parent compte chaque verdict une fois, et garde ceux
      // qu'un ordre suivant a remplacés.
      ordre = { n: ++numeroOrdre, ordre: d.ordre, voie, apres: null };
      const courant = ordre;
      setTimeout(() => {
        courant.apres = v ? { muet: v.muted, lecture: !v.paused } : null;
        poster();
      }, 1500);
    });

    poster();
    /* Chaque seconde : le son tenu, la qualité, l'avertissement levé et la
       pub comptée se jugent sur cet état — en retard de deux secondes, un son
       que Twitch a remis en muet le resterait d'autant. */
    setInterval(poster, 1000);
  })();

  /* LA CONSOLE DANS UN CHAT DE LA SALLE (4.24.0.12). Le chat
     intégré est une page de www.twitch.tv, de même origine que celle qui porte
     la salle : `tse` y est tout simplement celui de la page. Seulement dans
     NOS cadres de chat, et seulement de même origine — sinon, rien. */
  (() => {
    'use strict';
    try {
      if (window.top === window) return;
      if (window.name !== TSE_SALLE_CHAT_NAME) return;
      const haut = window.top;
      if (haut.location.origin !== location.origin) return;
      Object.defineProperty(window, 'tse', { get: () => haut.tse, configurable: false });
    } catch { /* autre origine, ou déjà posé : rien */ }
  })();

  /* LE RELEVÉ DES CHAÎNES SUIVIES, CÔTÉ CADRE (4.25.0.3, cf. module SUIVIES).
     La page « Chaînes suivies » demande elle-même la liste, par pages, à
     mesure qu'on la fait défiler : ses réponses `ChannelFollows` portent
     `data.user.follows.edges[].node.login` et `pageInfo.hasNextPage`
     (MESURÉ, troisième passe). Twitch ne la sert pas sans compte, et
     l'extension n'envoie jamais le jeton : on lit les RÉPONSES que la page
     reçoit — jamais un en-tête de ce qu'elle envoie.
     Seulement dans NOTRE cadre, à son nom, sous une page de même origine. Le
     bloc tourne à document_start, avant le premier script de Twitch : le fetch
     qu'il enveloppe est celui que l'application trouvera. Il poste à la page,
     réponse par réponse, les logins lus et ce que Twitch dit de la suite. */
  const TSE_SUIVIES_FRAME_NAME = 'tse-suivies';
  const TSE_SUIVIES_MSG = 'tse:suivies';
  (() => {
    'use strict';
    try {
      if (window.top === window) return;
      if (window.name !== TSE_SUIVIES_FRAME_NAME) return;
      if (window.top.location.origin !== location.origin) return;
    } catch { return; }
    const vrai = window.fetch;
    if (typeof vrai !== 'function') return;
    const poster = (x) => {
      try { window.top.postMessage({ [TSE_SUIVIES_MSG]: x }, location.origin); } catch { /* page partie */ }
    };
    // Les opérations d'un lot, dans l'ordre : la réponse les rend dans le même.
    const operations = (corps) => {
      try { return [].concat(JSON.parse(corps)).map((o) => (o && o.operationName) || ''); }
      catch { return []; }
    };
    const lire = (ops, json) => {
      const reps = [].concat(json);
      ops.forEach((nom, i) => {
        if (nom !== 'ChannelFollows') return;
        const f = reps[i]?.data?.user?.follows;
        if (!f || !Array.isArray(f.edges)) { poster({ illisible: true }); return; }
        poster({ logins: f.edges.map((e) => e?.node?.login).filter((l) => typeof l === 'string'),
                 suite: typeof f.pageInfo?.hasNextPage === 'boolean' ? f.pageInfo.hasNextPage : null });
      });
    };
    window.fetch = function (...args) {
      const p = vrai.apply(window, args);
      try {
        const [url, init] = args;
        const ops = typeof init?.body === 'string' && String(url).includes('gql.twitch.tv')
          ? operations(init.body) : [];
        if (ops.includes('ChannelFollows')) {
          p.then((rep) => rep.clone().json().then((json) => lire(ops, json)),
                 () => poster({ echec: true }))
            .catch(() => poster({ illisible: true }));
        }
      } catch { /* jamais au détriment de la page */ }
      return p;
    };
  })();
}
