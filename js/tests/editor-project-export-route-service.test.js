const assert = require('node:assert/strict');

const routeModule = require('../editor/EditorProjectExportRouteService.js');

(async () => {
  const blob = { type: 'application/json' };
  let pickerOptions = null;
  let writtenBlob = null;
  let closed = false;
  const pickerService = routeModule.create({
    getShowSaveFilePicker: () => async options => {
      pickerOptions = options;
      return {
        createWritable: async () => ({
          write: async value => { writtenBlob = value; },
          close: async () => { closed = true; }
        })
      };
    },
    getConfirm: () => () => {
      throw new Error('confirm must not run after picker success');
    }
  });

  assert.deepEqual(
    await pickerService.saveBrowser({
      blob,
      defaultName: 'Song.json',
      pickerOptions: { suggestedName: 'Song.json' },
      confirmMessage: 'unused'
    }),
    { handled: true, status: 'saved', mode: 'picker' }
  );
  assert.deepEqual(pickerOptions, { suggestedName: 'Song.json' });
  assert.equal(writtenBlob, blob);
  assert.equal(closed, true);

  let confirmCalls = 0;
  const cancelledPickerService = routeModule.create({
    getShowSaveFilePicker: () => async () => {
      throw { name: 'AbortError' };
    },
    getConfirm: () => () => {
      confirmCalls += 1;
      return true;
    }
  });
  assert.deepEqual(
    await cancelledPickerService.saveBrowser({
      blob,
      defaultName: 'Cancelled.json',
      confirmMessage: 'unused'
    }),
    { handled: true, status: 'cancelled', mode: 'picker' }
  );
  assert.equal(confirmCalls, 0);

  let clicked = 0;
  let scheduledCallback = null;
  let revokedUrl = null;
  const fallbackService = routeModule.create({
    getShowSaveFilePicker: () => async () => {
      throw new Error('picker unavailable');
    },
    getConfirm: () => message => message === 'download?',
    documentRef: {
      createElement: tag => {
        assert.equal(tag, 'a');
        return {
          click: () => { clicked += 1; }
        };
      }
    },
    urlRef: {
      createObjectURL: value => {
        assert.equal(value, blob);
        return 'blob:project';
      },
      revokeObjectURL: value => { revokedUrl = value; }
    },
    schedule: (callback, delay) => {
      scheduledCallback = { callback, delay };
    },
    logger: { warn() {} }
  });

  const fallbackResult = await fallbackService.saveBrowser({
    blob,
    defaultName: 'Fallback.json',
    confirmMessage: 'download?'
  });
  assert.deepEqual(fallbackResult, {
    handled: true,
    status: 'saved',
    mode: 'download'
  });
  assert.equal(clicked, 1);
  assert.equal(scheduledCallback.delay, 5000);
  scheduledCallback.callback();
  assert.equal(revokedUrl, 'blob:project');

  const declinedService = routeModule.create({
    getShowSaveFilePicker: () => undefined,
    getConfirm: () => () => false
  });
  assert.deepEqual(
    await declinedService.saveBrowser({
      blob,
      defaultName: 'Declined.json',
      confirmMessage: 'decline'
    }),
    { handled: true, status: 'cancelled', mode: 'download' }
  );

  await assert.rejects(
    () => pickerService.saveBrowser({ defaultName: 'Missing.json' }),
    /Project export blob is required/
  );

  console.log('EditorProjectExportRouteService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
