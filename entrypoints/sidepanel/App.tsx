import styles from './App.module.css';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  type CoursePreferences,
  type AssignmentChange,
} from '../../lib/storage/db';
import { Fragment, useState, useRef, useEffect, useCallback } from 'react';
import { syncCourses } from '../../lib/brightspace/sync';
import {
  reorderCourse,
  sortCourses,
  updateCoursePreferences,
} from '../../lib/courses/preferences';
import CourseCard from './CourseCard';
import Icon from './Icon';
import ChangeFeed from './ChangeFeed';
import NotificationControls from './NotificationControls';
import { browser } from 'wxt/browser';
import { takeInAppChanges } from '../../lib/notifications/in-app';
import ChangeToast from './ChangeToast';
import Upcoming from './Upcoming';
import { shouldRefreshOnOpen } from '../../lib/brightspace/refresh';

export default function App() {
  const courseDialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<'upcoming' | 'courses' | 'changes'>(
    location.hash === '#changes-heading' ? 'changes' : 'upcoming',
  );
  const autoSyncAttempted = useRef(false);
  const [toast, setToast] = useState<AssignmentChange[] | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [notificationError, setNotificationError] = useState('');
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const [draggedCourse, setDraggedCourse] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    placement: 'before' | 'after';
  } | null>(null);
  const [reorderStatus, setReorderStatus] = useState('');
  function endDrag() {
    setDraggedCourse(null);
    setDropTarget(null);
  }
  async function moveCourse(
    sourceId: string,
    targetId: string,
    placement: 'before' | 'after',
  ) {
    endDrag();
    setSavingPreference(true);
    setPreferenceError('');
    try {
      await reorderCourse(sourceId, targetId, placement);
      setReorderStatus('Course order saved.');
    } catch {
      setPreferenceError('Could not save course order. Please try again.');
    } finally {
      setSavingPreference(false);
    }
  }
  async function updatePreferences(
    courseId: string,
    patch: Omit<Partial<CoursePreferences>, 'courseId'>,
  ) {
    setSavingPreference(true);
    setPreferenceError('');
    try {
      await updateCoursePreferences(courseId, patch);
    } catch {
      setPreferenceError(
        'Could not save course preferences. Please try again.',
      );
    } finally {
      setSavingPreference(false);
    }
  }
  async function sync() {
    setSyncing(true);
    setSyncErrors([]);
    setNotificationError('');
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
          ? `Synced ${result.assignments} assignments across ${result.courses} courses.${result.skipped ? ` Skipped ${result.skipped} excluded courses.` : ''}`
          : result.failures.length
            ? 'Sync could not complete.'
            : result.skipped
              ? 'No courses selected. Choose courses in Preferences.'
              : 'No accessible courses found.',
      );
      setSyncErrors(result.failures);
      if (result.syncedCourseIds.length) {
        try {
          const changes = await takeInAppChanges(result.syncedCourseIds);
          if (changes.length) setToast(changes);
        } catch {
          setNotificationError(
            'Could not show the update alert. Your changes are saved in the feed.',
          );
        }
        try {
          const response = await browser.runtime.sendMessage({
            type: 'notifications:sync-complete',
            courseIds: result.syncedCourseIds,
          });
          if (!response?.ok) throw new Error(response?.error);
        } catch {
          setNotificationError(
            'Change notifications could not be sent. Your changes are saved in the feed.',
          );
        }
      }
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
      const [
        courses,
        assignments,
        preferences,
        changes,
        baselines,
        notificationSettings,
      ] = await Promise.all([
        db.courses.toArray(),
        db.assignments.toArray(),
        db.coursePreferences.toArray(),
        db.assignmentChanges.toArray(),
        db.courseBaselines.toArray(),
        db.notificationSettings.get('notifications'),
      ]);
      return {
        courses,
        assignments,
        preferences,
        changes,
        baselines,
        notificationSettings,
        error: false,
      };
    } catch {
      return {
        courses: [],
        assignments: [],
        preferences: [],
        changes: [],
        baselines: [],
        notificationSettings: undefined,
        error: true,
      };
    }
  });
  useEffect(() => {
    if (data?.notificationSettings?.inAppNotifications === false)
      dismissToast();
  }, [data?.notificationSettings?.inAppNotifications, dismissToast]);
  const preferences = new Map(
    data?.preferences.map((item) => [item.courseId, item]),
  );
  const courses = sortCourses(data?.courses ?? [], data?.preferences ?? []);
  const includedCourses = courses.filter(
    (course) => !preferences.get(course.id)?.excluded,
  );
  const pinnedCount = includedCourses.filter(
    (course) => preferences.get(course.id)?.pinned,
  ).length;
  const unreadChanges =
    data?.changes.filter(
      (change) =>
        change.seenAt === null &&
        includedCourses.some((course) => course.id === change.courseId),
    ).length ?? 0;
  const latestSync = data?.baselines.length
    ? Math.max(...data.baselines.map((item) => item.capturedAt))
    : null;
  useEffect(() => {
    if (!data || data.error || autoSyncAttempted.current) return;
    autoSyncAttempted.current = true;
    if (shouldRefreshOnOpen(data.courses, data.preferences, data.baselines))
      void sync();
  }, [data]);
  return (
    <main className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            O
          </span>
          <h1>Owlert</h1>
        </div>
        <nav className={styles.headerActions} aria-label="Owlert controls">
          <button
            type="button"
            className={`${styles.iconButton} ${styles.headerSync} ${syncing ? styles.syncingIcon : ''}`}
            title={syncing ? 'Syncing courses…' : 'Sync courses'}
            aria-label="Sync courses"
            aria-busy={syncing}
            disabled={syncing}
            onClick={() => {
              void sync();
            }}
          >
            <Icon name="sync" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            title="Preferences"
            aria-label="Preferences"
            aria-haspopup="dialog"
            aria-controls="course-display"
            onClick={() => courseDialog.current?.showModal()}
          >
            <Icon name="settings" />
          </button>
        </nav>
      </header>
      <section className={styles.card} aria-labelledby="welcome-heading">
        <h2 id="welcome-heading" className={styles.srOnly}>
          Assignments
        </h2>
        {data && !data.error && courses.length > 0 && (
          <nav className={styles.viewNav} aria-label="Assignment views">
            <button
              type="button"
              aria-pressed={view === 'upcoming'}
              aria-controls="upcoming-view"
              onClick={() => setView('upcoming')}
            >
              Upcoming
            </button>
            <button
              type="button"
              aria-pressed={view === 'courses'}
              aria-controls="courses-view"
              onClick={() => setView('courses')}
            >
              Courses
            </button>
            <button
              type="button"
              aria-pressed={view === 'changes'}
              aria-controls="changes-view"
              onClick={() => setView('changes')}
            >
              Changes{' '}
              {unreadChanges > 0 && (
                <span className={styles.viewCount}>{unreadChanges}</span>
              )}
            </button>
          </nav>
        )}
        <p className={styles.syncStatus} role="status">
          {syncing
            ? syncStatus
            : syncErrors.length
              ? 'Sync needs attention'
              : latestSync
                ? `Updated ${new Date(latestSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                : syncStatus || 'Connecting to Brightspace…'}
        </p>
        {syncErrors.length > 0 && (
          <details className={styles.syncErrors}>
            <summary>
              Could not update{' '}
              {syncErrors.length === 1 ? 'a course' : 'some courses'} · Details
            </summary>
            <ul>
              {syncErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </details>
        )}
        {preferenceError && <p role="alert">{preferenceError}</p>}
        {notificationError && <p role="alert">{notificationError}</p>}
        {data && !data.error && includedCourses.length > 0 && (
          <div id="changes-view" hidden={view !== 'changes'}>
            <ChangeFeed
              changes={data.changes.filter((change) =>
                includedCourses.some((course) => course.id === change.courseId),
              )}
              preferences={preferences}
              trackedCourses={
                data.baselines.filter((baseline) =>
                  includedCourses.some(
                    (course) => course.id === baseline.courseId,
                  ),
                ).length
              }
              totalCourses={includedCourses.length}
            />
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
          <div className={styles.setup}>
            <h2>Your assignments, in one place.</h2>
            <p>
              Sign in to Western Brightspace. Owlert uses your existing session.
            </p>
            <button
              type="button"
              className={styles.syncButton}
              onClick={() => {
                void browser.tabs.create({
                  url: 'https://westernu.brightspace.com/',
                });
              }}
            >
              Open Brightspace
            </button>
            <button
              type="button"
              className={styles.textButton}
              disabled={syncing}
              onClick={() => {
                void sync();
              }}
            >
              {' '}
              {syncing ? 'Connecting…' : 'Already signed in? Sync now'}
            </button>
          </div>
        ) : (
          <>
            <div id="upcoming-view" hidden={view !== 'upcoming'}>
              <Upcoming
                assignments={data.assignments}
                courses={includedCourses}
                preferences={preferences}
                onBrowse={() => setView('courses')}
              />
            </div>
            {includedCourses.length === 0 && (
              <p className={styles.emptyCourse}>
                No courses selected. Choose courses in Preferences.
              </p>
            )}
            <div id="courses-view" hidden={view !== 'courses'}>
              <div className={styles.courses}>
                <p id="course-reorder-help" className={styles.srOnly}>
                  Hold and drag a course header to reorder it within its pinned
                  or unpinned group. With a header focused, press Alt and the Up
                  or Down arrow to move it.
                </p>
                <span className={styles.srOnly} role="status">
                  {reorderStatus}
                </span>
                {includedCourses.map((course, index) => (
                  <Fragment key={course.id}>
                    {pinnedCount > 0 &&
                      (index === 0 || index === pinnedCount) && (
                        <h3 className={styles.courseDivider}>
                          {index === 0 && <Icon name="pin" />}
                          {index === 0 ? 'Pinned courses' : 'Other courses'}
                        </h3>
                      )}
                    <CourseCard
                      course={course}
                      assignments={data.assignments.filter(
                        (item) => item.courseId === course.id,
                      )}
                      preferences={
                        preferences.get(course.id) ?? { courseId: course.id }
                      }
                      disabled={savingPreference}
                      dragging={draggedCourse === course.id}
                      dropPlacement={
                        dropTarget?.id === course.id
                          ? dropTarget.placement
                          : null
                      }
                      onDragStart={(event) => {
                        setDraggedCourse(course.id);
                        setReorderStatus('');
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', course.id);
                      }}
                      onDragEnd={endDrag}
                      onDragOver={(event) => {
                        if (
                          !draggedCourse ||
                          draggedCourse === course.id ||
                          !!preferences.get(draggedCourse)?.pinned !==
                            !!preferences.get(course.id)?.pinned
                        ) {
                          setDropTarget(null);
                          return;
                        }
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        const bounds =
                          event.currentTarget.getBoundingClientRect();
                        setDropTarget({
                          id: course.id,
                          placement:
                            event.clientY < bounds.top + bounds.height / 2
                              ? 'before'
                              : 'after',
                        });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (
                          !draggedCourse ||
                          dropTarget?.id !== course.id ||
                          savingPreference
                        ) {
                          endDrag();
                          return;
                        }
                        void moveCourse(
                          draggedCourse,
                          course.id,
                          dropTarget.placement,
                        );
                      }}
                      onMove={(direction) => {
                        if (savingPreference) return;
                        const group = includedCourses.filter(
                          (item) =>
                            !!preferences.get(item.id)?.pinned ===
                            !!preferences.get(course.id)?.pinned,
                        );
                        const target =
                          group[
                            group.findIndex((item) => item.id === course.id) +
                              direction
                          ];
                        if (target)
                          void moveCourse(
                            course.id,
                            target.id,
                            direction === -1 ? 'before' : 'after',
                          );
                      }}
                      onChange={(patch) => {
                        void updatePreferences(course.id, patch);
                      }}
                    />
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
      <dialog
        ref={courseDialog}
        id="course-display"
        className={styles.displayDialog}
        aria-labelledby="display-title"
      >
        <div className={styles.dialogHeader}>
          <h2 id="display-title">Preferences</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close preferences"
            onClick={() => courseDialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <h3 className={styles.preferenceHeading}>Alerts</h3>
        <NotificationControls />
        <details className={styles.coursePreferences}>
          <summary>Choose courses ({includedCourses.length} included)</summary>
          <p>Hidden courses keep their saved assignments.</p>
          {preferenceError && <p role="alert">{preferenceError}</p>}
          <div className={styles.displayList}>
            {courses.map((course) => (
              <label key={course.id} className={styles.displayRow}>
                <span
                  className={styles.colorDot}
                  style={{
                    background: preferences.get(course.id)?.color ?? '#4f2683',
                  }}
                  aria-hidden="true"
                />
                <span>{course.name}</span>
                <input
                  type="checkbox"
                  aria-label={`Include ${course.name}`}
                  disabled={savingPreference}
                  checked={!preferences.get(course.id)?.excluded}
                  onChange={(event) => {
                    void updatePreferences(course.id, {
                      excluded: !event.target.checked,
                    });
                  }}
                />
              </label>
            ))}
          </div>
        </details>
        <p className={styles.preferenceNote}>
          Saved on this device. Refreshes on open when data is older than 15
          minutes.
        </p>
      </dialog>
      {toast && (
        <ChangeToast
          changes={toast}
          color={
            preferences.get(
              [...toast].sort(
                (a, b) =>
                  Number(b.kind === 'deadline') - Number(a.kind === 'deadline'),
              )[0]!.courseId,
            )?.color ?? '#4f2683'
          }
          onDismiss={dismissToast}
          onReview={() => {
            dismissToast();
            setView('changes');
            requestAnimationFrame(() => {
              const heading = document.getElementById('changes-heading');
              heading?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'instant'
                  : 'smooth',
                block: 'start',
              });
              heading?.focus({ preventScroll: true });
            });
          }}
        />
      )}
    </main>
  );
}
