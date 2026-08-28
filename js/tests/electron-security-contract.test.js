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
assert.match(main, /const IPC_CHANNELS = Object\.freeze\(\[/);
assert.match(main, /function registerIpcHandler\(/);
assert.match(main, /isTrustedIpcSender\(event\)/);
assert.doesNotMatch(main, /ipcMain\.handle\(\s*['"]/);
// A native Electron Space accelerator bypasses DOM editing guards and makes
// lyric whitespace trigger transport playback.
assert.doesNotMatch(main, /accelerator:\s*['"]Space['"]/);
assert.match(preload, /const INVOKE_CHANNELS = Object\.freeze\(\[/);
assert.match(preload, /function invoke\(channel, \.\.\.args\)/);
assert.doesNotMatch(
  preload,
  /ipcRenderer\.invoke\(\s*['"]/
);

for (const channel of [
  'audio:read-file',
  'audio:copy-to-project',
  'audio:delete-file',
  'audio:resolve-path',
  'print:open-window',
  'dialog:show-message-box',
  'project:save-with-audio',
  'project:write-json',
  'project:load-file',
  'fs:check-exists',
  'dialog:open-file',
  'dialog:save-file'
]) {
  assert.match(
    main,
    new RegExp(`registerIpcHandler\\(['"]${channel.replace(':', '\\:')}['"]`)
  );
  assert.match(preload, new RegExp(`['"]${channel.replace(':', '\\:')}['"]`));
}

console.log('Electron security contract tests passed');
