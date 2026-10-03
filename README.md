# Owlert

Your courses change. Stay ahead.

A Chrome Manifest V3 extension for a local-first Western Brightspace course
briefing. Log into Western Brightspace and click **Sync courses** in Owlert to
collect assignments across all active, accessible courses. Visiting an Assignments
page also captures its visible rows. Captures are saved locally
and remain available between browser sessions. Change detection and reminders
are not implemented yet.

## Requirements

- Node.js **24 LTS** (includes npm)
- Google Chrome **116 or newer**
- Git

## Develop

From PowerShell in the project folder:

```powershell
# Already completed during initial setup. On a fresh checkout:
npm ci

# Starts WXT with hot reload:
npm run dev
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm`.

Open `chrome://extensions`, turn on **Developer mode**, select **Load unpacked**,
and choose `.output/chrome-mv3-dev`. Keep the development server running.

Click Owlert's extension toolbar button to open the side panel. Pin the extension
through Chrome's Extensions menu if needed. Stop the development server with Ctrl+C.
Browser loading is manual; the optional automatic browser runner is not installed.

The dev server uses port 3000 and fails if that port is occupied. Run only one
Owlert dev server at a time. After restarting it, reload Owlert in
`chrome://extensions` and reopen the side panel so Chrome loads the current
development manifest and scripts together.

## Validate and build

```powershell
npm run check
npm run zip
```

`check` runs TypeScript, formatting checks, and the production build. The production
extension is in `.output/chrome-mv3`; load that folder through `chrome://extensions`
to try the release build. `zip` produces a distributable archive in `.output/`.

Other commands:

- `run format`: format source files with Prettier.
- `run test` / `run test:watch`: Vitest parser tests against sanitized assignment markup.

## Project structure

- `wxt.config.ts`: extension configuration and permissions; WXT generates the manifest.
- `entrypoints/background.ts`: service worker; enables toolbar-click side panel opening.
- `entrypoints/assignments.content.ts`: collects visible assignment rows on Western Brightspace.
- `entrypoints/sidepanel/`: React UI and CSS Modules.
- `lib/db.ts`: Dexie course and assignment schema for extension contexts.
- `lib/assignments.ts`: assignment parser and message validation.
- `lib/sync.ts`: authenticated course discovery and assignment sync through Brightspace's APIs.
- `vitest.config.ts`: test runner configuration.

Stack: WXT, TypeScript, React, CSS Modules, Dexie/IndexedDB, Vitest, and Prettier.
Dependency versions are recorded in `package-lock.json`; use `ci` to reproduce them.

The extension requests `sidePanel`, `storage`, and host access to
`https://westernu.brightspace.com/*` for authenticated, read-only API requests.
Its content script runs only on Western Brightspace assignment-list pages. Alarm and notification permissions
will be added with reminders. No backend, API keys, or environment variables are
required. Only course and assignment fields are saved; passwords, grades,
submission details, and attachment contents are not saved.

After updating the extension, reload it in `chrome://extensions` and reopen the
side panel. Click **Sync courses**; no course-page visits are needed. Enrollment
pagination is followed, and the assignment API returns the full folder list for
each course. The scan uses your existing login session and reports partial failures.
If the session expires, log back into Brightspace and sync again.
API due dates are displayed in your device's timezone, with a timezone label.
Group assignment links open the course's assignment list to use the appropriate group.
Manual page captures retain Brightspace's displayed due-date labels; refresh an
open assignment page after loading or updating the extension to capture its rows.
Saved assignments are updated by course and assignment ID. Missing rows are not
deleted, since they may be on another page or temporarily unavailable.

## Next milestone

Keep capture history and compare a later capture with its baseline to show title
and deadline changes. Confirm completeness before interpreting missing assignments
as deletions.
