const assert = require('node:assert/strict');
const ArchivePublicApi = require('../archive/ArchivePublicApi.js');

const target = {};
const api = ArchivePublicApi.create({
  target,
  namespace: 'TestArchiveApi'
});
const open = () => 'opened';
const close = () => 'closed';

const firstSnapshot = api.publish({ open });
assert.equal(firstSnapshot.open(), 'opened');
assert.equal(target.TestArchiveApi.open, open);
assert.equal(api.get('open'), open);
assert.equal(api.has('close'), false);

const secondSnapshot = api.publish({ close });
assert.equal(secondSnapshot.open, open);
assert.equal(secondSnapshot.close(), 'closed');
assert.equal(target.TestArchiveApi.close, close);
assert.equal(api.has('close'), true);
assert.equal(Object.isFrozen(secondSnapshot), true);

assert.throws(() => api.publish({ invalid: true }), TypeError);
assert.throws(
  () => ArchivePublicApi.create({ target: null }),
  TypeError
);

console.log('Archive public API tests passed');
