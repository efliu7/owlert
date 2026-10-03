import { useRef, useState, type CSSProperties, type DragEvent } from 'react';
import type {
  Assignment,
  Course,
  CoursePreferences,
} from '../../lib/storage/db';
import { COURSE_COLORS } from '../../lib/courses/preferences';
import { courseTextColor } from '../../lib/ui/colors';
import { HexColorPicker } from 'react-colorful';
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
  const [draftColor, setDraftColor] = useState('#4f2683');
  const [hexInput, setHexInput] = useState('#4f2683');
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const palette = useRef<HTMLDivElement>(null);
  const colorButton = useRef<HTMLButtonElement>(null);
  const paletteId = `course-color-${course.id}`;
  const color = preferences.color ?? '#4f2683';
  const validHex = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hexInput);
  function selectDraft(value: string) {
    setDraftColor(value);
    setHexInput(value);
  }
  function applyColor(value: string) {
    onChange({ color: value });
    palette.current?.hidePopover();
    colorButton.current?.focus();
  }
  return (
    <section
      className={`${styles.course} ${dragging ? styles.draggingCourse : ''} ${dropPlacement === 'before' ? styles.dropBefore : dropPlacement === 'after' ? styles.dropAfter : ''}`}
      aria-label={course.name}
      data-course-id={course.id}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={
        {
          '--course-accent': color,
          '--course-ink': courseTextColor(color),
        } as CSSProperties
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
              selectDraft(color);
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
        onToggle={() => {
          const open = !!palette.current?.matches(':popover-open');
          setPaletteOpen(open);
          if (open) {
            const bounds = colorButton.current!.getBoundingClientRect();
            const popup = palette.current!.getBoundingClientRect();
            setPosition({
              left: Math.max(
                8,
                Math.min(
                  bounds.right - popup.width,
                  window.innerWidth - popup.width - 8,
                ),
              ),
              top: Math.max(
                8,
                Math.min(
                  bounds.bottom + 8,
                  window.innerHeight - popup.height - 8,
                ),
              ),
            });
          }
        }}
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
              aria-pressed={
                preferences.color === color.value ||
                (!preferences.color && color.value === '#4f2683')
              }
              disabled={disabled}
              style={{ background: color.value }}
              onClick={() => {
                applyColor(color.value);
              }}
            />
          ))}
        </div>
        <form
          className={styles.customColor}
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled && validHex) applyColor(draftColor);
          }}
        >
          <fieldset disabled={disabled}>
            <legend>Custom color</legend>
            <HexColorPicker
              color={draftColor}
              onChange={selectDraft}
              aria-label={`Custom color for ${course.name}`}
            />
            <label className={styles.hexLabel} htmlFor={`${paletteId}-hex`}>
              Hex color
            </label>
            <div className={styles.hexRow}>
              <span
                className={styles.colorPreview}
                style={{ background: draftColor }}
                aria-hidden="true"
              />
              <input
                id={`${paletteId}-hex`}
                value={hexInput}
                className={styles.hexInput}
                maxLength={7}
                spellCheck={false}
                autoComplete="off"
                placeholder="#4f2683"
                aria-invalid={!validHex}
                aria-describedby={!validHex ? `${paletteId}-error` : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setHexInput(value);
                  if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) {
                    const normalized =
                      value.length === 4
                        ? `#${value
                            .slice(1)
                            .split('')
                            .map((part) => part + part)
                            .join('')}`
                        : value;
                    setDraftColor(normalized.toLowerCase());
                  }
                }}
              />
            </div>
            {!validHex && (
              <p id={`${paletteId}-error`} className={styles.hexError}>
                Use # followed by 3 or 6 hex digits.
              </p>
            )}
            <button
              type="submit"
              className={styles.syncButton}
              disabled={disabled || !validHex}
            >
              Apply color
            </button>
          </fieldset>
        </form>
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
