const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function executableLines(source) {
  return source
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
}

const archive = executableLines(read('js/archive/ArchiveModule.js'));
const projectHub = executableLines(read('js/projecthub.js'));
const performanceBridge = executableLines(read('js/performanceBridge.js'));
const archiveRuntimeAdapter = read('js/archive/ArchiveRuntimeAdapter.js');
const editorRuntimeAdapter = read('js/core/EditorRuntimeAdapter.js');
const domainBridge = read('js/core/DomainBridge.js');
const textEncodingService = read('js/core/TextEncodingService.js');
const editorSongStateService = read('js/core/EditorSongStateService.js');
const editor = executableLines(read('js/app/editor.js'));
const appCore = executableLines(read('js/app/core.js'));
const search = executableLines(read('js/app/search.js'));

assert.doesNotMatch(archive, /window\.edCur/);
assert.doesNotMatch(archive, /\bPERF\b/);
assert.doesNotMatch(archive, /document\.addEventListener\(['"](?:click|mousemove|mouseup)['"]/);

assert.doesNotMatch(projectHub, /\bedCur\s*[.=]/);
assert.doesNotMatch(projectHub, /\bDAW\s*\./);
assert.doesNotMatch(projectHub, /typeof\s+DAW/);
assert.doesNotMatch(projectHub, /document\.addEventListener\(['"]keydown['"]/);

assert.doesNotMatch(performanceBridge, /window\.edCur/);
assert.doesNotMatch(performanceBridge, /\bDAW\s*\./);
assert.doesNotMatch(performanceBridge, /\bPERF\s*\./);

assert.match(archiveRuntimeAdapter, /getSong\(\)/);
assert.match(archiveRuntimeAdapter, /getDAW\(\)/);
assert.match(archiveRuntimeAdapter, /getPERF\(\)/);
assert.match(editorRuntimeAdapter, /getDAWOrThrow\(\)/);
assert.match(editorRuntimeAdapter, /getPERFOrThrow\(\)/);
assert.match(editorRuntimeAdapter, /startPointerDrag/);
assert.match(domainBridge, /getPerformanceStore/);
assert.match(domainBridge, /callRuntime/);
assert.doesNotMatch(domainBridge, /window\.edCur/);
assert.match(textEncodingService, /repairSong/);
assert.doesNotMatch(editorSongStateService, /document/);
assert.doesNotMatch(editorSongStateService, /\bDAW\b/);
assert.doesNotMatch(editorSongStateService, /\bPERF\b/);
assert.doesNotMatch(editorSongStateService, /window\.edCur/);
assert.match(appCore, /function requireEditorSongStateService\(\)/);
assert.match(appCore, /function detectTempo\(\)[\s\S]*getSyncTimes\(\)/);
assert.match(appCore, /function detectKey\(\)[\s\S]*getChords\(\)/);

assert.doesNotMatch(appCore, /\bPERF\s*\./);
assert.doesNotMatch(appCore, /\bDAW\s*\./);
assert.doesNotMatch(editor, /\bPERF\s*\./);
assert.doesNotMatch(editor, /\bDAW\s*\./);
assert.equal(
  (appCore.match(/globalScope\.DAW\s*=/g) || []).length,
  1,
  'core must publish exactly one DAW runtime object'
);
assert.doesNotMatch(
  appCore,
  /globalScope\.DAW\s*=\s*\{\s*audioContext:/,
  'core must not publish a placeholder DAW'
);
assert.match(appCore, /function setCountInBars\(value\)/);
assert.match(appCore, /alignPlayheadToNearestMeasure/);
assert.equal(
  (appCore.match(/function setEditorSong\s*\(/g) || []).length,
  1,
  'core must expose exactly one editor-song setter'
);
assert.doesNotMatch(editor, /EdCurAdapter\?\.setEdCur/);
assert.doesNotMatch(archive, /EdCurAdapter\?\.setEdCur/);

assert.doesNotMatch(search, /document\.addEventListener\(['"](?:mousemove|mouseup)['"]/);
assert.doesNotMatch(editor, /document\.addEventListener\(['"](?:mousemove|mouseup)['"]/);
assert.doesNotMatch(appCore, /document\.addEventListener\(['"](?:mousemove|mouseup)['"]/);

console.log('Runtime dependency budget tests passed');
