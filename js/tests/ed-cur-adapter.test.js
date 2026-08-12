const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const context = {
  console,
  Set,
  Object
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(
  fs.readFileSync(
    path.resolve(__dirname, '..', 'core', 'EdCurAdapter.js'),
    'utf8'
  ),
  context,
  { filename: 'js/core/EdCurAdapter.js' }
);

const adapter = context.EdCurAdapter;
const firstSong = { id: 'song-1' };
const secondSong = { id: 'song-2' };
const changes = [];
const unsubscribe = adapter.onChange((name, value) => {
  changes.push([name, value]);
});

assert.equal(adapter.setEdCur(firstSong), firstSong);
assert.equal(adapter.getEdCur(), firstSong);
assert.equal(context.edCur, firstSong);
assert.equal(context.window.edCur, firstSong);
assert.equal(adapter.hasSong(), true);

// Legacy assignment must update the same canonical reference.
context.window.edCur = secondSong;
assert.equal(adapter.getEdCur(), secondSong);
assert.equal(adapter.getId(), 'song-2');

unsubscribe();
context.window.edCur = null;
assert.equal(adapter.getEdCur(), null);
assert.equal(adapter.hasSong(), false);
assert.deepEqual(changes.map(([name]) => name), ['set', 'set']);

console.log('EdCurAdapter ownership tests passed');
