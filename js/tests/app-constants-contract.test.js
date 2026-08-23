const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const constantsSource = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'constants.js'),
  'utf8'
);
const coreSource = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'core.js'),
  'utf8'
);
const htmlSource = fs.readFileSync(
  path.join(projectRoot, 'Akordyar.html'),
  'utf8'
);
const appBootstrap = require('../app.js');

const sandbox = { window: {}, globalThis: {} };
vm.runInNewContext(constantsSource, sandbox, { filename: 'constants.js' });
const constants = sandbox.window.AkordyarAppConstants;

assert.ok(constants, 'application constants must be published');
assert.deepEqual(
  Array.from(constants.NOTES),
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
);
assert.deepEqual(
  Array.from(constants.ROOT_NOTES.slice(0, 3)),
  ['None', 'C', 'C#']
);
assert.equal(constants.NOTE_SEMITONE.Bb, 10);
assert.equal(constants.CHORD_TEMPLATES.length, 25);

assert.doesNotMatch(coreSource, /const\s+COLORS\s*=/);
assert.doesNotMatch(coreSource, /const\s+CHORD_TEMPLATES\s*=/);
assert.match(coreSource, /globalScope\.AkordyarAppConstants/);

assert.equal(appBootstrap.APPLICATION_CHUNKS[0], 'core/FunctionUtils.js');
assert.equal(appBootstrap.APPLICATION_CHUNKS[1], 'core/DAWRuntimeState.js');
assert.equal(appBootstrap.APPLICATION_CHUNKS[2], 'app/constants.js');
assert.ok(
  htmlSource.indexOf('js/app/constants.js') <
    htmlSource.indexOf('js/app/core.js')
);

console.log('Application constants contract tests passed');
