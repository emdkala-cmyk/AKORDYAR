const assert = require('node:assert/strict');
const ArchiveUndoService = require('../archive/ArchiveUndoService.js');

let songs = [{ id: 'one', title: 'اولیه' }];
let now = 100;
const service = ArchiveUndoService.create({
  getSongs: () => songs,
  maxEntries: 2,
  getNow: () => now++
});

service.push('اول');
songs[0].title = 'تغییر اول';
service.push('دوم');
songs[0].title = 'تغییر دوم';
service.push('سوم');

const stack = service.getStack();
assert.equal(stack.length, 2);
assert.deepEqual(stack.map(item => item.desc), ['دوم', 'سوم']);
assert.deepEqual(stack.map(item => item.time), [101, 102]);
assert.equal(stack[0].snapshot[0].title, 'تغییر اول');

songs[0].title = 'تغییر بعدی';
assert.equal(stack[1].snapshot[0].title, 'تغییر دوم');

assert.throws(
  () => ArchiveUndoService.create(),
  /requires getSongs/
);

console.log('ArchiveUndoService tests passed');
