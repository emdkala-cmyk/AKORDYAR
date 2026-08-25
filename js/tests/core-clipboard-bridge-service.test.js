const assert = require('node:assert/strict');
const ClipboardBridge = require('../app/CoreClipboardBridgeService.js');

const calls = [];
let factoryCalls = 0;
let deletionFactoryCalls = 0;
let saveReady = false;
const daw = { selectedIds: new Set(), selectedSectionIds: new Set() };
const bridge = ClipboardBridge.create({
  clipboardFactory: () => {
    factoryCalls += 1;
    return class FakeClipboard {
      constructor(options) {
        this.options = options;
        assert.equal(options.getDAW(), daw);
        assert.equal(typeof options.edSaveSong, 'function');
      }

      copySelected() {
        calls.push('copy');
      }

      deleteSelected() {
        calls.push('delete');
        this.options.deleteSelected();
      }
    };
  },
  deletionFactory: () => options => {
    deletionFactoryCalls += 1;
    assert.equal(options.getDAW(), daw);
    return { deleteSelected: () => calls.push('deletion') };
  },
  getEdSaveSong: () => saveReady ? () => {} : null,
  getDAW: () => daw,
  selectedClips: () => [],
  translate: key => key
});

assert.equal(bridge.getClipboardService(), null);
assert.equal(factoryCalls, 1);
assert.equal(bridge.copySelected(), undefined);
saveReady = true;
assert.equal(bridge.getClipboardService() instanceof Object, true);
assert.equal(factoryCalls, 3);
bridge.copySelected();
bridge.deleteSelected();
assert.deepEqual(calls, ['copy', 'delete', 'deletion']);
assert.equal(bridge.getClipboardService(), bridge.getClipboardService());
assert.equal(factoryCalls, 3);
assert.equal(deletionFactoryCalls, 1);

console.log('CoreClipboardBridgeService tests passed');
