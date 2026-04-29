// De.fault — background service worker
// window.ai only exists in the tab's MAIN world, not in a service worker.
// We bridge via chrome.scripting.executeScript (world: 'MAIN').

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No tab context — try reloading the page.' });
      return true;
    }
    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: mainWorldAI,
        args: [message.payload]
      })
      .then(results => {
        const r = results[0]?.result;
        if (r?.ok) sendResponse({ ok: true, data: r.data });
        else sendResponse({ ok: false, error: r?.error || 'AI call failed.' });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

// ─── Injected into the tab's MAIN world ────────────────────────
// Must be fully self-contained — no closures from service worker scope.
async function mainWorldAI({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  const ai = window.ai?.languageModel;
  if (!ai) {
    return {
      ok: false,
      error:
        'Chrome AI not available. ' +
        'Go to chrome://flags → enable "Prompt API for Gemini Nano" → restart Chrome.'
    };
  }

  try {
    const caps = await ai.capabilities();
    if (caps.available === 'no')
      return { ok: false, error: 'Chrome AI is not supported on this device.' };
    if (caps.available === 'after-download')
      return { ok: false, error: 'Chrome AI model is still downloading — wait a moment and retry.' };

    const session = await ai.create({
      temperature: 0.9,
      topK: 40,
      systemPrompt:
        'You are De.fault, a de-personalization engine. ' +
        'Surface what lies UNDER or AROUND topics — never confirm what the user already knows. ' +
        `Disciplinary lens — ${disciplineKey}: ${disciplineDesc}. ` +
        'Respond with a valid JSON array only. No markdown, no explanation.'
    });

    let responseText;
    try {
      responseText = await session.prompt(
        `The user is browsing: "${context}"\n` +
        `Curiosity intent: "${intent}"\n` +
        `Content angle: ${contentTypeDesc}\n\n` +
        `Generate exactly 3 content suggestions that illuminate "${context}" from unexpected but meaningful angles. ` +
        'Suggest real articles, videos, or podcasts — things a person would NEVER find in their personalized feed.\n\n' +
        'Return ONLY this JSON array (no markdown, no extra text):\n' +
        '[{"title":"exact title","source":"publisher name","type":"ARTICLE","description":"one sentence why this expands perspective","imageQuery":"3-4 word visual theme"},' +
        '{"title":"...","source":"...","type":"VIDEO","description":"...","imageQuery":"..."},' +
        '{"title":"...","source":"...","type":"AUDIO","description":"...","imageQuery":"..."}]'
      );
    } finally {
      session.destroy();
    }

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { ok: false, error: 'Could not parse AI response.' };

    const suggestions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(suggestions) || !suggestions.length)
      return { ok: false, error: 'No suggestions returned.' };

    return { ok: true, data: suggestions.slice(0, 3) };
  } catch (e) {
    return { ok: false, error: e.message || 'AI call failed.' };
  }
}
