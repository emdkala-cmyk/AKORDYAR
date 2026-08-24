const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const editorSource = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);
const htmlSource = fs.readFileSync(
  path.join(projectRoot, 'Akordyar.html'),
  'utf8'
);

assert.match(
  editorSource,
  /let edCur = window\.EditorRuntimeAdapter\?\.getSong\?\.\(\) \|\| null;/
);
assert.match(
  editorSource,
  /window\.EdCurAdapter\?\.onChange\?\.\(\(_eventName, song\) =>/
);
assert.match(
  editorSource,
  /return window\.EditorRuntimeAdapter\?\.getSong\?\.\(\) \|\| edCur \|\| null;/
);
assert.ok(
  htmlSource.indexOf('js/core/EdCurAdapter.js') <
    htmlSource.indexOf('js/app/editor.js')
);

const context = { console };
context.window = context;
context.globalThis = context;

function load(relativePath) {
  vm.runInNewContext(
    fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'),
    context,
    { filename: relativePath }
  );
}

load('js/core/EdCurAdapter.js');
load('js/core/EditorRuntimeAdapter.js');

let editorSongMirror = context.EditorRuntimeAdapter.getSong();
context.EdCurAdapter.onChange((_eventName, song) => {
  editorSongMirror = song;
});

const firstSong = { id: 'song-1' };
context.EditorRuntimeAdapter.setSong(firstSong);
assert.equal(editorSongMirror, firstSong);

const secondSong = { id: 'song-2' };
context.window.edCur = secondSong;
assert.equal(editorSongMirror, secondSong);

console.log('Editor song state seam tests passed');
