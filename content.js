// ─── Constants ───────────────────────────────────────────────────────────────

const HEADLINES = [
  "I have something else to show you!",
  "Shall we explore different perspectives?",
  "Hey, have you also heard about this?",
  "Understanding why can also help.",
  "Wait, have you heard about this?",
  "Check out their backstory!",
  "Hope this also motivates you."
];

const CONTENT_TYPES = [
  { key: 'cause',        desc: 'the root cause — what caused this topic to exist?' },
  { key: 'effect',       desc: 'downstream consequences — what happens because of this?' },
  { key: 'opinion',      desc: 'contested opinions — what do people argue about this?' },
  { key: 'backstory',    desc: 'backstory — what is the historical or origin context?' },
  { key: 'adjacent',     desc: 'adjacent topics — what lives conceptually next to this?' },
  { key: 'alternative',  desc: 'alternative angles — a completely different way of looking at this' },
  { key: 'contribution', desc: 'contributing factors — what played a part in this topic existing?' },
  { key: 'examples',     desc: 'illustrative examples — concrete real-world cases that show this in action' }
];

// Discipline colors: Blue=Linguistic, Red=Economic, Green=Biological
const SESSION_COLORS = ['#001FE9', '#F90000', '#004500'];

// ─── Page Context Detection ───────────────────────────────────────────────────

function getPageContext() {
  const url = window.location.href;

  // Skip non-content pages
  const skipPatterns = [
    /^chrome(-extension)?:\/\//,
    /^about:/,
    /^moz-extension:\/\//,
    /\.(pdf|xml|json)(\?|$)/i
  ];
  if (skipPatterns.some(p => p.test(url))) return null;

  // Google Search
  if (window.location.hostname.includes('google.') && window.location.pathname === '/search') {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim().length >= 3) return { context: q.trim(), source: 'search' };
    return null;
  }

  // Article page — require a meaningful h1
  const h1 = document.querySelector('h1');
  if (h1) {
    const text = h1.textContent.trim();
    if (text.length >= 15) return { context: text.substring(0, 200), source: 'article' };
  }

  return null;
}

// ─── Intent Detection (Intent × Content Matrix) ──────────────────────────────

function detectIntent(text) {
  const t = text.toLowerCase();

  const isGoalAction = /\b(how to|how do i|how do you|how can i|fix|repair|install|setup|configure|download|buy|purchase|order|find|get|make|create|build|start|stop|add|remove|enable|disable)\b/.test(t);
  const isDecision   = /\b(compare|vs\.?|versus|review|reviews|best|top|cheapest|which|should i|recommend|worth it|difference between|pros and cons|is it worth)\b/.test(t);
  const isLearning   = /\b(what is|what are|what was|what were|explain|definition|meaning of|understand|why is|why does|why did|how does|how did|what does|when did|where did|who is|who was|overview|introduction to|history of|science of)\b/.test(t);
  const isBeginner   = /\b(beginner|basics|introduction|intro|start|starter|learn|fundamentals|guide|101|for dummies|explained simply|easy)\b/.test(t);
  const isEntertain  = /\b(funny|humor|comedy|hilarious|meme|memes|weird|strange|shocking|amazing|incredible|beautiful|sad|emotional|touching|scary|horror|thriller|movie|film|tv show|series|music|song|album|playlist|game|gaming|celebrity|gossip|viral|trending|wtf)\b/.test(t);
  const isEscape     = /\b(relax|chill|escape|hobby|fun|entertainment|watch|listen|play|pass the time|bored|something to do)\b/.test(t);
  const isTrend      = /\b(trend|trending|news|latest|new|recent|2024|2025|2026|future|emerging|innovation|startup|technology|ai|artificial intelligence|breakthrough|update)\b/.test(t);

  if (isGoalAction && isDecision) return "I'm here to dig deeper and decide";
  if (isGoalAction)               return "I'm here to get something done";
  if (isLearning && isBeginner)   return "I'm building knowledge from scratch";
  if (isLearning)                 return "I'm aiming for full comprehension";
  if (isEntertain && isEscape)    return "I want to relax / escape";
  if (isEntertain)                return "I want to feel something (funny, emotional, weird)";
  if (isTrend)                    return "I'm browsing for emerging trends and perspectives";
  return "I'm open to discovery";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h) % 900 + 100; // 100–999
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Session State ────────────────────────────────────────────────────────────

const SESSION_KEY_COLOR = 'de-fault-color-index';
const SESSION_KEY_CT    = 'de-fault-ct-index';
const SESSION_KEY_HL    = 'de-fault-headline';

function initSessionState() {
  // Color: persist per tab session
  let colorIndex = sessionStorage.getItem(SESSION_KEY_COLOR);
  if (colorIndex === null) {
    colorIndex = Math.floor(Math.random() * SESSION_COLORS.length);
    sessionStorage.setItem(SESSION_KEY_COLOR, colorIndex);
  }

  // Content type index
  let ctIndex = sessionStorage.getItem(SESSION_KEY_CT);
  if (ctIndex === null) {
    ctIndex = Math.floor(Math.random() * CONTENT_TYPES.length);
    sessionStorage.setItem(SESSION_KEY_CT, ctIndex);
  }

  // Headline
  let headline = sessionStorage.getItem(SESSION_KEY_HL);
  if (!headline) {
    headline = pickRandom(HEADLINES);
    sessionStorage.setItem(SESSION_KEY_HL, headline);
  }

  return {
    color:    SESSION_COLORS[parseInt(colorIndex)],
    ctIndex:  parseInt(ctIndex),
    headline
  };
}

function rotateContentType(current) {
  const next = (current + 1) % CONTENT_TYPES.length;
  sessionStorage.setItem(SESSION_KEY_CT, next);
  return next;
}

// ─── Overlay Styles ───────────────────────────────────────────────────────────

function buildStyles(color) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;700&family=Barlow:wght@400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .popup {
      width: 490px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.2);
      background: ${color};
      font-family: 'Adelle Sans', 'Gill Sans', system-ui, -apple-system, sans-serif;
      user-select: none;
    }

    /* ── Header ── */
    .header {
      padding: 18px 20px 14px 20px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: ${color};
    }

    .headline {
      font-family: 'David Libre', Georgia, 'Times New Roman', serif;
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      line-height: 1.25;
      flex: 1;
      letter-spacing: -0.01em;
    }

    .controls {
      display: flex;
      gap: 4px;
      margin-top: 2px;
      flex-shrink: 0;
    }

    .ctrl-btn {
      background: rgba(255,255,255,0.18);
      border: none;
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      line-height: 1;
    }
    .ctrl-btn:hover { background: rgba(255,255,255,0.32); }
    .ctrl-btn.refresh-btn { font-size: 17px; }

    /* ── Cards Container ── */
    .cards-container {
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: rgba(0,0,0,0.25);
    }

    /* ── Large Card ── */
    .card-large {
      position: relative;
      height: 210px;
      overflow: hidden;
      background: rgba(0,0,0,0.3);
      cursor: pointer;
    }
    .card-large-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s ease;
    }
    .card-large:hover .card-large-img { transform: scale(1.03); }
    .card-large-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.72) 100%);
    }
    .card-large-meta {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .card-large-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* ── Small Cards ── */
    .card-small {
      display: flex;
      background: rgba(0,0,0,0.3);
      cursor: pointer;
      transition: background 0.15s;
      min-height: 76px;
    }
    .card-small:hover { background: rgba(0,0,0,0.45); }
    .card-small-img {
      width: 88px;
      height: 76px;
      object-fit: cover;
      flex-shrink: 0;
      display: block;
    }
    .card-small-content {
      flex: 1;
      padding: 10px 14px 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .card-small-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .card-small-meta {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ── Badge ── */
    .badge {
      font-family: 'Barlow', 'Arial Narrow', sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 2px 7px;
      border: 1px solid rgba(255,255,255,0.65);
      border-radius: 3px;
      color: #fff;
      white-space: nowrap;
    }

    .source-name {
      font-family: 'Barlow', sans-serif;
      font-size: 10px;
      font-weight: 500;
      color: rgba(255,255,255,0.65);
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-large .card-title {
      font-size: 15px;
      -webkit-line-clamp: 2;
    }

    .bookmark-btn {
      background: none;
      border: none;
      color: rgba(255,255,255,0.55);
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      flex-shrink: 0;
      line-height: 1;
      transition: color 0.15s;
    }
    .bookmark-btn:hover { color: #fff; }
    .bookmark-btn.saved { color: #fff; }

    /* ── Footer ── */
    .footer {
      padding: 11px 20px;
      background: rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .feedback-link {
      font-family: 'Barlow', sans-serif;
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      text-decoration: none;
      letter-spacing: 0.02em;
    }
    .feedback-link:hover { color: rgba(255,255,255,0.85); }

    /* ── Loading Skeleton ── */
    .skeleton-wrap { padding: 0; }
    .skeleton-large { height: 210px; background: rgba(255,255,255,0.08); }
    .skeleton-small { height: 76px; background: rgba(255,255,255,0.06); margin-top: 1px; }
    .skeleton-large, .skeleton-small { animation: shimmer 1.6s ease-in-out infinite; }
    @keyframes shimmer {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* ── Error State ── */
    .error-state {
      padding: 32px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .error-icon { font-size: 28px; opacity: 0.7; }
    .error-msg {
      font-size: 13px;
      color: rgba(255,255,255,0.75);
      line-height: 1.5;
    }
    .error-retry {
      font-family: 'Barlow', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      padding: 7px 20px;
      cursor: pointer;
      letter-spacing: 0.04em;
      transition: background 0.15s;
    }
    .error-retry:hover { background: rgba(255,255,255,0.3); }

    /* ── API Key Prompt ── */
    .setup-state {
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .setup-msg {
      font-size: 13px;
      color: rgba(255,255,255,0.8);
      line-height: 1.5;
    }
    .setup-hint {
      font-family: 'Barlow', sans-serif;
      font-size: 11px;
      color: rgba(255,255,255,0.5);
    }

    /* ── Minimized ── */
    .popup.minimized .cards-container,
    .popup.minimized .footer { display: none; }
  `;
}

// ─── Render Helpers ───────────────────────────────────────────────────────────

function renderLoading() {
  return `
    <div class="skeleton-wrap">
      <div class="skeleton-large"></div>
      <div class="skeleton-small"></div>
      <div class="skeleton-small"></div>
    </div>
  `;
}

function renderError(message) {
  const isNoKey = message === 'NO_API_KEY';
  return `
    <div class="error-state">
      <div class="error-icon">${isNoKey ? '🔑' : '⚠️'}</div>
      <p class="error-msg">${
        isNoKey
          ? 'No API key set. Click the De.fault icon in your toolbar to add your Anthropic API key.'
          : `Couldn't load suggestions.<br><small style="opacity:0.65">${message}</small>`
      }</p>
      ${!isNoKey ? '<button class="error-retry">Try again</button>' : ''}
    </div>
  `;
}

function renderApiKeyPrompt() {
  return `
    <div class="setup-state">
      <p class="setup-msg">To get started, click the <strong style="color:#fff">De.fault icon</strong> in your browser toolbar and enter your Anthropic API key.</p>
      <p class="setup-hint">Your key is stored locally and never shared.</p>
    </div>
  `;
}

function imgUrl(query, width, height, index) {
  return `https://picsum.photos/seed/${hashString(query + index)}/${width}/${height}`;
}

function renderSuggestions(suggestions) {
  const [s0, s1, s2] = suggestions;
  return `
    <div class="card-large">
      <img class="card-large-img" src="${imgUrl(s0.imageQuery || s0.title, 490, 210, 0)}" alt="" loading="eager" onerror="this.style.display='none'">
      <div class="card-large-gradient"></div>
      <div class="card-large-meta">
        <div class="card-large-top">
          <span class="badge">${s0.type || 'ARTICLE'}</span>
          <button class="bookmark-btn" data-idx="0" title="Save">☆</button>
        </div>
        <div class="source-name">${escHtml(s0.source)}</div>
        <p class="card-title">${escHtml(s0.title)}</p>
      </div>
    </div>
    ${renderSmallCard(s1, 1)}
    ${renderSmallCard(s2, 2)}
  `;
}

function renderSmallCard(s, idx) {
  return `
    <div class="card-small">
      <img class="card-small-img" src="${imgUrl(s.imageQuery || s.title, 88, 76, idx)}" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="card-small-content">
        <div class="card-small-header">
          <div class="card-small-meta">
            <span class="badge">${s.type || 'ARTICLE'}</span>
            <span class="source-name">${escHtml(s.source)}</span>
          </div>
          <button class="bookmark-btn" data-idx="${idx}" title="Save">☆</button>
        </div>
        <p class="card-title">${escHtml(s.title)}</p>
      </div>
    </div>
  `;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Overlay Management ───────────────────────────────────────────────────────

let overlayHost = null;
let shadow = null;
let appState = {};

function createOverlay(session) {
  if (overlayHost) return; // Already mounted

  overlayHost = document.createElement('div');
  overlayHost.id = 'de-fault-root';
  overlayHost.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
  `;

  shadow = overlayHost.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>${buildStyles(session.color)}</style>
    <div class="popup" id="popup">
      <div class="header">
        <h1 class="headline" id="headline">${escHtml(session.headline)}</h1>
        <div class="controls">
          <button class="ctrl-btn refresh-btn" id="refreshBtn" title="New angle">↻</button>
          <button class="ctrl-btn minimize-btn" id="minimizeBtn" title="Minimize">—</button>
          <button class="ctrl-btn close-btn" id="closeBtn" title="Close">✕</button>
        </div>
      </div>
      <div class="cards-container" id="cardsContainer">
        ${renderLoading()}
      </div>
      <div class="footer">
        <a href="https://github.com/yoonbeebaek/de-fault-extension/issues" target="_blank" rel="noopener noreferrer" class="feedback-link">Send Feedback</a>
      </div>
    </div>
  `;

  // Event listeners
  shadow.getElementById('refreshBtn').addEventListener('click', handleRefresh);
  shadow.getElementById('minimizeBtn').addEventListener('click', handleMinimize);
  shadow.getElementById('closeBtn').addEventListener('click', handleClose);
  shadow.getElementById('cardsContainer').addEventListener('click', handleCardAreaClick);

  document.documentElement.appendChild(overlayHost);
}

function setCardsHtml(html) {
  if (!shadow) return;
  shadow.getElementById('cardsContainer').innerHTML = html;
}

function handleRefresh() {
  appState.ctIndex = rotateContentType(appState.ctIndex);
  const newHeadline = pickRandom(HEADLINES);
  sessionStorage.setItem(SESSION_KEY_HL, newHeadline);
  shadow.getElementById('headline').textContent = newHeadline;
  loadSuggestions();
}

function handleMinimize() {
  const popup = shadow.getElementById('popup');
  const isNowMin = !popup.classList.contains('minimized');
  popup.classList.toggle('minimized');
  shadow.getElementById('minimizeBtn').textContent = isNowMin ? '+' : '—';
}

function handleClose() {
  if (overlayHost) {
    overlayHost.remove();
    overlayHost = null;
    shadow = null;
  }
}

function handleCardAreaClick(e) {
  const retryBtn = e.target.closest('.error-retry');
  if (retryBtn) { loadSuggestions(); return; }

  const bookmarkBtn = e.target.closest('.bookmark-btn');
  if (bookmarkBtn) {
    const isSaved = bookmarkBtn.classList.toggle('saved');
    bookmarkBtn.textContent = isSaved ? '★' : '☆';
  }
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function loadSuggestions() {
  setCardsHtml(renderLoading());

  const contentType = CONTENT_TYPES[appState.ctIndex];
  const response = await chrome.runtime.sendMessage({
    type: 'FETCH_SUGGESTIONS',
    payload: {
      context: appState.context,
      intent: appState.intent,
      contentTypeDesc: contentType.desc
    }
  });

  if (response.ok) {
    setCardsHtml(renderSuggestions(response.data));
  } else {
    setCardsHtml(renderError(response.error));
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const pageCtx = getPageContext();
  if (!pageCtx) return;

  const session = initSessionState();
  appState = {
    context:  pageCtx.context,
    intent:   detectIntent(pageCtx.context),
    ctIndex:  session.ctIndex,
    color:    session.color
  };

  // Small delay so the page settles and the popup doesn't feel jarring
  await new Promise(r => setTimeout(r, 2200));

  // Bail if user navigated away before timer fired
  const freshCtx = getPageContext();
  if (!freshCtx) return;

  const { hasKey } = await chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' });

  createOverlay(session);

  if (!hasKey) {
    setCardsHtml(renderApiKeyPrompt());
    return;
  }

  await loadSuggestions();
}

// Run only once per page load (avoid double-injection on SPAs doing pushState)
if (!window.__defaultExtLoaded) {
  window.__defaultExtLoaded = true;
  boot();
}
