/* Data collection.
 *
 * For now: every play is appended to localStorage and can be downloaded as a
 * JSON file ("write to a file locally"). If CONFIG.DATA_ENDPOINT is later set
 * to a secret-holding proxy (e.g. an HF Space that writes to a HF dataset),
 * records are also POSTed there (fire-and-forget). The page never holds a token.
 */
window.Recorder = (function () {
  const KEY = "geoguessr_plays";

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveAll(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {
      /* storage full / disabled — ignore, the game still works */
    }
  }

  function record(event, payload) {
    const entry = {
      event: event,
      payload: payload,
      ts: new Date().toISOString(),
      ua: navigator.userAgent,
    };
    const all = loadAll();
    all.push(entry);
    saveAll(all);

    const endpoint = window.CONFIG && window.CONFIG.DATA_ENDPOINT;
    if (endpoint) {
      try {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
          keepalive: true,
        }).catch(() => {});
      } catch (e) {
        /* network errors must never break gameplay */
      }
    }
    return entry;
  }

  function count() {
    return loadAll().length;
  }

  function download() {
    const data = JSON.stringify(loadAll(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "geoguessr_plays.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clear() {
    saveAll([]);
  }

  return { record, count, download, clear, loadAll };
})();
