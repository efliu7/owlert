import { db, type Course, type CoursePreferences, type Assignment } from './db';

export const COURSE_COLORS = [
  { name: 'Purple', value: '#4f2683' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Green', value: '#166534' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Amber', value: '#92400e' },
] as const;

export function sortCourses(
  courses: Course[],
  preferences: CoursePreferences[],
): Course[] {
  const prefs = new Map(preferences.map((item) => [item.courseId, item]));
  return [...courses].sort(
    (a, b) =>
      Number(!!prefs.get(b.id)?.pinned) - Number(!!prefs.get(a.id)?.pinned) ||
      (prefs.get(a.id)?.sortOrder ?? Infinity) -
        (prefs.get(b.id)?.sortOrder ?? Infinity) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}

export async function reorderCourse(
  sourceId: string,
  targetId: string,
  placement: 'before' | 'after',
): Promise<void> {
  if (sourceId === targetId) return;
  await db.transaction('rw', db.courses, db.coursePreferences, async () => {
    const [courses, preferences] = await Promise.all([
      db.courses.toArray(),
      db.coursePreferences.toArray(),
    ]);
    const prefs = new Map(preferences.map((item) => [item.courseId, item]));
    if (!!prefs.get(sourceId)?.pinned !== !!prefs.get(targetId)?.pinned) return;
    const ordered = sortCourses(courses, preferences);
    const sourceIndex = ordered.findIndex((course) => course.id === sourceId);
    if (sourceIndex < 0 || !ordered.some((course) => course.id === targetId))
      return;
    const [source] = ordered.splice(sourceIndex, 1);
    const targetIndex = ordered.findIndex((course) => course.id === targetId);
    ordered.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, source!);
    await db.coursePreferences.bulkPut(
      ordered.map((course, sortOrder) => ({
        ...prefs.get(course.id),
        courseId: course.id,
        sortOrder,
      })),
    );
  });
}

export async function updateCoursePreferences(
  courseId: string,
  patch: Omit<Partial<CoursePreferences>, 'courseId'>,
) {
  await db.transaction('rw', db.coursePreferences, async () => {
    const existing = await db.coursePreferences.get(courseId);
    await db.coursePreferences.put({ ...existing, ...patch, courseId });
  });
}

// Recheck exclusion inside the write transaction, including when it changed during a fetch.
export async function saveCourseAssignments(
  course: Course,
  assignments: Assignment[],
  capturedAt: number,
): Promise<boolean> {
  return db.transaction(
    'rw',
    db.courses,
    db.assignments,
    db.coursePreferences,
    async () => {
      if ((await db.coursePreferences.get(course.id))?.excluded) return false;
      await db.courses.put({ ...course, lastCapturedAt: capturedAt });
      await db.assignments.bulkPut(assignments);
      return true;
    },
  );
}
