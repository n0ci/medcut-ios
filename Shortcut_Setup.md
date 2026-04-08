# Shortcut Setup (Optional)

This file is for maintainers and advanced users who want to build shortcuts manually.

Most users do not need shortcuts to install MedCut. Install first with [Install_MedCut.js](Install_MedCut.js), then optionally add shortcuts for faster daily use.

## Optional shortcuts

- Log Injection
- Open Tracker
- Add Protocol
- Quick Log and reopen dashboard
- Export Backup

## 1) Log Injection shortcut

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

## 2) Open Tracker shortcut

Actions:
1. Dictionary
   - action = dashboard
2. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above

## 3) Optional Add Protocol shortcut

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

## 4) Edit or delete recent injections

These are usually faster from the in-app history list because the dashboard already exposes inline Edit/Delete controls.

If you need automation:
- `edit_injection` requires `injection_id`, `compound`, `dose_mg`, and `time`
- `delete_injection` requires `injection_id`
- `edit_protocol` requires `protocol_id` plus the fields you want to update
- `toggle_protocol` requires `protocol_id` and `enabled`
- `delete_protocol` requires `protocol_id`
- both can include `ui = dashboard` to return to the refreshed dashboard after the action

## 5) Export backup shortcut

Actions:
1. Dictionary
   - action = export_backup
2. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above
3. Optional:
   - read the returned `backup_file`
   - move/share the exported JSON file as needed for archival

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
