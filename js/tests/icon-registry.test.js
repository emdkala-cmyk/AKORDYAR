const assert = require('node:assert/strict');
const IconRegistry = require('../core/IconRegistry.js');

for (const name of [
  'hitpoints',
  'mixer',
  'settings',
  'grip',
  'import',
  'clipboard',
  'chevron-left',
  'chevron-right'
]) {
  const svg = IconRegistry.get(name);
  assert.match(svg, /^<svg\b/, `${name} should resolve to SVG`);
  assert.match(svg, /currentColor/, `${name} should inherit the control color`);
}

assert.equal(IconRegistry.get('✕'), IconRegistry.get('close'));
assert.equal(IconRegistry.has('hitpoints'), true);

console.log('Icon registry tests passed');
