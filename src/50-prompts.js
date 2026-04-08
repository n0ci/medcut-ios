// ---------- Shortcut actions ----------
function shortcutOutput(payload) {
  Script.setShortcutOutput(payload)
}

function allMedicationFilePaths(data) {
  return Object.keys(data.__files).map(function(fileName) { return categoryFilePath(fileName) })
}

function allHistoryFilePaths(data) {
  return Object.keys(data.__files).map(function(fileName) { return historyFilePath(fileName) })
}

function buildBackupSnapshot(data) {
  const files = Object.keys(data.__files).sort()
  const snapshot = {
    app: APP_NAME,
    exported_at: iso(new Date()),
    schema_version: data.schema_version,
    medications: {},
    history: {}
  }

  files.forEach(function(fileName) {
    const fileState = data.__files[fileName]
    snapshot.medications[fileName] = {
      schema_version: data.schema_version,
      category: fileState.category,
      compounds: fileState.compounds
    }
    snapshot.history[fileName] = fileState.history
  })

  return snapshot
}

function exportBackupToFile(data) {
  const timestamp = iso(new Date()).replace(/[:.]/g, "-")
  const fileName = `medcut-backup-${timestamp}.json`
  const targetPath = fm.joinPath(exportDirPath(), fileName)
  writeJson(targetPath, buildBackupSnapshot(data))
  return targetPath
}

async function handleShortcut(data, input) {
  const action = String(input.action || "dashboard").toLowerCase()
  const uiMode = String(input.ui || "").toLowerCase()
  const returnDashboard = uiMode === "dashboard" || uiMode === "open"
  const handlers = {
    prompt_log: async function() {
      await promptLogInjection(data)
    },
    prompt_protocol: async function() {
      await promptAddProtocol(data)
    },
    menu: async function() {
      await showMenu(data)
    },
    dashboard: async function() {
      await presentDashboard(data)
    },
    open: async function() {
      await presentDashboard(data)
    },
    summary: async function() {
      shortcutOutput({
        ok: true,
        action: "summary",
        schema_version: data.schema_version,
        rows: summaryRows(data),
        files: allMedicationFilePaths(data),
        history_files: allHistoryFilePaths(data)
      })
    },
    export_backup: async function() {
      const backupPath = exportBackupToFile(data)
      if (!args.shortcutParameter) {
        await notify("Backup exported", backupPath)
      }
      shortcutOutput({
        ok: true,
        action: "export_backup",
        schema_version: data.schema_version,
        backup_file: backupPath
      })
    },
    add_protocol: async function() {
      addProtocolEntry(data, input)
      if (returnDashboard) {
        await presentDashboard(data)
        return
      }
      shortcutOutput({
        ok: true,
        action: "add_protocol",
        schema_version: data.schema_version,
        files: allMedicationFilePaths(data),
        history_files: allHistoryFilePaths(data)
      })
    },
    edit_protocol: async function() {
      const protocolId = normalizeText(input.protocol_id != null ? input.protocol_id : input.id)
      if (!protocolId) throw new Error("Missing protocol_id")
      updateProtocolEntry(data, protocolId, input)
      if (returnDashboard) {
        await presentDashboard(data)
        return
      }
      shortcutOutput({
        ok: true,
        action: "edit_protocol",
        schema_version: data.schema_version,
        protocol_id: protocolId
      })
    },
    delete_protocol: async function() {
      const protocolId = normalizeText(input.protocol_id != null ? input.protocol_id : input.id)
      if (!protocolId) throw new Error("Missing protocol_id")
      removeProtocolEntry(data, protocolId)
      if (returnDashboard) {
        await presentDashboard(data)
        return
      }
      shortcutOutput({
        ok: true,
        action: "delete_protocol",
        schema_version: data.schema_version,
        protocol_id: protocolId
      })
    },
    toggle_protocol: async function() {
      const protocolId = normalizeText(input.protocol_id != null ? input.protocol_id : input.id)
      if (!protocolId) throw new Error("Missing protocol_id")
      const enabled = String(input.enabled).toLowerCase() !== "false"
      toggleProtocolEntry(data, protocolId, enabled)
      if (returnDashboard) {
        await presentDashboard(data)
        return
      }
      shortcutOutput({
        ok: true,
        action: "toggle_protocol",
        schema_version: data.schema_version,
        protocol_id: protocolId,
        enabled: enabled
      })
    },
    log: async function() {
      const compound = normalizeCompoundKey(data, input.compound, input.category)
      if (!compound) throw new Error("Unknown compound: " + input.compound)
      const dose = toNumber(input.dose_mg != null ? input.dose_mg : input.dose, NaN)
      const time = input.time ? new Date(input.time) : new Date()
      const c = data.compounds[compound]

      addInjection(data, compound, dose, time, input.notes || "")
      if (returnDashboard) {
        await presentDashboard(data)
        return
      }
      shortcutOutput({
        ok: true,
        action: "log",
        schema_version: data.schema_version,
        compound: compound,
        display_name: c.display_name || titleCase(compound),
        category: c.category || DEFAULT_CATEGORY,
        dose_mg: dose,
        time: iso(time),
        file: categoryFilePath(c.source_file),
        history_file: historyFilePath(c.source_file)
      })
    },
    edit_injection: async function() {
      const injectionId = String(input.injection_id != null ? input.injection_id : input.id || "").trim()
      if (!injectionId) throw new Error("Missing injection_id")

      const compound = normalizeCompoundKey(data, input.compound, input.category)
      if (!compound) throw new Error("Unknown compound: " + input.compound)
      const dose = toNumber(input.dose_mg != null ? input.dose_mg : input.dose, NaN)
      const time = input.time ? new Date(input.time) : new Date()
      const c = data.compounds[compound]

      updateInjectionEntry(data, injectionId, compound, dose, time, input.notes || "")
      if (returnDashboard) {
        await presentDashboard(data)
        return
      }
      shortcutOutput({
        ok: true,
        action: "edit_injection",
        schema_version: data.schema_version,
        injection_id: injectionId,
        compound: compound,
        display_name: c.display_name || titleCase(compound),
        category: c.category || DEFAULT_CATEGORY,
        dose_mg: dose,
        time: iso(time),
        file: categoryFilePath(c.source_file),
        history_file: historyFilePath(c.source_file)
      })
    },
    delete_injection: async function() {
      const injectionId = String(input.injection_id != null ? input.injection_id : input.id || "").trim()
      if (!injectionId) throw new Error("Missing injection_id")

      const removed = removeInjectionEntry(data, injectionId)
      if (returnDashboard) {
        await presentDashboard(data)
        return
      }

      const c = data.compounds[removed.compound]
      shortcutOutput({
        ok: true,
        action: "delete_injection",
        schema_version: data.schema_version,
        injection_id: removed.id,
        compound: removed.compound,
        display_name: c ? (c.display_name || titleCase(removed.compound)) : titleCase(removed.compound),
        history_file: historyFilePath(removed.source_file)
      })
    }
  }

  const handler = handlers[action]
  if (!handler) throw new Error("Unsupported action: " + action)
  await handler()
}

async function presentError(error) {
  const message = safeErrorMessage(error)
  if (args.shortcutParameter) {
    shortcutOutput({ ok: false, error: message, file: medicationsDirPath() })
    return
  }

  const alert = new Alert()
  alert.title = `${APP_NAME} Error`
  alert.message = message
  alert.addAction("OK")
  await alert.presentAlert()
}
