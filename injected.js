(() => {
  const restrictedEvents = new Set(['copy', 'cut', 'paste', 'contextmenu']);
  const inlineOnlyEvents = new Set(['selectstart', 'dragstart', 'drag', 'drop', 'mousedown', 'mouseup']);

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (restrictedEvents.has(type?.toLowerCase())) return;
    return originalAddEventListener.call(this, type, listener, options);
  };

  const clearInlineHandlers = () => {
    const targets = [window, document, document.body, document.documentElement];
    targets.forEach((target) => {
      if (!target) return;
      [...restrictedEvents, ...inlineOnlyEvents].forEach((evt) => {
        try { target[`on${evt}`] = null; } catch (_) {}
        try { if (target.removeAttribute) target.removeAttribute(`on${evt}`); } catch (_) {}
      });
    });
  };

  clearInlineHandlers();
  document.addEventListener('DOMContentLoaded', clearInlineHandlers);

  try {
    delete document.oncontextmenu;
    delete document.oncopy;
    delete document.onpaste;
    delete document.onselectstart;
  } catch (_) {}
})();
