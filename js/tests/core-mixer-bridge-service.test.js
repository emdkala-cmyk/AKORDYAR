const assert = require('node:assert/strict');
const MixerBridge = require('../app/CoreMixerBridgeService.js');

const calls = [];
let factoryCalls = 0;
const dependencies = {
  getDAW: () => ({ tracks: [] }),
  getElement: id => ({ id }),
  documentRef: { name: 'document' },
  windowRef: { name: 'window' },
  saveState: () => calls.push('save'),
  renderTracks: () => calls.push('tracks'),
  renderClips: () => calls.push('clips'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  startPointerDrag: () => calls.push('drag')
};

const bridge = MixerBridge.create({
  ...dependencies,
  mixerFactory: () => options => {
    factoryCalls += 1;
    assert.equal(options.getDAW, dependencies.getDAW);
    assert.equal(options.documentRef, dependencies.documentRef);
    return {
      updateTrackMix: id => calls.push(['mix', id]),
      toggle: () => calls.push('toggle'),
      render: () => calls.push('render'),
      initDrag: () => calls.push('init-drag')
    };
  }
});

assert.equal(factoryCalls, 0);
bridge.updateTrackMix('t1');
assert.equal(factoryCalls, 1);
bridge.toggleMixer();
bridge.renderMixer();
bridge.initMixerDrag();
assert.equal(
  bridge.getEditorMixerService(),
  bridge.getEditorMixerService()
);
assert.equal(factoryCalls, 1);
assert.deepEqual(calls, [
  ['mix', 't1'],
  'toggle',
  'render',
  'init-drag'
]);

const missing = MixerBridge.create({ mixerFactory: () => null });
assert.equal(missing.getEditorMixerService(), null);
assert.equal(missing.updateTrackMix('t2'), undefined);

console.log('CoreMixerBridgeService tests passed');
