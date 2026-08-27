import { StorageBridge } from './storage-bridge.js';
import { AuthManager } from './auth-manager.js';
import { OfflineQueue } from './offline-queue.js';
import { SyncManager } from './sync-manager.js';
import { NotificationManager } from './notification-manager.js';
import { MessageRouter } from './message-router.js';

const storage = new StorageBridge();
const auth = new AuthManager(storage);
const notifications = new NotificationManager();
const queue = new OfflineQueue(storage, auth);
const sync = new SyncManager(auth, queue, notifications);
const router = new MessageRouter(auth, queue, sync, notifications);

// MV3 service workers are non-persistent: a message can wake this worker from
// scratch, and chrome.runtime.onMessage fires immediately — before the async
// auth.init() below has read tokens back out of chrome.storage. Without this
// gate, a message handled during that window sees auth.tokens still null,
// which authenticatedRequest treats as "not logged in" and surfaces as a
// spurious, wake-triggered logout even though the real session in storage is
// intact. onInstalled/onStartup await the same promise instead of calling
// auth.init() a second time, so every entry point observes one ready signal.
const authReady = auth.init();

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    authReady.then(() => router.handle(message, sender, sendResponse));
    return true;
  }
);

chrome.runtime.onInstalled.addListener(async (details) => {
  await authReady;
  await notifications.init();
  await sync.init();
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await authReady;
  await notifications.init();
  await sync.init();
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const type = notificationId.split('-')[0];

  switch (type) {
    case 'watched':
    case 'ai':
    case 'saved':
      chrome.tabs.create({ url: `http://localhost:3000/vacancies` });
      break;
    case 'interview':
      chrome.tabs.create({ url: 'http://localhost:3000/applications' });
      break;
  }

  chrome.notifications.clear(notificationId);
});

authReady.then(() => {
  console.log('[CareerOS] Background service worker initialized');
});
