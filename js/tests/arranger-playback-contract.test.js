const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const core = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'core.js'),
  'utf8'
);
const transportService = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'CoreTransportService.js'),
  'utf8'
);
const editor = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);
const markerController = fs.readFileSync(
  path.join(
    projectRoot,
    'js',
    'editor',
    'EditorArrangerMarkerControllerService.js'
  ),
  'utf8'
);
const html = fs.readFileSync(
  path.join(projectRoot, 'Akordyar.html'),
  'utf8'
);

assert.ok(
  html.indexOf('js/editor/ArrangerPlaybackPolicyService.js') <
    html.indexOf('js/app/core.js'),
  'arranger playback policy must load before core'
);
assert.ok(
  html.indexOf('js/editor/ArrangerMarkerService.js') <
    html.indexOf('js/editor/EditorHydrationService.js'),
  'arranger marker service must load before hydration'
);
assert.ok(
  html.indexOf('js/editor/EditorArrangerMarkerControllerService.js') <
    html.indexOf('js/app/core.js'),
  'arranger marker controller must load before core'
);
assert.match(core, /ArrangerPlaybackPolicyService/);
assert.match(
  transportService,
  /!arranger\.active[\s\S]*!daw\.isRecording/
);
assert.match(transportService, /playheadMath\?\.applyLoop/);
assert.match(core, /arrangerPlaybackPolicy\?\.createBoundary/);
assert.match(core, /arrangerMarkers:\s*songData\._arrangerMarkers/);
assert.match(core, /legacyLoopState:\s*songData\._dawLoop/);
assert.match(core, /playbackStart:\s*playbackBoundary\.start/);
assert.match(editor, /arrangerPlaybackPolicy\?\.applyToDAW/);
assert.match(editor, /seekTransport\(arrPerformActive \? playbackBoundary\.start : 0, false, true\)/);
assert.match(editor, /arrangerMarkers:\s*ns\.arrangerMarkers/);
assert.match(editor, /seekTransport\(arrPerformActive \? nextStart : 0, true, true\)/);
assert.doesNotMatch(editor, /var _ori2 = PlayheadMath\.createOrigin/);

assert.match(
  html,
  /<div[^>]*data-inline-actions[^>]*>\s*<button[^>]*id="sendToArrangerBtn"[^>]*data-action="sendToArranger"/
);
assert.match(
  editor,
  /sendToArranger:\s*\(\)\s*=>\s*sendCurrentSongToArranger\(\)/
);
assert.match(core, /async function sendCurrentSongToArranger/);
assert.match(html, /data-action="setArrangerA"/);
assert.match(html, /data-action="setArrangerB"/);
assert.match(html, /data-action="toggleArrangerMarkers"/);
assert.match(html, /id="arranger-marker-controls"/);
assert.match(html, /id="arranger-markers-overlay"/);
assert.match(core, /EditorArrangerMarkerControllerService\.create/);
assert.match(markerController, /function renderArrangerMarkers/);
assert.match(markerController, /markers\.enabled === true/);
assert.match(editor, /toggleArrangerMarkers:\s*\(\)\s*=>\s*toggleArrangerMarkers\(\)/);

console.log('Arranger playback contract tests passed');
