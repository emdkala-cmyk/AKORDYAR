const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const editor = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);

const nativeSaveIndex = editor.indexOf('window.electronAPI.saveFileDialog');
const nativeWriteIndex = editor.indexOf('window.electronAPI.writeProjectJson');
const browserPickerIndex = editor.indexOf('window.showSaveFilePicker');

assert.notEqual(nativeSaveIndex, -1);
assert.notEqual(nativeWriteIndex, -1);
assert.notEqual(browserPickerIndex, -1);
assert.ok(nativeSaveIndex < browserPickerIndex);
assert.ok(nativeWriteIndex < browserPickerIndex);
assert.match(editor, /saveFileDialog\(\{\s*defaultPath:\s*defaultName\s*\}\)/);
assert.match(editor, /async function edSaveProjectFile\(\)/);
assert.match(editor, /edCurrentProjectFilePath/);
assert.match(editor, /edExportProjectFull\(\{\s*targetPath:\s*edCurrentProjectFilePath\s*\}\)/);

console.log('Editor native project save contract tests passed');
