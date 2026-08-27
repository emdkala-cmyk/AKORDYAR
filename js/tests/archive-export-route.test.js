const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const archive = fs.readFileSync(
  path.join(projectRoot, 'js', 'archive', 'ArchiveModule.js'),
  'utf8'
);

assert.match(
  archive,
  /async function edExportProject\(\)\s*\{\s*if \(getArchiveEditorApi\(\)\.exportProjectFull\)/
);
assert.doesNotMatch(archive, /typeof edExportProjectFull/);
assert.doesNotMatch(archive, /encodeAudioToWebM\(buffer, 128000\)/);
assert.doesNotMatch(archive, /uint8ToBase64\(encoded\)/);

console.log('Archive export route contract tests passed');
