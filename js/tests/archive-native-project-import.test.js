const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const archive = fs.readFileSync(
  path.join(projectRoot, 'js', 'archive', 'ArchiveModule.js'),
  'utf8'
);

const nativeDialogIndex = archive.indexOf('window.electronAPI.openFileDialog');
const nativeLoadIndex = archive.indexOf('window.electronAPI.loadProjectFile');
const browserInputIndex = archive.lastIndexOf('input.click();');

assert.match(archive, /async function edImportProject\(\)/);
assert.notEqual(nativeDialogIndex, -1);
assert.notEqual(nativeLoadIndex, -1);
assert.ok(nativeDialogIndex < browserInputIndex);
assert.ok(nativeLoadIndex < browserInputIndex);
assert.match(
  archive,
  /text:\s*async\s*\(\)\s*=>\s*JSON\.stringify\(data\)/
);

console.log('Archive native project import contract tests passed');
