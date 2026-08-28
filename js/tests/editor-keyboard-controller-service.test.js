const assert = require('node:assert/strict');
const ControllerService = require(
  '../editor/EditorKeyboardControllerService.js'
);

let capturedOptions = null;
const runtime = Object.freeze({ handleKeydown: () => true });
const runtimeService = {
  create(options) {
    capturedOptions = options;
    return runtime;
  }
};

const calls = [];
const selected = [];
const controller = ControllerService.create({
  runtimeService,
  windowRef: {
    setTimeout(callback) {
      callback();
      return 1;
    },
    document: {
      getElementById() {
        return null;
      }
    }
  },
  actions: {
    getDAW: () => ({
      isPlaying: false,
      playhead: 0,
      clips: [{ id: 'clip-1' }]
    }),
    ensureAudioCtx: () => calls.push('audio'),
    seekTransport: () => calls.push('seek'),
    startTransport: () => calls.push('start'),
    openLyricOnlyPopup: () => calls.push('lyric-only'),
    openLyricPopup: () => calls.push('lyric'),
    setSelection: ids => selected.push(...ids)
  }
});

assert.ok(controller);
assert.equal(controller.get(), runtime);
assert.equal(controller.get(), runtime);
assert.ok(capturedOptions);

capturedOptions.transport.onSelectAllClips();
assert.deepEqual(selected, ['clip-1']);

capturedOptions.transport.onFullscreen();
assert.deepEqual(calls, [
  'lyric-only',
  'lyric',
  'audio',
  'seek',
  'start'
]);
assert.equal(
  ControllerService.create({ runtimeService: {} }),
  null
);

console.log('EditorKeyboardControllerService tests passed');
