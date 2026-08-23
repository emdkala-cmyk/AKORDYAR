const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const main = fs.readFileSync(
  path.join(projectRoot, 'electron-main.js'),
  'utf8'
);
const buildScript = fs.readFileSync(
  path.join(projectRoot, 'build-installer.bat'),
  'utf8'
);

assert.match(main, /app\.getVersion\(\)/);
assert.doesNotMatch(main, /Version 1\.0\.0/);
assert.match(buildScript, /set "APP_VERSION=%%v"/);
assert.match(buildScript, /Akordyar Setup %APP_VERSION%\.exe/);
assert.doesNotMatch(buildScript, /Akordyar-Setup-1\.0\.0\.exe/);

console.log('Release version contract tests passed');
