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
let _sess = null;   // active session

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
    systemPrompt:
      'You are De.fault, a de-personalization engine. ' +
      'Surface unexpected but meaningful adjacent content — never confirm what the user already knows. ' +
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
      `Topic: "${context}"\n` +
      `Intent: "${intent}"\n` +
      `Angle: ${contentTypeDesc}\n\n` +
      `3 real, surprising content suggestions (articles/videos/podcasts the user would NEVER see in their feed).\n` +
      `[{"title":"...","source":"...","type":"ARTICLE","description":"...","imageQuery":"..."},` +
      `{"title":"...","source":"...","type":"VIDEO","description":"...","imageQuery":"..."},` +
      `{"title":"...","source":"...","type":"AUDIO","description":"...","imageQuery":"..."}]`
    );
  } catch (e) {
    // Session may have expired — destroy and let next call recreate
    _sess = null;
    return { ok: false, error: 'AI prompt failed: ' + e.message };
  }

  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return { ok: false, error: 'Response was not valid JSON. Got: ' + text.slice(0, 100) };

  let suggestions;
  try {
    suggestions = JSON.parse(match[0]);
  } catch (e) {
    return { ok: false, error: 'JSON parse failed: ' + e.message };
  }

  if (!Array.isArray(suggestions) || !suggestions.length)
    return { ok: false, error: 'AI returned an empty suggestions array.' };

  return { ok: true, data: suggestions.slice(0, 3) };
}
