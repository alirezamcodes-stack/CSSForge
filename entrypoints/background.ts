import { supportedPage } from '../src/picker/supportedPage';

export default defineBackground(() => {
  const pending = new Set<number>();
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined || pending.has(tab.id)) return;
    const tabId = tab.id;
    pending.add(tabId);
    try {
      if (!supportedPage(tab.url ?? '')) throw new Error('Restricted page');
      try {
        await browser.tabs.sendMessage(tabId, { type: 'cssforge:toggle' });
      } catch {
        await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
      }
      await browser.action.setBadgeText({ tabId, text: '' });
      await browser.action.setTitle({ tabId, title: 'Toggle CSSForge' });
    } catch {
      // Per-tab feedback, including browser-rejected injections; no new permissions.
      await Promise.allSettled([
        browser.action.setBadgeText({ tabId, text: '!' }),
        browser.action.setBadgeBackgroundColor({ tabId, color: '#806531' }),
        browser.action.setTitle({ tabId, title: 'CSSForge is unavailable on this page. Open a normal webpage to inspect.' }),
      ]);
    } finally { pending.delete(tabId); }
  });
});
