(() => {
  // ONLY intercept the exact events related to copying/pasting.
  // NEVER block mousedown, mouseup, or dragstart, as that destroys modern web apps like YouTube.
  const restrictedEvents = new Set([
    'copy',
    'cut',
    'paste',
    'contextmenu'
  ]);

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (restrictedEvents.has(type?.toLowerCase())) {
      return; // Block websites from disabling copy/paste
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  const clearInlineHandlers = () => {
    const targets = [window, document, document.body, document.documentElement];
    targets.forEach((target) => {
      if (!target) return;
      restrictedEvents.forEach((evt) => {
        try { target[`on${evt}`] = null; } catch (_) {}
      });
    });
  };

  clearInlineHandlers();
  document.addEventListener('DOMContentLoaded', clearInlineHandlers);

  try {
    delete document.oncontextmenu;
    delete document.oncopy;
    delete document.onpaste;
  } catch (_) {}
})();
