// ---------- In-app prompts ----------
async function chooseCompound(data, prompt) {
  const names = compoundNames(data)
  if (!names.length) return null

  const multiCategory = (data.categories || []).length > 1

  const alert = new Alert()
  alert.title = prompt || "Choose compound"
  for (const name of names) {
    const c = data.compounds[name]
    const base = c.display_name || titleCase(name)
    alert.addAction(multiCategory ? `${base} (${c.category || DEFAULT_CATEGORY})` : base)
  }
  alert.addCancelAction("Cancel")
  const idx = await alert.presentSheet()
  if (idx === -1) return null
  return names[idx]
}

async function promptLogInjection(data) {
  const compound = await chooseCompound(data, "Log injection")
  if (!compound) return

  const alert = new Alert()
  alert.title = data.compounds[compound].display_name || titleCase(compound)
  alert.message = "Enter dose in mg"
  alert.addTextField("Dose mg", "")
  alert.addAction("Use current time")
  alert.addCancelAction("Cancel")

  const idx = await alert.presentAlert()
  if (idx === -1) return

  const dose = toNumber(alert.textFieldValue(0), NaN)
  addInjection(data, compound, dose, new Date(), "")
  await notify(`${data.compounds[compound].display_name || titleCase(compound)} logged`, `${dose} mg at ${formatDateTime(new Date())}`)
}

async function promptAddProtocol(data) {
  const compound = await chooseCompound(data, "Add repeating schedule")
  if (!compound) return

  const alert = new Alert()
  alert.title = `Schedule: ${data.compounds[compound].display_name || titleCase(compound)}`
  alert.message = "Start now. Add dose, interval, and optional occurrence count."
  alert.addTextField("Dose mg", "")
  alert.addTextField("Every how many days?", "7")
  alert.addTextField("How many doses? (optional)", "")
  alert.addAction("Save")
  alert.addCancelAction("Cancel")
  const idx = await alert.presentAlert()
  if (idx === -1) return

  addProtocolEntry(data, {
    compound: compound,
    start: new Date(),
    dose_mg: toNumber(alert.textFieldValue(0), NaN),
    every_days: toNumber(alert.textFieldValue(1), 7),
    occurrences: alert.textFieldValue(2).trim() ? toNumber(alert.textFieldValue(2), null) : null,
    enabled: true
  })

  await notify("Schedule saved", `${data.compounds[compound].display_name || titleCase(compound)} every ${alert.textFieldValue(1)} days`)
}

async function notify(title, body) {
  const n = new Notification()
  n.title = title
  n.body = body
  await n.schedule()
}

async function showMenu(data) {
  const alert = new Alert()
  alert.title = APP_NAME
  alert.message = "Choose an action"
  alert.addAction("Dashboard")
  alert.addAction("Log injection")
  alert.addAction("Add repeating schedule")
  alert.addAction("Export backup")
  alert.addAction("Show data files")
  alert.addCancelAction("Cancel")

  const idx = await alert.presentSheet()
  if (idx === 0) return presentDashboard(data)
  if (idx === 1) return promptLogInjection(data)
  if (idx === 2) return promptAddProtocol(data)
  if (idx === 3) {
    const backupPath = exportBackupToFile(data)
    await notify("Backup exported", backupPath)
    return
  }
  if (idx === 4) {
    const info = new Alert()
    info.title = "Data files"
    info.message = Object.keys(data.__files)
      .map(function(fileName) {
        return `MedCut/medications/${fileName}\nMedCut/history/${fileName}`
      })
      .join("\n")
    info.addAction("OK")
    await info.presentAlert()
  }
}
