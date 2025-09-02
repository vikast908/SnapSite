const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const barEl = document.getElementById('bar');
const pctEl = document.getElementById('pct');
const countMetaEl = document.getElementById('countMeta');
const elapsedMetaEl = document.getElementById('elapsedMeta');
const openOptionsLink = document.getElementById('openOptionsLink');
const reportLink = document.getElementById('reportLink');
const videoBtn = document.getElementById('videoBtn');
const videoPanel = document.getElementById('videoPanel');
const videoPanelStatus = document.getElementById('videoPanelStatus');
const videoList = document.getElementById('videoList');
const ytdlpList = document.getElementById('ytdlpList');

let currentTabId = null;
let startedAt = 0;
let lastTotal = 0;
let lastDone = 0;

async function getActiveTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0]?.id || null;
  } catch { return null; }
}

function setStatus(s) { if (statusEl) statusEl.textContent = s; }
function fmtTime(ms){
  const sec = Math.max(0, Math.floor(ms/1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec/60), s = sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function setProgress(done, total) {
  total = Math.max(1, Number(total) || 1);
  done = Math.max(0, Math.min(total, Number(done) || 0));
  const pct = Math.floor((done * 100) / total);
  if (barEl) barEl.style.width = Math.min(99, pct) + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  lastDone = done; lastTotal = total;
  // Meta: counts, elapsed, ETA
  try {
    if (countMetaEl) countMetaEl.textContent = `${done}/${total}`;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    if (elapsedMetaEl) elapsedMetaEl.textContent = fmtTime(elapsed);
  } catch {}
}
function resetProgress() { setProgress(0, 1); }

async function runCapture() {
  currentTabId = await getActiveTabId();
  if (!currentTabId) {
    setStatus('No active tab.');
    return;
  }
  setStatus('Starting...');
  resetProgress();
  stopBtn.disabled = false;
  startedAt = Date.now(); lastDone = 0; lastTotal = 0;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['src/vendor/jszip.min.js', 'src/content.js']
    });
  } catch (e) {
    const msg = String(e || '');
    // Helpful guidance + fallback for sites that block scripting via policy
    if (/ExtensionsSettings policy|cannot be scripted/i.test(msg)) {
      setStatus('Site blocks scripting. Requesting permission, then saving MHTML...');
      try {
        // Request per-origin permission under user gesture (popup click)
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tabs?.[0]?.url || '';
        let origin = '';
        try { origin = new URL(url).origin + '/*'; } catch {}
        if (origin) {
          const have = await chrome.permissions.contains({ origins: [origin] }).catch(() => false);
          if (!have) {
            const ok = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
            if (!ok) throw new Error('Permission denied for ' + origin);
          }
        }
        await chrome.runtime.sendMessage({ type: 'GETINSPIRE_SAVE_MHTML_DIRECT', tabId: currentTabId });
        setStatus('Saved MHTML snapshot.');
      } catch (e2) {
        setStatus('Unable to save MHTML: ' + String(e2));
      }
    } else {
      setStatus('Error injecting scripts: ' + msg);
    }
    stopBtn.disabled = true;
    resetProgress();
  }
}

startBtn.addEventListener('click', runCapture);

stopBtn.addEventListener('click', async () => {
  currentTabId = await getActiveTabId();
  if (!currentTabId) return;

  stopBtn.disabled = true;
  setStatus('Stopping...');
  try {
    await chrome.tabs.sendMessage(currentTabId, { type: 'GETINSPIRE_STOP' });
  } catch (e) {
    setStatus('Error sending stop message: ' + String(e));
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GETINSPIRE_STATUS') setStatus(msg.text);
  if (msg.type === 'GETINSPIRE_PROGRESS') setProgress(msg.downloaded, msg.total);
  if (msg.type === 'GETINSPIRE_DONE') {
    setStatus('Downloaded ZIP.');
    stopBtn.disabled = true;
    setProgress(msg.total || 1, msg.total || 1);
  }
  if (msg.type === 'GETINSPIRE_ERROR') {
    setStatus('Error: ' + (msg.error || 'Unknown error'));
    stopBtn.disabled = true;
    resetProgress();
  }
});

// Quick actions
if (openOptionsLink) openOptionsLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const url = chrome.runtime.getURL('src/options.html');
    if (chrome.windows && chrome.windows.create) {
      await chrome.windows.create({ url, type: 'popup', width: 760, height: 720, focused: true });
    } else {
      window.open(url, 'GetInspireOptions', 'width=760,height=720,noopener,noreferrer');
    }
  } catch (err) {
    try { window.open(chrome.runtime.getURL('src/options.html'), 'GetInspireOptions', 'width=760,height=720,noopener,noreferrer'); } catch {}
  }
});
if (reportLink) reportLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const manifest = chrome.runtime.getManifest?.() || { version: '' };
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const page = tab?.url || '';
    const body = [
      'Please describe the issue here...',
      '',
      `Version: ${manifest.version}`,
      `Page: ${page}`,
      `Progress: ${lastDone}/${lastTotal}`,
    ].join('%0A');
    const subj = encodeURIComponent('GetInspire feedback');
    const href = `mailto:?subject=${subj}&body=${body}`;
    // Open in a new tab context to respect popup restrictions
    chrome.tabs.create({ url: href });
  } catch {}
});

// (inline quick settings removed)

// ---- Video downloader ----
if (videoBtn) videoBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    if (videoPanel.classList.contains('open')) {
      videoPanel.classList.remove('open');
      return;
    }
    // Open panel and show loading
    videoPanel.classList.add('open');
    videoList.style.display = 'none'; if (ytdlpList) ytdlpList.style.display = 'none';
    videoPanelStatus.textContent = 'Detecting video...';

    const tabId = await getActiveTabId();
    if (!tabId) { videoPanelStatus.textContent = 'No active tab.'; return; }

    // Probe the page for a currently playing or visible video
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        function pickFromYouTube(){
          try{
            const host = location.hostname||''; if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(host)) return null;
            const pr = (globalThis.ytInitialPlayerResponse) ||
              (globalThis.ytplayer && globalThis.ytplayer.config && (typeof globalThis.ytplayer.config.args?.player_response==='string' ? JSON.parse(globalThis.ytplayer.config.args.player_response) : globalThis.ytplayer.config.args?.player_response));
            const out = [];
            const add = (f) => {
              if (!f) return; const url = f.url; const mt = String(f.mimeType||'');
              // Only direct video URLs with a video/* mime
              if (!url || !/^video\//i.test(mt)) return;
              const ql = f.qualityLabel || f.quality || '';
              out.push({ url, label: ql || (mt.split(';')[0]) || 'Source', itag: f.itag||null, type: 'file', mimeType: mt });
            };
            const sd = pr && pr.streamingData;
            if (sd){
              (sd.formats||[]).forEach(add);
              (sd.adaptiveFormats||[]).forEach(add);
            }
            if (out.length) {
              return { url: out[0].url, all: out.map(o=>o.url), variants: out, title: document.title, pageUrl: location.href, source: 'youtube-streamingData' };
            }
          }catch(e){}
          return null;
        }
        function pickVideos(){
          const vids = Array.from(document.querySelectorAll('video'));
          const cand = [];
          const isVisible = (el) => {
            const r = el.getBoundingClientRect();
            return r.width>40 && r.height>40 && r.bottom>0 && r.right>0 && r.top < (innerHeight||1080) && r.left < (innerWidth||1920);
          };
          for (const v of vids){
            if (!isVisible(v)) continue;
            const urls = new Set();
            const add = (u) => { try { if (u && typeof u === 'string' && !/^blob:/i.test(u)) urls.add(new URL(u, document.baseURI).href); } catch {} };
            add(v.currentSrc || v.src || '');
            for (const s of v.querySelectorAll('source')) add(s.src || s.getAttribute('src'));
            if (urls.size>0) cand.push({ elementScore: (v.paused?0:2) + (v.readyState>=2?1:0) + (isFinite(v.duration)&&v.duration>60?1:0), urls: Array.from(urls) });
          }
          cand.sort((a,b)=>b.elementScore-a.elementScore);
          const all = cand.flatMap(c=>c.urls);
          const uniq = Array.from(new Set(all));
          return { url: uniq[0]||'', all: uniq, title: document.title, pageUrl: location.href, source: 'html-video' };
        }
        function pickFromPerformance(){
          try{
            const entries = (performance.getEntriesByType && performance.getEntriesByType('resource')) || [];
            const urls = [];
            for (const e of entries){ const n = e.name||''; if (/\.m3u8(\?|$)|\.mpd(\?|$)|\.mp4(\?|$)|\.webm(\?|$)|\.ogg(\?|$)/i.test(n)) urls.push(n); }
            const uniq = Array.from(new Set(urls));
            return { url: uniq[0]||'', all: uniq, title: document.title, pageUrl: location.href, source: 'performance' };
          }catch(e){ return { url:'', all:[], title: document.title, pageUrl: location.href, source: 'performance' }; }
        }
        return pickFromYouTube() || pickVideos() || pickFromPerformance();
      }
    });

    const candidateUrl = result?.url || result?.all?.[0] || '';
    if (!candidateUrl) {
      const pageHost = (()=>{ try { return new URL(result?.pageUrl||'').hostname || ''; } catch { return ''; } })();
      const isYT = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(pageHost);
      videoPanelStatus.textContent = isYT ? 'YouTube stream is protected or MSE-based; direct download not available.' : 'No downloadable video found.';
      return;
    }

    let variants = Array.isArray(result?.variants) && result.variants.length ?
      result.variants.map(v => ({ type:'file', url: v.url, label: v.label || 'Source' })) : null;
    if (!variants){
      // Ask background to inspect the URL and list variants (HLS/direct)
      const info = await new Promise((resolve)=>{
        chrome.runtime.sendMessage({ type:'GETINSPIRE_VIDEO_INFO', url: candidateUrl }, (resp)=> resolve(resp));
      });
      if (!info?.ok) { videoPanelStatus.textContent = (info?.error||'Unable to analyze video'); return; }
      variants = info.info?.variants || [];
    }
    if (!variants.length) { videoPanelStatus.textContent = 'No variants available.'; return; }

    // Populate list
    videoList.innerHTML = '';
    for (const v of variants){
      const item = document.createElement('div'); item.className='video-item';
      const label = document.createElement('div'); label.textContent = v.label || `${v.resolution||''} ${v.bandwidth?`(${Math.round(v.bandwidth/1000)}kbps)`:''}`.trim();
      const btn = document.createElement('button'); btn.textContent = 'Download';
      btn.addEventListener('click', async () => {
        try {
          videoPanelStatus.textContent = 'Preparing...';
          videoList.style.display = 'none';
          // Pre-request host permission under user gesture for all video hosts
          const urls = [candidateUrl, v.url].filter(Boolean);
          const patterns = [];
          for (const u of urls){ try { const o = new URL(u).origin + '/*'; if (!patterns.includes(o)) patterns.push(o); } catch {} }
          const granted = await ensureOrigins(patterns);
          if (!granted) { videoPanelStatus.textContent = 'Permission denied for video host'; return; }
          chrome.runtime.sendMessage({ type:'GETINSPIRE_VIDEO_DOWNLOAD', variant: v, from: candidateUrl });
          videoPanel.classList.remove('open');
        } catch (err) {
          videoPanelStatus.textContent = 'Error: ' + String(err);
        }
      });
      item.appendChild(label); item.appendChild(btn); videoList.appendChild(item);
    }
    videoPanelStatus.textContent = 'Choose quality:';
    videoList.style.display = '';

    // Also offer yt-dlp fallback (best quality) using page URL for robust downloads
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageUrl = tabs?.[0]?.url || '';
      if (pageUrl && ytdlpList) {
        ytdlpList.innerHTML = '';
        const bestItem = document.createElement('div'); bestItem.className = 'video-item';
        const bestLabel = document.createElement('div'); bestLabel.textContent = 'yt-dlp (best)';
        const bestBtn = document.createElement('button'); bestBtn.textContent = 'Download';
        bestBtn.addEventListener('click', async () => {
          videoPanelStatus.textContent = 'Handing off to yt-dlp...';
          videoList.style.display = 'none'; ytdlpList.style.display = 'none';
          chrome.runtime.sendMessage({ type: 'GETINSPIRE_YTDLP_DOWNLOAD', url: pageUrl, format: 'bestvideo*+bestaudio/best' });
          videoPanel.classList.remove('open');
        });
        bestItem.appendChild(bestLabel); bestItem.appendChild(bestBtn); ytdlpList.appendChild(bestItem);

        // Optional: show a probe of available formats (quick)
        const resp = await new Promise((resolve)=>{
          chrome.runtime.sendMessage({ type:'GETINSPIRE_YTDLP_PROBE', url: pageUrl }, (r)=> resolve(r));
        });
        if (resp?.ok && Array.isArray(resp.formats) && resp.formats.length){
          for (const f of resp.formats.slice(0,6)){
            const it = document.createElement('div'); it.className='video-item';
            const l = document.createElement('div'); l.textContent = `yt-dlp ${f.height?f.height+'p ':''}${f.ext||''} ${f.fps?f.fps+'fps ':''}`.trim();
            const b = document.createElement('button'); b.textContent = 'Download';
            b.addEventListener('click', ()=>{
              chrome.runtime.sendMessage({ type:'GETINSPIRE_YTDLP_DOWNLOAD', url: pageUrl, format: String(f.format_id||'best') });
              videoPanel.classList.remove('open');
            });
            it.appendChild(l); it.appendChild(b); ytdlpList.appendChild(it);
          }
        }
        ytdlpList.style.display = '';
      }
    } catch {}
  } catch (err) {
    videoPanelStatus.textContent = 'Error: ' + String(err);
  }
});

// Close the video panel when clicking outside the icons area within popup
document.addEventListener('click', (ev)=>{
  const t = ev.target;
  if (!videoPanel) return;
  if (t===videoPanel || t===videoBtn || (t.closest && (t.closest('#videoPanel') || t.closest('#videoBtn')))) return;
  videoPanel.classList.remove('open');
});

// Progress updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GETINSPIRE_VIDEO_STATUS') setStatus(msg.text||'');
  if (msg.type === 'GETINSPIRE_VIDEO_PROGRESS') setProgress(msg.done, msg.total);
});

async function ensureOrigins(patterns){
  try {
    if (!patterns || !patterns.length) return true;
    const missing = [];
    for (const p of patterns){
      const has = await chrome.permissions.contains({ origins: [p] }).catch(()=>false);
      if (!has) missing.push(p);
    }
    if (!missing.length) return true;
    const ok = await chrome.permissions.request({ origins: missing }).catch(()=>false);
    return !!ok;
  } catch { return false; }
}
