const siteToggle = document.getElementById('site-toggle');
const globalToggle = document.getElementById('global-toggle');
const cookieToggle = document.getElementById('cookie-toggle');
const statusText = document.getElementById('status-text');
const reloadBtn = document.getElementById('reload-btn');
const statsCounter = document.getElementById('stats-counter');

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];
  const url = new URL(currentTab.url);
  const domain = url.hostname;

  chrome.storage.local.get(['enabledDomains', 'globalEnabled', 'blocksDefeated'], (data) => {
    const enabledDomains = data.enabledDomains || {};
    siteToggle.checked = !!enabledDomains[domain];
    globalToggle.checked = !!data.globalEnabled;
    statsCounter.innerText = data.blocksDefeated || 0;
    updateStatusText();

    siteToggle.addEventListener('change', () => {
      enabledDomains[domain] = siteToggle.checked;
      chrome.storage.local.set({ enabledDomains });
      updateStatusText();
      notifyTab(currentTab.id, siteToggle.checked || globalToggle.checked);
      chrome.tabs.reload(currentTab.id);
    });

        cookieToggle.addEventListener('change', () => {
      chrome.storage.local.set({ nukeCookies: cookieToggle.checked });
      chrome.tabs.sendMessage(currentTab.id, { type: 'NUKE_COOKIES', enabled: cookieToggle.checked }).catch(()=>{});
    });
    globalToggle.addEventListener('change', () => {
      chrome.storage.local.set({ globalEnabled: globalToggle.checked });
      updateStatusText();
      notifyTab(currentTab.id, siteToggle.checked || globalToggle.checked);
      chrome.tabs.reload(currentTab.id);
    });
  });
});

function updateStatusText() {
  if (globalToggle.checked) {
    statusText.innerText = "ON (GLOBAL)";
    statusText.style.color = "var(--accent-color)";
    reloadBtn.style.display = "block";
  } else if (siteToggle.checked) {
    statusText.innerText = "ON (SITE)";
    statusText.style.color = "var(--accent-color)";
    reloadBtn.style.display = "block";
  } else {
    statusText.innerText = "OFF";
    statusText.style.color = "#94a3b8";
    reloadBtn.style.display = "none";
  }
}

function notifyTab(tabId, isEnabled) {
  chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_STATE', enabled: isEnabled }).catch(() => {});
}

reloadBtn.addEventListener('click', () => {
  chrome.tabs.reload();
  window.close();
});

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch(e) {
    const ta = document.createElement('textarea');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

const sendToTab = (type, payload = {}) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;
    chrome.tabs.sendMessage(tabs[0].id, { type, ...payload }, { frameId: 0 });
    setTimeout(() => window.close(), 150);
  });
};

document.getElementById('snipe-btn').addEventListener('click', () => sendToTab('START_SNIPER'));
document.getElementById('extract-images-btn')?.addEventListener('click', () => sendToTab('EXTRACT_IMAGES'));
const imagesBtn = document.getElementById('images-btn');
if(imagesBtn) imagesBtn.addEventListener('click', () => sendToTab('EXTRACT_IMAGES'));
document.getElementById('darkmode-btn').addEventListener('click', () => sendToTab('TOGGLE_DARK_MODE'));

document.getElementById('md-btn').addEventListener('click', () => sendToTab('COPY_MARKDOWN'));

// removed autocopy

document.getElementById('reader-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;
    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['Readability.js'] }, () => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'READER_MODE' });
      setTimeout(() => window.close(), 150);
    });
  });
});

// bypass button removed

document.getElementById('ocr-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;
    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['tesseract.min.js'] }, () => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'START_OCR' }).catch(()=>{});
      window.close();
    });
  });
});

document.getElementById('download-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_ARTICLE_TEXT' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.text) return;
      chrome.runtime.sendMessage({ type: 'DOWNLOAD_TEXT', text: response.text, title: response.title });
      window.close();
    });
  });
});

// Clean URL Logic
document.getElementById('clean-url-btn').addEventListener('click', async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;
    try {
      const rawUrl = new URL(tabs[0].url);
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'igshid', '_ga', 'mc_eid', 'ttclid', 'ref'];
      trackingParams.forEach(param => rawUrl.searchParams.delete(param));
      const cleaned = rawUrl.toString();
      
      await copyToClipboard(cleaned);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_TOAST', toast: '&#128279; Clean URL Copied!' }, { frameId: 0 }).catch(()=>{});
    } catch(e) {}
    window.close();
  });
});

// Tabs logic
document.getElementById('tab-tools').addEventListener('click', () => {
  document.getElementById('tab-tools').classList.add('active');
  document.getElementById('tab-vault').classList.remove('active');
  document.getElementById('view-tools').style.display = 'block';
  document.getElementById('view-vault').style.display = 'none';
});
document.getElementById('tab-vault').addEventListener('click', () => {
  document.getElementById('tab-vault').classList.add('active');
  document.getElementById('tab-tools').classList.remove('active');
  document.getElementById('view-vault').style.display = 'block';
  document.getElementById('view-tools').style.display = 'none';
  loadVault();
});

function loadVault() {
  chrome.storage.local.get(['clipboardHistory'], (data) => {
    const list = document.getElementById('vault-list');
    list.innerHTML = '';
    const history = data.clipboardHistory || [];
    if (history.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:#9aa0a6; margin-top:20px;">Your vault is empty.<br><br>Copy some text on any page and it will magically appear here!</p>';
      return;
    }
    history.forEach((item, index) => {
      const div = document.createElement('div');
      div.style.cssText = 'background:#f8f9fa; border:1px solid #dadce0; border-radius:4px; padding:10px; margin-bottom:8px; cursor:pointer; position:relative; text-align:left; transition:0.2s;';
      const textPreview = item.text.length > 80 ? item.text.substring(0, 80) + '...' : item.text;
      const safeTitle = item.title ? item.title.replace(/</g, '&lt;') : 'Copied item';
      const safeText = textPreview.replace(/</g, '&lt;');
      
      div.innerHTML = `
        <div style="font-size:11px; color:#5f6368; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${safeTitle}</span>
          <span>${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div style="font-size:13px; color:#202124; line-height:1.4; word-break:break-word;">${safeText}</div>
      `;
      div.addEventListener('mouseover', () => div.style.background = '#f1f3f4');
      div.addEventListener('mouseout', () => div.style.background = '#f8f9fa');
      div.addEventListener('click', async () => {
        try {
          await copyToClipboard(item.text);
          div.style.background = '#e8f0fe';
          div.style.borderColor = '#d2e3fc';
          setTimeout(() => {
            div.style.background = '#f8f9fa';
            div.style.borderColor = '#dadce0';
          }, 400);
        } catch(e) {}
      });
      list.appendChild(div);
    });
  });
}

document.getElementById('clear-vault-btn').addEventListener('click', () => {
  chrome.storage.local.set({ clipboardHistory: [] }, () => {
    loadVault();
  });
});

document.getElementById('screenshot-btn').addEventListener('click', () => chrome.runtime.sendMessage({type: 'FULL_SCREENSHOT'}));



document.getElementById('autoscroll-btn').addEventListener('click', () => sendToTab('START_AUTOSCROLL'));





