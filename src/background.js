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
  // Independent agencies, institutes & niche publishers
  'e-flux': 'e-flux.com',
  'adweek': 'adweek.com',
  'print magazine': 'printmag.com', 'print mag': 'printmag.com',
  'design observer': 'designobserver.com',
  '2x4': '2x4.org', '2×4': '2x4.org',
  'pentagram': 'pentagram.com',
  'base design': 'basedesign.com',
  'work & co': 'work.co', 'work and co': 'work.co',
  'long now': 'longnow.org', 'long now foundation': 'longnow.org',
  'data & society': 'datasociety.net', 'data and society': 'datasociety.net',
  'strelka': 'strelka.com', 'strelka magazine': 'strelka.com',
  'forensic architecture': 'forensic-architecture.org',
  'business of fashion': 'businessoffashion.com', 'bof': 'businessoffashion.com',
  'ribbonfarm': 'ribbonfarm.com',
  'interintellect': 'interintellect.com',
  'lithub': 'lithub.com', 'lit hub': 'lithub.com',
  'longreads': 'longreads.com',
  'aeon': 'aeon.co',
  'noema': 'noemamag.com', 'noema magazine': 'noemamag.com',
  'ssense': 'ssense.com',
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
  // YouTube search/results URLs have no useful og:image (returns logo only).
  // Skip straight to Wikipedia for video cards.
  const isSearchPage = /\/(results|search)\?/i.test(s.url || '');
  if (!isSearchPage) {
    const fromArticle = await fetchOgImage(s.url);
    if (fromArticle) return fromArticle;
  }

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

// ─── URL resolution via Google News RSS ───────────────────────
// Gemini Nano hallucinates URLs — instead we use title+source+query from
// Gemini to look up real live URLs via Google News RSS (free, no key).
//
// Card slot strategy:
//   Cards 0 & 1 (curated)  — domain-filtered + general queries run IN PARALLEL;
//                            first hit wins. No format-descriptor keywords
//                            (essay, in-depth) — those cause literal-match false
//                            positives (e.g. "essay contest" articles).
//   Card 2 (wildcard)      — raw query only, no domain filter. Most serendipitous.

// Discipline → preferred publications matching De.fault's editorial vibe.
// Substack + Medium added to each discipline to surface essays and personal
// writing that Google News RSS wouldn't otherwise index.
// Keep domain filters short — long URLs cause Google News RSS to return no results.
// Niche/independent publishers are handled via Gemini's system prompt + SOURCE_DOMAINS fallback.
const DISCIPLINE_DOMAINS = {
  communicational: 'site:theatlantic.com OR site:newyorker.com OR site:theguardian.com OR site:lithub.com OR site:medium.com OR site:substack.com OR site:reddit.com',
  economical:      'site:economist.com OR site:ft.com OR site:bloomberg.com OR site:hbr.org OR site:vox.com OR site:medium.com OR site:substack.com OR site:reddit.com',
  ecological:      'site:nature.com OR site:scientificamerican.com OR site:nationalgeographic.com OR site:wired.com OR site:newscientist.com OR site:medium.com OR site:substack.com OR site:reddit.com',
};

// Raw POV card — sources with unfiltered community voice
const RAW_DOMAINS = 'site:reddit.com OR site:x.com OR site:twitter.com';

async function rssFirstLink(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const resp = await timedFetch(url, 5000);
    if (!resp.ok) return null;
    const xml = await resp.text();
    const itemStart = xml.indexOf('<item>');
    if (itemStart === -1) return null;
    const m = xml.slice(itemStart).match(/<link>(https?:\/\/[^<\s]+)/i);
    return m?.[1]?.trim() || null;
  } catch { return null; }
}

async function resolveUrl(s, disciplineKey, cardIndex, rawCard = false) {
  const type      = (s.type || 'ARTICLE').toUpperCase();
  const title     = s.title  || '';
  const source    = s.source || '';
  // Gemini writes an angle-aware query; fall back to title+source
  const baseQuery = s.query || [title, source].filter(Boolean).join(' ');

  // VIDEO: search for real video links on known platforms via Google News RSS.
  // Prefer /watch URLs; accept any hit. Falls back to Google search (not YouTube
  // search results page, which always shows multiple unrelated videos).
  if (type === 'VIDEO') {
    const videoHit = await rssFirstLink(`(${baseQuery}) site:youtube.com OR site:vimeo.com OR site:ted.com`);
    if (videoHit) return videoHit;
    return `https://www.google.com/search?q=${encodeURIComponent(baseQuery + ' video')}`;
  }

  const isWildcard = cardIndex >= 2;
  const isRawCard  = isWildcard && rawCard;

  if (isRawCard) {
    // Raw POV card: Reddit/X community voice
    const hit = await rssFirstLink(`(${baseQuery}) ${RAW_DOMAINS}`);
    if (hit) return hit;
    // fallback to unfiltered
    const hit2 = await rssFirstLink(baseQuery);
    if (hit2) return hit2;
  } else if (isWildcard) {
    // Normal wildcard: no editorial filter
    const hit = await rssFirstLink(baseQuery);
    if (hit) return hit;
  } else {
    // Cards 0 & 1: domain-filtered and general queries run IN PARALLEL;
    // whichever returns first wins — halves sequential latency.
    const domainFilter = DISCIPLINE_DOMAINS[disciplineKey];
    const [hit1, hit2] = await Promise.all([
      domainFilter ? rssFirstLink(`(${baseQuery}) ${domainFilter}`) : Promise.resolve(null),
      rssFirstLink(baseQuery),
    ]);
    const hit = hit1 || hit2;
    if (hit) return hit;
  }

  // Fallback: site-specific Google search → generic Google search
  const domain = SOURCE_DOMAINS[(source).toLowerCase().trim()];
  const titleEnc = encodeURIComponent(title);
  if (domain) return `https://www.google.com/search?q=site:${domain}+${titleEnc}`;
  const q = encodeURIComponent(baseQuery);
  if (type === 'AUDIO') return `https://www.google.com/search?q=${q}+podcast`;
  return `https://www.google.com/search?q=${q}`;
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
          const disciplineKey = message.payload?.disciplineKey;
          const rawCard       = !!message.payload?.rawCard;
          result.data = await Promise.all(
            result.data.map(async (s, i) => {
              const isRaw = rawCard && i === 2;
              const url   = await resolveUrl(s, disciplineKey, i, rawCard);
              const image = await getThumb({ ...s, url });
              return { ...s, url, image, ...(isRaw ? { raw: true } : {}) };
            })
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
