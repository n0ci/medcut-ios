const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const medcutPath = path.join(__dirname, '..', 'MedCut.js');
const source = fs.readFileSync(medcutPath, 'utf8');

function approxEqual(actual, expected, tolerance, message) {
  const delta = Math.abs(actual - expected);
  assert.ok(
    delta <= tolerance,
    (message || 'Values are not approximately equal')
      + ` (actual=${actual}, expected=${expected}, delta=${delta}, tol=${tolerance})`
  );
}

function buildRuntime(fixedNowIso) {
  const marker = '// ---------- Main ----------';
  const cut = source.indexOf(marker);
  if (cut < 0) throw new Error('Unable to find main marker in MedCut.js');

  const preMain = source.slice(0, cut);
  const fixedNowMs = new Date(fixedNowIso).getTime();
  const RealDate = Date;

  function FakeDate(...args) {
    if (!(this instanceof FakeDate)) {
      return new RealDate(...args);
    }
    if (args.length === 0) {
      return new RealDate(fixedNowMs);
    }
    return new RealDate(...args);
  }
  FakeDate.now = () => fixedNowMs;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.parse = RealDate.parse;
  FakeDate.prototype = RealDate.prototype;

  const fileManagerStub = {
    joinPath: (a, b) => `${a}/${b}`,
    documentsDirectory: () => '/tmp',
    fileExists: () => false,
    listContents: () => [],
    createDirectory: () => {},
    readString: () => '{}',
    writeString: () => {},
    downloadFileFromiCloud: async () => {}
  };

  const context = {
    console,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Date: FakeDate,
    FileManager: { iCloud: () => fileManagerStub },
    DateFormatter: function DateFormatter() {
      this.dateFormat = '';
      this.useMediumDateStyle = () => {};
      this.useShortTimeStyle = () => {};
      this.string = value => new RealDate(value).toISOString();
    },
    Notification: function Notification() {
      this.title = '';
      this.body = '';
      this.schedule = async () => {};
    },
    Alert: function Alert() {
      this.title = '';
      this.message = '';
      this.addTextField = () => {};
      this.addAction = () => {};
      this.addCancelAction = () => {};
      this.presentSheet = async () => -1;
      this.presentAlert = async () => -1;
      this.textFieldValue = () => '';
    },
    WebView: function WebView() {
      this.loadHTML = async () => {};
      this.present = async () => {};
    },
    ListWidget: function ListWidget() {
      this.setPadding = () => {};
      this.addText = () => ({
        textColor: null,
        font: null
      });
      this.addSpacer = () => {};
      this.backgroundGradient = null;
    },
    LinearGradient: function LinearGradient() {
      this.colors = [];
      this.locations = [];
    },
    Color: function Color() {},
    Font: {
      boldSystemFont: () => null,
      systemFont: () => null
    },
    Script: {
      setShortcutOutput: () => {},
      setWidget: () => {},
      complete: () => {}
    },
    args: { queryParameters: {}, shortcutParameter: null },
    config: { runsInWidget: false }
  };

  vm.createContext(context);
  vm.runInContext(
    `${preMain}\n;globalThis.__medcut = { amountForCompoundAt, concentrationForCompoundAt, summaryRows, buildSeries };`,
    context
  );

  return context.__medcut;
}

function makeData(overrides) {
  const compoundId = 'peptides::test';
  const data = {
    schema_version: 1,
    compounds: {
      [compoundId]: {
        display_name: 'Test Compound',
        half_life_days: 1000000,
        bioavailability: 1,
        vd_l: 1,
        route: 'subcutaneous',
        model_quality: 'good',
        color: '#56CCF2',
        notes: '',
        category: 'peptides',
        base_key: 'test',
        source_file: 'peptides.json'
      }
    },
    injections: [],
    protocols: [],
    categories: ['peptides'],
    __files: {}
  };

  if (overrides && overrides.compound) {
    data.compounds[compoundId] = {
      ...data.compounds[compoundId],
      ...overrides.compound
    };
  }

  if (overrides && Array.isArray(overrides.injections)) {
    data.injections = overrides.injections.map((injection, i) => ({
      id: injection.id || `inj_${i}`,
      compound: injection.compound || compoundId,
      dose_mg: injection.dose_mg,
      time: injection.time,
      source: injection.source || 'log',
      notes: injection.notes || '',
      category: 'peptides',
      source_file: 'peptides.json'
    }));
  }

  if (overrides && Array.isArray(overrides.protocols)) {
    data.protocols = overrides.protocols.map((protocol, i) => ({
      id: protocol.id || `pro_${i}`,
      compound: protocol.compound || compoundId,
      start: protocol.start,
      dose_mg: protocol.dose_mg,
      every_days: protocol.every_days,
      occurrences: protocol.occurrences,
      until: protocol.until || null,
      enabled: protocol.enabled !== false,
      notes: protocol.notes || '',
      category: 'peptides',
      source_file: 'peptides.json'
    }));
  }

  return { data, compoundId };
}

function makeTirzepatideData(injections) {
  return makeData({
    compound: {
      display_name: 'Tirzepatide',
      half_life_days: 5,
      bioavailability: 0.8,
      vd_l: 9.7,
      route: 'subcutaneous',
      model_quality: 'good'
    },
    injections: injections
  });
}

function expectedTirzepatideAmountAt(evalTimeIso, injections) {
  const halfLifeDays = 5;
  const bioavailability = 0.8;
  const elimination = Math.log(2) / halfLifeDays;
  const evalMs = new Date(evalTimeIso).getTime();

  return injections.reduce((sum, shot) => {
    const t = new Date(shot.time).getTime();
    if (!Number.isFinite(t) || t > evalMs) return sum;
    const ageDays = (evalMs - t) / 86400000;
    return sum + shot.dose_mg * bioavailability * Math.exp(-elimination * ageDays);
  }, 0);
}

test('PK math stacks doses: 10 mg + 2 mg stays near 12 mg with negligible decay', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 1000000, bioavailability: 1, vd_l: 1 },
    injections: [
      { dose_mg: 10, time: '2026-04-08T11:00:00.000Z' },
      { dose_mg: 2, time: '2026-04-08T11:30:00.000Z' }
    ]
  });

  const amount = runtime.amountForCompoundAt(
    data,
    compoundId,
    new Date('2026-04-08T12:00:00.000Z'),
    { includeProtocols: false }
  );

  approxEqual(amount, 12, 0.01, 'Expected near-additive stacking at short age with huge half-life.');
});

test('Concentration equals amount divided by Vd', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 1000000, bioavailability: 1, vd_l: 10 },
    injections: [{ dose_mg: 12, time: '2026-04-08T12:00:00.000Z' }]
  });

  const when = new Date('2026-04-08T12:00:00.000Z');
  const amount = runtime.amountForCompoundAt(data, compoundId, when, { includeProtocols: false });
  const concentration = runtime.concentrationForCompoundAt(data, compoundId, when, { includeProtocols: false });

  approxEqual(amount, 12, 0.0001, 'Expected immediate amount to match injected dose for F=1 and no decay age.');
  approxEqual(concentration, amount / 10, 0.0001, 'Expected concentration to equal amount / vd_l.');
});

test('Current rows exclude not-yet-occurred scheduled doses', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 1000000, bioavailability: 1, vd_l: 1 },
    protocols: [
      { start: '2026-04-09T12:00:00.000Z', dose_mg: 20, every_days: 7, occurrences: 1, enabled: true }
    ]
  });

  const rows = runtime.summaryRows(data);
  const row = rows.find(r => r.name === compoundId);
  assert.ok(row, 'Expected summary row for protocol-backed active compound.');
  approxEqual(row.amount, 0, 0.0001, 'Expected current amount to ignore future-only scheduled doses.');
});

test('Future protocol inclusion toggle changes future-time amount calculations', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 1000000, bioavailability: 1, vd_l: 1 },
    protocols: [
      { start: '2026-04-09T12:00:00.000Z', dose_mg: 5, every_days: 7, occurrences: 1, enabled: true }
    ]
  });

  const evalTime = new Date('2026-04-10T12:00:00.000Z');
  const withoutFuture = runtime.amountForCompoundAt(data, compoundId, evalTime, {
    includeProtocols: true,
    protocolOptions: { includePast: true, includeFuture: false }
  });
  const withFuture = runtime.amountForCompoundAt(data, compoundId, evalTime, {
    includeProtocols: true,
    protocolOptions: { includePast: true, includeFuture: true }
  });

  approxEqual(withoutFuture, 0, 0.0001, 'Expected future protocol doses to be excluded when includeFuture=false.');
  assert.ok(withFuture > 4.99, 'Expected scheduled future dose to contribute at future eval time when includeFuture=true.');
});

test('Graph now-point amount matches current summary amount for same fixture', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 14, bioavailability: 1, vd_l: 1 },
    injections: [
      { dose_mg: 6, time: '2026-04-07T12:00:00.000Z' },
      { dose_mg: 2, time: '2026-04-08T06:00:00.000Z' }
    ],
    protocols: [
      { start: '2026-04-09T12:00:00.000Z', dose_mg: 10, every_days: 7, occurrences: 1, enabled: true }
    ]
  });

  const rows = runtime.summaryRows(data);
  const row = rows.find(r => r.name === compoundId);
  assert.ok(row, 'Expected summary row for selected compound.');

  const series = runtime.buildSeries(data, [compoundId], 2, 2, 'amount');
  const compoundSeries = series.compounds.find(c => c.name === compoundId);
  assert.ok(compoundSeries, 'Expected graph series for selected compound.');

  const nowMs = new Date(series.now).getTime();
  const nowPoint = compoundSeries.points
    .map(p => ({ t: new Date(p[0]).getTime(), v: Number(p[1]) }))
    .sort((a, b) => Math.abs(a.t - nowMs) - Math.abs(b.t - nowMs))[0];

  assert.ok(nowPoint, 'Expected at least one graph point near now.');
  approxEqual(nowPoint.v, row.amount, 0.05, 'Expected graph now-point to track current summary amount.');
});

test('Graph preserves forecast behavior for future scheduled doses', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 1000000, bioavailability: 1, vd_l: 1 },
    protocols: [
      { start: '2026-04-09T00:00:00.000Z', dose_mg: 10, every_days: 7, occurrences: 1, enabled: true }
    ]
  });

  const series = runtime.buildSeries(data, [compoundId], 1, 2, 'amount');
  const compoundSeries = series.compounds.find(c => c.name === compoundId);
  assert.ok(compoundSeries, 'Expected graph series for protocol-backed compound.');

  const nowMs = new Date(series.now).getTime();
  const nowPoint = compoundSeries.points
    .map(p => ({ t: new Date(p[0]).getTime(), v: Number(p[1]) }))
    .sort((a, b) => Math.abs(a.t - nowMs) - Math.abs(b.t - nowMs))[0];

  const futureMax = compoundSeries.points
    .map(p => ({ t: new Date(p[0]).getTime(), v: Number(p[1]) }))
    .filter(p => p.t > nowMs)
    .reduce((max, p) => Math.max(max, p.v), 0);

  assert.ok(nowPoint && nowPoint.v < 0.01, 'Expected near-zero current graph value before future scheduled dose occurs.');
  assert.ok(futureMax > 9.9, 'Expected future graph forecast to reflect upcoming scheduled dose.');
});

test('Long-running protocol still contributes to current amount in lookback window', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 50, bioavailability: 1, vd_l: 1 },
    protocols: [
      {
        start: '2020-01-01T12:00:00.000Z',
        dose_mg: 1,
        every_days: 1,
        occurrences: null,
        enabled: true
      }
    ]
  });

  const when = new Date('2026-04-08T12:00:00.000Z');
  const amount = runtime.amountForCompoundAt(data, compoundId, when, {
    includeProtocols: true,
    protocolOptions: { includePast: true, includeFuture: false }
  });

  assert.ok(amount > 1, 'Expected steady-state accumulation from long-running daily protocol history.');
});

test('Adaptive lookback includes older doses for long half-life compounds', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const { data, compoundId } = makeData({
    compound: { half_life_days: 400, bioavailability: 1, vd_l: 1 },
    injections: [{ dose_mg: 10, time: '2024-04-10T12:00:00.000Z' }]
  });

  const when = new Date('2026-04-08T12:00:00.000Z');
  const amount = runtime.amountForCompoundAt(data, compoundId, when, { includeProtocols: false });

  assert.ok(amount > 2, 'Expected older injection to remain in scope for very long half-life compounds.');
});

test('Tirzepatide concentration matches PK expectation for mixed doses and intervals', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const shots = [
    { dose_mg: 2.5, time: '2026-03-25T12:00:00.000Z' },
    { dose_mg: 5.0, time: '2026-04-01T12:00:00.000Z' },
    { dose_mg: 7.5, time: '2026-04-06T12:00:00.000Z' }
  ];
  const { data, compoundId } = makeTirzepatideData(shots);

  const whenIso = '2026-04-08T12:00:00.000Z';
  const when = new Date(whenIso);

  const amount = runtime.amountForCompoundAt(data, compoundId, when, { includeProtocols: false });
  const concentration = runtime.concentrationForCompoundAt(data, compoundId, when, { includeProtocols: false });

  const expectedAmount = expectedTirzepatideAmountAt(whenIso, shots);
  const expectedConcentration = expectedAmount / 9.7;

  approxEqual(amount, expectedAmount, 0.00001, 'Expected tirzepatide amount to match closed-form multi-shot PK sum.');
  approxEqual(concentration, expectedConcentration, 0.00001, 'Expected tirzepatide concentration to match closed-form PK amount/Vd.');
});

test('Tirzepatide concentration increases with higher shot frequency at fixed dose', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const frequentShots = [
    { dose_mg: 5, time: '2026-03-09T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-03-14T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-03-19T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-03-24T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-03-29T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-04-03T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-04-08T12:00:00.000Z' }
  ];
  const sparseShots = [
    { dose_mg: 5, time: '2026-03-09T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-03-19T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-03-29T12:00:00.000Z' },
    { dose_mg: 5, time: '2026-04-08T12:00:00.000Z' }
  ];

  const frequent = makeTirzepatideData(frequentShots);
  const sparse = makeTirzepatideData(sparseShots);
  const when = new Date('2026-04-08T12:00:00.000Z');

  const cFrequent = runtime.concentrationForCompoundAt(frequent.data, frequent.compoundId, when, { includeProtocols: false });
  const cSparse = runtime.concentrationForCompoundAt(sparse.data, sparse.compoundId, when, { includeProtocols: false });

  assert.ok(cFrequent > cSparse, 'Expected higher tirzepatide concentration with more frequent same-dose shots.');
  assert.ok(cFrequent > cSparse * 1.3, 'Expected materially higher concentration with 5-day frequency versus 10-day frequency.');
});

test('Tirzepatide concentration responds to mixed dose and frequency pattern changes', () => {
  const runtime = buildRuntime('2026-04-08T12:00:00.000Z');
  const lowPattern = [
    { dose_mg: 2.5, time: '2026-03-11T12:00:00.000Z' },
    { dose_mg: 2.5, time: '2026-03-25T12:00:00.000Z' },
    { dose_mg: 2.5, time: '2026-04-08T12:00:00.000Z' }
  ];
  const intensifiedPattern = [
    { dose_mg: 2.5, time: '2026-03-11T12:00:00.000Z' },
    { dose_mg: 5.0, time: '2026-03-25T12:00:00.000Z' },
    { dose_mg: 7.5, time: '2026-04-01T12:00:00.000Z' },
    { dose_mg: 7.5, time: '2026-04-08T12:00:00.000Z' }
  ];

  const low = makeTirzepatideData(lowPattern);
  const high = makeTirzepatideData(intensifiedPattern);
  const when = new Date('2026-04-08T12:00:00.000Z');

  const cLow = runtime.concentrationForCompoundAt(low.data, low.compoundId, when, { includeProtocols: false });
  const cHigh = runtime.concentrationForCompoundAt(high.data, high.compoundId, when, { includeProtocols: false });

  assert.ok(cHigh > cLow, 'Expected higher concentration when both dose and shot frequency are increased.');
  assert.ok(cHigh > cLow * 2, 'Expected strong concentration uplift under intensified tirzepatide regimen.');
});
