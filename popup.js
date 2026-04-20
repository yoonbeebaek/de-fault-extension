const apiKeyInput    = document.getElementById('apiKey');
const saveBtn        = document.getElementById('saveBtn');
const statusEl       = document.getElementById('status');
const keyStatusEl    = document.getElementById('keyStatus');
const keyStatusText  = document.getElementById('keyStatusText');
const clearBtn       = document.getElementById('clearBtn');
const toggleBtn      = document.getElementById('toggleVisibility');
const eyeOpen        = document.getElementById('eyeOpen');
const eyeClosed      = document.getElementById('eyeClosed');

// Load existing key on open
chrome.storage.local.get('apiKey').then(({ apiKey }) => {
  if (apiKey && apiKey.trim()) {
    showKeyStatus(apiKey.trim());
  }
});

saveBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showStatus('Please enter an API key.', 'error');
    return;
  }
  if (!key.startsWith('sk-ant-')) {
    showStatus('Key should start with sk-ant-…', 'error');
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
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  eyeOpen.style.display   = isPassword ? 'none' : '';
  eyeClosed.style.display = isPassword ? '' : 'none';
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    statusEl.className = 'status hidden';
  }, 3000);
}

function showKeyStatus(key) {
  const masked = key.substring(0, 10) + '••••••••' + key.slice(-4);
  keyStatusText.textContent = masked;
  keyStatusEl.classList.remove('hidden');
}
