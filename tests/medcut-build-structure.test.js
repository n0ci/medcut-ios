const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const bundlePath = path.join(root, 'MedCut.js');
const buildScriptPath = path.join(root, 'scripts', 'build.js');
const sourceDir = path.join(root, 'src');
const bundle = fs.readFileSync(bundlePath, 'utf8');

test('build script exists for generating the Scriptable bundle', () => {
  assert.ok(fs.existsSync(buildScriptPath), 'Expected scripts/build.js to exist.');
  assert.match(
    fs.readFileSync(buildScriptPath, 'utf8'),
    /const orderedFiles = \[/,
    'Expected build script to concatenate ordered source files.'
  );
});

test('source tree is sectioned and the generated bundle advertises its origin', () => {
  const requiredFiles = [
    '00-config.js',
    '10-storage.js',
    '20-core.js',
    '30-widget.js',
    '40-dashboard.js',
    '50-prompts.js',
    '99-main.js'
  ];

  requiredFiles.forEach(fileName => {
    assert.ok(fs.existsSync(path.join(sourceDir, fileName)), `Expected source file ${fileName} to exist.`);
  });

  assert.match(
    bundle,
    /Generated from src\/\*\.js by scripts\/build\.js\./,
    'Expected built bundle banner describing the generated artifact.'
  );
});
