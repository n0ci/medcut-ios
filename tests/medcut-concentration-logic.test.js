const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const medcutPath = path.join(__dirname, '..', 'MedCut.js');
const source = fs.readFileSync(medcutPath, 'utf8');

test('loadData tracks diagnostics for recovered/skipped history events', () => {
  assert.match(
    source,
    /__diagnostics:\s*\{\s*skipped_injections:\s*0,\s*skipped_protocols:\s*0,\s*recovered_injections:\s*0,\s*recovered_protocols:\s*0\s*\}/,
    'Expected loadData diagnostics counters for history merge outcomes.'
  );
});

test('history merge resolves compounds via fallback resolver instead of silent drop', () => {
  assert.match(
    source,
    /function resolveHistoryCompoundId\(rawValue, categoryHint\)/,
    'Expected dedicated resolver for history compound IDs.'
  );

  assert.match(
    source,
    /const resolved = resolveHistoryCompoundId\(injection\.compound, category\)/,
    'Expected injection merge to use fallback resolver.'
  );

  assert.match(
    source,
    /merged\.__diagnostics\.skipped_injections \+= 1/,
    'Expected skipped injection diagnostics when resolution fails.'
  );

  assert.doesNotMatch(
    source,
    /if \(!merged\.compounds\[compoundId\]\) continue/,
    'Silent continue on unresolved compound should not exist in history merge.'
  );
});

test('normalizeCompoundKey matching is deterministic and category-aware', () => {
  assert.match(
    source,
    /const names = compoundNames\(data\)\.slice\(\)\.sort\(\)/,
    'Expected deterministic sorted compound matching order.'
  );

  assert.match(
    source,
    /const categoryBaseInput = /,
    'Expected category/base parsing variable.'
  );

  assert.match(
    source,
    /\.exec\(needle\)/,
    'Expected category/base parsing to run against user input.'
  );

  assert.match(
    source,
    /if \(name\.toLowerCase\(\) === needle\) return name/,
    'Expected exact full-id match preference.'
  );
});
