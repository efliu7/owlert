export const BRIGHTSPACE_ORIGIN = 'https://westernu.brightspace.com';

export interface CapturedAssignment {
  id: string;
  title: string;
  url: string;
  dueLabel: string | null;
}

export interface AssignmentCapture {
  course: { id: string; name: string; url: string };
  assignments: CapturedAssignment[];
}

export function assignmentListCourseId(pageUrl: string): string | null {
  const url = new URL(pageUrl);
  const courseId = url.searchParams.get('ou');
  return url.origin === BRIGHTSPACE_ORIGIN &&
    url.pathname === '/d2l/lms/dropbox/user/folders_list.d2l' &&
    courseId &&
    /^\d+$/.test(courseId)
    ? courseId
    : null;
}

export function captureAssignments(
  document: Document,
  pageUrl: string,
): AssignmentCapture | null {
  const courseId = assignmentListCourseId(pageUrl);
  const table = document.querySelector('table.d2l-grid');
  if (!courseId || !table) return null;

  const assignments = new Map<string, CapturedAssignment>();
  for (const link of table.querySelectorAll<HTMLAnchorElement>('th a[href]')) {
    let url: URL;
    try {
      url = new URL(link.getAttribute('href')!, pageUrl);
    } catch {
      continue;
    }
    const id = url.searchParams.get('db');
    if (
      url.origin !== BRIGHTSPACE_ORIGIN ||
      url.pathname !== '/d2l/lms/dropbox/user/folder_submit_files.d2l' ||
      url.searchParams.get('ou') !== courseId ||
      !id ||
      !/^\d+$/.test(id)
    )
      continue;
    const title = link.textContent?.trim();
    if (!title || assignments.has(id)) continue;
    const row = link.closest('tr');
    const dueLabel =
      Array.from(row?.querySelectorAll('.d2l-dates-text') ?? [])
        .map((element) => element.textContent?.trim() ?? '')
        .find((text) => /^Due\b/i.test(text)) ?? null;
    assignments.set(id, { id, title, url: url.href, dueLabel });
  }

  return {
    course: {
      id: courseId,
      name:
        document.title
          .replace(/^Assignments\s*-\s*/, '')
          .replace(/\s*-\s*Western University$/, '')
          .trim() || `Course ${courseId}`,
      url: `${BRIGHTSPACE_ORIGIN}/d2l/home/${courseId}`,
    },
    assignments: [...assignments.values()],
  };
}

export function isAssignmentCapture(
  value: unknown,
): value is AssignmentCapture {
  if (!value || typeof value !== 'object') return false;
  const { course, assignments } = value as Partial<AssignmentCapture>;
  if (
    !course ||
    typeof course.id !== 'string' ||
    !/^\d+$/.test(course.id) ||
    typeof course.name !== 'string' ||
    course.url !== `${BRIGHTSPACE_ORIGIN}/d2l/home/${course.id}` ||
    !Array.isArray(assignments) ||
    assignments.length > 1000
  )
    return false;
  return assignments.every((item: CapturedAssignment) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !/^\d+$/.test(item.id) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      typeof item.url !== 'string' ||
      (item.dueLabel !== null && typeof item.dueLabel !== 'string')
    )
      return false;
    try {
      const url = new URL(item.url);
      return (
        url.origin === BRIGHTSPACE_ORIGIN &&
        url.pathname === '/d2l/lms/dropbox/user/folder_submit_files.d2l' &&
        url.searchParams.get('db') === item.id &&
        url.searchParams.get('ou') === course.id
      );
    } catch {
      return false;
    }
  });
}
