

'use strict';

const CANAL = 'tse-panneau';

const EXPIRATION = 35_000;

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
    attente.repondre({ ok: !!m.ok, data: m.data, erreur: m.erreur });
  });
});

chrome.runtime.onMessage.addListener((msg, _expediteur, repondre) => {
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
    repondre({ ok: false, erreur: 'expiration' });
  }, EXPIRATION);
  enVol.set(reqId, { repondre, minuteur });

  try {
    port.postMessage({ reqId, section: msg.section, action: msg.action, arg: msg.arg });
  } catch {

    enVol.delete(reqId);
    clearTimeout(minuteur);
    repondre({ ok: false, erreur: 'absent' });
    return false;
  }
  return true;
});
