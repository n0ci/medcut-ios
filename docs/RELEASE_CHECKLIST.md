# Release Checklist

## 1) Pre-release code checks

- [ ] MedCut.js opens and runs in Scriptable on iPhone
- [ ] Widget renders without crashes
- [ ] Shortcut actions still work: log, add_protocol, dashboard/open, summary
- [ ] Empty-state UX is readable and actionable
- [ ] Multi-compound dashboard and chart render correctly
- [ ] Confidence labels and caveat language are present

## 2) Schema and migration checks

- [ ] Current schema_version is 1 in medications/*.json and history/*.json starter files
- [ ] Legacy injection records with dose field are normalized to dose_mg
- [ ] Invalid records are handled safely (no crash)
- [ ] Migrated data writes back to the correct category files in iCloud Drive (medications + history)

## 3) Distribution checks

- [ ] Raw script URL points to latest MedCut.js
- [ ] Raw script URL points to latest MedCutDashboard.js
- [ ] Raw starter JSON URL points to latest medications/peptides.json
- [ ] Raw starter JSON URL points to latest history/peptides.json
- [ ] README links updated with current public shortcut URLs

## 4) Shortcut checks

- [ ] Install MedCut shortcut runs end-to-end on a clean device
- [ ] Log Injection shortcut logs a record successfully
- [ ] Optional category parameter routes logs to the expected category file
- [ ] Open Tracker shortcut opens dashboard
- [ ] Optional Add Protocol shortcut creates a valid schedule
- [ ] Shortcut descriptions include safety/disclaimer language

## 5) Documentation checks

- [ ] README install section matches real user flow
- [ ] Shortcut_Setup.md matches current payload contract

## 6) Release notes

Include:
- onboarding or install-flow changes
- schema changes and migration behavior
- UI/chart improvements
- bug fixes
- known limitations and confidence caveats

## 7) Final publish

- [ ] Create git tag/release
- [ ] Publish changelog
- [ ] Smoke test links from release page on iPhone
