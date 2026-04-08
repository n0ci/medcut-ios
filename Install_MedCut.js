// Paste this once in Scriptable as: Install_MedCut

const BASE = "https://raw.githubusercontent.com/n0ci/medcut-ios/main/"
const SHORTCUT_CATALOG_URL = BASE + "docs/shortcuts.json"
const SHORTCUT_CATALOG_PAGE = "https://github.com/n0ci/medcut-ios/blob/main/docs/Official_Shortcuts.md"
const FILES = ["MedCut.js"]
const fm = FileManager.iCloud()

function publishedShortcutEntries(catalog) {
  if (!catalog || !Array.isArray(catalog.shortcuts)) return []
  return catalog.shortcuts.filter(item => {
    const url = String(item && item.icloud_url || "").trim()
    const status = String(item && item.status || "").trim().toLowerCase()
    const kind = String(item && item.kind || "").trim().toLowerCase()
    return kind !== "installer" && status === "published" && /^https:\/\/(www\.)?icloud\.com\/shortcuts\//.test(url)
  })
}

async function loadShortcutCatalog() {
  try {
    return await new Request(SHORTCUT_CATALOG_URL).loadJSON()
  } catch (error) {
    return null
  }
}

async function presentShortcutCatalog(catalog) {
  const published = publishedShortcutEntries(catalog)
  if (!published.length) {
    Safari.open((catalog && catalog.catalog_url) || SHORTCUT_CATALOG_PAGE)
    return
  }

  const picker = new Alert()
  picker.title = "Official Shortcuts"
  picker.message = "Install one of the core MedCut shortcuts."
  for (const item of published) {
    picker.addAction(item.name)
  }
  picker.addAction("Open catalog")
  picker.addCancelAction("Done")

  const choice = await picker.presentSheet()
  if (choice === -1) return
  if (choice < published.length) {
    Safari.open(published[choice].icloud_url)
    return
  }
  Safari.open((catalog && catalog.catalog_url) || SHORTCUT_CATALOG_PAGE)
}

try {
  for (const name of FILES) {
    const text = await new Request(BASE + name).loadString()
    fm.writeString(fm.joinPath(fm.documentsDirectory(), name), text)
  }

  const shortcutCatalog = await loadShortcutCatalog()
  const publishedShortcuts = publishedShortcutEntries(shortcutCatalog)

  const done = new Alert()
  done.title = "MedCut installed"
  done.message = publishedShortcuts.length
    ? "Open MedCut now or install the official shortcuts?"
    : "Open MedCut now? The official shortcut catalog is available from the repo."
  done.addAction("Open MedCut")
  done.addAction("Shortcuts")
  done.addCancelAction("Later")
  const choice = await done.presentAlert()
  if (choice === 0) {
    Safari.open("scriptable:///run/MedCut")
  } else if (choice === 1) {
    await presentShortcutCatalog(shortcutCatalog)
  }
} catch (e) {
  const fail = new Alert()
  fail.title = "Install failed"
  fail.message = String(e)
  fail.addAction("OK")
  await fail.presentAlert()
}

Script.complete()
