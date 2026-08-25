const assert = require('node:assert/strict');
const MovableWindowBridge = require(
  '../app/CoreMovableWindowBridgeService.js'
);

const calls = [];
let factoryCalls = 0;
const documentRef = { id: 'document' };
const windowRef = { id: 'window' };
const startPointerDrag = () => calls.push('drag');
const service = MovableWindowBridge.create({
  movableWindowFactory: () => {
    factoryCalls += 1;
    return options => {
      assert.equal(options.documentRef, documentRef);
      assert.equal(options.windowRef, windowRef);
      assert.equal(options.startPointerDrag, startPointerDrag);
      return {
        bind: () => calls.push('bind')
      };
    };
  },
  documentRef,
  windowRef,
  startPointerDrag
});

assert.equal(factoryCalls, 0);
assert.equal(service.getEditorMovableWindowService().bind, service.getEditorMovableWindowService().bind);
assert.equal(factoryCalls, 1);
service.initMovableWindows();
assert.deepEqual(calls, ['bind']);

const missing = MovableWindowBridge.create({
  movableWindowFactory: () => null
});
assert.throws(
  () => missing.getEditorMovableWindowService(),
  /EditorMovableWindowService is not loaded/
);

console.log('CoreMovableWindowBridgeService tests passed');
