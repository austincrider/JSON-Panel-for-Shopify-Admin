# JSON Panel for Shopify Admin

A Chrome extension that shows the JSON behind the Shopify admin page you're viewing, in a side panel that updates as you navigate.

Shopify admin pages for products, variants, orders, customers, and many settings return their underlying data when you add `.json` to the URL. This extension does that for you automatically and shows the result as a formatted, searchable tree, so you don't have to edit URLs and switch tabs.

It's built for people who work with Shopify data behind the scenes: integration and sync builders (iPaaS tools, ERPs, middleware), developers, and admins who need to check field names, IDs, and raw values.

> Not affiliated with or endorsed by Shopify. "Shopify" is a trademark of Shopify Inc.

## Features

- **Follows you around the admin.** The panel reloads when you open a different record, including Shopify's in-app navigation.
- **Collapsible JSON tree** with color-coded values, light and dark themes.
- **Copy anything:**
  - The copy icon on each row copies that value, or a whole object or array as formatted JSON.
  - Click a key to copy its path (for example `variant.sku` or `order.line_items[0].sku`), handy for field mappings.
  - **Copy JSON** copies the full document.
- **Filter** keys and values with a live match count.
- **Pin** a record to keep it in view while you look at another system in a different tab.
- **Auto-close** when you leave Shopify admin (unless a record is pinned).
- **Keyboard shortcut:** Alt+Shift+J (Option+Shift+J on Mac) opens the panel.
- **Open raw JSON** in a new tab from the link at the top of the panel.

## Install

The extension isn't in the Chrome Web Store yet. Install it from this repository:

1. Download the code: click **Code > Download ZIP** on this page and unzip it, or clone the repository.
2. Move the folder somewhere permanent, such as Documents. Chrome loads the extension from this folder, so moving or deleting it breaks the extension.
3. In Chrome, go to `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the **`extension`** folder inside the repository (the one that contains `manifest.json`).
5. Click the puzzle-piece icon in the toolbar and pin **JSON Panel for Shopify Admin**.

Chrome may show a warning about developer mode extensions at startup. You can dismiss it.

> If your Chrome is managed by your organization, Developer mode may be turned off by policy. Ask your IT team.

### Update to a new version

Replace the contents of the folder with the new version (or run `git pull`), then click the reload arrow on the extension's card in `chrome://extensions`.

## Usage

1. Open any Shopify admin page, such as a product or order.
2. Click the extension's toolbar icon or press Alt+Shift+J. The panel opens on the right.
3. Browse normally. The panel updates as you move between records.

| Control | What it does |
|---|---|
| URL link (top) | Opens the raw `.json` in a new tab |
| Refresh | Fetches the JSON again (use after saving changes in Shopify) |
| Pin / Unpin | Keeps the current record in view while you browse elsewhere |
| Expand / Collapse | Opens or closes every section |
| Copy JSON | Copies the full document, formatted |
| Filter box | Shows only keys or values containing the text |
| Copy icon (each row) | Copies the value, or the object or array as formatted JSON |
| Click a key | Copies its path |
| Click a value | Copies the value |

The status bar at the bottom shows the HTTP status, response size, and time of the last fetch.

To change the shortcut, go to `chrome://extensions/shortcuts`. To keep the panel open when you leave Shopify, set `AUTO_CLOSE_OFF_SHOPIFY = false` at the top of `extension/sidepanel.js` and reload the extension.

## How it works

- The JSON URL is the page's origin and path plus `.json`. Query strings, `#` fragments, and trailing slashes are dropped. For example, `.../products/123?link_source=search` becomes `.../products/123.json`.
- The request runs inside your Shopify tab, so it uses your existing Shopify login. There are no API keys or tokens to set up.
- Works on `admin.shopify.com/store/<store>/...` and `<store>.myshopify.com/admin/...`.

## Privacy and permissions

The extension only reads data. It makes GET requests to Shopify admin pages you can already see, and it never changes anything in Shopify. Nothing is collected, stored, or sent anywhere: the data stays in your browser.

| Permission | Why it's needed |
|---|---|
| `sidePanel` | To show the panel next to the page |
| `scripting` | To run the `.json` request inside your Shopify tab so it uses your existing login |
| Host access to `admin.shopify.com` and `*.myshopify.com` | To read the JSON for the page you're on. No other sites. |

The extension has no remote code, analytics, or external services.

## Limitations

- Shopify's `.json` admin URLs are a long-standing but undocumented feature. Shopify could change or remove them at any time.
- Some admin pages have no JSON view, including most embedded app pages. The panel says so when that happens.
- Very large responses (thousands of fields) take longer to display. Filtering still works.

## Project structure

```
extension/
  manifest.json    Extension manifest (Manifest V3)
  background.js    Opens the side panel from the toolbar icon or shortcut
  sidepanel.html   Panel layout
  sidepanel.css    Panel styles (light and dark)
  sidepanel.js     Tracks the active tab, fetches and displays the JSON
  jsontree.js      JSON tree rendering, copy buttons, filtering
  url.js           Builds the .json URL and detects Shopify admin pages
  icons/           Toolbar and store icons
```

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
