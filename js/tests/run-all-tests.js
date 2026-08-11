const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const testDir = __dirname;
const testFiles = fs.readdirSync(testDir)
  .filter(name => name.endsWith('.test.js'))
  .sort()
  .map(name => path.join(testDir, name));

const entries = [
  path.join(projectRoot, 'parser-test.js'),
  ...testFiles
];

for (const entry of entries) {
  console.log(`\n=== ${path.relative(projectRoot, entry)} ===`);
  const result = spawnSync(process.execPath, [entry], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`\nAll ${entries.length} test entries passed.`);
