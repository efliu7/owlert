import { describe, expect, it, vi } from 'vitest';
import { discoverCourses, folderAssignments } from './sync';

function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
}
const versions = [
  { ProductCode: 'lp', LatestVersion: '1.63' },
  { ProductCode: 'le', LatestVersion: '1.99' },
];
const enrollment = (id: number, canAccess = true) => ({
  OrgUnit: { Id: id, Name: `Course ${id}`, Type: { Id: 3 } },
  Access: { IsActive: true, CanAccess: canAccess },
});

describe('course sync', () => {
  it('discovers accessible courses across enrollment pages using the login session', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(versions))
      .mockResolvedValueOnce(
        response({
          Items: [enrollment(123), enrollment(999, false)],
          PagingInfo: { HasMoreItems: true, Bookmark: 'next' },
        }),
      )
      .mockResolvedValueOnce(
        response({
          Items: [enrollment(456)],
          PagingInfo: { HasMoreItems: false, Bookmark: null },
        }),
      );
    const result = await discoverCourses(fetcher);
    expect(result.courses.map((course) => course.id)).toEqual(['123', '456']);
    expect(fetcher.mock.calls[2]![0]).toContain('bookmark=next');
    expect(fetcher.mock.calls[0]![1]?.credentials).toBe('include');
  });
  it('gives a login instruction for expired sessions', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>Login</html>', {
        headers: { 'content-type': 'text/html' },
      }),
    );
    await expect(discoverCourses(fetcher)).rejects.toThrow('log in');
  });
  it('fails when enrollment pagination repeats rather than silently returning partial results', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(versions))
      .mockImplementation(async () =>
        response({
          Items: [],
          PagingInfo: { HasMoreItems: true, Bookmark: 'same' },
        }),
      );
    await expect(discoverCourses(fetcher)).rejects.toThrow('did not advance');
  });
  it('uses API titles, filters hidden assignments and preserves missing due dates', () => {
    const records = folderAssignments(
      '123',
      [
        {
          Id: 456,
          Name: 'Ethics presentation',
          DueDate: null,
          IsHidden: false,
          GroupTypeId: 42,
        },
        {
          Id: 789,
          Name: 'Poster',
          DueDate: '2026-10-20T01:00:00Z',
          IsHidden: false,
          GroupTypeId: null,
        },
        {
          Id: 999,
          Name: 'Hidden',
          DueDate: null,
          IsHidden: true,
          GroupTypeId: null,
        },
      ],
      100,
    );
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      key: '123:456',
      title: 'Ethics presentation',
      dueLabel: null,
    });
    expect(records[0]!.url).toContain('folders_list.d2l?ou=123');
    expect(records[1]!.dueLabel).toMatch(/^Due on /);
    expect(records[1]!.url).toContain('db=789');
  });
});
