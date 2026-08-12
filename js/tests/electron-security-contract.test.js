const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'Akordyar.html'), 'utf8');
const main = fs.readFileSync(path.join(projectRoot, 'electron-main.js'), 'utf8');
const preload = fs.readFileSync(path.join(projectRoot, 'preload.js'), 'utf8');

assert.doesNotMatch(html, /window\.require\s*\(/);
assert.doesNotMatch(html, /typeof\s+require\s*!==/);
assert.match(preload, /contextBridge\.exposeInMainWorld\(\s*['"]electronAPI['"]/);
assert.match(
  main,
  /mainWindow\s*=\s*new\s+BrowserWindow[\s\S]{0,1200}nodeIntegration:\s*false/
);
assert.match(
  main,
  /printWindow\s*=\s*new\s+BrowserWindow[\s\S]{0,600}contextIsolation:\s*true[\s\S]{0,80}sandbox:\s*true/
);

console.log('Electron security contract tests passed');
