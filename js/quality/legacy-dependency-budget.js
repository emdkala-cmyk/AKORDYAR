const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const serviceRoot = path.join(projectRoot, 'js', 'editor');
const forbiddenPatterns = [
  { name: 'window.edCur', pattern: /window\.edCur/ },
  { name: 'global DAW mutation/access', pattern: /\b(?:window|globalThis)\.DAW\b/ },
  { name: 'global PERF mutation/access', pattern: /\b(?:window|globalThis)\.PERF\b/ }
];

let failed = false;
for (const name of fs.readdirSync(serviceRoot).filter(file => file.endsWith('.js'))) {
  const relativePath = path.join('js', 'editor', name);
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(source)) {
      failed = true;
      console.error(
        `[legacy-dependency-budget] FAIL ${relativePath}: ${forbidden.name}`
      );
    }
  }
}

if (failed) process.exitCode = 1;
else console.log('[legacy-dependency-budget] editor services passed');
