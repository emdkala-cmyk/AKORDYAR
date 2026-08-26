const assert = require('node:assert/strict');
const CoreArrangerSaveService = require(
  '../app/CoreArrangerSaveService.js'
);

function run() {
  const elements = {
    arrName: { value: '  Saved Set  ' },
    arrCrossfadeRange: { value: '2.5' }
  };
  const editingArr = { id: 'arr-1', name: 'Old', items: ['song-1'] };
  const calls = [];
  const timers = [];
  const cancelled = [];

  const runtime = CoreArrangerSaveService.create({
    getElement: id => elements[id],
    getEditingArr: () => editingArr,
    playlistNameExists: () => false,
    saveArrangers: () => calls.push('save'),
    renderArrangerManager: () => calls.push('manager'),
    toast: message => calls.push(['toast', message]),
    isoNow: () => '2026-08-26T12:00:00.000Z',
    schedule: (callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    },
    cancel: timer => {
      if (timer) cancelled.push(timer);
    }
  });

  runtime.saveCurrentArranger();
  assert.equal(editingArr.name, 'Saved Set');
  assert.equal(editingArr.updatedAt, '2026-08-26T12:00:00.000Z');
  assert.equal(editingArr.crossfade, 2.5);
  assert.deepEqual(calls, [
    'save',
    'manager',
    ['toast', '✅ پلی‌لیست «Saved Set» ذخیره شد (1 آهنگ)']
  ]);

  const duplicateRuntime = CoreArrangerSaveService.create({
    getElement: () => ({ value: 'Duplicate' }),
    getEditingArr: () => editingArr,
    playlistNameExists: () => true,
    saveArrangers: () => {
      throw new Error('duplicate must not save');
    },
    toast: message => calls.push(['duplicate', message])
  });
  duplicateRuntime.saveCurrentArranger();
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'duplicate'));

  runtime.saveCurrentArrangerDebounced();
  runtime.saveCurrentArrangerDebounced();
  assert.equal(timers.length, 2);
  assert.equal(timers[1].delay, 500);
  assert.deepEqual(cancelled, [timers[0]]);
  timers[1].callback();
  assert.equal(calls.filter(call => call === 'save').length, 2);

  const emptyRuntime = CoreArrangerSaveService.create({
    getEditingArr: () => null,
    toast: message => calls.push(['empty', message])
  });
  emptyRuntime.saveCurrentArranger();
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'empty'));

  console.log('CoreArrangerSaveService tests passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
