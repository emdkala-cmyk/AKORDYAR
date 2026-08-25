const assert = require('node:assert/strict');
const RecordingService = require('../app/CoreRecordingService.js');

const calls = [];
const removedLiveClips = [];
const recButton = {
  classList: {
    toggle: (...args) => calls.push(['button-class', ...args])
  }
};
const recLaneName = {
  classList: {
    toggle: (...args) => calls.push(['name-class', ...args])
  }
};
const recLaneElement = {
  classList: {
    toggle: (...args) => calls.push(['lane-class', ...args])
  },
  appendChild: element => {
    calls.push(['append', element.className]);
  }
};

const documentRef = {
  getElementById: id => id === 'recBtn' ? recButton : null,
  querySelector: selector => {
    if (selector === '.track-name[data-track-id="tRec"]') {
      return recLaneName;
    }
    if (selector === '.track-lane[data-track-id="tRec"]') {
      return recLaneElement;
    }
    return null;
  },
  querySelectorAll: selector => {
    if (selector !== '.rec-live-clip') return [];
    return removedLiveClips;
  },
  createElement: tag => {
    if (tag === 'canvas') {
      return {
        getContext: () => ({
          fillStyle: '',
          fillRect() {}
        }),
        toDataURL: () => 'data:image/png;base64,wave'
      };
    }
    return {
      dataset: {},
      style: {},
      classList: { toggle() {} },
      appendChild() {}
    };
  }
};

const audioContext = {
  createStereoPanner: () => ({
    connect: () => {}
  }),
  createGain: () => ({
    connect: () => {}
  }),
  createMediaStreamSource: () => ({
    connect: () => {}
  }),
  createAnalyser: () => ({
    fftSize: 1024,
    connect: () => {},
    getFloatTimeDomainData: data => {
      data[0] = 0.5;
    }
  }),
  createMediaStreamDestination: () => ({
    stream: { id: 'destination-stream' }
  })
};

const daw = {
  tracks: [{ id: 'section', type: 'section' }],
  clips: [],
  selectedIds: new Set(),
  bufferCache: new Map(),
  masterGain: { id: 'master' },
  audioCtx: audioContext,
  playhead: 2,
  isPlaying: false,
  isRecording: false,
  recRafId: null,
  recPeaks: []
};

const stream = {
  stopped: false,
  getTracks: () => [{
    stop: () => {
      stream.stopped = true;
    }
  }]
};

class FakeBlob {
  constructor(parts = [], options = {}) {
    this.size = parts.reduce((sum, part) => sum + (part.size || 0), 0);
    this.type = options.type || '';
  }
}

class FakeMediaRecorder {
  static isTypeSupported(type) {
    return type === 'audio/webm;codecs=opus';
  }

  constructor(destinationStream, options) {
    this.destinationStream = destinationStream;
    this.options = options;
    this.mimeType = options?.mimeType || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }

  start(interval) {
    this.interval = interval;
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: { size: 600 } });
    this.onstop?.();
  }
}

let nextId = 1;
let frameId = 0;
const service = RecordingService.create({
  getDAW: () => daw,
  documentRef,
  getNavigator: () => ({
    mediaDevices: {
      getUserMedia: async constraints => {
        calls.push(['media', constraints]);
        return stream;
      }
    }
  }),
  getMediaRecorder: () => FakeMediaRecorder,
  getBlob: () => FakeBlob,
  requestAnimationFrameRef: callback => {
    frameId += 1;
    calls.push(['raf', frameId]);
    return frameId;
  },
  cancelAnimationFrameRef: id => calls.push(['cancel-raf', id]),
  ensureAudioCtx: () => {
    calls.push('ctx');
    return audioContext;
  },
  updateTrackMix: id => calls.push(['mix', id]),
  renderAll: () => calls.push('render'),
  startTransport: () => {
    calls.push('start-transport');
    daw.isPlaying = true;
  },
  pauseTransport: () => calls.push('pause-transport'),
  timeToX: value => value * 70,
  decodeFileToBuffer: async () => ({
    buffer: { duration: 2.5 }
  }),
  peaksFromBuffer: () => ['peak'],
  refreshClipWaveImage: clip => calls.push(['wave', clip.id]),
  ensureTimelineFits: value => calls.push(['fit', value]),
  saveState: () => calls.push('save'),
  saveAudioBlobToDB: async (...args) => calls.push(['blob', ...args]),
  uid: prefix => `${prefix}${nextId++}`,
  roundMs: value => Math.round(value * 100) / 100,
  formatTime: value => `t${value}`,
  toast: value => calls.push(['toast', value]),
  logger: {
    error: error => calls.push(['error', error?.message || error])
  }
});

assert.equal(service.recMimeType(), 'audio/webm;codecs=opus');
assert.equal(service.ensureRecLane().id, 'tRec');
assert.equal(daw.tracks[1].id, 'tRec');
assert.deepEqual(calls.slice(0, 2), ['ctx', 'ctx']);
assert.deepEqual(calls.at(-1), ['mix', 'tRec']);

(async () => {
  calls.splice(0);
  await service.startRec();
  assert.equal(daw.isRecording, true);
  assert.equal(daw.recMediaRecorder.state, 'recording');
  assert.equal(daw.recMediaRecorder.interval, 250);
  assert.equal(daw.recLaneId, 'tRec');
  assert.equal(daw.isPlaying, true);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'media'));
  assert.ok(calls.includes('start-transport'));
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'raf'));

  daw.playhead = 4;
  service.endRec();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(daw.isRecording, false);
  assert.equal(daw.recMediaRecorder, null);
  assert.equal(stream.stopped, true);
  assert.equal(daw.clips.length, 1);
  assert.equal(daw.clips[0].trackId, 'tRec');
  assert.equal(daw.clips[0].duration, 2);
  assert.deepEqual(daw.selectedIds, new Set([daw.clips[0].id]));
  assert.equal(daw.bufferCache.size, 1);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'wave'));
  assert.ok(calls.includes('save'));
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'blob'));
  assert.deepEqual(calls.at(-1), ['toast', '✓ ضبط ذخیره شد']);

  const unsupportedCalls = [];
  const unsupported = RecordingService.create({
    getDAW: () => ({ isRecording: false }),
    getNavigator: () => null,
    toast: value => unsupportedCalls.push(value)
  });
  await unsupported.startRec();
  assert.deepEqual(unsupportedCalls, ['ضبط صدا در این محیط پشتیبانی نمی‌شود']);

  console.log('CoreRecordingService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
