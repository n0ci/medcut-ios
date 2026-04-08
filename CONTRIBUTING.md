# Contributing

Thanks for contributing.

## Principles

- Keep setup simple on iPhone
- Prefer JSON + Scriptable + Shortcuts over heavy infrastructure
- Mark weak / placeholder PK parameters clearly
- Avoid presenting estimates as clinical truth

## Development workflow

1. Edit source files in `src/`
2. Run `npm run build` to regenerate `MedCut.js`
3. Run `npm test`
4. Run `npm run format:check`
5. Test in Scriptable on iPhone
6. Update docs when behavior changes

## Good first contributions

- Improve dashboard status clarity or quick-log ergonomics
- Improve chart aesthetics
- Add export/import helpers
- Add more compound presets with cited parameter notes
- Improve Shortcut setup docs
- Add theme options for widgets and dashboard

## Notes for UI changes

- Optimize for fast daily use on iPhone first
- Keep advanced controls collapsed unless a task clearly benefits from always-visible complexity
- Preserve Scriptable WebView constraints and mobile touch behavior
- If you change dashboard structure or shortcut contracts, update `README.md`, `Shortcut_Setup.md`, and `docs/shortcuts.json` when the official shortcut pack is affected
- If you change CI or formatting expectations, update `.github/workflows/ci.yml`, `package.json`, and contributor docs together
