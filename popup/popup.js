const getBrowser = () => (typeof chrome !== 'undefined' ? chrome : browser);
const api = getBrowser();

document.addEventListener('DOMContentLoaded', async () => {
  const currentDomainEl = document.getElementById('current-domain');
  const siteToggle = document.getElementById('site-toggle');
  const globalToggle = document.getElementById('global-toggle');
  const globalBadge = document.getElementById('global-badge');
  const btnReload = document.getElementById('btn-reload');

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith('http')) {
    currentDomainEl.textContent = 'Not applicable on this page';
    siteToggle.disabled = true;
    updateUIState(false);
    return;
  }

  const url = new URL(tab.url);
  const domain = url.hostname;
  currentDomainEl.textContent = domain;

  const { enabledDomains = {}, globalEnabled = false } = await api.storage.sync.get([
    'enabledDomains',
    'globalEnabled'
  ]);

  const isSiteEnabled = !!enabledDomains[domain];
  siteToggle.checked = isSiteEnabled;
  globalToggle.checked = globalEnabled;

  const isActive = isSiteEnabled || globalEnabled;
  updateUIState(isActive);

  siteToggle.addEventListener('change', async () => {
    const updated = await api.storage.sync.get(['enabledDomains']);
    const domains = updated.enabledDomains || {};

    if (siteToggle.checked) {
      domains[domain] = true;
    } else {
      delete domains[domain];
    }

    await api.storage.sync.set({ enabledDomains: domains });
    const currentActive = siteToggle.checked || globalToggle.checked;
    
    updateUIState(currentActive);
    notifyContentScript(tab.id, currentActive);
    updateBackgroundBadge(tab.id, tab.url);
    btnReload.style.display = 'block';
  });

  globalToggle.addEventListener('change', async () => {
    const isGlobal = globalToggle.checked;
    await api.storage.sync.set({ globalEnabled: isGlobal });
    
    const currentActive = siteToggle.checked || isGlobal;
    updateUIState(currentActive);
    notifyContentScript(tab.id, currentActive);
    updateBackgroundBadge(tab.id, tab.url);
    btnReload.style.display = 'block';
  });

  btnReload.addEventListener('click', () => {
    api.tabs.reload(tab.id);
    window.close();
  });

  function updateUIState(isActive) {
    if (isActive) {
      globalBadge.textContent = 'ON (ACTIVE)';
      globalBadge.classList.remove('off');
      globalBadge.classList.add('active');
    } else {
      globalBadge.textContent = 'OFF';
      globalBadge.classList.remove('active');
      globalBadge.classList.add('off');
    }
  }

  function notifyContentScript(tabId, enabled) {
    api.tabs.sendMessage(tabId, { type: 'TOGGLE_STATE', enabled }).catch(() => {});
  }

  function updateBackgroundBadge(tabId, tabUrl) {
    api.runtime.sendMessage({ type: 'UPDATE_BADGE', tabId, url: tabUrl }).catch(() => {});
  }
});
