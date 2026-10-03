import { useState, type CSSProperties } from 'react';
import type { AssignmentChange, CoursePreferences } from '../../lib/storage/db';
import { markChangesSeen } from '../../lib/assignments/changes';
import { courseTextColor } from '../../lib/ui/colors';
import styles from './App.module.css';

function deadline(value: string | null) {
  return value === null
    ? 'No due date'
    : new Date(value).toLocaleString(undefined, { timeZoneName: 'short' });
}

export default function ChangeFeed({
  changes,
  preferences,
  trackedCourses,
  totalCourses,
}: {
  changes: AssignmentChange[];
  preferences: Map<string, CoursePreferences>;
  trackedCourses: number;
  totalCourses: number;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ordered = [...changes].sort(
    (a, b) => b.detectedAt - a.detectedAt || (b.id ?? 0) - (a.id ?? 0),
  );
  const unread = ordered.filter((change) => change.seenAt === null);
  const seen = ordered.filter((change) => change.seenAt !== null);
  async function acknowledge(items: AssignmentChange[]) {
    setSaving(true);
    setError('');
    try {
      await markChangesSeen(
        items.flatMap((item) => (item.id === undefined ? [] : [item.id])),
      );
    } catch {
      setError('Could not mark changes as seen. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  function list(items: AssignmentChange[]) {
    return (
      <ul className={styles.changeList}>
        {items.map((change) => {
          const color = preferences.get(change.courseId)?.color ?? '#4f2683';
          return (
            <li
              key={change.id}
              className={styles.changeItem}
              style={
                {
                  '--course-accent': color,
                  '--course-ink': courseTextColor(color),
                } as CSSProperties
              }
            >
              <p className={styles.changeCourse}>{change.courseName}</p>
              <a href={change.after.url} target="_blank" rel="noreferrer">
                {change.after.title}
              </a>
              <p className={styles.changeKind}>
                {change.kind === 'new'
                  ? 'New assignment'
                  : change.kind === 'renamed'
                    ? 'Assignment renamed'
                    : change.before?.dueAt === null
                      ? 'Deadline added'
                      : change.after.dueAt === null
                        ? 'Deadline removed'
                        : 'Deadline changed'}
              </p>
              {change.kind === 'renamed' && (
                <dl className={styles.changeValues}>
                  <dt>Previously</dt>
                  <dd>{change.before!.title}</dd>
                  <dt>Now</dt>
                  <dd>{change.after.title}</dd>
                </dl>
              )}
              {change.kind === 'deadline' && (
                <dl className={styles.changeValues}>
                  <dt>Previously</dt>
                  <dd>{deadline(change.before!.dueAt)}</dd>
                  <dt>Now</dt>
                  <dd>{deadline(change.after.dueAt)}</dd>
                </dl>
              )}
              {change.kind === 'new' && <p>{deadline(change.after.dueAt)}</p>}
              <div className={styles.changeFooter}>
                <time dateTime={new Date(change.detectedAt).toISOString()}>
                  Detected {new Date(change.detectedAt).toLocaleString()}
                </time>
                {change.seenAt === null && (
                  <button
                    type="button"
                    className={styles.seenButton}
                    disabled={saving}
                    aria-label={`Mark ${change.kind === 'deadline' ? 'deadline change' : change.kind === 'renamed' ? 'name change' : 'new assignment'} for ${change.after.title} as seen`}
                    onClick={() => {
                      void acknowledge([change]);
                    }}
                  >
                    Mark as seen
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <section className={styles.changeFeed} aria-labelledby="changes-heading">
      <div className={styles.changeHeading}>
        <h3 id="changes-heading">Since your last check</h3>
        {unread.length > 0 && (
          <button
            type="button"
            className={styles.seenButton}
            disabled={saving}
            onClick={() => {
              void acknowledge(unread);
            }}
          >
            Mark all as seen
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className={styles.changeStatus} role="status">
        {unread.length
          ? `${unread.length} unseen ${unread.length === 1 ? 'change' : 'changes'}.`
          : trackedCourses
            ? 'No unseen changes.'
            : 'Sync courses to start tracking changes.'}
      </p>
      {trackedCourses < totalCourses && (
        <p className={styles.changeHint}>
          The first successful sync for each course establishes its starting
          point. Tracking {trackedCourses} of {totalCourses} courses.
        </p>
      )}
      {unread.length > 0 && list(unread)}
      {seen.length > 0 && (
        <details className={styles.seenHistory}>
          <summary>Seen changes ({seen.length})</summary>
          {list(seen)}
        </details>
      )}
    </section>
  );
}
