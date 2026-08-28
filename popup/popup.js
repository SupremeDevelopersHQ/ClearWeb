const siteToggle = document.getElementById('site-toggle');
const globalToggle = document.getElementById('global-toggle');
const statusText = document.getElementById('status-text');
const reloadBtn = document.getElementById('reload-btn');
const statsCounter = document.getElementById('stats-counter');

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];
  const url = new URL(currentTab.url);
  const domain = url.hostname;

  chrome.storage.sync.get(['enabledDomains', 'globalEnabled', 'blocksDefeated'], (data) => {
    const enabledDomains = data.enabledDomains || {};
    
    siteToggle.checked = !!enabledDomains[domain];
    globalToggle.checked = !!data.globalEnabled;
    statsCounter.innerText = data.blocksDefeated || 0;
    
    updateStatusText();

    siteToggle.addEventListener('change', () => {
      enabledDomains[domain] = siteToggle.checked;
      chrome.storage.sync.set({ enabledDomains });
      updateStatusText();
      notifyTab(currentTab.id, siteToggle.checked || globalToggle.checked);
    });

    globalToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ globalEnabled: globalToggle.checked });
      updateStatusText();
      notifyTab(currentTab.id, siteToggle.checked || globalToggle.checked);
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

const snipeBtn = document.getElementById('snipe-btn');
if(snipeBtn) {
  snipeBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'START_SNIPER' });
      window.close();
    });
  });
}

const mdBtn = document.getElementById('markdown-btn');
if(mdBtn) {
  mdBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'COPY_MARKDOWN' });
      window.close();
    });
  });
}
