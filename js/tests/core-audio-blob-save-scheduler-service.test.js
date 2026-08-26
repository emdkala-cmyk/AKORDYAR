const assert = require('node:assert/strict');
const CoreAudioBlobSaveSchedulerService = require(
  '../app/CoreAudioBlobSaveSchedulerService.js'
);

(async () => {
  const timers = [];
  const cancelled = [];
  const saves = [];
  const warnings = [];
  let songId = 'song-1';

  const runtime = CoreAudioBlobSaveSchedulerService.create({
    getSongId: () => songId,
    saveAudioBlobsForProject: async id => {
      saves.push(id);
    },
    schedule: (callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    },
    cancel: timer => {
      if (timer) cancelled.push(timer);
    },
    delay: 25,
    logger: { warn: (...args) => warnings.push(args) }
  });

  runtime.scheduleAudioBlobSave();
  runtime.scheduleAudioBlobSave();
  assert.equal(timers.length, 2);
  assert.equal(timers[1].delay, 25);
  assert.deepEqual(cancelled, [timers[0]]);

  await timers[1].callback();
  assert.deepEqual(saves, ['song-1']);

  const runningTimers = [];
  let resolveSave;
  const runningRuntime = CoreAudioBlobSaveSchedulerService.create({
    getSongId: () => songId,
    saveAudioBlobsForProject: id => {
      saves.push(id);
      return new Promise(resolve => {
        resolveSave = resolve;
      });
    },
    schedule: callback => {
      const timer = { callback };
      runningTimers.push(timer);
      return timer;
    },
    cancel: () => {},
    logger: { warn: (...args) => warnings.push(args) }
  });

  runningRuntime.scheduleAudioBlobSave();
  const firstRun = runningTimers[0].callback();
  runningRuntime.scheduleAudioBlobSave();
  const queuedRun = runningTimers[1].callback();
  await queuedRun;
  await Promise.resolve();
  assert.equal(runningTimers.length, 2);
  resolveSave();
  await firstRun;
  assert.equal(runningTimers.length, 3);
  const secondRun = runningTimers[2].callback();
  resolveSave();
  await secondRun;
  assert.deepEqual(saves.slice(-2), ['song-1', 'song-1']);

  songId = null;
  runningRuntime.scheduleAudioBlobSave();
  assert.equal(runningTimers.length, 3);

  const errorTimers = [];
  const deterministicFailingRuntime =
    CoreAudioBlobSaveSchedulerService.create({
      getSongId: () => 'song-error',
      saveAudioBlobsForProject: async () => {
        throw new Error('failure');
      },
      schedule: callback => {
        const timer = { callback };
        errorTimers.push(timer);
        return timer;
      },
      cancel: () => {},
      logger: { warn: (...args) => warnings.push(args) }
    });
  deterministicFailingRuntime.scheduleAudioBlobSave();
  await errorTimers[0].callback();
  assert.equal(warnings.length, 1);

  console.log('CoreAudioBlobSaveSchedulerService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
