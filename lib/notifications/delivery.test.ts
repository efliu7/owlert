// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type AssignmentChange } from '../storage/db';
import { takeInAppChanges } from './in-app';
import {
  deliverChangeNotification,
  notificationContent,
  type NotificationClient,
} from './delivery';

const snapshot = {
  key: '123:456',
  id: '456',
  title: 'Poster',
  url: 'https://westernu.brightspace.com/d2l/home/123',
  dueAt: null,
};
const change = (patch: Partial<AssignmentChange> = {}): AssignmentChange => ({
  courseId: '123',
  courseName: 'Ethics',
  assignmentKey: snapshot.key,
  kind: 'new',
  before: null,
  after: snapshot,
  detectedAt: 100,
  seenAt: null,
  ...patch,
});
const client = () => ({
  permission: vi.fn(async () => true),
  create: vi.fn<NotificationClient['create']>(async () => {}),
});
beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.notificationSettings.put({
    id: 'notifications',
    changeNotifications: true,
  });
});
afterAll(async () => {
  await db.delete();
});

describe('change notification delivery', () => {
  it('shows in-window alerts independently of desktop delivery and remembers them across reloads', async () => {
    await db.notificationSettings.put({
      id: 'notifications',
      changeNotifications: false,
    });
    await db.assignmentChanges.bulkAdd([
      change(),
      change({ seenAt: 200 }),
      change({ courseId: '999' }),
      change({ courseId: '777' }),
    ]);
    await db.coursePreferences.put({ courseId: '999', excluded: true });
    expect(await takeInAppChanges(['123', '999'])).toHaveLength(1);
    const stored = (await db.assignmentChanges.toArray())[0]!;
    expect(stored.seenAt).toBeNull();
    expect(stored.notificationBatchId).toBeUndefined();
    expect(stored.inAppNotifiedAt).toBeTypeOf('number');
    db.close();
    await db.open();
    expect(await takeInAppChanges(['123', '999'])).toHaveLength(0);
  });
  it('respects the in-window toggle and prevents overlapping panels from showing the same alert', async () => {
    await db.assignmentChanges.add(change());
    await db.notificationSettings.put({
      id: 'notifications',
      changeNotifications: true,
      inAppNotifications: false,
    });
    expect(await takeInAppChanges(['123'])).toHaveLength(0);
    await db.notificationSettings.update('notifications', {
      inAppNotifications: true,
    });
    const results = await Promise.all([
      takeInAppChanges(['123']),
      takeInAppChanges(['123']),
    ]);
    expect(results.flat()).toHaveLength(1);
  });
  it('does not contact Chrome when notifications are disabled, and does not claim changes when Chrome blocks them', async () => {
    await db.assignmentChanges.add(change());
    const api = client();
    await db.notificationSettings.put({
      id: 'notifications',
      changeNotifications: false,
    });
    await deliverChangeNotification(['123'], api);
    expect(api.permission).not.toHaveBeenCalled();
    await db.notificationSettings.put({
      id: 'notifications',
      changeNotifications: true,
    });
    api.permission.mockResolvedValue(false);
    await deliverChangeNotification(['123'], api);
    expect(api.create).not.toHaveBeenCalled();
    expect(
      (await db.assignmentChanges.toArray())[0]!.notificationBatchId,
    ).toBeUndefined();
  });
  it('batches unseen changes while excluding acknowledged, excluded, previously delivered and failed-course events', async () => {
    await db.assignmentChanges.bulkAdd([
      change(),
      change({ kind: 'renamed', before: snapshot }),
      change({ seenAt: 200 }),
      change({ notificationBatchId: 'old', notifiedAt: 200 }),
      change({ courseId: '999' }),
      change({ courseId: '777' }),
    ]);
    await db.coursePreferences.put({ courseId: '999', excluded: true });
    const api = client();
    await deliverChangeNotification(['123', '999'], api);
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.create.mock.calls[0]![1].title).toBe('2 assignment changes');
    expect(
      (await db.assignmentChanges.toArray()).filter(
        (row) => row.notificationBatchId && row.notificationBatchId !== 'old',
      ),
    ).toHaveLength(2);
    expect(
      (await db.assignmentChanges.toArray()).filter(
        (row) => row.notifiedAt !== undefined,
      ),
    ).toHaveLength(3);
  });
  it('does not resend after database reopening or toggling notifications off and on', async () => {
    await db.assignmentChanges.add(change());
    const api = client();
    await deliverChangeNotification(['123'], api);
    db.close();
    await db.open();
    await deliverChangeNotification(['123'], api);
    await db.notificationSettings.put({
      id: 'notifications',
      changeNotifications: false,
    });
    await deliverChangeNotification(['123'], api);
    await db.notificationSettings.put({
      id: 'notifications',
      changeNotifications: true,
    });
    await deliverChangeNotification(['123'], api);
    expect(api.create).toHaveBeenCalledOnce();
    expect((await db.assignmentChanges.toArray())[0]!.seenAt).toBeNull();
  });
  it('releases a failed Chrome delivery for retry without losing the change feed', async () => {
    await db.assignmentChanges.add(change());
    const api = client();
    api.create.mockRejectedValueOnce(new Error('Delivery failed'));
    await expect(deliverChangeNotification(['123'], api)).rejects.toThrow(
      'Delivery failed',
    );
    expect(
      (await db.assignmentChanges.toArray())[0]!.notificationBatchId,
    ).toBeUndefined();
    await deliverChangeNotification(['123'], api);
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(await db.assignmentChanges.count()).toBe(1);
  });
  it('claims changes transactionally so overlapping deliveries cannot create duplicate popups', async () => {
    await db.assignmentChanges.add(change());
    const api = client();
    await Promise.all([
      deliverChangeNotification(['123'], api),
      deliverChangeNotification(['123'], api),
    ]);
    expect(api.create).toHaveBeenCalledOnce();
  });
  it('allows new events to be delivered after an earlier notification', async () => {
    await db.assignmentChanges.add(change());
    const api = client();
    await deliverChangeNotification(['123'], api);
    await db.assignmentChanges.add(change({ detectedAt: 200 }));
    await deliverChangeNotification(['123'], api);
    expect(api.create).toHaveBeenCalledTimes(2);
  });
  it('highlights deadline changes with old and new dates and includes the remaining batch count', () => {
    const content = notificationContent([
      change(),
      change({
        kind: 'deadline',
        before: snapshot,
        after: { ...snapshot, dueAt: '2026-10-20T01:00:00.000Z' },
      }),
    ]);
    expect(content.title).toBe('1 assignment deadline change');
    expect(content.message).toContain('Ethics — Poster');
    expect(content.message).toContain('No due date →');
    expect(content.message).toContain('+ 1 more change.');
  });
});
