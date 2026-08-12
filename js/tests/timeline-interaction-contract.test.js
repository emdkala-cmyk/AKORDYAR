const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const core = read('js/app/core.js');
const editor = read('js/app/editor.js');
const html = read('Akordyar.html');
const timelineCss = read('styles/timeline.css');

assert.match(core, /selectedTrackId:\s*null/);
assert.match(core, /function selectTrack\(trackId\)/);
assert.match(core, /selectTrack\(tr\.id\)/);
assert.doesNotMatch(
  core,
  /h\.addEventListener\('click',\s*\(e\)\s*=>\s*\{[^}]*openChordEditor\(\)/
);
assert.match(core, /let returnToStartOnPause = true/);
assert.match(core, /function previewMetronomeSound/);
assert.match(html, /data-action="previewMetroSound"/);
assert.match(editor, /function toggleSelectedTrackHeight/);
assert.match(editor, /e\.code === 'KeyZ'/);
assert.match(timelineCss, /\.track-name\.selected-track/);
assert.match(timelineCss, /\.track-lane\.selected-track/);

console.log('Timeline interaction contract tests passed');
