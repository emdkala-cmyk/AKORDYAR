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
const editorSongRuntimeService = read('js/core/EditorSongRuntimeService.js');
const syncModeController = executableLines(read('js/editor/SyncModeController.js'));
const editorMutationService = read('js/editor/EditorMutationService.js');
const editorChordQuantizeService = read('js/editor/EditorChordQuantizeService.js');
const editorChordInteractionService = read('js/editor/EditorChordInteractionService.js');
const editorLyricsRenderer = read('js/editor/EditorLyricsRenderer.js');
const editorSyncAnalysisUiService = read(
  'js/editor/EditorSyncAnalysisUiService.js'
);
const midiMonitorService = read('js/app/MidiMonitorService.js');
const coreGridQuantizeService = read('js/app/CoreGridQuantizeService.js');
const coreMetronomeService = read('js/app/CoreMetronomeService.js');
const corePanelLayoutService = read('js/app/CorePanelLayoutService.js');
const coreTimelineGeometryService = read('js/app/CoreTimelineGeometryService.js');
const coreTimelineRendererService = read('js/app/CoreTimelineRendererService.js');
const coreClipService = read('js/app/CoreClipService.js');
const coreAudioImportService = read('js/app/CoreAudioImportService.js');
const coreClipEditService = read('js/app/CoreClipEditService.js');
const coreSelectionService = read('js/app/CoreSelectionService.js');
const coreClipDragService = read('js/app/CoreClipDragService.js');
const coreClipInteractionService = read('js/app/CoreClipInteractionService.js');
const coreClipDeletionService = read('js/app/CoreClipDeletionService.js');
const coreClipboardBridgeService = read(
  'js/app/CoreClipboardBridgeService.js'
);
const coreRecordingService = read('js/app/CoreRecordingService.js');
const coreSettingsService = read('js/app/CoreSettingsService.js');
const coreMixerBridgeService = read('js/app/CoreMixerBridgeService.js');
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
assert.match(editorSongStateService, /setSeqPoints/);
assert.match(editorSongStateService, /setSyncTime/);
assert.doesNotMatch(editorSongRuntimeService, /document/);
assert.match(editorSongRuntimeService, /assertSynchronized/);
assert.doesNotMatch(syncModeController, /getEdCur/);
assert.match(syncModeController, /songState\.setSeqPoints/);
assert.match(syncModeController, /songState\.replaceSyncTimes/);
assert.doesNotMatch(editorMutationService, /document/);
assert.doesNotMatch(editorMutationService, /\bDAW\b/);
assert.doesNotMatch(editorMutationService, /\bPERF\b/);
assert.doesNotMatch(editorMutationService, /window\.edCur/);
assert.doesNotMatch(editorChordQuantizeService, /window\.edCur/);
assert.doesNotMatch(editorChordQuantizeService, /\bDAW\b/);
assert.doesNotMatch(editorChordQuantizeService, /\bPERF\b/);
assert.doesNotMatch(editorChordQuantizeService, /document/);
assert.match(editorChordQuantizeService, /gridStepForPreset/);
assert.match(editorChordQuantizeService, /quantizeSelectedChords/);
assert.match(editorMutationService, /removeAndReverse/);
assert.doesNotMatch(editorChordInteractionService, /window\.edCur/);
assert.doesNotMatch(editorChordInteractionService, /\bDAW\b/);
assert.doesNotMatch(editorChordInteractionService, /\bPERF\b/);
assert.match(editorChordInteractionService, /moveChordsByDelta/);
assert.doesNotMatch(editorLyricsRenderer, /window\.edCur/);
assert.doesNotMatch(editorLyricsRenderer, /\bDAW\b/);
assert.doesNotMatch(editorLyricsRenderer, /\bPERF\b/);
assert.match(editorLyricsRenderer, /function render/);
assert.match(appCore, /function requireEditorSongStateService\(\)/);
assert.match(editorSyncAnalysisUiService, /function detectTempo\(\)[\s\S]*getSyncTimes/);
assert.match(editorSyncAnalysisUiService, /function detectKey\(\)[\s\S]*getChords/);
assert.doesNotMatch(appCore, /function detectTempo\(/);
assert.doesNotMatch(appCore, /function detectKey\(/);
assert.match(midiMonitorService, /function updateMidiMonitor\(/);
assert.match(midiMonitorService, /function updateMidiStatusDot\(/);
assert.doesNotMatch(appCore, /midiMsgTypes/);
assert.doesNotMatch(appCore, /function updateMidiMonitor\(/);
assert.match(coreGridQuantizeService, /function snapTime\(/);
assert.match(coreGridQuantizeService, /function quantizeSelectedChords\(/);
assert.doesNotMatch(appCore, /function getActiveQuantizeGridStep\(/);
assert.doesNotMatch(appCore, /function quantizeSelectedChords\(/);
assert.match(coreMetronomeService, /function setCountInBars\(value\)/);
assert.match(coreMetronomeService, /function startMetronome\(/);
assert.match(coreMetronomeService, /function checkMetronomeTick\(/);
assert.doesNotMatch(appCore, /function setCountInBars\(value\)/);
assert.doesNotMatch(appCore, /function alignPlayheadToNearestMeasure\(/);
assert.doesNotMatch(appCore, /function startMetronome\(/);
assert.doesNotMatch(appCore, /function checkMetronomeTick\(/);
assert.match(corePanelLayoutService, /function initDockableSidePanels\(\)/);
assert.match(corePanelLayoutService, /function setTimelinePanelHeight\(/);
assert.match(corePanelLayoutService, /function togglePanel\(panel\)/);
assert.doesNotMatch(appCore, /function initDockableSidePanels\(\)/);
assert.doesNotMatch(appCore, /function setTimelinePanelHeight\(/);
assert.doesNotMatch(appCore, /function togglePanel\(panel\)/);
assert.match(coreTimelineGeometryService, /function timeToX\(time\)/);
assert.match(coreTimelineGeometryService, /function timeToBarBeat\(seconds\)/);
assert.match(coreTimelineGeometryService, /function getProjectEnd\(\)/);
assert.match(coreTimelineGeometryService, /function clientToTime\(clientX\)/);
assert.doesNotMatch(appCore, /const timeToX = \(t\)/);
assert.doesNotMatch(appCore, /const xToTime = \(x\)/);
assert.doesNotMatch(appCore, /function timeToBarBeat\(seconds\)/);
assert.doesNotMatch(appCore, /function getProjectEnd\(\)/);
assert.doesNotMatch(appCore, /function ensureTimelineFits\(needed\)/);
assert.doesNotMatch(appCore, /function clientToTime\(clientX\)/);
assert.match(
  coreTimelineRendererService,
  /function getTimelineTrackRendererService\(\)/
);
assert.match(coreTimelineRendererService, /function renderTracks\(\)/);
assert.doesNotMatch(
  appCore,
  /function getTimelineTrackRendererService\(\)/
);
assert.doesNotMatch(appCore, /function updateTrackSelectionUI\(\)/);
assert.match(coreClipService, /function splitClipAt\(clip, atTime\)/);
assert.match(coreClipService, /function splitSelectedAtPlayhead\(\)/);
assert.doesNotMatch(appCore, /function splitClipAt\(clip, atTime\)/);
assert.doesNotMatch(appCore, /function splitSelectedAtPlayhead\(\)/);
assert.match(coreAudioImportService, /function openFileForTrack\(trackId\)/);
assert.match(coreAudioImportService, /function handleFileInputChange\(event\)/);
assert.match(coreAudioImportService, /function bindFileInput\(/);
assert.doesNotMatch(
  appCore,
  /\$\('audio-file-input'\)\.addEventListener\('change'/
);
assert.match(coreClipEditService, /function cutAtTime\(time, trackId = null\)/);
assert.doesNotMatch(appCore, /function cutAtTime\(time, trackId = null\)/);
assert.doesNotMatch(appCore, /\bsels\.forEach\(c =>/);
assert.match(coreSelectionService, /function setSelection\(ids\)/);
assert.match(coreSelectionService, /function clearSelection\(\)/);
assert.doesNotMatch(appCore, /function setSelection\(ids\)/);
assert.doesNotMatch(appCore, /function clearSelection\(\)/);
assert.match(coreClipDragService, /function update\(event\)/);
assert.match(coreClipDragService, /function finish\(\)/);
assert.doesNotMatch(
  coreClipInteractionService,
  /function updateResizeDrag\(delta, daw\)/
);
assert.doesNotMatch(
  coreClipInteractionService,
  /function updateMoveDrag\(delta, daw\)/
);
assert.match(
  coreClipboardBridgeService,
  /function getClipboardService\(\)/
);
assert.match(
  coreClipboardBridgeService,
  /function getClipDeletionService\(\)/
);
assert.match(coreClipboardBridgeService, /copySelected:\s*call/);
assert.match(coreClipDeletionService, /function deleteSelected\(\)/);
assert.match(coreClipDeletionService, /selectedSectionIds/);
assert.match(coreRecordingService, /function startRec\(\)/);
assert.match(coreRecordingService, /function finishRec\(blob\)/);
assert.match(coreSettingsService, /function applyTheme\(name\)/);
assert.match(coreSettingsService, /function previewMetronomeSound\(/);
assert.doesNotMatch(
  appCore,
  /function deleteSelected\(\)/
);
assert.doesNotMatch(appCore, /function startRec\(\)/);
assert.doesNotMatch(appCore, /function finishRec\(blob\)/);
assert.doesNotMatch(appCore, /function previewMetronomeSound\(/);
assert.doesNotMatch(
  appCore,
  /function getClipboardService\(\)/
);
assert.match(
  coreClipInteractionService,
  /function onClipMouseDown\(event\)/
);
assert.match(
  coreClipInteractionService,
  /function onDocMouseMove\(event\)/
);
assert.match(coreClipInteractionService, /function onDocMouseUp\(\)/);
assert.doesNotMatch(appCore, /function onClipMouseDown\(e\)/);
assert.doesNotMatch(appCore, /function onDocMouseMove\(e\)/);
assert.doesNotMatch(appCore, /function onDocMouseUp\(\)/);
assert.match(
  coreMixerBridgeService,
  /function getEditorMixerService\(\)/
);
assert.match(coreMixerBridgeService, /function updateTrackMix\(trackId\)/);
assert.doesNotMatch(
  appCore,
  /const mixerService = globalScope\.EditorMixerService\.create/
);

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
assert.match(appCore, /CoreMetronomeService/);
assert.match(appCore, /requireEditorSongRuntimeService\(\)\.setSong/);
assert.doesNotMatch(appCore, /EdCurAdapter\?\./);
assert.doesNotMatch(appCore, /\bedCur\b/);
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
