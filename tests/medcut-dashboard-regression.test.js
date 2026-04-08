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
    'Expected no-data warning to include explanatory detail context.'
  );

  assert.match(
    source,
    /setPlotWarning\('No dose events yet', 'Use Log Injection or Add Schedule to start plotting\.'\);/,
    'Expected explicit warning when no dose signal exists.'
  );
});

test('dashboard keeps only essential graph controls and simple ui preferences', () => {
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
    'Expected preference save handler to persist lightweight dashboard state.'
  );

  assert.doesNotMatch(
    source,
    /advanced-panel|chartDetail|setRouteFilter|setQualityFilter|setCategoryFilter|setChartDetail|resetAdvancedControls/,
    'Advanced control wiring should be removed from the simplified dashboard.'
  );

  assert.match(
    source,
    /id="focus-compound" class="focus-select" onchange="setFocusCompound\(this\.value\)"/,
    'Expected the remaining visible graph control to be the focus selector.'
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
    /action:\s*editingId \? 'edit_protocol' : 'add_protocol'/,
    'Expected schedule form submission to switch between create and edit protocol actions.'
  );
});

test('past injections are editable and deletable from history list', () => {
  assert.match(
    source,
    /<button class="pill history-edit" type="button" data-edit-id="/,
    'Expected each history row to include an Edit button with injection id wiring.'
  );

  assert.match(
    source,
    /<button class="pill history-delete" type="button" data-delete-id="/,
    'Expected each history row to include a Delete button with injection id wiring.'
  );

  assert.match(
    source,
    /function startEditInjection\(injectionId\)/,
    'Expected edit handler to prefill the log form with selected injection values.'
  );

  assert.match(
    source,
    /function deleteHistoryInjection\(injectionId\)/,
    'Expected delete handler for removing selected injection entries.'
  );

  assert.match(
    source,
    /function cancelLogEdit\(\)/,
    'Expected explicit cancel path for injection edit mode.'
  );

  assert.match(
    source,
    /edit_injection:\s*async function\(\)/,
    'Expected shortcut backend to support updating existing injections through the action registry.'
  );

  assert.match(
    source,
    /delete_injection:\s*async function\(\)/,
    'Expected shortcut backend to support deleting existing injections through the action registry.'
  );

  assert.match(
    source,
    /updateInjectionEntry\(data, injectionId, compound, dose, time, input\.notes \|\| ""\)/,
    'Expected edit action to persist injection updates through storage layer helper.'
  );

  assert.match(
    source,
    /removeInjectionEntry\(data, injectionId\)/,
    'Expected delete action to persist injection removal through storage layer helper.'
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
    /\.entry-row\.compact-datetime \{\s*grid-template-columns: minmax\(0, 1\.15fr\) minmax\(0, 0\.85fr\);/,
    'Expected compact datetime rows so date and time controls do not waste horizontal space.'
  );

  assert.match(
    source,
    /\.entry-card input,[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;/,
    'Expected entry inputs to be width-constrained and shrinkable in narrow layouts.'
  );

  assert.match(
    source,
    /\.entry-card input\[type="date"\],[\s\S]*?min-inline-size: 0;[\s\S]*?inline-size: 100%;/,
    'Expected date/time controls to override intrinsic WebView width.'
  );

  assert.match(
    source,
    /@media \(max-width: 980px\) \{[\s\S]*?\.action-rail \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/,
    'Expected the compact action rail to reflow at medium widths.'
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

test('dashboard prioritizes status and graph before actions', () => {
  const cardsIdx = source.indexOf('<div class="section-title">Current Status</div>');
  const graphIdx = source.indexOf('<div id="chart-section" class="section-title">Trend Graph</div>');
  const actionIdx = source.indexOf('<div class="section-title">Actions</div>');

  assert.ok(cardsIdx !== -1 && graphIdx !== -1 && actionIdx !== -1, 'Expected status, graph, and actions sections to exist.');
  assert.ok(cardsIdx < graphIdx, 'Current status should appear before the trend graph.');
  assert.ok(graphIdx < actionIdx, 'Trend graph should appear before the action workspace.');
});

test('graph controls remain below chart and actions open a management workspace', () => {
  const chartIdx = source.indexOf('<div class="chart-wrap">');
  const toolbarIdx = source.indexOf('<div class="graph-controls">');
  assert.ok(chartIdx !== -1 && toolbarIdx !== -1 && chartIdx < toolbarIdx, 'Expected graph controls below chart container.');

  assert.match(
    source,
    /id="focus-compound" class="focus-select" onchange="setFocusCompound\(this\.value\)"/,
    'Expected a visible focus-compound control near the graph.'
  );

  assert.match(
    source,
    /class="action-rail"/,
    'Expected a compact action rail below the graph.'
  );

  assert.match(
    source,
    /id="workspace-shell" class="workspace-shell"/,
    'Expected a shared management workspace container.'
  );

  assert.match(
    source,
    /function updateWorkspaceVisibility\(\)/,
    'Expected panel visibility to be coordinated through a single workspace function.'
  );

  assert.match(
    source,
    /function togglePanel\(name, shouldScroll\)/,
    'Expected action buttons to toggle one management panel at a time.'
  );

  assert.match(
    source,
    /id="workspace-empty" class="workspace-empty"/,
    'Expected an empty workspace hint instead of always-open forms.'
  );

  assert.match(
    source,
    /id="panel-log" class="workspace-panel"/,
    'Expected Quick Log to live inside the shared workspace.'
  );

  assert.match(
    source,
    /id="panel-history" class="workspace-panel"/,
    'Expected history management to live inside the shared workspace.'
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

  assert.match(
    source,
    /id="refresh-dashboard" class="pill" type="button" onclick="refreshDashboard\(\)"/,
    'Expected explicit dashboard refresh control in graph toolbar.'
  );
});

test('dashboard refresh action reopens dashboard run', () => {
  assert.match(
    source,
    /function refreshDashboard\(\) \{\s*const url = buildRunUrl\(\{ action: 'dashboard', ui: 'open' \}\);\s*window\.location\.href = url;\s*\}/,
    'Expected refresh action to relaunch Scriptable dashboard with fresh payload.'
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
