const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editorSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'editor.js'),
  'utf8'
);
const keyboardControllerSource = fs.readFileSync(
  path.resolve(
    __dirname,
    '..',
    'editor',
    'EditorKeyboardControllerService.js'
  ),
  'utf8'
);

const attachCall = editorSource.indexOf('attachHistoryService();');
const lifecycleCall = editorSource.indexOf(
  'window.EditorLifecycleService?.initialize?.({'
);

assert.notEqual(attachCall, -1, 'HistoryService must attach during editor startup');
assert.notEqual(lifecycleCall, -1, 'EditorLifecycleService startup call must exist');
assert.ok(
  attachCall < lifecycleCall,
  'HistoryService must attach before lifecycle initialization'
);
assert.equal(
  editorSource.lastIndexOf('attachHistoryService();'),
  attachCall,
  'HistoryService must not be attached again after lifecycle initialization'
);
assert.match(editorSource, /deactivateHistory,\s*activateHistory/);
assert.match(editorSource, /function undo\(\)\s*\{\s*return getHistoryService\(\)\.undo\(\);\s*\}/s);
assert.match(editorSource, /function redo\(\)\s*\{\s*return getHistoryService\(\)\.redo\(\);\s*\}/s);
assert.match(editorSource, /undo:\s*\(\)\s*=>\s*undo\(\)/);
assert.match(editorSource, /redo:\s*\(\)\s*=>\s*redo\(\)/);
assert.match(keyboardControllerSource, /onUndo:\s*action\('undo'\)/);
assert.match(keyboardControllerSource, /onRedo:\s*action\('redo'\)/);

console.log('Editor history startup-order contract tests passed');
