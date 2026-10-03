import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { browser } from 'wxt/browser';
import { db } from '../../lib/storage/db';
import { CHANGE_NOTIFICATION_ID } from '../../lib/notifications/delivery';
import styles from './App.module.css';

export default function NotificationControls() {
  const settings = useLiveQuery(
    () =>
      db.notificationSettings.get('notifications').then((value) => ({
        enabled: value?.changeNotifications ?? false,
        inApp: value?.inAppNotifications ?? true,
      })),
    [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const check = () => {
      void browser.notifications
        .getPermissionLevel()
        .then((level) => setBlocked(level !== 'granted'))
        .catch(() => setBlocked(true));
    };
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);
  async function toggle(
    key: 'changeNotifications' | 'inAppNotifications',
    enabled: boolean,
  ) {
    setSaving(true);
    setError('');
    try {
      await db.transaction('rw', db.notificationSettings, async () => {
        const current = await db.notificationSettings.get('notifications');
        await db.notificationSettings.put({
          id: 'notifications',
          changeNotifications: false,
          ...current,
          [key]: enabled,
        });
      });
      if (key === 'changeNotifications' && !enabled)
        await browser.notifications.clear(CHANGE_NOTIFICATION_ID);
    } catch {
      setError('Could not update notifications. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className={styles.notificationControls}>
      <label className={styles.notificationToggle}>
        <input
          type="checkbox"
          checked={settings?.inApp ?? true}
          disabled={!settings || saving}
          onChange={(event) => {
            void toggle('inAppNotifications', event.target.checked);
          }}
        />
        Show alerts inside Owlert
      </label>
      <p>A compact alert when assignments change.</p>
      <label className={styles.notificationToggle}>
        <input
          type="checkbox"
          checked={settings?.enabled ?? false}
          disabled={!settings || saving}
          onChange={(event) => {
            void toggle('changeNotifications', event.target.checked);
          }}
        />
        Also show desktop notifications
      </label>
      <p>Silent alerts outside the panel.</p>
      <p>Desktop alerts follow your system notification settings.</p>
      {blocked && (
        <p role="status">
          Chrome has blocked notifications for Owlert. Check your browser
          notification settings.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
