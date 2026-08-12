const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'editor.js'),
  'utf8'
);

assert.match(source, /function escapeHtml\(value\)/);
assert.match(source, /escapeHtml\(n\)/);
assert.match(source, /escapeHtml\(artistName\)/);
assert.doesNotMatch(source, /🎵 \$\{n\}/);
assert.doesNotMatch(source, /شناسایی \$\{artistName\}/);
assert.doesNotMatch(source, /دریافت \$\{artistName\}/);
assert.doesNotMatch(source, /تلاش مجدد \$\{artistName\}/);

console.log('Editor markup safety tests passed');
