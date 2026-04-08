# MedCut

**One-tap tracking with Apple Shortcuts**

MedCut is a lightweight iPhone tracker powered by Scriptable, Apple Shortcuts, and iCloud Drive JSON.

It is designed to feel like an app without building or maintaining a native app.

## Why MedCut

- Fast logging from Apple Shortcuts
- Task-first Scriptable dashboard with quick log, recent history, and charting
- Optional Home Screen widget
- iCloud Drive JSON as plain, portable source of truth
- Open-source and easy to maintain

## Safety and scope

MedCut is a convenience visualization tool.

- Not medical advice
- Not a medical device
- No dosing recommendations
- Some compounds use lower-confidence PK assumptions (labeled in UI)

## Install (normal users)

### 1. Install Scriptable
Install Scriptable from the App Store.

### 2. Add one tiny installer script
Create one script in Scriptable named `Install_MedCut` and paste [Install_MedCut.js](Install_MedCut.js).

This installer downloads and installs the app automatically:
- [MedCut.js](MedCut.js)

You only paste once.

### 3. Open MedCut once
Run MedCut in Scriptable one time to grant permissions and let it create the starter data files automatically.

### 4. Optional: add shortcuts later
Shortcuts are optional and only for convenience/automation after install:
- Quick log action
- Quick open dashboard
- Quick add schedule
- Siri / automation triggers

The dashboard now opens with:
- Overview cards at the top
- Quick action buttons for log, schedule, chart, and history
- Diagnostics banner when files contain invalid canonical references
- Quick Log open by default
- Current status cards with confidence and schedule context
- Trend graph with filters and detail presets
- Past injections with pagination plus inline edit/delete
- Schedule list with inline edit/pause/delete
- Backup export shortcut entrypoint

This keeps the daily workflow inside one UI while reducing friction.

### 5. Optional widget
Add a Scriptable widget and select MedCut.

## Hosted distribution model

Raw files:
- Bootstrap helper: https://raw.githubusercontent.com/n0ci/medcut-ios/main/Install_MedCut.js
- Script URL: https://raw.githubusercontent.com/n0ci/medcut-ios/main/MedCut.js

No manual data-file install is required. MedCut creates the starter `medications/` and `history/` files on first launch.

Published shortcuts:
- Install MedCut
- Log Injection
- Open Tracker
- Optional Add Protocol
- Optional Export Backup

Shortcut role:
- Not required for installation
- Recommended for lock-screen or Siri driven daily-use speed

Install behavior requirements:
- Ensure script is created/updated in Scriptable as `MedCut`
- Required naming for auto-created data files: `<category>.json` inside `medications/` and `history/` (example: `peptides.json`, `painkillers.json`)
- If direct script install is blocked by iOS behavior, use fallback handoff (open raw script and share to Scriptable)

## Shortcut input contract

MedCut accepts a Shortcut dictionary (or JSON string).

### Log injection
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

### Add protocol
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

### Edit protocol
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

### Toggle protocol
```json
{
  "action": "toggle_protocol",
  "protocol_id": "pro_123",
  "enabled": false
}
```

### Delete protocol
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

### Edit injection
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

### Delete injection
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

## Data schema

Source of truth is split by concern:

- Definitions: `iCloud Drive/Scriptable/MedCut/medications/<category>.json`
- History: `iCloud Drive/Scriptable/MedCut/history/<category>.json`

Medication definition file:
- `schema_version`: 1
- `category`: string
- `compounds`: object

History file:
- `schema_version`: 1
- `category`: string
- `injections`: array
- `protocols`: array

The script auto-discovers all `<category>.json` files across both folders and merges them at runtime.

Canonical-only note:
- Medication definitions are expected in `medications/<category>.json`
- Matching history is expected in `history/<category>.json`
- Old combined-file layouts and fallback recovery behavior are no longer supported

## Dashboard UX

The current dashboard is optimized for fast daily use inside Scriptable:

- Overview header with high-level counts and next-schedule context
- Quick action cards for jumping to log, schedule, graph, and history
- Recent-compound shortcuts in Quick Log
- Quick Log form expanded by default
- Advanced controls collapsed by default
- Inline history edit/delete actions
- Inline schedule edit/pause/delete actions
- Remembered preferred compound and filter/detail preferences
- Click a status card to focus the chart on one compound
- Touch-friendly chart with hover/pinch behavior
- Tooltip breakdown showing the contributing compounds at the selected chart point
- Toast-style confirmations after dashboard-triggered mutations

## Which data file should I use?

- MedCut creates starter files automatically on first launch.
- If you want to edit presets later, start with these seeded categories:
  - `medications/peptides.json`
  - `medications/painkillers.json`
  - `medications/small_molecules.json`
  - `medications/antidepressants.json`

## Repo layout

- `Install_MedCut.js`: bootstrap installer that downloads the app scripts automatically
- `MedCut.js`: generated Scriptable app bundle
- `src/`: authored source files that are concatenated into `MedCut.js`
  - `00-config.js`: constants and general helpers
  - `10-storage.js`: canonical storage, persistence, and file merge logic
  - `20-core.js`: PK math, summary rows, and series generation
  - `30-widget.js`: dashboard/widget payload and WebView UI
  - `40-dashboard.js`: in-app prompt/menu helpers
  - `50-prompts.js`: shortcut action routing
  - `99-main.js`: Scriptable entrypoint
- `scripts/build.js`: local build script used to generate the distributable bundle
- `.github/workflows/ci.yml`: CI for format check, build, and tests
- `medications/peptides.json`: category template (peptides)
- `medications/painkillers.json`: category template (painkillers example)
- `medications/small_molecules.json`: category template (small molecules)
- `medications/antidepressants.json`: category template (antidepressants)
- `history/peptides.json`: starter history template (peptides)
- `history/painkillers.json`: starter history template (painkillers example)
- `history/small_molecules.json`: starter history template (small molecules)
- `history/antidepressants.json`: starter history template (antidepressants)
- `Shortcut_Setup.md`: manual shortcut builder instructions

## Contributor notes

Keep the stack lightweight:
- Scriptable runtime/UI/charting
- Apple Shortcuts install + logging flow
- iCloud Drive JSON storage

Local workflow:
- edit files in `src/`, not `MedCut.js`
- `npm run build` regenerates `MedCut.js` from `src/`
- `npm test` runs regression and numeric tests against the current bundle/source layout
- `npm run format:check` validates the lightweight formatting/CI contract
- verify the generated bundle in Scriptable on device before shipping UI changes

Avoid native app rewrites.

## Widget modes

Scriptable widgets support optional `widgetParameter` modes:

- `top`: top compounds by current amount/concentration
- `today`: injections logged in the last 24 hours
- `next`: next scheduled doses
