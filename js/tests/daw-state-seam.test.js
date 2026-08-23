const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const core = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'core.js'),
  'utf8'
);
const html = fs.readFileSync(
  path.join(projectRoot, 'Akordyar.html'),
  'utf8'
);
const bootstrap = require('../app.js');

assert.match(core, /globalScope\.DAWRuntimeState\.create\(\)/);
assert.doesNotMatch(
  core,
  /globalScope\.DAWRuntimeState\?\.\.create\?\.\(\)\s*\|\|\s*\{/,
  'core must not keep an inline DAW state fallback'
);
assert.equal(
  bootstrap.APPLICATION_CHUNKS.indexOf('core/DAWRuntimeState.js') <
    bootstrap.APPLICATION_CHUNKS.indexOf('app/core.js'),
  true
);
assert.ok(
  html.indexOf('js/core/DAWRuntimeState.js') <
    html.indexOf('js/app/core.js')
);

console.log('DAW state seam tests passed');
