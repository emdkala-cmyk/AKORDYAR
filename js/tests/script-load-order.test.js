const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'Akordyar.html'),
  'utf8'
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
  scriptIndex('js/editor/SyncModeController.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorRuntimeAdapter.js') <
    scriptIndex('js/app/core.js')
);

console.log('Script load-order contract tests passed');
