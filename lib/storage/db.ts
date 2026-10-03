import Dexie, { type EntityTable } from 'dexie';
import type { CapturedAssignment } from '../assignments/capture';

export interface Course {
  id: string;
  name: string;
  url: string;
  lastCapturedAt?: number;
}

export interface Assignment extends CapturedAssignment {
  key: string;
  courseId: string;
  capturedAt: number;
  dueAt?: string | null;
}

export interface SyncedAssignment extends Assignment {
  dueAt: string | null;
}

export interface AssignmentSnapshot {
  key: string;
  id: string;
  title: string;
  url: string;
  dueAt: string | null;
}

export interface CourseBaseline {
  courseId: string;
  capturedAt: number;
  assignments: AssignmentSnapshot[];
}

export interface AssignmentChange {
  id?: number;
  courseId: string;
  courseName: string;
  assignmentKey: string;
  kind: 'new' | 'renamed' | 'deadline';
  before: AssignmentSnapshot | null;
  after: AssignmentSnapshot;
  detectedAt: number;
  seenAt: number | null;
}

export interface CoursePreferences {
  courseId: string;
  color?: string;
  pinned?: boolean;
  excluded?: boolean;
  sortOrder?: number;
}

// Import only from extension contexts (side panel/background), not content scripts.
export const db = new Dexie('owlert') as Dexie & {
  courses: EntityTable<Course, 'id'>;
  assignments: EntityTable<Assignment, 'key'>;
  coursePreferences: EntityTable<CoursePreferences, 'courseId'>;
  courseBaselines: EntityTable<CourseBaseline, 'courseId'>;
  assignmentChanges: EntityTable<AssignmentChange, 'id'>;
};

db.version(1).stores({ courses: 'id, name' });
db.version(2).stores({
  courses: 'id, name',
  assignments: 'key, courseId',
});
db.version(3).stores({ coursePreferences: 'courseId' });
db.version(4).stores({
  courseBaselines: 'courseId',
  assignmentChanges: '++id, courseId, detectedAt',
});
