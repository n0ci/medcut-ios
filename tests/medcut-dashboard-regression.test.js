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
    /setPlotWarning\('No data available for this plot', 'Adjust filters or log an injection to generate chart data\.'\);/,
    'Expected explicit warning when filters produce no series.'
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
    /action:\s*'log'/,
    'Expected log form submission to route through log action payload.'
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
