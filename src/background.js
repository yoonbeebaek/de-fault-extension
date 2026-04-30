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

ensureOffscreen()
  .then(() => chrome.runtime.sendMessage({ target: 'df-offscreen', type: 'AI_WARMUP' }))
  .catch(() => {});

// ─── Source → domain map ───────────────────────────────────────
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
  'hbr': 'hbr.org', 'harvard business review': 'hbr.org',
  'mit technology review': 'technologyreview.com',
  'ars technica': 'arstechnica.com', 'quartz': 'qz.com',
};

// ─── Helpers ───────────────────────────────────────────────────

function timedFetch(url, ms = 6000, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(t));
}

function extractOgImage(html, base) {
  const patterns = [
    /property=["']og:image(?::url)?["'][^>]*content=["']([^"'\s]{8,})["']/i,
    /content=["']([^"'\s]{8,})["'][^>]*property=["']og:image(?::url)?["']/i,
    /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"'\s]{8,})["']/i,
    /content=["']([^"'\s]{8,})["'][^>]*name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m?.[1]) continue;
    try { return m[1].startsWith('http') ? m[1] : new URL(m[1], base).href; }
    catch { continue; }
  }
  return null;
}

async function fetchOgImage(url) {
  // Reject template placeholders and bare domains (need a path to be an article)
  if (!url || !/^https?:\/\/[a-z0-9][-a-z0-9.]{2,}\.[a-z]{2,}\/.+/i.test(url)) return null;
  try {
    const resp = await timedFetch(url);
    if (!resp.ok) return null;
    return extractOgImage(await resp.text(), url);
  } catch { return null; }
}

// ─── Wikipedia image (free, no key, high quality, topic-relevant) ─
const WIKI_STOP = new Set([
  'the','a','an','is','are','was','were','how','why','what','when','who',
  'to','in','of','and','for','that','this','but','with','from','about',
  'more','than','just','also','over','can','will','does','have','has',
]);

async function getWikipediaImage(title) {
  const terms = (title || '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 3 && !WIKI_STOP.has(w))
    .slice(0, 3).join(' ');
  if (!terms) return null;

  try {
    // Search Wikipedia for the best matching article
    const searchResp = await timedFetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(terms)}&srlimit=1&format=json&origin=*`
    );
    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();
    const pageTitle = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return null;

    // Fetch the page thumbnail
    const imgResp = await timedFetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&origin=*&pithumbsize=400`
    );
    if (!imgResp.ok) return null;
    const imgData = await imgResp.json();
    const pages = imgData?.query?.pages || {};
    return Object.values(pages)[0]?.thumbnail?.source || null;
  } catch { return null; }
}

// ─── Thumbnail resolution chain ────────────────────────────────
// 1. Article og:image (if AI returned a real URL with a path)
// 2. Wikipedia image for the topic (free, topic-relevant, high quality)
// 3. Source homepage og:image (brand logo — last resort)
async function getThumb(s) {
  const fromArticle = await fetchOgImage(s.url);
  if (fromArticle) return fromArticle;

  const fromWiki = await getWikipediaImage(s.title);
  if (fromWiki) return fromWiki;

  const domain = SOURCE_DOMAINS[(s.source || '').toLowerCase().trim()];
  if (domain) {
    try {
      const resp = await timedFetch(`https://${domain}`);
      if (resp.ok) {
        const img = extractOgImage(await resp.text(), `https://${domain}`);
        if (img) return img;
      }
    } catch { /* ignore */ }
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
