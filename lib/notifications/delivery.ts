import { db, type AssignmentChange } from '../storage/db';

export const CHANGE_NOTIFICATION_ID = 'owlert-assignment-changes';
export interface NotificationClient {
  permission(): Promise<boolean>;
  create(
    id: string,
    content: { title: string; message: string },
  ): Promise<void>;
}

const shorten = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;
const date = (value: string | null) =>
  value === null
    ? 'No due date'
    : new Date(value).toLocaleString(undefined, { timeZoneName: 'short' });
export function notificationContent(changes: AssignmentChange[]) {
  const ordered = [...changes].sort(
    (a, b) =>
      Number(b.kind === 'deadline') - Number(a.kind === 'deadline') ||
      b.detectedAt - a.detectedAt,
  );
  const first = ordered[0]!;
  const deadlines = changes.filter(
    (change) => change.kind === 'deadline',
  ).length;
  const reason =
    first.kind === 'deadline'
      ? `Deadline: ${date(first.before!.dueAt)} → ${date(first.after.dueAt)}`
      : first.kind === 'renamed'
        ? `Renamed from ${shorten(first.before!.title, 60)}`
        : 'New assignment';
  return {
    title: deadlines
      ? `${deadlines} assignment deadline ${deadlines === 1 ? 'change' : 'changes'}`
      : `${changes.length} assignment ${changes.length === 1 ? 'change' : 'changes'}`,
    message: `${shorten(first.courseName, 60)} — ${shorten(first.after.title, 65)}\n${reason}${changes.length > 1 ? `\n+ ${changes.length - 1} more ${changes.length === 2 ? 'change' : 'changes'}.` : ''}\nClick to review in Owlert.`,
  };
}

// Claim events before calling Chrome so two panels or a restarted worker cannot
// repeatedly alert on the same events. A rejected API call releases the claim.
// A crash after claiming can miss a popup; the persistent feed remains available.
export async function deliverChangeNotification(
  courseIds: string[],
  client: NotificationClient,
): Promise<void> {
  if (
    !courseIds.length ||
    !(await db.notificationSettings.get('notifications'))
      ?.changeNotifications ||
    !(await client.permission())
  )
    return;
  const batchId = crypto.randomUUID();
  const changes = await db.transaction(
    'rw',
    [db.assignmentChanges, db.coursePreferences, db.notificationSettings],
    async () => {
      if (
        !(await db.notificationSettings.get('notifications'))
          ?.changeNotifications
      )
        return [];
      const preferences = new Map(
        (await db.coursePreferences.toArray()).map((item) => [
          item.courseId,
          item,
        ]),
      );
      const pending = (
        await db.assignmentChanges.where('courseId').anyOf(courseIds).toArray()
      ).filter(
        (change) =>
          change.seenAt === null &&
          !change.notificationBatchId &&
          !preferences.get(change.courseId)?.excluded,
      );
      for (const change of pending)
        await db.assignmentChanges.update(change.id!, {
          notificationBatchId: batchId,
        });
      return pending;
    },
  );
  if (!changes.length) return;
  try {
    await client.create(CHANGE_NOTIFICATION_ID, notificationContent(changes));
  } catch (error) {
    await db.assignmentChanges
      .where('id')
      .anyOf(changes.map((change) => change.id!))
      .modify((change) => {
        if (change.notificationBatchId === batchId)
          delete change.notificationBatchId;
      });
    throw error;
  }
  await db.assignmentChanges
    .where('id')
    .anyOf(changes.map((change) => change.id!))
    .modify((change) => {
      if (change.notificationBatchId === batchId)
        change.notifiedAt = Date.now();
    });
}
