const assert = require('node:assert/strict');
const CoreArrangerCreationService = require(
  '../app/CoreArrangerCreationService.js'
);

(async () => {
  const arrangers = [{ id: 'existing', name: 'Live' }];
  const prompts = [' Live ', 'New Set'];
  const calls = [];
  let editingArr = null;
  let nowValue = 40;
  let isoValue = 0;

  const runtime = CoreArrangerCreationService.create({
    getArrangers: () => arrangers,
    prompt: async () => prompts.shift(),
    playlistNameExists: name =>
      arrangers.some(arr => arr.name.toLowerCase() === name.toLowerCase()),
    saveArrangers: () => calls.push('save'),
    setEditingArr: value => {
      editingArr = value;
    },
    renderArrangerManager: () => calls.push('manager'),
    openArrEditor: () => calls.push('editor'),
    toast: message => calls.push(['toast', message]),
    now: () => ++nowValue,
    isoNow: () => `2026-08-26T00:00:0${++isoValue}.000Z`
  });

  const result = await runtime.createNewArranger();
  assert.equal(result, undefined);
  assert.equal(prompts.length, 0);
  assert.equal(arrangers.length, 2);
  assert.deepEqual(arrangers[0], {
    id: 'playlist_41',
    name: 'New Set',
    items: [],
    crossfade: 0,
    pauseBetween: false,
    createdAt: '2026-08-26T00:00:01.000Z',
    updatedAt: '2026-08-26T00:00:02.000Z'
  });
  assert.equal(editingArr, arrangers[0]);
  assert.ok(calls.includes('manager'));
  assert.ok(calls.includes('editor'));
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'toast' && (call[1] === '✅ پلی‌لیست «New Set» ساخته شد' || call[1] === 'playlistCreated')));
  // First prompt 'Live ' gets trimmed → 'Live' which matches existing → re-prompts with 'New Set'

  const cancelledRuntime = CoreArrangerCreationService.create({
    getArrangers: () => arrangers,
    prompt: async () => null,
    saveArrangers: () => {
      throw new Error('cancelled creation must not save');
    }
  });
  assert.equal(await cancelledRuntime.createNewArranger(), undefined);

  console.log('CoreArrangerCreationService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
