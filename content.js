const getBrowser = () => (typeof chrome !== 'undefined' ? chrome : browser);
const api = getBrowser();

const currentDomain = window.location.hostname;
let isUnblocked = false;

async function checkAndApply() {
  const { enabledDomains = {}, globalEnabled = false } = await api.storage.sync.get([
    'enabledDomains',
    'globalEnabled'
  ]);

  const shouldEnable = globalEnabled || !!enabledDomains[currentDomain];

  if (shouldEnable && !isUnblocked) {
    enableUnblocking();
  } else if (!shouldEnable && isUnblocked) {
    disableUnblocking();
  }
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

  const allowedEvents = ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'mousedown', 'mouseup', 'keydown', 'keyup'];
  allowedEvents.forEach((eventType) => {
    window.addEventListener(
      eventType,
      (e) => {
        if (!isUnblocked) return;
        e.stopImmediatePropagation();
      },
      true
    );
  });
}

function disableUnblocking() {
  isUnblocked = false;
  const cssElem = document.getElementById('copyfreedom-css');
  if (cssElem) cssElem.remove();
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_STATE') {
    if (request.enabled) {
      enableUnblocking();
    } else {
      disableUnblocking();
    }
    sendResponse({ success: true, status: isUnblocked });
  } else if (request.type === 'GET_STATUS') {
    sendResponse({ isUnblocked, domain: currentDomain });
  }
});

checkAndApply();
