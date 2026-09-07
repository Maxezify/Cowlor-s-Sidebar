

(() => {
  'use strict';

  if (window.top !== window) return;

  const REQ = 'tse-panneau-req';
  const RES = 'tse-panneau-res';

  const EXPIRATION = 30_000;

  let port = null;
  let suivant = 0;
  let reprises = 0;
  const NE = Date.now();
  const attentes = new Map();

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

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.tse !== RES || typeof d.id !== 'number') return;
    const attente = attentes.get(d.id);
    if (!attente) return;
    attentes.delete(d.id);
    clearTimeout(attente.minuteur);

    const { tse: _t, id: _i, ...reponse } = d;
    envoyer({ reqId: attente.reqId, ...reponse, ok: !!d.ok });
  });

  const envoyer = (charge) => {
    try { port?.postMessage(charge); } catch {   }
  };

  const REPRISE = 200;
  let minuteurReprise = null;

  const debrancher = () => {
    clearTimeout(minuteurReprise); minuteurReprise = null;
    try { port?.disconnect(); } catch {   }
    port = null;
    for (const [, a] of attentes) clearTimeout(a.minuteur);
    attentes.clear();
  };

  const brancher = () => {
    if (port || document.hidden) return;
    try {
      port = chrome.runtime.connect({ name: 'tse-panneau' });
    } catch {

      port = null;
      return;
    }
    port.onDisconnect.addListener(() => {
      port = null;

      if (!document.hidden && !minuteurReprise) {
        reprises++;
        minuteurReprise = setTimeout(() => { minuteurReprise = null; brancher(); }, REPRISE);
      }
    });
    port.onMessage.addListener((m) => {

      if (!m || typeof m.reqId !== 'number') return;
      const { reqId: _r, ...demande } = m;
      if (!Object.keys(demande).length) return;

      if (!marque()) {
        envoyer({ reqId: m.reqId, ok: false, erreur: 'page-absente',
                  observations: observations() });
        return;
      }

      const id = ++suivant;
      const minuteur = setTimeout(() => {
        attentes.delete(id);

        envoyer({ reqId: m.reqId, ok: false, erreur: 'expiration-page',
                  observations: observations() });
      }, EXPIRATION);
      attentes.set(id, { reqId: m.reqId, minuteur });

      window.postMessage({ tse: REQ, id, ...demande }, '*');
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) debrancher(); else brancher();
  });

  brancher();
})();
