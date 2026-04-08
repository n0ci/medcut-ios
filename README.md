# MedCut

[![CI](https://github.com/n0ci/medcut-ios/actions/workflows/ci.yml/badge.svg)](https://github.com/n0ci/medcut-ios/actions/workflows/ci.yml)

Scriptable-based tracking for peptides and medications on iPhone.

MedCut combines Scriptable, Apple Shortcuts, widgets, and plain iCloud Drive JSON into a lightweight tracker that feels app-like without becoming a native app project.

## What It Does

- Logs compounds quickly from Apple Shortcuts or the in-app dashboard
- Shows current status cards and a trend graph in a Scriptable dashboard
- Supports recurring schedules with add, edit, pause, and delete flows
- Keeps history editable from the dashboard
- Stores everything as plain JSON in iCloud Drive
- Ships as one generated `MedCut.js` script for Scriptable

## Why This Repo Exists

MedCut is built for people who want:

- a private, local-first tracker
- automation through Apple Shortcuts and Siri
- editable, inspectable source-of-truth files
- a tool that is easy to maintain and extend

It is intentionally not a native iOS app, backend service, or cloud product.

## Product Shape

The current app includes:

- compact current-state header
- current status cards
- trend graph
- quick log workspace
- schedule management
- inline history edit/delete
- Home Screen widget modes
- starter catalog across peptides, painkillers, antidepressants, small molecules, and steroids

Quick Log now uses:

- class filter
- typeahead substance search with dropdown results
- recent-substance shortcuts
- native iPhone date/time pickers inside a Scriptable-safe shell

## Safety And Scope

MedCut is a convenience visualization tool.

- Not medical advice
- Not a medical device
- No dosing recommendations
- Some compounds use rough or low-confidence PK assumptions, which are surfaced in the UI

## How It Works

```text
Apple Shortcuts / Scriptable UI
            |
            v
        MedCut.js
            |
            v
 iCloud Drive / Scriptable / MedCut
   - medications/<category>.json
   - history/<category>.json
            |
            v
  Dashboard, widget, summaries, schedules
```

## Install

### 1. Install Scriptable

Install Scriptable from the App Store.

### 2. Run the MedCut installer

Create a Scriptable script named `Install_MedCut` and paste in [Install_MedCut.js](Install_MedCut.js).

That installer:

- downloads the latest [MedCut.js](MedCut.js)
- installs it into Scriptable as `MedCut`
- offers the official shortcut catalog after install

### 3. Open MedCut once

Open MedCut in Scriptable once so it can:

- request permissions
- create the starter `medications/` files
- create the starter `history/` files

### 4. Install the core shortcuts

The official shortcut catalog lives here:

- [Official Shortcuts](docs/Official_Shortcuts.md)
- [Shortcut catalog manifest](docs/shortcuts.json)

Core shortcuts:

- `Install MedCut`
- `Open Dashboard`
- `Quick Log`
- `Add Schedule`

If published iCloud links are present in the catalog, `Install_MedCut.js` will offer them after install. If not, the installer opens the catalog page and the manual fallback remains available in [Shortcut_Setup.md](Shortcut_Setup.md).

### 5. Optional: add a widget

Add a Scriptable widget and point it at `MedCut`.

## Hosted Distribution

Raw files:

- Installer: https://raw.githubusercontent.com/n0ci/medcut-ios/main/Install_MedCut.js
- App bundle: https://raw.githubusercontent.com/n0ci/medcut-ios/main/MedCut.js
- Shortcut catalog: https://raw.githubusercontent.com/n0ci/medcut-ios/main/docs/shortcuts.json

The first launch creates starter `medications/` and `history/` files automatically.

## Official Shortcuts

The repo now has a tracked shortcut catalog that defines the official shortcut pack.

Primary shortcuts:

- `Install MedCut`: installs or updates the Scriptable app and points the user at the shortcut pack
- `Open Dashboard`: opens the MedCut dashboard directly
- `Quick Log`: logs one entry and returns to the updated dashboard
- `Add Schedule`: creates a recurring schedule and returns to the updated dashboard

Published iCloud links belong in [`docs/shortcuts.json`](/Users/noci/repo/peptide-tracker-ios/docs/shortcuts.json). Once those links are added, the installer and docs automatically point users into the official pack.

## Shortcut Input Contract

MedCut accepts a Shortcut dictionary or JSON string.

### Log entry

```json
{
  "action": "log",
  "category": "peptides",
  "compound": "tirzepatide",
  "dose_mg": 2.5,
  "time": "2026-04-08T10:00:00Z",
  "notes": "optional"
}
```

### Add schedule

```json
{
  "action": "add_protocol",
  "category": "peptides",
  "compound": "tirzepatide",
  "dose_mg": 2.5,
  "every_days": 7,
  "start": "2026-04-08T10:00:00Z",
  "occurrences": 6,
  "enabled": true
}
```

### Edit schedule

```json
{
  "action": "edit_protocol",
  "protocol_id": "pro_123",
  "compound": "tirzepatide",
  "dose_mg": 2.5,
  "every_days": 7,
  "start": "2026-04-08T10:00:00Z",
  "occurrences": 6,
  "enabled": true,
  "notes": "optional"
}
```

### Toggle schedule

```json
{
  "action": "toggle_protocol",
  "protocol_id": "pro_123",
  "enabled": false
}
```

### Delete schedule

```json
{
  "action": "delete_protocol",
  "protocol_id": "pro_123"
}
```

### Open dashboard

```json
{
  "action": "dashboard"
}
```

### Edit log entry

```json
{
  "action": "edit_injection",
  "injection_id": "inj_123",
  "compound": "tirzepatide",
  "dose_mg": 2.5,
  "time": "2026-04-08T10:00:00Z",
  "notes": "optional"
}
```

### Delete log entry

```json
{
  "action": "delete_injection",
  "injection_id": "inj_123"
}
```

### Summary

```json
{
  "action": "summary"
}
```

### Export backup

```json
{
  "action": "export_backup"
}
```

## Data Model

Source of truth is split by concern:

- `iCloud Drive/Scriptable/MedCut/medications/<category>.json`
- `iCloud Drive/Scriptable/MedCut/history/<category>.json`

Medication definition file:

- `schema_version`: 1
- `category`: string
- `compounds`: object

History file:

- `schema_version`: 1
- `category`: string
- `injections`: array
- `protocols`: array

Canonical-only rules:

- Definitions must live in `medications/<category>.json`
- Matching history must live in `history/<category>.json`
- Old combined-file layouts are no longer supported
- Fuzzy compound matching and legacy recovery paths were removed

## Starter Catalog

Seeded categories:

- peptides
- painkillers
- antidepressants
- small molecules
- steroids

Examples in the starter library include:

- Tirzepatide
- Semaglutide
- Retatrutide
- GHK-Cu
- BPC-157
- Sertraline
- Ibuprofen
- Metformin

Edit the seeded files directly if you want to adjust presets later.

## Widget Modes

Scriptable widgets support optional `widgetParameter` modes:

- `top`: top compounds by current amount or concentration
- `today`: entries logged in the last 24 hours
- `next`: next scheduled doses

## Repo Layout

- `Install_MedCut.js`: installer that downloads the latest bundle into Scriptable
- `MedCut.js`: generated Scriptable app bundle
- `src/`: authored source files
- `src/00-config.js`: constants, starter library, normalization helpers
- `src/10-storage.js`: canonical storage and persistence
- `src/20-core.js`: PK math, summaries, and series generation
- `src/30-widget.js`: dashboard and widget UI generation
- `src/40-dashboard.js`: prompt and menu helpers
- `src/50-prompts.js`: shortcut action routing
- `src/99-main.js`: Scriptable entrypoint
- `scripts/build.js`: concatenates `src/` into `MedCut.js`
- `docs/shortcuts.json`: official shortcut catalog manifest
- `docs/Official_Shortcuts.md`: public shortcut pack page
- `medications/`: starter definition templates
- `history/`: starter history templates
- `.github/workflows/ci.yml`: CI checks
- `Shortcut_Setup.md`: manual Shortcut builder notes

## Contributor Notes

Keep the stack lightweight:

- Scriptable runtime and UI
- Apple Shortcuts for automation
- iCloud Drive JSON for storage

Local workflow:

- edit files in `src/`, not `MedCut.js`
- run `npm run build` to regenerate the bundle
- run `npm test` for regression and numeric checks
- run `npm run format:check` before shipping
- verify dashboard changes on-device in Scriptable

Avoid turning this into a native app rewrite.
