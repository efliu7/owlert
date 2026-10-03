import { db, type AssignmentChange } from '../storage/db';

export async function takeInAppChanges(
  courseIds: string[],
): Promise<AssignmentChange[]> {
  if (!courseIds.length) return [];
  return db.transaction(
    'rw',
    [db.assignmentChanges, db.coursePreferences, db.notificationSettings],
    async () => {
      if (
        (await db.notificationSettings.get('notifications'))
          ?.inAppNotifications === false
      )
        return [];
      const preferences = new Map(
        (await db.coursePreferences.toArray()).map((item) => [
          item.courseId,
          item,
        ]),
      );
      const changes = (
        await db.assignmentChanges.where('courseId').anyOf(courseIds).toArray()
      ).filter(
        (change) =>
          change.seenAt === null &&
          change.inAppNotifiedAt === undefined &&
          !preferences.get(change.courseId)?.excluded,
      );
      const shownAt = Date.now();
      for (const change of changes)
        await db.assignmentChanges.update(change.id!, {
          inAppNotifiedAt: shownAt,
        });
      return changes;
    },
  );
}
