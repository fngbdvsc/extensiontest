(() => {
  const STATE_KEY = "__pqWalmartValidatedTickets";
  const EVENT_NAME = "pokequebec:aco:walmart-queue-updated";
  if (window[STATE_KEY]?.version === 3) return;

  const state = { version: 3, tickets: [], observedAt: 0 };
  Object.defineProperty(window, STATE_KEY, {
    value: state,
    configurable: true
  });

  const isValidationUrl = value => {
    try {
      const url = new URL(String(value ?? ""), location.href);
      return /^q-api(?:\.www)?\.walmart\.(?:ca|com)$/iu.test(url.hostname) &&
        /^\/validateTickets\/?$/u.test(url.pathname);
    } catch {
      return false;
    }
  };
  const sanitize = payload => {
    const tickets = [];
    const seen = new WeakSet();
    let visited = 0;
    const visit = (value, depth = 0) => {
      if (!value || typeof value !== "object" || depth > 6 || visited++ > 500) {
        return;
      }
      if (seen.has(value)) return;
      seen.add(value);

      if (Number.isInteger(value.ticket) && typeof value.queue === "string") {
        const item = value.customMetadata?.item;
        tickets.push({
          site: value.site,
          queue: value.queue,
          shard: value.shard,
          ticket: value.ticket,
          state: value.state,
          errorCode: value.errorCode,
          expires: value.expires,
          itemId: value.itemId,
          offerId: value.offerId,
          nextRefreshUnixTimestamp: value.nextRefreshUnixTimestamp,
          expectedTurnTimeUnixTimestamp: value.expectedTurnTimeUnixTimestamp,
          customMetadata: {
            admissionLikelihood: value.customMetadata?.admissionLikelihood,
            item: item && typeof item === "object" ? {
              name: item.name,
              currentPrice: item.currentPrice,
              imageURL: item.imageURL,
              itemURL: item.itemURL
            } : {}
          }
        });
      }

      for (const nested of Array.isArray(value)
        ? value
        : Object.values(value)) {
        visit(nested, depth + 1);
      }
    };
    visit(payload);
    return tickets;
  };
  const capture = payload => {
    state.tickets = sanitize(payload).slice(-50);
    state.observedAt = Date.now();
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (isValidationUrl(response.url) || isValidationUrl(requestUrl)) {
        void response.clone().json().then(capture, () => {});
      }
      return response;
    };
  }

  const xhr = window.XMLHttpRequest?.prototype;
  if (xhr?.open && xhr.send) {
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    const requestUrls = new WeakMap();
    xhr.open = function (method, url, ...args) {
      requestUrls.set(this, url);
      return originalOpen.call(this, method, url, ...args);
    };
    xhr.send = function (...args) {
      if (isValidationUrl(requestUrls.get(this))) {
        this.addEventListener("load", () => {
          try {
            capture(this.responseType === "json"
              ? this.response
              : JSON.parse(this.responseText));
          } catch {
            return;
          }
        }, { once: true });
      }
      return originalSend.apply(this, args);
    };
  }
})();
