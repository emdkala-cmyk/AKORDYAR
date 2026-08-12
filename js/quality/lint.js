const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const roots = ['js/app', 'js/core', 'js/editor'];
const files = roots.flatMap(relativeRoot => {
  const absoluteRoot = path.join(projectRoot, relativeRoot);
  return fs.readdirSync(absoluteRoot)
    .filter(name => name.endsWith('.js'))
    .map(name => path.join(absoluteRoot, name));
});

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || `${file} failed syntax check\n`);
  }
}

if (failed) process.exitCode = 1;
else console.log(`[lint] syntax checks passed for ${files.length} JavaScript files`);
