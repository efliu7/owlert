import { useEffect, useState, type CSSProperties } from 'react';
import type { AssignmentChange } from '../../lib/storage/db';
import { courseTextColor } from '../../lib/ui/colors';
import Icon from './Icon';
import styles from './App.module.css';

const date = (value: string | null) =>
  value === null
    ? 'No due date'
    : new Date(value).toLocaleString(undefined, { timeZoneName: 'short' });
export default function ChangeToast({
  changes,
  color,
  onDismiss,
  onReview,
}: {
  changes: AssignmentChange[];
  color: string;
  onDismiss: () => void;
  onReview: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(onDismiss, 18000);
    return () => window.clearTimeout(timer);
  }, [hovered, focused, onDismiss]);
  const first = [...changes].sort(
    (a, b) => Number(b.kind === 'deadline') - Number(a.kind === 'deadline'),
  )[0]!;
  return (
    <aside
      className={styles.changeToast}
      style={
        {
          '--course-accent': color,
          '--course-ink': courseTextColor(color),
        } as CSSProperties
      }
      aria-label="Assignment update"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className={styles.toastHeading}>
        <span className={styles.toastIcon}>
          <Icon name="bell" />
        </span>
        <span>
          Course updates{' '}
          <span className={styles.toastCount}>{changes.length}</span>
        </span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Dismiss assignment update"
          onClick={() => {
            onDismiss();
            document
              .querySelector<HTMLButtonElement>('[aria-label="Sync courses"]')
              ?.focus();
          }}
        >
          <Icon name="close" />
        </button>
      </div>
      <div role="status" className={styles.toastContent}>
        <p className={styles.toastCourse}>{first.courseName}</p>
        <p className={styles.toastTitle}>{first.after.title}</p>
        <p className={styles.toastReason}>
          {first.kind === 'deadline'
            ? first.before!.dueAt === null
              ? 'Deadline added'
              : first.after.dueAt === null
                ? 'Deadline removed'
                : 'Deadline changed'
            : first.kind === 'renamed'
              ? 'Assignment renamed'
              : 'New assignment'}
        </p>
        {first.kind === 'deadline' ? (
          <div className={styles.toastDates}>
            <span>{date(first.before!.dueAt)}</span>
            <strong>{date(first.after.dueAt)}</strong>
          </div>
        ) : first.kind === 'renamed' ? (
          <p className={styles.toastPrevious}>
            Previously: {first.before!.title}
          </p>
        ) : null}
        {changes.length > 1 && (
          <p className={styles.toastMore}>
            And {changes.length - 1} more{' '}
            {changes.length === 2 ? 'change' : 'changes'}.
          </p>
        )}
      </div>
      <button type="button" className={styles.toastReview} onClick={onReview}>
        Review changes <span aria-hidden="true">→</span>
      </button>
    </aside>
  );
}
