const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MidiMonitorService = require('../app/MidiMonitorService.js');

function createClassList() {
  const values = new Set();
  return {
    toggle(name) {
      if (values.has(name)) values.delete(name);
      else values.add(name);
    },
    contains: name => values.has(name)
  };
}

const elements = {
  midiMonitor: { classList: createClassList() },
  midiMonitorBody: {
    children: [],
    scrollTop: 0,
    scrollHeight: 120,
    appendChild(node) {
      this.children.push(node);
      this.scrollHeight += 10;
    },
    removeChild() {
      this.children.shift();
    },
    innerHTML: ''
  },
  midiStatusDot: { className: '' },
  midiChordInfo: { style: {} },
  midiChordName: { textContent: '' },
  midiChordNotes: { textContent: '' }
};
const documentRef = {
  getElementById: id => elements[id] || null,
  createElement: () => ({ className: '', innerHTML: '' })
};

const service = MidiMonitorService.create({
  documentRef,
  logger: { error() {} }
});

assert.equal(service.getMidiAccess(), null);
service.setMidiAccess({ inputs: new Map() });
assert.equal(service.getMidiAccess().inputs instanceof Map, true);
assert.equal(service.toggleMidiMonitor(), true);
assert.equal(service.toggleMidiMonitor(), false);
assert.equal(service.updateMidiMonitor([0x90, 60, 100]), true);
assert.match(elements.midiMonitorBody.children[0].innerHTML, /Note On/);
assert.match(elements.midiMonitorBody.children[0].innerHTML, /C4 vel:100/);
assert.equal(service.updateMidiMonitorOut([0xFC]), true);
assert.match(elements.midiMonitorBody.children[1].innerHTML, /STOP/);
assert.equal(service.updateMidiStatusDot(), true);
assert.match(elements.midiStatusDot.className, /connected/);
assert.equal(service.updateMidiChordDisplay('Cmaj7', 'C4 E4 G4 B4'), true);
assert.equal(elements.midiChordName.textContent, 'Cmaj7');
assert.equal(elements.midiChordNotes.textContent, 'C4 E4 G4 B4');
assert.equal(service.toggleMidiMonitorAutoScroll(), false);
assert.equal(service.clearMidiLog(), true);
assert.equal(elements.midiMonitorBody.innerHTML, '');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'MidiMonitorService.js'),
  'utf8'
);
const browserWindow = {};
vm.runInNewContext(source, { window: browserWindow }, {
  filename: 'MidiMonitorService.js'
});
browserWindow.midiAccess = 'test-access';
assert.equal(browserWindow.midiAccess, 'test-access');
assert.deepEqual(
  Array.from(browserWindow.noteNames.slice(0, 3)),
  ['C', 'C#', 'D']
);
assert.equal(typeof browserWindow.updateMidiMonitor, 'function');

console.log('MidiMonitorService tests passed');
