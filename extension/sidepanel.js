// Side panel controller: follows the active tab in this window, builds the
// .json URL, fetches it with the user's Shopify session, and renders it.

const $ = (id) => document.getElementById(id);

// Close the panel when the active tab leaves Shopify admin (another site,
// a new tab, chrome:// pages). Skipped while pinned, and only after the
// panel has shown a Shopify page, so opening it elsewhere still works.
// Set to false to restore the v0.1.0 behavior (panel stays open).
const AUTO_CLOSE_OFF_SHOPIFY = true;

const state = {
  windowId: null,
  tabId: null,
  jsonUrl: null,
  data: null,
  rawText: null,
  pinned: false,
  seq: 0,
  debounce: null,
  sawShopify: false,
};

// ---------- UI helpers ----------

function shortLabel(url) {
  try {
    const u = new URL(url);
    // admin.shopify.com/store/<handle>/products/123.json -> products/123.json
    const m = u.pathname.match(/^\/store\/[^/]+\/(.+)$/);
    if (m) return m[1];
    const a = u.pathname.match(/^\/admin\/(.+)$/);
    if (a) return a[1];
    return u.pathname;
  } catch (e) {
    return url;
  }
}

function setUrl(url) {
  const a = $("json-url");
  if (url) {
    a.textContent = shortLabel(url);
    a.title = `Open in new tab: ${url}`;
  } else {
    a.textContent = "No page loaded";
    a.title = "";
  }
}

function setStatus(text) {
  $("status").textContent = text || "";
}

function showMessage(title, body, isError) {
  const c = $("content");
  c.textContent = "";
  const box = document.createElement("div");
  box.className = "message" + (isError ? " error" : "");
  const t = document.createElement("strong");
  t.textContent = title;
  box.appendChild(t);
  if (body) {
    const p = document.createElement("p");
    if (body instanceof Node) p.appendChild(body);
    else p.textContent = body;
    box.appendChild(p);
  }
  c.appendChild(box);
  setDataButtons(false);
  $("match-count").textContent = "";
}

function showLoading(url) {
  const c = $("content");
  c.textContent = "";
  const box = document.createElement("div");
  box.className = "message";
  box.appendChild(Object.assign(document.createElement("div"), { className: "spinner" }));
  box.appendChild(document.createTextNode("Loading " + shortLabel(url) + "…"));
  c.appendChild(box);
}

function setDataButtons(enabled) {
  for (const id of ["btn-expand", "btn-collapse", "btn-copy"]) $(id).disabled = !enabled;
  $("search").disabled = !enabled;
}

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 1400);
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const preview = text.length > 60 ? text.slice(0, 57) + "…" : text;
  toast(`${label}: ${preview}`);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ---------- Fetching ----------

// Runs inside the Shopify tab (same origin as the admin), so the user's
// session cookies are used exactly as the page uses them.
async function fetchInPage(url) {
  try {
    const r = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return {
      status: r.status,
      contentType: r.headers.get("content-type") || "",
      finalUrl: r.url,
      text: await r.text(),
    };
  } catch (e) {
    return { networkError: String(e) };
  }
}

async function fetchViaTab(tabId, url) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: fetchInPage,
    args: [url],
  });
  return res && res.result;
}

async function fetchJson(tabId, url) {
  let res = null;
  let via = "page";
  try {
    res = await fetchViaTab(tabId, url);
  } catch (e) {
    res = { networkError: String(e) };
  }
  // Fallback: fetch from the extension itself (covers cross-origin
  // redirects, e.g. to <store>.myshopify.com, that the page cannot follow).
  if (!res || res.networkError) {
    via = "extension";
    res = await fetchInPage(url);
  }
  res.via = via;
  return res;
}

// ---------- Core flow ----------

async function load(tab, force) {
  if (state.pinned && !force) return;

  const url = tab && tab.url;
  // Tabs outside the extension's host access report no URL, which also
  // means they are not Shopify admin pages.
  if (isShopifyAdmin(url)) {
    state.sawShopify = true;
  } else if (AUTO_CLOSE_OFF_SHOPIFY && state.sawShopify && !state.pinned) {
    window.close();
    return;
  }

  const jsonUrl = jsonUrlFor(url);
  state.tabId = tab ? tab.id : null;

  if (!jsonUrl) {
    state.jsonUrl = null;
    state.data = null;
    state.rawText = null;
    setUrl(null);
    setStatus("");
    if (isShopifyAdmin(url)) {
      showMessage(
        "No JSON view for this page",
        "Open a product, order, or settings page to see its JSON."
      );
    } else {
      showMessage(
        "No Shopify admin page",
        "Open a Shopify admin product, order, or settings page in this tab."
      );
    }
    return;
  }

  if (!force && jsonUrl === state.jsonUrl && state.data !== null) return;
  await fetchAndRender(tab.id, jsonUrl);
}

async function fetchAndRender(tabId, jsonUrl) {
  const seq = ++state.seq;
  state.tabId = tabId;
  state.jsonUrl = jsonUrl;
  setUrl(jsonUrl);
  showLoading(jsonUrl);
  setStatus("");

  const res = await fetchJson(tabId, jsonUrl);
  if (seq !== state.seq) return; // a newer navigation won

  if (res.networkError) {
    state.data = null;
    showMessage("Request failed", res.networkError, true);
    setStatus(`via ${res.via}`);
    return;
  }

  if (res.finalUrl && /accounts\.shopify\.com|\/login/.test(res.finalUrl)) {
    state.data = null;
    showMessage("Signed out", "Shopify redirected to a login page. Sign in again, then press Refresh.", true);
    setStatus(`HTTP ${res.status} via ${res.via}`);
    return;
  }

  let data;
  try {
    data = JSON.parse(res.text);
  } catch (e) {
    state.data = null;
    let body = "This page does not have a JSON view.";
    if (res.status === 401 || res.status === 403) {
      body = "Shopify denied the request. You may not have permission to view this record.";
    } else if (res.status >= 500) {
      body = "Shopify returned a server error. Try Refresh.";
    }
    const code = document.createElement("code");
    code.textContent = jsonUrl;
    const frag = document.createDocumentFragment();
    frag.append(body, document.createElement("br"), code);
    showMessage(`No JSON (HTTP ${res.status})`, frag, true);
    setStatus(`HTTP ${res.status} · ${res.contentType || "unknown type"} · via ${res.via}`);
    return;
  }

  state.data = data;
  state.rawText = res.text;
  render();
  const time = new Date().toLocaleTimeString();
  setStatus(
    `HTTP ${res.status} · ${formatBytes(res.text.length)} · ${time}` +
      (res.status >= 400 ? " · error response" : "")
  );
}

function render() {
  const c = $("content");
  JsonTree.renderTree(c, state.data, copyText);
  setDataButtons(true);
  applySearch();
}

function applySearch() {
  const term = $("search").value;
  const n = JsonTree.filterTree($("content"), term);
  $("match-count").textContent = n < 0 ? "" : `${n} match${n === 1 ? "" : "es"}`;
}

async function syncActiveTab(force) {
  const [tab] = await chrome.tabs.query({ active: true, windowId: state.windowId });
  await load(tab || null, force);
}

function scheduleSync() {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => syncActiveTab(false), 250);
}

// ---------- Wiring ----------

async function init() {
  const win = await chrome.windows.getCurrent();
  state.windowId = win.id;

  chrome.tabs.onActivated.addListener(({ windowId }) => {
    if (windowId === state.windowId) scheduleSync();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.windowId !== state.windowId || !tab.active) return;
    // changeInfo.url fires for full loads and for Shopify's in-app
    // (history.pushState) navigation.
    if (changeInfo.url || changeInfo.status === "complete") scheduleSync();
  });

  $("json-url").addEventListener("click", (e) => {
    e.preventDefault();
    if (state.jsonUrl) chrome.tabs.create({ url: state.jsonUrl });
  });

  $("btn-refresh").addEventListener("click", () => {
    if (state.pinned && state.tabId != null && state.jsonUrl) {
      // Pinned: refetch the pinned record, not the page currently shown.
      fetchAndRender(state.tabId, state.jsonUrl);
    } else {
      syncActiveTab(true);
    }
  });

  $("btn-pin").addEventListener("click", () => {
    state.pinned = !state.pinned;
    $("btn-pin").classList.toggle("active", state.pinned);
    $("btn-pin").textContent = state.pinned ? "Unpin" : "Pin";
    $("pin-badge").hidden = !state.pinned;
    if (!state.pinned) syncActiveTab(false);
  });

  $("btn-expand").addEventListener("click", () => JsonTree.setAllOpen($("content"), true));
  $("btn-collapse").addEventListener("click", () => JsonTree.setAllOpen($("content"), false));
  $("btn-copy").addEventListener("click", () => {
    if (state.data !== null) copyText(JSON.stringify(state.data, null, 2), "JSON copied");
  });

  let searchTimer = null;
  $("search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 150);
  });

  setDataButtons(false);
  await syncActiveTab(false);
}

init();
