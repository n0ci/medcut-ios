// MedCut for Scriptable
// Source of truth: iCloud Drive / Scriptable / medication JSON files.
// This is a convenience visualization tool, not a medical device.

const APP_NAME = "MedCut"
const APP_DATA_DIR = "MedCut"
const CATEGORY_DIR = "medications"
const HISTORY_DIR = "history"
const EXPORT_DIR = "exports"
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

function exportDirPath() {
  return filePath(EXPORT_DIR)
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

function normalizeText(value) {
  return String(value || "").trim()
}

function cleanObject(value) {
  return isObject(value) ? value : {}
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
        notes: "Reference-like profile compared to many exploratory entries.",
        provenance: "Seed preset",
        references: []
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
  if (!fm.fileExists(exportDirPath())) {
    fm.createDirectory(exportDirPath(), true)
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
      const compound = cleanObject(c)
      const references = Array.isArray(compound.references)
        ? compound.references.map(function(value) { return normalizeText(value) }).filter(Boolean)
        : []
      const provenance = normalizeText(compound.provenance)
      const notes = normalizeText(compound.notes)
      return {
        display_name: compound.display_name || titleCase(name),
        half_life_days: Math.max(0.001, toNumber(compound.half_life_days, 1)),
        bioavailability: Math.max(0, toNumber(compound.bioavailability, 1)),
        vd_l: Math.max(0.001, toNumber(compound.vd_l, 10)),
        route: compound.route || "unknown",
        model_quality: normalizeQuality(compound.model_quality),
        color: compound.color || COLOR_PALETTE[index % COLOR_PALETTE.length],
        notes: notes,
        provenance: provenance || (notes ? "Custom notes" : "Unspecified"),
        references: references
      }
    }

    function normalizeMedicationData(rawData, fallbackCategory) {
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

    function validateMedicationData(data) {
      const warnings = []
      const names = Object.keys(data.compounds || {})
      const seenDisplayNames = {}

      for (const name of names) {
        const compound = data.compounds[name]
        if (!compound) continue
        if (compound.half_life_days <= 0) warnings.push(`Compound ${name} has an invalid half-life`)
        if (compound.vd_l <= 0) warnings.push(`Compound ${name} has an invalid volume of distribution`)

        const displayKey = normalizeText(compound.display_name).toLowerCase()
        if (displayKey) {
          if (seenDisplayNames[displayKey]) warnings.push(`Duplicate display name detected: ${compound.display_name}`)
          seenDisplayNames[displayKey] = true
        }
      }

      return warnings
    }

    function normalizeInjectionRecord(injection) {
      if (!isObject(injection)) return null
      const compound = String(injection.compound || "").trim()
      if (!compound) return null

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

    function normalizeProtocolRecord(protocol) {
      if (!isObject(protocol)) return null
      const compound = String(protocol.compound || "").trim()
      if (!compound) return null

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

    function normalizeHistoryData(rawData, fallbackCategory) {
      const data = isObject(rawData) ? rawData : {}
      const category = normalizeCategoryName(data.category || fallbackCategory) || DEFAULT_CATEGORY
      const injectionsInput = Array.isArray(data.injections) ? data.injections : []
      const protocolsInput = Array.isArray(data.protocols) ? data.protocols : []

      const injections = injectionsInput
        .map(function(injection) { return normalizeInjectionRecord(injection) })
        .filter(Boolean)
        .sort(function(a, b) { return dt(a.time) - dt(b.time) })

      const protocols = protocolsInput
        .map(function(protocol) { return normalizeProtocolRecord(protocol) })
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
      const normalized = normalizeMedicationData(data, categoryFromFileName(fileName))
      writeJson(categoryFilePath(fileName), normalized)
    }

    function saveHistoryFile(fileName, data) {
      const normalized = normalizeHistoryData(data, categoryFromFileName(fileName))
      writeJson(historyFilePath(fileName), normalized)
    }

    async function loadMedicationFile(fileName) {
      const p = categoryFilePath(fileName)
      await fm.downloadFileFromiCloud(p)
      return normalizeMedicationData(readJson(p), categoryFromFileName(fileName))
    }

    async function loadHistoryFile(fileName) {
      const p = historyFilePath(fileName)
      if (!fm.fileExists(p)) {
        const starter = buildStarterHistoryData(categoryFromFileName(fileName))
        saveHistoryFile(fileName, starter)
      }

      await fm.downloadFileFromiCloud(p)
      return normalizeHistoryData(readJson(p), categoryFromFileName(fileName))
    }

    async function loadData() {
      await ensureDataFiles()

      const medicationFiles = listCategoryFilesInDir(medicationsDirPath())

      const merged = {
        schema_version: SCHEMA_VERSION,
        compounds: {},
        injections: [],
        protocols: [],
        categories: [],
        __files: {},
        __diagnostics: {
          warnings: []
        }
      }
      for (const fileName of medicationFiles) {
        const medicationData = await loadMedicationFile(fileName)

        const historyData = await loadHistoryFile(fileName)
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
            provenance: c.provenance || "Unspecified",
            references: Array.isArray(c.references) ? c.references.slice() : [],
            category: category,
            base_key: baseName,
            source_file: fileName
          }
        }

        merged.__diagnostics.warnings = merged.__diagnostics.warnings.concat(validateMedicationData(medicationData))

        for (const injection of historyData.injections) {
          const compoundId = makeCompoundId(category, injection.compound)
          const resolvedCompound = merged.compounds[compoundId]
          if (!resolvedCompound) {
            merged.__diagnostics.warnings.push(`Unknown injection compound ${injection.compound} in ${fileName}`)
            continue
          }
          merged.injections.push({
            id: injection.id,
            compound: compoundId,
            dose_mg: injection.dose_mg,
            time: injection.time,
            source: injection.source,
            notes: injection.notes || "",
            category: resolvedCompound.category,
            source_file: resolvedCompound.source_file
          })
        }

        for (const protocol of historyData.protocols) {
          const compoundId = makeCompoundId(category, protocol.compound)
          const resolvedCompound = merged.compounds[compoundId]
          if (!resolvedCompound) {
            merged.__diagnostics.warnings.push(`Unknown schedule compound ${protocol.compound} in ${fileName}`)
            continue
          }
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
            category: resolvedCompound.category,
            source_file: resolvedCompound.source_file
          })
        }
      }

      merged.categories = Array.from(new Set(merged.categories)).sort()
      merged.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
      merged.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
      merged.__diagnostics.warnings = Array.from(new Set(merged.__diagnostics.warnings))

      return merged
    }

    
