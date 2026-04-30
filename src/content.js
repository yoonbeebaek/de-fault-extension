// ═══════════════════════════════════════════════════════════════
//  De.fault — content.js
//  Reads any page context. Intersects Intent × Content-Type.
//  Surfaces 3 unexpected adjacent content pieces via Gemini.
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

// ─── Foucault discipline system ────────────────────────────────
// Three epistemic lenses that shape how De.fault reframes content.
// Each session is assigned one discipline; its color palette sets the card mood.
// Reference: Foucault, "Discipline and Punish", Vintage Books 1995.

const DISCIPLINES = [
  {
    key: 'linguistic',
    desc: 'how this topic is named, framed, and contested through language, narrative, and media logic — what rhetoric or discourse shapes the way people understand it',
    // Blue family — from reference palette (row 2)
    colors: ['rgb(10,80,195)','rgb(8,35,115)','rgb(68,68,108)','rgb(98,138,155)','rgb(0,45,108)']
  },
  {
    key: 'economic',
    desc: 'what systems, institutions, and power structures produce or maintain this topic — who holds power, who benefits, what capital or policy forces are at play',
    // Red/warm family — from reference palette (row 3): crimson, mauve, magenta, burnt orange, dark brown
    colors: ['rgb(125,18,18)','rgb(115,65,65)','rgb(175,0,165)','rgb(175,85,8)','rgb(75,48,18)']
  },
  {
    key: 'biological',
    desc: 'how this topic intersects with bodies, health, ecology, or physical systems — what natural, scientific, or evolutionary forces operate beneath the surface',
    // Green family — from reference palette (row 1): emerald, forest, slate-green, olive, dark teal
    colors: ['rgb(0,128,55)','rgb(0,65,15)','rgb(55,85,70)','rgb(65,75,10)','rgb(0,75,85)']
  }
];

// ─── Content angles — Under (depth) and Around (adjacency) ─────
// Derived from the Intent × Content matrix.

const UNDER_ANGLES = [
  { key: 'cause',     desc: 'root cause — what forces, decisions, or history caused this topic to exist or emerge?' },
  { key: 'effect',    desc: 'downstream consequences — what happens in the world because of this? Who or what is affected?' },
  { key: 'opinion',   desc: 'contested opinions — what do people fundamentally disagree about regarding this topic?' },
  { key: 'backstory', desc: 'backstory — what is the historical, political, or biographical origin of this?' },
];

const AROUND_ANGLES = [
  { key: 'adjacent',    desc: 'adjacent topics — what lives conceptually next to this, in a different but related domain?' },
  { key: 'alternative', desc: 'alternative angles — a completely different paradigm or framework for approaching this topic' },
  { key: 'contributor', desc: 'topics that played a part — what other forces or events contributed to making this what it is?' },
  { key: 'examples',    desc: 'illustrative examples — concrete real-world cases that reveal the dynamics of this topic in action' },
];

// Intent → preferred angle pool (maps curiosity type to content region)
const INTENT_ANGLE_REGION = {
  "I'm open to discovery":                              'around',
  "I'm browsing for emerging trends and perspectives":  'both',
  "I want to feel something (funny, emotional, weird)": 'around',
  "I want to relax / escape":                           'around',
  "I'm here to get something done":                     'under',
  "I'm here to dig deeper and decide":                  'under',
  "I'm aiming for full comprehension":                  'under',
  "I'm building knowledge from scratch":                'both',
};

function anglePool(intent) {
  const region = INTENT_ANGLE_REGION[intent] || 'both';
  if (region === 'under')  return UNDER_ANGLES;
  if (region === 'around') return AROUND_ANGLES;
  return [...UNDER_ANGLES, ...AROUND_ANGLES];
}

// ─── Page context — any page with readable text ────────────────

// Non-content path patterns — signup, about, legal, settings, etc.
const NON_CONTENT_PATH = /^\/(about|about-us|sign[-_]?(up|in)|log[-_]?(in|out)|register|login|logout|pricing|plans|contact|contact-us|terms|tos|privacy|privacy-policy|cookie|legal|help|faq|support|careers|jobs|press|download|features|404|500|error|settings|account|profile|notifications|subscribe|unsubscribe|welcome|onboarding)(\/|$|\?)/i;

function getPageContext() {
  const url  = window.location.href;
  const host = window.location.hostname;
  const path = window.location.pathname;

  if (/^(chrome|chrome-extension|moz-extension|edge|about|data|file|blob):/.test(url)) return null;
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(host)) return null;
  if (/\.(pdf|xml|json|csv|txt)(\?.*)?$/i.test(url)) return null;

  // Skip homepages and non-content pages
  if (path === '/' || path === '') return null;
  if (NON_CONTENT_PATH.test(path)) return null;

  // Google Search
  if (/google\.[a-z.]+\/search/.test(url)) {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q?.trim().length >= 3) return { context: q.trim() };
  }

  // YouTube
  if (host.includes('youtube.com') && url.includes('/watch')) {
    const t = document.title?.replace(/\s*-\s*YouTube\s*$/, '').trim();
    if (t?.length > 4) return { context: t };
  }

  // Twitter / X
  if (host.includes('twitter.com') || host.includes('x.com')) {
    const el = document.querySelector('[data-testid="tweetText"]');
    if (el?.textContent.trim().length > 10)
      return { context: el.textContent.trim().slice(0, 200) };
  }

  // Reddit
  if (host.includes('reddit.com')) {
    const el = document.querySelector(
      'h1[data-testid="post-title"], shreddit-post h1, [data-click-id="title"] h3, h1.title'
    );
    if (el?.textContent.trim().length > 5)
      return { context: el.textContent.trim().slice(0, 200) };
  }

  // Wikipedia
  if (host.includes('wikipedia.org')) {
    const el = document.querySelector('#firstHeading');
    if (el?.textContent.trim()) return { context: el.textContent.trim() };
  }

  // Article h1
  const h1 = document.querySelector('article h1, main h1, h1');
  if (h1?.textContent.trim().length >= 15)
    return { context: h1.textContent.trim().slice(0, 200) };

  // Open Graph title
  const og = document.querySelector('meta[property="og:title"]')?.content?.trim();
  if (og?.length >= 10) return { context: og.slice(0, 200) };

  // Page title — strip site-name suffix
  const raw = document.title?.trim();
  if (raw?.length >= 10) {
    const clean = raw
      .replace(/\s*[-–—|·•]\s*[^-–—|·•]{1,50}$/, '')
      .replace(/\s*[-–—|·•]\s*[^-–—|·•]{1,50}$/, '')
      .trim();
    if (clean.length >= 8) return { context: clean };
    return { context: raw.slice(0, 200) };
  }

  // Meta description
  const desc = document.querySelector(
    'meta[name="description"], meta[property="og:description"]'
  )?.content?.trim();
  if (desc?.length >= 20) return { context: desc.slice(0, 200) };

  return null;
}

// ─── Intent detection ──────────────────────────────────────────

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

// ─── Session state ─────────────────────────────────────────────

const SK = { discipline: 'df-di', color: 'df-ci', angle: 'df-ai', hl: 'df-hl' };

function initSession(intent) {
  // Discipline — random per tab session, drives color palette
  let di = sessionStorage.getItem(SK.discipline);
  if (di === null) {
    di = Math.floor(Math.random() * DISCIPLINES.length);
    sessionStorage.setItem(SK.discipline, di);
  }
  const discipline = DISCIPLINES[+di];

  // Color — random within discipline's palette, consistent per session
  let ci = sessionStorage.getItem(SK.color);
  if (ci === null) {
    ci = Math.floor(Math.random() * discipline.colors.length);
    sessionStorage.setItem(SK.color, ci);
  }
  const color = discipline.colors[+ci % discipline.colors.length];

  // Angle — random start within intent's pool (Under or Around)
  let ai = sessionStorage.getItem(SK.angle);
  if (ai === null) {
    const pool = anglePool(intent);
    ai = Math.floor(Math.random() * pool.length);
    sessionStorage.setItem(SK.angle, ai);
  }
  const pool = anglePool(intent);
  const angle = pool[+ai % pool.length];

  let hl = sessionStorage.getItem(SK.hl);
  if (!hl) {
    hl = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
    sessionStorage.setItem(SK.hl, hl);
  }
  return { discipline, color, angle, angleIdx: +ai, headline: hl };
}

function rotateAngle(intent, currentIdx) {
  const pool = anglePool(intent);
  const next = (currentIdx + 1) % pool.length;
  sessionStorage.setItem(SK.angle, next);
  return { angle: pool[next], angleIdx: next };
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

function imgUrl(query, size, idx) {
  return `https://picsum.photos/seed/${hashStr((query || '') + idx)}/${size}/${size}`;
}

// ─── Icon URLs — resolved once at load time ────────────────────
const _EXT = chrome.runtime.getURL('icons/');

// ─── Icons ─────────────────────────────────────────────────────

// DfIcon: 15×15 circle icons for card chrome
const ICON_CLOSE = `<svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
  <path d="M7.5 0a7.5 7.5 0 110 15 7.5 7.5 0 010-15zm-2.8 4.7a.6.6 0 00-.85.85L6.65 7.5 3.85 9.45a.6.6 0 10.85.85L7.5 8.35l2.8 2.8a.6.6 0 10.85-.85L8.35 7.5l2.8-2.8a.6.6 0 00-.85-.85L7.5 6.65 4.7 4.7z"/>
</svg>`;

const ICON_SHRINK = `<svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
  <path d="M7.5 0a7.5 7.5 0 110 15 7.5 7.5 0 010-15zM4.17 6.9a.6.6 0 100 1.2h6.66a.6.6 0 100-1.2z"/>
</svg>`;

// Save — user's Menu.png; CSS opacity drives ghost (inactive) → white (saved) state
const ICON_SAVE = `<img src="${_EXT}Menu.png" width="14" height="14" alt="" style="display:block;">`;

// Content-type badges — user's uploaded PNGs
const MEDIUM_ICONS = {
  ARTICLE: `<img src="${_EXT}ARTICLE.png" width="14" height="14" alt="" style="display:block;">`,
  VIDEO:   `<img src="${_EXT}VIDEO.png"   width="14" height="14" alt="" style="display:block;">`,
  AUDIO:   `<img src="${_EXT}AUDIO.png"   width="14" height="14" alt="" style="display:block;">`,
  PRODUCT: `<img src="${_EXT}PRODUCT.png" width="14" height="14" alt="" style="display:block;">`,
};

// ─── Styles ────────────────────────────────────────────────────
//
//  All measurements from Figma spec:
//  Card:          400 × 620px, radius 6
//  Title slot:    left:25  top:47   w:298  h:104   (David Libre 36/40)
//  Content slot:  left:20  top:181  w:360  h:396
//    Primary rec: 172 × 172px image well
//    Secondary:   100 × 100px image wells
//  Footer:        1px rule + shadow, 43px tall

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

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Card shell: 400×510 viewport ── */
    .popup {
      position: relative;
      width: 400px;
      height: min(510px, calc(100vh - 52px));
      border-radius: 6px;
      overflow: hidden;
      background: ${color};
      /* Subtle 5%→0% black gradient top→bottom */
      background-image: linear-gradient(rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 100%);
      background-blend-mode: multiply;
      box-shadow: 0 8px 24px -6px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.14);
      font-family: "Barlow", system-ui, sans-serif;
      font-weight: 400;
      color: rgb(255,255,255);
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      animation: df-in 320ms cubic-bezier(0.22,1,0.36,1);
    }

    @keyframes df-in {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Control bar: close + shrink, 15×15, absolute top:16 right:16 ── */
    .controls {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 2;
    }

    .btn-ctrl {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: rgba(255,255,255,0.32);   /* ghost */
      display: flex;
      align-items: center;
      transition: color 120ms ease;
      line-height: 0;
    }
    .btn-ctrl:hover { color: rgb(255,255,255); }

    /* ── Header: fixed, not scrollable ── */
    .header {
      padding: 47px 25px 24px 25px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      flex-shrink: 0;
      position: relative;
    }

    /* ── Headline: David Libre, 36/40 ── */
    .headline {
      font-family: "David Libre", serif;
      font-weight: 400;
      font-size: 36px;
      line-height: 40px;
      color: rgb(255,255,255);
      flex: 1;
      min-width: 0;
    }

    /* THE BAR — explicit element between header and scroll area */
    .df-bar {
      height: 1px;
      flex-shrink: 0;
      margin: 0 20px;
      background: rgba(255,255,255,0.22);
      box-shadow: 0 1px 3px rgba(0,0,0,0.40);
    }

    /* Refresh button — PNG is the full 44×44 appearance */
    .btn-refresh {
      width: 44px;
      height: 44px;
      background: none;
      border: none;
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
      padding: 0;
    }
    .btn-refresh::after {
      content: '';
      position: absolute;
      inset: 0;
      background: url("${_EXT}Redo_Default.png") no-repeat center / contain;
    }
    .btn-refresh:hover::after { background-image: url("${_EXT}Redo_Hover.png"); }
    .btn-refresh:active { transform: scale(0.94); }
    @keyframes df-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .btn-refresh.spin {
      animation: df-spin 580ms cubic-bezier(0.34, 1.2, 0.64, 1);
    }

    /* ── Scroll container — fills remaining height, clips at the bar ── */
    .df-scroll {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: 14px 20px 24px;
    }
    .df-scroll::-webkit-scrollbar { width: 3px; }
    .df-scroll::-webkit-scrollbar-track { background: transparent; }
    .df-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.28);
      border-radius: 2px;
    }

    /* ── Cards column inside scroll ── */
    .cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    /* ── Recommendation wells — rgba(0,0,0,0.2) at border-radius:3 ── */
    .card {
      display: flex;
      overflow: hidden;
      background: rgba(0,0,0,0.20);
      border-radius: 3px;
      cursor: pointer;
      transition: filter 120ms ease;
    }
    .card:hover { filter: brightness(1.1); }

    .card-primary   { height: 172px; flex-shrink: 0; }
    .card-secondary { height: 100px; flex-shrink: 0; }

    /* Square images with rounded left corners only */
    .card-img {
      flex-shrink: 0;
      object-fit: cover;
      display: block;
      background: rgb(217,217,217);   /* --neutral-gray fallback */
    }
    .card-primary   .card-img { width: 172px; height: 172px; border-radius: 3px 0 0 3px; }
    .card-secondary .card-img { width: 100px; height: 100px; border-radius: 3px 0 0 3px; }

    .card-body {
      flex: 1;
      position: relative;
      min-width: 0;
    }

    /* ── Eyebrow: fixed at top of card ── */
    .eyebrow {
      position: absolute;
      top: 12px;
      left: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-secondary .eyebrow { top: 10px; left: 14px; right: 14px; }

    /* ── Title wrapper: full-height flex, centers title at card midpoint ── */
    .card-title-wrap {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
    }
    .card-secondary .card-title-wrap { padding: 0 14px; }

    .medium-icon { display: flex; align-items: center; flex-shrink: 0; line-height: 0; }

    .type-label {
      font-weight: 600;
      font-size: 10px;
      color: rgba(255,255,255,0.70);   /* --fg-3 */
      letter-spacing: 0.02em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    /* 1px × 8px vertical rule — spec: background: var(--fg-rule) */
    .eyebrow-rule {
      display: inline-block;
      width: 1px;
      height: 8px;
      background: rgba(255,255,255,0.32);
      flex-shrink: 0;
    }

    .source-name {
      font-weight: 400;
      font-size: 10px;
      color: rgba(255,255,255,0.70);   /* --fg-3 */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 80px;
    }

    /* save icon — marginLeft:auto pushes to right edge */
    .btn-save {
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      opacity: 0.38;
      transition: opacity 120ms ease;
    }
    .btn-save:hover { opacity: 0.85; }
    .btn-save.saved { opacity: 1.0; }

    /* ── Recommendation title ── */
    .card-title {
      font-weight: 400;
      font-size: 16px;
      line-height: 1.30;
      color: rgb(255,255,255);
      text-align: center;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-secondary .card-title {
      font-size: 13px;
      line-height: 1.3;
      -webkit-line-clamp: 2;
    }

    /* ── Footer — inside the scroll area, sits below cards ── */
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 24px;
    }
    .feedback-link {
      font-size: 12px;
      color: rgba(255,255,255,0.60);   /* --fg-4 */
      text-decoration: none;
      transition: color 120ms ease;
    }
    .feedback-link:hover { color: rgb(255,255,255); }
    .copyright {
      font-size: 10px;
      color: rgba(255,255,255,0.45);   /* --fg-muted */
    }

    /* ── Loading skeleton ── */
    .skel-primary   { height: 172px; border-radius: 3px; }
    .skel-secondary { height: 100px; border-radius: 3px; }
    .skel-primary, .skel-secondary {
      background: rgba(255,255,255,0.10);
      animation: df-pulse 1.6s ease-in-out infinite;
    }
    @keyframes df-pulse { 0%,100% { opacity:.3 } 50% { opacity:.7 } }

    /* ── Error / no-key ── */
    .error-wrap {
      height: 396px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 0 24px;
      text-align: center;
    }
    .error-icon { font-size: 28px; opacity: 0.6; }
    .error-msg {
      font-size: 13px;
      color: rgba(255,255,255,0.90);
      line-height: 1.5;
      max-width: 290px;
    }
    .error-hint {
      font-size: 11px;
      color: rgba(255,255,255,0.55);
      line-height: 1.5;
      max-width: 270px;
      text-align: center;
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

    /* ── Floating action button (minimized active state → always Activated) ── */
    .df-fab {
      width: 44px;
      height: 44px;
      background: url("${_EXT}Floating_Activated.png") no-repeat center / 44px 44px;
      border: none;
      padding: 0;
      cursor: pointer;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.12));
      transition: transform 140ms ease, filter 140ms ease;
    }
    .df-fab:hover {
      transform: scale(1.08);
      filter: drop-shadow(0 4px 16px rgba(0,0,0,0.22));
    }
    .df-fab:active { transform: scale(0.95); }
    @keyframes df-fab-in {
      from { opacity: 0; transform: scale(0.55); }
      to   { opacity: 1; transform: scale(1); }
    }
  `;
}

// ─── Render ────────────────────────────────────────────────────

function renderLoading() {
  return `
    <div class="skel-primary"></div>
    <div class="skel-secondary"></div>
    <div class="skel-secondary"></div>
  `;
}

function renderError(message) {
  const isChromeAI = /chrome ai|flags|prompt api|gemini nano/i.test(message);
  const hint = isChromeAI
    ? 'Go to chrome://flags → enable "Prompt API for Gemini Nano" → restart Chrome, then reload the extension.'
    : 'Try refreshing the page or reloading the extension.';
  return `
    <div class="error-wrap">
      <div class="error-icon">⚡</div>
      <p class="error-msg">${esc(message)}</p>
      <p class="error-hint">${hint}</p>
      <button class="btn-retry">Retry</button>
    </div>
  `;
}

function renderCard(s, isPrimary, idx) {
  const type  = (s.type || 'ARTICLE').toUpperCase();
  const micon = MEDIUM_ICONS[type] || MEDIUM_ICONS.ARTICLE;
  const size  = isPrimary ? 172 : 100;

  return `
    <div class="card ${isPrimary ? 'card-primary' : 'card-secondary'}">
      <img class="card-img"
           src="${imgUrl(s.imageQuery || s.title, size, idx)}"
           alt=""
           loading="${isPrimary ? 'eager' : 'lazy'}"
           onerror="this.style.opacity='0'">
      <div class="card-body">
        <div class="eyebrow">
          <span class="medium-icon">${micon}</span>
          <span class="type-label">${esc(type)}</span>
          <span class="eyebrow-rule"></span>
          <span class="source-name">${esc(s.source)}</span>
          <button class="btn-save" data-idx="${idx}" title="Save">
            ${ICON_SAVE}
          </button>
        </div>
        <div class="card-title-wrap"><p class="card-title">${esc(s.title)}</p></div>
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
let inactiveHost = null;

function mountInactiveFAB() {
  if (inactiveHost || host) return;
  inactiveHost = document.createElement('div');
  inactiveHost.id = 'de-fault-inactive';
  inactiveHost.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;';
  const sh = inactiveHost.attachShadow({ mode: 'open' });
  const ext = chrome.runtime.getURL('icons/');
  sh.innerHTML = `
    <style>
      .df-fab-off {
        width:44px; height:44px;
        background: url("${ext}Floating_inactivated.png") no-repeat center / 44px 44px;
        border:none; padding:0; display:block;
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.12));
      }
    </style>
    <button class="df-fab-off" title="De.fault"></button>
  `;
  document.documentElement.appendChild(inactiveHost);
}

function mount(session) {
  if (host) return;
  if (inactiveHost) { inactiveHost.remove(); inactiveHost = null; }

  host = document.createElement('div');
  host.id = 'de-fault-root';
  host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;';

  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${buildStyles(session.color)}</style>

    <button class="df-fab" id="btnFab" title="De.fault — expand" style="display:none"></button>

    <div class="popup" id="popup">
      <div class="controls">
        <button class="btn-ctrl" id="btnShrink" title="Minimize">${ICON_SHRINK}</button>
        <button class="btn-ctrl" id="btnClose"  title="Close">${ICON_CLOSE}</button>
      </div>
      <div class="header">
        <h1 class="headline" id="headline">${esc(session.headline)}</h1>
        <button class="btn-refresh" id="btnRefresh" title="New angle"></button>
      </div>
      <div class="df-bar"></div>
      <div class="df-scroll">
        <div class="cards" id="cards">${renderLoading()}</div>
        <div class="footer">
          <a class="feedback-link"
             href="https://github.com/yoonbeebaek/de-fault-extension/issues"
             target="_blank" rel="noopener noreferrer">Send Feedback</a>
          <span class="copyright">2026 de.fault all rights reserved</span>
        </div>
      </div>
    </div>
  `;

  const $ = (id) => shadow.getElementById(id);

  $('btnShrink').addEventListener('click', () => {
    $('popup').style.display = 'none';
    const fab = $('btnFab');
    fab.style.display = 'flex';
    fab.style.animation = 'none';
    void fab.offsetWidth;
    fab.style.animation = 'df-fab-in 260ms cubic-bezier(0.22,1,0.36,1)';
  });

  $('btnFab').addEventListener('click', () => {
    $('btnFab').style.display = 'none';
    const popup = $('popup');
    popup.style.display = '';
    popup.style.animation = 'none';
    void popup.offsetWidth;
    popup.style.animation = 'df-in 300ms cubic-bezier(0.22,1,0.36,1)';
  });

  $('btnClose').addEventListener('click', () => {
    // Collapse to FAB rather than disappearing entirely
    $('popup').style.display = 'none';
    const fab = $('btnFab');
    fab.style.display = 'flex';
    fab.style.animation = 'none';
    void fab.offsetWidth;
    fab.style.animation = 'df-fab-in 260ms cubic-bezier(0.22,1,0.36,1)';
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

  btn.classList.remove('spin');
  void btn.offsetWidth;            // reflow to restart animation
  btn.classList.add('spin');
  setTimeout(() => btn.classList.remove('spin'), 600);

  const { angle, angleIdx } = rotateAngle(appState.intent, appState.angleIdx);
  appState.angle    = angle;
  appState.angleIdx = angleIdx;
  const hl = pick(HEADLINES);
  sessionStorage.setItem(SK.hl, hl);
  if (shadow) shadow.getElementById('headline').textContent = hl;

  await loadSuggestions();
}

function handleCardsClick(e) {
  if (e.target.closest('.btn-retry')) { loadSuggestions(); return; }

  const saveBtn = e.target.closest('.btn-save');
  if (saveBtn) {
    saveBtn.classList.toggle('saved');
  }
}

// ─── Data ──────────────────────────────────────────────────────

function cacheKey() {
  return `df:${appState.context}:${appState.discipline.key}:${appState.angle.key}`;
}

function fetchPayload() {
  return {
    context:         appState.context,
    intent:          appState.intent,
    contentTypeDesc: appState.angle.desc,
    disciplineKey:   appState.discipline.key,
    disciplineDesc:  appState.discipline.desc
  };
}

async function loadSuggestions() {
  const key = cacheKey();
  const hit = sessionStorage.getItem(key);
  if (hit) { setCards(renderSuggestions(JSON.parse(hit))); return; }

  setCards(renderLoading());
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'FETCH_SUGGESTIONS', payload: fetchPayload() });
    if (resp.ok) {
      sessionStorage.setItem(key, JSON.stringify(resp.data));
      setCards(renderSuggestions(resp.data));
    } else {
      setCards(renderError(resp.error));
    }
  } catch (err) {
    setCards(renderError(err?.message || 'Could not reach background — try reloading the page.'));
  }
}

// ─── Context relevance gate ────────────────────────────────────
//
//  Trigger is curiosity-intent-driven: the detected curiosity type IS
//  the signal. "I'm open to discovery" is the generic fallback — it
//  only triggers on known content-rich platforms where depth is certain.
//  All other specific curiosity intents carry enough signal on their own.

const TRIGGER_DOMAINS = [
  'nytimes.com','bbc.com','bbc.co.uk','theguardian.com','washingtonpost.com',
  'reuters.com','apnews.com','cnn.com','foxnews.com','nbcnews.com',
  'politico.com','theatlantic.com','bloomberg.com','slate.com','vox.com',
  'wired.com','economist.com','ft.com','wsj.com','reddit.com',
  'twitter.com','x.com','threads.net','medium.com','substack.com'
];

function isContextTriggerable(context, intent) {
  if (!context || context.length < 12) return false;
  if (intent === "I'm open to discovery") {
    const host = window.location.hostname;
    return TRIGGER_DOMAINS.some(d => host.includes(d));
  }
  return true; // every specific curiosity intent is enough signal
}

// ─── Boot ──────────────────────────────────────────────────────

async function boot() {
  const pageCtx = getPageContext();
  if (!pageCtx) { mountInactiveFAB(); return; }

  const intent = detectIntent(pageCtx.context);
  if (!isContextTriggerable(pageCtx.context, intent)) { mountInactiveFAB(); return; }

  const session = initSession(intent);
  appState = {
    context:    pageCtx.context,
    intent,
    angle:      session.angle,
    angleIdx:   session.angleIdx,
    discipline: session.discipline,
    color:      session.color
  };

  const key = cacheKey();
  const hit = sessionStorage.getItem(key);

  // Fire AI request in parallel with 600ms settle wait (unless cached)
  const earlyFetch = hit
    ? null
    : chrome.runtime.sendMessage({ type: 'FETCH_SUGGESTIONS', payload: fetchPayload() })
        .catch(err => ({ ok: false, error: err?.message || 'Request failed' }));

  await new Promise(r => setTimeout(r, 600));
  if (!getPageContext()) return;

  mount(session);

  if (hit) {
    setCards(renderSuggestions(JSON.parse(hit)));
  } else {
    const resp = await earlyFetch;
    if (resp.ok) {
      sessionStorage.setItem(key, JSON.stringify(resp.data));
      setCards(renderSuggestions(resp.data));
    } else {
      setCards(renderError(resp.error));
    }
  }
}

if (!window.__dfLoaded) {
  window.__dfLoaded = true;
  boot();
}

// SPA navigation support — re-trigger when URL changes without a full page reload
// (handles Medium, Reddit, YouTube, Twitter feed navigation)
let _dfLastUrl = location.href;
setInterval(() => {
  // Re-attach if SPA navigation removed our hosts from the DOM
  if (host && !document.documentElement.contains(host))
    document.documentElement.appendChild(host);
  if (inactiveHost && !document.documentElement.contains(inactiveHost))
    document.documentElement.appendChild(inactiveHost);

  if (location.href === _dfLastUrl || host) return;
  _dfLastUrl = location.href;
  boot();
}, 2000);
