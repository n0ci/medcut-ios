// ---------- Dashboard HTML ----------
const DASHBOARD_DATASET_WINDOWS = [1, 7, 30, 90, 180, 365]

function buildDashboardDatasets(data, defaults) {
  const datasets = {}
  for (const mode of ["amount", "concentration"]) {
    for (const days of DASHBOARD_DATASET_WINDOWS) {
      datasets[`${mode}_${days}`] = buildSeries(data, defaults, days, days, mode)
    }
  }
  return datasets
}

function buildDashboardCategoryOptions(data) {
  const seen = {}
  const options = [{ value: "all", label: "All classes" }]
  compoundNames(data)
    .map(function(name) {
      const compound = data.compounds[name] || {}
      return compound.category || DEFAULT_CATEGORY
    })
    .sort()
    .forEach(function(category) {
      if (!category || seen[category]) return
      seen[category] = true
      options.push({
        value: category,
        label: titleCase(category)
      })
    })
  return options
}

function buildDashboardPayload(data, rows) {
  const defaults = activeCompoundNames(data)
  const nextScheduledAt = rows
    .map(function(row) { return row.next ? dt(row.next.time) : null })
    .filter(function(value) { return isValidDate(value) })
    .sort(function(a, b) { return a - b })[0] || null

  return {
    schema_version: data.schema_version,
    overview: {
      compound_count: compoundNames(data).length,
      active_compound_count: defaults.length,
      injection_count: data.injections.length,
      recent_injection_count: data.injections.filter(function(injection) {
        const at = dt(injection.time)
        return isValidDate(at) && daysBetween(at, new Date()) <= 7
      }).length,
      enabled_schedule_count: data.protocols.filter(function(protocol) { return protocol.enabled !== false }).length,
      next_scheduled_at: nextScheduledAt ? iso(nextScheduledAt) : null
    },
    diagnostics: {
      warnings: data.__diagnostics && Array.isArray(data.__diagnostics.warnings) ? data.__diagnostics.warnings.slice(0, 8) : []
    },
    recent_compounds: data.injections
      .slice()
      .sort(function(a, b) { return dt(b.time) - dt(a.time) })
      .map(function(injection) { return injection.compound })
      .filter(function(value, index, list) { return list.indexOf(value) === index })
      .slice(0, 4),
    categories: buildDashboardCategoryOptions(data),
    compounds: compoundNames(data).map(function(name) {
      const c = data.compounds[name]
      return {
        name: name,
        display_name: c.display_name || titleCase(name),
        category: c.category || DEFAULT_CATEGORY,
        color: c.color,
        quality: c.model_quality || "rough",
        route: c.route || "unknown",
        notes: c.notes || "",
        provenance: c.provenance || "Unspecified",
        references: Array.isArray(c.references) ? c.references.slice() : []
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
    protocols: data.protocols
      .slice()
      .sort(function(a, b) { return dt(a.start) - dt(b.start) })
      .slice(0, 60)
      .map(function(protocol) {
        const compound = data.compounds[protocol.compound] || {}
        return {
          id: protocol.id,
          compound: protocol.compound,
          display_name: compound.display_name || titleCase(protocol.compound),
          category: compound.category || protocol.category || DEFAULT_CATEGORY,
          color: compound.color || "#9fb1cc",
          quality: compound.model_quality || "rough",
          route: compound.route || "unknown",
          provenance: compound.provenance || "Unspecified",
          dose_mg: toNumber(protocol.dose_mg, 0),
          every_days: toNumber(protocol.every_days, 0),
          occurrences: protocol.occurrences,
          start: protocol.start,
          until: protocol.until,
          enabled: protocol.enabled !== false,
          notes: protocol.notes || ""
        }
      }),
    datasets: buildDashboardDatasets(data, defaults)
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
    --bg-1: #09111b;
    --bg-2: #102236;
    --panel: rgba(10, 22, 36, 0.82);
    --panel-strong: rgba(8, 18, 29, 0.94);
    --panel-border: rgba(143, 182, 216, 0.16);
    --text: #edf4ff;
    --muted: #9eb2c6;
    --muted-strong: #bed0e0;
    --accent: #75c5ff;
    --accent-soft: rgba(117, 197, 255, 0.16);
    --good: #9de0b1;
    --rough: #f2d58d;
    --low: #f3a3a3;
  }
  body {
    margin: 0;
    padding: 18px;
    background:
      radial-gradient(circle at top left, rgba(95, 157, 214, 0.26), transparent 34%),
      radial-gradient(circle at top right, rgba(104, 176, 149, 0.12), transparent 26%),
      linear-gradient(180deg, var(--bg-1), var(--bg-2));
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  }
  .shell {
    max-width: 1120px;
    margin: 0 auto;
  }
  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: 0.2px;
  }
  .muted {
    margin-top: 6px;
    color: var(--muted);
    font-size: 13px;
  }
  .hero {
    padding: 12px 14px;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(11, 23, 38, 0.96), rgba(11, 24, 39, 0.84));
    border: 1px solid rgba(155, 196, 227, 0.14);
    box-shadow: 0 14px 28px rgba(3, 8, 14, 0.28);
    margin-bottom: 10px;
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: #d8ecff;
    font-size: 11px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .hero-status {
    font-size: 12px;
    color: var(--muted-strong);
    text-align: right;
    max-width: 360px;
  }
  .hero-meta {
    margin-top: 8px;
    color: var(--muted);
    font-size: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .hero-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    color: #dbe8ff;
    font-size: 12px;
  }
  .hero-chip strong {
    font-size: 13px;
    color: var(--text);
  }
  .diag-banner {
    display: none;
    margin: 0 0 12px;
    padding: 10px 12px;
    border-radius: 18px;
    border: 1px solid rgba(242, 213, 141, 0.24);
    background: rgba(59, 44, 14, 0.55);
    color: #f2dfaf;
  }
  .diag-banner strong {
    display: block;
    margin-bottom: 4px;
    color: #ffe4a3;
  }
  .diag-list {
    margin: 0;
    padding-left: 18px;
    color: #ecd7a5;
    font-size: 12px;
  }
  .recent-compounds {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 10px 10px;
  }
  .schedule-list {
    display: grid;
    gap: 8px;
  }
  .schedule-item {
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.03);
  }
  .schedule-item.disabled {
    opacity: 0.66;
  }
  .schedule-item .top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
  }
  .schedule-item .meta {
    margin-top: 4px;
    font-size: 11px;
    color: var(--muted);
  }
  .schedule-item .actions {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    max-width: min(92vw, 520px);
    border-radius: 999px;
    padding: 10px 14px;
    background: rgba(7, 14, 25, 0.94);
    border: 1px solid rgba(117, 197, 255, 0.24);
    color: #e6f4ff;
    font-size: 12px;
    z-index: 5;
    display: none;
    box-shadow: 0 10px 30px rgba(0,0,0,0.32);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 10px;
    margin: 8px 0 14px;
    min-width: 0;
  }
  .section-title {
    margin: 16px 0 8px;
    font-size: 12px;
    color: var(--muted-strong);
    letter-spacing: 0.45px;
    text-transform: uppercase;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    padding: 14px;
    backdrop-filter: blur(10px);
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    text-align: left;
    color: var(--text);
  }
  .name {
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
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
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .small {
    margin-top: 4px;
    font-size: 12px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .card-topline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .card-expand {
    color: var(--muted);
    font-size: 11px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .card-summary {
    margin-top: 4px;
  }
  .card-details {
    display: none;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .card.expanded .card-details {
    display: block;
  }
  .card-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .card-actions .pill {
    font-size: 11px;
    padding: 6px 10px;
  }
  .graph-controls {
    display: grid;
    gap: 8px;
    margin: 10px 0 14px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
  }
  .pill, select {
    background: rgba(255,255,255,0.06);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 13px;
  }
  .field-stack {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .field-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--muted-strong);
    text-transform: uppercase;
  }
  select {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    line-height: 1.25;
    padding-left: 14px;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23bcd0e5' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: calc(100% - 12px) center;
    background-size: 10px 6px;
    padding-right: 32px;
    text-indent: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    background-clip: padding-box;
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
  .picker-stack {
    display: grid;
    gap: 8px;
  }
  .picker-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 8px;
    align-items: start;
  }
  .picker-toolbar > * {
    min-width: 0;
  }
  .picker-toolbar input,
  .picker-toolbar select {
    min-width: 0;
  }
  .picker-toolbar .field-stack {
    min-width: 0;
  }
  .compound-native {
    display: none;
  }
  .compound-picker {
    display: grid;
    gap: 8px;
  }
  .compound-typeahead {
    position: relative;
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .compound-search-shell {
    display: flex;
    align-items: center;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.07);
    padding: 10px 12px;
  }
  .compound-selected {
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.12);
    background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
  }
  .compound-selected.empty {
    border-style: dashed;
    background: rgba(255,255,255,0.03);
  }
  .compound-selected-kicker {
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .compound-selected-name {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .compound-selected-meta {
    font-size: 11px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .compound-dropdown {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 8;
    gap: 6px;
    max-height: 220px;
    overflow: auto;
    min-width: 0;
    padding: 8px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(8, 18, 29, 0.96);
    box-shadow: 0 16px 30px rgba(1, 8, 16, 0.45);
    backdrop-filter: blur(10px);
  }
  .compound-dropdown.open {
    display: grid;
  }
  .compound-dropdown-note {
    font-size: 11px;
    color: var(--muted);
    padding: 0 2px 2px;
  }
  .compound-option,
  .compound-empty {
    min-width: 0;
    box-sizing: border-box;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
  }
  .compound-option {
    width: 100%;
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    text-align: left;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .compound-option.active {
    border-color: rgba(117, 197, 255, 0.34);
    background: rgba(117, 197, 255, 0.14);
    box-shadow: inset 0 0 0 1px rgba(117, 197, 255, 0.1);
  }
  .compound-option-name {
    font-size: 13px;
    font-weight: 650;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .compound-option-meta {
    font-size: 11px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .compound-empty {
    padding: 12px;
    font-size: 12px;
    color: var(--muted);
  }
  .action-rail {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin: 0 0 10px;
  }
  .action-rail button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 46px;
    padding: 10px 12px;
    border-radius: 16px;
    text-align: center;
    font-weight: 650;
  }
  .action-symbol {
    font-size: 15px;
    line-height: 1;
  }
  .workspace-shell {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 20px;
    padding: 12px;
    min-height: 72px;
  }
  .workspace-empty {
    color: var(--muted);
    font-size: 12px;
    padding: 6px 2px;
  }
  .workspace-panel {
    display: none;
  }
  .workspace-panel.active {
    display: block;
  }
  .workspace-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .workspace-head h2 {
    margin: 0;
    font-size: 15px;
  }
  .workspace-copy {
    color: var(--muted);
    font-size: 12px;
    margin: 0 0 10px;
  }
  .workspace-dismiss {
    min-width: 0;
  }
  .entry-card.primary {
    border-color: rgba(117, 197, 255, 0.24);
    box-shadow: 0 12px 26px rgba(2, 13, 24, 0.22);
  }
  .entry-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    overflow: hidden;
  }
  .entry-card form {
    display: grid;
    gap: 8px;
    padding: 10px;
  }
  .entry-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .entry-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .entry-row > * {
    min-width: 0;
  }
  .entry-card input,
  .entry-card textarea,
  .entry-card select {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.07);
    color: #fff;
    padding: 8px 10px;
    font-size: 12px;
  }
  .entry-card input {
    line-height: 1.25;
  }
  .compound-search-shell input {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    border: 0;
    background: transparent;
    border-radius: 0;
    padding: 0;
    margin: 0;
  }
  .compound-search-shell input::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }
  .native-temporal-shell {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.07);
    padding: 8px 10px;
    overflow: hidden;
  }
  .entry-card input[type="date"],
  .entry-card input[type="time"] {
    width: 100%;
    width: -webkit-fill-available;
    min-width: 0;
    min-inline-size: 0;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    overflow: hidden;
    font: inherit;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    margin: 0;
  }
  .entry-card input[type="date"]::-webkit-date-and-time-value,
  .entry-card input[type="time"]::-webkit-date-and-time-value {
    min-width: 0;
    text-align: left;
  }
  .entry-card input[type="date"]::-webkit-textfield-decoration-container,
  .entry-card input[type="time"]::-webkit-textfield-decoration-container {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: 0;
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
  .history-panel,
  .schedule-panel {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    padding: 14px;
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
  .history-item .actions {
    margin-top: 7px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .history-item .history-edit {
    font-size: 11px;
    padding: 5px 10px;
  }
  .history-item .history-delete {
    font-size: 11px;
    padding: 5px 10px;
    border-color: rgba(255, 129, 129, 0.35);
    color: #ffd1d1;
  }
  .chart-wrap {
    position: relative;
    background: var(--panel-strong);
    border: 1px solid var(--panel-border);
    border-radius: 22px;
    padding: 14px;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
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
    white-space: normal;
    max-width: min(86vw, 680px);
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
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
    -webkit-user-select: none;
    user-select: none;
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
  .legend label.active {
    border-color: rgba(117, 197, 255, 0.32);
    background: rgba(117, 197, 255, 0.12);
  }
  .footer {
    margin-top: 12px;
    color: #89a0c2;
    font-size: 12px;
  }
  @media (max-width: 980px) {
    .action-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 700px) {
    .hero { padding: 16px; }
    .hero-top { flex-direction: column; }
    .cards { grid-template-columns: 1fr; }
    .action-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .entry-row { grid-template-columns: 1fr; }
    .picker-toolbar { grid-template-columns: 1fr; }
    .hero-status { text-align: left; max-width: none; }
  }
</style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="hero-top">
        <div>
          <div class="hero-kicker">Current State</div>
          <h1>${escapeHtml(appName)}</h1>
        </div>
        <div id="hero-status" class="hero-status"></div>
      </div>
      <div id="hero-meta" class="hero-meta"></div>
    </section>

    <div id="diagnostics-banner" class="diag-banner"></div>

    <div id="empty" class="empty" style="display:none">No logs yet. Use Quick Log to create your first entry.</div>

    <div class="section-title">Current Status</div>
    <div class="cards" id="cards"></div>

    <div id="chart-section" class="section-title">Trend Graph</div>
    <div class="chart-wrap">
      <canvas id="chart"></canvas>
      <div id="plot-warning" class="plot-warning" style="display:none"></div>
      <div id="chart-tip" class="chart-tip" style="display:none"></div>
      <div class="legend" id="legend"></div>
    </div>

    <div class="graph-controls">
      <div class="toolbar">
        <button id="window-1" class="pill" onclick="setWindow(1)">1d</button>
        <button id="window-7" class="pill" onclick="setWindow(7)">7d</button>
        <button id="window-30" class="pill" onclick="setWindow(30)">30d</button>
        <button id="window-90" class="pill" onclick="setWindow(90)">90d</button>
        <input id="custom-days" type="number" min="1" max="365" step="1" inputmode="numeric" pattern="[0-9]*" placeholder="Custom days" style="width:120px" />
        <button id="mode-amount" class="pill" onclick="setMode('amount')">Amount</button>
        <button id="mode-concentration" class="pill" onclick="setMode('concentration')">Concentration</button>
      </div>

    </div>

    <div class="section-title">Actions</div>
    <div class="action-rail">
      <button id="action-log" class="pill" type="button" onclick="togglePanel('log', true)"><span class="action-symbol">+</span>Quick Log</button>
      <button id="action-schedule" class="pill" type="button" onclick="togglePanel('schedule', true)"><span class="action-symbol">~</span>Add Schedule</button>
      <button id="action-history" class="pill" type="button" onclick="togglePanel('history', true)"><span class="action-symbol">#</span>History</button>
      <button id="action-protocols" class="pill" type="button" onclick="togglePanel('protocols', true)"><span class="action-symbol">@</span>Schedules</button>
      <button id="action-export" class="pill" type="button" onclick="exportBackup()"><span class="action-symbol">^</span>Export</button>
    </div>

    <section id="workspace-shell" class="workspace-shell">
      <div id="workspace-empty" class="workspace-empty">Choose an action to open logging, schedules, or history management.</div>

      <div id="panel-log" class="workspace-panel">
        <div class="workspace-head">
          <h2>Quick Log</h2>
          <button class="pill workspace-dismiss" type="button" onclick="setActivePanel('', false)">Hide</button>
        </div>
        <div class="workspace-copy">Save a new log entry and return to the updated dashboard state.</div>
        <div id="entry-log" class="entry-card primary">
          <form onsubmit="submitLog(event)">
            <div class="picker-stack">
              <div class="picker-toolbar">
                <div class="field-stack">
                  <label class="field-label" for="log-category">Class</label>
                  <select id="log-category" onchange="handlePickerCategoryChange('log')">
                    <option value="all">All classes</option>
                  </select>
                </div>
                <div class="compound-picker">
                  <div class="compound-typeahead">
                    <label class="field-label" for="log-search">Substance</label>
                    <div class="compound-search-shell">
                      <input id="log-search" type="search" placeholder="Type to search substances" autocomplete="off" autocapitalize="none" spellcheck="false" onfocus="openCompoundDropdown('log')" oninput="handlePickerSearchChange('log')" onkeydown="handlePickerSearchKeydown('log', event)" />
                    </div>
                    <select id="log-compound" class="compound-native" required tabindex="-1" aria-hidden="true"></select>
                    <div id="log-compound-menu" class="compound-dropdown"></div>
                  </div>
                  <div id="log-compound-selected" class="compound-selected" aria-live="polite"></div>
                </div>
              </div>
            </div>
            <div id="recent-compounds" class="recent-compounds"></div>
            <div class="field-stack">
              <label class="field-label" for="log-dose">Dose</label>
              <input id="log-dose" type="number" min="0" step="0.01" placeholder="Dose mg" required>
            </div>
            <div class="field-stack">
              <label class="field-label" for="log-date">Date</label>
              <div class="native-temporal-shell">
                <input id="log-date" type="date" required>
              </div>
            </div>
            <div class="field-stack">
              <label class="field-label" for="log-time">Time</label>
              <div class="native-temporal-shell">
                <input id="log-time" type="time" required>
              </div>
            </div>
            <div class="field-stack">
              <label class="field-label" for="log-notes">Notes</label>
              <textarea id="log-notes" placeholder="Optional notes"></textarea>
            </div>
            <div class="entry-actions">
              <button id="log-submit" class="pill" type="submit">Save Entry</button>
              <button id="log-cancel-edit" class="pill" type="button" onclick="cancelLogEdit()" style="display:none">Cancel Edit</button>
            </div>
          </form>
          <div id="log-status" class="entry-status"></div>
        </div>
      </div>

      <div id="panel-schedule" class="workspace-panel">
        <div class="workspace-head">
          <h2>Schedule</h2>
          <button class="pill workspace-dismiss" type="button" onclick="setActivePanel('', false)">Hide</button>
        </div>
        <div class="workspace-copy">Project upcoming doses without leaving the dashboard.</div>
        <div id="entry-schedule" class="entry-card">
          <form onsubmit="submitSchedule(event)">
            <div class="picker-stack">
              <div class="picker-toolbar">
                <div class="field-stack">
                  <label class="field-label" for="schedule-category">Class</label>
                  <select id="schedule-category" onchange="handlePickerCategoryChange('schedule')">
                    <option value="all">All classes</option>
                  </select>
                </div>
                <div class="compound-picker">
                  <div class="compound-typeahead">
                    <label class="field-label" for="schedule-search">Substance</label>
                    <div class="compound-search-shell">
                      <input id="schedule-search" type="search" placeholder="Type to search substances" autocomplete="off" autocapitalize="none" spellcheck="false" onfocus="openCompoundDropdown('schedule')" oninput="handlePickerSearchChange('schedule')" onkeydown="handlePickerSearchKeydown('schedule', event)" />
                    </div>
                    <select id="schedule-compound" class="compound-native" required tabindex="-1" aria-hidden="true"></select>
                    <div id="schedule-compound-menu" class="compound-dropdown"></div>
                  </div>
                  <div id="schedule-compound-selected" class="compound-selected" aria-live="polite"></div>
                </div>
              </div>
            </div>
            <div class="entry-row">
              <div class="field-stack">
                <label class="field-label" for="schedule-dose">Dose</label>
                <input id="schedule-dose" type="number" min="0" step="0.01" placeholder="Dose mg" required>
              </div>
              <div class="field-stack">
                <label class="field-label" for="schedule-every">Interval</label>
                <input id="schedule-every" type="number" min="0.25" step="0.25" placeholder="Every days" value="7" required>
              </div>
            </div>
            <div class="field-stack">
              <label class="field-label" for="schedule-start-date">Start date</label>
              <div class="native-temporal-shell">
                <input id="schedule-start-date" type="date" required>
              </div>
            </div>
            <div class="field-stack">
              <label class="field-label" for="schedule-start-time">Start time</label>
              <div class="native-temporal-shell">
                <input id="schedule-start-time" type="time" required>
              </div>
            </div>
            <div class="field-stack">
              <label class="field-label" for="schedule-occurrences">Occurrences</label>
              <input id="schedule-occurrences" type="number" min="1" step="1" placeholder="Occurrences (optional)">
            </div>
            <div class="field-stack">
              <label class="field-label" for="schedule-notes">Notes</label>
              <textarea id="schedule-notes" placeholder="Optional notes"></textarea>
            </div>
            <div class="entry-actions">
              <button class="pill" type="submit">Save Schedule</button>
              <button id="schedule-cancel-edit" class="pill" type="button" onclick="cancelProtocolEdit()" style="display:none">Cancel Edit</button>
            </div>
          </form>
          <div id="schedule-status" class="entry-status"></div>
        </div>
      </div>

      <div id="panel-history" class="workspace-panel">
        <div class="workspace-head">
          <h2>Past Injections</h2>
          <button class="pill workspace-dismiss" type="button" onclick="setActivePanel('', false)">Hide</button>
        </div>
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
      </div>

      <div id="panel-protocols" class="workspace-panel">
        <div class="workspace-head">
          <h2>Schedules</h2>
          <button class="pill workspace-dismiss" type="button" onclick="setActivePanel('', false)">Hide</button>
        </div>
        <section class="schedule-panel">
          <div id="schedule-meta" class="history-meta"></div>
          <div id="schedule-list" class="schedule-list"></div>
        </section>
      </div>
    </section>

    <div class="footer">Convenience visualization only. Values are model estimates and can be low-confidence for some compounds.</div>
  </div>
  <div id="toast" class="toast"></div>

<script>
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());

  const payload = ${payloadJson};
  const BROWSER_DEFAULT_CATEGORY = 'general';

  let state = {
    days: 7,
    mode: 'amount',
    historyDays: 30,
    historyPage: 0,
    showTotal: false,
    showTrend: false,
    enabled: [],
    hoverX: null,
    pinchStartDistance: null,
    pinchStartDays: null,
    editInjectionId: null,
    editProtocolId: null,
    preferredCompound: null,
    expandedCard: null,
    pickerFilters: {
      log: { category: 'all', query: '' },
      schedule: { category: 'all', query: '' }
    },
    openCompoundMenus: {
      log: false,
      schedule: false
    },
    activePanel: Array.isArray(payload.rows) && payload.rows.length ? '' : 'log',
    toastTimer: null
  };
  const HISTORY_PAGE_SIZE = 15;
  const MAX_COMPOUND_MATCHES = 8;
  const UI_PREFS_KEY = 'medcut.dashboard.ui.v1';
  const PENDING_TOAST_KEY = 'medcut.dashboard.pendingToast.v1';
  const categoryOptions = (Array.isArray(payload.categories) && payload.categories.length
    ? payload.categories
    : [{ value: 'all', label: 'All classes' }]).map(function(item) {
      return {
        value: String(item && item.value || 'all'),
        label: String(item && item.label || 'All classes')
      };
    });

  applySavedUiPrefs();

  function findCompoundByName(name) {
    return payload.compounds.find(function(item) {
      return item.name === name;
    }) || null;
  }

  function categoryLabelFor(category) {
    const value = String(category || BROWSER_DEFAULT_CATEGORY);
    const match = categoryOptions.find(function(option) {
      return option.value === value;
    });
    return match ? match.label : value;
  }

  function fillCategorySelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    select.innerHTML = '';
    categoryOptions.forEach(function(option) {
      const item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    });
    if (current && categoryOptions.some(function(option) { return option.value === current; })) {
      select.value = current;
    }
  }

  function setPickerCategory(kind, category) {
    if (!state.pickerFilters[kind]) state.pickerFilters[kind] = { category: 'all', query: '' };
    state.pickerFilters[kind].category = category || 'all';
    syncPickerInputs(kind);
    fillCompoundSelect(kind + '-compound', kind);
  }

  function compoundsForPicker(kind) {
    const picker = state.pickerFilters[kind] || { category: 'all', query: '' };
    const query = String(picker.query || '').trim().toLowerCase();
    return payload.compounds
      .filter(function(compound) {
        if (picker.category !== 'all' && compound.category !== picker.category) return false;
        if (!query) return true;
        const haystack = [
          compound.display_name || compound.name,
          compound.name,
          compound.category || BROWSER_DEFAULT_CATEGORY
        ].join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
      })
      .sort(function(a, b) {
        return String(a.display_name || a.name).localeCompare(String(b.display_name || b.name));
      });
  }

  function syncPickerInputs(kind) {
    const picker = state.pickerFilters[kind] || { category: 'all', query: '' };
    const categorySelect = document.getElementById(kind + '-category');
    const searchInput = document.getElementById(kind + '-search');
    if (categorySelect && categorySelect.value !== picker.category) categorySelect.value = picker.category;
    if (searchInput && searchInput.value !== picker.query) searchInput.value = picker.query;
  }

  function syncPickerToCompound(kind, compoundName) {
    const compound = findCompoundByName(compoundName);
    if (!compound) return;
    if (!state.pickerFilters[kind]) state.pickerFilters[kind] = { category: 'all', query: '' };
    state.pickerFilters[kind].category = compound.category || BROWSER_DEFAULT_CATEGORY;
    state.pickerFilters[kind].query = '';
    syncPickerInputs(kind);
  }

  function renderCompoundPicker(kind, compounds) {
    const select = document.getElementById(kind + '-compound');
    const selectedRoot = document.getElementById(kind + '-compound-selected');
    const menuRoot = document.getElementById(kind + '-compound-menu');
    if (!select || !selectedRoot || !menuRoot) return;

    const allMatches = Array.isArray(compounds) ? compounds.slice() : compoundsForPicker(kind);
    const currentName = String(select.value || '');
    const currentCompound = findCompoundByName(currentName);
    let visibleMatches = allMatches.slice(0, MAX_COMPOUND_MATCHES);

    if (currentCompound && allMatches.some(function(item) { return item.name === currentCompound.name; }) &&
        !visibleMatches.some(function(item) { return item.name === currentCompound.name; })) {
      const seen = {};
      visibleMatches = [currentCompound].concat(visibleMatches).filter(function(item) {
        if (!item || seen[item.name]) return false;
        seen[item.name] = true;
        return true;
      }).slice(0, MAX_COMPOUND_MATCHES);
    }

    selectedRoot.innerHTML = '';
    selectedRoot.classList.toggle('empty', !currentCompound);

    const selectedKicker = document.createElement('div');
    selectedKicker.className = 'compound-selected-kicker';
    selectedKicker.textContent = currentCompound ? 'Selected substance' : 'No substance selected';
    selectedRoot.appendChild(selectedKicker);

    const selectedNameNode = document.createElement('div');
    selectedNameNode.className = 'compound-selected-name';
    selectedNameNode.textContent = currentCompound
      ? String(currentCompound.display_name || currentCompound.name)
      : 'Type to search, then pick from the dropdown.';
    selectedRoot.appendChild(selectedNameNode);

    const selectedMeta = document.createElement('div');
    selectedMeta.className = 'compound-selected-meta';
    selectedMeta.textContent = currentCompound
      ? categoryLabelFor(currentCompound.category) + ' · ' + String(currentCompound.route || 'unknown')
      : 'Use the class filter and search field to narrow the list.';
    selectedRoot.appendChild(selectedMeta);

    menuRoot.innerHTML = '';
    const isOpen = !!(state.openCompoundMenus && state.openCompoundMenus[kind]);
    menuRoot.classList.toggle('open', isOpen);
    if (!isOpen) {
      return;
    }

    const note = document.createElement('div');
    note.className = 'compound-dropdown-note';
    if (!allMatches.length) {
      note.textContent = 'No matches. Try another class or search.';
      menuRoot.appendChild(note);
      const empty = document.createElement('div');
      empty.className = 'compound-empty';
      empty.textContent = 'No substances match the current filters.';
      menuRoot.appendChild(empty);
      return;
    }
    note.textContent = allMatches.length > visibleMatches.length
      ? 'Showing top ' + visibleMatches.length + ' of ' + allMatches.length + ' matches'
      : (allMatches.length === 1 ? '1 match' : String(allMatches.length) + ' matches');
    menuRoot.appendChild(note);

    visibleMatches.forEach(function(compound) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'compound-option' + (compound.name === currentName ? ' active' : '');
      button.setAttribute('data-compound-kind', kind);
      button.setAttribute('data-compound-name', compound.name);

      const nameNode = document.createElement('div');
      nameNode.className = 'compound-option-name';
      nameNode.textContent = String(compound.display_name || compound.name);
      button.appendChild(nameNode);

      const metaNode = document.createElement('div');
      metaNode.className = 'compound-option-meta';
      metaNode.textContent = categoryLabelFor(compound.category) + ' · ' + String(compound.route || 'unknown');
      button.appendChild(metaNode);

      button.addEventListener('click', function() {
        selectCompoundOption(kind, compound.name);
      });
      menuRoot.appendChild(button);
    });
  }

  function closeCompoundDropdown(kind) {
    if (!state.openCompoundMenus) return;
    state.openCompoundMenus[kind] = false;
    renderCompoundPicker(kind, compoundsForPicker(kind));
  }

  function closeAllCompoundDropdowns(exceptKind) {
    if (!state.openCompoundMenus) return;
    ['log', 'schedule'].forEach(function(kind) {
      if (kind === exceptKind) return;
      if (!state.openCompoundMenus[kind]) return;
      state.openCompoundMenus[kind] = false;
      renderCompoundPicker(kind, compoundsForPicker(kind));
    });
  }

  function openCompoundDropdown(kind) {
    if (!state.openCompoundMenus) state.openCompoundMenus = { log: false, schedule: false };
    closeAllCompoundDropdowns(kind);
    state.openCompoundMenus[kind] = true;
    renderCompoundPicker(kind, compoundsForPicker(kind));
  }

  function selectCompoundOption(kind, compoundName, options) {
    const select = document.getElementById(kind + '-compound');
    if (!select || !compoundName) return;
    const opts = options || {};

    if (opts.alignFilters) {
      syncPickerToCompound(kind, compoundName);
    } else if (!state.pickerFilters[kind]) {
      state.pickerFilters[kind] = { category: 'all', query: '' };
    }
    if (opts.clearQuery !== false) {
      state.pickerFilters[kind].query = '';
    }
    if (state.openCompoundMenus) state.openCompoundMenus[kind] = false;
    syncPickerInputs(kind);
    fillCompoundSelect(kind + '-compound', kind, { selectedName: compoundName });

    if (opts.remember !== false) {
      state.preferredCompound = compoundName;
      saveUiPrefs();
    }
  }

  function fillCompoundSelect(selectId, kind, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const allowBlank = options && options.allowBlank;
    const blankLabel = options && options.blankLabel ? options.blankLabel : 'All substances';
    const selectedName = options && Object.prototype.hasOwnProperty.call(options, 'selectedName')
      ? options.selectedName
      : select.value;
    const compounds = compoundsForPicker(kind);
    const hasQuery = !!String((state.pickerFilters[kind] && state.pickerFilters[kind].query) || '').trim();
    select.innerHTML = allowBlank ? ('<option value="">' + blankLabel + '</option>') : '';
    compounds.forEach(function(c) {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = (c.display_name || c.name) + ' (' + (c.category || 'general') + ')';
      select.appendChild(opt);
    });
    const preferred = selectedName && compounds.some(function(c) { return c.name === selectedName; })
      ? selectedName
      : (!hasQuery && state.preferredCompound && compounds.some(function(c) { return c.name === state.preferredCompound; })
        ? state.preferredCompound
        : null);
    if (preferred) {
      select.value = preferred;
    } else if (!allowBlank && compounds.length && !hasQuery) {
      select.value = compounds[0].name;
    } else if (allowBlank) {
      select.value = '';
    } else {
      select.selectedIndex = -1;
    }
    renderCompoundPicker(kind, compounds);
  }

  function handlePickerCategoryChange(kind) {
    const select = document.getElementById(kind + '-category');
    setPickerCategory(kind, select ? select.value : 'all');
  }

  function handlePickerSearchChange(kind) {
    const input = document.getElementById(kind + '-search');
    if (!state.pickerFilters[kind]) state.pickerFilters[kind] = { category: 'all', query: '' };
    state.pickerFilters[kind].query = input ? input.value : '';
    if (state.openCompoundMenus) state.openCompoundMenus[kind] = true;
    fillCompoundSelect(kind + '-compound', kind);
  }

  function handlePickerSearchKeydown(kind, event) {
    if (!event) return;
    if (event.key === 'Escape') {
      closeCompoundDropdown(kind);
      return;
    }
    if (event.key !== 'Enter') return;
    const matches = compoundsForPicker(kind);
    if (!matches.length) return;
    event.preventDefault();
    selectCompoundOption(kind, matches[0].name);
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

  if (!state.preferredCompound && payload.compounds.length) {
    state.preferredCompound = payload.compounds[0].name;
  }
  fillCategorySelect('log-category');
  fillCategorySelect('schedule-category');
  syncPickerToCompound('log', state.preferredCompound);
  syncPickerToCompound('schedule', state.preferredCompound);
  syncPickerInputs('log');
  syncPickerInputs('schedule');
  fillCompoundSelect('log-compound', 'log');
  fillCompoundSelect('schedule-compound', 'schedule');
  setDefaultDateTimeInputs();
  renderRecentCompounds();
  renderDiagnostics();
  consumeQueuedToast();

  document.addEventListener('click', function(event) {
    const target = event && event.target;
    if (target && typeof target.closest === 'function' && target.closest('.compound-typeahead')) return;
    closeAllCompoundDropdowns();
  });

  const customDaysInput = document.getElementById('custom-days');
  if (customDaysInput) {
    customDaysInput.addEventListener('change', function() {
      applyCustomDays();
    });
    customDaysInput.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyCustomDays();
    });
  }

  function hasRows() {
    return Array.isArray(payload.rows) && payload.rows.length > 0;
  }

  function filteredRows() {
    return payload.rows.slice();
  }

  function compoundHasVisibleSignal(compound) {
    if (!compound) return false;
    return Array.isArray(compound.points) && compound.points.some(function(point) {
      return Number(point[1] || 0) > 0.000001;
    });
  }

  function currentGraphVisibleCompounds() {
    const source = getSeries();
    return source.compounds
      .filter(function(compound) {
        return compoundHasVisibleSignal(compound);
      })
      .sort(function(a, b) {
        return String(a.display_name || a.name).localeCompare(String(b.display_name || b.name));
      });
  }

  function currentActiveStatusCompoundNames() {
    const source = getSeries();
    return source.compounds
      .filter(function(compound) {
        return compoundHasVisibleSignal(compound);
      })
      .map(function(compound) { return compound.name; });
  }

  function normalizeEnabledCompounds() {
    const visibleNames = currentGraphVisibleCompounds().map(function(compound) { return compound.name; });
    state.enabled = state.enabled.filter(function(name) {
      return visibleNames.includes(name);
    });

    if (!state.enabled.length && visibleNames.length) {
      state.enabled = visibleNames.slice();
    }
  }

  function filteredCompounds() {
    return payload.compounds.slice();
  }

  function filteredHistoryItems() {
    const now = Date.now();
    const cutoff = state.historyDays > 0 ? (now - state.historyDays * 86400000) : null;
    return (payload.injection_history || []).filter(function(item) {
      const t = new Date(item.time).getTime();
      if (!Number.isFinite(t)) return false;
      if (cutoff != null && t < cutoff) return false;
      return true;
    });
  }

  function renderOverview() {
    const meta = document.getElementById('hero-meta');
    const status = document.getElementById('hero-status');
    const visibleCompounds = currentGraphVisibleCompounds();
    if (meta) {
      const chips = [
        { label: 'Active', value: visibleCompounds.length, note: 'in view' },
        { label: 'Schedules', value: payload.overview.enabled_schedule_count || 0, note: 'enabled' },
        { label: 'Logs', value: payload.overview.recent_injection_count || 0, note: 'last 7d' }
      ];
      meta.innerHTML = chips.map(function(item) {
        return '<div class="hero-chip"><strong>' + escapeHtmlText(String(item.value)) + '</strong><span>'
          + escapeHtmlText(item.label + ' ' + item.note) + '</span></div>';
      }).join('');
    }

    if (!status) return;
    status.textContent = 'Showing active substances in the current window';
  }

  function renderDiagnostics() {
    const root = document.getElementById('diagnostics-banner');
    if (!root) return;
    const diagnostics = payload.diagnostics || {};
    const warningItems = Array.isArray(diagnostics.warnings) ? diagnostics.warnings : [];

    if (!warningItems.length) {
      root.style.display = 'none';
      root.innerHTML = '';
      return;
    }

    root.style.display = 'block';
    root.innerHTML = '<strong>Data checks noticed canonical data issues</strong><ul class="diag-list">'
      + warningItems.map(function(item) { return '<li>' + escapeHtmlText(item) + '</li>'; }).join('')
      + '</ul>';
  }

  function showToast(message) {
    const root = document.getElementById('toast');
    if (!root) return;
    root.textContent = message;
    root.style.display = 'block';
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function() {
      root.style.display = 'none';
    }, 2600);
  }

  function queueToast(message) {
    try {
      localStorage.setItem(PENDING_TOAST_KEY, message);
    } catch (error) {
      // Ignore localStorage failures.
    }
  }

  function consumeQueuedToast() {
    try {
      const raw = localStorage.getItem(PENDING_TOAST_KEY);
      if (!raw) return;
      localStorage.removeItem(PENDING_TOAST_KEY);
      showToast(raw);
    } catch (error) {
      // Ignore localStorage failures.
    }
  }

  function renderRecentCompounds() {
    const root = document.getElementById('recent-compounds');
    if (!root) return;
    const names = Array.isArray(payload.recent_compounds) ? payload.recent_compounds : [];
    if (!names.length) {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = names.map(function(name) {
      const compound = payload.compounds.find(function(item) { return item.name === name; }) || {};
      const label = escapeHtmlText(compound.display_name || name);
      const safeName = escapeHtmlText(name);
      return '<button class="pill" type="button" data-recent-compound="' + safeName + '">' + label + '</button>';
    }).join('');

    root.querySelectorAll('button[data-recent-compound]').forEach(function(button) {
      button.addEventListener('click', function() {
        const name = button.getAttribute('data-recent-compound') || '';
        if (name) {
          selectCompoundOption('log', name, { alignFilters: true });
          setActivePanel('log', false);
          showToast('Quick Log set to ' + button.textContent + '.');
        }
      });
    });
  }

  function updateWorkspaceVisibility() {
    const active = state.activePanel || '';
    const empty = document.getElementById('workspace-empty');
    if (empty) empty.style.display = active ? 'none' : 'block';

    ['log', 'schedule', 'history', 'protocols'].forEach(function(name) {
      const panel = document.getElementById('panel-' + name);
      if (panel) panel.classList.toggle('active', active === name);
      const action = document.getElementById('action-' + name);
      if (action) action.classList.toggle('active', active === name);
    });
  }

  function setActivePanel(name, shouldScroll) {
    state.activePanel = String(name || '').trim();
    updateWorkspaceVisibility();
    if (!state.activePanel) return;
    if (shouldScroll) {
      const shell = document.getElementById('workspace-shell');
      if (shell) shell.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const firstField = document.querySelector('#panel-' + state.activePanel + ' input, #panel-' + state.activePanel + ' select, #panel-' + state.activePanel + ' textarea, #panel-' + state.activePanel + ' button');
    if (firstField && typeof firstField.focus === 'function') firstField.focus();
  }

  function togglePanel(name, shouldScroll) {
    const normalized = String(name || '').trim();
    if (state.activePanel === normalized) {
      setActivePanel('', false);
      return;
    }
    setActivePanel(normalized, shouldScroll);
  }

  function formatProtocolRule(item) {
    const every = Number(item.every_days || 0);
    const dose = Number(item.dose_mg || 0).toFixed(2);
    const base = dose + ' mg every ' + every + 'd';
    if (item.occurrences != null) return base + ' for ' + item.occurrences + ' doses';
    return base;
  }

  function startEditProtocol(protocolId) {
    const id = String(protocolId || '').trim();
    if (!id) return;
    const entry = (payload.protocols || []).find(function(item) {
      return String(item.id || '') === id;
    });
    if (!entry) {
      setFormStatus('schedule-status', 'Unable to find this schedule for editing.');
      return;
    }

    const at = new Date(entry.start);
    const yyyy = at.getFullYear();
    const mm = String(at.getMonth() + 1).padStart(2, '0');
    const dd = String(at.getDate()).padStart(2, '0');
    const hh = String(at.getHours()).padStart(2, '0');
    const min = String(at.getMinutes()).padStart(2, '0');
    document.getElementById('schedule-dose').value = Number(entry.dose_mg || 0).toString();
    document.getElementById('schedule-every').value = Number(entry.every_days || 7).toString();
    document.getElementById('schedule-start-date').value = yyyy + '-' + mm + '-' + dd;
    document.getElementById('schedule-start-time').value = hh + ':' + min;
    document.getElementById('schedule-occurrences').value = entry.occurrences == null ? '' : String(entry.occurrences);
    document.getElementById('schedule-notes').value = String(entry.notes || '');
    selectCompoundOption('schedule', entry.compound, { alignFilters: true });
    setProtocolEditState(id);
    setActivePanel('schedule', true);
    setFormStatus('schedule-status', 'Editing schedule. Save to update it.');
  }

  function cancelProtocolEdit() {
    setProtocolEditState(null);
    setFormStatus('schedule-status', 'Schedule edit cancelled.');
    setActivePanel('schedule', false);
  }

  function toggleProtocol(protocolId, enabled) {
    const url = buildRunUrl({
      action: 'toggle_protocol',
      ui: 'dashboard',
      protocol_id: protocolId,
      enabled: enabled ? 'true' : 'false'
    });
    queueToast(enabled ? 'Schedule enabled.' : 'Schedule paused.');
    setFormStatus('schedule-status', enabled ? 'Opening MedCut to enable schedule...' : 'Opening MedCut to pause schedule...');
    window.location.href = url;
  }

  function deleteProtocol(protocolId) {
    const id = String(protocolId || '').trim();
    if (!id) return;
    const confirmed = typeof window.confirm === 'function'
      ? window.confirm('Delete this schedule? This cannot be undone.')
      : true;
    if (!confirmed) return;
    const url = buildRunUrl({
      action: 'delete_protocol',
      ui: 'dashboard',
      protocol_id: id
    });
    queueToast('Schedule deleted.');
    setFormStatus('schedule-status', 'Opening MedCut to delete schedule...');
    window.location.href = url;
  }

  function renderSchedules() {
    const meta = document.getElementById('schedule-meta');
    const list = document.getElementById('schedule-list');
    const items = (payload.protocols || []).slice();

    meta.textContent = items.length ? ('Showing ' + items.length + ' schedules') : 'No schedules for current filters';
    if (!items.length) {
      list.innerHTML = '<div class="entry-note">No schedules yet. Open Add Schedule to project upcoming doses.</div>';
      return;
    }

    list.innerHTML = items.map(function(item) {
      const start = new Date(item.start);
      const startText = Number.isFinite(start.getTime()) ? start.toLocaleString() : 'Unknown start';
      const notes = item.notes ? (' • Notes: ' + escapeHtmlText(item.notes)) : '';
      return '<div class="schedule-item ' + (item.enabled ? '' : 'disabled') + '">'
        + '<div class="top"><strong>' + escapeHtmlText(item.display_name) + '</strong><span>' + (item.enabled ? 'Enabled' : 'Paused') + '</span></div>'
        + '<div class="meta">' + escapeHtmlText(formatProtocolRule(item)) + ' • Starts ' + escapeHtmlText(startText) + '</div>'
        + '<div class="meta">' + escapeHtmlText(item.category) + ' • ' + escapeHtmlText(item.route) + ' • ' + escapeHtmlText(item.provenance || 'Unspecified') + notes + '</div>'
        + '<div class="actions">'
        + '<button class="pill" type="button" data-protocol-edit="' + escapeHtmlText(item.id) + '">Edit</button>'
        + '<button class="pill" type="button" data-protocol-toggle="' + escapeHtmlText(item.id) + '" data-protocol-enabled="' + (item.enabled ? 'true' : 'false') + '">' + (item.enabled ? 'Pause' : 'Enable') + '</button>'
        + '<button class="pill history-delete" type="button" data-protocol-delete="' + escapeHtmlText(item.id) + '">Delete</button>'
        + '</div>'
        + '</div>';
    }).join('');

    list.querySelectorAll('button[data-protocol-edit]').forEach(function(button) {
      button.addEventListener('click', function() {
        startEditProtocol(button.getAttribute('data-protocol-edit') || '');
      });
    });
    list.querySelectorAll('button[data-protocol-toggle]').forEach(function(button) {
      button.addEventListener('click', function() {
        const currentlyEnabled = button.getAttribute('data-protocol-enabled') === 'true';
        toggleProtocol(button.getAttribute('data-protocol-toggle') || '', !currentlyEnabled);
      });
    });
    list.querySelectorAll('button[data-protocol-delete]').forEach(function(button) {
      button.addEventListener('click', function() {
        deleteProtocol(button.getAttribute('data-protocol-delete') || '');
      });
    });
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

    const visibleNames = currentActiveStatusCompoundNames();
    const visibleRows = filteredRows().filter(function(row) {
      return visibleNames.includes(row.name);
    });

    if (!visibleRows.length) {
      root.innerHTML = '<div class="entry-note">No active substances in the current graph window.</div>';
      return;
    }

    root.innerHTML = visibleRows.map(r => {
      const nextText = r.next ? relativeFromNow(r.next) : 'No schedule';
      const lastText = r.last ? (relativeFromNow(r.last.time) + ' (' + Number(r.last.dose_mg).toFixed(2) + ' mg)') : 'No logged dose';
      const amount = Number(r.amount || 0).toFixed(2);
      const conc = Number(r.concentration || 0).toFixed(3);
      const color = safeColor(r.color);
      const displayName = escapeHtmlText(r.display_name);
      const route = escapeHtmlText(r.route);
      const category = escapeHtmlText(r.category);
      const qualityLabel = escapeHtmlText(r.quality_label);
      const safeLast = escapeHtmlText(lastText);
      const safeNext = escapeHtmlText(nextText);
      const expanded = state.expandedCard === r.name;
      return '<div class="card' + (expanded ? ' expanded' : '') + '" data-card-expand="' + escapeHtmlText(r.name) + '">'
        + '<div class="card-topline"><div class="name"><span class="dot" style="background:' + color + '"></span>' + displayName + '</div><div class="card-expand">' + (expanded ? 'Hide details' : 'Details') + '</div></div>'
        + '<div class="big">' + amount + ' mg • ' + conc + ' mg/L</div>'
        + '<div class="small card-summary">Last: ' + safeLast + ' • Next: ' + safeNext + '</div>'
        + '<div class="card-details">'
        + '<div class="small">Route: ' + route + ' • Category: ' + category + '</div>'
        + '<div class="small">Confidence: ' + qualityLabel + '</div>'
        + '</div>'
        + '</div>';
    }).join('');

    root.querySelectorAll('[data-card-expand]').forEach(function(card) {
      card.addEventListener('click', function() {
        const name = card.getAttribute('data-card-expand') || '';
        state.expandedCard = state.expandedCard === name ? null : name;
        renderCards();
      });
    });

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

    let base = null;
    if (state.days <= 7) base = payload.datasets[state.mode + '_7'];
    else if (state.days <= 30) base = payload.datasets[state.mode + '_30'];
    else if (state.days <= 90) base = payload.datasets[state.mode + '_90'];
    else if (state.days <= 180) base = payload.datasets[state.mode + '_180'];
    else base = payload.datasets[state.mode + '_365'];

    if (!base) base = payload.datasets[state.mode + '_365'] || payload.datasets[state.mode + '_180'];
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

    const custom = document.getElementById('custom-days');
    if (custom) custom.value = String(state.days);

    syncPickerInputs('log');
    syncPickerInputs('schedule');
    normalizeEnabledCompounds();

    renderOverview();
    updateWorkspaceVisibility();
  }

  function buildNoDataWarningDetail() {
    return 'Log an injection or add a schedule to generate chart data.';
  }

  function applySavedUiPrefs() {
    let parsed = null;
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object') return;

    const preferredCompound = typeof parsed.preferredCompound === 'string' ? parsed.preferredCompound : null;
    state.preferredCompound = preferredCompound && payload.compounds.some(function(compound) {
      return compound.name === preferredCompound;
    }) ? preferredCompound : null;

  }

  function saveUiPrefs() {
    try {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
        preferredCompound: state.preferredCompound
      }));
    } catch (error) {
      // Ignore storage errors; dashboard still works with in-memory state.
    }
  }

  function setFormStatus(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
  }

  function setLogEditState(injectionId) {
    state.editInjectionId = injectionId ? String(injectionId) : null;
    const submit = document.getElementById('log-submit');
    const cancel = document.getElementById('log-cancel-edit');
    if (submit) submit.textContent = state.editInjectionId ? 'Save Changes' : 'Save Entry';
    if (cancel) cancel.style.display = state.editInjectionId ? 'inline-block' : 'none';
  }

  function setProtocolEditState(protocolId) {
    state.editProtocolId = protocolId ? String(protocolId) : null;
    const submit = document.querySelector('#entry-schedule button[type="submit"]');
    const cancel = document.getElementById('schedule-cancel-edit');
    if (submit) submit.textContent = state.editProtocolId ? 'Save Schedule Changes' : 'Save Schedule';
    if (cancel) cancel.style.display = state.editProtocolId ? 'inline-block' : 'none';
  }

  function cancelLogEdit() {
    setLogEditState(null);
    setFormStatus('log-status', 'Edit cancelled.');
    if (state.preferredCompound) {
      selectCompoundOption('log', state.preferredCompound, { alignFilters: true, remember: false });
    }
    setActivePanel('log', false);
  }

  function startEditInjection(injectionId) {
    const id = String(injectionId || '').trim();
    if (!id) return;

    const entry = (payload.injection_history || []).find(function(item) {
      return String(item.id || '') === id;
    });
    if (!entry) {
      setFormStatus('log-status', 'Unable to find this injection for editing.');
      return;
    }

    const at = new Date(entry.time);
    if (!Number.isFinite(at.getTime())) {
      setFormStatus('log-status', 'Selected injection has an invalid timestamp.');
      return;
    }

    const yyyy = at.getFullYear();
    const mm = String(at.getMonth() + 1).padStart(2, '0');
    const dd = String(at.getDate()).padStart(2, '0');
    const hh = String(at.getHours()).padStart(2, '0');
    const min = String(at.getMinutes()).padStart(2, '0');

    const dose = document.getElementById('log-dose');
    const date = document.getElementById('log-date');
    const time = document.getElementById('log-time');
    const notes = document.getElementById('log-notes');

    if (dose) dose.value = Number(entry.dose_mg || 0).toString();
    if (date) date.value = yyyy + '-' + mm + '-' + dd;
    if (time) time.value = hh + ':' + min;
    if (notes) notes.value = String(entry.notes || '');

    selectCompoundOption('log', entry.compound, { alignFilters: true });
    setLogEditState(id);
    setActivePanel('log', true);
    setFormStatus('log-status', 'Editing past log entry. Save Changes to update it.');
  }

  function buildRunUrl(params) {
    const parts = Object.keys(params)
      .filter(function(key) { return params[key] != null && String(params[key]) !== ''; })
      .map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
      });
    return 'scriptable:///run/MedCut?' + parts.join('&');
  }

  function exportBackup() {
    const url = buildRunUrl({ action: 'export_backup' });
    queueToast('Backup export requested.');
    showToast('Running backup export in Scriptable...');
    window.location.href = url;
  }

  function deleteHistoryInjection(injectionId) {
    const id = String(injectionId || '').trim();
    if (!id) return;

    const entry = (payload.injection_history || []).find(function(item) {
      return String(item.id || '') === id;
    });
    const label = entry ? (entry.display_name || entry.compound || 'this entry') : 'this entry';

    let confirmed = true;
    if (typeof window.confirm === 'function') {
      confirmed = window.confirm('Delete ' + label + ' log entry? This cannot be undone.');
    }
    if (!confirmed) return;

    const url = buildRunUrl({
      action: 'delete_injection',
      ui: 'dashboard',
      injection_id: id
    });
    queueToast('Injection deleted.');
    setFormStatus('log-status', 'Opening MedCut to delete injection...');
    window.location.href = url;
  }

  function submitLog(event) {
    event.preventDefault();
    const compound = document.getElementById('log-compound').value;
    const dose = Number(document.getElementById('log-dose').value);
    const date = document.getElementById('log-date').value;
    const time = document.getElementById('log-time').value;
    const notes = document.getElementById('log-notes').value.trim();
    const editingId = state.editInjectionId;
    const action = editingId ? 'edit_injection' : 'log';
    state.preferredCompound = compound || state.preferredCompound;
    saveUiPrefs();

    if (!compound) {
      setFormStatus('log-status', 'Choose a substance before saving.');
      return;
    }

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
      action: action,
      ui: 'dashboard',
      injection_id: editingId,
      compound: compound,
      dose_mg: dose,
      time: at.toISOString(),
      notes: notes
    });
    queueToast(editingId ? 'Log entry updated.' : 'Log entry saved.');
    setFormStatus('log-status', editingId ? 'Opening MedCut to update log entry...' : 'Opening MedCut to save log entry...');
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
    const editingId = state.editProtocolId;

    state.preferredCompound = compound || state.preferredCompound;
    saveUiPrefs();

    if (!compound) {
      setFormStatus('schedule-status', 'Choose a substance before saving.');
      return;
    }

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
      action: editingId ? 'edit_protocol' : 'add_protocol',
      ui: 'dashboard',
      protocol_id: editingId,
      compound: compound,
      dose_mg: dose,
      every_days: every,
      start: start.toISOString(),
      occurrences: occurrences,
      notes: notes
    });
    queueToast(editingId ? 'Schedule updated.' : 'Schedule saved.');
    setFormStatus('schedule-status', editingId ? 'Opening MedCut to update schedule...' : 'Opening MedCut to save schedule...');
    window.location.href = url;
  }

  function toggleCompound(name) {
    if (!currentGraphVisibleCompounds().some(function(compound) { return compound.name === name; })) return;
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

  function graphLegendCompounds() {
    return currentGraphVisibleCompounds();
  }

  function buildLegend() {
    const root = document.getElementById('legend');
    const visibleCompounds = graphLegendCompounds();
    root.innerHTML = visibleCompounds.map(c => {
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
    const filtered = filteredHistoryItems();

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
      const editId = item.id ? escapeHtmlText(item.id) : '';
      const deleteId = item.id ? escapeHtmlText(item.id) : '';
      const notes = item.notes ? (' • Notes: ' + escapeHtmlText(item.notes)) : '';
      return '<div class="history-item">'
        + '<div class="top"><strong>' + display + '</strong><span>' + dose + ' mg</span></div>'
        + '<div class="meta">' + whenRel + ' • ' + whenAbs + '</div>'
        + '<div class="meta">' + category + ' • ' + route + ' • ' + source + notes + '</div>'
        + '<div class="actions">'
          + (editId ? ('<button class="pill history-edit" type="button" data-edit-id="' + editId + '">Edit</button>') : '')
          + (deleteId ? ('<button class="pill history-delete" type="button" data-delete-id="' + deleteId + '">Delete</button>') : '')
          + '</div>'
        + '</div>';
    }).join('');

    const editButtons = list.querySelectorAll('button[data-edit-id]');
    editButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        startEditInjection(button.getAttribute('data-edit-id') || '');
      });
    });

    const deleteButtons = list.querySelectorAll('button[data-delete-id]');
    deleteButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        deleteHistoryInjection(button.getAttribute('data-delete-id') || '');
      });
    });
  }

  function draw(chartOnly) {
    normalizeEnabledCompounds();
    if (!chartOnly) {
      renderCards();
      buildLegend();
      renderHistory();
      renderSchedules();
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
      setPlotWarning('No data available for this plot', buildNoDataWarningDetail());
      return;
    }

    const hasDoseSignal = enabled.some(s => {
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

    ctx.fillStyle = '#9fb1cc';
    ctx.font = '12px -apple-system';
    ctx.fillText(state.mode === 'concentration' ? 'mg/L' : 'mg', 10, 24);

    for (let i = 0; i <= 4; i++) {
      const x = padding.left + (plotW * i / 4);
      const t = new Date(minT + (maxT - minT) * i / 4);
      const label = t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      ctx.fillStyle = '#9fb1cc';
      ctx.font = '11px -apple-system';
      ctx.fillText(label, x - 30, H - 10);
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
      const breakdown = [];
      for (const s of enabled) {
        const idx = Math.min(nearestIndex, s.points.length - 1);
        const pointValue = Number(s.points[idx][1] || 0);
        totalAtPoint += pointValue;
        breakdown.push((s.display_name || s.name) + ': ' + pointValue.toFixed(state.mode === 'concentration' ? 3 : 2));
      }

      const unit = state.mode === 'concentration' ? 'mg/L' : 'mg';
      const dateLabel = new Date(nearestT).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const value = totalAtPoint.toFixed(state.mode === 'concentration' ? 3 : 2);

      tip.textContent = dateLabel + ' • Total: ' + value + ' ' + unit + ' • ' + breakdown.join(' • ');
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

  const chartWrap = document.querySelector('.chart-wrap');
  const canvas = document.getElementById('chart');
  if (chartWrap) {
    ['contextmenu', 'selectstart'].forEach(function(eventName) {
      chartWrap.addEventListener(eventName, function(event) {
        event.preventDefault();
      });
    });
  }
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
