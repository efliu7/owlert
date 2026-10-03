import { useRef, useState, type CSSProperties, type DragEvent } from 'react';
import type { Assignment, Course, CoursePreferences } from '../../lib/db';
import { COURSE_COLORS } from '../../lib/courses';
import Icon from './Icon';
import styles from './App.module.css';

export default function CourseCard({
  course,
  assignments,
  preferences,
  disabled,
  onChange,
  dragging,
  dropPlacement,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
}: {
  course: Course;
  assignments: Assignment[];
  preferences: CoursePreferences;
  disabled: boolean;
  onChange: (patch: Omit<Partial<CoursePreferences>, 'courseId'>) => void;
  dragging: boolean;
  dropPlacement: 'before' | 'after' | null;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const palette = useRef<HTMLDivElement>(null);
  const colorButton = useRef<HTMLButtonElement>(null);
  const paletteId = `course-color-${course.id}`;
  return (
    <section
      className={`${styles.course} ${dragging ? styles.draggingCourse : ''} ${dropPlacement === 'before' ? styles.dropBefore : dropPlacement === 'after' ? styles.dropAfter : ''}`}
      aria-label={course.name}
      data-course-id={course.id}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={
        { '--course-accent': preferences.color ?? '#4f2683' } as CSSProperties
      }
    >
      <div className={styles.courseHeader}>
        <button
          type="button"
          className={styles.courseToggle}
          aria-expanded={expanded}
          aria-controls={`course-body-${course.id}`}
          aria-describedby="course-reorder-help"
          draggable={!disabled}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onKeyDown={(event) => {
            if (
              event.altKey &&
              (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ) {
              event.preventDefault();
              onMove(event.key === 'ArrowUp' ? -1 : 1);
            }
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={styles.courseHeading}>
            <span className={styles.courseTitle}>{course.name}</span>
            <span className={styles.courseCount}>
              {preferences.pinned && (
                <span className={styles.pinnedBadge}>Pinned</span>
              )}
              {assignments.length}{' '}
              {assignments.length === 1 ? 'assignment' : 'assignments'}
            </span>
          </span>
          <span
            className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ''}`}
          >
            <Icon name="chevron" />
          </span>
        </button>
        <div className={styles.courseActions}>
          <button
            type="button"
            ref={colorButton}
            className={styles.iconButton}
            title="Change course color"
            aria-label={`Change color for ${course.name}`}
            aria-expanded={paletteOpen}
            aria-controls={paletteId}
            popoverTarget={paletteId}
            disabled={disabled}
            onClick={() => {
              const bounds = colorButton.current!.getBoundingClientRect();
              setPosition({
                left: Math.max(
                  8,
                  Math.min(bounds.right - 208, window.innerWidth - 216),
                ),
                top: Math.max(
                  8,
                  Math.min(bounds.bottom + 8, window.innerHeight - 120),
                ),
              });
            }}
          >
            <Icon name="palette" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            title={preferences.pinned ? 'Unpin course' : 'Pin course'}
            aria-label={`${preferences.pinned ? 'Unpin' : 'Pin'} ${course.name}`}
            aria-pressed={!!preferences.pinned}
            disabled={disabled}
            onClick={() => onChange({ pinned: !preferences.pinned })}
          >
            <Icon name="pin" />
          </button>
        </div>
      </div>
      <div
        ref={palette}
        id={paletteId}
        popover="auto"
        className={styles.colorPopover}
        style={position}
        onToggle={() =>
          setPaletteOpen(!!palette.current?.matches(':popover-open'))
        }
      >
        <p>Course color</p>
        <div
          className={styles.colorSwatches}
          role="group"
          aria-label={`Color for ${course.name}`}
        >
          {COURSE_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className={styles.colorSwatch}
              title={color.name}
              aria-label={color.name}
              aria-pressed={(preferences.color ?? '#4f2683') === color.value}
              disabled={disabled}
              style={{ background: color.value }}
              onClick={() => {
                onChange({ color: color.value });
                palette.current?.hidePopover();
                colorButton.current?.focus();
              }}
            />
          ))}
        </div>
      </div>
      <div
        className={styles.courseBody}
        id={`course-body-${course.id}`}
        hidden={!expanded}
      >
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
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
                <p
                  className={item.dueLabel ? styles.dueDate : styles.noDueDate}
                >
                  {item.dueLabel ?? 'No due date shown'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
