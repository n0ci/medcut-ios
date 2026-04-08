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
