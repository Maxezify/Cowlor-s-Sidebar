

(() => {
  'use strict';

  if (window.top !== window) return;

  const REQ = 'tse-panneau-req';
  const RES = 'tse-panneau-res';

  const EXPIRATION = 30_000;

  let port = null;
  let suivant = 0;
  const attentes = new Map();

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.tse !== RES || typeof d.id !== 'number') return;
    const attente = attentes.get(d.id);
    if (!attente) return;
    attentes.delete(d.id);
    clearTimeout(attente.minuteur);
    envoyer({ reqId: attente.reqId, ok: !!d.ok, data: d.data, erreur: d.erreur });
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
        minuteurReprise = setTimeout(() => { minuteurReprise = null; brancher(); }, REPRISE);
      }
    });
    port.onMessage.addListener((m) => {
      if (!m || (!m.section && !m.action)) return;
      const id = ++suivant;
      const minuteur = setTimeout(() => {
        attentes.delete(id);
        envoyer({ reqId: m.reqId, ok: false, erreur: 'expiration' });
      }, EXPIRATION);
      attentes.set(id, { reqId: m.reqId, minuteur });

      window.postMessage({ tse: REQ, id, section: m.section, action: m.action, arg: m.arg }, '*');
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) debrancher(); else brancher();
  });

  brancher();
})();
