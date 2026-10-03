import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  assignmentListCourseId,
  isAssignmentCapture,
} from '../lib/assignments';
import { db } from '../lib/db';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    void db
      .transaction('rw', db.courses, db.assignments, async () => {
        await db.courses.put({
          ...snapshot.course,
          lastCapturedAt: capturedAt,
        });
        await db.assignments.bulkPut(
          snapshot.assignments.map((item) => ({
            ...item,
            key: `${snapshot.course.id}:${item.id}`,
            courseId: snapshot.course.id,
            capturedAt,
          })),
        );
      })
      .then(
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
