import styles from './App.module.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useState } from 'react';
import { syncCourses } from '../../lib/sync';

export default function App() {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  async function sync() {
    setSyncing(true);
    setSyncErrors([]);
    try {
      const result = await syncCourses((progress) => {
        setSyncStatus(
          progress.total
            ? `Syncing courses ${progress.completed}/${progress.total}…`
            : 'Finding your courses…',
        );
      });
      setSyncStatus(
        result.courses
          ? `Synced ${result.assignments} assignments across ${result.courses} courses.`
          : result.failures.length
            ? 'Sync could not complete.'
            : 'No accessible courses found.',
      );
      setSyncErrors(result.failures);
    } catch (error) {
      setSyncStatus('Sync could not complete.');
      setSyncErrors([
        error instanceof Error ? error.message : 'Please try again.',
      ]);
    } finally {
      setSyncing(false);
    }
  }
  const data = useLiveQuery(async () => {
    try {
      const [courses, assignments] = await Promise.all([
        db.courses.toArray(),
        db.assignments.toArray(),
      ]);
      return { courses, assignments, error: false };
    } catch {
      return { courses: [], assignments: [], error: true };
    }
  });
  return (
    <main className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.mark} aria-hidden="true">
          O
        </span>
        <div>
          <h1>Owlert</h1>
          <p>Your courses change. Stay ahead.</p>
        </div>
      </header>
      <section className={styles.card} aria-labelledby="welcome-heading">
        <span className={styles.badge}>Your course briefing</span>
        <h2 id="welcome-heading">Assignments</h2>
        <button
          className={styles.syncButton}
          disabled={syncing}
          onClick={() => {
            void sync();
          }}
        >
          {syncing ? 'Syncing…' : 'Sync courses'}
        </button>
        <p className={styles.syncStatus} role="status">
          {syncStatus ||
            'Log into Western Brightspace, then sync all accessible courses.'}
        </p>
        {syncErrors.length > 0 && (
          <div role="alert" className={styles.syncErrors}>
            <p>
              Some courses could not be updated. Saved assignments are still
              available.
            </p>
            <ul>
              {syncErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {!data ? (
          <p role="status">Loading saved assignments…</p>
        ) : data.error ? (
          <p role="alert">
            Could not open your local course database. Close and reopen Owlert
            to try again.
          </p>
        ) : data.courses.length === 0 ? (
          <>
            <p>
              Click Sync courses to collect your assignments without visiting
              each course.
            </p>
            <p className={styles.note}>
              You can also capture assignments by visiting an Assignments page.
            </p>
          </>
        ) : (
          <>
            <p>Saved on this device from your Brightspace courses.</p>
            <div className={styles.courses}>
              {data.courses.map((course) => {
                const assignments = data.assignments.filter(
                  (item) => item.courseId === course.id,
                );
                return (
                  <details
                    className={styles.course}
                    key={course.id}
                    aria-label={course.name}
                  >
                    <summary className={styles.courseSummary}>
                      <div className={styles.courseHeading}>
                        <h3>{course.name}</h3>
                        <span className={styles.courseCount}>
                          {assignments.length}{' '}
                          {assignments.length === 1
                            ? 'assignment'
                            : 'assignments'}
                        </span>
                      </div>
                      <svg
                        className={styles.chevron}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <div className={styles.courseBody}>
                      <div className={styles.courseMeta}>
                        <a href={course.url} target="_blank" rel="noreferrer">
                          Open course ↗
                        </a>
                        <p className={styles.timestamp}>
                          Last captured{' '}
                          {course.lastCapturedAt
                            ? new Date(course.lastCapturedAt).toLocaleString()
                            : 'unknown'}
                        </p>
                      </div>
                      {assignments.length === 0 ? (
                        <p className={styles.emptyCourse}>
                          No assignments found for this course.
                        </p>
                      ) : (
                        <ul className={styles.assignments}>
                          {assignments.map((item) => (
                            <li key={item.key}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {item.title}
                              </a>
                              <p
                                className={
                                  item.dueLabel
                                    ? styles.dueDate
                                    : styles.noDueDate
                                }
                              >
                                {item.dueLabel ?? 'No due date shown'}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
            <p className={styles.note}>
              Sync reads all assignments returned by Brightspace. Synced dates
              use your device’s timezone; page captures keep Brightspace’s
              displayed dates. Saved items remain until change tracking is
              added.
            </p>
          </>
        )}
      </section>
      <footer className={styles.footer}>
        Built for students. Stored on your device.
      </footer>
    </main>
  );
}
