const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const medcutPath = path.join(__dirname, '..', 'MedCut.js');
const source = fs.readFileSync(medcutPath, 'utf8');

test('loadData tracks canonical data warnings', () => {
  assert.match(
    source,
    /__diagnostics:\s*\{\s*warnings:\s*\[\]\s*\}/,
    'Expected loadData diagnostics to track warning messages for canonical data issues.'
  );
});

test('history merge uses canonical category/base compound IDs', () => {
  assert.doesNotMatch(
    source,
    /function resolveHistoryCompoundId\(rawValue, categoryHint\)/,
    'Expected legacy history resolver to be removed in canonical-only mode.'
  );

  assert.match(
    source,
    /const compoundId = makeCompoundId\(category, injection\.compound\)/,
    'Expected history injections to resolve through canonical category/base IDs.'
  );

  assert.match(
    source,
    /Unknown injection compound \$\{injection\.compound\} in \$\{fileName\}/,
    'Expected invalid injection references to emit warnings instead of recovery logic.'
  );
});

test('normalizeCompoundKey only accepts canonical ids or category-qualified base keys', () => {
  assert.match(
    source,
    /const names = compoundNames\(data\)/,
    'Expected canonical matching to iterate the known compound IDs directly.'
  );

  assert.match(
    source,
    /if \(wantedCategory && needle\.indexOf\("::"\) === -1\) \{/,
    'Expected base-key lookup to require an explicit category.'
  );

  assert.match(
    source,
    /const candidate = makeCompoundId\(wantedCategory, normalizeCategoryName\(needle\)\)/,
    'Expected canonical category/base construction for shortcut input.'
  );

  assert.doesNotMatch(
    source,
    /displayMatches|baseMatches|categoryBaseInput/,
    'Expected legacy fuzzy/display-name compound matching paths to be removed.'
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
    /const protocolOptions = protocolOptionsForTime\(now, now\)/,
    'Expected summary rows to derive protocol inclusion from a shared helper at current time.'
  );

  assert.match(
    source,
    /amountForCompoundAt\(data, name, now, \{\s*includeProtocols: true,\s*protocolOptions: protocolOptions\s*\}\)/,
    'Expected current amount to include both logged and scheduled history events.'
  );

  assert.match(
    source,
    /concentrationForCompoundAt\(data, name, now, \{\s*includeProtocols: true,\s*protocolOptions: protocolOptions\s*\}\)/,
    'Expected current concentration to include both logged and scheduled history events.'
  );
});

test('graph series derive protocol inclusion from sample-time semantics', () => {
  assert.match(
    source,
    /function protocolOptionsForTime\(referenceNow, evaluationTime\)/,
    'Expected shared protocol options helper for current and graph calculations.'
  );

  assert.match(
    source,
    /const protocolOptions = protocolOptionsForTime\(now, time\)/,
    'Expected graph point calculations to use sample-time protocol inclusion.'
  );

  assert.match(
    source,
    /const includePast = options && typeof options\.includePast === "boolean" \? options\.includePast : true/,
    'Expected protocol generation to default to including past schedule events unless explicitly disabled.'
  );

  assert.match(
    source,
    /const includeFuture = options && typeof options\.includeFuture === "boolean" \? options\.includeFuture : true/,
    'Expected protocol generation to default to including future schedule events unless explicitly disabled.'
  );
});
