// MedCut bootstrap installer for Scriptable.
// Run this once to install MedCut.js and MedCutDashboard.js automatically.

const APP_NAME = "MedCut Installer"
const REPO_BASE = "https://raw.githubusercontent.com/n0ci/medcut-ios/main/"
const fm = FileManager.iCloud()

function documentsPath() {
  return fm.documentsDirectory()
}

function scriptPath(fileName) {
  return fm.joinPath(documentsPath(), fileName)
}

async function fetchText(relativePath) {
  const request = new Request(REPO_BASE + relativePath)
  return await request.loadString()
}

async function installFile(fileName, relativePath) {
  const content = await fetchText(relativePath)
  fm.writeString(scriptPath(fileName), content)
}

async function showDone() {
  const alert = new Alert()
  alert.title = APP_NAME
  alert.message = "MedCut and MedCutDashboard are installed. Open MedCut to finish setup."
  alert.addAction("Open MedCut")
  alert.addCancelAction("Close")
  const index = await alert.presentAlert()
  if (index === 0) {
    Safari.open("scriptable:///run?scriptName=MedCut")
  }
}

try {
  await installFile("MedCut.js", "MedCut.js")
  await installFile("MedCutDashboard.js", "MedCutDashboard.js")
  await showDone()
  Script.complete()
} catch (error) {
  const alert = new Alert()
  alert.title = APP_NAME
  alert.message = `Install failed: ${error && error.message ? error.message : error}`
  alert.addAction("OK")
  await alert.presentAlert()
  Script.complete()
}