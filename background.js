const getDomain = (url) => {
  try { return new URL(url).hostname; } catch (e) { return null; }
};

const updateIcon = async (tabId, url) => {
  try {
    if (!url || url.startsWith('chrome://')) {
      chrome.action.setIcon({ tabId, path: { "16": "icons/icon16_off.png", "48": "icons/icon48_off.png", "128": "icons/icon128_off.png" } }).catch(()=>{});
      return;
    }
    const domain = getDomain(url);
    if (!domain) return;
    const data = await chrome.storage.local.get(['enabledDomains', 'globalEnabled']);
    const isEnabled = data.globalEnabled || (data.enabledDomains && data.enabledDomains[domain]);
    const path = isEnabled ? { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" } : { "16": "icons/icon16_off.png", "48": "icons/icon48_off.png", "128": "icons/icon128_off.png" };
    chrome.action.setIcon({ tabId, path }).catch(() => {});
  } catch(err) {}
};

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateIcon(tab.id, tab.url);
  } catch(e) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateIcon(tabId, tab.url);
  }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && (changes.enabledDomains || changes.globalEnabled)) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        updateIcon(tabs[0].id, tabs[0].url);
      }
    } catch(e) {}
  }
});

// Handle Messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_TEXT') {
    const blob = new Blob([message.text], { type: 'text/plain;charset=utf-8' });
    const reader = new FileReader();
    reader.onload = function() {
      chrome.downloads.download({
        url: reader.result,
        filename: (message.title || 'article').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt',
        saveAs: true
      });
    };
    reader.readAsDataURL(blob);
    sendResponse({ success: true });
  }
  
  if (message.type === 'OPEN_IMAGE_GALLERY') {
    chrome.storage.local.set({ extractedImages: message.images }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
    });
    sendResponse({ success: true });
  }

    if (message.type === 'FULL_SCREENSHOT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || tab.url.startsWith('chrome://')) return;
      
      const debuggee = { tabId: tab.id };
      chrome.debugger.attach(debuggee, "1.3", () => {
        chrome.debugger.sendCommand(debuggee, "Page.getLayoutMetrics", {}, (metrics) => {
          const w = metrics.cssContentSize ? metrics.cssContentSize.width : metrics.contentSize.width;
          const h = metrics.cssContentSize ? metrics.cssContentSize.height : metrics.contentSize.height;
          chrome.debugger.sendCommand(debuggee, "Page.captureScreenshot", {
            clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
            captureBeyondViewport: true,
            format: 'png'
          }, (result) => {
            chrome.debugger.detach(debuggee);
            if (result && result.data) {
              chrome.downloads.download({
                url: 'data:image/png;base64,' + result.data,
                filename: 'Zenbrowse_FullPage.png',
                saveAs: true
              });
            }
          });
        });
      });
    });
    return true;
  }
  if (message.type === 'CAPTURE_SCREEN') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true; // async response
  }
  
  return true;
});

// Setup Context Menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "highlight-text",
    title: "ðŸ–ï¸ Highlight Text & Save",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "highlight-text") {
    chrome.tabs.sendMessage(tab.id, { type: "HIGHLIGHT_SELECTION" }).catch(()=>{});
  }
});



