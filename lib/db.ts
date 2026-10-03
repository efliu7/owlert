import Dexie, { type EntityTable } from 'dexie';
import type { CapturedAssignment } from './assignments';

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
};

db.version(1).stores({ courses: 'id, name' });
db.version(2).stores({
  courses: 'id, name',
  assignments: 'key, courseId',
});
db.version(3).stores({ coursePreferences: 'courseId' });
