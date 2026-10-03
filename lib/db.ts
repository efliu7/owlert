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

// Import only from extension contexts (side panel/background), not content scripts.
export const db = new Dexie('owlert') as Dexie & {
  courses: EntityTable<Course, 'id'>;
  assignments: EntityTable<Assignment, 'key'>;
};

db.version(1).stores({ courses: 'id, name' });
db.version(2).stores({
  courses: 'id, name',
  assignments: 'key, courseId',
});
