# Shortcut Setup (Optional)

This file is the manual fallback for maintainers and advanced users who want to build shortcuts manually.

The official shortcut pack is tracked in:

- [docs/Official_Shortcuts.md](docs/Official_Shortcuts.md)
- [docs/shortcuts.json](docs/shortcuts.json)

Install first with [Install_MedCut.js](Install_MedCut.js). If published iCloud shortcut links exist in the catalog, the installer will offer them automatically. Use the instructions below when those links are not published yet or when you want to recreate the shortcuts manually.

## Optional shortcuts

- Install MedCut (official published shortcut entry; not manually built here)
- Open Dashboard
- Quick Log
- Add Schedule
- Export Backup

## 1) Quick Log shortcut

Goal: fast logging with a dictionary payload.

Actions:
1. Choose from List
   - Use display names (for example Tirzepatide, Semaglutide)
2. Ask for Input
   - Prompt: Dose (mg)
   - Type: Number
3. Current Date
4. Dictionary
   - action = log
   - category = peptides (optional)
   - compound = chosen list value
   - dose_mg = number input
   - time = current date
   - ui = dashboard (optional, reopens the updated dashboard after save)
5. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above
6. Show Result or Notification

Optional fields:
- notes: free text

## 2) Open Dashboard shortcut

Actions:
1. Dictionary
   - action = dashboard
2. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above

## 3) Add Schedule shortcut

Actions:
1. Choose from List (compound)
2. Ask for Input (dose mg)
3. Ask for Input (every how many days, default 7)
4. Ask for Input (occurrences, optional)
5. Ask for Date or Current Date (start)
6. Dictionary
   - action = add_protocol
   - category = peptides (optional)
   - compound = chosen list value
   - dose_mg = dose input
   - every_days = interval input
   - occurrences = optional input
   - start = selected date
   - enabled = true
   - ui = dashboard (optional, reopens dashboard after save)
7. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above

## 4) Export backup shortcut

Actions:
1. Dictionary
   - action = export_backup
2. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above
3. Optional:
   - read the returned `backup_file`
   - move/share the exported JSON file as needed for archival

## 5) Edit or delete recent injections

These are usually faster from the in-app history list because the dashboard already exposes inline Edit/Delete controls.

If you need automation:
- `edit_injection` requires `injection_id`, `compound`, `dose_mg`, and `time`
- `delete_injection` requires `injection_id`
- `edit_protocol` requires `protocol_id` plus the fields you want to update
- `toggle_protocol` requires `protocol_id` and `enabled`
- `delete_protocol` requires `protocol_id`
- both can include `ui = dashboard` to return to the refreshed dashboard after the action

## 6) JSON contract reminders

- The script accepts a dictionary or JSON string.
- `category` is optional; when provided it targets a specific medication category file.
- Action values:
  - log
  - edit_injection
  - delete_injection
  - add_protocol
  - edit_protocol
  - toggle_protocol
  - delete_protocol
  - dashboard (or open)
  - summary
  - export_backup
- `ui = dashboard` or `ui = open` makes mutating actions reopen the dashboard instead of only returning shortcut output

## Category file auto-discovery

- MedCut auto-discovers files named `<category>.json` in both:
   - `iCloud Drive/Scriptable/MedCut/medications`
   - `iCloud Drive/Scriptable/MedCut/history`
- Example files:
   - `peptides.json`
   - `painkillers.json`

## 7) Safety language for public shortcuts

Use this wording in shortcut descriptions:
- Convenience tracking and visualization only.
- Not medical advice.
- Not dosing guidance.
