const assert = require('node:assert/strict');

const lifecycle = require('../editor/EditorLifecycleService.js');

const children = [];
const documentRef = {
  readyState: 'complete',
  createElement: () => ({
    className: '',
    innerHTML: '',
    children: [],
    querySelector() {
      return { textContent: '' };
    }
  }),
  getElementById(id) {
    if (id !== 'timeline-tracks-container') return null;
    return {
      children,
      replaceChildren() {
        children.length = 0;
      },
      appendChild(value) {
        children.push(value);
      }
    };
  }
};

lifecycle.renderTimeline({
  documentRef,
  getDAW: () => ({ tracks: [{ name: 'Vocals' }, { name: 'Music' }] })
});
assert.equal(children.length, 2);

let initialized = [];
const ready = lifecycle.initialize({
  initDAW: () => initialized.push('daw'),
  initSong: () => initialized.push('song'),
  initAccidentalSelector: () => initialized.push('accidental'),
  applyI18n: () => initialized.push('i18n'),
  initHighlightEffect: () => initialized.push('highlight'),
  refreshStorageInfo: () => initialized.push('storage'),
  schedule: callback => callback()
});
assert.equal(typeof ready?.then, 'function');

ready.then(() => {
  assert.deepEqual(initialized, [
    'daw',
    'song',
    'accidental',
    'i18n',
    'highlight',
    'storage'
  ]);
  console.log('EditorLifecycleService tests passed');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
