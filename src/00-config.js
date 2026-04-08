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

const STARTER_MEDICATION_LIBRARY = {
  peptides: {
    tirzepatide: {
      display_name: "Tirzepatide",
      half_life_days: 5.0,
      bioavailability: 0.8,
      vd_l: 9.7,
      route: "subcutaneous",
      model_quality: "good",
      color: "#56CCF2"
    },
    retatrutide: {
      display_name: "Retatrutide",
      half_life_days: 6.0,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous",
      model_quality: "rough",
      color: "#BB6BD9",
      notes: "Half-life is reported publicly; bioavailability and Vd here are placeholders for tracking/forecasting."
    },
    semaglutide: {
      display_name: "Semaglutide",
      half_life_days: 7.0,
      bioavailability: 0.89,
      vd_l: 12.5,
      route: "subcutaneous",
      model_quality: "good",
      color: "#6FCF97"
    },
    cagrilintide: {
      display_name: "Cagrilintide",
      half_life_days: 7.0,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous",
      model_quality: "rough",
      color: "#F2C94C",
      notes: "Placeholder bioavailability/Vd."
    },
    tesamorelin: {
      display_name: "Tesamorelin",
      half_life_days: 0.0076,
      bioavailability: 0.04,
      vd_l: 336.0,
      route: "subcutaneous",
      model_quality: "rough",
      color: "#F2994A"
    },
    cjc1295_dac: {
      display_name: "CJC-1295 (DAC)",
      half_life_days: 7.0,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous",
      model_quality: "rough",
      color: "#2D9CDB",
      notes: "Bioavailability/Vd are placeholders."
    },
    ipamorelin: {
      display_name: "Ipamorelin",
      half_life_days: 0.083,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous",
      model_quality: "rough",
      color: "#27AE60",
      notes: "Bioavailability/Vd are placeholders."
    },
    ghk_cu: {
      display_name: "GHK-Cu",
      half_life_days: 0.031,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "topical_or_subcutaneous",
      model_quality: "low",
      color: "#E91E63",
      notes: "Short plasma half-life; systemic concentration modeling is low-confidence, especially for topical use."
    },
    bpc157: {
      display_name: "BPC-157",
      half_life_days: 0.2,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous_or_local",
      model_quality: "low",
      color: "#EB5757",
      notes: "Heuristic placeholders; use mainly for logging and relative decay."
    },
    tb500: {
      display_name: "TB-500",
      half_life_days: 2.0,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous_or_intramuscular",
      model_quality: "low",
      color: "#9B51E0",
      notes: "Heuristic placeholders; use mainly for logging and relative decay."
    },
    aod9604: {
      display_name: "AOD-9604",
      half_life_days: 0.06,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous",
      model_quality: "low",
      color: "#7ED321",
      notes: "Short-lived peptide estimate; parameters are placeholders for convenience tracking."
    },
    epitalon: {
      display_name: "Epitalon",
      half_life_days: 0.12,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "subcutaneous_or_intranasal",
      model_quality: "low",
      color: "#50E3C2",
      notes: "Limited human PK references; modeled as low-confidence tracking estimate."
    },
    selank: {
      display_name: "Selank",
      half_life_days: 0.05,
      bioavailability: 1.0,
      vd_l: 10.0,
      route: "intranasal_or_subcutaneous",
      model_quality: "low",
      color: "#4A90E2",
      notes: "Approximate elimination only; useful mostly for dose/event logging."
    },
    ll37: {
      display_name: "LL-37",
      half_life_days: 0.08,
      bioavailability: 1.0,
      vd_l: 12.0,
      route: "subcutaneous_or_local",
      model_quality: "low",
      color: "#D0021B",
      notes: "PK behavior varies by use-case; represented as low-confidence placeholder values."
    },
    oxytocin: {
      display_name: "Oxytocin",
      half_life_days: 0.003,
      bioavailability: 0.2,
      vd_l: 18.0,
      route: "intranasal_or_subcutaneous",
      model_quality: "rough",
      color: "#9013FE",
      notes: "Very short systemic half-life; route-dependent effects can differ from plasma estimates."
    }
  },
  painkillers: {
    ibuprofen: {
      display_name: "Ibuprofen",
      half_life_days: 0.083,
      bioavailability: 0.9,
      vd_l: 12.0,
      route: "oral",
      model_quality: "rough",
      color: "#F2994A",
      notes: "Simple elimination estimate for convenience tracking."
    },
    acetaminophen: {
      display_name: "Acetaminophen",
      half_life_days: 0.104,
      bioavailability: 0.85,
      vd_l: 67.0,
      route: "oral",
      model_quality: "rough",
      color: "#56CCF2",
      notes: "Convenience estimate only."
    },
    naproxen: {
      display_name: "Naproxen",
      half_life_days: 0.58,
      bioavailability: 0.95,
      vd_l: 11.0,
      route: "oral",
      model_quality: "rough",
      color: "#6FCF97",
      notes: "Longer half-life NSAID represented with simplified one-compartment assumptions."
    },
    diclofenac: {
      display_name: "Diclofenac",
      half_life_days: 0.08,
      bioavailability: 0.6,
      vd_l: 14.0,
      route: "oral_or_topical",
      model_quality: "rough",
      color: "#F2C94C",
      notes: "Route-dependent exposure differs; useful mainly for relative tracking patterns."
    },
    celecoxib: {
      display_name: "Celecoxib",
      half_life_days: 0.46,
      bioavailability: 0.4,
      vd_l: 400.0,
      route: "oral",
      model_quality: "rough",
      color: "#BB6BD9",
      notes: "Approximate values; high apparent distribution and PK variability across users."
    },
    tramadol: {
      display_name: "Tramadol",
      half_life_days: 0.25,
      bioavailability: 0.75,
      vd_l: 190.0,
      route: "oral",
      model_quality: "rough",
      color: "#2D9CDB",
      notes: "Modeled as parent-compound only; active metabolite effects are not represented."
    },
    ketorolac: {
      display_name: "Ketorolac",
      half_life_days: 0.23,
      bioavailability: 1.0,
      vd_l: 13.0,
      route: "oral_or_intramuscular",
      model_quality: "rough",
      color: "#27AE60",
      notes: "Short-term analgesic profile modeled with simplified elimination assumptions."
    }
  },
  antidepressants: {
    sertraline: {
      display_name: "Sertraline",
      half_life_days: 1.1,
      bioavailability: 0.45,
      vd_l: 1400.0,
      route: "oral",
      model_quality: "rough",
      color: "#56CCF2",
      notes: "Approximate parent-compound profile for adherence-style trend tracking."
    },
    escitalopram: {
      display_name: "Escitalopram",
      half_life_days: 1.25,
      bioavailability: 0.8,
      vd_l: 880.0,
      route: "oral",
      model_quality: "rough",
      color: "#6FCF97",
      notes: "One-compartment simplification; individual variability can be high."
    },
    fluoxetine: {
      display_name: "Fluoxetine",
      half_life_days: 4.0,
      bioavailability: 0.72,
      vd_l: 1700.0,
      route: "oral",
      model_quality: "rough",
      color: "#F2C94C",
      notes: "Parent half-life used for convenience; long-lived metabolite is not separately modeled."
    },
    venlafaxine: {
      display_name: "Venlafaxine",
      half_life_days: 0.21,
      bioavailability: 0.45,
      vd_l: 500.0,
      route: "oral",
      model_quality: "rough",
      color: "#EB5757",
      notes: "Estimated profile for relative timing only; metabolite exposure is not explicitly separated."
    },
    bupropion: {
      display_name: "Bupropion",
      half_life_days: 0.88,
      bioavailability: 0.85,
      vd_l: 1250.0,
      route: "oral",
      model_quality: "rough",
      color: "#BB6BD9",
      notes: "Parent-focused estimate; active metabolite dynamics not explicitly modeled."
    }
  },
  small_molecules: {
    metformin: {
      display_name: "Metformin",
      half_life_days: 0.26,
      bioavailability: 0.55,
      vd_l: 654.0,
      route: "oral",
      model_quality: "rough",
      color: "#56CCF2",
      notes: "Convenience tracking estimate; simplified disposition model."
    },
    berberine: {
      display_name: "Berberine",
      half_life_days: 0.18,
      bioavailability: 0.01,
      vd_l: 120.0,
      route: "oral",
      model_quality: "low",
      color: "#F2C94C",
      notes: "Low and variable oral bioavailability; represented as low-confidence estimate."
    },
    tadalafil: {
      display_name: "Tadalafil",
      half_life_days: 0.73,
      bioavailability: 0.8,
      vd_l: 63.0,
      route: "oral",
      model_quality: "rough",
      color: "#6FCF97",
      notes: "Approximate one-compartment profile used for relative timing visualization."
    },
    naltrexone: {
      display_name: "Naltrexone",
      half_life_days: 0.17,
      bioavailability: 0.35,
      vd_l: 135.0,
      route: "oral",
      model_quality: "rough",
      color: "#EB5757",
      notes: "Parent-compound estimate only; active metabolite behavior not fully represented."
    },
    finasteride: {
      display_name: "Finasteride",
      half_life_days: 0.25,
      bioavailability: 0.65,
      vd_l: 76.0,
      route: "oral",
      model_quality: "rough",
      color: "#9B51E0",
      notes: "Simplified PK assumptions for convenience trend tracking."
    }
  },
  steroids: {
    testosterone_cypionate: {
      display_name: "Testosterone Cypionate",
      half_life_days: 8.0,
      bioavailability: 1.0,
      vd_l: 75.0,
      route: "intramuscular_or_subcutaneous",
      model_quality: "rough",
      color: "#56CCF2",
      notes: "Depot ester estimate for convenience tracking; serum levels vary with carrier oil and injection cadence."
    },
    testosterone_enanthate: {
      display_name: "Testosterone Enanthate",
      half_life_days: 4.5,
      bioavailability: 1.0,
      vd_l: 75.0,
      route: "intramuscular_or_subcutaneous",
      model_quality: "rough",
      color: "#6FCF97",
      notes: "Depot ester estimate for trend tracking only."
    },
    nandrolone_decanoate: {
      display_name: "Nandrolone Decanoate",
      half_life_days: 7.0,
      bioavailability: 1.0,
      vd_l: 65.0,
      route: "intramuscular",
      model_quality: "rough",
      color: "#F2C94C",
      notes: "Long-acting depot estimate; useful mainly for rough accumulation/clearance visualization."
    },
    methenolone_enanthate: {
      display_name: "Methenolone Enanthate",
      half_life_days: 10.5,
      bioavailability: 1.0,
      vd_l: 80.0,
      route: "intramuscular",
      model_quality: "rough",
      color: "#BB6BD9",
      notes: "Approximate long-ester profile for convenience tracking."
    },
    drostanolone_enanthate: {
      display_name: "Drostanolone Enanthate",
      half_life_days: 6.0,
      bioavailability: 1.0,
      vd_l: 80.0,
      route: "intramuscular",
      model_quality: "rough",
      color: "#2D9CDB",
      notes: "Approximate depot profile used for rough trend tracking."
    },
    oxandrolone: {
      display_name: "Oxandrolone",
      half_life_days: 0.42,
      bioavailability: 0.97,
      vd_l: 65.0,
      route: "oral",
      model_quality: "rough",
      color: "#F2994A",
      notes: "Short oral steroid estimate; represented for convenience tracking rather than clinical interpretation."
    },
    stanozolol: {
      display_name: "Stanozolol",
      half_life_days: 0.375,
      bioavailability: 0.95,
      vd_l: 65.0,
      route: "oral_or_intramuscular",
      model_quality: "rough",
      color: "#9B51E0",
      notes: "Route-dependent PK varies; simplified estimate for relative timing visualization."
    }
  }
}

const STARTER_HISTORY_LIBRARY = {
  peptides: {
    injections: [],
    protocols: [
      {
        compound: "tirzepatide",
        start: "2026-02-01T10:00:00.000Z",
        dose_mg: 2.5,
        every_days: 7,
        occurrences: 6,
        enabled: false,
        notes: "Example starter phase"
      },
      {
        compound: "tirzepatide",
        start: "2026-03-15T10:00:00.000Z",
        dose_mg: 3.75,
        every_days: 7,
        enabled: false,
        notes: "Example escalation phase"
      }
    ]
  },
  painkillers: { injections: [], protocols: [] },
  antidepressants: { injections: [], protocols: [] },
  small_molecules: { injections: [], protocols: [] },
  steroids: { injections: [], protocols: [] }
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
  const normalizedCategory = normalizeCategoryName(category) || DEFAULT_CATEGORY
  const compounds = STARTER_MEDICATION_LIBRARY[normalizedCategory] || STARTER_MEDICATION_LIBRARY[DEFAULT_CATEGORY]
  return {
    schema_version: SCHEMA_VERSION,
    category: normalizedCategory,
    compounds: JSON.parse(JSON.stringify(compounds))
  }
}

function buildStarterHistoryData(category) {
  const normalizedCategory = normalizeCategoryName(category) || DEFAULT_CATEGORY
  const starter = STARTER_HISTORY_LIBRARY[normalizedCategory] || { injections: [], protocols: [] }
  return {
    schema_version: SCHEMA_VERSION,
    category: normalizedCategory,
    injections: JSON.parse(JSON.stringify(starter.injections || [])),
    protocols: JSON.parse(JSON.stringify(starter.protocols || []))
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

  const starterCategories = Object.keys(STARTER_MEDICATION_LIBRARY)
  const medicationFiles = listCategoryFilesInDir(medicationsDirPath())
  const historyFiles = listCategoryFilesInDir(historyDirPath())
  const existingMedication = {}
  const existingHistory = {}

  medicationFiles.forEach(function(fileName) {
    existingMedication[categoryFromFileName(fileName)] = true
  })
  historyFiles.forEach(function(fileName) {
    existingHistory[categoryFromFileName(fileName)] = true
  })

  for (const category of starterCategories) {
    if (!existingMedication[category]) {
      writeJson(categoryFilePath(makeCategoryFileName(category)), buildStarterMedicationData(category))
    }
    if (!existingHistory[category]) {
      writeJson(historyFilePath(makeCategoryFileName(category)), buildStarterHistoryData(category))
    }
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

    
