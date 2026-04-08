const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const medcutPath = path.join(__dirname, '..', 'MedCut.js');
const source = fs.readFileSync(medcutPath, 'utf8');

function buildRuntime() {
  const marker = '// ---------- Main ----------';
  const cut = source.indexOf(marker);
  if (cut < 0) throw new Error('Unable to find main marker in MedCut.js');

  const preMain = source.slice(0, cut);
  const fixedNowMs = new Date('2026-04-08T12:00:00.000Z').getTime();
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
    readString: () => '{"compounds":{},"injections":[],"protocols":[]}',
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
      this.addText = () => ({ textColor: null, font: null });
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
      systemFont: () => null,
      semiboldSystemFont: () => null
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
    `${preMain}\n;globalThis.__medcut = { buildDashboardPayload, buildDashboardDatasets, activeCompoundNames, compoundNames };`,
    context
  );

  return context.__medcut;
}

function makeData() {
  return {
    schema_version: 1,
    compounds: {
      'peptides::alpha': {
        display_name: 'Alpha',
        category: 'peptides',
        color: '#112233',
        model_quality: 'good',
        route: 'subq',
        source_file: 'peptides.json'
      },
      'peptides::beta': {
        display_name: 'Beta',
        category: 'peptides',
        color: '#445566',
        model_quality: 'rough',
        route: 'subq',
        source_file: 'peptides.json'
      }
    },
    injections: [
      { id: 'inj-old', compound: 'peptides::alpha', dose_mg: 1, time: '2026-03-31T12:00:00.000Z', source: 'log', notes: '', category: 'peptides' },
      { id: 'inj-new', compound: 'peptides::beta', dose_mg: 2, time: '2026-04-07T12:00:00.000Z', source: 'log', notes: '', category: 'peptides' }
    ],
    protocols: [
      { id: 'pro-1', compound: 'peptides::beta', start: '2026-04-09T12:00:00.000Z', dose_mg: 2, every_days: 7, occurrences: 1, enabled: true, notes: '', category: 'peptides' }
    ],
    categories: ['peptides'],
    __files: {}
  };
}

test('dashboard payload includes overview counts, latest history ordering, and next schedule metadata', () => {
  const runtime = buildRuntime();
  const data = makeData();
  const rows = [
    {
      name: 'peptides::alpha',
      display_name: 'Alpha',
      category: 'peptides',
      color: '#112233',
      quality: 'good',
      quality_label: 'Higher confidence',
      route: 'subq',
      amount: 1.23456,
      concentration: 0.123456,
      last: { dose_mg: 1, time: '2026-04-01T12:00:00.000Z' },
      next: { time: '2026-04-09T12:00:00.000Z' }
    },
    {
      name: 'peptides::beta',
      display_name: 'Beta',
      category: 'peptides',
      color: '#445566',
      quality: 'rough',
      quality_label: 'Exploratory model',
      route: 'subq',
      amount: 2.5,
      concentration: 0.25,
      last: { dose_mg: 2, time: '2026-04-07T12:00:00.000Z' },
      next: null
    }
  ];

  const payload = runtime.buildDashboardPayload(data, rows);

  assert.deepEqual(JSON.parse(JSON.stringify(payload.overview)), {
    compound_count: 2,
    active_compound_count: 2,
    injection_count: 2,
    recent_injection_count: 1,
    enabled_schedule_count: 1,
    next_scheduled_at: '2026-04-09T12:00:00.000Z'
  });

  assert.deepEqual(
    payload.injection_history.map(item => item.id),
    ['inj-new', 'inj-old'],
    'Expected history to be sorted newest first for the dashboard feed.'
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(payload.categories)),
    [
      { value: 'all', label: 'All classes' },
      { value: 'peptides', label: 'Peptides' }
    ],
    'Expected dashboard payload to include explicit category labels for custom pickers.'
  );

  assert.equal(payload.datasets.amount_7.mode, 'amount');
  assert.equal(payload.datasets.concentration_7.mode, 'concentration');
  assert.equal(payload.datasets.amount_7.compounds.length, 2);
  assert.equal(payload.datasets.amount_7.compounds[0].points.length > 0, true);
});

test('dashboard datasets are built for every shared window and mode', () => {
  const runtime = buildRuntime();
  const data = makeData();
  const defaults = runtime.activeCompoundNames(data);
  const datasets = runtime.buildDashboardDatasets(data, defaults);

  assert.deepEqual(
    Object.keys(datasets).sort(),
    [
      'amount_1',
      'amount_180',
      'amount_30',
      'amount_365',
      'amount_7',
      'amount_90',
      'concentration_1',
      'concentration_180',
      'concentration_30',
      'concentration_365',
      'concentration_7',
      'concentration_90'
    ]
  );

  assert.equal(datasets.amount_30.mode, 'amount');
  assert.equal(datasets.concentration_365.mode, 'concentration');
  assert.equal(datasets.amount_1.compounds.length, 2);
  assert.equal(Array.isArray(datasets.amount_1.compounds[0].markers), true);
});
