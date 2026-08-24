const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const editor = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);
const fileService = fs.readFileSync(
  path.join(projectRoot, 'js', 'editor', 'EditorProjectFileService.js'),
  'utf8'
);

assert.match(fileService, /saveNative\(/);
assert.match(fileService, /saveFileDialog\(\{\s*defaultPath\s*\}\)/);
assert.match(fileService, /writeProjectJson\(savePath,\s*data\)/);
assert.match(editor, /getEditorProjectFileService\(\)\?\.saveNative\?\.\(/);
assert.match(editor, /window\.showSaveFilePicker/);
assert.match(editor, /async function edSaveProjectFile\(\)/);
assert.match(editor, /getEditorProjectFileService\(\)\?\.getPath\?\.\(\)/);
assert.match(editor, /edExportProjectFull\(\{\s*targetPath:\s*currentPath\s*\}\)/);

console.log('Editor native project save contract tests passed');
