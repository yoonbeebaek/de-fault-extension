// Show whether the extension is active on the current tab
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const statusRow = document.getElementById('statusRow');
  if (!statusRow) return;

  const dot  = statusRow.querySelector('.dot');
  const text = statusRow.querySelector('.status-text');

  const url = tab?.url || '';
  const isSkipped = /^(chrome|chrome-extension|about|file|data|blob):/.test(url)
    || url === ''
    || !tab?.url;

  if (isSkipped) {
    dot.className  = 'dot dot-inactive';
    text.textContent = 'Not active on this page type';
  } else {
    dot.className  = 'dot dot-active';
    text.textContent = 'Active on this page';
  }
});
