// Clicking the toolbar icon (or pressing the Alt+Shift+J shortcut, which
// triggers the same action) opens the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("setPanelBehavior failed:", err));
