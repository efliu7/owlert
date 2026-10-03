# Owlert

Your courses change. Stay ahead.

A Chrome Manifest V3 extension for a local-first Western Brightspace course
briefing. Log into Western Brightspace and click **Sync courses** in Owlert to
collect assignments across all active, accessible courses. Visiting an Assignments
page also captures its visible rows. Captures are saved locally
and remain available between browser sessions. Successful syncs track new
assignments, renamed assignments, and exact deadline changes. Chrome notifications
and scheduled reminders are not implemented yet.

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
- `run test` / `run test:watch`: Vitest parser, sync, preference, and change-tracking tests.

## Course preferences

Click a course header's **palette icon** to choose a preset or custom color, or its **pin icon**
to pin it. The **Course display icon** beside Sync courses opens a separate menu
for including or excluding courses. Hold and drag a course header to reorder it;
the drop indicator appears only while dragging. Pinned courses stay first, and
dragging reorders courses within the pinned or unpinned group. You can also focus
a header and press **Alt+Up/Down** to move it. Before a custom order is saved,
courses sort alphabetically; newly discovered courses follow the saved order.
Colors apply to course headers,
borders, links, and due-date badges. The custom picker uses react-colorful and
supports pointer and keyboard controls. You can also enter a 3- or 6-digit hex
color and click **Apply color**. Dismissing the picker discards unapplied changes.
Light colors retain their accents while text uses a darker shade for readability.

Excluded courses disappear from the briefing and their assignments are skipped
during both sync and page capture. They remain in Course display, and previously
saved assignments are kept. Include the course again and sync to refresh it.
Order, colors, and pins are stored separately on this device and survive syncs and browser
restarts.

## Project structure

- `wxt.config.ts`: extension configuration and permissions; WXT generates the manifest.
- `entrypoints/background.ts`: service worker; enables toolbar-click side panel opening.
- `entrypoints/assignments.content.ts`: collects visible assignment rows on Western Brightspace.
- `entrypoints/sidepanel/`: React UI and CSS Modules.
- `lib/assignments/`: page capture, message validation, sync baselines, and change history.
- `lib/brightspace/`: authenticated course discovery and assignment sync through Brightspace's APIs.
- `lib/courses/`: course preferences, ordering, and page-capture storage.
- `lib/storage/`: shared Dexie database and stored data types for extension contexts.
- `lib/ui/`: shared color and readability utilities.
- Tests live beside their corresponding modules in each feature folder.
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

## Assignment change tracking

The **Since your last check** feed shows new assignments, name changes, and
deadline changes with previous and current values and a Brightspace source link.
The first successful sync for each course establishes a baseline without alerts,
including after upgrading from an older version of Owlert. Subsequent successful
syncs compare normalized API timestamps, so timezone and date-format changes do
not create false alerts. Existing assignments and course preferences survive the
database upgrade.

Use **Mark as seen** or **Mark all as seen** to acknowledge changes. Seen changes
remain available in the collapsible history, and acknowledgements survive browser
restarts. Excluded courses' changes are hidden until the course is included again.

Page captures update saved assignment displays while preserving known API due
timestamps. They never establish or overwrite the sync baseline. Failed course
requests and invalid responses leave that course's baseline unchanged; successful
courses can still update. Missing assignments are retained without deletion
alerts. Baseline updates, saved assignments, and change events commit together.

## Next milestone

Validate change tracking with real course updates, then add configurable Chrome
notifications and deadline reminders. Instruction and attachment changes require
additional retrieval. See PRODUCT.md for the broader product direction.
