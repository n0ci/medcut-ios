// MedCut for Scriptable
// Source of truth: iCloud Drive / Scriptable / medication JSON files.
// This is a convenience visualization tool, not a medical device.

const APP_NAME = "MedCut"
const APP_DATA_DIR = "MedCut"
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

const fm = FileManager.iCloud()

function dataRootPath() {
  return fm.joinPath(fm.documentsDirectory(), APP_DATA_DIR)
}

function filePath(fileName) {
  return fm.joinPath(dataRootPath(), fileName)
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
  const q = args.queryParameters || {}
  if (q.action) return q

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
  if (!fm.fileExists(dataRootPath())) {
    fm.createDirectory(dataRootPath(), true)
  }

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
        __files: {},
        __diagnostics: {
          skipped_injections: 0,
          skipped_protocols: 0,
          recovered_injections: 0,
          recovered_protocols: 0
        }
      }

      function resolveHistoryCompoundId(rawValue, categoryHint) {
        const raw = String(rawValue || "").trim()
        if (!raw) return null

        const hintedCategory = normalizeCategoryName(categoryHint || "")

        if (merged.compounds[raw]) {
          return { id: raw, recovered: true }
        }

        if (hintedCategory && raw.indexOf("::") === -1) {
          const hintedId = makeCompoundId(hintedCategory, raw)
          if (merged.compounds[hintedId]) {
            return { id: hintedId, recovered: false }
          }
        }

        const withHint = normalizeCompoundKey(merged, raw, hintedCategory)
        if (withHint) {
          return { id: withHint, recovered: true }
        }

        const fallback = normalizeCompoundKey(merged, raw, "")
        if (fallback) {
          return { id: fallback, recovered: true }
        }

        return null
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
          const resolved = resolveHistoryCompoundId(injection.compound, category)
          if (!resolved) {
            merged.__diagnostics.skipped_injections += 1
            continue
          }
          if (resolved.recovered) merged.__diagnostics.recovered_injections += 1

          const resolvedCompound = merged.compounds[resolved.id]
          merged.injections.push({
            id: injection.id,
            compound: resolved.id,
            dose_mg: injection.dose_mg,
            time: injection.time,
            source: injection.source,
            notes: injection.notes || "",
            category: resolvedCompound ? resolvedCompound.category : category,
            source_file: resolvedCompound ? resolvedCompound.source_file : fileName
          })
        }

        for (const protocol of historyData.protocols) {
          const resolved = resolveHistoryCompoundId(protocol.compound, category)
          if (!resolved) {
            merged.__diagnostics.skipped_protocols += 1
            continue
          }
          if (resolved.recovered) merged.__diagnostics.recovered_protocols += 1

          const resolvedCompound = merged.compounds[resolved.id]
          merged.protocols.push({
            id: protocol.id,
            compound: resolved.id,
            start: protocol.start,
            dose_mg: protocol.dose_mg,
            every_days: protocol.every_days,
            occurrences: protocol.occurrences,
            until: protocol.until,
            enabled: protocol.enabled,
            notes: protocol.notes || "",
            category: resolvedCompound ? resolvedCompound.category : category,
            source_file: resolvedCompound ? resolvedCompound.source_file : fileName
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

      const names = compoundNames(data).slice().sort()

      function categoryOf(name) {
        const compound = data.compounds[name]
        return normalizeCategoryName(compound && compound.category ? compound.category : "")
      }

      function matchesCategory(name) {
        if (!wantedCategory) return true
        return categoryOf(name) === wantedCategory
      }

      for (const name of names) {
        if (!matchesCategory(name)) continue
        if (name.toLowerCase() === needle) return name
      }

      const categoryBaseInput = /^([a-z0-9_-]+)\/([a-z0-9_-]+)$/i.exec(needle)
      if (categoryBaseInput) {
        const candidate = makeCompoundId(normalizeCategoryName(categoryBaseInput[1]) || DEFAULT_CATEGORY, normalizeCategoryName(categoryBaseInput[2]) || "")
        if (data.compounds[candidate]) return candidate
      }

      const baseMatches = []
      for (const name of names) {
        if (!matchesCategory(name)) continue
        const split = splitCompoundId(name)
        if (split && split.base_key.toLowerCase() === needle) {
          baseMatches.push(name)
        }
      }
      if (baseMatches.length) {
        const preferred = baseMatches.find(function(name) { return categoryOf(name) === DEFAULT_CATEGORY })
        return preferred || baseMatches[0]
      }

      const displayMatches = []
      for (const name of names) {
        if (!matchesCategory(name)) continue
        const compound = data.compounds[name]
        if (!compound) continue
        const display = (compound.display_name || "").toLowerCase()
        if (display === needle) {
          displayMatches.push(name)
        }
      }
      if (displayMatches.length) {
        const preferred = displayMatches.find(function(name) { return categoryOf(name) === DEFAULT_CATEGORY })
        return preferred || displayMatches[0]
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
    injection_history: data.injections
      .slice()
      .sort(function(a, b) { return dt(b.time) - dt(a.time) })
      .slice(0, 300)
      .map(function(injection) {
        const compound = data.compounds[injection.compound] || {}
        return {
          id: injection.id,
          compound: injection.compound,
          display_name: compound.display_name || titleCase(injection.compound),
          category: compound.category || injection.category || DEFAULT_CATEGORY,
          route: compound.route || "unknown",
          quality: compound.model_quality || "rough",
          dose_mg: toNumber(injection.dose_mg, 0),
          time: injection.time,
          source: injection.source || "log",
          notes: injection.notes || ""
        }
      }),
    datasets: {
      amount_1: buildSeries(data, defaults, 1, 1, "amount"),
      amount_7: buildSeries(data, defaults, 7, 7, "amount"),
      amount_30: buildSeries(data, defaults, 30, 30, "amount"),
      amount_90: buildSeries(data, defaults, 90, 90, "amount"),
      amount_180: buildSeries(data, defaults, 180, 180, "amount"),
      amount_365: buildSeries(data, defaults, 365, 365, "amount"),
      concentration_1: buildSeries(data, defaults, 1, 1, "concentration"),
      concentration_7: buildSeries(data, defaults, 7, 7, "concentration"),
      concentration_30: buildSeries(data, defaults, 30, 30, "concentration"),
      concentration_90: buildSeries(data, defaults, 90, 90, "concentration"),
      concentration_180: buildSeries(data, defaults, 180, 180, "concentration"),
      concentration_365: buildSeries(data, defaults, 365, 365, "concentration")
    }
  }
}

function dashboardHTML(data, rows) {
  const payload = JSON.stringify(buildDashboardPayload(data, rows))
  return renderDashboardHTML(APP_NAME, payload)
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
}

function renderDashboardHTML(appName, payloadJson) {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>
  :root {
    color-scheme: dark;
    --bg-1: #060d1a;
    --bg-2: #101b31;
    --panel: rgba(255,255,255,0.06);
    --panel-border: rgba(255,255,255,0.10);
    --text: #e5eefc;
    --muted: #9fb1cc;
    --good: #86efac;
    --rough: #fde68a;
    --low: #fca5a5;
  }
  body {
    margin: 0;
    padding: 18px;
    background: radial-gradient(circle at 15% 0%, #16325f 0%, transparent 38%), linear-gradient(180deg, var(--bg-1), var(--bg-2));
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  }
  h1 {
    margin: 0;
    font-size: 24px;
    letter-spacing: 0.2px;
  }
  .muted {
    margin-top: 6px;
    color: var(--muted);
    font-size: 13px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 10px;
    margin: 10px 0 14px;
  }
  .section-title {
    margin: 14px 0 6px;
    font-size: 13px;
    color: #c8d6f1;
    letter-spacing: 0.2px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    padding: 12px;
    backdrop-filter: blur(6px);
  }
  .name {
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    display: inline-block;
    box-shadow: 0 0 8px rgba(255,255,255,0.35);
  }
  .big {
    font-size: 22px;
    font-weight: 800;
    margin-top: 8px;
  }
  .small {
    margin-top: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .badge {
    margin-top: 7px;
    display: inline-block;
    font-size: 11px;
    border-radius: 999px;
    padding: 4px 8px;
    border: 1px solid rgba(255,255,255,0.16);
  }
  .badge.good { color: var(--good); }
  .badge.rough { color: var(--rough); }
  .badge.low { color: var(--low); }
  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 12px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 10px;
  }
  .pill, select {
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 13px;
  }
  button.pill {
    cursor: pointer;
  }
  .pill.active {
    background: rgba(255,255,255,0.18);
    border-color: rgba(255,255,255,0.28);
  }
  a.pill {
    text-decoration: none;
    display: inline-block;
  }
  .advanced-panel {
    margin: 0 0 12px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    padding: 8px 10px;
  }
  .advanced-panel summary {
    cursor: pointer;
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
  .advanced-panel summary::-webkit-details-marker {
    display: none;
  }
  .advanced-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .advanced-grid select {
    width: 100%;
  }
  .entry-panels {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }
  .entry-card {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    overflow: hidden;
  }
  .entry-card summary {
    cursor: pointer;
    padding: 10px 12px;
    font-size: 13px;
    color: #d9e7ff;
    user-select: none;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    list-style: none;
  }
  .entry-card summary::-webkit-details-marker {
    display: none;
  }
  .entry-card summary::before {
    content: '▶';
    margin-right: 8px;
    font-size: 10px;
    color: #9fb1cc;
  }
  .entry-card[open] summary::before {
    content: '▼';
  }
  .entry-card[open] summary {
    background: rgba(255,255,255,0.08);
    border-bottom: 1px solid rgba(255,255,255,0.12);
  }
  .entry-card form {
    display: grid;
    gap: 8px;
    padding: 10px;
  }
  .entry-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .entry-card input,
  .entry-card textarea,
  .entry-card select {
    width: 100%;
    box-sizing: border-box;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.07);
    color: #fff;
    padding: 8px 10px;
    font-size: 12px;
  }
  .entry-card textarea {
    min-height: 52px;
    resize: vertical;
  }
  .entry-note {
    color: var(--muted);
    font-size: 11px;
  }
  .entry-status {
    color: #f6dfa8;
    font-size: 11px;
    padding: 0 10px 10px;
  }
  .entry-card .entry-note {
    padding: 0 10px 10px;
  }
  .history-panel {
    margin-top: 12px;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    padding: 12px;
  }
  .history-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .history-head h2 {
    margin: 0;
    font-size: 14px;
  }
  .history-ranges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .history-list {
    display: grid;
    gap: 8px;
    max-height: 340px;
    overflow: auto;
  }
  .history-meta {
    margin-bottom: 8px;
    font-size: 11px;
    color: var(--muted);
  }
  .history-more {
    margin-top: 8px;
    display: flex;
    justify-content: center;
  }
  .history-item {
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.03);
  }
  .history-item .top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
  }
  .history-item .meta {
    margin-top: 3px;
    font-size: 11px;
    color: var(--muted);
  }
  .chart-wrap {
    position: relative;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    padding: 12px;
  }
  .chart-tip {
    position: absolute;
    z-index: 3;
    pointer-events: none;
    border-radius: 10px;
    background: rgba(7, 14, 25, 0.92);
    border: 1px solid rgba(255,255,255,0.18);
    color: #dbe8ff;
    font-size: 11px;
    padding: 6px 8px;
    white-space: nowrap;
    transform: translate(-50%, -120%);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  }
  .plot-warning {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(90%, 560px);
    border-radius: 14px;
    border: 1px solid rgba(255, 194, 79, 0.45);
    background: rgba(33, 23, 7, 0.86);
    color: #ffd37a;
    padding: 14px 16px;
    text-align: center;
    z-index: 2;
    pointer-events: none;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  }
  .plot-warning strong {
    display: block;
    font-size: 15px;
    margin-bottom: 4px;
  }
  .plot-warning span {
    display: block;
    font-size: 12px;
    color: #f6dfa8;
  }
  .empty {
    margin-top: 18px;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    padding: 16px;
    color: var(--muted);
  }
  canvas {
    width: 100%;
    height: auto;
    display: block;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .legend label {
    background: rgba(255,255,255,0.06);
    border-radius: 999px;
    padding: 7px 10px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .footer {
    margin-top: 12px;
    color: #89a0c2;
    font-size: 12px;
  }
  @media (max-width: 700px) {
    .cards { grid-template-columns: 1fr; }
    .advanced-grid { grid-template-columns: 1fr; }
    .entry-panels { grid-template-columns: 1fr; }
    .entry-row { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(appName)}</h1>
  <div class="muted">Schema v<span id="schema"></span> • history from logged injections • forecast from enabled schedule entries.</div>
  <div id="empty" class="empty" style="display:none">No logs yet. Use the Log Injection shortcut to create your first entry.</div>

  <div class="section-title">Trend Graph</div>

  <div class="chart-wrap">
    <canvas id="chart"></canvas>
    <div id="plot-warning" class="plot-warning" style="display:none"></div>
    <div id="chart-tip" class="chart-tip" style="display:none"></div>
    <div class="legend" id="legend"></div>
  </div>

  <div class="toolbar">
    <button id="window-1" class="pill" onclick="setWindow(1)">1d</button>
    <button id="window-7" class="pill" onclick="setWindow(7)">7d</button>
    <button id="window-30" class="pill" onclick="setWindow(30)">30d</button>
    <button id="window-90" class="pill" onclick="setWindow(90)">90d</button>
    <input id="custom-days" type="number" min="1" max="365" step="1" inputmode="numeric" pattern="[0-9]*" placeholder="Custom days" style="width:120px" />
    <button class="pill" type="button" onclick="applyCustomDays()">Apply</button>
    <button id="mode-amount" class="pill" onclick="setMode('amount')">Amount</button>
    <button id="mode-concentration" class="pill" onclick="setMode('concentration')">Concentration</button>
  </div>

  <details class="advanced-panel">
    <summary>Advanced Filters and Chart Detail</summary>
    <div class="advanced-grid">
      <select id="routeFilter" onchange="setRouteFilter(this.value)">
        <option value="all">All routes</option>
      </select>
      <select id="qualityFilter" onchange="setQualityFilter(this.value)">
        <option value="all">All confidence</option>
        <option value="good">Higher confidence</option>
        <option value="rough">Exploratory</option>
        <option value="low">Low confidence</option>
      </select>
      <select id="categoryFilter" onchange="setCategoryFilter(this.value)">
        <option value="all">All categories</option>
      </select>
      <select id="chartDetail" onchange="setChartDetail(this.value)">
        <option value="markers">Chart detail: Events</option>
        <option value="minimal">Chart detail: Minimal</option>
        <option value="insight">Chart detail: Events + Total</option>
        <option value="full">Chart detail: Full</option>
      </select>
    </div>
  </details>

  <div class="section-title">Current Concentrations</div>
  <div class="cards" id="cards"></div>

  <div class="section-title">Past Injections</div>
  <section class="history-panel">
    <div class="history-head">
      <h2>Past Injections</h2>
      <div class="history-ranges">
        <button class="pill" id="history-7" type="button" onclick="setHistoryRange(7)">7d</button>
        <button class="pill" id="history-30" type="button" onclick="setHistoryRange(30)">30d</button>
        <button class="pill" id="history-90" type="button" onclick="setHistoryRange(90)">90d</button>
        <button class="pill" id="history-all" type="button" onclick="setHistoryRange(0)">All</button>
      </div>
    </div>
    <div id="history-meta" class="history-meta"></div>
    <div id="history-list" class="history-list"></div>
    <div class="history-more">
      <button id="history-more" class="pill" type="button" onclick="loadMoreHistory()" style="display:none">Load more</button>
    </div>
  </section>

  <div class="section-title">Entry Forms</div>
  <div class="quick-actions">
    <button class="pill" type="button" onclick="focusEntry('log')">Expand Log Injection</button>
    <button class="pill" type="button" onclick="focusEntry('schedule')">Expand Add Schedule</button>
  </div>

  <div class="entry-panels">
    <details id="entry-log" class="entry-card">
      <summary>Log Injection</summary>
      <form onsubmit="submitLog(event)">
        <select id="log-compound" required></select>
        <div class="entry-row">
          <input id="log-dose" type="number" min="0" step="0.01" placeholder="Dose mg" required>
          <input id="log-date" type="date" required>
        </div>
        <input id="log-time" type="time" required>
        <textarea id="log-notes" placeholder="Optional notes"></textarea>
        <button class="pill" type="submit">Save Injection</button>
      </form>
      <div id="log-status" class="entry-status"></div>
    </details>

    <details id="entry-schedule" class="entry-card">
      <summary>Add Schedule</summary>
      <form onsubmit="submitSchedule(event)">
        <select id="schedule-compound" required></select>
        <div class="entry-row">
          <input id="schedule-dose" type="number" min="0" step="0.01" placeholder="Dose mg" required>
          <input id="schedule-every" type="number" min="0.25" step="0.25" placeholder="Every days" value="7" required>
        </div>
        <div class="entry-row">
          <input id="schedule-start-date" type="date" required>
          <input id="schedule-start-time" type="time" required>
        </div>
        <input id="schedule-occurrences" type="number" min="1" step="1" placeholder="Occurrences (optional)">
        <textarea id="schedule-notes" placeholder="Optional notes"></textarea>
        <button class="pill" type="submit">Save Schedule</button>
      </form>
      <div id="schedule-status" class="entry-status"></div>
      <div class="entry-note">Saving writes to history and reopens the updated dashboard automatically.</div>
    </details>
  </div>

  <div class="footer">Convenience visualization only. Values are model estimates and can be low-confidence for some compounds.</div>

<script>
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());

  const payload = ${payloadJson};
  document.getElementById('schema').textContent = payload.schema_version;

  let state = {
    days: 7,
    mode: 'amount',
    routeFilter: 'all',
    qualityFilter: 'all',
    categoryFilter: 'all',
    historyDays: 30,
    historyPage: 0,
    chartDetail: 'markers',
    showMarkers: true,
    showTotal: false,
    showTrend: false,
    enabled: payload.datasets.amount_7.compounds.map(c => c.name),
    hoverX: null,
    pinchStartDistance: null,
    pinchStartDays: null
  };
  const HISTORY_PAGE_SIZE = 15;

  const routeSet = new Set(payload.compounds.map(c => c.route || 'unknown'));
  const routeSelect = document.getElementById('routeFilter');
  Array.from(routeSet).sort().forEach(route => {
    const opt = document.createElement('option');
    opt.value = route;
    opt.textContent = route;
    routeSelect.appendChild(opt);
  });

  const categorySet = new Set(payload.compounds.map(c => c.category || 'general'));
  const categorySelect = document.getElementById('categoryFilter');
  Array.from(categorySet).sort().forEach(category => {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    categorySelect.appendChild(opt);
  });

  if (categorySet.size <= 1) {
    categorySelect.style.display = 'none';
  }

  function fillCompoundSelect(selectId) {
    const select = document.getElementById(selectId);
    const compounds = payload.compounds.slice().sort((a, b) => {
      return String(a.display_name || a.name).localeCompare(String(b.display_name || b.name));
    });
    select.innerHTML = '';
    compounds.forEach(function(c) {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = (c.display_name || c.name) + ' (' + (c.category || 'general') + ')';
      select.appendChild(opt);
    });
  }

  function setDefaultDateTimeInputs() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const dateValue = yyyy + '-' + mm + '-' + dd;
    const timeValue = hh + ':' + min;

    document.getElementById('log-date').value = dateValue;
    document.getElementById('log-time').value = timeValue;
    document.getElementById('schedule-start-date').value = dateValue;
    document.getElementById('schedule-start-time').value = timeValue;
  }

  fillCompoundSelect('log-compound');
  fillCompoundSelect('schedule-compound');
  setDefaultDateTimeInputs();

  const customDaysInput = document.getElementById('custom-days');
  if (customDaysInput) {
    customDaysInput.addEventListener('change', function() {
      const clamped = clampDays(customDaysInput.value);
      customDaysInput.value = clamped ? String(clamped) : String(state.days);
    });
  }

  function hasRows() {
    return Array.isArray(payload.rows) && payload.rows.length > 0;
  }

  function renderCards() {
    const empty = document.getElementById('empty');
    const root = document.getElementById('cards');
    if (!hasRows()) {
      empty.style.display = 'block';
      root.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    const filteredRows = payload.rows.filter(r => {
      const routeOk = state.routeFilter === 'all' || r.route === state.routeFilter;
      const qualityOk = state.qualityFilter === 'all' || r.quality === state.qualityFilter;
      const categoryOk = state.categoryFilter === 'all' || r.category === state.categoryFilter;
      return routeOk && qualityOk && categoryOk;
    });

    root.innerHTML = filteredRows.map(r => {
      const nextText = r.next ? relativeFromNow(r.next) : 'No schedule';
      const lastText = r.last ? (relativeFromNow(r.last.time) + ' (' + Number(r.last.dose_mg).toFixed(2) + ' mg)') : 'No logged dose';
      const amount = Number(r.amount || 0).toFixed(2);
      const conc = Number(r.concentration || 0).toFixed(3);
      const color = safeColor(r.color);
      const badgeClass = safeBadgeClass(r.quality);
      const displayName = escapeHtmlText(r.display_name);
      const route = escapeHtmlText(r.route);
      const category = escapeHtmlText(r.category);
      const qualityLabel = escapeHtmlText(r.quality_label);
      const safeLast = escapeHtmlText(lastText);
      const safeNext = escapeHtmlText(nextText);
      return '<div class="card">'
        + '<div class="name"><span class="dot" style="background:' + color + '"></span>' + displayName + ' <span class="badge ' + badgeClass + '">' + qualityLabel + '</span></div>'
        + '<div class="big">' + amount + ' mg • ' + conc + ' mg/L</div>'
        + '<div class="small">Last: ' + safeLast + ' • Next: ' + safeNext + '</div>'
        + '<div class="small">Route: ' + route + ' • Category: ' + category + '</div>'
        + '</div>';
    }).join('');
  }

  function relativeFromNow(value) {
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return 'Unknown';
    const now = Date.now();
    const diff = t - now;
    const absMs = Math.abs(diff);
    const minute = 60000;
    const hour = 3600000;
    const day = 86400000;

    if (absMs < hour) {
      const mins = Math.max(1, Math.round(absMs / minute));
      return diff >= 0 ? ('in ' + mins + 'm') : (mins + 'm ago');
    }
    if (absMs < day * 2) {
      const hours = Math.max(1, Math.round(absMs / hour));
      return diff >= 0 ? ('in ' + hours + 'h') : (hours + 'h ago');
    }
    const days = Math.max(1, Math.round(absMs / day));
    return diff >= 0 ? ('in ' + days + 'd') : (days + 'd ago');
  }

  function clampDays(value) {
    const days = Math.round(Number(value));
    if (!Number.isFinite(days)) return null;
    return Math.max(1, Math.min(365, days));
  }

  function getSeries() {
    const direct = payload.datasets[state.mode + '_' + state.days];
    if (direct) return direct;

    const base = payload.datasets[state.mode + '_365'] || payload.datasets[state.mode + '_180'];
    if (!base) return payload.datasets[state.mode + '_90'];

    const now = new Date(base.now).getTime();
    const startBound = now - state.days * 86400000;
    const endBound = now + state.days * 86400000;

    return {
      mode: base.mode,
      start: new Date(startBound).toISOString(),
      end: new Date(endBound).toISOString(),
      now: base.now,
      compounds: base.compounds.map(function(c) {
        return {
          name: c.name,
          display_name: c.display_name,
          color: c.color,
          model_quality: c.model_quality,
          route: c.route,
          category: c.category,
          points: c.points.filter(function(p) {
            const t = new Date(p[0]).getTime();
            return t >= startBound && t <= endBound;
          }),
          markers: (c.markers || []).filter(function(m) {
            const t = new Date(m[0]).getTime();
            return t >= startBound && t <= endBound;
          })
        };
      })
    };
  }

  function setWindow(days) {
    const clamped = clampDays(days);
    if (!clamped) return;
    state.days = clamped;
    draw(false);
  }
  function setMode(mode) { state.mode = mode; draw(false); }
  function setRouteFilter(route) { state.routeFilter = route; resetHistoryPagination(); draw(false); }
  function setQualityFilter(quality) { state.qualityFilter = quality; resetHistoryPagination(); draw(false); }
  function setCategoryFilter(category) { state.categoryFilter = category; resetHistoryPagination(); draw(false); }

  function setChartDetail(detail) {
    state.chartDetail = detail;
    if (detail === 'minimal') {
      state.showMarkers = false;
      state.showTotal = false;
      state.showTrend = false;
    } else if (detail === 'markers') {
      state.showMarkers = true;
      state.showTotal = false;
      state.showTrend = false;
    } else if (detail === 'insight') {
      state.showMarkers = true;
      state.showTotal = true;
      state.showTrend = false;
    } else {
      state.showMarkers = true;
      state.showTotal = true;
      state.showTrend = true;
    }
    draw(false);
  }

  function setHistoryRange(days) {
    state.historyDays = days;
    resetHistoryPagination();
    draw(false);
  }

  function resetHistoryPagination() {
    state.historyPage = 0;
  }

  function loadMoreHistory() {
    state.historyPage += 1;
    renderHistory();
    updateActiveControls();
  }

  function applyCustomDays() {
    const input = document.getElementById('custom-days');
    const clamped = clampDays(input && input.value);
    if (!clamped) {
      if (input) input.value = String(state.days);
      return;
    }
    state.days = clamped;
    if (input) input.value = String(clamped);
    draw(false);
  }

  function updateActiveControls() {
    ['1', '7', '30', '90'].forEach(function(days) {
      const el = document.getElementById('window-' + days);
      if (!el) return;
      el.classList.toggle('active', state.days === Number(days));
    });
    const amount = document.getElementById('mode-amount');
    const concentration = document.getElementById('mode-concentration');
    if (amount) amount.classList.toggle('active', state.mode === 'amount');
    if (concentration) concentration.classList.toggle('active', state.mode === 'concentration');

    const ranges = [7, 30, 90, 0];
    ranges.forEach(function(days) {
      const id = days === 0 ? 'history-all' : ('history-' + days);
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('active', state.historyDays === days);
    });

    const detail = document.getElementById('chartDetail');
    if (detail && detail.value !== state.chartDetail) detail.value = state.chartDetail;

    const custom = document.getElementById('custom-days');
    if (custom) custom.value = String(state.days);
  }

  function focusEntry(kind) {
    const target = kind === 'schedule' ? document.getElementById('entry-schedule') : document.getElementById('entry-log');
    if (!target) return;
    target.open = true;
    const firstField = target.querySelector('input, select, textarea');
    if (firstField) firstField.focus();
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setFormStatus(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
  }

  function buildRunUrl(params) {
    const parts = Object.keys(params)
      .filter(function(key) { return params[key] != null && String(params[key]) !== ''; })
      .map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
      });
    return 'scriptable:///run/MedCut?' + parts.join('&');
  }

  function submitLog(event) {
    event.preventDefault();
    const compound = document.getElementById('log-compound').value;
    const dose = Number(document.getElementById('log-dose').value);
    const date = document.getElementById('log-date').value;
    const time = document.getElementById('log-time').value;
    const notes = document.getElementById('log-notes').value.trim();

    if (!(dose > 0)) {
      setFormStatus('log-status', 'Dose must be greater than 0.');
      return;
    }

    const at = new Date(date + 'T' + time);
    if (!Number.isFinite(at.getTime())) {
      setFormStatus('log-status', 'Please provide a valid date and time.');
      return;
    }

    const url = buildRunUrl({
      action: 'log',
      ui: 'dashboard',
      compound: compound,
      dose_mg: dose,
      time: at.toISOString(),
      notes: notes
    });
    setFormStatus('log-status', 'Opening MedCut to save injection...');
    window.location.href = url;
  }

  function submitSchedule(event) {
    event.preventDefault();
    const compound = document.getElementById('schedule-compound').value;
    const dose = Number(document.getElementById('schedule-dose').value);
    const every = Number(document.getElementById('schedule-every').value);
    const date = document.getElementById('schedule-start-date').value;
    const time = document.getElementById('schedule-start-time').value;
    const occurrences = document.getElementById('schedule-occurrences').value.trim();
    const notes = document.getElementById('schedule-notes').value.trim();

    if (!(dose > 0) || !(every > 0)) {
      setFormStatus('schedule-status', 'Dose and interval must be greater than 0.');
      return;
    }

    const start = new Date(date + 'T' + time);
    if (!Number.isFinite(start.getTime())) {
      setFormStatus('schedule-status', 'Please provide a valid start date and time.');
      return;
    }

    const url = buildRunUrl({
      action: 'add_protocol',
      ui: 'dashboard',
      compound: compound,
      dose_mg: dose,
      every_days: every,
      start: start.toISOString(),
      occurrences: occurrences,
      notes: notes
    });
    setFormStatus('schedule-status', 'Opening MedCut to save schedule...');
    window.location.href = url;
  }

  function toggleCompound(name) {
    if (state.enabled.includes(name)) {
      state.enabled = state.enabled.filter(x => x !== name);
    } else {
      state.enabled.push(name);
    }
    draw(false);
  }

  function escapeHtmlText(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeColor(value) {
    const s = String(value || '').trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s) ? s : '#9fb1cc';
  }

  function safeBadgeClass(value) {
    const v = String(value || '').toLowerCase();
    return v === 'good' || v === 'rough' || v === 'low' ? v : 'rough';
  }

  function buildLegend() {
    const root = document.getElementById('legend');
    const filtered = payload.compounds.filter(c => {
      const routeOk = state.routeFilter === 'all' || c.route === state.routeFilter;
      const qualityOk = state.qualityFilter === 'all' || c.quality === state.qualityFilter;
      const categoryOk = state.categoryFilter === 'all' || c.category === state.categoryFilter;
      return routeOk && qualityOk && categoryOk;
    });
    root.innerHTML = filtered.map(c => {
      const checked = state.enabled.includes(c.name) ? 'checked' : '';
      const safeName = escapeHtmlText(c.name);
      const color = safeColor(c.color);
      const displayName = escapeHtmlText(c.display_name);
      return '<label><input type="checkbox" ' + checked + ' data-compound="' + safeName + '">'
        + '<span class="dot" style="background:' + color + '"></span>'
        + displayName + '</label>';
    }).join('');

    const checkboxes = root.querySelectorAll('input[type="checkbox"][data-compound]');
    checkboxes.forEach(function(cb) {
      cb.addEventListener('change', function() {
        toggleCompound(cb.getAttribute('data-compound') || '');
      });
    });
  }

  function renderHistory() {
    const list = document.getElementById('history-list');
    const meta = document.getElementById('history-meta');
    const more = document.getElementById('history-more');
    const now = Date.now();
    const cutoff = state.historyDays > 0 ? (now - state.historyDays * 86400000) : null;

    const filtered = (payload.injection_history || []).filter(function(item) {
      const t = new Date(item.time).getTime();
      if (!Number.isFinite(t)) return false;
      if (cutoff != null && t < cutoff) return false;
      const routeOk = state.routeFilter === 'all' || item.route === state.routeFilter;
      const qualityOk = state.qualityFilter === 'all' || item.quality === state.qualityFilter;
      const categoryOk = state.categoryFilter === 'all' || item.category === state.categoryFilter;
      return routeOk && qualityOk && categoryOk;
    });

    const visibleCount = Math.min(filtered.length, (state.historyPage + 1) * HISTORY_PAGE_SIZE);
    const pageItems = filtered.slice(0, visibleCount);

    if (!pageItems.length) {
      meta.textContent = 'Showing 0 of 0 injections';
      more.style.display = 'none';
      list.innerHTML = '<div class="entry-note">No past injections for current filters and range.</div>';
      return;
    }

    meta.textContent = 'Showing ' + pageItems.length + ' of ' + filtered.length + ' injections';
    more.style.display = filtered.length > pageItems.length ? 'inline-block' : 'none';

    list.innerHTML = pageItems.map(function(item) {
      const dose = Number(item.dose_mg || 0).toFixed(2);
      const whenAbs = new Date(item.time).toLocaleString();
      const whenRel = relativeFromNow(item.time);
      const display = escapeHtmlText(item.display_name || item.compound);
      const category = escapeHtmlText(item.category || 'general');
      const route = escapeHtmlText(item.route || 'unknown');
      const source = escapeHtmlText(item.source || 'log');
      const notes = item.notes ? (' • Notes: ' + escapeHtmlText(item.notes)) : '';
      return '<div class="history-item">'
        + '<div class="top"><strong>' + display + '</strong><span>' + dose + ' mg</span></div>'
        + '<div class="meta">' + whenRel + ' • ' + whenAbs + '</div>'
        + '<div class="meta">' + category + ' • ' + route + ' • ' + source + notes + '</div>'
        + '</div>';
    }).join('');
  }

  function draw(chartOnly) {
    if (!chartOnly) {
      renderCards();
      buildLegend();
      renderHistory();
      updateActiveControls();
    }

    const canvas = document.getElementById('chart');
    const warning = document.getElementById('plot-warning');
    const tip = document.getElementById('chart-tip');
    const ctx = canvas.getContext('2d');
    const dpr = Math.max(1, Math.min(3, Number(window.devicePixelRatio || 1)));
    const W = Math.max(320, Math.floor(canvas.clientWidth || 320));
    const H = Math.max(220, Math.min(420, Math.floor(W * 0.56)));
    const scaledW = Math.floor(W * dpr);
    const scaledH = Math.floor(H * dpr);
    if (canvas.width !== scaledW || canvas.height !== scaledH) {
      canvas.width = scaledW;
      canvas.height = scaledH;
      canvas.style.height = H + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b1220');
    bg.addColorStop(1, '#0a162b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const padding = { left: 68, right: 20, top: 24, bottom: 46 };
    const plotW = W - padding.left - padding.right;
    const plotH = H - padding.top - padding.bottom;

    const source = getSeries();
    const now = new Date(source.now).getTime();
    const minT = new Date(source.start).getTime();
    const maxT = new Date(source.end).getTime();

    const enabled = source.compounds
      .filter(c => state.enabled.includes(c.name))
      .filter(c => state.routeFilter === 'all' || c.route === state.routeFilter)
      .filter(c => state.qualityFilter === 'all' || c.model_quality === state.qualityFilter)
      .filter(c => state.categoryFilter === 'all' || c.category === state.categoryFilter)
      .map(c => ({
        ...c,
        points: c.points.map(p => [new Date(p[0]).getTime(), p[1]])
      }))
      .filter(c => c.points.length > 1);

    function setPlotWarning(title, detail) {
      if (!title) {
        warning.style.display = 'none';
        while (warning.firstChild) warning.removeChild(warning.firstChild);
        tip.style.display = 'none';
        return;
      }
      while (warning.firstChild) warning.removeChild(warning.firstChild);
      const strong = document.createElement('strong');
      strong.textContent = title;
      const span = document.createElement('span');
      span.textContent = detail;
      warning.appendChild(strong);
      warning.appendChild(span);
      warning.style.display = 'block';
    }

    if (!enabled.length) {
      setPlotWarning('No data available for this plot', 'Adjust filters or log an injection to generate chart data.');
      return;
    }

    const hasDoseSignal = enabled.some(s => {
      if (Array.isArray(s.markers) && s.markers.length > 0) return true;
      return s.points.some(p => Number(p[1] || 0) > 0.000001);
    });

    if (!hasDoseSignal) {
      setPlotWarning('No dose events yet', 'Use Log Injection or Add Schedule to start plotting.');
      return;
    }

    setPlotWarning('', '');

    let yMax = 1;
    for (const s of enabled) {
      for (const p of s.points) yMax = Math.max(yMax, p[1]);
    }
    yMax *= 1.10;

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH * i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();

      const val = (yMax * (1 - i / 4)).toFixed(state.mode === 'concentration' ? 2 : 1);
      ctx.fillStyle = '#9fb1cc';
      ctx.font = '12px -apple-system';
      ctx.fillText(val, 10, y + 7);
    }

    const xNow = padding.left + ((now - minT) / (maxT - minT)) * plotW;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(xNow, padding.top);
    ctx.lineTo(xNow, padding.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#9fb1cc';
    ctx.font = '12px -apple-system';
    ctx.fillText(state.mode === 'concentration' ? 'mg/L' : 'mg', 10, 24);
    ctx.fillText('Now', xNow + 8, padding.top + 20);

    for (let i = 0; i <= 4; i++) {
      const x = padding.left + (plotW * i / 4);
      const t = new Date(minT + (maxT - minT) * i / 4);
      const label = t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      ctx.fillStyle = '#9fb1cc';
      ctx.font = '11px -apple-system';
      ctx.fillText(label, x - 30, H - 10);
    }

    if (state.showMarkers) {
      for (const s of enabled) {
        for (const marker of s.markers) {
          const mt = new Date(marker[0]).getTime();
          if (mt < minT || mt > maxT) continue;
          const x = padding.left + ((mt - minT) / (maxT - minT)) * plotW;
          ctx.strokeStyle = s.color + '40';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padding.top);
          ctx.lineTo(x, padding.top + plotH);
          ctx.stroke();
        }
      }
    }

    function movingAverage(points, windowSize) {
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        let sum = 0;
        for (let j = start; j <= i; j++) sum += points[j][1];
        out.push([points[i][0], sum / (i - start + 1)]);
      }
      return out;
    }

    for (const s of enabled) {
      const area = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
      area.addColorStop(0, s.color + '55');
      area.addColorStop(1, s.color + '05');

      ctx.beginPath();
      s.points.forEach((p, index) => {
        const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
        const y = padding.top + plotH - ((p[1] / yMax) * plotH);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });

      const lastX = padding.left + ((s.points[s.points.length - 1][0] - minT) / (maxT - minT)) * plotW;
      const firstX = padding.left + ((s.points[0][0] - minT) / (maxT - minT)) * plotW;
      ctx.lineTo(lastX, padding.top + plotH);
      ctx.lineTo(firstX, padding.top + plotH);
      ctx.closePath();
      ctx.fillStyle = area;
      ctx.fill();

      ctx.beginPath();
      s.points.forEach((p, index) => {
        const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
        const y = padding.top + plotH - ((p[1] / yMax) * plotH);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      if (state.showTrend) {
        const trend = movingAverage(s.points, 5);
        ctx.beginPath();
        trend.forEach((p, index) => {
          const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
          const y = padding.top + plotH - ((p[1] / yMax) * plotH);
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#ffffff66';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (state.showTotal && enabled.length > 1) {
      const total = enabled[0].points.map((p, i) => {
        let v = 0;
        for (const s of enabled) v += s.points[i][1];
        return [p[0], v];
      });

      ctx.beginPath();
      total.forEach((p, index) => {
        const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
        const y = padding.top + plotH - ((p[1] / yMax) * plotH);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.hoverX != null) {
      const clampedX = Math.max(padding.left, Math.min(W - padding.right, state.hoverX));
      const ratio = (clampedX - padding.left) / Math.max(1, plotW);
      const targetT = minT + ratio * (maxT - minT);

      let nearestIndex = 0;
      let bestDiff = Number.POSITIVE_INFINITY;
      const refPoints = enabled[0].points;
      for (let i = 0; i < refPoints.length; i++) {
        const diff = Math.abs(refPoints[i][0] - targetT);
        if (diff < bestDiff) {
          bestDiff = diff;
          nearestIndex = i;
        }
      }

      const nearestT = refPoints[nearestIndex][0];
      const nearestX = padding.left + ((nearestT - minT) / Math.max(1, (maxT - minT))) * plotW;

      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(nearestX, padding.top);
      ctx.lineTo(nearestX, padding.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      let totalAtPoint = 0;
      for (const s of enabled) {
        const idx = Math.min(nearestIndex, s.points.length - 1);
        totalAtPoint += Number(s.points[idx][1] || 0);
      }

      const unit = state.mode === 'concentration' ? 'mg/L' : 'mg';
      const dateLabel = new Date(nearestT).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const value = totalAtPoint.toFixed(state.mode === 'concentration' ? 3 : 2);

      tip.textContent = dateLabel + ' • Total: ' + value + ' ' + unit;
      tip.style.display = 'block';
      tip.style.left = nearestX + 'px';
      tip.style.top = (padding.top + 10) + 'px';
    } else {
      tip.style.display = 'none';
    }
  }

  function updateHoverFromClientX(clientX) {
    const canvas = document.getElementById('chart');
    const rect = canvas.getBoundingClientRect();
    state.hoverX = clientX - rect.left;
    draw(true);
  }

  function clearHover() {
    state.hoverX = null;
    draw(true);
  }

  const canvas = document.getElementById('chart');
  canvas.addEventListener('mousemove', function(e) {
    updateHoverFromClientX(e.clientX);
  });
  canvas.addEventListener('mouseleave', function() {
    clearHover();
  });
  canvas.addEventListener('touchstart', function(e) {
    if (!e.touches || !e.touches.length) return;
    if (e.touches.length === 2) {
      const a = e.touches[0];
      const b = e.touches[1];
      state.pinchStartDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      state.pinchStartDays = state.days;
      return;
    }
    updateHoverFromClientX(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener('touchmove', function(e) {
    if (!e.touches || !e.touches.length) return;
    if (e.touches.length === 2 && state.pinchStartDistance && state.pinchStartDays) {
      e.preventDefault();
      const a = e.touches[0];
      const b = e.touches[1];
      const currentDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (currentDistance > 0) {
        const proposed = clampDays(state.pinchStartDays * (state.pinchStartDistance / currentDistance));
        if (proposed && proposed !== state.days) {
          state.days = proposed;
          draw(false);
        }
      }
      return;
    }
    updateHoverFromClientX(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener('touchend', function() {
    state.pinchStartDistance = null;
    state.pinchStartDays = null;
    clearHover();
  }, { passive: true });

  window.addEventListener('resize', function() {
    draw(false);
  });

  draw(false);
</script>
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
        return `MedCut/medications/${fileName}\nMedCut/history/${fileName}`
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
  const uiMode = String(input.ui || "").toLowerCase()
  const returnDashboard = uiMode === "dashboard" || uiMode === "open"

  if (action === "prompt_log") {
    await promptLogInjection(data)
    return
  }

  if (action === "prompt_protocol") {
    await promptAddProtocol(data)
    return
  }

  if (action === "menu") {
    await showMenu(data)
    return
  }

  if (action === "log") {
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
    return
  }

  if (action === "add_protocol") {
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
