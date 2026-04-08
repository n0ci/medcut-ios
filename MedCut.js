// MedCut for Scriptable
// Source of truth: iCloud Drive / Scriptable / medication JSON files.
// This is a convenience visualization tool, not a medical device.

const APP_NAME = "MedCut"
const CATEGORY_DIR = "medications"
const HISTORY_DIR = "history"
const CATEGORY_FILE_SUFFIX = ".json"
const DEFAULT_CATEGORY = "peptides"
const SCHEMA_VERSION = 1
const MAX_PROTOCOL_EVENTS = 1500
const HISTORY_LOOKBACK_DAYS = 365
const COLOR_PALETTE = [
  "#56CCF2", "#6FCF97", "#F2C94C", "#EB5757", "#BB6BD9",
  "#2D9CDB", "#27AE60", "#F2994A", "#9B51E0", "#E91E63"
]

const MODEL_CONFIDENCE = {
  good: { label: "Higher confidence", badge: "good" },
  rough: { label: "Exploratory model", badge: "rough" },
  low: { label: "Low confidence", badge: "low" }
}

const dashboardRenderer = loadDashboardRenderer()

function loadDashboardRenderer() {
  try {
    return importModule("MedCutDashboard")
  } catch (error) {
    return null
  }
}

const fm = FileManager.iCloud()

function filePath(fileName) {
  return fm.joinPath(fm.documentsDirectory(), fileName)
}

function medicationsDirPath() {
  return filePath(CATEGORY_DIR)
}

function historyDirPath() {
  return filePath(HISTORY_DIR)
}

function categoryFilePath(fileName) {
  return fm.joinPath(medicationsDirPath(), fileName)
}

function historyFilePath(fileName) {
  return fm.joinPath(historyDirPath(), fileName)
}

function normalizeCategoryName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function makeCategoryFileName(category) {
  const safe = normalizeCategoryName(category) || DEFAULT_CATEGORY
  return `${safe}${CATEGORY_FILE_SUFFIX}`
}

function categoryFromFileName(fileName) {
  const match = /^([a-z0-9_-]+)\.json$/i.exec(fileName)
  if (match) return normalizeCategoryName(match[1]) || DEFAULT_CATEGORY
  const fallback = fileName.replace(/\.json$/i, "")
  return normalizeCategoryName(fallback) || DEFAULT_CATEGORY
}

function makeCompoundId(category, baseKey) {
  return `${normalizeCategoryName(category) || DEFAULT_CATEGORY}::${baseKey}`
}

function splitCompoundId(value) {
  const parts = String(value || "").split("::")
  if (parts.length !== 2) return null
  return { category: parts[0], base_key: parts[1] }
}

// ---------- General helpers ----------
function toNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value)
}

function titleCase(s) {
  if (!s) return ""
  return String(s)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, function(c) { return c.toUpperCase() })
}

function iso(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) throw new Error("Invalid date value")
  return d.toISOString()
}

function dt(value) {
  return new Date(value)
}

function isValidDate(value) {
  return value instanceof Date && !isNaN(value.getTime())
}

function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / 86400000
}

function formatDateTime(d) {
  const df = new DateFormatter()
  df.useMediumDateStyle()
  df.useShortTimeStyle()
  return df.string(d)
}

function formatShortDateTime(d) {
  const df = new DateFormatter()
  df.dateFormat = "MMM d, HH:mm"
  return df.string(d)
}

function formatRelativeTime(target, now) {
  const diffMs = target.getTime() - now.getTime()
  const hours = Math.round(diffMs / 3600000)
  if (Math.abs(hours) < 36) {
    return hours >= 0 ? `in ${hours}h` : `${Math.abs(hours)}h ago`
  }
  const days = Math.round(diffMs / 86400000)
  return days >= 0 ? `in ${days}d` : `${Math.abs(days)}d ago`
}

function safeErrorMessage(error) {
  if (!error) return "Unknown error"
  if (typeof error === "string") return error
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function parseShortcutInput() {
  const p = args.shortcutParameter
  if (!p) return null
  if (typeof p === "string") {
    try {
      return JSON.parse(p)
    } catch (error) {
      return { action: p }
    }
  }
  return p
}

function makeId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${rand}`
}

// ---------- Schema + storage ----------
function buildStarterMedicationData(category) {
  return {
    schema_version: SCHEMA_VERSION,
    category: normalizeCategoryName(category) || DEFAULT_CATEGORY,
    compounds: {
      tirzepatide: {
        display_name: "Tirzepatide",
        half_life_days: 5.0,
        bioavailability: 0.8,
        vd_l: 9.7,
        route: "subcutaneous",
        model_quality: "good",
        color: "#56CCF2",
        notes: "Reference-like profile compared to many exploratory entries."
      }
    }
  }
}

function buildStarterHistoryData(category) {
  return {
    schema_version: SCHEMA_VERSION,
    category: normalizeCategoryName(category) || DEFAULT_CATEGORY,
    injections: [],
    protocols: []
  }
}

function listCategoryFilesInDir(dirPath) {
  if (!fm.fileExists(dirPath)) return []
  const names = fm.listContents(dirPath)
  const files = names.filter(function(name) {
    return /^[a-z0-9_-]+\.json$/i.test(name)
  })
  files.sort()
  return files
}

function readJson(pathValue) {
  const rawText = fm.readString(pathValue)
  try {
    return JSON.parse(rawText)
  } catch (error) {
    throw new Error(`Data file is not valid JSON: ${pathValue}`)
  }
}

function writeJson(pathValue, value) {
  fm.writeString(pathValue, JSON.stringify(value, null, 2))
}

async function ensureDataFiles() {
  if (!fm.fileExists(medicationsDirPath())) {
    fm.createDirectory(medicationsDirPath(), true)
  }
  if (!fm.fileExists(historyDirPath())) {
    fm.createDirectory(historyDirPath(), true)
  }

  const medicationFiles = listCategoryFilesInDir(medicationsDirPath())
  if (!medicationFiles.length) {
    const starter = buildStarterMedicationData(DEFAULT_CATEGORY)
    writeJson(categoryFilePath(makeCategoryFileName(DEFAULT_CATEGORY)), starter)
  }
}

    function normalizeQuality(value) {
      const q = String(value || "rough").toLowerCase()
      if (q === "good" || q === "rough" || q === "low") return q
      return "rough"
    }

    function normalizeCompound(name, c, index) {
      const compound = isObject(c) ? c : {}
      return {
        display_name: compound.display_name || titleCase(name),
        half_life_days: Math.max(0.001, toNumber(compound.half_life_days, 1)),
        bioavailability: Math.max(0, toNumber(compound.bioavailability, 1)),
        vd_l: Math.max(0.001, toNumber(compound.vd_l, 10)),
        route: compound.route || "unknown",
        model_quality: normalizeQuality(compound.model_quality),
        color: compound.color || COLOR_PALETTE[index % COLOR_PALETTE.length],
        notes: compound.notes || ""
      }
    }

    function migrateMedicationData(rawData, fallbackCategory) {
      const data = isObject(rawData) ? rawData : {}
      const category = normalizeCategoryName(data.category || fallbackCategory) || DEFAULT_CATEGORY
      const compoundsInput = isObject(data.compounds) ? data.compounds : {}
      const compounds = {}
      const names = Object.keys(compoundsInput)

      for (let i = 0; i < names.length; i++) {
        const name = names[i]
        compounds[name] = normalizeCompound(name, compoundsInput[name], i)
      }

      return {
        schema_version: SCHEMA_VERSION,
        category: category,
        compounds: compounds
      }
    }

    function migrateInjection(injection, compounds) {
      if (!isObject(injection)) return null
      const compound = String(injection.compound || "").trim()
      if (!compound || !compounds[compound]) return null

      const dose = toNumber(injection.dose_mg != null ? injection.dose_mg : injection.dose, NaN)
      const time = new Date(injection.time)
      if (!Number.isFinite(dose) || dose <= 0 || !isValidDate(time)) return null

      return {
        id: injection.id || makeId("inj"),
        compound: compound,
        dose_mg: dose,
        time: iso(time),
        source: injection.source || "log",
        notes: injection.notes || ""
      }
    }

    function migrateProtocol(protocol, compounds) {
      if (!isObject(protocol)) return null
      const compound = String(protocol.compound || "").trim()
      if (!compound || !compounds[compound]) return null

      const start = new Date(protocol.start)
      const dose = toNumber(protocol.dose_mg != null ? protocol.dose_mg : protocol.dose, NaN)
      const everyDays = toNumber(protocol.every_days, 7)
      const occurrences = protocol.occurrences == null || protocol.occurrences === ""
        ? null
        : toNumber(protocol.occurrences, null)
      const until = protocol.until ? new Date(protocol.until) : null

      if (!isValidDate(start) || !Number.isFinite(dose) || dose <= 0 || !Number.isFinite(everyDays) || everyDays <= 0) {
        return null
      }

      return {
        id: protocol.id || makeId("pro"),
        compound: compound,
        start: iso(start),
        dose_mg: dose,
        every_days: everyDays,
        occurrences: Number.isFinite(occurrences) ? Math.max(0, Math.floor(occurrences)) : null,
        until: until && isValidDate(until) ? iso(until) : null,
        enabled: protocol.enabled !== false,
        notes: protocol.notes || ""
      }
    }

    function migrateHistoryData(rawData, compounds, fallbackCategory) {
      const data = isObject(rawData) ? rawData : {}
      const category = normalizeCategoryName(data.category || fallbackCategory) || DEFAULT_CATEGORY
      const injectionsInput = Array.isArray(data.injections) ? data.injections : []
      const protocolsInput = Array.isArray(data.protocols) ? data.protocols : []

      const injections = injectionsInput
        .map(function(injection) { return migrateInjection(injection, compounds) })
        .filter(Boolean)
        .sort(function(a, b) { return dt(a.time) - dt(b.time) })

      const protocols = protocolsInput
        .map(function(protocol) { return migrateProtocol(protocol, compounds) })
        .filter(Boolean)
        .sort(function(a, b) { return dt(a.start) - dt(b.start) })

      return {
        schema_version: SCHEMA_VERSION,
        category: category,
        injections: injections,
        protocols: protocols
      }
    }

    function saveMedicationFile(fileName, data) {
      const migrated = migrateMedicationData(data, categoryFromFileName(fileName))
      writeJson(categoryFilePath(fileName), migrated)
    }

    function saveHistoryFile(fileName, data, compounds) {
      const migrated = migrateHistoryData(data, compounds || {}, categoryFromFileName(fileName))
      writeJson(historyFilePath(fileName), migrated)
    }

    async function migrateCombinedMedicationFiles() {
      const medicationFiles = listCategoryFilesInDir(medicationsDirPath())

      for (const fileName of medicationFiles) {
        const medPath = categoryFilePath(fileName)
        await fm.downloadFileFromiCloud(medPath)
        const parsed = readJson(medPath)

        const hasCombined = Array.isArray(parsed.injections) || Array.isArray(parsed.protocols)
        if (!hasCombined) continue

        const migratedMedication = migrateMedicationData(parsed, categoryFromFileName(fileName))
        const existingHistoryPath = historyFilePath(fileName)
        let historyRaw = buildStarterHistoryData(migratedMedication.category)

        if (fm.fileExists(existingHistoryPath)) {
          await fm.downloadFileFromiCloud(existingHistoryPath)
          historyRaw = readJson(existingHistoryPath)
        }

        const mergedHistoryRaw = {
          schema_version: SCHEMA_VERSION,
          category: migratedMedication.category,
          injections: (Array.isArray(historyRaw.injections) ? historyRaw.injections : []).concat(Array.isArray(parsed.injections) ? parsed.injections : []),
          protocols: (Array.isArray(historyRaw.protocols) ? historyRaw.protocols : []).concat(Array.isArray(parsed.protocols) ? parsed.protocols : [])
        }

        saveMedicationFile(fileName, migratedMedication)
        saveHistoryFile(fileName, mergedHistoryRaw, migratedMedication.compounds)
      }
    }

    async function loadMedicationFile(fileName) {
      const p = categoryFilePath(fileName)
      await fm.downloadFileFromiCloud(p)
      return migrateMedicationData(readJson(p), categoryFromFileName(fileName))
    }

    async function loadHistoryFile(fileName, compounds) {
      const p = historyFilePath(fileName)
      if (!fm.fileExists(p)) {
        const starter = buildStarterHistoryData(categoryFromFileName(fileName))
        saveHistoryFile(fileName, starter, compounds)
      }

      await fm.downloadFileFromiCloud(p)
      return migrateHistoryData(readJson(p), compounds, categoryFromFileName(fileName))
    }

    async function loadData() {
      await ensureDataFiles()
      await migrateCombinedMedicationFiles()

      const medicationFiles = listCategoryFilesInDir(medicationsDirPath())
      const historyFiles = listCategoryFilesInDir(historyDirPath())
      const allFiles = Array.from(new Set(medicationFiles.concat(historyFiles))).sort()

      const merged = {
        schema_version: SCHEMA_VERSION,
        compounds: {},
        injections: [],
        protocols: [],
        categories: [],
        __files: {}
      }

      for (const fileName of allFiles) {
        const medicationData = medicationFiles.includes(fileName)
          ? await loadMedicationFile(fileName)
          : buildStarterMedicationData(categoryFromFileName(fileName))

        const historyData = await loadHistoryFile(fileName, medicationData.compounds)
        const category = normalizeCategoryName(medicationData.category || historyData.category || categoryFromFileName(fileName)) || DEFAULT_CATEGORY

        merged.__files[fileName] = {
          category: category,
          compounds: medicationData.compounds,
          history: historyData
        }
        merged.categories.push(category)

        const baseNames = Object.keys(medicationData.compounds)
        for (const baseName of baseNames) {
          const compoundId = makeCompoundId(category, baseName)
          const c = medicationData.compounds[baseName]
          merged.compounds[compoundId] = {
            display_name: c.display_name,
            half_life_days: c.half_life_days,
            bioavailability: c.bioavailability,
            vd_l: c.vd_l,
            route: c.route,
            model_quality: c.model_quality,
            color: c.color,
            notes: c.notes || "",
            category: category,
            base_key: baseName,
            source_file: fileName
          }
        }

        for (const injection of historyData.injections) {
          const compoundId = makeCompoundId(category, injection.compound)
          if (!merged.compounds[compoundId]) continue
          merged.injections.push({
            id: injection.id,
            compound: compoundId,
            dose_mg: injection.dose_mg,
            time: injection.time,
            source: injection.source,
            notes: injection.notes || "",
            category: category,
            source_file: fileName
          })
        }

        for (const protocol of historyData.protocols) {
          const compoundId = makeCompoundId(category, protocol.compound)
          if (!merged.compounds[compoundId]) continue
          merged.protocols.push({
            id: protocol.id,
            compound: compoundId,
            start: protocol.start,
            dose_mg: protocol.dose_mg,
            every_days: protocol.every_days,
            occurrences: protocol.occurrences,
            until: protocol.until,
            enabled: protocol.enabled,
            notes: protocol.notes || "",
            category: category,
            source_file: fileName
          })
        }
      }

      merged.categories = Array.from(new Set(merged.categories)).sort()
      merged.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
      merged.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })

      return merged
    }

    // ---------- Compound + event model ----------
    function compoundNames(data) {
      return Object.keys(data.compounds)
    }

    function activeCompoundNames(data) {
      const seen = {}
      for (const injection of data.injections) seen[injection.compound] = true
      for (const protocol of data.protocols) {
        if (protocol.enabled !== false) seen[protocol.compound] = true
      }
      const names = Object.keys(seen)
      return names.length ? names : compoundNames(data)
    }

    function normalizeCompoundKey(data, value, category) {
      if (!value) return null
      const needle = String(value).trim().toLowerCase()
      const wantedCategory = normalizeCategoryName(category || "")

      const names = compoundNames(data)
      for (const name of names) {
        const compound = data.compounds[name]
        if (!compound) continue
        if (wantedCategory && normalizeCategoryName(compound.category) !== wantedCategory) continue

        if (name.toLowerCase() === needle) return name

        const split = splitCompoundId(name)
        if (split && split.base_key.toLowerCase() === needle) return name

        const display = (compound.display_name || "").toLowerCase()
        if (display === needle) return name

        if (split && `${split.category}/${split.base_key}`.toLowerCase() === needle) return name
      }
      return null
    }

    function eventAmountAtTime(event, t, compound) {
      const eventTime = dt(event.time)
      if (!isValidDate(eventTime) || eventTime > t) return 0
      const halfLifeDays = Math.max(0.001, toNumber(compound.half_life_days, 1))
      const elimination = Math.log(2) / halfLifeDays
      const dose = toNumber(event.dose_mg, 0)
      const f = Math.max(0, toNumber(compound.bioavailability, 1))
      const ageDays = daysBetween(eventTime, t)
      return dose * f * Math.exp(-elimination * ageDays)
    }

    function loggedEventsForCompound(data, compoundName) {
      return data.injections
        .filter(function(injection) { return injection.compound === compoundName })
        .map(function(injection) {
          return {
            compound: compoundName,
            dose_mg: toNumber(injection.dose_mg, 0),
            time: injection.time,
            source: "log"
          }
        })
    }

    function generateProtocolEvents(data, compoundName, fromTime, toTime) {
      const events = []
      const now = new Date()
      let globalCount = 0

      for (const protocol of data.protocols) {
        if (globalCount > MAX_PROTOCOL_EVENTS) break
        if (protocol.enabled === false || protocol.compound !== compoundName) continue

        const start = dt(protocol.start)
        const stepDays = Math.max(0.25, toNumber(protocol.every_days, 7))
        const dose = toNumber(protocol.dose_mg, 0)
        const occurrences = protocol.occurrences != null ? Math.max(0, toNumber(protocol.occurrences, 0)) : null
        const until = protocol.until ? dt(protocol.until) : null

        if (!isValidDate(start) || !(dose > 0)) continue

        let count = 0
        let t = new Date(start)
        while (true) {
          if (globalCount > MAX_PROTOCOL_EVENTS) break
          if (occurrences != null && count >= occurrences) break
          if (until && isValidDate(until) && t > until) break
          if (t > toTime) break

          if (t >= fromTime && t >= now) {
            events.push({
              compound: compoundName,
              dose_mg: dose,
              time: iso(t),
              source: "protocol"
            })
            globalCount += 1
          }

          t = new Date(t.getTime() + stepDays * 86400000)
          count += 1
          if (count > MAX_PROTOCOL_EVENTS) break
        }
      }

      return events.sort(function(a, b) { return dt(a.time) - dt(b.time) })
    }

    function allEventsForCompound(data, compoundName, fromTime, toTime) {
      return loggedEventsForCompound(data, compoundName)
        .concat(generateProtocolEvents(data, compoundName, fromTime, toTime))
        .sort(function(a, b) { return dt(a.time) - dt(b.time) })
    }

    function amountForCompoundAt(data, compoundName, t) {
      const compound = data.compounds[compoundName]
      if (!compound) return 0

      const horizonStart = new Date(t.getTime() - HISTORY_LOOKBACK_DAYS * 86400000)
      const events = allEventsForCompound(data, compoundName, horizonStart, t)
      let total = 0
      for (const event of events) total += eventAmountAtTime(event, t, compound)
      return total
    }

    function concentrationForCompoundAt(data, compoundName, t) {
      const compound = data.compounds[compoundName]
      if (!compound) return null
      const vd = Math.max(0.001, toNumber(compound.vd_l, 10))
      return amountForCompoundAt(data, compoundName, t) / vd
    }

    function nextScheduledDose(data, compoundName, fromTime) {
      const oneYearOut = new Date(fromTime.getTime() + 365 * 86400000)
      const future = generateProtocolEvents(data, compoundName, fromTime, oneYearOut)
      return future.length ? future[0] : null
    }

    function confidenceMeta(quality) {
      return MODEL_CONFIDENCE[quality] || MODEL_CONFIDENCE.rough
    }

    function summaryRows(data) {
      const now = new Date()
      const names = activeCompoundNames(data)
      const rows = []

      for (const name of names) {
        const compound = data.compounds[name]
        if (!compound) continue

        const amount = amountForCompoundAt(data, name, now)
        const concentration = concentrationForCompoundAt(data, name, now)
        const nextDose = nextScheduledDose(data, name, now)
        const lastDose = data.injections
          .filter(function(injection) { return injection.compound === name })
          .sort(function(a, b) { return dt(b.time) - dt(a.time) })[0] || null
        const confidence = confidenceMeta(compound.model_quality)

        rows.push({
          name: name,
          display_name: compound.display_name || titleCase(name),
          category: compound.category || DEFAULT_CATEGORY,
          color: compound.color,
          quality: compound.model_quality,
          quality_label: confidence.label,
          quality_badge: confidence.badge,
          route: compound.route || "unknown",
          amount: amount,
          concentration: concentration,
          last: lastDose,
          next: nextDose
        })
      }

      rows.sort(function(a, b) { return b.amount - a.amount })
      return rows
    }

    function buildSeries(data, selectedCompounds, daysBack, daysForward, mode) {
      const now = new Date()
      const start = new Date(now.getTime() - daysBack * 86400000)
      const end = new Date(now.getTime() + daysForward * 86400000)
      let stepHours = 6
      if (daysBack + daysForward > 120) stepHours = 12
      const stepMs = stepHours * 3600000

      const dataset = {
        mode: mode,
        start: iso(start),
        end: iso(end),
        now: iso(now),
        compounds: []
      }

      for (const name of selectedCompounds) {
        const compound = data.compounds[name]
        if (!compound) continue

        const points = []
        for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
          const time = new Date(t)
          let value = 0
          if (mode === "concentration") {
            value = concentrationForCompoundAt(data, name, time)
          } else {
            value = amountForCompoundAt(data, name, time)
          }
          points.push([iso(time), Number(Math.max(0, value || 0).toFixed(6))])
        }

        const markers = allEventsForCompound(data, name, start, end)
          .map(function(event) {
            return [event.time, event.dose_mg, event.source]
          })

        dataset.compounds.push({
          name: name,
          display_name: compound.display_name || titleCase(name),
          color: compound.color,
          model_quality: compound.model_quality,
          route: compound.route,
          category: compound.category || DEFAULT_CATEGORY,
          points: points,
          markers: markers
        })
      }

      return dataset
    }

    function pushMergedInjection(data, compoundName, dose, timeIso, notes, source) {
      const compound = data.compounds[compoundName]
      data.injections.push({
        id: makeId("inj"),
        compound: compoundName,
        dose_mg: dose,
        time: timeIso,
        source: source || "log",
        notes: notes || "",
        category: compound.category,
        source_file: compound.source_file
      })
      data.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
    }

    function pushMergedProtocol(data, compoundName, protocol) {
      const compound = data.compounds[compoundName]
      data.protocols.push({
        id: protocol.id,
        compound: compoundName,
        start: protocol.start,
        dose_mg: protocol.dose_mg,
        every_days: protocol.every_days,
        occurrences: protocol.occurrences,
        until: protocol.until,
        enabled: protocol.enabled,
        notes: protocol.notes || "",
        category: compound.category,
        source_file: compound.source_file
      })
      data.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
    }

    function addInjection(data, compoundName, doseMg, timeValue, notes) {
      const compound = data.compounds[compoundName]
      if (!compound) throw new Error("Unknown compound: " + compoundName)
      const dose = toNumber(doseMg, NaN)
      if (!Number.isFinite(dose) || dose <= 0) throw new Error("Dose must be a positive number")

      const time = new Date(timeValue || new Date())
      if (!isValidDate(time)) throw new Error("Invalid time")

      const fileState = data.__files[compound.source_file]
      if (!fileState) throw new Error("Unable to resolve history file for compound")

      fileState.history.injections.push({
        id: makeId("inj"),
        compound: compound.base_key,
        dose_mg: dose,
        time: iso(time),
        source: "log",
        notes: notes || ""
      })
      fileState.history.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
      saveHistoryFile(compound.source_file, fileState.history, fileState.compounds)

      pushMergedInjection(data, compoundName, dose, iso(time), notes, "log")
    }

    function addProtocolEntry(data, entry) {
      const compoundName = normalizeCompoundKey(data, entry.compound, entry.category)
      if (!compoundName) throw new Error("Unknown compound: " + entry.compound)

      const compound = data.compounds[compoundName]
      const fileState = data.__files[compound.source_file]
      if (!fileState) throw new Error("Unable to resolve history file for compound")

      const start = new Date(entry.start || new Date())
      const dose = toNumber(entry.dose_mg != null ? entry.dose_mg : entry.dose, NaN)
      const everyDays = toNumber(entry.every_days, 7)
      if (!isValidDate(start) || !Number.isFinite(dose) || dose <= 0 || !Number.isFinite(everyDays) || everyDays <= 0) {
        throw new Error("Protocol entry is invalid")
      }

      const protocol = {
        id: makeId("pro"),
        compound: compound.base_key,
        start: iso(start),
        dose_mg: dose,
        every_days: everyDays,
        occurrences: entry.occurrences != null && entry.occurrences !== "" ? Math.max(0, Math.floor(toNumber(entry.occurrences, 0))) : null,
        until: entry.until ? iso(entry.until) : null,
        enabled: entry.enabled !== false,
        notes: entry.notes || ""
      }

      fileState.history.protocols.push(protocol)
      fileState.history.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
      saveHistoryFile(compound.source_file, fileState.history, fileState.compounds)

      pushMergedProtocol(data, compoundName, protocol)
    }

// ---------- Widget UI ----------
function makeWidget(data) {
  const now = new Date()
  const rows = summaryRows(data).slice(0, 3)

  const w = new ListWidget()
  const gradient = new LinearGradient()
  gradient.colors = [new Color("#081326"), new Color("#121a2e")]
  gradient.locations = [0, 1]
  w.backgroundGradient = gradient
  w.setPadding(14, 14, 14, 14)

  const title = w.addText(APP_NAME)
  title.textColor = Color.white()
  title.font = Font.boldSystemFont(16)

  const subtitle = w.addText("Approximate tracking dashboard")
  subtitle.textColor = new Color("#9FB1CC")
  subtitle.font = Font.systemFont(10)
  w.addSpacer(8)

  if (!rows.length) {
    const empty = w.addText("No injections logged yet")
    empty.textColor = new Color("#CBD5E1")
    empty.font = Font.systemFont(12)

    const tip = w.addText("Use the Log Injection shortcut to get started")
    tip.textColor = new Color("#94A3B8")
    tip.font = Font.systemFont(10)
    return w
  }

  for (const row of rows) {
    const stack = w.addStack()
    stack.layoutVertically()

    const line1 = stack.addStack()
    const dot = line1.addText("● ")
    dot.textColor = new Color(row.color)
    dot.font = Font.boldSystemFont(12)

    const name = line1.addText(row.display_name)
    name.textColor = Color.white()
    name.font = Font.semiboldSystemFont(12)

    const amounts = stack.addText(`${row.amount.toFixed(2)} mg • ${row.concentration.toFixed(3)} mg/L`)
    amounts.textColor = new Color("#CBD5E1")
    amounts.font = Font.systemFont(11)

    const quality = stack.addText(row.quality_label)
    quality.textColor = row.quality_badge === "good" ? new Color("#86EFAC") : (row.quality_badge === "low" ? new Color("#FCA5A5") : new Color("#FDE68A"))
    quality.font = Font.systemFont(10)

    if (row.next) {
      const when = dt(row.next.time)
      const next = stack.addText(`Next ${formatRelativeTime(when, now)} (${formatShortDateTime(when)})`)
      next.textColor = new Color("#94A3B8")
      next.font = Font.systemFont(10)
    }

    w.addSpacer(6)
  }

  const footer = w.addText(formatDateTime(now))
  footer.textColor = new Color("#64748B")
  footer.font = Font.systemFont(9)
  return w
}

// ---------- Dashboard HTML ----------
function buildDashboardPayload(data, rows) {
  const defaults = activeCompoundNames(data)
  return {
    schema_version: data.schema_version,
    compounds: compoundNames(data).map(function(name) {
      const c = data.compounds[name]
      return {
        name: name,
        display_name: c.display_name || titleCase(name),
        category: c.category || DEFAULT_CATEGORY,
        color: c.color,
        quality: c.model_quality || "rough",
        route: c.route || "unknown"
      }
    }),
    rows: rows.map(function(r) {
      return {
        name: r.name,
        display_name: r.display_name,
        category: r.category || DEFAULT_CATEGORY,
        color: r.color,
        quality: r.quality,
        quality_label: r.quality_label,
        route: r.route,
        amount: Number(r.amount.toFixed(3)),
        concentration: Number(r.concentration.toFixed(4)),
        last: r.last ? { dose_mg: r.last.dose_mg, time: r.last.time } : null,
        next: r.next ? r.next.time : null
      }
    }),
    datasets: {
      amount_30: buildSeries(data, defaults, 30, 30, "amount"),
      amount_90: buildSeries(data, defaults, 90, 90, "amount"),
      amount_180: buildSeries(data, defaults, 180, 180, "amount"),
      concentration_30: buildSeries(data, defaults, 30, 30, "concentration"),
      concentration_90: buildSeries(data, defaults, 90, 90, "concentration"),
      concentration_180: buildSeries(data, defaults, 180, 180, "concentration")
    }
  }
}

function dashboardHTML(data, rows) {
  const payload = JSON.stringify(buildDashboardPayload(data, rows))
  if (dashboardRenderer && typeof dashboardRenderer.renderDashboardHTML === "function") {
    return dashboardRenderer.renderDashboardHTML(APP_NAME, payload)
  }

  return `<!doctype html>
<html>
<body style="font-family:-apple-system; padding:16px;">
  <h2>${APP_NAME}</h2>
  <p>Dashboard module not found. Install MedCutDashboard.js in Scriptable and retry.</p>
</body>
</html>`
}

async function presentDashboard(data) {
  const rows = summaryRows(data)
  const web = new WebView()
  await web.loadHTML(dashboardHTML(data, rows))
  await web.present(true)
}

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
  alert.addAction("Show data files")
  alert.addCancelAction("Cancel")

  const idx = await alert.presentSheet()
  if (idx === 0) return presentDashboard(data)
  if (idx === 1) return promptLogInjection(data)
  if (idx === 2) return promptAddProtocol(data)
  if (idx === 3) {
    const info = new Alert()
    info.title = "Data files"
    info.message = Object.keys(data.__files)
      .map(function(fileName) {
        return `${categoryFilePath(fileName)}\n${historyFilePath(fileName)}`
      })
      .join("\n")
    info.addAction("OK")
    await info.presentAlert()
  }
}

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

async function handleShortcut(data, input) {
  const action = String(input.action || "dashboard").toLowerCase()

  if (action === "log") {
    const compound = normalizeCompoundKey(data, input.compound, input.category)
    if (!compound) throw new Error("Unknown compound: " + input.compound)
    const dose = toNumber(input.dose_mg != null ? input.dose_mg : input.dose, NaN)
    const time = input.time ? new Date(input.time) : new Date()
    const c = data.compounds[compound]

    addInjection(data, compound, dose, time, input.notes || "")
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
    return
  }

  if (action === "add_protocol") {
    addProtocolEntry(data, input)
    shortcutOutput({
      ok: true,
      action: "add_protocol",
      schema_version: data.schema_version,
      files: allMedicationFilePaths(data),
      history_files: allHistoryFilePaths(data)
    })
    return
  }

  if (action === "summary") {
    shortcutOutput({
      ok: true,
      action: "summary",
      schema_version: data.schema_version,
      rows: summaryRows(data),
      files: allMedicationFilePaths(data),
      history_files: allHistoryFilePaths(data)
    })
    return
  }

  if (action === "dashboard" || action === "open") {
    await presentDashboard(data)
    return
  }

  throw new Error("Unsupported action: " + action)
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

// ---------- Main ----------
try {
  const data = await loadData()

  if (config.runsInWidget) {
    Script.setWidget(makeWidget(data))
    Script.complete()
  } else {
    const input = parseShortcutInput()
    if (input) {
      await handleShortcut(data, input)
      Script.complete()
    } else {
      await showMenu(data)
      Script.complete()
    }
  }
} catch (error) {
  await presentError(error)
  Script.complete()
}
