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
assert.match(core, /CorePublicApi/);
assert.match(core, /corePublicApi\.publish\(\{/);
assert.doesNotMatch(core, /window\.(startTransport|pauseTransport|stopTransport|seekTransport)\s*=/);
assert.doesNotMatch(core, /window\.(loadAudioFromHardDrive|pathDirname|pathJoin)\s*=/);
assert.ok(
  html.indexOf('js/core/CorePublicApi.js') <
    html.indexOf('js/app/core.js')
);
assert.ok(
  html.indexOf('js/core/CorePublicApi.js') <
    html.indexOf('js/app/core.js')
);

console.log('Core public API contract tests passed');
