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

test('repo ships seeded category templates including steroids', () => {
  const requiredFiles = [
    path.join(root, 'medications', 'peptides.json'),
    path.join(root, 'medications', 'painkillers.json'),
    path.join(root, 'medications', 'antidepressants.json'),
    path.join(root, 'medications', 'small_molecules.json'),
    path.join(root, 'medications', 'steroids.json'),
    path.join(root, 'history', 'peptides.json'),
    path.join(root, 'history', 'painkillers.json'),
    path.join(root, 'history', 'antidepressants.json'),
    path.join(root, 'history', 'small_molecules.json'),
    path.join(root, 'history', 'steroids.json')
  ];

  requiredFiles.forEach(filePath => {
    assert.ok(fs.existsSync(filePath), `Expected starter file ${path.relative(root, filePath)} to exist.`);
  });

  assert.match(
    fs.readFileSync(path.join(sourceDir, '00-config.js'), 'utf8'),
    /const STARTER_MEDICATION_LIBRARY = \{[\s\S]*?steroids:/,
    'Expected starter medication library to seed multiple categories including steroids.'
  );
});
