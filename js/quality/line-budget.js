const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const budgets = [
  { file: 'js/app.js', max: 200, target: 150 },
  { file: 'js/app/core.js', max: 6000, target: 5600 },
  { file: 'js/app/editor.js', max: 6500, target: 6000 }
];

let failed = false;

for (const budget of budgets) {
  const absolutePath = path.join(projectRoot, budget.file);
  const lineCount = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
  const status = lineCount > budget.max ? 'FAIL' : lineCount > budget.target ? 'WARN' : 'OK';
  console.log(
    `[line-budget] ${status} ${budget.file}: ${lineCount} lines ` +
    `(target <= ${budget.target}, max <= ${budget.max})`
  );
  if (lineCount > budget.max) failed = true;
}

if (failed) process.exitCode = 1;
