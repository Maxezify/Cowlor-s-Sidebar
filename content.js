/* ============================================================
 *  Cowlor's Sidebar for Twitch — Extension Chrome v3.18.0
 *  -------------------------------------------------------------
 *  Portage du userscript Violentmonkey "Twitch Sidebar Enhancer
 *  ADBLOCK 4" v2.22.3 vers une extension Manifest V3, avec
 *  localisation multilingue (français, anglais, allemand,
 *  espagnol, portugais du Brésil et du Portugal) et
 *  architecture indépendante de la langue (cf. bloc I18N).
 *
 *  Ce fichier contient DEUX modules indépendants :
 *
 *   1) MODULE ANTI-PUB (vaft v37.0.0 par pixeltris). N'agit
 *      QUE dans les iframes — concrètement, dans l'iframe
 *      d'aperçu servie par player.twitch.tv. Le stream
 *      principal n'est pas impacté. Voir le commentaire
 *      d'intro de ce module pour le détail.
 *
 *   2) MODULE TSE (sidebar enrichie). N'agit QU'EN top-level —
 *      ne tourne pas dans les iframes. C'est le module
 *      principal de l'extension.
 *
 *  Les deux modules ont des gardes opposées (iframe-only /
 *  top-level-only) donc dans n'importe quelle frame, exactement
 *  un des deux est actif.
 *
 *  FRAÎCHEUR DES DONNÉES (v3.18) — l'extension ne se contente pas
 *  de lire le DOM de Twitch, elle rafraîchit elle-même ce que
 *  Twitch laisse périmer. Le pipeline tient en trois pièces :
 *
 *   • UNE requête, TseChannel, qui rapporte par chaîne tout ce
 *     dont la sidebar a besoin (createdAt, viewersCount, game,
 *     freeformTags, id). Elle a remplacé UseLive + TseLang.
 *   • UN cache à TTL, `cache` (login -> entrée), dont la durée de
 *     validité LIVE_TTL est la SEULE constante qui détermine à
 *     quel point la sidebar colle au direct.
 *   • UN scan idempotent : processCard lit le cache s'il est
 *     frais (sans réseau), remet le login en file sinon. Le
 *     rendu passe par applyChannelData, ré-appelable sans effet
 *     de bord cumulatif.
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
 *  MODULE INTÉGRÉ : Anti-publicité Twitch (vaft v37.0.0)
 *  -------------------------------------------------------------
 *  Auteur original : pixeltris / TwitchAdSolutions (cleanlock)
 *  Source : https://github.com/pixeltris/TwitchAdSolutions
 *
 *  PORTÉE D'EXÉCUTION :
 *   Le module ne s'active QUE dans les iframes (notre iframe
 *   d'aperçu sur player.twitch.tv). Sur le stream principal,
 *   il se met en retrait — l'utilisateur qui regarde activement
 *   un stream accepte le modèle économique normal de Twitch.
 *   Pour un anti-pub global, installer vaft en externe ; le
 *   check twitchAdSolutionsVersion natif gère la cohabitation.
 *
 *  DIRECTIVES REQUISES (header) :
 *   - @match https://*.twitch.tv/*   pour autoriser player.twitch.tv
 *   - @allFrames true                pour injecter dans les sub-frames
 *                                    (ViolentMonkey ne le fait pas par défaut)
 *
 *  ARCHITECTURE — modifications appliquées au code vaft original :
 *   a) préfixe "[TSE-AdBlock]" sur tous les console.log/error
 *      (pour les distinguer dans la DevTools console)
 *   b) wrapper IIFE avec garde TSE_ADBLOCK_ENABLED (désactivation)
 *   c) garde iframe-only en début d'IIFE
 *   d) injection CSS qui masque la bannière .adblock-overlay
 *      (la fonction updateAdblockBanner continue de tourner, le
 *      <div> est créé mais invisible — préserve isActivelyStrippingAds
 *      utilisé par monitorPlayerBuffering)
 *
 *  COMPATIBILITÉ TSE :
 *   vaft hook window.fetch globalement, mais ne modifie que les
 *   requêtes contenant "PlaybackAccessToken" ou "picture-by-picture".
 *   Nos requêtes UseLive partent depuis la page top-level (où vaft
 *   ne tourne pas) — zéro conflit possible.
 *
 *  MISE À JOUR (pour intégrer une nouvelle version de vaft) :
 *   1) Récupérer le source sur GitHub.
 *   2) Coller son contenu intérieur (entre "(function() {" et
 *      "})();") à l'intérieur du wrapper ci-dessous.
 *   3) Préfixer tous les console.log/error par '[TSE-AdBlock]'.
 *   4) Vérifier que les 4 modifications (a-d) ci-dessus sont préservées.
 * ============================================================ */
// Flag de désactivation. Le mettre à false pour utiliser un vaft
// externe ou désactiver totalement le blocage de pub.
const TSE_ADBLOCK_ENABLED = true;

if (TSE_ADBLOCK_ENABLED) (function() {
    'use strict';

    // Garde iframe-only (cf. commentaire d'intro). window.top peut lever
    // une SecurityError en cross-origin, d'où le try/catch.
    try {
        if (window.top === window) return;
    } catch { /* frame cross-origin → continue */ }

    // Masque la bannière "Blocking ads" injectée par updateAdblockBanner
    // (cf. modification (d) en intro). !important pour battre les styles
    // inline que vaft applique sur le <div>.
    {
        const tag = document.createElement('style');
        tag.textContent = '.adblock-overlay, .player-adblock-notice { display: none !important; }';
        (document.head || document.documentElement).appendChild(tag);
    }

    const ourTwitchAdSolutionsVersion = 24;// Used to prevent conflicts with outdated versions of the scripts
    if (typeof window.twitchAdSolutionsVersion !== 'undefined' && window.twitchAdSolutionsVersion >= ourTwitchAdSolutionsVersion) {
        console.log('[TSE-AdBlock]', "skipping vaft as there's another script active. ourVersion:" + ourTwitchAdSolutionsVersion + " activeVersion:" + window.twitchAdSolutionsVersion);
        window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
        return;
    }
    window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
    function declareOptions(scope) {
        scope.AdSignifier = 'stitched';
        scope.ClientID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        scope.BackupPlayerTypes = [
            'embed',//Source
            'popout',//Source
            'autoplay',//360p
            //'picture-by-picture-CACHED'//360p (-CACHED is an internal suffix and is removed)
        ];
        scope.FallbackPlayerType = 'embed';
        scope.ForceAccessTokenPlayerType = 'popout';
        scope.SkipPlayerReloadOnHevc = false;// If true this will skip player reload on streams which have 2k/4k quality (if you enable this and you use the 2k/4k quality setting you'll get error #4000 / #3000 / spinning wheel on chrome based browsers)
        scope.AlwaysReloadPlayerOnAd = false;// Always pause/play when entering/leaving ads
        scope.ReloadPlayerAfterAd = true;// After the ad finishes do a player reload instead of pause/play
        scope.PlayerReloadMinimalRequestsTime = 1500;
        scope.PlayerReloadMinimalRequestsPlayerIndex = 2;//autoplay
        scope.HasTriggeredPlayerReload = false;
        scope.StreamInfos = [];
        scope.StreamInfosByUrl = [];
        scope.GQLDeviceID = null;
        scope.ClientVersion = null;
        scope.ClientSession = null;
        scope.ClientIntegrityHeader = null;
        scope.AuthorizationHeader = undefined;
        scope.SimulatedAdsDepth = 0;
        scope.PlayerBufferingFix = true;// If true this will pause/play the player when it gets stuck buffering
        scope.PlayerBufferingDelay = 600;// How often should we check the player state (in milliseconds)
        scope.PlayerBufferingSameStateCount = 3;// How many times of seeing the same player state until we trigger pause/play (it will only trigger it one time until the player state changes again)
        scope.PlayerBufferingDangerZone = 1;// The buffering time left (in seconds) when we should ignore the players playback position in the player state check
        scope.PlayerBufferingDoPlayerReload = false;// If true this will do a player reload instead of pause/play (player reloading is better at fixing the playback issues but it takes slightly longer)
        scope.PlayerBufferingMinRepeatDelay = 8000;// Minimum delay (in milliseconds) between each pause/play (this is to avoid over pressing pause/play when there are genuine buffering problems)
        scope.PlayerBufferingPrerollCheckEnabled = false;// Enable this if you're getting an immediate pause/play/reload as you open a stream (which is causing the stream to take longer to load). One problem with this being true is that it can cause the player to get stuck in some instances requiring the user to press pause/play
        scope.PlayerBufferingPrerollCheckOffset = 5;// How far the stream need to move before doing the buffering mitigation (depends on PlayerBufferingPrerollCheckEnabled being true)
        scope.V2API = false;
        scope.IsAdStrippingEnabled = true;
        scope.AdSegmentCache = new Map();
        scope.AllSegmentsAreAdSegments = false;
    }
    let isActivelyStrippingAds = false;
    let localStorageHookFailed = false;
    const twitchWorkers = [];
    const workerStringConflicts = [
        'twitch',
        'isVariantA'// TwitchNoSub
    ];
    const workerStringAllow = [];
    const workerStringReinsert = [
        'isVariantA',// TwitchNoSub (prior to (0.9))
        'besuper/',// TwitchNoSub (0.9)
        '${patch_url}'// TwitchNoSub (0.9.1)
    ];
    function getCleanWorker(worker) {
        let root = null;
        let parent = null;
        let proto = worker;
        while (proto) {
            const workerString = proto.toString();
            if (workerStringConflicts.some((x) => workerString.includes(x)) && !workerStringAllow.some((x) => workerString.includes(x))) {
                if (parent !== null) {
                    Object.setPrototypeOf(parent, Object.getPrototypeOf(proto));
                }
            } else {
                if (root === null) {
                    root = proto;
                }
                parent = proto;
            }
            proto = Object.getPrototypeOf(proto);
        }
        return root;
    }
    function getWorkersForReinsert(worker) {
        const result = [];
        let proto = worker;
        while (proto) {
            const workerString = proto.toString();
            if (workerStringReinsert.some((x) => workerString.includes(x))) {
                result.push(proto);
            } else {
            }
            proto = Object.getPrototypeOf(proto);
        }
        return result;
    }
    function reinsertWorkers(worker, reinsert) {
        let parent = worker;
        for (let i = 0; i < reinsert.length; i++) {
            Object.setPrototypeOf(reinsert[i], parent);
            parent = reinsert[i];
        }
        return parent;
    }
    function isValidWorker(worker) {
        const workerString = worker.toString();
        return !workerStringConflicts.some((x) => workerString.includes(x))
            || workerStringAllow.some((x) => workerString.includes(x))
            || workerStringReinsert.some((x) => workerString.includes(x));
    }
    function hookWindowWorker() {
        const reinsert = getWorkersForReinsert(window.Worker);
        const newWorker = class Worker extends getCleanWorker(window.Worker) {
            constructor(twitchBlobUrl, options) {
                let isTwitchWorker = false;
                try {
                    isTwitchWorker = new URL(twitchBlobUrl).origin.endsWith('.twitch.tv');
                } catch {}
                if (!isTwitchWorker) {
                    super(twitchBlobUrl, options);
                    return;
                }
                const newBlobStr = `
                    const pendingFetchRequests = new Map();
                    ${stripAdSegments.toString()}
                    ${getStreamUrlForResolution.toString()}
                    ${processM3U8.toString()}
                    ${hookWorkerFetch.toString()}
                    ${declareOptions.toString()}
                    ${getAccessToken.toString()}
                    ${gqlRequest.toString()}
                    ${parseAttributes.toString()}
                    ${getWasmWorkerJs.toString()}
                    ${getServerTimeFromM3u8.toString()}
                    ${replaceServerTimeInM3u8.toString()}
                    const workerString = getWasmWorkerJs('${twitchBlobUrl.replaceAll("'", "%27")}');
                    declareOptions(self);
                    GQLDeviceID = ${GQLDeviceID ? "'" + GQLDeviceID + "'" : null};
                    AuthorizationHeader = ${AuthorizationHeader ? "'" + AuthorizationHeader + "'" : undefined};
                    ClientIntegrityHeader = ${ClientIntegrityHeader ? "'" + ClientIntegrityHeader + "'" : null};
                    ClientVersion = ${ClientVersion ? "'" + ClientVersion + "'" : null};
                    ClientSession = ${ClientSession ? "'" + ClientSession + "'" : null};
                    self.addEventListener('message', function(e) {
                        if (e.data.key == 'UpdateClientVersion') {
                            ClientVersion = e.data.value;
                        } else if (e.data.key == 'UpdateClientSession') {
                            ClientSession = e.data.value;
                        } else if (e.data.key == 'UpdateClientId') {
                            ClientID = e.data.value;
                        } else if (e.data.key == 'UpdateDeviceId') {
                            GQLDeviceID = e.data.value;
                        } else if (e.data.key == 'UpdateClientIntegrityHeader') {
                            ClientIntegrityHeader = e.data.value;
                        } else if (e.data.key == 'UpdateAuthorizationHeader') {
                            AuthorizationHeader = e.data.value;
                        } else if (e.data.key == 'FetchResponse') {
                            const responseData = e.data.value;
                            if (pendingFetchRequests.has(responseData.id)) {
                                const { resolve, reject } = pendingFetchRequests.get(responseData.id);
                                pendingFetchRequests.delete(responseData.id);
                                if (responseData.error) {
                                    reject(new Error(responseData.error));
                                } else {
                                    // Create a Response object from the response data
                                    const response = new Response(responseData.body, {
                                        status: responseData.status,
                                        statusText: responseData.statusText,
                                        headers: responseData.headers
                                    });
                                    resolve(response);
                                }
                            }
                        } else if (e.data.key == 'TriggeredPlayerReload') {
                            HasTriggeredPlayerReload = true;
                        } else if (e.data.key == 'SimulateAds') {
                            SimulatedAdsDepth = e.data.value;
                            console.log('[TSE-AdBlock]', 'SimulatedAdsDepth: ' + SimulatedAdsDepth);
                        } else if (e.data.key == 'AllSegmentsAreAdSegments') {
                            AllSegmentsAreAdSegments = !AllSegmentsAreAdSegments;
                            console.log('[TSE-AdBlock]', 'AllSegmentsAreAdSegments: ' + AllSegmentsAreAdSegments);
                        }
                    });
                    hookWorkerFetch();
                    eval(workerString);
                `;
                super(URL.createObjectURL(new Blob([newBlobStr])), options);
                twitchWorkers.push(this);
                this.addEventListener('message', (e) => {
                    if (e.data.key == 'UpdateAdBlockBanner') {
                        updateAdblockBanner(e.data);
                    } else if (e.data.key == 'PauseResumePlayer') {
                        doTwitchPlayerTask(true, false);
                    } else if (e.data.key == 'ReloadPlayer') {
                        doTwitchPlayerTask(false, true);
                    }
                });
                this.addEventListener('message', async event => {
                    if (event.data.key == 'FetchRequest') {
                        const fetchRequest = event.data.value;
                        const responseData = await handleWorkerFetchRequest(fetchRequest);
                        this.postMessage({
                            key: 'FetchResponse',
                            value: responseData
                        });
                    }
                });
            }
        };
        let workerInstance = reinsertWorkers(newWorker, reinsert);
        Object.defineProperty(window, 'Worker', {
            get: function() {
                return workerInstance;
            },
            set: function(value) {
                if (isValidWorker(value)) {
                    workerInstance = value;
                } else {
                    console.log('[TSE-AdBlock]', 'Attempt to set twitch worker denied');
                }
            }
        });
    }
    function getWasmWorkerJs(twitchBlobUrl) {
        const req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.overrideMimeType("text/javascript");
        req.send();
        return req.responseText;
    }
    function hookWorkerFetch() {
        console.log('[TSE-AdBlock]', 'hookWorkerFetch (vaft)');
        const realFetch = fetch;
        fetch = async function(url, options) {
            if (typeof url === 'string') {
                if (AdSegmentCache.has(url)) {
                    return new Promise(function(resolve, reject) {
                        const send = function() {
                            return realFetch('data:video/mp4;base64,AAAAKGZ0eXBtcDQyAAAAAWlzb21tcDQyZGFzaGF2YzFpc282aGxzZgAABEltb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAYagAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAABqHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAURtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAALuAAAAAAAAzZXNkcwAAAAADgICAIgABAASAgIAUQBUAAAAAAAAAAAAAAAWAgIACEZAGgICAAQIAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAeV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAGBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAA9CQAAAAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABLG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAOxzdGJsAAAAoHN0c2QAAAAAAAAAAQAAAJBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAOmF2Y0MBTUAe/+EAI2dNQB6WUoFAX/LgLUBAQFAAAD6AAA6mDgAAHoQAA9CW7y4KAQAEaOuPIAAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAC4AAAAAAoAAAAAAACB0cmV4AAAAAAAAAAIAAAABAACCNQAAAAACQAAA', options).then(function(response) {
                                resolve(response);
                            })['catch'](function(err) {
                                reject(err);
                            });
                        };
                        send();
                    });
                }
                url = url.trimEnd();
                if (url.endsWith('m3u8')) {
                    return new Promise(function(resolve, reject) {
                        const processAfter = async function(response) {
                            if (response.status === 200) {
                                resolve(new Response(await processM3U8(url, await response.text(), realFetch)));
                            } else {
                                resolve(response);
                            }
                        };
                        const send = function() {
                            return realFetch(url, options).then(function(response) {
                                processAfter(response);
                            })['catch'](function(err) {
                                reject(err);
                            });
                        };
                        send();
                    });
                } else if (url.includes('/channel/hls/') && !url.includes('picture-by-picture')) {
                    V2API = url.includes('/api/v2/');
                    const channelName = (new URL(url)).pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
                    if (ForceAccessTokenPlayerType) {
                        // parent_domains is used to determine if the player is embeded and stripping it gets rid of fake ads
                        const tempUrl = new URL(url);
                        tempUrl.searchParams.delete('parent_domains');
                        url = tempUrl.toString();
                    }
                    return new Promise(function(resolve, reject) {
                        const processAfter = async function(response) {
                            if (response.status == 200) {
                                const encodingsM3u8 = await response.text();
                                const serverTime = getServerTimeFromM3u8(encodingsM3u8);
                                let streamInfo = StreamInfos[channelName];
                                if (streamInfo != null && streamInfo.EncodingsM3U8 != null && (await realFetch(streamInfo.EncodingsM3U8.match(/^https:.*\.m3u8$/m)[0])).status !== 200) {
                                    // The cached encodings are dead (the stream probably restarted)
                                    streamInfo = null;
                                }
                                if (streamInfo == null || streamInfo.EncodingsM3U8 == null) {
                                    StreamInfos[channelName] = streamInfo = {
                                        ChannelName: channelName,
                                        IsShowingAd: false,
                                        LastPlayerReload: 0,
                                        EncodingsM3U8: encodingsM3u8,
                                        ModifiedM3U8: null,
                                        IsUsingModifiedM3U8: false,
                                        UsherParams: (new URL(url)).search,
                                        RequestedAds: new Set(),
                                        Urls: [],// xxx.m3u8 -> { Resolution: "284x160", FrameRate: 30.0 }
                                        ResolutionList: [],
                                        BackupEncodingsM3U8Cache: [],
                                        ActiveBackupPlayerType: null,
                                        IsMidroll: false,
                                        IsStrippingAdSegments: false,
                                        NumStrippedAdSegments: 0
                                    };
                                    const lines = encodingsM3u8.replaceAll('\r', '').split('\n');
                                    for (let i = 0; i < lines.length - 1; i++) {
                                        if (lines[i].startsWith('#EXT-X-STREAM-INF') && lines[i + 1].includes('.m3u8')) {
                                            const attributes = parseAttributes(lines[i]);
                                            const resolution = attributes['RESOLUTION'];
                                            if (resolution) {
                                                const resolutionInfo = {
                                                    Resolution: resolution,
                                                    FrameRate: attributes['FRAME-RATE'],
                                                    Codecs: attributes['CODECS'],
                                                    Url: lines[i + 1]
                                                };
                                                streamInfo.Urls[lines[i + 1]] = resolutionInfo;
                                                streamInfo.ResolutionList.push(resolutionInfo);
                                            }
                                            StreamInfosByUrl[lines[i + 1]] = streamInfo;
                                        }
                                    }
                                    const nonHevcResolutionList = streamInfo.ResolutionList.filter((element) => element.Codecs.startsWith('avc') || element.Codecs.startsWith('av0'));
                                    if (AlwaysReloadPlayerOnAd || (nonHevcResolutionList.length > 0 && streamInfo.ResolutionList.some((element) => element.Codecs.startsWith('hev') || element.Codecs.startsWith('hvc')) && !SkipPlayerReloadOnHevc)) {
                                        if (nonHevcResolutionList.length > 0) {
                                            for (let i = 0; i < lines.length - 1; i++) {
                                                if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                                                    const resSettings = parseAttributes(lines[i].substring(lines[i].indexOf(':') + 1));
                                                    const codecsKey = 'CODECS';
                                                    if (resSettings[codecsKey].startsWith('hev') || resSettings[codecsKey].startsWith('hvc')) {
                                                        const oldResolution = resSettings['RESOLUTION'];
                                                        const [targetWidth, targetHeight] = oldResolution.split('x').map(Number);
                                                        const newResolutionInfo = nonHevcResolutionList.sort((a, b) => {
                                                            // TODO: Take into account 'Frame-Rate' when sorting (i.e. 1080p60 vs 1080p30)
                                                            const [streamWidthA, streamHeightA] = a.Resolution.split('x').map(Number);
                                                            const [streamWidthB, streamHeightB] = b.Resolution.split('x').map(Number);
                                                            return Math.abs((streamWidthA * streamHeightA) - (targetWidth * targetHeight)) - Math.abs((streamWidthB * streamHeightB) - (targetWidth * targetHeight));
                                                        })[0];
                                                        console.log('[TSE-AdBlock]', 'ModifiedM3U8 swap ' + resSettings[codecsKey] + ' to ' + newResolutionInfo.Codecs + ' oldRes:' + oldResolution + ' newRes:' + newResolutionInfo.Resolution);
                                                        lines[i] = lines[i].replace(/CODECS="[^"]+"/, `CODECS="${newResolutionInfo.Codecs}"`);
                                                        lines[i + 1] = newResolutionInfo.Url + ' '.repeat(i + 1);// The stream doesn't load unless each url line is unique
                                                    }
                                                }
                                            }
                                        }
                                        if (nonHevcResolutionList.length > 0 || AlwaysReloadPlayerOnAd) {
                                            streamInfo.ModifiedM3U8 = lines.join('\n');
                                        }
                                    }
                                }
                                streamInfo.LastPlayerReload = Date.now();
                                resolve(new Response(replaceServerTimeInM3u8(streamInfo.IsUsingModifiedM3U8 ? streamInfo.ModifiedM3U8 : streamInfo.EncodingsM3U8, serverTime)));
                            } else {
                                resolve(response);
                            }
                        };
                        const send = function() {
                            return realFetch(url, options).then(function(response) {
                                processAfter(response);
                            })['catch'](function(err) {
                                reject(err);
                            });
                        };
                        send();
                    });
                }
            }
            return realFetch.apply(this, arguments);
        };
    }
    function getServerTimeFromM3u8(encodingsM3u8) {
        if (V2API) {
            const matches = encodingsM3u8.match(/#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="([^"]+)"/);
            return matches.length > 1 ? matches[1] : null;
        }
        const matches = encodingsM3u8.match('SERVER-TIME="([0-9.]+)"');
        return matches.length > 1 ? matches[1] : null;
    }
    function replaceServerTimeInM3u8(encodingsM3u8, newServerTime) {
        if (V2API) {
            return newServerTime ? encodingsM3u8.replace(/(#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE=")[^"]+(")/, `$1${newServerTime}$2`) : encodingsM3u8;
        }
        return newServerTime ? encodingsM3u8.replace(new RegExp('(SERVER-TIME=")[0-9.]+"'), `SERVER-TIME="${newServerTime}"`) : encodingsM3u8;
    }
    function stripAdSegments(textStr, stripAllSegments, streamInfo) {
        let hasStrippedAdSegments = false;
        const lines = textStr.replaceAll('\r', '').split('\n');
        const newAdUrl = 'https://twitch.tv';
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Remove tracking urls which appear in the overlay UI
            line = line
                .replaceAll(/(X-TV-TWITCH-AD-URL=")(?:[^"]*)(")/g, `$1${newAdUrl}$2`)
                .replaceAll(/(X-TV-TWITCH-AD-CLICK-TRACKING-URL=")(?:[^"]*)(")/g, `$1${newAdUrl}$2`);
            if (i < lines.length - 1 && line.startsWith('#EXTINF') && (!line.includes(',live') || stripAllSegments || AllSegmentsAreAdSegments)) {
                const segmentUrl = lines[i + 1];
                if (!AdSegmentCache.has(segmentUrl)) {
                    streamInfo.NumStrippedAdSegments++;
                }
                AdSegmentCache.set(segmentUrl, Date.now());
                hasStrippedAdSegments = true;
            }
            if (line.includes(AdSignifier)) {
                hasStrippedAdSegments = true;
            }
        }
        if (hasStrippedAdSegments) {
            for (let i = 0; i < lines.length; i++) {
                // No low latency during ads (otherwise it's possible for the player to prefetch and display ad segments)
                if (lines[i].startsWith('#EXT-X-TWITCH-PREFETCH:')) {
                    lines[i] = '';
                }
            }
        } else {
            streamInfo.NumStrippedAdSegments = 0;
        }
        streamInfo.IsStrippingAdSegments = hasStrippedAdSegments;
        AdSegmentCache.forEach((value, key, map) => {
            if (value < Date.now() - 120000) {
                map.delete(key);
            }
        });
        return lines.join('\n');
    }
    function getStreamUrlForResolution(encodingsM3u8, resolutionInfo) {
        const encodingsLines = encodingsM3u8.replaceAll('\r', '').split('\n');
        const [targetWidth, targetHeight] = resolutionInfo.Resolution.split('x').map(Number);
        let matchedResolutionUrl = null;
        let matchedFrameRate = false;
        let closestResolutionUrl = null;
        let closestResolutionDifference = Infinity;
        for (let i = 0; i < encodingsLines.length - 1; i++) {
            if (encodingsLines[i].startsWith('#EXT-X-STREAM-INF') && encodingsLines[i + 1].includes('.m3u8')) {
                const attributes = parseAttributes(encodingsLines[i]);
                const resolution = attributes['RESOLUTION'];
                const frameRate = attributes['FRAME-RATE'];
                if (resolution) {
                    if (resolution == resolutionInfo.Resolution && (!matchedResolutionUrl || (!matchedFrameRate && frameRate == resolutionInfo.FrameRate))) {
                        matchedResolutionUrl = encodingsLines[i + 1];
                        matchedFrameRate = frameRate == resolutionInfo.FrameRate;
                        if (matchedFrameRate) {
                            return matchedResolutionUrl;
                        }
                    }
                    const [width, height] = resolution.split('x').map(Number);
                    const difference = Math.abs((width * height) - (targetWidth * targetHeight));
                    if (difference < closestResolutionDifference) {
                        closestResolutionUrl = encodingsLines[i + 1];
                        closestResolutionDifference = difference;
                    }
                }
            }
        }
        return closestResolutionUrl;
    }
    async function processM3U8(url, textStr, realFetch) {
        const streamInfo = StreamInfosByUrl[url];
        if (!streamInfo) {
            return textStr;
        }
        if (HasTriggeredPlayerReload) {
            HasTriggeredPlayerReload = false;
            streamInfo.LastPlayerReload = Date.now();
        }
        const haveAdTags = textStr.includes(AdSignifier) || SimulatedAdsDepth > 0;
        if (haveAdTags) {
            streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
            if (!streamInfo.IsShowingAd) {
                streamInfo.IsShowingAd = true;
                postMessage({
                    key: 'UpdateAdBlockBanner',
                    isMidroll: streamInfo.IsMidroll,
                    hasAds: streamInfo.IsShowingAd,
                    isStrippingAdSegments: false
                });
            }
            if (!streamInfo.IsMidroll) {
                const lines = textStr.replaceAll('\r', '').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.startsWith('#EXTINF') && lines.length > i + 1) {
                        if (!line.includes(',live') && !streamInfo.RequestedAds.has(lines[i + 1])) {
                            // Only request one .ts file per .m3u8 request to avoid making too many requests
                            //console.log('Fetch ad .ts file');
                            streamInfo.RequestedAds.add(lines[i + 1]);
                            fetch(lines[i + 1]).then((response)=>{response.blob()});
                            break;
                        }
                    }
                }
            }
            const currentResolution = streamInfo.Urls[url];
            if (!currentResolution) {
                console.log('[TSE-AdBlock]', 'Ads will leak due to missing resolution info for ' + url);
                return textStr;
            }
            const isHevc = currentResolution.Codecs.startsWith('hev') || currentResolution.Codecs.startsWith('hvc');
            if (((isHevc && !SkipPlayerReloadOnHevc) || AlwaysReloadPlayerOnAd) && streamInfo.ModifiedM3U8 && !streamInfo.IsUsingModifiedM3U8) {
                streamInfo.IsUsingModifiedM3U8 = true;
                streamInfo.LastPlayerReload = Date.now();
                postMessage({
                    key: 'ReloadPlayer'
                });
            }
            let backupPlayerType = null;
            let backupM3u8 = null;
            let fallbackM3u8 = null;
            let startIndex = 0;
            let isDoingMinimalRequests = false;
            if (streamInfo.LastPlayerReload > Date.now() - PlayerReloadMinimalRequestsTime) {
                // When doing player reload there are a lot of requests which causes the backup stream to load in slow. Briefly prefer using a single version to prevent long delays
                startIndex = PlayerReloadMinimalRequestsPlayerIndex;
                isDoingMinimalRequests = true;
            }
            for (let playerTypeIndex = startIndex; !backupM3u8 && playerTypeIndex < BackupPlayerTypes.length; playerTypeIndex++) {
                const playerType = BackupPlayerTypes[playerTypeIndex];
                const realPlayerType = playerType.replace('-CACHED', '');
                const isFullyCachedPlayerType = playerType != realPlayerType;
                for (let i = 0; i < 2; i++) {
                    // This caches the m3u8 if it doesn't have ads. If the already existing cache has ads it fetches a new version (second loop)
                    let isFreshM3u8 = false;
                    let encodingsM3u8 = streamInfo.BackupEncodingsM3U8Cache[playerType];
                    if (!encodingsM3u8) {
                        isFreshM3u8 = true;
                        try {
                            const accessTokenResponse = await getAccessToken(streamInfo.ChannelName, realPlayerType);
                            if (accessTokenResponse.status === 200) {
                                const accessToken = await accessTokenResponse.json();
                                const urlInfo = new URL('https://usher.ttvnw.net/api/' + (V2API ? 'v2/' : '') + 'channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.UsherParams);
                                urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                                urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                                const encodingsM3u8Response = await realFetch(urlInfo.href);
                                if (encodingsM3u8Response.status === 200) {
                                    encodingsM3u8 = streamInfo.BackupEncodingsM3U8Cache[playerType] = await encodingsM3u8Response.text();
                                }
                            }
                        } catch (err) {}
                    }
                    if (encodingsM3u8) {
                        try {
                            const streamM3u8Url = getStreamUrlForResolution(encodingsM3u8, currentResolution);
                            const streamM3u8Response = await realFetch(streamM3u8Url);
                            if (streamM3u8Response.status == 200) {
                                const m3u8Text = await streamM3u8Response.text();
                                if (m3u8Text) {
                                    if (playerType == FallbackPlayerType) {
                                        fallbackM3u8 = m3u8Text;
                                    }
                                    if ((!m3u8Text.includes(AdSignifier) && (SimulatedAdsDepth == 0 || playerTypeIndex >= SimulatedAdsDepth - 1)) || (!fallbackM3u8 && playerTypeIndex >= BackupPlayerTypes.length - 1)) {
                                        backupPlayerType = playerType;
                                        backupM3u8 = m3u8Text;
                                        break;
                                    }
                                    if (isFullyCachedPlayerType) {
                                        break;
                                    }
                                    if (isDoingMinimalRequests) {
                                        backupPlayerType = playerType;
                                        backupM3u8 = m3u8Text;
                                        break;
                                    }
                                }
                            }
                        } catch (err) {}
                    }
                    streamInfo.BackupEncodingsM3U8Cache[playerType] = null;
                    if (isFreshM3u8) {
                        break;
                    }
                }
            }
            if (!backupM3u8 && fallbackM3u8) {
                backupPlayerType = FallbackPlayerType;
                backupM3u8 = fallbackM3u8;
            }
            if (backupM3u8) {
                textStr = backupM3u8;
                if (streamInfo.ActiveBackupPlayerType != backupPlayerType) {
                    streamInfo.ActiveBackupPlayerType = backupPlayerType;
                    console.log('[TSE-AdBlock]', `Blocking${(streamInfo.IsMidroll ? ' midroll ' : ' ')}ads (${backupPlayerType})`);
                }
            }
            // TODO: Improve hevc stripping. It should always strip when there is a codec mismatch (both ways)
            const stripHevc = isHevc && streamInfo.ModifiedM3U8;
            if (IsAdStrippingEnabled || stripHevc) {
                textStr = stripAdSegments(textStr, stripHevc, streamInfo);
            }
        } else if (streamInfo.IsShowingAd) {
            console.log('[TSE-AdBlock]', 'Finished blocking ads');
            streamInfo.IsShowingAd = false;
            streamInfo.IsStrippingAdSegments = false;
            streamInfo.NumStrippedAdSegments = 0;
            streamInfo.ActiveBackupPlayerType = null;
            if (streamInfo.IsUsingModifiedM3U8 || ReloadPlayerAfterAd) {
                streamInfo.IsUsingModifiedM3U8 = false;
                streamInfo.LastPlayerReload = Date.now();
                postMessage({
                    key: 'ReloadPlayer'
                });
            } else {
                postMessage({
                    key: 'PauseResumePlayer'
                });
            }
        }
        postMessage({
            key: 'UpdateAdBlockBanner',
            isMidroll: streamInfo.IsMidroll,
            hasAds: streamInfo.IsShowingAd,
            isStrippingAdSegments: streamInfo.IsStrippingAdSegments,
            numStrippedAdSegments: streamInfo.NumStrippedAdSegments
        });
        return textStr;
    }
    function parseAttributes(str) {
        return Object.fromEntries(
            str.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/)
            .filter(Boolean)
            .map(x => {
                const idx = x.indexOf('=');
                const key = x.substring(0, idx);
                const value = x.substring(idx + 1);
                const num = Number(value);
                return [key, Number.isNaN(num) ? value.startsWith('"') ? JSON.parse(value) : value : num];
            }));
    }
    function getAccessToken(channelName, playerType) {
        const body = {
            operationName: 'PlaybackAccessToken',
            variables: {
                isLive: true,
                login: channelName,
                isVod: false,
                vodID: "",
                playerType: playerType,
                platform: playerType == 'autoplay' ? 'android' : 'web'
            },
            extensions: {
                persistedQuery: {
                    version:1,
                    sha256Hash:"ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9"
                }
            }
        };
        return gqlRequest(body, playerType);
    }
    function gqlRequest(body, playerType) {
        if (!GQLDeviceID) {
            GQLDeviceID = '';
            const dcharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
            const dcharactersLength = dcharacters.length;
            for (let i = 0; i < 32; i++) {
                GQLDeviceID += dcharacters.charAt(Math.floor(Math.random() * dcharactersLength));
            }
        }
        let headers = {
            'Client-ID': ClientID,
            'X-Device-Id': GQLDeviceID,
            'Authorization': AuthorizationHeader,
            ...(ClientIntegrityHeader && {'Client-Integrity': ClientIntegrityHeader}),
            ...(ClientVersion && {'Client-Version': ClientVersion}),
            ...(ClientSession && {'Client-Session-Id': ClientSession})
        };
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(2, 15);
            const fetchRequest = {
                id: requestId,
                url: 'https://gql.twitch.tv/gql',
                options: {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers
                }
            };
            pendingFetchRequests.set(requestId, {
                resolve,
                reject
            });
            postMessage({
                key: 'FetchRequest',
                value: fetchRequest
            });
        });
    }
    let playerForMonitoringBuffering = null;
    const playerBufferState = {
        channelName: null,
        hasStreamStarted: false,
        position: 0,
        bufferedPosition: 0,
        bufferDuration: 0,
        numSame: 0,
        lastFixTime: 0,
        isLive: true
    };
    function monitorPlayerBuffering() {
        if (playerForMonitoringBuffering) {
            try {
                const player = playerForMonitoringBuffering.player;
                const state = playerForMonitoringBuffering.state;
                if (!player.core) {
                    playerForMonitoringBuffering = null;
                } else if (state.props?.content?.type === 'live' && !player.isPaused() && !player.getHTMLVideoElement()?.ended && playerBufferState.lastFixTime <= Date.now() - PlayerBufferingMinRepeatDelay && !isActivelyStrippingAds) {
                    const m3u8Url = player.core?.state?.path;
                    if (m3u8Url) {
                      const fileName = new URL(m3u8Url).pathname.split('/').pop();
                      if (fileName?.endsWith('.m3u8')) {
                          const channelName = fileName.slice(0, -5);
                          if (playerBufferState.channelName != channelName) {
                              playerBufferState.channelName = channelName;
                              playerBufferState.hasStreamStarted = false;
                              playerBufferState.numSame = 0;
                              //console.log('Channel changed to ' + channelName);
                          }
                      }
                    }
                    if (player.getState() === 'Playing') {
                        playerBufferState.hasStreamStarted = true;
                    }
                    const position = player.core?.state?.position;
                    const bufferedPosition = player.core?.state?.bufferedPosition;
                    const bufferDuration = player.getBufferDuration();
                    if (position !== undefined && bufferedPosition !== undefined) {
                        //console.log('position:' + position + ' bufferDuration:' + bufferDuration + ' bufferPosition:' + bufferedPosition + ' state: ' + player.core?.state?.state + ' started: ' + playerBufferState.hasStreamStarted);
                        // NOTE: This could be improved. It currently lets the player fully eat the full buffer before it triggers pause/play
                        if (playerBufferState.hasStreamStarted &&
                            (!PlayerBufferingPrerollCheckEnabled || position > PlayerBufferingPrerollCheckOffset) &&
                            (playerBufferState.position == position || bufferDuration < PlayerBufferingDangerZone)  &&
                            playerBufferState.bufferedPosition == bufferedPosition &&
                            playerBufferState.bufferDuration >= bufferDuration &&
                            (position != 0 || bufferedPosition != 0 || bufferDuration != 0)
                        ) {
                            playerBufferState.numSame++;
                            if (playerBufferState.numSame == PlayerBufferingSameStateCount) {
                                console.log('[TSE-AdBlock]', 'Attempt to fix buffering position:' + playerBufferState.position + ' bufferedPosition:' + playerBufferState.bufferedPosition + ' bufferDuration:' + playerBufferState.bufferDuration);
                                const isPausePlay = !PlayerBufferingDoPlayerReload;
                                const isReload = PlayerBufferingDoPlayerReload;
                                doTwitchPlayerTask(isPausePlay, isReload);
                                playerBufferState.lastFixTime = Date.now();
                                playerBufferState.numSame = 0;
                            }
                        } else {
                            playerBufferState.numSame = 0;
                        }
                        playerBufferState.position = position;
                        playerBufferState.bufferedPosition = bufferedPosition;
                        playerBufferState.bufferDuration = bufferDuration;
                    } else {
                        playerBufferState.numSame = 0;
                    }
                }
            } catch (err) {
                console.error('[TSE-AdBlock]', 'error when monitoring player for buffering: ' + err);
                playerForMonitoringBuffering = null;
            }
        }
        if (!playerForMonitoringBuffering) {
            const playerAndState = getPlayerAndState();
            if (playerAndState && playerAndState.player && playerAndState.state) {
                playerForMonitoringBuffering = {
                    player: playerAndState.player,
                    state: playerAndState.state
                };
            }
        }
        const isLive = playerForMonitoringBuffering?.state?.props?.content?.type === 'live';
        if (playerBufferState.isLive && !isLive) {
            updateAdblockBanner({
                hasAds: false
            });
        }
        playerBufferState.isLive = isLive;
        setTimeout(monitorPlayerBuffering, PlayerBufferingDelay);
    }
    function updateAdblockBanner(data) {
        const playerRootDiv = document.querySelector('.video-player');
        if (playerRootDiv != null) {
            let adBlockDiv = null;
            adBlockDiv = playerRootDiv.querySelector('.adblock-overlay');
            if (adBlockDiv == null) {
                adBlockDiv = document.createElement('div');
                adBlockDiv.className = 'adblock-overlay';
                adBlockDiv.innerHTML = '<div class="player-adblock-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 5px;"><p></p></div>';
                adBlockDiv.style.display = 'none';
                adBlockDiv.P = adBlockDiv.querySelector('p');
                playerRootDiv.appendChild(adBlockDiv);
            }
            if (adBlockDiv != null) {
                isActivelyStrippingAds = data.isStrippingAdSegments;
                adBlockDiv.P.textContent = 'Blocking' + (data.isMidroll ? ' midroll' : '') + ' ads' + (data.isStrippingAdSegments ? ' (stripping)' : '');// + (data.numStrippedAdSegments > 0 ? ` (${data.numStrippedAdSegments})` : '');
                adBlockDiv.style.display = data.hasAds && playerBufferState.isLive ? 'block' : 'none';
            }
        }
    }
    function getPlayerAndState() {
        function findReactNode(root, constraint) {
            if (root.stateNode && constraint(root.stateNode)) {
                return root.stateNode;
            }
            let node = root.child;
            while (node) {
                const result = findReactNode(node, constraint);
                if (result) {
                    return result;
                }
                node = node.sibling;
            }
            return null;
        }
        function findReactRootNode() {
            let reactRootNode = null;
            const rootNode = document.querySelector('#root');
            if (rootNode && rootNode._reactRootContainer && rootNode._reactRootContainer._internalRoot && rootNode._reactRootContainer._internalRoot.current) {
                reactRootNode = rootNode._reactRootContainer._internalRoot.current;
            }
            if (reactRootNode == null && rootNode != null) {
                const containerName = Object.keys(rootNode).find(x => x.startsWith('__reactContainer'));
                if (containerName != null) {
                    reactRootNode = rootNode[containerName];
                }
            }
            return reactRootNode;
        }
        const reactRootNode = findReactRootNode();
        if (!reactRootNode) {
            return null;
        }
        let player = findReactNode(reactRootNode, node => node.setPlayerActive && node.props && node.props.mediaPlayerInstance);
        player = player && player.props && player.props.mediaPlayerInstance ? player.props.mediaPlayerInstance : null;
        if (player?.playerInstance) {
            player = player.playerInstance;
        }
        const playerState = findReactNode(reactRootNode, node => node.setSrc && node.setInitialPlaybackSettings);
        return  {
            player: player,
            state: playerState
        };
    }
    function doTwitchPlayerTask(isPausePlay, isReload) {
        const playerAndState = getPlayerAndState();
        if (!playerAndState) {
            console.log('[TSE-AdBlock]', 'Could not find react root');
            return;
        }
        const player = playerAndState.player;
        const playerState = playerAndState.state;
        if (!player) {
            console.log('[TSE-AdBlock]', 'Could not find player');
            return;
        }
        if (!playerState) {
            console.log('[TSE-AdBlock]', 'Could not find player state');
            return;
        }
        if (player.isPaused() || player.core?.paused) {
            return;
        }
        playerBufferState.lastFixTime = Date.now();
        playerBufferState.numSame = 0;
        if (isPausePlay) {
            player.pause();
            player.play();
            return;
        }
        if (isReload) {
            const lsKeyQuality = 'video-quality';
            const lsKeyMuted = 'video-muted';
            const lsKeyVolume = 'volume';
            let currentQualityLS = null;
            let currentMutedLS = null;
            let currentVolumeLS = null;
            try {
                currentQualityLS = localStorage.getItem(lsKeyQuality);
                currentMutedLS = localStorage.getItem(lsKeyMuted);
                currentVolumeLS = localStorage.getItem(lsKeyVolume);
                if (localStorageHookFailed && player?.core?.state) {
                    localStorage.setItem(lsKeyMuted, JSON.stringify({default:player.core.state.muted}));
                    localStorage.setItem(lsKeyVolume, player.core.state.volume);
                }
                if (localStorageHookFailed && player?.core?.state?.quality?.group) {
                    localStorage.setItem(lsKeyQuality, JSON.stringify({default:player.core.state.quality.group}));
                }
            } catch {}
            console.log('[TSE-AdBlock]', 'Reloading Twitch player');
            playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
            postTwitchWorkerMessage('TriggeredPlayerReload');
            player.play();
            if (localStorageHookFailed && (currentQualityLS || currentMutedLS || currentVolumeLS)) {
                setTimeout(() => {
                    try {
                        if (currentQualityLS) {
                            localStorage.setItem(lsKeyQuality, currentQualityLS);
                        }
                        if (currentMutedLS) {
                            localStorage.setItem(lsKeyMuted, currentMutedLS);
                        }
                        if (currentVolumeLS) {
                            localStorage.setItem(lsKeyVolume, currentVolumeLS);
                        }
                    } catch {}
                }, 3000);
            }
            return;
        }
    }
    window.reloadTwitchPlayer = () => {
        doTwitchPlayerTask(false, true);
    };
    function postTwitchWorkerMessage(key, value) {
        twitchWorkers.forEach((worker) => {
            worker.postMessage({key: key, value: value});
        });
    }
    async function handleWorkerFetchRequest(fetchRequest) {
        try {
            const response = await window.realFetch(fetchRequest.url, fetchRequest.options);
            const responseBody = await response.text();
            const responseObject = {
                id: fetchRequest.id,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody
            };
            return responseObject;
        } catch (error) {
            return {
                id: fetchRequest.id,
                error: error.message
            };
        }
    }
    function hookFetch() {
        const realFetch = window.fetch;
        window.realFetch = realFetch;
        window.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                if (url.includes('gql')) {
                    let deviceId = init.headers['X-Device-Id'];
                    if (typeof deviceId !== 'string') {
                        deviceId = init.headers['Device-ID'];
                    }
                    if (typeof deviceId === 'string' && GQLDeviceID != deviceId) {
                        GQLDeviceID = deviceId;
                        postTwitchWorkerMessage('UpdateDeviceId', GQLDeviceID);
                    }
                    if (typeof init.headers['Client-Version'] === 'string' && init.headers['Client-Version'] !== ClientVersion) {
                        postTwitchWorkerMessage('UpdateClientVersion', ClientVersion = init.headers['Client-Version']);
                    }
                    if (typeof init.headers['Client-Session-Id'] === 'string' && init.headers['Client-Session-Id'] !== ClientSession) {
                        postTwitchWorkerMessage('UpdateClientSession', ClientSession = init.headers['Client-Session-Id']);
                    }
                    if (typeof init.headers['Client-Integrity'] === 'string' && init.headers['Client-Integrity'] !== ClientIntegrityHeader) {
                        postTwitchWorkerMessage('UpdateClientIntegrityHeader', ClientIntegrityHeader = init.headers['Client-Integrity']);
                    }
                    if (typeof init.headers['Authorization'] === 'string' && init.headers['Authorization'] !== AuthorizationHeader) {
                        postTwitchWorkerMessage('UpdateAuthorizationHeader', AuthorizationHeader = init.headers['Authorization']);
                    }
                    // Get rid of mini player above chat - TODO: Reject this locally instead of having server reject it
                    if (init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken') && init.body.includes('picture-by-picture')) {
                        init.body = '';
                    }
                    if (ForceAccessTokenPlayerType && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                        let replacedPlayerType = '';
                        const newBody = JSON.parse(init.body);
                        if (Array.isArray(newBody)) {
                            for (let i = 0; i < newBody.length; i++) {
                                if (newBody[i]?.variables?.playerType && newBody[i]?.variables?.playerType !== ForceAccessTokenPlayerType) {
                                    replacedPlayerType = newBody[i].variables.playerType;
                                    newBody[i].variables.playerType = ForceAccessTokenPlayerType;
                                }
                            }
                        } else {
                            if (newBody?.variables?.playerType && newBody?.variables?.playerType !== ForceAccessTokenPlayerType) {
                                replacedPlayerType = newBody.variables.playerType;
                                newBody.variables.playerType = ForceAccessTokenPlayerType;
                            }
                        }
                        if (replacedPlayerType) {
                            console.log('[TSE-AdBlock]', `Replaced '${replacedPlayerType}' player type with '${ForceAccessTokenPlayerType}' player type`);
                            init.body = JSON.stringify(newBody);
                        }
                    }
                }
            }
            return realFetch.apply(this, arguments);
        };
    }
    function onContentLoaded() {
        // This stops Twitch from pausing the player when in another tab and an ad shows.
        // Taken from https://github.com/saucettv/VideoAdBlockForTwitch/blob/cefce9d2b565769c77e3666ac8234c3acfe20d83/chrome/content.js#L30
        try {
            Object.defineProperty(document, 'visibilityState', {
                get() {
                    return 'visible';
                }
            });
        }catch{}
        let hidden = document.__lookupGetter__('hidden');
        let webkitHidden = document.__lookupGetter__('webkitHidden');
        try {
            Object.defineProperty(document, 'hidden', {
                get() {
                    return false;
                }
            });
        }catch{}
        const block = e => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        let wasVideoPlaying = true;
        const visibilityChange = e => {
            const isChrome = typeof chrome !== 'undefined';
            const videos = document.getElementsByTagName('video');
            if (videos.length > 0) {
                if (hidden.apply(document) === true || (webkitHidden && webkitHidden.apply(document) === true)) {
                    wasVideoPlaying = !videos[0].paused && !videos[0].ended;
                } else {
                    if (!playerBufferState.hasStreamStarted) {
                        //console.log('Tab focused. Stream should be active');
                        playerBufferState.hasStreamStarted = true;
                    }
                    if (isChrome && wasVideoPlaying && !videos[0].ended && videos[0].paused && videos[0].muted) {
                        videos[0].play();
                    }
                }
            }
            block(e);
        };
        document.addEventListener('visibilitychange', visibilityChange, true);
        document.addEventListener('webkitvisibilitychange', visibilityChange, true);
        document.addEventListener('mozvisibilitychange', visibilityChange, true);
        document.addEventListener('hasFocus', block, true);
        try {
            if (/Firefox/.test(navigator.userAgent)) {
                Object.defineProperty(document, 'mozHidden', {
                    get() {
                        return false;
                    }
                });
            } else {
                Object.defineProperty(document, 'webkitHidden', {
                    get() {
                        return false;
                    }
                });
            }
        }catch{}
        // Hooks for preserving volume / resolution
        try {
            const keysToCache = [
                'video-quality',
                'video-muted',
                'volume',
                'lowLatencyModeEnabled',// Low Latency
                'persistenceEnabled',// Mini Player
            ];
            const cachedValues = new Map();
            for (let i = 0; i < keysToCache.length; i++) {
                cachedValues.set(keysToCache[i], localStorage.getItem(keysToCache[i]));
            }
            const realSetItem = localStorage.setItem;
            localStorage.setItem = function(key, value) {
                if (cachedValues.has(key)) {
                    cachedValues.set(key, value);
                }
                realSetItem.apply(this, arguments);
            };
            const realGetItem = localStorage.getItem;
            localStorage.getItem = function(key) {
                if (cachedValues.has(key)) {
                    return cachedValues.get(key);
                }
                return realGetItem.apply(this, arguments);
            };
            if (!localStorage.getItem.toString().includes(Object.keys({cachedValues})[0])) {
                // These hooks are useful to preserve player state on player reload
                // Firefox doesn't allow hooking of localStorage functions but chrome does
                localStorageHookFailed = true;
            }
        } catch (err) {
            console.log('[TSE-AdBlock]', 'localStorageHooks failed ' + err)
            localStorageHookFailed = true;
        }
    }
    declareOptions(window);
    hookWindowWorker();
    hookFetch();
    if (PlayerBufferingFix) {
        monitorPlayerBuffering();
    }
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        window.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
    window.simulateAds = (depth) => {
        if (depth === undefined || depth < 0) {
            console.log('[TSE-AdBlock]', 'Ad depth paramter required (0 = no simulated ad, 1+ = use backup player for given depth)');
            return;
        }
        postTwitchWorkerMessage('SimulateAds', depth);
    };
    window.allSegmentsAreAdSegments = () => {
        postTwitchWorkerMessage('AllSegmentsAreAdSegments');
    };
})();

(() => {
  'use strict';

  // Garde top-level : le code TSE n'a rien à faire dans une iframe
  // (cf. commentaire d'intro du module anti-pub vaft pour le pourquoi
  // de @allFrames true au header). Try/catch contre une SecurityError
  // théorique sur frames cross-origin.
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
      consoleHealthBroken:       '[tse] Des sélecteurs critiques ne correspondent plus au DOM de Twitch — l\'extension est peut-être partiellement cassée. Détails : tse.diagnose()',
      consoleHealthAllOk:        '[tse] Tous les sélecteurs critiques répondent.',
      consoleColProbe:           'sonde',
      consoleColStatus:          'état',
      consoleColDetail:          'détail',
      consoleHealthTagBroken:    'CASSÉ',
      consoleHealthTagNa:        'N/A',
      locale:                    'fr-FR',
    }),
    en: Object.freeze({
      followedLabel:             'Followed Channels',
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
      consoleHealthBroken:       '[tse] Some critical selectors no longer match Twitch\'s DOM — the extension may be partially broken. Details: tse.diagnose()',
      consoleHealthAllOk:        '[tse] All critical selectors are responding.',
      consoleColProbe:           'probe',
      consoleColStatus:          'status',
      consoleColDetail:          'detail',
      consoleHealthTagBroken:    'BROKEN',
      consoleHealthTagNa:        'N/A',
      locale:                    'en-US',
    }),
    de: Object.freeze({
      followedLabel:             'Gefolgte Kanäle',
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
      consoleHealthBroken:       '[tse] Einige kritische Selektoren stimmen nicht mehr mit dem DOM von Twitch überein — die Erweiterung ist möglicherweise teilweise defekt. Details: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Alle kritischen Selektoren reagieren.',
      consoleColProbe:           'Sonde',
      consoleColStatus:          'Status',
      consoleColDetail:          'Detail',
      consoleHealthTagBroken:    'DEFEKT',
      consoleHealthTagNa:        'N/V',
      locale:                    'de-DE',
    }),
    es: Object.freeze({
      followedLabel:             'Canales que sigues',
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
      consoleHealthBroken:       '[tse] Algunos selectores críticos ya no coinciden con el DOM de Twitch — puede que la extensión esté parcialmente rota. Detalles: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Todos los selectores críticos responden.',
      consoleColProbe:           'sonda',
      consoleColStatus:          'estado',
      consoleColDetail:          'detalle',
      consoleHealthTagBroken:    'ROTO',
      consoleHealthTagNa:        'N/D',
      locale:                    'es-MX',
    }),
    pt: Object.freeze({
      followedLabel:             'Canais seguidos',
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
      consoleHealthBroken:       '[tse] Alguns seletores críticos não correspondem mais ao DOM da Twitch — a extensão pode estar parcialmente quebrada. Detalhes: tse.diagnose()',
      consoleHealthAllOk:        '[tse] Todos os seletores críticos estão respondendo.',
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
    // Nombre max d'opérations par POST GraphQL. Twitch plafonne la taille des
    // lots batchés : au-delà, c'est le lot ENTIER qui est rejeté, et tous les
    // logins qu'il portait retombent en UPTIME_UNKNOWN (sidebar figée sur son
    // dernier état, sans signe visible de panne). On découpe donc en tranches,
    // envoyées en parallèle et évaluées INDÉPENDAMMENT : l'échec d'une tranche
    // ne coûte que les logins de cette tranche.
    GQL_MAX_BATCH:  25,
    // Persisted query "GuestStarBatchCollaborationQuery" : source FIABLE des
    // co-streams "Streamer ensemble" (host.id partagé entre participants).
    // Capté sur le trafic gql.twitch.tv ; repli heuristique si le hash devient
    // obsolète (cf. module Guest Star / detectCoStreams).
    GUEST_STAR_HASH:           '096d50357df5e938f4fa83fe2acf25cb0f4886149aa81ddb9754eae98c05f2dd',
    GUEST_STAR_TTL:            30_000,   // ms — fraîcheur d'une session co-stream en cache
    GUEST_STAR_DEBOUNCE:       300,      // ms — fenêtre de regroupement des IDs avant fetch
    GUEST_STAR_ERROR_COOLDOWN: 30_000,   // ms — pause après échec (réseau / hash obsolète)
    // Délai de grâce avant de LIBÉRER la couleur d'un co-stream devenu inactif.
    // Absorbe les disparitions transitoires (rebuild DOM de Twitch, fenêtre de
    // refetch) : tant qu'une collaboration réapparaît dans ce délai, elle
    // conserve EXACTEMENT la même couleur.
    COSTREAM_COLOR_GRACE:      60_000,   // ms
    BATCH_DELAY:    250,
    UI_TICK:        60_000,
    // ─── Cadence de fraîcheur ─────────────────────────────────────────
    // LIVE_TTL est LA constante qui détermine à quel point la sidebar colle
    // au direct : durée de validité d'une réponse TseChannel (statut live,
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
    // jamais rien. Aligné sur LIVE_TTL — le scan trouve les entrées tout juste
    // périmées et les remet en file.
    REFRESH_TICK:   30_000,
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
    // Pause après l'échec d'un lot TseChannel (réseau coupé, throttle, lot
    // rejeté). Indispensable depuis que les cartes ne portent plus de garde
    // qui bloque leur re-fetch : sans cooldown, chaque scan reconstituerait
    // aussitôt la file, et une panne réseau se traduirait par un lot toutes
    // les SCAN_DEBOUNCE — soit un martèlement à 4 requêtes/seconde pendant
    // toute la durée de la panne. Aligné sur LIVE_TTL : dans le cas normal
    // on aurait de toute façon attendu ce délai, la pause ne coûte rien.
    GQL_ERROR_COOLDOWN: 30_000,
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

    // === Aperçu au survol ===
    // Largeur cible de l'aperçu. Le ratio 16:9 est respecté pour le wrapper.
    PREVIEW_THUMB_WIDTH:  480,
    PREVIEW_THUMB_HEIGHT: 270,
    // Délai avant de basculer du JPEG statique au player iframe. Permet
    // de ne pas spawner d'iframes si l'utilisateur balaie plusieurs cartes
    // rapidement (un iframe player Twitch = ~5-10 MB de RAM).
    PREVIEW_IFRAME_DELAY: 150,
    // Quality demandée à player.twitch.tv. "360p30" est le sweet spot pour
    // un aperçu : bande passante raisonnable, qualité suffisante. Valeurs
    // valides : 'auto' | '160p30' | '360p30' | '480p30' | '720p30' | 'chunked'.
    PREVIEW_IFRAME_QUALITY: '360p30',
    // Délai max d'attente du chargement de l'iframe avant fallback JPEG.
    PREVIEW_IFRAME_TIMEOUT_MS: 3_000,

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
    filterDriver:   null   // facette pilotée par l'utilisateur : 'category' | 'language' | null
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
      background: #000;
    }
    .tse-preview__thumb {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* L'iframe player est superposé au JPEG dans le même wrapper.
       Invisible par défaut (data-tse-loaded="false"), apparaît en
       fade-in une fois le player chargé. Si l'iframe est démonté
       (timeout, fermeture), le JPEG reste visible en fallback. */
    .tse-preview__iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      opacity: 0;
      transition: opacity 0.2s ease;
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
   *  UNE seule opération (TseChannel) porte tout ce dont la sidebar
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

  const TSE_CHANNEL_QUERY =
    'query TseChannel($channelLogin: String!) {' +
    '  user(login: $channelLogin) {' +
    '    id' +
    '    login' +
    '    stream {' +
    '      id createdAt viewersCount' +
    '      game { id name }' +
    '      freeformTags { name }' +
    '    }' +
    '  }' +
    '}';

  const buildChannelOp = (login) => ({
    operationName: 'TseChannel',
    variables: { channelLogin: login },
    query: TSE_CHANNEL_QUERY
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
    const slices = chunk(logins, CFG.GQL_MAX_BATCH);
    const responses = await Promise.all(slices.map(s => post(s.map(buildChannelOp))));

    const now = Date.now();
    let fresh = 0;

    slices.forEach((slice, si) => {
      const results = responses[si];

      // Tranche HS → ne pas écraser le cache, ne pas marquer les cartes
      // hors-ligne : les appelants reçoivent la sentinelle "on ne sait pas".
      // L'échec vaut aussi signal de santé réseau : on ouvre une pause pendant
      // laquelle plus rien n'est mis en file (cf. GQL_ERROR_COOLDOWN).
      if (isResultsUnusable(results)) {
        gqlCooldownUntil = Date.now() + CFG.GQL_ERROR_COOLDOWN;
        slice.forEach(login => {
          (pending.get(login) || []).forEach(fn => fn(UPTIME_UNKNOWN));
        });
        return;
      }

      slice.forEach((login, i) => {
        const user   = results?.[i]?.data?.user;
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
          ts:      now
        };
        cache.set(login, entry);
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
   *  HELPERS
   * ============================================================ */
  const RESERVED = /^(directory|videos|search|p|drops|wallet|prime|subscriptions|settings|jobs|turbo|moderator|payments|inventory|messages|friends)$/i;

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
  const followedSection = () =>
    document.querySelector(DOM.followedSelector) ||
    document.querySelector(`${DOM.sidebarRoot} ${DOM.followedHeaderSelector}`)
      ?.closest('.side-nav-section') ||
    null;

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
      stabilityTimer = setTimeout(finish, CFG.LOADING_STABILITY_MS);
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
    const notifyScan = (hadOfflineActivity, cardCount) => {
      if (!cycleActive) return false;
      const stillGrowing = cardCount > lastCardCount;
      if (cardCount > lastCardCount) lastCardCount = cardCount;
      const ready = cardCount > 0 && !hadOfflineActivity && !stillGrowing;
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
    const startCycle = () => {
      if (cycleActive) return;
      cycleActive = true;
      lastCardCount = 0; // croissance mesurée à partir de zéro pour ce cycle

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
      timeoutTimer = setTimeout(finish, CFG.LOADING_TIMEOUT_MS);
    };

    const init = () => {
      // Démarre un premier cycle immédiatement (le boot Twitch va monter
      // la sidebar et déclencher les scans).
      startCycle();

      // Observer GLOBAL permanent : détecte les disparitions/réapparitions
      // de #side-nav pour redéclencher un cycle au retour de /stories ou
      // autres pages plein-écran qui retirent la sidebar du DOM.
      // Indépendant du cycleObserver (qui est tué entre les cycles).
      wasPresent = !!document.querySelector(DOM.sidebarRoot);
      globalObserver = new MutationObserver(() => {
        const present = !!document.querySelector(DOM.sidebarRoot);
        if (present && !wasPresent && !cycleActive) {
          // #side-nav réapparaît après une absence → nouveau cycle.
          startCycle();
        }
        wasPresent = present;
      });
      globalObserver.observe(document.body, { childList: true, subtree: true });
    };

    return { init, notifyScan, bumpActivity, startCycle };
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
      console.log(S.consoleHistoryCleared);
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
   * Écrit la catégorie fraîche (issue de TseChannel) dans la carte, quand elle
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
    if (el.hasAttribute('title') && (el.getAttribute('title') || '').trim() !== name) {
      el.setAttribute('title', name);
    }
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

  const applyCollabBadge = (card) => {
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
      const avatar = avatarOf(card);
      if (avatar) {
        const stale = avatar.querySelector(':scope > .tse-collab-badge');
        if (stale) stale.remove();
        avatar.classList.remove('tse-collab-host');
      }
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
   *  nôtre, alimenté par TseChannel toutes les LIVE_TTL.
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

  const renderViewers = (card, count) => {
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
    setText(span, formatViewers(count));
    // Pose le marqueur qui masque le compteur natif (cf. CSS). Fait seulement
    // maintenant : tant qu'on n'a pas de valeur, celui de Twitch reste visible.
    if (card.dataset.tseViewers !== String(count)) {
      card.dataset.tseViewers = String(count);
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

  // Nombre de viewers comparable. Valeur exacte issue de TseChannel dès
  // qu'elle est connue ; repli sur l'analyse du texte natif tant qu'elle ne
  // l'est pas (premier rendu, sections hors « suivis », requête en vol).
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

  const preview = (() => {
    let el = null;             // élément popup (singleton)
    let iframeTimer = null;    // setTimeout avant injection de l'iframe
    let iframeLoadTimer = null;// timeout de chargement de l'iframe
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

    // URL du JPEG statique servi par le CDN Twitch (affichage immédiat
    // avant que l'iframe player ne soit prêt).
    const buildThumbUrl = (login) =>
      `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}` +
      `-${CFG.PREVIEW_THUMB_WIDTH}x${CFG.PREVIEW_THUMB_HEIGHT}.jpg` +
      `?_=${Date.now()}`;

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
      // L'iframe est masqué via CSS tant que dataset.tseLoaded != 'true'.
      // On positionne l'attribut au load réussi (cf. listener ci-dessous).

      iframe.addEventListener('load', () => {
        if (iframeLoadTimer) { clearTimeout(iframeLoadTimer); iframeLoadTimer = null; }
        // Vérifie que le popup n'a pas été refermé entre-temps.
        if (currentLogin !== login || !iframe.isConnected) return;
        iframe.dataset.tseLoaded = 'true';
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
   * Applique à une carte une entrée de cache TseChannel (ou la sentinelle
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
      // Données fraîches issues de la même réponse.
      renderViewers(card, data.viewers);
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
    // rien dit. Une fois la valeur de TseChannel posée (applyChannelData), on
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

    const cards = section.querySelectorAll('.side-nav-card');
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

      if (filterActive) {
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
    const current = (root.textContent || '').trim();
    if (current === S.followedLabel) {
      root.dataset.tseRenamed = 'true';
      return;
    }
    root.textContent = S.followedLabel;
    root.dataset.tseRenamed = 'true';
  }

  /**
   * Fallback JS pour masquer le header natif Twitch quand le sélecteur CSS
   * ne le couvre pas (renaming des classes hashées par Twitch). On identifie
   * l'élément par son contenu textuel — il contient soit "Spectateurs", soit
   * "Recommandées" — et on remonte au wrapper qui porte l'attribut
   * aria-expanded (= le trigger du modal). Marquage idempotent via dataset.
   */
  function hideNativeFollowedHeader() {
    const section = followedSection();
    if (!section) return;
    const triggers = section.querySelectorAll('button[aria-expanded]');
    for (const btn of triggers) {
      if (btn.dataset.tseNativeHeader === 'hidden') continue;
      const txt = (btn.textContent || '');
      if (!DOM.nativeHeaderRe.test(txt)) continue;
      // On masque le bloc parent (header complet) plutôt que juste le bouton,
      // pour effacer aussi les icônes de tri et le wrapper visuel.
      const block = btn.closest('div[class*="followed-side-nav-header"]') || btn.parentElement;
      if (block) block.setAttribute('data-tse-native-header', 'hidden');
      btn.dataset.tseNativeHeader = 'hidden';
    }
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
  function rebuildDropdown(dd, values, counts, current, disabled, kind) {
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
        + `<span class="tse-dd-n">${counts.get(v) || 0} |</span>${itemLabel(v)}</div>`).join('');
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
   * Lit aussi les langues (langStore, cache TseChannel) et les mémorise sur
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
      const resolved = langStore.getLangs(login); // lecture du cache TseChannel
      if (resolved) card.dataset.tseLangs = resolved.length ? '|' + resolved.join('|') + '|' : '';
      const langs = (card.dataset.tseLangs || '').split('|').filter(Boolean);
      records.push({ cat: card.dataset.tseCategory || '', langs });
    });

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
  const COSTREAM_PALETTE = [
    { color: '#f5c518', bg: 'rgba(245, 197, 24, 0.18)',  fade: 'rgba(245, 197, 24, 0.06)'  }, // jaune
    { color: '#ffa94d', bg: 'rgba(255, 169, 77, 0.18)',  fade: 'rgba(255, 169, 77, 0.06)'  }, // orange clair
    { color: '#4dc4ff', bg: 'rgba(77, 196, 255, 0.18)',  fade: 'rgba(77, 196, 255, 0.06)'  }, // bleu clair
    { color: '#5cdf8a', bg: 'rgba(92, 223, 138, 0.18)',  fade: 'rgba(92, 223, 138, 0.06)'  }, // vert clair
    { color: '#ff7a8a', bg: 'rgba(255, 122, 138, 0.18)', fade: 'rgba(255, 122, 138, 0.06)' }, // rouge clair
    { color: '#26d4c8', bg: 'rgba(38, 212, 200, 0.18)',  fade: 'rgba(38, 212, 200, 0.06)'  }, // turquoise
    { color: '#ffd166', bg: 'rgba(255, 209, 102, 0.18)', fade: 'rgba(255, 209, 102, 0.06)' }, // jaune doux
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
   *  Twitch expose la vérité via l'opération
   *  GuestStarBatchCollaborationQuery : pour un lot d'IDs de chaînes,
   *  chaque entrée porte une `session` dont `session.host.id` est
   *  PARTAGÉ par TOUS les participants d'un même co-stream. On
   *  regroupe donc par host.id — déterministe, insensible aux viewers.
   *
   *  Transport identique à UseLive : post() (persisted query, header
   *  Client-ID seul, donnée publique), batché et mis en cache (TTL).
   *  Le cache est servi en "stale-while-revalidate" : une valeur connue
   *  est renvoyée même périmée pendant son rafraîchissement, ce qui évite
   *  tout retour transitoire à l'heuristique (donc toute saute de couleur).
   *  Si aucune valeur n'a JAMAIS été apprise (hash obsolète dès le départ,
   *  réseau HS), getHostId() renvoie `undefined` et detectCoStreams retombe
   *  proprement sur l'heuristique → aucune régression.
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

  const flushGuestStar = async () => {
    gsTimer = null;
    const ids = [...gsQueue];
    gsQueue.clear();
    if (!ids.length) return;

    const res = await post([{
      operationName: 'GuestStarBatchCollaborationQuery',
      variables: {
        options: { channelIDs: ids },
        canDropInFlagEnabled: false,
        openCallingFlagEnabled: true
      },
      extensions: { persistedQuery: { version: 1, sha256Hash: CFG.GUEST_STAR_HASH } }
    }]);

    // Échec global (réseau, throttle, ou hash périmé → PersistedQueryNotFound) :
    // on n'écrit rien, on pose un cooldown, et le repli heuristique assure
    // l'intérim. On ne tente PAS d'inline ici (texte de la query non capté) ;
    // si le hash se périme un jour, il suffira de le mettre à jour dans CFG.
    // NB : isResultsUnusable couvre déjà le cas d'une réponse mono-opération
    // porteuse d'`errors` (PersistedQueryNotFound inclus).
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
        infoById.set(e.id, { hostId, mates });
      }
    }
    // On écrit TOUTES les chaînes demandées (avec/ sans session) pour ne pas
    // les redemander en boucle pendant la durée du TTL.
    const now = Date.now();
    for (const id of ids) {
      const info = infoById.get(id);
      gsCache.set(id, {
        hostId: info ? info.hostId : null,
        mates: info ? info.mates : [],
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

  // LECTURE PURE du cache TseChannel — plus aucun transport propre.
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
    const cards = section.querySelectorAll('.side-nav-card');
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

    let sorted;
    if (state.sortMode === 'uptime') {
      // createdAt DESC → stream le plus récent en premier (uptime le plus court)
      sorted = [...cards].sort((a, b) => {
        const ta = new Date(a.dataset.tseStartedAt || 0).getTime() || 0;
        const tb = new Date(b.dataset.tseStartedAt || 0).getTime() || 0;
        return tb - ta;
      });
    } else if (state.sortMode === 'viewers') {
      // Viewers DESC → le plus regardé en premier
      sorted = [...cards].sort((a, b) => getCardViewers(b) - getCardViewers(a));
    } else if (state.sortMode === 'costream') {
      // Groupes de co-stream regroupés en tête, ordonnés par nombre de
      // viewers du groupe (somme) décroissant. Les solos sont relégués
      // après, dans leur ordre Twitch original. À l'intérieur d'un même
      // groupe, on conserve l'ordre Twitch (déjà cohérent avec viewers).
      const groupViewers = new Map(); // key -> somme viewers du groupe
      cards.forEach(card => {
        const key = card.dataset.tseCostreamKey;
        if (!key) return;
        groupViewers.set(key, (groupViewers.get(key) || 0) + getCardViewers(card));
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
    } else if (state.sortMode === 'popular') {
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
    } else if (state.sortMode === 'alpha') {
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
   *  SCAN + OBSERVER
   * ============================================================ */
  const scanSidebar = () => {
    // Re-évaluer la langue en premier : auto-correction si LANG
    // initial était erroné (DOM Twitch pas encore prêt au boot).
    refreshLanguage();
    refreshSidebarCollapsed(); // état réduit/étendu, lu par les détections du scan
    preview.closeIfDetached(); // ferme l'aperçu si sa carte d'ancrage a été retirée
    offlineTransitionsThisScan = 0; // remis à zéro avant le passage des cartes
    snapshotTwitchOrder(); // avant tout tri custom, on photographie l'ordre Twitch
    const cards = document.querySelectorAll('.side-nav-card');
    cards.forEach(processCard);
    ensureFilterBar();
    ensureSortRow();
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
    const stillGrowing = loadingOverlay.notifyScan(hadOfflineActivity, cards.length);

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
    let lastObservedCollapsed = detectSidebarCollapsed();

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
      const collapsedNow = detectSidebarCollapsed();
      if (collapsedNow !== lastObservedCollapsed) {
        lastObservedCollapsed = collapsedNow;
        loadingOverlay.startCycle();
        invalidateAndRescan();
        return; // invalidateAndRescan a déjà relancé un scan complet
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
    const allCards  = document.querySelectorAll('.side-nav-card');
    const cards     = section ? [...section.querySelectorAll('.side-nav-card')] : [];
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
      loadingOverlay.startCycle();
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