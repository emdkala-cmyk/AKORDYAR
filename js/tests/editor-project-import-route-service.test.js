const assert = require('node:assert/strict');

const routeModule = require('../editor/EditorProjectImportRouteService.js');

(async () => {
  const calls = [];
  let receivedFile = null;
  const electronAPI = {
    isElectron: true,
    openFileDialog: async () => {
      calls.push('dialog');
      return 'C:\\Projects\\Song.akordyar';
    },
    loadProjectFile: async filePath => {
      calls.push(['load', filePath]);
      return { title: 'Imported song' };
    }
  };

  const service = routeModule.create({
    getElectronAPI: () => electronAPI
  });
  const opened = await service.openNative({
    onFile: async file => {
      receivedFile = file;
      assert.equal(file.name, 'Song.akordyar');
      assert.equal(file._projectFilePath, 'C:\\Projects\\Song.akordyar');
      assert.deepEqual(JSON.parse(await file.text()), {
        title: 'Imported song'
      });
    }
  });

  assert.deepEqual(opened, {
    handled: true,
    status: 'opened',
    path: 'C:\\Projects\\Song.akordyar'
  });
  assert.deepEqual(calls, [
    'dialog',
    ['load', 'C:\\Projects\\Song.akordyar']
  ]);
  assert.ok(receivedFile);

  const cancelled = routeModule.create({
    getElectronAPI: () => ({
      isElectron: true,
      openFileDialog: async () => null,
      loadProjectFile: async () => {
        throw new Error('must not load after cancel');
      }
    })
  });
  assert.deepEqual(
    await cancelled.openNative({ onFile: () => {} }),
    { handled: true, status: 'cancelled' }
  );

  const browserService = routeModule.create({
    getElectronAPI: () => ({ isElectron: false })
  });
  assert.deepEqual(
    await browserService.openNative({ onFile: () => {} }),
    { handled: false, status: 'unsupported' }
  );

  const failed = routeModule.create({
    getElectronAPI: () => ({
      isElectron: true,
      openFileDialog: async () => 'C:\\missing.akordyar',
      loadProjectFile: async () => {
        throw new Error('file missing');
      }
    })
  });
  const failedResult = await failed.openNative({ onFile: () => {} });
  assert.equal(failedResult.handled, true);
  assert.equal(failedResult.status, 'error');
  assert.match(failedResult.error.message, /file missing/);

  await assert.rejects(
    () => service.openNative(),
    /requires an onFile callback/
  );

  console.log('EditorProjectImportRouteService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
