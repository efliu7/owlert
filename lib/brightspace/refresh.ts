import type { Course, CourseBaseline, CoursePreferences } from '../storage/db';

export function shouldRefreshOnOpen(
  courses: Course[],
  preferences: CoursePreferences[],
  baselines: CourseBaseline[],
  now = Date.now(),
): boolean {
  if (!courses.length) return true;
  const excluded = new Set(
    preferences.filter((item) => item.excluded).map((item) => item.courseId),
  );
  const lastSync = new Map(
    baselines.map((item) => [item.courseId, item.capturedAt]),
  );
  return courses.some(
    (course) =>
      !excluded.has(course.id) &&
      (!lastSync.has(course.id) ||
        now - lastSync.get(course.id)! >= 15 * 60 * 1000),
  );
}
