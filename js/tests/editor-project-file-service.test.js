const assert = require('node:assert/strict');

const fileModule = require('../editor/EditorProjectFileService.js');

(async () => {
  const calls = [];
  const electronAPI = {
    isElectron: true,
    saveFileDialog: async options => {
      calls.push(['dialog', options]);
      return '  C:\\Projects\\Song.akordyar  ';
    },
    writeProjectJson: async (filePath, data) => {
      calls.push(['write', filePath, data]);
      return 'written';
    }
  };

  const service = fileModule.create({
    getElectronAPI: () => electronAPI
  });

  assert.equal(service.getPath(), null);
  assert.equal(service.setPath('  C:\\Projects\\Existing.akordyar  '), 'C:\\Projects\\Existing.akordyar');
  assert.equal(service.getPath(), 'C:\\Projects\\Existing.akordyar');
  assert.equal(service.canUseNativeSave(), true);

  const overwrite = await service.saveNative({
    data: '{"title":"Existing"}',
    defaultPath: 'ignored.json'
  });
  assert.deepEqual(overwrite, {
    handled: true,
    cancelled: false,
    path: 'C:\\Projects\\Existing.akordyar',
    result: 'written'
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    'write',
    'C:\\Projects\\Existing.akordyar',
    '{"title":"Existing"}'
  ]);

  service.clearPath();
  const saveAs = await service.saveNative({
    data: '{"title":"New"}',
    defaultPath: 'New.json'
  });
  assert.equal(saveAs.path, 'C:\\Projects\\Song.akordyar');
  assert.equal(service.getPath(), 'C:\\Projects\\Song.akordyar');
  assert.deepEqual(calls[1], ['dialog', { defaultPath: 'New.json' }]);
  assert.deepEqual(calls[2], [
    'write',
    'C:\\Projects\\Song.akordyar',
    '{"title":"New"}'
  ]);

  const cancelledService = fileModule.create({
    getElectronAPI: () => ({
      isElectron: true,
      saveFileDialog: async () => '   ',
      writeProjectJson: async () => {
        throw new Error('must not write after cancel');
      }
    })
  });
  assert.deepEqual(
    await cancelledService.saveNative({ data: '{}', defaultPath: 'Cancel.json' }),
    { handled: true, cancelled: true, path: null }
  );

  const browserService = fileModule.create({
    getElectronAPI: () => ({ isElectron: false })
  });
  assert.equal(browserService.canUseNativeSave(), false);
  assert.deepEqual(
    await browserService.saveNative({ data: '{}', defaultPath: 'Browser.json' }),
    { handled: false, cancelled: false, path: null }
  );

  await assert.rejects(
    () => service.saveNative({ data: null, targetPath: 'C:\\Projects\\Invalid.akordyar' }),
    /Project data is required/
  );

  console.log('EditorProjectFileService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
