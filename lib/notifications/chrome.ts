import { browser } from 'wxt/browser';
import { CHANGE_NOTIFICATION_ID, deliverChangeNotification } from './delivery';

let queue: Promise<void> = Promise.resolve();
export function notifyAfterSync(courseIds: string[]): Promise<void> {
  const task = queue.then(() =>
    deliverChangeNotification(courseIds, {
      permission: async () =>
        (await browser.notifications.getPermissionLevel()) === 'granted',
      create: async (id, content) => {
        await browser.notifications.create(id, {
          type: 'basic',
          iconUrl: browser.runtime.getURL('/notification.png'),
          ...content,
          silent: true,
          requireInteraction: false,
        });
      },
    }),
  );
  queue = task.catch(() => {});
  return task;
}

export function registerNotificationClicks() {
  browser.notifications.onClicked.addListener((id) => {
    if (id !== CHANGE_NOTIFICATION_ID) return;
    void browser.tabs
      .create({
        url: `${browser.runtime.getURL('/sidepanel.html')}#changes-heading`,
      })
      .then(() => browser.notifications.clear(id))
      .catch((error) =>
        console.error('Owlert could not open change details:', error),
      );
  });
}
