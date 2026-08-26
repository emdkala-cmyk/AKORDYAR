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
const preparationService = fs.readFileSync(
  path.join(
    projectRoot,
    'js',
    'app',
    'CoreArrangerPreparationService.js'
  ),
  'utf8'
);
const editor = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);
const songLoadService = fs.readFileSync(
  path.join(
    projectRoot,
    'js',
    'editor',
    'EditorArrangerSongLoadService.js'
  ),
  'utf8'
);
const hotSwapService = fs.readFileSync(
  path.join(
    projectRoot,
    'js',
    'editor',
    'EditorArrangerHotSwapService.js'
  ),
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
const markerBridge = fs.readFileSync(
  path.join(
    projectRoot,
    'js',
    'app',
    'CoreArrangerMarkerBridgeService.js'
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
  html.indexOf('js/editor/EditorArrangerSongLoadService.js') <
    html.indexOf('js/app/editor.js'),
  'arranger song load service must load before editor'
);
assert.ok(
  html.indexOf('js/editor/EditorArrangerHotSwapService.js') <
    html.indexOf('js/app/editor.js'),
  'arranger hot swap service must load before editor'
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
assert.match(core, /CoreArrangerMarkerBridgeService\?\.create/);
assert.match(
  transportService,
  /!arranger\.active[\s\S]*!daw\.isRecording/
);
assert.match(transportService, /playheadMath\?\.applyLoop/);
assert.match(core, /arrangerPlaybackPolicy\?\.createBoundary/);
assert.match(
  core,
  /CoreArrangerPreparationService\?\.create/
);
assert.match(preparationService, /arrangerMarkers:\s*songData\._arrangerMarkers/);
assert.match(preparationService, /legacyLoopState:\s*songData\._dawLoop/);
assert.match(preparationService, /playbackStart:\s*playbackBoundary\.start/);
assert.match(songLoadService, /playbackPolicy\?\.applyToDAW/);
assert.match(
  songLoadService,
  /arrangerMarkers:\s*song\._arrangerMarkers/
);
assert.match(
  songLoadService,
  /seekTransport\(\s*stateAfterLoad\.active \? playbackBoundary\.start : 0,\s*false,\s*true\s*\)/
);
assert.match(editor, /getPlaybackPolicy:\s*\(\) => arrangerPlaybackPolicy/);
assert.match(hotSwapService, /arrangerMarkers:\s*nextState\.arrangerMarkers/);
assert.match(hotSwapService, /seekTransport\(active \? nextStart : 0, true, true\)/);
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
assert.match(
  markerBridge,
  /EditorArrangerMarkerControllerService\?\.create/
);
assert.match(markerBridge, /controller\.bindDrag/);
assert.match(markerController, /function renderArrangerMarkers/);
assert.match(markerController, /markers\.enabled === true/);
assert.match(editor, /toggleArrangerMarkers:\s*\(\)\s*=>\s*toggleArrangerMarkers\(\)/);

console.log('Arranger playback contract tests passed');
