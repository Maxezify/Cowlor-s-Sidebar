

'use strict';

const CANAL = 'tse-panneau';

const EXPIRATION = 35_000;

const NE = Date.now();
const ports = new Map();

const enVol = new Map();
let suivant = 0;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== CANAL) return;
  const tabId = port.sender?.tab?.id;
  if (typeof tabId !== 'number') return;

  const ancien = ports.get(tabId);
  if (ancien && ancien !== port) { try { ancien.disconnect(); } catch {   } }
  ports.set(tabId, port);

  port.onDisconnect.addListener(() => {
    if (ports.get(tabId) === port) ports.delete(tabId);
  });

  port.onMessage.addListener((m) => {
    if (!m || typeof m.reqId !== 'number') return;
    const attente = enVol.get(m.reqId);
    if (!attente) return;
    enVol.delete(m.reqId);
    clearTimeout(attente.minuteur);

    const { reqId: _r, ...reponse } = m;
    attente.repondre({ ...reponse, ok: !!m.ok });
  });
});

chrome.runtime.onMessage.addListener((msg, _expediteur, repondre) => {

  if (msg && msg.type === CANAL + '-etat') {
    repondre({ ok: true, ponts: [...ports.keys()], enVol: enVol.size,
               workerMs: Date.now() - NE });
    return false;
  }

  if (!msg || msg.type !== CANAL) return false;

  const port = ports.get(msg.tabId);
  if (!port) {

    repondre({ ok: false, erreur: 'absent',
               detail: `onglet ${msg.tabId} — ponts connus : `
                     + ([...ports.keys()].join(', ') || 'aucun') });
    return false;
  }

  const reqId = ++suivant;
  const minuteur = setTimeout(() => {
    enVol.delete(reqId);

    repondre({ ok: false, erreur: 'expiration-pont',
               detail: `${EXPIRATION} ms sans réponse du pont` });
  }, EXPIRATION);
  enVol.set(reqId, { repondre, minuteur });

  try {

    const { type: _t, tabId: _o, ...demande } = msg;
    port.postMessage({ reqId, ...demande });
  } catch {

    enVol.delete(reqId);
    clearTimeout(minuteur);
    repondre({ ok: false, erreur: 'absent' });
    return false;
  }
  return true;
});
