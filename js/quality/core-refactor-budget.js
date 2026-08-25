const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const budget = Object.freeze({
  file: 'js/app/core.js',
  finalTarget: 1000,
  interimMax: 6000
});

const source = fs.readFileSync(
  path.join(projectRoot, budget.file),
  'utf8'
);
const lineCount = source.split(/\r?\n/).length;
const finalGate = process.argv.includes('--final');
const allowedLines = finalGate ? budget.finalTarget : budget.interimMax;
const status = lineCount <= allowedLines ? 'OK' : 'FAIL';

console.log(
  `[core-refactor-budget] ${status} ${budget.file}: ${lineCount} lines ` +
  `(final target <= ${budget.finalTarget}, ` +
  `${finalGate ? 'final gate' : `interim max <= ${budget.interimMax}`})`
);

if (lineCount > allowedLines) {
  process.exitCode = 1;
}

module.exports = Object.freeze({
  budget,
  lineCount,
  finalGate,
  allowedLines
});
