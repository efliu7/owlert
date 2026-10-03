import { BRIGHTSPACE_ORIGIN } from '../assignments/capture';
import { db, type SyncedAssignment, type Course } from '../storage/db';
import { saveSyncedAssignments } from '../assignments/changes';
import { ensureCourseColors } from '../courses/preferences';

type Fetch = typeof globalThis.fetch;
interface Version {
  ProductCode: string;
  LatestVersion: string;
}
interface Enrollment {
  OrgUnit: { Id: number; Name: string; Type: { Id: number } };
  Access: { IsActive: boolean; CanAccess: boolean };
}
interface EnrollmentPage {
  Items: Enrollment[];
  PagingInfo: { HasMoreItems: boolean; Bookmark: string | null };
}
export interface Folder {
  Id: number;
  Name: string;
  DueDate: string | null;
  IsHidden: boolean;
  GroupTypeId: number | null;
}
export interface SyncProgress {
  completed: number;
  total: number;
  courseName?: string;
}
export interface SyncResult {
  courses: number;
  assignments: number;
  failures: string[];
  skipped: number;
  syncedCourseIds: string[];
}

async function json<T>(path: string, fetcher: Fetch): Promise<T> {
  const response = await fetcher(`${BRIGHTSPACE_ORIGIN}${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
  });
  if (
    response.status === 401 ||
    response.status === 403 ||
    new URL(response.url || `${BRIGHTSPACE_ORIGIN}${path}`).origin !==
      BRIGHTSPACE_ORIGIN ||
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    throw new Error(
      'Open Western Brightspace, log in, then try syncing again.',
    );
  }
  if (!response.ok)
    throw new Error(
      `Brightspace request failed (${response.status}). Try again later.`,
    );
  return response.json() as Promise<T>;
}

export async function discoverCourses(
  fetcher: Fetch = fetch,
): Promise<{ courses: Course[]; le: string }> {
  const versions = await json<Version[]>('/d2l/api/versions/', fetcher);
  const lp = versions.find((item) => item.ProductCode === 'lp')?.LatestVersion;
  const le = versions.find((item) => item.ProductCode === 'le')?.LatestVersion;
  if (!lp || !le || !/^\d+\.\d+$/.test(lp) || !/^\d+\.\d+$/.test(le)) {
    throw new Error('Could not determine Brightspace API versions.');
  }
  const courses = new Map<string, Course>();
  const bookmarks = new Set<string>();
  let bookmark: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const query = new URLSearchParams({ orgUnitTypeId: '3' });
    if (bookmark) query.set('bookmark', bookmark);
    const page = await json<EnrollmentPage>(
      `/d2l/api/lp/${lp}/enrollments/myenrollments/?${query}`,
      fetcher,
    );
    if (!Array.isArray(page.Items) || !page.PagingInfo)
      throw new Error('Unexpected course list from Brightspace.');
    for (const item of page.Items) {
      if (
        !item.Access?.CanAccess ||
        !item.Access.IsActive ||
        item.OrgUnit?.Type?.Id !== 3
      )
        continue;
      const id = String(item.OrgUnit.Id);
      if (!/^\d+$/.test(id) || typeof item.OrgUnit.Name !== 'string') continue;
      courses.set(id, {
        id,
        name: item.OrgUnit.Name,
        url: `${BRIGHTSPACE_ORIGIN}/d2l/home/${id}`,
      });
    }
    if (!page.PagingInfo.HasMoreItems)
      return { courses: [...courses.values()], le };
    bookmark = page.PagingInfo.Bookmark;
    if (!bookmark || bookmarks.has(bookmark))
      throw new Error('Brightspace course pagination did not advance.');
    bookmarks.add(bookmark);
  }
  throw new Error('Brightspace returned too many course pages.');
}

export function folderAssignments(
  courseId: string,
  folders: Folder[],
  capturedAt: number,
): SyncedAssignment[] {
  if (!Array.isArray(folders))
    throw new Error('Unexpected assignments response.');
  const ids = new Set<number>();
  for (const folder of folders) {
    if (
      !folder ||
      !Number.isSafeInteger(folder.Id) ||
      folder.Id <= 0 ||
      ids.has(folder.Id) ||
      typeof folder.IsHidden !== 'boolean' ||
      (folder.DueDate !== null && typeof folder.DueDate !== 'string')
    ) {
      throw new Error('Unexpected assignment details from Brightspace.');
    }
    ids.add(folder.Id);
  }
  return folders
    .filter((folder) => !folder.IsHidden)
    .map((folder) => {
      const id = String(folder.Id);
      if (
        !/^\d+$/.test(id) ||
        typeof folder.Name !== 'string' ||
        !folder.Name.trim()
      ) {
        throw new Error('Unexpected assignment details from Brightspace.');
      }
      const due = folder.DueDate !== null ? new Date(folder.DueDate) : null;
      if (due && !Number.isFinite(due.getTime()))
        throw new Error('Unexpected due date from Brightspace.');
      return {
        key: `${courseId}:${id}`,
        id,
        courseId,
        title: folder.Name.trim(),
        capturedAt,
        dueAt: due ? due.toISOString() : null,
        // Group assignments require the user's group ID. Open the list to select the group safely.
        url:
          folder.GroupTypeId != null
            ? `${BRIGHTSPACE_ORIGIN}/d2l/lms/dropbox/user/folders_list.d2l?ou=${courseId}`
            : `${BRIGHTSPACE_ORIGIN}/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${id}&ou=${courseId}&grpid=0`,
        dueLabel: due
          ? `Due on ${due.toLocaleString(undefined, { timeZoneName: 'short' })}`
          : null,
      };
    });
}

let activeSync: Promise<SyncResult> | undefined;
export function syncCourses(
  onProgress: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  if (activeSync) return activeSync;
  activeSync = performSync(onProgress).finally(() => {
    activeSync = undefined;
  });
  return activeSync;
}

export async function performSync(
  onProgress: (progress: SyncProgress) => void,
  fetcher: Fetch = fetch,
): Promise<SyncResult> {
  onProgress({ completed: 0, total: 0 });
  const { courses, le } = await discoverCourses(fetcher);
  await db.transaction('rw', db.courses, db.coursePreferences, async () => {
    for (const course of courses) {
      const existing = await db.courses.get(course.id);
      await db.courses.put({ ...existing, ...course });
    }
    await ensureCourseColors();
  });
  const result: SyncResult = {
    courses: 0,
    assignments: 0,
    failures: [],
    skipped: 0,
    syncedCourseIds: [],
  };
  for (let index = 0; index < courses.length; index++) {
    const course = courses[index]!;
    onProgress({
      completed: index,
      total: courses.length,
      courseName: course.name,
    });
    try {
      if ((await db.coursePreferences.get(course.id))?.excluded) {
        result.skipped++;
        continue;
      }
      const folders = await json<Folder[]>(
        `/d2l/api/le/${le}/${course.id}/dropbox/folders/`,
        fetcher,
      );
      const capturedAt = Date.now();
      const assignments = folderAssignments(course.id, folders, capturedAt);
      if (!(await saveSyncedAssignments(course, assignments, capturedAt))) {
        result.skipped++;
        continue;
      }
      result.courses++;
      result.syncedCourseIds.push(course.id);
      result.assignments += assignments.length;
    } catch (error) {
      result.failures.push(
        `${course.name}: ${error instanceof Error ? error.message : 'Could not sync'}`,
      );
    }
  }
  onProgress({ completed: courses.length, total: courses.length });
  return result;
}
