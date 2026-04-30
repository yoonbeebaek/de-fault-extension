// De.fault — background service worker
// Creates an offscreen extension page to access window.ai (Gemini Nano).
// Service workers have no window, so all Chrome AI calls live in offscreen.js.

const OFFSCREEN_URL = 'src/offscreen.html';

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['DOM_PARSER'],
      justification: 'window.ai (Chrome built-in AI) requires a DOM context unavailable in service workers'
    });
  }
}

// Pre-warm offscreen + AI session on startup so first user request is faster
ensureOffscreen()
  .then(() => chrome.runtime.sendMessage({ target: 'df-offscreen', type: 'AI_WARMUP' }))
  .catch(() => {}); // silent — warmup is best-effort

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    (async () => {
      try {
        await ensureOffscreen();
        const result = await chrome.runtime.sendMessage({
          target: 'df-offscreen',
          type: 'AI_FETCH',
          payload: message.payload
        });
        sendResponse(result ?? { ok: false, error: 'No response from offscreen AI worker.' });
      } catch (e) {
        sendResponse({ ok: false, error: 'Offscreen worker error: ' + e.message });
      }
    })();
    return true;
  }
});
