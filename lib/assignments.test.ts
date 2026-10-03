// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { captureAssignments, isAssignmentCapture } from './assignments';

const pageUrl =
  'https://westernu.brightspace.com/d2l/lms/dropbox/user/folders_list.d2l?ou=123';
beforeEach(() => {
  document.title = 'Assignments - Example Course - Western University';
  document.body.innerHTML = `<table class="d2l-grid"><tbody>
    <tr><th><a href="/d2l/lms/dropbox/user/folder_submit_files.d2l?db=456&ou=123">Assignment One</a>
    <div class="d2l-dates-text">Due on Oct 10, 2026 11:59 PM</div>
    <a href="/d2l/common/viewFile.d2lfile/example.pdf">Attachment</a></th>
    <td><a href="/d2l/lms/dropbox/user/folders_history.d2l?db=456&ou=123">Submission history</a></td></tr>
    <tr><th><a href="/d2l/lms/dropbox/user/folder_submit_files.d2l?db=789&ou=123">Assignment Two</a>
    <div class="d2l-dates-text">Available until Oct 15, 2026</div></th></tr>
  </tbody></table>`;
});

describe('Brightspace assignment capture', () => {
  it('captures stable IDs, links and due labels without attachments or submission history', () => {
    const snapshot = captureAssignments(document, pageUrl)!;
    expect(snapshot.course).toEqual({
      id: '123',
      name: 'Example Course',
      url: 'https://westernu.brightspace.com/d2l/home/123',
    });
    expect(snapshot.assignments).toEqual([
      {
        id: '456',
        title: 'Assignment One',
        url: 'https://westernu.brightspace.com/d2l/lms/dropbox/user/folder_submit_files.d2l?db=456&ou=123',
        dueLabel: 'Due on Oct 10, 2026 11:59 PM',
      },
      {
        id: '789',
        title: 'Assignment Two',
        url: 'https://westernu.brightspace.com/d2l/lms/dropbox/user/folder_submit_files.d2l?db=789&ou=123',
        dueLabel: null,
      },
    ]);
    expect(isAssignmentCapture(snapshot)).toBe(true);
  });
  it('waits for the table and rejects unsupported pages', () => {
    expect(
      captureAssignments(
        document,
        'https://westernu.brightspace.com/d2l/home/123',
      ),
    ).toBeNull();
    expect(
      captureAssignments(
        document,
        pageUrl.replace('westernu.brightspace.com', 'example.com'),
      ),
    ).toBeNull();
    document.body.innerHTML = '';
    expect(captureAssignments(document, pageUrl)).toBeNull();
  });
  it('does not replace the assignment title with its completion-status link', () => {
    document
      .querySelector('tr td')!
      .insertAdjacentHTML(
        'beforeend',
        '<a href="/d2l/lms/dropbox/user/folder_submit_files.d2l?db=456&ou=123">Not Submitted</a>',
      );
    const result = captureAssignments(document, pageUrl)!;
    expect(result.assignments[0]!.title).toBe('Assignment One');
    expect(result.assignments[0]!.dueLabel).toBe(
      'Due on Oct 10, 2026 11:59 PM',
    );
  });
  it('deduplicates IDs and ignores assignment links from other courses', () => {
    document.querySelector('tbody')!.insertAdjacentHTML(
      'beforeend',
      `<tr><th>
      <a href="/d2l/lms/dropbox/user/folder_submit_files.d2l?db=789&ou=123">Assignment Two</a>
      <a href="/d2l/lms/dropbox/user/folder_submit_files.d2l?db=111&ou=999">Other course</a>
    </th></tr>`,
    );
    expect(captureAssignments(document, pageUrl)!.assignments).toHaveLength(2);
  });
  it('accepts empty rendered lists', () => {
    document.body.innerHTML =
      '<table class="d2l-grid"><tr><td>No assignments</td></tr></table>';
    expect(captureAssignments(document, pageUrl)!.assignments).toEqual([]);
  });
  it('rejects malformed messages and foreign links', () => {
    expect(isAssignmentCapture(null)).toBe(false);
    expect(isAssignmentCapture({ course: {}, assignments: [] })).toBe(false);
    const snapshot = captureAssignments(document, pageUrl)!;
    snapshot.assignments[0]!.url = 'https://example.com/';
    expect(isAssignmentCapture(snapshot)).toBe(false);
  });
});
