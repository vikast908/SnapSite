const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

let currentTabId = null;

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  currentTabId = tab?.id;
});

function setStatus(s) { statusEl.textContent = s; }

async function runCapture() {
  if (!currentTabId) return;
  setStatus('Starting...');
  stopBtn.disabled = false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['src/vendor/jszip.min.js', 'src/content.js']
    });
  } catch (e) {
    setStatus('Error injecting scripts: ' + String(e));
    stopBtn.disabled = true;
  }
}

startBtn.addEventListener('click', runCapture);

stopBtn.addEventListener('click', async () => {
  if (!currentTabId) return;
  await chrome.tabs.sendMessage(currentTabId, { type: 'GETINSPIRE_STOP' });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GETINSPIRE_STATUS') setStatus(msg.text);
  if (msg.type === 'GETINSPIRE_DONE') {
    setStatus('Downloaded ZIP.');
    stopBtn.disabled = true;
  }
  if (msg.type === 'GETINSPIRE_ERROR') {
    setStatus('Error: ' + (msg.error || 'Unknown error'));
    stopBtn.disabled = true;
  }
});
