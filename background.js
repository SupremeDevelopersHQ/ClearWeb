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

    const data = await chrome.storage.sync.get(['enabledDomains', 'globalEnabled']);
    const isEnabled = data.globalEnabled || (data.enabledDomains && data.enabledDomains[domain]);

    const path = isEnabled ? {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    } : {
      "16": "icons/icon16_off.png",
      "48": "icons/icon48_off.png",
      "128": "icons/icon128_off.png"
    };

    chrome.action.setIcon({ tabId, path }).catch(() => {});
  } catch(err) {
    // Ignore icon update errors for closed tabs
  }
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
