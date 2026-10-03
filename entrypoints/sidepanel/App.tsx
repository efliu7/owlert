import styles from './App.module.css';

export default function App() {
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
        <span className={styles.badge}>Getting started</span>
        <h2 id="welcome-heading">A little clarity for your courses.</h2>
        <p>
          This is the start of your course briefing. Brightspace collection,
          change tracking, and reminders are coming next.
        </p>
        <p className={styles.note}>
          No courses connected yet. This version does not read course pages.
        </p>
      </section>
      <footer className={styles.footer}>
        Built for students. Stored on your device.
      </footer>
    </main>
  );
}
