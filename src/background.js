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
  .catch(() => {});

// ─── Source → domain map (mirrors content.js SOURCE_DOMAINS) ───
const SOURCE_DOMAINS = {
  'bbc': 'bbc.com', 'bbc news': 'bbc.com',
  'new york times': 'nytimes.com', 'nytimes': 'nytimes.com', 'nyt': 'nytimes.com',
  'the guardian': 'theguardian.com', 'guardian': 'theguardian.com',
  'washington post': 'washingtonpost.com', 'wapo': 'washingtonpost.com',
  'the atlantic': 'theatlantic.com', 'atlantic': 'theatlantic.com',
  'wired': 'wired.com', 'ted': 'ted.com', 'ted talks': 'ted.com',
  'npr': 'npr.org', 'spotify': 'spotify.com',
  'medium': 'medium.com', 'reuters': 'reuters.com', 'bloomberg': 'bloomberg.com',
  'vox': 'vox.com', 'the verge': 'theverge.com', 'verge': 'theverge.com',
  'techcrunch': 'techcrunch.com', 'nature': 'nature.com',
  'scientific american': 'scientificamerican.com',
  'new yorker': 'newyorker.com', 'the new yorker': 'newyorker.com',
  'economist': 'economist.com', 'the economist': 'economist.com',
  'ft': 'ft.com', 'financial times': 'ft.com',
  'wsj': 'wsj.com', 'wall street journal': 'wsj.com',
  'time': 'time.com', 'slate': 'slate.com', 'politico': 'politico.com',
  'axios': 'axios.com', 'propublica': 'propublica.org',
  'national geographic': 'nationalgeographic.com', 'nat geo': 'nationalgeographic.com',
  'harvard business review': 'hbr.org', 'hbr': 'hbr.org',
  'mit technology review': 'technologyreview.com',
  'ars technica': 'arstechnica.com',
  'the intercept': 'theintercept.com', 'quartz': 'qz.com',
};

// ─── og:image extraction ───────────────────────────────────────
// Tries og:image, then twitter:image as fallback.
function extractImage(html, baseUrl) {
  const patterns = [
    /property=["']og:image(?::url)?["'][^>]*content=["']([^"'\s]{8,})["']/i,
    /content=["']([^"'\s]{8,})["'][^>]*property=["']og:image(?::url)?["']/i,
    /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"'\s]{8,})["']/i,
    /content=["']([^"'\s]{8,})["'][^>]*name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m?.[1]) continue;
    try {
      const raw = m[1];
      return raw.startsWith('http') ? raw : new URL(raw, baseUrl).href;
    } catch { continue; }
  }
  return null;
}

async function fetchImage(url) {
  // Reject non-URLs and template placeholders like "https://..."
  if (!url || !/^https?:\/\/[a-z0-9][-a-z0-9]{0,60}\.[a-z]{2,}(\/|$)/i.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    return extractImage(html, url);
  } catch {
    return null;
  }
}

async function getThumb(s) {
  // 1. Try the AI-provided URL (real article page)
  const fromArticle = await fetchImage(s.url);
  if (fromArticle) return fromArticle;

  // 2. Fall back to source publication homepage og:image
  const domain = SOURCE_DOMAINS[(s.source || '').toLowerCase().trim()];
  if (domain) {
    const fromDomain = await fetchImage(`https://${domain}`);
    if (fromDomain) return fromDomain;
  }

  return null;
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
        // Enrich each suggestion with a thumbnail image (parallel, best-effort)
        if (result.ok && Array.isArray(result.data)) {
          result.data = await Promise.all(
            result.data.map(async s => ({ ...s, image: await getThumb(s) }))
          );
        }
        sendResponse(result);
      } catch (e) {
        sendResponse({ ok: false, error: 'Offscreen worker error: ' + e.message });
      }
    })();
    return true;
  }
});
