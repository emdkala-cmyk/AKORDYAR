const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'Akordyar.html'),
  'utf8'
);

const appBootstrap = fs.readFileSync(
  path.resolve(__dirname, '..', 'app.js'),
  'utf8'
);

assert.match(appBootstrap, /createApplicationLoader/);
assert.match(appBootstrap, /data-loader-mode="document-write"/);
assert.match(appBootstrap, /loadWithDocumentWrite/);
assert.doesNotMatch(
  appBootstrap,
  /if\s*\(\s*document\.readyState\s*===\s*['"]loading['"]\s*\)\s*\{\s*document\.write/
);

function scriptIndex(sourceName) {
  const index = html.indexOf(`src="${sourceName}"`);
  assert.notEqual(index, -1, `${sourceName} must be loaded`);
  return index;
}

assert.ok(
  scriptIndex('js/core/RuntimeStateAdapter.js') <
    scriptIndex('js/archive/ArchiveRuntimeAdapter.js')
);
assert.ok(
  scriptIndex('js/core/TransposeService.js') <
    scriptIndex('js/editor/EditorNotationService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorNotationService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordStateService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAnchorService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSelectionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordDragService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorTextSelectionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordCommandService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EdCurAdapter.js') <
    scriptIndex('js/archive/ArchiveRuntimeAdapter.js')
);
assert.ok(
  scriptIndex('js/core/TextEncodingService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveRuntimeAdapter.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/editor/HistoryService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorLifecycleService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorHydrationService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/SyncModeController.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorRuntimeAdapter.js') <
    scriptIndex('js/app/core.js')
);

console.log('Script load-order contract tests passed');
