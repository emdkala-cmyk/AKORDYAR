const assert = require('assert');

const ProjectAudioService = require(
  '../core/ProjectAudioService.js'
);

let testCount = 0;

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      testCount++;
      console.log(`✅ ${name}`);
    })
    .catch((error) => {
      console.error(`❌ ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

class FakeAudioContext {
  constructor() {
    this.decodeCalls = [];
    this.nextDuration = 12;
  }

  async decodeAudioData(arrayBuffer) {
    this.decodeCalls.push(arrayBuffer);

    return {
      duration: this.nextDuration,
      fakeBuffer: true
    };
  }
}

function createState() {
  return {
    tracks: [],
    clips: [],
    sections: [],
    pool: {},
    bufferCache: new Map(),
    projectRoot: null,
    projectDuration: 0,
    project: {},
    edCur: null,
    edSeqPoints: []
  };
}

function createService(options = {}) {
  const state = options.state || createState();
  const audioCtx = options.audioCtx || new FakeAudioContext();

  const electronAPI = options.electronAPI || {
    checkFileExists: async () => true,
    readAudioFile: async () => new ArrayBuffer(8),
    resolvePath: async (dir, relativePath) =>
      `${dir}/${relativePath}`
  };

  let renderCount = 0;
  const loader = options.loader || null;

  const service = new ProjectAudioService({
    state,
    isElectron: options.isElectron ?? true,
    getElectronAPI: () => electronAPI,
    ensureAudioCtx: () => audioCtx,
    renderTimeline: () => {
      renderCount++;
    },
    getLoadingIndicator: () => loader,
    repairSong: options.repairSong || null,
    logger: {
      warn() {},
      error() {}
    }
  });

  return {
    service,
    state,
    audioCtx,
    electronAPI,
    getRenderCount: () => renderCount,
    loader
  };
}

test('pathDirname مسیر ویندوز را درست استخراج می‌کند', () => {
  const { service } = createService();

  assert.strictEqual(
    service.pathDirname(
      'C:\\Projects\\Akordyar\\song.akordyar'
    ),
    'C:/Projects/Akordyar'
  );
});

test('pathJoin اسلش‌های اضافی را نرمال می‌کند', () => {
  const { service } = createService();

  assert.strictEqual(
    service.pathJoin(
      'C:\\Projects\\Akordyar\\',
      '\\audio\\voice.wav'
    ),
    'C:\\Projects\\Akordyar/audio\\voice.wav'
  );
});

test('loadAudioFromHardDrive فایل را بررسی، خوانده و decode می‌کند', async () => {
  const { service, audioCtx } = createService();

  const buffer = await service.loadAudioFromHardDrive(
    'C:/audio/test.wav'
  );

  assert.strictEqual(buffer.fakeBuffer, true);
  assert.strictEqual(audioCtx.decodeCalls.length, 1);
});

test('loadAudioFromHardDrive برای فایل غایب خطای FILE_NOT_FOUND می‌دهد', async () => {
  const { service } = createService({
    electronAPI: {
      checkFileExists: async () => false,
      readAudioFile: async () => new ArrayBuffer(8)
    }
  });

  await assert.rejects(
    () => service.loadAudioFromHardDrive('C:/missing.wav'),
    /FILE_NOT_FOUND/
  );
});

test('handleAudioImport ترک و کلیپ جدید ایجاد می‌کند', async () => {
  const {
    service,
    state,
    getRenderCount
  } = createService();

  const fakeFile = {
    name: 'vocals.wav',
    path: 'C:/audio/vocals.wav',
    arrayBuffer: async () => new ArrayBuffer(16)
  };

  const track = await service.handleAudioImport(
    fakeFile,
    false
  );

  assert.strictEqual(state.tracks.length, 1);
  assert.strictEqual(track.name, 'vocals.wav');
  assert.strictEqual(track.filePath, 'C:/audio/vocals.wav');
  assert.strictEqual(track.clips.length, 1);
  assert.strictEqual(track.clips[0].duration, 12);
  assert.strictEqual(state.projectDuration, 12);
  assert.strictEqual(getRenderCount(), 1);
});

test('resolveClipAudio مسیر copy را resolve و buffer را cache می‌کند', async () => {
  const {
    service,
    state
  } = createService();

  state.projectRoot = 'C:/Projects/Test';

  const clip = {
    id: 'clip_1',
    storage: {
      mode: 'copy',
      projectPath: 'audio/vocal.wav'
    }
  };

  const buffer = await service.resolveClipAudio(clip);

  assert.strictEqual(buffer.fakeBuffer, true);
  assert.ok(state.bufferCache.has('clip_1'));
  assert.strictEqual(clip.runtime.loaded, true);
  assert.strictEqual(
    clip.runtime.resolvedPath,
    'C:/Projects/Test/audio/vocal.wav'
  );
});

test('resolveClipAudio مسیر reference را بدون resolvePath استفاده می‌کند', async () => {
  const {
    service,
    state
  } = createService();

  const clip = {
    id: 'clip_reference',
    storage: {
      mode: 'reference',
      externalPath: 'D:/Audio/voice.wav'
    }
  };

  await service.resolveClipAudio(clip);

  assert.ok(
    state.bufferCache.has('clip_reference')
  );

  assert.strictEqual(
    clip.runtime.resolvedPath,
    'D:/Audio/voice.wav'
  );
});

test('loadProject state را بازیابی و audio pool را load می‌کند', async () => {
  const {
    service,
    state,
    getRenderCount
  } = createService();

  const projectData = {
    project: {
      title: 'Test Project'
    },

    projectDuration: 44,

    pool: {
      pool_clip_1: {
        id: 'pool_clip_1',
        storage: {
          mode: 'reference',
          externalPath: 'D:/Audio/pool.wav'
        }
      }
    },

    tracks: [
      {
        id: 'track_1',
        name: 'Voice',
        clips: []
      }
    ],

    clips: [
      {
        id: 'legacy_clip',
        type: 'audio',
        relativePath: 'audio/legacy.wav',
        name: 'Legacy Voice'
      }
    ],

    sections: [
      {
        id: 'section_1',
        name: 'Verse'
      }
    ],

    edCur: {
      title: 'Song'
    },

    edSeqPoints: [0, 4, 8]
  };

  await service.loadProject(
    projectData,
    'C:/Projects/Test/song.akordyar'
  );

  assert.strictEqual(
    state.project.title,
    'Test Project'
  );

  assert.strictEqual(
    state.projectRoot,
    'C:/Projects/Test'
  );

  assert.strictEqual(
    state.tracks.length,
    1
  );

  assert.strictEqual(
    state.sections.length,
    1
  );

  assert.strictEqual(
    state.projectDuration,
    44
  );

  assert.ok(
    state.bufferCache.has('pool_clip_1')
  );

  assert.ok(
    state.bufferCache.has('legacy_clip')
  );

  assert.strictEqual(
    getRenderCount(),
    1
  );
});

test('loadProject loader را در موفقیت پنهان می‌کند و edCur را repair می‌کند', async () => {
  const loader = { style: { display: 'none' } };
  const repairedSong = { title: 'ترمیم‌شده' };
  const { service, state } = createService({
    isElectron: false,
    loader,
    repairSong: () => repairedSong
  });

  await service.loadProject({
    project: {},
    edCur: { title: 'خراب' },
    tracks: [],
    clips: [],
    sections: []
  });

  assert.equal(state.edCur, repairedSong);
  assert.equal(loader.style.display, 'none');
});

test('loadProject دادهٔ نامعتبر را سریع رد می‌کند', async () => {
  const { service } = createService();
  await assert.rejects(
    () => service.loadProject(null),
    /requires project data/
  );
});

test('loadProject در خطای داخلی هم loader را رها نمی‌کند', async () => {
  const loader = { style: { display: 'none' } };
  const { service } = createService({
    loader,
    repairSong: () => { throw new Error('repair failed'); }
  });

  await assert.rejects(
    () => service.loadProject({ edCur: {}, tracks: [], clips: [], sections: [] }),
    /repair failed/
  );
  assert.equal(loader.style.display, 'none');
});

process.on('beforeExit', () => {
  if (!process.exitCode) {
    console.log(`\n${testCount} passed, 0 failed`);
  }
});
