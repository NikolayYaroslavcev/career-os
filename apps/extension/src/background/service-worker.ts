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

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    router.handle(message, sender, sendResponse);
    return true;
  }
);

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await auth.init();
    await notifications.init();
    await sync.init();
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    await auth.init();
    await notifications.init();
    await sync.init();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await auth.init();
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

auth.init().then(() => {
  console.log('[CareerOS] Background service worker initialized');
});
