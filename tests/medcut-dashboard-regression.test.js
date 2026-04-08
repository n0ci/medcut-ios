const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const medcutPath = path.join(__dirname, '..', 'MedCut.js');
const source = fs.readFileSync(medcutPath, 'utf8');

test('dashboard includes dedicated plot warning element', () => {
  assert.match(
    source,
    /<div id="plot-warning" class="plot-warning" style="display:none"><\/div>/,
    'Expected a dedicated hidden warning container inside the chart area.'
  );
});

test('legend uses data-compound wiring instead of inline toggle function call', () => {
  assert.doesNotMatch(
    source,
    /onchange="toggleCompound\(/,
    'Inline onchange handler reintroduced; this caused prior plotting regressions.'
  );

  assert.match(
    source,
    /data-compound="' \+ safeName \+ '"/,
    'Expected safe data attribute based wiring for compound toggles.'
  );

  assert.match(
    source,
    /querySelectorAll\('input\[type="checkbox"\]\[data-compound\]'\)/,
    'Expected checkbox listener binding by data attribute selector.'
  );

  assert.match(
    source,
    /addEventListener\('change', function\(\) \{\s*toggleCompound\(cb\.getAttribute\('data-compound'\) \|\| ''\);\s*\}\);/,
    'Expected checkbox change listeners that call toggleCompound with data attribute value.'
  );
});

test('plot warning rendering avoids innerHTML injection', () => {
  assert.doesNotMatch(
    source,
    /warning\.innerHTML\s*=\s*'<strong>'/,
    'Expected warning content to be rendered via textContent, not HTML concatenation.'
  );

  assert.match(
    source,
    /const strong = document\.createElement\('strong'\);/,
    'Expected warning title node creation.'
  );

  assert.match(
    source,
    /strong\.textContent = title;/,
    'Expected safe text assignment for warning title.'
  );

  assert.match(
    source,
    /span\.textContent = detail;/,
    'Expected safe text assignment for warning detail.'
  );
});

test('draw() still surfaces no-data warning states', () => {
  assert.match(
    source,
    /setPlotWarning\('No data available for this plot', buildNoDataWarningDetail\(\)\);/,
    'Expected no-data warning to include filter-aware detail context.'
  );

  assert.match(
    source,
    /setPlotWarning\('No dose events yet', 'Use Log Injection or Add Schedule to start plotting\.'\);/,
    'Expected explicit warning when no dose signal exists.'
  );
});

test('dashboard exposes collapsible advanced controls and chart detail preset', () => {
  assert.match(
    source,
    /<details class="advanced-panel">/,
    'Expected advanced controls to be collapsed by default.'
  );

  assert.match(
    source,
    /<select id="chartDetail" onchange="setChartDetail\(this.value\)">/,
    'Expected a single chart detail preset control.'
  );

  assert.match(
    source,
    /id="advanced-summary" class="advanced-summary"/,
    'Expected advanced summary badge for active filter visibility.'
  );

  assert.match(
    source,
    /onclick="resetAdvancedControls\(\)"/,
    'Expected quick reset action for advanced filters.'
  );

  assert.match(
    source,
    /<option value="markers">Events<\/option>/,
    'Expected concise chart detail labels for faster scanning.'
  );
});

test('advanced filters and chart detail preferences persist across dashboard opens', () => {
  assert.match(
    source,
    /const UI_PREFS_KEY = 'medcut\.dashboard\.ui\.v1';/,
    'Expected a stable localStorage key for dashboard UI preferences.'
  );

  assert.match(
    source,
    /function applySavedUiPrefs\(\)/,
    'Expected preference restore handler during dashboard initialization.'
  );

  assert.match(
    source,
    /localStorage\.setItem\(UI_PREFS_KEY, JSON\.stringify\(\{/,
    'Expected preference save handler to persist advanced control state.'
  );

  assert.match(
    source,
    /function setRouteFilter\(route\) \{ state\.routeFilter = route; saveUiPrefs\(\); resetHistoryPagination\(\); draw\(false\); \}/,
    'Expected route filter changes to be persisted.'
  );

  assert.match(
    source,
    /function setChartDetail\(detail\) \{\s*applyChartDetailState\(detail\);\s*saveUiPrefs\(\);\s*draw\(false\);\s*\}/,
    'Expected chart detail changes to be persisted.'
  );
});

test('dashboard includes in-app forms for injection logging and schedule creation', () => {
  assert.match(
    source,
    /<form onsubmit="submitLog\(event\)">/,
    'Expected inline log injection form.'
  );

  assert.match(
    source,
    /<form onsubmit="submitSchedule\(event\)">/,
    'Expected inline schedule form.'
  );

  assert.match(
    source,
    /const action = editingId \? 'edit_injection' : 'log';/,
    'Expected log form submission to switch between create and edit actions.'
  );

  assert.match(
    source,
    /ui:\s*'dashboard'/,
    'Expected inline form submissions to request dashboard return mode.'
  );

  assert.match(
    source,
    /action:\s*'add_protocol'/,
    'Expected schedule form submission to route through add_protocol action payload.'
  );
});

test('past injections are editable from history list', () => {
  assert.match(
    source,
    /<button class="pill history-edit" type="button" data-edit-id="/,
    'Expected each history row to include an Edit button with injection id wiring.'
  );

  assert.match(
    source,
    /function startEditInjection\(injectionId\)/,
    'Expected edit handler to prefill the log form with selected injection values.'
  );

  assert.match(
    source,
    /function cancelLogEdit\(\)/,
    'Expected explicit cancel path for injection edit mode.'
  );

  assert.match(
    source,
    /if \(action === "edit_injection"\)/,
    'Expected shortcut backend to support updating existing injections.'
  );

  assert.match(
    source,
    /updateInjectionEntry\(data, injectionId, compound, dose, time, input\.notes \|\| ""\)/,
    'Expected edit action to persist injection updates through storage layer helper.'
  );
});

test('entry form controls are responsive and can shrink without overflow', () => {
  assert.match(
    source,
    /\.entry-row > \* \{\s*min-width: 0;/,
    'Expected row children to allow shrinking so date/time controls do not overflow.'
  );

  assert.match(
    source,
    /\.entry-card input,[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;/,
    'Expected entry inputs to be width-constrained and shrinkable in narrow layouts.'
  );

  assert.match(
    source,
    /@media \(max-width: 980px\) \{\s*\.entry-panels \{ grid-template-columns: 1fr; \}/,
    'Expected entry panels to stack at medium widths to preserve usable form field widths.'
  );
});

test('shortcut handler supports dashboard-return mode for form actions', () => {
  assert.match(
    source,
    /const returnDashboard = uiMode === "dashboard" \|\| uiMode === "open"/,
    'Expected shared dashboard-return mode parsing.'
  );

  assert.match(
    source,
    /if \(returnDashboard\) \{\s*await presentDashboard\(data\)\s*return\s*\}/,
    'Expected log/add_protocol actions to reopen dashboard in return mode.'
  );
});

test('dashboard includes past injections history panel', () => {
  assert.match(
    source,
    /<section class="history-panel">/,
    'Expected a dedicated past injections panel in dashboard.'
  );

  assert.match(
    source,
    /id="history-list" class="history-list"/,
    'Expected history list container for rendered past injections.'
  );

  assert.match(
    source,
    /function renderHistory\(\)/,
    'Expected renderHistory function for view-only injection history.'
  );
});

test('dashboard section order is graph first then concentrations then history then forms', () => {
  const graphIdx = source.indexOf('<div class="section-title">Trend Graph</div>');
  const cardsIdx = source.indexOf('<div class="section-title">Current Concentrations</div>');
  const historyIdx = source.indexOf('<div class="section-title">Past Injections</div>');
  const formsIdx = source.indexOf('<div class="section-title">Entry Forms</div>');

  assert.ok(graphIdx !== -1 && cardsIdx !== -1 && historyIdx !== -1 && formsIdx !== -1, 'Expected all main section titles to exist.');
  assert.ok(graphIdx < cardsIdx, 'Graph section should appear before concentrations section.');
  assert.ok(cardsIdx < historyIdx, 'Concentrations section should appear before past injections section.');
  assert.ok(historyIdx < formsIdx, 'Past injections section should appear before entry forms section.');
});

test('graph controls are below chart and forms are collapsed by default', () => {
  const chartIdx = source.indexOf('<div class="chart-wrap">');
  const toolbarIdx = source.indexOf('<div class="toolbar">');
  assert.ok(chartIdx !== -1 && toolbarIdx !== -1 && chartIdx < toolbarIdx, 'Expected graph controls below chart container.');

  assert.match(
    source,
    /<details id="entry-log" class="entry-card">/,
    'Expected log form to be collapsed details panel by default.'
  );

  assert.match(
    source,
    /<details id="entry-schedule" class="entry-card">/,
    'Expected schedule form to be collapsed details panel by default.'
  );

  assert.match(
    source,
    /id="window-1" class="pill" onclick="setWindow\(1\)"/,
    'Expected 1d graph window control.'
  );

  assert.match(
    source,
    /id="window-7" class="pill" onclick="setWindow\(7\)"/,
    'Expected 7d graph window control.'
  );

  assert.match(
    source,
    /id="custom-days" type="number"/,
    'Expected custom day window numeric control.'
  );
});

test('history pagination load-more wiring exists', () => {
  assert.match(
    source,
    /id="history-more" class="pill" type="button" onclick="loadMoreHistory\(\)"/,
    'Expected load more button for paginated history.'
  );

  assert.match(
    source,
    /const HISTORY_PAGE_SIZE = 15;/,
    'Expected finite page size constant for history pagination.'
  );

  assert.match(
    source,
    /function loadMoreHistory\(\)/,
    'Expected pagination handler function for history view.'
  );
});

test('graph supports custom day window and pinch interaction', () => {
  assert.match(
    source,
    /function applyCustomDays\(\)/,
    'Expected custom day apply handler for graph window.'
  );

  assert.match(
    source,
    /state\.pinchStartDistance = Math\.hypot\(/,
    'Expected two-finger pinch distance tracking.'
  );

  assert.match(
    source,
    /state\.days = proposed;\s*draw\(false\);/,
    'Expected pinch interaction to update graph day window and redraw.'
  );

  assert.match(
    source,
    /id="custom-days" type="number" min="1" max="365" step="1" inputmode="numeric"/,
    'Expected integer-focused custom day input configuration.'
  );

  assert.doesNotMatch(
    source,
    /onclick="applyCustomDays\(\)">Apply<\/button>/,
    'Expected no explicit Apply button; custom day value should auto-apply.'
  );

  assert.match(
    source,
    /customDaysInput\.addEventListener\('change', function\(\) \{\s*applyCustomDays\(\);\s*\}\);/,
    'Expected custom day changes to auto-apply chart window.'
  );

  assert.match(
    source,
    /customDaysInput\.addEventListener\('keydown', function\(event\) \{[\s\S]*?event\.key !== 'Enter'[\s\S]*?applyCustomDays\(\);[\s\S]*?\}\);/,
    'Expected Enter key on custom day input to auto-apply window changes.'
  );

  assert.match(
    source,
    /if \(custom\) custom\.value = String\(state\.days\);/,
    'Expected custom day input to stay synchronized with pinch/window state.'
  );
});
