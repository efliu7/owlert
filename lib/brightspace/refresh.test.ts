import { describe, expect, it } from 'vitest';
import { shouldRefreshOnOpen } from './refresh';
const course = {
  id: '123',
  name: 'Course',
  url: 'https://westernu.brightspace.com/d2l/home/123',
};
const now = 2000000;
describe('refresh on panel open', () => {
  it('connects a fresh install or a course without a sync baseline', () => {
    expect(shouldRefreshOnOpen([], [], [], now)).toBe(true);
    expect(shouldRefreshOnOpen([course], [], [], now)).toBe(true);
  });
  it('uses cached data until the 15-minute boundary', () => {
    expect(
      shouldRefreshOnOpen(
        [course],
        [],
        [{ courseId: '123', capturedAt: now - 899999, assignments: [] }],
        now,
      ),
    ).toBe(false);
    expect(
      shouldRefreshOnOpen(
        [course],
        [],
        [{ courseId: '123', capturedAt: now - 900000, assignments: [] }],
        now,
      ),
    ).toBe(true);
  });
  it('does not refresh excluded courses, including when every course is excluded', () => {
    expect(
      shouldRefreshOnOpen(
        [course],
        [{ courseId: '123', excluded: true }],
        [],
        now,
      ),
    ).toBe(false);
  });
});
