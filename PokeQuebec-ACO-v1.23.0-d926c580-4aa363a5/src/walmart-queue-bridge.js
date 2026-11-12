(() => {
  const EVENT_NAME = "pokequebec:aco:walmart-queue-updated";
  const INSTALLED_KEY = "__pqWalmartQueueBridgeInstalled";
  if (window[INSTALLED_KEY]) return;

  Object.defineProperty(window, INSTALLED_KEY, {
    value: true,
    configurable: true
  });

  const reportError = error => {
    if (/Extension context invalidated/iu.test(error?.message ?? "")) return;
    console.warn(
      "[pokequebec-aco] Could not publish Walmart queue update.",
      error?.message ?? String(error)
    );
  };

  window.addEventListener(EVENT_NAME, () => {
    try {
      void chrome.runtime.sendMessage({
        type: "POKEQUEBEC_ACO_WALMART_QUEUE_UPDATED"
      }).catch(reportError);
    } catch (error) {
      reportError(error);
    }
  });
})();
