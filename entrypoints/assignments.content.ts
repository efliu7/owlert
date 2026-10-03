import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { captureAssignments } from '../lib/assignments/capture';

export default defineContentScript({
  matches: [
    'https://westernu.brightspace.com/d2l/lms/dropbox/user/folders_list.d2l*',
  ],
  runAt: 'document_idle',
  main(ctx) {
    let fingerprint = '';
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let saving = false;
    async function capture() {
      if (saving || ctx.isInvalid) return;
      saving = true;
      let captured = false;
      try {
        const permission = await browser.runtime.sendMessage({
          type: 'courses:can-capture',
        });
        if (!permission?.included || ctx.isInvalid) return;
        const snapshot = captureAssignments(document, location.href);
        if (!snapshot) return;
        const next = JSON.stringify(snapshot);
        if (next === fingerprint) return;
        const response = await browser.runtime.sendMessage({
          type: 'assignments:capture',
          snapshot,
        });
        if (!response?.ok)
          throw new Error(response?.error ?? 'Could not save assignments');
        fingerprint = next;
        captured = true;
      } catch (error) {
        console.error('Owlert assignment capture failed:', error);
      } finally {
        saving = false;
        if (!ctx.isInvalid && captured) void capture();
      }
    }
    const observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        void capture();
      }, 750);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    void capture();
    ctx.onInvalidated(() => {
      observer.disconnect();
      clearTimeout(timeout);
    });
  },
});
