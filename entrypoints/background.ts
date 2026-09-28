export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !/^https?:/.test(tab.url ?? '')) return;
    try {
      await browser.tabs.sendMessage(tab.id, { type: 'cssforge:toggle' });
    } catch {
      await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
    }
  });
});
