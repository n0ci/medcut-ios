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

test('buildSeries uses finer temporal resolution for short windows', () => {
  assert.match(
    source,
    /if \(spanDays <= 3\) stepHours = 0\.25/,
    'Expected 15-minute sampling for very short windows.'
  );

  assert.match(
    source,
    /else if \(spanDays <= 14\) stepHours = 0\.5/,
    'Expected 30-minute sampling for short windows.'
  );

  assert.match(
    source,
    /else if \(spanDays <= 45\) stepHours = 1/,
    'Expected hourly sampling for medium-short windows.'
  );
});

test('current concentration cards are computed from full history (logged + schedule)', () => {
  assert.match(
    source,
    /amountForCompoundAt\(data, name, now, \{\s*includeProtocols: true,\s*protocolOptions: \{ includePast: true, includeFuture: false \}\s*\}\)/,
    'Expected current amount to include both logged and scheduled history events.'
  );

  assert.match(
    source,
    /concentrationForCompoundAt\(data, name, now, \{\s*includeProtocols: true,\s*protocolOptions: \{ includePast: true, includeFuture: false \}\s*\}\)/,
    'Expected current concentration to include both logged and scheduled history events.'
  );
});

test('graph series include both past and future protocol events from schedule history', () => {
  assert.match(
    source,
    /protocolOptions: \{ includePast: true, includeFuture: true \}/,
    'Expected graph calculations to include schedule events across the displayed window.'
  );

  assert.match(
    source,
    /const includePast = Boolean\(options && options\.includePast\)/,
    'Expected protocol generation to support explicit past inclusion toggle.'
  );
});
