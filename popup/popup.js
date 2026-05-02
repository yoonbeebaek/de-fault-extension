// Query the content script for actual activation status
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const statusRow = document.getElementById('statusRow');
  if (!statusRow) return;

  const dot  = statusRow.querySelector('.dot');
  const text = statusRow.querySelector('.status-text');

  const url = tab?.url || '';
  const isSystemPage = /^(chrome|chrome-extension|about|file|data|blob):/.test(url) || !url;

  if (isSystemPage) {
    dot.className    = 'dot dot-inactive';
    text.textContent = 'Not active on this page type';
    return;
  }

  // Ask the content script whether De.fault actually activated
  chrome.tabs.sendMessage(tab.id, { type: 'DF_GET_STATUS' }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      // Content script not injected (PDF, cross-origin iframe, etc.)
      dot.className    = 'dot dot-inactive';
      text.textContent = 'Not active on this page type';
      return;
    }
    if (resp.active) {
      dot.className    = 'dot dot-active';
      text.textContent = 'Active on this page';
    } else {
      dot.className    = 'dot dot-inactive';
      text.textContent = 'Not active on this page type';
    }
  });
});
