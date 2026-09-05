

const TSE_PREVIEW_FIRST_FRAME_MSG = 'tse:preview-first-frame';

const TSE_PREVIEW_GATE_MSG = 'tse:preview-gate';

const TSE_PREVIEW_HELLO_MSG = 'tse:preview-hello';

const TSE_GATE_ENABLED = true;

const TSE_GATE_BUTTON =
  'button[data-a-target="content-classification-gate-overlay-start-watching-button"]';

const TSE_GATE_ZONE = '[data-a-target^="content-classification-gate"]';

const TSE_GATE_MAX_CLICKS = 5;

(() => {
  'use strict';

  try {
    if (window.top === window) return;
    if (location.hostname !== 'player.twitch.tv') return;
  } catch { return; }

  let targets;
  try {
    const a = location.ancestorOrigins;
    targets = a && a.length ? [a[0]] : null;
  } catch { targets = null; }
  if (!targets) targets = ['https://www.twitch.tv', 'https://twitch.tv'];

  const poster = (quoi) => {
    for (const origin of targets) {
      try { window.parent.postMessage({ tse: quoi }, origin); } catch {   }
    }
  };

  poster(TSE_PREVIEW_HELLO_MSG);

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

  const annoncer = () => {
    if (sent || !imagePrete) return;
    if (gateBouton()) return;
    sent = true;
    poster(TSE_PREVIEW_FIRST_FRAME_MSG);
  };
  const announce = () => { imagePrete = true; annoncer(); };

  const cliques = new WeakSet();
  let clics = 0, gateVue = false;
  const lever = () => {

    if (gateVue && (!TSE_GATE_ENABLED || clics >= TSE_GATE_MAX_CLICKS)) return;
    const btn = gateBouton();
    if (!btn) return;

    if (!gateVue) { gateVue = true; poster(TSE_PREVIEW_GATE_MSG); }

    if (!TSE_GATE_ENABLED || clics >= TSE_GATE_MAX_CLICKS) return;
    if (cliques.has(btn)) return;
    cliques.add(btn);
    clics += 1;
    try { btn.click(); } catch {   }
  };

  const watch = (video) => {

    if (typeof video.requestVideoFrameCallback === 'function') {
      try { video.requestVideoFrameCallback(announce); } catch {   }
    }
    video.addEventListener('playing', announce, { once: true });
    if (video.readyState >= 2) announce();
  };

  let vue = null;
  const scan = () => {
    lever();
    const v = document.querySelector('video');
    if (v && v !== vue) { vue = v; watch(v); }

    annoncer();

    return sent;
  };

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

  try {
    if (window.top !== window) return;
  } catch { return; }

  const DOM = Object.freeze({

    sidebarRoot:             '#side-nav',
    followedSelector:        '[aria-label="Chaînes suivies"], [aria-label="Followed Channels"], [aria-label="Kanäle, denen du folgst"], [aria-label="Canales que sigues"], [aria-label="Canais seguidos"], [aria-label="Canais que segues"]',

    followedHeaderSelector:  '[class*="followed-side-nav-header"]',

    storiesSelector:         '[data-a-target*="stories" i], [class*="stories" i]',
    followedCardSelector:    'a[data-test-selector="followed-channel"]',

    liveIndicator:           '.tw-channel-status-indicator',

    cardLinkSelector:        'a[data-a-target="side-nav-card"], a.side-nav-card__link, a[href^="/"]',
    discountSelector:        '[aria-label="Abonnement-cadeau"], [aria-label="Gift a Sub"], [aria-label="Abo verschenken"], [aria-label="Suscripción de Regalo"], [aria-label="Inscrição de presente"], [aria-label="Oferta de subscrição"]',
    altLogoSelector:         'img[alt^="Logo de"], img[alt^="Logo of"], img[alt^="Logo von"]',
    altCostreamHostSelector: 'img[alt^="Co-stream d\'un stream de "], img[alt^="Co-stream from a stream by "], img[alt^="Co-stream aus einem Stream von "], img[alt^="Co-stream de um stream de "]',

    followedLabels:          ['Chaînes suivies', 'Followed Channels', 'Kanäle, denen du folgst', 'Canales que sigues', 'Canais seguidos', 'Canais que segues'],
    showMoreLabels:          ['Afficher plus', 'Show More', 'Mehr anzeigen', 'Mostrar más', 'Mostrar mais'],
    showLessLabels:          ['Afficher moins', 'Show Less', 'Weniger anzeigen', 'Mostrar menos'],

    showMoreStableSelector:  '[data-a-target="side-nav-show-more-button"], [data-test-selector="ShowMore"]',

    subManageSelector:       '[data-a-target="manage-sub-button"]',

    subCardSelector:         '[data-a-target="subscription-card"]',

    subCardNoiseSelector:
      '.sub-badge-progress, .subscription-card__sub-progress, .expired-sub-message, ' +
      '.subscription-card__channel-name, [data-a-target], [data-test-selector]',
    subOfferSelector:        '[data-a-target="subscribe-button"]',
    showLessStableSelector:  '[data-a-target="side-nav-show-less-button"], [data-test-selector="ShowLess"]',

    offlineRe:               /\b(?:déconnecté(?:e)?s?|offline|desconectad(?:o|a)s?)\b/i,

    nativeHeaderRe:          /Spectateurs|Recommandées|Viewers|Recommended|Zuschauer|Empfohlen|espe(?:ct|t)adores/i,
    costreamHostRe:          /^(?:Co-stream d'un stream de|Co-stream from a stream by|Co-stream aus einem Stream von|Co-stream de um stream de)\s+([A-Za-z0-9_]+)$/,

    guestsTotalRe:           /\s(?:et|and|und|y|e)\s+(\d+)\s+(?:invité|guest|Gast|Gäste|invitado|convidado)/i,
    sponsorLogoRe:           /^Logo\s+(?:de|of|von)\s+(.+)$/i,
  });

  const plurielSlave = (n, [un, peu, beaucoup]) => {
    const d = n % 10, c = n % 100;
    if (d === 1 && c !== 11) return un;
    if (d >= 2 && d <= 4 && (c < 12 || c > 14)) return peu;
    return beaucoup;
  };

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
      uiBadgeCostreamOf:         (nom) => `Co-stream de ${nom}`,
      uiBadgeCostreamHost:       'Stream Hôte',
      uiBadgeSubMonths:          (n) => `Abonné ${n} mois`,
      uiBadgeExSubMonths:        (n) => `Anciennement abonné ${n} mois`,

      uiCclMatureGame:                      'Jeux matures',
      uiCclGambling:                        'Jeux d\'argent',
      uiCclSexualThemes:                    'Thèmes sexuels',
      uiCclViolentGraphic:                  'Violence explicite',
      uiCclDrugsIntoxication:               'Drogues et alcool',
      uiCclProfanityVulgarity:              'Langage cru',
      uiCclDebatedSocialIssuesAndPolitics:  'Politique et sujets sensibles',
      uiCclGeneric:                         'Contenu classifié',
      uiBadgeCostreamWithNames:  (noms) => `Co-stream avec ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `Vient de passer sur ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` et ${others} autre${others > 1 ? 's' : ''}` : '';
        return `En live avec ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Sponsorisé par ${nom}`,
      uiSortNoCoStreams:         'Aucun co-stream détecté actuellement',
      uiSortLabelSubs:           'Mes abonnements en tête',
      uiSortLabelSubsCount:      (n) => `Mes abonnements en tête — ${n} abonnement${n > 1 ? 's' : ''} au total`,
      uiSortNoSubs:              'Aucun abonnement repéré pour l\'instant — ouvrez une chaîne à laquelle vous êtes abonné',
      uiSortSubsOffline:         'Aucun de vos abonnements n\'est en direct',
      consoleNoSubs:             '[tse] Aucun abonnement repéré pour le moment.',
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
      uiBadgeCostreamOf:         (nom) => `Co-stream of ${nom}`,
      uiBadgeCostreamHost:       'Host Stream',
      uiBadgeSubMonths:          (n) => `Subscribed ${n} month${n > 1 ? 's' : ''}`,
      uiBadgeExSubMonths:        (n) => `Formerly subscribed ${n} month${n > 1 ? 's' : ''}`,
      uiCclMatureGame:                      'Mature-rated game',
      uiCclGambling:                        'Gambling',
      uiCclSexualThemes:                    'Sexual themes',
      uiCclViolentGraphic:                  'Graphic violence',
      uiCclDrugsIntoxication:               'Drugs & intoxication',
      uiCclProfanityVulgarity:              'Strong language',
      uiCclDebatedSocialIssuesAndPolitics:  'Politics & sensitive topics',
      uiCclGeneric:                         'Classified content',
      uiBadgeCostreamWithNames:  (noms) => `Co-stream with ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `Just switched to ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` and ${others} other${others > 1 ? 's' : ''}` : '';
        return `Live with ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Sponsored by ${nom}`,
      uiSortNoCoStreams:         'No co-streams currently detected',
      uiSortLabelSubs:           'My subscriptions first',
      uiSortLabelSubsCount:      (n) => `My subscriptions first — ${n} subscription${n > 1 ? 's' : ''} in total`,
      uiSortNoSubs:              'No subscription spotted yet — open a channel you are subscribed to',
      uiSortSubsOffline:         'None of your subscriptions is live',
      consoleNoSubs:             '[tse] No subscription spotted yet.',
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
      uiBadgeCostreamOf:         (nom) => `Co-stream von ${nom}`,
      uiBadgeCostreamHost:       'Host-Stream',
      uiBadgeSubMonths:          (n) => `${n} Monat${n > 1 ? 'e' : ''} abonniert`,
      uiBadgeExSubMonths:        (n) => `Früher ${n} Monat${n > 1 ? 'e' : ''} abonniert`,
      uiCclMatureGame:                      'Spiel ab 18',
      uiCclGambling:                        'Glücksspiel',
      uiCclSexualThemes:                    'Sexuelle Themen',
      uiCclViolentGraphic:                  'Explizite Gewalt',
      uiCclDrugsIntoxication:               'Drogen & Alkohol',
      uiCclProfanityVulgarity:              'Derbe Sprache',
      uiCclDebatedSocialIssuesAndPolitics:  'Politik & sensible Themen',
      uiCclGeneric:                         'Klassifizierter Inhalt',
      uiBadgeCostreamWithNames:  (noms) => `Co-stream mit ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `Gerade gewechselt zu ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` und ${others} ${others > 1 ? 'weiteren' : 'weiterem'}` : '';
        return `Live mit ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Gesponsert von ${nom}`,
      uiSortNoCoStreams:         'Derzeit keine Co-streams erkannt',
      uiSortLabelSubs:           'Meine Abos zuerst',
      uiSortLabelSubsCount:      (n) => `Meine Abos zuerst — ${n} Abo${n > 1 ? 's' : ''} insgesamt`,
      uiSortNoSubs:              'Noch kein Abo erkannt — öffne einen Kanal, den du abonniert hast',
      uiSortSubsOffline:         'Keines deiner Abos ist live',
      consoleNoSubs:             '[tse] Noch kein Abo erkannt.',
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
      uiBadgeCostreamOf:         (nom) => `Co-stream de ${nom}`,
      uiBadgeCostreamHost:       'Canal anfitrión',
      uiBadgeSubMonths:          (n) => `Suscrito ${n} mes${n > 1 ? 'es' : ''}`,
      uiBadgeExSubMonths:        (n) => `Anteriormente suscrito ${n} mes${n > 1 ? 'es' : ''}`,
      uiCclMatureGame:                      'Juego para adultos',
      uiCclGambling:                        'Juegos de azar',
      uiCclSexualThemes:                    'Temas sexuales',
      uiCclViolentGraphic:                  'Violencia explícita',
      uiCclDrugsIntoxication:               'Drogas y alcohol',
      uiCclProfanityVulgarity:              'Lenguaje soez',
      uiCclDebatedSocialIssuesAndPolitics:  'Política y temas sensibles',
      uiCclGeneric:                         'Contenido clasificado',
      uiBadgeCostreamWithNames:  (noms) => `Co-stream con ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `Acaba de cambiar a ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` y ${others} más` : '';
        return `En vivo con ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Patrocinado por ${nom}`,
      uiSortNoCoStreams:         'No se detectaron co-streams por el momento',
      uiSortLabelSubs:           'Mis suscripciones primero',
      uiSortLabelSubsCount:      (n) => `Mis suscripciones primero — ${n} suscripci${n > 1 ? 'ones' : 'ón'} en total`,
      uiSortNoSubs:              'Ninguna suscripción detectada aún — abre un canal al que estés suscrito',
      uiSortSubsOffline:         'Ninguna de tus suscripciones está en directo',
      consoleNoSubs:             '[tse] Ninguna suscripción detectada por ahora.',
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
      uiBadgeCostreamOf:         (nom) => `Co-stream de ${nom}`,
      uiBadgeCostreamHost:       'Canal anfitrião',
      uiBadgeSubMonths:          (n) => `Inscrito há ${n} ${n > 1 ? 'meses' : 'mês'}`,
      uiBadgeExSubMonths:        (n) => `Anteriormente inscrito ${n} ${n > 1 ? 'meses' : 'mês'}`,
      uiCclMatureGame:                      'Jogo adulto',
      uiCclGambling:                        'Jogos de azar',
      uiCclSexualThemes:                    'Temas sexuais',
      uiCclViolentGraphic:                  'Violência explícita',
      uiCclDrugsIntoxication:               'Drogas e álcool',
      uiCclProfanityVulgarity:              'Linguagem forte',
      uiCclDebatedSocialIssuesAndPolitics:  'Política e temas sensíveis',
      uiCclGeneric:                         'Conteúdo classificado',
      uiBadgeCostreamWithNames:  (noms) => `Co-stream com ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `Acabou de mudar para ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` e mais ${others}` : '';
        return `Ao vivo com ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Patrocinado por ${nom}`,
      uiSortNoCoStreams:         'Nenhum co-stream detectado no momento',
      uiSortLabelSubs:           'Minhas inscrições primeiro',
      uiSortLabelSubsCount:      (n) => `Minhas inscrições primeiro — ${n} inscri${n > 1 ? 'ções' : 'ção'} no total`,
      uiSortNoSubs:              'Nenhuma inscrição detectada ainda — abra um canal em que você é inscrito',
      uiSortSubsOffline:         'Nenhuma das suas inscrições está ao vivo',
      consoleNoSubs:             '[tse] Nenhuma inscrição detectada por enquanto.',
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
    }),
    it: Object.freeze({
      followedLabel:             'Canali seguiti',
      uiGlobalLabel:             'Canali di punta',
      uiModeMenuAria:            'Scegli cosa mostrare nella barra laterale',
      uiGlobalPartial:           'Classifica parziale: al momento Twitch non espone abbastanza categorie per garantirla completa.',
      uiFilterAriaLabel:         'Filtra i canali seguiti per categoria',
      uiFilterAllCategories:     'Tutte le categorie',
      uiFilterLangAriaLabel:     'Filtra i canali seguiti per lingua',
      uiFilterAllLanguages:      'Tutte le lingue',
      uiUptimeEnded:             'Terminato',
      uiPreviewUnavailable:      'Anteprima non disponibile',
      uiPreviewLoadingTitle:     'Caricamento del titolo…',
      uiBadgeCostreamOf:         (nom) => `Co-stream di ${nom}`,
      uiBadgeCostreamHost:       'Stream host',
      uiBadgeSubMonths:          (n) => `Abbonato da ${n} mes${n > 1 ? 'i' : 'e'}`,
      uiBadgeExSubMonths:        (n) => `Già abbonato per ${n} mes${n > 1 ? 'i' : 'e'}`,
      uiCclMatureGame:                      'Gioco per adulti',
      uiCclGambling:                        'Gioco d\'azzardo',
      uiCclSexualThemes:                    'Temi sessuali',
      uiCclViolentGraphic:                  'Violenza esplicita',
      uiCclDrugsIntoxication:               'Droghe e alcol',
      uiCclProfanityVulgarity:              'Linguaggio forte',
      uiCclDebatedSocialIssuesAndPolitics:  'Politica e temi sensibili',
      uiCclGeneric:                         'Contenuto classificato',
      uiBadgeCostreamWithNames:  (noms) => `Co-stream con ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `È appena passato a ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` e altri ${others}` : '';
        return `In diretta con ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Sponsorizzato da ${nom}`,
      uiSortNoCoStreams:         'Nessun co-stream rilevato al momento',
      uiSortLabelSubs:           'I miei abbonamenti per primi',
      uiSortLabelSubsCount:      (n) => `I miei abbonamenti per primi — ${n} abbonament${n > 1 ? 'i' : 'o'} in totale`,
      uiSortNoSubs:              'Nessun abbonamento rilevato finora — apri un canale a cui sei abbonato',
      uiSortSubsOffline:         'Nessuno dei tuoi abbonamenti è in diretta',
      consoleNoSubs:             '[tse] Nessun abbonamento rilevato al momento.',
      uiSortLabelViewers:        'Ordina per numero di spettatori (decrescente)',
      uiSortLabelPopular:        'Ordina per popolarità personale (visite recenti)',
      uiSortLabelUptime:         'Ordina per durata dello stream (crescente)',
      uiSortLabelAlpha:          'Ordina per nome del canale (alfabetico)',
      uiSortLabelCostream:       'Raggruppa i co-stream in cima',
      consoleNoVisits:           '[tse] Nessuna visita registrata al momento.',
      consoleHistoryCleared:     '[tse] Cronologia delle visite cancellata.',
      consoleColLogin:           'login',
      consoleColScore:           'punteggio',
      consoleColVisits:          'visite',
      consoleColLast:            'ultima visita',
      consoleColLag:             'ritardo di Twitch',
      consoleColGain:            'guadagnato dall\'estensione',
      consoleLagGain:            (n, med) => `[tse] Su ${n} di queste dirette, l'estensione ha anticipato Twitch di ${med} in mediana.`,
      consoleColSeen:            'visto il',
      consoleLagEmpty:           '[tse] Nessuna misurazione utilizzabile al momento. Lascia aperta la scheda Twitch: un campione viene raccolto ogni volta che un canale seguito va in diretta sotto i tuoi occhi.',
      consoleLagSummary:         (n, med, p90) => `[tse] ${n} misurazione/i — ritardo mediano di Twitch: ${med}, 90° percentile: ${p90}.`,
      consoleRosterEmpty:        '[tse] Nessun canale memorizzato al momento.',
      consoleRosterSummary:      (n) => `[tse] ${n} canale/i seguito/i memorizzato/i localmente.`,
      consoleHealthBroken:       '[tse] Alcuni selettori critici non corrispondono più al DOM di Twitch — l\'estensione potrebbe essere parzialmente rotta. Dettagli: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Tutti i selettori critici rispondono.',
      consoleMassOffline:        (n, total) => `[tse] Risposta sospetta dall'API di Twitch: ${n} canali su ${total} noti come in diretta sono dichiarati offline tutti insieme. Visualizzazione mantenuta invece di svuotare la barra laterale; nuovo tentativo tra 30 s.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Canali globali: ${n} errori consecutivi dall'API di Twitch. Cadenza strutturale ridotta a ${s} s per non martellare l'endpoint. La barra laterale « Canali seguiti » non è interessata.`,
      consoleGlobalRestored:     (s) => `[tse] Canali globali: API di nuovo stabile, cadenza strutturale ripristinata a ${s} s.`,
      consoleColProbe:           'sonda',
      consoleColStatus:          'stato',
      consoleColDetail:          'dettaglio',
      consoleHealthTagBroken:    'ROTTO',
      consoleHealthTagNa:        'N/D',
      locale:                    'it-IT',
    }),
    pl: Object.freeze({
      followedLabel:             'Obserwowane kanały',
      uiGlobalLabel:             'Najpopularniejsze kanały',
      uiModeMenuAria:            'Wybierz, co ma wyświetlać panel boczny',
      uiGlobalPartial:           'Ranking częściowy: Twitch nie udostępnia obecnie wystarczającej liczby kategorii, by zagwarantować jego kompletność.',
      uiFilterAriaLabel:         'Filtruj obserwowane kanały według kategorii',
      uiFilterAllCategories:     'Wszystkie kategorie',
      uiFilterLangAriaLabel:     'Filtruj obserwowane kanały według języka',
      uiFilterAllLanguages:      'Wszystkie języki',
      uiUptimeEnded:             'Zakończono',
      uiPreviewUnavailable:      'Podgląd niedostępny',
      uiPreviewLoadingTitle:     'Wczytywanie tytułu…',
      uiBadgeCostreamOf:         (nom) => `Co-stream u ${nom}`,
      uiBadgeCostreamHost:       'Kanał gospodarza',
      uiBadgeSubMonths:          (n) => `Subskrypcja: ${n} ${plurielSlave(n, ['miesiąc', 'miesiące', 'miesięcy'])}`,
      uiBadgeExSubMonths:        (n) => `Dawna subskrypcja: ${n} ${plurielSlave(n, ['miesiąc', 'miesiące', 'miesięcy'])}`,
      uiCclMatureGame:                      'Gra dla dorosłych',
      uiCclGambling:                        'Hazard',
      uiCclSexualThemes:                    'Treści seksualne',
      uiCclViolentGraphic:                  'Drastyczna przemoc',
      uiCclDrugsIntoxication:               'Narkotyki i alkohol',
      uiCclProfanityVulgarity:              'Wulgarny język',
      uiCclDebatedSocialIssuesAndPolitics:  'Polityka i tematy drażliwe',
      uiCclGeneric:                         'Treść oznaczona',
      uiBadgeCostreamWithNames:  (noms) => `Co-stream z ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `Właśnie przeszedł na ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` i jeszcze ${others}` : '';
        return `Na żywo z ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Sponsorowane przez ${nom}`,
      uiSortNoCoStreams:         'Nie wykryto obecnie żadnego co-streamu',
      uiSortLabelSubs:           'Moje subskrypcje na górze',
      uiSortLabelSubsCount:      (n) => `Moje subskrypcje na górze — łącznie ${n} ${plurielSlave(n, ['subskrypcja', 'subskrypcje', 'subskrypcji'])}`,
      uiSortNoSubs:              'Nie wykryto jeszcze żadnej subskrypcji — otwórz kanał, który subskrybujesz',
      uiSortSubsOffline:         'Żadna z Twoich subskrypcji nie jest na żywo',
      consoleNoSubs:             '[tse] Nie wykryto jeszcze żadnej subskrypcji.',
      uiSortLabelViewers:        'Sortuj według liczby widzów (malejąco)',
      uiSortLabelPopular:        'Sortuj według osobistej popularności (ostatnie wizyty)',
      uiSortLabelUptime:         'Sortuj według czasu trwania streamu (rosnąco)',
      uiSortLabelAlpha:          'Sortuj według nazwy kanału (alfabetycznie)',
      uiSortLabelCostream:       'Grupuj co-streamy na górze',
      consoleNoVisits:           '[tse] Nie zapisano jeszcze żadnej wizyty.',
      consoleHistoryCleared:     '[tse] Historia wizyt wyczyszczona.',
      consoleColLogin:           'login',
      consoleColScore:           'wynik',
      consoleColVisits:          'wizyty',
      consoleColLast:            'ostatnia wizyta',
      consoleColLag:             'opóźnienie Twitcha',
      consoleColGain:            'zysk rozszerzenia',
      consoleLagGain:            (n, med) => `[tse] Na ${n} z tych transmisji rozszerzenie wyprzedziło Twitcha o ${med} w medianie.`,
      consoleColSeen:            'zauważono',
      consoleLagEmpty:           '[tse] Brak na razie użytecznych pomiarów. Zostaw kartę Twitcha otwartą: próbka jest pobierana za każdym razem, gdy obserwowany kanał wchodzi na żywo na Twoich oczach.',
      consoleLagSummary:         (n, med, p90) => `[tse] Pomiary: ${n} — mediana opóźnienia Twitcha: ${med}, 90. percentyl: ${p90}.`,
      consoleRosterEmpty:        '[tse] Nie zapamiętano jeszcze żadnego kanału.',
      consoleRosterSummary:      (n) => `[tse] Zapamiętano lokalnie ${n} obserwowanych kanałów.`,
      consoleHealthBroken:       '[tse] Niektóre krytyczne selektory nie pasują już do DOM Twitcha — rozszerzenie może być częściowo zepsute. Szczegóły: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Wszystkie krytyczne selektory odpowiadają.',
      consoleMassOffline:        (n, total) => `[tse] Podejrzana odpowiedź API Twitcha: ${n} z ${total} kanałów znanych jako na żywo zgłoszono naraz jako offline. Zachowano bieżący widok zamiast opróżniać panel boczny; ponowna próba za 30 s.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Kanały globalne: ${n} kolejnych błędów API Twitcha. Rytm strukturalny zwolniony do ${s} s, aby nie zasypywać punktu końcowego. Panel „Obserwowane kanały” nie jest tym dotknięty.`,
      consoleGlobalRestored:     (s) => `[tse] Kanały globalne: API znów stabilne, rytm strukturalny przywrócony do ${s} s.`,
      consoleColProbe:           'sonda',
      consoleColStatus:          'stan',
      consoleColDetail:          'szczegół',
      consoleHealthTagBroken:    'ZEPSUTY',
      consoleHealthTagNa:        'BD',
      locale:                    'pl-PL',
    }),
    ru: Object.freeze({
      followedLabel:             'Отслеживаемые каналы',
      uiGlobalLabel:             'Топ каналов',
      uiModeMenuAria:            'Выберите, что показывать на боковой панели',
      uiGlobalPartial:           'Частичный рейтинг: Twitch сейчас отдаёт недостаточно категорий, чтобы гарантировать его полноту.',
      uiFilterAriaLabel:         'Фильтровать отслеживаемые каналы по категории',
      uiFilterAllCategories:     'Все категории',
      uiFilterLangAriaLabel:     'Фильтровать отслеживаемые каналы по языку',
      uiFilterAllLanguages:      'Все языки',
      uiUptimeEnded:             'Завершено',
      uiPreviewUnavailable:      'Предпросмотр недоступен',
      uiPreviewLoadingTitle:     'Загрузка названия…',
      uiBadgeCostreamOf:         (nom) => `Ко-стрим у ${nom}`,
      uiBadgeCostreamHost:       'Канал ведущего',
      uiBadgeSubMonths:          (n) => `Подписка: ${n} ${plurielSlave(n, ['месяц', 'месяца', 'месяцев'])}`,
      uiBadgeExSubMonths:        (n) => `Бывшая подписка: ${n} ${plurielSlave(n, ['месяц', 'месяца', 'месяцев'])}`,
      uiCclMatureGame:                      'Игра для взрослых',
      uiCclGambling:                        'Азартные игры',
      uiCclSexualThemes:                    'Сексуальные темы',
      uiCclViolentGraphic:                  'Жестокое насилие',
      uiCclDrugsIntoxication:               'Наркотики и алкоголь',
      uiCclProfanityVulgarity:              'Нецензурная лексика',
      uiCclDebatedSocialIssuesAndPolitics:  'Политика и острые темы',
      uiCclGeneric:                         'Помеченный контент',
      uiBadgeCostreamWithNames:  (noms) => `Ко-стрим с ${noms}`,
      uiBadgeCategorySwitch:     (jeu) => `Только что перешёл на ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? ` и ещё ${others}` : '';
        return `В эфире с ${invite}${suffix}`;
      },
      uiBadgeSponsoredBy:        (nom) => `Спонсор: ${nom}`,
      uiSortNoCoStreams:         'Ко-стримы сейчас не обнаружены',
      uiSortLabelSubs:           'Мои подписки сверху',
      uiSortLabelSubsCount:      (n) => `Мои подписки сверху — всего ${n} ${plurielSlave(n, ['подписка', 'подписки', 'подписок'])}`,
      uiSortNoSubs:              'Подписки пока не обнаружены — откройте канал, на который вы подписаны',
      uiSortSubsOffline:         'Ни одна из ваших подписок не в эфире',
      consoleNoSubs:             '[tse] Подписки пока не обнаружены.',
      uiSortLabelViewers:        'Сортировать по числу зрителей (по убыванию)',
      uiSortLabelPopular:        'Сортировать по личной популярности (недавние посещения)',
      uiSortLabelUptime:         'Сортировать по длительности стрима (по возрастанию)',
      uiSortLabelAlpha:          'Сортировать по названию канала (по алфавиту)',
      uiSortLabelCostream:       'Сгруппировать ко-стримы сверху',
      consoleNoVisits:           '[tse] Посещения пока не записаны.',
      consoleHistoryCleared:     '[tse] История посещений очищена.',
      consoleColLogin:           'логин',
      consoleColScore:           'счёт',
      consoleColVisits:          'посещения',
      consoleColLast:            'последнее посещение',
      consoleColLag:             'отставание Twitch',
      consoleColGain:            'выигрыш расширения',
      consoleLagGain:            (n, med) => `[tse] На ${n} из этих эфиров расширение опередило Twitch на ${med} по медиане.`,
      consoleColSeen:            'замечено',
      consoleLagEmpty:           '[tse] Пока нет пригодных измерений. Оставьте вкладку Twitch открытой: замер делается каждый раз, когда отслеживаемый канал выходит в эфир у вас на глазах.',
      consoleLagSummary:         (n, med, p90) => `[tse] Измерений: ${n} — медианное отставание Twitch: ${med}, 90-й процентиль: ${p90}.`,
      consoleRosterEmpty:        '[tse] Каналы пока не запомнены.',
      consoleRosterSummary:      (n) => `[tse] Локально запомнено отслеживаемых каналов: ${n}.`,
      consoleHealthBroken:       '[tse] Некоторые критичные селекторы больше не соответствуют DOM Twitch — расширение может быть частично сломано. Подробности: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Все критичные селекторы отвечают.',
      consoleMassOffline:        (n, total) => `[tse] Подозрительный ответ API Twitch: ${n} из ${total} каналов, известных как эфирные, разом объявлены офлайн. Текущее отображение сохранено, чтобы не опустошать панель; повтор через 30 с.`,
      consoleGlobalDegraded:     (n, s) => `[tse] Глобальные каналы: ${n} подряд ошибок API Twitch. Структурный ритм снижен до ${s} с, чтобы не долбить эндпоинт. Панель «Отслеживаемые каналы» не затронута.`,
      consoleGlobalRestored:     (s) => `[tse] Глобальные каналы: API снова стабилен, структурный ритм восстановлен до ${s} с.`,
      consoleColProbe:           'проба',
      consoleColStatus:          'состояние',
      consoleColDetail:          'подробности',
      consoleHealthTagBroken:    'СЛОМАН',
      consoleHealthTagNa:        'н/д',
      locale:                    'ru-RU',
    }),
    ja: Object.freeze({
      followedLabel:             'フォロー中のチャンネル',
      uiGlobalLabel:             'トップチャンネル',
      uiModeMenuAria:            'サイドバーに表示する内容を選択',
      uiGlobalPartial:           'ランキングは部分的です。現在 Twitch が公開しているカテゴリーが少なく、完全性を保証できません。',
      uiFilterAriaLabel:         'フォロー中のチャンネルをカテゴリーで絞り込む',
      uiFilterAllCategories:     'すべてのカテゴリー',
      uiFilterLangAriaLabel:     'フォロー中のチャンネルを言語で絞り込む',
      uiFilterAllLanguages:      'すべての言語',
      uiUptimeEnded:             '終了',
      uiPreviewUnavailable:      'プレビューを利用できません',
      uiPreviewLoadingTitle:     'タイトルを読み込み中…',
      uiBadgeCostreamOf:         (nom) => `${nom} のコラボ配信`,
      uiBadgeCostreamHost:       'ホスト配信',
      uiBadgeSubMonths:          (n) => `サブスク${n}か月`,
      uiBadgeExSubMonths:        (n) => `元サブスク${n}か月`,
      uiCclMatureGame:                      '成人向けゲーム',
      uiCclGambling:                        'ギャンブル',
      uiCclSexualThemes:                    '性的なテーマ',
      uiCclViolentGraphic:                  '過激な暴力表現',
      uiCclDrugsIntoxication:               '薬物・飲酒',
      uiCclProfanityVulgarity:              '過激な言葉遣い',
      uiCclDebatedSocialIssuesAndPolitics:  '政治・デリケートな話題',
      uiCclGeneric:                         'ラベル付きコンテンツ',
      uiBadgeCostreamWithNames:  (noms) => `${noms} とのコラボ配信`,
      uiBadgeCategorySwitch:     (jeu) => `${jeu} に切り替えたばかり`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? `ほか${others}人` : '';
        return `${invite}${suffix} と配信中`;
      },
      uiBadgeSponsoredBy:        (nom) => `${nom} のスポンサー配信`,
      uiSortNoCoStreams:         '現在コラボ配信は検出されていません',
      uiSortLabelSubs:           'サブスク中のチャンネルを上に',
      uiSortLabelSubsCount:      (n) => `サブスク中のチャンネルを上に — 合計${n}件`,
      uiSortNoSubs:              'サブスクはまだ検出されていません — サブスクしているチャンネルを開いてください',
      uiSortSubsOffline:         'サブスク中のチャンネルは配信していません',
      consoleNoSubs:             '[tse] サブスクはまだ検出されていません。',
      uiSortLabelViewers:        '視聴者数で並べ替え（降順）',
      uiSortLabelPopular:        '個人的な人気度で並べ替え（最近の訪問）',
      uiSortLabelUptime:         '配信時間で並べ替え（昇順）',
      uiSortLabelAlpha:          'チャンネル名で並べ替え（アルファベット順）',
      uiSortLabelCostream:       'コラボ配信を上にまとめる',
      consoleNoVisits:           '[tse] 訪問はまだ記録されていません。',
      consoleHistoryCleared:     '[tse] 訪問履歴を消去しました。',
      consoleColLogin:           'ログイン名',
      consoleColScore:           'スコア',
      consoleColVisits:          '訪問回数',
      consoleColLast:            '最終訪問',
      consoleColLag:             'Twitch の遅れ',
      consoleColGain:            '拡張機能の先行',
      consoleLagGain:            (n, med) => `[tse] そのうち${n}件の配信で、拡張機能は Twitch より中央値 ${med} 早く表示しました。`,
      consoleColSeen:            '検出時刻',
      consoleLagEmpty:           '[tse] 利用できる計測はまだありません。Twitch のタブを開いたままにしてください。フォロー中のチャンネルが目の前で配信を始めるたびに計測されます。',
      consoleLagSummary:         (n, med, p90) => `[tse] 計測${n}件 — Twitch の遅れの中央値: ${med}、90パーセンタイル: ${p90}。`,
      consoleRosterEmpty:        '[tse] 記憶しているチャンネルはまだありません。',
      consoleRosterSummary:      (n) => `[tse] フォロー中のチャンネル${n}件をローカルに記憶しています。`,
      consoleHealthBroken:       '[tse] 一部の重要なセレクターが Twitch の DOM と一致しなくなりました。拡張機能が部分的に動作していない可能性があります。詳細: tse.diagnose()',
      consoleHealthAllOk:        '[tse] 重要なセレクターはすべて応答しています。',
      consoleMassOffline:        (n, total) => `[tse] Twitch API の応答が不審です。配信中と分かっていた${total}件のうち${n}件が一度にオフラインと報告されました。サイドバーを空にせず現在の表示を維持します。30秒後に再試行します。`,
      consoleGlobalDegraded:     (n, s) => `[tse] グローバルチャンネル: Twitch API が${n}回連続で失敗しました。エンドポイントに負荷をかけないため、構造更新の間隔を${s}秒に緩めます。「フォロー中のチャンネル」には影響しません。`,
      consoleGlobalRestored:     (s) => `[tse] グローバルチャンネル: API が再び安定したため、構造更新の間隔を${s}秒に戻しました。`,
      consoleColProbe:           'プローブ',
      consoleColStatus:          '状態',
      consoleColDetail:          '詳細',
      consoleHealthTagBroken:    '故障',
      consoleHealthTagNa:        '該当なし',
      locale:                    'ja-JP',
    }),
    zh: Object.freeze({
      followedLabel:             '关注的频道',
      uiGlobalLabel:             '热门频道',
      uiModeMenuAria:            '选择侧边栏显示的内容',
      uiGlobalPartial:           '排名不完整：Twitch 目前公开的分类不足，无法保证排名完整。',
      uiFilterAriaLabel:         '按分类筛选关注的频道',
      uiFilterAllCategories:     '全部分类',
      uiFilterLangAriaLabel:     '按语言筛选关注的频道',
      uiFilterAllLanguages:      '全部语言',
      uiUptimeEnded:             '已结束',
      uiPreviewUnavailable:      '预览不可用',
      uiPreviewLoadingTitle:     '正在加载标题…',
      uiBadgeCostreamOf:         (nom) => `${nom} 的联合直播`,
      uiBadgeCostreamHost:       '主办直播',
      uiBadgeSubMonths:          (n) => `已订阅 ${n} 个月`,
      uiBadgeExSubMonths:        (n) => `曾订阅 ${n} 个月`,
      uiCclMatureGame:                      '成人向游戏',
      uiCclGambling:                        '赌博',
      uiCclSexualThemes:                    '性相关内容',
      uiCclViolentGraphic:                  '血腥暴力',
      uiCclDrugsIntoxication:               '毒品与酒精',
      uiCclProfanityVulgarity:              '粗俗语言',
      uiCclDebatedSocialIssuesAndPolitics:  '政治与敏感话题',
      uiCclGeneric:                         '已标记内容',
      uiBadgeCostreamWithNames:  (noms) => `与 ${noms} 联合直播`,
      uiBadgeCategorySwitch:     (jeu) => `刚刚切换到 ${jeu}`,
      uiBadgeLiveWith:           (invite, others) => {
        const suffix = others > 0 ? `等 ${others} 人` : '';
        return `正在与 ${invite}${suffix} 直播`;
      },
      uiBadgeSponsoredBy:        (nom) => `由 ${nom} 赞助`,
      uiSortNoCoStreams:         '当前未检测到联合直播',
      uiSortLabelSubs:           '我订阅的频道优先',
      uiSortLabelSubsCount:      (n) => `我订阅的频道优先 — 共 ${n} 个订阅`,
      uiSortNoSubs:              '尚未发现订阅 — 请打开一个你已订阅的频道',
      uiSortSubsOffline:         '你订阅的频道都不在直播',
      consoleNoSubs:             '[tse] 尚未发现订阅。',
      uiSortLabelViewers:        '按观众人数排序（降序）',
      uiSortLabelPopular:        '按个人常看程度排序（近期访问）',
      uiSortLabelUptime:         '按直播时长排序（升序）',
      uiSortLabelAlpha:          '按频道名称排序（字母顺序）',
      uiSortLabelCostream:       '将联合直播归到顶部',
      consoleNoVisits:           '[tse] 尚未记录任何访问。',
      consoleHistoryCleared:     '[tse] 访问历史已清除。',
      consoleColLogin:           '登录名',
      consoleColScore:           '得分',
      consoleColVisits:          '访问次数',
      consoleColLast:            '最近访问',
      consoleColLag:             'Twitch 的延迟',
      consoleColGain:            '扩展抢先量',
      consoleLagGain:            (n, med) => `[tse] 在其中 ${n} 场直播里，扩展比 Twitch 平均（中位数）早 ${med} 显示。`,
      consoleColSeen:            '发现时间',
      consoleLagEmpty:           '[tse] 暂无可用测量。请保持 Twitch 标签页打开：每当关注的频道在你眼前开播时都会采样一次。',
      consoleLagSummary:         (n, med, p90) => `[tse] 测量 ${n} 次 — Twitch 延迟中位数：${med}，第 90 百分位：${p90}。`,
      consoleRosterEmpty:        '[tse] 尚未记住任何频道。',
      consoleRosterSummary:      (n) => `[tse] 已在本地记住 ${n} 个关注的频道。`,
      consoleHealthBroken:       '[tse] 部分关键选择器已与 Twitch 的 DOM 不匹配 — 扩展可能部分失效。详情：tse.diagnose()',
      consoleHealthAllOk:        '[tse] 所有关键选择器均有响应。',
      consoleMassOffline:        (n, total) => `[tse] Twitch API 返回可疑：已知在直播的 ${total} 个频道中有 ${n} 个被同时报告为离线。保留当前显示而不清空侧边栏；30 秒后重试。`,
      consoleGlobalDegraded:     (n, s) => `[tse] 全局频道：Twitch API 连续失败 ${n} 次。为避免频繁请求，结构刷新间隔放宽到 ${s} 秒。“关注的频道”侧边栏不受影响。`,
      consoleGlobalRestored:     (s) => `[tse] 全局频道：API 恢复稳定，结构刷新间隔已恢复为 ${s} 秒。`,
      consoleColProbe:           '探针',
      consoleColStatus:          '状态',
      consoleColDetail:          '详情',
      consoleHealthTagBroken:    '已失效',
      consoleHealthTagNa:        '不适用',
      locale:                    'zh-CN',
    })
  });

  function detectLanguage() {

    if (document.querySelector('[aria-label="Chaînes suivies"]')) return 'fr';
    if (document.querySelector('[aria-label="Followed Channels"]')) return 'en';
    if (document.querySelector('[aria-label="Kanäle, denen du folgst"]')) return 'de';
    if (document.querySelector('[aria-label="Canales que sigues"]')) return 'es';
    if (document.querySelector('[aria-label="Canais seguidos"]')) return 'pt';
    if (document.querySelector('[aria-label="Canais que segues"]')) return 'pt';

    const parPrefixe = (code) => {
      if (code.startsWith('fr')) return 'fr';
      if (code.startsWith('de')) return 'de';
      if (code.startsWith('es')) return 'es';
      if (code.startsWith('pt')) return 'pt';
      if (code.startsWith('it')) return 'it';
      if (code.startsWith('pl')) return 'pl';
      if (code.startsWith('ru')) return 'ru';
      if (code.startsWith('ja')) return 'ja';
      if (code.startsWith('zh')) return 'zh';
      return null;
    };
    const htmlLang = (document.documentElement.lang || '').toLowerCase().trim();
    const parHtml = parPrefixe(htmlLang);
    if (parHtml) return parHtml;
    if (htmlLang.startsWith('en')) return 'en';

    const parNav = parPrefixe((navigator.language || '').toLowerCase());
    if (parNav) return parNav;

    return 'en';
  }

  let LANG = detectLanguage();
  let S = STRINGS[LANG];

  function refreshLanguage() {
    const newLang = detectLanguage();
    if (newLang === LANG) return false;
    LANG = newLang;
    S = STRINGS[LANG];
    return true;
  }

  const CFG = Object.freeze({
    GQL_URL:        'https://gql.twitch.tv/gql',
    CLIENT_ID:      'kimne78kx3ncx6brgo4mv6wki5h1ko',

    GQL_MAX_LOGINS: 50,

    GUEST_STAR_TTL:            30_000,
    GUEST_STAR_DEBOUNCE:       300,
    GUEST_STAR_ERROR_COOLDOWN: 30_000,

    COSTREAM_COLOR_GRACE:      60_000,
    BATCH_DELAY:    250,
    UI_TICK:        60_000,

    LIVE_TTL:       30_000,

    REFRESH_TICK:   5_000,

    MAINTENANCE_TICK: 5 * 60_000,

    LIVE_PRUNE_AGE: 5 * 60_000,
    LIVE_CACHE_MAX: 500,

    REVISIT_RELOAD_MS: 60_000,

    HEALTH_INITIAL_DELAY: 8_000,
    SCAN_DEBOUNCE:  250,
    FRESH_MAX_MIN:  10,
    GQL_TIMEOUT:    15_000,

    GQL_ERROR_COOLDOWN: 30_000,

    MASS_OFFLINE_MIN:       5,
    MASS_OFFLINE_RATIO:     0.6,
    MASS_OFFLINE_TOLERANCE: 4,

    OFFLINE_CONFIRM: 2,

    META_CACHE_MAX:  300,
    GS_CACHE_MAX:    500,

    GS_PRUNE_AGE:    5 * 60_000,

    GLOBAL_TOP_N:            30,

    GLOBAL_CATEGORIES_MAX:   100,

    GLOBAL_SEED_CATEGORIES:  10,

    GLOBAL_CATEGORY_BUDGET:  90,

    GLOBAL_STREAMS_MAX:      30,

    GLOBAL_BATCH_OPS:        20,

    GLOBAL_STRUCT_TICK:      30_000,

    GLOBAL_MISS_CONFIRM:     3,

    GLOBAL_PRUNE_AGE:        10 * 60_000,

    GLOBAL_FULL_WALK_MS:     150_000,

    GLOBAL_ERROR_COOLDOWN:   30_000,

    GLOBAL_FAIL_DEGRADE:     3,

    PURPLE:         '#9147ff',
    PURPLE_HOVER:   '#a970ff',

    VISIT_MIN_DWELL_MS:   5 * 60_000,
    VISIT_SESSION_MS:     180 * 60_000,
    VISIT_ROLLING_N:      20,
    VISIT_MAX_LOGINS:     400,
    VISIT_HALFLIFE_DAYS:  7,
    VISIT_STORAGE_KEY:    'tse:visits',

    SUBS_PAGE_ENABLED:    true,

    SUBS_PAGE_TABS:       ['paid', 'gifts', 'mobile'],

    SUBS_PAGE_TABS_PAST:  ['expired'],
    SUBS_PAGE_TTL:        6 * 60 * 60_000,
    SUBS_PAGE_TIMEOUT:    25_000,

    SUBS_PAGE_SETTLE:     7_000,

    SUBS_PAGE_STABLE:     1_500,

    SUBS_PAGE_STAGGER:      600,

    SUBS_PAGE_HOLD_MAX:   7_000,

    SUBS_PAGE_HOLD_GRACE: 1_500,
    SUBS_PAGE_STAMP_KEY:  'tse:substs',

    SUBS_LABEL_KEY:       'tse:submois',

    SUBS_STORAGE_KEY:     'tse:subs',
    SUBS_MAX_LOGINS:      400,
    SUBS_TTL_DAYS:        120,

    ROSTER_STORAGE_KEY:   'tse:roster',
    ROSTER_MAX:           1500,

    ROSTER_MAX_AGE:       60 * 24 * 60 * 60_000,

    AHEAD_ENABLED:        true,

    AHEAD_MAX:            15,

    AHEAD_MAX_POLL:       300,

    LAG_STORAGE_KEY:      'tse:livelag',

    LAG_FORMAT:           2,
    LAG_MAX_SAMPLES:      300,

    LAG_MAX_DONE:         1000,

    LAG_SETTLE_MS:        60_000,

    LAG_MAX_PLAUSIBLE:    2 * 60 * 60_000,

    PREVIEW_THUMB_WIDTH:  480,

    PREVIEW_THUMB_CDN_W:  480,
    PREVIEW_THUMB_CDN_H:  270,

    PREVIEW_THUMB_CACHE_MS: 150_000,

    PREVIEW_PRELOAD_ENABLED:     true,
    PREVIEW_PRELOAD_CONCURRENCY: 3,
    PREVIEW_PRELOAD_MAX:         200,
    PREVIEW_IFRAME_DELAY: 150,

    PREVIEW_IFRAME_QUALITY: '360p30',

    PREVIEW_IFRAME_TIMEOUT_MS: 3_000,

    PREVIEW_REVEAL_FALLBACK_MS: 1_500,

    PREVIEW_GATE_TIMEOUT_MS: 2_500,

    CATEGORY_SWITCH_TTL: 10 * 60_000,

    CATEGORY_SWITCH_MAX: 200,

    LOADING_STABILITY_MS:   1_500,

    LOADING_TIMEOUT_MS:     15_000,

    LOADING_FADE_MS:        1_000
  });

  const state = {

    sortMode:       'viewers',

    sortWish:       'viewers',
    categoryFilter: null,
    languageFilter: null,
    filterDriver:   null,

    globalMode:     false
  };

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

    /* === Chaîne dont on est ABONNÉ ===
       Le nom de la chaîne passe à l'or, et une lueur circule dans le FOND de
       la carte : trois nappes colorées qui dérivent chacune à sa vitesse, et
       un voile lumineux qui balaie la carte en diagonale de loin en loin.
       L'avatar garde son anneau tournant — c'est le seul élément qui subsiste
       en mode réduit, où il n'y a ni fond ni texte à colorer.

       COMMENT ÇA COHABITE, alors que le fond appartient déjà à « frais »
       (violet) et au co-stream (couleur du groupe) : la couche animée est
       posée en z-index NÉGATIF dans le contexte d'empilement de la carte.
       Elle se peint donc APRÈS le fond de la carte — dont elle laisse passer
       la teinte, étant elle-même très transparente — mais AVANT le contenu,
       et sous la barre de gauche qui est en z-index 1. Les trois signaux
       restent donc lisibles ensemble, sans une seule règle de départage :
       le fond dit « frais » ou « co-stream », la lueur et l'or disent
       « abonné », la barre dit le groupe.

       PHASE. --tse-sub-phase (0..11) est posée en JS d'après le LOGIN et
       décale le départ des animations. Les cartes ne battent donc pas à
       l'unisson : chacune a sa position dans le cycle. Dérivée du login et
       non du rang, la phase ne bouge pas quand le tri réordonne la liste.

       COÛT, MESURÉ. Une seule propriété animée par carte — la position des
       couches de fond — plus le dégradé du nom. Relevé dans Chromium sur
       trente cartes décorées, soit le double de ce qu'un compte ordinaire
       affiche : 16,75 ms d'intervalle moyen entre images contre 16,76 ms sans
       la décoration, et une image longue (> 20 ms) contre une. Autrement dit :
       rien de mesurable. */
    @property --tse-sub-angle {
      syntax: '<angle>';
      inherits: false;
      initial-value: 0deg;
    }
    .side-nav-card.tse-sub {
      position: relative;
      isolation: isolate;
      border-radius: 5px;
    }
    /* LA LUEUR DE FOND. Quatre couches dans une seule propriété, chacune avec
       sa taille et sa position propres — c'est ce qui permet de les faire
       dériver à des vitesses différentes en n'animant qu'UNE propriété.
       La première est le voile de balayage ; les trois autres sont les nappes.
       Toutes très transparentes : on ajoute une lueur, on ne repeint pas la
       carte. */
    .side-nav-card.tse-sub::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      border-radius: 5px;
      pointer-events: none;
      background:
        linear-gradient(102deg,
          rgba(255, 255, 255, 0)     40%,
          rgba(255, 248, 224, 0.13)  48%,
          rgba(255, 220, 170, 0.07)  53%,
          rgba(255, 255, 255, 0)     61%),
        radial-gradient(68% 190% at 14% 45%, rgba(255, 200, 104, 0.115), transparent 68%),
        radial-gradient(58% 170% at 58% 72%, rgba(255, 146, 200, 0.095), transparent 70%),
        radial-gradient(78% 210% at 88% 22%, rgba(190, 148, 255, 0.085), transparent 72%);
      background-size: 300% 100%, 170% 100%, 200% 100%, 230% 100%;
      background-repeat: no-repeat;
      animation: tse-sub-lueur 15s linear infinite;
      animation-delay: calc(var(--tse-sub-phase, 0) * -1.25s);
    }
    /* Le balayage traverse dans le premier quart du cycle puis reste hors
       cadre : il passe, il ne clignote pas. Les nappes, elles, dérivent sans
       interruption — et pas au même rythme, sans quoi elles se déplaceraient
       en bloc et l'œil y verrait une seule image qui glisse. */
    @keyframes tse-sub-lueur {
      0%   { background-position: -110% 0,   0% 50%, 100% 50%,  40% 50%; }
      25%  { background-position:  210% 0,  35% 50%,  62% 50%,  78% 50%; }
      60%  { background-position:  210% 0,  78% 50%,  18% 50%,   8% 50%; }
      100% { background-position:  210% 0, 100% 50%,   0% 50%,  40% 50%; }
    }

    /* LE TEXTE, EN OR. Un dégradé qui traverse les lettres elles-mêmes : la
       couleur est celle d'un fond, découpée à la forme du texte. La règle de
       repli pose une couleur pleine D'ABORD — si background-clip venait à ne
       pas s'appliquer, le texte reste doré et lisible au lieu de disparaître.

       DEUX RANGS, ET ILS DOIVENT LE RESTER. Le nom est l'information ; la
       catégorie l'accompagne. Le nom reçoit donc l'or vif, un reflet rapide
       (7 s) et un halo qui respire ; la catégorie, un champagne plus sourd et
       un reflet presque deux fois plus lent (11 s), sans halo. Leur donner le
       même traitement aurait aplati la hiérarchie que Twitch installe par la
       taille et la couleur — et rendu la carte illisible d'un coup d'œil.
       Les deux reflets ne défilent pas non plus en cadence : périodes
       différentes ET décalages différents, sinon l'œil y verrait un seul bloc
       qui glisse. */
    .side-nav-card.tse-sub p[data-a-target="side-nav-title"] {
      color: #ffd68a;
      font-weight: 700;
    }
    /* La catégorie, désignée par une CLASSE posée en JS d'après
       cardCategoryEl() — pour la même raison que l'avatar : la fonction
       couvre cinq emplacements, dont deux où le <p> ne porte pas d'attribut
       title, et une feuille de style qui les recopie finit par en oublier
       un (cf. markSubPart). */
    .side-nav-card.tse-sub .tse-sub-cat {
      color: #e6c68d;
    }
    @supports (-webkit-background-clip: text) or (background-clip: text) {
      .side-nav-card.tse-sub p[data-a-target="side-nav-title"] {
        background: linear-gradient(100deg,
          #ffc86e   0%,
          #fff6dc  32%,
          #ffb3d9  46%,
          #ffc86e  64%,
          #ffc86e 100%) 0 0 / 300% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        /* Le halo est posé par un filtre, non par text-shadow : avec un
           remplissage transparent, une ombre de texte se verrait AU TRAVERS
           des lettres, en double flou. Le filtre, lui, s'applique au résultat
           déjà découpé — il entoure les lettres au lieu de les traverser. */
        animation: tse-sub-titre 7s linear infinite,
                   tse-sub-halo 5.5s ease-in-out infinite;
        animation-delay: calc(var(--tse-sub-phase, 0) * -0.58s),
                         calc(var(--tse-sub-phase, 0) * -0.46s);
      }
      .side-nav-card.tse-sub .tse-sub-cat {
        background: linear-gradient(100deg,
          #d4b076   0%,
          #f4e3c2  34%,
          #dcb4c6  47%,
          #d4b076  64%,
          #d4b076 100%) 0 0 / 300% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: tse-sub-titre 11s linear infinite;
        animation-delay: calc(var(--tse-sub-phase, 0) * -0.91s);
      }
    }
    @keyframes tse-sub-titre { to { background-position: 300% 0; } }
    @keyframes tse-sub-halo {
      0%, 100% { filter: drop-shadow(0 0 2px rgba(255, 196,  92, 0.20)); }
      50%      { filter: drop-shadow(0 0 5px rgba(255, 220, 160, 0.55)); }
    }

    /* L'AVATAR — seul élément qui subsiste en mode réduit, donc le seul qui
       puisse y porter le signal : ni fond ni nom n'y sont visibles. Il est
       désigné par une CLASSE, posée en JS d'après avatarOf() : Twitch rend
       cinq formes d'avatar différentes, et une feuille de style qui les
       RECOPIE finit par en oublier une — d'où un anneau présent sur une carte
       et absent sur sa voisine, sans raison visible (cf. markSubAvatar).

       L'OR, POUR TOUT ABONNEMENT, quel que soit l'onglet d'où il vient —
       payant, offert, mobile — et qu'il ait été relevé sur la page ou appris
       au passage sur une chaîne. Une teinte par origine a été essayée puis
       retirée : le signal « abonné » est binaire, et le décliner en trois
       couleurs demandait au lecteur de retenir un code pour une distinction
       dont il n'a que faire à cet endroit.

       Les deux variables restent : elles tiennent la teinte en UN point, d'où
       les dégradés et le halo la lisent tous. */
    .side-nav-card.tse-sub {
      --tse-sub-or:    rgba(255, 196,  92, 1);
      --tse-sub-clair: rgba(255, 246, 214, 1);
    }
    .side-nav-card.tse-sub .tse-sub-avatar {
      position: relative;
      border-radius: 50%;
      /* Le halo respire. C'est une ombre portée sur un disque de trente
         pixels : le repeint tient dans un mouchoir de poche, et c'est ce qui
         donne à l'anneau sa présence sans rien ajouter au mouvement déjà là. */
      animation: tse-sub-souffle 4.2s ease-in-out infinite;
      animation-delay: calc(var(--tse-sub-phase, 0) * -0.35s);
    }
    @keyframes tse-sub-souffle {
      0%, 100% { box-shadow: 0 0 5px color-mix(in srgb, var(--tse-sub-or) 30%, transparent); }
      50%      { box-shadow: 0 0 11px color-mix(in srgb, var(--tse-sub-or) 62%, transparent); }
    }
    .side-nav-card.tse-sub .tse-sub-avatar::after {
      content: '';
      position: absolute;
      inset: -2.5px;
      box-sizing: border-box;
      border-radius: 50%;
      padding: 2px;
      background:
        /* L'éclat qui court, blanc quelle que soit la teinte : c'est un
           reflet, pas une couleur. */
        conic-gradient(from var(--tse-sub-angle),
          rgba(255, 255, 255, 0)      0deg,
          rgba(255, 255, 255, 1)     22deg,
          color-mix(in srgb, var(--tse-sub-clair) 70%, transparent)  44deg,
          rgba(255, 255, 255, 0)     80deg,
          rgba(255, 255, 255, 0)    360deg),
        /* Le métal, dans la teinte de l'origine. */
        conic-gradient(from var(--tse-sub-angle),
          color-mix(in srgb, var(--tse-sub-or)    62%, transparent)    0deg,
          color-mix(in srgb, var(--tse-sub-clair) 80%, transparent)   90deg,
          color-mix(in srgb, var(--tse-sub-or)    58%, transparent)  180deg,
          color-mix(in srgb, var(--tse-sub-clair) 80%, transparent)  270deg,
          color-mix(in srgb, var(--tse-sub-or)    62%, transparent)  360deg);
      /* Deux masques, l'un sur la boîte de contenu, l'autre sur la boîte
         entière ; leur DIFFÉRENCE ne laisse que l'anneau du padding. C'est ce
         qui fait un dégradé conique en bordure, chose qu'aucune propriété
         « border » ne sait faire. */
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask-composite: exclude;
      animation: tse-sub-turn 5s linear infinite;
      animation-delay: calc(var(--tse-sub-phase, 0) * -0.42s);
      pointer-events: none;
    }
    @keyframes tse-sub-turn { to { --tse-sub-angle: 360deg; } }

    /* Mouvement réduit : la demande est explicite, on la respecte. L'or reste
       — c'est lui qui porte l'information — mais plus rien ne bouge. */
    @media (prefers-reduced-motion: reduce) {
      .side-nav-card.tse-sub::after,
      .side-nav-card.tse-sub p[data-a-target="side-nav-title"],
      .side-nav-card.tse-sub .tse-sub-cat,
      .side-nav-card.tse-sub .tse-sub-avatar,
      .side-nav-card.tse-sub .tse-sub-avatar::after {
        animation: none;
      }
      .side-nav-card.tse-sub .tse-sub-avatar {
        box-shadow: 0 0 8px color-mix(in srgb, var(--tse-sub-or) 45%, transparent);
      }
      .side-nav-card.tse-sub .tse-sub-avatar::after {
        background: linear-gradient(135deg,
          rgba(255, 196, 92, 0.9),
          rgba(255, 246, 214, 0.95) 35%,
          rgba(255, 158, 205, 0.8) 65%,
          rgba(255, 196, 92, 0.9));
      }
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
      /* S'étire pour remplir la rangée — d'où des boutons un peu plus larges
         que les 28 px d'origine. La borne haute évite qu'ils ne s'étalent en
         pavés sur une sidebar large ; la borne basse garde la cible cliquable
         au-dessus du minimum confortable. */
      flex: 1 1 0;
      min-width: 28px; max-width: 44px;
      position: relative;   /* ancre du compteur, cf. .tse-sort-count */
      width: auto; height: 28px;
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
    /* Compteur d'abonnements, en pastille au coin bas-droit du bouton.
       Le filet de la couleur du fond découpe la pastille dans le bouton au
       lieu de l'y coller — c'est ce qui la fait lire comme une notification.
       Sur le bouton ACTIF, le violet du badge se confondrait avec le violet
       du bouton : les couleurs s'inversent alors. */
    .tse-sort-count {
      position: absolute; right: -5px; bottom: -5px;
      min-width: 15px; height: 15px; padding: 0 3px;
      display: inline-flex; align-items: center; justify-content: center;
      box-sizing: border-box; border-radius: 999px;
      background: ${CFG.PURPLE}; color: #fff;
      border: 2px solid #1f1f23;
      font-size: 9px; font-weight: 800; line-height: 1;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }
    .tse-sort-toggle[aria-pressed="true"] .tse-sort-count {
      background: #fff; color: ${CFG.PURPLE}; border-color: ${CFG.PURPLE};
    }
    /* État désactivé : grise le bouton et bloque toute interaction.
       Note : l'attribut HTML "disabled" court-circuite déjà click et focus
       côté navigateur ; ce style ne fait qu'aligner le rendu.

       L'opacité porte sur l'ICÔNE, pas sur le bouton. Une opacité posée sur le
       bouton s'applique au groupe entier, pastille comprise — et le nombre
       d'abonnements, qu'on veut justement pouvoir lire quand aucun n'est en
       direct, tombait à 35 %. La pastille garde donc sa pleine intensité sur
       un bouton grisé : c'est exactement ainsi que se comporte une pastille de
       notification sur une entrée inactive. */
    .tse-sort-toggle:disabled {
      cursor: not-allowed;
      pointer-events: none;
      background: rgba(0, 0, 0, 0.25);
      border-color: rgba(255, 255, 255, 0.04);
    }
    .tse-sort-toggle:disabled svg { opacity: 0.35; }

    /* === Ligne des boutons de tri (sous les dropdowns) ===
       ALIGNÉE SUR LES FILTRES, bord à bord. Les boutons s'étirent pour
       occuper toute la largeur : le premier touche le bord gauche, le dernier
       le bord droit, exactement comme les listes déroulantes juste au-dessus.
       Centrée avec des boutons de largeur fixe, la rangée laissait de part et
       d'autre une marge qui ne correspondait à rien.
       Le space-between n'intervient que si les boutons plafonnent (sidebar
       large) : les bords, eux, restent flush dans tous les cas. */
    .tse-sort-row {
      display: flex; align-items: center; justify-content: space-between; gap: 6px;
      margin-top: 4px;
    }

    /* === Bascule de mode : Chaînes suivies ↔ Top Chaînes ===
       Deux boutons dans NOTRE bloc filtre, posés là où Twitch affichait son
       en-tête de section. Pas de popup : rien à positionner, rien à refermer,
       rien que React puisse emporter.

       UN CONTRÔLE SEGMENTÉ, ET NON DEUX BOUTONS. Le mode est un choix
       exclusif : deux pastilles détachées se lisaient comme deux actions
       indépendantes, et la pastille violette pleine hauteur pesait plus lourd
       que tout le reste du bloc filtre. On pose donc une piste unique, qui
       reprend exactement les surfaces des listes déroulantes juste en dessous
       — fond enfoncé rgba(0,0,0,.4), filet blanc à 8 %, rayon 6 px — et un
       curseur violet qui se déplace de l'un à l'autre à l'intérieur.

       Les cotes sont choisies pour que la piste fasse la MÊME HAUTEUR que la
       rangée de filtres : 22 px de segment + 2×2 px de gouttière + 2×1 px de
       filet = 28 px, la hauteur de .tse-dd-btn. Le bloc filtre s'aligne ainsi
       sur une seule trame verticale (le harnais le vérifie).

       Le libellé n'est JAMAIS tronqué — c'est la seule contrainte qui compte
       ici. Plutôt qu'une ellipse, la rangée autorise le retour à la ligne :
       en français les deux boutons tiennent côte à côte, et dans une langue
       plus longue (« Kanäle, denen du folgst ») le second passe en dessous,
       toujours entièrement lisible. Une ellipse aurait donné « Chaînes su… »,
       ce qui n'informe plus de rien. */
    .tse-mode-row {
      display: flex; flex-wrap: wrap; gap: 2px;
      padding: 2px; box-sizing: border-box;
      /* 2 px de plus que la gouttière de .tse-filter (6 px) : la bascule dit
         CE QU'ON REGARDE, les filtres ne font que restreindre à l'intérieur.
         Un cran d'espace marque cette différence de niveau sans trait de
         séparation. */
      margin-bottom: 2px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
    }
    /* Rangée des stories : masquée UNIQUEMENT en mode Top Chaînes. Elle
       reste intacte sur les chaînes suivies, où elle a du sens. */
    body.tse-global-mode [data-tse-stories="row"] { display: none !important; }
    /* Twitch ne lui donne d'air qu'AU-DESSUS (style="margin-top: 0.7rem" posé
       en ligne) : en dessous, elle touchait notre bloc filtre. On lui rend la
       même valeur en bas, dans la même unité, pour qu'elle respire des deux
       côtés.
       Le !important n'est pas décoratif : la marge du haut est déclarée EN
       LIGNE par Twitch. Tant qu'ils écrivent « margin-top », une règle de
       feuille suffirait — mais le jour où ils passent au raccourci « margin »,
       leur déclaration en ligne remettrait notre marge basse à zéro, sans
       bruit. Un mot met la règle à l'abri de ce changement-là. */
    [data-tse-stories="row"] { margin-bottom: 0.7rem !important; }
    .tse-mode-tab {
      flex: 1 1 auto; min-width: 0;
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 22px; padding: 0 8px;
      border: 0; border-radius: 4px;
      background: transparent; color: var(--color-text-alt-2, #adadb8);
      /* Même échelle typographique que .tse-dd-btn et .tse-dd-opt : le bloc
         filtre ne doit pas mélanger deux tailles de texte. */
      font: inherit; font-size: 1.15rem; font-weight: 600; line-height: 1.2;
      white-space: nowrap; text-align: center; cursor: pointer;
      transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
    }
    /* Le segment inactif n'a pas de filet propre à colorer comme le font les
       listes déroulantes au survol : c'est donc un lavis de fond qui joue ce
       rôle. À 8 % il se perdait sur la piste déjà sombre (rendu et regardé) ;
       12 % se lit sans crier. */
    .tse-mode-tab:hover {
      background: rgba(255, 255, 255, 0.12);
      color: var(--color-text-base, #efeff1);
    }
    /* Anneau de focus clavier, comme sur le bouton de tri — il manquait ici. */
    .tse-mode-tab:focus-visible {
      outline: none;
      color: var(--color-text-base, #efeff1);
      box-shadow: 0 0 0 1px ${CFG.PURPLE};
    }
    /* Curseur actif : dégradé vertical léger et ombre portée courte, pour
       qu'il se lise POSÉ SUR la piste et non découpé dedans. */
    .tse-mode-tab[aria-pressed="true"] {
      background: linear-gradient(180deg, ${CFG.PURPLE_HOVER} 0%, ${CFG.PURPLE} 100%);
      color: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
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
    /* Abonnement : le même or que le filet des cartes abonnées, pour qu'on
       reconnaisse le signal d'une surface à l'autre. La variante « ancien
       abonné » le désature — c'est un fait révolu, il ne doit pas briller
       autant qu'un abonnement en cours. */
    .tse-preview__badge--sub      { background: rgba(255, 201, 102, 0.22); color: #ffd591; }
    .tse-preview__badge--exsub    { background: rgba(255, 201, 102, 0.10); color: #c9b48c; }
    /* Étiquettes de classification : ROUGE, et il a fallu le mesurer pour le
       voir. La 3.55 avait choisi l'ambre, en raisonnant juste sur le principe
       — une teinte d'avertissement, distincte de l'or des abonnements — et
       faux sur le nombre : son texte tombait à 2° de teinte de celui du hype
       train (26° contre 24°), c'est-à-dire la MÊME couleur à l'œil. Les deux
       badges peuvent coexister (une chaîne étiquetée qui lance un hype train
       n'a rien d'exotique), et le coin chaud de la palette était déjà occupé
       par sub (37°) et exsub (39°).

       Le rouge est le seul créneau libre, et il est étroit : coincé entre
       l'orange du hype à 24° et le rose de la réduction à 311°, l'optimum
       théorique est 348°. On se pose à 357° — franchement rouge plutôt que
       cramoisi — soit 27° du hype sur le texte et 31° sur le fond.

       Le contraste a dicté le reste. Le rouge est la teinte la plus sombre à
       luminance égale (le canal rouge ne pèse que 0,2126 dans la formule), et
       les premiers essais tombaient à 4,9:1 quand toute la famille tient entre
       6,4 et 7,7. D'où un fond DÉLIBÉRÉMENT sombre (le rouge vif est dans le
       texte, pas dans la pastille) : 6,41:1, juste au-dessus du plancher de la
       famille, qui est le badge co-stream à 6,38:1.

       max-width autorise le repli : plusieurs étiquettes cumulées feraient
       sinon un badge plus large que l'aperçu, que le popup couperait net. */
    .tse-preview__badge--ccl      { background: rgba(200, 25, 42, 0.26); color: #ff868c;
                                    max-width: 100%; }
    /* Basculement de catégorie. Citron vert, et le choix est arithmétique
       plutôt qu'esthétique : les huit teintes déjà prises laissaient un seul
       créneau large — l'optimum est à 93°, à 54° du voisin le plus proche,
       là où turquoise ou cyan n'auraient offert que 26 à 27° du sponsor et du
       co-stream. On s'y pose à 91°, soit 52° de l'ancien abonné et 54° de
       l'abonné, pour 7,15:1 de contraste — dans la fourchette de la famille
       (6,38 à 7,67). Le vert dit « nouveau », ce qui tombe bien : le badge
       annonce une nouvelle, et il s'efface au bout de dix minutes. */
    .tse-preview__badge--switch   { background: rgba(120, 215, 60, 0.24); color: #a8e86b; }
    /* Les pictogrammes d'avertissement. line-height: 1 les empêche de
       rehausser le badge : un emoji dépasse sa boîte em, et sans cela la
       pastille grandissait d'un pixel ou deux par rapport aux autres. */
    .tse-preview__badge-mark      { flex: 0 0 auto; line-height: 1; }
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

  const cache = new Map();

  const basculements = new Map();

  const noterBasculement = (login, avant, apres) => {
    if (!avant || !apres) return;
    if (!avant.game || !apres.game) return;
    if (avant.game === apres.game) return;

    const memeSession = avant.stream?.id && apres.stream?.id
                        && avant.stream.id === apres.stream.id;
    if (!memeSession) return;

    basculements.set(login, {
      vers: apres.game,
      libelle: apres.gameLabel || apres.game,
      ts: Date.now()
    });

    while (basculements.size > CFG.CATEGORY_SWITCH_MAX) {
      basculements.delete(basculements.keys().next().value);
    }
  };

  const basculementFrais = (login) => {
    const b = basculements.get(login);
    if (!b) return null;
    if (Date.now() - b.ts > CFG.CATEGORY_SWITCH_TTL) { basculements.delete(login); return null; }
    return b;
  };

  let queue = new Map();
  let queueTimer = null;
  let gqlCooldownUntil = 0;
  let massOfflineStreak = 0;

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const NETWORK_ERROR = Symbol('network-error');

  const post = (payload) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CFG.GQL_TIMEOUT);
    return fetch(CFG.GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-ID': CFG.CLIENT_ID,
                 'Accept-Language': S.locale },
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

    '      game { id name displayName }' +
    '      freeformTags { name }' +
    '    }' +
    '  }' +
    '}';

  const buildChannelsOp = (logins) => ({
    operationName: 'TseChannels',
    variables: { logins },
    query: TSE_CHANNELS_QUERY
  });

  const UPTIME_UNKNOWN = Symbol('uptime-unknown');

  const isResultsUnusable = (results) => {
    if (results === NETWORK_ERROR) return true;
    if (!Array.isArray(results)) return true;
    if (results.length === 0) return true;

    if (results.every(r => r === null || r === undefined || r?.errors)) return true;
    return false;
  };

  async function flushQueue() {
    queueTimer = null;
    const logins = [...queue.keys()];
    const pending = queue;
    queue = new Map();
    if (!logins.length) return;

    const slices = chunk(logins, CFG.GQL_MAX_LOGINS);
    const responses = await Promise.all(slices.map(s => post([buildChannelsOp(s)])));

    const now = Date.now();
    let fresh = 0;

    const parsed = slices.map((slice, si) => {
      const results = responses[si];
      const list = results?.[0]?.data?.users;

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
        if (!byLogin.has(login)) continue;
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

        if (!user) {
          (pending.get(login) || []).forEach(fn => fn(UPTIME_UNKNOWN));
          return;
        }
        const stream = user?.stream ?? null;

        const id = user?.id ?? cache.get(login)?.id ?? null;

        const tags = Array.isArray(stream?.freeformTags)
          ? stream.freeformTags.map(t => t?.name).filter(Boolean)
          : [];
        const entry = {
          id,
          stream,
          tags,
          game:    stream?.game?.name || null,

          gameLabel: stream?.game?.displayName?.trim() || stream?.game?.name || null,
          viewers: Number.isFinite(stream?.viewersCount) ? stream.viewersCount : null,

          name:    user?.displayName?.trim() || cache.get(login)?.name || null,
          avatar:  user?.profileImageURL || cache.get(login)?.avatar || null,
          ts:      now
        };

        noterBasculement(login, cache.get(login), entry);
        cache.set(login, entry);

        globalChannels.setViewers(login, entry.viewers);
        fresh++;
        (pending.get(login) || []).forEach(fn => fn(entry));
      });
    });

    if (fresh) scheduleScan();
  }

  const getChannelId = (login) => cache.get(login)?.id ?? null;

  const getFreshChannel = (login) => {
    const hit = cache.get(login);
    return hit && Date.now() - hit.ts < CFG.LIVE_TTL ? hit : null;
  };

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

  const globalChannels = (() => {

    const CATEGORIES_QUERY =
      'query TseCategories($n: Int!) {' +
      '  games(first: $n, options: { sort: VIEWER_COUNT }) {' +
      '    edges { node { id name displayName viewersCount } }' +
      '  }' +
      '}';

    const catTopQuery = (code) =>
      'query TseCategoryTop($name: String!, $n: Int!) {' +
      '  game(name: $name) {' +
      '    id name viewersCount' +
      '    streams(first: $n, options: { sort: VIEWER_COUNT' +
      (code ? `, broadcasterLanguages: [${code}]` : '') + ' }) {' +
      '      edges { node {' +
      '        id createdAt viewersCount' +
      '        broadcaster { id login displayName profileImageURL(width: 70) }' +

      '        game { id name displayName }' +
      '        freeformTags { name }' +
      '      } }' +
      '    }' +
      '  }' +
      '}';

    const CATEGORY_TOP_QUERY = catTopQuery(null);

    let categories    = [];
    let categoriesTs  = 0;
    let ranking       = [];
    let rankingDirty  = false;
    let rankingTs     = 0;
    let threshold     = 0;
    let lastFullWalk  = 0;
    let cooldownUntil = 0;
    let failStreak    = 0;
    let okStreak      = 0;
    let degraded      = false;
    let running       = false;
    let complete      = false;
    let windowFloor   = 0;
    const stats = { walks: 0, light: 0, scoped: 0, ops: 0, failedSlices: 0,
                    misses: 0, evicted: 0, lastMs: 0 };

    const send = async (ops) => {
      if (!ops.length) return { out: [], transport: false };
      const slices = chunk(ops, CFG.GLOBAL_BATCH_OPS);
      stats.ops += ops.length;
      const responses = await Promise.all(slices.map(s => post(s)));
      const out = [];
      let transport = false;
      responses.forEach((rep, i) => {
        const size = slices[i].length;

        if (rep === NETWORK_ERROR || !Array.isArray(rep) || rep.length !== size) {
          stats.failedSlices += 1;
          transport = true;
          for (let k = 0; k < size; k++) out.push(null);
          return;
        }
        rep.forEach(r => out.push(r?.errors ? null : (r?.data ?? null)));
      });
      return { out, transport };
    };

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
        gameLabel: node.game?.displayName?.trim() || node.game?.name || null,
        createdAt: node.createdAt || null,

        tags:      Array.isArray(node.freeformTags)
          ? node.freeformTags.map(t => t?.name).filter(Boolean) : [],
        ts:        now
      };
    };

    const nthViewers = (pool, n) => {
      if (pool.size < n) return 0;
      const v = [...pool.values()].map(s => s.viewers).sort((a, b) => b - a);
      return v[n - 1] ?? 0;
    };

    const fetchCategories = async () => {
      const { out: [data] } = await send([{
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

      list.sort((a, b) => b.viewers - a.viewers);
      return list.length ? list : null;
    };

    const harvest = async (cats, pool, code = null) => {
      const queried = new Set(), seen = new Set();
      if (!cats.length) return { queried, seen, done: 0, transport: false };
      const query = code ? catTopQuery(code) : CATEGORY_TOP_QUERY;
      const ops = cats.map(c => ({
        operationName: 'TseCategoryTop',
        variables: { name: c.name, n: CFG.GLOBAL_STREAMS_MAX },
        query
      }));
      const { out: data, transport } = await send(ops);
      const now  = Date.now();
      let done = 0;
      data.forEach((d, i) => {
        const edges = d?.game?.streams?.edges;
        if (!Array.isArray(edges)) return;
        done += 1;
        queried.add(cats[i].name);

        if (Number.isFinite(d.game?.viewersCount)) cats[i].viewers = d.game.viewersCount;
        for (const e of edges) {
          const rec = readStream(e?.node, now);
          if (!rec) continue;
          seen.add(rec.login);
          const prev = pool.get(rec.login);

          if (!prev || rec.ts >= prev.ts) pool.set(rec.login, rec);
        }
      });
      return { queried, seen, done, transport };
    };

    const reconcile = (pool, queried, seen, now) => {
      const cutoff = now - CFG.GLOBAL_PRUNE_AGE;
      for (const [login, rec] of pool) {
        if (seen.has(login)) { rec.misses = 0; continue; }

        if (rec.ts < cutoff) { pool.delete(login); stats.evicted += 1; continue; }
        if (!queried.has(rec.game)) continue;
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

    const carryOver = () => new Map(ranking.map(r => [r.login, r]));

    const fullWalk = async (wl) => {
      const gen = ++walkGen;
      const started = Date.now();

      const langAvant = worldLang;
      const cats = await fetchCategories();
      if (!cats) return { ok: false, complete: false };
      categories   = cats;
      categoriesTs = started;

      const pool = (wl?.lang || null) === langAvant ? carryOver() : new Map();
      const seed = cats.slice(0, CFG.GLOBAL_SEED_CATEGORIES);
      let code = wl?.code || null;
      let a = await harvest(seed, pool, code);

      if (!a.done && code && !a.transport) {
        langApiRejected.add(wl.lang);
        code = null;
        pool.clear();
        a = await harvest(seed, pool);
      }
      if (!a.done) return { ok: false, complete: false };

      const t = nthViewers(pool, CFG.GLOBAL_TOP_N);

      const rest = cats.slice(seed.length);
      const todo = [];
      let truncated = false;
      for (const c of rest) {

        if (t > 0 && c.viewers <= t) break;
        if (todo.length >= CFG.GLOBAL_CATEGORY_BUDGET) { truncated = true; break; }
        todo.push(c);
      }

      const b = await harvest(todo, pool, code);
      if (gen !== walkGen) return { ok: true, complete: false };

      if (code) {
        for (const rec of pool.values()) {
          if (!rec.tags.includes(wl.lang)) rec.tags = [...rec.tags, wl.lang];
        }
      }
      reconcile(pool,
                new Set([...a.queried, ...b.queried]),
                new Set([...a.seen,    ...b.seen]),
                started);
      publish(pool);

      windowFloor = cats[cats.length - 1].viewers;
      complete = !truncated
        && (cats.length < CFG.GLOBAL_CATEGORIES_MAX || windowFloor <= threshold);

      const langFinal = code ? wl.lang : null;

      worldLang = langFinal;

      if (!langFinal) allLangPool = ranking;
      lastFullWalk = rankingTs;
      stats.walks += 1;
      stats.lastMs = rankingTs - started;
      return { ok: true, complete };
    };

    const lightPass = async (wl) => {
      const gen = ++walkGen;
      const started = Date.now();
      const langAvant = worldLang;
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
          if (c.viewers <= threshold) break;
          const before = prev.get(c.name);

          if ((before === undefined || before <= threshold) && !seen.has(c.name)) {
            crossed.push(c);
            seen.add(c.name);
          }
        }
      }

      const pool = carryOver();

      const code = langAvant ? (wl?.code || null) : null;
      const h = await harvest(seed.concat(crossed), pool, code);
      if (gen !== walkGen) return { ok: true };
      if (!h.done) return { ok: false };
      if (code) {
        for (const rec of pool.values()) {
          if (!rec.tags.includes(langAvant)) rec.tags = [...rec.tags, langAvant];
        }
      }
      reconcile(pool, h.queried, h.seen, started);
      publish(pool);
      if (!langAvant) allLangPool = ranking;
      stats.light += 1;
      stats.lastMs = rankingTs - started;
      return { ok: true };
    };

    let scope        = null;
    let scopeRanking = [];
    let scopeTs      = 0;
    let scopeDirty   = false;

    let scopeGen     = 0;

    let worldLang = null;

    let allLangPool = [];

    let walkGen = 0;

    let scopeLangApplied = false;

    const wantedScope = () => {
      if (!state.globalMode || !state.categoryFilter) return null;
      const lang = state.languageFilter;
      const code = (lang && !langApiRejected.has(lang)) ? (LANG_API[lang] || null) : null;
      return { name: state.categoryFilter, lang, code,
               key: state.categoryFilter + '\u0000' + (code || '') };
    };

    const wantedLang = () => {
      if (!state.globalMode || state.categoryFilter) return null;
      const lang = state.languageFilter;
      if (!lang || langApiRejected.has(lang)) return null;
      const code = LANG_API[lang];
      return code ? { lang, code } : null;
    };

    const scopePass = async (want) => {
      const gen = ++scopeGen;
      const started = Date.now();
      const frais = new Map();
      let applique = !!want.code;
      let h = await harvest([{ name: want.name, viewers: 0 }], frais, want.code);

      if (!h.done && want.code && !h.transport) {
        langApiRejected.add(want.lang);
        applique = false;
        frais.clear();
        h = await harvest([{ name: want.name, viewers: 0 }], frais);
      }

      if (gen !== scopeGen) return { ok: true };
      if (!h.done) return { ok: false };

      if (applique) {
        for (const rec of frais.values()) {
          if (!rec.tags.includes(want.lang)) rec.tags = [...rec.tags, want.lang];
        }
      }

      const pool = scope === want.key ? new Map(scopeRanking.map(r => [r.login, r])) : new Map();
      for (const [login, rec] of frais) pool.set(login, rec);
      reconcile(pool, h.queried, h.seen, started);
      scope        = want.key;
      scopeLangApplied = applique;
      scopeRanking = [...pool.values()].sort((a, b) => b.viewers - a.viewers);
      scopeDirty   = false;
      scopeTs      = Date.now();
      stats.scoped += 1;
      stats.lastMs  = scopeTs - started;
      return { ok: true };
    };

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

      const want = wantedScope();
      if (want) {
        const neuf = want.key !== scope;
        if (!neuf && now - scopeTs < CFG.GLOBAL_STRUCT_TICK) return;
        running = true;
        scopePass(want)
          .then(res => { res?.ok ? noteSuccess() : noteFailure(); })
          .catch(() => noteFailure())
          .finally(() => { running = false; });
        return;
      }

      const wl = wantedLang();
      const langChange = (wl?.lang || null) !== worldLang;

      if (langChange && !wl && allLangPool.length) {
        ranking = allLangPool;
        rankingDirty = false;
        worldLang = null;
      }
      const needFull = langChange || !ranking.length
        || now - lastFullWalk >= CFG.GLOBAL_FULL_WALK_MS;
      if (!needFull) {
        const interval = degraded ? CFG.GLOBAL_FULL_WALK_MS : CFG.GLOBAL_STRUCT_TICK;
        if (now - rankingTs < interval) return;
      }
      running = true;
      (needFull ? fullWalk(wl) : lightPass(wl))
        .then(res => { res?.ok ? noteSuccess() : noteFailure(); })
        .catch(() => noteFailure())
        .finally(() => { running = false; });
    };

    const reset = () => {
      categories = []; categoriesTs = 0;
      ranking = []; rankingDirty = false; rankingTs = 0;
      threshold = 0; windowFloor = 0; lastFullWalk = 0; cooldownUntil = 0;
      scope = null; scopeRanking = []; scopeTs = 0; scopeDirty = false;
      worldLang = null; allLangPool = []; walkGen += 1;
      scopeLangApplied = false;
      scopeGen += 1;
      failStreak = 0; okStreak = 0; degraded = false; complete = false;
    };

    return {
      tick,
      reset,

      warm() {
        if (running) return Promise.resolve(null);
        running = true;
        return fullWalk()
          .then(res => { res?.ok ? noteSuccess() : noteFailure(); return res; })
          .catch(() => { noteFailure(); return { ok: false, complete: false }; })
          .finally(() => { running = false; });
      },

      base() {
        const want = wantedScope();
        if (want) {

          if (want.key !== scope) return [];
          if (scopeDirty) {
            scopeRanking = scopeRanking.slice().sort((a, b) => b.viewers - a.viewers);
            scopeDirty = false;
          }
          return scopeRanking;
        }

        if ((wantedLang()?.lang || null) !== worldLang) return [];
        if (rankingDirty) {
          ranking = ranking.slice().sort((a, b) => b.viewers - a.viewers);
          rankingDirty = false;
        }
        return ranking;
      },

      top(n = CFG.GLOBAL_TOP_N) {
        const lang = state.globalMode ? state.languageFilter : null;
        const liste = this.base();

        if (!lang
            || (wantedScope() && scopeLangApplied)
            || (!wantedScope() && worldLang === lang)) return liste.slice(0, n);
        return liste.filter(r => r.tags.includes(lang)).slice(0, n);
      },

      langs() {
        const m = new Map();
        const src = allLangPool.length ? allLangPool
          : (ranking.length ? ranking : this.base());
        for (const r of src) {
          for (const t of r.tags) {
            if (LANG_SET.has(t)) m.set(t, (m.get(t) || 0) + 1);
          }
        }
        return m;
      },

      cats(n = CFG.GLOBAL_CATEGORIES_MAX) { return categories.slice(0, n); },

      setViewers(login, viewers) {

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

          complete:   complete
            && !(state.globalMode && state.languageFilter
                 && !(wantedScope() ? scopeLangApplied
                                    : worldLang === state.languageFilter)),
          langApplied: !!(wantedScope() ? scopeLangApplied
                                        : worldLang && worldLang === state.languageFilter),
          worldLang,
          language:   state.globalMode ? state.languageFilter : null,
          scope,
          scopeSize:  scopeRanking.length,
          degraded,
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

  const noeudStatique = (() => {
    const cache = new Map();
    return (balisage) => {
      let modele = cache.get(balisage);
      if (!modele) {
        modele = new DOMParser().parseFromString(balisage, 'text/html').body;
        cache.set(balisage, modele);
      }
      const frag = document.createDocumentFragment();
      for (const n of modele.childNodes) frag.appendChild(n.cloneNode(true));
      return frag;
    };
  })();

  const FENTE = '\u0000';

  const phraseAvecFente = (phrase, fabriquerRemplissage) => {
    const frag = document.createDocumentFragment();
    const morceaux = String(phrase).split(FENTE);
    morceaux.forEach((t, i) => {
      if (t) frag.appendChild(document.createTextNode(t));
      if (i < morceaux.length - 1) frag.appendChild(fabriquerRemplissage());
    });
    return frag;
  };

  const nomsEnGras = (noms) => {
    const frag = document.createDocumentFragment();
    noms.forEach((n, i) => {
      if (i) frag.appendChild(document.createTextNode(', '));
      const fort = document.createElement('strong');
      fort.textContent = n;
      frag.appendChild(fort);
    });
    return frag;
  };

  const setText = (el, text) => {
    if (el && el.textContent !== text) el.textContent = text;
  };

  const followedSection = () => {
    for (const el of document.querySelectorAll(DOM.followedSelector)) {
      const sec = el.closest('.side-nav-section');
      if (sec) return sec;
    }
    return document.querySelector(`${DOM.sidebarRoot} ${DOM.followedHeaderSelector}`)
      ?.closest('.side-nav-section') || null;
  };

  const loadingOverlay = (() => {

    let globalObserver = null;
    let wasPresent = false;
    let cycleActive = false;

    let overlay = null;
    let spinner = null;
    let stabilityTimer = null;
    let cycleObserver = null;
    let resizeHandler = null;
    let timeoutTimer = null;
    let lastCardCount = 0;

    const build = () => {
      const el = document.createElement('div');
      el.className = 'tse-loading-overlay';
      const sp = document.createElement('div');
      sp.className = 'tse-loading-overlay__spinner';
      el.appendChild(sp);
      return { el, sp };
    };

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

      document.body.classList.remove('tse-loading');
      if (!overlay || !overlay.isConnected) { overlay = null; spinner = null; return; }

      overlay.dataset.tseFading = 'true';
      const oldOverlay = overlay;
      overlay = null;
      spinner = null;
      setTimeout(() => {
        if (oldOverlay.isConnected) oldOverlay.remove();
      }, CFG.LOADING_FADE_MS);
    };

    const armStability = () => {
      if (stabilityTimer) clearTimeout(stabilityTimer);
      stabilityTimer = setTimeout(() => { noter('levée', 'stabilité'); finish(); },
                                  CFG.LOADING_STABILITY_MS);
    };

    const clearStability = () => {
      if (stabilityTimer) { clearTimeout(stabilityTimer); stabilityTimer = null; }
    };

    const verrous = new Set();
    let held = false;
    const setHold = (on, raison = 'global') => {
      const avant = held;
      if (on) verrous.add(raison); else verrous.delete(raison);
      held = verrous.size > 0;
      if (held && !avant) clearStability();
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

    const bumpActivity = () => {
      if (!cycleActive) return;
      clearStability();
    };

    const startCycle = (raison = 'inconnue') => {
      if (cycleActive) { noter('cycle ignoré', raison); return; }
      noter('cycle', raison);
      cycleActive = true;
      lastCardCount = 0;
      verrous.clear();
      held = false;

      document.body.classList.add('tse-loading');

      const built = build();
      overlay = built.el;
      spinner = built.sp;
      document.body.appendChild(overlay);
      reposition();

      resizeHandler = () => reposition();
      window.addEventListener('resize', resizeHandler);

      cycleObserver = new MutationObserver((mutations) => {
        if (!cycleActive) return;
        const allInOverlay = mutations.every(m =>
          overlay && (m.target === overlay || overlay.contains(m.target))
        );
        if (allInOverlay) return;
        reposition();
      });
      cycleObserver.observe(document.body, { childList: true, subtree: true });

      timeoutTimer = setTimeout(() => { noter('levée', 'délai maximal'); finish(); },
                                CFG.LOADING_TIMEOUT_MS);
    };

    const init = () => {

      startCycle('démarrage');

      wasPresent = !!document.querySelector(DOM.sidebarRoot);
      globalObserver = new MutationObserver(() => {
        const present = !!document.querySelector(DOM.sidebarRoot);
        if (present && !wasPresent && !cycleActive) {

          startCycle('remount de la sidebar');
        }
        wasPresent = present;
      });
      globalObserver.observe(document.body, { childList: true, subtree: true });
    };

    return { init, notifyScan,
      setHold, bumpActivity, startCycle,
      journal: () => journal.slice(),

      verrous: () => [...verrous] };
  })();

  const visits = {
    map: new Map(),

    load() {
      try {
        const raw = localStorage.getItem(CFG.VISIT_STORAGE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return;
        for (const [login, arr] of Object.entries(obj)) {
          if (!Array.isArray(arr)) continue;

          const cleaned = arr
            .map(Number)
            .filter(n => Number.isFinite(n) && n > 0)
            .sort((a, b) => b - a)
            .slice(0, CFG.VISIT_ROLLING_N);
          if (cleaned.length) this.map.set(login, cleaned);
        }
        this.prune();
      } catch {   }
    },

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
      } catch {   }
    },

    record(login) {
      if (!login) return;
      const now = Date.now();
      const list = this.map.get(login) || [];
      if (list.length > 0 && now - list[0] < CFG.VISIT_SESSION_MS) {
        return;
      }
      list.unshift(now);
      if (list.length > CFG.VISIT_ROLLING_N) list.length = CFG.VISIT_ROLLING_N;
      this.map.set(login, list);
      this.prune();
      this.save();
    },

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

  const subs = {

    map: new Map(),

    load() {
      try {
        const obj = JSON.parse(localStorage.getItem(CFG.SUBS_STORAGE_KEY) || 'null');
        if (!obj || typeof obj !== 'object') return;
        for (const [login, v] of Object.entries(obj)) {

          if (!Array.isArray(v) || v.length < 2) continue;
          const ts = Number(v[1]);
          if (!Number.isFinite(ts) || ts <= 0) continue;
          const e = { sub: !!v[0], ts };
          const m = Number(v[2]);
          if (Number.isFinite(m) && m > 0) e.m = m;
          if (v[3]) e.ex = true;
          if (typeof v[4] === 'string' && v[4]) e.src = v[4];
          this.map.set(login, e);
        }
        this.prune();
      } catch {   }
    },

    save() {
      try {
        const obj = {};
        for (const [login, e] of this.map) {

          if (e.src) obj[login] = [e.sub ? 1 : 0, e.ts, e.m || 0, e.ex ? 1 : 0, e.src];
          else if (e.m || e.ex) obj[login] = [e.sub ? 1 : 0, e.ts, e.m || 0, e.ex ? 1 : 0];
          else obj[login] = [e.sub ? 1 : 0, e.ts];
        }
        localStorage.setItem(CFG.SUBS_STORAGE_KEY, JSON.stringify(obj));
      } catch {   }
    },

    prune() {
      const limite = Date.now() - CFG.SUBS_TTL_DAYS * 24 * 60 * 60 * 1000;
      for (const [login, e] of [...this.map]) if (e.ts < limite) this.map.delete(login);
      if (this.map.size <= CFG.SUBS_MAX_LOGINS) return;

      const gardees = [...this.map.entries()]
        .sort((a, b) => (Number(b[1].sub) - Number(a[1].sub)) || (b[1].ts - a[1].ts))
        .slice(0, CFG.SUBS_MAX_LOGINS);
      this.map = new Map(gardees);
    },

    record(login, sub, differer = false) {
      if (!login) return false;
      const avant = this.map.get(login);

      const e = { sub, ts: Date.now() };
      if (avant?.m) e.m = avant.m;
      if (avant?.ex) e.ex = avant.ex;
      if (avant?.src) e.src = avant.src;
      this.map.set(login, e);
      if (avant && avant.sub === sub) return false;

      if (!differer) this.flush();
      return true;
    },

    noteMonths(login, mois, ancien, differer = false) {
      if (!login) return false;
      const m = Number(mois);
      if (!Number.isFinite(m) || m <= 0) return false;
      const avant = this.map.get(login);
      const e = avant
        ? { ...avant }
        : { sub: false, ts: Date.now() };
      if (e.m === m && (!ancien || e.ex)) return false;
      e.m = m;
      if (ancien) e.ex = true;

      this.map.set(login, e);

      if (!differer) this.flush();
      return true;
    },

    flush() {
      this.prune();
      this.save();
    },

    noteSource(login, src, differer = false) {
      if (!login || !src) return false;
      const avant = this.map.get(login);
      if (avant && avant.src === src) return false;
      const e = avant ? { ...avant } : { sub: false, ts: Date.now() };
      e.src = src;
      this.map.set(login, e);
      if (!differer) this.flush();
      return true;
    },

    monthsFor(login) {
      const e = login ? this.map.get(login) : null;
      return e?.m || 0;
    },

    wasSub(login) {
      const e = login ? this.map.get(login) : null;
      return !!(e && e.ex && !this.isSub(login));
    },

    isSub(login) {
      const e = login ? this.map.get(login) : null;
      if (!e || !e.sub) return false;
      return Date.now() - e.ts < CFG.SUBS_TTL_DAYS * 24 * 60 * 60 * 1000;
    },

    count() {
      let n = 0;
      for (const login of this.map.keys()) if (this.isSub(login)) n += 1;
      return n;
    },

    entries() {
      return [...this.map.entries()]
        .map(([login, e]) => ({ login, sub: e.sub, ts: e.ts, mois: e.m || 0,
                                ancien: !!e.ex, origine: e.src || '' }))
        .sort((a, b) => (b.sub - a.sub) || (b.ts - a.ts));
    },

    clear() {
      this.map.clear();
      try { localStorage.removeItem(CFG.SUBS_STORAGE_KEY); } catch {}

      try { localStorage.removeItem(CFG.SUBS_PAGE_STAMP_KEY); } catch {}

      try { localStorage.removeItem(CFG.SUBS_LABEL_KEY); } catch {}
    }
  };

  const subsPage = (() => {
    let running = false;

    let etiquette = (() => {
      try { return localStorage.getItem(CFG.SUBS_LABEL_KEY) || ''; }
      catch { return ''; }
    })();
    const retenirEtiquette = (t) => {
      etiquette = t;
      try { localStorage.setItem(CFG.SUBS_LABEL_KEY, t); } catch {}
    };

    const feuilles = (carte) => {
      const out = [];
      for (const el of carte.querySelectorAll('p, span')) {

        const bruit = el.closest(DOM.subCardNoiseSelector);
        if (bruit && bruit !== carte) continue;
        const t = [...el.childNodes]
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent.trim())
          .filter(Boolean)
          .join(' ')
          .trim();
        if (t) out.push({ el, t });
      }
      return out;
    };

    const entier = (t) => {
      const m = /\d+/.exec(t || '');
      const n = m ? parseInt(m[0], 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const mois = (carte, apprendre) => {
      const f = feuilles(carte);
      if (apprendre) {

        if (f.length !== 2 || entier(f[0].t) || !entier(f[1].t)) return 0;
        if (etiquette !== f[0].t) retenirEtiquette(f[0].t);
        return entier(f[1].t);
      }
      if (!etiquette) return 0;
      const i = f.findIndex(x => x.t === etiquette);
      return i >= 0 && f[i + 1] ? entier(f[i + 1].t) : 0;
    };

    const LECTEUR = 2;
    const horodatage = () => {
      try {
        const brut = String(localStorage.getItem(CFG.SUBS_PAGE_STAMP_KEY) || '');
        if (!brut) return 0;
        const [v, t] = brut.includes(':') ? brut.split(':') : ['1', brut];
        if (Number(v) !== LECTEUR) return 0;
        return Number(t) || 0;
      } catch { return 0; }
    };
    const marquer = () => {
      try {
        localStorage.setItem(CFG.SUBS_PAGE_STAMP_KEY, LECTEUR + ':' + Date.now());
      } catch {}
    };

    const visiterApres = (onglet, passe, rang) =>
      new Promise(r => setTimeout(r, rang * CFG.SUBS_PAGE_STAGGER))
        .then(() => visiter(onglet, passe));

    const visiter = (onglet, passe = false) => new Promise(resolve => {
      let cadre = document.createElement('iframe');
      let sondeur = null, limite = null;
      let debout = 0;
      let passage = '';
      let noeuds = -1;
      let stableDepuis = 0;
      const finir = (logins) => {
        if (sondeur) { clearInterval(sondeur); sondeur = null; }
        if (limite) { clearTimeout(limite); limite = null; }
        if (cadre) { cadre.remove(); cadre = null; }
        resolve(logins);
      };
      cadre.setAttribute('aria-hidden', 'true');
      cadre.setAttribute('tabindex', '-1');
      cadre.style.cssText =
        'position:fixed;left:-10000px;top:0;width:1280px;height:900px;' +
        'opacity:0;pointer-events:none;border:0';
      cadre.src = `${location.origin}/subscriptions?tab=${encodeURIComponent(onglet)}`;
      limite = setTimeout(() => finir([]), CFG.SUBS_PAGE_TIMEOUT);
      cadre.addEventListener('load', () => {

        try {
          const chemin = cadre?.contentWindow?.location?.pathname;
          if (chemin && chemin !== '/subscriptions') return finir([]);
        } catch { return finir([]); }

        sondeur = setInterval(() => {
          let doc = null;
          try { doc = cadre?.contentDocument; } catch { return finir([]); }
          if (!doc) return;
          const cartes = doc.querySelectorAll(DOM.subCardSelector);
          if (cartes.length) {
            const trouve = [];
            const vus = new Set();
            for (const carte of cartes) {
              const lien = carte.querySelector('a[href^="/"]');
              const login = loginFromHref(lien?.getAttribute('href') || '');
              if (!login || vus.has(login)) continue;
              vus.add(login);
              trouve.push({ login, mois: mois(carte, passe) });
            }
            if (trouve.length) {

              const signature = trouve.length + '/' +
                trouve.filter(x => x.mois > 0).length + '/' +
                trouve.reduce((s, x) => s + x.mois, 0);
              if (signature !== passage) { passage = signature; stableDepuis = Date.now(); return; }
              if (Date.now() - stableDepuis < CFG.SUBS_PAGE_STABLE) return;
              return finir(trouve);
            }
          }
          if (!cartes.length) {

            const taille = doc.querySelectorAll('*').length;
            if (taille !== noeuds) { noeuds = taille; debout = 0; return; }
            if (!debout && doc.querySelector(DOM.sidebarRoot)) debout = Date.now();
            if (debout && Date.now() - debout > CFG.SUBS_PAGE_SETTLE) return finir([]);
            return;
          }
        }, 400);
      }, { once: true });
      document.body.appendChild(cadre);
    });

    const refresh = async (force = false) => {
      if (!CFG.SUBS_PAGE_ENABLED || running) return null;
      if (!force && Date.now() - horodatage() < CFG.SUBS_PAGE_TTL) return null;
      if (!document.body) return null;
      running = true;
      const trouves = [];
      try {
        let touche = false;
        const verserPasse = (liste) => {
          for (const { login, mois: m } of liste) {
            touche = subs.noteMonths(login, m, true, true) || touche;
          }
        };

        const verserCourant = (onglet) => (liste) => {
          if (!liste.length) return;
          for (const { login, mois: m } of liste) {
            if (!trouves.includes(login)) trouves.push(login);
            touche = subs.noteMonths(login, m, false, true) || touche;

            touche = subs.noteSource(login, onglet, true) || touche;
            touche = subs.record(login, true, true) || touche;
          }

          if (touche) { subs.flush(); touche = false; }
          scheduleScan();
          premierResultat();
        };

        if (!etiquette) {
          for (const onglet of CFG.SUBS_PAGE_TABS_PAST) verserPasse(await visiter(onglet, true));
        }

        const encore = etiquette ? CFG.SUBS_PAGE_TABS_PAST : [];
        let rang = 0;
        await Promise.all([
          ...encore.map(o => visiterApres(o, true, rang++).then(verserPasse)),
          ...CFG.SUBS_PAGE_TABS.map(o => visiterApres(o, false, rang++).then(verserCourant(o))),
        ]);
        if (touche) subs.flush();

        marquer();
      } finally {

        running = false;
      }
      return trouves;
    };

    const demarrer = () => {

      const aveugle = !horodatage();
      if (!aveugle) { premierResultat = () => {}; refresh().catch(() => {}); return; }

      loadingOverlay.setHold(true, 'subs');
      let repit = null;
      const lever = () => {
        if (repit) { clearTimeout(repit); repit = null; }
        clearTimeout(secours);
        premierResultat = () => {};
        loadingOverlay.setHold(false, 'subs');
        scheduleScan();
      };
      const secours = setTimeout(lever, CFG.SUBS_PAGE_HOLD_MAX);

      premierResultat = () => {
        if (repit) return;
        repit = setTimeout(lever, CFG.SUBS_PAGE_HOLD_GRACE);
      };

      refresh().catch(() => {}).then(lever, lever);
    };

    let premierResultat = () => {};

    let arme = false, parti = false;

    const enAttente = () => arme && !parti;
    const notifySidebar = (aDesChainesSuivies) => {
      if (!enAttente() || !aDesChainesSuivies) return;
      parti = true;
      demarrer();
    };

    const init = () => {
      if (!CFG.SUBS_PAGE_ENABLED) return;
      arme = true;
    };

    return { init, refresh, horodatage, notifySidebar, enAttente };
  })();

  function detectSubscription() {
    const login = loginFromHref(location.pathname);
    if (!login) return;
    if (document.querySelector(DOM.subManageSelector)) subs.record(login, true);
    else if (document.querySelector(DOM.subOfferSelector)) subs.record(login, false);

  }

  const roster = (() => {
    const map = new Map();
    let dirty = false;

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
      } catch {   }
    };

    const prune = () => {
      const cutoff = Date.now() - CFG.ROSTER_MAX_AGE;
      for (const [login, ts] of map) if (ts < cutoff) { map.delete(login); ordered = null; }
      if (map.size <= CFG.ROSTER_MAX) return;
      const kept = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, CFG.ROSTER_MAX);
      map.clear();
      for (const [login, ts] of kept) map.set(login, ts);
      ordered = null;
    };

    const flush = () => {
      if (!dirty) return;
      dirty = false;
      prune();
      try {
        localStorage.setItem(CFG.ROSTER_STORAGE_KEY,
          JSON.stringify(Object.fromEntries(map)));
      } catch {   }
    };

    const record = (login) => {
      if (!login) return;
      const now = Date.now();
      const prev = map.get(login);

      if (prev && now - prev < 60_000) return;
      map.set(login, now);
      dirty = true;
      ordered = null;
    };

    const init = () => {
      load();

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

  const liveLag = (() => {
    const bootAt = Date.now();
    let visibleSince = document.hidden ? 0 : bootAt;

    const aheadAt = new Map();
    const done    = new Set();

    let samples = [];

    const load = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(CFG.LAG_STORAGE_KEY) || 'null');

        if (!raw || raw.v !== CFG.LAG_FORMAT || !Array.isArray(raw.samples)) return;
        samples = raw.samples
          .filter(x => x && Number.isFinite(x.lag) && Number.isFinite(x.ts))
          .slice(-CFG.LAG_MAX_SAMPLES);
      } catch {   }
    };

    const save = () => {
      try {
        localStorage.setItem(CFG.LAG_STORAGE_KEY,
          JSON.stringify({ v: CFG.LAG_FORMAT, samples }));
      } catch {   }
    };

    const noteAhead = (streamId) => {
      if (!streamId || done.has(streamId) || aheadAt.has(streamId)) return;
      aheadAt.set(streamId, Date.now());
    };

    const observe = (card, stream) => {
      const id = stream?.id;
      if (!id || done.has(id)) return;
      if (isSynthetic(card)) return;
      if (!card.querySelector(DOM.followedCardSelector)) return;
      const started = new Date(stream.createdAt).getTime();
      if (!Number.isFinite(started)) return;

      done.add(id);
      const ahead = aheadAt.get(id);
      aheadAt.delete(id);

      if (started <= Math.max(bootAt + CFG.LAG_SETTLE_MS, visibleSince)) return;

      const now = Date.now();
      const lag = now - started;
      if (lag < 0 || lag > CFG.LAG_MAX_PLAUSIBLE) return;
      samples.push({
        login: card.dataset.tseLogin || null,
        lag,

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

          aheadAt.clear();
        }
      });
    };

    const prune = () => {

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

        if (loginFromHref(location.pathname) === pendingLogin) {
          visits.record(pendingLogin);
        }
        timer = null;
        pendingLogin = null;
      }, CFG.VISIT_MIN_DWELL_MS);
    };

    const onLocationChange = () => {
      const login = loginFromHref(location.pathname);
      start(login);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancel();
      } else {
        onLocationChange();
      }
    };

    return {
      init() {
        visits.load();

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

        onLocationChange();
      }
    };
  })();

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
      subs.clear();
      liveLag.clear();
      console.log(S.consoleHistoryCleared);
    },

    subs(limit = Infinity) {
      const entries = subs.entries();
      if (!entries.length) { console.log(S.consoleNoSubs); return []; }
      const lignes = entries.slice(0, limit);
      console.table(lignes.map(e => ({
        [S.consoleColLogin]: e.login,
        abonné:              e.sub,
        [S.consoleColLast]:  formatDate(e.ts)
      })));
      return lignes;
    },

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

    verrous() { return loadingOverlay.verrous(); },
    cycles() {
      const j = loadingOverlay.journal();
      if (!j.length) { console.log('[tse] aucun cycle de voile enregistré.'); return j; }
      console.table(j.map(e => ({ 'ms depuis le chargement': e.t, événement: e.evt, détail: e.detail })));
      return j;
    },

    apercu() {
      const j = preview.journal();
      if (!j.length) { console.log('[tse] aucun aperçu enregistré — survolez une carte.'); return j; }
      console.table(j.map(e => ({ 'ms depuis l\'injection': e.t, événement: e.evt, détail: e.detail })));
      return j;
    },

    bascules() {
      const vivants = [];
      for (const login of [...basculements.keys()]) {
        const b = basculementFrais(login);
        if (b) vivants.push({ chaîne: login, 'passée sur': b.libelle || b.vers,
                              canonique: b.vers,
                              'il y a (s)': Math.round((Date.now() - b.ts) / 1000) });
      }
      if (!vivants.length) {
        console.log('[tse] aucun basculement de catégorie dans les dix dernières minutes.');
        return vivants;
      }
      console.table(vivants);
      return vivants;
    },

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
          rank: i + 1, category: c.display, canonique: c.name, viewers: c.viewers
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

    diagnose() {
      const report = runDiagnostics();
      logDiagnostics(report);
      const broken = hasCriticalBreakage(report);
      console[broken ? 'warn' : 'log'](broken ? S.consoleHealthBroken : S.consoleHealthAllOk);
      return report;
    }
  };

  tseApi.scores.raw = () => buildScoresReport();

  tseApi.subs.refresh = () => subsPage.refresh(true);

  tseApi.rescan = () => { invalidateAndRescan(); };

  try {
    Object.defineProperty(window, 'tse', {
      value: Object.freeze(tseApi),
      writable: false,
      configurable: false
    });
  } catch {

  }

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

    card.querySelector('[class*="promoted-followed-card__content"] p[title]') ||
    card.querySelector('[class*="promoted-followed-card__content"] p') ||
    card.querySelector('.side-nav-card__metadata p');

  const getCardCategory = (card) => {
    const el = cardCategoryEl(card);
    if (!el) return null;
    return (el.getAttribute('title') || el.textContent || '').trim() || null;
  };

  const renderCategory = (card, name, login) => {
    if (!name) return;
    const el = cardCategoryEl(card);
    if (!el) return;
    const cur = (el.getAttribute('title') || el.textContent || '').trim();

    if (login && cur.toLowerCase() === login) return;

    if (el.hasAttribute('title') && (el.getAttribute('title') || '').trim() !== name) {
      el.setAttribute('title', name);
    }

    if (PLUS_RE_PRESENT.test(el.textContent || '')) return;
    if ((el.textContent || '').trim() !== name) setText(el, name);
  };

  const detectSidebarCollapsed = () => !!document.querySelector(
    '.side-nav--collapsed, [data-a-target="side-nav-bar-collapsed"]'
  );

  let sidebarCollapsed = false;
  const refreshSidebarCollapsed = () => { sidebarCollapsed = detectSidebarCollapsed(); };

  const isCardOffline = (card) => {

    if (DOM.offlineRe.test(card.textContent || '')) return true;

    if (card.querySelector('.side-nav-card__avatar--offline')) return true;

    if (sidebarCollapsed) return false;

    return !card.querySelector(DOM.liveIndicator);
  };

  const updateFreshness = (card) => {
    const ts = card.dataset.tseStartedAt;
    if (!ts) { card.classList.remove('tse-fresh'); return; }
    const ageMin = (Date.now() - new Date(ts).getTime()) / 60_000;
    card.classList.toggle('tse-fresh', ageMin >= 0 && ageMin < CFG.FRESH_MAX_MIN);
  };

  const subPhase = (login) => {
    let h = 0;
    for (let i = 0; i < login.length; i++) h = (h * 31 + login.charCodeAt(i)) % 9973;
    return h % 12;
  };

  const markSubPart = (card, abonne, etait, classe, trouver) => {
    if (!abonne) {

      if (!etait) return;
      for (const el of card.querySelectorAll('.' + classe)) el.classList.remove(classe);
      return;
    }

    if (card.querySelector('.' + classe)) return;
    const cible = trouver(card);
    if (cible) cible.classList.add(classe);
  };

  const applySubStyle = (card, login) => {
    const abonne = subs.isSub(login);
    const etait = card.classList.contains('tse-sub');
    if (etait !== abonne) card.classList.toggle('tse-sub', abonne);
    markSubPart(card, abonne, etait, 'tse-sub-avatar', avatarOf);
    markSubPart(card, abonne, etait, 'tse-sub-cat', cardCategoryEl);
    if (!abonne) {
      if (card.style.getPropertyValue('--tse-sub-phase')) {
        card.style.removeProperty('--tse-sub-phase');
      }
      return;
    }
    const phase = String(subPhase(login));
    if (card.style.getPropertyValue('--tse-sub-phase') !== phase) {
      card.style.setProperty('--tse-sub-phase', phase);
    }

  };

  const applyCardVisibility = (card) => {
    if (card.dataset.tseOffline === 'true') {
      card.style.display = '';
      return;
    }

    if (card.dataset.tseGlobal === 'true') {
      card.style.display = '';
      return;
    }
    const catFilter  = state.categoryFilter;
    const langFilter = state.languageFilter;
    if (!catFilter && !langFilter) {
      card.style.display = '';
      return;
    }

    if (sidebarCollapsed) {
      card.style.display = '';
      return;
    }

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

      const langs = card.dataset.tseLangs;
      if (langs !== undefined && !langs.includes('|' + langFilter + '|')) {
        visible = false;
      }
    }
    card.style.display = visible ? '' : 'none';
  };

  const PLUS_RE_ELEMENT  = /^\+\s*(\d+)$/;
  const PLUS_RE_TRAILING = /(\s+)\+\s*(\d+)\s*$/;

  const PLUS_RE_PRESENT  = /\+\s*\d/;

  const clearCollabBadge = (card) => {
    const avatar = avatarOf(card);
    if (!avatar) return;
    avatar.querySelector(':scope > .tse-collab-badge')?.remove();
    avatar.classList.remove('tse-collab-host');
  };

  const applyCollabBadge = (card) => {

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

  const nativeViewersEl = (card) =>
    card.querySelector('.side-nav-card__live-status [aria-hidden="true"]:not(.tse-viewers)') ||
    card.querySelector('[data-a-target="side-nav-live-status"] [aria-hidden="true"]:not(.tse-viewers)');

  const viewerFormatters = new Map();
  const viewerFormatter = () => {
    const key = `${S.locale}|${LANG}`;
    let f = viewerFormatters.get(key);
    if (!f) {

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

    if (card.dataset.tseViewers !== String(shown)) {
      card.dataset.tseViewers = String(shown);
    }
  };

  const removeViewers = (card) => {
    delete card.dataset.tseViewers;
    card.querySelector('.tse-viewers')?.remove();
  };

  const getCardViewersText = (card) => {
    const own = card.querySelector('.tse-viewers');
    const el = own || nativeViewersEl(card);
    if (!el) return null;
    return (el.textContent || '').replace(/\s+/g, ' ').trim() || null;
  };

  const getCardViewers = (card) => {
    const n = parseInt(card.dataset.tseViewers, 10);
    if (Number.isFinite(n)) return n;
    return parseViewerCount(getCardViewersText(card));
  };

  const markExtraRows = (card) => {
    const link = card.querySelector('a.side-nav-card__link, a[data-a-target="side-nav-card"]');
    if (!link) return;

    const metadata = link.querySelector(':scope > * [data-a-target="side-nav-card-metadata"]');
    if (!metadata) return;
    const mainBlock = [...link.children].find(c => c.contains(metadata));
    if (!mainBlock) return;

    const metadataCell = [...mainBlock.children].find(c => c.contains(metadata));
    if (!metadataCell) return;

    const collected = [];
    let after = false;
    for (const child of mainBlock.children) {
      if (!after) {
        if (child === metadataCell) after = true;
        continue;
      }

      if (child.querySelector?.('.side-nav-card__link__tooltip-arrow')) {
        if (child.dataset.tseExtraRow) delete child.dataset.tseExtraRow;
        continue;
      }
      if (child.dataset.tseExtraRow !== 'true') {
        child.dataset.tseExtraRow = 'true';
      }

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

  const buildThumbUrl = (login) =>
    `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}` +
    `-${CFG.PREVIEW_THUMB_CDN_W}x${CFG.PREVIEW_THUMB_CDN_H}.jpg` +
    `?_=${Math.floor(Date.now() / CFG.PREVIEW_THUMB_CACHE_MS)}`;

  const thumbPreload = (() => {
    const done = new Set();
    let bucket = null;
    let inFlight = 0;

    const currentBucket = () => Math.floor(Date.now() / CFG.PREVIEW_THUMB_CACHE_MS);

    const sync = () => {
      const b = currentBucket();
      if (b !== bucket) { bucket = b; done.clear(); }
      return b;
    };

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

    const candidates = () => {
      const root = document.querySelector(DOM.sidebarRoot);
      if (!root) return [];
      const out = [];
      const seen = new Set();
      for (const card of root.querySelectorAll('.side-nav-card')) {
        const login = card.dataset.tseLogin;
        if (!login || seen.has(login) || done.has(login)) continue;

        if (card.dataset.tseOffline === 'true') continue;
        if (isCardOffline(card)) continue;
        seen.add(login);
        out.push(login);
        if (out.length >= CFG.PREVIEW_PRELOAD_MAX) break;
      }
      return out;
    };

    const fetchOne = (login) => {

      done.add(login);
      inFlight++;

      const img = document.createElement('img');
      try { img.fetchPriority = 'low'; } catch {   }
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

        if (blocked() || currentBucket() !== b) return;
        fetchOne(queue[i++]);
      }
    }

    return {

      tick() { if (CFG.PREVIEW_PRELOAD_ENABLED) pump(); },

      markDone(login) { if (login) { sync(); done.add(login); } }
    };
  })();

  const preview = (() => {
    let el = null;
    let iframeTimer = null;
    let iframeLoadTimer = null;
    let revealTimer = null;
    let gateTimer = null;

    let journalApercu = [];
    let revealCleanup = null;
    let flagRemoveTimer = null;
    let currentLogin = null;
    let currentCard = null;

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

    const fetchPreviewMeta = async (login) => {
      const hit = metaCache.get(login);
      if (hit && Date.now() - hit.ts < META_TTL) {
        if (hit.offline) return { offline: true };
        return { title: hit.title, ccl: hit.ccl, id: hit.id, costreamOrganizer: hit.costreamOrganizer };
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

        metaCache.set(login, { offline: true, ts: Date.now() });
        return { offline: true };
      }
      const title = stream.title || null;

      const labels = stream.contentClassificationLabels;
      const ccl = (Array.isArray(labels) ? labels : [])
        .map(l => (l && typeof l.id === 'string') ? l.id : null)
        .filter(Boolean);

      const id = user?.id ?? null;

      const org = stream.costreamDetails?.organizer;
      const costreamOrganizer = org && org.id
        ? { id: org.id, login: (org.login || '').toLowerCase(), name: (org.displayName || '').trim() || null }
        : null;
      metaCache.set(login, { title, ccl, id, costreamOrganizer, ts: Date.now() });
      return { title, ccl, id, costreamOrganizer };
    };

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

    const getCostreamInfo = (card) => {
      if (card.querySelector('[class*="iconContainer--secondary"]')) {
        return { role: 'host', host: null };
      }
      if (!card.querySelector('[class*="iconContainer--primary"]')) {
        return { role: null, host: null };
      }

      const img = card.querySelector(DOM.altCostreamHostSelector);
      if (!img) return { role: 'participant', host: null };
      const m = DOM.costreamHostRe.exec((img.getAttribute('alt') || '').trim());
      if (!m) return { role: 'participant', host: null };
      const login = m[1].toLowerCase();
      if (RESERVED.test(login)) return { role: 'participant', host: null };
      return { role: 'participant', host: login };
    };

    const getSquadInfo = (card) => {
      const miniWrap = card.querySelector('.primary-with-small-avatar__mini-avatar');
      if (!miniWrap) return null;
      const miniImg = miniWrap.querySelector('img[alt]');
      const guest = (miniImg?.getAttribute('alt') || '').trim();
      if (!guest) return null;

      const allP = card.querySelectorAll('p');
      let total = 1;
      for (const p of allP) {
        const m = DOM.guestsTotalRe.exec(p.textContent || '');
        if (m) { total = parseInt(m[1], 10) || 1; break; }
      }
      return { guest, otherCount: Math.max(0, total - 1) };
    };

    const getSponsorInfo = (card) => {
      if (!card.querySelector('a[class*="--promoted-followed"]')) return null;
      const logoImg = card.querySelector(DOM.altLogoSelector);
      if (!logoImg) return null;
      const logoUrl = logoImg.getAttribute('src') || '';

      let name = '';
      const m = DOM.sponsorLogoRe.exec((logoImg.getAttribute('alt') || '').trim());
      if (m) name = m[1].trim();
      if (!name) {

        const bottomPs = card.querySelectorAll('.side-nav-card-promoted-bottom p');
        const lastP = bottomPs[bottomPs.length - 1];
        name = (lastP?.getAttribute('title') || lastP?.textContent || '').trim();
      }
      if (!name) return null;

      const rawColor = (logoImg.parentElement?.style?.backgroundColor || '').trim();
      const bgColor = /^(?:rgba?|hsla?)\([^)]+\)$|^#[0-9a-f]{3,8}$|^transparent$/i.test(rawColor)
        ? rawColor
        : 'transparent';
      return { name, logoUrl, bgColor };
    };

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

    const positionPopup = (card) => {
      if (!el) return;

      if (!card || !card.isConnected) { close(); return; }
      const cardRect = card.getBoundingClientRect();
      const margin = 8;
      const popupWidth = el.offsetWidth;
      const popupHeight = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = cardRect.right + margin;
      if (left + popupWidth > vw - margin) {
        left = cardRect.left - popupWidth - margin;
      }
      if (left < margin) left = margin;

      let top = cardRect.top;
      if (top + popupHeight > vh - margin) {
        top = vh - popupHeight - margin;
      }
      if (top < margin) top = margin;

      el.style.left = `${left}px`;
      el.style.top  = `${top}px`;
    };

    const badgeNoeud = (modClass, contenu, lead = null, trail = null) => {
      const badge = document.createElement('span');
      badge.className = `tse-preview__badge ${modClass}`;
      if (lead) badge.appendChild(lead);
      const texte = document.createElement('span');
      texte.className = 'tse-preview__badge-text';

      if (typeof contenu === 'string') texte.textContent = contenu;
      else if (contenu) texte.appendChild(contenu);
      badge.appendChild(texte);
      if (trail) badge.appendChild(trail);
      return badge;
    };

    const liveWithBadgeNoeud = (login, squadInfo, channelId) => {
      const mates = getGuestStarMates(login, channelId);
      if (mates.length) {

        const noms = mates
          .map(m => displayNameFor(m.login, m.name).trim())
          .filter(Boolean);
        if (!noms.length) return null;
        return badgeNoeud('tse-preview__badge--squad',
          phraseAvecFente(S.uiBadgeLiveWith(FENTE, 0), () => nomsEnGras(noms)));
      }
      if (squadInfo) {
        return badgeNoeud('tse-preview__badge--squad',
          phraseAvecFente(S.uiBadgeLiveWith(FENTE, squadInfo.otherCount),
                          () => nomsEnGras([squadInfo.guest])));
      }
      return null;
    };

    const updateLiveWithBadge = (login, squadInfo, channelId) => {
      if (!el || currentLogin !== login) return;
      const badge = liveWithBadgeNoeud(login, squadInfo, channelId);
      if (!badge) return;
      const body = el.querySelector('.tse-preview__body');
      if (!body) return;
      let container = el.querySelector('.tse-preview__badges');
      if (!container) {
        container = document.createElement('div');
        container.className = 'tse-preview__badges';
        body.appendChild(container);
      }
      const existing = container.querySelector('.tse-preview__badge--squad');
      if (existing) existing.replaceWith(badge);
      else container.appendChild(badge);
      if (currentCard) positionPopup(currentCard);
    };

    const updateCclBadge = (login, ccl) => {
      if (!el || currentLogin !== login) return;
      if (!Array.isArray(ccl) || !ccl.length) return;
      if (el.querySelector('.tse-preview__badge--ccl')) return;
      const noms = [];
      for (const id of ccl) {
        const nom = S['uiCcl' + id];
        if (nom && !noms.includes(nom)) noms.push(nom);
      }
      const texte = noms.length ? noms.join(' · ') : S.uiCclGeneric;
      const body = el.querySelector('.tse-preview__body');
      if (!body) return;
      let container = el.querySelector('.tse-preview__badges');
      if (!container) {
        container = document.createElement('div');
        container.className = 'tse-preview__badges';
        body.appendChild(container);
      }

      const marque = () => noeudStatique(
        '<span class="tse-preview__badge-mark" aria-hidden="true">⚠️</span>');
      container.prepend(badgeNoeud('tse-preview__badge--ccl', texte, marque(), marque()));
      if (currentCard) positionPopup(currentCard);
    };

    const costreamBadgeNoeud = (info) => {
      if (info?.role === 'participant' && info.host) {
        const nom = displayNameFor(info.host, info.hostName);
        return badgeNoeud('tse-preview__badge--costream',
          phraseAvecFente(S.uiBadgeCostreamOf(FENTE), () => nomsEnGras([nom])));
      }
      if (info?.role === 'host') {
        return badgeNoeud('tse-preview__badge--costream', S.uiBadgeCostreamHost);
      }
      return null;
    };

    const resolveCostreamInfo = (domInfo, organizer, channelId) => {
      const role = domInfo?.role || null;
      if (role === 'host') return domInfo;
      if (role === 'participant' && domInfo.host) return domInfo;
      if (organizer && organizer.login) {
        const isSelf = channelId && organizer.id === channelId;
        if (role === 'participant') {

          return isSelf ? domInfo : { role: 'participant', host: organizer.login, hostName: organizer.name };
        }

        return isSelf
          ? { role: 'host', host: null }
          : { role: 'participant', host: organizer.login, hostName: organizer.name };
      }
      return domInfo || { role: null, host: null };
    };

    const updateCostreamBadge = (login, domInfo, channelId, organizer) => {
      if (!el || currentLogin !== login) return;
      const badge = costreamBadgeNoeud(resolveCostreamInfo(domInfo, organizer, channelId));
      if (!badge) return;
      const body = el.querySelector('.tse-preview__body');
      if (!body) return;
      let container = el.querySelector('.tse-preview__badges');
      if (!container) {
        container = document.createElement('div');
        container.className = 'tse-preview__badges';
        body.appendChild(container);
      }
      const existing = container.querySelector('.tse-preview__badge--costream');
      if (existing) { existing.replaceWith(badge); }
      else {

        const anchor = container.querySelector('.tse-preview__badge--squad, .tse-preview__badge--sponsor');
        if (anchor) anchor.before(badge);
        else container.appendChild(badge);
      }
      if (currentCard) positionPopup(currentCard);
    };

    const renderPopup = (login, title, extraRows, costreamInfo, costreamMates, squadInfo, sponsorInfo) => {
      const badges = (extraRows || []).map(r => {
        const cls = r.type === 'hype' ? 'tse-preview__badge--hype'
                  : r.type === 'discount' ? 'tse-preview__badge--discount'
                  : '';
        return badgeNoeud(cls, r.text);
      });

      const bascule = basculementFrais(login);
      if (bascule) {
        badges.unshift(badgeNoeud('tse-preview__badge--switch',
          phraseAvecFente(S.uiBadgeCategorySwitch(FENTE),
                          () => nomsEnGras([bascule.libelle || bascule.vers]))));
      }

      const moisAbo = subs.monthsFor(login);
      if (moisAbo > 0) {
        if (subs.isSub(login)) {
          badges.push(badgeNoeud('tse-preview__badge--sub', S.uiBadgeSubMonths(moisAbo)));
        } else if (subs.wasSub(login)) {
          badges.push(badgeNoeud('tse-preview__badge--exsub', S.uiBadgeExSubMonths(moisAbo)));
        }
      }

      let costreamBadge = costreamBadgeNoeud(costreamInfo);
      if (!costreamBadge && costreamMates && costreamMates.length) {
        const noms = costreamMates.map(l => displayNameFor(l));
        costreamBadge = badgeNoeud('tse-preview__badge--costream',
          phraseAvecFente(S.uiBadgeCostreamWithNames(FENTE), () => nomsEnGras(noms)));
      }
      if (costreamBadge) badges.push(costreamBadge);

      const liveWithBadge = liveWithBadgeNoeud(login, squadInfo);
      if (liveWithBadge) badges.push(liveWithBadge);

      if (sponsorInfo) {

        let logo = null;
        if (sponsorInfo.logoUrl) {
          logo = document.createElement('span');
          logo.className = 'tse-preview__sponsor-logo';
          logo.style.background = sponsorInfo.bgColor;
          const img = document.createElement('img');
          img.setAttribute('src', sponsorInfo.logoUrl);
          img.setAttribute('alt', '');
          logo.appendChild(img);
        }
        badges.push(badgeNoeud(
          'tse-preview__badge--sponsor',
          phraseAvecFente(S.uiBadgeSponsoredBy(FENTE), () => nomsEnGras([sponsorInfo.name])),
          logo
        ));
      }

      el.replaceChildren(noeudStatique(
        '<div class="tse-preview__thumb-wrap">'
        + '<img class="tse-preview__thumb" alt="">'
        + '<div class="tse-preview__thumb-placeholder" style="display:none"></div>'
        + '</div>'
        + '<div class="tse-preview__body">'
        + '<p class="tse-preview__title"></p>'
        + '</div>'));

      const thumbImg = el.querySelector('.tse-preview__thumb');
      const placeholder = el.querySelector('.tse-preview__thumb-placeholder');
      thumbImg.setAttribute('src', buildThumbUrl(login));
      placeholder.textContent = S.uiPreviewUnavailable;

      const titreEl = el.querySelector('.tse-preview__title');
      titreEl.textContent = title || S.uiPreviewLoadingTitle;

      if (!title) titreEl.style.color = 'rgba(255,255,255,0.5)';

      if (badges.length) {
        const zone = document.createElement('div');
        zone.className = 'tse-preview__badges';
        for (const b of badges) zone.appendChild(b);
        el.querySelector('.tse-preview__body').appendChild(zone);
      }

      if (thumbImg && placeholder) {
        thumbImg.addEventListener('error', () => {
          thumbImg.style.display = 'none';
          placeholder.style.display = 'flex';
        }, { once: true });

        const showThumb = () => { thumbImg.dataset.tseLoaded = 'true'; };
        if (thumbImg.complete && thumbImg.naturalWidth > 0) showThumb();
        else thumbImg.addEventListener('load', showThumb, { once: true });
      }
    };

    const injectIframe = (login) => {
      if (!el || currentLogin !== login) return;
      const wrap = el.querySelector('.tse-preview__thumb-wrap');
      if (!wrap || wrap.querySelector('iframe')) return;

      const iframe = document.createElement('iframe');
      iframe.className = 'tse-preview__iframe';
      iframe.src = buildIframeUrl(login);
      iframe.setAttribute('allow', 'autoplay; encrypted-media');

      let gateVu = false;

      const t0 = Date.now();
      const noter = (evt, detail = '') => {
        journalApercu.push({ t: Date.now() - t0, evt, detail });
        if (journalApercu.length > 24) journalApercu.shift();
      };
      journalApercu = [];
      noter('iframe', login);

      const reveal = () => {
        if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
        if (gateTimer) { clearTimeout(gateTimer); gateTimer = null; }
        if (revealCleanup) { revealCleanup(); revealCleanup = null; }

        if (currentLogin !== login || !iframe.isConnected) return;
        iframe.dataset.tseLoaded = 'true';
        noter('devoilee');
      };

      const rendreLaMain = () => {
        gateTimer = null;
        if (iframe.dataset.tseLoaded === 'true' || !iframe.isConnected) return;
        if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
        if (revealCleanup) { revealCleanup(); revealCleanup = null; }
        noter('retour-vignette');
        try { iframe.src = 'about:blank'; } catch {   }
        iframe.remove();
      };

      const onMessage = (e) => {

        if (e.source !== iframe.contentWindow) return;
        if (e.data?.tse === TSE_PREVIEW_HELLO_MSG) { noter('pont'); return; }
        if (e.data?.tse === TSE_PREVIEW_FIRST_FRAME_MSG) {
          noter('premiere-image');
          reveal();
          return;
        }
        if (e.data?.tse !== TSE_PREVIEW_GATE_MSG) return;
        noter('modale');

        gateVu = true;
        if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
        if (!gateTimer) gateTimer = setTimeout(rendreLaMain, CFG.PREVIEW_GATE_TIMEOUT_MS);
      };
      window.addEventListener('message', onMessage);
      revealCleanup = () => window.removeEventListener('message', onMessage);

      iframe.addEventListener('load', () => {
        if (iframeLoadTimer) { clearTimeout(iframeLoadTimer); iframeLoadTimer = null; }
        if (currentLogin !== login || !iframe.isConnected) return;

        if (gateVu || gateTimer) return;
        revealTimer = setTimeout(reveal, CFG.PREVIEW_REVEAL_FALLBACK_MS);
      }, { once: true });

      iframeLoadTimer = setTimeout(() => {
        iframeLoadTimer = null;
        if (iframe.dataset.tseLoaded !== 'true' && iframe.isConnected) {

          try { iframe.src = 'about:blank'; } catch {   }
          iframe.remove();
        }
      }, CFG.PREVIEW_IFRAME_TIMEOUT_MS);

      wrap.appendChild(iframe);
    };

    const removeIframe = () => {
      if (iframeTimer) { clearTimeout(iframeTimer); iframeTimer = null; }
      if (iframeLoadTimer) { clearTimeout(iframeLoadTimer); iframeLoadTimer = null; }
      if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
      if (gateTimer) { clearTimeout(gateTimer); gateTimer = null; }

      if (revealCleanup) { revealCleanup(); revealCleanup = null; }
      if (!el) return;
      const iframe = el.querySelector('.tse-preview__iframe');
      if (iframe) {

        try { iframe.src = 'about:blank'; } catch {   }
        iframe.remove();
      }
    };

    const close = () => {
      removeIframe();
      currentLogin = null;
      currentCard = null;
      if (el) {
        el.dataset.tseVisible = 'false';

      }

      if (flagRemoveTimer) clearTimeout(flagRemoveTimer);
      flagRemoveTimer = setTimeout(() => {
        flagRemoveTimer = null;
        document.body.classList.remove('tse-preview-active');
      }, 500);
    };

    const open = (card) => {

      let login = card.dataset.tseLogin;
      if (!login) {
        const link = card.querySelector(DOM.cardLinkSelector);
        login = loginFromHref(link?.getAttribute('href'));
      }
      if (!login) return;

      if (card.dataset.tseOffline === 'true') return;

      currentLogin = login;
      currentCard = card;

      thumbPreload.markDone(login);
      ensureEl();

      const extraRows = (() => {
        try { return JSON.parse(card.dataset.tseExtraRows || '[]'); }
        catch { return []; }
      })();

      const costreamInfo = getCostreamInfo(card);

      const mates = costreamInfo.role ? [] : getCostreamMates(card);

      const squadInfo = getSquadInfo(card);

      const sponsorInfo = getSponsorInfo(card);

      renderPopup(login, null, extraRows, costreamInfo, mates, squadInfo, sponsorInfo);
      el.dataset.tseVisible = 'true';

      if (flagRemoveTimer) { clearTimeout(flagRemoveTimer); flagRemoveTimer = null; }
      document.body.classList.add('tse-preview-active');
      positionPopup(card);

      const requestLiveWith = (id) => {
        if (!id) return;
        requestGuestStar(id).then(() => updateLiveWithBadge(login, squadInfo, id));
      };
      requestLiveWith(getChannelId(login));

      fetchPreviewMeta(login).then(meta => {
        if (currentLogin !== login || !el) return;
        if (!meta) return;

        if (meta.offline) {
          card.dataset.tseGqlOffline = 'true';
          card.dataset.tseOffline = 'true';
          cache.delete(login);
          close();
          return;
        }

        if (meta.title) {
          const titleEl = el.querySelector('.tse-preview__title');
          if (titleEl) {
            titleEl.textContent = meta.title;
            titleEl.style.color = '';
          }

          if (currentCard) positionPopup(currentCard);
        }

        updateCclBadge(login, meta.ccl);

        if (meta.id) requestLiveWith(meta.id);

        updateCostreamBadge(login, costreamInfo, meta.id || getChannelId(login), meta.costreamOrganizer);
      });

      iframeTimer = setTimeout(() => {
        iframeTimer = null;
        injectIframe(login);
      }, CFG.PREVIEW_IFRAME_DELAY);
    };

    let lastMouseX = -1;
    let lastMouseY = -1;

    const resolveCard = (node) => {
      let card = node.closest('.side-nav-card');
      if (!card) return null;
      for (let p = card.parentElement; p; p = p.parentElement) {
        if (p.classList.contains('side-nav-card')) card = p;
      }
      return card;
    };

    const init = () => {

      document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }, { passive: true, capture: true });

      document.addEventListener('mouseenter', (e) => {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;
        const card = resolveCard(t);
        if (!card) return;

        if (t !== card) return;
        if (card === currentCard) return;

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

        requestAnimationFrame(() => {
          if (card !== currentCard) return;
          const under = document.elementFromPoint(lastMouseX, lastMouseY);
          if (under && card.contains(under)) {

            return;
          }
          close();
        });
      }, true);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) close();
      });
    };

    return {
      init,

      closeIfDetached: () => { if (currentCard && !currentCard.isConnected) close(); },

      prune: () => pruneCache(metaCache, META_TTL, CFG.META_CACHE_MAX),

      journal: () => journalApercu.slice()
    };
  })();

  let offlineTransitionsThisScan = 0;

  const applyChannelData = (card, data) => {
    if (data === UPTIME_UNKNOWN) {

      applyCardVisibility(card);
      return;
    }

    const stream = data.stream;

    if (stream?.createdAt) {

      liveLag.observe(card, stream);
      card.dataset.tseStartedAt = stream.createdAt;
      card.dataset.tseOfflineHits = '0';
      delete card.dataset.tseOfflineTs;

      delete card.dataset.tseGqlOffline;
      delete card.dataset.tseOffline;
      renderUptime(card, stream.createdAt);
      updateFreshness(card);

      renderViewers(card, data.viewers, getCollabViewers(data.id));
      if (data.game) {

        card.dataset.tseCategory = data.game;
        card.dataset.tseCategoryLabel = data.gameLabel || data.game;
        renderCategory(card, data.gameLabel || data.game, card.dataset.tseLogin);
      }
    } else {

      const counted = card.dataset.tseOfflineTs === String(data.ts);
      let hits = parseInt(card.dataset.tseOfflineHits, 10) || 0;
      if (!counted) {
        hits += 1;
        card.dataset.tseOfflineHits = String(hits);
        card.dataset.tseOfflineTs = String(data.ts);
      }
      if (hits >= CFG.OFFLINE_CONFIRM && card.dataset.tseGqlOffline !== 'true') {

        removeUptime(card);
        removeViewers(card);
        card.dataset.tseGqlOffline = 'true';
        card.dataset.tseOffline = 'true';

        loadingOverlay.bumpActivity();
        scheduleScan();
      }
    }
    applyCardVisibility(card);
  };

  async function processCard(card) {
    if (isCardOffline(card)) {

      if (card.dataset.tseOffline !== 'true') offlineTransitionsThisScan++;
      card.dataset.tseOffline = 'true';

      removeViewers(card);
      return;
    }

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

    if (card.dataset.tseLogin && card.dataset.tseLogin !== login) {
      delete card.dataset.tseStartedAt;
      delete card.dataset.tseOfflineHits;
      delete card.dataset.tseOfflineTs;
      delete card.dataset.tseGqlOffline;
      delete card.dataset.tseCategory;
      delete card.dataset.tseCategoryLabel;
      delete card.dataset.tseLangs;
      removeViewers(card);

    }
    card.dataset.tseLogin = login;
    applySubStyle(card, login);

    if (!card.dataset.tseCategory) {
      const category = getCardCategory(card);

      if (category) {
        card.dataset.tseCategory = category;
        card.dataset.tseCategoryLabel = category;
      }
    }

    const cached = getFreshChannel(login);
    if (cached) { applyChannelData(card, cached); return; }

    const seed = globalSeedFor(card);
    if (seed) applyChannelData(card, seed);

    const data = await fetchChannel(login);
    if (!document.contains(card)) return;

    if (card.dataset.tseLogin !== login) return;
    applyChannelData(card, data);
  }

  let lastFollowedCount = -1;

  function hideShowLessButton() {
    const section = followedSection();
    if (!section) return;

    section.querySelectorAll(DOM.showLessStableSelector).forEach(btn => {
      if (!btn.classList.contains('tse-show-less-hidden')) {
        btn.classList.add('tse-show-less-hidden');
      }
    });

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

  function updateSectionsVisibility() {
    const sections = document.querySelectorAll('#side-nav .side-nav-section');

    const filterActive = !sidebarCollapsed &&
      (state.categoryFilter !== null || state.languageFilter !== null);

    const hideOthers = filterActive || state.globalMode;

    sections.forEach(section => {

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

  const FILTER_ID = 'tse-filter';
  const CAT_DD_ID  = 'tse-cat-dd';
  const LANG_DD_ID = 'tse-lang-dd';

  const getAllLabel = () => S.uiFilterAllCategories;

  function closeMenus(except) {
    document.querySelectorAll('.tse-dd.tse-open').forEach(dd => {
      if (dd === except) return;
      dd.classList.remove('tse-open');
      const btn = dd.querySelector('.tse-dd-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  let ddBound = false;
  function bindDropdownsGlobal() {
    if (ddBound) return;
    ddBound = true;

    document.addEventListener('click', (e) => closeMenus(e.target.closest('.tse-dd')), true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  }

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

  const ddSquelette = (id, facet, modifier, ariaLabel, fabriquerCourant) => {
    const frag = noeudStatique(
      '<div class="tse-dd">'
      + '<button type="button" class="tse-dd-btn" aria-haspopup="listbox" aria-expanded="false">'
      + '<span class="tse-dd-current"></span>'
      + '<span class="tse-dd-caret" aria-hidden="true"></span>'
      + '</button>'
      + '<div class="tse-dd-menu" role="listbox"></div>'
      + '</div>');
    const dd = frag.firstElementChild;
    dd.id = id;
    dd.classList.add(modifier);
    dd.dataset.facet = facet;
    dd.querySelector('.tse-dd-btn').setAttribute('aria-label', ariaLabel);
    dd.querySelector('.tse-dd-current').appendChild(fabriquerCourant());
    return frag;
  };

  function ensureFilterBar() {
    if (document.getElementById(FILTER_ID)) return;

    const sideNav = document.querySelector(DOM.sidebarRoot);
    if (!sideNav) return;

    const section = followedSection();
    if (!section || !sideNav.contains(section)) return;

    const wrap = document.createElement('div');
    wrap.id = FILTER_ID;
    wrap.className = 'tse-filter';
    wrap.replaceChildren(noeudStatique(
      '<div class="tse-filter-row">'
      + '<div class="tse-filter-field tse-filter-field--cat"></div>'
      + '<div class="tse-filter-field tse-filter-field--lang"></div>'
      + '</div>'));
    wrap.querySelector('.tse-filter-field--cat').appendChild(
      ddSquelette(CAT_DD_ID, 'category', 'tse-dd--cat', S.uiFilterAriaLabel,
                  () => document.createTextNode(getAllLabel())));
    wrap.querySelector('.tse-filter-field--lang').appendChild(
      ddSquelette(LANG_DD_ID, 'language', 'tse-dd--lang', S.uiFilterLangAriaLabel,
                  () => noeudStatique(GLOBE_MARKUP)));
    section.parentElement.insertBefore(wrap, section);

    wireDropdown(wrap.querySelector(`#${CAT_DD_ID}`));
    wireDropdown(wrap.querySelector(`#${LANG_DD_ID}`));
    bindDropdownsGlobal();
  }

  function onFilterChange(facet, value) {
    const cur = facet === 'category' ? state.categoryFilter : state.languageFilter;
    if (value === cur) return;
    if (facet === 'category') {
      state.categoryFilter = value;
      state.filterDriver = value ? 'category' : (state.languageFilter ? 'language' : null);

      if (state.globalMode) {
        globalChannels.tick();
        if (!globalChannels.top(1).length) loadingOverlay.startCycle('changement de catégorie');
        scheduleScan();
      }
    } else {
      state.languageFilter = value;
      state.filterDriver = value ? 'language' : (state.categoryFilter ? 'category' : null);

      if (state.globalMode) {
        globalChannels.tick();
        if (!globalChannels.top(1).length) loadingOverlay.startCycle('changement de langue');
        scheduleScan();
      }
    }
    recomputeFilters();
  }

  const SORT_ROW_ID = 'tse-sort-row';

  const SVG_EYE =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 5C6.5 5 2.7 9.6 1.5 12c1.2 2.4 5 7 10.5 7s9.3-4.6 10.5-7C21.3 9.6 17.5 5 12 5Zm0 12c-4.1 0-7.3-3.3-8.5-5 1.2-1.7 4.4-5 8.5-5s7.3 3.3 8.5 5c-1.2 1.7-4.4 5-8.5 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>' +
    '</svg>';
  const SVG_CLOCK =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7Z"/>' +
    '</svg>';

  const SVG_LINK =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3-3a1 1 0 1 1 1.4 1.4l-3 3a1 1 0 0 1-1.4 0Zm-3.3 4.7a3.5 3.5 0 0 1 0-5l2.5-2.5a1 1 0 0 1 1.4 1.4L8.7 14.5a1.5 1.5 0 1 0 2.1 2.1l2.5-2.5a1 1 0 0 1 1.4 1.4l-2.5 2.5a3.5 3.5 0 0 1-5 0Zm10-10a3.5 3.5 0 0 1 0 5L14.8 15.6a1 1 0 0 1-1.4-1.4l2.5-2.5a1.5 1.5 0 1 0-2.1-2.1L11.3 12a1 1 0 0 1-1.4-1.4l2.5-2.5a3.5 3.5 0 0 1 5 0Z"/>' +
    '</svg>';

  const SVG_STAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>' +
    '</svg>';

  const SVG_ALPHA =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M3.5 16h2.3l.5-1.5h2.6L9.4 16h2.3L8.9 8H6.3L3.5 16Zm3.5-6.7.9 2.9H6.1l.9-2.9ZM17 5v10.6l1.8-1.8 1.4 1.4-4.2 4.2-4.2-4.2 1.4-1.4 1.8 1.8V5h2Z"/>' +
    '</svg>';

  const SVG_GEM =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 3h9l4 5.5-8.5 12L3.5 8.5 7.5 3Z' +
    'm.8 2L6 8h3.4l1.1-3H8.3Zm4.4 0-1.1 3h2.8l-1.1-3h-.6Zm3.4 0 1.1 3H20l-2.3-3h-1.6Z' +
    'M5.9 10l5 7-2.4-7H5.9Zm4.7 0 1.4 4.2L13.4 10h-2.8Zm4.9 0-2.4 7 5-7h-2.6Z"/></svg>';

  const getSortButtons = () => [
    { mode: 'viewers',  svg: SVG_EYE,   label: S.uiSortLabelViewers  },

    { mode: 'subs',     svg: SVG_GEM,   label: S.uiSortLabelSubs     },
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

    row.replaceChildren(...getSortButtons().map(spec => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tse-sort-toggle';
      b.dataset.tseSortMode = spec.mode;
      b.setAttribute('aria-pressed', state.sortMode === spec.mode ? 'true' : 'false');
      b.setAttribute('title', spec.label);
      b.setAttribute('aria-label', spec.label);
      b.appendChild(noeudStatique(spec.svg));
      return b;
    }));
    filterBar.appendChild(row);

    const buttons = [...row.querySelectorAll('button[data-tse-sort-mode]')];

    const refreshPressed = () => {

      const parMode = new Map(getSortButtons().map(sp => [sp.mode, sp.label]));
      buttons.forEach(btn => {
        const mode = btn.dataset.tseSortMode;
        btn.setAttribute('aria-pressed', state.sortMode === mode ? 'true' : 'false');
        const libelle = parMode.get(mode);
        if (libelle && btn.getAttribute('title') !== libelle) {
          btn.setAttribute('title', libelle);
          btn.setAttribute('aria-label', libelle);
        }
      });
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.tseSortMode;
        if (btn.disabled) return;

        if (state.sortMode === mode) return;
        state.sortMode = mode;
        state.sortWish = mode;
        refreshPressed();
        applySorting();
      });
    });
  }

  const countLiveSubs = () => {
    const section = followedSection();
    if (!section) return 0;
    let n = 0;
    for (const card of section.querySelectorAll('.side-nav-card')) {
      if (card.dataset.tseOffline === 'true') continue;
      if (subs.isSub(card.dataset.tseLogin || '')) n += 1;
    }
    return n;
  };

  function updateSortButtonsState({ costreamGroups }) {
    const row = document.getElementById(SORT_ROW_ID);
    if (!row) return false;

    const nbSubs = countLiveSubs();
    const nbConnus = subs.count();

    const available = {
      viewers:  true,

      subs:     nbSubs > 0,
      popular:  true,
      uptime:   true,
      alpha:    true,
      costream: costreamGroups > 0,
    };

    let modeForced = false;
    const buttons = [...row.querySelectorAll('button[data-tse-sort-mode]')];

    if (state.sortMode !== state.sortWish && available[state.sortWish] !== false) {
      state.sortMode = state.sortWish;
      modeForced = true;
    }

    buttons.forEach(btn => {
      const mode = btn.dataset.tseSortMode;
      const ok = available[mode] !== false;
      btn.disabled = !ok;

      if (!ok && mode === 'costream') {
        btn.title = S.uiSortNoCoStreams;
      } else if (!ok && mode === 'subs') {

        btn.title = nbConnus > 0 ? S.uiSortSubsOffline : S.uiSortNoSubs;
      } else if (mode === 'subs' && nbConnus > 0) {

        btn.title = S.uiSortLabelSubsCount(nbConnus);
      } else {
        const spec = getSortButtons().find(s => s.mode === mode);
        if (spec) btn.title = spec.label;
      }

      if (mode === 'subs') {
        let pastille = btn.querySelector(':scope > .tse-sort-count');
        if (nbConnus > 0) {
          if (!pastille) {
            pastille = document.createElement('span');
            pastille.className = 'tse-sort-count';
            pastille.setAttribute('aria-hidden', 'true');
            btn.appendChild(pastille);
          }
          setText(pastille, nbConnus > 99 ? '99+' : String(nbConnus));
        } else if (pastille) {
          pastille.remove();
        }
      }

      if (!ok && state.sortMode === mode) {
        state.sortMode = 'viewers';
        modeForced = true;
      }
    });

    if (modeForced) {
      buttons.forEach(b => {
        b.setAttribute('aria-pressed', state.sortMode === b.dataset.tseSortMode ? 'true' : 'false');
      });
    }
    return modeForced;
  }

  function renameRootTitle() {
    const root = document.querySelector('#side-nav .side-nav__title h3');
    if (!root) return;

    const wanted = state.globalMode ? S.uiGlobalLabel : S.followedLabel;
    const current = (root.textContent || '').trim();
    if (current === wanted) {
      root.dataset.tseRenamed = 'true';
      return;
    }
    root.textContent = wanted;
    root.dataset.tseRenamed = 'true';
  }

  const STORIES_RE = /stories/i;
  const classOf = (el) => el?.getAttribute?.('class') || '';

  function tagStoriesRow() {
    const nav = document.querySelector(DOM.sidebarRoot);
    if (!nav) return;

    const root = nav.parentElement || nav;
    if (root.querySelector('[data-tse-stories="row"]')) return;
    let el = root.querySelector(DOM.storiesSelector);
    if (!el) return;

    while (el.parentElement && el.parentElement !== root
           && STORIES_RE.test(classOf(el.parentElement))) {
      el = el.parentElement;
    }
    if (el === nav || el.contains(nav) || el.querySelector('.side-nav-card')) return;
    el.setAttribute('data-tse-stories', 'row');
  }

  function hideNativeFollowedHeader() {
    const section = followedSection();
    if (!section) return;
    const block = section.querySelector(DOM.followedHeaderSelector);
    if (!block) return;
    if (block.getAttribute('data-tse-native-header') === 'hidden') return;
    block.setAttribute('data-tse-native-header', 'hidden');

    block.style.setProperty('display', 'none', 'important');
  }

  const byCountDesc = (counts) => (a, b) =>
    (counts.get(b) - counts.get(a)) || a.localeCompare(b, S.locale);

  function rebuildDropdown(dd, values, counts, current, disabled, kind,
                           fmt = String, libelle = String) {
    const btn  = dd.querySelector('.tse-dd-btn');
    const cur  = dd.querySelector('.tse-dd-current');
    const menu = dd.querySelector('.tse-dd-menu');

    const itemLabel = (v) => {
      if (kind === 'lang') return langIcon(v);
      const sp = document.createElement('span');
      sp.className = 'tse-dd-name';
      sp.textContent = libelle(v);
      return sp;
    };
    const allLabel = () => kind === 'lang'
      ? noeudStatique(GLOBE_MARKUP)
      : document.createTextNode(getAllLabel());
    const allTitle  = kind === 'lang' ? S.uiFilterAllLanguages : S.uiFilterAllCategories;

    const sig = `${kind}|${disabled ? 'D' : ''}|cur=${current || ''}|` +
      values.map(v => v + '>' + libelle(v) + '#' + (counts.get(v) || 0)).join('\u00A7');
    if (dd.dataset.tseSig !== sig) {
      dd.dataset.tseSig = sig;
      cur.replaceChildren(current ? itemLabel(current) : allLabel());

      const option = (valeur, selectionnee, titre, contenu) => {
        const o = document.createElement('div');
        o.className = 'tse-dd-opt';
        o.setAttribute('role', 'option');
        o.dataset.value = valeur;
        o.setAttribute('aria-selected', String(selectionnee));
        if (titre != null) o.setAttribute('title', titre);
        o.appendChild(contenu);
        return o;
      };
      const lignes = [option('', !current, allTitle, allLabel())];
      for (const v of values) {
        const o = option(v, v === current, null, itemLabel(v));
        const n = fmt(counts.get(v) || 0);

        if (n !== '') {
          const c = document.createElement('span');
          c.className = 'tse-dd-n';
          c.textContent = `${n} |`;
          o.insertBefore(c, o.firstChild);
        }
        lignes.push(o);
      }
      menu.replaceChildren(...lignes);
    }
    btn.disabled = disabled;
    const base = kind === 'lang' ? S.uiFilterLangAriaLabel : S.uiFilterAriaLabel;
    btn.setAttribute('aria-label', current ? `${base} : ${libelle(current)}` : base);
    if (disabled && dd.classList.contains('tse-open')) {
      dd.classList.remove('tse-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function recomputeFilters() {
    const catDD  = document.getElementById(CAT_DD_ID);
    const langDD = document.getElementById(LANG_DD_ID);
    if (!catDD || !langDD) return;
    const section = followedSection();
    if (!section) return;

    if (state.globalMode) {
      const cats = globalChannels.cats(CFG.GLOBAL_CATEGORIES_MAX);
      const catCount = new Map(cats.map(c => [c.name, c.viewers]));

      const langCount = globalChannels.langs();
      const langsPresent = new Set(langCount.keys());
      const Lg = state.languageFilter && langsPresent.has(state.languageFilter)
        ? state.languageFilter : null;
      state.languageFilter = Lg;

      const catLabel = new Map(cats.map(c => [c.name, c.display]));
      rebuildDropdown(catDD, cats.map(c => c.name), catCount,
                      state.categoryFilter, cats.length === 0, 'cat', formatViewers,
                      (v) => catLabel.get(v) || v);
      rebuildDropdown(langDD, [...langsPresent].sort(byCountDesc(langCount)),
                      langCount, Lg, langsPresent.size === 0, 'lang',

                      state.categoryFilter ? () => '' : String);
      const wrapG = document.getElementById(FILTER_ID);
      if (wrapG) wrapG.dataset.tseActive = (state.categoryFilter || Lg) ? 'true' : 'false';
      applyCategoryFilter();
      return;
    }

    const records = [];
    const catLabel = new Map();
    section.querySelectorAll('.side-nav-card').forEach(card => {
      if (card.dataset.tseOffline === 'true') return;
      const login = card.dataset.tseLogin;
      if (!login) return;
      const resolved = langStore.getLangs(login);
      if (resolved) card.dataset.tseLangs = resolved.length ? '|' + resolved.join('|') + '|' : '';
      const langs = (card.dataset.tseLangs || '').split('|').filter(Boolean);
      records.push({ cat: card.dataset.tseCategory || '', langs });

      if (card.dataset.tseCategory) {
        catLabel.set(card.dataset.tseCategory,
                     card.dataset.tseCategoryLabel || card.dataset.tseCategory);
      }
    });

    const allCats  = new Set(records.map(r => r.cat).filter(Boolean));
    const allLangs = new Set(records.flatMap(r => r.langs));

    let C  = state.categoryFilter && allCats.has(state.categoryFilter)  ? state.categoryFilter : null;
    let Lg = state.languageFilter && allLangs.has(state.languageFilter) ? state.languageFilter : null;
    let driver = state.filterDriver;
    if (driver === 'category' && !C)  driver = null;
    if (driver === 'language' && !Lg) driver = null;
    if (!driver) driver = C ? 'category' : (Lg ? 'language' : null);

    let catOpts = allCats, langOpts = allLangs;
    let dispC = C, dispLg = Lg, catDisabled = false, langDisabled = false;
    if (driver === 'category') {
      const ls = new Set(records.filter(r => r.cat === C).flatMap(r => r.langs));
      langOpts = ls;
      if (ls.size <= 1) {
        langDisabled = true;
        dispLg = ls.size === 1 ? [...ls][0] : null;
        Lg = null;
      } else {
        if (Lg && !ls.has(Lg)) Lg = null;
        dispLg = Lg;
      }
    } else if (driver === 'language') {
      const cs = new Set(records.filter(r => r.langs.includes(Lg)).map(r => r.cat).filter(Boolean));
      catOpts = cs;
      if (cs.size <= 1) {
        catDisabled = true;
        dispC = cs.size === 1 ? [...cs][0] : null;
        C = null;
      } else {
        if (C && !cs.has(C)) C = null;
        dispC = C;
      }
    }

    state.categoryFilter = C;
    state.languageFilter = Lg;
    state.filterDriver   = driver;

    const filterByLang = driver === 'language';
    const filterByCat  = driver === 'category';
    const catCount  = new Map();
    catOpts.forEach(x => catCount.set(x,
      records.filter(r => r.cat === x && (!filterByLang || r.langs.includes(Lg))).length));
    const langCount = new Map();
    langOpts.forEach(l => langCount.set(l,
      records.filter(r => r.langs.includes(l) && (!filterByCat || r.cat === C)).length));

    rebuildDropdown(catDD,  [...catOpts].sort(byCountDesc(catCount)),  catCount,  dispC,  catDisabled,  'cat',
                    String, (v) => catLabel.get(v) || v);
    rebuildDropdown(langDD, [...langOpts].sort(byCountDesc(langCount)), langCount, dispLg, langDisabled, 'lang');
    const wrap = document.getElementById(FILTER_ID);
    if (wrap) wrap.dataset.tseActive = (C || Lg) ? 'true' : 'false';

    applyCategoryFilter();
  }

  function applyCategoryFilter() {
    document.querySelectorAll('#side-nav .side-nav-card').forEach(applyCardVisibility);
    updateSectionsVisibility();
  }

  const COSTREAM_PALETTE = [
    { color: '#f5c518', bg: 'rgba(245, 197, 24, 0.18)',  fade: 'rgba(245, 197, 24, 0.06)'  },
    { color: '#7ee081', bg: 'rgba(126, 224, 129, 0.18)', fade: 'rgba(126, 224, 129, 0.06)' },
    { color: '#26d4c8', bg: 'rgba(38, 212, 200, 0.18)',  fade: 'rgba(38, 212, 200, 0.06)'  },
    { color: '#4d8cff', bg: 'rgba(77, 140, 255, 0.18)',  fade: 'rgba(77, 140, 255, 0.06)'  },
    { color: '#c77dff', bg: 'rgba(199, 125, 255, 0.18)', fade: 'rgba(199, 125, 255, 0.06)' },
    { color: '#ff7a8a', bg: 'rgba(255, 122, 138, 0.18)', fade: 'rgba(255, 122, 138, 0.06)' },
  ];

  const costreamColorByKey = new Map();

  const cardHasCollab = (card) => !!card.querySelector('.tse-collab-badge');

  const cardShown = (card) =>
    card.dataset.tseOffline !== 'true' &&
    card.style.display !== 'none' &&
    (card.dataset.tseGlobal === 'true' ||
     !document.body.classList.contains('tse-global-ready'));

  const getCardCollabCount = (card) => {
    const badge = card.querySelector('.tse-collab-badge');
    if (!badge) return null;
    const n = parseInt((badge.textContent || '').trim(), 10);
    return Number.isFinite(n) ? n : null;
  };

  const gsCache = new Map();
  const gsQueue = new Set();
  const gsWaiters = new Map();
  let gsTimer = null;
  let gsCooldownUntil = 0;

  const resolveGuestStarWaiters = (ids) => {
    for (const id of ids) {
      const arr = gsWaiters.get(id);
      if (arr) { gsWaiters.delete(id); arr.forEach(fn => fn(gsCache.get(id) || null)); }
    }
  };

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

    if (!op) { resolveGuestStarWaiters(ids); return; }

    const res = await post([op]);

    if (isResultsUnusable(res)) {
      gsCooldownUntil = Date.now() + CFG.GUEST_STAR_ERROR_COOLDOWN;
      resolveGuestStarWaiters(ids);
      return;
    }

    const list = res?.[0]?.data?.guestStarChannelCollaboration;
    const infoById = new Map();
    if (Array.isArray(list)) {
      for (const e of list) {
        if (!e || !e.id) continue;
        const session = e.session;
        const hostId = session?.host?.id ?? null;

        const raw = session
          ? [session.host, ...(session.guests || []).map(g => g?.user)]
          : [];
        const seen = new Set();
        const mates = [];
        for (const u of raw) {
          const login = u?.login?.toLowerCase();
          if (!login || seen.has(login)) continue;
          seen.add(login);

          mates.push({ login, name: (u.displayName || '').trim() || null });
        }

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
    resolveGuestStarWaiters(ids);
    scheduleScan();
  };

  const getHostId = (channelId) => {
    if (!channelId) return undefined;
    const hit = gsCache.get(channelId);
    const stale = !hit || Date.now() - hit.ts >= CFG.GUEST_STAR_TTL;

    if (stale && Date.now() >= gsCooldownUntil) {
      gsQueue.add(channelId);
      gsTimer ??= setTimeout(flushGuestStar, CFG.GUEST_STAR_DEBOUNCE);
    }

    return hit ? hit.hostId : undefined;
  };

  const requestGuestStar = (channelId) => new Promise(resolve => {
    if (!channelId) return resolve(null);
    const hit = gsCache.get(channelId);
    if (hit && Date.now() - hit.ts < CFG.GUEST_STAR_TTL) return resolve(hit);
    if (Date.now() < gsCooldownUntil) return resolve(hit || null);
    let arr = gsWaiters.get(channelId);
    if (!arr) gsWaiters.set(channelId, arr = []);
    arr.push(resolve);
    gsQueue.add(channelId);
    gsTimer ??= setTimeout(flushGuestStar, CFG.GUEST_STAR_DEBOUNCE);
  });

  const getCollabViewers = (channelId) => {
    if (!channelId) return null;
    const v = gsCache.get(channelId)?.combined;
    return Number.isFinite(v) ? v : null;
  };

  const getGuestStarMates = (login, channelId) => {
    if (!login) return [];
    const id = channelId || getChannelId(login);
    if (!id) return [];
    const hit = gsCache.get(id);
    if (!hit || !Array.isArray(hit.mates)) return [];
    return hit.mates.filter(m => m.login !== login);
  };

  // ── Drapeaux SVG inline (jeu OpenMoji, licence CC BY-SA 4.0) ───────────

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

  const LANG_CC = {
    'Français':'FR', 'English':'EN', 'Deutsch':'DE', 'Español':'ES',
    'Italiano':'IT', 'Português':'PT', 'Русский':'RU', '日本語':'JP',
    '한국어':'KR', '中文':'CN', 'Nederlands':'NL', 'Polski':'PL',
    'Türkçe':'TR', 'العربية':'SA', 'Čeština':'CZ', 'Svenska':'SE',
    'Dansk':'DK', 'Norsk':'NO', 'Suomi':'FI', 'Ελληνικά':'GR',
    'Magyar':'HU', 'Română':'RO', 'ไทย':'TH', 'Tiếng Việt':'VN',
    'Bahasa Indonesia':'ID', 'Українська':'UA'
  };

  const LANG_API = {
    'Français':'FR', 'English':'EN', 'Deutsch':'DE', 'Español':'ES',
    'Italiano':'IT', 'Português':'PT', 'Русский':'RU', '日本語':'JA',
    '한국어':'KO', '中文':'ZH', 'Nederlands':'NL', 'Polski':'PL',
    'Türkçe':'TR', 'العربية':'AR', 'Čeština':'CS', 'Svenska':'SV',
    'Dansk':'DA', 'Norsk':'NO', 'Suomi':'FI', 'Ελληνικά':'EL',
    'Magyar':'HU', 'Română':'RO', 'ไทย':'TH', 'Tiếng Việt':'VI',
    'Bahasa Indonesia':'ID', 'Українська':'UK'
  };

  const langApiRejected = new Set();

  const LANG_SET = new Set(Object.keys(LANG_CC));
  // Globe SVG inline (OpenMoji 1F30D, licence CC BY-SA 4.0) : icône du libellé

  const GLOBE_MARKUP = `<span class="tse-flag"><svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><circle cx="36" cy="36" r="28" fill="#92D3F5"/><path fill="#B1CC33" d="M49.4394,11.4301C48.9012,12.3361,47.7952,13.5726,47,14c-1.2452,0.6692-1.904,0.2672-3,1c-1.2689,0.8484-1.2095,1.9379-2,2 c-0.8018,0.063-0.6879-1.993-1-3c-0.4521-1.4585-0.2307-1.5267-1-2c-1.0834-0.6665-3.2121-1.0502-5,0 c-0.7094,0.4167-0.7506,0.682-3,4c-1.7096,2.5218-2.188,3.1093-2,4c0.1989,0.9419,0.0427,1.7474,1,2 c1.1873,0.3132,1.3661-0.2722,2-1c1.3282-1.525,2.3581-3.7828,3-4c0.5713-0.1933,2.0656,1.3495,2,3c-0.0463,1.1654-0.852,1.922-2,3 c-0.7417,0.6965-2.875,1.5-6,2c-1.719,0.275-1.4083,0.8524-2.0625,1.5938c-0.8427,0.955-0.4615,2.1691-1.2812,3.3125 c-1.0252,1.43-3.4727,1.7917-3.6564,2.7188C22.8432,33.4154,24.9604,33.9845,26,34c0.8505,0.0127,1.0644-0.7721,3-2 c0.7408-0.47,1.75-1.2812,2.6875-1.25c0.5041,0.0168,1.8289,0.2852,2.3438,0.7188c0.5938,0.5-0.1562,1.8438-0.4062,3.1562 s-2.8976,1.8646-3.8542,2.0208c-1.5737,0.257-4.1439-0.5228-5.6042,0.9375c-1,1-1.1155,1.766-1.1667,3.4167 c-0.0129,0.4172,0.937,3.0323,2,4c1.1442,1.0416,2.2939-0.8356,4,0c1.7456,0.8549,2.493,2.7288,3,4 c0.5078,1.2731,0.1756,1.1679,1,5c0.4146,1.9271,0.3191,1.1194,1,4c0.5632,2.3826,0.5889,2.7678,1,3 c1.1732,0.6628,3.8997-0.8162,5-3c0.6895-1.3683,0.2111-1.9625,1-5c0.3928-1.5123,0.5892-2.2685,1-3 c1.7332-3.0861,4.8828-3.1256,5-5c0.0802-1.2824-1.3573-1.8515-1-3c0.3421-1.0997,1.8099-1.0603,2-2 c0.2579-1.2752-2.2492-2.316-2-3c0.2822-0.7746,4.0696-1.0098,6,1c0.6397,0.666,0.4982,0.9775,2,4c1.3839,2.7851,1.7637,3.0431,2,3 c0.4287-0.0782,0.3223-1.1355,1-3c0.3243-0.8922,1.0927-3.0062,2-3c0.6247,0.0043,0.7386,1.0097,2,2 c0.7103,0.5576,1.7908,0.8806,2.3474,1.0378C63.7747,40.0932,64,38.0729,64,36c0-10.6315-5.9252-19.8791-14.6535-24.6206"/></g><g><circle cx="36" cy="36" r="28" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M49.4394,11.4301C48.9012,12.3361,47.7952,13.5726,47,14c-1.2452,0.6692-1.904,0.2672-3,1c-1.2689,0.8484-1.2095,1.9379-2,2 c-0.8018,0.063-0.6879-1.993-1-3c-0.4521-1.4585-0.2307-1.5267-1-2c-1.0834-0.6665-3.2121-1.0502-5,0 c-0.7094,0.4167-0.7506,0.682-3,4c-1.7096,2.5218-2.188,3.1093-2,4c0.1989,0.9419,0.0427,1.7474,1,2 c1.1873,0.3132,1.3661-0.2722,2-1c1.3282-1.525,2.3581-3.7828,3-4c0.5713-0.1933,2.0656,1.3495,2,3c-0.0463,1.1654-0.852,1.922-2,3 c-0.7417,0.6965-2.875,1.5-6,2c-1.719,0.275-1.4083,0.8524-2.0625,1.5938c-0.8427,0.955-0.4615,2.1691-1.2812,3.3125 c-1.0252,1.43-3.4727,1.7917-3.6564,2.7188C22.8432,33.4154,24.9604,33.9845,26,34c0.8505,0.0127,1.0644-0.7721,3-2 c0.7408-0.47,1.75-1.2812,2.6875-1.25c0.5041,0.0168,1.8289,0.2852,2.3438,0.7188c0.5938,0.5-0.1562,1.8438-0.4062,3.1562 s-2.8976,1.8646-3.8542,2.0208c-1.5737,0.257-4.1439-0.5228-5.6042,0.9375c-1,1-1.1155,1.766-1.1667,3.4167 c-0.0129,0.4172,0.937,3.0323,2,4c1.1442,1.0416,2.2939-0.8356,4,0c1.7456,0.8549,2.493,2.7288,3,4 c0.5078,1.2731,0.1756,1.1679,1,5c0.4146,1.9271,0.3191,1.1194,1,4c0.5632,2.3826,0.5889,2.7678,1,3 c1.1732,0.6628,3.8997-0.8162,5-3c0.6895-1.3683,0.2111-1.9625,1-5c0.3928-1.5123,0.5892-2.2685,1-3 c1.7332-3.0861,4.8828-3.1256,5-5c0.0802-1.2824-1.3573-1.8515-1-3c0.3421-1.0997,1.8099-1.0603,2-2 c0.2579-1.2752-2.2492-2.316-2-3c0.2822-0.7746,4.0696-1.0098,6,1c0.6397,0.666,0.4982,0.9775,2,4c1.3839,2.7851,1.7637,3.0431,2,3 c0.4287-0.0782,0.3223-1.1355,1-3c0.3243-0.8922,1.0927-3.0062,2-3c0.6247,0.0043,0.7386,1.0097,2,2 c0.7103,0.5576,1.7908,0.8806,2.3474,1.0378C63.7747,40.0932,64,38.0729,64,36c0-10.6315-5.9252-19.8791-14.6535-24.6206 z"/></g></svg></span>`;

  const flagMarkup = (canonical) => {
    const svg = FLAG_SVG[LANG_CC[canonical]];
    return svg ? `<span class="tse-flag">${svg}</span>` : null;
  };

  const langIcon = (canonical) => {

    const svg = flagMarkup(canonical);
    if (svg) return noeudStatique(svg);
    const sp = document.createElement('span');
    sp.className = 'tse-lang-code';
    sp.textContent = canonical;
    return sp;
  };

  const langStore = (() => {

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

    const section = followedSection();
    const cards = section ? section.querySelectorAll('.side-nav-card') : [];
    const now = Date.now();
    const gsUsable = now >= gsCooldownUntil;

    const groups = new Map();
    const gsHandled = new Set();
    const hostByCard = new Map();

    cards.forEach(card => {
      if (!cardShown(card)) return;
      const login = card.dataset.tseLogin;
      if (!login) return;
      const hostId = getHostId(getChannelId(login));
      hostByCard.set(card, hostId);
      if (typeof hostId !== 'string') return;
      const key = `gs:${hostId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });

    for (const [, members] of groups) {
      if (members.length >= 2) members.forEach(c => gsHandled.add(c));
    }

    cards.forEach(card => {
      if (!cardShown(card)) return;
      if (gsHandled.has(card)) return;
      if (gsUsable && hostByCard.get(card) === undefined && getChannelId(card.dataset.tseLogin)) return;
      if (!cardHasCollab(card)) return;
      const cat = card.dataset.tseCategory;
      if (!cat) return;

      const viewers = getCardViewersText(card);
      if (!viewers) return;
      const key = `vh:${cat}|||${viewers}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });

    const activeKeys = new Set();
    for (const [key, members] of groups) {
      if (members.length < 2) continue;

      if (key.startsWith('gs:')) { activeKeys.add(key); continue; }

      const counts = members.map(getCardCollabCount);
      if (counts.some(c => c === null)) continue;
      const first = counts[0];
      if (!counts.every(c => c === first)) continue;
      if (members.length > first + 1) continue;
      activeKeys.add(key);
    }

    for (const key of activeKeys) {
      const slot = costreamColorByKey.get(key);
      if (slot) slot.lastActiveTs = now;
    }

    for (const [key, slot] of [...costreamColorByKey]) {
      if (!activeKeys.has(key) && now - slot.lastActiveTs > CFG.COSTREAM_COLOR_GRACE) {
        costreamColorByKey.delete(key);
      }
    }
    const reserved = new Set();
    for (const slot of costreamColorByKey.values()) reserved.add(slot.idx);
    const pickIdx = () => {
      for (let i = 0; i < COSTREAM_PALETTE.length; i++) if (!reserved.has(i)) return i;
      return costreamColorByKey.size % COSTREAM_PALETTE.length;
    };
    for (const key of activeKeys) {
      if (!costreamColorByKey.has(key)) {
        const idx = pickIdx();
        reserved.add(idx);
        costreamColorByKey.set(key, { idx, lastActiveTs: now });
      }
    }

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

        card.dataset.tseCostreamKey = key;
      }
    }

    return activeKeys.size;
  }

  function applyCostreamJoins() {
    const all = document.querySelectorAll('.side-nav-card');
    all.forEach(c => {
      c.classList.remove('tse-costream-join-top', 'tse-costream-join-bottom');
      c.style.removeProperty('--tse-costream-jt');
      c.style.removeProperty('--tse-costream-jb');
    });
    const visible = [...all].filter(c =>
      cardShown(c) &&
      !c.parentElement?.closest('.side-nav-card')
    );

    const pairs = [];
    for (let i = 0; i < visible.length - 1; i++) {
      const a = visible[i], b = visible[i + 1];
      const key = a.dataset.tseCostreamKey;
      if (key && key === b.dataset.tseCostreamKey) pairs.push([a, b]);
    }
    if (!pairs.length) return;

    const joins = [];
    for (const [a, b] of pairs) {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      if (!ra.height || !rb.height) continue;
      const gap = rb.top - ra.bottom;
      if (gap > Math.min(ra.height, rb.height)) continue;
      joins.push([a, b, Math.max(0, gap) / 2 + 1]);
    }

    const mark = (card, cls, varName, ext) => {
      for (const el of [card, ...card.querySelectorAll('.side-nav-card')]) {
        el.classList.add(cls);
        el.style.setProperty(varName, `-${ext}px`);
      }
    };
    for (const [a, b, ext] of joins) {
      mark(a, 'tse-costream-join-bottom', '--tse-costream-jb', ext);
      mark(b, 'tse-costream-join-top', '--tse-costream-jt', ext);
    }
  }

  function snapshotTwitchOrder() {
    const section = followedSection();
    if (!section) return;

    const cards = [...section.querySelectorAll('.side-nav-card')].filter(c => !isSynthetic(c));
    cards.forEach((card, i) => {
      if (card.dataset.tseTwitchOrder !== undefined) return;
      card.dataset.tseTwitchOrder = String(i);
    });
  }

  const parseViewerCount = (txt) => {
    if (!txt) return 0;

    const s = txt.replace(/[\s\u00a0\u202f]+/g, '').toLowerCase();

    const suf = s.match(/(mil|mio|mi|k|m)\.?$/);
    if (suf) {

      const mult = (suf[1] === 'k' || suf[1] === 'mil') ? 1_000 : 1_000_000;
      const num = parseFloat(s.slice(0, suf.index).replace(',', '.'));
      return Number.isFinite(num) ? Math.round(num * mult) : 0;
    }

    const digits = s.replace(/[.,]/g, '');
    return /^\d+$/.test(digits) ? parseInt(digits, 10) : 0;
  };

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

    const sortMode = state.globalMode ? 'viewers' : state.sortMode;

    let sorted;
    if (sortMode === 'uptime') {

      sorted = [...cards].sort((a, b) => {
        const ta = new Date(a.dataset.tseStartedAt || 0).getTime() || 0;
        const tb = new Date(b.dataset.tseStartedAt || 0).getTime() || 0;
        return tb - ta;
      });
    } else if (sortMode === 'viewers') {

      sorted = [...cards].sort((a, b) => getCardViewers(b) - getCardViewers(a));
    } else if (sortMode === 'costream') {

      const groupViewers = new Map();
      cards.forEach(card => {
        const key = card.dataset.tseCostreamKey;
        if (!key) return;
        groupViewers.set(key, Math.max(groupViewers.get(key) || 0, getCardViewers(card)));
      });
      sorted = [...cards].sort((a, b) => {
        const ka = a.dataset.tseCostreamKey || null;
        const kb = b.dataset.tseCostreamKey || null;
        if (ka && !kb) return -1;
        if (!ka && kb) return 1;
        if (ka && kb && ka !== kb) {

          return (groupViewers.get(kb) || 0) - (groupViewers.get(ka) || 0);
        }

        const oa = parseInt(a.dataset.tseTwitchOrder ?? '999', 10);
        const ob = parseInt(b.dataset.tseTwitchOrder ?? '999', 10);
        return oa - ob;
      });
    } else if (sortMode === 'subs') {

      sorted = [...cards].sort((a, b) => {
        const sa = subs.isSub(getCardLogin(a)) ? 1 : 0;
        const sb = subs.isSub(getCardLogin(b)) ? 1 : 0;
        if (sa !== sb) return sb - sa;
        const va = getCardViewers(a), vb = getCardViewers(b);
        if (vb !== va) return vb - va;
        const oa = parseInt(a.dataset.tseTwitchOrder ?? '999', 10);
        const ob = parseInt(b.dataset.tseTwitchOrder ?? '999', 10);
        return oa - ob;
      });
    } else if (sortMode === 'popular') {

      sorted = [...cards].sort((a, b) => {
        const sa = visits.scoreFor(getCardLogin(a));
        const sb = visits.scoreFor(getCardLogin(b));
        if (sb !== sa) return sb - sa;
        const oa = parseInt(a.dataset.tseTwitchOrder ?? '999', 10);
        const ob = parseInt(b.dataset.tseTwitchOrder ?? '999', 10);
        return oa - ob;
      });
    } else if (sortMode === 'alpha') {

      sorted = [...cards].sort((a, b) => {
        return getCardLogin(a).localeCompare(getCardLogin(b), S.locale, { sensitivity: 'base' });
      });
    } else {

      sorted = [...cards].sort((a, b) => {
        const oa = parseInt(a.dataset.tseTwitchOrder ?? '999', 10);
        const ob = parseInt(b.dataset.tseTwitchOrder ?? '999', 10);
        return oa - ob;
      });
    }

    let changed = false;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== cards[i]) { changed = true; break; }
    }
    if (!changed) return;
    sorted.forEach(c => container.appendChild(c));
  }

  const GLOBAL_BANNER_ID = 'tse-global-partial';
  function setGlobalMode(on) {
    if (state.globalMode === on) return;
    state.globalMode = on;
    document.body.classList.toggle('tse-global-mode', on);

    if (on) {
      globalChannels.tick();

      if (!globalChannels.top(1).length) loadingOverlay.startCycle('entrée dans Top Chaînes');
    }

    scheduleScan();
  }

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

      const tab = (mode, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tse-mode-tab';
        b.dataset.tseMode = mode;
        b.textContent = label;
        return b;
      };
      row.replaceChildren(tab('followed', S.followedLabel), tab('global', S.uiGlobalLabel));
      row.querySelectorAll('[data-tse-mode]').forEach(btn => {
        btn.addEventListener('click', () => {

          const wanted = btn.dataset.tseMode === 'global';
          if (state.globalMode === wanted) return;
          setGlobalMode(wanted);
        });
      });

      filterBar.prepend(row);
    }
    row.setAttribute('aria-label', S.uiModeMenuAria);
    row.querySelectorAll('[data-tse-mode]').forEach(btn => {

      const libelle = btn.dataset.tseMode === 'global' ? S.uiGlobalLabel : S.followedLabel;
      if (btn.textContent !== libelle) btn.textContent = libelle;
      const on = (btn.dataset.tseMode === 'global') === state.globalMode;
      if (btn.getAttribute('aria-pressed') !== String(on)) {
        btn.setAttribute('aria-pressed', String(on));
      }
    });
  }

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

  let globalTemplate = null;
  let globalContainer = null;

  const releaseGlobalCard = (card) => {
    if (isSynthetic(card)) { card.remove(); return; }
    delete card.dataset.tseGlobal;
  };

  const globalSeed = new Map();

  const globalSeedFor = (card) =>
    (card.dataset.tseGlobal === 'true' && globalSeed.get(card.dataset.tseLogin)) || null;

  function syncGlobalCards() {
    const section = followedSection();
    if (!section) return;

    const existing = new Map();
    for (const c of section.querySelectorAll('.side-nav-card[data-tse-global="true"]')) {
      const l = c.dataset.tseLogin;
      if (l) existing.set(l, c); else releaseGlobalCard(c);
    }

    const ready = (n) => document.body.classList.toggle('tse-global-ready', n > 0);
    if (!state.globalMode) {
      existing.forEach(releaseGlobalCard);
      globalSeed.clear();
      ready(0);
      return;
    }

    let template = null;
    let container = null;
    for (const c of section.querySelectorAll('.side-nav-card')) {
      if (c.dataset.tseGlobal === 'true' || isSynthetic(c)) continue;
      if (isPlainCard(c) && !isCardOffline(c)) { template = c; break; }
    }
    if (template) {
      container = template.parentElement;

      globalTemplate = template.cloneNode(true);
      globalContainer = container;
    } else if (globalTemplate) {
      template = globalTemplate;

      container = (globalContainer?.isConnected ? globalContainer : null)
        || section.querySelector('.side-nav-card')?.parentElement
        || section;
    }
    if (!template || !container) return;

    const seed = (rec) => globalSeed.set(rec.login, {
      id: rec.id, tags: rec.tags, game: rec.game, gameLabel: rec.gameLabel,
      viewers: rec.viewers,
      name: rec.name, avatar: rec.avatar, ts: rec.ts,
      stream: {
        createdAt: rec.createdAt,
        viewersCount: rec.viewers,
        game: { name: rec.game, displayName: rec.gameLabel },
        freeformTags: rec.tags.map(n => ({ name: n }))
      }
    });

    const natives = new Map();
    for (const c of section.querySelectorAll('.side-nav-card')) {
      const l = c.dataset.tseLogin;
      if (l && !isSynthetic(c) && !c.dataset.tseGlobal && !natives.has(l)) natives.set(l, c);
    }

    const top = globalChannels.top(CFG.GLOBAL_TOP_N);
    const keep = new Set();
    ready(top.length);
    globalSeed.clear();
    for (const rec of top) {
      keep.add(rec.login);
      seed(rec);
      let card = existing.get(rec.login) || natives.get(rec.login);
      if (card) {
        card.dataset.tseGlobal = 'true';
      } else {
        card = buildAheadCard(template, rec.login, rec);
        if (!card) return;
        card.dataset.tseGlobal = 'true';
        container.appendChild(card);
      }

      renderViewers(card, rec.viewers);
    }
    for (const [login, card] of existing) if (!keep.has(login)) releaseGlobalCard(card);
  }

  const isSynthetic = (card) => card.dataset.tseSynthetic === 'true';

  const isPlainCard = (card) => {
    if (card.querySelector('[class*="promoted-followed-card__content"]')) return false;
    if (card.querySelector(DOM.altCostreamHostSelector)) return false;
    if (card.querySelector(DOM.altLogoSelector)) return false;
    if (card.querySelector('.tse-collab-badge')) return false;
    if (PLUS_RE_PRESENT.test(card.textContent || '')) return false;
    if (card.querySelector('[data-tse-extra-row]')) return false;
    return true;
  };

  const pollRoster = () => {
    if (!CFG.AHEAD_ENABLED || document.hidden) return;
    let budget = CFG.AHEAD_MAX_POLL;

    for (const [login] of roster.entries()) {
      if (budget-- <= 0) break;
      if (getFreshChannel(login)) continue;
      fetchChannel(login);
    }
  };

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

      node.removeAttribute('id');

      node.removeAttribute('aria-label');
      node.removeAttribute('aria-labelledby');
      node.removeAttribute('aria-describedby');
    };
    strip(el);
    el.querySelectorAll('*').forEach(strip);

    el.querySelectorAll('.side-nav-card__avatar--offline')
      .forEach(n => n.classList.remove('side-nav-card__avatar--offline'));

    const status = liveStatusOf(el);
    if (status) {
      status.querySelectorAll('*').forEach(n => {
        if (n.children.length) return;
        if (n.getAttribute('aria-hidden') === 'true') return;
        if ((n.textContent || '').trim()) n.remove();
      });
    }
  };

  const buildAheadCard = (template, login, data) => {
    const card = template.cloneNode(true);
    scrubClone(card);

    const links = card.querySelectorAll('a[href]');
    if (!links.length) return null;
    links.forEach(a => a.setAttribute('href', `/${login}`));

    const name = data.name || (login.charAt(0).toUpperCase() + login.slice(1));
    const nameEl = card.querySelector('p[data-a-target="side-nav-title"]');
    if (!nameEl) return null;
    setText(nameEl, name);
    if (nameEl.hasAttribute('title')) nameEl.setAttribute('title', name);

    const catEl = cardCategoryEl(card);
    const categorie = data.gameLabel || data.game;
    if (catEl && categorie) {
      setText(catEl, categorie);
      if (catEl.hasAttribute('title')) catEl.setAttribute('title', categorie);
    }

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

  const syncAheadCards = () => {
    if (!CFG.AHEAD_ENABLED) return;

    if (state.globalMode) return;
    const section = followedSection();
    if (!section) return;

    const all = [...section.querySelectorAll('.side-nav-card')];

    const nativeCovers = (c) =>
      !isCardOffline(c) && c.dataset.tseGqlOffline !== 'true';

    const covered = new Set();
    let template = null;
    for (const c of all) {
      if (isSynthetic(c) || !nativeCovers(c)) continue;
      const l = c.dataset.tseLogin || getCardLogin(c);
      if (l) covered.add(l);

      if (!template && isPlainCard(c)) template = c;
    }

    const standing = new Set();
    for (const c of all) {
      if (!isSynthetic(c)) continue;
      const l = c.dataset.tseLogin;
      const hit = l ? cache.get(l) : null;
      if (!l || covered.has(l) || !hit?.stream) { c.remove(); continue; }
      standing.add(l);
    }
    let live = standing.size;

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
      if (!card) return;
      container.appendChild(card);
      liveLag.noteAhead(hit.stream.id);
      live++;
    }
  };

  const harvestFollowed = () => {
    const section = followedSection();
    if (!section) return;
    section.querySelectorAll(DOM.followedCardSelector).forEach(a => {

      if (a.closest('[data-tse-synthetic="true"]')) return;
      const login = loginFromHref(a.getAttribute('href'));
      if (!login) return;
      roster.record(login);
    });
  };

  const scanSidebar = () => {

    refreshLanguage();
    refreshSidebarCollapsed();
    preview.closeIfDetached();
    offlineTransitionsThisScan = 0;
    snapshotTwitchOrder();
    harvestFollowed();
    detectSubscription();
    pollRoster();

    if (!state.globalMode) syncAheadCards();
    syncGlobalCards();
    const cards = document.querySelectorAll('.side-nav-card');
    cards.forEach(processCard);
    ensureFilterBar();
    ensureSortRow();
    ensureModeRow();
    tagStoriesRow();
    ensureGlobalBanner();
    hideNativeFollowedHeader();
    renameRootTitle();
    recomputeFilters();
    const costreamGroups = detectCoStreams();
    updateSortButtonsState({ costreamGroups });
    applySorting();
    applyCostreamJoins();
    autoExpandFollowed();

    const hadOfflineActivity = offlineTransitionsThisScan > 0;

    loadingOverlay.setHold(state.globalMode
      && !document.body.classList.contains('tse-global-ready'), 'global');

    if (subsPage.enAttente()) {
      subsPage.notifySidebar(!!document.querySelector(DOM.followedCardSelector));
    }
    const nativeCount = [...cards].filter(c => !isSynthetic(c)).length;
    const stillGrowing = loadingOverlay.notifyScan(hadOfflineActivity, nativeCount);

    if (hadOfflineActivity || stillGrowing) scheduleScan();
  };

  let scanTimer = null;
  const scheduleScan = () => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scanSidebar(); }, CFG.SCAN_DEBOUNCE);
  };

  const startObserver = () => {

    let lastObservedCollapsed = null;

    const obs = new MutationObserver((mutations) => {

      const nav = document.querySelector(DOM.sidebarRoot);
      let cardRemoved = false;
      let relevant = !nav;
      for (const m of mutations) {
        if (!relevant) {
          if (nav.contains(m.target)) relevant = true;
          else for (const node of m.addedNodes) {
            if (node.nodeType === 1 && (node === nav || node.contains?.(nav))) {
              relevant = true; break;
            }
          }
        }
        for (const node of m.removedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.classList?.contains('side-nav-card') ||
              node.querySelector?.('.side-nav-card')) {
            cardRemoved = true;
            relevant = true;
            break;
          }
        }
        if (cardRemoved && relevant) break;
      }
      if (cardRemoved) loadingOverlay.bumpActivity();

      if (nav) {
        const collapsedNow = detectSidebarCollapsed();
        if (lastObservedCollapsed === null) {

          lastObservedCollapsed = collapsedNow;
        } else if (collapsedNow !== lastObservedCollapsed) {
          lastObservedCollapsed = collapsedNow;
          loadingOverlay.startCycle('bascule réduit/étendu');
          invalidateAndRescan();
          return;
        }
      }

      if (relevant) scheduleScan();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    scanSidebar();
  };

  function runDiagnostics() {
    const root      = document.querySelector(DOM.sidebarRoot);
    const collapsed = detectSidebarCollapsed();
    const section   = followedSection();
    const allCards  = [...document.querySelectorAll('.side-nav-card')]
      .filter(c => !isSynthetic(c));

    const cards     = section
      ? [...section.querySelectorAll('.side-nav-card')].filter(c => !isSynthetic(c))
      : [];

    const liveSample = cards.find(c => c.dataset.tseOffline !== 'true') || null;
    const anySample  = liveSample || cards[0] || null;

    const navLinks = root ? root.querySelectorAll('a[href^="/"]').length : 0;

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

    add('viewersCount', 'nativeViewersEl() — compteur de viewers', true,
        collapsed ? 'na' : (!exp ? 'na' : (nativeViewersEl(exp) ? 'ok' : 'broken')),
        collapsed ? 'sidebar réduite' : (exp ? '' : 'aucune carte live à sonder'));

    add('category', 'getCardCategory() — métadonnées', false,
        collapsed ? 'na' : (!exp ? 'na' : (getCardCategory(exp) ? 'ok' : 'broken')),
        collapsed ? 'sidebar réduite' : (exp ? '' : 'aucune carte live à sonder'));

    return probes;
  }

  function logDiagnostics(report) {
    const tag = (s) =>
      s === 'ok' ? 'OK' : s === 'broken' ? S.consoleHealthTagBroken : S.consoleHealthTagNa;
    console.table(report.map(p => ({
      [S.consoleColProbe]:  p.label,
      [S.consoleColStatus]: tag(p.status),
      [S.consoleColDetail]: p.detail || ''
    })));
  }

  function hasCriticalBreakage(report) {
    return report.some(p => p.critical && p.status === 'broken');
  }

  let healthWarned = false;
  function runSelectorHealthCheck() {
    if (!document.querySelector(DOM.sidebarRoot)) return;
    if (document.body.classList.contains('tse-loading')) return;
    const report = runDiagnostics();
    const broken = hasCriticalBreakage(report);
    if (broken && !healthWarned) {
      healthWarned = true;
      console.warn(S.consoleHealthBroken);
      logDiagnostics(report);
    } else if (!broken && healthWarned) {
      healthWarned = false;
    }
  }

  const invalidateAndRescan = () => {
    cache.clear();
    document.querySelectorAll('.side-nav-card[data-tse-login]').forEach(card => {
      delete card.dataset.tseLogin;
    });
    scanSidebar();
  };

  const startTimers = () => {

    setInterval(() => {
      document.querySelectorAll('.side-nav-card[data-tse-started-at]').forEach(card => {
        refreshUptime(card);
        updateFreshness(card);
      });
    }, CFG.UI_TICK);

    setInterval(() => {
      if (document.hidden) return;
      scheduleScan();

      thumbPreload.tick();

      globalChannels.tick();
    }, CFG.REFRESH_TICK);

    setInterval(() => {

      pruneCache(cache, CFG.LIVE_PRUNE_AGE, CFG.LIVE_CACHE_MAX);
      pruneCache(gsCache, CFG.GS_PRUNE_AGE, CFG.GS_CACHE_MAX);
      preview.prune();
      liveLag.prune();
      roster.flush();

      if (document.hidden) { cache.clear(); return; }
      runSelectorHealthCheck();
    }, CFG.MAINTENANCE_TICK);

    let hiddenSince = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenSince = Date.now(); return; }
      if (!hiddenSince) return;
      const awayMs = Date.now() - hiddenSince;
      hiddenSince = 0;
      if (awayMs < CFG.REVISIT_RELOAD_MS) return;
      loadingOverlay.startCycle('retour d\'onglet');
      invalidateAndRescan();
    });

    setTimeout(runSelectorHealthCheck, CFG.HEALTH_INITIAL_DELAY);
  };

  const boot = () => {
    injectCSS();
    const ready = () => {

      refreshLanguage();
      loadingOverlay.init();

      roster.init();
      subs.load();
      subsPage.init();
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