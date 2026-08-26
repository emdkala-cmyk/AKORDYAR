const assert = require('node:assert/strict');
const CorePlayerViewPopupService = require(
  '../app/CorePlayerViewPopupService.js'
);

const popup = { closed: false };
const documentRef = { id: 'player-document' };
let snapshotCalls = 0;
let syncCalls = 0;
const renders = [];

const runtime = CorePlayerViewPopupService.create({
  getPopup: () => popup,
  isPopupOpen: value => value === popup,
  popupDocument: value => (value === popup ? documentRef : null),
  getSnapshot: () => {
    snapshotCalls++;
    return {
      title: '',
      artist: 'Artist',
      key: 'D',
      keyMode: 'min',
      lyrics: 'Line one\nLine two',
      transpose: 2,
      styles: { tSize: 24 },
      chords: [
        {
          lineIndex: 0,
          charIndex: 0,
          anchorType: 'LineStart',
          name: 'C'
        }
      ]
    };
  },
  translate: key => (key === 'untitled' ? 'Untitled' : key),
  getCurrentLang: () => 'en',
  transposeChord: (name, transpose) => `${name}:${transpose}`,
  popupSyncRuntime: {
    syncExistingPopup: () => {
      syncCalls++;
      return false;
    }
  },
  popupBuilderRuntime: {
    render: config => renders.push(config)
  }
});

runtime.sync();
assert.equal(snapshotCalls, 1);
assert.equal(syncCalls, 1);
assert.equal(renders.length, 1);
assert.deepEqual(renders[0], {
  documentRef,
  title: 'Untitled',
  sub: 'Artist  ·  Key: Dm',
  lines: ['Line one', 'Line two'],
  styles: { tSize: 24 },
  chords: [
    {
      lineIndex: 0,
      charIndex: 0,
      anchorType: 'LineStart',
      _name: 'C:2'
    }
  ]
});

const existingRuntime = CorePlayerViewPopupService.create({
  getPopup: () => popup,
  isPopupOpen: () => true,
  popupDocument: () => documentRef,
  getSnapshot: () => {
    throw new Error('snapshot should not be read for an existing popup');
  },
  popupSyncRuntime: { syncExistingPopup: () => true },
  popupBuilderRuntime: { render: () => {
    throw new Error('builder should not run for an existing popup');
  } }
});
existingRuntime.sync();

const closedRuntime = CorePlayerViewPopupService.create({
  getPopup: () => ({ closed: true }),
  getSnapshot: () => {
    throw new Error('snapshot should not be read for a closed popup');
  }
});
closedRuntime.sync();

console.log('CorePlayerViewPopupService tests passed');
