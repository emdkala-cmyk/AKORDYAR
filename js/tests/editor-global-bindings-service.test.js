const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorGlobalBindingsService.js'),
  'utf8'
);

function target() {
  const listeners = new Map();
  return {
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
    emit(name, event = {}) {
      listeners.get(name)?.(event);
    },
    listenerCount() {
      return listeners.size;
    }
  };
}

const fakeWindow = target();
fakeWindow.requestAnimationFrame = callback => {
  callback();
  return 1;
};
fakeWindow.cancelAnimationFrame = () => {};
const fakeDocument = {};
const editorWrap = target();
const context = {
  document: fakeDocument,
  requestAnimationFrame: fakeWindow.requestAnimationFrame,
  cancelAnimationFrame: fakeWindow.cancelAnimationFrame
};
vm.runInNewContext(source, context);

let renderCount = 0;
let altState = false;
const service = context.EditorGlobalBindingsService.create({
  windowRef: fakeWindow,
  documentRef: fakeDocument,
  getSong: () => ({ id: 1 }),
  renderChords: () => { renderCount += 1; },
  getEditorWrap: () => editorWrap,
  isDragging: () => false,
  onAltChange: value => { altState = value; }
});

service.bind();
service.bind();
assert.equal(fakeWindow.listenerCount(), 4);
assert.equal(editorWrap.listenerCount(), 1);

fakeWindow.emit('keydown', { key: 'Alt' });
assert.equal(service.isAltDown(), true);
assert.equal(altState, true);
fakeWindow.emit('keyup', { key: 'Alt' });
assert.equal(service.isAltDown(), false);
editorWrap.emit('scroll');
assert.equal(renderCount, 1);

service.destroy();
assert.equal(fakeWindow.listenerCount(), 0);
assert.equal(editorWrap.listenerCount(), 0);
assert.equal(service.isAltDown(), false);

console.log('EditorGlobalBindingsService tests passed');
