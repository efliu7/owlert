export default function Icon({
  name,
}: {
  name: 'palette' | 'pin' | 'settings' | 'close' | 'chevron' | 'bell' | 'sync';
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'palette' && (
        <>
          <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.1-2.5H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" />
          <circle cx="7.5" cy="10" r=".6" />
          <circle cx="10" cy="6.5" r=".6" />
          <circle cx="15" cy="7" r=".6" />
        </>
      )}
      {name === 'pin' && (
        <>
          <path d="m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6Z" />
          <path d="M12 15v6" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="8" cy="6" r="2" fill="currentColor" />
          <circle cx="16" cy="12" r="2" fill="currentColor" />
          <circle cx="10" cy="18" r="2" fill="currentColor" />
        </>
      )}
      {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
      {name === 'bell' && (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </>
      )}
      {name === 'sync' && (
        <>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3" />
        </>
      )}
      {name === 'chevron' && <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}
