

const TSE_PREVIEW_PARENTS = ['https://www.twitch.tv', 'https://twitch.tv'];

const tseOrigineParent = () => {
  try {
    const a = location.ancestorOrigins;
    return a && a.length ? a[0] : null;
  } catch { return null; }
};

const TSE_GATE_BUTTON =
  'button[data-a-target="content-classification-gate-overlay-start-watching-button"]';

const TSE_GATE_ZONE = '[data-a-target^="content-classification-gate"]';

const TSE_GATE_MAX_CLICKS = 5;

const TSE_PUB_REPERES = '[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"], '
  + '[data-test-selector="ad-banner-default-text"]';

{

  const TSE_PREVIEW_FIRST_FRAME_MSG = 'tse:preview-first-frame';

  const TSE_PREVIEW_GATE_MSG = 'tse:preview-gate';

  const TSE_PREVIEW_HELLO_MSG = 'tse:preview-hello';

  const TSE_PREVIEW_FRAME_NAME = 'tse-apercu';

  const TSE_GATE_ENABLED = true;

  (() => {
    'use strict';

    try {
      if (window.top === window) return;
      if (location.hostname !== 'player.twitch.tv') return;
      if (window.name !== TSE_PREVIEW_FRAME_NAME) return;
    } catch { return; }

    const parentConnu = tseOrigineParent();

    if (parentConnu && !TSE_PREVIEW_PARENTS.includes(parentConnu)) return;
    const targets = parentConnu ? [parentConnu] : TSE_PREVIEW_PARENTS;

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

  const TSE_SALLE_FRAME_NAME = 'tse-salle';
  const TSE_SALLE_ETAT_MSG = 'tse:salle-etat';
  const TSE_SALLE_ORDRE_MSG = 'tse:salle-ordre';

  const TSE_SALLE_RELEVE_MSG = 'tse:salle-releve';

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

    let gestes = 0;
    const compterGeste = (e) => { if (e.isTrusted) gestes += 1; };
    window.addEventListener('pointerdown', compterGeste, true);
    window.addEventListener('keydown', compterGeste, true);

    const leves = new WeakSet();
    let avertissementVu = false, avertissementClics = 0;
    const leverAvertissement = () => {

      const visible = (b) => { if (!b) return null; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? b : null; };
      const zone = document.querySelector(TSE_GATE_ZONE);
      const bouton = visible(document.querySelector(TSE_GATE_BUTTON)) || (zone ? visible(zone.querySelector('button')) : null);
      if (!bouton) return false;
      avertissementVu = true;
      if (!TSE_GATE_ENABLED || avertissementClics >= TSE_GATE_MAX_CLICKS || leves.has(bouton)) return true;
      leves.add(bouton);
      avertissementClics += 1;
      try { bouton.click(); } catch {   }
      return true;
    };

    let instanceLecteur = null;

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
      } catch {   }
      return null;
    };

    let hauteurVoulue = null;
    let qualiteEssais = 0;
    let qualiteT = 0;

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

    const tenirQualite = () => {
      if (!hauteurVoulue || qualiteEssais >= 5 || Date.now() - qualiteT < 3000 || enPub()) return;
      const lecteur = lecteurTwitch();
      if (!lecteur || typeof lecteur.setQuality !== 'function') return;
      let echelle = [];
      try { echelle = lecteur.getQualities() || []; } catch { return; }
      const cible = choisirQualite(echelle, hauteurVoulue);
      if (!cible) return;
      let actuelle = null, auto = null;
      try { actuelle = lecteur.getQuality && lecteur.getQuality(); } catch {   }
      try { auto = lecteur.isAutoQualityMode ? lecteur.isAutoQualityMode() : null; } catch {   }
      if (actuelle && actuelle.name === cible.name && auto === false) return;
      try {
        lecteur.setQuality(cible);
        qualiteEssais += 1;
        qualiteT = Date.now();
      } catch { qualiteEssais += 1; qualiteT = Date.now(); }
    };

    const releveLecteur = () => {
      const lecteur = lecteurTwitch();
      if (!lecteur) return { lecteur: false };
      const lire = (f) => { try { const x = f(); return Number.isFinite(x) ? Math.round(x * 100) / 100 : null; } catch { return null; } };
      let nom = null, auto = null;
      try { nom = lecteur.getQuality ? (lecteur.getQuality() || {}).name || null : null; } catch {   }
      try { auto = lecteur.isAutoQualityMode ? !!lecteur.isAutoQualityMode() : null; } catch {   }
      return {
        lecteur: true, qualite: nom, auto,
        latence: lecteur.getLiveLatency ? lire(() => lecteur.getLiveLatency()) : null,
        tampon: lecteur.getBufferDuration ? lire(() => lecteur.getBufferDuration()) : null,
      };
    };

    const etatSalle = () => {
      const v = document.querySelector('video');
      tenirQualite();
      const avertissement = leverAvertissement();

      const q = v && typeof v.getVideoPlaybackQuality === 'function' ? v.getVideoPlaybackQuality() : null;
      return {
        ...releveLecteur(),
        qualiteVoulue: hauteurVoulue,
        vitesse: v ? v.playbackRate : null,
        video: !!v,
        lecture: !!v && !v.paused,
        muet: v ? v.muted : null,

        volume: v ? Math.round(v.volume * 100) / 100 : null,
        images: q ? q.totalVideoFrames : null,
        perdues: q ? q.droppedVideoFrames : null,
        octets: v && typeof v.webkitVideoDecodedByteCount === 'number'
          ? v.webkitVideoDecodedByteCount + (Number(v.webkitAudioDecodedByteCount) || 0) : null,

        pub: enPub(),
        pubVisible: [...document.querySelectorAll(TSE_PUB_REPERES)].some((el) => el.getClientRects().length > 0),
        boutonSon: !!document.querySelector(BOUTON_SON),
        avertissement, avertissementVu, avertissementClics,
        gestes,
        ordre,
      };
    };

    const lireNombre = (f, chiffres = 3) => {
      try {
        const x = f();
        const p = 10 ** chiffres;
        return Number.isFinite(x) ? Math.round(x * p) / p : null;
      } catch { return null; }
    };

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

    let essai = null;
    let numeroEssai = 0;

    const deplacer = (s, sens = 1) => {
      const lecteur = lecteurTwitch();
      const v = document.querySelector('video');
      const type = sens > 0 ? 'recul' : 'avance';

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
        try { avant = lecteur.getPosition(); lecteur.seekTo(avant - sens * s); voie = 'instance'; } catch {   }
      }
      if (!voie && v) { avant = v.currentTime; v.currentTime = avant - sens * s; voie = 'video'; }
      const e = { n: ++numeroEssai, type, valeur: s, voie: voie || 'sans-video', t: Date.now(), fin: null,
                  avant: Number.isFinite(avant) ? Math.round(avant * 1000) / 1000 : null, apres: null };
      essai = e;
      if (!voie) return;
      setTimeout(() => {
        const p = voie === 'instance' ? lireNombre(() => lecteur.getPosition()) : (v ? v.currentTime : null);
        e.apres = Number.isFinite(p) ? Math.round(p * 1000) / 1000 : null;

        e.ecouleS = Math.round(performance.now() - t0) / 1000;
        e.fin = Date.now();
      }, 500);
    };

    const retirerFaibleLatence = () => {
      const lecteur = lecteurTwitch();
      let voie;
      if (!lecteur || typeof lecteur.setLiveLowLatencyEnabled !== 'function') voie = 'absent';
      else {
        try { lecteur.setLiveLowLatencyEnabled(false); voie = 'instance'; } catch (err) { voie = `refusé : ${(err && err.name) || 'erreur'}`; }
      }
      essai = { n: ++numeroEssai, type: 'faible-latence', valeur: false, voie, t: Date.now(), fin: Date.now() };
    };

    const arriereElement = (v) => {
      try {
        if (!v || !v.buffered || !Number.isFinite(v.currentTime)) return null;
        for (let i = 0; i < v.buffered.length; i++) {
          const s = v.buffered.start(i), e = v.buffered.end(i);
          if (v.currentTime >= s && v.currentTime <= e + 0.1) return Math.round((v.currentTime - s) * 1000) / 1000;
        }
      } catch {   }
      return null;
    };

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
        try { cles = ['video', ...Object.keys(r)]; } catch {   }
        const tab = cles.map((k) => r[k]).find((v) => Array.isArray(v) && v.length && paire(v[0]));
        if (tab) l = tab.map(paire);
      }
      const forme = Array.isArray(r) || r === undefined || r === null ? null : formeDe(r);
      if (!l) return { plages: r === undefined || r === null ? null : forme, forme };
      return { plages: l.slice(0, 8).map((x) => (x && x.every(Number.isFinite) ? x.map((y) => Math.round(y * 1000) / 1000) : null)), forme };
    };

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

      const MARCHE_MS = 15;
      let secMin = Infinity, secT = 0, marches = 0, marchesMs = [];

      let rang = -1, dernierPt = null;

      let sonVu = false, amorce = 0;
      let lot = [];

      let secondes = [], blocs = 0, muets = 0;

      const debrancher = () => {
        try { if (source) source.disconnect(); } catch {   }
        source = null; piste = null;
      };

      const detacher = () => {
        debrancher();
        if (flux) for (const p of flux.getTracks()) { try { p.stop(); } catch {   } }
        flux = null; video = null;
      };
      const relier = () => {
        const v = document.querySelector('video');
        if (!v) { etat = 'sans-video'; return; }
        if (typeof v.captureStream !== 'function') { etat = 'indisponible'; return; }

        if (!proc) return;
        if (v !== video) {
          detacher();
          try { flux = v.captureStream(); } catch (e) { etat = `erreur:${(e && e.name) || 'capture'}`; return; }
          video = v;
        }
        const vivantes = flux.getAudioTracks().filter((p) => p.readyState === 'live');
        const derniere = vivantes[vivantes.length - 1] || null;
        if (!derniere) {

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

      const surFin = (finMs, puissance, mur) => {
        const ecart = mur - finMs;

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

        const niveau = Math.log10(puissance + 1e-8);
        blocs += 1;
        if (niveau < -7) muets += 1;
        if (!sonVu) { if (niveau < -7) return; sonVu = true; }
        if (amorce > 0) { amorce -= 1; return; }

        lot.push([Math.round((ancre + finMs - ((B / sr) * 1000) / 2) * 10) / 10, Math.round(niveau * 1000) / 1000]);

        if (lot.length > 600) lot.splice(0, lot.length - 600);
      };

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
          .finally(() => { try { URL.revokeObjectURL(url); } catch {   } });
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
        } catch {   }
        try { if (nul) nul.disconnect(); } catch {   }
        try { if (ac) ac.close(); } catch {   }
        ac = null; proc = null; nul = null; lot = []; secondes = []; blocs = 0; muets = 0;
        ancreCour = Infinity; ancrePrec = Infinity; ancreT = 0; rang = -1; dernierPt = null;
        secMin = Infinity; secT = 0; marches = 0; marchesMs = [];
        sonVu = false; amorce = 0;
        etat = 'inactive';
      };

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

        sync: f('getSyncTime') ? lireNombre(() => lecteur.getSyncTime()) : null,
        position: f('getPosition') ? lireNombre(() => lecteur.getPosition()) : null,

        arriere: arriereElement(v),
        ...(f('getBufferedRanges') ? (() => { const x = lirePlages(lecteur); return { plages: x.plages, plagesForme: x.forme }; })()
          : { plages: null, plagesForme: null }),
        lecture: !!v && !v.paused,
        faibleLatence: f('isLiveLowLatency') ? (() => { try { return !!lecteur.isLiveLowLatency(); } catch { return null; } })() : null,
        essai,
        ecoute: ecoute.bilan(),

        pub: enPub(),
        env: ecoute.prendre(),
      };
      if (d.api === true && lecteur) r.api = lireApi(lecteur);
      for (const o of cibles) {
        try { window.parent.postMessage(r, o); } catch {   }
      }
    };

    let numeroConsole = 0;
    const simple = (x) => (x === null || x === undefined || ['number', 'string', 'boolean'].includes(typeof x) ? x : String(x));
    const relayer = (commande) => (...args) => {
      const n = ++numeroConsole;
      for (const o of cibles) {
        try {
          window.parent.postMessage({ tse: TSE_SALLE_CONSOLE_MSG, n, commande, args: args.slice(0, 3).map(simple) }, o);
        } catch {   }
      }
      return `[tse] ${commande} → envoyé à la salle / sent to the room`;
    };
    try {
      Object.defineProperty(window, 'tse', {
        value: Object.freeze({ salle: Object.freeze(Object.fromEntries(
          ['auto', 'recul', 'avance', 'ecoute', 'rapport'].map((c) => [c, relayer(c)]))) }),
        writable: false, configurable: false,
      });
    } catch {   }

    const poster = () => {
      const e = etatSalle();
      for (const o of cibles) {
        try { window.parent.postMessage({ tse: TSE_SALLE_ETAT_MSG, etat: e }, o); } catch {   }
      }
    };

    const ORDRES = ['son', 'muet', 'pause', 'lecture'];
    window.addEventListener('message', (e) => {
      if (e.source !== window.parent || !TSE_PREVIEW_PARENTS.includes(e.origin)) return;
      const d = e.data;

      if (d && d.tse === TSE_SALLE_ORDRE_MSG && d.ordre === 'qualite') {
        const h = Math.round(Number(d.hauteur));
        if (h >= 100 && h <= 4320 && h !== hauteurVoulue) {
          hauteurVoulue = h; qualiteEssais = 0; qualiteT = 0; tenirQualite();
        }
        return;
      }

      if (d && d.tse === TSE_SALLE_CONSOLE_REPONSE) {
        console.info(`[tse] ${d.commande} →`, d.resultat);
        return;
      }

      if (d && d.tse === TSE_SALLE_ORDRE_MSG && ['releve', 'essai-recul', 'essai-avance', 'faible-latence'].includes(d.ordre)) {
        if (d.ordre === 'releve' && Number.isFinite(d.n)) repondreReleve(d);
        else if (d.ordre === 'faible-latence') retirerFaibleLatence();
        else {

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

      ordre = { n: ++numeroOrdre, ordre: d.ordre, voie, apres: null };
      const courant = ordre;
      setTimeout(() => {
        courant.apres = v ? { muet: v.muted, lecture: !v.paused } : null;
        poster();
      }, 1500);
    });

    poster();

    setInterval(poster, 1000);
  })();

  (() => {
    'use strict';
    try {
      if (window.top === window) return;
      if (window.name !== TSE_SALLE_CHAT_NAME) return;
      const haut = window.top;
      if (haut.location.origin !== location.origin) return;
      Object.defineProperty(window, 'tse', { get: () => haut.tse, configurable: false });
    } catch {   }
  })();

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
      try { window.top.postMessage({ [TSE_SUIVIES_MSG]: x }, location.origin); } catch {   }
    };

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
      } catch {   }
      return p;
    };
  })();
}
