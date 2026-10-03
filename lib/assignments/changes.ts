import {
  db,
  type AssignmentSnapshot,
  type Course,
  type SyncedAssignment,
  type AssignmentChange,
} from '../storage/db';
import { ensureCourseColors } from '../courses/preferences';

// Only complete, validated API responses call this function. Page captures never
// establish or alter this baseline, and missing assignments never imply deletion.
export async function saveSyncedAssignments(
  course: Course,
  assignments: SyncedAssignment[],
  capturedAt: number,
): Promise<boolean> {
  return db.transaction(
    'rw',
    [
      db.courses,
      db.assignments,
      db.coursePreferences,
      db.courseBaselines,
      db.assignmentChanges,
    ],
    async () => {
      if ((await db.coursePreferences.get(course.id))?.excluded) return false;
      const baseline = await db.courseBaselines.get(course.id);
      const previous = new Map(
        baseline?.assignments.map((item) => [item.key, item]),
      );
      const changes: AssignmentChange[] = [];
      for (const assignment of assignments) {
        const after: AssignmentSnapshot = {
          key: assignment.key,
          id: assignment.id,
          title: assignment.title,
          url: assignment.url,
          dueAt: assignment.dueAt,
        };
        const before = previous.get(assignment.key) ?? null;
        const add = (kind: AssignmentChange['kind']) =>
          changes.push({
            courseId: course.id,
            courseName: course.name,
            assignmentKey: assignment.key,
            kind,
            before,
            after,
            detectedAt: capturedAt,
            seenAt: null,
          });
        if (baseline) {
          if (!before) add('new');
          else {
            if (before.title !== after.title) add('renamed');
            if (before.dueAt !== after.dueAt) add('deadline');
          }
        }
        previous.set(assignment.key, after);
      }
      await db.courses.put({ ...course, lastCapturedAt: capturedAt });
      await ensureCourseColors();
      await db.assignments.bulkPut(assignments);
      await db.courseBaselines.put({
        courseId: course.id,
        capturedAt,
        assignments: [...previous.values()],
      });
      if (changes.length) await db.assignmentChanges.bulkAdd(changes);
      return true;
    },
  );
}

export async function markChangesSeen(ids: number[]): Promise<void> {
  await db.transaction('rw', db.assignmentChanges, async () => {
    const seenAt = Date.now();
    await db.assignmentChanges
      .where('id')
      .anyOf(ids)
      .modify((change) => {
        if (change.seenAt === null) change.seenAt = seenAt;
      });
  });
}
