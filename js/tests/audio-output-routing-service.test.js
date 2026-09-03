const assert = require('node:assert/strict');
const ProjectPerformanceSettingsService = require(
  '../core/ProjectPerformanceSettingsService.js'
);
const AudioOutputRoutingService = require(
  '../core/AudioOutputRoutingService.js'
);

function createParam(value = 0) {
  return {
    value,
    cancelScheduledValues() {},
    setValueAtTime(nextValue) {
      this.value = nextValue;
    }
  };
}

function createNode(kind, extra = {}) {
  return {
    kind,
    connections: [],
    connect(destination, output, input) {
      this.connections.push({ destination, output, input });
    },
    disconnect() {
      this.connections = [];
    },
    ...extra
  };
}

class FakeAudioContext {
  constructor(maxChannelCount = 4) {
    this.currentTime = 3;
    this.destination = createNode('destination', {
      maxChannelCount,
      channelCount: maxChannelCount
    });
    this.nodes = [];
  }

  createGain() {
    const node = createNode('gain', { gain: createParam() });
    this.nodes.push(node);
    return node;
  }

  createChannelMerger(numberOfInputs) {
    const node = createNode('merger', { numberOfInputs });
    this.nodes.push(node);
    return node;
  }

  createChannelSplitter(numberOfOutputs) {
    const node = createNode('splitter', { numberOfOutputs });
    this.nodes.push(node);
    return node;
  }
}

const context = new FakeAudioContext(4);
const masterInput = context.createGain();
const service = AudioOutputRoutingService.create({
  settingsService: ProjectPerformanceSettingsService,
  logger: { warn() {} }
});

let state = service.attachContext(context, {
  masterInput,
  settings: ProjectPerformanceSettingsService.normalize({
    audioRouting: {
      mode: 'multi-channel',
      clickIsolation: true
    }
  })
});
assert.equal(state.layout.mode, 'multi-channel');
assert.equal(state.layout.degraded, false);
assert.equal(state.buses.backing, true);
assert.ok(service.getBusDestination('click'));
assert.ok(service.getBusDestination('cue'));
assert.equal(masterInput.connections.length, 1);

assert.equal(service.panic(), true);
assert.equal(service.getState().panicMuted, true);
assert.equal(service.releasePanic(), true);
assert.equal(service.getState().panicMuted, false);

state = service.configure(
  ProjectPerformanceSettingsService.normalize({
    audioRouting: {
      mode: 'multi-channel',
      fallbackMode: 'mono-split',
      clickIsolation: true
    }
  }),
  { availableChannels: 2 }
);
assert.equal(state.layout.mode, 'mono-split');
assert.equal(state.layout.degraded, true);

console.log('Audio output routing service tests passed');
