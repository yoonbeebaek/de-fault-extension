// ═══════════════════════════════════════════════════════════════
//  De.fault — content.js
//  De-personalization engine. Reads any page context, intersects
//  Intent × Content-Type, surfaces 3 unexpected adjacent pieces.
// ═══════════════════════════════════════════════════════════════

// ─── Copy ──────────────────────────────────────────────────────

const HEADLINES = [
  'I have something else to show you!',
  'Shall we explore different perspectives?',
  'Hey, have you also heard about this?',
  'Understanding why can also help.',
  'Wait, have you heard about this?',
  'Check out their backstory!',
  'Hope this also motivates you.'
];

// Intent × Content-Type matrix (8 angles)
const CONTENT_TYPES = [
  { key: 'cause',        desc: 'the root cause — what caused this topic to exist?' },
  { key: 'effect',       desc: 'downstream consequences — what happens because of this?' },
  { key: 'opinion',      desc: 'contested opinions — what do people debate about this?' },
  { key: 'backstory',    desc: 'backstory — what is the historical or origin context?' },
  { key: 'adjacent',     desc: 'adjacent topics — what lives conceptually next to this?' },
  { key: 'alternative',  desc: 'alternative angles — a completely different way of looking at this' },
  { key: 'contribution', desc: 'contributing factors — what played a part in this topic existing?' },
  { key: 'examples',     desc: 'illustrative examples — concrete real-world cases that show this in action' }
];

// Card palette from tokens.css — all entries safe for white fg-1 text
const SESSION_COLORS = [
  'rgb(142,30,30)',   // --red-1
  'rgb(118,57,64)',   // --red-3
  'rgb(0,70,189)',    // --blue-1
  'rgb(9,50,122)',    // --blue-2
  'rgb(1,55,147)',    // --blue-3
  'rgb(60,72,103)',   // --blue-4
  'rgb(0,67,116)',    // --blue-5
  'rgb(0,118,50)',    // --green-1
  'rgb(5,90,18)',     // --green-3
  'rgb(35,80,61)',    // --green-4
  'rgb(45,78,6)',     // --green-5
  'rgb(1,90,95)',     // --teal-1
  'rgb(67,126,140)',  // --teal-2
  'rgb(159,2,143)',   // --magenta
  'rgb(164,72,20)',   // --orange-1
  'rgb(87,61,36)',    // --brown-1
  'rgb(88,88,88)',    // --slate-1
  'rgb(65,64,63)'     // --slate-2
];

// ─── Page Context — works on any page with detectable text ─────

function getPageContext() {
  const url  = window.location.href;
  const host = window.location.hostname;

  // Skip browser-internal and non-HTML pages
  if (/^(chrome|chrome-extension|moz-extension|edge|brave|about|data|file|blob):/.test(url)) return null;
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(host)) return null;
  if (/\.(pdf|xml|json|csv|txt)(\?.*)?$/i.test(url)) return null;

  // 1. Google Search — most reliable signal
  if (/google\.[a-z.]+\/search/.test(url)) {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q?.trim().length >= 3) return { context: q.trim(), source: 'search' };
  }

  // 2. YouTube video
  if (host.includes('youtube.com') && url.includes('/watch')) {
    const clean = document.title?.replace(/\s*-\s*YouTube\s*$/, '').trim();
    if (clean?.length > 4) return { context: clean, source: 'youtube' };
  }

  // 3. Twitter / X
  if (host.includes('twitter.com') || host.includes('x.com')) {
    const tweet = document.querySelector('[data-testid="tweetText"]');
    if (tweet?.textContent.trim().length > 10)
      return { context: tweet.textContent.trim().slice(0, 200), source: 'twitter' };
  }

  // 4. Reddit — handles both old and new Reddit
  if (host.includes('reddit.com')) {
    const el = document.querySelector(
      'h1[data-testid="post-title"], shreddit-post h1, [data-click-id="title"] h3, h1.title'
    );
    if (el?.textContent.trim().length > 5)
      return { context: el.textContent.trim().slice(0, 200), source: 'reddit' };
  }

  // 5. Wikipedia
  if (host.includes('wikipedia.org')) {
    const h1 = document.querySelector('#firstHeading');
    if (h1?.textContent.trim()) return { context: h1.textContent.trim(), source: 'wikipedia' };
  }

  // 6. Any article — prefer article > main scoped h1
  const h1 = document.querySelector('article h1, main h1, h1');
  if (h1?.textContent.trim().length >= 15)
    return { context: h1.textContent.trim().slice(0, 200), source: 'article' };

  // 7. Open Graph title (content-focused, usually cleaner than <title>)
  const og = document.querySelector('meta[property="og:title"]')?.content?.trim();
  if (og?.length >= 10) return { context: og.slice(0, 200), source: 'og' };

  // 8. Page <title> — strip common " | Site Name" suffixes
  const raw = document.title?.trim();
  if (raw?.length >= 10) {
    const clean = raw
      .replace(/\s*[-–—|·•]\s*[^-–—|·•]{1,50}$/, '')
      .replace(/\s*[-–—|·•]\s*[^-–—|·•]{1,50}$/, '')
      .trim();
    if (clean.length >= 8) return { context: clean, source: 'title' };
    return { context: raw.slice(0, 200), source: 'title' };
  }

  // 9. Meta description fallback
  const desc = document.querySelector('meta[name="description"], meta[property="og:description"]')?.content?.trim();
  if (desc?.length >= 20) return { context: desc.slice(0, 200), source: 'meta' };

  return null;
}

// ─── Intent Detection ──────────────────────────────────────────

function detectIntent(text) {
  const t = text.toLowerCase();
  const has = (re) => re.test(t);

  if (has(/\b(how to|how do i|how can i|fix|repair|install|setup|configure|download|buy|purchase|find|make|create|build|remove|enable|disable)\b/)) {
    return has(/\b(compare|vs\.?|versus|review|best|top|which|should i|recommend|worth|difference between|pros and cons)\b/)
      ? "I'm here to dig deeper and decide"
      : "I'm here to get something done";
  }

  if (has(/\b(what is|what are|explain|definition|meaning|understand|why is|why does|how does|overview|history of|science of|who is|who was)\b/)) {
    return has(/\b(beginner|basics|introduction|intro|start|fundamentals|guide|101|for dummies|explained simply)\b/)
      ? "I'm building knowledge from scratch"
      : "I'm aiming for full comprehension";
  }

  if (has(/\b(funny|humor|comedy|hilarious|meme|weird|strange|shocking|amazing|beautiful|sad|emotional|movie|film|music|song|game|gaming|celebrity|gossip|viral)\b/)) {
    return has(/\b(relax|chill|escape|hobby|entertainment|watch|listen|play|bored)\b/)
      ? "I want to relax / escape"
      : "I want to feel something (funny, emotional, weird)";
  }

  if (has(/\b(trend|trending|news|latest|new|recent|2024|2025|2026|future|emerging|innovation|startup|ai|artificial intelligence|breakthrough)\b/))
    return "I'm browsing for emerging trends and perspectives";

  return "I'm open to discovery";
}

// ─── Session State ─────────────────────────────────────────────

const SK = { color: 'df-ci', ct: 'df-cti', hl: 'df-hl' };

function initSession() {
  let ci = sessionStorage.getItem(SK.color);
  if (ci === null) {
    ci = Math.floor(Math.random() * SESSION_COLORS.length);
    sessionStorage.setItem(SK.color, ci);
  }
  let cti = sessionStorage.getItem(SK.ct);
  if (cti === null) {
    cti = Math.floor(Math.random() * CONTENT_TYPES.length);
    sessionStorage.setItem(SK.ct, cti);
  }
  let hl = sessionStorage.getItem(SK.hl);
  if (!hl) {
    hl = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
    sessionStorage.setItem(SK.hl, hl);
  }
  return { color: SESSION_COLORS[+ci], ctIndex: +cti, headline: hl };
}

function rotateCT(current) {
  const next = (current + 1) % CONTENT_TYPES.length;
  sessionStorage.setItem(SK.ct, next);
  return next;
}

// ─── Utilities ─────────────────────────────────────────────────

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return (Math.abs(h) % 900) + 100;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imgUrl(query, w, h, idx) {
  return `https://picsum.photos/seed/${hashStr((query || '') + idx)}/${w}/${h}`;
}

// ─── Type Icons (SVG) ──────────────────────────────────────────

const ICONS = {
  ARTICLE: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="10" height="10" rx="1.5" fill="rgba(255,255,255,0.92)"/>
    <line x1="3" y1="4.5" x2="9" y2="4.5" stroke="rgba(0,0,0,0.45)" stroke-width="1" stroke-linecap="round"/>
    <line x1="3" y1="6.5" x2="9" y2="6.5" stroke="rgba(0,0,0,0.45)" stroke-width="1" stroke-linecap="round"/>
    <line x1="3" y1="8.5" x2="6.5" y2="8.5" stroke="rgba(0,0,0,0.45)" stroke-width="1" stroke-linecap="round"/>
  </svg>`,
  VIDEO: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="5.5" fill="rgba(255,255,255,0.92)"/>
    <path d="M4.5 4L8.5 6L4.5 8V4Z" fill="rgba(0,0,0,0.55)"/>
  </svg>`,
  AUDIO: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="5.5" fill="rgba(255,255,255,0.92)"/>
    <path d="M3.8 8.2C3.8 6.4 4.8 5 6 5s2.2 1.4 2.2 3.2" stroke="rgba(0,0,0,0.5)" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <circle cx="6" cy="8.6" r="0.9" fill="rgba(0,0,0,0.5)"/>
  </svg>`,
  PRODUCT: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="rgba(255,255,255,0.92)"/>
    <path d="M6 3.5v5M3.5 6h5" stroke="rgba(0,0,0,0.5)" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`
};

const BOOKMARK_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2.5 2h8v9.5L6.5 9 2.5 11.5V2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>
</svg>`;
const BOOKMARK_SAVED_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M2.5 2h8v9.5L6.5 9 2.5 11.5V2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>
</svg>`;

// ─── Styles ────────────────────────────────────────────────────

function buildStyles(color) {
  const ext = chrome.runtime.getURL('');

  return `
    @font-face {
      font-family: "David Libre";
      font-weight: 400;
      font-display: swap;
      src: url("${ext}fonts/DavidLibre-Regular.ttf") format("truetype");
    }
    @font-face {
      font-family: "Barlow";
      font-weight: 400;
      font-display: swap;
      src: url("${ext}fonts/Barlow-Regular.ttf") format("truetype");
    }
    @font-face {
      font-family: "Barlow";
      font-weight: 600;
      font-display: swap;
      src: url("${ext}fonts/Barlow-SemiBold.ttf") format("truetype");
    }

    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Popup shell — 400×620px (--card-w × --card-h) ── */
    .popup {
      width: 400px;
      border-radius: 6px;          /* --r-card */
      overflow: hidden;
      background: ${color};
      box-shadow: 0 8px 24px -6px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.14);
      font-family: "Barlow", system-ui, sans-serif;
      color: rgb(255,255,255);
      display: flex;
      flex-direction: column;
      animation: df-in 320ms cubic-bezier(0.22,1,0.36,1);
      -webkit-font-smoothing: antialiased;
    }

    @keyframes df-in {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Controls row (— ✕) ── */
    .controls {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 6px;
      padding: 13px 13px 0;
      flex-shrink: 0;
    }

    .btn-ctrl {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(255,255,255,0.16);
      border: none;
      color: rgba(255,255,255,0.75);
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: background 120ms ease;
    }
    .btn-ctrl:hover { background: rgba(255,255,255,0.28); }

    /* ── Header: headline + refresh FAB ──
       Title at --card-title-top (47px from card top)
       i.e. 47px - controls height (~39px) = 8px header padding-top  */
    .header {
      flex: 1;
      min-height: 0;
      padding: 8px 16px 16px 20px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .headline {
      font-family: "David Libre", Georgia, serif;
      font-weight: 400;
      font-size: 36px;             /* --fz-display */
      line-height: 1.10;           /* --lh-display */
      color: rgb(255,255,255);
      letter-spacing: 0.002em;
      flex: 1;
    }

    /* Refresh — matches .df-fab--inactive */
    .btn-refresh {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(0,0,0,0.20);  /* --df-fab--inactive */
      border: none;
      color: rgb(255,255,255);
      font-size: 20px;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 120ms ease, transform 500ms cubic-bezier(0.22,1,0.36,1);
      line-height: 1;
    }
    .btn-refresh:hover  { background: rgba(0,0,0,0.32); }
    .btn-refresh:active { transform: scale(0.94); }
    .btn-refresh.spin   { transform: rotate(360deg); }

    /* ── Cards section — 3 cards, starts at --card-content-top (181px) ──
       Primary: 190px  ·  gap: 4px  ·  Secondary ×2: 100px each  = 398px */
    .cards {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex-shrink: 0;
    }

    .card {
      display: flex;
      overflow: hidden;
      background: rgba(0,0,0,0.20);  /* --surface-recess */
      cursor: pointer;
      transition: filter 120ms ease;
    }
    .card:hover { filter: brightness(1.1); }

    .card-primary   { height: 190px; flex-shrink: 0; }
    .card-secondary { height: 100px; flex-shrink: 0; }

    .card-img {
      flex-shrink: 0;
      object-fit: cover;
      display: block;
      background: rgba(255,255,255,0.08);
    }
    .card-primary   .card-img { width: 160px; height: 190px; }
    .card-secondary .card-img { width: 130px; height: 100px; }

    .card-body {
      flex: 1;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
    }

    /* ── Eyebrow: [icon] TYPE | SOURCE [bookmark] ── */
    .eyebrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }
    .eyebrow-left {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
      overflow: hidden;
    }
    .type-icon { display: flex; align-items: center; flex-shrink: 0; }

    .type-label {
      font-weight: 600;              /* --fw-semi */
      font-size: 10px;               /* --fz-meta */
      color: rgb(255,255,255);       /* --fg-1 */
      letter-spacing: 0.02em;
      white-space: nowrap;
      text-transform: uppercase;
    }
    .eyebrow-rule {
      font-size: 10px;
      color: rgba(255,255,255,0.32); /* --fg-rule */
      padding: 0 2px;
    }
    .source-name {
      font-weight: 400;
      font-size: 10px;               /* --fz-meta */
      color: rgba(255,255,255,0.70); /* --fg-3 */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
    }

    .btn-bookmark {
      background: none;
      border: none;
      color: rgba(255,255,255,0.32); /* --fg-ghost */
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      transition: color 120ms ease;
      line-height: 1;
    }
    .btn-bookmark:hover { color: rgba(255,255,255,0.85); }
    .btn-bookmark.saved { color: rgb(255,255,255); }

    /* ── Card title ── */
    .card-title {
      font-weight: 400;              /* --fw-regular */
      font-size: 16px;               /* --fz-title */
      line-height: 1.30;             /* --lh-title */
      color: rgb(255,255,255);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-secondary .card-title {
      font-size: 14px;
      -webkit-line-clamp: 2;
    }

    /* ── Footer ── */
    .footer {
      height: 40px;
      flex-shrink: 0;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .feedback-link {
      font-size: 12px;               /* --fz-body */
      color: rgba(255,255,255,0.60); /* --fg-4 */
      text-decoration: none;
      transition: color 120ms ease;
    }
    .feedback-link:hover { color: rgb(255,255,255); }
    .copyright {
      font-size: 10px;               /* --fz-meta */
      color: rgba(255,255,255,0.45); /* --fg-muted */
    }

    /* ── Loading skeleton ── */
    .skel-primary   { height: 190px; }
    .skel-secondary { height: 100px; }
    .skel-primary, .skel-secondary {
      background: rgba(255,255,255,0.10);
      animation: df-pulse 1.6s ease-in-out infinite;
    }
    @keyframes df-pulse { 0%,100% { opacity:.3 } 50% { opacity:.7 } }

    /* ── Error / no-key state ── */
    .error-wrap {
      height: 398px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 24px;
      text-align: center;
    }
    .error-icon { font-size: 28px; opacity: 0.6; }
    .error-msg {
      font-size: 12px;
      color: rgba(255,255,255,0.85);
      line-height: 1.5;
      max-width: 290px;
    }
    .btn-retry {
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: rgb(255,255,255);
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.28);
      border-radius: 999px;
      padding: 8px 22px;
      cursor: pointer;
      transition: background 120ms ease;
    }
    .btn-retry:hover { background: rgba(255,255,255,0.25); }

    /* ── Minimized ── */
    .popup.minimized .cards,
    .popup.minimized .footer { display: none; }
  `;
}

// ─── Render Functions ──────────────────────────────────────────

function renderLoading() {
  return `
    <div class="skel-primary"></div>
    <div class="skel-secondary"></div>
    <div class="skel-secondary"></div>
  `;
}

function renderError(message) {
  const noKey = message === 'NO_API_KEY';
  return `
    <div class="error-wrap">
      <div class="error-icon">${noKey ? '🔑' : '⚡'}</div>
      <p class="error-msg">${
        noKey
          ? 'Add your Google AI API key via the De.fault toolbar icon to get started.'
          : esc(message)
      }</p>
      ${!noKey ? '<button class="btn-retry">Try again</button>' : ''}
    </div>
  `;
}

function renderCard(s, isPrimary, idx) {
  const imgW  = isPrimary ? 160 : 130;
  const imgH  = isPrimary ? 190 : 100;
  const type  = (s.type || 'ARTICLE').toUpperCase();
  const icon  = ICONS[type] || ICONS.ARTICLE;

  return `
    <div class="card ${isPrimary ? 'card-primary' : 'card-secondary'}">
      <img class="card-img"
           src="${imgUrl(s.imageQuery || s.title, imgW, imgH, idx)}"
           alt=""
           loading="${isPrimary ? 'eager' : 'lazy'}"
           onerror="this.style.opacity='0'">
      <div class="card-body">
        <div class="eyebrow">
          <span class="eyebrow-left">
            <span class="type-icon">${icon}</span>
            <span class="type-label">${esc(type)}</span>
            <span class="eyebrow-rule"> | </span>
            <span class="source-name">${esc(s.source)}</span>
          </span>
          <button class="btn-bookmark" data-idx="${idx}" title="Save">
            ${BOOKMARK_ICON}
          </button>
        </div>
        <p class="card-title">${esc(s.title)}</p>
      </div>
    </div>
  `;
}

function renderSuggestions(data) {
  return renderCard(data[0], true, 0)
    + renderCard(data[1], false, 1)
    + renderCard(data[2], false, 2);
}

// ─── Overlay ───────────────────────────────────────────────────

let host = null, shadow = null, appState = {};

function mount(session) {
  if (host) return;

  host = document.createElement('div');
  host.id = 'de-fault-root';
  // Fixed: bottom-right, above everything
  host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;';

  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${buildStyles(session.color)}</style>
    <div class="popup" id="popup">
      <div class="controls">
        <button class="btn-ctrl" id="btnMin" title="Minimize">—</button>
        <button class="btn-ctrl" id="btnClose" title="Close">✕</button>
      </div>
      <div class="header">
        <h1 class="headline" id="headline">${esc(session.headline)}</h1>
        <button class="btn-refresh" id="btnRefresh" title="New angle">↻</button>
      </div>
      <div class="cards" id="cards">${renderLoading()}</div>
      <div class="footer">
        <a class="feedback-link"
           href="https://github.com/yoonbeebaek/de-fault-extension/issues"
           target="_blank" rel="noopener noreferrer">Send Feedback</a>
        <span class="copyright">2026 de.fault all rights reserved</span>
      </div>
    </div>
  `;

  const $ = (id) => shadow.getElementById(id);

  $('btnMin').addEventListener('click', () => {
    const minimized = $('popup').classList.toggle('minimized');
    $('btnMin').textContent = minimized ? '+' : '—';
  });

  $('btnClose').addEventListener('click', () => {
    host.remove();
    host = null;
    shadow = null;
  });

  $('btnRefresh').addEventListener('click', handleRefresh);
  $('cards').addEventListener('click', handleCardsClick);

  document.documentElement.appendChild(host);
}

function setCards(html) {
  if (shadow) shadow.getElementById('cards').innerHTML = html;
}

// ─── Interactions ──────────────────────────────────────────────

async function handleRefresh() {
  const btn = shadow?.getElementById('btnRefresh');
  if (!btn) return;

  // Spin animation (remove + re-add to restart)
  btn.classList.remove('spin');
  void btn.offsetWidth;
  btn.classList.add('spin');
  setTimeout(() => btn.classList.remove('spin'), 500);

  appState.ctIndex = rotateCT(appState.ctIndex);

  const hl = pick(HEADLINES);
  sessionStorage.setItem(SK.hl, hl);
  if (shadow) shadow.getElementById('headline').textContent = hl;

  await loadSuggestions();
}

function handleCardsClick(e) {
  if (e.target.closest('.btn-retry')) {
    loadSuggestions();
    return;
  }
  const bm = e.target.closest('.btn-bookmark');
  if (bm) {
    const saved = bm.classList.toggle('saved');
    bm.innerHTML = saved ? BOOKMARK_SAVED_ICON : BOOKMARK_ICON;
  }
}

// ─── Data ──────────────────────────────────────────────────────

async function loadSuggestions() {
  setCards(renderLoading());

  const ct   = CONTENT_TYPES[appState.ctIndex];
  const resp = await chrome.runtime.sendMessage({
    type: 'FETCH_SUGGESTIONS',
    payload: {
      context:         appState.context,
      intent:          appState.intent,
      contentTypeDesc: ct.desc
    }
  });

  setCards(resp.ok ? renderSuggestions(resp.data) : renderError(resp.error));
}

// ─── Boot ──────────────────────────────────────────────────────

async function boot() {
  const pageCtx = getPageContext();
  if (!pageCtx) return;

  const session  = initSession();
  appState = {
    context:  pageCtx.context,
    intent:   detectIntent(pageCtx.context),
    ctIndex:  session.ctIndex,
    color:    session.color
  };

  // Give the page 2.2s to settle before appearing
  await new Promise(r => setTimeout(r, 2200));

  // Abort if user navigated away during wait
  if (!getPageContext()) return;

  const { hasKey } = await chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' });

  mount(session);

  if (!hasKey) {
    setCards(renderError('NO_API_KEY'));
    return;
  }

  await loadSuggestions();
}

// Guard against double-injection on SPA route changes
if (!window.__dfLoaded) {
  window.__dfLoaded = true;
  boot();
}
