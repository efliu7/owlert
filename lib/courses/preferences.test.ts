// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Course } from '../storage/db';
import {
  saveCourseAssignments,
  sortCourses,
  updateCoursePreferences,
  reorderCourse,
  ensureCourseColors,
} from './preferences';
import { performSync } from '../brightspace/sync';

const course: Course = {
  id: '123',
  name: 'Example course',
  url: 'https://westernu.brightspace.com/d2l/home/123',
};
const assignment = {
  key: '123:456',
  id: '456',
  courseId: '123',
  title: 'Example assignment',
  url: 'https://westernu.brightspace.com/d2l/lms/dropbox/user/folder_submit_files.d2l?db=456&ou=123',
  dueLabel: null,
  capturedAt: 100,
};
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

describe('course preferences', () => {
  it('backfills distinct defaults beyond the swatches while preserving preferences and reload stability', async () => {
    await db.courses.bulkPut(
      Array.from({ length: 20 }, (_, index) => ({
        ...course,
        id: String(index),
      })),
    );
    await updateCoursePreferences('0', { color: '#1D4ED8', pinned: true });
    await updateCoursePreferences('1', { excluded: true, sortOrder: 7 });
    await Promise.all([ensureCourseColors(), ensureCourseColors()]);
    const saved = await db.coursePreferences.toArray();
    expect(saved).toHaveLength(20);
    expect(new Set(saved.map((item) => item.color!.toLowerCase())).size).toBe(
      20,
    );
    expect(saved.every((item) => /^#[0-9a-f]{6}$/i.test(item.color!))).toBe(
      true,
    );
    expect(await db.coursePreferences.get('0')).toEqual({
      courseId: '0',
      color: '#1D4ED8',
      pinned: true,
    });
    expect(await db.coursePreferences.get('1')).toMatchObject({
      excluded: true,
      sortOrder: 7,
    });
    db.close();
    await db.open();
    await ensureCourseColors();
    expect(await db.coursePreferences.toArray()).toEqual(saved);
    await saveCourseAssignments({ ...course, id: 'new' }, [], 200);
    const added = await db.coursePreferences.get('new');
    expect(added?.color).toBeDefined();
    expect(
      saved.some((item) => item.color!.toLowerCase() === added!.color),
    ).toBe(false);
    for (const item of saved) {
      expect(await db.coursePreferences.get(item.courseId)).toEqual(item);
    }
  });
  it('persists a dragged order alongside colors and pins through database reopening and capture', async () => {
    const courses = [
      { ...course, id: '1', name: 'Alpha' },
      { ...course, id: '2', name: 'Beta' },
      { ...course, id: '3', name: 'Gamma' },
    ];
    await db.courses.bulkPut(courses);
    await updateCoursePreferences('2', { color: '#a1b2c3', pinned: false });
    await reorderCourse('2', '1', 'before');
    await saveCourseAssignments(courses[1]!, [], 200);
    db.close();
    await db.open();
    expect(
      sortCourses(
        await db.courses.toArray(),
        await db.coursePreferences.toArray(),
      ).map((c) => c.id),
    ).toEqual(['2', '1', '3']);
    expect(await db.coursePreferences.get('2')).toMatchObject({
      color: '#a1b2c3',
      pinned: false,
      sortOrder: 0,
    });
    await updateCoursePreferences('2', { pinned: true });
    expect((await db.coursePreferences.get('2'))!.sortOrder).toBe(0);
  });
  it('reorders within pinned groups without changing pins or excluded-course preferences', async () => {
    await db.courses.bulkPut([
      { ...course, id: '1', name: 'Alpha' },
      { ...course, id: '2', name: 'Beta' },
      { ...course, id: '3', name: 'Gamma' },
    ]);
    await updateCoursePreferences('1', { pinned: true });
    await updateCoursePreferences('2', { pinned: true, excluded: true });
    await reorderCourse('1', '2', 'after');
    expect(
      sortCourses(
        await db.courses.toArray(),
        await db.coursePreferences.toArray(),
      ).map((c) => c.id),
    ).toEqual(['2', '1', '3']);
    await reorderCourse('3', '2', 'before');
    expect(
      sortCourses(
        await db.courses.toArray(),
        await db.coursePreferences.toArray(),
      ).map((c) => c.id),
    ).toEqual(['2', '1', '3']);
    expect(await db.coursePreferences.get('2')).toMatchObject({
      pinned: true,
      excluded: true,
    });
  });
  it('keeps colors and pins across preference changes, captures and database reopening', async () => {
    await updateCoursePreferences('123', { color: '#0f766e', pinned: true });
    await updateCoursePreferences('123', { excluded: false });
    await saveCourseAssignments(course, [assignment], 100);
    db.close();
    await db.open();
    expect(await db.coursePreferences.get('123')).toEqual({
      courseId: '123',
      color: '#0f766e',
      pinned: true,
      excluded: false,
    });
    expect(await db.assignments.count()).toBe(1);
  });
  it('skips capture for excluded courses and keeps saved records available for restoration', async () => {
    await saveCourseAssignments(course, [assignment], 100);
    await updateCoursePreferences('123', { excluded: true });
    expect(
      await saveCourseAssignments(
        course,
        [{ ...assignment, title: 'Changed' }],
        200,
      ),
    ).toBe(false);
    expect((await db.assignments.get('123:456'))!.title).toBe(
      'Example assignment',
    );
    expect((await db.courses.get('123'))!.lastCapturedAt).toBe(100);
    await updateCoursePreferences('123', { excluded: false });
    expect(
      await saveCourseAssignments(
        course,
        [{ ...assignment, title: 'Changed' }],
        200,
      ),
    ).toBe(true);
  });
  it('does not request assignments for excluded courses during sync', async () => {
    await updateCoursePreferences('123', { excluded: true, pinned: true });
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
          Items: [
            {
              OrgUnit: { Id: 123, Name: 'Example course', Type: { Id: 3 } },
              Access: { CanAccess: true, IsActive: true },
            },
          ],
          PagingInfo: { HasMoreItems: false },
        }),
      );
    expect(await performSync(() => {}, fetcher)).toMatchObject({
      skipped: 1,
      courses: 0,
      assignments: 0,
      failures: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await db.courses.get('123')).toBeDefined();
    expect((await db.coursePreferences.get('123'))!.color).toMatch(
      /^#[0-9a-f]{6}$/,
    );
    expect((await db.coursePreferences.get('123'))!.pinned).toBe(true);
  });
  it('rejects a fetched update if the course was excluded while the request was running', async () => {
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
          Items: [
            {
              OrgUnit: { Id: 123, Name: 'Example course', Type: { Id: 3 } },
              Access: { CanAccess: true, IsActive: true },
            },
          ],
          PagingInfo: { HasMoreItems: false },
        }),
      )
      .mockImplementationOnce(async () => {
        await updateCoursePreferences('123', { excluded: true });
        return response([
          {
            Id: 456,
            Name: 'Example assignment',
            DueDate: null,
            IsHidden: false,
            GroupTypeId: null,
          },
        ]);
      });
    expect(await performSync(() => {}, fetcher)).toMatchObject({
      skipped: 1,
      assignments: 0,
    });
    expect(await db.assignments.count()).toBe(0);
  });
  it('puts pinned courses first, sorts each group by name, and does not mutate input', () => {
    const courses = [
      { ...course, id: '1', name: 'Zulu' },
      { ...course, id: '2', name: 'Alpha' },
      { ...course, id: '3', name: 'Beta' },
    ];
    expect(
      sortCourses(courses, [{ courseId: '1', pinned: true }]).map((c) => c.id),
    ).toEqual(['1', '2', '3']);
    expect(courses.map((c) => c.id)).toEqual(['1', '2', '3']);
  });
});
