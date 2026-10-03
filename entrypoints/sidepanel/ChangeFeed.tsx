import { useEffect, useState, useRef, type CSSProperties } from 'react';
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
  notifications = false,
}: {
  changes: AssignmentChange[];
  preferences: Map<string, CoursePreferences>;
  trackedCourses: number;
  totalCourses: number;
  notifications?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!notifications && location.hash === '#changes-heading') {
      heading.current?.scrollIntoView();
      heading.current?.focus({ preventScroll: true });
    }
  }, [notifications]);
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
      setError(
        notifications
          ? 'Could not dismiss notifications. Please try again.'
          : 'Could not mark changes as seen. Please try again.',
      );
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
                    aria-label={
                      notifications
                        ? `Dismiss notification for ${change.after.title}`
                        : `Mark ${change.kind === 'deadline' ? 'deadline change' : change.kind === 'renamed' ? 'name change' : 'new assignment'} for ${change.after.title} as seen`
                    }
                    onClick={() => {
                      void acknowledge([change]);
                    }}
                  >
                    {notifications ? 'Dismiss' : 'Mark as seen'}
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
    <section
      className={styles.changeFeed}
      aria-labelledby={
        notifications ? 'notifications-heading' : 'changes-heading'
      }
    >
      <div className={styles.changeHeading}>
        <h3
          id={notifications ? 'notifications-heading' : 'changes-heading'}
          ref={heading}
          tabIndex={-1}
        >
          {notifications ? 'Missed updates' : 'Changes'}
        </h3>
        {unread.length > 0 && (
          <button
            type="button"
            className={styles.seenButton}
            disabled={saving}
            onClick={() => {
              void acknowledge(unread);
            }}
          >
            {notifications ? 'Dismiss all' : 'Mark all as seen'}
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className={styles.changeStatus} role="status">
        {notifications
          ? unread.length
            ? `${unread.length} pending ${unread.length === 1 ? 'notification' : 'notifications'}.`
            : 'You’re all caught up.'
          : unread.length
            ? `${unread.length} unseen ${unread.length === 1 ? 'change' : 'changes'}.`
            : trackedCourses
              ? 'No unseen changes.'
              : 'Sync courses to start tracking changes.'}
      </p>
      {!notifications && trackedCourses < totalCourses && (
        <p className={styles.changeHint}>
          Tracking {trackedCourses} of {totalCourses} courses. Sync to start
          tracking the rest.
        </p>
      )}
      {unread.length > 0 && list(unread)}
      {!notifications && seen.length > 0 && (
        <details className={styles.seenHistory}>
          <summary>Seen changes ({seen.length})</summary>
          {list(seen)}
        </details>
      )}
    </section>
  );
}
