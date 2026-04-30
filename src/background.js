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

// ─── og:image extraction ───────────────────────────────────────
// Background SW can fetch any HTTPS URL without CORS restrictions.
// We parse the first 64 KB of HTML to find og:image in <head>.

async function fetchOgImage(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Range': 'bytes=0-65535' }   // most servers ignore for HTML, but worth asking
    });
    clearTimeout(timer);

    // Read as text; og:image is always in <head> so first chunk is enough
    const html = await resp.text();

    // Match both attribute orderings and both quote styles
    const tags = html.matchAll(/<meta\s[^>]+>/gi);
    for (const [tag] of tags) {
      if (!/og:image/i.test(tag)) continue;
      const m = tag.match(/content=["']([^"']{4,})["']/i);
      if (!m) continue;
      const raw = m[1];
      try { return raw.startsWith('http') ? raw : new URL(raw, url).href; } catch { return null; }
    }
    return null;
  } catch {
    return null;
  }
}

// Enrich suggestions with og:image thumbnails (parallel, best-effort)
async function enrichWithImages(suggestions) {
  return Promise.all(
    suggestions.map(async s => ({
      ...s,
      image: await fetchOgImage(s.url)
    }))
  );
}

// ─── Message handler ───────────────────────────────────────────

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
        if (!result) {
          sendResponse({ ok: false, error: 'No response from offscreen AI worker.' });
          return;
        }
        if (result.ok && Array.isArray(result.data)) {
          result.data = await enrichWithImages(result.data);
        }
        sendResponse(result);
      } catch (e) {
        sendResponse({ ok: false, error: 'Offscreen worker error: ' + e.message });
      }
    })();
    return true;
  }
});
