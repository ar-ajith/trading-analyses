/**
 * Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AI Trader] Trading Chart Assistant installed.');
  
  // Set default settings
  chrome.storage.local.set({
    backendUrl: 'http://localhost:8000',
    defaultTimeframe: '15m',
    riskRewardMultiplier: 1.5,
    autoRefreshInterval: 10,
    notificationEnabled: true
  });
});

// Relay messages between tabs and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG' });
    return true;
  }
});

