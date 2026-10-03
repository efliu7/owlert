import styles from './App.module.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CoursePreferences } from '../../lib/storage/db';
import { Fragment, useState, useRef } from 'react';
import { syncCourses } from '../../lib/brightspace/sync';
import {
  reorderCourse,
  sortCourses,
  updateCoursePreferences,
} from '../../lib/courses/preferences';
import CourseCard from './CourseCard';
import Icon from './Icon';
import ChangeFeed from './ChangeFeed';

export default function App() {
  const courseDialog = useRef<HTMLDialogElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
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
              ? 'All courses are excluded. Include a course using the Course display icon to sync it.'
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
      const [courses, assignments, preferences, changes, baselines] =
        await Promise.all([
          db.courses.toArray(),
          db.assignments.toArray(),
          db.coursePreferences.toArray(),
          db.assignmentChanges.toArray(),
          db.courseBaselines.toArray(),
        ]);
      return {
        courses,
        assignments,
        preferences,
        changes,
        baselines,
        error: false,
      };
    } catch {
      return {
        courses: [],
        assignments: [],
        preferences: [],
        changes: [],
        baselines: [],
        error: true,
      };
    }
  });
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
        <div className={styles.toolbar}>
          <button
            className={styles.syncButton}
            disabled={syncing}
            onClick={() => {
              void sync();
            }}
          >
            {syncing ? 'Syncing…' : 'Sync courses'}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            title="Course display"
            aria-label="Manage course display"
            aria-haspopup="dialog"
            aria-controls="course-display"
            disabled={!courses.length}
            onClick={() => courseDialog.current?.showModal()}
          >
            <Icon name="settings" />
          </button>
        </div>
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
        {preferenceError && <p role="alert">{preferenceError}</p>}
        {data && !data.error && includedCourses.length > 0 && (
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
            {includedCourses.length === 0 && (
              <p className={styles.emptyCourse}>
                All courses are excluded. Use the Course display icon to include
                one.
              </p>
            )}
            <div className={styles.courses}>
              <p id="course-reorder-help" className={styles.srOnly}>
                Hold and drag a course header to reorder it within its pinned or
                unpinned group. With a header focused, press Alt and the Up or
                Down arrow to move it.
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
                      dropTarget?.id === course.id ? dropTarget.placement : null
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
            <p className={styles.note}>
              Sync reads all assignments returned by Brightspace. Synced dates
              use your device’s timezone; page captures keep Brightspace’s
              displayed dates. Change tracking compares successful syncs;
              visiting a page does not generate change alerts. Assignments
              absent from a sync remain saved and are not marked as deleted.
            </p>
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
          <h2 id="display-title">Course display</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close course display"
            onClick={() => courseDialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <p>
          Choose the courses to show and sync. Hidden courses keep their saved
          assignments.
        </p>
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
      </dialog>
      <footer className={styles.footer}>
        Built for students. Stored on your device.
      </footer>
    </main>
  );
}
