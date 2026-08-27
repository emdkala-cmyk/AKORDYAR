const assert = require('node:assert/strict');
const EditorPublicApi = require('../editor/EditorPublicApi.js');

const target = {};
const api = EditorPublicApi.create({
  target,
  namespace: 'TestEditorApi'
});
const saveSong = () => 'saved';
const renderChords = () => 'rendered';

assert.equal(api.publish({ saveSong }).saveSong(), 'saved');
assert.equal(target.TestEditorApi.saveSong, saveSong);
assert.equal(api.get('saveSong'), saveSong);
assert.equal(api.has('renderChords'), false);

const snapshot = api.publish({ renderChords });
assert.equal(snapshot.renderChords, renderChords);
assert.equal(target.TestEditorApi.renderChords, renderChords);
assert.equal(api.has('renderChords'), true);
assert.equal(Object.isFrozen(snapshot), true);

assert.throws(() => api.publish({ invalid: true }), TypeError);
assert.throws(
  () => EditorPublicApi.create({ target: null }),
  TypeError
);

console.log('Editor public API tests passed');
