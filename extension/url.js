// Builds the .json URL for a Shopify admin page.
// Rules: keep origin + path only (query string and #hash are dropped),
// strip trailing slashes, and do not double-append ".json".
(function (root) {
  function jsonUrlFor(rawUrl) {
    if (!rawUrl) return null;
    let u;
    try {
      u = new URL(rawUrl);
    } catch (e) {
      return null;
    }
    if (u.protocol !== "https:") return null;

    const path = u.pathname.replace(/\/+$/, "");

    if (u.hostname === "admin.shopify.com") {
      // Needs at least /store/<handle>/<something>
      if (!/^\/store\/[^/]+\/.+/.test(path)) return null;
    } else if (u.hostname.endsWith(".myshopify.com")) {
      if (!/^\/admin\/.+/.test(path)) return null;
    } else {
      return null;
    }

    if (path.endsWith(".json")) return u.origin + path;
    return u.origin + path + ".json";
  }

  // True for any Shopify admin page, including pages with no JSON view
  // (e.g. the admin home). Used to decide when the user has left Shopify.
  function isShopifyAdmin(rawUrl) {
    if (!rawUrl) return false;
    let u;
    try {
      u = new URL(rawUrl);
    } catch (e) {
      return false;
    }
    if (u.protocol !== "https:") return false;
    if (u.hostname === "admin.shopify.com") return /^\/store\/[^/]+/.test(u.pathname);
    if (u.hostname.endsWith(".myshopify.com")) return /^\/admin(\/|$)/.test(u.pathname);
    return false;
  }

  root.jsonUrlFor = jsonUrlFor;
  root.isShopifyAdmin = isShopifyAdmin;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { jsonUrlFor, isShopifyAdmin };
  }
})(typeof self !== "undefined" ? self : globalThis);
