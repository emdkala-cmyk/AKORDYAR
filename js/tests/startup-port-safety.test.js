const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const main = fs.readFileSync(
  path.join(projectRoot, 'electron-main.js'),
  'utf8'
);
const server = fs.readFileSync(
  path.join(projectRoot, 'server.js'),
  'utf8'
);
const launchers = [
  fs.readFileSync(path.join(projectRoot, 'Run-Akordyar.bat'), 'utf8'),
  fs.readFileSync(path.join(projectRoot, 'start.bat'), 'utf8')
];

assert.doesNotMatch(main, /stopExistingServerOnPort|taskkill/);
assert.match(main, /checkAkordyarServer/);
assert.match(main, /SERVER_HEALTH_URL/);
assert.match(main, /app\.quit\(\);\s*return;/);
assert.match(server, /app\.get\(['"]\/api\/health['"]/);
assert.match(server, /service:\s*['"]akordyar['"]/);

for (const launcher of launchers) {
  assert.doesNotMatch(launcher, /taskkill/i);
}

console.log('Startup port safety contract tests passed');
