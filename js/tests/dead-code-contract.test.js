const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const coreSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'core.js'),
  'utf8'
);

assert.doesNotMatch(
  coreSource,
  /\bconst\s+fs\s*=\s*null\b/,
  'core must not keep an unused fs placeholder'
);
assert.doesNotMatch(
  coreSource,
  /\bconst\s+path\s*=\s*null\b/,
  'core must not keep an unused path placeholder'
);

console.log('Dead-code contract tests passed');
