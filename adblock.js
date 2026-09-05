/* ============================================================
 *  MODULE ANTI-PUBLICITÉ — fichier séparé, code tiers vendorisé
 *  -------------------------------------------------------------
 *  Source  : https://github.com/scamorza/TwitchAdBlock  (vaft v2.0.4)
 *  Licence : MIT — Copyright (c) 2020-present TwitchAdSolutions
 *            Contributors. Fork de pixeltris/TwitchAdSolutions,
 *            depuis largement réécrit autour de la même idée.
 *
 *  POURQUOI UN FICHIER À PART :
 *   Ce code ne nous appartient pas et se met à jour en amont. L'isoler
 *   rend la prochaine mise à jour mécanique — on remplace le fichier et
 *   on rejoue les cinq adaptations listées ci-dessous — au lieu d'un
 *   fusionnement à la main dans les 6 000 lignes de content.js.
 *   L'ordre de chargement (adblock.js AVANT content.js, cf. manifest)
 *   reproduit exactement l'ordre qu'avaient les deux modules quand ils
 *   partageaient un fichier.
 *
 *  PORTÉE D'EXÉCUTION :
 *   Le module ne s'active QUE dans les iframes (notre iframe d'aperçu
 *   sur player.twitch.tv). Sur le stream principal, il se met en
 *   retrait. Pour un anti-pub global, installer vaft en externe : le
 *   handshake twitchAdSolutionsVersion gère la cohabitation, et c'est
 *   d'ailleurs lui qui fait que l'un des deux se retire proprement.
 *
 *  LES HUIT ADAPTATIONS (toutes marquées « ADAPTATION » dans le code) :
 *   a) préfixe de log « [VAFT2] » → « [TSE-AdBlock] », pour distinguer
 *      nos lignes de celles d'un vaft installé en externe ;
 *   b) interrupteur TSE_ADBLOCK_ENABLED ;
 *   c) garde iframe-only (cf. ci-dessus) ;
 *   d) GM_info remplacé par la version en dur — cette API appartient aux
 *      gestionnaires de userscripts et n'existe pas dans une extension ;
 *   e) bannière de démarrage retirée (l'iframe renaît à chaque survol) ;
 *   f) PinHighestQuality passé à false — l'aperçu fait 480x270, épingler la
 *      meilleure qualité disponible y est du gaspillage pur, et cela combat
 *      le 360p30 que la sidebar demande déjà par l'URL ;
 *   g) ShowBanner passé à false — l'encart de diagnostic mangerait le coin
 *      de la vignette ;
 *   h) ForceAccessTokenPlayerType passé de 'popout' à 'autoplay' — Twitch
 *      plafonne l'échelle de qualité d'autoplay à 640x360, ce qui est
 *      exactement le bon plafond pour une vignette de 480x270, et un plafond
 *      SERVEUR que l'adaptation de débit ne peut pas franchir.
 *
 *  (f), (g) et (h) ne sont pas des corrections : en amont ces valeurs sont
 *  justes, pour un lecteur qu'on regarde vraiment. Elles ne le sont plus dès
 *  lors que le lecteur est une vignette de survol. À reconsidérer si la garde
 *  iframe-only tombait un jour.
 *
 *  Le reste du fichier est repris TEL QUEL. Ne pas y corriger de bug
 *  local : le signaler en amont, sinon la prochaine mise à jour l'écrase.
 * ============================================================ */

const TSE_ADBLOCK_ENABLED = true;

(function () {
    'use strict';

    if (!TSE_ADBLOCK_ENABLED) return;

    try {
        if (window.top === window) return;
    } catch {   }

    if (window.self !== window.top) {
        const host = document.location.hostname;
        const path = document.location.pathname;
        const isChatEmbed = /^\/embed\/[^/]+\/chat\/?$/.test(path);
        const isPlayerEmbed = !isChatEmbed && (
            host === 'player.twitch.tv' || host === 'embed.twitch.tv' ||
            host === 'clips.twitch.tv' || host === 'm.twitch.tv' ||
            path === '/embed' || path.startsWith('/embed/')
        );
        if (!isPlayerEmbed) {
            return;
        }
    }

    const OUR_VERSION = 1;
    const VERSION_MARKERS = ['vaftVersion', 'twitchAdSolutionsVersion'];
    const claimedBy = VERSION_MARKERS.find((name) => {
        return typeof window[name] !== 'undefined' && window[name] >= OUR_VERSION;
    });
    if (claimedBy) {
        console.log('[TSE-AdBlock] standing down, ' + claimedBy + ' is already set -- another ad blocker got here first');
        return;
    }
    VERSION_MARKERS.forEach((name) => { window[name] = OUR_VERSION; });

    const Config = {

        BlockAds: true,
        AdSignifier: 'stitched',

        BackupPlayerTypes: ['mobile_feed', 'popout', 'autoplay'],

        ForceAccessTokenPlayerType: 'autoplay',
        StripAdSegments: true,

        RenumberSequence: true,

        ReloadPlayerAfterAd: false,

        AdEndGraceSeconds: 0,

        ReloadCooldownSeconds: 90,

        RefreshTokenOnReload: true,

        WatchOverlayAds: true,

        DeclineClientSideAds: true,

        AdDeclineReason: 'player_size',

        AdDeclineAttempts: 240,

        HideVisibility: true,

        ResumeOnFocus: true,

        PinHighestQuality: false,

        RecoverBlockedPlayback: true,
        ResumeVerifyDelayMs: 2000,
        ResumeVerifyAttempts: 2,

        StallBackstop: false,
        StallBackstopSeconds: 20,

        RecoverDeadPlayer: true,
        DeadPlayerSeconds: 12,

        StepDownCodecInsteadOfStripping: true,

        ShowBanner: false,

        LogLevel: 'info',

        CrossCheckAdEvents: true
    };

    const LEVELS = { debug: 10, info: 20, warn: 30, off: 99 };
    const VERSION = '2.0.4';
    const seenOnce = new Map();

    function log(level, message) {
        if ((LEVELS[level] || 20) < (LEVELS[Config.LogLevel] || 20)) {
            return;
        }
        const line = '[TSE-AdBlock] ' + message;
        if (level === 'warn') {
            console.warn(line);
        } else {
            console.log(line);
        }
    }

    function logOnce(key, level, message) {
        if (seenOnce.get(key) === message) {
            return;
        }
        seenOnce.set(key, message);
        log(level, message);
    }

    function clearOnce(key) {
        seenOnce.delete(key);
    }

    const State = {
        adActive: false,
        adIsMidroll: false,
        activeBackupPlayerType: null,
        strippingSegments: false,
        lastBackupFailure: null,
        workers: [],
        playerAdEvent: null,
        gqlTokenMode: 'persisted',
        counters: { breaks: 0, reloads: 0, backupFailures: 0, recoveries: 0, deadPlayers: 0 }
    };

    const QUALITY_KEY = 'video-quality-highest-available';
    const QUALITY_STAMP_KEY = 's-qs-ts';

    function applyQualityPreference(enabled) {
        try {
            if (enabled) {
                localStorage.setItem(QUALITY_STAMP_KEY, Date.now());

                localStorage.setItem(QUALITY_KEY, 'true');
            } else {
                localStorage.removeItem(QUALITY_KEY);
                localStorage.removeItem(QUALITY_STAMP_KEY);
            }
        } catch (err) {
            log('debug', 'could not ' + (enabled ? 'set' : 'clear') + ' the quality preference: ' + err);
        }
    }

    function installVisibilityLayer() {
        if (!Config.HideVisibility) {
            return;
        }

        const nativeHidden = document.__lookupGetter__('hidden');
        const nativeWebkitHidden = document.__lookupGetter__('webkitHidden');
        Visibility.isReallyHidden = () =>
            (nativeHidden ? nativeHidden.apply(document) === true : false) ||
            (nativeWebkitHidden ? nativeWebkitHidden.apply(document) === true : false);

        const define = (prop, value) => {
            try {
                Object.defineProperty(document, prop, { get() { return value; } });
            } catch (err) {
                log('warn', 'could not override document.' + prop + ': ' + err);
            }
        };
        define('visibilityState', 'visible');
        define('hidden', false);
        define(/Firefox/.test(navigator.userAgent) ? 'mozHidden' : 'webkitHidden', false);

        const swallow = (e) => {

            const reallyHidden = Visibility.isReallyHidden();
            const video = document.getElementsByTagName('video')[0];
            if (reallyHidden) {
                Visibility.wasPlaying = !!(video && !video.paused && !video.ended);
            } else if (Config.ResumeOnFocus && Visibility.wasPlaying && video && video.paused && !video.ended) {

                Visibility.wasPlaying = false;
                log('debug', 'window came back with the stream paused, resuming');
                const found = getPlayer();
                playPlayer(found ? found.player : video, 'window focus');
                verifyResumed(true);
            }

            if (Visibility.allowNextVisibilityChange && e.type === 'visibilitychange' && !reallyHidden) {
                Visibility.allowNextVisibilityChange = false;
                log('debug', 'letting the first visibilitychange through so a background-opened stream starts');
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        ['visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange'].forEach((name) => {
            document.addEventListener(name, swallow, true);
        });

        window.addEventListener('focus', () => {
            if (!Config.ResumeOnFocus) {
                return;
            }
            const video = document.getElementsByTagName('video')[0];
            if (Visibility.wasPlaying && video && video.paused && !video.ended) {
                Visibility.wasPlaying = false;
                log('debug', 'window focused with the stream paused, resuming');
                const found = getPlayer();
                playPlayer(found ? found.player : video, 'window focus');
                verifyResumed(true);
            }
        });
        window.addEventListener('blur', () => {
            const video = document.getElementsByTagName('video')[0];
            if (video && !video.paused && !video.ended) {
                Visibility.wasPlaying = true;
            }
        });
        Visibility.installed = true;
    }

    const Visibility = {
        installed: false,
        wasPlaying: false,
        isReallyHidden: () => false,
        allowNextVisibilityChange: false
    };

    function findReactNode(root, predicate) {
        if (root.stateNode && predicate(root.stateNode)) {
            return root.stateNode;
        }
        let node = root.child;
        while (node) {
            const found = findReactNode(node, predicate);
            if (found) {
                return found;
            }
            node = node.sibling;
        }
        return null;
    }

    function getPlayer() {
        const rootNode = document.querySelector('#root');
        if (!rootNode) {
            return null;
        }
        let reactRoot = null;
        if (rootNode._reactRootContainer?._internalRoot?.current) {
            reactRoot = rootNode._reactRootContainer._internalRoot.current;
        } else {
            const key = Object.keys(rootNode).find((x) => x.startsWith('__reactContainer'));
            reactRoot = key ? rootNode[key] : null;
        }
        if (!reactRoot) {
            return null;
        }
        let instance = findReactNode(reactRoot, (n) => n.setPlayerActive && n.props?.mediaPlayerInstance);
        instance = instance?.props?.mediaPlayerInstance || null;
        if (instance?.playerInstance) {
            instance = instance.playerInstance;
        }
        const controller = findReactNode(reactRoot, (n) => n.setSrc && n.setInitialPlaybackSettings);
        return instance && controller ? { player: instance, controller } : null;
    }

    function playPlayer(player, context) {
        try {
            const result = player.play();
            result?.catch?.((err) => log('debug', 'play() rejected after ' + context + ': ' + (err?.name || err)));
        } catch (err) {
            log('debug', 'play() threw after ' + context + ': ' + err);
        }
    }

    const Resume = { timer: null, attempts: 0 };

    function verifyResumed(isNewAttempt) {
        if (!Config.RecoverBlockedPlayback) {
            return;
        }
        if (isNewAttempt) {

            Resume.attempts = 0;
        }
        clearTimeout(Resume.timer);
        Resume.timer = setTimeout(() => {
            try {
                const found = getPlayer();
                const video = found?.player?.getHTMLVideoElement?.();

                if (!found || !video || (!video.paused && !video.ended)) {
                    Resume.attempts = 0;
                    return;
                }
                if (found.player.core?.state?.state === 'Buffering') {

                    verifyResumed(false);
                    return;
                }
                if (Resume.attempts < Config.ResumeVerifyAttempts) {
                    Resume.attempts++;
                    log('debug', 'still paused after our resume, retrying play (' + Resume.attempts + '/' + Config.ResumeVerifyAttempts + ')');
                    playPlayer(found.player, 'resume retry');
                    verifyResumed(false);
                } else {
                    log('warn', 'player did not resume after ' + Resume.attempts + ' retries; leaving it alone rather than reloading in a loop');
                }
            } catch (err) {
                log('debug', 'resume verification failed: ' + err);
            }
        }, Config.ResumeVerifyDelayMs);
    }

    let listenersAttachedTo = null;

    function attachPlayerListeners(player) {
        if (!player?.addEventListener || listenersAttachedTo === player) {
            return;
        }
        listenersAttachedTo = player;
        const on = (event, handler) => {
            try {
                player.addEventListener(event, handler);
            } catch (err) {
                log('warn', 'could not listen for ' + event + ': ' + err);
            }
        };

        if (Config.RecoverBlockedPlayback) {

            on('PlayerPlaybackBlocked', () => {
                State.counters.recoveries++;
                log('info', 'PlaybackBlocked -- Twitch paused the muted stream and will not retry; resuming');
                playPlayer(player, 'playback blocked');
                verifyResumed(true);
            });

            on('PlayerAudioBlocked', () => {
                log('warn', 'AudioBlocked -- Twitch muted the stream to keep it playing; unmute manually to get sound back');
            });
        }

        if (Config.CrossCheckAdEvents) {
            on('stitchedadstart', () => {
                State.playerAdEvent = 'start';
                log('debug', 'player reports stitchedadstart' + (State.adActive ? '' : ' -- we have NOT detected an ad, AdSignifier may have drifted'));
            });
            on('stitchedadend', () => {
                State.playerAdEvent = 'end';
                log('debug', 'player reports stitchedadend');
            });
        }
    }

    function ensurePlayerWired() {
        const found = getPlayer();
        if (found?.player) {
            attachPlayerListeners(found.player);
        }
        return found;
    }

    function mediaIsTornDown() {
        try {
            const video = document.getElementsByTagName('video')[0];
            if (!video) {
                return false;
            }
            return video.readyState === 0 && video.buffered.length === 0 && !video.videoHeight;
        } catch {
            return false;
        }
    }

    function codecFamilyOf(codecs) {
        const base = String(codecs || '').split(',')[0].trim().split('.')[0].toLowerCase();
        if (base === 'hev1' || base === 'hvc1') { return 'hevc'; }
        if (base.startsWith('avc')) { return 'avc'; }
        return base || '?';
    }

    function describePlayback() {
        try {
            const player = getPlayer()?.player;
            const quality = player?.getQuality?.();
            if (!quality) {
                return 'quality unknown';
            }
            const mine = codecFamilyOf(quality.codecs);
            let siblings = '';
            try {
                const ladder = player.getQualities?.() || [];
                const same = ladder.filter((q) => codecFamilyOf(q.codecs) === mine).length;
                siblings = ', ' + same + '/' + ladder.length + ' variant(s) share the codec';
            } catch {}

            let real = '';
            try {
                const video = document.getElementsByTagName('video')[0];
                if (video?.videoWidth) {
                    const actual = video.videoWidth + 'x' + video.videoHeight;
                    real = ' [decoding ' + actual + (actual === quality.width + 'x' + quality.height
                        ? '' : ' -- NOT what the label says') + ']';
                }
            } catch {}
            return quality.name + ' ' + mine + ' (' + quality.codecs + ')' + siblings + real;
        } catch (err) {
            return 'quality unreadable: ' + err;
        }
    }

    const QualityFallback = { originalName: null, wasAuto: false, active: false };

    function stepDownFromStrippedCodec() {
        if (!Config.StepDownCodecInsteadOfStripping || QualityFallback.active) {
            return;
        }
        try {
            const player = getPlayer()?.player;
            const current = player?.getQuality?.();
            const ladder = player?.getQualities?.() || [];
            if (!current || !ladder.length) {
                log('warn', 'wanted to step down out of stripping but the quality ladder is unreadable');
                return;
            }
            const mine = codecFamilyOf(current.codecs);
            const pixels = (q) => (q.width || 0) * (q.height || 0);
            const others = ladder.filter((q) => codecFamilyOf(q.codecs) !== mine);
            if (!others.length) {
                log('warn', 'stripping with no way out: every variant in the ladder is ' + mine);
                return;
            }

            const affordable = others
                .filter((q) => pixels(q) <= pixels(current))
                .sort((a, b) => pixels(b) - pixels(a));
            if (!affordable.length) {
                log('warn', 'not stepping down: the only ' +
                    codecFamilyOf(others[0].codecs) + ' variant available is ' + others[0].name +
                    ', larger than the ' + current.name + ' being watched -- staying on stripping' +
                    ' rather than forcing a higher bitrate');
                return;
            }
            const target = affordable[0];
            QualityFallback.originalName = current.name;
            QualityFallback.wasAuto = !!player.isAutoQualityMode?.();
            QualityFallback.active = true;
            player.setQuality(target);

            postToWorkers({
                key: 'PreferVariant',
                value: {
                    resolution: target.width + 'x' + target.height,
                    frameRate: target.framerate || target.frameRate || null,
                    codecs: target.codecs
                }
            });
            log('info', 'stepping down from ' + current.name + ' ' + mine + ' to ' + target.name + ' ' +
                codecFamilyOf(target.codecs) + ' so the backup search has variants to pick from' +
                ' -- will return to ' + (QualityFallback.wasAuto ? 'automatic quality' : current.name) +
                ' when the break ends');
        } catch (err) {
            QualityFallback.active = false;
            log('warn', 'codec step-down failed, staying on stripping: ' + err);
        }
    }

    function restoreQualityAfterAdBreak() {
        if (!QualityFallback.active) {
            return;
        }
        const wanted = QualityFallback.originalName;
        const wasAuto = QualityFallback.wasAuto;
        QualityFallback.active = false;

        postToWorkers({ key: 'PreferVariant', value: null });
        QualityFallback.originalName = null;
        QualityFallback.wasAuto = false;
        try {
            const player = getPlayer()?.player;
            if (wasAuto) {
                player.setAutoQualityMode(true);
                log('info', 'break over, handing quality back to automatic');
                return;
            }

            const target = (player?.getQualities?.() || []).find((q) => q.name === wanted);
            if (!target) {
                log('warn', 'cannot return to ' + wanted + ', it is no longer in the ladder');
                return;
            }
            player.setQuality(target);
            log('info', 'break over, returning to ' + wanted);
        } catch (err) {
            log('warn', 'could not return to ' + (wasAuto ? 'automatic quality' : wanted) + ': ' + err);
        }
    }

    let lastReloadAt = 0;

    function reloadPlayer() {
        const found = ensurePlayerWired();
        if (!found) {
            log('warn', 'asked to reload but the player could not be found');
            return;
        }

        if ((found.player.isPaused?.() || found.player.core?.paused) && !mediaIsTornDown()) {
            log('debug', 'skipping reload, the player is paused');
            return;
        }
        const sinceLast = Date.now() - lastReloadAt;
        if (lastReloadAt && sinceLast < Config.ReloadCooldownSeconds * 1000) {

            log('warn', 'second reload requested ' + Math.round(sinceLast / 1000) + 's after the last one' +
                ' -- using pause/play instead, the reload is not settling the break');
            pauseResumePlayer();
            return;
        }
        lastReloadAt = Date.now();
        State.counters.reloads++;
        log('info', 'reloading the player');
        try {
            found.controller.setSrc({
                isNewMediaPlayerInstance: true,
                refreshAccessToken: Config.RefreshTokenOnReload
            });
        } catch (err) {
            log('warn', 'setSrc failed: ' + err);
            return;
        }
        postToWorkers({ key: 'PlayerReloaded' });
        playPlayer(found.player, 'reload');
        verifyResumed(true);
    }

    function pauseResumePlayer() {
        const found = ensurePlayerWired();
        if (!found || found.player.isPaused?.() || found.player.core?.paused) {
            return;
        }
        try {
            found.player.pause();
        } catch (err) {
            log('warn', 'pause failed: ' + err);
            return;
        }
        playPlayer(found.player, 'pause/play');
        verifyResumed(true);
    }

    function startStallBackstop() {
        if (!Config.StallBackstop) {
            return;
        }
        let lastBufferedPosition = null;
        let frozenSince = 0;
        setInterval(() => {
            try {
                const found = getPlayer();
                const player = found?.player;
                if (!player?.core || player.isPaused?.() || State.adActive) {
                    frozenSince = 0;
                    return;
                }
                const buffered = player.core?.state?.bufferedPosition;
                if (buffered === undefined) {
                    return;
                }
                if (buffered !== lastBufferedPosition) {
                    lastBufferedPosition = buffered;
                    frozenSince = 0;
                    return;
                }
                if (!frozenSince) {
                    frozenSince = Date.now();
                    return;
                }
                if (Date.now() - frozenSince >= Config.StallBackstopSeconds * 1000) {
                    frozenSince = 0;
                    log('warn', 'buffer frozen for ' + Config.StallBackstopSeconds + 's, nudging the player');
                    pauseResumePlayer();
                }
            } catch (err) {
                log('debug', 'stall backstop error: ' + err);
            }
        }, 2000);
    }

    function startDeadPlayerWatch() {
        if (!Config.RecoverDeadPlayer) {
            return;
        }
        let everHealthy = false;
        let deadSince = 0;
        let reported = false;
        setInterval(() => {
            try {
                if (!mediaIsTornDown()) {
                    // One healthy sample licenses the watcher: without it a destroyed player and a

                    everHealthy = true;
                    deadSince = 0;
                    reported = false;
                    return;
                }
                if (!everHealthy) {
                    return;
                }
                if (!deadSince) {
                    deadSince = Date.now();
                    return;
                }
                const downFor = Math.round((Date.now() - deadSince) / 1000);
                if (downFor < Config.DeadPlayerSeconds) {
                    return;
                }
                if (!reported) {
                    reported = true;
                    State.counters.deadPlayers++;
                    log('warn', 'the player is gone -- no media, no buffer, ' + downFor + 's' +
                        (State.adActive ? ' (during an ad break' +
                            (State.strippingSegments ? ', while stripping segments' : '') + ')' : '') +
                        '; reloading it');
                }
                deadSince = Date.now();
                State.counters.recoveries++;
                reloadPlayer();
            } catch (err) {
                log('debug', 'dead-player watch error: ' + err);
            }
        }, 3000);
    }

    function updateBanner() {
        if (!Config.ShowBanner) {
            return;
        }
        const root = document.querySelector('.video-player');
        if (!root) {
            return;
        }
        let overlay = root.querySelector('.vaft2-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'vaft2-overlay';
            overlay.innerHTML = '<div style="color:white;background-color:rgba(0,0,0,0.8);position:absolute;top:0;left:0;padding:5px;"><p></p></div>';
            overlay.style.display = 'none';
            root.appendChild(overlay);
        }
        const text = overlay.querySelector('p');
        if (text) {

            text.textContent = 'Blocking' + (State.adIsMidroll ? ' midroll' : '') + ' ads' +
                (State.strippingSegments ? ' (stripping)' : '');
        }
        overlay.style.display = State.adActive ? 'block' : 'none';
    }

    const Navigation = { channel: null, left: null };

    function messageIsStale(data) {
        const channel = data.channel && String(data.channel).toLowerCase();
        if (!channel || channel === 'simulation' || !Navigation.left) {
            return false;
        }
        return channel === Navigation.left && channel !== Navigation.channel;
    }

    const NOT_A_CHANNEL = {
        directory: 1, videos: 1, settings: 1, subscriptions: 1, wallet: 1, drops: 1,
        friends: 1, downloads: 1, jobs: 1, turbo: 1, prime: 1, search: 1, u: 1, p: 1, '': 1
    };

    function channelFromLocation() {
        try {
            const parts = document.location.pathname.split('/').filter(Boolean);
            if (!parts.length) {
                return null;
            }
            if (parts[0] === 'popout' || parts[0] === 'moderator') {
                return parts[1] ? parts[1].toLowerCase() : null;
            }
            return NOT_A_CHANNEL[parts[0]] ? null : parts[0].toLowerCase();
        } catch (err) {
            log('debug', 'could not read a channel from the location: ' + err);
            return null;
        }
    }

    function resetForChannelChange(previous, next, how) {
        const carried = State.adActive || QualityFallback.active;
        Navigation.left = previous;
        State.adActive = false;
        State.adIsMidroll = false;
        State.activeBackupPlayerType = null;
        State.strippingSegments = false;
        State.playerAdEvent = null;
        clearOnce('blocking');
        clearOnce('leak');

        const stepped = QualityFallback.active;
        const wasAuto = QualityFallback.wasAuto;
        QualityFallback.active = false;
        QualityFallback.originalName = null;
        QualityFallback.wasAuto = false;
        if (stepped && wasAuto) {
            try {
                getPlayer()?.player?.setAutoQualityMode(true);
            } catch (err) {
                log('debug', 'could not hand quality back to automatic after a channel change: ' + err);
            }
        }

        postToWorkers({ key: 'ChannelChanged', value: previous });

        try {
            document.querySelectorAll('.vaft2-overlay').forEach((el) => { el.style.display = 'none'; });
        } catch (err) {
            log('debug', 'could not hide the banner after a channel change: ' + err);
        }
        updateBanner();

        const from = previous || 'a non-channel page';
        const to = next || 'a non-channel page';
        if (carried) {
            log('info', 'left ' + from + ' mid-break -- state cleared for ' + to);
        } else {
            log('debug', 'channel changed, ' + from + ' -> ' + to + ' (nothing carried) via ' + how);
        }
    }

    function installNavigationWatch() {
        Navigation.channel = channelFromLocation();

        const onNavigate = (how) => {
            try {
                const next = channelFromLocation();
                if (next === Navigation.channel) {
                    return;
                }
                const previous = Navigation.channel;
                Navigation.channel = next;
                resetForChannelChange(previous, next, how);
            } catch (err) {
                log('debug', 'navigation watch error: ' + err);
            }
        };
        ['pushState', 'replaceState'].forEach((name) => {
            const original = history[name];
            if (typeof original !== 'function') {
                return;
            }
            history[name] = function () {
                const result = original.apply(this, arguments);

                onNavigate(name);
                return result;
            };
        });
        window.addEventListener('popstate', () => onNavigate('popstate'));

        setInterval(() => onNavigate('poll'), 2000);
    }

    const OverlayAds = {
        pbypInstance: null,
        buffer: [],
        bufferLimit: 180,
        anomalyActive: false,
        seen: 0,
        styleEl: null,
        hidden: [],
        strip: null
    };

    function findPictureByPictureContext() {
        const rootNode = document.querySelector('#root');
        const key = rootNode && Object.keys(rootNode).find((x) => x.startsWith('__reactContainer'));
        if (!key) {
            return null;
        }
        const seen = new Set();
        let found = null;
        (function walk(node, depth) {
            if (!node || found || depth > 4000 || seen.has(node)) {
                return;
            }
            seen.add(node);
            const state = node.stateNode && node.stateNode.state;
            if (state && typeof state === 'object' &&
                ('isShowingMirrorPbyPAdPod' in state || 'mirrorPbyPAdMetadata' in state)) {
                found = node.stateNode;
                return;
            }
            let child = node.child;
            while (child && !found) {
                walk(child, depth + 1);
                child = child.sibling;
            }
        })(rootNode[key], 0);
        return found;
    }

    function sampleOverlayState() {
        const video = document.getElementsByTagName('video')[0];
        const container = document.querySelector('.video-player');
        const videoRect = video ? video.getBoundingClientRect() : null;
        const containerRect = container ? container.getBoundingClientRect() : null;
        const iframes = [...document.querySelectorAll('iframe')].map((f) => String(f.src).slice(0, 90));

        if (!OverlayAds.pbypInstance || !OverlayAds.pbypInstance.state) {
            OverlayAds.pbypInstance = findPictureByPictureContext();
        }
        const pbyp = OverlayAds.pbypInstance && OverlayAds.pbypInstance.state;

        return {
            t: new Date().toISOString().slice(11, 19),
            vw: videoRect ? Math.round(videoRect.width) : null,
            vh: videoRect ? Math.round(videoRect.height) : null,
            cw: containerRect ? Math.round(containerRect.width) : null,
            ch: containerRect ? Math.round(containerRect.height) : null,

            ratio: videoRect && containerRect && containerRect.width
                ? Math.round((videoRect.width / containerRect.width) * 100) / 100
                : null,

            videoAspect: videoRect && videoRect.height
                ? Math.round((videoRect.width / videoRect.height) * 100) / 100 : null,
            containerAspect: containerRect && containerRect.height
                ? Math.round((containerRect.width / containerRect.height) * 100) / 100 : null,
            iframes: iframes.length,
            adIframes: iframes.filter((s) => /amazon-adsystem|doubleclick|imasdk/.test(s)).length,
            iframeList: iframes,
            streamAd: State.adActive,
            playerState: (() => { try { return getPlayer()?.player?.getState?.(); } catch { return null; } })(),
            pbyp: pbyp ? {
                isShowing: pbyp.isShowing, showingMirrorPod: pbyp.isShowingMirrorPbyPAdPod,
                status: pbyp.status, rollType: pbyp.rollType, adSessionID: pbyp.adSessionID,
                hasMetadata: !!pbyp.mirrorPbyPAdMetadata
            } : null
        };
    }

    function pollOverlayAds() {
        try {
            const sample = sampleOverlayState();
            OverlayAds.buffer.push(sample);
            if (OverlayAds.buffer.length > OverlayAds.bufferLimit) {
                OverlayAds.buffer.shift();
            }

            const sameAspect = sample.videoAspect !== null && sample.containerAspect !== null &&
                Math.abs(sample.videoAspect - sample.containerAspect) <= sample.containerAspect * 0.05;
            const shrunk = sample.ratio !== null && sample.ratio < 0.9 && sameAspect;

            const pbypActive = !!(sample.pbyp && (sample.pbyp.showingMirrorPod || sample.pbyp.isShowing ||
                sample.pbyp.rollType || sample.pbyp.adSessionID));
            const anomalous = shrunk || pbypActive;

            if (anomalous && !OverlayAds.anomalyActive) {
                OverlayAds.anomalyActive = true;
                OverlayAds.seen++;
                State.counters.overlayAds = OverlayAds.seen;
                log('warn', 'OVERLAY AD suspected (shrunk=' + shrunk +
                    ' pbypActive=' + pbypActive + ') -- ' + JSON.stringify(sample));
                log('debug', 'OVERLAY AD layout: ' + JSON.stringify(describeOverlayLayout()));

                const before = OverlayAds.buffer.slice(-21, -1);
                log('debug', 'OVERLAY AD preceding 20 samples: ' + JSON.stringify(before));
            } else if (!anomalous && OverlayAds.anomalyActive) {
                OverlayAds.anomalyActive = false;
                log('warn', 'OVERLAY AD ended -- ' + JSON.stringify(sample));
            }
        } catch (err) {
            log('debug', 'overlay-ad poll error: ' + err);
        }
    }

    function describeOverlayLayout() {
        const video = document.getElementsByTagName('video')[0];
        if (!video) {
            return { err: 'no video' };
        }
        const box = (el) => {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        };
        const chain = [];
        for (let node = video, i = 0; node && node.tagName !== 'BODY' && i < 8; node = node.parentElement, i++) {
            chain.push(Object.assign({
                tag: node.tagName,
                cls: String(node.className || '').split(' ').slice(0, 3).join(' ').slice(0, 60),
                inline: (node.getAttribute('style') || '').slice(0, 140)
            }, box(node)));
        }
        return { chain };
    }

    const AdManager = { applied: false, attempts: 0, reason: null, moduleId: null };

    function webpackRequire() {
        const key = Object.keys(window).find((k) => /^webpackChunk/i.test(k));
        const queue = key ? window[key] : null;
        if (!queue || typeof queue.push !== 'function') {
            return null;
        }

        let req = null;
        const entry = [[Symbol('vaft2')], {}, (r) => { req = r; }];
        queue.push(entry);
        if (!req) {
            const at = queue.indexOf(entry);
            if (at !== -1) {
                queue.splice(at, 1);
            }
            return null;
        }
        return req;
    }

    function findAdManagerClass(req) {
        const factories = req.m || {};
        for (const id of Object.keys(factories)) {
            let source;
            try {
                source = Function.prototype.toString.call(factories[id]);
            } catch { continue; }

            if (source.indexOf('startProcessingRequests') === -1 || source.indexOf('declineReason') === -1) {
                continue;
            }
            let exports;
            try {
                exports = req(id);
            } catch { continue; }
            if (!exports) {
                continue;
            }
            for (const name of Object.keys(exports)) {
                let value;
                try {
                    value = exports[name];
                } catch { continue; }
                if (typeof value === 'function'
                    && typeof value.startProcessingRequests === 'function'
                    && typeof value.decline === 'function') {
                    return { id, name, manager: value };
                }
            }
        }
        return null;
    }

    function declineClientSideAds() {
        const req = webpackRequire();
        if (!req) {
            return false;
        }
        const found = findAdManagerClass(req);
        if (!found) {
            return false;
        }
        AdManager.moduleId = found.id + '.' + found.name;
        if (found.manager.declineReason) {

            AdManager.applied = true;
            AdManager.reason = String(found.manager.declineReason);
            log('info', 'client-side ad manager was already declined by Twitch (' + AdManager.reason + ')');
            return true;
        }

        found.manager.decline(Config.AdDeclineReason, { sendEvent: false });
        AdManager.reason = String(found.manager.declineReason || '');
        AdManager.applied = !!AdManager.reason;
        if (!AdManager.applied) {
            log('warn', 'ad manager found at ' + AdManager.moduleId + ' but decline did not take');
            return false;
        }
        log('info', 'client-side ad manager declined at ' + AdManager.moduleId
            + ' (' + AdManager.reason + ') -- display ads will not be requested');
        return true;
    }

    function startAdManagerDecline() {
        if (!Config.DeclineClientSideAds) {
            return;
        }

        (function attempt() {
            AdManager.attempts++;
            let done = false;
            try {
                done = declineClientSideAds();
            } catch (err) {
                log('debug', 'ad manager lookup failed: ' + (err?.message || err));
            }
            if (done) {
                return;
            }
            if (AdManager.attempts >= Config.AdDeclineAttempts) {
                log('warn', 'client-side ad manager not found after ' + AdManager.attempts
                    + ' attempts -- display ads are NOT blocked');
                return;
            }
            setTimeout(attempt, 500);
        })();
    }

    function startOverlayAdWatch() {
        if (!Config.WatchOverlayAds) {
            return;
        }

        setInterval(pollOverlayAds, 500);
        pollOverlayAds();
    }

    const GQL = {
        clientId: 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        deviceId: null,
        clientVersion: null,
        clientSession: null,
        integrity: null,
        authorization: undefined
    };

    async function performWorkerFetch(request) {
        try {
            const response = await window.__vaft2RealFetch(request.url, request.options);
            return {
                id: request.id,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: await response.text()
            };
        } catch (err) {
            return { id: request.id, error: err?.message || String(err) };
        }
    }

    function postToWorkers(message) {
        State.workers.forEach((worker) => {
            try {
                worker.postMessage(message);
            } catch (err) {
                log('debug', 'could not post to a worker: ' + err);
            }
        });
    }

    function urlOfRequest(input) {
        try {
            if (typeof input === 'string') { return input; }
            if (typeof URL !== 'undefined' && input instanceof URL) { return input.href; }
            if (input && typeof input.url === 'string') { return input.url; }
        } catch {}
        return '';
    }

    function installFetchHook() {
        const realFetch = window.fetch;
        window.__vaft2RealFetch = realFetch;

        window.fetch = function (input, init) {

            const caller = this;
            const original = arguments;
            try {
                const url = urlOfRequest(input);
                if (url.includes('gql.twitch.tv')) {
                    captureGqlHeaders(init && init.headers ? init : input);
                    if (init && typeof init.body === 'string') {
                        const rewritten = rewriteGqlBody(init, realFetch);
                        if (rewritten) {
                            return rewritten;
                        }
                    } else if (input && typeof input.clone === 'function' && typeof input.text === 'function') {

                        return input.clone().text().then((body) => {
                            const shim = { body, headers: input.headers };
                            const rewritten = rewriteGqlBody(shim, realFetch);
                            if (rewritten) {
                                return rewritten;
                            }
                            if (shim.body !== body) {
                                return realFetch.call(caller, new Request(input, { body: shim.body }));
                            }
                            return realFetch.apply(caller, original);
                        }).catch(() => realFetch.apply(caller, original));
                    }
                }
            } catch (err) {
                log('warn', 'fetch hook error, passing the request through untouched: ' + err);
            }
            return realFetch.apply(this, arguments);
        };
    }

    function readHeader(headers, name) {
        if (!headers) {
            return undefined;
        }

        if (typeof headers.get === 'function') {
            return headers.get(name) ?? undefined;
        }
        if (headers[name] !== undefined) {
            return headers[name];
        }
        const lower = name.toLowerCase();
        const key = Object.keys(headers).find((x) => x.toLowerCase() === lower);
        return key === undefined ? undefined : headers[key];
    }

    function captureGqlHeaders(init) {
        const headers = init && init.headers;
        if (!headers) {
            return;
        }
        const pairs = [
            ['deviceId', readHeader(headers, 'X-Device-Id') ?? readHeader(headers, 'Device-ID'), 'UpdateDeviceId'],
            ['clientVersion', readHeader(headers, 'Client-Version'), 'UpdateClientVersion'],
            ['clientSession', readHeader(headers, 'Client-Session-Id'), 'UpdateClientSession'],
            ['integrity', readHeader(headers, 'Client-Integrity'), 'UpdateIntegrity'],
            ['authorization', readHeader(headers, 'Authorization'), 'UpdateAuthorization']
        ];
        for (const [field, value, message] of pairs) {
            if (typeof value === 'string' && GQL[field] !== value) {
                GQL[field] = value;
                postToWorkers({ key: message, value });
            }
        }
    }

    function rewriteGqlBody(init, realFetch) {
        if (!init || typeof init.body !== 'string' || !init.body.includes('PlaybackAccessToken')) {
            return null;
        }
        let parsed;
        try {
            parsed = JSON.parse(init.body);
        } catch {
            log('debug', 'unreadable PlaybackAccessToken body, left alone');
            return null;
        }
        const operations = Array.isArray(parsed) ? parsed : [parsed];
        const isPictureByPicture = (op) => typeof op?.variables?.playerType === 'string' &&
            op.variables.playerType.includes('picture-by-picture');

        if (operations.length > 0 && operations.every(isPictureByPicture)) {
            const denied = () => ({ data: { streamPlaybackAccessToken: null, videoPlaybackAccessToken: null } });
            const body = Array.isArray(parsed) ? operations.map(denied) : denied();

            log('info', 'denied a picture-by-picture token locally');
            return Promise.resolve(new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        if (Array.isArray(parsed) && operations.some(isPictureByPicture)) {

            const indici = [];
            const resto = [];
            operations.forEach((op, i) => { (isPictureByPicture(op) ? indici : resto).push(i); });
            log('debug', 'picture-by-picture batched with ' + resto.length + ' other operation(s)' +
                ' -- denying position(s) ' + indici.join(',') + ' and passing the rest');
            const magro = resto.map((i) => operations[i]);
            const inviare = { ...init, body: JSON.stringify(magro) };
            return realFetch('https://gql.twitch.tv/gql', inviare).then(async (response) => {
                if (response.status !== 200) { return response; }
                const risposte = await response.json();
                const array = Array.isArray(risposte) ? risposte : [risposte];
                const ricomposto = [];
                let k = 0;
                operations.forEach((op, i) => {
                    ricomposto[i] = isPictureByPicture(op)
                        ? { data: { streamPlaybackAccessToken: null, videoPlaybackAccessToken: null } }
                        : array[k++];
                });
                return new Response(JSON.stringify(ricomposto), {
                    status: 200, headers: { 'Content-Type': 'application/json' }
                });
            }).catch((err) => {
                log('warn', 'splicing the picture-by-picture batch failed, sending it untouched: ' + err);
                return realFetch('https://gql.twitch.tv/gql', init);
            });
        }

        if (!Config.ForceAccessTokenPlayerType) {
            return null;
        }
        let replaced = null;
        for (const op of operations) {
            const current = op?.variables?.playerType;
            if (current && current !== Config.ForceAccessTokenPlayerType && !isPictureByPicture(op)) {
                replaced = current;
                op.variables.playerType = Config.ForceAccessTokenPlayerType;
            }
        }
        if (replaced) {
            init.body = JSON.stringify(parsed);
            logOnce('playerType', 'debug', "rewrote playerType '" + replaced + "' as '" + Config.ForceAccessTokenPlayerType + "'");
        }
        return null;
    }

    const WORKER_SOURCE = `
'use strict';

// VAFT2_INIT is prepended as a JSON literal. Config arrives embedded rather than by postMessage:
// Twitch's wasm worker reads every message delivered to the worker, took our Init as one of its own
// and threw during startup. Whatever still has to be sent is hidden from it below.
var CONFIG = VAFT2_INIT.config;
var GQLState = VAFT2_INIT.gql;

// Overrides stream.currentVariant when choosing a backup rendition. currentVariant is whatever the
// player wants at this instant, and right after a codec step-down that is the bottom of the ladder
// it is ramping up from -- aiming at it locked a whole break to 640x360. A backup swap hands the
// player one fixed variant with no ladder left to climb, so the transient value cannot be undone.
var preferredVariant = null;
var streamsByChannel = Object.create(null);
var streamsByPlaylistUrl = Object.create(null);
var adSegments = new Map();
var pendingFetches = new Map();
var lastReloadAt = 0;
var onceMessages = new Map();

// The reply must carry no codec configuration at all, because we never learn which codec the
// SourceBuffer was opened with. This used to be a one-frame mp4 carrying an avc1 sample
// description: harmless on h264, fatal on hevc, where the decoder gets an H.264 track config and
// the player dies with Errore #3000 and never comes back. Zero bytes is the only answer correct
// for every codec -- MSE treats the append as a no-op, and the player still gets its 200.
function emptySegmentResponse() {
    return new Response(new ArrayBuffer(0), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': '0' }
    });
}

function wlog(level, message) {
    self.postMessage({ key: 'Log', level: level, message: message });
}

function wlogOnce(key, level, message) {
    if (onceMessages.get(key) === message) { return; }
    onceMessages.set(key, message);
    wlog(level, message);
}

// Cleared by prefix so every break reports its own state: a census suppressed because it matched
// the previous break's is the one case where seeing it twice is the point.
function wclearOnce(prefix) {
    onceMessages.forEach(function (value, key) {
        if (key.indexOf(prefix) === 0) { onceMessages.delete(key); }
    });
}

function parseAttributes(line) {
    var out = Object.create(null);
    var parts = line.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
        var idx = parts[i].indexOf('=');
        if (idx < 0) { continue; }
        var key = parts[i].substring(0, idx);
        var raw = parts[i].substring(idx + 1);
        var num = Number(raw);
        out[key] = Number.isNaN(num) ? (raw.charAt(0) === '"' ? JSON.parse(raw) : raw) : num;
    }
    return out;
}

// Both dialects tried regardless of what the URL suggested: the flag is derived from a URL that
// may not be the one this text came from, and a mismatch left a promise that never settled.
function readServerTime(text) {
    var v2 = text.match(/#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="([^"]+)"/);
    if (v2 && v2.length > 1) { return v2[1]; }
    var v1 = text.match(/SERVER-TIME="([0-9.]+)"/);
    return v1 && v1.length > 1 ? v1[1] : null;
}

function writeServerTime(text, serverTime) {
    if (!serverTime) { return text; }
    if (text.indexOf('#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME"') >= 0) {
        return text.replace(/(#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE=")[^"]+(")/, '$1' + serverTime + '$2');
    }
    return text.replace(/(SERVER-TIME=")[0-9.]+"/, 'SERVER-TIME="' + serverTime + '"');
}

function gqlRequest(body) {
    // An invented device id must never travel with the page's real Client-Integrity: that token is
    // minted for one device, and the same token under another is what a replay looks like. The
    // server burns it, and from then on the page's OWN requests fail their integrity check. The
    // window is real -- Twitch's first token request of a page load carries no device id either.
    var inventedDeviceId = false;
    if (!GQLState.deviceId) {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var id = '';
        for (var i = 0; i < 32; i++) { id += chars.charAt(Math.floor(Math.random() * chars.length)); }
        GQLState.deviceId = id;
        inventedDeviceId = true;
        GQLState.deviceIdInvented = true;
    }
    var headers = { 'Client-ID': GQLState.clientId, 'X-Device-Id': GQLState.deviceId };
    if (GQLState.authorization) { headers['Authorization'] = GQLState.authorization; }
    if (GQLState.integrity && !GQLState.deviceIdInvented) {
        headers['Client-Integrity'] = GQLState.integrity;
    } else if (GQLState.integrity) {
        wlogOnce('integrity-held', 'warn', 'holding back Client-Integrity: the device id is one we' +
            ' invented, and pairing the two would invalidate the token the page itself is using');
    }
    if (inventedDeviceId) {
        wlogOnce('device-invented', 'warn', 'no device id captured from the page yet, using a' +
            ' generated one for this request');
    }
    if (GQLState.clientVersion) { headers['Client-Version'] = GQLState.clientVersion; }
    if (GQLState.clientSession) { headers['Client-Session-Id'] = GQLState.clientSession; }
    return new Promise(function (resolve, reject) {
        var id = Math.random().toString(36).substring(2, 15);
        pendingFetches.set(id, { resolve: resolve, reject: reject });
        self.postMessage({
            key: 'FetchRequest',
            value: { id: id, url: 'https://gql.twitch.tv/gql', options: { method: 'POST', body: JSON.stringify(body), headers: headers } }
        });
    });
}

var PERSISTED_HASH = 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9';
var TOKEN_QUERY = 'query PlaybackAccessToken($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!, $platform: String!) {' +
    ' streamPlaybackAccessToken(channelName: $login, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) { value signature }' +
    ' videoPlaybackAccessToken(id: $vodID, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) { value signature }' +
    ' }';

// Twitch's own client sends the full document, not this hash, so the hash is an optimisation we
// are not entitled to assume keeps working. On the first refusal, switch for the session.
// Player types that must be asked for as a mobile client. The platform is not cosmetic: the same
// mobile_feed asked as web comes back stitched every time, so the exemption needs the pair.
var PLATFORM_MOBILE = { autoplay: 1, mobile_feed: 1 };

function requestAccessToken(channel, playerType) {
    var variables = {
        isLive: true, login: channel, isVod: false, vodID: '',
        playerType: playerType, platform: PLATFORM_MOBILE[playerType] ? 'android' : 'web'
    };
    var body = { operationName: 'PlaybackAccessToken', variables: variables };
    if (CONFIG.tokenMode === 'persisted') {
        body.extensions = { persistedQuery: { version: 1, sha256Hash: PERSISTED_HASH } };
    } else {
        body.query = TOKEN_QUERY;
    }
    return gqlRequest(body).then(function (response) {
        if (response.status !== 200) {
            throw new Error('token request returned ' + response.status);
        }
        return response.json();
    }).then(function (json) {
        if (json && json.data && json.data.streamPlaybackAccessToken) {
            return json.data.streamPlaybackAccessToken;
        }
        if (CONFIG.tokenMode === 'persisted') {
            CONFIG.tokenMode = 'document';
            self.postMessage({ key: 'TokenModeChanged', value: 'document' });
            wlog('debug', 'the persisted-query hash was refused; falling back to the full GQL document');
            return requestAccessToken(channel, playerType);
        }
        var errors = json && json.errors ? json.errors.map(function (e) { return e.message; }).join(', ') : 'no token in the response';
        throw new Error(errors);
    });
}

function buildUsherUrl(stream, token) {
    var url = new URL(stream.usherBase);
    url.searchParams.set('sig', token.signature);
    url.searchParams.set('token', token.value);
    return url.href;
}

// hev1 and hvc1 are both HEVC and interchangeable here; everything else is compared on the part
// before the first dot, which is what distinguishes the decoders.
function codecFamily(codecs) {
    if (!codecs) { return null; }
    var base = String(codecs).split(',')[0].trim().split('.')[0].toLowerCase();
    if (base === 'hev1' || base === 'hvc1') { return 'hevc'; }
    if (base.indexOf('avc') === 0) { return 'avc'; }
    if (base.indexOf('av0') === 0) { return 'av1'; }
    return base;
}

// Same codec is mandatory: handing an avc1 playlist to a player decoding hev1 stops it dead until
// the page is reloaded by hand. No compatible variant means null and the caller moves on.
function pickVariant(masterText, want) {
    var lines = masterText.replace(/\\r/g, '').split('\\n');
    var all = [];
    for (var i = 0; i < lines.length - 1; i++) {
        if (lines[i].indexOf('#EXT-X-STREAM-INF') !== 0 || lines[i + 1].indexOf('.m3u8') < 0) { continue; }
        var attrs = parseAttributes(lines[i]);
        if (!attrs['RESOLUTION']) { continue; }
        all.push({ url: lines[i + 1], resolution: attrs['RESOLUTION'], frameRate: attrs['FRAME-RATE'], codecs: attrs['CODECS'] });
    }
    if (!all.length) { return null; }

    var pool = all;
    var wantFamily = want && codecFamily(want.codecs);
    if (wantFamily) {
        pool = all.filter(function (v) { return codecFamily(v.codecs) === wantFamily; });
        if (!pool.length) {
            wlogOnce('codec', 'warn', 'backup ladder carries no ' + wantFamily + ' variant while the player is decoding ' + wantFamily + ' - skipping it, a codec swap stops playback outright');
            return null;
        }
    }

    var wantPixels = 0;
    if (want && want.resolution) {
        var wh = want.resolution.split('x');
        wantPixels = Number(wh[0]) * Number(wh[1]);
    }
    // Ranked, not chosen: abandoning a player type because one rung is stitched throws away the
    // rest of a ladder already paid for. Usually every rendition is stitched at once, but the cost
    // of finding out is one playlist fetch.
    var ranked = pool.slice().map(function (v) {
        var parts = v.resolution.split('x');
        var px = Number(parts[0]) * Number(parts[1]);
        var sameRes = want && v.resolution === want.resolution;
        var sameFps = want && String(v.frameRate) === String(want.frameRate);
        return { url: v.url, resolution: v.resolution, rank: (sameRes && sameFps) ? -2 : (sameRes ? -1 : 1),
                 delta: Math.abs(px - wantPixels) };
    });
    ranked.sort(function (a, b) { return a.rank - b.rank || a.delta - b.delta; });
    return ranked;
}

// Everything the master declares, before our filtering. "Two candidates left" and "two renditions
// exist" look identical in pickVariant's output and mean very different things.
function describeMaster(text) {
    var lines = String(text).replace(/\\r/g, '').split('\\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('#EXT-X-STREAM-INF') !== 0) { continue; }
        var attrs = parseAttributes(lines[i]);
        var next = lines[i + 1] === undefined ? '' : lines[i + 1];
        out.push((attrs['RESOLUTION'] || 'no-resolution') + '/' +
            String(attrs['CODECS'] || '?').split(',')[0].replace(/"/g, '') +
            (next.indexOf('.m3u8') < 0 ? '/not-a-playlist' : ''));
    }
    return out.length ? out.join(' ') : 'no #EXT-X-STREAM-INF at all';
}

function hasAdMarkers(text) {
    return text.indexOf(CONFIG.adSignifier) >= 0;
}

// Removes ad segments and, while an ad is running, the low-latency prefetch hints -- a prefetched
// ad segment would be displayed before we ever saw the playlist entry for it.
function stripAds(text, stream) {
    var lines = text.replace(/\\r/g, '').split('\\n');
    var stripped = false;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
            .replace(/(X-TV-TWITCH-AD-URL=")[^"]*(")/g, '$1https://twitch.tv$2')
            .replace(/(X-TV-TWITCH-AD-CLICK-TRACKING-URL=")[^"]*(")/g, '$1https://twitch.tv$2');
        lines[i] = line;
        if (i < lines.length - 1 && line.indexOf('#EXTINF') === 0 && line.indexOf(',live') < 0) {
            // Cached, NOT removed. Deleting the lines leaves a playlist with no media at all when
            // every segment is an ad: the player runs out of timeline, goes to Ended, and Twitch
            // renders the channel as offline. Kept, they are answered with an empty body instead.
            adSegments.set(lines[i + 1], Date.now());
            stripped = true;
        }
    }
    if (stripped) {
        // Prefetch hints do get removed: a prefetched ad segment is displayed before we ever see
        // the playlist entry that would have let us cache it.
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].indexOf('#EXT-X-TWITCH-PREFETCH:') === 0) { lines[j] = ''; }
        }
    }
    var cutoff = Date.now() - 120000;
    adSegments.forEach(function (at, key) { if (at < cutoff) { adSegments.delete(key); } });
    stream.stripping = stripped;
    return lines.filter(function (l) { return l !== ''; }).join('\\n');
}

// A master only changes when the stream restarts, but fetching one costs a GQL token round-trip
// bridged through the page plus an usher request. Uncached, every playlist poll during a break
// repeated that for every player type: up to nine round-trips every couple of seconds.
function fetchBackupMaster(stream, playerType, realFetch) {
    if (stream.backupMasters[playerType]) {
        return Promise.resolve(stream.backupMasters[playerType]);
    }
    return requestAccessToken(stream.channel, playerType)
        .then(function (token) { return realFetch(buildUsherUrl(stream, token)); })
        .then(function (response) {
            if (response.status !== 200) { throw new Error('usher returned ' + response.status); }
            return response.text();
        })
        .then(function (text) {
            stream.backupMasters[playerType] = text;
            return text;
        });
}

// Resolves to the playlist text if this player type is currently ad-free, null if it still has
// ads, and rejects if it could not be reached at all -- three outcomes the caller treats apart.
function tryPlayerType(stream, playerType, realFetch) {
    return fetchBackupMaster(stream, playerType, realFetch)
        .then(function (masterText) {
            var want = preferredVariant || stream.currentVariant;
            var candidates = pickVariant(masterText, want);
            if (!candidates || !candidates.length) {
                throw new Error('no comparable variant in the backup ladder');
            }
            // Aiming badly and being offered nothing better look identical from the picture alone.
            wlogOnce('rungs:' + playerType, 'debug', playerType + ' master declares [' +
                describeMaster(masterText) + '] -- of which usable ' +
                candidates.map(function (v) { return v.resolution; }).join(', ') +
                ' -- aiming at ' + ((want && want.resolution) || 'unknown') +
                (preferredVariant ? ' (asked for by the page)' : ' (what the player is on)'));
            // First clean rung wins. A lower rendition beats a frozen picture, and the viewer gets
            // their quality back when the break ends.
            // Stay on the rendition this break picked. Only the player type was pinned, so every
            // poll re-ran the choice and the encode could change under the player -- another
            // resolution, another session, another EXT-X-MAP on fMP4 -- while the renumbering kept
            // claiming the segments were contiguous. Dropped with activeBackup at the end of a break.
            // Released when the player moves on its own: it is resetting its decoder anyway, so
            // following costs nothing extra. Without this, a reload during a pre-roll pins the rung
            // the player woke up on -- 284x160 -- and holds the whole break there while the player
            // has long since climbed.
            if (stream.activeVariantUrl && want && stream.servedResolution &&
                want.resolution !== stream.servedResolution) {
                stream.activeVariantUrl = null;
            }

            var pinned = -1;
            if (stream.activeVariantUrl) {
                for (var p = 0; p < candidates.length; p++) {
                    if (candidates[p].url === stream.activeVariantUrl) { pinned = p; break; }
                }
                if (pinned > 0) { candidates = [candidates[pinned]].concat(candidates.slice(0, pinned), candidates.slice(pinned + 1)); }
            }

            var i = 0;
            function attempt() {
                // Do not log the urls to chase an external probe finding this player type clean:
                // they are identical down to the token. The discriminator is the request context --
                // the same usher url returns stitched variants when fetched from the browser.
                if (i >= candidates.length) { return Promise.resolve(null); }
                var index = i++;
                return realFetch(candidates[index].url)
                    .then(function (response) {
                        if (response.status !== 200) {
                            // A cached master outlives its variant urls when the stream restarts.
                            stream.backupMasters[playerType] = null;
                            throw new Error('backup playlist returned ' + response.status);
                        }
                        return response.text();
                    })
                    .then(function (text) {
                        if (!text) { throw new Error('empty backup playlist'); }
                        if (!hasAdMarkers(text)) {
                            // The player keeps the label it had when we swapped the playlist under
                            // it, so its own reading is worthless during a break.
                            stream.servedResolution = candidates[index].resolution;
                            if (stream.activeVariantUrl !== candidates[index].url) {
                                if (stream.activeVariantUrl) {
                                    wlog('info', 'backup rendition changed mid-break to ' +
                                        candidates[index].resolution + ' -- the previous one is gone or stitched');
                                }
                                stream.activeVariantUrl = candidates[index].url;
                            }
                            if (index > 0) {
                                wlog('info', 'backup via ' + playerType + ' was stitched at the' +
                                    ' closest rendition, took rendition ' + (index + 1) + ' of ' +
                                    candidates.length + ' instead');
                            }
                            return text;
                        }
                        return attempt();
                    });
            }
            return attempt();
        });
}

function searchPlayerTypes(stream, realFetch) {
    var index = 0;
    function attempt() {
        if (index >= CONFIG.backupPlayerTypes.length) {
            return Promise.resolve(null);
        }
        var thisIndex = index;
        var playerType = CONFIG.backupPlayerTypes[index++];
        return tryPlayerType(stream, playerType, realFetch)
            .then(function (text) {
                if (!text) {
                    // At info: this is the line that explains a break ending up at 640x360, and
                    // without it the only visible trace is the low resolution itself.
                    wlog('info', 'backup via ' + playerType + ' had ads at every rendition,' +
                        ' trying the next player type');
                    return attempt();
                }
                // Depth pretends the earlier player types still have ads, so 3 forces the fall to
                // autoplay -- on a 2k/4k channel, the codec-mismatch case.
                if (CONFIG.simulatedAdDepth > 0 && thisIndex < CONFIG.simulatedAdDepth - 1) {
                    wlog('debug', 'simulateAd: pretending ' + playerType + ' still has ads');
                    return attempt();
                }
                stream.activeBackup = playerType;
                return { playerType: playerType, text: text };
            })
            .catch(function (err) {
                wlogOnce('backup:' + playerType, 'debug', 'backup stream unavailable via ' + playerType + ': ' + (err && err.message ? err.message : err));
                return attempt();
            });
    }
    return attempt();
}

// One clean playlist, or null with a reason recorded.
function findCleanPlaylist(stream, realFetch) {
    // Stay on whatever is already serving this break: re-running the search every poll changed
    // player type mid-break, which is a second stream swap with nothing to resynchronise it.
    if (stream.activeBackup) {
        var current = stream.activeBackup;
        return tryPlayerType(stream, current, realFetch)
            .then(function (text) {
                if (text) { return { playerType: current, text: text }; }
                wlog('debug', 'backup ' + current + ' picked up ads, searching again');
                stream.activeBackup = null;
                stream.activeVariantUrl = null;
                return searchPlayerTypes(stream, realFetch);
            })
            .catch(function (err) {
                wlogOnce('backup:' + current, 'debug', 'backup stream via ' + current + ' failed: ' + (err && err.message ? err.message : err));
                stream.activeBackup = null;
                stream.activeVariantUrl = null;
                return searchPlayerTypes(stream, realFetch);
            });
    }
    return searchPlayerTypes(stream, realFetch);
}

function onMasterPlaylist(url, text) {
    var match = new URL(url).pathname.match(/([^\\/]+)(?=\\.\\w+$)/);
    if (!match) {
        wlog('warn', 'could not read a channel name from ' + url);
        return text;
    }
    var channel = match[0];
    var stream = streamsByChannel[channel];
    if (!stream) {
        stream = streamsByChannel[channel] = {
            channel: channel, usherBase: null, variants: Object.create(null), currentVariant: null,
            adActive: false, stripping: false, cleanSince: null,
            // Per player type, kept across breaks: valid for the session, so the next break starts
            // warm instead of paying for the token round-trip again.
            backupMasters: Object.create(null),
            activeBackup: null
        };
    }
    var usher = new URL(url);
    usher.searchParams.delete('parent_domains');
    usher.searchParams.delete('sig');
    usher.searchParams.delete('token');
    stream.usherBase = usher.href;

    var lines = text.replace(/\\r/g, '').split('\\n');
    for (var i = 0; i < lines.length - 1; i++) {
        if (lines[i].indexOf('#EXT-X-STREAM-INF') !== 0 || lines[i + 1].indexOf('.m3u8') < 0) { continue; }
        var attrs = parseAttributes(lines[i]);
        if (!attrs['RESOLUTION']) { continue; }
        var info = { resolution: attrs['RESOLUTION'], frameRate: attrs['FRAME-RATE'], codecs: attrs['CODECS'] };
        stream.variants[lines[i + 1]] = info;
        streamsByPlaylistUrl[lines[i + 1]] = stream;
    }
    return text;
}

// -- sequence renumbering ----------------------------------------------------------------------
// MEDIA-SEQUENCE is per session and counts ads too, so an ad-free backup drifts behind by a break's
// worth every time. The player fetches by number, so the drift costs gap x segment duration of
// video. We renumber what we serve, moving the offset only at the edges of a break.
var SEQ_TAG = '#EXT-X-MEDIA-SEQUENCE:';
// Segments the head may drift from the elapsed time before an exit re-anchor is refused.
var SEQ_STEP_TOLERANCE = 6;

function seqRead(text) {
    var at = text.indexOf(SEQ_TAG);
    if (at < 0) { return null; }
    var end = text.indexOf('\\n', at);
    var value = parseInt(text.substring(at + SEQ_TAG.length, end < 0 ? text.length : end), 10);
    return isNaN(value) ? null : value;
}

function seqWrite(text, value) {
    var at = text.indexOf(SEQ_TAG);
    if (at < 0) { return null; }
    var end = text.indexOf('\\n', at);
    if (end < 0) { end = text.length; }
    if (end > 0 && text.charAt(end - 1) === '\\r') { end--; }
    return text.substring(0, at) + SEQ_TAG + value + text.substring(end);
}

function seqSegments(text) {
    // CRLF: a trailing \\r makes Date.parse NaN and kills every anchor silently.
    var out = [], pdt = null, lines = text.replace(/\\r/g, '').split('\\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('#EXT-X-PROGRAM-DATE-TIME:') === 0) { pdt = Date.parse(line.slice(25)); }
        else if (line.indexOf('#EXTINF:') === 0) {
            out.push({ pdt: pdt, d: parseFloat(line.slice(8)) || 0 });
            pdt = null;
        }
    }
    return out;
}

// The tail: the only anchor meaning the same instant in both sessions, since the original's head
// freezes during a break while its tail follows the live edge.
function seqTail(text) {
    var seq = seqRead(text), segs = seqSegments(text);
    if (seq === null || !segs.length || !segs[segs.length - 1].pdt) { return null; }
    return { n: seq + segs.length - 1, pdt: segs[segs.length - 1].pdt, seq: seq, count: segs.length };
}

// The number this playlist gives to an instant. Interpolated: the two sessions' boundaries sit a
// few hundred ms apart, so an exact PDT lookup finds nothing.
function seqNumberAt(text, pdt) {
    var seq = seqRead(text), segs = seqSegments(text);
    if (seq === null || segs.length < 2 || !segs[0].pdt || !segs[segs.length - 1].pdt || !pdt) { return null; }
    var first = segs[0].pdt, last = segs[segs.length - 1].pdt;
    if (!(last > first)) { return null; }

    // Real boundaries, not a uniform step: a break's window mixes durations and an average is off
    // by a segment or two.
    if (pdt >= first && pdt <= last) {
        var at = first;
        for (var i = 0; i < segs.length - 1; i++) {
            var d = (segs[i + 1].pdt !== null && segs[i + 1].pdt !== undefined)
                ? segs[i + 1].pdt - at
                : (segs[i].d || 0) * 1000;
            if (!(d > 0)) { continue; }
            if (pdt <= at + d) { return seq + i + (pdt - at) / d; }
            at += d;
        }
        return seq + segs.length - 1;
    }

    // Outside the window only the average is left, and one window of slack is as far as it reaches:
    // beyond that a stale anchor gets a confident, meaningless answer.
    var step = (last - first) / (segs.length - 1);
    if (!(step > 0)) { return null; }
    var slack = last - first;
    if (pdt < first - slack || pdt > last + slack) { return null; }
    return seq + (pdt - first) / step;
}

// The floor is per rendition: they share one stream object, but their playlists do not tick
// together, and a rendition a segment behind another would raise the offset for the whole channel
// and advertise a segment that does not exist yet.
function seqServe(stream, url, text, seq, field) {
    var last = stream.seqHeads[url];
    var floor = (last === null || last === undefined) ? 0 : last;
    if (floor < 0) { floor = 0; }
    var head = seq + stream[field];
    if (head < floor) {
        // Raise the offset, not the number: pinning it turns the step into a stall, the playlist
        // advancing while the number does not. Floor at zero, MEDIA-SEQUENCE is unsigned.
        stream[field] = floor - seq;
        head = floor;
    }
    stream.seqHeads[url] = head;
    stream.seqServedHead = head;
    if (head === seq) { return text; }
    var rewritten = seqWrite(text, head);
    return rewritten === null ? text : rewritten;
}

// Anything from the original -- outside a break, or a stripped one -- takes the session offset.
// Always through seqServe, so the floor sees it.
function seqApplySessionOffset(stream, url, text) {
    var seq = seqRead(text);
    if (seq === null) { return text; }
    return seqServe(stream, url, text, seq, 'seqOffset');
}

// A session restart needs no special case: the floor raises the offset and the numbering carries
// on. Do not add a detector that serves raw -- a variant switch looks identical, and the append is
// then refused.

// Re-anchors an offset so a new source continues the numbering already served: each session numbers
// from its own base. False when there is no usable anchor, and the caller keeps what it had.
function seqReanchor(stream, text, field) {
    if (stream.seqServedPdt === undefined || stream.seqServedNumber === undefined) { return false; }
    var here = seqNumberAt(text, stream.seqServedPdt);
    if (here === null) { return false; }
    stream[field] = Math.round(stream.seqServedNumber - here);
    return true;
}

// A stripped break: no backup found, so we are back on the original numbering.
function seqStrippedBreak(stream, url, text) {
    if (!CONFIG.renumberSequence) { return text; }
    // Marked only on success, or a failed anchor is never retried and rides the whole break.
    if (stream.seqInBreak && stream.seqSource !== 'orig' && seqReanchor(stream, text, 'seqOffset')) {
        stream.seqSource = 'orig';
    }
    // Still a break, or the exit never re-anchors.
    if (!stream.seqInBreak) {
        stream.seqInBreak = true;
        stream.seqSource = 'orig';
    }
    var served = seqApplySessionOffset(stream, url, text);
    var tail = seqTail(text);
    if (tail) {
        stream.seqServedPdt = tail.pdt;
        stream.seqServedNumber = stream.seqServedHead + (tail.count - 1);
    }
    return served;
}

// Outside a break, and the moment one ends: the original advanced by every stitched segment while
// we were away, so the offset is re-anchored here.
function seqOutsideBreak(stream, url, text) {
    if (!CONFIG.renumberSequence) { return text; }
    // On adActive, not the markers: a pod drops them between videos and the break stays open.
    if (stream.seqInBreak && !stream.adActive) {
        stream.seqInBreak = false;
        stream.seqSource = 'orig';
        var previous = stream.seqOffset;
        if (seqReanchor(stream, text, 'seqOffset')) {
            // Continuity, not magnitude: a size cap would have to exempt the pre-roll exit, which
            // moves by thousands and is still continuous.
            var head = seqRead(text), tail = seqTail(text);
            if (head !== null && tail && stream.seqServedHead !== null && stream.seqServedHead !== undefined &&
                stream.seqServedPdt) {
                // Tolerance from the elapsed time: a constant conflates the offset moving with the
                // playlist advancing, and rejects good corrections.
                var step = (tail.d || 2) * 1000;
                var expected = (tail.pdt - stream.seqServedPdt) / step;
                var actual = (head + stream.seqOffset) - stream.seqServedHead;
                if (Math.abs(actual - expected) > SEQ_STEP_TOLERANCE) {
                    wlog('info', '[SEQ] exit re-anchor rejected: offset ' + stream.seqOffset + ' moves the head by ' +
                        actual.toFixed(1) + ' segments while ' + expected.toFixed(1) + ' went by -- keeping ' + previous);
                    stream.seqOffset = previous;
                }
            }
        }
        stream.seqBlind = false;
    }
    return seqApplySessionOffset(stream, url, text);
}

// Inside a break, serving the backup in place of the original.
function seqInsideBreak(stream, url, text, cleanText) {
    if (!CONFIG.renumberSequence) { return cleanText; }
    // No tail: use the backup's own offset. The session offset on a backup number gets written back
    // into seqOffset by the floor and corrupts it for good.
    var backup = seqTail(cleanText);
    if (!backup) {
        if (stream.seqInBreak) { return seqServe(stream, url, cleanText, seqRead(cleanText), 'seqBackupOffset'); }
        return cleanText;
    }

    // The backup changes identity when its player type picks up ads, and another session numbers
    // from another base.
    var source = 'backup:' + (stream.activeBackup || '?');
    if (stream.seqInBreak && stream.seqSource !== source && seqReanchor(stream, cleanText, 'seqBackupOffset')) {
        stream.seqSource = source;
    }

    if (!stream.seqInBreak) {
        stream.seqInBreak = true;
        stream.seqSource = source;
        // Channel-wide, not this rendition: a switch at the break edge would otherwise read as a
        // pre-roll and ride the whole break blind.
        if (stream.seqServedHead === null || stream.seqServedHead === undefined) {
            // Nothing seen outside the break, so the player's numbers are unknown and a drift would
            // drag it backwards. Ride what is in flight, re-anchor at the exit. Every pre-roll.
            stream.seqBackupOffset = 0;
            stream.seqBlind = true;
        } else {
            var original = seqTail(text);
            if (!original) { stream.seqInBreak = false; return cleanText; }
            stream.seqBackupOffset = stream.seqOffset + (original.n - backup.n);
        }
    }

    var served = seqServe(stream, url, cleanText, backup.seq, 'seqBackupOffset');
    // Anchor from the number written, not the formula: the floor makes them differ, and the exit
    // would agree with itself while the player starves.
    stream.seqServedPdt = backup.pdt;
    stream.seqServedNumber = stream.seqServedHead + (backup.count - 1);
    return served;
}

function onMediaPlaylist(url, text, realFetch) {
    var stream = streamsByPlaylistUrl[url];
    if (!stream) { return Promise.resolve(text); }
    stream.currentVariant = stream.variants[url] || stream.currentVariant;
    if (stream.seqOffset === undefined) {
        stream.seqOffset = 0;
        stream.seqHeads = {};
        stream.seqServedHead = null;
        stream.seqInBreak = false;
    }

    // Waiting for a midroll on a particular channel is not a workable way to reach the interesting
    // cases, the codec mismatch on a 2k/4k channel above all.
    if (CONFIG.simulatedAdDepth > 0) {
        if (!stream.adActive) {
            stream.adActive = true;
            wclearOnce('rungs:');
            self.postMessage({ key: 'AdStarted', channel: stream.channel, isMidroll: true, simulated: true });
        }
        return findCleanPlaylist(stream, realFetch).then(function (clean) {
            if (clean) {
                self.postMessage({ key: 'AdBlocked', channel: stream.channel, playerType: clean.playerType, isMidroll: true, stripping: false, resolution: stream.servedResolution || null });
                return clean.text;
            }
            // Falls through to stripping exactly like the real path, otherwise the simulation
            // cannot exercise the branch that matters most on 2k/4k channels -- where no backup
            // carries HEVC and stripping is the only thing left.
            if (CONFIG.stripAdSegments) {
                var strippedText = stripAds(text, stream);
                self.postMessage({ key: 'AdBlocked', channel: stream.channel, playerType: null, isMidroll: true, stripping: true });
                return strippedText;
            }
            wlogOnce('sim', 'warn', 'simulateAd: no clean playlist at depth ' + CONFIG.simulatedAdDepth);
            return text;
        });
    }

    if (!hasAdMarkers(text)) {
        if (stream.adActive) {
            // Multi-ad pods drop the markers for a poll or two between videos, and calling that
            // the end meant resyncing mid-break. The clean playlist is still served during the
            // grace window, so only the end-of-break decision waits, not the content.
            if (!stream.cleanSince) {
                stream.cleanSince = Date.now();
            }
            if (Date.now() - stream.cleanSince >= CONFIG.adEndGraceMs) {
                stream.adActive = false;
                stream.stripping = false;
                stream.cleanSince = null;
                // Released so the next break picks a player type on its own merits. The cached
                // master playlists deliberately survive: they are what make the next break start
                // without paying for the token round-trip all over again.
                stream.activeBackup = null;
                stream.activeVariantUrl = null;
                self.postMessage({ key: 'AdEnded', channel: stream.channel });
            }
        }
        return Promise.resolve(seqOutsideBreak(stream, url, text));
    }
    // Markers are back: whatever gap we were in was between ads, not the end of the break
    if (stream.cleanSince) {
        wlog('debug', 'ad markers returned after ' + (Date.now() - stream.cleanSince) + 'ms of clean playlist - same break, still one pod');
        stream.cleanSince = null;
    }

    var isMidroll = text.indexOf('"MIDROLL"') >= 0 || text.indexOf('"midroll"') >= 0;
    if (!stream.adActive) {
        stream.adActive = true;
        // Each break reports its own ladders. Two breaks minutes apart can see different ones --
        // that is the whole reason to log them -- so carrying the suppression across is what makes
        // the census useless exactly when it would have been informative.
        wclearOnce('rungs:');
        self.postMessage({ key: 'AdStarted', channel: stream.channel, isMidroll: isMidroll });
    }

    if (!CONFIG.blockAds) {
        return Promise.resolve(text);
    }

    return findCleanPlaylist(stream, realFetch).then(function (clean) {
        if (clean) {
            self.postMessage({ key: 'AdBlocked', channel: stream.channel, playerType: clean.playerType, isMidroll: isMidroll, stripping: false, resolution: stream.servedResolution || null });
            return seqInsideBreak(stream, url, text, clean.text);
        }
        if (CONFIG.stripAdSegments) {
            var strippedText = stripAds(text, stream);
            self.postMessage({ key: 'AdBlocked', channel: stream.channel, playerType: null, isMidroll: isMidroll, stripping: true });
            return seqStrippedBreak(stream, url, strippedText);
        }
        wlogOnce('leak', 'warn', 'no clean playlist and stripping is off -- ads will be shown');
        return seqStrippedBreak(stream, url, text);
    });
}

function installFetchHook() {
    var realFetch = self.fetch;
    self.fetch = function (input, options) {
        if (typeof input !== 'string') {
            return realFetch.apply(this, arguments);
        }
        var url = input.trimEnd();

        if (adSegments.has(url)) {
            return Promise.resolve(emptySegmentResponse());
        }

        if (url.indexOf('/channel/hls/') >= 0 && url.indexOf('picture-by-picture') < 0) {
            if (CONFIG.forcePlayerType) {
                // parent_domains is how the backend decides the player is embedded, and leaving it
                // on while the playerType says otherwise is what produces the embed-shaped fake ads
                var stripped = new URL(url);
                stripped.searchParams.delete('parent_domains');
                url = stripped.href;
            }
            return realFetch(url, options).then(function (response) {
                if (response.status !== 200) { return response; }
                return response.text().then(function (text) {
                    var serverTime = readServerTime(text);
                    var out = onMasterPlaylist(url, text);
                    return new Response(writeServerTime(out, serverTime), { status: 200 });
                });
            });
        }

        if (url.endsWith('m3u8')) {
            return realFetch(url, options).then(function (response) {
                if (response.status !== 200) { return response; }
                return response.text()
                    .then(function (text) { return onMediaPlaylist(url, text, realFetch); })
                    .then(function (out) { return new Response(out, { status: 200 }); });
            });
        }

        return realFetch.apply(this, arguments);
    };
}

var OUR_MESSAGE_KEYS = {
    UpdateDeviceId: 1, UpdateClientVersion: 1, UpdateClientSession: 1,
    UpdateIntegrity: 1, UpdateAuthorization: 1, PlayerReloaded: 1, FetchResponse: 1,
    SimulateAd: 1, PreferVariant: 1, ChannelChanged: 1
};

// Registered before Twitch's worker is loaded, so this listener runs first and can stop our own
// messages reaching its onmessage. Its handler assumes every message is one of its own and throws
// on anything else, which during startup is enough to leave it uninitialised and the player dead.
self.addEventListener('message', function (e) {
    var data = e.data || {};
    if (OUR_MESSAGE_KEYS[data.key]) {
        e.stopImmediatePropagation();
    }
    if (data.key === 'UpdateDeviceId') {
        // The page's real id supersedes anything we generated, and clears the hold on integrity:
        // once the two match again there is nothing replay-shaped about sending them together.
        GQLState.deviceId = data.value;
        GQLState.deviceIdInvented = false;
        return;
    }
    if (data.key === 'UpdateClientVersion') { GQLState.clientVersion = data.value; return; }
    if (data.key === 'UpdateClientSession') { GQLState.clientSession = data.value; return; }
    if (data.key === 'UpdateIntegrity') { GQLState.integrity = data.value; return; }
    // What rendition the backup search should aim at, when the page knows better than the player
    // does. Sent after a codec step-down and cleared at the end of the break.
    if (data.key === 'PreferVariant') { preferredVariant = data.value || null; return; }
    if (data.key === 'ChannelChanged') {
        // onMediaPlaylist is what ends a break, and the playlist being left stops being polled, so
        // its break never ends: returning later would resume it. The cached master playlists survive
        // on purpose, the backup in use does not.
        preferredVariant = null;
        var left = data.value && streamsByChannel[data.value];
        if (left) {
            left.adActive = false;
            left.stripping = false;
            left.cleanSince = null;
            left.activeBackup = null;
            left.activeVariantUrl = null;
            // Same for the sequence state: coming back the player is a new session, and an offset
            // or a floor from the previous visit would be applied to numbers it never described.
            left.seqOffset = 0;
            left.seqHeads = {};
            left.seqServedHead = null;
            left.seqInBreak = false;
            left.seqSource = null;
            left.seqBackupOffset = 0;
            left.seqServedPdt = undefined;
            left.seqServedNumber = undefined;
            left.seqBlind = false;
        }
        return;
    }
    if (data.key === 'UpdateAuthorization') { GQLState.authorization = data.value; return; }
    if (data.key === 'PlayerReloaded') { lastReloadAt = Date.now(); return; }
    if (data.key === 'SimulateAd') {
        CONFIG.simulatedAdDepth = data.value | 0;
        wlog('warn', 'simulateAd depth set to ' + CONFIG.simulatedAdDepth + (CONFIG.simulatedAdDepth ? ' - forcing the ad path until set back to 0' : ' - back to real ad detection'));
        if (!CONFIG.simulatedAdDepth) {
            // Release the forced state so the next real break starts from a clean slate
            Object.keys(streamsByChannel).forEach(function (k) {
                streamsByChannel[k].adActive = false;
                streamsByChannel[k].activeBackup = null;
                streamsByChannel[k].activeVariantUrl = null;
            });
            self.postMessage({ key: 'AdEnded', channel: 'simulation' });
        }
        return;
    }
    if (data.key === 'FetchResponse') {
        var payload = data.value;
        var pending = pendingFetches.get(payload.id);
        if (!pending) { return; }
        pendingFetches.delete(payload.id);
        if (payload.error) {
            pending.reject(new Error(payload.error));
        } else {
            pending.resolve(new Response(payload.body, { status: payload.status, statusText: payload.statusText, headers: payload.headers }));
        }
    }
});

// Load Twitch's own worker only after the hook is in place. importScripts is the documented way
// to do this; the synchronous XHR plus eval below is the fallback for environments that refuse a
// blob URL here.
function loadTwitchWorker(url) {
    try {
        self.importScripts(url);
        return;
    } catch (err) {
        wlog('debug', 'importScripts failed (' + err + '), falling back to XHR');
    }
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.overrideMimeType('text/javascript');
    request.send();
    // eslint-disable-next-line no-eval
    (0, eval)(request.responseText);
}

installFetchHook();
`;

    function installWorkerHook() {
        const NativeWorker = window.Worker;

        class HookedWorker extends NativeWorker {
            constructor(scriptUrl, options) {
                let isTwitchWorker = false;
                try {
                    isTwitchWorker = new URL(scriptUrl).origin.endsWith('.twitch.tv');
                } catch {}
                if (!isTwitchWorker) {
                    super(scriptUrl, options);
                    return;
                }

                const init = {
                    config: {
                        blockAds: Config.BlockAds,
                        adSignifier: Config.AdSignifier,
                        backupPlayerTypes: Config.BackupPlayerTypes.slice(),
                        stripAdSegments: Config.StripAdSegments,
                        renumberSequence: Config.RenumberSequence !== false,
                        forcePlayerType: !!Config.ForceAccessTokenPlayerType,
                        adEndGraceMs: Math.max(0, Config.AdEndGraceSeconds * 1000),
                        simulatedAdDepth: 0,
                        tokenMode: State.gqlTokenMode
                    },
                    gql: {
                        clientId: GQL.clientId,
                        deviceId: GQL.deviceId,
                        clientVersion: GQL.clientVersion,
                        clientSession: GQL.clientSession,
                        integrity: GQL.integrity,
                        authorization: GQL.authorization
                    }
                };
                const source = 'var VAFT2_INIT = ' + JSON.stringify(init) + ';\n' +
                    WORKER_SOURCE + '\nloadTwitchWorker(' + JSON.stringify(scriptUrl) + ');\n';
                super(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })), options);

                State.workers.push(this);
                log('debug', 'wrapped Twitch worker #' + State.workers.length);

                this.addEventListener('message', async (event) => {
                    const data = event.data || {};
                    if (messageIsStale(data)) {
                        log('debug', 'ignoring a late ' + data.key + ' for ' + data.channel +
                            ', that channel has been left');
                        return;
                    }
                    switch (data.key) {
                        case 'Log':
                            log(data.level || 'info', data.message);
                            break;
                        case 'FetchRequest':
                            this.postMessage({ key: 'FetchResponse', value: await performWorkerFetch(data.value) });
                            break;
                        case 'TokenModeChanged':
                            State.gqlTokenMode = data.value;
                            break;
                        case 'AdStarted':
                            State.counters.breaks++;
                            State.adActive = true;
                            State.adIsMidroll = !!data.isMidroll;

                            log('info', 'ad break started on ' + data.channel +
                                (data.isMidroll ? ' (midroll)' : '') + ' -- ' + describePlayback());
                            if (Config.CrossCheckAdEvents && State.playerAdEvent !== 'start') {
                                log('debug', 'we saw the ad before the player reported stitchedadstart');
                            }
                            updateBanner();
                            break;
                        case 'AdBlocked':
                            State.activeBackupPlayerType = data.playerType;
                            State.strippingSegments = !!data.stripping;
                            logOnce('blocking', 'info', data.playerType
                                ? 'serving a clean stream via ' + data.playerType +
                                    (data.resolution ? ' at ' + data.resolution : '')
                                : 'no clean stream available, stripping ad segments');

                            if (!data.playerType) {
                                stepDownFromStrippedCodec();
                            }
                            updateBanner();
                            break;
                        case 'AdEnded':
                            State.adActive = false;
                            State.activeBackupPlayerType = null;
                            State.strippingSegments = false;
                            clearOnce('blocking');
                            clearOnce('leak');

                            log('info', 'ad break finished on ' + data.channel +
                                ' -- watched at ' + describePlayback());
                            restoreQualityAfterAdBreak();
                            updateBanner();
                            if (Config.ReloadPlayerAfterAd) {
                                reloadPlayer();
                            } else {
                                pauseResumePlayer();
                            }
                            break;
                        default:
                            break;
                    }
                });
            }
        }

        Object.defineProperty(window, 'Worker', {
            configurable: true,
            get() { return HookedWorker; },
            set() { log('debug', 'refused an attempt to replace window.Worker'); }
        });
    }

    window.vaft2 = {
        config: Config,
        status() {
            const found = getPlayer();
            const player = found?.player;
            let quality = null;
            try {
                const q = player?.getQuality?.();
                quality = q && (q.name || q.group);
            } catch {}
            return {
                version: VERSION,
                adActive: State.adActive,
                adIsMidroll: State.adIsMidroll,
                backupPlayerType: State.activeBackupPlayerType,
                strippingSegments: State.strippingSegments,
                playerAdEvent: State.playerAdEvent,
                tokenMode: State.gqlTokenMode,
                counters: Object.assign({}, State.counters),
                layers: {
                    hideVisibility: Visibility.installed,
                    adManagerDeclined: AdManager.applied,
                    adManagerReason: AdManager.reason,
                    adManagerModule: AdManager.moduleId,
                    adManagerAttempts: AdManager.attempts,
                    pinHighestQuality: Config.PinHighestQuality,
                    qualityFlagInStorage: (() => { try { return localStorage.getItem(QUALITY_KEY); } catch { return 'unreadable'; } })()
                },
                player: {
                    found: !!player,
                    state: (() => { try { return player?.getState?.(); } catch { return null; } })(),
                    quality,
                    autoQualityMode: player?.core?.state?.autoQualityMode ?? null,
                    reallyHidden: Visibility.isReallyHidden()
                },
                workers: State.workers.length
            };
        },

        overlayBuffer() {
            return OverlayAds.buffer.slice();
        },
        overlayLayout: describeOverlayLayout,

        simulateAd(depth) {
            const value = Math.max(0, depth | 0);
            postToWorkers({ key: 'SimulateAd', value });
            log('info', value
                ? 'simulating an ad break at depth ' + value + ' - call window.vaft2.simulateAd(0) to stop'
                : 'simulation off');
            return value;
        },
        setLogLevel(level) {
            if (!(level in LEVELS)) {
                console.log('[TSE-AdBlock] log levels: ' + Object.keys(LEVELS).join(', '));
                return;
            }
            Config.LogLevel = level;
        },
        reloadPlayer,

        help() {
            const names = Object.keys(window.vaft2)
                .map((k) => 'window.vaft2.' + k + (typeof window.vaft2[k] === 'function' ? '()' : ''))
                .sort();
            console.log(['[TSE-AdBlock] v2 active -- ' + VERSION].concat(names).join('\n'));
        }
    };

    installFetchHook();
    installWorkerHook();
    applyQualityPreference(Config.PinHighestQuality);

    try {
        Visibility.allowNextVisibilityChange = document.visibilityState === 'hidden';
    } catch {}
    installVisibilityLayer();

    installNavigationWatch();

    startAdManagerDecline();

    function onReady() {
        ensurePlayerWired();
        startStallBackstop();
        startDeadPlayerWatch();
        startOverlayAdWatch();

        document.addEventListener('click', () => ensurePlayerWired(), true);
        setTimeout(function rewire() {
            ensurePlayerWired();
            setTimeout(rewire, 5000);
        }, 5000);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        onReady();
    } else {
        window.addEventListener('DOMContentLoaded', onReady);
    }

})();
