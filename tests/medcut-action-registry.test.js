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

  const calls = [];
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
      setShortcutOutput: payload => calls.push(['shortcutOutput', payload]),
      setWidget: () => {},
      complete: () => {}
    },
    args: { queryParameters: {}, shortcutParameter: null },
    config: { runsInWidget: false }
  };

  vm.createContext(context);
  vm.runInContext(
    `${preMain}\n;globalThis.__medcut = { handleShortcut };`,
    context
  );

  const data = {
    schema_version: 1,
    compounds: {
      'peptides::tirzepatide': {
        display_name: 'Tirzepatide',
        category: 'peptides',
        source_file: 'peptides.json',
        base_key: 'tirzepatide'
      }
    },
    categories: ['peptides'],
    injections: [],
    protocols: [],
    __files: {}
  };

  context.presentDashboard = async () => {
    calls.push(['presentDashboard']);
  };
  context.promptLogInjection = async () => {
    calls.push(['promptLogInjection']);
  };
  context.promptAddProtocol = async () => {
    calls.push(['promptAddProtocol']);
  };
  context.showMenu = async () => {
    calls.push(['showMenu']);
  };
  context.normalizeCompoundKey = () => 'peptides::tirzepatide';
  context.addInjection = () => {
    calls.push(['addInjection']);
  };
  context.addProtocolEntry = () => {
    calls.push(['addProtocolEntry']);
  };
  context.updateInjectionEntry = () => {
    calls.push(['updateInjectionEntry']);
  };
  context.removeInjectionEntry = () => {
    calls.push(['removeInjectionEntry']);
    return {
      id: 'inj_1',
      source_file: 'peptides.json',
      compound: 'peptides::tirzepatide'
    };
  };
  context.shortcutOutput = payload => {
    calls.push(['shortcutOutput', payload]);
  };
  context.summaryRows = () => [{ name: 'peptides::tirzepatide' }];
  context.allMedicationFilePaths = () => ['/tmp/medications/peptides.json'];
  context.allHistoryFilePaths = () => ['/tmp/history/peptides.json'];
  context.iso = value => new RealDate(value).toISOString();
  context.titleCase = value => String(value);
  context.categoryFilePath = value => `/tmp/medications/${value}`;
  context.historyFilePath = value => `/tmp/history/${value}`;

  return { handleShortcut: context.__medcut.handleShortcut, data, calls };
}

test('action registry dispatches every supported shortcut action', async () => {
  const runtime = buildRuntime();
  const cases = [
    { input: { action: 'prompt_log' }, expect: 'promptLogInjection' },
    { input: { action: 'prompt_protocol' }, expect: 'promptAddProtocol' },
    { input: { action: 'menu' }, expect: 'showMenu' },
    { input: { action: 'dashboard' }, expect: 'presentDashboard' },
    { input: { action: 'open' }, expect: 'presentDashboard' },
    { input: { action: 'summary' }, expect: 'shortcutOutput' },
    { input: { action: 'log', compound: 'peptides::tirzepatide', dose_mg: 2.5 }, expect: 'shortcutOutput' },
    { input: { action: 'edit_injection', injection_id: 'inj_1', compound: 'peptides::tirzepatide', dose_mg: 2.5 }, expect: 'shortcutOutput' },
    { input: { action: 'delete_injection', injection_id: 'inj_1' }, expect: 'shortcutOutput' },
    { input: { action: 'add_protocol', compound: 'peptides::tirzepatide', dose_mg: 2.5, every_days: 7, start: '2026-04-08T12:00:00.000Z' }, expect: 'shortcutOutput' }
  ];

  for (const testCase of cases) {
    runtime.calls.length = 0;
    await runtime.handleShortcut(runtime.data, testCase.input);
    assert.ok(runtime.calls.some(call => call[0] === testCase.expect), `Expected ${testCase.input.action} to hit ${testCase.expect}`);
  }
});

test('dashboard-return mode prefers the refreshed dashboard over shortcut output', async () => {
  const runtime = buildRuntime();

  runtime.calls.length = 0;
  await runtime.handleShortcut(runtime.data, {
    action: 'log',
    ui: 'dashboard',
    compound: 'peptides::tirzepatide',
    dose_mg: 2.5
  });
  assert.deepEqual(runtime.calls.map(call => call[0]), ['addInjection', 'presentDashboard']);

  runtime.calls.length = 0;
  await runtime.handleShortcut(runtime.data, {
    action: 'edit_injection',
    ui: 'open',
    injection_id: 'inj_1',
    compound: 'peptides::tirzepatide',
    dose_mg: 2.5
  });
  assert.deepEqual(runtime.calls.map(call => call[0]), ['updateInjectionEntry', 'presentDashboard']);

  runtime.calls.length = 0;
  await runtime.handleShortcut(runtime.data, {
    action: 'delete_injection',
    ui: 'dashboard',
    injection_id: 'inj_1'
  });
  assert.deepEqual(runtime.calls.map(call => call[0]), ['removeInjectionEntry', 'presentDashboard']);

  runtime.calls.length = 0;
  await runtime.handleShortcut(runtime.data, {
    action: 'add_protocol',
    ui: 'dashboard',
    compound: 'peptides::tirzepatide',
    dose_mg: 2.5,
    every_days: 7,
    start: '2026-04-08T12:00:00.000Z'
  });
  assert.deepEqual(runtime.calls.map(call => call[0]), ['addProtocolEntry', 'presentDashboard']);
});

test('unsupported actions fail fast', async () => {
  const runtime = buildRuntime();
  await assert.rejects(
    () => runtime.handleShortcut(runtime.data, { action: 'not-real' }),
    /Unsupported action: not-real/
  );
});
