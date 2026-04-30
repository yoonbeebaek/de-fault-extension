// De.fault — offscreen document
// This is an extension page, so window.ai IS available here (unlike service workers).
// Session is cached and reused across requests to avoid repeated cold-start latency.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'df-offscreen') return false;
  if (message.type === 'AI_FETCH') {
    runAI(message.payload)
      .then(sendResponse)
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'AI_WARMUP') {
    warmup().catch(() => {});
    return false;
  }
});

// ─── Session cache ─────────────────────────────────────────────
// Gemini Nano session creation is the main source of latency.
// Cache one session and reuse it — destroy only if model changes.
let _lm   = null;   // language model API reference
let _sess = null;   // active session — recreated fresh on each offscreen document load

async function getLM() {
  if (_lm) return _lm;
  _lm =
    (typeof LanguageModel !== 'undefined' && typeof LanguageModel.create === 'function'
      ? LanguageModel : null)
    ?? window.ai?.languageModel
    ?? (typeof window.ai?.create === 'function' ? window.ai : null);
  return _lm;
}

async function getSession() {
  if (_sess) return _sess;
  const lm = await getLM();
  if (!lm) throw new Error('__NO_LM__');
  _sess = await lm.create({
    temperature: 0.9,
    topK: 40,
    expectedInputLanguages: ['en'],
    expectedOutputLanguages: ['en'],
    systemPrompt:
      'You are De.fault, a curiosity engine. ' +
      'Suggest only real, well-known, published content that genuinely exists and is publicly accessible. ' +
      'Favor established publications (BBC, NYT, The Atlantic, TED, NPR, Wired, Nature, etc.). ' +
      'Content should be surprising, delightful, and counterintuitive — museum exhibit, not exposé. ' +
      'Output a valid JSON array only. No markdown, no explanation.'
  });
  return _sess;
}

async function warmup() {
  await getSession(); // pre-create session so first real request is fast
}

// ─── Main AI call ──────────────────────────────────────────────

async function runAI({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  const lm = await getLM();

  if (!lm) {
    const hasAI  = typeof window.ai !== 'undefined';
    const aiKeys = hasAI ? Object.keys(window.ai) : [];
    const hasLM  = typeof LanguageModel !== 'undefined';
    return {
      ok: false,
      error:
        `Gemini Nano not found in extension context. ` +
        `[window.ai=${hasAI}, keys=(${aiKeys.join('|') || 'none'}), LanguageModel=${hasLM}] ` +
        `— open chrome://components, find "Optimization Guide On Device Model", click Update.`
    };
  }

  // Availability check (method name differs by Chrome version)
  if (typeof lm.availability === 'function') {
    const s = await lm.availability();
    if (s === 'unavailable')
      return { ok: false, error: 'Gemini Nano not supported on this device.' };
    if (s === 'downloading')
      return { ok: false, error: 'Gemini Nano is downloading — wait a moment and retry.' };
  } else if (typeof lm.capabilities === 'function') {
    const c = await lm.capabilities();
    if (c.available === 'no')
      return { ok: false, error: 'Gemini Nano not supported on this device.' };
    if (c.available === 'after-download')
      return { ok: false, error: 'Gemini Nano is downloading — wait a moment and retry.' };
  }

  let session;
  try {
    session = await getSession();
  } catch (e) {
    _sess = null; // reset so next call retries
    return { ok: false, error: 'Could not start AI session: ' + e.message };
  }

  let text;
  try {
    text = await session.prompt(
      `Lens: ${disciplineKey} — ${disciplineDesc}\n` +
      `Topic: "${context}". Intent: "${intent}". Angle: ${contentTypeDesc}\n\n` +
      `3 real surprising suggestions (articles/videos/podcasts). JSON only:\n` +
      `[{"title":"...","source":"...","url":"https://...","type":"ARTICLE"},` +
      `{"title":"...","source":"...","url":"https://...","type":"VIDEO"},` +
      `{"title":"...","source":"...","url":"https://...","type":"AUDIO"}]`,
    );
  } catch (e) {
    _sess = null;
    return { ok: false, error: 'AI prompt failed: ' + e.message };
  }

  const suggestions = extractSuggestions(text);
  if (!suggestions) return { ok: false, error: 'Could not extract suggestions from AI response.' };
  return { ok: true, data: suggestions.slice(0, 3) };
}

// ─── Robust JSON extraction ────────────────────────────────────
// Gemini Nano can: truncate mid-array, include unescaped chars,
// leave trailing commas, or wrap in markdown. Handle all cases.
function extractSuggestions(raw) {
  const start = raw.indexOf('[');
  if (start === -1) return null;

  // Walk bracket depth to find the true closing ] (handles nested objects)
  let depth = 0, end = -1;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  // If output was truncated, attempt to close the last open object + array
  let jsonStr = end !== -1
    ? raw.slice(start, end + 1)
    : raw.slice(start).trimEnd() + '"}]}'; // close dangling object + array

  // Clean up common Gemini Nano quirks
  jsonStr = jsonStr
    .replace(/,\s*([}\]])/g, '$1')   // trailing commas
    .replace(/\t/g, ' ')              // literal tabs inside strings
    .replace(/\n(?=[^"]*"[^"]*(?:"[^"]*"[^"]*)*$)/g, ' '); // newlines inside strings

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (_) {
    // fall through to object-by-object fallback
  }

  // Last resort: pull out any complete {"title":...} objects individually
  const items = [];
  let depth2 = 0, objStart = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') { if (depth2 === 0) objStart = i; depth2++; }
    else if (raw[i] === '}') {
      depth2--;
      if (depth2 === 0 && objStart !== -1) {
        try {
          const obj = JSON.parse(raw.slice(objStart, i + 1));
          if (obj.title) items.push(obj);
        } catch (_) {}
        objStart = -1;
      }
    }
  }
  return items.length ? items : null;
}