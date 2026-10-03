// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Course } from '../storage/db';
import { markChangesSeen, saveSyncedAssignments } from './changes';
import {
  saveCourseAssignments,
  updateCoursePreferences,
} from '../courses/preferences';
import { folderAssignments, performSync } from '../brightspace/sync';

const course: Course = {
  id: '123',
  name: 'Example course',
  url: 'https://westernu.brightspace.com/d2l/home/123',
};
const folder = (overrides = {}) => ({
  Id: 456,
  Name: 'Poster',
  DueDate: '2026-10-20T01:00:00Z',
  IsHidden: false,
  GroupTypeId: null,
  ...overrides,
});
const records = (overrides = {}, time = 100) =>
  folderAssignments(course.id, [folder(overrides)], time);
const response = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterAll(async () => {
  await db.delete();
});

describe('assignment change tracking', () => {
  it('migrates existing assignments and preferences without interpreting legacy labels as a baseline', async () => {
    await db.delete();
    const legacy = new Dexie('owlert');
    legacy.version(3).stores({
      courses: 'id, name',
      assignments: 'key, courseId',
      coursePreferences: 'courseId',
    });
    await legacy.open();
    await legacy.table('courses').put(course);
    await legacy
      .table('assignments')
      .put({ ...records()[0], dueAt: undefined, title: 'Old page title' });
    await legacy
      .table('coursePreferences')
      .put({ courseId: '123', color: '#a1b2c3', pinned: true, sortOrder: 2 });
    legacy.close();
    await db.open();
    expect((await db.coursePreferences.get('123'))!.color).toBe('#a1b2c3');
    expect((await db.assignments.get('123:456'))!.title).toBe('Old page title');
    await saveSyncedAssignments(course, records(), 100);
    expect(await db.assignmentChanges.count()).toBe(0);
    expect((await db.courseBaselines.get('123'))!.assignments[0]!.dueAt).toBe(
      '2026-10-20T01:00:00.000Z',
    );
  });
  it('treats an empty first successful sync as a baseline and only alerts on subsequent new assignments', async () => {
    await saveSyncedAssignments(course, [], 100);
    expect(await db.assignmentChanges.count()).toBe(0);
    await saveSyncedAssignments(course, records(), 200);
    expect(await db.assignmentChanges.toArray()).toMatchObject([
      {
        kind: 'new',
        before: null,
        after: { title: 'Poster' },
        detectedAt: 200,
        seenAt: null,
      },
    ]);
    await saveSyncedAssignments(course, records(), 300);
    expect(await db.assignmentChanges.count()).toBe(1);
  });
  it('normalizes equivalent timestamps and ignores formatting and locale label differences', async () => {
    await saveSyncedAssignments(course, records(), 100);
    const equivalent = records({ DueDate: '2026-10-19T21:00:00-04:00' }, 200);
    equivalent[0]!.dueLabel = 'A different displayed date format';
    await saveSyncedAssignments(course, equivalent, 200);
    expect(await db.assignmentChanges.count()).toBe(0);
  });
  it('records simultaneous rename and deadline changes with exact before/after values', async () => {
    await saveSyncedAssignments(course, records(), 100);
    await saveSyncedAssignments(
      course,
      records(
        { Name: 'Interview poster', DueDate: '2026-10-22T01:00:00Z' },
        200,
      ),
      200,
    );
    const changes = await db.assignmentChanges.toArray();
    expect(changes.map((change) => change.kind)).toEqual([
      'renamed',
      'deadline',
    ]);
    expect(changes[1]).toMatchObject({
      before: { title: 'Poster', dueAt: '2026-10-20T01:00:00.000Z' },
      after: { title: 'Interview poster', dueAt: '2026-10-22T01:00:00.000Z' },
      courseName: course.name,
    });
    await saveSyncedAssignments(
      course,
      records(
        { Name: 'Interview poster', DueDate: '2026-10-22T01:00:00Z' },
        300,
      ),
      300,
    );
    expect(await db.assignmentChanges.count()).toBe(2);
  });
  it('records deadline removal and addition without inferring a deadline from a page capture', async () => {
    await saveSyncedAssignments(course, records(), 100);
    const { dueAt: _due, ...page } = records()[0]!;
    await saveCourseAssignments(
      course,
      [{ ...page, title: 'A page title', dueLabel: null }],
      150,
    );
    expect((await db.assignments.get(page.key))!.dueAt).toBe(
      '2026-10-20T01:00:00.000Z',
    );
    expect(await db.assignmentChanges.count()).toBe(0);
    await saveSyncedAssignments(course, records({ DueDate: null }, 200), 200);
    await saveSyncedAssignments(course, records({}, 300), 300);
    expect(
      (await db.assignmentChanges.toArray()).map((change) => [
        change.before!.dueAt,
        change.after.dueAt,
      ]),
    ).toEqual([
      ['2026-10-20T01:00:00.000Z', null],
      [null, '2026-10-20T01:00:00.000Z'],
    ]);
  });
  it('keeps missing assignments without deletion alerts or spurious new alerts on reappearance', async () => {
    await saveSyncedAssignments(course, records(), 100);
    await saveSyncedAssignments(course, [], 200);
    expect(await db.assignments.count()).toBe(1);
    await saveSyncedAssignments(
      course,
      records({ Name: 'Updated poster' }, 300),
      300,
    );
    expect(
      (await db.assignmentChanges.toArray()).map((change) => change.kind),
    ).toEqual(['renamed']);
  });
  it('skips excluded courses without advancing their baseline', async () => {
    await saveSyncedAssignments(course, records(), 100);
    await updateCoursePreferences('123', { excluded: true });
    expect(
      await saveSyncedAssignments(
        course,
        records({ Name: 'Updated' }, 200),
        200,
      ),
    ).toBe(false);
    expect((await db.courseBaselines.get('123'))!.capturedAt).toBe(100);
    expect(await db.assignmentChanges.count()).toBe(0);
  });
  it('persists acknowledgements and preserves a later recurrence as a separate unseen change', async () => {
    await saveSyncedAssignments(course, records(), 100);
    await saveSyncedAssignments(course, records({ DueDate: null }, 200), 200);
    const change = (await db.assignmentChanges.toArray())[0]!;
    await markChangesSeen([change.id!]);
    const seenAt = (await db.assignmentChanges.get(change.id!))!.seenAt;
    await markChangesSeen([change.id!]);
    expect((await db.assignmentChanges.get(change.id!))!.seenAt).toBe(seenAt);
    db.close();
    await db.open();
    expect((await db.assignmentChanges.get(change.id!))!.seenAt).toBe(seenAt);
    await saveSyncedAssignments(course, records({}, 300), 300);
    expect((await db.assignmentChanges.toArray())[1]!.seenAt).toBeNull();
  });
  it('rolls back the baseline and assignments if change history cannot be written', async () => {
    await saveSyncedAssignments(course, records(), 100);
    const failingWrite = vi
      .spyOn(db.assignmentChanges, 'bulkAdd')
      .mockRejectedValueOnce(new Error('Database full'));
    await expect(
      saveSyncedAssignments(course, records({ Name: 'Updated' }, 200), 200),
    ).rejects.toThrow('Database full');
    failingWrite.mockRestore();
    expect((await db.courseBaselines.get('123'))!.capturedAt).toBe(100);
    expect((await db.assignments.get('123:456'))!.title).toBe('Poster');
    expect(await db.assignmentChanges.count()).toBe(0);
  });
  it('does not advance a failed course baseline while recording successful changes in another course', async () => {
    await saveSyncedAssignments(course, records(), 100);
    const other = { ...course, id: '999', name: 'Other course' };
    await saveSyncedAssignments(
      other,
      folderAssignments('999', [folder()], 100),
      100,
    );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response([
          { ProductCode: 'lp', LatestVersion: '1.63' },
          { ProductCode: 'le', LatestVersion: '1.99' },
        ]),
      )
      .mockResolvedValueOnce(
        response({
          Items: [course, other].map((item) => ({
            OrgUnit: { Id: Number(item.id), Name: item.name, Type: { Id: 3 } },
            Access: { IsActive: true, CanAccess: true },
          })),
          PagingInfo: { HasMoreItems: false },
        }),
      )
      .mockResolvedValueOnce(
        new Response('Failed', {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(response([folder({ Name: 'Updated other' })]));
    const result = await performSync(() => {}, fetcher);
    expect(result.courses).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect((await db.courseBaselines.get('123'))!.capturedAt).toBe(100);
    expect(await db.assignmentChanges.toArray()).toMatchObject([
      { courseId: '999', kind: 'renamed' },
    ]);
  });
  it('rejects malformed or duplicate API records instead of manufacturing deadline changes', () => {
    expect(() =>
      folderAssignments('123', [folder({ DueDate: undefined })], 100),
    ).toThrow();
    expect(() =>
      folderAssignments('123', [folder({ DueDate: 'not a date' })], 100),
    ).toThrow();
    expect(() => folderAssignments('123', [folder(), folder()], 100)).toThrow();
  });
});
