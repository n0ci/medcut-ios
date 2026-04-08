# Shortcut Setup (Manual)

This file is for maintainers and advanced users who want to build shortcuts manually.

Most users should use the hosted public shortcut links in README.md.

## Required shortcuts

- Install MedCut
- Log Injection
- Open Tracker

## 1) Install MedCut shortcut

Goal: bootstrap script + starter data with one tap.

Actions:
1. URL
   - https://raw.githubusercontent.com/n0ci/medcut-ios/main/MedCut.js
2. Get Contents of URL
3. Save File
   - Service: iCloud Drive
   - Path: Shortcuts/MedCut.js (temporary)
4. URL
   - https://raw.githubusercontent.com/n0ci/medcut-ios/main/MedCutDashboard.js
5. Get Contents of URL
6. Save File
   - Service: iCloud Drive
   - Path: Shortcuts/MedCutDashboard.js (temporary)
7. URL
   - https://raw.githubusercontent.com/n0ci/medcut-ios/main/medications/peptides.json
8. Get Contents of URL
9. Save File
   - Service: iCloud Drive
   - Path: Scriptable/medications/peptides.json
   - If file exists: Ask
10. URL
   - https://raw.githubusercontent.com/n0ci/medcut-ios/main/history/peptides.json
11. Get Contents of URL
12. Save File
   - Service: iCloud Drive
   - Path: Scriptable/history/peptides.json
   - If file exists: Ask
13. Create Text
   - MedCut
14. Run Script (Scriptable)
   - Script: MedCut
   - Input: {"action":"dashboard"}
15. Show Notification
   - MedCut installed

Notes:
- iOS Shortcuts cannot always write directly into Scriptable app scripts in all setups.
- If your setup cannot write the script automatically, fall back to opening the raw script URL and sharing into Scriptable.

## 2) Log Injection shortcut

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
5. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above
6. Show Result or Notification

Optional fields:
- notes: free text

## 3) Open Tracker shortcut

Actions:
1. Dictionary
   - action = dashboard
2. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above

## 4) Optional Add Protocol shortcut

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
7. Run Script (Scriptable)
   - Script: MedCut
   - Input: Dictionary above

## 5) JSON contract reminders

- The script accepts a dictionary or JSON string.
- `category` is optional; when provided it targets a specific medication category file.
- Action values:
  - log
  - add_protocol
  - dashboard (or open)
  - summary

## Category file auto-discovery

- MedCut auto-discovers files named `<category>.json` in both:
   - `iCloud Drive/Scriptable/medications`
   - `iCloud Drive/Scriptable/history`
- Example files:
   - `peptides.json`
   - `painkillers.json`

## 6) Safety language for public shortcuts

Use this wording in shortcut descriptions:
- Convenience tracking and visualization only.
- Not medical advice.
- Not dosing guidance.
