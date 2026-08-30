const getBrowser = () => (typeof chrome !== 'undefined' ? chrome : browser);
const api = getBrowser();
const currentDomain = window.location.hostname;
let isUnblocked = false;

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// Stats Tracking
let sessionBlocks = 0;
let statsTimeout = null;
function recordBlock() {
  sessionBlocks++;
  if (statsTimeout) return;
  statsTimeout = setTimeout(() => {
    try {
      if (!api || !api.storage) { sessionBlocks = 0; statsTimeout = null; return; }
      api.storage.local.get(['blocksDefeated'], (data) => {
        if (api.runtime.lastError) return;
        const current = data.blocksDefeated || 0;
        api.storage.local.set({ blocksDefeated: current + sessionBlocks });
        sessionBlocks = 0;
        statsTimeout = null;
      });
    } catch (e) { sessionBlocks = 0; statsTimeout = null; }
  }, 2000);
}

async function checkAndApply() {
  try {
    const { enabledDomains = {}, globalEnabled = false } = await api.storage.local.get(['enabledDomains', 'globalEnabled']);
    const shouldEnable = globalEnabled || !!enabledDomains[currentDomain];
    if (shouldEnable && !isUnblocked) enableUnblocking();
    else if (!shouldEnable && isUnblocked) disableUnblocking();
  } catch(e) {}
}

function enableUnblocking() {
  isUnblocked = true;
  if (!document.getElementById('copyfreedom-css')) {
    const link = document.createElement('link'); link.id = 'copyfreedom-css'; link.rel = 'stylesheet';
    link.href = api.runtime.getURL('unblock.css'); (document.head || document.documentElement).appendChild(link);
  }
  if (!document.getElementById('copyfreedom-script')) {
    const script = document.createElement('script'); script.id = 'copyfreedom-script';
    script.src = api.runtime.getURL('injected.js'); script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  const allowedEvents = ['cut', 'paste', 'contextmenu'];
  allowedEvents.forEach((eventType) => {
    window.addEventListener(eventType, (e) => {
        if (!isUnblocked) return;
        e.stopImmediatePropagation(); recordBlock();
      }, true);
  });

  window.addEventListener('selectstart', (e) => {
    if (!isUnblocked) return;
    if (e.target && e.target.closest && e.target.closest('video, audio, input, textarea, button, [role="slider"], .ytp-progress-bar-container, .slider')) return; 
    e.stopImmediatePropagation(); recordBlock();
  }, true);

  window.addEventListener('copy', (e) => {
    if (!isUnblocked) return;
    e.stopImmediatePropagation(); recordBlock();
    const plainText = window.getSelection().toString();
    if (plainText) {
      e.clipboardData.clearData(); e.clipboardData.setData('text/plain', plainText); e.preventDefault(); 
    }
  }, true);

  window.addEventListener('keydown', (e) => {
    if (!isUnblocked) return;
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'C', 'V', 'X', 'A'].includes(e.key)) {
      e.stopImmediatePropagation(); recordBlock();
    }
  }, true);
}

function disableUnblocking() {
  isUnblocked = false;
  const cssElem = document.getElementById('copyfreedom-css'); if (cssElem) cssElem.remove();
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_STATE') {
    if (request.enabled) enableUnblocking(); else disableUnblocking();
    sendResponse({ success: true, status: isUnblocked });
  }
  
  if (request.type === 'START_SNIPER') startSniperMode();
  if (request.type === 'COPY_MARKDOWN') copyAsMarkdown();
  if (request.type === 'AUTO_COPY') autoCopyAll();
  if (request.type === 'READER_MODE') enableReaderMode();
  if (request.type === 'EXTRACT_IMAGES') extractImages();
  if (request.type === 'START_OCR') startOCRMode();
  if (request.type === 'HIGHLIGHT_SELECTION') highlightSelection();
  if (request.type === 'SHOW_TOAST') {
    const d = document.createElement('div'); d.innerHTML = request.toast;
    showToast(d.innerText);
  }
  
  if (request.type === 'GET_ARTICLE_TEXT') {
    const text = document.body.innerText;
    sendResponse({ text, title: document.title });
  }
  
  if (request.type === 'TOGGLE_DARK_MODE') {
    let style = document.getElementById('supreme-dark-mode');
    if (style) {
      style.remove();
      showToast('Dark Mode Disabled');
    } else {
      style = document.createElement('style');
      style.id = 'supreme-dark-mode';
      style.textContent = `
        html { background-color: #fff !important; filter: invert(1) hue-rotate(180deg) !important; }
        img:not([class*="logo" i]):not([src*="logo" i]):not([id*="logo" i]), 
        video, iframe, canvas, 
        svg:not([class*="logo" i]):not([id*="logo" i]), 
        picture { 
          filter: invert(1) hue-rotate(180deg) !important; 
        }
      `;
      document.head.appendChild(style);
      showToast('Dark Mode Enabled');
    }
  }

  return true;
});

function showToast(msg) {
  const toast = document.createElement('div'); toast.innerText = msg;
  toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#10b981; color:white; padding:12px 24px; border-radius:8px; z-index:9999999; font-family:sans-serif; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.15);';
  document.body.appendChild(toast); setTimeout(() => toast.remove(), 2500);
}

// ---------------------------------------------------------
// NEW FEATURES
// ---------------------------------------------------------

function getReadabilityArticle() {
  if (typeof Readability === 'undefined') return Promise.resolve(null);
  return Promise.resolve(new Readability(document.cloneNode(true)).parse());
}

// Fixed later

async function enableReaderMode() {
  try {
    const article = await getReadabilityArticle();
    if (!article) { showToast('Could not find a readable article on this page.'); return; }
    
    document.body.innerHTML = `
      <div style="max-width: 800px; margin: 40px auto; padding: 20px; font-family: Georgia, serif; line-height: 1.8; color: #111; background: #fff; font-size: 18px;">
        <h1 style="font-size: 32px; font-family: sans-serif; margin-bottom: 30px;">${article.title}</h1>
        ${article.content}
      </div>
    `;
    document.body.style.background = '#f8f9fa';
  } catch(e) {
    showToast('Reader mode failed on this page.');
  }
}

function extractImages() {
  const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src).filter(src => src && src.startsWith('http'));
  // also check computed styles for background images
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1] && match[1].startsWith('http')) imgs.push(match[1]);
    }
  });
  
  const uniqueImgs = [...new Set(imgs)];
  if (uniqueImgs.length === 0) { showToast('No images found!'); return; }
  
  api.runtime.sendMessage({ type: 'OPEN_IMAGE_GALLERY', images: uniqueImgs });
}

document.addEventListener('copy', () => {
  const selection = window.getSelection().toString().trim();
  if (selection) {
    api.storage.local.get(['clipboardHistory'], (data) => {
      let history = data.clipboardHistory || [];
      if (history.length > 0 && history[0].text === selection) return;
      
      history.unshift({
        text: selection,
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
      });
      
      if (history.length > 30) history = history.slice(0, 30);
      api.storage.local.set({ clipboardHistory: history });
    });
  }
});

// ---------------------------------------------------------
// OCR MODE
// ---------------------------------------------------------
let ocrOverlay = null;
let startX, startY;

function startOCRMode() {
  if (ocrOverlay) return;
  document.body.style.cursor = 'crosshair';
  ocrOverlay = document.createElement('div');
  ocrOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999999; background:rgba(0,0,0,0.3); cursor:crosshair;';
  
  const selectionBox = document.createElement('div');
  selectionBox.style.cssText = 'position:fixed; border:2px dashed #3b82f6; background:rgba(59,130,246,0.2); display:none;';
  ocrOverlay.appendChild(selectionBox);
  document.body.appendChild(ocrOverlay);

  function mousedown(e) {
    startX = e.clientX; startY = e.clientY;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  }

  function mousemove(e) {
    if (selectionBox.style.display !== 'block') return;
    const w = e.clientX - startX;
    const h = e.clientY - startY;
    selectionBox.style.width = Math.abs(w) + 'px';
    selectionBox.style.height = Math.abs(h) + 'px';
    selectionBox.style.left = (w < 0 ? e.clientX : startX) + 'px';
    selectionBox.style.top = (h < 0 ? e.clientY : startY) + 'px';
  }

  async function mouseup(e) {
    document.body.style.cursor = '';
    document.removeEventListener('keydown', keydownHandler, true);
    const rect = selectionBox.getBoundingClientRect();
    if(ocrOverlay) { ocrOverlay.remove(); ocrOverlay = null; }
    
    if (rect.width < 10 || rect.height < 10) return;
    showToast('Extracting Text (OCR)... Please wait.');

    try {
      api.runtime.sendMessage({ type: 'CAPTURE_SCREEN' }, async (response) => {
        if (!response || !response.dataUrl) { showToast('Failed to capture screen.'); return; }
        
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = rect.width; canvas.height = rect.height;
          const ctx = canvas.getContext('2d');
          const scale = window.devicePixelRatio;
          ctx.drawImage(img, rect.left * scale, rect.top * scale, rect.width * scale, rect.height * scale, 0, 0, rect.width, rect.height);
          const croppedDataUrl = canvas.toDataURL('image/png');
          
          if (typeof Tesseract === 'undefined') {
             showToast("OCR Engine failed to load."); return;
          }
          
          const worker = await Tesseract.createWorker({
            workerPath: api.runtime.getURL('worker.min.js'),
            corePath: api.runtime.getURL('tesseract-core.wasm.js'),
            langPath: api.runtime.getURL(''),
          });
          
          await worker.loadLanguage('eng');
          await worker.initialize('eng');
          const { data: { text } } = await worker.recognize(croppedDataUrl);
          await worker.terminate();
          
          if (text.trim()) {
            copyToClipboard(text.trim()).then(() => showToast('OCR Copied to Clipboard!'));
          } else {
            showToast('No text found in that area.');
          }
        };
        img.src = response.dataUrl;
      });
    } catch(err) {
      showToast('OCR Failed. Check console.');
      console.error(err);
    }
  }

  function keydownHandler(e) {
    if (e.key === 'Escape') {
      if (ocrOverlay) { ocrOverlay.remove(); ocrOverlay = null; }
      document.body.style.cursor = '';
      document.removeEventListener('keydown', keydownHandler, true);
    }
  }

  ocrOverlay.addEventListener('mousedown', mousedown);
  ocrOverlay.addEventListener('mousemove', mousemove);
  ocrOverlay.addEventListener('mouseup', mouseup);
  document.addEventListener('keydown', keydownHandler, true);
}

// ---------------------------------------------------------
// SNIPER & MARKDOWN
// ---------------------------------------------------------
let hoveredElement = null;

function startSniperMode() {
  document.body.style.cursor = 'crosshair';
  
  function mouseOverHandler(e) { e.stopPropagation(); if (hoveredElement) hoveredElement.style.outline = ''; hoveredElement = e.target; hoveredElement.style.outline = '3px dashed red'; hoveredElement.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }
  function mouseOutHandler(e) { if (hoveredElement) { hoveredElement.style.outline = ''; hoveredElement.style.backgroundColor = ''; } }
  
  function cleanup() {
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', mouseOverHandler, true);
    document.removeEventListener('mouseout', mouseOutHandler, true);
    document.removeEventListener('click', clickHandler, true);
    document.removeEventListener('keydown', keydownHandler, true);
  }
  
  function clickHandler(e) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (hoveredElement) { hoveredElement.style.outline = ''; hoveredElement.style.backgroundColor = ''; hoveredElement.remove(); }
    cleanup();
  }
  
  function keydownHandler(e) {
    if (e.key === 'Escape') {
      if (hoveredElement) { hoveredElement.style.outline = ''; hoveredElement.style.backgroundColor = ''; }
      cleanup();
    }
  }
  
  document.addEventListener('mouseover', mouseOverHandler, true);
  document.addEventListener('mouseout', mouseOutHandler, true);
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('keydown', keydownHandler, true);
}

function copyAsMarkdown() {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.toString().trim() === '') return showToast('Please highlight some text on the page first!');
  const container = document.createElement('div'); container.appendChild(selection.getRangeAt(0).cloneContents());
  let html = container.innerHTML;
  let md = html.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n').replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n').replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n').replace(/<strong>(.*?)<\/strong>/gi, '**$1**').replace(/<b>(.*?)<\/b>/gi, '**$1**').replace(/<em>(.*?)<\/em>/gi, '*$1*').replace(/<i>(.*?)<\/i>/gi, '*$1*').replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)').replace(/<br\s*[\/]?>/gi, '\n').replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<[^>]+>/g, '');
  copyToClipboard(md.trim()).then(() => showToast('Copied as Markdown!'));
}

// ---------------------------------------------------------
// PERSISTENT HIGHLIGHTER
// ---------------------------------------------------------
function highlightSelection() {
  const text = window.getSelection().toString().trim();
  if (!text) {
    showToast('Please select text to highlight!');
    return;
  }
  
  document.designMode = "on";
  document.execCommand("hiliteColor", false, "#ffeb3b");
  document.designMode = "off";
  
  const url = window.location.href.split('#')[0];
  api.storage.local.get(['webHighlights'], (data) => {
    const highlights = data.webHighlights || {};
    if (!highlights[url]) highlights[url] = [];
    highlights[url].push(text);
    api.storage.local.set({ webHighlights: highlights });
    showToast('&#128396; Highlight saved!');
  });
  window.getSelection().removeAllRanges();
}

function restoreHighlights() {
  const url = window.location.href.split('#')[0];
  api.storage.local.get(['webHighlights'], (data) => {
    const highlights = data.webHighlights || {};
    const pageHighlights = highlights[url];
    
    if (pageHighlights && pageHighlights.length > 0) {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      document.designMode = "on";
      pageHighlights.forEach(text => {
        window.getSelection().removeAllRanges();
        document.body.focus();
        let found = true;
        let count = 0;
        while (found && count < 100) {
          found = window.find(text, false, false, true, false, false, false);
          if (found) {
            document.execCommand("hiliteColor", false, "#ffeb3b");
          }
          count++;
        }
      });
      document.designMode = "off";
      window.scrollTo(scrollX, scrollY);
      window.getSelection().removeAllRanges();
    }
  });
}

// Run restore highlights gently after load
setTimeout(restoreHighlights, 1000);

checkAndApply();

// --- NUKE COOKIES ---
function nukeCookieBanners() {
  const keywords = ['cookie', 'consent', 'gdpr', 'privacy'];
  const acceptWords = ['accept', 'allow', 'agree', 'got it', 'understand'];
  const elements = document.querySelectorAll('div, section, aside, dialogue');
  for (let el of elements) {
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute') {
      const text = el.innerText.toLowerCase();
      const zIndex = parseInt(style.zIndex) || 0;
      if (zIndex > 90 && keywords.some(k => text.includes(k)) && acceptWords.some(w => text.includes(w))) {
        el.remove();
        document.body.style.overflow = 'auto'; 
      }
    }
  }
}

api.storage.local.get(['nukeCookies'], (data) => {
  if (data.nukeCookies) {
    nukeCookieBanners();
    setTimeout(nukeCookieBanners, 2000);
    setTimeout(nukeCookieBanners, 5000);
  }
});

// --- AUTO SCROLL ---
let scrollInterval = null;
let currentScrollSpeed = 1.5;

function startAutoScroll() {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
    return;
  }
  
  let scrollAccumulator = 0;
  const startLoop = () => {
    if (scrollInterval) clearInterval(scrollInterval);
    scrollInterval = setInterval(() => {
      scrollAccumulator += currentScrollSpeed;
      if (scrollAccumulator >= 1) {
        let pixels = Math.floor(scrollAccumulator);
        window.scrollBy(0, pixels);
        scrollAccumulator -= pixels;
      }
    }, 20);
  };
  
  startLoop();
  
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e293b;color:white;padding:10px 15px;border-radius:20px;z-index:9999999;font-family:sans-serif;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;user-select:none;';
  
  panel.innerHTML = `
    <span style="font-weight:bold;margin-right:5px;">&#128196; Auto-Scroll</span>
    <button id="cw-slower" style="background:#334155;border:none;color:white;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:bold;">-</button>
    <span id="cw-speed-disp" style="width:35px;text-align:center;display:inline-block;">${currentScrollSpeed.toFixed(1)}x</span>
    <button id="cw-faster" style="background:#334155;border:none;color:white;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:bold;">+</button>
    <div style="width:1px;height:20px;background:#475569;margin:0 5px;"></div>
    <button id="cw-stop-scroll" style="background:#ef4444;border:none;color:white;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Stop</button>
  `;
  document.body.appendChild(panel);
  
  const updateSpeedDisp = () => {
    panel.querySelector('#cw-speed-disp').innerText = currentScrollSpeed.toFixed(1) + 'x';
    startLoop();
  };
  
  panel.querySelector('#cw-slower').onclick = (e) => {
    e.stopPropagation();
    currentScrollSpeed = Math.round(Math.max(0.1, currentScrollSpeed - 0.1) * 10) / 10;
    updateSpeedDisp();
  };
  
  panel.querySelector('#cw-faster').onclick = (e) => {
    e.stopPropagation();
    currentScrollSpeed = Math.round(Math.min(10.0, currentScrollSpeed + 0.1) * 10) / 10;
    updateSpeedDisp();
  };
  
  panel.querySelector('#cw-stop-scroll').onclick = (e) => {
    e.stopPropagation();
    clearInterval(scrollInterval);
    scrollInterval = null;
    panel.remove();
  };
  
  const stopEvents = (e) => {
    if (panel.contains(e.target)) return;
    if(scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
      if(panel && panel.parentNode) panel.remove();
    }
    document.removeEventListener('wheel', stopEvents);
    document.removeEventListener('mousedown', stopEvents);
  };
  
  setTimeout(() => {
    document.addEventListener('wheel', stopEvents);
    document.addEventListener('mousedown', stopEvents);
  }, 500);
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'NUKE_COOKIES' && request.enabled) nukeCookieBanners();
  if (request.type === 'START_AUTOSCROLL') startAutoScroll();
});


