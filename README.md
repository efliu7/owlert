# Owlert

Your courses change. Stay ahead.

A Chrome Manifest V3 extension for a local-first Western Brightspace course
briefing. The initial scaffold has a React side panel and a background service
worker. Course collection, change detection, and reminders are not implemented yet.

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
- `run test` / `run test:watch`: Vitest, configured for future parser and change
  detection tests. No tests exist yet; Vitest reports that until tests are added.

## Project structure

- `wxt.config.ts`: extension configuration and permissions; WXT generates the manifest.
- `entrypoints/background.ts`: service worker; enables toolbar-click side panel opening.
- `entrypoints/sidepanel/`: React UI and CSS Modules.
- `lib/db.ts`: initial Dexie course schema for extension contexts.
- `vitest.config.ts`: test runner configuration.

Stack: WXT, TypeScript, React, CSS Modules, Dexie/IndexedDB, Vitest, and Prettier.
Dependency versions are recorded in `package-lock.json`; use `ci` to reproduce them.

The extension currently requests `sidePanel` and `storage` only. Brightspace host
permissions and a content script will be added when the actual Western course pages
and extraction approach are verified. Alarm and notification permissions will be
added with reminders. No backend, API keys, or environment variables are required.

## Next milestone

Verify Western's Brightspace URL and page structure, then implement collection from
a visited course page, save a baseline, and display changes after a later scan.
