const apiKeyInput   = document.getElementById('apiKey');
const saveBtn       = document.getElementById('saveBtn');
const statusEl      = document.getElementById('status');
const keyStatusEl   = document.getElementById('keyStatus');
const keyStatusText = document.getElementById('keyStatusText');
const clearBtn      = document.getElementById('clearBtn');
const toggleBtn     = document.getElementById('toggleVisibility');
const eyeOpen       = document.getElementById('eyeOpen');
const eyeClosed     = document.getElementById('eyeClosed');

// Load existing key on open
chrome.storage.local.get('apiKey').then(({ apiKey }) => {
  if (apiKey?.trim()) showKeyStatus(apiKey.trim());
});

saveBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus('Please enter an API key.', 'error');
    return;
  }
  // Google AI Studio keys start with AIza
  if (!key.startsWith('AIza')) {
    showStatus('Key should start with AIza…', 'error');
    return;
  }
  await chrome.storage.local.set({ apiKey: key });
  apiKeyInput.value = '';
  showStatus('API key saved!', 'success');
  showKeyStatus(key);
});

clearBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove('apiKey');
  keyStatusEl.classList.add('hidden');
  showStatus('API key removed.', 'success');
});

toggleBtn.addEventListener('click', () => {
  const isPass = apiKeyInput.type === 'password';
  apiKeyInput.type = isPass ? 'text' : 'password';
  eyeOpen.style.display   = isPass ? 'none' : '';
  eyeClosed.style.display = isPass ? '' : 'none';
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

let statusTimer;
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.className = 'status hidden';
  }, 3000);
}

function showKeyStatus(key) {
  keyStatusText.textContent = key.slice(0, 8) + '••••••••' + key.slice(-4);
  keyStatusEl.classList.remove('hidden');
}
