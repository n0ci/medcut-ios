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

  assert.match(
    source,
    /function graphLegendCompounds\(\)\s*\{\s*return currentGraphVisibleCompounds\(\);/,
    'Expected legend entries to be derived from current graph-visible compounds, not the full catalog.'
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

test('chart surface disables text selection and touch callouts on iphone', () => {
  assert.match(
    source,
    /\.chart-wrap \{[\s\S]*?-webkit-user-select: none;[\s\S]*?user-select: none;[\s\S]*?-webkit-touch-callout: none;/,
    'Expected chart wrapper to disable text selection and iOS touch callouts.'
  );

  assert.match(
    source,
    /chartWrap\.addEventListener\(eventName, function\(event\) \{\s*event\.preventDefault\(\);/ ,
    'Expected chart wrapper to prevent selectstart/contextmenu defaults.'
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

  assert.doesNotMatch(
    source,
    /focus-compound|setFocusCompound\(|focus-category|focus-search/,
    'Focus graph controls should be removed from the simplified dashboard.'
  );

  assert.doesNotMatch(
    source,
    /Schema v<span id="schema"><\/span>|live estimate from logs and enabled schedules|getElementById\('schema'\)/,
    'The top header should avoid verbose schema/live-estimate copy.'
  );

  assert.match(
    source,
    /const BROWSER_DEFAULT_CATEGORY = 'general';[\s\S]*?function browserTitleCase\(value\)/,
    'Expected browser-local fallback helpers instead of Scriptable-only globals in the WebView.'
  );

  assert.match(
    source,
    /function currentGraphVisibleCompounds\(\)[\s\S]*?return compoundHasVisibleSignal\(compound\);/,
    'Expected graph-visible compounds to be based on actual visible signal, not every catalog series.'
  );

  assert.match(
    source,
    /function normalizeEnabledCompounds\(\)[\s\S]*?if \(!state\.enabled\.length && visibleNames\.length\) \{\s*state\.enabled = visibleNames\.slice\(\);/,
    'Expected enabled legend state to be normalized against current graph-visible compounds.'
  );

  assert.match(
    source,
    /const chips = \[\s*\{ label: 'Active', value: visibleCompounds\.length, note: 'in view' \}/,
    'Expected the Active header chip to reflect current graph-visible compounds.'
  );
});

test('dashboard forms support class-first and typed substance filtering', () => {
  assert.match(
    source,
    /id="log-category" onchange="handlePickerCategoryChange\('log'\)"/,
    'Expected Quick Log to expose class filtering.'
  );

  assert.match(
    source,
    /id="log-search" type="search" placeholder="Type to filter substances" oninput="handlePickerSearchChange\('log'\)"/,
    'Expected Quick Log to expose typed substance filtering.'
  );

  assert.match(
    source,
    /id="schedule-category" onchange="handlePickerCategoryChange\('schedule'\)"/,
    'Expected schedule form to expose class filtering.'
  );

  assert.match(
    source,
    /function compoundsForPicker\(kind\)/,
    'Expected shared picker filtering logic across dashboard selectors.'
  );

  assert.match(
    source,
    /select \{[\s\S]*?inline-size: 100%;[\s\S]*?-webkit-appearance: none;[\s\S]*?padding-right: 32px;[\s\S]*?text-indent: 0;/,
    'Expected select controls to use explicit mobile-safe sizing and non-clipping styling.'
  );

  assert.match(
    source,
    /\.picker-toolbar > \* \{\s*min-width: 0;/,
    'Expected picker toolbar children to be shrinkable so class labels do not clip.'
  );

  assert.match(
    source,
    /<label class="field-label" for="log-category">Class<\/label>[\s\S]*?<label class="field-label" for="log-compound">Substance<\/label>/,
    'Expected dashboard pickers to use explicit labels for class and substance selection.'
  );
});

test('header uses compact count chips and status cards expand for details', () => {
  assert.match(
    source,
    /class="hero-chip"/,
    'Expected the top header to render compact count chips.'
  );

  assert.match(
    source,
    /data-card-expand="/,
    'Expected status cards to expose expandable detail containers.'
  );

  assert.match(
    source,
    /state\.expandedCard = state\.expandedCard === name \? null : name;/,
    'Expected only one status card detail view to be expanded at a time.'
  );

  assert.match(
    source,
    /<div class="small">Confidence: /,
    'Expected confidence metadata to move into the expandable details section.'
  );

  assert.match(
    source,
    /function currentActiveStatusCompoundNames\(\)[\s\S]*?return compoundHasVisibleSignal\(compound\);/,
    'Expected status cards to use active compounds with visible signal, independent of graph focus.'
  );

  assert.match(
    source,
    /const visibleNames = currentActiveStatusCompoundNames\(\);/,
    'Expected Current Status cards to be scoped by active compounds rather than the focused graph subset.'
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

test('status cards and picker surfaces can shrink to the viewport without overflow', () => {
  assert.match(
    source,
    /\.card \{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;[\s\S]*?box-sizing: border-box;[\s\S]*?overflow: hidden;/,
    'Expected status cards to stay within the viewport on narrow screens.'
  );

  assert.match(
    source,
    /\.big \{[\s\S]*?overflow-wrap: anywhere;/,
    'Expected large status values to wrap instead of forcing horizontal overflow.'
  );

  assert.match(
    source,
    /\.card-topline \{[\s\S]*?min-width: 0;/,
    'Expected card toplines to allow inner content to shrink on narrow screens.'
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
    /\.entry-row\.compact-datetime \{\s*grid-template-columns: 1fr;/,
    'Expected date and time controls to stack vertically for reliable mobile layout.'
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
    /<label class="field-label" for="log-date">Date<\/label>[\s\S]*?<input id="log-date" type="date" required>[\s\S]*?<label class="field-label" for="log-time">Time<\/label>[\s\S]*?<input id="log-time" type="time" required>/,
    'Expected Quick Log date and time controls to be explicit labeled fields.'
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

test('native prompt chooser narrows substances by class first', () => {
  assert.match(
    source,
    /categoryAlert\.message = "Choose a class first"/,
    'Expected native compound chooser to prompt for class before substance.'
  );

  assert.match(
    source,
    /categoryAlert\.addAction\("All classes"\)/,
    'Expected native compound chooser to allow an all-classes fallback.'
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

  assert.doesNotMatch(
    source,
    /Focus chart|focus-compound|setFocusCompound\(/,
    'Expected graph focus UI and card actions to be removed.'
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
