const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'core.js'),
  'utf8'
);

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let state = 'code';
  let quote = '';

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '*') {
        state = 'block-comment';
        index += 1;
        continue;
      }
      if (char === '/' && next === '/') {
        state = 'line-comment';
        index += 1;
        continue;
      }
      if (char === '\'' || char === '"' || char === '`') {
        state = 'string';
        quote = char;
        continue;
      }
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) return index;
      }
      continue;
    }

    if (state === 'line-comment') {
      if (char === '\n') state = 'code';
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 1;
      }
      continue;
    }

    if (char === '\\') {
      index += 1;
    } else if (char === quote) {
      state = 'code';
    }
  }

  return -1;
}

const bufferFunctionStart = source.indexOf('function bufferToWave');
assert.notEqual(bufferFunctionStart, -1, 'bufferToWave must remain available');

const bufferBodyStart = source.indexOf('{', bufferFunctionStart);
assert.notEqual(bufferBodyStart, -1, 'bufferToWave must have a body');

const bufferFunctionEnd = findMatchingBrace(source, bufferBodyStart);
assert.notEqual(bufferFunctionEnd, -1, 'bufferToWave must have a balanced body');

const bufferBody = source.slice(bufferBodyStart + 1, bufferFunctionEnd);
assert.doesNotMatch(
  bufferBody,
  /function\s+renderTimeline\s*\(/,
  'renderTimeline must not be nested in bufferToWave'
);
assert.doesNotMatch(
  bufferBody,
  /DOMContentLoaded/,
  'DOMContentLoaded setup must not be nested in bufferToWave'
);

const renderTimelineStart = source.indexOf('function renderTimeline');
assert.ok(
  renderTimelineStart > bufferFunctionEnd,
  'renderTimeline must be declared after bufferToWave closes'
);

const domReadyStart = source.indexOf(
  "document.addEventListener('DOMContentLoaded', () =>"
);
assert.ok(
  domReadyStart > bufferFunctionEnd,
  'DOMContentLoaded setup must be outside bufferToWave'
);

console.log('Core structure contract tests passed');
