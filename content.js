const getBrowser = () => (typeof chrome !== 'undefined' ? chrome : browser);
const api = getBrowser();
const currentDomain = window.location.hostname;
let isUnblocked = false;

// Stats Tracking 
let sessionBlocks = 0;
let statsTimeout = null;

function recordBlock() {
  sessionBlocks++;
  if (statsTimeout) return;
  statsTimeout = setTimeout(() => {
    try {
      if (!api || !api.storage) {
        sessionBlocks = 0;
        statsTimeout = null;
        return;
      }
      api.storage.sync.get(['blocksDefeated'], (data) => {
        if (api.runtime.lastError) return; // Prevent extension reload errors
        const current = data.blocksDefeated || 0;
        api.storage.sync.set({ blocksDefeated: current + sessionBlocks });
        sessionBlocks = 0;
        statsTimeout = null;
      });
    } catch (e) {
      sessionBlocks = 0;
      statsTimeout = null;
    }
  }, 2000);
}

async function checkAndApply() {
  try {
    const { enabledDomains = {}, globalEnabled = false } = await api.storage.sync.get(['enabledDomains', 'globalEnabled']);
    const shouldEnable = globalEnabled || !!enabledDomains[currentDomain];
    if (shouldEnable && !isUnblocked) enableUnblocking();
    else if (!shouldEnable && isUnblocked) disableUnblocking();
  } catch(e) {}
}

function enableUnblocking() {
  isUnblocked = true;

  if (!document.getElementById('copyfreedom-css')) {
    const link = document.createElement('link');
    link.id = 'copyfreedom-css';
    link.rel = 'stylesheet';
    link.href = api.runtime.getURL('unblock.css');
    (document.head || document.documentElement).appendChild(link);
  }

  if (!document.getElementById('copyfreedom-script')) {
    const script = document.createElement('script');
    script.id = 'copyfreedom-script';
    script.src = api.runtime.getURL('injected.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  const allowedEvents = ['cut', 'paste', 'contextmenu'];
  allowedEvents.forEach((eventType) => {
    window.addEventListener(eventType, (e) => {
        if (!isUnblocked) return;
        e.stopImmediatePropagation();
        recordBlock();
      }, true);
  });

  window.addEventListener('copy', (e) => {
    if (!isUnblocked) return;
    e.stopImmediatePropagation(); 
    recordBlock();
    
    const plainText = window.getSelection().toString();
    if (plainText) {
      e.clipboardData.clearData();
      e.clipboardData.setData('text/plain', plainText);
      e.preventDefault(); 
    }
  }, true);

  window.addEventListener('keydown', (e) => {
    if (!isUnblocked) return;
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'C', 'V', 'X', 'A'].includes(e.key)) {
      e.stopImmediatePropagation();
      recordBlock();
    }
  }, true);
}

function disableUnblocking() {
  isUnblocked = false;
  const cssElem = document.getElementById('copyfreedom-css');
  if (cssElem) cssElem.remove();
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_STATE') {
    if (request.enabled) enableUnblocking();
    else disableUnblocking();
    sendResponse({ success: true, status: isUnblocked });
  }
});

let hoveredElement = null;

function startSniperMode() {
  document.body.style.cursor = 'crosshair';
  
  const mouseOverHandler = (e) => {
    e.stopPropagation();
    if (hoveredElement) hoveredElement.style.outline = '';
    hoveredElement = e.target;
    hoveredElement.style.outline = '3px dashed red';
    hoveredElement.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
  };

  const mouseOutHandler = (e) => {
    if (hoveredElement) {
      hoveredElement.style.outline = '';
      hoveredElement.style.backgroundColor = '';
    }
  };

  const clickHandler = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (hoveredElement) {
      hoveredElement.style.outline = '';
      hoveredElement.style.backgroundColor = '';
      hoveredElement.remove();
    }
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', mouseOverHandler, true);
    document.removeEventListener('mouseout', mouseOutHandler, true);
    document.removeEventListener('click', clickHandler, true);
  };

  document.addEventListener('mouseover', mouseOverHandler, true);
  document.addEventListener('mouseout', mouseOutHandler, true);
  document.addEventListener('click', clickHandler, true);
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_SNIPER') {
    startSniperMode();
  }
});

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'COPY_MARKDOWN') {
    copyAsMarkdown();
  }
});

function copyAsMarkdown() {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.toString().trim() === '') {
    alert('Please highlight some text on the page first!');
    return;
  }
  
  const container = document.createElement('div');
  container.appendChild(selection.getRangeAt(0).cloneContents());
  let html = container.innerHTML;
  
  let md = html
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
  
  md = md.replace(/<[^>]+>/g, '');
  const txt = document.createElement("textarea");
  txt.innerHTML = md;
  const finalMd = txt.value.trim();
  
  navigator.clipboard.writeText(finalMd).then(() => {
    const toast = document.createElement('div');
    toast.innerText = 'Copied as Markdown!';
    toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#10b981; color:white; padding:12px 24px; border-radius:8px; z-index:9999999; font-family:sans-serif; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  });
}

checkAndApply();
