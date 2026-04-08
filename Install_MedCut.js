// Paste this once in Scriptable as: Install_MedCut

const BASE = "https://raw.githubusercontent.com/n0ci/medcut-ios/main/"
const FILES = ["MedCut.js"]
const fm = FileManager.iCloud()

try {
  for (const name of FILES) {
    const text = await new Request(BASE + name).loadString()
    fm.writeString(fm.joinPath(fm.documentsDirectory(), name), text)
  }

  const done = new Alert()
  done.title = "MedCut installed"
  done.message = "Open MedCut now?"
  done.addAction("Open")
  done.addCancelAction("Later")
  if (await done.presentAlert() === 0) Safari.open("scriptable:///run/MedCut")
} catch (e) {
  const fail = new Alert()
  fail.title = "Install failed"
  fail.message = String(e)
  fail.addAction("OK")
  await fail.presentAlert()
}

Script.complete()