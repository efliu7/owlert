import type {
  Assignment,
  Course,
  CoursePreferences,
} from '../../lib/storage/db';
import styles from './App.module.css';

export default function Upcoming({
  assignments,
  courses,
  preferences,
  onBrowse,
}: {
  assignments: Assignment[];
  courses: Course[];
  preferences: Map<string, CoursePreferences>;
  onBrowse: () => void;
}) {
  const now = Date.now();
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const upcoming = assignments
    .filter(
      (item) =>
        courseMap.has(item.courseId) &&
        item.dueAt &&
        new Date(item.dueAt).getTime() >= now,
    )
    .sort(
      (a, b) =>
        Date.parse(a.dueAt!) - Date.parse(b.dueAt!) ||
        a.title.localeCompare(b.title),
    );
  const undated = assignments.filter(
    (item) => courseMap.has(item.courseId) && !item.dueAt,
  ).length;
  return (
    <div className={styles.upcoming}>
      <div className={styles.listHeading}>
        <h2>Upcoming deadlines</h2>
        <span>{upcoming.length}</span>
      </div>
      {upcoming.length ? (
        <ul className={styles.upcomingList}>
          {upcoming.map((item) => {
            const due = new Date(item.dueAt!);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const afterTomorrow = new Date(tomorrow);
            afterTomorrow.setDate(afterTomorrow.getDate() + 1);
            const day =
              due < tomorrow
                ? 'Today'
                : due < afterTomorrow
                  ? 'Tomorrow'
                  : due.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      ...(due.getFullYear() !== today.getFullYear()
                        ? { year: 'numeric' }
                        : {}),
                    });
            return (
              <li key={item.key} className={styles.upcomingItem}>
                <span
                  className={styles.upcomingDot}
                  style={{
                    background:
                      preferences.get(item.courseId)?.color ?? '#4f2683',
                  }}
                  aria-hidden="true"
                />
                <div className={styles.upcomingText}>
                  <p>{courseMap.get(item.courseId)!.name}</p>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                  <time
                    dateTime={item.dueAt!}
                    title={due.toLocaleString(undefined, {
                      timeZoneName: 'short',
                    })}
                  >
                    {day} ·{' '}
                    {due.toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.quietEmpty}>No upcoming deadlines found.</p>
      )}
      {undated > 0 && (
        <button type="button" className={styles.textButton} onClick={onBrowse}>
          {undated} {undated === 1 ? 'assignment has' : 'assignments have'} no
          synced date · View courses
        </button>
      )}
    </div>
  );
}
