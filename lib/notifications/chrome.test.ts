import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  create: vi.fn(async () => ({})),
  clear: vi.fn(async () => true),
}));
vi.mock('wxt/browser', () => ({
  browser: {
    notifications: {
      onClicked: { addListener: mocks.addListener },
      clear: mocks.clear,
    },
    tabs: { create: mocks.create },
    runtime: { getURL: (path: string) => `chrome-extension://owlert${path}` },
  },
}));
import { registerNotificationClicks } from './chrome';

describe('notification clicks', () => {
  it('opens the change feed and clears the popup, without acknowledging its events', async () => {
    registerNotificationClicks();
    const listener = mocks.addListener.mock.calls[0]![0] as (
      id: string,
    ) => void;
    listener('unrelated');
    expect(mocks.create).not.toHaveBeenCalled();
    listener('owlert-assignment-changes');
    await vi.waitFor(() =>
      expect(mocks.clear).toHaveBeenCalledWith('owlert-assignment-changes'),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      url: 'chrome-extension://owlert/sidepanel.html#changes-heading',
    });
  });
});
