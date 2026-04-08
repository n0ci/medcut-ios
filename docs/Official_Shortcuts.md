# Official Shortcuts

This page is the public catalog for the MedCut shortcut pack.

The core shortcut set is:

- `Install MedCut`
- `Open Dashboard`
- `Quick Log`
- `Add Schedule`

MedCut already supports the runtime actions behind these shortcuts. This catalog is the repo-tracked source of truth for their names, purpose, and published iCloud links.

## Current status

The catalog is wired up, but the iCloud shortcut links are not published in the repo yet.

When you are ready to publish them:

1. Publish each shortcut from Shortcuts on iPhone or iPad.
2. Paste the iCloud link into [`docs/shortcuts.json`](/Users/noci/repo/peptide-tracker-ios/docs/shortcuts.json).
3. Change the shortcut `status` to `published`.

After that:

- the README can link directly to the official shortcuts
- `Install_MedCut.js` will start offering the official shortcut pack after install

## Catalog

| Shortcut | Role | Purpose | Current status |
| --- | --- | --- | --- |
| Install MedCut | installer | Installs or updates MedCut in Scriptable and points the user at the shortcut pack. | unpublished |
| Open Dashboard | core | Opens the MedCut dashboard directly. | unpublished |
| Quick Log | core | Logs one entry and returns to the updated dashboard. | unpublished |
| Add Schedule | core | Creates a recurring schedule and returns to the updated dashboard. | unpublished |

## Manual fallback

If the official links are still unpublished, use [Shortcut_Setup.md](/Users/noci/repo/peptide-tracker-ios/Shortcut_Setup.md) to build the shortcuts manually.
