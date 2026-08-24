const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const core = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'core.js'),
  'utf8'
);
const editor = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);
const html = fs.readFileSync(
  path.join(projectRoot, 'Akordyar.html'),
  'utf8'
);

assert.ok(
  html.indexOf('js/editor/ArrangerPlaybackPolicyService.js') <
    html.indexOf('js/app/core.js'),
  'arranger playback policy must load before core'
);
assert.match(core, /ArrangerPlaybackPolicyService/);
assert.match(core, /!arrPerformActive && !getEditorDAW\(\)\.isRecording/);
assert.match(core, /arrangerPlaybackPolicy\?\.createBoundary/);
assert.match(editor, /arrangerPlaybackPolicy\?\.applyToDAW/);

console.log('Arranger playback contract tests passed');
