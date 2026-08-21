/* ============================================================
 *  Cowlor's Sidebar for Twitch — Extension Chrome
 *  -------------------------------------------------------------
 *  Portage du userscript Violentmonkey "Twitch Sidebar Enhancer
 *  ADBLOCK 4" v2.22.3 vers une extension Manifest V3, avec
 *  localisation multilingue (français, anglais, allemand,
 *  espagnol, portugais du Brésil et du Portugal) et
 *  architecture indépendante de la langue (cf. bloc I18N).
 *
 *  L'extension charge DEUX modules indépendants, dans cet ordre :
 *
 *   1) MODULE ANTI-PUB — fichier adblock.js, code tiers vendorisé
 *      (vaft v2.0.4, scamorza/TwitchAdBlock, MIT). N'agit QUE
 *      dans les iframes — concrètement, dans l'iframe d'aperçu
 *      servie par player.twitch.tv. Le stream principal n'est pas
 *      impacté. Voir l'en-tête d'adblock.js pour le détail et la
 *      liste des adaptations.
 *
 *   2) MODULE TSE (sidebar enrichie) — CE fichier. N'agit QU'EN
 *      top-level, jamais dans les iframes. C'est le module
 *      principal de l'extension.
 *
 *      Une exception, minuscule et volontaire : le PONT D'APERÇU en
 *      tête de ce fichier tourne, lui, dans les iframes du lecteur.
 *      Il n'y fait qu'une chose — signaler au parent la première image
 *      affichée — et ne touche à rien d'autre, précisément pour ne
 *      pas croiser le module anti-pub qui partage cette frame.
 *
 *  Les deux ont des gardes OPPOSÉES (iframe-only / top-level-only)
 *  donc dans n'importe quelle frame, exactement un des deux est
 *  actif. Ces gardes sont porteuses, pas décoratives : le module
 *  anti-pub force document.hidden et intercepte visibilitychange,
 *  ce qui perturberait la sidebar s'il tournait dans sa frame.
 *  L'ordre de chargement est fixé par le manifeste et reproduit
 *  celui qu'avaient les deux modules quand ils partageaient un
 *  fichier — ne pas l'inverser.
 *
 *  FRAÎCHEUR DES DONNÉES (v3.18) — l'extension ne se contente pas
 *  de lire le DOM de Twitch, elle rafraîchit elle-même ce que
 *  Twitch laisse périmer. Le pipeline tient en trois pièces :
 *
 *   • UNE requête, TseChannels, qui rapporte pour TOUTE une
 *     tranche de chaînes ce dont la sidebar a besoin (createdAt,
 *     viewersCount, game, freeformTags, id). Elle a remplacé
 *     UseLive + TseLang, ET la forme `user(login:)` qui imposait
 *     une opération par chaîne. Un lot de logins → une opération.
 *   • UN cache à TTL, `cache` (login -> entrée), dont la durée de
 *     validité LIVE_TTL est la SEULE constante qui détermine à
 *     quel point la sidebar colle au direct.
 *   • UN scan idempotent : processCard lit le cache s'il est
 *     frais (sans réseau), remet le login en file sinon. Le
 *     rendu passe par applyChannelData, ré-appelable sans effet
 *     de bord cumulatif.
 *
 *  Depuis la v3.21 le pipeline ne se contente plus de décorer ce
 *  que Twitch pose : il SONDE aussi les chaînes suivies absentes de
 *  la sidebar (roster appris par observation) et FABRIQUE la carte
 *  de celles qui viennent de passer en direct, que Twitch met 2 à
 *  4 minutes à afficher (mesuré, cf. tse.lag()). La carte est un
 *  clone d'une carte native : elle hérite ainsi du rendu de Twitch
 *  et de tous les marqueurs dont le reste du module dépend.
 *
 *  Deux invariants tiennent l'ensemble, tous deux nécessaires
 *  parce que le scan est déclenché par les mutations du DOM :
 *
 *   a) toute écriture de texte passe par setText(), qui n'écrit
 *      que si la valeur change. Une écriture inconditionnelle
 *      dans le scan entretiendrait sa propre boucle (écriture →
 *      mutation → scan → écriture).
 *   b) la confirmation hors-ligne se compte par RÉPONSE RÉSEAU
 *      (marqueur tseOfflineTs), jamais par appel : sinon
 *      OFFLINE_CONFIRM serait consommé en un instant par la
 *      rafale de scans d'une seule mutation.
 *
 *  Adaptations imposées par le contexte extension :
 *
 *   1) Content script déclaré avec `"world": "MAIN"`,
 *      `"run_at": "document_start"` et `"all_frames": true`
 *      dans le manifeste. Les trois sont nécessaires :
 *       - MAIN : pour exposer window.tse à la console, hook
 *         history.pushState/replaceState et window.fetch,
 *         et injecter le CSS avant le premier rendu React ;
 *       - document_start : pour intercepter avant tout autre
 *         script Twitch ;
 *       - all_frames : pour que le module anti-pub puisse
 *         s'injecter dans l'iframe d'aperçu (équivalent MV3
 *         de @allFrames true du userscript).
 *
 *   2) Le seul `onerror=""` inline (fallback JPEG du popup
 *      d'aperçu, dans le module TSE) a été porté en
 *      addEventListener('error') car la CSP de Twitch
 *      interdit les handlers inline pour les content scripts.
 *
 *  Localisation du module TSE (cf. bloc I18N en début de module) :
 *
 *   - DOM matchers MULTI-LANGUES (objet DOM) : sélecteurs CSS,
 *     regex, listes de libellés. Reconnaissent FR, EN, DE et ES
 *     simultanément, avec repli structurel (ancres indépendantes
 *     de la langue) pour toute autre locale. Les fonctionnalités
 *     sont donc résilientes à une mauvaise détection de langue ou
 *     à un changement.
 *
 *   - Libellés UI affichés par l'extension (objet S, alias
 *     mutable vers STRINGS[LANG]).
 *
 *   - LANG est détecté de manière robuste (DOM, puis html.lang,
 *     puis navigator) et recalculé à chaque scan via
 *     refreshLanguage() — auto-correction.
 *
 *   - renameRootTitle() est idempotent par comparaison textuelle
 *     pour suivre une bascule de LANG après le boot.
 *
 *  Note de stabilité : les identifiants internes (préfixe CSS
 *  ".tse-", attributs "data-tse-*", clé localStorage "tse:visits")
 *  sont conservés malgré le renommage pour ne pas invalider
 *  l'historique de visites des utilisateurs existants.
 * ============================================================ */

/* ============================================================
 *  PONT D'APERÇU — la seule partie de ce fichier qui tourne EN IFRAME
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
 *  Ce module est DÉLIBÉRÉMENT minuscule et passif. Il ne touche ni à
 *  la visibilité, ni au réseau, ni au lecteur — rien qui puisse entrer
 *  en conflit avec le module anti-pub, qui vit dans la même frame.
 * ============================================================ */
const TSE_PREVIEW_FIRST_FRAME_MSG = 'tse:preview-first-frame';

(() => {
  'use strict';

  // Uniquement dans une iframe du lecteur. Le try/catch couvre la
  // SecurityError théorique sur window.top en cross-origin.
  try {
    if (window.top === window) return;
    if (location.hostname !== 'player.twitch.tv') return;
  } catch { return; }

  // Origines destinataires. `ancestorOrigins` est ordonné du parent IMMÉDIAT
  // vers le sommet ; on poste à `parent`, donc c'est bien l'indice 0 qu'il
  // faut — prendre le dernier viserait la page du haut, qui n'est le parent
  // que dans le cas d'une iframe non imbriquée. Sans cette API, on retombe sur
  // les deux formes que le manifeste déclare. Un envoi vers une origine qui ne
  // correspond pas est simplement ignoré par le navigateur. Jamais '*' : le
  // message ne porte aucune donnée, mais diffuser à l'aveugle reste une
  // habitude à ne pas prendre.
  let targets;
  try {
    const a = location.ancestorOrigins;
    targets = a && a.length ? [a[0]] : null;
  } catch { targets = null; }
  if (!targets) targets = ['https://www.twitch.tv', 'https://twitch.tv'];

  let sent = false;
  const announce = () => {
    if (sent) return;
    sent = true;
    for (const origin of targets) {
      try { window.parent.postMessage({ tse: TSE_PREVIEW_FIRST_FRAME_MSG }, origin); } catch { /* origine refusée */ }
    }
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

  const scan = () => {
    const v = document.querySelector('video');
    if (v) { watch(v); return true; }
    return false;
  };

  // À document_start il n'y a pas encore de <video>. On l'attend, sans
  // surveiller indéfiniment : passé le délai, l'observation cesse et le
  // parent révèle de lui-même par son propre filet.
  if (!scan()) {
    const root = document.documentElement;
    if (!root) return;
    const mo = new MutationObserver(() => { if (scan()) mo.disconnect(); });
    mo.observe(root, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 15_000);
  }
})();

(() => {
  'use strict';

  // Garde top-level : le code TSE n'a rien à faire dans une iframe
  // (cf. en-tête d'adblock.js pour le pourquoi de all_frames: true).
  // Try/catch contre une SecurityError théorique sur frames cross-origin.
  try {
    if (window.top !== window) return;
  } catch { return; }

  /* ============================================================
   *  I18N — DÉTECTION DE LANGUE + CHAÎNES LOCALISABLES
   *  -------------------------------------------------------------
   *  Deux niveaux :
   *
   *   1) DOM matchers (objet `DOM`) — MULTI-LANGUES. Reconnaissent
   *      les libellés natifs Twitch en FR, EN, DE, ES et PT
   *      (Brésil et Portugal) simultanément.
   *      Les fonctionnalités s'appuient sur eux : indépendantes
   *      de LANG, robustes si la détection est tardive ou fausse.
   *
   *   2) Libellés UI (objet `S` = STRINGS[LANG]) — sélectionnés
   *      par la langue détectée. C'est ce que l'utilisateur lit
   *      (filtre, badges, tooltips, console).
   *
   *  Détection (detectLanguage) dans l'ordre :
   *    a) libellé natif Twitch présent dans le DOM (vérité terrain) ;
   *    b) document.documentElement.lang ;
   *    c) navigator.language ;
   *    d) défaut "en".
   *
   *  LANG et S sont MUTABLES. refreshLanguage() est appelé en
   *  début de chaque scan : auto-correction si la première
   *  détection (à document_start, DOM pas encore prêt) était fausse.
   * ============================================================ */

  /* ----- DOM matchers (multi-langues) ----- */
  const DOM = Object.freeze({
    // Racine de la sidebar : ID structurel, indépendant de la langue de l'UI.
    // Conteneur de la section suivie, des cartes et de nos injections ; c'est
    // aussi l'unité de remount (cf. globalObserver) et la zone de la porte de scan.
    sidebarRoot:             '#side-nav',
    followedSelector:        '[aria-label="Chaînes suivies"], [aria-label="Followed Channels"], [aria-label="Kanäle, denen du folgst"], [aria-label="Canales que sigues"], [aria-label="Canais seguidos"], [aria-label="Canais que segues"]',
    // Anchors INDÉPENDANTS DE LA LANGUE (confirmés sur DOM réel fr/en/de/es/pt) :
    //  - le header de la section suivie porte `followed-side-nav-header`
    //    (les autres sections utilisent `side-nav-header`, sans le préfixe) ;
    //  - les cartes suivies ont data-test-selector="followed-channel"
    //    (les recommandées : "recommended-channel" / "similarity-channel") ;
    //  - le bouton "Afficher plus" porte data-a-target="side-nav-show-more-button".
    // Servent de repli structurel pour toute UI Twitch dont la langue n'est
    // pas explicitement listée (fr/en/de/es/pt) — détection indépendante des libellés.
    followedHeaderSelector:  '[class*="followed-side-nav-header"]',
    followedCardSelector:    'a[data-test-selector="followed-channel"]',
    // Indicateur de statut live (point coloré) présent sur une carte EN LIGNE,
    // absent d'une carte hors-ligne. Sélecteur Twitch → centralisé ici (utilisé
    // par la détection hors-ligne et par l'auto-diagnostic).
    liveIndicator:           '.tw-channel-status-indicator',
    // Lien de chaîne à l'intérieur d'une carte. Cascade de repli (1er match
    // gagnant) : hook d'automatisation Twitch, puis .side-nav-card__link
    // (mode étendu), puis tout <a href> (mode réduit, où le <a> ne porte que
    // .side-nav-card). Sert à extraire le login depuis le href dans
    // processCard() et preview.open().
    cardLinkSelector:        'a[data-a-target="side-nav-card"], a.side-nav-card__link, a[href^="/"]',
    discountSelector:        '[aria-label="Abonnement-cadeau"], [aria-label="Gift a Sub"], [aria-label="Abo verschenken"], [aria-label="Suscripción de Regalo"], [aria-label="Inscrição de presente"], [aria-label="Oferta de subscrição"]',
    altLogoSelector:         'img[alt^="Logo de"], img[alt^="Logo of"], img[alt^="Logo von"]',
    altCostreamHostSelector: 'img[alt^="Co-stream d\'un stream de "], img[alt^="Co-stream from a stream by "], img[alt^="Co-stream aus einem Stream von "], img[alt^="Co-stream de um stream de "]',

    followedLabels:          ['Chaînes suivies', 'Followed Channels', 'Kanäle, denen du folgst', 'Canales que sigues', 'Canais seguidos', 'Canais que segues'],
    showMoreLabels:          ['Afficher plus', 'Show More', 'Mehr anzeigen', 'Mostrar más', 'Mostrar mais'],
    showLessLabels:          ['Afficher moins', 'Show Less', 'Weniger anzeigen', 'Mostrar menos'],
    // Sélecteurs STABLES (indépendants de la langue) des boutons « plus / moins ».
    // Twitch expose ces hooks d'automatisation sur tous ses libellés localisés ;
    // on les privilégie au match textuel (qui ne couvre que les langues listées).
    showMoreStableSelector:  '[data-a-target="side-nav-show-more-button"], [data-test-selector="ShowMore"]',
    showLessStableSelector:  '[data-a-target="side-nav-show-less-button"], [data-test-selector="ShowLess"]',

    offlineRe:               /\b(?:déconnecté(?:e)?s?|offline|desconectad(?:o|a)s?)\b/i,
    // Header natif de section : libellés de tri/sections « Spectateurs »,
    // « Recommandées » (fr), « Viewers », « Recommended » (en), « Zuschauer »,
    // « Empfohlen » (de), « espectadores » (es / pt-BR), « espetadores »
    // (pt-PT, sans « c »). Sert à masquer le header natif + ses icônes de tri.
    nativeHeaderRe:          /Spectateurs|Recommandées|Viewers|Recommended|Zuschauer|Empfohlen|espe(?:ct|t)adores/i,
    costreamHostRe:          /^(?:Co-stream d'un stream de|Co-stream from a stream by|Co-stream aus einem Stream von|Co-stream de um stream de)\s+([A-Za-z0-9_]+)$/,
    // Phrase d'accessibilité du nombre total d'invités d'un squad :
    //   fr « X et N invité(s) » · en « X and N guest(s) » · de « X und N Gast/Gäste »
    //   · es « X y N invitado(s) » · pt « X e N convidado(s) » (BR et PT).
    guestsTotalRe:           /\s(?:et|and|und|y|e)\s+(\d+)\s+(?:invité|guest|Gast|Gäste|invitado|convidado)/i,
    sponsorLogoRe:           /^Logo\s+(?:de|of|von)\s+(.+)$/i,
  });

  /* ----- Libellés UI par langue ----- */
  const STRINGS = Object.freeze({
    fr: Object.freeze({
      followedLabel:             'Chaînes suivies',
      uiGlobalLabel:             'Top Chaînes',
      uiModeMenuAria:            'Choisir ce qui s\'affiche dans la barre latérale',
      uiGlobalPartial:           'Classement partiel : Twitch n\'expose pas assez de catégories en ce moment pour le garantir complet.',
      uiFilterAriaLabel:         'Filtrer les chaînes suivies par catégorie',
      uiFilterAllCategories:     'Toutes les catégories',
      uiFilterLangAriaLabel:     'Filtrer les chaînes suivies par langue',
      uiFilterAllLanguages:      'Toutes les langues',
      uiUptimeEnded:             'Terminé',
      uiPreviewUnavailable:      'Aperçu indisponible',
      uiPreviewLoadingTitle:     'Chargement du titre…',
      uiBadgeCostreamOf:         (nameHtml) => `Co-stream de <strong>${nameHtml}</strong>`,
      uiBadgeCostreamHost:       'Stream Hôte',
      uiBadgeCostreamWithNames:  (namesHtml) => `Co-stream avec ${namesHtml}`,
      uiBadgeLiveWith:           (guestHtml, others) => {
        const suffix = others > 0 ? ` et ${others} autre${others > 1 ? 's' : ''}` : '';
        return `En live avec ${guestHtml}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nameHtml) => `Sponsorisé par <strong>${nameHtml}</strong>`,
      uiSortNoCoStreams:         'Aucun co-stream détecté actuellement',
      uiSortLabelViewers:        'Trier par nombre de viewers (décroissant)',
      uiSortLabelPopular:        'Trier par popularité personnelle (visites récentes)',
      uiSortLabelUptime:         'Trier par durée de stream (croissant)',
      uiSortLabelAlpha:          'Trier par pseudo (alphabétique)',
      uiSortLabelCostream:       'Regrouper les co-streams en tête',
      consoleNoVisits:           '[tse] Aucune visite enregistrée pour le moment.',
      consoleHistoryCleared:     '[tse] Historique de visites effacé.',
      consoleColLogin:           'login',
      consoleColScore:           'score',
      consoleColVisits:          'visites',
      consoleColLast:            'dernière visite',
      consoleColLag:             'retard de Twitch',
      consoleColGain:            'gagné par l\'extension',
      consoleLagGain:            (n, med) => `[tse] Sur ${n} de ces direct(s), l'extension a devancé Twitch de ${med} en médiane.`,
      consoleColSeen:            'vu le',
      consoleLagEmpty:           '[tse] Aucune mesure exploitable pour le moment. Laissez l\'onglet Twitch ouvert : une mesure est prise chaque fois qu\'une chaîne suivie passe en live sous vos yeux.',
      consoleLagSummary:         (n, med, p90) => `[tse] ${n} mesure(s) — retard médian de Twitch : ${med}, 90e centile : ${p90}.`,
      consoleRosterEmpty:        '[tse] Aucune chaîne mémorisée pour le moment.',
      consoleRosterSummary:      (n) => `[tse] ${n} chaîne(s) suivie(s) mémorisée(s) localement.`,
      consoleHealthBroken:       '[tse] Des sélecteurs critiques ne correspondent plus au DOM de Twitch — l\'extension est peut-être partiellement cassée. Détails : tse.diagnose()',
      consoleHealthAllOk:        '[tse] Tous les sélecteurs critiques répondent.',
      consoleMassOffline:        (n, total) => `[tse] Réponse suspecte de l'API Twitch : ${n} chaînes sur ${total} que l'on savait en direct sont annoncées hors ligne d'un coup. Affichage conservé en l'état plutôt que de vider la sidebar ; nouvel essai dans 30 s.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Chaînes globales : ${n} échecs consécutifs de l'API Twitch. Cadence structurelle repliée sur ${s} s pour ne pas marteler l'endpoint. La sidebar « Chaînes suivies » n'est pas affectée.`,
      consoleGlobalRestored:     (s) => `[tse] Chaînes globales : API de nouveau stable, cadence structurelle rétablie à ${s} s.`,
      consoleColProbe:           'sonde',
      consoleColStatus:          'état',
      consoleColDetail:          'détail',
      consoleHealthTagBroken:    'CASSÉ',
      consoleHealthTagNa:        'N/A',
      locale:                    'fr-FR',
    }),
    en: Object.freeze({
      followedLabel:             'Followed Channels',
      uiGlobalLabel:             'Top Channels',
      uiModeMenuAria:            'Choose what the sidebar displays',
      uiGlobalPartial:           'Partial ranking: Twitch is not exposing enough categories right now to guarantee it is complete.',
      uiFilterAriaLabel:         'Filter followed channels by category',
      uiFilterAllCategories:     'All categories',
      uiFilterLangAriaLabel:     'Filter followed channels by language',
      uiFilterAllLanguages:      'All languages',
      uiUptimeEnded:             'Ended',
      uiPreviewUnavailable:      'Preview unavailable',
      uiPreviewLoadingTitle:     'Loading title…',
      uiBadgeCostreamOf:         (nameHtml) => `Co-stream of <strong>${nameHtml}</strong>`,
      uiBadgeCostreamHost:       'Host Stream',
      uiBadgeCostreamWithNames:  (namesHtml) => `Co-stream with ${namesHtml}`,
      uiBadgeLiveWith:           (guestHtml, others) => {
        const suffix = others > 0 ? ` and ${others} other${others > 1 ? 's' : ''}` : '';
        return `Live with ${guestHtml}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nameHtml) => `Sponsored by <strong>${nameHtml}</strong>`,
      uiSortNoCoStreams:         'No co-streams currently detected',
      uiSortLabelViewers:        'Sort by viewer count (descending)',
      uiSortLabelPopular:        'Sort by personal popularity (recent visits)',
      uiSortLabelUptime:         'Sort by stream duration (ascending)',
      uiSortLabelAlpha:          'Sort by channel name (alphabetical)',
      uiSortLabelCostream:       'Group co-streams at the top',
      consoleNoVisits:           '[tse] No visits recorded yet.',
      consoleHistoryCleared:     '[tse] Visit history cleared.',
      consoleColLogin:           'login',
      consoleColScore:           'score',
      consoleColVisits:          'visits',
      consoleColLast:            'last visit',
      consoleColLag:             'Twitch lag',
      consoleColGain:            'gained by extension',
      consoleLagGain:            (n, med) => `[tse] On ${n} of those streams, the extension beat Twitch by ${med} at the median.`,
      consoleColSeen:            'seen at',
      consoleLagEmpty:           '[tse] No usable measurement yet. Keep the Twitch tab open: a sample is taken every time a followed channel goes live while you are watching.',
      consoleLagSummary:         (n, med, p90) => `[tse] ${n} sample(s) — median Twitch lag: ${med}, 90th percentile: ${p90}.`,
      consoleRosterEmpty:        '[tse] No channel memorised yet.',
      consoleRosterSummary:      (n) => `[tse] ${n} followed channel(s) memorised locally.`,
      consoleHealthBroken:       '[tse] Some critical selectors no longer match Twitch\'s DOM — the extension may be partially broken. Details: tse.diagnose()',
      consoleHealthAllOk:        '[tse] All critical selectors are responding.',
      consoleMassOffline:        (n, total) => `[tse] Suspicious response from Twitch's API: ${n} of ${total} channels known to be live are reported offline at once. Keeping the current display rather than emptying the sidebar; retrying in 30 s.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Global channels: ${n} consecutive failures from Twitch's API. Structural refresh backed off to ${s} s to avoid hammering the endpoint. The "Followed Channels" sidebar is unaffected.`,
      consoleGlobalRestored:     (s) => `[tse] Global channels: API stable again, structural refresh restored to ${s} s.`,
      consoleColProbe:           'probe',
      consoleColStatus:          'status',
      consoleColDetail:          'detail',
      consoleHealthTagBroken:    'BROKEN',
      consoleHealthTagNa:        'N/A',
      locale:                    'en-US',
    }),
    de: Object.freeze({
      followedLabel:             'Gefolgte Kanäle',
      uiGlobalLabel:             'Top-Kanäle',
      uiModeMenuAria:            'Auswählen, was in der Seitenleiste angezeigt wird',
      uiGlobalPartial:           'Unvollständige Rangliste: Twitch gibt derzeit nicht genügend Kategorien preis, um Vollständigkeit zu garantieren.',
      uiFilterAriaLabel:         'Gefolgte Kanäle nach Kategorie filtern',
      uiFilterAllCategories:     'Alle Kategorien',
      uiFilterLangAriaLabel:     'Gefolgte Kanäle nach Sprache filtern',
      uiFilterAllLanguages:      'Alle Sprachen',
      uiUptimeEnded:             'Beendet',
      uiPreviewUnavailable:      'Vorschau nicht verfügbar',
      uiPreviewLoadingTitle:     'Titel wird geladen…',
      uiBadgeCostreamOf:         (nameHtml) => `Co-stream von <strong>${nameHtml}</strong>`,
      uiBadgeCostreamHost:       'Host-Stream',
      uiBadgeCostreamWithNames:  (namesHtml) => `Co-stream mit ${namesHtml}`,
      uiBadgeLiveWith:           (guestHtml, others) => {
        const suffix = others > 0 ? ` und ${others} ${others > 1 ? 'weiteren' : 'weiterem'}` : '';
        return `Live mit ${guestHtml}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nameHtml) => `Gesponsert von <strong>${nameHtml}</strong>`,
      uiSortNoCoStreams:         'Derzeit keine Co-streams erkannt',
      uiSortLabelViewers:        'Nach Zuschauerzahl sortieren (absteigend)',
      uiSortLabelPopular:        'Nach persönlicher Beliebtheit sortieren (kürzliche Besuche)',
      uiSortLabelUptime:         'Nach Stream-Dauer sortieren (aufsteigend)',
      uiSortLabelAlpha:          'Nach Kanalname sortieren (alphabetisch)',
      uiSortLabelCostream:       'Co-streams oben gruppieren',
      consoleNoVisits:           '[tse] Noch keine Besuche aufgezeichnet.',
      consoleHistoryCleared:     '[tse] Besuchsverlauf gelöscht.',
      consoleColLogin:           'Login',
      consoleColScore:           'Punktzahl',
      consoleColVisits:          'Besuche',
      consoleColLast:            'letzter Besuch',
      consoleColLag:             'Twitch-Verzögerung',
      consoleColGain:            'durch Erweiterung gewonnen',
      consoleLagGain:            (n, med) => `[tse] Bei ${n} dieser Streams war die Erweiterung Twitch im Median um ${med} voraus.`,
      consoleColSeen:            'gesehen am',
      consoleLagEmpty:           '[tse] Noch keine verwertbare Messung. Lassen Sie den Twitch-Tab offen: eine Messung wird erfasst, sobald ein gefolgter Kanal vor Ihren Augen live geht.',
      consoleLagSummary:         (n, med, p90) => `[tse] ${n} Messung(en) — mediane Twitch-Verzögerung: ${med}, 90. Perzentil: ${p90}.`,
      consoleRosterEmpty:        '[tse] Noch keine Kanäle gespeichert.',
      consoleRosterSummary:      (n) => `[tse] ${n} gefolgte(r) Kanal/Kanäle lokal gespeichert.`,
      consoleHealthBroken:       '[tse] Einige kritische Selektoren stimmen nicht mehr mit dem DOM von Twitch überein — die Erweiterung ist möglicherweise teilweise defekt. Details: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Alle kritischen Selektoren reagieren.',
      consoleMassOffline:        (n, total) => `[tse] Verdächtige Antwort der Twitch-API: ${n} von ${total} als live bekannten Kanälen werden auf einmal als offline gemeldet. Anzeige wird beibehalten, statt die Seitenleiste zu leeren; neuer Versuch in 30 s.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Globale Kanäle: ${n} aufeinanderfolgende Fehler der Twitch-API. Strukturelle Aktualisierung auf ${s} s gedrosselt, um den Endpunkt nicht zu überlasten. Die Seitenleiste „Kanäle, denen du folgst“ ist nicht betroffen.`,
      consoleGlobalRestored:     (s) => `[tse] Globale Kanäle: API wieder stabil, strukturelle Aktualisierung auf ${s} s zurückgesetzt.`,
      consoleColProbe:           'Sonde',
      consoleColStatus:          'Status',
      consoleColDetail:          'Detail',
      consoleHealthTagBroken:    'DEFEKT',
      consoleHealthTagNa:        'N/V',
      locale:                    'de-DE',
    }),
    es: Object.freeze({
      followedLabel:             'Canales que sigues',
      uiGlobalLabel:             'Top Canales',
      uiModeMenuAria:            'Elegir lo que muestra la barra lateral',
      uiGlobalPartial:           'Clasificación parcial: Twitch no expone ahora mismo suficientes categorías para garantizar que esté completa.',
      uiFilterAriaLabel:         'Filtrar los canales que sigues por categoría',
      uiFilterAllCategories:     'Todas las categorías',
      uiFilterLangAriaLabel:     'Filtrar los canales que sigues por idioma',
      uiFilterAllLanguages:      'Todos los idiomas',
      uiUptimeEnded:             'Finalizado',
      uiPreviewUnavailable:      'Vista previa no disponible',
      uiPreviewLoadingTitle:     'Cargando título…',
      uiBadgeCostreamOf:         (nameHtml) => `Co-stream de <strong>${nameHtml}</strong>`,
      uiBadgeCostreamHost:       'Canal anfitrión',
      uiBadgeCostreamWithNames:  (namesHtml) => `Co-stream con ${namesHtml}`,
      uiBadgeLiveWith:           (guestHtml, others) => {
        const suffix = others > 0 ? ` y ${others} más` : '';
        return `En vivo con ${guestHtml}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nameHtml) => `Patrocinado por <strong>${nameHtml}</strong>`,
      uiSortNoCoStreams:         'No se detectaron co-streams por el momento',
      uiSortLabelViewers:        'Ordenar por número de espectadores (descendente)',
      uiSortLabelPopular:        'Ordenar por popularidad personal (visitas recientes)',
      uiSortLabelUptime:         'Ordenar por duración del stream (ascendente)',
      uiSortLabelAlpha:          'Ordenar por nombre de canal (alfabético)',
      uiSortLabelCostream:       'Agrupar los co-streams al inicio',
      consoleNoVisits:           '[tse] No hay visitas registradas por el momento.',
      consoleHistoryCleared:     '[tse] Historial de visitas borrado.',
      consoleColLogin:           'login',
      consoleColScore:           'puntuación',
      consoleColVisits:          'visitas',
      consoleColLast:            'última visita',
      consoleColLag:             'retraso de Twitch',
      consoleColGain:            'ganado por la extensión',
      consoleLagGain:            (n, med) => `[tse] En ${n} de esos directos, la extensión se adelantó a Twitch ${med} en mediana.`,
      consoleColSeen:            'visto el',
      consoleLagEmpty:           '[tse] Aún no hay mediciones utilizables. Deje la pestaña de Twitch abierta: se toma una medición cada vez que un canal que sigue se pone en directo ante sus ojos.',
      consoleLagSummary:         (n, med, p90) => `[tse] ${n} medición(es) — retraso mediano de Twitch: ${med}, percentil 90: ${p90}.`,
      consoleRosterEmpty:        '[tse] Ningún canal memorizado por el momento.',
      consoleRosterSummary:      (n) => `[tse] ${n} canal(es) que sigue memorizado(s) localmente.`,
      consoleHealthBroken:       '[tse] Algunos selectores críticos ya no coinciden con el DOM de Twitch — puede que la extensión esté parcialmente rota. Detalles: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Todos los selectores críticos responden.',
      consoleMassOffline:        (n, total) => `[tse] Respuesta sospechosa de la API de Twitch: ${n} de ${total} canales que sabíamos en directo se anuncian desconectados de golpe. Se mantiene la vista actual en vez de vaciar la barra lateral; nuevo intento en 30 s.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Canales globales: ${n} fallos consecutivos de la API de Twitch. Cadencia estructural reducida a ${s} s para no saturar el endpoint. La barra lateral «Canales que sigues» no se ve afectada.`,
      consoleGlobalRestored:     (s) => `[tse] Canales globales: la API vuelve a ser estable, cadencia estructural restablecida a ${s} s.`,
      consoleColProbe:           'sonda',
      consoleColStatus:          'estado',
      consoleColDetail:          'detalle',
      consoleHealthTagBroken:    'ROTO',
      consoleHealthTagNa:        'N/D',
      locale:                    'es-MX',
    }),
    pt: Object.freeze({
      followedLabel:             'Canais seguidos',
      uiGlobalLabel:             'Top Canais',
      uiModeMenuAria:            'Escolher o que a barra lateral mostra',
      uiGlobalPartial:           'Classificação parcial: a Twitch não expõe categorias suficientes neste momento para garantir que esteja completa.',
      uiFilterAriaLabel:         'Filtrar os canais seguidos por categoria',
      uiFilterAllCategories:     'Todas as categorias',
      uiFilterLangAriaLabel:     'Filtrar os canais seguidos por idioma',
      uiFilterAllLanguages:      'Todos os idiomas',
      uiUptimeEnded:             'Encerrado',
      uiPreviewUnavailable:      'Pré-visualização indisponível',
      uiPreviewLoadingTitle:     'Carregando título…',
      uiBadgeCostreamOf:         (nameHtml) => `Co-stream de <strong>${nameHtml}</strong>`,
      uiBadgeCostreamHost:       'Canal anfitrião',
      uiBadgeCostreamWithNames:  (namesHtml) => `Co-stream com ${namesHtml}`,
      uiBadgeLiveWith:           (guestHtml, others) => {
        const suffix = others > 0 ? ` e mais ${others}` : '';
        return `Ao vivo com ${guestHtml}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nameHtml) => `Patrocinado por <strong>${nameHtml}</strong>`,
      uiSortNoCoStreams:         'Nenhum co-stream detectado no momento',
      uiSortLabelViewers:        'Ordenar por número de espectadores (decrescente)',
      uiSortLabelPopular:        'Ordenar por popularidade pessoal (visitas recentes)',
      uiSortLabelUptime:         'Ordenar por duração do stream (crescente)',
      uiSortLabelAlpha:          'Ordenar por nome do canal (alfabético)',
      uiSortLabelCostream:       'Agrupar os co-streams no topo',
      consoleNoVisits:           '[tse] Nenhuma visita registrada por enquanto.',
      consoleHistoryCleared:     '[tse] Histórico de visitas apagado.',
      consoleColLogin:           'login',
      consoleColScore:           'pontuação',
      consoleColVisits:          'visitas',
      consoleColLast:            'última visita',
      consoleColLag:             'atraso da Twitch',
      consoleColGain:            'ganho pela extensão',
      consoleLagGain:            (n, med) => `[tse] Em ${n} desses diretos, a extensão adiantou-se à Twitch em ${med} na mediana.`,
      consoleColSeen:            'visto em',
      consoleLagEmpty:           '[tse] Ainda nenhuma medição utilizável. Deixe a aba da Twitch aberta: uma medição é feita sempre que um canal seguido entra ao vivo diante de você.',
      consoleLagSummary:         (n, med, p90) => `[tse] ${n} medição(ões) — atraso mediano da Twitch: ${med}, percentil 90: ${p90}.`,
      consoleRosterEmpty:        '[tse] Nenhum canal memorizado no momento.',
      consoleRosterSummary:      (n) => `[tse] ${n} canal(is) seguido(s) memorizado(s) localmente.`,
      consoleHealthBroken:       '[tse] Alguns seletores críticos não correspondem mais ao DOM da Twitch — a extensão pode estar parcialmente quebrada. Detalhes: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Todos os seletores críticos estão respondendo.',
      consoleMassOffline:        (n, total) => `[tse] Resposta suspeita da API da Twitch: ${n} de ${total} canais que sabíamos ao vivo são anunciados offline de uma vez. A exibição é mantida em vez de esvaziar a barra lateral; nova tentativa em 30 s.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Canais globais: ${n} falhas consecutivas da API da Twitch. Cadência estrutural reduzida para ${s} s para não sobrecarregar o endpoint. A barra lateral «Canais seguidos» não é afetada.`,
      consoleGlobalRestored:     (s) => `[tse] Canais globais: API estável novamente, cadência estrutural restabelecida em ${s} s.`,
      consoleColProbe:           'sonda',
      consoleColStatus:          'estado',
      consoleColDetail:          'detalhe',
      consoleHealthTagBroken:    'QUEBRADO',
      consoleHealthTagNa:        'N/D',
      locale:                    'pt-BR',
    })
  });

  /* ----- Détection de langue robuste ----- */
  function detectLanguage() {
    // 1. Vérité terrain : un libellé natif est-il déjà dans le DOM ?
    if (document.querySelector('[aria-label="Chaînes suivies"]')) return 'fr';
    if (document.querySelector('[aria-label="Followed Channels"]')) return 'en';
    if (document.querySelector('[aria-label="Kanäle, denen du folgst"]')) return 'de';
    if (document.querySelector('[aria-label="Canales que sigues"]')) return 'es';
    if (document.querySelector('[aria-label="Canais seguidos"]')) return 'pt';   // pt-BR
    if (document.querySelector('[aria-label="Canais que segues"]')) return 'pt'; // pt-PT
    // 2. document.documentElement.lang
    const htmlLang = (document.documentElement.lang || '').toLowerCase().trim();
    if (htmlLang.startsWith('fr')) return 'fr';
    if (htmlLang.startsWith('de')) return 'de';
    if (htmlLang.startsWith('es')) return 'es';
    if (htmlLang.startsWith('pt')) return 'pt';
    if (htmlLang.startsWith('en')) return 'en';
    // 3. navigator.language
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('fr')) return 'fr';
    if (navLang.startsWith('de')) return 'de';
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('pt')) return 'pt';
    // 4. Défaut
    return 'en';
  }

  let LANG = detectLanguage();
  let S = STRINGS[LANG];

  /* Re-évalue la langue et met à jour S si elle a changé.
   * À appeler en début de chaque scan ; coût négligeable. */
  function refreshLanguage() {
    const newLang = detectLanguage();
    if (newLang === LANG) return false;
    LANG = newLang;
    S = STRINGS[LANG];
    return true;
  }


  /* ============================================================
   *  CONFIG
   * ============================================================ */
  const CFG = Object.freeze({
    GQL_URL:        'https://gql.twitch.tv/gql',
    CLIENT_ID:      'kimne78kx3ncx6brgo4mv6wki5h1ko',
    // Nombre max de logins passés à `users(logins:)` en une opération. Le
    // plafond réel côté Twitch n'est pas documenté ; on reste prudemment en
    // dessous de ce que le service accepte vraisemblablement, et on découpe
    // en tranches envoyées en parallèle et évaluées INDÉPENDAMMENT : si une
    // tranche est rejetée, elle ne coûte que ses propres logins, au lieu
    // d'aveugler toute la sidebar d'un coup.
    GQL_MAX_LOGINS: 50,
    // Guest Star : source FIABLE des co-streams "Streamer ensemble" (host.id
    // partagé entre participants). Interrogé par une requête INLINE, sans
    // hash — l'extension ne dépend donc d'AUCUNE persisted query (cf. module
    // Guest Star / detectCoStreams).
    GUEST_STAR_TTL:            30_000,   // ms — fraîcheur d'une session co-stream en cache
    GUEST_STAR_DEBOUNCE:       300,      // ms — fenêtre de regroupement des IDs avant fetch
    GUEST_STAR_ERROR_COOLDOWN: 30_000,   // ms — pause après échec réseau / rejet
    // Délai de grâce avant de LIBÉRER la couleur d'un co-stream devenu inactif.
    // Absorbe les disparitions transitoires (rebuild DOM de Twitch, fenêtre de
    // refetch) : tant qu'une collaboration réapparaît dans ce délai, elle
    // conserve EXACTEMENT la même couleur.
    COSTREAM_COLOR_GRACE:      60_000,   // ms
    BATCH_DELAY:    250,
    UI_TICK:        60_000,
    // ─── Cadence de fraîcheur ─────────────────────────────────────────
    // LIVE_TTL est LA constante qui détermine à quel point la sidebar colle
    // au direct : durée de validité d'une réponse TseChannels (statut live,
    // createdAt, viewers, catégorie, tags de langue). Tant qu'une entrée est
    // fraîche, les scans la relisent sans réseau ; dès qu'elle périme, le
    // premier scan qui la touche la remet en file.
    //
    // 30 s est une cadence assumée, pas une estimation : le module Guest Star
    // interroge déjà gql.twitch.tv à ce rythme (GUEST_STAR_TTL) avec un lot de
    // toutes les chaînes suivies, sans incident. On s'aligne dessus.
    LIVE_TTL:       30_000,
    // Période du réveil de rafraîchissement. Un scan périodique est nécessaire
    // même sans mutation DOM : sans lui, une sidebar immobile ne redemanderait
    // jamais rien.
    //
    // Il doit être NETTEMENT PLUS FIN que LIVE_TTL, et c'est contre-intuitif :
    // l'aligner sur LIVE_TTL semble logique mais DOUBLE la période réelle.
    // Une entrée n'est écrite qu'APRÈS le réveil qui l'a demandée — le temps
    // du debounce de scan, du regroupement en lot et de l'aller-retour réseau.
    // Elle périme donc quelques centaines de millisecondes APRÈS le réveil
    // suivant, qui la juge encore fraîche et passe son chemin ; il faut
    // attendre le réveil d'après. Mesuré en navigateur : période réelle de
    // 2,00 × LIVE_TTL avec un réveil aligné, 1,33 × avec un réveil trois fois
    // plus fin.
    //
    // Un réveil qui ne trouve rien de périmé ne coûte qu'une lecture de Map
    // par carte et AUCUNE requête : le raffiner est donc quasi gratuit, alors
    // qu'il ramène la période de 60 s à ~33 s pour un TTL de 30 s.
    REFRESH_TICK:   5_000,
    // Période des tâches d'entretien (purge des caches, auto-diagnostic des
    // sélecteurs). Rien à voir avec la fraîcheur : c'est de l'hygiène, elle
    // n'a aucune raison de suivre la cadence de rafraîchissement.
    MAINTENANCE_TICK: 5 * 60_000,
    // Âge au-delà duquel une entrée du cache de streams est évincée. Volontai-
    // rement plus large que LIVE_TTL : les chaînes affichées sont rafraîchies
    // en boucle et ne vieillissent jamais jusque-là ; seules les entrées
    // ponctuelles (survol hors « suivis », carte disparue) sont évincées.
    LIVE_PRUNE_AGE: 5 * 60_000,
    LIVE_CACHE_MAX: 500,          // entrées max du cache de streams
    // Durée d'absence (onglet caché) au-delà de laquelle un retour sur l'onglet
    // déclenche une RÉ-INITIALISATION complète sous voile (purge cache + rescan).
    // Pendant une absence, notre re-fetch GraphQL est en pause ET Twitch a pu
    // muter sa sidebar sans qu'on l'observe → on masque cette re-hydratation.
    // Assez court pour couvrir les absences réelles, assez long pour ne pas
    // flasher le voile à chaque bref coup d'œil sur un autre onglet.
    REVISIT_RELOAD_MS: 60_000,
    // Délai après le boot avant le 1er auto-diagnostic des sélecteurs (laisse
    // à Twitch le temps de monter la sidebar). Ensuite réévalué à chaque
    // MAINTENANCE_TICK.
    HEALTH_INITIAL_DELAY: 8_000,
    SCAN_DEBOUNCE:  250,
    FRESH_MAX_MIN:  10,
    GQL_TIMEOUT:    15_000,       // ms — au-delà, on considère la requête HS
    // Pause après l'échec d'un lot TseChannels (réseau coupé, throttle, lot
    // rejeté). Indispensable depuis que les cartes ne portent plus de garde
    // qui bloque leur re-fetch : sans cooldown, chaque scan reconstituerait
    // aussitôt la file, et une panne réseau se traduirait par un lot toutes
    // les SCAN_DEBOUNCE — soit un martèlement à 4 requêtes/seconde pendant
    // toute la durée de la panne. Aligné sur LIVE_TTL : dans le cas normal
    // on aurait de toute façon attendu ce délai, la pause ne coûte rien.
    GQL_ERROR_COOLDOWN: 30_000,
    // ─── Garde-fou « extinction de masse » (cf. flushQueue) ───────────
    // Une réponse dégradée de l'API qui annoncerait tout le monde hors ligne
    // viderait la sidebar. On refuse de la croire tant que l'anomalie n'est
    // pas confirmée sur plusieurs cycles.
    MASS_OFFLINE_MIN:       5,    // en dessous, l'échantillon ne prouve rien
    MASS_OFFLINE_RATIO:     0.6,  // part des chaînes connues live qui s'éteignent
    MASS_OFFLINE_TOLERANCE: 4,    // cycles refusés avant d'accepter le verdict
    // Nombre de réponses "stream=null" CONSÉCUTIVES avant de basculer en
    // "Terminé". Chaque confirmation coûte un LIVE_TTL : à 30 s, une chaîne
    // qui coupe disparaît en 30 à 60 s, tout en gardant la garde à deux coups
    // contre un faux négatif ponctuel (hiccup côté Twitch).
    OFFLINE_CONFIRM: 2,
    // Plafonds mémoire des caches reconstruisibles (purge périodique). Évincer
    // une entrée = simple re-fetch à la prochaine demande, sans effet visible.
    META_CACHE_MAX:  300,         // entrées max du cache de métadonnées d'aperçu
    GS_CACHE_MAX:    500,         // entrées max du cache Guest Star
    // Âge d'éviction du cache Guest Star. Comme LIVE_PRUNE_AGE, volontairement
    // plus large que son TTL de fraîcheur (GUEST_STAR_TTL) : les entrées des
    // chaînes affichées sont re-set en boucle par le scan, seules les entrées
    // ponctuelles vieillissent jusqu'à l'éviction.
    GS_PRUNE_AGE:    5 * 60_000,

    // === CHAÎNES GLOBALES — couche de données ===
    // Taille du classement rendu. 30 n'est pas une limite technique mais un
    // choix de coût : T (le N-ième score) baisse quand N monte, donc le
    // nombre de catégories à interroger monte avec lui. À 50, compter
    // environ deux fois plus d'opérations par marche complète.
    GLOBAL_TOP_N:            30,
    // `games(first:)` accepte 100 et rend une liste RÉELLEMENT classée
    // (vérifié : 100 reçus, décroissants). C'est la colonne vertébrale de
    // tout le module — et accessoirement la source du filtre catégorie.
    GLOBAL_CATEGORIES_MAX:   100,
    // Catégories de tête interrogées à chaque passe structurelle : elles
    // portent l'essentiel du top N, et les re-lire à chaque cycle évite
    // d'attendre la marche complète pour voir une chaîne grimper CHEZ ELLES.
    GLOBAL_SEED_CATEGORIES:  10,
    // Plafond dur d'opérations « catégorie » par marche complète. La marche
    // s'arrête normalement d'elle-même sur la condition `audience <= T` ;
    // ce budget n'est qu'un garde-fou contre une réponse aberrante.
    // Mesuré en production : une marche complète descend une cinquantaine de
    // catégories (pool de ~1 600 chaînes) avant de croiser T. Aux heures
    // creuses T baisse et la descente s'allonge. Calé sur ce que la fenêtre
    // peut au maximum contenir (GLOBAL_CATEGORIES_MAX moins l'amorce), le
    // budget cesse d'être une cause de troncature silencieuse : il ne reste
    // qu'un garde-fou contre une réponse aberrante.
    GLOBAL_CATEGORY_BUDGET:  90,
    // `streams(first:)` est plafonné à 30 par Twitch, qui le dit explicitement :
    // "argument 'first' value must be between 1 and 30." Ce n'est donc pas une
    // observation mais une limite déclarée.
    GLOBAL_STREAMS_MAX:      30,
    // Il n'y a PAS de `first` adaptatif, et ce n'est pas faute d'avoir essayé.
    // Une catégorie à C spectateurs ne pouvant contenir que C/T streams
    // au-dessus de T, demander 3 au lieu de 30 aux petites catégories aurait
    // divisé la charge utile par dix. Mesuré sur Just Chatting :
    //     first: 3  → les 3 plus gros, exactement
    //     first: 5  → 3 justes, puis deux chaînes qui ne sont pas du top 5
    //     first: 10 → 4 justes, puis six chaînes qui ne sont pas du top 10
    // `first: k` ne rend donc PAS le top k. L'optimisation est réfutée, pas
    // en attente : on demande toujours GLOBAL_STREAMS_MAX.
    // Opérations groupées par requête HTTP. L'extension envoie déjà des
    // tableaux d'opérations à gql.twitch.tv (cf. post()).
    GLOBAL_BATCH_OPS:        20,
    // Cadence de la passe structurelle légère : totaux des catégories +
    // catégories de tête. Alignée sur LIVE_TTL, car les compteurs des
    // chaînes affichées voyagent, eux, dans la file TseChannels existante.
    GLOBAL_STRUCT_TICK:      30_000,
    // Absences CONSÉCUTIVES d'une chaîne dans une catégorie pourtant
    // interrogée, avant de la retirer du classement. Mesuré : l'API omet
    // rubius (23 608 spectateurs) 2 fois sur 6 appels identiques. À ce taux,
    // trois absences d'affilée surviennent une fois sur 27 au lieu d'une fois
    // sur 3 — le clignotement passe de 33 % du temps à moins de 4 %, sans
    // une seule requête de plus. Doubler les appels ferait pire (1 sur 9)
    // pour deux fois le prix.
    GLOBAL_MISS_CONFIRM:     3,
    // Âge au-delà duquel un enregistrement du pool est évincé sans plus de
    // procès : sa catégorie est sortie de la descente et rien ne le rafraîchit
    // plus. Assez large pour ne jamais concurrencer le compteur d'absences
    // ci-dessus, qui est le mécanisme d'éviction NORMAL. Ce que l'utilisateur
    // voit, lui, est protégé bien plus tôt : les chaînes affichées portent une
    // carte, donc la file TseChannels les rafraîchit toutes les 30 s et retire
    // celles qui se sont éteintes.
    GLOBAL_PRUNE_AGE:        10 * 60_000,
    // Cadence de la marche complète, filet de correction contre la dérive
    // (une chaîne qui grimpe dans une catégorie ni de tête ni franchissante).
    GLOBAL_FULL_WALK_MS:     150_000,
    // Pause après échec — DISTINCTE de GQL_ERROR_COOLDOWN, à dessein : si
    // Twitch bride le mode global, la sidebar « Chaînes suivies » ne doit pas
    // s'éteindre avec lui. Domaines de panne séparés.
    GLOBAL_ERROR_COOLDOWN:   30_000,
    // Échecs consécutifs au-delà desquels la cadence structurelle retombe
    // d'elle-même sur GLOBAL_FULL_WALK_MS, avec un avertissement en console.
    GLOBAL_FAIL_DEGRADE:     3,

    PURPLE:         '#9147ff',
    PURPLE_HOVER:   '#a970ff',

    // === Tracking des visites (tri "popularité personnelle") ===
    // Une visite est enregistrée si l'utilisateur reste >= VISIT_MIN_DWELL_MS
    // sur la page d'un streamer, ET si plus de VISIT_SESSION_MS se sont
    // écoulés depuis sa dernière visite enregistrée chez ce streamer.
    // On conserve les VISIT_ROLLING_N derniers timestamps par chaîne.
    // Score = somme des poids exponentiellement décroissants :
    //   poids = 2 ^ (-âge_en_jours / VISIT_HALFLIFE_DAYS)
    // → une visite d'aujourd'hui pèse 1, une d'il y a 7 jours pèse 0.5,
    //   une d'il y a 14 jours pèse 0.25, etc.
    VISIT_MIN_DWELL_MS:   5 * 60_000,    // >= 5 min sur la page
    VISIT_SESSION_MS:     180 * 60_000,  // fenêtre 180 min entre 2 visites
    VISIT_ROLLING_N:      20,            // N derniers timestamps gardés
    VISIT_MAX_LOGINS:     400,           // nb max de chaînes suivies (borne mémoire + localStorage)
    VISIT_HALFLIFE_DAYS:  7,
    VISIT_STORAGE_KEY:    'tse:visits',

    // === Roster des chaînes suivies (cf. module ROSTER) ===
    ROSTER_STORAGE_KEY:   'tse:roster',
    ROSTER_MAX:           1500,           // borne dure (largement au-dessus d'un suivi réel)
    // Une chaîne plus vue dans la sidebar depuis ce délai est oubliée. C'est
    // le seul garde-fou contre les désabonnements : un roster sans péremption
    // finirait par porter des chaînes que l'utilisateur ne suit plus.
    ROSTER_MAX_AGE:       60 * 24 * 60 * 60_000,   // 60 jours

    // === Cartes en avance sur Twitch (cf. module CARTES EN AVANCE) ===
    // Interrupteur unique de la fonctionnalité. À false, l'extension se
    // contente d'enrichir les cartes que Twitch pose — le roster continue
    // d'être appris et la mesure de retard de tourner.
    AHEAD_ENABLED:        true,
    // Plafond de cartes fabriquées simultanément. Filet contre un état
    // inattendu (sidebar à moitié montée, roster anormalement grand) : la
    // sidebar ne doit jamais se remplir de cartes que Twitch ignore.
    AHEAD_MAX:            15,
    // Plafond de chaînes sondées par cycle. Les entrées du roster sont
    // servies de la plus récemment vue à la plus ancienne, donc en cas de
    // dépassement ce sont les chaînes les plus présentes qui sont couvertes.
    AHEAD_MAX_POLL:       300,

    // === Mesure du retard de Twitch (cf. module LIVE LAG) ===
    LAG_STORAGE_KEY:      'tse:livelag',
    // Version du format. À incrémenter dès que la MÉTHODE de mesure change :
    // les relevés d'une méthode antérieure sont alors ignorés au chargement
    // plutôt que moyennés avec les nouveaux, ce qui n'aurait aucun sens.
    LAG_FORMAT:           2,
    LAG_MAX_SAMPLES:      300,
    // Plafond des identifiants de direct déjà traités, gardés en mémoire pour
    // ne pas mesurer deux fois le même. Sans borne, la table grandissait d'une
    // entrée par direct observé, indéfiniment.
    LAG_MAX_DONE:         1000,
    // Délai d'installation après le boot avant de mesurer quoi que ce soit :
    // pendant le peuplement initial, toutes les cartes « apparaissent », ce
    // qui n'apprend rien sur la réactivité de Twitch.
    LAG_SETTLE_MS:        60_000,
    // Au-delà, l'échantillon est aberrant (horloge décalée, cas non prévu) et
    // polluerait la médiane.
    LAG_MAX_PLAUSIBLE:    2 * 60 * 60_000,         // 2 h

    // === Aperçu au survol ===
    // Largeur cible de l'aperçu. Le ratio 16:9 est respecté pour le wrapper.
    // Largeur du popup d'aperçu, en pixels CSS. NE SERT QU'À LA MISE EN PAGE.
    PREVIEW_THUMB_WIDTH:  480,
    // Taille demandée au CDN pour la miniature. Volontairement SÉPARÉE de la
    // largeur du popup, dont elle dépendait jusqu'ici : changer la mise en page
    // changeait alors silencieusement l'objet réclamé au CDN, donc les temps de
    // chargement, sans que rien ne le laisse voir.
    //
    // Le choix de cette taille n'est pas neutre : le service d'images de Twitch
    // fabrique à la demande les dimensions qu'on lui réclame, et seules celles
    // que Twitch demande lui-même pour son propre site restent chaudes en bord
    // de réseau. Une taille inhabituelle se paie donc d'un redimensionnement à
    // chaque fois qu'elle a refroidi.
    PREVIEW_THUMB_CDN_W:  480,
    PREVIEW_THUMB_CDN_H:  270,
    // Délai avant de basculer du JPEG statique au player iframe. Permet
    // de ne pas spawner d'iframes si l'utilisateur balaie plusieurs cartes
    // rapidement (un iframe player Twitch = ~5-10 MB de RAM).
    // Granularité du contournement de cache de la vignette (cf. buildThumbUrl).
    // Pendant une tranche, l'URL ne change pas : les re-survols sont instantanés.
    // 2 min 30 : Twitch régénère ces images toutes les quelques minutes, la
    // tranche est donc calée sur le rythme de la source plutôt que plus fine
    // qu'elle — ce qui ne rapporterait que des téléchargements en plus.
    PREVIEW_THUMB_CACHE_MS: 150_000,
    // === Préchargement des miniatures (cf. module dédié) ===
    // Interrupteur, et bornes de la passe. La concurrence est ce qui borne la
    // charge instantanée ; le plafond n'est qu'une soupape pour un cas
    // pathologique, pas un réglage de confort — à 3 requêtes en vol, cent
    // chaînes se réchauffent en une douzaine de secondes sur une tranche de
    // 150, largement de quoi finir avant le retour du pointeur.
    PREVIEW_PRELOAD_ENABLED:     true,
    PREVIEW_PRELOAD_CONCURRENCY: 3,
    PREVIEW_PRELOAD_MAX:         200,
    PREVIEW_IFRAME_DELAY: 150,
    // Quality demandée à player.twitch.tv. "360p30" est le sweet spot pour
    // un aperçu : bande passante raisonnable, qualité suffisante. Valeurs
    // valides : 'auto' | '160p30' | '360p30' | '480p30' | '720p30' | 'chunked'.
    PREVIEW_IFRAME_QUALITY: '360p30',
    // Délai max d'attente du chargement de l'iframe avant fallback JPEG.
    PREVIEW_IFRAME_TIMEOUT_MS: 3_000,
    // Filet de révélation. L'iframe est normalement dévoilée à sa PREMIÈRE
    // IMAGE, signalée par le module PONT D'APERÇU. Si ce signal n'arrive pas,
    // on dévoile quand même ce délai après le `load` du document — au pire on
    // retrouve l'ancien comportement (un lecteur noir un instant), jamais un
    // aperçu bloqué sur sa vignette.
    PREVIEW_REVEAL_FALLBACK_MS: 1_500,

    // === Voile de chargement initial ===
    // Délai de stabilité : le voile se lève quand la sidebar est peuplée
    // ET qu'aucune nouvelle carte "Déconnecté(e)" n'a été masquée pendant
    // ce laps de temps. Comme Twitch monte/nettoie sa sidebar par vagues
    // au boot, chaque vague repousse ce délai ; le voile attend donc la
    // fin réelle du nettoyage. Valeur courte car on suit l'activité réelle.
    LOADING_STABILITY_MS:   1_500,
    // Timeout dur — filet anti-blocage. Ne sert QUE si l'activité ne
    // s'arrête jamais (cas pathologique : Twitch mute en boucle). Dans
    // le cas normal, c'est le debounce de stabilité ci-dessus qui lève
    // le voile bien avant. Valeur large pour ne jamais couper le nettoyage
    // en plein travail, tout en garantissant que l'utilisateur n'est
    // jamais bloqué indéfiniment.
    LOADING_TIMEOUT_MS:     15_000,
    // Durée du fondu de sortie (CSS transition opacity).
    LOADING_FADE_MS:        1_000
  });

  /* ============================================================
   *  STATE
   * ============================================================ */
  const state = {
    // Mode de tri actif sur la section "Chaînes suivies".
    //   viewers  : nombre de viewers décroissant (mode par défaut, aligné
    //              sur le tri natif "Spectateurs (décroissant)")
    //   popular  : popularité personnelle (cf. module visits)
    //   uptime   : durée de stream croissante (récents en tête)
    //   alpha    : pseudo alphabétique
    //   costream : groupes de co-stream en tête (par audience cumulée)
    //   default  : ordre Twitch natif — non sélectionnable par l'utilisateur,
    //              utilisé uniquement comme état transitoire si jamais
    //              l'état devient inattendu (sécurité).
    sortMode:       'viewers',
    categoryFilter: null,
    languageFilter: null,
    filterDriver:   null,  // facette pilotée par l'utilisateur : 'category' | 'language' | null
    // Mode d'affichage de la section principale :
    //   false → « Chaînes suivies » (les cartes que Twitch pose lui-même)
    //   true  → « Chaînes globales » (cartes fabriquées par l'extension à
    //           partir du classement calculé par le module globalChannels)
    // La bascule d'interface arrive au palier 2 ; au palier 1 le drapeau
    // n'est manipulable que par la console (tse.global.on()).
    globalMode:     false
  };

  /* ============================================================
   *  STYLES
   * ============================================================ */
  const CSS = `
    /* === Voile de chargement initial ===
       Masque toute la sidebar pendant l'init pour cacher le flash de
       cartes Déconnecté(e), cartes non triées, hype trains non encore
       masqués. Levé dès stabilité de la sidebar (debounce piloté par
       loadingOverlay.notifyScan dans scanSidebar) ou au plus tard
       après LOADING_TIMEOUT_MS.

       Le masquage est en DEUX couches synchronisées :
         1) body.tse-loading rend #side-nav transparente (opacity:0).
            Évite que les sections Twitch (Stories, etc.) "flashent"
            entre le moment où elles sont montées et le moment où
            l'overlay JS est positionné dessus. Levée par retrait
            de la classe → transition fade-in de la sidebar.
         2) L'overlay flottant (position:fixed, calé sur #side-nav)
            affiche le fond + le spinner pendant ce temps. Levée par
            data-tse-fading → fade-out symétrique.
       Les deux fondus partagent LOADING_FADE_MS pour un crossfade
       propre : la sidebar se révèle au même rythme que l'overlay
       disparaît, masquant la barre violette "stream frais" qui
       attirerait l'œil pendant le fondu sinon. */
    /* opacity:0 masque la sidebar ; pointer-events:none la rend inerte
       pendant le voile. Sans ce second point, la sidebar (invisible mais
       toujours présente dans le layout) resterait survolable et cliquable
       « à l'aveugle » sous le voile : déclenchement de l'aperçu au survol
       (délégation mouseenter sur .side-nav-card), états :hover et
       navigations au clic. pointer-events:none neutralise les trois d'un
       coup — les events de pointeur ne ciblent plus aucune carte, donc ni
       les listeners JS ni les pseudo-classes :hover ne s'activent. La règle
       est portée par body.tse-loading, l'unique source de vérité du voile
       (posée par startCycle(), retirée en première action de finish()) :
       l'interaction est donc restaurée pile au lancement du crossfade de
       sortie, et non à la fin du fondu. */
    body.tse-loading #side-nav { opacity: 0; pointer-events: none; }
    #side-nav { transition: opacity ${CFG.LOADING_FADE_MS}ms ease; }
    .tse-loading-overlay {
      position: fixed;
      background: #26262c;
      z-index: 100;
      opacity: 1;
      transition: opacity ${CFG.LOADING_FADE_MS}ms ease;
      pointer-events: none;
    }
    .tse-loading-overlay[data-tse-fading="true"] { opacity: 0; }
    /* Spinner indépendant de la hauteur de l'overlay. Centré V dans la
       viewport (top:50% + translateY) et H dans la sidebar (left+width
       posés par reposition() en JS, translateX:-50% pour centrer dans). */
    .tse-loading-overlay__spinner {
      position: fixed;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 44px; height: 44px;
      border-radius: 50%;
      border: 5px solid #464656;
      border-top-color: #9147ff;
      animation: tse-spin 0.9s linear infinite;
      z-index: 101;
      opacity: 1;
      transition: opacity ${CFG.LOADING_FADE_MS}ms ease;
      pointer-events: none;
    }
    .tse-loading-overlay[data-tse-fading="true"] .tse-loading-overlay__spinner {
      opacity: 0;
    }
    @keyframes tse-spin {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    /* === Compteur de viewers rafraîchi par l'extension ===
       Notre span est inséré juste après le compteur natif, dans le même
       parent : il reprend donc exactement sa place dans le flux, sans avoir
       à rejouer la mise en page de Twitch. Le natif n'est masqué que sur les
       cartes qui portent déjà une valeur à nous ([data-tse-viewers]) — sur
       toutes les autres (résolution en cours, sections hors « suivis »),
       c'est celui de Twitch qui reste affiché. */
    .tse-viewers {
      font-variant-numeric: tabular-nums;
    }
    .side-nav-card[data-tse-viewers] .side-nav-card__live-status [aria-hidden="true"]:not(.tse-viewers),
    .side-nav-card[data-tse-viewers] [data-a-target="side-nav-live-status"] [aria-hidden="true"]:not(.tse-viewers) {
      display: none !important;
    }

    /* === Uptime label sous le nombre de viewers === */
    .tse-uptime {
      display: block; width: 100%; margin-top: 1px;
      font-size: 1.2rem; line-height: 1.4; text-align: right;
      color: var(--color-text-alt-2, #adadb8);
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }
    .tse-uptime[data-tse-ended="true"] {
      color: var(--color-text-alt, #6e6e7a);
      font-style: italic;
      font-variant-numeric: normal;
    }

    /* === Pastille collab === */
    .tse-collab-host { position: relative !important; }
    .tse-collab-badge {
      position: absolute; bottom: -3px; right: -3px;
      min-width: 16px; height: 16px; padding: 0 4px;
      box-sizing: border-box;
      background: ${CFG.PURPLE}; color: #fff;
      font-size: 10px; font-weight: 700; line-height: 16px;
      border-radius: 999px; text-align: center;
      box-shadow: 0 0 0 2px var(--color-background-base, #0e0e10);
      pointer-events: none; z-index: 2;
      font-variant-numeric: tabular-nums;
    }

    /* === Masquages divers === */
    [data-a-target*="hype-train" i],
    [data-test-selector*="hype-train" i],
    [class*="hype-train" i],
    [class*="HypeTrain"] { display: none !important; }

    /* Lignes annexes (hype train, réduction d'abonnement, badges divers)
       injectées par Twitch sous le bloc principal d'une carte. Elles sont
       marquées en JS via [data-tse-extra-row] dans processCard(), puis
       masquées ici. L'approche JS est nécessaire car les sélecteurs CSS
       avec :has() et :not(:has()) combinés rencontrent des bugs/limitations
       selon les moteurs et certaines structures (styled-components Twitch). */
    .side-nav-card [data-tse-extra-row="true"] { display: none !important; }
    .side-nav-card .primary-with-small-avatar__mini-avatar { display: none !important; }

    /* Masquage des indicateurs de co-stream que Twitch superpose sur
       l'avatar principal des cartes (cercle coloré avec icône personnage).
       Le rôle de la carte dans le co-stream est exposé en suffixe de
       classe (les autres tokens sont hashés et changent à chaque build) :
         iconContainer--primary    → la carte est un co-streamer participant (cercle bleu)
         iconContainer--secondary  → la carte est la chaîne hébergeant      (cercle blanc)
       On masque les deux : l'info "Co-stream de X" est désormais dans
       notre popup d'aperçu, plus claire qu'un cercle ambigu.
       NB : sélecteurs préfixés .side-nav-card pour ne pas affecter les
       mêmes patterns ailleurs dans Twitch (pages de chaîne, directory).
       NB 2 : ne PAS confondre avec primary-with-small-avatar__mini-avatar
       (déjà masqué ci-dessus) qui est le système distinct "En live avec"
       (squad/multistream, badge +N), à laisser tel quel côté info. */
    .side-nav-card [class*="iconContainer--primary"],
    .side-nav-card [class*="iconContainer--secondary"] { display: none !important; }

    /* Cartes sponsorisées (carte avec layout spécial "promoted-followed") :
       on masque les éléments propres à la mise en avant publicitaire pour
       que la carte ressemble à une carte normale. Les classes
       side-nav-promoted-followed-card__* et side-nav-card__link--promoted-followed
       sont stables côté Twitch (pas hashées).
         - gradient violet de fond
         - bandeau "Sponsorisé • <marque>" en bas
         - croix "en collaboration avec"
         - logo de la marque + son cadre coloré (background-color inline) :
           ciblé par parenté via :has() pour ne pas laisser un cadre vide.
       L'info sponso est restituée comme badge dans notre popup d'aperçu
       (cf. getSponsorInfo + renderPopup). */
    .side-nav-card .side-nav-promoted-followed-card__gradient,
    .side-nav-card .side-nav-promoted-followed-card__sponsorship,
    /* Sélecteurs par alt dupliqués FR + EN + DE (« Logo de/of/von »),
       indépendants de LANG ; l'espagnol « Logo de … » réutilise la variante
       FR. La croix « collaboration » reste FR/EN (le masquage structurel
       --promoted-followed couvre le reste de la mise en page quelle que
       soit la langue). */
    .side-nav-card img[alt="en collaboration avec"],
    .side-nav-card img[alt="in collaboration with"],
    .side-nav-card img[alt="em colaboração com"],
    .side-nav-card img[alt^="Logo de"],
    .side-nav-card img[alt^="Logo of"],
    .side-nav-card img[alt^="Logo von"],
    .side-nav-card a[class*="--promoted-followed"] div:has(> img[alt^="Logo de"]),
    .side-nav-card a[class*="--promoted-followed"] div:has(> img[alt^="Logo of"]),
    .side-nav-card a[class*="--promoted-followed"] div:has(> img[alt^="Logo von"]) {
      display: none !important;
    }

    /* Une fois le décor publicitaire masqué, il reste la mise en page
       "promoted-followed" de Twitch : avatar + statut sur une ligne, PUIS le
       nom, PUIS la catégorie — empilés verticalement. Résultat : la carte
       paraît cassée/dédoublée vs les cartes normales. On la remet en forme
       en une grille « avatar | nom/catégorie | viewers » identique aux autres
       cartes. Les wrappers intermédiaires sont hashés : on les aplatit via
       display:contents en s'ancrant UNIQUEMENT sur des classes stables
       (--promoted-followed, side-nav-card__link__tooltip-arrow,
       promoted-followed-card__{gradient,title,content}, side-nav-card__live-status,
       tw-avatar). */
    .side-nav-card a[class*="--promoted-followed"] { display: block; }

    /* Niveau 1 : wrapper interne du lien (hors flèche tooltip) → transparent. */
    .side-nav-card a[class*="--promoted-followed"]
      > div:not(.side-nav-card__link__tooltip-arrow) { display: contents; }

    /* Niveau 2 : bloc de contenu (enfant non-gradient) → grille 3 colonnes. */
    .side-nav-card a[class*="--promoted-followed"]
      > div:not(.side-nav-card__link__tooltip-arrow)
      > div:not([class*="promoted-followed-card__gradient"]) {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
      align-items: center;
      column-gap: 0.8rem;
      width: 100%;
    }

    /* Niveau 3+4 : bloc avatar+statut puis wrapper d'avatar → transparents,
       pour que avatar, statut, titre et catégorie deviennent les items de la
       grille définie ci-dessus. */
    .side-nav-card a[class*="--promoted-followed"]
      > div:not(.side-nav-card__link__tooltip-arrow)
      > div:not([class*="promoted-followed-card__gradient"])
      > div:not([class*="promoted-followed-card__"]),
    .side-nav-card a[class*="--promoted-followed"]
      > div:not(.side-nav-card__link__tooltip-arrow)
      > div:not([class*="promoted-followed-card__gradient"])
      > div:not([class*="promoted-followed-card__"])
      > div:not(.side-nav-card__live-status) { display: contents; }

    /* Placement dans la grille (mêmes repères qu'une carte normale). */
    .side-nav-card a[class*="--promoted-followed"] .tw-avatar {
      grid-column: 1; grid-row: 1 / 3;
    }
    .side-nav-card a[class*="--promoted-followed"] [class*="promoted-followed-card__title"] {
      grid-column: 2; grid-row: 1; min-width: 0; margin: 0;
    }
    .side-nav-card a[class*="--promoted-followed"] [class*="promoted-followed-card__content"] {
      grid-column: 2; grid-row: 2; min-width: 0; margin: 0;
    }
    .side-nav-card a[class*="--promoted-followed"] .side-nav-card__live-status {
      grid-column: 3; grid-row: 1 / 3;
    }

    /* Twitch peut afficher une 3e ligne pour le titre du stream (ex. "[DROPS]
       [REBROADCAST] …"). C'est un <div> frère de .side-nav-card__metadata, à
       l'intérieur du bloc [data-a-target="side-nav-card-metadata"]. On masque
       tout frère de la metadata, ce qui couvre la 3e ligne sans dépendre
       d'une classe hashée Twitch. */
    .side-nav-card [data-a-target="side-nav-card-metadata"] > .side-nav-card__metadata ~ * {
      display: none !important;
    }

    .side-nav-card[data-tse-offline="true"] { display: none !important; }
    .side-nav-section.tse-section-hidden { display: none !important; }

    /* Masquage des tooltips et panneaux d'aperçu NATIFS de Twitch
       (notre popup d'aperçu .tse-preview les remplace) :
       - tooltip-arrow : chevron + message "Utilisez la flèche droite…"
       - online-side-nav-channel-tooltip : grand panneau d'aperçu live
         qui s'ouvre au survol prolongé (~2-3s) et masque notre popup
       - side-nav-costreaming-tooltip   : encart listant les co-streamers
       - side-nav-card__tooltip         : tooltip simple
       Pattern [class*="side-nav"][class*="tooltip"] : capture aussi les
       variantes futures (Twitch hash certains noms de classe). Le
       pattern reste sûr car notre .tse-preview ne contient pas
       "side-nav" dans son nom de classe. */
    .side-nav-card .side-nav-card__link__tooltip-arrow,
    [class*="online-side-nav-channel-tooltip"],
    [class*="side-nav-costreaming-tooltip"],
    [class*="side-nav-card__tooltip"],
    [class*="side-nav"][class*="tooltip__body"],
    [data-a-target="side-nav-card-tooltip"] {
      display: none !important;
    }

    /* Modale natif Twitch (.tw-dialog-layer) qui sert de wrapper React au
       tooltip d'aperçu de carte (.online-side-nav-channel-tooltip). Même
       avec les tooltips masqués ci-dessus, ce wrapper modal apparaît au
       survol et clignote derrière notre popup, surtout au mouseout.
       On le masque uniquement pendant l'affichage de notre popup, via le
       flag .tse-preview-active posé sur <body> par open()/close(). Hors
       de ce contexte, .tw-dialog-layer reste fonctionnel pour les modales
       légitimes (menu utilisateur, paramètres, confirmations). */
    body.tse-preview-active .tw-dialog-layer { display: none !important; }

    /* Masquage du header natif Twitch ("Chaînes suivies / Spectateurs (décroissant) / ↕"
       qui ouvre la modale de tri Twitch). Plusieurs sélecteurs pour résister
       aux renames : classe legacy, classe à préfixe similaire, et marqueur
       JS de secours posé en fallback par hideNativeFollowedHeader(). */
    .followed-side-nav-header,
    [class*="followed-side-nav-header"],
    [data-tse-native-header="hidden"] { display: none !important; }

    /* === Alignement droit du compteur de viewers ===
       Twitch enveloppe le nombre dans un sous-conteneur flex qui le
       centre/justifie selon son flux. Pour avoir une grille verticale
       stable entre "60" et "9,8 k", on force :
         - la cellule live-status à aligner son contenu à droite
         - le wrapper interne à occuper toute la largeur, justifier
           son contenu à la fin, et passer en text-align right
         - le span numérique en tabular-nums */
    .side-nav-card__live-status,
    [data-a-target="side-nav-live-status"] {
      text-align: right;
    }
    .side-nav-card__live-status > div,
    [data-a-target="side-nav-live-status"] > div {
      width: 100%;
      justify-content: flex-end;
    }
    .side-nav-card__live-status > div > div,
    [data-a-target="side-nav-live-status"] > div > div {
      justify-content: flex-end;
      text-align: right;
    }
    .side-nav-card__live-status [aria-hidden="true"],
    [data-a-target="side-nav-live-status"] [aria-hidden="true"] {
      font-variant-numeric: tabular-nums;
    }

    /* === Survol progressif des cartes ===
       Twitch applique un fond de surbrillance INSTANTANÉ au :hover d'une carte.
       On l'adoucit en ajoutant une transition sur la carte et ses descendants :
       quel que soit l'élément qui porte réellement ce fond (lien, wrapper
       interne), le fondu s'applique. On ne transitionne QUE background-color :
       la transition ne se déclenche donc que sur l'élément qui change de fond,
       et les dégradés co-stream/fresh (background-image) ne sont pas affectés. */
    .side-nav-card,
    .side-nav-card * {
      transition: background-color 300ms ease;
    }

    /* === Stream frais (< 10 min) ===
       Effet renforcé : fond violet subtil + barre 3px lumineuse +
       halo qui pulse. Reste léger pour ne pas saturer la sidebar. */
    .side-nav-card.tse-fresh {
      position: relative;
      isolation: isolate;
      background: linear-gradient(
        90deg,
        rgba(145, 71, 255, 0.18) 0%,
        rgba(145, 71, 255, 0.06) 40%,
        transparent 100%
      );
      border-radius: 4px;
    }
    .side-nav-card.tse-fresh::before {
      content: '';
      position: absolute;
      left: 0; top: 4px; bottom: 4px;
      width: 3px;
      background: ${CFG.PURPLE};
      border-radius: 0 3px 3px 0;
      animation: tse-fresh-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      pointer-events: none;
      z-index: 1;
    }
    @keyframes tse-fresh-pulse {
      0%, 100% {
        opacity: 0.7;
        box-shadow: 0 0 6px ${CFG.PURPLE}, 0 0 2px ${CFG.PURPLE};
      }
      50% {
        opacity: 1;
        box-shadow: 0 0 14px ${CFG.PURPLE}, 0 0 6px ${CFG.PURPLE};
      }
    }

    /* === Co-stream : même effet que "fresh" mais sans animation et avec
       une couleur différente par groupe. La couleur est définie via la
       variable --tse-costream-color posée en JS sur chaque carte.
       Si une carte est à la fois "fresh" ET "costream", "fresh" gagne
       visuellement (priorité au violet animé). */
    .side-nav-card.tse-costream {
      position: relative;
      isolation: isolate;
      background: linear-gradient(
        90deg,
        var(--tse-costream-bg, rgba(255,255,255,0.10)) 0%,
        var(--tse-costream-bg-fade, rgba(255,255,255,0.04)) 40%,
        transparent 100%
      );
      border-radius: 4px;
    }
    .side-nav-card.tse-costream::before {
      content: '';
      position: absolute;
      left: 0; top: 4px; bottom: 4px;
      width: 3px;
      background: var(--tse-costream-color, #ffffff);
      border-radius: 0 3px 3px 0;
      box-shadow: 0 0 6px var(--tse-costream-color, #ffffff),
                  0 0 2px var(--tse-costream-color, #ffffff);
      pointer-events: none;
      z-index: 1;
    }
    /* Si "fresh" et "costream" se cumulent, fresh prend le dessus visuellement. */
    .side-nav-card.tse-fresh.tse-costream { background-image: linear-gradient(
        90deg,
        rgba(145, 71, 255, 0.18) 0%,
        rgba(145, 71, 255, 0.06) 40%,
        transparent 100%
      ); }
    .side-nav-card.tse-fresh.tse-costream::before { background: ${CFG.PURPLE}; }
    /* Jonction de barres : deux cartes co-stream VISIBLES adjacentes du même
       groupe (classes posées en JS par applyCostreamJoins) → leurs barres
       latérales fusionnent en une seule. On prolonge la barre au-delà du bord
       de la carte vers le voisin et on supprime l'arrondi du côté joint.
       L'extension exacte (moitié de l'interstice inter-cartes) est mesurée en
       JS et passée via --tse-costream-jt / --tse-costream-jb : la jointure est ainsi
       parfaite quel que soit le mode (étendu OU réduit, où l'espacement entre
       avatars est plus grand). Repli -8px si la mesure n'a pas encore eu lieu.
       Une carte « du milieu » (3+ membres adjacents) porte les deux classes. */
    .side-nav-card.tse-costream.tse-costream-join-bottom::before {
      bottom: var(--tse-costream-jb, -8px);
      border-bottom-right-radius: 0;
    }
    .side-nav-card.tse-costream.tse-costream-join-top::before {
      top: var(--tse-costream-jt, -8px);
      border-top-right-radius: 0;
    }

    /* === Masquage du bouton "Afficher moins" (inutile après auto-expansion) === */
    .tse-show-less-hidden { display: none !important; }

    /* === Barre filtre + bouton tri === */
    .tse-filter {
      padding: 8px 12px 4px;
      display: flex; flex-direction: column; gap: 6px;
    }
    /* Ligne des deux dropdowns : catégorie (extensible) + langue (bord droit). */
    .tse-filter-row { display: flex; align-items: center; gap: 8px; }
    /* Conteneur d'un dropdown (flex). Le positionnement des menus se fait sur
       .tse-dd (qui porte position:relative), pas ici. */
    .tse-filter-field { display: flex; align-items: center; }
    .tse-filter-field--cat  { flex: 1 1 auto; min-width: 0; }       /* place restante */
    .tse-filter-field--lang { flex: 0 0 auto; margin-left: auto; }  /* compacte, à droite */
    /* === Dropdowns personnalisés (catégorie + langue), même structure ===
       On n'utilise plus de <select> natif : un <option> ne peut afficher que
       du texte (pas les drapeaux SVG) et on veut une mise en forme homogène.  */
    .tse-dd { position: relative; width: 100%; }
    .tse-dd-btn {
      display: flex; align-items: center; gap: 4px;
      width: 100%; height: 28px; padding: 0 8px;
      background-color: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 4px;
      color: var(--color-text-base, #efeff1);
      font-size: 1.15rem;                /* agrandi pour la lisibilité */
      cursor: pointer; outline: none; box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
    }
    .tse-dd-btn:hover:not(:disabled) { border-color: rgba(145, 71, 255, 0.5); }
    .tse-dd.tse-open .tse-dd-btn { border-color: ${CFG.PURPLE}; box-shadow: 0 0 0 1px ${CFG.PURPLE}; }
    .tse-dd-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .tse-dd-current { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; }
    .tse-dd-caret {
      flex: 0 0 auto; width: 0; height: 0;
      border-left: 4px solid transparent; border-right: 4px solid transparent;
      border-top: 5px solid #adadb8;
    }
    /* Menu déroulant : popup sous le bouton, scrollable. */
    .tse-dd-menu {
      display: none;
      position: absolute; top: calc(100% + 4px); z-index: 9999;
      min-width: 100%; max-height: 260px; overflow-y: auto; padding: 4px;
      background: #18181b; border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    }
    .tse-dd.tse-open .tse-dd-menu { display: block; }
    .tse-dd-opt {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-radius: 4px; cursor: pointer;
      font-size: 1.15rem; color: #efeff1; white-space: nowrap;
    }
    .tse-dd-opt:hover { background: rgba(145, 71, 255, 0.25); }
    .tse-dd-opt[aria-selected="true"] { background: rgba(145, 71, 255, 0.4); }
    .tse-dd-n { flex: 0 0 auto; color: #adadb8; font-variant-numeric: tabular-nums; }

    /* Catégorie : prend la place, bouton tronqué « … », menu aligné à gauche
       et élargi au contenu (noms lisibles), plafonné à la largeur sidebar. */
    .tse-dd--cat .tse-dd-current { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tse-dd--cat .tse-dd-menu { left: 0; right: auto; width: max-content; max-width: 208px; }
    .tse-dd--cat .tse-dd-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

    /* Langue : compacte, menu aligné à droite. Le bouton est inchangé (caret
       conservé, juste l'emoji globe passé en SVG). Le centrage demandé ne
       concerne QUE le menu : chaque ligne y est centrée (option « toutes les
       langues » = globe seul, options de langue = « N | drapeau »). */
    .tse-dd--lang { width: 50px; }
    .tse-dd--lang .tse-dd-current { justify-content: center; }
    .tse-dd--lang .tse-dd-menu { right: 0; left: auto; min-width: 64px; }
    .tse-dd--lang .tse-dd-opt { justify-content: center; }
    .tse-lang-code  { font-weight: 600; }
    .tse-flag { display: inline-flex; }
    .tse-flag svg { display: block; width: 20px; height: 20px; }
    .tse-dd--lang .tse-dd-opt .tse-flag svg { width: 22px; height: 22px; }

    .tse-sort-toggle {
      flex: 0 0 auto;
      width: 28px; height: 28px;
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      color: var(--color-text-alt-2, #adadb8);
      cursor: pointer;
      transition: background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
    }
    .tse-sort-toggle:hover {
      border-color: rgba(145, 71, 255, 0.5);
      color: var(--color-text-base, #efeff1);
    }
    .tse-sort-toggle:focus-visible {
      outline: none;
      border-color: ${CFG.PURPLE};
      box-shadow: 0 0 0 1px ${CFG.PURPLE};
    }
    .tse-sort-toggle svg {
      width: 16px; height: 16px;
      fill: currentColor;
      pointer-events: none;
    }
    .tse-sort-toggle[aria-pressed="true"] {
      background: ${CFG.PURPLE};
      border-color: ${CFG.PURPLE};
      color: #fff;
    }
    .tse-sort-toggle[aria-pressed="true"]:hover {
      background: ${CFG.PURPLE_HOVER};
      border-color: ${CFG.PURPLE_HOVER};
    }
    /* État désactivé : grise le bouton et bloque toute interaction.
       Note : l'attribut HTML "disabled" court-circuite déjà click et focus
       côté navigateur ; ce style ne fait qu'aligner le rendu. */
    .tse-sort-toggle:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* === Ligne des boutons de tri (sous les dropdowns, centrée) === */
    .tse-sort-row {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 4px;
    }

    /* === Bascule de mode : Chaînes suivies ↔ Top Chaînes ===
       Deux boutons dans NOTRE bloc filtre, posés là où Twitch affichait son
       en-tête de section. Pas de popup : rien à positionner, rien à refermer,
       rien que React puisse emporter.

       Le libellé n'est JAMAIS tronqué — c'est la seule contrainte qui compte
       ici. Plutôt qu'une ellipse, la rangée autorise le retour à la ligne :
       en français les deux boutons tiennent côte à côte, et dans une langue
       plus longue (« Kanäle, denen du folgst ») le second passe en dessous,
       toujours entièrement lisible. Une ellipse aurait donné « Chaînes su… »,
       ce qui n'informe plus de rien. */
    .tse-mode-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .tse-mode-tab {
      flex: 1 1 auto;
      padding: 7px 8px; border: 0; border-radius: 4px;
      background: rgba(255, 255, 255, 0.08); color: #adadb8;
      font: inherit; font-size: 12px; font-weight: 600; line-height: 1.2;
      white-space: nowrap; text-align: center; cursor: pointer;
      transition: background-color 0.1s ease, color 0.1s ease;
    }
    .tse-mode-tab:hover { background: rgba(255, 255, 255, 0.16); color: #efeff1; }
    .tse-mode-tab[aria-pressed="true"] {
      background: ${CFG.PURPLE}; color: #fff;
    }
    .tse-mode-tab[aria-pressed="true"]:hover { background: ${CFG.PURPLE_HOVER}; }

    /* En mode « Top Chaînes », les cartes de Twitch s'effacent au profit des
       nôtres. Le bouton « Afficher plus » de la liste suivie n'a plus d'objet,
       et les modes de tri non plus : le classement EST le tri. */
    body.tse-global-ready .side-nav-card:not([data-tse-global="true"]) { display: none !important; }
    body.tse-global-ready ${DOM.showMoreStableSelector} { display: none !important; }
    body.tse-global-mode #tse-sort-row { display: none; }

    /* Bandeau d'honnêteté : le classement est servi, mais on dit quand il
       n'est pas PROUVÉ complet (cf. windowFloor dans le module de données). */
    .tse-global-partial {
      margin-top: 4px; padding: 4px 6px;
      font-size: 11px; line-height: 1.3; color: #dedee3;
      background: rgba(255, 122, 138, 0.14);
      border-left: 2px solid #ff7a8a; border-radius: 2px;
    }

    /* === Sidebar rétrécie (collapsed) : masque les contrôles custom ===
       Quand l'utilisateur réduit la sidebar (« Réduire la barre latérale »),
       Twitch pose .side-nav--collapsed / data-a-target="side-nav-bar-collapsed"
       sur le conteneur racine et ne montre plus qu'une colonne d'avatars.
       Notre barre filtre + tri (#tse-filter, qui englobe #tse-sort-row) est
       dimensionnée pour la largeur étendue : repliée, le label et les
       contrôles débordent et cassent la mise en page. On la masque donc
       en mode collapsed pour retrouver le rendu natif.

       Pure CSS (et non JS) : réaction instantanée au basculement
       collapse/expand, sans observer ni reflow piloté JS, et la barre
       réapparaît telle quelle à l'expansion. Le tri/filtre appliqué aux
       cartes reste actif (logique JS indépendante de la visibilité des
       contrôles) ; l'état est juste non éditable tant que la barre est
       réduite. Double sélecteur (attribut + classe) par robustesse : si
       Twitch renomme l'un, l'autre prend le relais. */
    [data-a-target="side-nav-bar-collapsed"] #tse-filter,
    .side-nav--collapsed #tse-filter { display: none !important; }

    /* === Aperçu au survol ===
       Le popup est positionné via JS (left/top inline). On veut un overlay
       au-dessus du reste de l'UI Twitch, donc z-index très élevé. */
    .tse-preview {
      position: fixed;
      z-index: 9999;
      width: ${CFG.PREVIEW_THUMB_WIDTH}px;
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      overflow: hidden;
      font-family: var(--font-base, "Inter", sans-serif);
      color: #efeff1;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .tse-preview[data-tse-visible="true"] { opacity: 1; }
    .tse-preview__thumb-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      /* Fond de la même teinte que le popup, et non noir : c'est ce qu'on voit
         tant que la vignette n'est pas arrivée. Un rectangle noir se lit comme
         une panne ; la couleur du panneau se lit comme un chargement. */
      background: #18181b;
    }
    /* La vignette apparaît elle aussi en fondu. Elle est servie par le réseau :
       même mise en cache, un premier affichage a un délai, et la voir surgir
       d'un coup sur le fond du panneau accroche l'œil. */
    .tse-preview__thumb {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .tse-preview__thumb[data-tse-loaded="true"] { opacity: 1; }
    /* L'iframe player est superposé au JPEG dans le même wrapper.
       Invisible par défaut (data-tse-loaded="false"), elle apparaît en
       fondu à sa PREMIÈRE IMAGE — pas au chargement de son document,
       qui la montrerait encore noire (cf. injectIframe). Si l'iframe est
       démontée (timeout, fermeture), le JPEG reste visible en repli.
       Le fondu est allongé à 0,35 s : la vignette et la première image
       montrent presque la même chose, la transition doit se sentir
       comme un enchaînement, pas comme une bascule. */
    .tse-preview__iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      opacity: 0;
      transition: opacity 0.35s ease;
      /* L'iframe ne doit pas capter les clics : le popup entier est
         pointer-events:none côté .tse-preview, mais l'iframe pourrait
         intercepter via sa propre composition. Cohérent avec
         l'approche du module FFZ étudié. */
      pointer-events: none;
    }
    .tse-preview__iframe[data-tse-loaded="true"] { opacity: 1; }
    .tse-preview__thumb-placeholder {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255, 255, 255, 0.4);
      font-size: 1.2rem;
    }
    .tse-preview__body {
      padding: 10px 12px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .tse-preview__title {
      font-size: 1.4rem;
      font-weight: 600;
      line-height: 1.3;
      margin: 0;
      /* Limite à 3 lignes max pour éviter un popup démesuré sur des
         titres très longs (style speedrun avec catégorie, etc.). */
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .tse-preview__badges {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .tse-preview__badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.5;
      background: rgba(255, 255, 255, 0.08);
      color: #efeff1;
    }
    /* Palette des badges, par type de contenu :
         hype     → orange  (Hype Train standard)
         discount → rose    (Réduction d'abonnement)
         costream → bleu    (Co-stream : participant / hôte / fallback heuristique)
         squad    → violet  (Système "En live avec" / multistream Twitch)
         sponsor  → vert    (Stream sponsorisé)
       Toutes les couleurs sont distinctes pour qu'elles soient facilement
       différenciables en un coup d'œil dans le popup. */
    .tse-preview__badge--hype     { background: rgba(255, 105, 5, 0.25); color: #ffb380; }
    .tse-preview__badge--discount { background: rgba(255, 56, 219, 0.20); color: #ffa3ee; }
    .tse-preview__badge--costream { background: rgba(31, 105, 255, 0.25); color: #7fb3ff; }
    .tse-preview__badge--squad    { background: rgba(145, 71, 255, 0.25); color: #d1b3ff; }
    .tse-preview__badge--sponsor  { background: rgba(0, 184, 90, 0.22);  color: #6bdb9d; }
    /* Logo de la marque sponsor (image fournie par Twitch sur fond coloré
       inline). On le rend en mini cadre carré 14×14 dans le badge. Le
       background-color est posé inline depuis getSponsorInfo. */
    .tse-preview__sponsor-logo {
      display: inline-flex;
      width: 14px; height: 14px;
      border-radius: 2px;
      align-items: center; justify-content: center;
      overflow: hidden;
    }
    .tse-preview__sponsor-logo img { width: 100%; height: 100%; object-fit: contain; }
  `;

  const injectCSS = () => {
    const tag = document.createElement('style');
    tag.id = 'tse-css';
    tag.textContent = CSS;
    (document.head || document.documentElement).appendChild(tag);
  };

  /* ============================================================
   *  GRAPHQL — requête consolidée, batching découpé, cache
   *  -------------------------------------------------------------
   *  UNE seule opération (TseChannels) porte tout ce dont la sidebar
   *  a besoin par chaîne :
   *    stream.createdAt     → durée de stream + « stream frais »
   *    stream.viewersCount  → compteur rafraîchi (cf. module VIEWERS)
   *    stream.game.name     → catégorie (filtre + heuristique co-stream)
   *    stream.freeformTags  → langues (cf. langStore)
   *    user.id              → clé de la résolution Guest Star
   *  stream === null ⇒ la chaîne est réellement hors ligne.
   *
   *  Une entrée de cache vaut LIVE_TTL. Tant qu'elle est fraîche les
   *  scans la relisent sans réseau ; dès qu'elle périme, le premier
   *  scan qui la touche remet le login en file. C'est ce TTL — et lui
   *  seul — qui fixe la fraîcheur de la sidebar.
   *
   *  Requête INLINE (et non persisted query) : les champs dont on a
   *  besoin dépassent ce que renvoie le hash UseLive, qui n'a donc plus
   *  lieu d'être. On perd une dépendance à un hash susceptible d'être
   *  tourné par Twitch, et le repli inline qu'il fallait maintenir avec.
   *  Le transport reste identique : Client-ID public, credentials omis,
   *  donnée strictement publique — comme TsePreview.
   * ============================================================ */
  const cache = new Map();
  let queue = new Map();
  let queueTimer = null;
  let gqlCooldownUntil = 0;   // anti-martèlement après l'échec d'un lot
  let massOfflineStreak = 0;  // cycles consécutifs d'extinction de masse suspecte

  // Découpe un tableau en tranches d'au plus `size` éléments.
  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Sentinelle retournée par post() en cas d'échec réseau (timeout, fetch
  // rejeté, JSON invalide). À distinguer d'un payload légitime contenant
  // stream=null, qui signifie "vraiment hors-ligne".
  const NETWORK_ERROR = Symbol('network-error');

  const post = (payload) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CFG.GQL_TIMEOUT);
    return fetch(CFG.GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-ID': CFG.CLIENT_ID },
      body: JSON.stringify(payload),
      credentials: 'omit',
      signal: controller.signal
    })
      .then(r => {
        if (!r.ok) return NETWORK_ERROR;
        return r.json().catch(() => NETWORK_ERROR);
      })
      .catch(() => NETWORK_ERROR)
      .finally(() => clearTimeout(timer));
  };

  const TSE_CHANNELS_QUERY =
    'query TseChannels($logins: [String!]) {' +
    '  users(logins: $logins) {' +
    '    id' +
    '    login' +
    '    displayName' +
    '    profileImageURL(width: 70)' +
    '    stream {' +
    '      id createdAt viewersCount' +
    '      game { id name }' +
    '      freeformTags { name }' +
    '    }' +
    '  }' +
    '}';

  // UNE opération couvre TOUTE une tranche de logins. C'est la différence
  // décisive avec la forme `user(login:)` : celle-ci imposait une opération
  // par chaîne, soit ~60 opérations/minute pour une sidebar ordinaire à la
  // cadence de 30 s. Ici une sidebar entière tient en une seule.
  const buildChannelsOp = (logins) => ({
    operationName: 'TseChannels',
    variables: { logins },
    query: TSE_CHANNELS_QUERY
  });

  // Sentinelle pour les consommateurs : "on n'a pas pu savoir, ne touche à rien".
  const UPTIME_UNKNOWN = Symbol('uptime-unknown');

  // Détecte si la liste de résultats est globalement HS (réseau cassé, throttle
  // par le navigateur en arrière-plan, etc.). On retourne UPTIME_UNKNOWN à tous
  // les appelants au lieu de stream=null (qui déclencherait "Terminé" partout).
  const isResultsUnusable = (results) => {
    if (results === NETWORK_ERROR) return true;
    if (!Array.isArray(results)) return true;
    if (results.length === 0) return true;
    // Si Twitch renvoie une erreur globale (ex: rate limit, auth) sur tout le batch
    if (results.every(r => r === null || r === undefined || r?.errors)) return true;
    return false;
  };

  async function flushQueue() {
    queueTimer = null;
    const logins = [...queue.keys()];
    const pending = queue;
    queue = new Map();
    if (!logins.length) return;

    // Découpage en tranches, envoyées EN PARALLÈLE. Chaque tranche est jugée
    // séparément : un lot rejeté (trop gros, throttle, erreur globale) ne fait
    // basculer en UPTIME_UNKNOWN que les logins qu'il portait, au lieu
    // d'aveugler toute la sidebar d'un coup.
    const slices = chunk(logins, CFG.GQL_MAX_LOGINS);
    const responses = await Promise.all(slices.map(s => post([buildChannelsOp(s)])));

    const now = Date.now();
    let fresh = 0;

    // ── 1) Dépouillement des tranches exploitables ──────────────────────
    // INDEXATION PAR LOGIN, jamais par position. Contrairement à une
    // opération par chaîne, `users(logins:)` ne garantit ni l'ordre ni la
    // complétude du tableau : un login inconnu peut être omis. S'aligner sur
    // l'index attribuerait les données d'une chaîne à une autre.
    const parsed = slices.map((slice, si) => {
      const results = responses[si];
      const list = results?.[0]?.data?.users;
      // Tranche HS → l'échec vaut signal de santé réseau : on ouvre une pause
      // pendant laquelle plus rien n'est mis en file (cf. GQL_ERROR_COOLDOWN).
      if (isResultsUnusable(results) || !Array.isArray(list)) {
        gqlCooldownUntil = Date.now() + CFG.GQL_ERROR_COOLDOWN;
        return null;
      }
      const byLogin = new Map();
      for (const u of list) {
        const l = u?.login?.toLowerCase();
        if (l) byLogin.set(l, u);
      }
      return byLogin;
    });

    // ── 2) GARDE-FOU : extinction de masse ──────────────────────────────
    // Combien de chaînes qu'on savait EN DIRECT reviennent hors ligne dans ce
    // même cycle ? Qu'une large part d'entre elles s'éteigne à la seconde près
    // est infiniment moins probable qu'une réponse dégradée de l'API — or la
    // croire vide la sidebar d'un coup, ce qui détruit la fonction même de
    // l'extension. Devant ce doute, on préfère un affichage périmé de quelques
    // dizaines de secondes à une sidebar vide.
    //
    // La tolérance est BORNÉE : si l'anomalie persiste plusieurs cycles, c'est
    // qu'elle est réelle (panne Twitch, fin d'un gros événement) et on finit
    // par l'accepter. Le garde-fou retarde, il ne censure pas.
    //
    // Deux sources pour « on la savait en direct », et la seconde est
    // indispensable : au tout premier cycle le cache est VIDE, donc la
    // première source ne prouve rien et le garde-fou serait inopérant au
    // moment le plus exposé — celui du démarrage. Ce que TWITCH affiche
    // comme étant en direct fait alors référence.
    const shownLive = new Set();
    document.querySelectorAll('.side-nav-card').forEach(c => {
      if (isSynthetic(c) || isCardOffline(c)) return;
      const l = c.dataset.tseLogin;
      if (l) shownLive.add(l);
    });

    let wasLive = 0, nowOffline = 0;
    slices.forEach((slice, si) => {
      const byLogin = parsed[si];
      if (!byLogin) return;
      for (const login of slice) {
        if (!cache.get(login)?.stream && !shownLive.has(login)) continue;
        if (!byLogin.has(login)) continue;         // absent de la réponse = inconnu
        wasLive++;
        if (!byLogin.get(login).stream) nowOffline++;
      }
    });
    const suspect = wasLive >= CFG.MASS_OFFLINE_MIN &&
                    nowOffline >= wasLive * CFG.MASS_OFFLINE_RATIO;
    if (suspect && massOfflineStreak < CFG.MASS_OFFLINE_TOLERANCE) {
      massOfflineStreak++;
      console.warn(S.consoleMassOffline(nowOffline, wasLive));
      gqlCooldownUntil = Date.now() + CFG.GQL_ERROR_COOLDOWN;
      logins.forEach(login => {
        (pending.get(login) || []).forEach(fn => fn(UPTIME_UNKNOWN));
      });
      return;
    }
    if (!suspect) massOfflineStreak = 0;

    // ── 3) Application ──────────────────────────────────────────────────
    slices.forEach((slice, si) => {
      const byLogin = parsed[si];
      if (!byLogin) {
        slice.forEach(login => {
          (pending.get(login) || []).forEach(fn => fn(UPTIME_UNKNOWN));
        });
        return;
      }

      slice.forEach((login) => {
        const user = byLogin.get(login);
        // Login absent de la réponse : on ne sait pas. Surtout PAS « hors
        // ligne » — ce serait masquer une carte sur une absence de preuve.
        if (!user) {
          (pending.get(login) || []).forEach(fn => fn(UPTIME_UNKNOWN));
          return;
        }
        const stream = user?.stream ?? null;
        // ID numérique de la chaîne : clé attendue par la requête Guest Star
        // (GuestStarBatchCollaborationQuery prend des channelIDs, pas des
        // logins). On préserve un ID déjà connu si la réponse ne le porte pas.
        const id = user?.id ?? cache.get(login)?.id ?? null;
        // Tags bruts conservés tels quels : la canonicalisation en langues est
        // faite à la LECTURE (cf. langStore), ce qui évite de dupliquer ici la
        // table LANG_SET définie bien plus bas dans le module.
        const tags = Array.isArray(stream?.freeformTags)
          ? stream.freeformTags.map(t => t?.name).filter(Boolean)
          : [];
        const entry = {
          id,
          stream,
          tags,
          game:    stream?.game?.name || null,
          viewers: Number.isFinite(stream?.viewersCount) ? stream.viewersCount : null,
          // Nom affiché et avatar : nécessaires UNIQUEMENT pour fabriquer une
          // carte que Twitch n'a pas encore posée (cf. module CARTES EN
          // AVANCE). On préserve une valeur déjà connue si la réponse ne la
          // porte pas, pour ne pas perdre l'avatar d'une carte déjà rendue.
          name:    user?.displayName?.trim() || cache.get(login)?.name || null,
          avatar:  user?.profileImageURL || cache.get(login)?.avatar || null,
          ts:      now
        };
        cache.set(login, entry);
        // Le mode global se nourrit du MÊME lot : un compteur frais met à
        // jour le classement sans une seule requête de plus. C'est ce qui
        // rend la cadence de 30 s réelle plutôt que théorique — la marche
        // structurelle, elle, ne sert qu'à faire ENTRER et SORTIR des
        // chaînes du classement, qui portent toutes une carte.
        globalChannels.setViewers(login, entry.viewers);
        fresh++;
        (pending.get(login) || []).forEach(fn => fn(entry));
      });
    });

    // Données fraîches → re-scan pour répercuter viewers, catégories, langues
    // (options des filtres) et l'ordre de tri sur l'ensemble de la sidebar.
    if (fresh) scheduleScan();
  }

  // ID numérique d'une chaîne si on l'a déjà appris, sinon null.
  // Sert de clé à la résolution Guest Star (cf. module co-stream).
  const getChannelId = (login) => cache.get(login)?.id ?? null;

  // Entrée de cache ENCORE FRAÎCHE, ou null. Lecture pure : n'enfile rien.
  // C'est le chemin rapide des scans — un simple lookup de Map, sans promesse
  // ni microtâche, exécuté sur ~100 cartes à chaque mutation de la sidebar.
  const getFreshChannel = (login) => {
    const hit = cache.get(login);
    return hit && Date.now() - hit.ts < CFG.LIVE_TTL ? hit : null;
  };

  // Met `login` en file et tient la promesse avec son entrée de cache (ou
  // UPTIME_UNKNOWN si la tranche a échoué). À n'appeler que si getFreshChannel
  // a renvoyé null.
  //
  // Pendant une pause d'erreur, on répond UPTIME_UNKNOWN sans rien enfiler :
  // les cartes gardent leur dernier état connu, exactement comme lors d'un
  // échec ordinaire, et aucune requête ne part. Une entrée de cache PÉRIMÉE
  // reste préférable à l'ignorance : on la sert telle quelle plutôt que de
  // faire régresser l'affichage vers « on ne sait pas ».
  const fetchChannel = (login) => {
    if (Date.now() < gqlCooldownUntil) {
      return Promise.resolve(cache.get(login) ?? UPTIME_UNKNOWN);
    }
    return new Promise(resolve => {
      const arr = queue.get(login) || [];
      arr.push(resolve);
      queue.set(login, arr);
      queueTimer ??= setTimeout(flushQueue, CFG.BATCH_DELAY);
    });
  };

  /* ============================================================
   *  CHAÎNES GLOBALES — couche de données
   *  -------------------------------------------------------------
   *  Rend le classement des chaînes les plus regardées de Twitch, ANONYMEMENT,
   *  alors que l'API ne sait pas le produire.
   *
   *  Ce que dit le schéma de Twitch :
   *      "Fetch live streams, ordered by the number of viewers descending."
   *      StreamSort.VIEWER_COUNT : "descending (most viewers first). This is
   *      the default if StreamSort is not set."
   *  Ce que l'API rend réellement : une liste NON TRIÉE — mesuré, y compris
   *  sur la requête de Twitch lui-même, porteuse de son Authorization et de
   *  son Client-Integrity. Le contrat documenté est violé pour tout le monde ;
   *  le classement se fait donc dans le client, et nous le faisons aussi.
   *
   *  L'exactitude ne repose pas sur une estimation mais sur une inégalité.
   *  L'audience d'une catégorie est la SOMME de ses streams, donc pour tout
   *  stream S de la catégorie C :
   *
   *      viewers(S) <= viewers(C)
   *
   *  Or `games(first: 100, options: {sort: VIEWER_COUNT})` rend, LUI, une
   *  liste réellement classée (vérifié : 100 valeurs décroissantes). Il suffit
   *  donc de descendre les catégories tant que leur audience dépasse T, le
   *  N-ième score déjà trouvé : en dessous de T, aucune catégorie ne PEUT
   *  encore contenir un stream du top N. La marche s'arrête alors en sachant
   *  qu'elle est complète — pas en espérant l'être.
   *
   *  Reste UNE hypothèse, et il faut la nommer : `game(name:){ streams(first:
   *  30) }` rend bien LE SOMMET de sa catégorie. Deux mesures l'encadrent.
   *
   *  Pour — la couverture. Sur six grosses catégories, 30 streams captent
   *  96,5 % / 73,9 % / 65,1 % / 61,8 % / 59,6 % / 44,5 % de l'audience totale,
   *  choisis parmi des milliers. Une sélection non ordonnée par rang n'en
   *  capterait qu'une fraction de pour cent.
   *
   *  Contre — la sélection n'est pas STRICTEMENT ordonnée. Mesuré sur Just
   *  Chatting : `first: 3` rend exactement les trois plus gros, mais `first: 5`
   *  et `first: 10` glissent des chaînes de mi-classement dans leur résultat.
   *  Le sommet immédiat revient juste à chaque fois ; le ventre, non.
   *
   *  Conclusion tenable, et rien de plus : le classement est exact tant qu'une
   *  chaîne au-dessus de T figure dans les 30 rendus par sa catégorie. C'est
   *  une hypothèse mesurée, pas une certitude — d'où le soin apporté au sens
   *  de `complete`, qui ne parle QUE de la descente entre catégories et jamais
   *  de ce qui se passe à l'intérieur de l'une d'elles.
   * ============================================================ */
  const globalChannels = (() => {
    /* Requêtes INLINE, sans sha256Hash : ce module ne dépend d'AUCUNE
       persisted query, comme le reste de la sidebar. Anonymes (post() pose
       credentials: 'omit' et le Client-ID public), sur des données strictement
       publiques.

       Tous les champs de stream demandés ici sont DÉJÀ servis à l'extension
       par TseChannels — id, createdAt, viewersCount, game, freeformTags,
       login, displayName, profileImageURL. Le seul élément neuf est la forme
       `game(name:){ streams(first:, options:) }` elle-même. */
    const CATEGORIES_QUERY =
      'query TseCategories($n: Int!) {' +
      '  games(first: $n, options: { sort: VIEWER_COUNT }) {' +
      '    edges { node { id name displayName viewersCount } }' +
      '  }' +
      '}';

    const CATEGORY_TOP_QUERY =
      'query TseCategoryTop($name: String!, $n: Int!) {' +
      '  game(name: $name) {' +
      '    id name viewersCount' +
      '    streams(first: $n, options: { sort: VIEWER_COUNT }) {' +
      '      edges { node {' +
      '        id createdAt viewersCount' +
      '        broadcaster { id login displayName profileImageURL(width: 70) }' +
      '        game { id name }' +
      '        freeformTags { name }' +
      '      } }' +
      '    }' +
      '  }' +
      '}';

    // ── État ────────────────────────────────────────────────────────────
    let categories    = [];    // top GLOBAL_CATEGORIES_MAX — classé par l'API
    let categoriesTs  = 0;
    let ranking       = [];    // pool récolté, classé PAR NOUS, décroissant
    let rankingDirty  = false; // un compteur frais est arrivé depuis le tri
    let rankingTs     = 0;
    let threshold     = 0;     // T — N-ième score de la dernière passe
    let lastFullWalk  = 0;
    let cooldownUntil = 0;
    let failStreak    = 0;
    let okStreak      = 0;
    let degraded      = false; // cadence structurelle retombée sur la marche
    let running       = false;
    let complete      = false; // le dernier classement est-il PROUVÉ complet ?
    let windowFloor   = 0;     // total de la dernière catégorie de la fenêtre
    const stats = { walks: 0, light: 0, scoped: 0, ops: 0, failedSlices: 0,
                    misses: 0, evicted: 0, lastMs: 0 };

    // ── Transport ───────────────────────────────────────────────────────
    // Envoie un lot d'opérations et rend un tableau de `data` ALIGNÉ sur les
    // opérations, avec null là où la réponse est inexploitable. Ne jette
    // jamais : une tranche ratée ne dégrade que ce qu'elle portait, jamais
    // le reste de la marche.
    const send = async (ops) => {
      if (!ops.length) return [];
      const slices = chunk(ops, CFG.GLOBAL_BATCH_OPS);
      stats.ops += ops.length;
      const responses = await Promise.all(slices.map(s => post(s)));
      const out = [];
      responses.forEach((rep, i) => {
        const size = slices[i].length;
        // Une réponse de taille différente n'est PAS alignable : l'accepter
        // attribuerait les streams d'une catégorie à une autre.
        if (rep === NETWORK_ERROR || !Array.isArray(rep) || rep.length !== size) {
          stats.failedSlices += 1;
          for (let k = 0; k < size; k++) out.push(null);
          return;
        }
        rep.forEach(r => out.push(r?.errors ? null : (r?.data ?? null)));
      });
      return out;
    };

    // ── Lecture ─────────────────────────────────────────────────────────
    // Nœud de stream → enregistrement plat, ou null si inutilisable.
    const readStream = (node, now) => {
      const login   = node?.broadcaster?.login;
      const viewers = node?.viewersCount;
      if (!login || !Number.isFinite(viewers)) return null;
      return {
        login,
        id:        node.broadcaster.id ?? null,
        name:      node.broadcaster.displayName?.trim() || login,
        avatar:    node.broadcaster.profileImageURL || null,
        viewers,
        game:      node.game?.name || null,
        createdAt: node.createdAt || null,
        // Tags bruts, canonicalisés à la LECTURE comme pour TseChannels :
        // c'est ce qui alimentera le filtre pays sans requête supplémentaire.
        tags:      Array.isArray(node.freeformTags)
          ? node.freeformTags.map(t => t?.name).filter(Boolean) : [],
        ts:        now
      };
    };

    // N-ième meilleur score du pool, ou 0 si le pool n'atteint pas N.
    // Rendre 0 est VOLONTAIRE : tant qu'on n'a pas N candidats, aucune
    // catégorie ne peut être écartée et la descente doit continuer.
    const nthViewers = (pool, n) => {
      if (pool.size < n) return 0;
      const v = [...pool.values()].map(s => s.viewers).sort((a, b) => b - a);
      return v[n - 1] ?? 0;
    };

    // ── Récolte ─────────────────────────────────────────────────────────
    const fetchCategories = async () => {
      const [data] = await send([{
        operationName: 'TseCategories',
        variables: { n: CFG.GLOBAL_CATEGORIES_MAX },
        query: CATEGORIES_QUERY
      }]);
      const edges = data?.games?.edges;
      if (!Array.isArray(edges) || !edges.length) return null;
      const list = [];
      for (const e of edges) {
        const node = e?.node;
        if (!node?.name || !Number.isFinite(node.viewersCount)) continue;
        list.push({
          id:      node.id ?? null,
          name:    node.name,
          display: node.displayName?.trim() || node.name,
          viewers: node.viewersCount
        });
      }
      // L'API rend cette liste classée — et nous la retrions quand même.
      // TOUTE la garantie d'exactitude repose sur cet ordre : s'en remettre
      // à la parole d'une API qui viole déjà son contrat sur `streams`
      // serait précisément l'erreur à ne pas commettre.
      list.sort((a, b) => b.viewers - a.viewers);
      return list.length ? list : null;
    };

    // Interroge le sommet de chaque catégorie et verse le résultat dans pool.
    // Rend les catégories effectivement dépouillées et les chaînes qu'elles
    // ont rendues — les deux ensembles dont la réconciliation a besoin pour
    // distinguer « absente » de « pas regardée ».
    const harvest = async (cats, pool) => {
      const queried = new Set(), seen = new Set();
      if (!cats.length) return { queried, seen, done: 0 };
      const ops = cats.map(c => ({
        operationName: 'TseCategoryTop',
        variables: { name: c.name, n: CFG.GLOBAL_STREAMS_MAX },
        query: CATEGORY_TOP_QUERY
      }));
      const data = await send(ops);
      const now  = Date.now();
      let done = 0;
      data.forEach((d, i) => {
        const edges = d?.game?.streams?.edges;
        if (!Array.isArray(edges)) return;
        done += 1;
        queried.add(cats[i].name);
        // Total de la catégorie tel que vu à l'instant de la réponse : plus
        // frais que celui de la liste `games`, on en profite.
        if (Number.isFinite(d.game?.viewersCount)) cats[i].viewers = d.game.viewersCount;
        for (const e of edges) {
          const rec = readStream(e?.node, now);
          if (!rec) continue;
          seen.add(rec.login);
          const prev = pool.get(rec.login);
          // Une chaîne peut remonter de deux catégories lors d'un changement
          // de jeu en cours de passe : on garde la lecture la plus récente.
          // Un enregistrement frais repart à zéro absence, par construction.
          if (!prev || rec.ts >= prev.ts) pool.set(rec.login, rec);
        }
      });
      return { queried, seen, done };
    };

    // Réconciliation — le cœur de la tolérance à l'échantillonnage.
    //
    // MESURÉ : `game(name:){ streams(first: 30) }` omet par intermittence des
    // chaînes qui devraient y figurer. Six appels identiques à Fortnite, même
    // catégorie, même compteur : rubius (23 608 spectateurs, top 10 mondial)
    // présent quatre fois sur six — ●○●○●●. Ce n'est pas un changement de jeu,
    // c'est l'API qui échantillonne.
    //
    // Reconstruire le pool à vide à chaque marche ferait donc CLIGNOTER une
    // chaîne sur trois passages. On ne croit plus une absence isolée : il en
    // faut GLOBAL_MISS_CONFIRM d'affilée, exactement comme OFFLINE_CONFIRM
    // refuse de déclarer une chaîne terminée sur une seule réponse vide.
    //
    // Et l'on ne compte une absence QUE si la catégorie de la chaîne a été
    // réellement interrogée : ne pas regarder n'est pas constater.
    const reconcile = (pool, queried, seen, now) => {
      const cutoff = now - CFG.GLOBAL_PRUNE_AGE;
      for (const [login, rec] of pool) {
        if (seen.has(login)) { rec.misses = 0; continue; }
        // Trop vieille pour être encore crédible : sa catégorie est sortie de
        // la descente il y a longtemps, et plus rien ne la rafraîchit.
        if (rec.ts < cutoff) { pool.delete(login); stats.evicted += 1; continue; }
        if (!queried.has(rec.game)) continue;      // pas regardée, pas jugée
        rec.misses = (rec.misses || 0) + 1;
        stats.misses += 1;
        if (rec.misses >= CFG.GLOBAL_MISS_CONFIRM) {
          pool.delete(login);
          stats.evicted += 1;
        }
      }
    };

    const publish = (pool) => {
      ranking      = [...pool.values()].sort((a, b) => b.viewers - a.viewers);
      rankingDirty = false;
      rankingTs    = Date.now();
      threshold    = nthViewers(pool, CFG.GLOBAL_TOP_N);
    };

    // Pool de départ d'une passe : le classement courant, tel quel. Il n'est
    // PAS reconstruit à vide — voir reconcile() pour la raison.
    const carryOver = () => new Map(ranking.map(r => [r.login, r]));

    // ── Marche complète ─────────────────────────────────────────────────
    // Redescend toutes les catégories au-dessus de T. `complete` dit si la
    // descente s'est arrêtée sur la condition d'exactitude plutôt que sur le
    // budget ou sur le bord de la fenêtre.
    const fullWalk = async () => {
      const started = Date.now();
      const cats = await fetchCategories();
      if (!cats) return { ok: false, complete: false };
      categories   = cats;
      categoriesTs = started;

      const pool = carryOver();
      const seed = cats.slice(0, CFG.GLOBAL_SEED_CATEGORIES);
      const a = await harvest(seed, pool);
      if (!a.done) return { ok: false, complete: false };

      // T est calculé APRÈS l'amorce puis figé pour toute la descente. Il ne
      // peut que MONTER à mesure que le pool grossit ; conserver la valeur
      // basse rend la condition d'arrêt plus prudente — on visite plus de
      // catégories que strictement nécessaire, jamais moins.
      const t = nthViewers(pool, CFG.GLOBAL_TOP_N);

      const rest = cats.slice(seed.length);
      const todo = [];
      let truncated = false;
      for (const c of rest) {
        // Liste classée : la première catégorie sous T garantit que toutes
        // les suivantes le sont aussi. On arrête d'ACHETER, ce qui est une
        // économie — la preuve de complétude, elle, se fait plus bas.
        if (t > 0 && c.viewers <= t) break;
        if (todo.length >= CFG.GLOBAL_CATEGORY_BUDGET) { truncated = true; break; }
        todo.push(c);
      }

      const b = await harvest(todo, pool);
      reconcile(pool,
                new Set([...a.queried, ...b.queried]),
                new Set([...a.seen,    ...b.seen]),
                started);
      publish(pool);

      // Complétude — et c'est ici que se joue l'honnêteté du module.
      //
      // La descente ne voit que les GLOBAL_CATEGORIES_MAX premières
      // catégories. Une catégorie HORS de cette fenêtre a forcément un total
      // inférieur ou égal à celui de la dernière catégorie reçue. Le
      // classement n'est donc prouvé complet que si ce PLANCHER DE FENÊTRE
      // passe sous T : sinon, une catégorie non vue peut encore abriter un
      // membre du top N, et l'affirmer complet serait mentir.
      //
      // Cas particulier : si Twitch rend MOINS que la fenêtre demandée, c'est
      // qu'il n'a plus rien à donner — il n'y a alors pas de hors-fenêtre.
      //
      // Remarquer que la sortie de boucle sur `c.viewers <= t` est absorbée
      // par ce même test : si une catégorie de la fenêtre est passée sous T,
      // la dernière l'est aussi. Une seule règle, pas deux.
      windowFloor = cats[cats.length - 1].viewers;
      complete = !truncated
        && (cats.length < CFG.GLOBAL_CATEGORIES_MAX || windowFloor <= threshold);

      lastFullWalk = rankingTs;
      stats.walks += 1;
      stats.lastMs = rankingTs - started;
      return { ok: true, complete };
    };

    // ── Passe légère ────────────────────────────────────────────────────
    // Ne remplace pas la marche complète : elle la retarde. Un seul appel
    // `games(first: 100)` donne TOUS les totaux de catégories, donc aucune
    // catégorie ne peut franchir T sans qu'on le voie au cycle suivant.
    const lightPass = async () => {
      const started = Date.now();
      const cats = await fetchCategories();
      if (!cats) return { ok: false };
      const prev = new Map(categories.map(c => [c.name, c.viewers]));
      categories   = cats;
      categoriesTs = started;

      const seed = cats.slice(0, CFG.GLOBAL_SEED_CATEGORIES);
      const seen = new Set(seed.map(c => c.name));
      const crossed = [];
      if (threshold > 0) {
        for (const c of cats.slice(seed.length)) {
          if (c.viewers <= threshold) break;   // liste classée : rien au-delà
          const before = prev.get(c.name);
          // Catégorie inconnue au cycle précédent, ou qui vient de repasser
          // au-dessus de T : son sommet peut désormais entrer au classement.
          if ((before === undefined || before <= threshold) && !seen.has(c.name)) {
            crossed.push(c);
            seen.add(c.name);
          }
        }
      }

      const pool = carryOver();
      const h = await harvest(seed.concat(crossed), pool);
      if (!h.done) return { ok: false };
      reconcile(pool, h.queried, h.seen, started);
      publish(pool);
      stats.light += 1;
      stats.lastMs = rankingTs - started;
      return { ok: true };
    };

    // ── Portée : le monde, ou UNE catégorie ─────────────────────────────
    // Choisir une catégorie ne FILTRE pas le classement mondial — il n'en
    // resterait qu'une poignée de chaînes, et sûrement pas les plus regardées
    // de cette catégorie. Cela change ce qu'on DEMANDE : une seule opération
    // `game(name:){ streams(first: 30) }`, triée par nous comme le reste.
    //
    // Le plafond de 30 est celui de l'API — « argument 'first' value must be
    // between 1 and 30. » — et vaut pour TOUTE catégorie, ZEVENT compris.
    // Aucune exception n'est possible de ce côté-là.
    let scope        = null;   // nom canonique de la catégorie servie, ou null
    let scopeRanking = [];
    let scopeTs      = 0;
    let scopeDirty   = false;
    // Génération de portée. Une passe lit l'état AVANT son aller-retour et
    // l'écrit APRÈS : entre les deux, un reset() ou un autre choix de
    // catégorie a pu survenir, et publier le résultat ressusciterait une
    // portée que plus personne n'a demandée.
    let scopeGen     = 0;

    // Catégorie voulue par l'utilisateur, ou null pour le monde entier.
    const wantedScope = () =>
      (state.globalMode && state.categoryFilter) ? state.categoryFilter : null;

    const scopePass = async (name) => {
      const gen = ++scopeGen;
      const started = Date.now();
      const frais = new Map();
      const h = await harvest([{ name, viewers: 0 }], frais);
      // Périmée pendant l'aller-retour : on jette. Ce n'est PAS un échec —
      // le compter comme tel déclencherait une pause et, au bout de trois,
      // un repli de cadence, alors que rien n'a mal tourné.
      if (gen !== scopeGen) return { ok: true };
      if (!h.done) return { ok: false };
      // L'état porté est lu APRÈS l'aller-retour, jamais avant : le lire
      // d'abord reviendrait à fusionner un classement qui a pu changer
      // pendant la requête. Changer de catégorie repart donc d'un pool vide —
      // le classement précédent ne dit rien de la nouvelle — tandis que
      // rester dans la même le conserve, pour que la tolérance à
      // l'échantillonnage s'applique ici comme ailleurs.
      const pool = scope === name ? new Map(scopeRanking.map(r => [r.login, r])) : new Map();
      for (const [login, rec] of frais) pool.set(login, rec);   // le frais prime
      reconcile(pool, h.queried, h.seen, started);
      scope        = name;
      scopeRanking = [...pool.values()].sort((a, b) => b.viewers - a.viewers);
      scopeDirty   = false;
      scopeTs      = Date.now();
      stats.scoped += 1;
      stats.lastMs  = scopeTs - started;
      return { ok: true };
    };

    // ── Cadence ─────────────────────────────────────────────────────────
    const noteFailure = () => {
      failStreak += 1;
      okStreak    = 0;
      cooldownUntil = Date.now() + CFG.GLOBAL_ERROR_COOLDOWN;
      if (!degraded && failStreak >= CFG.GLOBAL_FAIL_DEGRADE) {
        degraded = true;
        console.warn(S.consoleGlobalDegraded(
          failStreak, Math.round(CFG.GLOBAL_FULL_WALK_MS / 1000)));
      }
    };

    const noteSuccess = () => {
      failStreak = 0;
      if (!degraded) return;
      if (++okStreak >= CFG.GLOBAL_FAIL_DEGRADE) {
        degraded = false;
        okStreak = 0;
        console.info(S.consoleGlobalRestored(
          Math.round(CFG.GLOBAL_STRUCT_TICK / 1000)));
      }
    };

    const tick = () => {
      if (!state.globalMode || running) return;
      const now = Date.now();
      if (now < cooldownUntil) return;

      // Une catégorie est choisie : une opération suffit, et la marche
      // mondiale n'a plus lieu d'être tant qu'on y reste.
      const want = wantedScope();
      if (want) {
        const neuf = want !== scope;
        if (!neuf && now - scopeTs < CFG.GLOBAL_STRUCT_TICK) return;
        running = true;
        scopePass(want)
          .then(res => { res?.ok ? noteSuccess() : noteFailure(); })
          .catch(() => noteFailure())
          .finally(() => { running = false; });
        return;
      }

      const needFull = !ranking.length || now - lastFullWalk >= CFG.GLOBAL_FULL_WALK_MS;
      if (!needFull) {
        const interval = degraded ? CFG.GLOBAL_FULL_WALK_MS : CFG.GLOBAL_STRUCT_TICK;
        if (now - rankingTs < interval) return;
      }
      running = true;
      (needFull ? fullWalk() : lightPass())
        .then(res => { res?.ok ? noteSuccess() : noteFailure(); })
        .catch(() => noteFailure())
        .finally(() => { running = false; });
    };

    const reset = () => {
      categories = []; categoriesTs = 0;
      ranking = []; rankingDirty = false; rankingTs = 0;
      threshold = 0; windowFloor = 0; lastFullWalk = 0; cooldownUntil = 0;
      scope = null; scopeRanking = []; scopeTs = 0; scopeDirty = false;
      scopeGen += 1;   // invalide une passe encore en vol
      failStreak = 0; okStreak = 0; degraded = false; complete = false;
    };

    return {
      tick,
      reset,
      // Force une marche complète et rend sa promesse. Surface de
      // vérification (tse.global.on()) — le chemin de production, lui, passe
      // par tick(), qui ne rend rien et ne bloque personne.
      warm() {
        if (running) return Promise.resolve(null);
        running = true;
        return fullWalk()
          .then(res => { res?.ok ? noteSuccess() : noteFailure(); return res; })
          .catch(() => { noteFailure(); return { ok: false, complete: false }; })
          .finally(() => { running = false; });
      },
      // Classement courant, retrié à la demande si un compteur frais est
      // arrivé depuis le dernier tri.
      top(n = CFG.GLOBAL_TOP_N) {
        const want = wantedScope();
        if (want) {
          // Servir le classement d'une AUTRE catégorie serait pire que ne
          // rien servir : l'utilisateur verrait des chaînes qui n'ont rien à
          // voir avec son choix. On rend une liste vide, le voile couvre.
          if (want !== scope) return [];
          if (scopeDirty) {
            scopeRanking = scopeRanking.slice().sort((a, b) => b.viewers - a.viewers);
            scopeDirty = false;
          }
          return scopeRanking.slice(0, n);
        }
        if (rankingDirty) {
          ranking = ranking.slice().sort((a, b) => b.viewers - a.viewers);
          rankingDirty = false;
        }
        return ranking.slice(0, n);
      },
      // Top des catégories, avec leur audience. Alimentera le filtre
      // catégorie du mode global (« 523k | Dota 2 »).
      cats(n = CFG.GLOBAL_CATEGORIES_MAX) { return categories.slice(0, n); },
      // Compteur frais venu de TseChannels. viewers === null → la chaîne
      // n'est plus en direct : on la retire du classement plutôt que de la
      // laisser figée sur sa dernière valeur connue.
      setViewers(login, viewers) {
        // Les DEUX classements sont servis : celui du monde et celui de la
        // catégorie courante. Une chaîne peut figurer dans les deux, et le
        // compteur frais vaut pour l'un comme pour l'autre.
        let touche = false;
        const appliquer = (liste) => {
          const i = liste.findIndex(r => r.login === login);
          if (i < 0) return false;
          if (viewers === null) { liste.splice(i, 1); return true; }
          if (!Number.isFinite(viewers) || liste[i].viewers === viewers) return false;
          liste[i] = { ...liste[i], viewers, ts: Date.now() };
          return true;
        };
        if (appliquer(ranking))      { rankingDirty = true; touche = true; }
        if (appliquer(scopeRanking)) { scopeDirty   = true; touche = true; }
        return touche;
      },
      report() {
        return {
          enabled:    state.globalMode,
          scope,
          scopeSize:  scopeRanking.length,
          degraded,
          complete,
          threshold,
          windowFloor,
          pool:       ranking.length,
          categories: categories.length,
          rankingAge: rankingTs ? Date.now() - rankingTs : null,
          walkAge:    lastFullWalk ? Date.now() - lastFullWalk : null,
          categoriesAge: categoriesTs ? Date.now() - categoriesTs : null,
          ...stats
        };
      }
    };
  })();

  /* ============================================================
   *  HELPERS
   * ============================================================ */
  const RESERVED =/^(directory|videos|search|p|drops|wallet|prime|subscriptions|settings|jobs|turbo|moderator|payments|inventory|messages|friends)$/i;

  const formatUptime = (createdAt) => {
    const start = new Date(createdAt).getTime();
    if (!Number.isFinite(start)) return '';
    const totalMin = Math.max(0, Math.floor((Date.now() - start) / 60_000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h === 0 ? `${m}m` : `${h}h${String(m).padStart(2, '0')}`;
  };

  const loginFromHref = (href) => {
    if (!href) return null;
    const m = href.match(/^\/([A-Za-z0-9_]+)(?:[/?#]|$)/);
    return m && !RESERVED.test(m[1]) ? m[1].toLowerCase() : null;
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /**
   * Écrit du texte dans un élément UNIQUEMENT s'il change.
   *
   * À utiliser pour tout ce qu'on écrit dans la sidebar, sans exception.
   * Affecter textContent remplace le nœud texte même quand la chaîne est
   * identique, ce qui émet une mutation childList — or notre MutationObserver
   * traite toute mutation dans #side-nav comme un signal de re-scan. Une
   * écriture inconditionnelle dans une fonction appelée par le scan entretient
   * donc sa propre boucle : scan → écriture → mutation → scan, indéfiniment,
   * à la fréquence du debounce. Le test d'égalité la coupe net.
   */
  const setText = (el, text) => {
    if (el && el.textContent !== text) el.textContent = text;
  };

  // Section « Chaînes suivies ». Cascade pour être INDÉPENDANT DE LA LANGUE de
  // l'UI Twitch : (1) aria-label localisé (fr/en/de/es/pt — rapide et précis) ; (2) repli
  // structurel — la seule section dont le header porte `followed-side-nav-header`.
  // Section « Chaînes suivies ». Le libellé n'est accepté que s'il est porté
  // PAR une section — ou par un élément qui en descend. Sans cette contrainte,
  // n'importe quel nœud portant aria-label="Chaînes suivies" usurpe la section
  // et la sidebar se croit vide : c'est arrivé avec un bouton de l'extension
  // elle-même, dont le libellé de mode valait le nom de la section.
  const followedSection = () => {
    for (const el of document.querySelectorAll(DOM.followedSelector)) {
      const sec = el.closest('.side-nav-section');
      if (sec) return sec;
    }
    return document.querySelector(`${DOM.sidebarRoot} ${DOM.followedHeaderSelector}`)
      ?.closest('.side-nav-section') || null;
  };

  /* ============================================================
   *  VOILE DE CHARGEMENT INITIAL
   *  -------------------------------------------------------------
   *  Affiche un voile + spinner pour cacher les états transitoires
   *  de la sidebar (cartes Déconnecté(e), cartes non triées, hype
   *  trains non encore masqués, etc.).
   *
   *  Cycles déclenchés dans 3 cas :
   *   - boot : init() lance un cycle initial.
   *   - retour de page plein-écran (ex. /<channel>/stories) :
   *     globalObserver détecte le remount de #side-nav.
   *   - retour de tab caché après une absence significative : startCycle()
   *     appelé explicitement par le handler visibilitychange (cf. CFG.
   *     REVISIT_RELOAD_MS). Twitch re-hydrate sa sidebar progressivement,
   *     on masque le processus.
   *
   *  Le voile est levé en fondu (LOADING_FADE_MS) dès que :
   *   - la sidebar est peuplée, STABLE EN TAILLE (plus aucune carte ajoutée)
   *     ET aucune nouvelle carte "Déconnecté(e)" n'a été masquée pendant
   *     LOADING_STABILITY_MS (confirmation),
   *   - OU LOADING_TIMEOUT_MS s'est écoulé au total (sécurité dure).
   *
   *  IMPLÉMENTATION : l'overlay est attaché à <body> en position:fixed,
   *  avec des coordonnées calculées dynamiquement depuis
   *  #side-nav.getBoundingClientRect(). Attacher l'overlay à <body>
   *  (et non à #side-nav) est crucial : React peut remonter #side-nav
   *  au cours du chargement et emporter nos enfants custom avec lui.
   *  <body> est hors de la zone gérée par React (#root).
   * ============================================================ */
  const loadingOverlay = (() => {
    // === État partagé entre cycles ===
    let globalObserver = null;  // observer permanent (DOM-wide)
    let wasPresent = false;     // #side-nav existait au dernier check
    let cycleActive = false;    // un cycle de voile est en cours

    // === État par cycle (réinitialisé à chaque startCycle) ===
    let overlay = null;
    let spinner = null;
    let stabilityTimer = null;
    let cycleObserver = null;
    let resizeHandler = null;
    let timeoutTimer = null;
    let lastCardCount = 0;      // plus haut nombre de cartes vu pendant ce cycle

    const build = () => {
      const el = document.createElement('div');
      el.className = 'tse-loading-overlay';
      const sp = document.createElement('div');
      sp.className = 'tse-loading-overlay__spinner';
      el.appendChild(sp);
      return { el, sp };
    };

    // Aligne l'overlay sur la bounding box visible de #side-nav, et
    // positionne le spinner sur le milieu horizontal de cette zone
    // (le centre vertical du spinner reste fixé via CSS top:50% sur
    // la viewport entière).
    const reposition = () => {
      if (!overlay || !cycleActive) return;
      const sideNav = document.querySelector(DOM.sidebarRoot);
      if (!sideNav) {
        overlay.style.display = 'none';
        return;
      }
      const rect = sideNav.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        overlay.style.display = 'none';
        return;
      }
      overlay.style.display = '';
      overlay.style.top    = `${rect.top}px`;
      overlay.style.left   = `${rect.left}px`;
      overlay.style.width  = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      if (spinner) {
        spinner.style.left = `${rect.left + rect.width / 2}px`;
      }
    };

    // Lève le voile en fondu. Nettoie tous les timers et observers du
    // cycle courant. cycleActive repasse à false pour qu'un futur cycle
    // (retour depuis /stories par ex.) puisse être déclenché.
    // Journal des cycles, borné. Il n'existe que pour répondre à UNE question
    // qu'on ne peut pas trancher depuis un harnais : au chargement d'une vraie
    // page Twitch, combien de fois le voile monte-t-il, et pourquoi ? Un
    // second cycle, ou une levée trop précoce suivie d'une vague de cartes,
    // se lisent directement ici. Consultable via tse.cycles().
    const journal = [];
    const noter = (evt, detail) => {
      journal.push({ t: Math.round(performance.now()), evt, detail });
      if (journal.length > 40) journal.shift();
    };

    const finish = () => {
      if (!cycleActive) return;
      cycleActive = false;
      if (stabilityTimer) { clearTimeout(stabilityTimer); stabilityTimer = null; }
      if (timeoutTimer)   { clearTimeout(timeoutTimer);   timeoutTimer   = null; }
      if (cycleObserver) { cycleObserver.disconnect(); cycleObserver = null; }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }
      // Retire le flag body : la sidebar fade-in (CSS transition opacity).
      document.body.classList.remove('tse-loading');
      if (!overlay || !overlay.isConnected) { overlay = null; spinner = null; return; }
      // Déclenche le fondu de l'overlay via data-attribute (transition CSS).
      // Les deux fondus (sidebar in / overlay out) sont synchronisés sur
      // LOADING_FADE_MS pour un crossfade propre.
      overlay.dataset.tseFading = 'true';
      const oldOverlay = overlay;
      overlay = null;
      spinner = null;
      setTimeout(() => {
        if (oldOverlay.isConnected) oldOverlay.remove();
      }, CFG.LOADING_FADE_MS);
    };

    // (Re)programme le timer de stabilité : finish() sera appelé après
    // LOADING_STABILITY_MS de confirmation.
    const armStability = () => {
      if (stabilityTimer) clearTimeout(stabilityTimer);
      stabilityTimer = setTimeout(() => { noter('levée', 'stabilité'); finish(); },
                                  CFG.LOADING_STABILITY_MS);
    };

    // Annule une confirmation de stabilité en cours (la sidebar bouge
    // encore : une carte Déconnecté vient d'être traitée).
    const clearStability = () => {
      if (stabilityTimer) { clearTimeout(stabilityTimer); stabilityTimer = null; }
    };

    // Appelée en fin de scanSidebar. Le voile ne se lève que lorsque TROIS
    // conditions tiennent pendant LOADING_STABILITY_MS :
    //   1. sidebar PEUPLÉE (cardCount > 0). Au boot, Twitch met ~2s à
    //      monter la sidebar ; lever le voile sur du vide le ferait
    //      disparaître avant l'arrivée des cartes Déconnecté → bug.
    //   2. sidebar STABLE EN TAILLE : aucune nouvelle carte ajoutée depuis le
    //      scan précédent. Twitch re-hydrate par vagues (au boot comme au
    //      retour d'onglet) ; tant que des cartes arrivent, on patiente.
    //   3. aucune nouvelle carte Déconnecté masquée ce scan
    //      (hadOfflineActivity === false). Les vagues de Déconnecté que
    //      Twitch monte annulent donc la confirmation tant qu'elles durent.
    // Condition non remplie → clearStability (le voile reste). Une
    // confirmation en cours n'est PAS re-armée par les scans "bruit de
    // fond" de la SPA, pour qu'elle puisse tenir ses LOADING_STABILITY_MS.
    // Retourne true si la sidebar grandit encore : l'appelant doit alors
    // reprogrammer un scan pour confirmer la stabilité, même si Twitch
    // n'émet plus de mutation.
    // Verrou de levée. Un appelant peut déclarer que la sidebar n'est pas
    // présentable même si elle est peuplée et stable — c'est le cas du mode
    // Top Chaînes, dont les cartes n'existent qu'à la fin de la marche
    // structurelle. Le timeout dur, lui, reste souverain : un verrou oublié
    // ne peut pas laisser la sidebar voilée indéfiniment.
    let held = false;
    const setHold = (on) => {
      if (held === on) return;
      held = on;
      if (on) clearStability();
    };

    const notifyScan = (hadOfflineActivity, cardCount) => {
      if (!cycleActive) return false;
      const stillGrowing = cardCount > lastCardCount;
      if (cardCount > lastCardCount) lastCardCount = cardCount;
      const ready = cardCount > 0 && !hadOfflineActivity && !stillGrowing && !held;
      if (!ready) { clearStability(); return stillGrowing; }
      if (!stabilityTimer) armStability();
      return false;
    };

    // Masquage offline survenu HORS scan (voie GQL asynchrone) ou
    // suppression de carte par Twitch. Annule la confirmation en cours :
    // le prochain scan ré-évaluera l'état de la sidebar.
    const bumpActivity = () => {
      if (!cycleActive) return;
      clearStability();
    };

    // Démarre un cycle de voile : crée l'overlay, pose le flag body,
    // installe les observers de repositionnement et le timeout dur.
    // Idempotent : si un cycle est déjà en cours, ne fait rien.
    const startCycle = (raison = 'inconnue') => {
      if (cycleActive) { noter('cycle ignoré', raison); return; }
      noter('cycle', raison);
      cycleActive = true;
      lastCardCount = 0; // croissance mesurée à partir de zéro pour ce cycle
      held = false;      // un nouveau cycle repart sans verrou hérité

      // 1) Pose body.tse-loading dès que possible : rend #side-nav
      //    transparent (CSS) pour qu'aucun fragment de sidebar ne flashe
      //    avant que l'overlay ne soit positionné.
      document.body.classList.add('tse-loading');

      // 2) Création de l'overlay et attachement à <body> (hors zone React).
      const built = build();
      overlay = built.el;
      spinner = built.sp;
      document.body.appendChild(overlay);
      reposition();

      // 3) Repositionnement sur resize fenêtre.
      resizeHandler = () => reposition();
      window.addEventListener('resize', resizeHandler);

      // 4) MutationObserver dédié au cycle pour repositionner sur les
      //    changements DOM. Filtre les mutations à l'intérieur de notre
      //    propre overlay pour éviter les boucles (animation du spinner).
      cycleObserver = new MutationObserver((mutations) => {
        if (!cycleActive) return;
        const allInOverlay = mutations.every(m =>
          overlay && (m.target === overlay || overlay.contains(m.target))
        );
        if (allInOverlay) return;
        reposition();
      });
      cycleObserver.observe(document.body, { childList: true, subtree: true });

      // 5) Timeout dur : voile levé d'office si jamais aucun scan n'arrive
      //    ou si la sidebar reste indéfiniment en mutation.
      timeoutTimer = setTimeout(() => { noter('levée', 'délai maximal'); finish(); },
                                CFG.LOADING_TIMEOUT_MS);
    };

    const init = () => {
      // Démarre un premier cycle immédiatement (le boot Twitch va monter
      // la sidebar et déclencher les scans).
      startCycle('démarrage');

      // Observer GLOBAL permanent : détecte les disparitions/réapparitions
      // de #side-nav pour redéclencher un cycle au retour de /stories ou
      // autres pages plein-écran qui retirent la sidebar du DOM.
      // Indépendant du cycleObserver (qui est tué entre les cycles).
      wasPresent = !!document.querySelector(DOM.sidebarRoot);
      globalObserver = new MutationObserver(() => {
        const present = !!document.querySelector(DOM.sidebarRoot);
        if (present && !wasPresent && !cycleActive) {
          // #side-nav réapparaît après une absence → nouveau cycle.
          startCycle('remount de la sidebar');
        }
        wasPresent = present;
      });
      globalObserver.observe(document.body, { childList: true, subtree: true });
    };

    return { init, notifyScan,
      setHold, bumpActivity, startCycle,
      journal: () => journal.slice() };
  })();

  /* ============================================================
   *  TRACKING DES VISITES (popularité personnelle)
   *  -------------------------------------------------------------
   *  Modèle :
   *   - une "visite" = avoir passé >= VISIT_MIN_DWELL_MS sur la page
   *     d'un streamer, ET ne pas avoir déjà compté de visite chez lui
   *     dans les VISIT_SESSION_MS dernières millisecondes.
   *   - on garde les VISIT_ROLLING_N derniers timestamps par chaîne.
   *   - score = somme des poids 2^(-age_jours / halflife).
   *
   *  Stockage : localStorage (clé VISIT_STORAGE_KEY), JSON
   *   { "<login>": [ts1, ts2, ...], ... }
   *
   *  Vie privée : 100 % local, jamais envoyé. Effaçable via la
   *   console : localStorage.removeItem('tse:visits').
   * ============================================================ */
  const visits = {
    map: new Map(), // login -> number[] (timestamps DESC)

    load() {
      try {
        const raw = localStorage.getItem(CFG.VISIT_STORAGE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return;
        for (const [login, arr] of Object.entries(obj)) {
          if (!Array.isArray(arr)) continue;
          // On normalise : timestamps DESC, taille bornée à N.
          const cleaned = arr
            .map(Number)
            .filter(n => Number.isFinite(n) && n > 0)
            .sort((a, b) => b - a)
            .slice(0, CFG.VISIT_ROLLING_N);
          if (cleaned.length) this.map.set(login, cleaned);
        }
        this.prune(); // borne le nombre de chaînes au chargement
      } catch { /* localStorage corrompu / quota / privacy mode → on ignore */ }
    },

    // Borne le nombre de chaînes suivies à VISIT_MAX_LOGINS, en gardant celles
    // aux visites les plus RÉCENTES (list[0] = timestamp le plus récent, tri
    // DESC garanti). Empêche une croissance illimitée de la map et du
    // localStorage sur de longs mois d'utilisation.
    prune() {
      if (this.map.size <= CFG.VISIT_MAX_LOGINS) return;
      const kept = [...this.map.entries()]
        .sort((a, b) => (b[1][0] || 0) - (a[1][0] || 0))
        .slice(0, CFG.VISIT_MAX_LOGINS);
      this.map = new Map(kept);
    },

    save() {
      try {
        const obj = Object.fromEntries(this.map);
        localStorage.setItem(CFG.VISIT_STORAGE_KEY, JSON.stringify(obj));
      } catch { /* quota dépassé → on ignore, le tracking continue en mémoire */ }
    },

    // Enregistre une visite si la fenêtre VISIT_SESSION_MS est dépassée.
    record(login) {
      if (!login) return;
      const now = Date.now();
      const list = this.map.get(login) || [];
      if (list.length > 0 && now - list[0] < CFG.VISIT_SESSION_MS) {
        return; // encore dans la même "session de visite"
      }
      list.unshift(now);
      if (list.length > CFG.VISIT_ROLLING_N) list.length = CFG.VISIT_ROLLING_N;
      this.map.set(login, list);
      this.prune(); // borne le nombre de chaînes suivies
      this.save();
    },

    // Score de popularité personnelle. Plus grand = plus populaire.
    scoreFor(login) {
      const list = this.map.get(login);
      if (!list || list.length === 0) return 0;
      const now = Date.now();
      const halfLifeMs = CFG.VISIT_HALFLIFE_DAYS * 24 * 60 * 60 * 1000;
      let score = 0;
      for (const ts of list) {
        const age = Math.max(0, now - ts);
        score += Math.pow(2, -age / halfLifeMs);
      }
      return score;
    }
  };

  /* ============================================================
   *  ROSTER DES CHAÎNES SUIVIES
   *  -------------------------------------------------------------
   *  Mémorise les chaînes suivies APERÇUES dans la sidebar, avec la
   *  date de dernière observation.
   *
   *  Pourquoi c'est possible sans authentification : Twitch rend dans
   *  la sidebar les chaînes suivies HORS LIGNE aussi bien que les
   *  chaînes en direct (c'est ce que masque isCardOffline), et
   *  autoExpandFollowed déplie la liste. Les cartes suivies portent
   *  toutes le marqueur indépendant de la langue
   *  data-test-selector="followed-channel" — il suffit de les lire.
   *
   *  À quoi ça sert : sonder la liveness d'une chaîne ne demande
   *  aucune authentification (c'est une donnée publique) ; seule la
   *  question « qui est-ce que je suis ? » l'exigeait. En apprenant
   *  la réponse par observation, on lève ce verrou — et on ouvre la
   *  possibilité de détecter un passage en direct sans attendre que
   *  Twitch insère la carte.
   *
   *  Ce module se contente d'ACCUMULER. Rien ne l'exploite encore ;
   *  il tourne dès maintenant pour que la liste soit déjà chaude le
   *  jour où on décidera de s'en servir (cf. tse.roster()).
   *
   *  Vie privée : 100 % local, jamais envoyé, même posture que
   *  l'historique de visites. Effaçable via tse.reset().
   * ============================================================ */
  const roster = (() => {
    const map = new Map();   // login -> ts de dernière observation
    let dirty = false;
    // Classement par récence, mémoïsé. Il est parcouru DEUX fois par scan
    // (sondage puis fabrication de cartes) ; le recalculer à chaque appel
    // copiait et triait la centaine d'entrées quatre fois par seconde pour
    // un résultat qui ne bouge quasiment jamais. Invalidé à la moindre
    // mutation de la table.
    let ordered = null;

    const load = () => {
      try {
        const obj = JSON.parse(localStorage.getItem(CFG.ROSTER_STORAGE_KEY) || 'null');
        if (!obj || typeof obj !== 'object') return;
        for (const [login, ts] of Object.entries(obj)) {
          const n = Number(ts);
          if (typeof login === 'string' && Number.isFinite(n) && n > 0) map.set(login, n);
        }
        ordered = null;
        prune();
      } catch { /* stockage corrompu / quota / navigation privée → on ignore */ }
    };

    // Évince ce qui n'a plus été vu depuis ROSTER_MAX_AGE : c'est le seul
    // garde-fou contre les désabonnements. Sans lui, une chaîne que
    // l'utilisateur ne suit plus resterait sondée — et, le jour où on
    // affichera des cartes, réapparaîtrait dans sa sidebar.
    const prune = () => {
      const cutoff = Date.now() - CFG.ROSTER_MAX_AGE;
      for (const [login, ts] of map) if (ts < cutoff) { map.delete(login); ordered = null; }
      if (map.size <= CFG.ROSTER_MAX) return;
      const kept = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, CFG.ROSTER_MAX);
      map.clear();
      for (const [login, ts] of kept) map.set(login, ts);
      ordered = null;
    };

    // Écriture différée : le scan tourne à chaque mutation de la sidebar,
    // sérialiser le roster à ce rythme serait absurde. On marque sale et on
    // écrit sur le tick d'entretien (et au départ de la page).
    const flush = () => {
      if (!dirty) return;
      dirty = false;
      prune();
      try {
        localStorage.setItem(CFG.ROSTER_STORAGE_KEY,
          JSON.stringify(Object.fromEntries(map)));
      } catch { /* quota → on garde en mémoire */ }
    };

    const record = (login) => {
      if (!login) return;
      const now = Date.now();
      const prev = map.get(login);
      // Ne marque sale que si la valeur bouge significativement : sinon chaque
      // scan re-daterait les ~100 mêmes logins pour rien.
      if (prev && now - prev < 60_000) return;
      map.set(login, now);
      dirty = true;
      ordered = null; // le classement par récence change
    };

    const init = () => {
      load();
      // pagehide couvre fermeture, navigation et mise en cache bfcache —
      // contrairement à unload, il est fiable sur mobile et sous Chromium.
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    };

    return {
      init, flush, record,
      size:    () => map.size,
      entries: () => (ordered ??= [...map.entries()].sort((a, b) => b[1] - a[1])),
      clear:   () => {
        map.clear(); dirty = false; ordered = null;
        try { localStorage.removeItem(CFG.ROSTER_STORAGE_KEY); } catch {}
      }
    };
  })();

  /* ============================================================
   *  MESURE DU RETARD DE TWITCH SUR LES PASSAGES EN DIRECT
   *  -------------------------------------------------------------
   *  Combien de temps Twitch met-il à faire apparaître la carte d'une
   *  chaîne qui vient de démarrer ? Personne ne le sait — et c'est
   *  précisément ce qui détermine s'il vaut la peine que l'extension
   *  prenne les devants. Ce module répond, sur des données réelles,
   *  sans rien coûter : les deux instants nécessaires sont déjà
   *  connus du code.
   *
   *    createdAt (réponse TseChannels)  → quand le stream a démarré
   *    première apparition de la carte → quand Twitch l'a affichée
   *
   *  Un échantillon n'est retenu que si le stream a démarré ALORS
   *  QU'ON REGARDAIT, c'est-à-dire après :
   *    • un délai d'installation depuis le boot (sinon on mesurerait
   *      le peuplement initial de la sidebar, pas la réactivité de
   *      Twitch) ;
   *    • le dernier retour sur l'onglet (onglet caché = ni Twitch ni
   *      nous ne rafraîchissons — la mesure ne voudrait rien dire).
   *  Tout stream démarré avant cette borne est ignoré : sa carte
   *  était peut-être là depuis le début, on ne peut rien conclure.
   *
   *  Résultat : tse.lag(). 100 % local, jamais envoyé.
   * ============================================================ */
  const liveLag = (() => {
    const bootAt = Date.now();
    let visibleSince = document.hidden ? 0 : bootAt;
    // Clé de TOUT ce module : l'identifiant de stream, pas le login. Il change
    // à chaque diffusion, ce qui fait porter la mesure sur « ce direct-ci » —
    // une chaîne qui coupe et reprend dans la même session est donc mesurable
    // deux fois, alors qu'une clé par login n'aurait autorisé qu'une mesure.
    const aheadAt = new Map();  // id de stream -> instant où NOTRE carte l'a montré
    const done    = new Set();  // ids déjà traités (mesurés ou écartés)
    // `done` et `aheadAt` grandissent d'une entrée par direct observé et rien
    // ne les vidait : sur une session de plusieurs heures, ils accumulaient
    // indéfiniment. `prune()` (appelé au tick d'entretien) les borne.
    // Évincer une entrée de `done` autorise au pire une seconde mesure du
    // même direct — sans conséquence, et le plafond rend le cas théorique.
    let samples = [];

    const load = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(CFG.LAG_STORAGE_KEY) || 'null');
        // Les relevés antérieurs à la v2 provenaient d'une méthode BIAISÉE (ils
        // n'échantillonnaient que les chaînes absentes de la sidebar, celles sur
        // lesquelles Twitch est le plus lent). Les mélanger aux nouveaux
        // fausserait la médiane : on repart de zéro plutôt que de comparer des
        // grandeurs qui ne mesurent pas la même chose.
        if (!raw || raw.v !== CFG.LAG_FORMAT || !Array.isArray(raw.samples)) return;
        samples = raw.samples
          .filter(x => x && Number.isFinite(x.lag) && Number.isFinite(x.ts))
          .slice(-CFG.LAG_MAX_SAMPLES);
      } catch { /* ignoré */ }
    };

    const save = () => {
      try {
        localStorage.setItem(CFG.LAG_STORAGE_KEY,
          JSON.stringify({ v: CFG.LAG_FORMAT, samples }));
      } catch { /* quota → on garde en mémoire */ }
    };

    // NOUS venons de poser une carte pour ce stream, avant Twitch. On retient
    // l'instant : quand Twitch finira par afficher le sien, la différence dira
    // ce que l'extension a réellement fait gagner.
    const noteAhead = (streamId) => {
      if (!streamId || done.has(streamId) || aheadAt.has(streamId)) return;
      aheadAt.set(streamId, Date.now());
    };

    /**
     * Appelée quand une carte de TWITCH affiche un stream comme étant en
     * direct. L'instant de cet appel est, à un scan près, celui où Twitch a
     * rendu la chaîne visible — c'est la grandeur qu'on cherche.
     *
     * L'ancienne version datait au contraire la première apparition de la
     * carte QUELLE QUE SOIT sa forme, « Déconnecté » compris. Une chaîne déjà
     * présente hors ligne était donc datée du chargement de la page, ce qui
     * donnait un écart négatif au moment où elle passait en direct — et
     * l'échantillon était jeté. Seules subsistaient les chaînes absentes de la
     * sidebar, c'est-à-dire précisément celles que Twitch tarde le plus à
     * lister : la médiane mesurait un sous-ensemble, pas la réalité.
     */
    const observe = (card, stream) => {
      const id = stream?.id;
      if (!id || done.has(id)) return;                      // sortie courante
      if (isSynthetic(card)) return;                        // ne pas se mesurer soi-même
      if (!card.querySelector(DOM.followedCardSelector)) return; // section suivie seule
      const started = new Date(stream.createdAt).getTime();
      if (!Number.isFinite(started)) return;

      done.add(id);
      const ahead = aheadAt.get(id);
      aheadAt.delete(id);

      // Borne d'attribution : le stream doit avoir démarré alors qu'on
      // observait vraiment. Sinon on ne mesure pas Twitch, on mesure le
      // hasard de notre propre arrivée.
      if (started <= Math.max(bootAt + CFG.LAG_SETTLE_MS, visibleSince)) return;

      const now = Date.now();
      const lag = now - started;
      if (lag < 0 || lag > CFG.LAG_MAX_PLAUSIBLE) return;
      samples.push({
        login: card.dataset.tseLogin || null,
        lag,
        // Écart entre notre affichage et celui de Twitch, quand on l'a devancé.
        gain: Number.isFinite(ahead) ? Math.max(0, now - ahead) : null,
        ts: now
      });
      if (samples.length > CFG.LAG_MAX_SAMPLES) samples = samples.slice(-CFG.LAG_MAX_SAMPLES);
      save();
    };

    const init = () => {
      load();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          visibleSince = Date.now();
          // Ce qui s'est passé pendant l'absence n'est pas attribuable.
          aheadAt.clear();
        }
      });
    };

    const prune = () => {
      // Une avance jamais suivie de l'affichage de Twitch (la chaîne a coupé
      // avant qu'il ne rattrape) resterait sinon éternellement en attente.
      const cutoff = Date.now() - CFG.LAG_MAX_PLAUSIBLE;
      for (const [id, ts] of aheadAt) if (ts < cutoff) aheadAt.delete(id);
      if (done.size > CFG.LAG_MAX_DONE) {
        let over = done.size - CFG.LAG_MAX_DONE;
        for (const id of done) { done.delete(id); if (--over <= 0) break; }
      }
    };

    return {
      init, noteAhead, observe, prune,
      all:   () => samples.slice(),
      clear: () => {
        samples = []; aheadAt.clear(); done.clear();
        try { localStorage.removeItem(CFG.LAG_STORAGE_KEY); } catch {}
      }
    };
  })();

  /**
   * Observe la page courante : quand l'utilisateur arrive sur /<login>,
   * démarre un timer ; s'il reste >= VISIT_MIN_DWELL_MS, on enregistre
   * la visite. Le timer est annulé si la page change avant l'échéance,
   * ou si l'onglet passe en arrière-plan (on ne compte pas un onglet
   * laissé ouvert en background pendant des heures).
   */
  const visitTracker = (() => {
    let timer = null;
    let pendingLogin = null;

    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      pendingLogin = null;
    };

    const start = (login) => {
      cancel();
      if (!login) return;
      pendingLogin = login;
      timer = setTimeout(() => {
        // Vérifie qu'on est TOUJOURS sur la page du même streamer au
        // moment où le timer expire (sinon l'utilisateur a navigué ailleurs).
        if (loginFromHref(location.pathname) === pendingLogin) {
          visits.record(pendingLogin);
        }
        timer = null;
        pendingLogin = null;
      }, CFG.VISIT_MIN_DWELL_MS);
    };

    const onLocationChange = () => {
      const login = loginFromHref(location.pathname);
      start(login); // null si on n'est pas sur une page de chaîne → cancel
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancel(); // onglet passé en arrière-plan : on ne compte pas la visite
      } else {
        onLocationChange(); // retour à l'onglet : on (ré)arme si on est sur une chaîne
      }
    };

    return {
      init() {
        visits.load();

        // Twitch est une SPA : pas de "navigation" event natif. On intercepte
        // pushState/replaceState et écoute popstate pour détecter les changements
        // de route côté client.
        const fire = () => onLocationChange();
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        history.pushState = function (...args) {
          const r = origPush.apply(this, args);
          fire();
          return r;
        };
        history.replaceState = function (...args) {
          const r = origReplace.apply(this, args);
          fire();
          return r;
        };
        window.addEventListener('popstate', fire);
        document.addEventListener('visibilitychange', onVisibilityChange);

        // Démarre le tracking sur la page courante.
        onLocationChange();
      }
    };
  })();

  /* ============================================================
   *  API CONSOLE — window.tse
   *  -------------------------------------------------------------
   *  Commandes disponibles dans la console DevTools de twitch.tv :
   *    tse.scores()        → console.table des scores de popularité
   *    tse.scores(20)      → top 20 (par défaut : tous)
   *    tse.scores.raw()    → objet brut { login: {score, visits, last} }
   *    tse.reset()         → efface tout l'historique de visites
   *    tse.diagnose()      → rapport de santé des sélecteurs (console.table) ;
   *                          retourne le rapport brut. Voir aussi l'auto-
   *                          diagnostic (console.warn) si un sélecteur casse.
   *
   *  L'objet est posé une seule fois sur window, en lecture seule.
   * ============================================================ */
  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleString(S.locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const buildScoresReport = () => {
    const out = [];
    for (const [login, list] of visits.map) {
      out.push({
        login,
        score: Number(visits.scoreFor(login).toFixed(3)),
        visits: list.length,
        last: list[0] || 0
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  const tseApi = {
    scores(limit = Infinity) {
      const report = buildScoresReport().slice(0, limit);
      if (report.length === 0) {
        console.log(S.consoleNoVisits);
        return;
      }
      // Vue console.table avec dates formatées pour la lisibilité.
      console.table(report.map(r => ({
        [S.consoleColLogin]:  r.login,
        [S.consoleColScore]:  r.score,
        [S.consoleColVisits]: r.visits,
        [S.consoleColLast]:   formatDate(r.last)
      })));
    },
    reset() {
      visits.map.clear();
      try { localStorage.removeItem(CFG.VISIT_STORAGE_KEY); } catch {}
      roster.clear();
      liveLag.clear();
      console.log(S.consoleHistoryCleared);
    },
    // Chaînes suivies mémorisées par observation de la sidebar (cf. module
    // ROSTER). Rien ne les exploite encore : la liste s'accumule pour être
    // déjà chaude le jour où on décidera de sonder au-delà de ce que Twitch
    // affiche. Renvoie les données brutes.
    roster(limit = Infinity) {
      const entries = roster.entries();
      if (!entries.length) { console.log(S.consoleRosterEmpty); return []; }
      console.log(S.consoleRosterSummary(entries.length));
      console.table(entries.slice(0, limit).map(([login, ts]) => ({
        [S.consoleColLogin]: login,
        [S.consoleColSeen]:  formatDate(ts)
      })));
      return entries;
    },
    // Retard mesuré de Twitch sur les passages en direct (cf. module LIVE
    // LAG) : combien de temps s'écoule entre le démarrage d'un stream et
    // l'apparition de sa carte. C'est ce chiffre — et lui seul — qui dit s'il
    // vaut la peine que l'extension prenne les devants. Renvoie les mesures.
    lag(limit = 25) {
      const samples = liveLag.all();
      if (!samples.length) { console.log(S.consoleLagEmpty); return []; }
      const fmt = (ms) => {
        const s = Math.round(ms / 1000);
        return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`;
      };
      const median = (arr) => {
        const a = arr.slice().sort((x, y) => x - y);
        return a[Math.floor(a.length / 2)];
      };
      const pct = (arr, q) => {
        const a = arr.slice().sort((x, y) => x - y);
        return a[Math.min(a.length - 1, Math.floor(a.length * q))];
      };
      const lags = samples.map(s => s.lag);
      console.log(S.consoleLagSummary(samples.length, fmt(median(lags)), fmt(pct(lags, 0.9))));
      // Avance réellement prise sur Twitch, quand l'extension a posé la carte
      // la première. C'est le chiffre qui dit si la fonctionnalité sert.
      const gains = samples.map(s => s.gain).filter(g => Number.isFinite(g));
      if (gains.length) console.log(S.consoleLagGain(gains.length, fmt(median(gains))));
      console.table(samples.slice(-limit).reverse().map(s => ({
        [S.consoleColLogin]: s.login,
        [S.consoleColLag]:   fmt(s.lag),
        [S.consoleColGain]:  Number.isFinite(s.gain) ? fmt(s.gain) : '—',
        [S.consoleColSeen]:  formatDate(s.ts)
      })));
      return samples;
    },
    // Journal des cycles de voile : à quel instant le voile est monté, pour
    // quelle raison, et ce qui l'a fait retomber. Sert à répondre à une
    // question qu'aucun harnais ne peut trancher — ce que fait VRAIMENT une
    // page Twitch au chargement.
    cycles() {
      const j = loadingOverlay.journal();
      if (!j.length) { console.log('[tse] aucun cycle de voile enregistré.'); return j; }
      console.table(j.map(e => ({ 'ms depuis le chargement': e.t, événement: e.evt, détail: e.detail })));
      return j;
    },
    // Chaînes globales — surface de vérification de la couche de données.
    // Aucune interface ne consomme encore le classement : c'est ici, et
    // seulement ici, qu'on peut l'allumer et le lire. Les colonnes sont des
    // noms de champs, pas des libellés d'interface : rien à localiser.
    //   await tse.global.on()  → active le mode, attend la marche complète
    //   tse.global.top(30)     → classement calculé
    //   tse.global.cats(25)    → catégories classées par l'API
    //   tse.global.report()    → T, complétude, coût, cadence
    //   tse.global.off()       → coupe et purge
    global: {
      on() {
        state.globalMode = true;
        return globalChannels.warm().then(() => globalChannels.report());
      },
      off() {
        state.globalMode = false;
        globalChannels.reset();
        return globalChannels.report();
      },
      top(limit = CFG.GLOBAL_TOP_N) {
        const rows = globalChannels.top(limit).map((r, i) => ({
          rank: i + 1, login: r.login, viewers: r.viewers, game: r.game
        }));
        console.table(rows);
        return rows;
      },
      cats(limit = 25) {
        const rows = globalChannels.cats(limit).map((c, i) => ({
          rank: i + 1, category: c.display, viewers: c.viewers
        }));
        console.table(rows);
        return rows;
      },
      report() {
        const r = globalChannels.report();
        console.table([r]);
        return r;
      }
    },
    // Auto-diagnostic des sélecteurs : rapport complet (toutes les sondes) +
    // verdict. Retourne le rapport brut (programmable).
    diagnose() {
      const report = runDiagnostics();
      logDiagnostics(report);
      const broken = hasCriticalBreakage(report);
      console[broken ? 'warn' : 'log'](broken ? S.consoleHealthBroken : S.consoleHealthAllOk);
      return report;
    }
  };
  // Sous-commande pour accéder aux données brutes (programmable).
  tseApi.scores.raw = () => buildScoresReport();

  // Expose en lecture seule pour éviter qu'un autre script ne l'écrase.
  //
  // Le try/catch n'est pas décoratif : la propriété est posée non
  // configurable, donc une SECONDE exécution du script sur le même document
  // (rechargement de l'extension sur un onglet déjà ouvert, cohabitation avec
  // le userscript dont ce portage est issu) lève une TypeError. Sans garde,
  // elle interromprait l'IIFE AVANT l'appel à boot() en fin de fichier :
  // l'extension entière resterait inerte, sans le moindre message.
  try {
    Object.defineProperty(window, 'tse', {
      value: Object.freeze(tseApi),
      writable: false,
      configurable: false
    });
  } catch {
    // Déjà posé par une exécution précédente — on garde l'objet en place et
    // on poursuit le démarrage normalement.
  }

  /* ============================================================
   *  CARD HELPERS
   * ============================================================ */
  const liveStatusOf = (card) =>
    card.querySelector('.side-nav-card__live-status') ||
    card.querySelector('[data-a-target="side-nav-live-status"]')?.closest('div');

  const avatarOf = (card) =>
    card.querySelector('.side-nav-card__avatar figure') ||
    card.querySelector('.side-nav-card__avatar .tw-avatar') ||
    card.querySelector('figure.tw-avatar') ||
    card.querySelector('.tw-avatar') ||
    card.querySelector('img.tw-image-avatar')?.closest('figure, .tw-avatar, div');

  const cardCategoryEl = (card) =>
    card.querySelector('.side-nav-card__metadata p[title]') ||
    card.querySelector('[data-a-target="side-nav-card-metadata"] p[title]') ||
    // Cartes sponsorisées "promoted-followed" : la catégorie est dans
    // .side-nav-promoted-followed-card__content (classe STABLE), hors de
    // la metadata normale. Sans ce repli, le stream sponsorisé n'a pas de
    // data-tse-category et échappe aux filtres catégorie/langue.
    card.querySelector('[class*="promoted-followed-card__content"] p[title]') ||
    card.querySelector('[class*="promoted-followed-card__content"] p') ||
    card.querySelector('.side-nav-card__metadata p');

  const getCardCategory = (card) => {
    const el = cardCategoryEl(card);
    if (!el) return null;
    return (el.getAttribute('title') || el.textContent || '').trim() || null;
  };

  /**
   * Écrit la catégorie fraîche (issue de TseChannels) dans la carte, quand elle
   * diffère de celle affichée par Twitch.
   *
   * Contrairement au compteur de viewers, on écrit ici DANS l'élément de
   * Twitch plutôt que d'en superposer un à nous : cette ligne porte l'ellipsis
   * et l'infobulle natives, coûteuses à reproduire fidèlement, et la catégorie
   * change bien trop rarement pour justifier ce coût.
   *
   * Écrire dans un nœud rendu par React demande une garantie de convergence :
   *   - on n'écrit QUE si la valeur diffère, donc un état déjà correct ne
   *     produit aucune mutation (pas de boucle scan → écriture → scan) ;
   *   - si React re-rend et réimpose son ancienne valeur, sa propre mutation
   *     déclenche un scan qui ré-applique la nôtre, en une passe.
   * Dans les deux sens, la séquence se termine.
   */
  const renderCategory = (card, name, login) => {
    if (!name) return;
    const el = cardCategoryEl(card);
    if (!el) return;
    const cur = (el.getAttribute('title') || el.textContent || '').trim();
    // Garde-fou contre le seul échec vraiment coûteux : ne JAMAIS écrire dans
    // l'élément qui porte le nom de la chaîne. Si un remaniement du markup
    // Twitch faisait pointer cardCategoryEl() sur le titre de la carte, on
    // remplacerait le pseudo de chaque streamer par sa catégorie — panne très
    // visible et déroutante. Le test ne coûte rien : dans ce cas on renonce
    // simplement à écrire, et data-tse-category (donc les filtres) continue de
    // fonctionner sur la valeur de l'API.
    if (login && cur.toLowerCase() === login) return;
    // L'attribut title ne porte que la catégorie : on peut le rafraîchir sans
    // risque, et c'est lui que getCardCategory lit en premier.
    if (el.hasAttribute('title') && (el.getAttribute('title') || '').trim() !== name) {
      el.setAttribute('title', name);
    }
    // Le TEXTE, lui, peut transporter davantage : Twitch y accole le « +N »
    // des collaborations, que la pastille collab lit juste après. Le réécrire
    // avec la seule catégorie effacerait cette information et ferait
    // disparaître le badge. On s'abstient donc dès qu'un « +N » est présent —
    // la catégorie fraîche reste portée par le title et par data-tse-category,
    // dont dépendent les filtres.
    if (PLUS_RE_PRESENT.test(el.textContent || '')) return;
    if ((el.textContent || '').trim() !== name) setText(el, name);
  };

  /* Détecteur pur de l'état réduit de la sidebar. Source de vérité unique,
     réutilisée par refreshSidebarCollapsed (cache par scan) et par le
     détecteur de transition réduit↔étendu (cf. startObserver). */
  const detectSidebarCollapsed = () => !!document.querySelector(
    '.side-nav--collapsed, [data-a-target="side-nav-bar-collapsed"]'
  );

  /* État réduit/étendu de la sidebar, recalculé une fois par scan (et non
     par carte) pour éviter ~100 querySelector inutiles. En mode réduit,
     Twitch ne rend que l'avatar des cartes : ni l'indicateur de live
     (.tw-channel-status-indicator), ni le libellé "Déconnecté(e)", ni les
     métadonnées de catégorie ne sont présents. Les détections qui en
     dépendent adaptent donc leur logique (isCardOffline, applyCardVisibility,
     updateSectionsVisibility). Rafraîchi en tête de scanSidebar. */
  let sidebarCollapsed = false;
  const refreshSidebarCollapsed = () => { sidebarCollapsed = detectSidebarCollapsed(); };

  const isCardOffline = (card) => {
    // 1) Libellé explicite "Déconnecté(e)/offline" — présent en mode étendu.
    if (DOM.offlineRe.test(card.textContent || '')) return true;
    // 2) Avatar grisé : signal hors-ligne FIABLE en mode étendu ET réduit
    //    (Twitch pose --offline sur l'avatar des chaînes hors-ligne dans les
    //    deux états d'affichage).
    if (card.querySelector('.side-nav-card__avatar--offline')) return true;
    // 3) En mode réduit, l'indicateur de live n'est jamais rendu (cartes
    //    réduites au seul avatar). S'y fier classerait TOUTES les cartes
    //    comme offline → sidebar vide. Les signaux fiables en mode réduit
    //    sont (1) et (2) ; à défaut, la carte est considérée live.
    if (sidebarCollapsed) return false;
    // 4) Mode étendu : l'absence d'indicateur de live confirme le hors-ligne.
    return !card.querySelector(DOM.liveIndicator);
  };

  const updateFreshness = (card) => {
    const ts = card.dataset.tseStartedAt;
    if (!ts) { card.classList.remove('tse-fresh'); return; }
    const ageMin = (Date.now() - new Date(ts).getTime()) / 60_000;
    card.classList.toggle('tse-fresh', ageMin >= 0 && ageMin < CFG.FRESH_MAX_MIN);
  };

  /**
   * Visibilité par carte (filtres catégorie ET langue, sur "Chaînes suivies"
   * uniquement). Le hors-ligne est géré par CSS via [data-tse-offline].
   *
   * Le court-circuit "aucun filtre actif" évite un card.closest() coûteux
   * dans le cas le plus fréquent. Appelée sur ~100 cartes par scan.
   */
  const applyCardVisibility = (card) => {
    if (card.dataset.tseOffline === 'true') {
      card.style.display = '';
      return;
    }
    const catFilter  = state.categoryFilter;
    const langFilter = state.languageFilter;
    if (!catFilter && !langFilter) {
      card.style.display = '';
      return;
    }
    // En mode réduit, ni la catégorie ni la langue ne sont exploitables
    // (avatar seul) et les UIs de filtre sont masquées : on neutralise les
    // filtres pour ne pas masquer à tort toutes les cartes de la section.
    if (sidebarCollapsed) {
      card.style.display = '';
      return;
    }
    // Filtres actifs : seules les cartes de la section followed sont concernées.
    // Détection INDÉPENDANTE DE LA LANGUE : les cartes suivies portent
    // data-test-selector="followed-channel" (recommandées : un autre marqueur).
    const inFollowed = !!card.querySelector(DOM.followedCardSelector);
    if (!inFollowed) {
      card.style.display = '';
      return;
    }
    let visible = true;
    if (catFilter && card.dataset.tseCategory !== catFilter) {
      visible = false;
    }
    if (visible && langFilter) {
      // tseLangs = "|Français|English|" (délimité), ou undefined si la langue
      // n'est pas encore résolue. Dans ce dernier cas on NE masque PAS (évite
      // un clignotement au démarrage) ; le scan suivant filtrera une fois la
      // donnée arrivée.
      const langs = card.dataset.tseLangs;
      if (langs !== undefined && !langs.includes('|' + langFilter + '|')) {
        visible = false;
      }
    }
    card.style.display = visible ? '' : 'none';
  };

  /* ============================================================
   *  PASTILLE COLLAB
   * ============================================================ */
  const PLUS_RE_ELEMENT  = /^\+\s*(\d+)$/;
  const PLUS_RE_TRAILING = /(\s+)\+\s*(\d+)\s*$/;
  // Condition NÉCESSAIRE aux deux recherches ci-dessous : l'une comme l'autre
  // exigent un « + » suivi (éventuellement après des espaces) d'un chiffre.
  const PLUS_RE_PRESENT  = /\+\s*\d/;

  // Retire le badge laissé par un scan précédent. Extrait pour être appelé
  // depuis les deux sorties « aucun collab détecté ».
  const clearCollabBadge = (card) => {
    const avatar = avatarOf(card);
    if (!avatar) return;
    avatar.querySelector(':scope > .tse-collab-badge')?.remove();
    avatar.classList.remove('tse-collab-host');
  };

  const applyCollabBadge = (card) => {
    // Pré-filtre. Sans lui, chaque carte de la sidebar était parcourue par un
    // TreeWalker qui rappelle du JS sur CHAQUE nœud, à chaque scan — de loin
    // le poste de calcul le plus lourd de l'extension au profilage (un quart
    // de son temps propre). Le cas courant est l'absence de collab : un test
    // de regex sur le texte de la carte le tranche sans rien parcourir.
    //
    // L'équivalence est stricte : quand ce test échoue, aucune des deux
    // recherches ne pouvait aboutir, donc l'ancien code atteignait la même
    // branche de nettoyage.
    if (!PLUS_RE_PRESENT.test(card.textContent || '')) { clearCollabBadge(card); return; }

    let count = null;
    let plusEl = null;
    let textHit = null;

    const elWalker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (el) => {
        if (el.classList.contains('tse-collab-badge')) return NodeFilter.FILTER_REJECT;
        if (el.children.length > 0) return NodeFilter.FILTER_SKIP;
        const m = PLUS_RE_ELEMENT.exec((el.textContent || '').trim());
        if (m) { count = m[1]; return NodeFilter.FILTER_ACCEPT; }
        return NodeFilter.FILTER_SKIP;
      }
    });
    plusEl = elWalker.nextNode();

    if (!plusEl) {
      const txtWalker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const m = PLUS_RE_TRAILING.exec(node.nodeValue || '');
          if (m) { count = m[2]; textHit = { node, match: m }; return NodeFilter.FILTER_ACCEPT; }
          return NodeFilter.FILTER_REJECT;
        }
      });
      txtWalker.nextNode();
    }

    if (count === null) {
      // Plus de collab détecté : nettoyer un éventuel badge laissé par un
      // scan précédent (cas où Twitch met à jour la carte pour retirer le
      // "+N" sans détruire la carte). Sinon le badge resterait collé avec
      // sa valeur obsolète.
      clearCollabBadge(card);
      return;
    }

    const avatar = avatarOf(card);
    if (!avatar) return;

    avatar.classList.add('tse-collab-host');
    let badge = avatar.querySelector(':scope > .tse-collab-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tse-collab-badge';
      avatar.appendChild(badge);
    }
    setText(badge, count);

    if (plusEl) {
      plusEl.style.display = 'none';
    } else if (textHit) {
      const { node, match } = textHit;
      node.nodeValue = node.nodeValue.slice(0, node.nodeValue.length - match[0].length);
    }
  };

  /* ============================================================
   *  UPTIME
   * ============================================================ */
  const ensureUptimeSpan = (card) => {
    const host = liveStatusOf(card);
    if (!host) return null;
    let span = host.querySelector(':scope > .tse-uptime');
    if (!span) {
      span = document.createElement('span');
      span.className = 'tse-uptime';
      host.appendChild(span);
    }
    return span;
  };

  const renderUptime = (card, createdAt) => {
    const span = ensureUptimeSpan(card);
    if (!span) return;
    delete span.dataset.tseEnded;
    setText(span, formatUptime(createdAt));
  };

  // Le stream a pris fin : on ne supprime PAS le label, on le mute en
  // "Terminé" pour signaler visuellement l'état avant que Twitch ne
  // retire la carte de la sidebar.
  const removeUptime = (card) => {
    delete card.dataset.tseStartedAt;
    card.classList.remove('tse-fresh');
    const span = ensureUptimeSpan(card);
    if (!span) return;
    span.dataset.tseEnded = 'true';
    setText(span, S.uiUptimeEnded);
  };

  const refreshUptime = (card) => {
    const ts = card.dataset.tseStartedAt;
    if (!ts) return;
    const span = card.querySelector('.tse-uptime');
    if (!span || span.dataset.tseEnded === 'true') return;
    setText(span, formatUptime(ts));
  };

  /* ============================================================
   *  VIEWERS
   *  -------------------------------------------------------------
   *  Le compteur natif de Twitch n'est réécrit que lorsque Twitch
   *  re-rend sa sidebar — c'est-à-dire rarement. On affiche donc le
   *  nôtre, alimenté par TseChannels toutes les LIVE_TTL.
   *
   *  Placement : un <span> inséré JUSTE APRÈS l'élément natif, dans le
   *  même parent. Il hérite ainsi de la même position dans le flux flex
   *  (aucune règle de mise en page à reproduire), et le natif n'est
   *  masqué — par CSS, via [data-tse-viewers] sur la carte — qu'une
   *  fois le nôtre porteur d'une valeur. Aucune carte ne se retrouve
   *  donc sans compteur pendant la résolution, et les cartes hors
   *  section « suivis » gardent le compteur de Twitch si jamais leur
   *  requête n'aboutit pas.
   *
   *  aria-hidden="true" sur notre span, comme sur le natif : la valeur
   *  lue par les lecteurs d'écran reste celle du libellé accessible de
   *  Twitch, on ne duplique pas l'information.
   * ============================================================ */

  // Élément natif portant le nombre. Le :not(.tse-viewers) garantit qu'on ne
  // se sélectionne jamais soi-même (notre span porte le même aria-hidden).
  const nativeViewersEl = (card) =>
    card.querySelector('.side-nav-card__live-status [aria-hidden="true"]:not(.tse-viewers)') ||
    card.querySelector('[data-a-target="side-nav-live-status"] [aria-hidden="true"]:not(.tse-viewers)');

  // Formateurs mémoïsés par locale : Intl.NumberFormat est coûteux à
  // construire et on formate ~100 cartes à chaque cycle.
  const viewerFormatters = new Map();
  const viewerFormatter = () => {
    const key = `${S.locale}|${LANG}`;
    let f = viewerFormatters.get(key);
    if (!f) {
      // Rendu aligné sur celui de Twitch, locale par locale (formats vérifiés
      // sur DOM réel, cf. le commentaire de parseViewerCount) :
      //   de → nombre PLEIN à séparateur de milliers (« 29.339 ») ;
      //   fr/en/es/pt → abréviation à une décimale (« 67,3 k », « 67.3K »,
      //   « 3,7 mil »), ce que produit exactement la notation compacte.
      const opts = LANG === 'de'
        ? {}
        : { notation: 'compact', maximumFractionDigits: 1 };
      try { f = new Intl.NumberFormat(S.locale, opts); }
      catch { f = new Intl.NumberFormat(undefined, opts); }
      viewerFormatters.set(key, f);
    }
    return f;
  };

  const formatViewers = (n) => viewerFormatter().format(n);

  // `count`   : viewers PROPRES à la chaîne — valeur exacte, mémorisée en
  //             dataset, utilisée pour trier et sommer.
  // `display` : nombre à AFFICHER s'il diffère. Sur un co-stream "Streamer
  //             ensemble", Twitch montre le compteur COMBINÉ de la session et
  //             non celui du streamer : afficher `count` afficherait 1,2 k là
  //             où Twitch affiche 11,8 k.
  //
  // C'est la valeur AFFICHÉE qui est mémorisée en dataset, donc celle sur
  // laquelle on trie. Trier sur un nombre différent de celui qu'on montre
  // produit une liste que l'œil juge cassée : deux co-streamers marqués
  // « 11,5 k » se retrouvaient l'un en haut du classement et l'autre au milieu
  // des « 1,7 k », chacun rangé selon son audience propre. Le tri suit donc ce
  // que l'utilisateur lit — comme le fait Twitch lui-même.
  const renderViewers = (card, count, display) => {
    if (!Number.isFinite(count)) return;
    const native = nativeViewersEl(card);
    const host = native?.parentElement;
    if (!host) return;
    let span = host.querySelector(':scope > .tse-viewers');
    if (!span) {
      span = document.createElement('span');
      span.className = 'tse-viewers';
      span.setAttribute('aria-hidden', 'true');
      native.insertAdjacentElement('afterend', span);
    }
    const shown = Number.isFinite(display) ? display : count;
    setText(span, formatViewers(shown));
    // Pose le marqueur qui masque le compteur natif (cf. CSS). Fait seulement
    // maintenant : tant qu'on n'a pas de valeur, celui de Twitch reste visible.
    if (card.dataset.tseViewers !== String(shown)) {
      card.dataset.tseViewers = String(shown);
    }
  };

  // Retire notre compteur et rend la main au natif (chaîne hors ligne, ou
  // carte recyclée par React sur une autre chaîne).
  const removeViewers = (card) => {
    delete card.dataset.tseViewers;
    card.querySelector('.tse-viewers')?.remove();
  };

  // Texte AFFICHÉ du compteur : le nôtre s'il existe, sinon celui de Twitch.
  // Utilisé par l'heuristique co-stream, qui compare des valeurs ARRONDIES
  // (deux co-streamers partagent un compteur combiné) — d'où la lecture du
  // texte rendu, et non du nombre exact.
  const getCardViewersText = (card) => {
    const own = card.querySelector('.tse-viewers');
    const el = own || nativeViewersEl(card);
    if (!el) return null;
    return (el.textContent || '').replace(/\s+/g, ' ').trim() || null;
  };

  // Nombre de viewers comparable — celui que la carte AFFICHE (donc le compteur
  // combiné sur un co-stream, cf. renderViewers). Valeur exacte issue de
  // TseChannels dès qu'elle est connue ; repli sur l'analyse du texte natif tant
  // qu'elle ne l'est pas (premier rendu, sections hors « suivis », requête en
  // vol).
  const getCardViewers = (card) => {
    const n = parseInt(card.dataset.tseViewers, 10);
    if (Number.isFinite(n)) return n;
    return parseViewerCount(getCardViewersText(card));
  };

  /* ============================================================
   *  PROCESSING D'UNE CARTE
   * ============================================================ */
  /**
   * Marque les "lignes annexes" injectées par Twitch dans une carte
   * (hype train, réduction d'abonnement, etc.) pour qu'elles soient
   * masquées via CSS [data-tse-extra-row], et collecte leur contenu
   * dans dataset.tseExtraRows (JSON) pour l'aperçu au survol.
   *
   * Structure DOM réelle d'une carte avec ligne annexe :
   *   <a class="side-nav-card__link">
   *     <div>avatar</div>
   *     <div class="bLlihH">              ← bloc principal (englobe TOUT le texte)
   *       <div class="dJfBsr">            ← sous-cellule métadonnées + live-status
   *         <div data-a-target="side-nav-card-metadata">…</div>
   *         <div class="cXMAQb">live-status</div>
   *       </div>
   *       <div class="dKitkM">            ← LIGNE ANNEXE (Réduction, Hype train, etc.)
   *         <div role="img">…</div>
   *         <p>Réduction • Se termine dans 5h</p>
   *       </div>
   *     </div>
   *     <div class="dJfBsr">tooltip-arrow</div>
   *   </a>
   *
   * Stratégie : on identifie le bloc principal comme l'enfant direct du <a>
   * qui CONTIENT [data-a-target="side-nav-card-metadata"]. À l'intérieur de
   * ce bloc, on identifie la sous-cellule qui CONTIENT directement le
   * metadata, puis on marque tous ses frères SUIVANTS comme lignes annexes.
   *
   * Classification du type d'une ligne annexe (pour le badge coloré du
   * popup d'aperçu) :
   *   - "hype"     : descendant avec une classe contenant "hype-train"
   *   - "discount" : descendant avec aria-label "Abonnement-cadeau"
   *   - "other"    : tout autre badge non identifié
   */
  const markExtraRows = (card) => {
    const link = card.querySelector('a.side-nav-card__link, a[data-a-target="side-nav-card"]');
    if (!link) return;

    // 1) Localiser le bloc principal (enfant direct du <a> qui contient le metadata)
    const metadata = link.querySelector(':scope > * [data-a-target="side-nav-card-metadata"]');
    if (!metadata) return;
    const mainBlock = [...link.children].find(c => c.contains(metadata));
    if (!mainBlock) return;

    // 2) Trouver la sous-cellule (enfant direct du bloc principal) qui contient
    //    le metadata, puis marquer tous ses frères suivants.
    const metadataCell = [...mainBlock.children].find(c => c.contains(metadata));
    if (!metadataCell) return;

    const collected = [];
    let after = false;
    for (const child of mainBlock.children) {
      if (!after) {
        if (child === metadataCell) after = true;
        continue;
      }
      // À ce stade, child est un frère suivant le metadataCell.
      // Par sécurité, on garde tout ce qui contiendrait un tooltip-arrow
      // (n'arrive pas dans la structure actuelle mais robustesse future).
      if (child.querySelector?.('.side-nav-card__link__tooltip-arrow')) {
        if (child.dataset.tseExtraRow) delete child.dataset.tseExtraRow;
        continue;
      }
      if (child.dataset.tseExtraRow !== 'true') {
        child.dataset.tseExtraRow = 'true';
      }
      // Extraction du texte + classification pour le popup d'aperçu.
      const p = child.querySelector('p');
      const text = (p?.getAttribute('title') || p?.textContent || '').trim();
      if (!text) continue;
      let type = 'other';
      if (child.querySelector('[class*="hype-train" i]')) type = 'hype';
      else if (child.querySelector(DOM.discountSelector)) type = 'discount';
      collected.push({ type, text });
    }

    if (collected.length) {
      card.dataset.tseExtraRows = JSON.stringify(collected);
    } else {
      delete card.dataset.tseExtraRows;
    }
  };

  /* ============================================================
   *  APERÇU AU SURVOL
   *  -------------------------------------------------------------
   *  Affiche un popup avec aperçu vidéo live + titre + badges au
   *  survol d'une carte de la sidebar, toutes sections confondues
   *  (Chaînes suivies, Chaînes live recommandées, Spectateurs de X
   *  regardent aussi).
   *
   *  Le login d'une carte est lu depuis dataset.tseLogin (posé par
   *  processCard qui tourne sur TOUTES les cartes de la sidebar).
   *  Fallback via le href du lien si dataset.tseLogin n'est pas
   *  encore posé (timing au tout premier survol, avant que le
   *  scan initial n'ait traité la carte).
   *
   *  Les badges affichés dans le popup :
   *   - hype train / réduction : depuis dataset.tseExtraRows posé
   *     par markExtraRows pour TOUTES les cartes
   *   - co-stream : DEUX sources exclusives, par ordre de priorité :
   *       1) Source DOM Twitch (getCostreamInfo) : détecte le rôle de la
   *          carte via les marqueurs iconContainer--primary (participant)
   *          ou iconContainer--secondary (hôte). Pour un participant,
   *          extrait aussi le login de l'hôte depuis l'alt du mini-avatar
   *          metadata. Fiable, disponible sur toutes les sections.
   *       2) Fallback heuristique (getCostreamMates) : groupes détectés
   *          par detectCoStreams (catégorie + viewers identiques),
   *          uniquement dans "Chaînes suivies". Sert de filet de sécurité
   *          si Twitch ne marque pas la carte.
   *   - "En live avec" (squad / multistream Twitch) : depuis getSquadInfo.
   *     Système Twitch distinct du co-stream — peut cohabiter en théorie.
   *     Twitch n'expose qu'UN seul invité dans le DOM ; pour les groupes
   *     > 2 personnes, on affiche cet invité + un compteur des autres
   *     (lu depuis la phrase d'accessibilité "X et N invités").
   *   - sponsor : depuis getSponsorInfo. Les cartes "promoted-followed"
   *     (sponsorisées) sont normalisées visuellement dans la sidebar
   *     (cf. règles CSS dédiées) ; l'info sponso est restituée dans le
   *     popup avec le logo coloré de la marque + le nom.
   *
   *  Stratégie en deux temps pour le visuel :
   *   1) Affichage immédiat d'un thumbnail JPEG (CDN Twitch). Pas
   *      de latence visuelle, l'utilisateur voit quelque chose tout
   *      de suite.
   *   2) Après PREVIEW_IFRAME_DELAY (~150 ms), bascule vers un
   *      <iframe src="player.twitch.tv/?…"> qui diffuse le live.
   *      Le délai évite de spawner des iframes (~5-10 MB chacun)
   *      si l'utilisateur balaie plusieurs cartes rapidement.
   *
   *  Contournement des pubs : on dépend de la présence d'un script
   *  externe (vaft / TwitchAdSolutions) qui intercepte les requêtes
   *  PlaybackAccessToken sur le domaine twitch.tv. Notre iframe est
   *  servi par player.twitch.tv (sous-domaine de twitch.tv) donc
   *  bénéficie automatiquement du bypass si vaft est installé. Si
   *  vaft n'est pas installé, l'utilisateur verra parfois une pub
   *  préroll de quelques secondes — pas idéal mais acceptable.
   *
   *  Streams avec Content Classification Label (mature/gambling/…) :
   *  le player Twitch afficherait son interstitielle "Commencer à
   *  regarder" qu'on ne peut pas fermer (iframe cross-origin). Pour
   *  ces streams, on ne bascule pas vers l'iframe et on garde le
   *  JPEG statique (cf. fetchPreviewMeta + branchement dans open).
   *
   *  Le titre du stream n'est pas dans la query UseLive du batch
   *  uptime. On fait une mini-query séparée (cache court 60s) qui
   *  ne se déclenche qu'à l'ouverture du popup.
   * ============================================================ */
  // Purge un cache Map de données RECONSTRUCTIBLES : évince les entrées dont
  // le champ `ts` dépasse maxAgeMs, puis borne la taille à maxSize (FIFO sur
  // l'ordre d'insertion de Map). Évincer n'a aucun effet fonctionnel : la
  // donnée sera simplement re-fetchée à la prochaine demande.
  const pruneCache = (map, maxAgeMs, maxSize) => {
    const now = Date.now();
    for (const [k, v] of map) {
      if (v && typeof v.ts === 'number' && now - v.ts > maxAgeMs) map.delete(k);
    }
    let over = map.size - maxSize;
    if (over > 0) {
      for (const k of map.keys()) {
        map.delete(k);
        if (--over <= 0) break;
      }
    }
  };

  // URL du JPEG statique servi par le CDN Twitch (affichage immédiat
  // avant que l'iframe player ne soit prête).
  //
  // Le paramètre de fin sert à contourner le cache : sans lui, le navigateur
  // resservirait indéfiniment une image que Twitch régénère toutes les
  // quelques minutes. Mais il était horodaté à la MILLISECONDE, ce qui
  // rendait chaque URL unique — donc chaque survol un échec de cache garanti,
  // y compris en revenant sur la même chaîne deux secondes plus tard. D'où le
  // fond noir de une à deux secondes, le temps du téléchargement.
  //
  // On l'arrondit désormais à une tranche : l'URL est stable pendant toute la
  // tranche, donc un re-survol tape le cache et s'affiche instantanément. La
  // vignette peut être vieille d'une minute — sans importance pour une image
  // affichée une seconde avant de céder la place à la vidéo en direct.
  const buildThumbUrl = (login) =>
    `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}` +
    `-${CFG.PREVIEW_THUMB_CDN_W}x${CFG.PREVIEW_THUMB_CDN_H}.jpg` +
    `?_=${Math.floor(Date.now() / CFG.PREVIEW_THUMB_CACHE_MS)}`;

  /* ============================================================
   *  PRÉCHARGEMENT DES MINIATURES
   *  -------------------------------------------------------------
   *  Mesuré : la miniature d'une chaîne jamais survolée met de 89 ms à
   *  1,8 s à arriver — un facteur 20, propriété du CDN de Twitch pour
   *  cette chaîne à cet instant, sur lequel on n'a aucun levier. Une
   *  fois en cache navigateur, le même survol coûte ~40 ms.
   *
   *  On réchauffe donc à l'avance, PENDANT LES PÉRIODES CALMES. La règle
   *  est inversée par rapport à l'intuition : on ne précharge PAS quand
   *  le pointeur entre dans la sidebar — entrer dans la sidebar, c'est
   *  atterrir sur une carte, donc ouvrir un aperçu, donc le moment où le
   *  réseau est le plus sollicité. On précharge quand le pointeur est
   *  AILLEURS, et la passe est terminée bien avant le retour.
   *
   *  Cadencé sur la TRANCHE de cache des miniatures, pas sur une période :
   *  l'URL vaut Math.floor(now / PREVIEW_THUMB_CACHE_MS), donc un minuteur
   *  libre tomberait à un décalage arbitraire de la frontière et jetterait
   *  en moyenne la moitié de son travail. Même piège que REFRESH_TICK
   *  aligné sur LIVE_TTL, documenté plus haut.
   *
   *  Garantie tenue : un survol n'est JAMAIS plus lent qu'avant. Soit la
   *  miniature est déjà là, soit sa requête est en vol et l'<img> du popup
   *  s'y raccroche (même URL, le navigateur ne la double pas), soit elle
   *  n'a jamais été demandée et c'est le chemin d'aujourd'hui — à priorité
   *  normale, donc devant tout résidu de passe, qui est en priorité basse.
   * ============================================================ */
  const thumbPreload = (() => {
    const done = new Set();   // logins déjà servis DANS LA TRANCHE COURANTE
    let bucket = null;        // tranche à laquelle `done` se rapporte
    let inFlight = 0;

    const currentBucket = () => Math.floor(Date.now() / CFG.PREVIEW_THUMB_CACHE_MS);

    // Le registre ne vaut que pour SA tranche. Au changement, tout ce qu'il
    // mémorise porte une URL désormais morte, et il empêcherait de repartir.
    // Le vider est donc à la fois la correction et la purge : c'est ce qui le
    // borne en mémoire.
    const sync = () => {
      const b = currentBucket();
      if (b !== bucket) { bucket = b; done.clear(); }
      return b;
    };

    // Pointeur au-dessus de la sidebar. Lu à la demande via :hover plutôt que
    // suivi par des écouteurs : la question n'est posée qu'au réveil et entre
    // deux préchargements — inutile d'observer chaque mouvement de souris.
    const sidebarHovered = () => {
      try {
        const root = document.querySelector(DOM.sidebarRoot);
        return !!root && root.matches(':hover');
      } catch { return false; }
    };

    const saveData = () => {
      try { return !!navigator.connection?.saveData; } catch { return false; }
    };

    const blocked = () => document.hidden || sidebarHovered() || saveData();

    // Chaînes à réchauffer, DANS L'ORDRE D'AFFICHAGE : on entre dans la sidebar
    // par le haut, donc les premières servies sont les plus probables. La liste
    // est reconstruite à chaque passage, ce qui fait sortir d'elle-même une
    // chaîne qui vient de couper et entrer une qui vient de démarrer.
    const candidates = () => {
      const root = document.querySelector(DOM.sidebarRoot);
      if (!root) return [];
      const out = [];
      const seen = new Set();
      for (const card of root.querySelectorAll('.side-nav-card')) {
        const login = card.dataset.tseLogin;
        if (!login || seen.has(login) || done.has(login)) continue;
        // Hors direct, il n'y a pas de miniature : l'URL répondrait 404. Deux
        // signaux, dans cet ordre : le verdict de l'API quand on l'a, le DOM
        // sinon. S'appuyer sur le cache SEUL exclurait les sections « Chaînes
        // live » et « Les spectateurs de… », que le scan n'interroge jamais —
        // or ce sont des cartes survolables comme les autres.
        if (card.dataset.tseOffline === 'true') continue;
        if (isCardOffline(card)) continue;
        seen.add(login);
        out.push(login);
        if (out.length >= CFG.PREVIEW_PRELOAD_MAX) break;
      }
      return out;
    };

    const fetchOne = (login) => {
      // Marqué AVANT la requête : un échec ne doit pas être réessayé en boucle
      // dans la même tranche.
      done.add(login);
      inFlight++;
      // AUCUNE référence n'est conservée sur l'Image, et c'est délibéré. Une
      // miniature 480x270 pèse ~25 Ko encodée mais ~506 Ko DÉCODÉE (129 600
      // pixels x 4 octets) : garder cent objets épinglerait ~50 Mo de bitmaps
      // pour des images qu'on n'affiche même pas. En la relâchant, le
      // navigateur garde les octets encodés dans son cache HTTP — ce qu'on
      // veut — et libère le décodé au ramasse-miettes.
      // createElement plutôt que new Image() : strictement équivalent, et
      // cohérent avec le reste du fichier.
      const img = document.createElement('img');
      try { img.fetchPriority = 'low'; } catch { /* attribut non géré */ }
      const finish = () => { inFlight--; pump(); };
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
      img.src = buildThumbUrl(login);
    };

    function pump() {
      const b = sync();
      if (blocked()) return;
      const queue = candidates();
      let i = 0;
      while (inFlight < CFG.PREVIEW_PRELOAD_CONCURRENCY && i < queue.length) {
        // Réévalué à CHAQUE émission : entrer dans la sidebar ou changer de
        // tranche doit arrêter la passe tout de suite. On cesse d'ÉMETTRE ;
        // on n'annule jamais ce qui est en vol — la requête coupée pourrait
        // être précisément celle que l'utilisateur vient de survoler, et le
        // popup la relancerait de zéro.
        if (blocked() || currentBucket() !== b) return;
        fetchOne(queue[i++]);
      }
    }

    return {
      // Appelé par le réveil de rafraîchissement. Reprend là où la passe s'est
      // arrêtée : `done` sert aussi de point de reprise.
      tick() { if (CFG.PREVIEW_PRELOAD_ENABLED) pump(); },
      // Une chaîne survolée est chargée par le popup de toute façon : inutile
      // que la passe la redemande ensuite.
      markDone(login) { if (login) { sync(); done.add(login); } }
    };
  })();

  const preview = (() => {
    let el = null;             // élément popup (singleton)
    let iframeTimer = null;    // setTimeout avant injection de l'iframe
    let iframeLoadTimer = null;// timeout de chargement de l'iframe
    let revealTimer = null;    // filet si le signal de première image n'arrive pas
    let revealCleanup = null;  // retire l'écouteur postMessage de l'iframe en cours
    let flagRemoveTimer = null;// retrait différé du flag body.tse-preview-active
    let currentLogin = null;   // login affiché actuellement (anti-race)
    let currentCard = null;    // carte sous laquelle on est ancré

    // Cache court des métadonnées par login. Évite les doubles requêtes
    // si l'utilisateur survole 2 fois la même carte rapidement.
    // Deux formes d'entrée possibles :
    //   { title, hasCCL, ts }  → stream live
    //   { offline: true, ts }  → stream confirmé offline par GraphQL
    const metaCache = new Map();
    const META_TTL = 60_000;

    const PREVIEW_QUERY =
      'query TsePreview($channelLogin: String!) {' +
      '  user(login: $channelLogin) {' +
      '    id' +
      '    stream {' +
      '      id title' +
      '      contentClassificationLabels { id }' +
      '      costreamDetails { organizer { id login displayName } }' +
      '    }' +
      '  }' +
      '}';

    // Récupère titre + état CCL (Content Classification Label) d'un stream.
    // Le CCL détermine si Twitch affiche son interstitielle "Commencer à
    // regarder" au démarrage du player. Comme on ne peut pas la fermer
    // (iframe cross-origin), on s'en sert pour décider de ne PAS injecter
    // l'iframe player et de rester sur le JPEG statique.
    //
    // Retourne :
    //   { title, hasCCL }       → stream live, données extraites
    //   { offline: true }       → stream confirmé OFFLINE par GQL (stream=null)
    //                             Permet à open() de corriger l'état de la
    //                             carte sans attendre l'expiration de son
    //                             entrée de cache (cf. LIVE_TTL).
    //   null                    → impossible de savoir (erreur réseau, throttle)
    const fetchPreviewMeta = async (login) => {
      const hit = metaCache.get(login);
      if (hit && Date.now() - hit.ts < META_TTL) {
        if (hit.offline) return { offline: true };
        return { title: hit.title, hasCCL: hit.hasCCL, id: hit.id, costreamOrganizer: hit.costreamOrganizer };
      }
      const res = await post([{
        operationName: 'TsePreview',
        variables: { channelLogin: login },
        query: PREVIEW_QUERY
      }]);
      if (isResultsUnusable(res)) return null;
      const user = res?.[0]?.data?.user;
      const stream = user?.stream;
      if (!stream) {
        // Stream confirmé offline par GraphQL. On cache cette info comme
        // les autres (avec TTL court) pour cohérence.
        metaCache.set(login, { offline: true, ts: Date.now() });
        return { offline: true };
      }
      const title = stream.title || null;
      const labels = stream.contentClassificationLabels;
      const hasCCL = Array.isArray(labels) && labels.length > 0;
      // id : sert à demander la session Guest Star à la volée (badge "En live
      // avec") pour les sections hors "suivis", où le scan ne le fait pas.
      const id = user?.id ?? null;
      // organizer du co-stream d'ÉVÉNEMENT (costreamDetails) : source fiable et
      // indépendante du mode (réduit/étendu) pour le badge "Co-stream de X".
      // En mode réduit, le DOM ne porte pas l'avatar/alt de l'hôte → on s'appuie
      // dessus pour compléter le badge (cf. updateCostreamBadge).
      const org = stream.costreamDetails?.organizer;
      const costreamOrganizer = org && org.id
        ? { id: org.id, login: (org.login || '').toLowerCase(), name: (org.displayName || '').trim() || null }
        : null;
      metaCache.set(login, { title, hasCCL, id, costreamOrganizer, ts: Date.now() });
      return { title, hasCCL, id, costreamOrganizer };
    };

    // URL du player iframe. parent=twitch.tv est requis par Twitch pour
    // l'embed (on est servi depuis twitch.tv donc OK). muted=true est
    // obligatoire pour permettre l'autoplay (politique navigateur).
    const buildIframeUrl = (login) => {
      const params = new URLSearchParams({
        channel: login,
        parent: 'twitch.tv',
        player: 'popout',
        quality: CFG.PREVIEW_IFRAME_QUALITY,
        muted: 'true',
        controls: 'false',
        autoplay: 'true'
      });
      return `https://player.twitch.tv/?${params}`;
    };

    // Lit les co-streamers à partir des cartes de la sidebar qui partagent
    // la même clé tseCostreamKey. Retourne les logins des AUTRES membres
    // (pas du streamer courant). Heuristique basée sur catégorie + viewers,
    // limitée à la section "Chaînes suivies".
    const getCostreamMates = (card) => {
      const key = card.dataset.tseCostreamKey;
      if (!key) return [];
      const myLogin = card.dataset.tseLogin;
      const section = followedSection();
      if (!section) return [];
      const mates = [];
      section.querySelectorAll(`.side-nav-card[data-tse-costream-key]`).forEach(c => {
        if (c.dataset.tseCostreamKey !== key) return;
        if (c.dataset.tseLogin === myLogin) return;
        if (c.dataset.tseLogin) mates.push(c.dataset.tseLogin);
      });
      return mates;
    };

    // Détecte le rôle d'une carte dans un co-stream Twitch et, si pertinent,
    // le login du stream principal.
    //
    // Twitch marque ces cartes avec un descendant dont la classe contient :
    //   - "iconContainer--primary"   → la carte est un co-streamer participant
    //                                  (cercle bleu). Un mini-avatar dans le
    //                                  bloc metadata porte un alt de la forme
    //                                  "Co-stream d'un stream de <login>" qui
    //                                  donne l'hôte.
    //   - "iconContainer--secondary" → la carte est le stream hôte (cercle
    //                                  blanc). Pas d'info supplémentaire à
    //                                  extraire — on connaît juste le rôle.
    //
    // Retourne un objet { role, host } :
    //   role = 'participant' | 'host' | null
    //   host = login lowercase de l'hôte (uniquement si role === 'participant'),
    //          null sinon ou si l'extraction a échoué (format Twitch modifié,
    //          login invalide).
    const getCostreamInfo = (card) => {
      if (card.querySelector('[class*="iconContainer--secondary"]')) {
        return { role: 'host', host: null };
      }
      if (!card.querySelector('[class*="iconContainer--primary"]')) {
        return { role: null, host: null };
      }
      // Co-streamer participant : on essaye d'extraire l'hôte.
      const img = card.querySelector(DOM.altCostreamHostSelector);
      if (!img) return { role: 'participant', host: null };
      const m = DOM.costreamHostRe.exec((img.getAttribute('alt') || '').trim());
      if (!m) return { role: 'participant', host: null };
      const login = m[1].toLowerCase();
      if (RESERVED.test(login)) return { role: 'participant', host: null };
      return { role: 'participant', host: login };
    };

    // Détecte le système "En live avec" (squad / multistream Twitch) et
    // extrait les infos visibles dans le DOM.
    //
    // Twitch marque ces cartes avec un wrapper .primary-with-small-avatar
    // __mini-avatar contenant un seul mini-avatar (l'invité affiché). Le
    // nombre total d'invités est exposé via une phrase d'accessibilité
    // de la forme :
    //   "X et 1 invité"  → 1 invité au total
    //   "X et N invités" → N invités au total (N >= 2)
    // Twitch ne liste PAS les autres invités dans le DOM (il faut ouvrir
    // le panneau natif pour les voir).
    //
    // Retourne :
    //   { guest, otherCount } si squad détecté
    //     guest      = nom visible du mini-avatar (case originale Twitch)
    //     otherCount = nombre d'invités supplémentaires (peut être 0 si +1)
    //   null sinon (pas un squad, ou structure DOM imprévue)
    const getSquadInfo = (card) => {
      const miniWrap = card.querySelector('.primary-with-small-avatar__mini-avatar');
      if (!miniWrap) return null;
      const miniImg = miniWrap.querySelector('img[alt]');
      const guest = (miniImg?.getAttribute('alt') || '').trim();
      if (!guest) return null;
      // Phrase d'accessibilité : "X et N invités" (présente même pour N=1).
      // On la lit pour connaître le nombre total ; "autres" = total - 1.
      const allP = card.querySelectorAll('p');
      let total = 1;
      for (const p of allP) {
        const m = DOM.guestsTotalRe.exec(p.textContent || '');
        if (m) { total = parseInt(m[1], 10) || 1; break; }
      }
      return { guest, otherCount: Math.max(0, total - 1) };
    };

    // Détecte si une carte est un stream sponsorisé (carte "promoted-followed")
    // et extrait les infos de la marque pour les afficher dans le popup.
    //
    // Twitch structure ces cartes via la classe stable
    // side-nav-card__link--promoted-followed sur le <a>. À l'intérieur :
    //   - <img alt="Logo de <Marque>" src="…">              → logo de la marque
    //   - le wrapper parent porte un style="background-color: rgb(…)" inline
    //     correspondant à la couleur de la marque
    //   - <p title=" <Marque>"> dans .side-nav-card-promoted-bottom → nom
    //     de la marque (préfixé d'un espace dans le DOM Twitch, on trim).
    //
    // Retourne :
    //   { name, logoUrl, bgColor } si carte sponsorisée
    //   null sinon
    const getSponsorInfo = (card) => {
      if (!card.querySelector('a[class*="--promoted-followed"]')) return null;
      const logoImg = card.querySelector(DOM.altLogoSelector);
      if (!logoImg) return null;
      const logoUrl = logoImg.getAttribute('src') || '';
      // Nom : on essaye d'abord d'extraire depuis l'alt "Logo de <Marque>"
      // (fiable), avec fallback sur le <p> du bandeau "Sponsorisé".
      let name = '';
      const m = DOM.sponsorLogoRe.exec((logoImg.getAttribute('alt') || '').trim());
      if (m) name = m[1].trim();
      if (!name) {
        // Fallback : dernier <p> de .side-nav-card-promoted-bottom (avec
        // espace en début dans le DOM Twitch, à trimmer).
        const bottomPs = card.querySelectorAll('.side-nav-card-promoted-bottom p');
        const lastP = bottomPs[bottomPs.length - 1];
        name = (lastP?.getAttribute('title') || lastP?.textContent || '').trim();
      }
      if (!name) return null;
      // Le cadre coloré qui héberge le logo a un background-color inline.
      // On le récupère pour reproduire le rendu d'origine côté badge.
      // Validation : on ne garde que les formats CSS color attendus
      // (rgb/rgba/hsl/hsla/hex/transparent) pour éviter toute injection
      // CSS si Twitch venait à exposer une valeur inattendue.
      const rawColor = (logoImg.parentElement?.style?.backgroundColor || '').trim();
      const bgColor = /^(?:rgba?|hsla?)\([^)]+\)$|^#[0-9a-f]{3,8}$|^transparent$/i.test(rawColor)
        ? rawColor
        : 'transparent';
      return { name, logoUrl, bgColor };
    };

    // Pseudo affiché (casse d'origine) d'un login (en minuscule). Priorité :
    //   1. carte présente dans la sidebar (TOUTES sections — un hôte/partenaire
    //      de co-stream peut être hors de "Chaînes suivies") → titre exact ;
    //   2. `fallback` fourni (ex. displayName Guest Star, pour un partenaire
    //      absent de la sidebar) ;
    //   3. capitalisation de la première lettre du login en dernier recours.
    const displayNameFor = (login, fallback) => {
      const card = document.querySelector(`.side-nav-card[data-tse-login="${login}"]`);
      if (card) {
        const p = card.querySelector('p[data-a-target="side-nav-title"]');
        const name = (p?.getAttribute('title') || p?.textContent || '').trim();
        if (name) return name;
      }
      const fb = (fallback || '').trim();
      if (fb) return fb;
      return login.charAt(0).toUpperCase() + login.slice(1);
    };

    const ensureEl = () => {
      if (el) return el;
      el = document.createElement('div');
      el.className = 'tse-preview';
      document.body.appendChild(el);
      return el;
    };

    // Positionne le popup à droite de la carte, ou à gauche s'il déborde.
    // Aligné verticalement sur le haut de la carte, ajusté pour rester
    // dans le viewport.
    const positionPopup = (card) => {
      if (!el) return;
      // Carte détachée du DOM (le stream s'est terminé pendant le survol et
      // Twitch a retiré la carte) : getBoundingClientRect() renverrait un rect
      // à zéro → le popup sauterait dans le coin (8,8). On ferme plutôt.
      if (!card || !card.isConnected) { close(); return; }
      const cardRect = card.getBoundingClientRect();
      const margin = 8;
      const popupWidth = el.offsetWidth;
      const popupHeight = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Horizontal : à droite de la carte par défaut, à gauche si déborde.
      let left = cardRect.right + margin;
      if (left + popupWidth > vw - margin) {
        left = cardRect.left - popupWidth - margin;
      }
      if (left < margin) left = margin;

      // Vertical : aligné sur le haut de la carte, mais clampé au viewport.
      let top = cardRect.top;
      if (top + popupHeight > vh - margin) {
        top = vh - popupHeight - margin;
      }
      if (top < margin) top = margin;

      el.style.left = `${left}px`;
      el.style.top  = `${top}px`;
    };

    // Enveloppe le contenu d'un badge. Le badge est en `inline-flex; gap:4px`
    // (pour espacer un éventuel logo sponsor du texte). Sans précaution, ce gap
    // s'insérerait AUSSI entre chaque item flex du contenu (mots et <strong>),
    // produisant "Scok , Farore". On force donc le texte à former UN SEUL item
    // flex via un span dédié (flux inline normal à l'intérieur → pas de gap
    // parasite). `leadHtml` (logo sponsor) reste hors du span : le gap voulu
    // entre logo et texte est ainsi préservé.
    const badgeHtml = (modClass, textHtml, leadHtml = '') =>
      `<span class="tse-preview__badge ${modClass}">` +
      leadHtml +
      `<span class="tse-preview__badge-text">${textHtml}</span>` +
      `</span>`;

    // Construit le HTML du badge "En live avec …" pour un login donné.
    // Priorité à la donnée Guest Star (liste complète et fiable, casse
    // correcte via displayName) ; repli sur la détection squad DOM native.
    // `channelId` optionnel : fourni par la popup pour les sections hors
    // "suivis" où getChannelId peut ne pas suffire. '' si aucun badge.
    const liveWithBadgeHtml = (login, squadInfo, channelId) => {
      const mates = getGuestStarMates(login, channelId);
      if (mates.length) {
        // Nettoyage infaillible au point de rendu : on trimme CHAQUE nom résolu
        // (le displayName Twitch arrive parfois avec une espace de fin, qui
        // produirait "Scok , Farore"), on écarte les vides, puis on joint par
        // ", " → "Scok, Farore, Hiuuugs".
        const namesHtml = mates
          .map(m => displayNameFor(m.login, m.name).trim())
          .filter(Boolean)
          .map(n => `<strong>${escapeHtml(n)}</strong>`)
          .join(', ');
        if (!namesHtml) return '';
        return badgeHtml('tse-preview__badge--squad', S.uiBadgeLiveWith(namesHtml, 0));
      }
      if (squadInfo) {
        const guestHtml = `<strong>${escapeHtml(squadInfo.guest)}</strong>`;
        return badgeHtml('tse-preview__badge--squad', S.uiBadgeLiveWith(guestHtml, squadInfo.otherCount));
      }
      return '';
    };

    // Insère/rafraîchit le badge "En live avec" dans la popup OUVERTE, sans
    // toucher au reste (titre, iframe). Utilisé quand la donnée Guest Star
    // arrive APRÈS le rendu initial (sections Chaînes live / "regardent aussi"
    // où le fetch est déclenché à l'ouverture). Anti-race : ne fait rien si la
    // popup a changé de cible entre-temps.
    const updateLiveWithBadge = (login, squadInfo, channelId) => {
      if (!el || currentLogin !== login) return;
      const html = liveWithBadgeHtml(login, squadInfo, channelId);
      if (!html) return;
      const body = el.querySelector('.tse-preview__body');
      if (!body) return;
      let container = el.querySelector('.tse-preview__badges');
      if (!container) {
        container = document.createElement('div');
        container.className = 'tse-preview__badges';
        body.appendChild(container);
      }
      const existing = container.querySelector('.tse-preview__badge--squad');
      if (existing) existing.outerHTML = html; // remplace un éventuel badge squad déjà posé
      else container.insertAdjacentHTML('beforeend', html);
      if (currentCard) positionPopup(currentCard); // la hauteur a pu changer
    };

    // Construit le HTML du badge co-stream d'ÉVÉNEMENT à partir d'un descripteur
    // { role, host, hostName } :
    //   - participant + host → "Co-stream de <hôte>" (hostName = casse de repli)
    //   - host               → "Stream Hôte"
    //   - sinon              → '' (pas de badge basé sur le rôle)
    const costreamBadgeHtml = (info) => {
      if (info?.role === 'participant' && info.host) {
        return badgeHtml(
          'tse-preview__badge--costream',
          S.uiBadgeCostreamOf(escapeHtml(displayNameFor(info.host, info.hostName)))
        );
      }
      if (info?.role === 'host') {
        return badgeHtml('tse-preview__badge--costream', escapeHtml(S.uiBadgeCostreamHost));
      }
      return '';
    };

    // Fusionne la détection DOM (getCostreamInfo) avec l'organizer GraphQL
    // (costreamDetails). Le DOM suffit en mode étendu ; en mode RÉDUIT il ne
    // porte pas le nom de l'hôte pour un participant → on le complète via
    // l'organizer (source fiable, indépendante du mode) :
    //   - organizer == chaîne survolée → c'est l'hôte → "Stream Hôte"
    //   - sinon                        → participant → "Co-stream de <organizer>"
    const resolveCostreamInfo = (domInfo, organizer, channelId) => {
      const role = domInfo?.role || null;
      if (role === 'host') return domInfo;                          // hôte (DOM) : OK dans les deux modes
      if (role === 'participant' && domInfo.host) return domInfo;   // hôte déjà extrait (DOM étendu)
      if (organizer && organizer.login) {
        const isSelf = channelId && organizer.id === channelId;
        if (role === 'participant') {
          // Le DOM affirme "participant" : on complète juste le nom de l'hôte
          // via l'organizer (jamais de bascule en hôte). Cas incohérent
          // organizer == soi → on n'affiche rien plutôt que "Co-stream de soi".
          return isSelf ? domInfo : { role: 'participant', host: organizer.login, hostName: organizer.name };
        }
        // role == null : l'organizer tranche. organizer == soi → hôte.
        return isSelf
          ? { role: 'host', host: null }
          : { role: 'participant', host: organizer.login, hostName: organizer.name };
      }
      return domInfo || { role: null, host: null };
    };

    // Insère/rafraîchit le badge "Co-stream de …" dans la popup OUVERTE quand
    // l'organizer arrive via GraphQL (mode réduit surtout), sans toucher au
    // reste. Conserve l'ordre des badges (co-stream avant squad/sponsor).
    const updateCostreamBadge = (login, domInfo, channelId, organizer) => {
      if (!el || currentLogin !== login) return;
      const html = costreamBadgeHtml(resolveCostreamInfo(domInfo, organizer, channelId));
      if (!html) return;
      const body = el.querySelector('.tse-preview__body');
      if (!body) return;
      let container = el.querySelector('.tse-preview__badges');
      if (!container) {
        container = document.createElement('div');
        container.className = 'tse-preview__badges';
        body.appendChild(container);
      }
      const existing = container.querySelector('.tse-preview__badge--costream');
      if (existing) { existing.outerHTML = html; }
      else {
        // Insérer avant le badge squad (sinon sponsor, sinon en fin) pour
        // garder l'ordre visuel co-stream → "En live avec" → sponsor.
        const anchor = container.querySelector('.tse-preview__badge--squad, .tse-preview__badge--sponsor');
        if (anchor) anchor.insertAdjacentHTML('beforebegin', html);
        else container.insertAdjacentHTML('beforeend', html);
      }
      if (currentCard) positionPopup(currentCard);
    };

    // Construit le HTML du popup à partir des données collectées.
    // L'iframe est ajouté plus tard par injectIframe(), pas dans ce rendu.
    //
    // Badge "Co-stream de X" (co-stream d'ÉVÉNEMENT) : rôle détecté via le DOM
    // Twitch (getCostreamInfo). En mode ÉTENDU, le DOM porte aussi le nom de
    // l'hôte (alt "Co-stream d'un stream de X"). En mode RÉDUIT, il ne le porte
    // pas → le nom est complété de façon asynchrone via l'organizer GraphQL
    // (costreamDetails), cf. updateCostreamBadge / resolveCostreamInfo. Repli
    // ultime : détection heuristique (costreamMates), limitée à "Chaînes
    // suivies" et aux co-streamers suivis.
    //
    // costreamInfo (DOM) possède un role :
    //   - 'participant' : "Co-stream de <hôte>" si l'hôte est connu (DOM en
    //                     étendu, ou organizer GraphQL en réduit) ;
    //   - 'host'        : "Stream Hôte" ;
    //   - null          : repli heuristique, puis organizer GraphQL.
    //
    // Badge "En live avec" (co-streamers en session ensemble) : indépendant
    // du badge "Co-stream de X" (événement) — les deux peuvent coexister.
    // Source prioritaire : Guest Star (getGuestStarMates, liste complète et
    // fiable) ; repli : détection squad DOM native (squadInfo).
    //   - Guest Star → "En live avec <noms…>" (tous les noms listés)
    //   - squad DOM, otherCount = 0 → "En live avec <guest>"
    //   - squad DOM, otherCount > 0 → "En live avec <guest> et N autres"
    //
    // Badge sponsor : affiché si sponsorInfo non-null. Texte
    // "Sponsorisé par <marque>" + mini logo coloré à gauche du texte
    // (reproduction du cadre coloré natif Twitch).
    const renderPopup = (login, title, extraRows, costreamInfo, costreamMates, squadInfo, sponsorInfo) => {
      const badges = (extraRows || []).map(r => {
        const cls = r.type === 'hype' ? 'tse-preview__badge--hype'
                  : r.type === 'discount' ? 'tse-preview__badge--discount'
                  : '';
        return badgeHtml(cls, escapeHtml(r.text));
      });

      // Badge co-stream d'événement : rôle DOM (participant+hôte / hôte) via
      // costreamBadgeHtml ; à défaut, repli heuristique (section suivie).
      let costreamHtml = costreamBadgeHtml(costreamInfo);
      if (!costreamHtml && costreamMates && costreamMates.length) {
        const names = costreamMates
          .map(l => `<strong>${escapeHtml(displayNameFor(l))}</strong>`)
          .join(', ');
        costreamHtml = badgeHtml('tse-preview__badge--costream', S.uiBadgeCostreamWithNames(names));
      }
      if (costreamHtml) badges.push(costreamHtml);

      // Badge "En live avec" (cf. liveWithBadgeHtml). Source prioritaire :
      // Guest Star (liste complète et fiable) ; repli : détection squad native.
      // INDÉPENDANT du badge "Co-stream de X" (événement) : les deux coexistent.
      const liveWithHtml = liveWithBadgeHtml(login, squadInfo);
      if (liveWithHtml) badges.push(liveWithHtml);

      if (sponsorInfo) {
        // Logo dans un mini cadre coloré (reproduit le rendu Twitch).
        // Le bgColor vient du style inline Twitch (couleur de la marque).
        // Si l'URL du logo est absente, on affiche juste le badge texte.
        // Le logo reste hors du span de texte (leadHtml) pour conserver le gap.
        const logoHtml = sponsorInfo.logoUrl
          ? `<span class="tse-preview__sponsor-logo" style="background:${escapeHtml(sponsorInfo.bgColor)}">` +
            `<img src="${escapeHtml(sponsorInfo.logoUrl)}" alt=""></span>`
          : '';
        badges.push(badgeHtml(
          'tse-preview__badge--sponsor',
          S.uiBadgeSponsoredBy(escapeHtml(sponsorInfo.name)),
          logoHtml
        ));
      }

      const thumbUrl = buildThumbUrl(login);
      const titleHtml = title
        ? `<p class="tse-preview__title">${escapeHtml(title)}</p>`
        : `<p class="tse-preview__title" style="color: rgba(255,255,255,0.5)">${escapeHtml(S.uiPreviewLoadingTitle)}</p>`;

      // NOTE PORTAGE EXTENSION : onerror="…" inline bloqué par la
      // CSP de Twitch pour les content scripts. Bascule en
      // addEventListener — sémantique identique.
      el.innerHTML = `
        <div class="tse-preview__thumb-wrap">
          <img class="tse-preview__thumb" alt="" src="${thumbUrl}">
          <div class="tse-preview__thumb-placeholder" style="display:none">${escapeHtml(S.uiPreviewUnavailable)}</div>
        </div>
        <div class="tse-preview__body">
          ${titleHtml}
          ${badges.length ? `<div class="tse-preview__badges">${badges.join('')}</div>` : ''}
        </div>
      `;
      const thumbImg = el.querySelector('.tse-preview__thumb');
      const placeholder = el.querySelector('.tse-preview__thumb-placeholder');
      if (thumbImg && placeholder) {
        thumbImg.addEventListener('error', () => {
          thumbImg.style.display = 'none';
          placeholder.style.display = 'flex';
        }, { once: true });
        // `complete` couvre le cas d'une image déjà en cache : l'événement load
        // a pu partir avant même que l'écouteur ne soit posé.
        const showThumb = () => { thumbImg.dataset.tseLoaded = 'true'; };
        if (thumbImg.complete && thumbImg.naturalWidth > 0) showThumb();
        else thumbImg.addEventListener('load', showThumb, { once: true });
      }
    };

    // Injecte un iframe player par-dessus le JPEG. Si l'iframe ne charge
    // pas en PREVIEW_IFRAME_TIMEOUT_MS, on retire l'iframe et on garde
    // le JPEG comme fallback gracieux.
    const injectIframe = (login) => {
      if (!el || currentLogin !== login) return;
      const wrap = el.querySelector('.tse-preview__thumb-wrap');
      if (!wrap || wrap.querySelector('iframe')) return;

      const iframe = document.createElement('iframe');
      iframe.className = 'tse-preview__iframe';
      iframe.src = buildIframeUrl(login);
      iframe.setAttribute('allow', 'autoplay; encrypted-media');

      /* Révélation de l'iframe — le MOMENT compte plus que le fondu.
       *
       * L'événement `load` d'une iframe signale la fin du chargement de son
       * DOCUMENT, pas l'arrivée d'une image. Révéler à ce moment-là faisait
       * apparaître un lecteur ENCORE NOIR par-dessus la vignette, pour environ
       * une seconde : le fondu jouait, mais sur du noir, ce qui se lit comme
       * une coupure franche.
       *
       * On attend donc que le lecteur ait vraiment présenté une image. Le
       * signal vient de l'iframe elle-même (cf. module PONT D'APERÇU en haut
       * de ce fichier), qui poste un message à la première frame peinte.
       * Cross-origin oblige, on ne peut pas l'observer d'ici.
       */
      const reveal = () => {
        if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
        if (revealCleanup) { revealCleanup(); revealCleanup = null; }
        // Le popup a pu être refermé, ou pointer une autre chaîne, entre-temps.
        if (currentLogin !== login || !iframe.isConnected) return;
        iframe.dataset.tseLoaded = 'true';
      };

      const onFirstFrame = (e) => {
        // `source` est la seule vérification qui compte : elle ancre le message
        // à CETTE iframe. Le contenu, lui, ne sert qu'à écarter le bruit des
        // autres scripts de la page (Twitch en poste beaucoup).
        if (e.source !== iframe.contentWindow) return;
        if (e.data?.tse !== TSE_PREVIEW_FIRST_FRAME_MSG) return;
        reveal();
      };
      window.addEventListener('message', onFirstFrame);
      revealCleanup = () => window.removeEventListener('message', onFirstFrame);

      iframe.addEventListener('load', () => {
        if (iframeLoadTimer) { clearTimeout(iframeLoadTimer); iframeLoadTimer = null; }
        if (currentLogin !== login || !iframe.isConnected) return;
        // Filet. Si le signal de première image n'arrive jamais — lecteur
        // remanié par Twitch, vidéo refusée, navigateur sans les API utilisées
        // — on révèle quand même passé ce délai. Mieux vaut un lecteur noir
        // qu'un aperçu figé sur sa vignette pour toujours.
        revealTimer = setTimeout(reveal, CFG.PREVIEW_REVEAL_FALLBACK_MS);
      }, { once: true });

      // Fallback : si load n'arrive pas à temps (réseau lent, erreur silencieuse),
      // on retire l'iframe pour laisser le JPEG visible.
      iframeLoadTimer = setTimeout(() => {
        iframeLoadTimer = null;
        if (iframe.dataset.tseLoaded !== 'true' && iframe.isConnected) {
          // about:blank avant remove : libère immédiatement le pipeline média
          // du player (buffers de décodage) au lieu d'attendre le GC.
          try { iframe.src = 'about:blank'; } catch { /* cross-origin edge */ }
          iframe.remove();
        }
      }, CFG.PREVIEW_IFRAME_TIMEOUT_MS);

      wrap.appendChild(iframe);
    };

    // Retire l'iframe du DOM pour libérer la mémoire/CPU du player.
    const removeIframe = () => {
      if (iframeTimer) { clearTimeout(iframeTimer); iframeTimer = null; }
      if (iframeLoadTimer) { clearTimeout(iframeLoadTimer); iframeLoadTimer = null; }
      if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
      // L'écouteur est posé sur window, pas sur l'iframe : il ne part pas avec
      // elle. Le retirer ici est ce qui évite d'en empiler un par survol.
      if (revealCleanup) { revealCleanup(); revealCleanup = null; }
      if (!el) return;
      const iframe = el.querySelector('.tse-preview__iframe');
      if (iframe) {
        // about:blank avant remove : coupe le flux et libère les buffers de
        // décodage vidéo tout de suite, sans attendre le ramasse-miettes.
        try { iframe.src = 'about:blank'; } catch { /* cross-origin edge */ }
        iframe.remove();
      }
    };

    const close = () => {
      removeIframe();
      currentLogin = null;
      currentCard = null;
      if (el) {
        el.dataset.tseVisible = 'false';
        // Garder le DOM en place (singleton), juste invisible.
      }
      // Retrait DIFFÉRÉ du flag .tse-preview-active : Twitch ferme sa
      // .tw-dialog-layer avec ~300 ms de délai après le mouseleave. Si on
      // retire le flag instantanément, la modale redevient visible le
      // temps de sa propre fermeture → flash. On laisse 500 ms pour que
      // Twitch finisse, puis on libère le flag pour ne pas bloquer les
      // modales légitimes ultérieures. Annulé si open() est rappelé.
      if (flagRemoveTimer) clearTimeout(flagRemoveTimer);
      flagRemoveTimer = setTimeout(() => {
        flagRemoveTimer = null;
        document.body.classList.remove('tse-preview-active');
      }, 500);
    };

    const open = (card) => {
      // Login : d'abord depuis dataset.tseLogin (posé par processCard pour
      // toutes les cartes de la sidebar). Fallback via le href si dataset
      // n'est pas encore posé (cas du tout premier survol, avant que le
      // scan initial n'ait traité cette carte).
      let login = card.dataset.tseLogin;
      if (!login) {
        const link = card.querySelector(DOM.cardLinkSelector);
        login = loginFromHref(link?.getAttribute('href'));
      }
      if (!login) return;
      // Pas d'aperçu pour les cartes offline confirmées par GQL.
      if (card.dataset.tseOffline === 'true') return;

      currentLogin = login;
      currentCard = card;
      // Le popup va charger cette miniature lui-même : on l'ôte de la passe.
      thumbPreload.markDone(login);
      ensureEl();

      const extraRows = (() => {
        try { return JSON.parse(card.dataset.tseExtraRows || '[]'); }
        catch { return []; }
      })();
      // Détection co-stream : rôle DOM Twitch au rendu initial (fiable et
      // disponible pour toutes les sections). Le nom de l'hôte d'un participant
      // est complété en mode réduit via l'organizer GraphQL après le fetch méta
      // (cf. updateCostreamBadge) ; repli heuristique sinon (cf. renderPopup).
      const costreamInfo = getCostreamInfo(card);
      // Fallback heuristique inutile si on a déjà identifié un rôle co-stream
      // via le DOM Twitch. Court-circuit pour éviter un querySelectorAll inutile.
      const mates = costreamInfo.role ? [] : getCostreamMates(card);
      // Détection "En live avec" (squad) — indépendant du co-stream.
      const squadInfo = getSquadInfo(card);
      // Détection sponsor (carte "promoted-followed").
      const sponsorInfo = getSponsorInfo(card);

      // Rendu initial sans titre (chargement async).
      renderPopup(login, null, extraRows, costreamInfo, mates, squadInfo, sponsorInfo);
      el.dataset.tseVisible = 'true';
      // Active le flag qui masque la .tw-dialog-layer parasite via CSS
      // (cf. règle body.tse-preview-active). Annule un éventuel retrait
      // différé en attente depuis un close() précédent (passage A → B).
      if (flagRemoveTimer) { clearTimeout(flagRemoveTimer); flagRemoveTimer = null; }
      document.body.classList.add('tse-preview-active');
      positionPopup(card);

      // Badge "En live avec" (Guest Star) hors section "suivis" (Chaînes live,
      // "regardent aussi") : le scan n'y déclenche aucun fetch Guest Star. On le
      // demande donc à l'ouverture de la popup puis on insère le badge dès que
      // la donnée arrive. Idempotent : requestGuestStar dédoublonne, et
      // updateLiveWithBadge porte sa propre garde anti-race.
      const requestLiveWith = (id) => {
        if (!id) return;
        requestGuestStar(id).then(() => updateLiveWithBadge(login, squadInfo, id));
      };
      requestLiveWith(getChannelId(login)); // ID souvent déjà connu (scan)

      // Fetch métadonnées (titre + CCL) en arrière-plan. Si l'utilisateur
      // a déjà refermé entre-temps, currentLogin aura changé et on ignore
      // la réponse (anti-race).
      fetchPreviewMeta(login).then(meta => {
        if (currentLogin !== login || !el) return;
        if (!meta) return;

        // Cas où GQL confirme que le stream est offline alors que la carte
        // Twitch montre encore un état live (Twitch est en retard sur son
        // propre DOM, et notre entrée de cache peut être valide encore
        // LIVE_TTL). Le survol raccourcit donc ce délai à zéro : on marque la
        // carte offline (le CSS la masquera), on retire le popup, et on
        // invalide l'entrée pour que le prochain scan reparte sur du frais.
        if (meta.offline) {
          card.dataset.tseGqlOffline = 'true';
          card.dataset.tseOffline = 'true';
          cache.delete(login);
          close();
          return;
        }

        // Mise à jour du titre dans le popup.
        if (meta.title) {
          const titleEl = el.querySelector('.tse-preview__title');
          if (titleEl) {
            titleEl.textContent = meta.title;
            titleEl.style.color = '';
          }
          // Le titre arrive après le positionnement initial → la hauteur
          // a pu changer, on re-clamp au viewport.
          if (currentCard) positionPopup(currentCard);
        }

        // Si le stream est tagué avec un Content Classification Label,
        // l'iframe player afficherait une interstitielle "Commencer à
        // regarder" qu'on ne peut pas fermer (cross-origin). On reste
        // donc sur le JPEG statique : on annule le timer si l'iframe
        // n'est pas encore injectée, on la retire sinon.
        if (meta.hasCCL) {
          if (iframeTimer) { clearTimeout(iframeTimer); iframeTimer = null; }
          if (el.querySelector('.tse-preview__iframe')) removeIframe();
        }

        // Filet : si l'ID de chaîne n'était pas encore en cache au survol, la
        // réponse preview vient de le fournir → on (re)tente le badge "En live
        // avec" (no-op si déjà posé).
        if (meta.id) requestLiveWith(meta.id);

        // Badge "Co-stream de X" : en mode réduit, le DOM ne porte pas le nom
        // de l'hôte. On le complète ici via l'organizer GraphQL (no-op en mode
        // étendu, où le DOM l'a déjà fourni au rendu initial).
        updateCostreamBadge(login, costreamInfo, meta.id || getChannelId(login), meta.costreamOrganizer);
      });

      // Bascule vers l'iframe player après un court délai. Si l'utilisateur
      // quitte avant, close() annule le timer. Si la réponse GQL arrive
      // avant et indique un CCL, le timer est aussi annulé (cf. ci-dessus).
      iframeTimer = setTimeout(() => {
        iframeTimer = null;
        injectIframe(login);
      }, CFG.PREVIEW_IFRAME_DELAY);
    };

    // Délégation au document en mode capture. On utilise mouseenter/mouseleave
    // plutôt que mouseover/mouseout pour deux raisons cruciales :
    //
    //  1) mouseenter/mouseleave ne bubblent PAS et ne se déclenchent PAS pour
    //     les mouvements entre enfants. Avec mouseover, chaque traversée
    //     d'un enfant React (avatar, p, span…) générait des paires sortie/
    //     entrée parasites.
    //
    //  2) Comme ils ne bubblent pas, on ne pourrait pas les attraper en
    //     délégation classique. La 3e arg `true` (capture phase) résout
    //     ça : l'event nous arrive depuis le root AVANT d'atteindre la
    //     cible, donc on peut filtrer via target.closest('.side-nav-card').
    //
    // Cas particulier — réconciliation React : Twitch (et notre propre
    // applySorting) peut déplacer une carte dans le DOM via appendChild
    // sur le même parent. Le navigateur détache puis rattache l'élément,
    // ce qui émet un mouseleave puis un mouseenter parasites alors que
    // la souris n'a pas bougé. On détecte ce cas via elementFromPoint
    // après un requestAnimationFrame (cf. handler mouseleave).
    let lastMouseX = -1;
    let lastMouseY = -1;

    // Résout la carte canonique (le wrapper englobant) à partir d'un nœud
    // survolé. NÉCESSAIRE car en mode RÉDUIT, Twitch pose la classe
    // .side-nav-card à la fois sur le <div> wrapper ET sur le <a> interne
    // (en mode étendu, le <a> porte .side-nav-card__link, classe distincte).
    // Sans normalisation, l'entrée dans le <a> interne satisfait elle aussi
    // le garde « t === card » et déclenche close()+open(<a>) ; or ce <a>
    // n'a pas de lien descendant → pas de login → open() abandonne, et
    // l'aperçu ouvert par le wrapper se referme aussitôt (jamais réaffiché).
    // En remontant au plus haut ancêtre .side-nav-card, wrapper et <a>
    // interne pointent vers la MÊME carte : « t === card » n'est vrai que
    // pour le wrapper. En mode étendu (un seul .side-nav-card par carte),
    // c'est un no-op → aucun changement de comportement.
    const resolveCard = (node) => {
      let card = node.closest('.side-nav-card');
      if (!card) return null;
      for (let p = card.parentElement; p; p = p.parentElement) {
        if (p.classList.contains('side-nav-card')) card = p;
      }
      return card;
    };

    const init = () => {
      // Track la position courante de la souris en permanence (léger,
      // mousemove est passif). Sert au test anti-fantôme du mouseleave.
      document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }, { passive: true, capture: true });

      document.addEventListener('mouseenter', (e) => {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;
        const card = resolveCard(t);
        if (!card) return;
        // En phase de capture, mouseenter peut viser un enfant en plus de
        // la carte elle-même. On ne réagit qu'à l'entrée dans la carte
        // canonique (cf. resolveCard pour le cas du mode réduit).
        if (t !== card) return;
        if (card === currentCard) return;
        // L'aperçu s'active pour TOUTES les cartes de la sidebar, toutes
        // sections confondues (Chaînes suivies, Chaînes live recommandées,
        // Spectateurs de X regardent aussi).
        close();
        open(card);
      }, true);

      document.addEventListener('mouseleave', (e) => {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;
        const card = resolveCard(t);
        if (!card) return;
        if (t !== card) return;
        if (card !== currentCard) return;

        // Test anti-fantôme : si le nœud actuellement sous la souris
        // est toujours dans la carte (ou est la carte), c'est que
        // l'event mouseleave provient d'un détachement/rattachement
        // DOM (réconciliation React, applySorting) et non d'un vrai
        // mouvement utilisateur. On ignore et on reste ouvert.
        // requestAnimationFrame attend que le rattachement soit fait
        // (le mouseleave est tiré pendant le détachement, donc on
        // ne peut pas faire le check au tick courant).
        requestAnimationFrame(() => {
          if (card !== currentCard) return; // déjà refermé entre-temps
          const under = document.elementFromPoint(lastMouseX, lastMouseY);
          if (under && card.contains(under)) {
            // Le DOM s'est restabilisé, souris toujours sur la carte → ignore.
            return;
          }
          close();
        });
      }, true);

      // Fermeture au changement de visibilité de l'onglet. Pas de
      // fermeture sur scroll : un scroll interne (relayout React,
      // image qui charge, mises à jour de compteurs Twitch) déclenchait
      // des fermetures parasites alors que la souris ne bougeait pas.
      // Si le popup est temporairement mal aligné après un scroll
      // volontaire de l'utilisateur, ce n'est pas grave — il fermera
      // au mouseleave naturel.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) close();
      });
    };

    return {
      init,
      // Ferme l'aperçu si sa carte d'ancrage a quitté le DOM (stream terminé
      // pendant le survol). Appelée depuis scanSidebar : le retrait d'une carte
      // est une mutation de #side-nav → déclenche un scan → fermeture proactive,
      // sans dépendre d'un mouseleave (peu fiable quand le nœud survolé est retiré).
      closeIfDetached: () => { if (currentCard && !currentCard.isConnected) close(); },
      // Purge mémoire du cache de métadonnées (appelée périodiquement par les
      // timers). metaCache est reconstructible → éviction sans effet visible.
      prune: () => pruneCache(metaCache, META_TTL, CFG.META_CACHE_MAX)
    };
  })();

  // Compteur de transitions visible→offline détectées pendant le scan
  // courant (cas synchrone isCardOffline). Si > 0 en fin de scan, la
  // sidebar n'est pas stable (React finit de rendre des cartes
  // déconnectées) → scanSidebar reprogramme un scan pour différer la
  // levée du voile de chargement.
  let offlineTransitionsThisScan = 0;

  /**
   * Applique à une carte une entrée de cache TseChannels (ou la sentinelle
   * UPTIME_UNKNOWN). Idempotent : ré-appelée à chaque scan tant que l'entrée
   * reste fraîche, elle doit converger sans effet de bord cumulatif.
   *
   * C'est pourquoi le compteur de confirmation hors-ligne n'est PAS incrémenté
   * par appel mais par RÉPONSE RÉSEAU : on mémorise sur la carte l'horodatage
   * de la dernière entrée déjà comptabilisée (tseOfflineTs). Sans ça, le
   * compteur grimperait à chaque scan — donc à chaque mutation de la sidebar —
   * et OFFLINE_CONFIRM ne vaudrait plus rien : la première réponse « null »
   * masquerait la carte, faux positifs compris.
   */
  const applyChannelData = (card, data) => {
    if (data === UPTIME_UNKNOWN) {
      // Réponse réseau HS : on ne touche à rien (pas d'effacement de
      // l'uptime, pas de "Terminé"). L'état précédent reste affiché.
      applyCardVisibility(card);
      return;
    }

    const stream = data.stream;

    if (stream?.createdAt) {
      // Mesure du retard de Twitch. L'instant de cet appel est celui où une
      // carte de TWITCH affiche ce stream en direct (processCard n'arrive
      // jusqu'ici que pour les cartes non hors-ligne) ; observe() écarte de
      // lui-même les cartes que l'extension a fabriquées.
      liveLag.observe(card, stream);
      card.dataset.tseStartedAt = stream.createdAt;
      card.dataset.tseOfflineHits = '0';
      delete card.dataset.tseOfflineTs;
      // Le streamer redémarre après une période offline confirmée : on retire
      // les deux flags pour que la carte redevienne visible. C'est le chemin
      // qui répare le sens offline → live, et il est désormais emprunté dès
      // que l'entrée de cache périme (LIVE_TTL), sans attendre autre chose.
      delete card.dataset.tseGqlOffline;
      delete card.dataset.tseOffline;
      renderUptime(card, stream.createdAt);
      updateFreshness(card);
      // Données fraîches issues de la même réponse. Le compteur affiché est
      // celui du co-stream quand il y en a un (lecture pure du cache Guest
      // Star, déjà alimenté par la détection de co-stream du même scan).
      renderViewers(card, data.viewers, getCollabViewers(data.id));
      if (data.game) {
        card.dataset.tseCategory = data.game;
        renderCategory(card, data.game, card.dataset.tseLogin);
      }
    } else {
      // Confirmation : il faut OFFLINE_CONFIRM réponses "stream=null"
      // consécutives pour basculer en "Terminé". Évite les faux positifs
      // ponctuels (Twitch lent, hiccup réseau). Une fois confirmé, on
      // pose tseGqlOffline (source de vérité prioritaire au DOM Twitch)
      // et tseOffline → la carte est masquée par CSS. Sans ça la carte
      // restait visible avec "Terminé" indéfiniment, car Twitch ne
      // retire pas toujours la carte de la sidebar en temps réel.
      const counted = card.dataset.tseOfflineTs === String(data.ts);
      let hits = parseInt(card.dataset.tseOfflineHits, 10) || 0;
      if (!counted) {
        hits += 1;
        card.dataset.tseOfflineHits = String(hits);
        card.dataset.tseOfflineTs = String(data.ts);
      }
      if (hits >= CFG.OFFLINE_CONFIRM && card.dataset.tseGqlOffline !== 'true') {
        // Masquage offline confirmé via GQL (hors scan synchrone). On ne
        // traite que la TRANSITION (carte pas encore masquée) pour ne pas
        // re-signaler à chaque scan une carte déjà offline.
        removeUptime(card);
        removeViewers(card);
        card.dataset.tseGqlOffline = 'true';
        card.dataset.tseOffline = 'true';
        // Annule la confirmation de stabilité du voile et programme un
        // scan : le prochain notifyScan ré-évaluera s'il reste du
        // Déconnecté à masquer avant de relancer la confirmation.
        loadingOverlay.bumpActivity();
        scheduleScan();
      }
    }
    applyCardVisibility(card);
  };

  async function processCard(card) {
    if (isCardOffline(card)) {
      // Compte les NOUVELLES transitions (carte pas encore masquée). Ce
      // compteur est lu en fin de scanSidebar : tant qu'il est > 0, le
      // voile de chargement reste (la sidebar masque encore du Déconnecté).
      if (card.dataset.tseOffline !== 'true') offlineTransitionsThisScan++;
      card.dataset.tseOffline = 'true';
      // Twitch a basculé la carte hors ligne : notre compteur n'a plus de sens
      // et le marqueur qui masque le sien doit tomber, sinon le libellé
      // « Déconnecté » resterait caché derrière un nombre figé si la carte
      // redevenait visible. Idempotent (le second passage ne trouve plus rien).
      removeViewers(card);
      return;
    }
    // Si on a déjà confirmé l'offline via GQL, on garde la carte masquée
    // jusqu'à preuve du contraire (réponse GQL avec createdAt valide).
    // Sans cette protection, la carte clignote visible pendant chaque
    // requête GQL en cours, car le DOM Twitch montre encore le live
    // indicator alors que le stream est en réalité terminé.
    if (card.dataset.tseGqlOffline === 'true') {
      card.dataset.tseOffline = 'true';
    } else {
      delete card.dataset.tseOffline;
    }

    applyCollabBadge(card);
    markExtraRows(card);

    const link = card.querySelector(DOM.cardLinkSelector);
    const login = loginFromHref(link?.getAttribute('href'));
    if (!login) return;

    // Carte recyclée par React sur une AUTRE chaîne : les données de la
    // précédente n'ont plus rien à y faire (elles resteraient affichées
    // jusqu'à la première réponse pour le nouveau login). À faire AVANT
    // l'amorçage ci-dessous, qui doit repartir du DOM de la nouvelle chaîne.
    if (card.dataset.tseLogin && card.dataset.tseLogin !== login) {
      delete card.dataset.tseStartedAt;
      delete card.dataset.tseOfflineHits;
      delete card.dataset.tseOfflineTs;
      delete card.dataset.tseGqlOffline;
      delete card.dataset.tseCategory;
      delete card.dataset.tseLangs;
      removeViewers(card);
    }
    card.dataset.tseLogin = login;

    // Catégorie affichée par Twitch : AMORCE seulement, tant que l'API n'a
    // rien dit. Une fois la valeur de TseChannels posée (applyChannelData), on
    // ne revient plus en arrière — relire le DOM à chaque scan la ferait
    // osciller entre la valeur périmée de Twitch et la nôtre, et les options
    // du filtre catégorie se reconstruiraient en boucle sur deux valeurs
    // différentes. La provenance est portée par la simple présence du dataset.
    if (!card.dataset.tseCategory) {
      const category = getCardCategory(card);
      if (category) card.dataset.tseCategory = category;
    }

    // Chemin rapide : entrée encore fraîche → application synchrone, sans
    // réseau ni microtâche. C'est le cas de l'immense majorité des passages
    // (les scans sont déclenchés par chaque mutation de la sidebar).
    const cached = getFreshChannel(login);
    if (cached) { applyChannelData(card, cached); return; }

    // Entrée périmée ou inconnue : on la remet en file. Le batch part dans
    // BATCH_DELAY, découpé en tranches (cf. flushQueue).
    const data = await fetchChannel(login);
    if (!document.contains(card)) return;
    // La carte a pu être recyclée sur une autre chaîne pendant l'attente.
    if (card.dataset.tseLogin !== login) return;
    applyChannelData(card, data);
  }

  /* ============================================================
   *  AUTO-EXPANSION "Afficher plus" + masquage "Afficher moins"
   * ============================================================ */
  let lastFollowedCount = -1;

  // Masque le bouton "Afficher moins" — inutile puisqu'on auto-expand toujours.
  // On masque le bouton ET son éventuel wrapper de cellule pour ne pas laisser
  // un vide visuel ; on retient la classe sur le bouton lui-même pour pouvoir
  // l'identifier au prochain scan sans recourir à un re-match textuel.
  function hideShowLessButton() {
    const section = followedSection();
    if (!section) return;
    // 1) Hook STABLE (toutes langues) : data-a-target / data-test-selector.
    section.querySelectorAll(DOM.showLessStableSelector).forEach(btn => {
      if (!btn.classList.contains('tse-show-less-hidden')) {
        btn.classList.add('tse-show-less-hidden');
      }
    });
    // 2) Repli textuel (langues listées) au cas où Twitch retirerait le hook.
    section.querySelectorAll('button').forEach(btn => {
      if (btn.classList.contains('tse-show-less-hidden')) return;
      if (DOM.showLessLabels.includes((btn.textContent || '').trim())) {
        btn.classList.add('tse-show-less-hidden');
      }
    });
  }

  function autoExpandFollowed() {
    const section = followedSection();
    if (!section) return;

    // Compte les seules cartes de Twitch : c'est leur nombre qui dit si
    // « Afficher plus » a encore de la matière à charger. Y mêler les nôtres
    // simulerait une croissance et déclencherait des clics inutiles.
    const cards = [...section.querySelectorAll('.side-nav-card')].filter(c => !isSynthetic(c));
    const currentCount = cards.length;
    if (currentCount === 0) return;

    if (currentCount < lastFollowedCount) lastFollowedCount = -1;
    if (currentCount === lastFollowedCount) {
      hideShowLessButton();
      return;
    }

    const button = section.querySelector(DOM.showMoreStableSelector) ||
      [...section.querySelectorAll('button')]
        .find(btn => DOM.showMoreLabels.includes((btn.textContent || '').trim()));

    if (!button) {
      lastFollowedCount = currentCount;
      hideShowLessButton();
      return;
    }
    lastFollowedCount = currentCount;
    button.click();
  }

  /* ============================================================
   *  VISIBILITÉ DES SECTIONS
   *  -------------------------------------------------------------
   *  Règles :
   *   - "Chaînes suivies" : toujours visible (interface du filtre/tri)
   *   - Autres sections ("Chaînes live", "Les spectateurs de X regardent aussi") :
   *       • masquées si un filtre catégorie est actif (l'utilisateur a
   *         explicitement réduit son champ aux Chaînes suivies)
   *       • masquées si elles ne contiennent aucune carte visible
   * ============================================================ */
  function updateSectionsVisibility() {
    const sections = document.querySelectorAll('#side-nav .side-nav-section');
    // Cohérent avec applyCardVisibility : en mode réduit les filtres
    // catégorie/langue sont neutralisés (illisibles + UI masquée), sinon les
    // sections live seraient masquées à tort.
    const filterActive = !sidebarCollapsed &&
      (state.categoryFilter !== null || state.languageFilter !== null);
    // En mode « Top Chaînes », les sections de recommandation de Twitch
    // — « Chaînes live », « Les spectateurs de X regardent aussi » — parlent
    // de ce que l'utilisateur suit. Elles n'ont plus de rapport avec ce qui
    // est affiché : on les masque, comme le fait un filtre explicite.
    const hideOthers = filterActive || state.globalMode;

    sections.forEach(section => {
      // La section suivie reste toujours visible (elle porte notre UI filtre/tri).
      // Identifiée de façon INDÉPENDANTE DE LA LANGUE par son header
      // `followed-side-nav-header` ; repli sur l'aria-label localisé.
      const label = section.getAttribute('aria-label') || '';
      const isFollowed = !!section.querySelector(DOM.followedHeaderSelector) ||
                         DOM.followedLabels.includes(label);
      if (isFollowed) {
        section.classList.remove('tse-section-hidden');
        return;
      }

      if (hideOthers) {
        section.classList.add('tse-section-hidden');
        return;
      }

      let visible = 0;
      section.querySelectorAll('.side-nav-card').forEach(card => {
        if (card.dataset.tseOffline === 'true') return;
        if (card.style.display === 'none') return;
        visible++;
      });
      section.classList.toggle('tse-section-hidden', visible === 0);
    });
  }

  /* ============================================================
   *  BARRE FILTRE
   * ============================================================ */
  const FILTER_ID = 'tse-filter';
  const CAT_DD_ID  = 'tse-cat-dd';
  const LANG_DD_ID = 'tse-lang-dd';
  // getAllLabel() lu dynamiquement pour suivre LANG si elle bascule.
  const getAllLabel = () => S.uiFilterAllCategories;
  // Les DEUX filtres sont des dropdowns personnalisés (et non des <select>
  // natifs) : un <option> ne peut afficher que du texte (pas les drapeaux SVG)
  // et on veut une présentation homogène (compteurs, libellés, états).

  // Ferme tous les menus ouverts sauf, éventuellement, celui passé en argument.
  function closeMenus(except) {
    document.querySelectorAll('.tse-dd.tse-open').forEach(dd => {
      if (dd === except) return;
      dd.classList.remove('tse-open');
      const btn = dd.querySelector('.tse-dd-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }
  // Clic extérieur / Échap → ferme les menus (lié une seule fois, global).
  let ddBound = false;
  function bindDropdownsGlobal() {
    if (ddBound) return;
    ddBound = true;
    // Capture : exécuté avant les handlers de bouton ; on ferme tous les menus
    // sauf celui dans lequel on clique (son propre handler gère sa bascule).
    document.addEventListener('click', (e) => closeMenus(e.target.closest('.tse-dd')), true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  }
  // Branche un dropdown : bascule au clic sur le bouton, sélection au clic sur
  // une option (délégation). La facette est lue sur data-facet.
  function wireDropdown(dd) {
    const btn  = dd.querySelector('.tse-dd-btn');
    const menu = dd.querySelector('.tse-dd-menu');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      const open = dd.classList.toggle('tse-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', (e) => {
      const opt = e.target.closest('.tse-dd-opt');
      if (!opt) return;
      e.stopPropagation();
      closeMenus();
      onFilterChange(dd.dataset.facet, opt.dataset.value || null);
    });
  }

  // Squelette d'un dropdown personnalisé (bouton + menu). `initialCurrent` est
  // le contenu affiché par défaut (libellé « toutes » de la facette).
  const ddSkeleton = (id, facet, modifier, ariaLabel, initialCurrent) => `
    <div id="${id}" class="tse-dd ${modifier}" data-facet="${facet}">
      <button type="button" class="tse-dd-btn" aria-haspopup="listbox" aria-expanded="false"
              aria-label="${escapeHtml(ariaLabel)}">
        <span class="tse-dd-current">${initialCurrent}</span>
        <span class="tse-dd-caret" aria-hidden="true"></span>
      </button>
      <div class="tse-dd-menu" role="listbox"></div>
    </div>`;

  // Crée la barre de filtre : UNE ligne avec deux dropdowns personnalisés
  // identiques — catégorie (extensible, libellé tronqué « … ») à gauche,
  // langue (drapeaux, compacte) collée à droite — puis (via ensureSortRow) la
  // rangée de tri centrée dessous. Idempotent ; recréé tel quel au re-mount.
  function ensureFilterBar() {
    if (document.getElementById(FILTER_ID)) return;

    const sideNav = document.querySelector(DOM.sidebarRoot);
    if (!sideNav) return;
    // INDÉPENDANT DE LA LANGUE : followedSection() retombe sur l'ancre
    // structurelle `followed-side-nav-header` quand l'aria-label localisé
    // (fr/en/de/es/pt) ne correspond pas — sinon la barre filtre/tri ne se monterait
    // jamais sur une UI Twitch dans une langue non listée.
    const section = followedSection();
    if (!section || !sideNav.contains(section)) return;

    const wrap = document.createElement('div');
    wrap.id = FILTER_ID;
    wrap.className = 'tse-filter';
    wrap.innerHTML = `
      <div class="tse-filter-row">
        <div class="tse-filter-field tse-filter-field--cat">
          ${ddSkeleton(CAT_DD_ID, 'category', 'tse-dd--cat', S.uiFilterAriaLabel, escapeHtml(getAllLabel()))}
        </div>
        <div class="tse-filter-field tse-filter-field--lang">
          ${ddSkeleton(LANG_DD_ID, 'language', 'tse-dd--lang', S.uiFilterLangAriaLabel, GLOBE_MARKUP)}
        </div>
      </div>
    `;
    section.parentElement.insertBefore(wrap, section);

    wireDropdown(wrap.querySelector(`#${CAT_DD_ID}`));
    wireDropdown(wrap.querySelector(`#${LANG_DD_ID}`));
    bindDropdownsGlobal();
  }

  // Changement utilisateur d'un filtre : enregistre la sélection et désigne la
  // facette « pilote » (la dernière choisie). L'autre devient dépendante.
  // Effacer une facette promeut l'autre pilote si elle porte un choix
  // utilisateur, sinon remet tout à zéro. Re-sélection identique = no-op
  // (évite un changement de pilote parasite).
  function onFilterChange(facet, value) {
    const cur = facet === 'category' ? state.categoryFilter : state.languageFilter;
    if (value === cur) return;
    if (facet === 'category') {
      state.categoryFilter = value;
      state.filterDriver = value ? 'category' : (state.languageFilter ? 'language' : null);
      // En mode Top Chaînes, changer de catégorie ne filtre pas l'affichage :
      // cela change ce qu'on DEMANDE à l'API. Le classement courant devient
      // caduc, donc on lance la requête sans attendre le prochain réveil, et
      // on voile tant qu'il n'y a rien à montrer — comme à l'entrée du mode.
      // Revenir à « toutes les catégories » ne voile pas : le classement
      // mondial n'a pas été purgé, il est servi immédiatement.
      if (state.globalMode) {
        globalChannels.tick();
        if (!globalChannels.top(1).length) loadingOverlay.startCycle('changement de catégorie');
        scheduleScan();
      }
    } else {
      state.languageFilter = value;
      state.filterDriver = value ? 'language' : (state.categoryFilter ? 'category' : null);
    }
    recomputeFilters();
  }

  /* ============================================================
   *  LIGNE DES BOUTONS DE TRI
   *  -------------------------------------------------------------
   *  Insérée dans le bloc filtre, sous la ligne des deux dropdowns.
   *  N boutons toggle mutuellement exclusifs. Un mode reste toujours
   *  actif : cliquer sur le bouton du mode courant n'a aucun effet ;
   *  pour changer, on clique sur un autre bouton.
   *  L'ordre du tableau getSortButtons() définit l'ordre d'affichage de
   *  gauche à droite.
   *
   *  Modes disponibles :
   *    • viewers  — nombre de viewers (décroissant) — défaut au boot
   *    • popular  — popularité personnelle (cf. module visits)
   *    • uptime   — durée de stream (croissant : récents en premier)
   *    • alpha    — pseudo alphabétique
   *    • costream — groupes de co-stream regroupés en tête
   *                 (désactivé si aucun groupe détecté)
   * ============================================================ */
  const SORT_ROW_ID = 'tse-sort-row';

  // SVG inline. Tous les paths utilisent currentColor.
  const SVG_EYE =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 5C6.5 5 2.7 9.6 1.5 12c1.2 2.4 5 7 10.5 7s9.3-4.6 10.5-7C21.3 9.6 17.5 5 12 5Zm0 12c-4.1 0-7.3-3.3-8.5-5 1.2-1.7 4.4-5 8.5-5s7.3 3.3 8.5 5c-1.2 1.7-4.4 5-8.5 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>' +
    '</svg>';
  const SVG_CLOCK =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7Z"/>' +
    '</svg>';
  // Maillons de chaîne (groupes de co-stream)
  const SVG_LINK =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3-3a1 1 0 1 1 1.4 1.4l-3 3a1 1 0 0 1-1.4 0Zm-3.3 4.7a3.5 3.5 0 0 1 0-5l2.5-2.5a1 1 0 0 1 1.4 1.4L8.7 14.5a1.5 1.5 0 1 0 2.1 2.1l2.5-2.5a1 1 0 0 1 1.4 1.4l-2.5 2.5a3.5 3.5 0 0 1-5 0Zm10-10a3.5 3.5 0 0 1 0 5L14.8 15.6a1 1 0 0 1-1.4-1.4l2.5-2.5a1.5 1.5 0 1 0-2.1-2.1L11.3 12a1 1 0 0 1-1.4-1.4l2.5-2.5a3.5 3.5 0 0 1 5 0Z"/>' +
    '</svg>';
  // Étoile pleine (popularité personnelle / fréquence de visite)
  const SVG_STAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>' +
    '</svg>';
  // "A↓Z" (tri alphabétique)
  const SVG_ALPHA =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M3.5 16h2.3l.5-1.5h2.6L9.4 16h2.3L8.9 8H6.3L3.5 16Zm3.5-6.7.9 2.9H6.1l.9-2.9ZM17 5v10.6l1.8-1.8 1.4 1.4-4.2 4.2-4.2-4.2 1.4-1.4 1.8 1.8V5h2Z"/>' +
    '</svg>';

  // Spécifications déclaratives des boutons. Pour en ajouter un :
  //   1. ajouter une entrée ici (avec un mode unique)
  //   2. ajouter le case correspondant dans applySorting()
  // L'ordre du tableau définit l'ordre d'affichage de gauche à droite.
  // getSortButtons() lu dynamiquement pour suivre LANG si elle bascule.
  const getSortButtons = () => [
    { mode: 'viewers',  svg: SVG_EYE,   label: S.uiSortLabelViewers  },
    { mode: 'popular',  svg: SVG_STAR,  label: S.uiSortLabelPopular  },
    { mode: 'uptime',   svg: SVG_CLOCK, label: S.uiSortLabelUptime   },
    { mode: 'alpha',    svg: SVG_ALPHA, label: S.uiSortLabelAlpha    },
    { mode: 'costream', svg: SVG_LINK,  label: S.uiSortLabelCostream },
  ];

  function ensureSortRow() {
    if (document.getElementById(SORT_ROW_ID)) return;
    const filterBar = document.getElementById(FILTER_ID);
    if (!filterBar) return;

    const row = document.createElement('div');
    row.id = SORT_ROW_ID;
    row.className = 'tse-sort-row';
    row.innerHTML = getSortButtons().map(spec => `
      <button type="button" class="tse-sort-toggle" data-tse-sort-mode="${spec.mode}"
              aria-pressed="${state.sortMode === spec.mode ? 'true' : 'false'}"
              title="${escapeHtml(spec.label)}"
              aria-label="${escapeHtml(spec.label)}">
        ${spec.svg}
      </button>
    `).join('');
    filterBar.appendChild(row);

    const buttons = [...row.querySelectorAll('button[data-tse-sort-mode]')];

    const refreshPressed = () => {
      buttons.forEach(btn => {
        const mode = btn.dataset.tseSortMode;
        btn.setAttribute('aria-pressed', state.sortMode === mode ? 'true' : 'false');
      });
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.tseSortMode;
        if (btn.disabled) return; // sécurité, le CSS pointer-events bloque déjà
        // Cliquer sur le mode actif ne le désactive pas : un mode de tri
        // reste TOUJOURS actif. Pour changer, l'utilisateur clique sur un
        // autre bouton (mutuellement exclusif).
        if (state.sortMode === mode) return;
        state.sortMode = mode;
        refreshPressed();
        applySorting();
      });
    });
  }

  /**
   * Active ou désactive les boutons de tri selon les données disponibles.
   * Pour le moment, seul "costream" est conditionnel (pas de groupe → disabled).
   * Les autres modes sont toujours utilisables.
   *
   * Effet de bord : si le mode actuellement actif devient indisponible
   * (ex. le tri co-stream est ON puis le dernier co-stream se termine),
   * on rebascule en 'viewers' (mode par défaut au boot). On ne retombe
   * pas sur 'default' car ce mode n'est pas accessible volontairement
   * à l'utilisateur.
   *
   * Retourne true si le mode a été forcé (signal qu'un applySorting
   * devrait être relancé — ce que scanSidebar fait déjà naturellement).
   */
  function updateSortButtonsState({ costreamGroups }) {
    const row = document.getElementById(SORT_ROW_ID);
    if (!row) return false;

    // Disponibilité par mode. Tous true sauf 'costream' qui requiert
    // qu'au moins un groupe ait été détecté par detectCoStreams().
    const available = {
      viewers:  true,
      popular:  true,
      uptime:   true,
      alpha:    true,
      costream: costreamGroups > 0,
    };

    let modeForced = false;
    const buttons = [...row.querySelectorAll('button[data-tse-sort-mode]')];

    buttons.forEach(btn => {
      const mode = btn.dataset.tseSortMode;
      const ok = available[mode] !== false;
      btn.disabled = !ok;
      // Tooltip étendu quand désactivé, pour expliquer pourquoi.
      if (!ok && mode === 'costream') {
        btn.title = S.uiSortNoCoStreams;
      } else {
        const spec = getSortButtons().find(s => s.mode === mode);
        if (spec) btn.title = spec.label;
      }
      // Fallback : si le mode actif vient d'être désactivé, basculer vers
      // 'viewers' (le mode par défaut au démarrage). On ne retombe pas sur
      // 'default' car ce mode n'est plus accessible volontairement à
      // l'utilisateur — un mode de tri custom reste toujours actif.
      if (!ok && state.sortMode === mode) {
        state.sortMode = 'viewers';
        modeForced = true;
      }
    });

    // Resync visuelle des aria-pressed si un fallback a eu lieu (le bouton
    // qui devient pressé n'est pas forcément celui qu'on vient de visiter).
    if (modeForced) {
      buttons.forEach(b => {
        b.setAttribute('aria-pressed', state.sortMode === b.dataset.tseSortMode ? 'true' : 'false');
      });
    }
    return modeForced;
  }

  /* ============================================================
   *  RENOMMAGE DU TITRE RACINE "Pour vous" → "Chaînes suivies"
   *  -------------------------------------------------------------
   *  Le <h3> "Pour vous" vit dans .side-nav__title (en dehors des
   *  sections). On le réécrit en place pour conserver son style
   *  natif (taille, font, couleur) sans CSS supplémentaire.
   * ============================================================ */
  function renameRootTitle() {
    const root = document.querySelector('#side-nav .side-nav__title h3');
    if (!root) return;
    // Idempotence textuelle (pas de court-circuit data-marker) :
    // si LANG bascule après le boot, le titre est automatiquement
    // re-traduit au prochain appel.
    // Le titre porte le nom du MODE : c'est lui qui dit à l'utilisateur ce
    // qu'il regarde, le bouton à sa droite ne faisant qu'en changer.
    const wanted = state.globalMode ? S.uiGlobalLabel : S.followedLabel;
    const current = (root.textContent || '').trim();
    if (current === wanted) {
      root.dataset.tseRenamed = 'true';
      return;
    }
    root.textContent = wanted;
    root.dataset.tseRenamed = 'true';
  }

  /**
   * Fallback JS pour masquer le header natif Twitch quand le sélecteur CSS
   * ne le couvre pas (renaming des classes hashées par Twitch). On identifie
   * l'élément par son contenu textuel — il contient soit "Spectateurs", soit
   * "Recommandées" — et on remonte au wrapper qui porte l'attribut
   * aria-expanded (= le trigger du modal). Marquage idempotent via dataset.
   */
  /**
   * Masque l'en-tête natif de la section suivie — titre ET bouton de tri.
   *
   * C'était déjà l'intention d'origine ; elle reposait sur un match TEXTUEL
   * du libellé du bouton (« Spectateurs », « Recommandées »…). Twitch a
   * depuis vidé ce libellé — son bouton ne porte plus qu'une icône — et la
   * règle ne s'appliquait donc plus à personne. Relevé sur DOM réel :
   *
   *   <div class="… followed-side-nav-header followed-side-nav-header--expanded">
   *     <button aria-expanded="false"> … <h3>Chaînes suivies</h3> … </button>
   *
   * On masque désormais le bloc par sa CLASSE, indépendante de la langue et
   * du contenu. Deux bénéfices : le tri natif de Twitch ne peut plus entrer
   * en conflit avec le nôtre, et le titre de section — redondant avec le
   * titre racine, qui porte déjà le nom du mode — disparaît avec lui.
   */
  function hideNativeFollowedHeader() {
    const section = followedSection();
    if (!section) return;
    const block = section.querySelector(DOM.followedHeaderSelector);
    if (!block) return;
    if (block.getAttribute('data-tse-native-header') === 'hidden') return;
    block.setAttribute('data-tse-native-header', 'hidden');
    // Masquage EN LIGNE et !important, en plus de la règle de feuille.
    // Constaté en production : l'en-tête restait visible malgré
    // `[class*="followed-side-nav-header"] { display: none !important }`.
    // Un style en ligne !important ne peut être battu par aucune feuille,
    // quelle que soit la spécificité ou l'ordre d'injection. Si React
    // réécrit l'attribut style, le scan suivant le repose.
    block.style.setProperty('display', 'none', 'important');
  }

  // Comparateur : nombre de streamers décroissant, puis alpha (rendu stable).
  const byCountDesc = (counts) => (a, b) =>
    (counts.get(b) - counts.get(a)) || a.localeCompare(b, S.locale);

  /**
   * Reconstruit un dropdown personnalisé (catégorie ou langue) :
   *   - bouton fermé : libellé de la sélection (nom de catégorie / drapeau de
   *     langue) ou le libellé « toutes » (texte / globe SVG) ;
   *   - menu : ligne « toutes » puis chaque option « N | libellé », déjà triée
   *     par compteur décroissant.
   * Garde de signature (dataset.tseSig) : on ne réécrit le DOM — donc on ne
   * ferme le menu — que si quelque chose a changé.
   *   kind='cat'  : libellé = nom de catégorie (texte), « toutes » = libellé i18n.
   *   kind='lang' : libellé = drapeau SVG (repli code), « toutes » = globe SVG.
   */
  //   fmt         : rendu du compteur. Par défaut le nombre brut (« 3 |
  //                 Just Chatting » = trois chaînes suivies). En mode Top
  //                 Chaînes le compteur est une AUDIENCE, pas un décompte de
  //                 chaînes : on y passe formatViewers (« 122 k | VALORANT »).
  function rebuildDropdown(dd, values, counts, current, disabled, kind, fmt = String) {
    const btn  = dd.querySelector('.tse-dd-btn');
    const cur  = dd.querySelector('.tse-dd-current');
    const menu = dd.querySelector('.tse-dd-menu');

    const itemLabel = (v) => kind === 'lang'
      ? langIcon(v)
      : `<span class="tse-dd-name">${escapeHtml(v)}</span>`;
    const allLabel  = kind === 'lang'
      ? GLOBE_MARKUP
      : escapeHtml(getAllLabel());
    const allTitle  = kind === 'lang' ? S.uiFilterAllLanguages : S.uiFilterAllCategories;

    const sig = `${kind}|${disabled ? 'D' : ''}|cur=${current || ''}|${values.map(v => v + '#' + (counts.get(v) || 0)).join('\u00A7')}`;
    if (dd.dataset.tseSig !== sig) {
      dd.dataset.tseSig = sig;
      cur.innerHTML = current ? itemLabel(current) : allLabel;
      const allRow = `<div class="tse-dd-opt" role="option" data-value="" aria-selected="${!current}" `
        + `title="${escapeHtml(allTitle)}">${allLabel}</div>`;
      const rows = values.map(v =>
        `<div class="tse-dd-opt" role="option" data-value="${escapeHtml(v)}" aria-selected="${v === current}">`
        + `<span class="tse-dd-n">${escapeHtml(fmt(counts.get(v) || 0))} |</span>${itemLabel(v)}</div>`).join('');
      menu.innerHTML = allRow + rows;
    }
    btn.disabled = disabled;
    const base = kind === 'lang' ? S.uiFilterLangAriaLabel : S.uiFilterAriaLabel;
    btn.setAttribute('aria-label', current ? `${base} : ${current}` : base);
    if (disabled && dd.classList.contains('tse-open')) {  // ferme uniquement CE menu
      dd.classList.remove('tse-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Recalcule et applique les DEUX filtres (catégorie + langue) de façon
   * croisée :
   *   - la facette « pilote » (state.filterDriver, dernière choisie par
   *     l'utilisateur) propose toutes ses valeurs et reste éditable ;
   *   - la facette « dépendante » ne propose que les valeurs cohérentes avec
   *     le pilote ; s'il n'en reste qu'UNE → auto-sélection + désactivation
   *     (grisée) ; s'il n'en reste AUCUNE → vidée + désactivée.
   * Lit aussi les langues (langStore, cache TseChannels) et les mémorise sur
   * chaque carte (data-tse-langs) pour applyCardVisibility. Idempotent.
   */
  function recomputeFilters() {
    const catDD  = document.getElementById(CAT_DD_ID);
    const langDD = document.getElementById(LANG_DD_ID);
    if (!catDD || !langDD) return;
    const section = followedSection();
    if (!section) return;

    // 1. Cartes live suivies → enregistrements { cat, langs[] }.
    const records = [];
    section.querySelectorAll('.side-nav-card').forEach(card => {
      if (card.dataset.tseOffline === 'true') return;
      const login = card.dataset.tseLogin;
      if (!login) return;
      const resolved = langStore.getLangs(login); // lecture du cache TseChannels
      if (resolved) card.dataset.tseLangs = resolved.length ? '|' + resolved.join('|') + '|' : '';
      const langs = (card.dataset.tseLangs || '').split('|').filter(Boolean);
      records.push({ cat: card.dataset.tseCategory || '', langs });
    });

    // ── Mode Top Chaînes : la catégorie n'est pas un filtre ─────────────
    // Elle décide de ce qu'on DEMANDE à l'API (cf. globalChannels, portée).
    // Sa liste vient donc du classement des catégories — les 100 premières,
    // avec leur audience réelle — et non des cartes affichées, qui n'en
    // couvrent qu'une poignée. Le croisement des deux facettes, lui, n'a plus
    // de sens ici : la langue reste un vrai filtre sur les cartes présentes.
    if (state.globalMode) {
      const cats = globalChannels.cats(CFG.GLOBAL_CATEGORIES_MAX);
      const catCount = new Map(cats.map(c => [c.name, c.viewers]));
      // La sélection n'est PAS validée contre les catégories connues : la
      // liste peut être vide au tout premier scan, et invalider le choix de
      // l'utilisateur à cet instant le lui ferait perdre sans raison.
      const langsPresent = new Set(records.flatMap(r => r.langs));
      const Lg = state.languageFilter && langsPresent.has(state.languageFilter)
        ? state.languageFilter : null;
      state.languageFilter = Lg;
      const langCount = new Map([...langsPresent].map(l =>
        [l, records.filter(r => r.langs.includes(l)).length]));
      rebuildDropdown(catDD, cats.map(c => c.name), catCount,
                      state.categoryFilter, cats.length === 0, 'cat', formatViewers);
      rebuildDropdown(langDD, [...langsPresent].sort(byCountDesc(langCount)),
                      langCount, Lg, langsPresent.size <= 1, 'lang');
      const wrapG = document.getElementById(FILTER_ID);
      if (wrapG) wrapG.dataset.tseActive = (state.categoryFilter || Lg) ? 'true' : 'false';
      applyCategoryFilter();
      return;
    }

    const allCats  = new Set(records.map(r => r.cat).filter(Boolean));
    const allLangs = new Set(records.flatMap(r => r.langs));

    // 2. Valide les sélections contre les données présentes, puis le pilote.
    let C  = state.categoryFilter && allCats.has(state.categoryFilter)  ? state.categoryFilter : null;
    let Lg = state.languageFilter && allLangs.has(state.languageFilter) ? state.languageFilter : null;
    let driver = state.filterDriver;
    if (driver === 'category' && !C)  driver = null;
    if (driver === 'language' && !Lg) driver = null;
    if (!driver) driver = C ? 'category' : (Lg ? 'language' : null);

    // 3. Options par facette + valeur d'AFFICHAGE de la facette dépendante.
    //    IMPORTANT — distinction « forcé » vs « affiné » :
    //    • Quand le dépendant n'a qu'UNE valeur possible (ou zéro), il est
    //      VERROUILLÉ : on l'affiche (dispC/dispLg) et on le grise, mais cette
    //      valeur n'est PAS un filtre utilisateur → on ne la persiste pas et on
    //      ne l'applique pas à la visibilité (le pilote seul produit déjà le bon
    //      sous-ensemble). Cela évite qu'une valeur forcée « colle » lors d'un
    //      changement de pilote ou soit promue pilote à l'effacement.
    //    • Quand le dépendant a ≥2 valeurs, l'utilisateur peut l'AFFINER ; ce
    //      choix-là (Lg/C) est un vrai filtre, persisté et appliqué.
    let catOpts = allCats, langOpts = allLangs;
    let dispC = C, dispLg = Lg, catDisabled = false, langDisabled = false;
    if (driver === 'category') {
      const ls = new Set(records.filter(r => r.cat === C).flatMap(r => r.langs));
      langOpts = ls;
      if (ls.size <= 1) {                 // verrouillé (0 ou 1 langue)
        langDisabled = true;
        dispLg = ls.size === 1 ? [...ls][0] : null; // affichage forcé (ou aucun)
        Lg = null;                                   // jamais persisté / visibilité
      } else {
        if (Lg && !ls.has(Lg)) Lg = null;            // affinage invalidé
        dispLg = Lg;
      }
    } else if (driver === 'language') {
      const cs = new Set(records.filter(r => r.langs.includes(Lg)).map(r => r.cat).filter(Boolean));
      catOpts = cs;
      if (cs.size <= 1) {                 // verrouillé (0 ou 1 catégorie)
        catDisabled = true;
        dispC = cs.size === 1 ? [...cs][0] : null;
        C = null;
      } else {
        if (C && !cs.has(C)) C = null;
        dispC = C;
      }
    }

    // 4. Persiste les CHOIX UTILISATEUR (jamais les valeurs forcées).
    state.categoryFilter = C;
    state.languageFilter = Lg;
    state.filterDriver   = driver;

    // 5. Compteurs de streamers par option. La facette dépendante est comptée
    //    en tenant compte de la sélection du pilote (ex. nb de FR DANS la
    //    catégorie choisie) ; le pilote affiche ses totaux bruts.
    const filterByLang = driver === 'language'; // → la catégorie (dépendante) est filtrée par Lg
    const filterByCat  = driver === 'category';  // → la langue (dépendante) est filtrée par C
    const catCount  = new Map();
    catOpts.forEach(x => catCount.set(x,
      records.filter(r => r.cat === x && (!filterByLang || r.langs.includes(Lg))).length));
    const langCount = new Map();
    langOpts.forEach(l => langCount.set(l,
      records.filter(r => r.langs.includes(l) && (!filterByCat || r.cat === C)).length));

    // 6. Reconstruit les deux dropdowns (triés par compteur décroissant). La
    //    sélection AFFICHÉE peut être une valeur forcée (dispC/dispLg).
    rebuildDropdown(catDD,  [...catOpts].sort(byCountDesc(catCount)),  catCount,  dispC,  catDisabled,  'cat');
    rebuildDropdown(langDD, [...langOpts].sort(byCountDesc(langCount)), langCount, dispLg, langDisabled, 'lang');
    const wrap = document.getElementById(FILTER_ID);
    if (wrap) wrap.dataset.tseActive = (C || Lg) ? 'true' : 'false';

    // 7. Applique la visibilité (cartes + sections) selon les choix utilisateur.
    applyCategoryFilter();
  }

  // Ré-applique la visibilité de TOUTES les cartes selon les deux filtres
  // (catégorie + langue, cf. applyCardVisibility) puis ajuste les sections.
  // Nom historique conservé.
  function applyCategoryFilter() {
    document.querySelectorAll('#side-nav .side-nav-card').forEach(applyCardVisibility);
    updateSectionsVisibility();
  }

  /* ============================================================
   *  DÉTECTION CO-STREAM
   *  -------------------------------------------------------------
   *  Deux sources, par ordre de fiabilité :
   *    1. Guest Star (host.id partagé) — source de vérité pour les
   *       co-streams "Streamer ensemble". Clé stable gs:<hostId>.
   *    2. Repli heuristique (catégorie + viewers identiques) — ne
   *       sert que si Guest Star ne peut pas trancher.
   *
   *  Chaque groupe reçoit une couleur de la palette, posée en CSS
   *  var sur ses cartes. La couleur est RÉSERVÉE par identité de
   *  groupe avec un délai de grâce : elle reste identique pour toute
   *  la durée de la collaboration, y compris au travers des
   *  disparitions transitoires (rebuild DOM de Twitch, refetch).
   * ============================================================ */
  /* Palette : une couleur par collaboration simultanée.
   *
   * RÈGLE : deux couleurs de cette liste doivent rester distinguables au
   * premier coup d'œil, sur des cartes qui peuvent se toucher. C'est un
   * écart de TEINTE qui le garantit — la saturation et la luminosité, elles,
   * se ressemblent toutes ici (couleurs claires sur fond sombre).
   *
   * L'ancienne palette empilait trois tons chauds dans un arc de 16° :
   * orange 31°, jaune doux 42°, jaune 47°. Le jaune doux et le jaune étaient
   * à 5° l'un de l'autre, soit la même couleur à l'œil nu. Les deux ont été
   * retirés — pas seulement l'orange — et un violet prend leur place dans le
   * grand vide entre le bleu et le rose.
   *
   * Teintes et écarts (mesurés) :
   *   jaune 47° → vert 122° → turquoise 176° → bleu 219° → violet 274°
   *   → rose 353° → (retour au jaune)
   *   écarts : 75°, 54°, 43°, 55°, 79°, 54°  —  MINIMUM 43° (contre 5° avant)
   *
   * Avant d'ajouter ou de modifier une entrée, vérifier que l'écart minimum
   * reste au-dessus de 40°. Le harnais de test le contrôle.
   */
  const COSTREAM_PALETTE = [
    { color: '#f5c518', bg: 'rgba(245, 197, 24, 0.18)',  fade: 'rgba(245, 197, 24, 0.06)'  }, // jaune      47°
    { color: '#7ee081', bg: 'rgba(126, 224, 129, 0.18)', fade: 'rgba(126, 224, 129, 0.06)' }, // vert      122°
    { color: '#26d4c8', bg: 'rgba(38, 212, 200, 0.18)',  fade: 'rgba(38, 212, 200, 0.06)'  }, // turquoise 176°
    { color: '#4d8cff', bg: 'rgba(77, 140, 255, 0.18)',  fade: 'rgba(77, 140, 255, 0.06)'  }, // bleu      219°
    { color: '#c77dff', bg: 'rgba(199, 125, 255, 0.18)', fade: 'rgba(199, 125, 255, 0.06)' }, // violet    274°
    { color: '#ff7a8a', bg: 'rgba(255, 122, 138, 0.18)', fade: 'rgba(255, 122, 138, 0.06)' }, // rose      353°
  ];

  // clé de groupe -> { idx: indice de palette, lastActiveTs: dernier scan actif }
  // La réservation survit à une inactivité brève (cf. COSTREAM_COLOR_GRACE),
  // ce qui garantit une couleur stable pour toute la durée de la collaboration.
  const costreamColorByKey = new Map();

  const cardHasCollab = (card) => !!card.querySelector('.tse-collab-badge');

  // Lit le chiffre N dans le badge collab. Convention Twitch (rectifiée par
  // l'utilisateur) : N représente "autres streamers en plus de celui-ci",
  // donc la taille totale du co-stream = N + 1. Exemple : badge "3" sur
  // DrFeelGood ⇒ il streame avec 3 autres personnes, soit 4 au total.
  const getCardCollabCount = (card) => {
    const badge = card.querySelector('.tse-collab-badge');
    if (!badge) return null;
    const n = parseInt((badge.textContent || '').trim(), 10);
    return Number.isFinite(n) ? n : null;
  };

  /* ============================================================
   *  CO-STREAM "STREAMER ENSEMBLE" (Guest Star) — source FIABLE
   *  -------------------------------------------------------------
   *  L'ancienne détection regroupait par "catégorie + nb de viewers
   *  identiques". Instable : les compteurs de viewers fluctuent
   *  indépendamment entre co-streamers (ex. Poko 1663 / Zaroide 70,
   *  et même le compteur combiné varie : 1722 vs 1719), d'où un
   *  coloriage clignotant.
   *
   *  Twitch expose la vérité via `guestStarChannelCollaboration` : pour
   *  un lot d'IDs de chaînes, chaque entrée porte une `session` dont
   *  `session.host.id` est PARTAGÉ par TOUS les participants d'un même
   *  co-stream. On regroupe donc par host.id — déterministe, insensible
   *  aux viewers. (Twitch l'interroge de son côté sous le nom
   *  GuestStarBatchCollaborationQuery ; on ne réutilise que le champ.)
   *
   *  La même réponse porte `collaborationViewersCount` : le compteur
   *  COMBINÉ que Twitch affiche sur la carte d'un co-streamer, à la
   *  place de son audience propre. On le récolte donc au passage, sans
   *  requête supplémentaire (cf. renderViewers).
   *
   *  Transport : post() (header Client-ID seul, donnée publique), batché
   *  et mis en cache (TTL). Requête INLINE, sans hash — cf. buildGuestStarOp.
   *  Le cache est servi en "stale-while-revalidate" : une valeur connue
   *  est renvoyée même périmée pendant son rafraîchissement, ce qui évite
   *  tout retour transitoire à l'heuristique (donc toute saute de couleur).
   *  Si aucune valeur n'a JAMAIS été apprise (réseau HS, API qui refuse),
   *  getHostId() renvoie `undefined` et detectCoStreams retombe proprement
   *  sur l'heuristique → aucune régression.
   *
   *  Valeurs de getHostId(channelId) :
   *    string    → ID de l'hôte (clé de regroupement du co-stream)
   *    null      → chaîne live mais PAS en co-stream Guest Star
   *    undefined → jamais résolu (fetch programmé) ; repli heuristique
   * ============================================================ */
  const gsCache = new Map();   // channelId -> { hostId: string|null, mates: {login,name}[], ts }
  const gsQueue = new Set();   // IDs en attente de résolution
  const gsWaiters = new Map(); // channelId -> [resolve…] : promesses en attente d'un flush
  let gsTimer = null;
  let gsCooldownUntil = 0;     // anti-martèlement après un échec global

  // Résout (et purge) les promesses requestGuestStar en attente sur ces IDs.
  const resolveGuestStarWaiters = (ids) => {
    for (const id of ids) {
      const arr = gsWaiters.get(id);
      if (arr) { gsWaiters.delete(id); arr.forEach(fn => fn(gsCache.get(id) || null)); }
    }
  };

  // Requête INLINE : elle porte son propre texte, donc AUCUN hash — rien que
  // Twitch puisse périmer unilatéralement. C'est le même choix que pour
  // TseChannels, et pour la même raison.
  //
  // Sélection réduite au strict nécessaire — host.id pour regrouper, les
  // participants pour la popup, le compteur combiné pour l'affichage. La forme
  // persistée qu'utilise Twitch en renvoie bien davantage (canJoinStatus,
  // descriptions, couleurs de profil, et un second champ racine
  // guestStarCollaborationStatuses qui duplique le premier) dont rien ici ne se
  // sert : à sélection plus courte, réponse plus légère et plus rapide.
  //
  // Les IDs sont écrits en LITTÉRAL plutôt que passés par $variables : le type
  // d'entrée exact de `options` n'est pas connu, et une déclaration de variable
  // devrait le nommer. En littéral, c'est le serveur qui fait la coercition.
  // Filtrage en chiffres seuls — les IDs de chaîne Twitch le sont toujours —
  // pour qu'aucune valeur inattendue ne puisse se glisser dans le texte envoyé.
  // Renvoie null si rien ne survit au filtre : mieux vaut ne rien demander que
  // demander une liste vide.
  //
  // VÉRIFIÉ sur gql.twitch.tv (anonyme, Client-ID public) : acceptée telle
  // quelle, elle renvoie exactement la forme lue plus bas et répond plus vite
  // que la persistée (24 ms contre 43-49).
  const buildGuestStarOp = (ids) => {
    const list = ids.filter(id => /^[0-9]+$/.test(id));
    if (!list.length) return null;
    return {
      operationName: 'TseGuestStar',
      query:
        'query TseGuestStar {' +
        `  guestStarChannelCollaboration(options: {channelIDs: [${list.map(id => `"${id}"`).join(',')}]}) {` +
        '    id' +
        '    session {' +
        '      host { id login displayName }' +
        '      guests { user { id login displayName stream { collaborationViewersCount } } }' +
        '    }' +
        '  }' +
        '}'
    };
  };

  const flushGuestStar = async () => {
    gsTimer = null;
    const ids = [...gsQueue];
    gsQueue.clear();
    if (!ids.length) return;

    const op = buildGuestStarOp(ids);
    // Aucun ID exploitable (tous écartés par le filtre) : on ne demande rien,
    // mais on libère les promesses en attente pour ne pas les laisser pendre.
    if (!op) { resolveGuestStarWaiters(ids); return; }

    const res = await post([op]);

    // Échec global (réseau, throttle, rejet applicatif) : on n'écrit rien, on
    // pose un cooldown, et le repli heuristique assure l'intérim.
    if (isResultsUnusable(res)) {
      gsCooldownUntil = Date.now() + CFG.GUEST_STAR_ERROR_COOLDOWN;
      resolveGuestStarWaiters(ids); // libère les promesses (échec) pour ne pas les laisser pendre
      return;
    }

    // La réponse renvoie un tableau guestStarChannelCollaboration, une entrée
    // par ID demandé : { id, session: { host { id login displayName },
    // guests[] { user { id login displayName } } } | null }.
    const list = res?.[0]?.data?.guestStarChannelCollaboration;
    const infoById = new Map();
    if (Array.isArray(list)) {
      for (const e of list) {
        if (!e || !e.id) continue;
        const session = e.session;
        const hostId = session?.host?.id ?? null;
        // Liste COMPLÈTE des participants (hôte + invités), dédoublonnée par
        // login (minuscule). On conserve aussi le displayName (casse correcte,
        // ex. "CommanderX") avec repli sur le login. Sert à enrichir la popup
        // ("En live avec …"). Identique pour tous les membres d'une session.
        const raw = session
          ? [session.host, ...(session.guests || []).map(g => g?.user)]
          : [];
        const seen = new Set();
        const mates = [];
        for (const u of raw) {
          const login = u?.login?.toLowerCase();
          if (!login || seen.has(login)) continue;
          seen.add(login);
          // displayName nettoyé (Twitch le renvoie parfois avec une espace de
          // fin, qui produirait "Scok , Farore"). null si absent → displayNameFor
          // capitalisera alors le login.
          mates.push({ login, name: (u.displayName || '').trim() || null });
        }
        // Compteur COMBINÉ de la session — celui que Twitch affiche sur la carte
        // d'un co-streamer, à la place de son audience propre. Chaque
        // participant en porte SON échantillon, et ils diffèrent légèrement
        // (11 736 chez l'un, 11 821 chez l'autre pour une même session) : on
        // retient donc celui de la chaîne demandée, pas celui de l'hôte, pour
        // coller exactement à ce que Twitch montrerait sur CETTE carte.
        // L'hôte figure lui aussi parmi les `guests` (slot 0), il est donc
        // couvert sans traitement particulier.
        //
        // Le champ vaut `null` sur une session OUVERTE MAIS SOLO — un seul
        // participant, donc rien à combiner (observé : session à un slot,
        // collaborationViewersCount null alors que viewersCount vaut 739).
        // Ce null est la bonne réponse et se propage tel quel : la carte
        // affiche alors l'audience propre. Ne pas le "réparer" en sommant les
        // invités ni en reprenant la valeur de l'hôte — ce serait inventer un
        // chiffre que Twitch n'affiche pas.
        let combined = null;
        for (const g of (session?.guests || [])) {
          if (g?.user?.id !== e.id) continue;
          const v = g.user.stream?.collaborationViewersCount;
          if (Number.isFinite(v)) combined = v;
          break;
        }
        infoById.set(e.id, { hostId, mates, combined });
      }
    }
    // On écrit TOUTES les chaînes demandées (avec/ sans session) pour ne pas
    // les redemander en boucle pendant la durée du TTL.
    const now = Date.now();
    for (const id of ids) {
      const info = infoById.get(id);
      gsCache.set(id, {
        hostId:   info ? info.hostId : null,
        mates:    info ? info.mates : [],
        combined: info ? info.combined : null,
        ts: now
      });
    }
    resolveGuestStarWaiters(ids); // tient les promesses en attente
    scheduleScan(); // données fraîches → re-colorier au prochain scan
  };

  const getHostId = (channelId) => {
    if (!channelId) return undefined;
    const hit = gsCache.get(channelId);
    const stale = !hit || Date.now() - hit.ts >= CFG.GUEST_STAR_TTL;
    // Rafraîchissement en arrière-plan si périmé (et hors cooldown d'erreur).
    if (stale && Date.now() >= gsCooldownUntil) {
      gsQueue.add(channelId);
      gsTimer ??= setTimeout(flushGuestStar, CFG.GUEST_STAR_DEBOUNCE);
    }
    // STALE-WHILE-REVALIDATE : tant qu'on a DÉJÀ une valeur, on la sert (même
    // périmée) pendant que le refetch tourne. Sans ça, la carte retomberait
    // sur l'heuristique à chaque expiration de TTL (~30s) → la clé gs: serait
    // libérée puis recolorée différemment. On ne renvoie undefined que si on
    // n'a JAMAIS rien su de cette chaîne.
    return hit ? hit.hostId : undefined;
  };

  // Garantit une résolution Guest Star pour `channelId` puis tient la promesse
  // (avec l'entrée de cache, ou null en échec/cooldown). Sert aux sections hors
  // "suivis" (Chaînes live, "regardent aussi") où le scan ne déclenche aucun
  // fetch : la popup la demande à la volée à son ouverture.
  const requestGuestStar = (channelId) => new Promise(resolve => {
    if (!channelId) return resolve(null);
    const hit = gsCache.get(channelId);
    if (hit && Date.now() - hit.ts < CFG.GUEST_STAR_TTL) return resolve(hit);
    if (Date.now() < gsCooldownUntil) return resolve(hit || null); // best-effort en cooldown
    let arr = gsWaiters.get(channelId);
    if (!arr) gsWaiters.set(channelId, arr = []);
    arr.push(resolve);
    gsQueue.add(channelId);
    gsTimer ??= setTimeout(flushGuestStar, CFG.GUEST_STAR_DEBOUNCE);
  });

  // Compteur combiné du co-stream pour cette chaîne, ou null si elle n'est pas
  // en session (ou si on n'a rien appris d'elle). Lecture PURE, sans fetch : le
  // même scan a déjà déclenché la résolution Guest Star via getHostId, et un
  // fetch d'affichage ferait dépendre le compteur d'une requête en vol.
  const getCollabViewers = (channelId) => {
    if (!channelId) return null;
    const v = gsCache.get(channelId)?.combined;
    return Number.isFinite(v) ? v : null;
  };

  // Co-streamers Guest Star de `login` (hôte + invités, soi exclu), chacun
  // { login, name }, pour enrichir la popup ("En live avec …"). [] si chaîne
  // inconnue ou hors session. Lecture pure (pas de fetch). `channelId` peut
  // être fourni explicitement (popup) ; sinon on le résout via le cache UseLive.
  const getGuestStarMates = (login, channelId) => {
    if (!login) return [];
    const id = channelId || getChannelId(login);
    if (!id) return [];
    const hit = gsCache.get(id);
    if (!hit || !Array.isArray(hit.mates)) return [];
    return hit.mates.filter(m => m.login !== login);
  };

  /* ============================================================
   *  FILTRE LANGUE — résolution des langues d'une chaîne
   *  -------------------------------------------------------------
   *  La langue n'est PAS dans le DOM de la sidebar (contrairement à
   *  la catégorie). On la déduit des TAGS du streamer, via GraphQL
   *  (Stream.freeformTags[].name).
   *
   *  IMPORTANT : on n'utilise PAS Stream.language (langue de
   *  DIFFUSION). Ce réglage est souvent erroné/trompeur — ex. un
   *  streamer FR qui diffuse en "en" tout en taguant "Français" —
   *  et produisait des faux positifs (rangé sous English à tort).
   *  Seuls les tags font foi, conformément à l'attendu. Un streamer
   *  multilingue (plusieurs tags langue) apparaît dans plusieurs
   *  filtres.
   *
   *  Transport : query inline TseLang (Client-ID, donnée publique),
   *  batchée et mise en cache (TTL), comme UseLive.
   * ============================================================ */
  // La détection de langue repose sur une correspondance EXACTE du nom de tag
  // (cf. LANG_SET, dérivé de LANG_CC plus bas). Un streamer multilingue (plusieurs
  // tags langue reconnus) apparaît dans plusieurs filtres.
  // ── Drapeaux SVG inline (jeu OpenMoji, licence CC BY-SA 4.0) ───────────
  // Embarqués en inline : le script s'exécute en MAIN world (pas d'accès à
  // chrome.runtime pour charger des ressources d'extension). Clés = code pays,
  // ou code de langue pour les bi-drapeaux EN (USA+Royaume-Uni) et PT
  // (Brésil+Portugal), coupés à la verticale centrale. Ces deux SVG combinés
  // n'utilisent AUCUN id (viewports <svg> imbriqués) : inlinables sans risque
  // de collision quand un même drapeau apparaît plusieurs fois dans le menu.
  const FLAG_SVG = {
    'FR': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><rect x="5" y="17" width="21" height="38" fill="#1e50a0"/><rect x="46" y="17" width="21" height="38" fill="#d22f27"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'EN': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><svg x="5" y="17" width="31" height="38" viewBox="5 17 31 38"><rect x="5" y="17" width="62" height="38" fill="#fff"/><rect x="5" y="17" width="62" height="5" fill="#d22f27"/><rect x="5" y="26" width="62" height="4" fill="#d22f27"/><rect x="5" y="34" width="62" height="4" fill="#d22f27"/><rect x="5" y="17" width="32" height="21" fill="#1e50a0"/><rect x="5" y="42" width="62" height="4" fill="#d22f27"/><circle cx="9.5" cy="22" r="1.75" fill="#fff"/><circle cx="17.5" cy="22" r="1.75" fill="#fff"/><circle cx="25.5" cy="22" r="1.75" fill="#fff"/><circle cx="33.5" cy="22" r="1.75" fill="#fff"/><circle cx="29.5" cy="26" r="1.75" fill="#fff"/><circle cx="21.5" cy="26" r="1.75" fill="#fff"/><circle cx="13.5" cy="26" r="1.75" fill="#fff"/><circle cx="9.5" cy="30" r="1.75" fill="#fff"/><circle cx="17.5" cy="30" r="1.75" fill="#fff"/><circle cx="25.5" cy="30" r="1.75" fill="#fff"/><circle cx="33.5" cy="30" r="1.75" fill="#fff"/><circle cx="29.5" cy="34" r="1.75" fill="#fff"/><circle cx="21.5" cy="34" r="1.75" fill="#fff"/><circle cx="13.5" cy="34" r="1.75" fill="#fff"/><rect x="5" y="50" width="62" height="5" fill="#d22f27"/></svg><svg x="36" y="17" width="31" height="38" viewBox="36 17 31 38"><rect x="5" y="17" width="62" height="38" fill="#1e50a0"/><polygon fill="#fff" points="40 28.856 40 32 50.181 32 67 21.691 67 17 59.346 17 40 28.856"/><polygon fill="#d22f27" points="67 17 67 17 63.173 17 40 31.203 40 32 43.482 32 67 17.586 67 17"/><polygon fill="#fff" points="59.347 55 67 55 67 55 67 50.308 50.182 40 40 40 40 43.143 59.347 55"/><polygon fill="#d22f27" points="67 55 67 52.653 46.355 40 41.568 40 66.042 55 67 55 67 55"/><polygon fill="#fff" points="32 43.144 32 40 21.819 40 5 50.309 5 55 12.654 55 32 43.144"/><polygon fill="#d22f27" points="5 55 5 55 8.827 55 32 40.797 32 40 28.518 40 5 54.414 5 55"/><polygon fill="#fff" points="12.653 17 5 17 5 17 5 21.692 21.818 32 32 32 32 28.857 12.653 17"/><polygon fill="#d22f27" points="5 17 5 19.347 25.646 32 30.432 32 5.958 17 5 17 5 17"/><rect x="5" y="31" width="62" height="10" fill="#fff"/><rect x="31" y="17" width="10" height="38" fill="#fff"/><rect x="5" y="33" width="62" height="6" fill="#d22f27"/><rect x="33" y="17" width="6" height="38" fill="#d22f27"/></svg><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="36" y1="17" x2="36" y2="55" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>`,
    'DE': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#f1b31c"/><rect x="5" y="30" width="62" height="12" fill="#d22f27"/><rect x="5" y="17" width="62" height="13"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'ES': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#f1b31c"/><path fill="#d22f27" d="M23,33v7a2.0059,2.0059,0,0,1-2,2H17a2.0059,2.0059,0,0,1-2-2V33"/><rect x="5" y="17" width="62" height="9" fill="#d22f27"/><rect x="5" y="46" width="62" height="9" fill="#d22f27"/><rect x="19" y="33" width="4" height="4" fill="#f1b31c"/><circle cx="19" cy="37" r="1.5" fill="#6a462f"/><g><line x1="27" x2="27" y1="33" y2="42" fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="11" x2="11" y1="33" y2="42" fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><path fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15,30a8.5678,8.5678,0,0,1,4-1"/><path fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M23,30a8.5678,8.5678,0,0,0-4-1"/><line x1="15" x2="23" y1="33" y2="33" fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><path fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M23,33v7a2.0059,2.0059,0,0,1-2,2H17a2.0059,2.0059,0,0,1-2-2V33"/><line x1="10" x2="12" y1="42" y2="42" fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="26" x2="28" y1="42" y2="42" fill="none" stroke="#6a462f" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'IT': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><rect x="5" y="17" width="21" height="38" fill="#5c9e31"/><rect x="46" y="17" width="21" height="38" fill="#d22f27"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'PT': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><svg x="5" y="17" width="31" height="38" viewBox="5 17 31 38"><rect x="5" y="17" width="62" height="38" fill="#5c9e31"/><polygon fill="#fcea2b" points="59.023 36.023 35.866 50.653 12.977 36.291 36.134 21.661 59.023 36.023"/><circle cx="36" cy="36" r="9" fill="#1e50a0"/><path fill="#fff" d="M44.1587,39.7815a9.0459,9.0459,0,0,0,.6963-2.2587,11.4735,11.4735,0,0,0-17.4766-4.0415,8.9839,8.9839,0,0,0-.3529,2.0137,10.9983,10.9983,0,0,1,17.1332,4.2865Z"/></svg><svg x="36" y="17" width="31" height="38" viewBox="14 17 31 38"><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><rect x="5" y="17" width="21" height="38" fill="#5c9e31"/><circle cx="26" cy="36" r="12" fill="none" stroke="#fcea2b" stroke-miterlimit="10" stroke-width="2"/><line x1="26" x2="26" y1="24" y2="48" fill="none" stroke="#fcea2b" stroke-linecap="round" stroke-linejoin="round"/><polygon fill="none" stroke="#fcea2b" stroke-linecap="round" stroke-linejoin="round" points="26 39.5 17 44 35 44 26 39.5"/><polygon fill="none" stroke="#fcea2b" stroke-linecap="round" stroke-linejoin="round" points="26 33.5 35 28 26.5 29.5 17 28 26 33.5"/><polygon fill="none" stroke="#fcea2b" stroke-linecap="round" stroke-linejoin="round" points="38 36 26 41 14 36 26 31 38 36"/><path fill="#fff" stroke="#d22f27" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.2,29H31.8V39.1c0,2.5-2.6,4.6-5.8,4.6h0c-3.2,0-5.8-2.1-5.8-4.6V29Z"/><circle cx="26" cy="32.8" r="0.7" fill="#1e50a0" stroke="#1e50a0" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="38.7" r="0.7" fill="#1e50a0" stroke="#1e50a0" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="35.7" r="0.7" fill="#1e50a0" stroke="#1e50a0" stroke-linecap="round" stroke-linejoin="round"/><circle cx="29" cy="35.7" r="0.7" fill="#1e50a0" stroke="#1e50a0" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23" cy="35.7" r="0.7" fill="#1e50a0" stroke="#1e50a0" stroke-linecap="round" stroke-linejoin="round"/></svg><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="36" y1="17" x2="36" y2="55" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>`,
    'RU': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><rect x="5" y="17" width="62" height="13" fill="#fff"/><rect x="5" y="30" width="62" height="12" fill="#1e50a0"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'JP': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><circle cx="36" cy="36" r="9" fill="#d22f27"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'KR': `<svg viewBox="0 0 72 72" version="1.1" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><g transform="translate(.002115 -.01649)"><circle cx="36" cy="36" r="9" fill="#d22f27"/><g fill="#1e50a0"><path d="m28.13 31.68a4.492 4.492 0 0 0 7.873 4.324c0.023-0.04 0.0338-0.0828 0.0554-0.123l0.0232 0.0138a4.493 4.493 0 0 1 7.724 4.59l3e-3 0.0018a8.992 8.992 0 0 1-15.68-8.807z"/><path d="m28.33 31.29 0.02 0.0115c-0.03 0.046-0.0668 0.085-0.0954 0.1325 0.0271-0.0465 0.047-0.0981 0.0754-0.144z"/></g></g><g transform="matrix(1.337 0 0 1.172 -16.64 -9.49)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.277"><g transform="matrix(1.125 0 0 1.127 .5437 -4.914)"><line x1="24.23" x2="27.23" y1="41.9" y2="47.1"/><line x1="20.77" x2="23.77" y1="43.9" y2="49.1"/><line x1="22.5" x2="23.5" y1="42.9" y2="44.63"/><line x1="24.5" x2="25.5" y1="46.37" y2="48.1"/></g><g transform="matrix(1.125 0 0 1.127 -1.713 -4.502)"><line x1="45.5" x2="46.5" y1="48.1" y2="46.37"/><line x1="47.5" x2="48.5" y1="44.63" y2="42.9"/><line x1="47.23" x2="48.23" y1="49.1" y2="47.37"/><line x1="49.23" x2="50.23" y1="45.63" y2="43.9"/><line x1="43.77" x2="44.77" y1="47.1" y2="45.37"/><line x1="45.77" x2="46.77" y1="43.63" y2="41.9"/></g><g transform="matrix(1.125 0 0 1.127 .5437 .9919)"><line x1="20.77" x2="23.77" y1="28.1" y2="22.9"/><line x1="22.5" x2="25.5" y1="29.1" y2="23.9"/><line x1="24.23" x2="27.23" y1="30.1" y2="24.9"/></g><g transform="matrix(1.125 0 0 1.127 -2.913 .9919)"><line x1="44.77" x2="45.77" y1="24.9" y2="26.63"/><line x1="46.77" x2="47.77" y1="28.37" y2="30.1"/><line x1="48.23" x2="49.23" y1="22.9" y2="24.63"/><line x1="50.23" x2="51.23" y1="26.37" y2="28.1"/><line x1="46.5" x2="49.5" y1="23.9" y2="29.1"/></g></g></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'CN': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><circle cx="24" cy="34" r="1.75" fill="#f1b31c"/><circle cx="24" cy="24" r="1.75" fill="#f1b31c"/><circle cx="28" cy="31" r="1.75" fill="#f1b31c"/><circle cx="28" cy="26" r="1.75" fill="#f1b31c"/><polygon fill="#f1b31c" stroke="#f1b31c" stroke-linecap="round" stroke-linejoin="round" points="13.528 32.445 16 24.445 18.473 32.445 12 27.5 20 27.5 13.528 32.445"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'NL': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#1e50a0"/><rect x="5" y="17" width="62" height="13" fill="#d22f27"/><rect x="5" y="30" width="62" height="12" fill="#fff"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'PL': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><rect x="5" y="36" width="62" height="19" fill="#d22f27"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'TR': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><path fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" d="m40.64 33.05s3.052 4.019 3.052 4.019l-4.934-1.532 4.932-1.541s-3.046 4.025-3.046 4.025l-0.003536-4.972"/><path fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" d="m31.29 44.64a8.643 8.643 0 1 1 3.958-16.34 11 11 0 1 0 0 15.38 8.715 8.715 0 0 1-3.958 0.9507z"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'SA': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#5c9e31"/><line x1="49" x2="23" y1="45" y2="45" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="43" x2="43" y1="43" y2="47" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="46" x2="46" y1="27" y2="36" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="51" x2="51" y1="27" y2="36" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="41" x2="41" y1="27" y2="36" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="36" x2="36" y1="27" y2="36" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="31" x2="31" y1="27" y2="36" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="26" x2="26" y1="27" y2="36" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="21" x2="21" y1="27" y2="36" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><line x1="49" x2="49" y1="45" y2="47" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'CZ': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><rect x="5" y="36" width="62" height="19" fill="#d22f27"/><path fill="#1e50a0" d="m36 36-31 18.6v-37.2z"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'SE': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#1e50a0"/><polygon fill="#fcea2b" stroke="#fcea2b" stroke-miterlimit="10" stroke-width="2" points="67 33 30 33 30 17 24 17 24 33 5 33 5 39 24 39 24 55 30 55 30 39 67 39 67 33"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'DK': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><polygon fill="#fff" stroke="#fff" stroke-miterlimit="10" stroke-width="2" points="67 33 30 33 30 17 24 17 24 33 5 33 5 39 24 39 24 55 30 55 30 39 67 39 67 33"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'NO': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><polygon fill="#1e50a0" stroke="#fff" stroke-miterlimit="10" stroke-width="2" points="67 33 30 33 30 17 24 17 24 33 5 33 5 39 24 39 24 55 30 55 30 39 67 39 67 33"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'FI': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><polygon fill="#1e50a0" stroke="#1e50a0" stroke-miterlimit="10" stroke-width="2" points="67 33 30 33 30 17 24 17 24 33 5 33 5 39 24 39 24 55 30 55 30 39 67 39 67 33"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'GR': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><rect x="5" y="34" width="62" height="4" fill="#1e50a0"/><rect x="5" y="25.75" width="62" height="4" fill="#1e50a0"/><rect x="5" y="42.25" width="62" height="4" fill="#1e50a0"/><rect x="5" y="50" width="62" height="5" fill="#1e50a0"/><rect x="5" y="17" width="62" height="5" fill="#1e50a0"/><rect x="5" y="17" width="22" height="21" fill="#1e50a0"/><rect x="14.5" y="17" width="4" height="22" fill="#fff"/><rect x="5" y="25.75" width="22" height="4" fill="#fff"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'HU': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#5c9e31"/><rect x="5" y="17" width="62" height="13" fill="#d22f27"/><rect x="5" y="30" width="62" height="12" fill="#fff"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'RO': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#f1b31c"/><rect x="5" y="17" width="21" height="38" fill="#1e50a0"/><rect x="46" y="17" width="21" height="38" fill="#d22f27"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'TH': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#fff"/><rect x="5" y="30" width="62" height="12" fill="#1e50a0"/><rect x="5" y="50" width="62" height="5" fill="#d22f27"/><rect x="5" y="17" width="62" height="5" fill="#d22f27"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'VN': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><polygon fill="#f1b31c" stroke="#f1b31c" stroke-linecap="round" stroke-linejoin="round" points="28.89 47 36.193 25 42.488 46.663 25 33.61 47 33.067 28.89 47"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'ID': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#d22f27"/><rect x="5" y="36" width="62" height="19" fill="#fff"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`,
    'UA': `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><rect x="5" y="17" width="62" height="38" fill="#61b2e4"/><rect x="5" y="36" width="62" height="19" fill="#fcea2b"/></g><g><rect x="5" y="17" width="62" height="38" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>`
  };
  // Nom de langue canonique → clé de drapeau FLAG_SVG (code pays, ou code de
  // langue pour les bi-drapeaux combinés : English→EN, Português→PT).
  // C'est aussi la liste des langues SUPPORTÉES (toutes ont un drapeau).
  const LANG_CC = {
    'Français':'FR', 'English':'EN', 'Deutsch':'DE', 'Español':'ES',
    'Italiano':'IT', 'Português':'PT', 'Русский':'RU', '日本語':'JP',
    '한국어':'KR', '中文':'CN', 'Nederlands':'NL', 'Polski':'PL',
    'Türkçe':'TR', 'العربية':'SA', 'Čeština':'CZ', 'Svenska':'SE',
    'Dansk':'DK', 'Norsk':'NO', 'Suomi':'FI', 'Ελληνικά':'GR',
    'Magyar':'HU', 'Română':'RO', 'ไทย':'TH', 'Tiếng Việt':'VN',
    'Bahasa Indonesia':'ID', 'Українська':'UA'
  };
  // Détection de langue : le nom d'un tag freeform doit correspondre EXACTEMENT
  // à l'une des chaînes canoniques (un seul tag par langue ; aucune variante,
  // casse ou traduction). Dérivé de LANG_CC → toute langue détectée a un drapeau.
  const LANG_SET = new Set(Object.keys(LANG_CC));
  // Globe SVG inline (OpenMoji 1F30D, licence CC BY-SA 4.0) : icône du libellé
  // « toutes les langues » (aucune langue sélectionnée). Rendu via le même
  // wrapper .tse-flag que les drapeaux → taille et centrage identiques.
  const GLOBE_MARKUP = `<span class="tse-flag"><svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><circle cx="36" cy="36" r="28" fill="#92D3F5"/><path fill="#B1CC33" d="M49.4394,11.4301C48.9012,12.3361,47.7952,13.5726,47,14c-1.2452,0.6692-1.904,0.2672-3,1c-1.2689,0.8484-1.2095,1.9379-2,2 c-0.8018,0.063-0.6879-1.993-1-3c-0.4521-1.4585-0.2307-1.5267-1-2c-1.0834-0.6665-3.2121-1.0502-5,0 c-0.7094,0.4167-0.7506,0.682-3,4c-1.7096,2.5218-2.188,3.1093-2,4c0.1989,0.9419,0.0427,1.7474,1,2 c1.1873,0.3132,1.3661-0.2722,2-1c1.3282-1.525,2.3581-3.7828,3-4c0.5713-0.1933,2.0656,1.3495,2,3c-0.0463,1.1654-0.852,1.922-2,3 c-0.7417,0.6965-2.875,1.5-6,2c-1.719,0.275-1.4083,0.8524-2.0625,1.5938c-0.8427,0.955-0.4615,2.1691-1.2812,3.3125 c-1.0252,1.43-3.4727,1.7917-3.6564,2.7188C22.8432,33.4154,24.9604,33.9845,26,34c0.8505,0.0127,1.0644-0.7721,3-2 c0.7408-0.47,1.75-1.2812,2.6875-1.25c0.5041,0.0168,1.8289,0.2852,2.3438,0.7188c0.5938,0.5-0.1562,1.8438-0.4062,3.1562 s-2.8976,1.8646-3.8542,2.0208c-1.5737,0.257-4.1439-0.5228-5.6042,0.9375c-1,1-1.1155,1.766-1.1667,3.4167 c-0.0129,0.4172,0.937,3.0323,2,4c1.1442,1.0416,2.2939-0.8356,4,0c1.7456,0.8549,2.493,2.7288,3,4 c0.5078,1.2731,0.1756,1.1679,1,5c0.4146,1.9271,0.3191,1.1194,1,4c0.5632,2.3826,0.5889,2.7678,1,3 c1.1732,0.6628,3.8997-0.8162,5-3c0.6895-1.3683,0.2111-1.9625,1-5c0.3928-1.5123,0.5892-2.2685,1-3 c1.7332-3.0861,4.8828-3.1256,5-5c0.0802-1.2824-1.3573-1.8515-1-3c0.3421-1.0997,1.8099-1.0603,2-2 c0.2579-1.2752-2.2492-2.316-2-3c0.2822-0.7746,4.0696-1.0098,6,1c0.6397,0.666,0.4982,0.9775,2,4c1.3839,2.7851,1.7637,3.0431,2,3 c0.4287-0.0782,0.3223-1.1355,1-3c0.3243-0.8922,1.0927-3.0062,2-3c0.6247,0.0043,0.7386,1.0097,2,2 c0.7103,0.5576,1.7908,0.8806,2.3474,1.0378C63.7747,40.0932,64,38.0729,64,36c0-10.6315-5.9252-19.8791-14.6535-24.6206"/></g><g><circle cx="36" cy="36" r="28" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M49.4394,11.4301C48.9012,12.3361,47.7952,13.5726,47,14c-1.2452,0.6692-1.904,0.2672-3,1c-1.2689,0.8484-1.2095,1.9379-2,2 c-0.8018,0.063-0.6879-1.993-1-3c-0.4521-1.4585-0.2307-1.5267-1-2c-1.0834-0.6665-3.2121-1.0502-5,0 c-0.7094,0.4167-0.7506,0.682-3,4c-1.7096,2.5218-2.188,3.1093-2,4c0.1989,0.9419,0.0427,1.7474,1,2 c1.1873,0.3132,1.3661-0.2722,2-1c1.3282-1.525,2.3581-3.7828,3-4c0.5713-0.1933,2.0656,1.3495,2,3c-0.0463,1.1654-0.852,1.922-2,3 c-0.7417,0.6965-2.875,1.5-6,2c-1.719,0.275-1.4083,0.8524-2.0625,1.5938c-0.8427,0.955-0.4615,2.1691-1.2812,3.3125 c-1.0252,1.43-3.4727,1.7917-3.6564,2.7188C22.8432,33.4154,24.9604,33.9845,26,34c0.8505,0.0127,1.0644-0.7721,3-2 c0.7408-0.47,1.75-1.2812,2.6875-1.25c0.5041,0.0168,1.8289,0.2852,2.3438,0.7188c0.5938,0.5-0.1562,1.8438-0.4062,3.1562 s-2.8976,1.8646-3.8542,2.0208c-1.5737,0.257-4.1439-0.5228-5.6042,0.9375c-1,1-1.1155,1.766-1.1667,3.4167 c-0.0129,0.4172,0.937,3.0323,2,4c1.1442,1.0416,2.2939-0.8356,4,0c1.7456,0.8549,2.493,2.7288,3,4 c0.5078,1.2731,0.1756,1.1679,1,5c0.4146,1.9271,0.3191,1.1194,1,4c0.5632,2.3826,0.5889,2.7678,1,3 c1.1732,0.6628,3.8997-0.8162,5-3c0.6895-1.3683,0.2111-1.9625,1-5c0.3928-1.5123,0.5892-2.2685,1-3 c1.7332-3.0861,4.8828-3.1256,5-5c0.0802-1.2824-1.3573-1.8515-1-3c0.3421-1.0997,1.8099-1.0603,2-2 c0.2579-1.2752-2.2492-2.316-2-3c0.2822-0.7746,4.0696-1.0098,6,1c0.6397,0.666,0.4982,0.9775,2,4c1.3839,2.7851,1.7637,3.0431,2,3 c0.4287-0.0782,0.3223-1.1355,1-3c0.3243-0.8922,1.0927-3.0062,2-3c0.6247,0.0043,0.7386,1.0097,2,2 c0.7103,0.5576,1.7908,0.8806,2.3474,1.0378C63.7747,40.0932,64,38.0729,64,36c0-10.6315-5.9252-19.8791-14.6535-24.6206 z"/></g></svg></span>`;

  // Drapeau SVG inline d'une langue, ou null si aucun n'est défini.
  const flagMarkup = (canonical) => {
    const svg = FLAG_SVG[LANG_CC[canonical]];
    return svg ? `<span class="tse-flag">${svg}</span>` : null;
  };
  // Icône d'une langue pour bouton/menu : drapeau SVG (toujours présent pour
  // une langue supportée), avec repli défensif sur le nom canonique.
  const langIcon = (canonical) =>
    flagMarkup(canonical) || `<span class="tse-lang-code">${escapeHtml(canonical)}</span>`;

  // LECTURE PURE du cache TseChannels — plus aucun transport propre.
  //
  // Les tags viennent désormais de la même réponse que le statut live, les
  // viewers et la catégorie : le module n'a donc plus ni file d'attente, ni
  // TTL, ni cooldown, ni cache à purger. Il ne reste que la canonicalisation,
  // faite ici plutôt qu'à l'écriture parce que LANG_SET est défini dans cette
  // section du fichier, bien après la couche GraphQL.
  const langStore = (() => {
    // Langues (noms canoniques) d'une chaîne, ou null si sa réponse n'est pas
    // encore arrivée. Un tag compte si et seulement si son nom est EXACTEMENT
    // une chaîne de LANG_SET ; un streamer multilingue (ex. « Français » +
    // « English ») relève donc de plusieurs filtres. Une chaîne hors ligne
    // renvoie [] (aucun tag), pas null : c'est une réponse, pas une absence.
    const getLangs = (login) => {
      if (!login) return null;
      const hit = cache.get(login);
      if (!hit) return null;
      const out = [];
      for (const name of hit.tags) {
        if (LANG_SET.has(name) && !out.includes(name)) out.push(name);
      }
      return out;
    };

    return { getLangs };
  })();

  function detectCoStreams() {
    // Passer par followedSection() : DOM.followedSelector contient
    // plusieurs alternatives séparées par des virgules (fr/en/de/es/pt), donc
    // l'interpoler dans un sélecteur composé `${...} .side-nav-card`
    // casserait le matching (le combinator ne s'appliquerait qu'au
    // dernier alternatif).
    const section = followedSection();
    const cards = section ? section.querySelectorAll('.side-nav-card') : [];
    const now = Date.now();
    const gsUsable = now >= gsCooldownUntil; // Guest Star opérationnel (hors cooldown)

    // === 1) Groupes FIABLES via Guest Star (clé = host.id partagé) ======
    // Pour chaque carte live, on résout l'ID de chaîne (appris via UseLive)
    // puis le host.id de son éventuelle session "Streamer ensemble". Les
    // cartes partageant le même host.id sont un co-stream certain. On mémorise
    // le host.id par carte pour le réutiliser au repli (pass 2).
    const groups = new Map();        // clé -> [cards]  (gs:<hostId> ou vh:<cat>|||<viewers>)
    const gsHandled = new Set();     // cartes couvertes de façon fiable
    const hostByCard = new Map();    // card -> string | null | undefined
    cards.forEach(card => {
      if (card.dataset.tseOffline === 'true') return;
      const login = card.dataset.tseLogin;
      if (!login) return;
      const hostId = getHostId(getChannelId(login));
      hostByCard.set(card, hostId);
      if (typeof hostId !== 'string') return; // null (pas de co-stream) / undefined (inconnu)
      const key = `gs:${hostId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });
    // Un groupe Guest Star ne "couvre" ses membres (et ne les soustrait à
    // l'heuristique) qu'à partir de 2 membres suivis visibles : c'est ce qui
    // matérialise un "ensemble" parmi les chaînes suivies.
    for (const [, members] of groups) {
      if (members.length >= 2) members.forEach(c => gsHandled.add(c));
    }

    // === 2) Repli HEURISTIQUE (catégorie + viewers) =====================
    // N'intervient QUE si Guest Star ne peut pas trancher :
    //   - host.id == null  → pas une session "Streamer ensemble" mais peut
    //     rester un co-stream d'événement que l'heuristique rattrape parfois ;
    //   - ID de chaîne encore inconnu (UseLive pas résolu) ;
    //   - Guest Star en cooldown (panne réseau / hash périmé).
    // Si Guest Star est opérationnel mais que la réponse est encore EN VOL
    // pour cette carte (host.id undefined + ID connu), on n'applique PAS
    // l'heuristique : on attend la vérité (~1s) → aucune transition de couleur
    // au démarrage.
    cards.forEach(card => {
      if (card.dataset.tseOffline === 'true') return;
      if (gsHandled.has(card)) return;
      if (gsUsable && hostByCard.get(card) === undefined && getChannelId(card.dataset.tseLogin)) return;
      if (!cardHasCollab(card)) return;
      const cat = card.dataset.tseCategory;
      if (!cat) return;
      // Comparaison sur le texte AFFICHÉ (donc arrondi, « 3,9 k ») et non sur
      // le nombre exact : la signature de cette heuristique est justement que
      // les co-streamers d'un même événement montrent le même compteur
      // combiné. Deux valeurs exactes voisines (1 663 / 1 661) ne doivent pas
      // faire échouer un regroupement que Twitch affiche comme identique.
      const viewers = getCardViewersText(card);
      if (!viewers) return;
      const key = `vh:${cat}|||${viewers}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });

    // === 3) Clés actives ================================================
    const activeKeys = new Set();
    for (const [key, members] of groups) {
      if (members.length < 2) continue;

      // Guest Star : 2 membres suivis suffisent (regroupement certain).
      if (key.startsWith('gs:')) { activeKeys.add(key); continue; }

      // Heuristique (clé vh:) : conditions cumulatives inchangées —
      //   - tous les membres affichent le MÊME chiffre N dans leur badge
      //     (signature forte : Twitch synchronise ce nombre) ;
      //   - cohérence de taille : N + 1 = taille totale du co-stream, donc
      //     members.length <= N + 1. L'inégalité couvre le cas où l'on ne
      //     suit qu'une partie des co-streamers (badge "3" sur 2 cartes =
      //     co-stream à 4 dont on en suit 2). L'égalité stricte raterait ces
      //     cas légitimes.
      const counts = members.map(getCardCollabCount);
      if (counts.some(c => c === null)) continue;
      const first = counts[0];
      if (!counts.every(c => c === first)) continue;
      if (members.length > first + 1) continue;
      activeKeys.add(key);
    }

    // === 4) Attribution STABLE des couleurs =============================
    // La couleur est réservée par clé de groupe avec un délai de grâce. Tant
    // qu'une collaboration reste active (ou réapparaît dans le délai), elle
    // garde le MÊME indice de palette. On élimine ainsi les deux causes de
    // clignotement : (a) la libération immédiate au moindre scan inactif et
    // (b) la dérive d'un compteur monotone. L'indice est le PLUS PETIT libre
    // parmi les couleurs encore réservées (déterministe, sans collision entre
    // groupes simultanés).
    for (const key of activeKeys) {
      const slot = costreamColorByKey.get(key);
      if (slot) slot.lastActiveTs = now;
    }
    // Purge des réservations dont la collaboration est réellement terminée
    // (inactives au-delà du délai de grâce).
    for (const [key, slot] of [...costreamColorByKey]) {
      if (!activeKeys.has(key) && now - slot.lastActiveTs > CFG.COSTREAM_COLOR_GRACE) {
        costreamColorByKey.delete(key);
      }
    }
    const reserved = new Set();
    for (const slot of costreamColorByKey.values()) reserved.add(slot.idx);
    const pickIdx = () => {
      for (let i = 0; i < COSTREAM_PALETTE.length; i++) if (!reserved.has(i)) return i;
      return costreamColorByKey.size % COSTREAM_PALETTE.length; // palette saturée : recyclage
    };
    for (const key of activeKeys) {
      if (!costreamColorByKey.has(key)) {
        const idx = pickIdx();
        reserved.add(idx);
        costreamColorByKey.set(key, { idx, lastActiveTs: now });
      }
    }

    // === 5) Reset des marqueurs, puis ré-application sur les actifs ======
    cards.forEach(card => {
      card.classList.remove('tse-costream');
      card.style.removeProperty('--tse-costream-color');
      card.style.removeProperty('--tse-costream-bg');
      card.style.removeProperty('--tse-costream-bg-fade');
      delete card.dataset.tseCostreamKey;
    });

    for (const key of activeKeys) {
      const palette = COSTREAM_PALETTE[costreamColorByKey.get(key).idx];
      for (const card of groups.get(key)) {
        card.classList.add('tse-costream');
        card.style.setProperty('--tse-costream-color',   palette.color);
        card.style.setProperty('--tse-costream-bg',      palette.bg);
        card.style.setProperty('--tse-costream-bg-fade', palette.fade);
        // La clé est exposée pour permettre au tri "co-stream" de
        // regrouper physiquement les membres d'un même groupe.
        card.dataset.tseCostreamKey = key;
      }
    }

    return activeKeys.size; // nb de groupes co-stream détectés (Guest Star + repli)
  }

  // Fusion visuelle des barres co-stream : marque les cartes co-stream VISIBLES
  // adjacentes (dans l'ordre d'affichage FINAL) partageant la même clé de
  // groupe, pour que leurs barres latérales se rejoignent (cf. CSS
  // .tse-costream-join-top/-bottom). À appeler APRÈS applySorting (l'adjacence
  // dépend de l'ordre final) et après recomputeFilters (une carte masquée —
  // offline ou filtrée — ne compte pas comme voisine et ne rompt donc pas la
  // continuité des deux cartes qui l'encadrent). Idempotent : réinitialise les
  // marqueurs à chaque passage.
  //
  // L'extension de chaque barre vers son voisin = moitié de l'interstice RÉEL
  // mesuré (+1px de recouvrement anti-hairline), pour une jointure exacte quel
  // que soit l'espacement inter-cartes (notamment en mode réduit, où les
  // avatars sont plus espacés). Lectures de layout groupées AVANT les écritures
  // (nos écritures ne touchent que le ::before → pas de reflow en boucle).
  //
  // Mode réduit : Twitch pose .side-nav-card sur le wrapper ET sur le <a>
  // interne (en étendu, l'interne porte .side-nav-card__link). On calcule donc
  // l'adjacence sur les cartes CANONIQUES (wrappers non imbriqués) pour ne pas
  // fausser le voisinage, et on applique le marqueur à la carte ET à ses
  // .side-nav-card internes (qui portent elles aussi une barre en réduit).
  function applyCostreamJoins() {
    const all = document.querySelectorAll('.side-nav-card');
    all.forEach(c => {
      c.classList.remove('tse-costream-join-top', 'tse-costream-join-bottom');
      c.style.removeProperty('--tse-costream-jt');
      c.style.removeProperty('--tse-costream-jb');
    });
    const visible = [...all].filter(c =>
      c.dataset.tseOffline !== 'true' &&
      c.style.display !== 'none' &&
      !c.parentElement?.closest('.side-nav-card')  // exclut le <a> interne (mode réduit)
    );
    // 1) Repère les paires voisines à joindre (même clé), sans lire le layout.
    const pairs = [];
    for (let i = 0; i < visible.length - 1; i++) {
      const a = visible[i], b = visible[i + 1];
      const key = a.dataset.tseCostreamKey;
      if (key && key === b.dataset.tseCostreamKey) pairs.push([a, b]);
    }
    if (!pairs.length) return;
    // 2) Mesure l'interstice de chaque paire (lectures groupées).
    const exts = pairs.map(([a, b]) =>
      Math.max(0, b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) / 2 + 1
    );
    // 3) Applique classes + extension à la carte ET à ses cartes internes
    //    (écritures ::before uniquement → pas d'invalidation de layout).
    const mark = (card, cls, varName, ext) => {
      for (const el of [card, ...card.querySelectorAll('.side-nav-card')]) {
        el.classList.add(cls);
        el.style.setProperty(varName, `-${ext}px`);
      }
    };
    pairs.forEach(([a, b], i) => {
      mark(a, 'tse-costream-join-bottom', '--tse-costream-jb', exts[i]);
      mark(b, 'tse-costream-join-top', '--tse-costream-jt', exts[i]);
    });
  }

  /* ============================================================
   *  ORDRE TWITCH ORIGINAL + TRI CUSTOM
   *  -------------------------------------------------------------
   *  L'ordre natif de Twitch dans la section "Chaînes suivies" est
   *  capturé une fois par carte dans dataset.tseTwitchOrder. Cette
   *  valeur sert :
   *   - de tie-breaker pour les tris custom (égalité de score sur
   *     popular, ordre interne d'un groupe co-stream)
   *   - de référence pour le fallback `default` (état transitoire).
   *
   *  Stratégie de snapshot : ONE-TIME-PER-CARD. Au boot, toutes les
   *  cartes sont nouvelles → toutes reçoivent un index dans l'ordre
   *  Twitch initial. Aux scans ultérieurs, seules les cartes nouvelles
   *  (sans tseTwitchOrder) sont indexées, en utilisant leur position
   *  DOM courante. On évite ainsi d'écraser l'ordre Twitch par
   *  l'ordre custom qu'on vient d'appliquer.
   * ============================================================ */

  // Capture l'ordre Twitch courant des cartes nouvellement apparues.
  function snapshotTwitchOrder() {
    const section = followedSection();
    if (!section) return;
    // Les cartes FABRIQUÉES sont écartées : elles ne font pas partie de
    // l'ordre de Twitch, et les compter décalerait l'indice de toutes les
    // cartes natives suivantes. Sans tseTwitchOrder elles retombent sur la
    // valeur par défaut du tri (fin de liste), ce qui est correct — cet ordre
    // ne sert que de départage et de repli.
    const cards = [...section.querySelectorAll('.side-nav-card')].filter(c => !isSynthetic(c));
    cards.forEach((card, i) => {
      if (card.dataset.tseTwitchOrder !== undefined) return;
      card.dataset.tseTwitchOrder = String(i);
    });
  }

  /**
   * Parse un compteur Twitch en nombre comparable, INDÉPENDAMMENT DE LA LANGUE.
   *
   * Twitch formate les viewers différemment selon la locale de l'UI :
   *   - fr : abréviation « 67,3 k » (virgule décimale + suffixe k) ;
   *   - en : abréviation « 67.3K » / « 1.2M » (point décimal + suffixe K/M) ;
   *   - de : nombre PLEIN « 29.339 » / « 4.089 » (point = séparateur de
   *          MILLIERS, AUCUN suffixe) — sous 1000 : « 987 » ;
   *   - pt : abréviation « 3,7 mil » (×1000) / « 1,2 mi » (×1 000 000)
   *          (virgule décimale + suffixe « mil » / « mi ») — identique au
   *          Brésil et au Portugal.
   *
   * Règle de désambiguïsation (sans dépendre de LANG, donc robuste même si la
   * détection de langue est tardive ou fausse) :
   *   • suffixe d'abréviation présent (mil / mi / mio / k / m) ⇒ le séparateur
   *     restant est DÉCIMAL → on parse en flottant puis on multiplie ;
   *   • aucun suffixe ⇒ « . », « , » et espaces sont des séparateurs de
   *     MILLIERS → on les retire et on parse en entier.
   *
   * Exemples : « 67,3 k »→67300 · « 67.3K »→67300 · « 29.339 »→29339 ·
   *            « 1.2M »→1200000 · « 3,7 mil »→3700 · « 1,2 mi »→1200000 ·
   *            « 987 »→987 · « » →0.
   */
  const parseViewerCount = (txt) => {
    if (!txt) return 0;
    // Normalise : retire espaces (normaux, insécables, fins) et passe en bas de casse.
    const s = txt.replace(/[\s\u00a0\u202f]+/g, '').toLowerCase();
    // Suffixe d'abréviation multi-langues (le plus long d'abord pour éviter
    // qu'un préfixe ne capture à tort : « mil » avant « mi », « mi » avant « m ») :
    //   millier → mil (pt) · k (fr/en) ;
    //   million → mi (pt) · mio (de) · m (en).
    const suf = s.match(/(mil|mio|mi|k|m)\.?$/);
    if (suf) {
      // AVEC suffixe → le séparateur restant est DÉCIMAL (« 67,3 k », « 3,7mil »).
      const mult = (suf[1] === 'k' || suf[1] === 'mil') ? 1_000 : 1_000_000;
      const num = parseFloat(s.slice(0, suf.index).replace(',', '.'));
      return Number.isFinite(num) ? Math.round(num * mult) : 0;
    }
    // SANS suffixe → « . » / « , » / espaces sont des séparateurs de MILLIERS
    // (« 4.089 » de, « 4,089 » en, « 4 089 » fr) ; les chiffres seuls suffisent.
    const digits = s.replace(/[.,]/g, '');
    return /^\d+$/.test(digits) ? parseInt(digits, 10) : 0;
  };

  // Récupère le pseudo affiché de la carte (extrait depuis l'URL pour
  // robustesse — le nom visible peut être tronqué par "...", l'URL non).
  // Fallback sur le contenu textuel du <p title=""> si l'URL est absente.
  const getCardLogin = (card) => {
    const link = card.querySelector('a[href^="/"]');
    const login = loginFromHref(link?.getAttribute('href'));
    if (login) return login;
    const p = card.querySelector('p[title]');
    return p ? (p.getAttribute('title') || '').toLowerCase() : '';
  };

  function applySorting() {
    const section = followedSection();
    if (!section) return;

    const cards = [...section.querySelectorAll('.side-nav-card')];
    if (cards.length < 2) return;
    const container = cards[0].parentElement;
    if (!container) return;

    // En mode global, le mode de tri est imposé : un classement mondial n'a
    // pas de sens trié par popularité personnelle ou par ordre alphabétique.
    // La ligne de boutons est masquée en conséquence, mais l'état qu'elle
    // portait est préservé — revenir aux chaînes suivies le retrouve intact.
    const sortMode = state.globalMode ? 'viewers' : state.sortMode;

    let sorted;
    if (sortMode === 'uptime') {
      // createdAt DESC → stream le plus récent en premier (uptime le plus court)
      sorted = [...cards].sort((a, b) => {
        const ta = new Date(a.dataset.tseStartedAt || 0).getTime() || 0;
        const tb = new Date(b.dataset.tseStartedAt || 0).getTime() || 0;
        return tb - ta;
      });
    } else if (sortMode === 'viewers') {
      // Viewers DESC → le plus regardé en premier
      sorted = [...cards].sort((a, b) => getCardViewers(b) - getCardViewers(a));
    } else if (sortMode === 'costream') {
      // Groupes de co-stream regroupés en tête, ordonnés par audience du
      // groupe décroissante. Les solos sont relégués après, dans leur ordre
      // Twitch original. À l'intérieur d'un même groupe, on conserve l'ordre
      // Twitch (déjà cohérent avec viewers).
      //
      // Audience du groupe = le PLUS GRAND compteur de ses membres, pas leur
      // somme : chaque membre d'un co-stream affiche déjà l'audience COMBINÉE
      // de la session (à un échantillon près — 11 736 chez l'un, 11 821 chez
      // l'autre). Les additionner compterait N fois le même public et
      // propulserait mécaniquement les groupes nombreux.
      const groupViewers = new Map(); // key -> audience du groupe
      cards.forEach(card => {
        const key = card.dataset.tseCostreamKey;
        if (!key) return;
        groupViewers.set(key, Math.max(groupViewers.get(key) || 0, getCardViewers(card)));
      });
      sorted = [...cards].sort((a, b) => {
        const ka = a.dataset.tseCostreamKey || null;
        const kb = b.dataset.tseCostreamKey || null;
        if (ka && !kb) return -1;       // a en groupe, b solo → a en premier
        if (!ka && kb) return 1;
        if (ka && kb && ka !== kb) {
          // Deux groupes différents : tri par viewers du groupe DESC
          return (groupViewers.get(kb) || 0) - (groupViewers.get(ka) || 0);
        }
        // Même groupe (ou deux solos) : ordre Twitch original
        const oa = parseInt(a.dataset.tseTwitchOrder ?? '999', 10);
        const ob = parseInt(b.dataset.tseTwitchOrder ?? '999', 10);
        return oa - ob;
      });
    } else if (sortMode === 'popular') {
      // Score de popularité personnelle DESC (visites récentes pondérées).
      // À égalité (ou si aucune donnée encore), on tombe sur l'ordre Twitch
      // pour rester déterministe — au début de l'usage la plupart des
      // streamers auront score=0 et ce fallback évite un ordre aléatoire.
      sorted = [...cards].sort((a, b) => {
        const sa = visits.scoreFor(getCardLogin(a));
        const sb = visits.scoreFor(getCardLogin(b));
        if (sb !== sa) return sb - sa;
        const oa = parseInt(a.dataset.tseTwitchOrder ?? '999', 10);
        const ob = parseInt(b.dataset.tseTwitchOrder ?? '999', 10);
        return oa - ob;
      });
    } else if (sortMode === 'alpha') {
      // Pseudo ASC (insensible à la casse, locale fr pour les accents)
      sorted = [...cards].sort((a, b) => {
        return getCardLogin(a).localeCompare(getCardLogin(b), S.locale, { sensitivity: 'base' });
      });
    } else {
      // Restauration de l'ordre Twitch
      sorted = [...cards].sort((a, b) => {
        const oa = parseInt(a.dataset.tseTwitchOrder ?? '999', 10);
        const ob = parseInt(b.dataset.tseTwitchOrder ?? '999', 10);
        return oa - ob;
      });
    }

    // Détecte si le DOM est déjà dans l'ordre voulu (évite les re-renders inutiles).
    let changed = false;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== cards[i]) { changed = true; break; }
    }
    if (!changed) return;
    sorted.forEach(c => container.appendChild(c));
  }

  /* ============================================================
   *  MODE « TOP CHAÎNES » — bascule et cartes
   *  -------------------------------------------------------------
   *  Le classement vient de globalChannels ; ici on ne fait que le rendre.
   *  Les cartes sont CLONÉES d'une carte native, comme les cartes en avance :
   *  c'est ce qui leur donne gratuitement le style de Twitch, le survol, la
   *  popup d'aperçu et tout ce que processCard sait déjà décorer.
   * ============================================================ */
  const GLOBAL_BANNER_ID = 'tse-global-partial';
  function setGlobalMode(on) {
    if (state.globalMode === on) return;
    state.globalMode = on;
    document.body.classList.toggle('tse-global-mode', on);
    // Entrer dans le mode doit être immédiat : on ne fait pas attendre le
    // prochain réveil de rafraîchissement pour lancer la marche.
    if (on) {
      globalChannels.tick();
      // Première entrée : la marche complète dure ~1,6 s. Sans voile,
      // l'utilisateur regarde ses chaînes suivies sous un titre qui annonce
      // déjà « Top Chaînes » — l'interface se contredit. On réutilise le
      // voile du démarrage plutôt que d'en inventer un second, et le verrou
      // ci-dessous le retient jusqu'à ce que les cartes existent.
      if (!globalChannels.top(1).length) loadingOverlay.startCycle('entrée dans Top Chaînes');
    }
    // En SORTIR ne purge pas le classement — y revenir doit être instantané,
    // et le pool se périme tout seul s'il n'est plus tiqué (GLOBAL_PRUNE_AGE).
    scheduleScan();
  }

  /**
   * Bascule de mode — NOTRE bouton, dans NOTRE conteneur.
   *
   * La version précédente détournait le bouton de tri natif de Twitch. Deux
   * défauts mesurés en usage réel, et tous deux inhérents à l'approche :
   *
   *   • un clic sur dix seulement ouvrait le choix. React remonte l'en-tête
   *     de section à chaque rendu ; entre le remplacement du bouton et le
   *     scan qui le ré-instrumente, il s'écoule un SCAN_DEBOUNCE pendant
   *     lequel le bouton n'est plus le nôtre. Rendre cette course fiable
   *     aurait demandé un observateur dédié à un élément que React possède ;
   *   • le menu se fermait dès qu'on avançait la souris vers lui, parce
   *     qu'il se refermait sur tout `scroll` capturé — et la barre latérale
   *     en émet au survol.
   *
   * On ne lutte plus. La bascule est un contrôle à deux onglets posé dans
   * le bloc filtre, que l'extension construit et possède : React n'y touche
   * jamais, il n'y a plus de popup à positionner, plus de clic extérieur à
   * écouter, plus de fermeture à déclencher. Les deux bugs disparaissent par
   * construction plutôt que par correctif.
   */
  const MODE_ROW_ID = 'tse-mode-row';

  function ensureModeRow() {
    const filterBar = document.getElementById(FILTER_ID);
    if (!filterBar) return;
    let row = document.getElementById(MODE_ROW_ID);
    if (!row) {
      row = document.createElement('div');
      row.id = MODE_ROW_ID;
      row.className = 'tse-mode-row';
      row.setAttribute('role', 'group');
      // PAS d'aria-label ici, et c'est délibéré : le libellé du mode suivi
      // vaut « Chaînes suivies », c'est-à-dire EXACTEMENT le sélecteur par
      // lequel l'extension retrouve la section suivie (DOM.followedSelector).
      // Le poser transformait ce bouton en imposteur : followedSection() le
      // renvoyait à sa place, et la sidebar se retrouvait sans aucune carte.
      // Le texte du bouton fait déjà office de nom accessible.
      //
      // Pas d'icône non plus : deux pictogrammes et leurs gouttières coûtent
      // une quarantaine de pixels sur les ~224 disponibles, et le libellé doit
      // rester lisible ENTIER — c'est lui qui porte l'information, pas l'image.
      const tab = (mode, label) =>
        `<button type="button" class="tse-mode-tab" data-tse-mode="${mode}">` +
        `${escapeHtml(label)}</button>`;
      row.innerHTML = tab('followed', S.followedLabel) + tab('global', S.uiGlobalLabel);
      row.querySelectorAll('[data-tse-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          // Recliquer l'onglet actif ne fait rien : un mode est TOUJOURS
          // actif, exactement comme la ligne des modes de tri.
          const wanted = btn.dataset.tseMode === 'global';
          if (state.globalMode === wanted) return;
          setGlobalMode(wanted);
        });
      });
      // En BAS du bloc filtre, et c'est ce qui le pose exactement là où
      // Twitch mettait son en-tête « Chaînes suivies ↑↓ » : ce bloc est le
      // dernier élément avant lui. L'en-tête masqué, les deux boutons
      // occupent sa place, au contact des cartes qu'ils commandent.
      filterBar.append(row);
    }
    row.setAttribute('aria-label', S.uiModeMenuAria);
    row.querySelectorAll('[data-tse-mode]').forEach(btn => {
      const on = (btn.dataset.tseMode === 'global') === state.globalMode;
      if (btn.getAttribute('aria-pressed') !== String(on)) {
        btn.setAttribute('aria-pressed', String(on));
      }
    });
  }

  // Bandeau affiché uniquement quand le classement n'est pas prouvé complet.
  function ensureGlobalBanner() {
    const bar = document.getElementById(FILTER_ID);
    let el = document.getElementById(GLOBAL_BANNER_ID);
    const rep = globalChannels.report();
    const show = state.globalMode && rep.pool > 0 && !rep.complete;
    if (!show || !bar) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = GLOBAL_BANNER_ID;
      el.className = 'tse-global-partial';
      bar.appendChild(el);
    }
    if (el.textContent !== S.uiGlobalPartial) setText(el, S.uiGlobalPartial);
  }

  /**
   * Réconcilie les cartes du mode global avec le classement courant.
   * Idempotent, comme syncAheadCards : ne crée que ce qui manque, ne retire
   * que ce qui n'a plus lieu d'être, et se ré-exécute à chaque scan — donc
   * ré-injecte ce que React aurait emporté.
   */
  // Dernier modèle de carte native relevé dans la session, et le conteneur
  // qui l'hébergeait (cf. syncGlobalCards).
  let globalTemplate = null;
  let globalContainer = null;

  function syncGlobalCards() {
    const section = followedSection();
    if (!section) return;

    const existing = new Map();
    for (const c of section.querySelectorAll('.side-nav-card[data-tse-global="true"]')) {
      const l = c.dataset.tseLogin;
      if (l) existing.set(l, c); else c.remove();
    }
    // `tse-global-ready` — et non `tse-global-mode` — commande l'effacement
    // des cartes de Twitch. La première marche prend ~1,6 s : basculer sur un
    // drapeau posé AVANT d'avoir le classement viderait la sidebar pendant ce
    // temps. On préfère montrer encore un instant la liste suivie, sous un
    // titre qui a déjà changé, plutôt qu'un vide. Les bascules suivantes sont
    // instantanées — le pool n'est pas purgé en sortant du mode.
    const ready = (n) => document.body.classList.toggle('tse-global-ready', n > 0);
    if (!state.globalMode) { existing.forEach(c => c.remove()); ready(0); return; }

    // Même exigence de modèle que pour les cartes en avance : une carte
    // native, en direct, et NEUTRE — cloner une carte décorée transposerait
    // ses marques sur une chaîne qui n'a rien à voir.
    // Le modèle est MÉMORISÉ, et c'est ce qui rend le mode utilisable pour de
    // bon : il n'existe de carte native EN DIRECT que si l'utilisateur suit
    // au moins une chaîne actuellement en ligne. Sans mémoire, un utilisateur
    // dont personne ne streame verrait « Top Chaînes » ne rien afficher —
    // alors même que le classement mondial, lui, est parfaitement connu.
    // Un modèle relevé une fois dans la session reste valable : c'est le
    // markup de carte de Twitch, il ne change pas d'une minute à l'autre.
    let template = null;
    let container = null;
    for (const c of section.querySelectorAll('.side-nav-card')) {
      if (c.dataset.tseGlobal === 'true' || isSynthetic(c)) continue;
      if (isPlainCard(c) && !isCardOffline(c)) { template = c; break; }
    }
    if (template) {
      container = template.parentElement;
      // Clone DÉTACHÉ : garder une référence au nœud vivant le laisserait
      // dériver avec les décorations que le scan lui applique ensuite.
      globalTemplate = template.cloneNode(true);
      globalContainer = container;
    } else if (globalTemplate) {
      template = globalTemplate;
      // Le conteneur mémorisé n'est retenu que s'il est TOUJOURS attaché :
      // React peut avoir remonté la liste entre-temps, et remplir un nœud
      // détaché reviendrait à ne rien afficher. Deux replis ensuite : le
      // parent d'une carte encore présente, puis la section elle-même —
      // moins fidèle à la structure de Twitch, mais visible.
      container = (globalContainer?.isConnected ? globalContainer : null)
        || section.querySelector('.side-nav-card')?.parentElement
        || section;
    }
    if (!template || !container) return;

    // Le cache partagé est la source de vérité de processCard. Sans l'amorcer,
    // une carte fraîchement clonée afficherait le compteur, la catégorie et
    // l'ancienneté de la chaîne qui a servi de MODÈLE jusqu'à la première
    // réponse TseChannels — soit un chiffre faux pendant une seconde.
    // On n'écrase jamais une entrée plus récente : la file TseChannels reste
    // la voix la plus autorisée sur une chaîne donnée.
    const seedCache = (rec) => {
      const prev = cache.get(rec.login);
      if (prev && prev.ts >= rec.ts) return;
      cache.set(rec.login, {
        id: rec.id, tags: rec.tags, game: rec.game, viewers: rec.viewers,
        name: rec.name, avatar: rec.avatar, ts: rec.ts,
        stream: {
          id: 'g:' + rec.login, createdAt: rec.createdAt,
          viewersCount: rec.viewers, game: { name: rec.game },
          freeformTags: rec.tags.map(n => ({ name: n }))
        }
      });
    };

    const top = globalChannels.top(CFG.GLOBAL_TOP_N);
    const keep = new Set();
    ready(top.length);
    for (const rec of top) {
      keep.add(rec.login);
      seedCache(rec);
      let card = existing.get(rec.login);
      if (!card) {
        card = buildAheadCard(template, rec.login, rec);
        if (!card) return;   // clone inexploitable : inutile d'insister
        card.dataset.tseGlobal = 'true';
        container.appendChild(card);
      }
      // Le compteur est écrit ICI, sans attendre le cache. Le clone hérite
      // sinon du nombre de spectateurs de la chaîne qui a servi de MODÈLE —
      // un chiffre faux, affiché le temps d'un aller-retour réseau, et
      // indéfiniment si la file TseChannels ne connaît pas cette chaîne.
      // processCard, qui passe APRÈS dans le scan, reste prioritaire : une
      // entrée de cache fraîche vient de TseChannels et fait plus autorité
      // que la marche structurelle.
      renderViewers(card, rec.viewers);
    }
    for (const [login, card] of existing) if (!keep.has(login)) card.remove();
  }

  /* ============================================================
   *  SCAN + OBSERVER
   * ============================================================ */
  /* ============================================================
   *  CARTES EN AVANCE SUR TWITCH
   *  -------------------------------------------------------------
   *  Twitch met 2 à 4 minutes à faire apparaître la carte d'une
   *  chaîne suivie qui passe en direct (mesuré : cf. tse.lag()).
   *  Comme le roster nous donne la liste des chaînes suivies et que
   *  leur statut live est une donnée publique, on peut le savoir
   *  avant lui — et poser la carte nous-mêmes.
   *
   *  FABRICATION PAR CLONAGE. La carte n'est pas écrite à la main :
   *  on CLONE une carte native de la sidebar et on en réécrit le
   *  contenu. C'est ce qui garantit qu'elle est visuellement
   *  indiscernable — toutes les classes de Twitch viennent avec —
   *  et qu'elle reste compatible avec le reste de l'extension :
   *  tri, filtres, aperçu au survol, coloration co-stream et
   *  rafraîchissement s'y appliquent sans une ligne de plus, parce
   *  qu'elle porte exactement les mêmes marqueurs.
   *
   *  Corollaire : sans carte native EN DIRECT à cloner, on ne
   *  fabrique rien. Le cas « aucune chaîne suivie en direct » ne
   *  bénéficie donc pas de l'avance — c'est assumé : mieux vaut ne
   *  rien afficher qu'une carte au rendu approximatif.
   *
   *  DEUX GARDES sur la fabrication :
   *   • jamais pendant le voile de chargement. Au boot la sidebar de
   *     Twitch est vide alors que le roster est plein : sans cette
   *     garde on injecterait des dizaines de cartes que Twitch
   *     poserait ensuite lui-même, pour rien.
   *   • un plafond (AHEAD_MAX), filet contre un état inattendu.
   *
   *  RETRAIT dès que l'une de ces conditions tombe : Twitch a posé
   *  sa propre carte (dédoublonnage), ou la chaîne n'est plus en
   *  direct. Le retrait passe AVANT la fabrication à chaque scan,
   *  pour qu'aucun doublon ne soit visible même transitoirement.
   * ============================================================ */

  const isSynthetic = (card) => card.dataset.tseSynthetic === 'true';

  /**
   * Une carte est NEUTRE si elle ne porte aucune des décorations que Twitch
   * ajoute selon le contexte. Seule une carte neutre peut servir de modèle de
   * clonage : tout ce qu'elle porte serait recopié sur la chaîne fabriquée.
   *
   * On réutilise exactement les détecteurs du reste du module — si l'un d'eux
   * évolue, cette garde suit sans intervention.
   */
  const isPlainCard = (card) => {
    if (card.querySelector('[class*="promoted-followed-card__content"]')) return false; // sponsorisée
    if (card.querySelector(DOM.altCostreamHostSelector)) return false;                  // co-stream
    if (card.querySelector(DOM.altLogoSelector)) return false;                          // logo sponsor / squad
    if (card.querySelector('.tse-collab-badge')) return false;                          // badge collab posé
    if (PLUS_RE_PRESENT.test(card.textContent || '')) return false;                     // « +N » non encore traité
    if (card.querySelector('[data-tse-extra-row]')) return false;                       // hype train, réduction…
    return true;
  };

  // Sonde les chaînes du roster dont on ne connaît pas l'état frais. C'est
  // ce qui permet de voir un passage en direct avant Twitch ; sans ça on ne
  // saurait rien des chaînes absentes de la sidebar.
  const pollRoster = () => {
    if (!CFG.AHEAD_ENABLED || document.hidden) return;
    let budget = CFG.AHEAD_MAX_POLL;
    // roster.entries() est trié par observation la plus récente : si le
    // budget est atteint, ce sont les chaînes les plus présentes dans la
    // sidebar — donc celles qui comptent — qui sont servies en premier.
    for (const [login] of roster.entries()) {
      if (budget-- <= 0) break;
      if (getFreshChannel(login)) continue;
      fetchChannel(login); // résultat récupéré via le cache au prochain scan
    }
  };

  // Débarrasse un clone de tout ce qui appartenait à la carte d'origine :
  // nos propres injections, les marqueurs d'état, les lignes annexes de
  // Twitch (hype train, réduction) et les styles calculés. Sans ce nettoyage,
  // la carte fabriquée hériterait de l'uptime, du compteur, du badge collab et
  // de la couleur de co-stream de la chaîne clonée.
  const scrubClone = (el) => {
    el.querySelectorAll('.tse-uptime, .tse-viewers, .tse-collab-badge, [data-tse-extra-row]')
      .forEach(n => n.remove());
    const strip = (node) => {
      for (const attr of [...node.attributes]) {
        if (attr.name.startsWith('data-tse-')) node.removeAttribute(attr.name);
      }
      if (node.classList.length) {
        [...node.classList].forEach(c => { if (c.startsWith('tse-')) node.classList.remove(c); });
      }
      node.removeAttribute('style');
      // Un id cloné serait un DOUBLON dans le document : il casserait
      // getElementById et toute référence ARIA qui le vise.
      node.removeAttribute('id');
      // Les libellés d'accessibilité décrivent la chaîne SOURCE. Les garder
      // ferait annoncer le mauvais streamer par un lecteur d'écran ; les
      // retirer laisse le nom accessible se déduire du texte visible, qui,
      // lui, est réécrit correctement.
      node.removeAttribute('aria-label');
      node.removeAttribute('aria-labelledby');
      node.removeAttribute('aria-describedby');
    };
    strip(el);
    el.querySelectorAll('*').forEach(strip);
    // L'avatar grisé n'a plus lieu d'être : on ne fabrique que du live.
    el.querySelectorAll('.side-nav-card__avatar--offline')
      .forEach(n => n.classList.remove('side-nav-card__avatar--offline'));
    // Twitch double son compteur visuel (aria-hidden) d'un texte réservé aux
    // lecteurs d'écran. Cloné tel quel, il annoncerait le nombre de viewers de
    // la chaîne SOURCE. On ne peut pas le réécrire — sa formulation exacte
    // varie selon la locale — donc on le retire : ne rien annoncer vaut mieux
    // qu'annoncer un chiffre faux. Le nom et la catégorie, eux, restent lus.
    const status = liveStatusOf(el);
    if (status) {
      status.querySelectorAll('*').forEach(n => {
        if (n.children.length) return;
        if (n.getAttribute('aria-hidden') === 'true') return;
        if ((n.textContent || '').trim()) n.remove();
      });
    }
  };

  /**
   * Fabrique la carte de `login` à partir de `template` (carte native live).
   * Renvoie l'élément, ou null si le clone n'expose pas les points d'ancrage
   * attendus — auquel cas on préfère ne rien afficher.
   */
  const buildAheadCard = (template, login, data) => {
    const card = template.cloneNode(true);
    scrubClone(card);

    // Liens : tous les <a> de la carte doivent pointer vers la bonne chaîne.
    const links = card.querySelectorAll('a[href]');
    if (!links.length) return null;
    links.forEach(a => a.setAttribute('href', `/${login}`));

    // Pseudo — hook d'automatisation Twitch, distinct du <p title> qui porte
    // la catégorie (cf. displayNameFor du module d'aperçu).
    const name = data.name || (login.charAt(0).toUpperCase() + login.slice(1));
    const nameEl = card.querySelector('p[data-a-target="side-nav-title"]');
    if (!nameEl) return null;
    setText(nameEl, name);
    if (nameEl.hasAttribute('title')) nameEl.setAttribute('title', name);

    // Catégorie : même élément que celui lu partout ailleurs.
    const catEl = cardCategoryEl(card);
    if (catEl && data.game) {
      setText(catEl, data.game);
      if (catEl.hasAttribute('title')) catEl.setAttribute('title', data.game);
    }

    // Avatar.
    const img = card.querySelector('img.tw-image-avatar, .side-nav-card__avatar img');
    if (img) {
      if (data.avatar) img.setAttribute('src', data.avatar);
      else img.removeAttribute('src');
      img.setAttribute('alt', name);
      img.removeAttribute('srcset');
    }

    card.dataset.tseSynthetic = 'true';
    card.dataset.tseLogin = login;
    return card;
  };

  /**
   * Réconcilie les cartes fabriquées avec la réalité, à chaque scan.
   * Idempotent : ne crée que ce qui manque, ne retire que ce qui n'a plus
   * lieu d'être. C'est aussi ce qui les ré-injecte si React les emporte.
   */
  const syncAheadCards = () => {
    if (!CFG.AHEAD_ENABLED) return;
    // En mode Top Chaînes, ces cartes sont de toute façon masquées par le
    // CSS. Les fabriquer quand même coûterait des clones, des mutations DOM
    // et des mesures d'avance (liveLag) sur des cartes que personne ne voit.
    // Elles sont réconciliées au retour, la fonction étant idempotente.
    if (state.globalMode) return;
    const section = followedSection();
    if (!section) return;

    const all = [...section.querySelectorAll('.side-nav-card')];

    // Une carte de Twitch ne COUVRE un login que si elle est réellement
    // affichée. Une carte que Twitch laisse en « Déconnecté » alors que la
    // chaîne a repris est masquée par le CSS : elle ne couvre rien, et si on
    // la comptait comme telle, la chaîne n'apparaîtrait NULLE PART — ni par
    // Twitch qui l'a mal étiquetée, ni par nous qui nous serions abstenus.
    const nativeCovers = (c) =>
      !isCardOffline(c) && c.dataset.tseGqlOffline !== 'true';

    const covered = new Set();
    let template = null;
    for (const c of all) {
      if (isSynthetic(c) || !nativeCovers(c)) continue;
      const l = c.dataset.tseLogin || getCardLogin(c);
      if (l) covered.add(l);
      // Modèle de clonage : une carte native EN DIRECT et NEUTRE. Le clonage
      // copie le markup tel quel — les décorations de la carte source
      // comprises. Cloner une carte sponsorisée, en co-stream ou portant un
      // badge de collaboration transposerait ces marques sur une chaîne qui
      // n'a rien à voir : l'aperçu au survol annoncerait un co-stream
      // inexistant, un badge « +3 » apparaîtrait sur l'avatar. On n'accepte
      // donc pour modèle qu'une carte dépourvue de toute décoration.
      if (!template && isPlainCard(c)) template = c;
    }

    // 1) Retraits — AVANT toute fabrication, pour qu'un doublon ne soit
    //    jamais visible, même le temps d'un rendu. Les rescapées sont
    //    collectées ici : ça évite d'avoir à les rechercher login par login
    //    plus bas, donc d'échapper quoi que ce soit dans un sélecteur.
    const standing = new Set();
    for (const c of all) {
      if (!isSynthetic(c)) continue;
      const l = c.dataset.tseLogin;
      const hit = l ? cache.get(l) : null;
      if (!l || covered.has(l) || !hit?.stream) { c.remove(); continue; }
      standing.add(l);
    }
    let live = standing.size;

    // 2) Fabrication. Suspendue pendant le voile : la sidebar de Twitch n'est
    //    pas encore peuplée, on injecterait des cartes qu'il va poser lui-même.
    if (!template) return;
    if (document.body.classList.contains('tse-loading')) return;

    const container = template.parentElement;
    if (!container) return;

    for (const [login] of roster.entries()) {
      if (live >= CFG.AHEAD_MAX) break;
      if (covered.has(login) || standing.has(login)) continue;
      const hit = getFreshChannel(login);
      if (!hit?.stream?.createdAt) continue;
      const card = buildAheadCard(template, login, hit);
      if (!card) return; // clone inexploitable : inutile d'insister sur les suivants
      container.appendChild(card);
      liveLag.noteAhead(hit.stream.id); // pour chiffrer l'avance prise sur Twitch
      live++;
    }
  };

  /**
   * Relève les chaînes suivies présentes dans la sidebar — EN DIRECT COMME
   * HORS LIGNE. Les cartes suivies portent toutes le marqueur indépendant de
   * la langue data-test-selector="followed-channel", y compris celles que
   * l'extension masque ensuite ; c'est ce qui rend la liste apprenable sans
   * jamais s'authentifier.
   *
   * Alimente le roster (mémoire longue). La mesure de retard, elle, ne passe
   * plus par ici : dater la première apparition d'une carte QUELLE QUE SOIT sa
   * forme confondait « Twitch liste la chaîne » et « Twitch l'affiche en
   * direct », et écartait tout le cas courant (cf. module LIVE LAG).
   */
  const harvestFollowed = () => {
    const section = followedSection();
    if (!section) return;
    section.querySelectorAll(DOM.followedCardSelector).forEach(a => {
      // NOS clones portent le même marqueur que les cartes de Twitch — c'est
      // même tout l'intérêt du clonage. Mais le roster est la mémoire
      // PERSISTÉE des chaînes suivies : y verser une carte du mode « Top
      // Chaînes » y inscrirait durablement une chaîne que l'utilisateur ne
      // suit pas, que pollRoster sonderait ensuite pour rien et que les
      // cartes en avance ressusciteraient au retour en mode suivi.
      // On ne relève donc que ce que Twitch a posé lui-même.
      if (a.closest('[data-tse-synthetic="true"]')) return;
      const login = loginFromHref(a.getAttribute('href'));
      if (!login) return;
      roster.record(login);
    });
  };

  const scanSidebar = () => {
    // Re-évaluer la langue en premier : auto-correction si LANG
    // initial était erroné (DOM Twitch pas encore prêt au boot).
    refreshLanguage();
    refreshSidebarCollapsed(); // état réduit/étendu, lu par les détections du scan
    preview.closeIfDetached(); // ferme l'aperçu si sa carte d'ancrage a été retirée
    offlineTransitionsThisScan = 0; // remis à zéro avant le passage des cartes
    snapshotTwitchOrder(); // avant tout tri custom, on photographie l'ordre Twitch
    harvestFollowed();     // relève du roster + horodatage des cartes nouvelles
    pollRoster();          // sonde les chaînes suivies absentes de la sidebar
    // Les cartes en avance servent la liste SUIVIE : elles n'ont pas d'objet
    // en mode global, où l'on n'affiche pas ce que l'utilisateur suit.
    if (!state.globalMode) syncAheadCards();
    syncGlobalCards();     // pose/retire les cartes du classement mondial
    const cards = document.querySelectorAll('.side-nav-card');
    cards.forEach(processCard);
    ensureFilterBar();
    ensureSortRow();
    ensureModeRow();
    ensureGlobalBanner();
    hideNativeFollowedHeader();
    renameRootTitle();
    recomputeFilters();
    const costreamGroups = detectCoStreams();
    updateSortButtonsState({ costreamGroups });
    applySorting();
    applyCostreamJoins(); // après le tri : fusionne les barres des voisins du même co-stream
    autoExpandFollowed();

    // Ce scan a-t-il masqué de nouvelles cartes "Déconnecté(e)" ?
    const hadOfflineActivity = offlineTransitionsThisScan > 0;

    // Signale au voile l'état de ce scan. Il renvoie true si la sidebar
    // grandit encore (de nouvelles cartes arrivent) : le voile ne se lève
    // que sur une sidebar peuplée, STABLE EN TAILLE et sans masquage offline
    // en cours, confirmé pendant LOADING_STABILITY_MS.
    // Les cartes FABRIQUÉES sont exclues du compte : le voile juge la sidebar
    // stable au nombre de cartes que Twitch a posées. Les compter reviendrait
    // à nous signaler notre propre travail comme une croissance de Twitch, et
    // le voile ne se lèverait jamais tant qu'on en ajoute.
    // Retenir le voile tant que le mode global n'a pas ses cartes : sans ça,
    // il se lèverait sur une sidebar « stable » — celle des chaînes suivies,
    // qui n'a effectivement pas bougé — avant même la fin de la marche.
    loadingOverlay.setHold(state.globalMode
      && !document.body.classList.contains('tse-global-ready'));
    const nativeCount = [...cards].filter(c => !isSynthetic(c)).length;
    const stillGrowing = loadingOverlay.notifyScan(hadOfflineActivity, nativeCount);

    // Twitch n'a pas fini de monter sa sidebar (vague de cartes Déconnecté
    // masquées, ou cartes encore en cours d'ajout) → on reprogramme un scan
    // pour attraper la prochaine vague, même si aucune autre mutation ne le
    // déclenche.
    if (hadOfflineActivity || stillGrowing) scheduleScan();
  };

  let scanTimer = null;
  const scheduleScan = () => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scanSidebar(); }, CFG.SCAN_DEBOUNCE);
  };

  const startObserver = () => {
    // État réduit/étendu observé en dernier, pour détecter les transitions
    // réduit↔étendu. Initialisé sur l'état courant au démarrage afin que la
    // première bascule réelle soit bien vue comme un changement.
    // null = INCONNU. Lire l'état avant que Twitch ait monté sa sidebar
    // renverrait « étendu » par défaut — l'élément marqueur n'existe pas
    // encore — et la première observation réelle serait alors comparée à une
    // valeur fabriquée. Chez un utilisateur en mode réduit, ou si la sidebar
    // se monte transitoirement dans l'autre état, cela déclenche une fausse
    // « bascule » : voile + purge du cache + re-scan complet, en plein
    // chargement. L'utilisateur voit alors la sidebar s'initialiser deux fois.
    let lastObservedCollapsed = null;

    const obs = new MutationObserver((mutations) => {
      // Un SEUL passage sur les mutations calcule deux choses :
      //  (a) cardRemoved — Twitch a-t-il RETIRÉ des cartes de la sidebar ?
      //      C'est le cas quand un stream se termine : Twitch nettoie sa
      //      sidebar par vagues, retirant les cartes "Déconnecté(e)" du DOM.
      //      Ces suppressions ne passent PAS par notre détection isCardOffline
      //      (la carte n'est plus là), donc on les capte ici pour maintenir le
      //      voile de chargement tant que ce nettoyage continue.
      //  (b) relevant — la mutation concerne-t-elle la zone sidebar (#side-nav) ?
      //      Sert de PORTE : Twitch mute le DOM en continu pour des choses sans
      //      rapport (chat, player, chrome de page) ; on n'a aucune raison de
      //      relancer un scan complet pour celles-là. Toute mutation DANS
      //      #side-nav a sa cible (le parent dont les enfants changent) à
      //      l'intérieur de #side-nav → nav.contains(target) la capte (ajout
      //      comme retrait). Le cas du remount (#side-nav lui-même réinséré)
      //      est capté via addedNodes. Et si #side-nav est absent (remount en
      //      cours), on est en FAIL-OPEN : toute mutation est jugée pertinente,
      //      pour ne JAMAIS risquer de rater une mise à jour.
      const nav = document.querySelector(DOM.sidebarRoot);
      let cardRemoved = false;
      let relevant = !nav; // fail-open tant que la sidebar n'est pas montée
      for (const m of mutations) {
        if (!relevant) {
          if (nav.contains(m.target)) relevant = true;
          else for (const node of m.addedNodes) { // remount : #side-nav (ré)inséré
            if (node.nodeType === 1 && (node === nav || node.contains?.(nav))) {
              relevant = true; break;
            }
          }
        }
        for (const node of m.removedNodes) {
          if (node.nodeType !== 1) continue; // éléments seulement
          if (node.classList?.contains('side-nav-card') ||
              node.querySelector?.('.side-nav-card')) {
            cardRemoved = true;
            relevant = true; // un retrait de carte est, par nature, pertinent
            break;
          }
        }
        if (cardRemoved && relevant) break;
      }
      if (cardRemoved) loadingOverlay.bumpActivity();

      // Transition réduit↔étendu : le clic sur "Réduire"/"Développer" fait
      // reconstruire les cartes par Twitch (structure DOM différente), ce qui
      // efface nos injections (#tse-filter, tri, data-tse-*) et laisse des
      // données périmées de l'état précédent. On force alors une ré-init
      // COMPLÈTE (cache vidé + re-scan) sous voile de chargement, plutôt
      // qu'un simple scan incrémental, pour repeupler proprement la sidebar.
      // Une seule fois par transition (l'état observé est mis à jour aussitôt).
      // VOLONTAIREMENT inconditionnel (hors porte) : le marqueur collapsed est
      // posé sur un ANCÊTRE de #side-nav, donc en dehors de la porte ; on le
      // vérifie donc à chaque mutation pour ne jamais manquer une bascule.
      if (nav) {
        const collapsedNow = detectSidebarCollapsed();
        if (lastObservedCollapsed === null) {
          // Première observation avec une sidebar réellement montée : c'est
          // la ligne de base, pas une transition.
          lastObservedCollapsed = collapsedNow;
        } else if (collapsedNow !== lastObservedCollapsed) {
          lastObservedCollapsed = collapsedNow;
          loadingOverlay.startCycle('bascule réduit/étendu');
          invalidateAndRescan();
          return; // invalidateAndRescan a déjà relancé un scan complet
        }
      }

      if (relevant) scheduleScan(); // porte : pas de scan pour les mutations hors sidebar
    });
    obs.observe(document.body, { childList: true, subtree: true });
    scanSidebar();
  };

  /* ============================================================
   *  DIAGNOSTIC DE SÉLECTEURS (auto-diagnostic de pérennité)
   *  -------------------------------------------------------------
   *  Sonde les dépendances DOM critiques de l'extension pour
   *  détecter quand Twitch modifie son markup et qu'un sélecteur
   *  ne matche plus. Chaque sonde renvoie l'un de trois états :
   *    'ok'     → la dépendance répond ;
   *    'broken' → attendue mais introuvable (changement Twitch probable) ;
   *    'na'     → non applicable dans le contexte courant (sidebar
   *               réduite, aucune carte à sonder…) → PAS un signe de casse.
   *  Seules les sondes `critical` en 'broken' déclenchent l'alerte
   *  automatique (console.warn, une seule fois par incident). Rapport
   *  complet à la demande via tse.diagnose().
   * ============================================================ */
  function runDiagnostics() {
    const root      = document.querySelector(DOM.sidebarRoot);
    const collapsed = detectSidebarCollapsed();
    const section   = followedSection();
    const allCards  = [...document.querySelectorAll('.side-nav-card')]
      .filter(c => !isSynthetic(c));
    // Cartes de TWITCH uniquement : les nôtres sont des clones, elles
    // répondraient forcément « ok » et masqueraient une rupture réelle du
    // markup — exactement ce que ce diagnostic doit détecter.
    const cards     = section
      ? [...section.querySelectorAll('.side-nav-card')].filter(c => !isSynthetic(c))
      : [];
    // Carte-échantillon live (porte tous les sous-éléments). dataset.tseOffline
    // vient de notre traitement ; à défaut, on prend la 1re carte.
    const liveSample = cards.find(c => c.dataset.tseOffline !== 'true') || null;
    const anySample  = liveSample || cards[0] || null;
    // Liens de chaîne génériques : signal NEUTRE (indépendant de nos classes)
    // pour distinguer « 0 carte car Twitch a renommé .side-nav-card » de
    // « 0 carte car l'utilisateur ne suit personne / sidebar vide ».
    const navLinks = root ? root.querySelectorAll('a[href^="/"]').length : 0;
    // Carte live ET étendue : seul contexte où statut live / catégorie existent.
    const exp = collapsed ? null : liveSample;

    const probes = [];
    const add = (id, label, critical, status, detail) =>
      probes.push({ id, label, critical, status, detail });

    add('sidebarRoot', DOM.sidebarRoot, true,
        root ? 'ok' : 'broken',
        root ? '' : 'racine de sidebar introuvable');

    add('followedSection', 'DOM.followedSelector', true,
        !root ? 'na' : (section ? 'ok' : 'broken'),
        !root ? 'racine absente' : (section ? '' : 'section « Chaînes suivies » introuvable'));

    add('cardClass', '.side-nav-card', true,
        !root ? 'na' : (allCards.length ? 'ok' : (navLinks > 3 ? 'broken' : 'na')),
        allCards.length ? `${allCards.length} carte(s)`
          : (navLinks > 3 ? `${navLinks} liens de chaîne mais 0 .side-nav-card`
                          : 'aucune carte (aucun suivi ?)'));

    add('cardLink', 'DOM.cardLinkSelector', false,
        !anySample ? 'na' : (anySample.querySelector(DOM.cardLinkSelector) ? 'ok' : 'broken'),
        anySample ? '' : 'aucune carte à sonder');

    add('avatar', 'avatarOf()', false,
        !anySample ? 'na' : (avatarOf(anySample) ? 'ok' : 'broken'),
        anySample ? '' : 'aucune carte à sonder');

    add('liveStatus', 'liveStatusOf() — viewers/uptime', true,
        collapsed ? 'na' : (!exp ? 'na' : (liveStatusOf(exp) ? 'ok' : 'broken')),
        collapsed ? 'sidebar réduite' : (exp ? '' : 'aucune carte live à sonder'));

    add('liveIndicator', DOM.liveIndicator, false,
        collapsed ? 'na' : (!exp ? 'na' : (exp.querySelector(DOM.liveIndicator) ? 'ok' : 'broken')),
        collapsed ? 'sidebar réduite' : (exp ? '' : 'aucune carte live à sonder'));

    // CRITIQUE depuis que l'extension rafraîchit elle-même le compteur : c'est
    // l'élément à côté duquel le nôtre s'insère et celui que le CSS masque.
    // S'il disparaît du markup Twitch, aucun compteur ne s'affiche plus.
    add('viewersCount', 'nativeViewersEl() — compteur de viewers', true,
        collapsed ? 'na' : (!exp ? 'na' : (nativeViewersEl(exp) ? 'ok' : 'broken')),
        collapsed ? 'sidebar réduite' : (exp ? '' : 'aucune carte live à sonder'));

    add('category', 'getCardCategory() — métadonnées', false,
        collapsed ? 'na' : (!exp ? 'na' : (getCardCategory(exp) ? 'ok' : 'broken')),
        collapsed ? 'sidebar réduite' : (exp ? '' : 'aucune carte live à sonder'));

    return probes;
  }

  // Affiche le rapport en console.table (en-têtes localisés).
  function logDiagnostics(report) {
    const tag = (s) =>
      s === 'ok' ? 'OK' : s === 'broken' ? S.consoleHealthTagBroken : S.consoleHealthTagNa;
    console.table(report.map(p => ({
      [S.consoleColProbe]:  p.label,
      [S.consoleColStatus]: tag(p.status),
      [S.consoleColDetail]: p.detail || ''
    })));
  }

  // Une sonde critique est-elle cassée ? (verdict commun à l'auto-diagnostic
  // et à tse.diagnose().)
  function hasCriticalBreakage(report) {
    return report.some(p => p.critical && p.status === 'broken');
  }

  // Auto-diagnostic : alerte UNE fois par incident si une sonde critique casse,
  // et se ré-arme quand tout est revenu vert. Appelé peu après le boot puis
  // tous les DATA_TTL (cf. startTimers).
  let healthWarned = false;
  function runSelectorHealthCheck() {
    if (!document.querySelector(DOM.sidebarRoot)) return;          // sidebar pas encore montée
    if (document.body.classList.contains('tse-loading')) return; // chargement en cours : cartes pas encore rendues
    const report = runDiagnostics();
    const broken = hasCriticalBreakage(report);
    if (broken && !healthWarned) {
      healthWarned = true;
      console.warn(S.consoleHealthBroken);
      logDiagnostics(report);
    } else if (!broken && healthWarned) {
      healthWarned = false; // incident résolu → ré-armer pour un futur changement
    }
  }

  /* ============================================================
   *  TIMERS
   * ============================================================ */
  const invalidateAndRescan = () => {
    cache.clear();
    document.querySelectorAll('.side-nav-card[data-tse-login]').forEach(card => {
      delete card.dataset.tseLogin;
    });
    scanSidebar();
  };

  const startTimers = () => {
    // Rafraîchissement local de l'affichage (uptime / freshness).
    // Pas de requête réseau, donc OK même en arrière-plan.
    setInterval(() => {
      document.querySelectorAll('.side-nav-card[data-tse-started-at]').forEach(card => {
        refreshUptime(card);
        updateFreshness(card);
      });
    }, CFG.UI_TICK);

    // Réveil de rafraîchissement. Il ne fait QUE programmer un scan : les
    // entrées de cache périmées depuis plus de LIVE_TTL sont alors remises en
    // file par processCard, et les fraîches relues sans réseau. La cadence
    // réelle de fraîcheur est donc fixée par LIVE_TTL, pas ici — ce timer
    // n'existe que pour couvrir le cas d'une sidebar immobile, où aucune
    // mutation DOM ne déclencherait de scan.
    //
    // Skippé quand l'onglet est caché : les navigateurs throttlent setTimeout
    // et fetch en arrière-plan, donc les réponses arrivent vides ou en timeout
    // et déclencheraient des faux "Terminé" partout. On rattrape au retour de
    // l'utilisateur (cf. handler visibilitychange plus bas).
    setInterval(() => {
      if (document.hidden) return;
      scheduleScan();
      // Réchauffage des miniatures. Posé ici parce que ce réveil a déjà les
      // deux propriétés voulues : il est coupé en arrière-plan, et il est plus
      // fin que la tranche de cache, donc la bascule est vue à 5 s près.
      thumbPreload.tick();
      // Passe structurelle du mode global. Même raison de vivre ici : coupée
      // en arrière-plan, et assez fine pour que GLOBAL_STRUCT_TICK soit tenu
      // à 5 s près. Ne fait rien tant que state.globalMode est faux.
      globalChannels.tick();
    }, CFG.REFRESH_TICK);

    // Entretien : purge mémoire + auto-diagnostic. Aucun rapport avec la
    // fraîcheur, d'où une cadence propre, bien plus lente.
    setInterval(() => {
      // Purge des caches reconstructibles — exécutée TOUJOURS (même onglet
      // caché) pour libérer la RAM en arrière-plan. Les entrées des chaînes
      // affichées sont re-set en boucle par le scan et ne vieillissent jamais
      // jusqu'à l'âge d'éviction ; seules les entrées ponctuelles (survols hors
      // "suivis", cartes disparues) sont évincées → re-fetch à la demande.
      pruneCache(cache, CFG.LIVE_PRUNE_AGE, CFG.LIVE_CACHE_MAX);
      pruneCache(gsCache, CFG.GS_PRUNE_AGE, CFG.GS_CACHE_MAX);
      preview.prune();
      liveLag.prune();
      roster.flush(); // écriture différée du roster (cf. module ROSTER)

      // Onglet caché : on libère en plus tout le cache de streams. Il est
      // reconstructible à la demande, et au retour invalidateAndRescan le
      // reconstruit sous le voile de chargement.
      if (document.hidden) { cache.clear(); return; }
      runSelectorHealthCheck();
    }, CFG.MAINTENANCE_TICK);

    // Au retour d'une absence significative (onglet caché >= REVISIT_RELOAD_MS),
    // on réinitialise la sidebar comme à un boot. Pendant que l'onglet était
    // caché : notre cycle de re-fetch GraphQL était en pause (cf. ci-dessus) ET
    // Twitch a pu muter sa sidebar sans qu'on l'observe — cartes retirées quand
    // des streams se terminent, cartes ajoutées quand d'autres passent en live —
    // laissant un état partiel (ex. : seulement les chaînes fraîchement en live).
    // On masque cette re-hydratation derrière le voile + purge du cache + rescan
    // complet ; le voile se lève dès stabilité (cf. notifyScan). On mesure la
    // durée RÉELLE d'absence (instant de masquage → instant de retour), et non
    // le temps écoulé depuis le dernier refresh.
    let hiddenSince = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenSince = Date.now(); return; }
      if (!hiddenSince) return; // onglet ouvert en arrière-plan au boot : rien à faire
      const awayMs = Date.now() - hiddenSince;
      hiddenSince = 0;
      if (awayMs < CFG.REVISIT_RELOAD_MS) return;
      loadingOverlay.startCycle('retour d\'onglet');
      invalidateAndRescan();
    });

    // 1er auto-diagnostic des sélecteurs, après que Twitch ait monté la sidebar.
    setTimeout(runSelectorHealthCheck, CFG.HEALTH_INITIAL_DELAY);
  };

  /* ============================================================
   *  BOOT
   * ============================================================ */
  const boot = () => {
    injectCSS();
    const ready = () => {
      // DOMContentLoaded : refreshLanguage corrige LANG si la première
      // détection (à document_start) était trop précoce.
      refreshLanguage();
      loadingOverlay.init(); // doit être appelé AVANT startObserver pour
                             // que le voile soit posé avant le premier scan
      roster.init();         // avant startObserver : le 1er scan relève déjà
      liveLag.init();
      visitTracker.init();
      preview.init();
      startObserver();
      startTimers();
    };
    if (document.body) ready();
    else document.addEventListener('DOMContentLoaded', ready, { once: true });
  };

  boot();
})();