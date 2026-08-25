const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const qualitySource = fs.readFileSync(
  path.join(projectRoot, 'js', 'quality', 'core-refactor-budget.js'),
  'utf8'
);
const budget = require('../quality/core-refactor-budget.js');

assert.equal(budget.budget.file, 'js/app/core.js');
assert.equal(budget.budget.finalTarget, 1000);
assert.equal(budget.budget.interimMax, 6000);
assert.equal(budget.finalGate, false);
assert.ok(budget.lineCount <= budget.budget.interimMax);
assert.match(qualitySource, /process\.argv\.includes\('--final'\)/);

console.log('Core refactor budget contract tests passed');
