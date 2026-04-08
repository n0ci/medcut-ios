# MedCut

**One-tap tracking with Apple Shortcuts**

MedCut is a lightweight iPhone tracker powered by Scriptable, Apple Shortcuts, and iCloud Drive JSON.

It is designed to feel like an app without building or maintaining a native app.

## Why MedCut

- Fast logging from Apple Shortcuts
- Rich Scriptable dashboard with filters and overlays
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

This installer downloads and installs both app scripts automatically:
- [MedCut.js](MedCut.js)
- [MedCutDashboard.js](MedCutDashboard.js)

You only paste once.

### 3. Open MedCut once
Run MedCut in Scriptable one time to grant permissions and let it create the starter data files automatically.

### 4. Optional: add shortcuts later
Shortcuts are optional and only for convenience/automation after install:
- Quick log action
- Quick open dashboard
- Siri / automation triggers

### 5. Optional widget
Add a Scriptable widget and select MedCut.

## Hosted distribution model

Raw files:
- Bootstrap helper: https://raw.githubusercontent.com/n0ci/medcut-ios/main/Install_MedCut.js
- Script URL: https://raw.githubusercontent.com/n0ci/medcut-ios/main/MedCut.js
- Dashboard module URL: https://raw.githubusercontent.com/n0ci/medcut-ios/main/MedCutDashboard.js

No manual data-file install is required. MedCut creates the starter `medications/` and `history/` files on first launch.

Published shortcuts:
- Install MedCut
- Log Injection
- Open Tracker
- Optional Add Protocol

Shortcut role:
- Not required for installation
- Recommended for daily-use speed

Install behavior requirements:
- Ensure script is created/updated in Scriptable as `MedCut`
- Ensure dashboard module is created/updated in Scriptable as `MedCutDashboard`
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

### Open dashboard
```json
{
  "action": "dashboard"
}
```

### Summary
```json
{
  "action": "summary"
}
```

## Data schema

Source of truth is split by concern:

- Definitions: `iCloud Drive/Scriptable/medications/<category>.json`
- History: `iCloud Drive/Scriptable/history/<category>.json`

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

## Which data file should I use?

- MedCut creates starter files automatically on first launch.
- If you want to edit presets later, use `medications/peptides.json` for peptide tracking and `medications/painkillers.json` for the example painkiller category.

## Repo layout

- `Install_MedCut.js`: bootstrap installer that downloads the app scripts automatically
- `MedCut.js`: main Scriptable app
- `MedCutDashboard.js`: dashboard frontend module (WebView HTML/CSS/JS)
- `medications/peptides.json`: category template (peptides)
- `medications/painkillers.json`: category template (painkillers example)
- `history/peptides.json`: starter history template (peptides)
- `history/painkillers.json`: starter history template (painkillers example)
- `Shortcut_Setup.md`: manual shortcut builder instructions
- `docs/RELEASE_CHECKLIST.md`: release workflow

## Contributor notes

Keep the stack lightweight:
- Scriptable runtime/UI/charting
- Apple Shortcuts install + logging flow
- iCloud Drive JSON storage

Avoid native app rewrites.
