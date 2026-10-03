import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  assignmentListCourseId,
  isAssignmentCapture,
} from '../lib/assignments/capture';
import { saveCourseAssignments } from '../lib/courses/preferences';
import { db } from '../lib/storage/db';
import {
  notifyAfterSync,
  registerNotificationClicks,
} from '../lib/notifications/chrome';

export default defineBackground(() => {
  registerNotificationClicks();
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'notifications:sync-complete') {
      const ids: unknown = message.courseIds;
      if (
        sender.url?.split(/[?#]/)[0] !==
          browser.runtime.getURL('/sidepanel.html') ||
        !Array.isArray(ids) ||
        ids.length > 1000 ||
        !ids.every((id) => typeof id === 'string' && /^\d+$/.test(id))
      ) {
        sendResponse({ ok: false, error: 'Invalid notification request' });
        return;
      }
      void notifyAfterSync(ids).then(
        () => sendResponse({ ok: true }),
        () =>
          sendResponse({
            ok: false,
            error:
              'Could not send change notifications. Your changes are saved in the feed.',
          }),
      );
      return true;
    }
    if (message?.type === 'courses:can-capture') {
      const courseId = sender.url ? assignmentListCourseId(sender.url) : null;
      if (!courseId) {
        sendResponse({ included: false });
        return;
      }
      void db.coursePreferences.get(courseId).then(
        (preferences) => sendResponse({ included: !preferences?.excluded }),
        () => sendResponse({ included: false }),
      );
      return true;
    }
    if (message?.type !== 'assignments:capture') return;
    const snapshot: unknown = message.snapshot;
    if (
      !sender.url ||
      !isAssignmentCapture(snapshot) ||
      assignmentListCourseId(sender.url) !== snapshot.course.id
    ) {
      sendResponse({ ok: false, error: 'Invalid assignment capture' });
      return;
    }
    const capturedAt = Date.now();
    void saveCourseAssignments(
      snapshot.course,
      snapshot.assignments.map((item) => ({
        ...item,
        key: `${snapshot.course.id}:${item.id}`,
        courseId: snapshot.course.id,
        capturedAt,
      })),
      capturedAt,
    ).then(
      () => sendResponse({ ok: true }),
      () =>
        sendResponse({
          ok: false,
          error: 'Could not save assignments locally',
        }),
    );
    return true;
  });
  void browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.error('Owlert could not enable the side panel:', error);
    });
});
