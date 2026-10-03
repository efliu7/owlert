import Dexie, { type EntityTable } from 'dexie';

export interface Course {
  id: string;
  name: string;
  url: string;
}

// Import only from extension contexts (side panel/background), not content scripts.
export const db = new Dexie('owlert') as Dexie & {
  courses: EntityTable<Course, 'id'>;
};

db.version(1).stores({ courses: 'id, name' });
