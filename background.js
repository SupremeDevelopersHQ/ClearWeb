const getBrowser = () => (typeof chrome !== 'undefined' ? chrome : browser);
const api = getBrowser();

const COLOR_ENABLED = '#10B981';
const COLOR_DISABLED = '#F97316';

api.runtime.onInstalled.addListener(() => {
  api.storage.sync.get(['enabledDomains', 'globalEnabled'], (result) => {
    if (!result.enabledDomains) {
      api.storage.sync.set({
        enabledDomains: {},
        globalEnabled: false
      });
    }
  });
});

async function updateBadge(tabId, url) {
  if (!url || !url.startsWith('http')) {
    api.action.setBadgeText({ tabId, text: '' });
    return;
  }

  try {
    const domain = new URL(url).hostname;
    const { enabledDomains = {}, globalEnabled = false } = await api.storage.sync.get([
      'enabledDomains',
      'globalEnabled'
    ]);

    const isEnabled = globalEnabled || !!enabledDomains[domain];

    if (isEnabled) {
      api.action.setBadgeText({ tabId, text: 'ON' });
      api.action.setBadgeBackgroundColor({ tabId, color: COLOR_ENABLED });
    } else {
      api.action.setBadgeText({ tabId, text: 'OFF' });
      api.action.setBadgeBackgroundColor({ tabId, color: COLOR_DISABLED });
    }
  } catch (e) {}
}

api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tabId, tab.url);
  }
});

api.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await api.tabs.get(activeInfo.tabId);
  if (tab && tab.url) {
    updateBadge(tab.id, tab.url);
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_BADGE' && message.tabId && message.url) {
    updateBadge(message.tabId, message.url);
    sendResponse({ success: true });
  }
});
