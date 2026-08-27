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
const masterSync = executableLines(read('js/sync/masterSync.js'));
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
const editorChordImportService = read('js/editor/EditorChordImportService.js');
const editorMidiInputService = read('js/editor/EditorMidiInputService.js');
const editorAutoImportStateService = read(
  'js/editor/EditorAutoImportStateService.js'
);
const editorAutoImportRuntimeService = read(
  'js/editor/EditorAutoImportRuntimeService.js'
);
const editorAutoImportFileSaveService = read(
  'js/editor/EditorAutoImportFileSaveService.js'
);
const editorAutoImportWorkflowService = read(
  'js/editor/EditorAutoImportWorkflowService.js'
);
const editorAutoImportRetryService = read(
  'js/editor/EditorAutoImportRetryService.js'
);
const editorArrangerSongLoadService = read(
  'js/editor/EditorArrangerSongLoadService.js'
);
const editorArrangerHotSwapService = read(
  'js/editor/EditorArrangerHotSwapService.js'
);
const editorArrangerRuntimeService = read(
  'js/editor/EditorArrangerRuntimeService.js'
);
const editorArrangerControllerService = read(
  'js/editor/EditorArrangerControllerService.js'
);
const editorSongInitializationControllerService = read(
  'js/editor/EditorSongInitializationControllerService.js'
);
const editorProjectExportWorkflowService = read(
  'js/editor/EditorProjectExportWorkflowService.js'
);
const editorAudioStorageRuntimeService = read(
  'js/editor/EditorAudioStorageRuntimeService.js'
);
const editorPlaylistBackupService = read(
  'js/editor/EditorPlaylistBackupService.js'
);
const editorToolbarDockService = read(
  'js/editor/EditorToolbarDockService.js'
);
const editorColorToolService = read(
  'js/editor/EditorColorToolService.js'
);
const editorLyricsRenderer = read('js/editor/EditorLyricsRenderer.js');
const editorSyncAnalysisRuntimeService = read(
  'js/editor/EditorSyncAnalysisRuntimeService.js'
);
const midiMonitorService = read('js/app/MidiMonitorService.js');
const coreGridQuantizeService = read('js/app/CoreGridQuantizeService.js');
const coreMetronomeService = read('js/app/CoreMetronomeService.js');
const coreTransportService = read('js/app/CoreTransportService.js');
const corePerformanceModeService = read(
  'js/app/CorePerformanceModeService.js'
);
const corePerformanceRuntimeService = read(
  'js/app/CorePerformanceRuntimeService.js'
);
const corePerformanceControllerService = read(
  'js/app/CorePerformanceControllerService.js'
);
const corePanelLayoutService = read('js/app/CorePanelLayoutService.js');
const coreTimelineGeometryService = read('js/app/CoreTimelineGeometryService.js');
const coreTimelineRendererService = read('js/app/CoreTimelineRendererService.js');
const coreTimelineGridService = read('js/app/CoreTimelineGridService.js');
const coreTimelineSectionBridgeService = read(
  'js/app/CoreTimelineSectionBridgeService.js'
);
const coreTimelineRuntimeService = read(
  'js/app/CoreTimelineRuntimeService.js'
);
const coreTimelineChordEditorBridgeService = read(
  'js/app/CoreTimelineChordEditorBridgeService.js'
);
const coreTrackSetupService = read('js/app/CoreTrackSetupService.js');
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
const coreHighlightService = read('js/app/CoreHighlightService.js');
const coreMovableWindowBridgeService = read(
  'js/app/CoreMovableWindowBridgeService.js'
);
const coreArrangerMarkerBridgeService = read(
  'js/app/CoreArrangerMarkerBridgeService.js'
);
const coreLoopVisualService = read('js/app/CoreLoopVisualService.js');
const coreLoopControlService = read('js/app/CoreLoopControlService.js');
const coreChordLineSyncService = read(
  'js/app/CoreChordLineSyncService.js'
);
const corePopupWindowBridgeService = read(
  'js/app/CorePopupWindowBridgeService.js'
);
const coreHistoryBridgeService = read(
  'js/app/CoreHistoryBridgeService.js'
);
const coreArrangerSongNoteService = read(
  'js/app/CoreArrangerSongNoteService.js'
);
const coreArrangerControlsService = read(
  'js/app/CoreArrangerControlsService.js'
);
const coreArrangerEditorActionsService = read(
  'js/app/CoreArrangerEditorActionsService.js'
);
const coreArrangerRuntimeService = read(
  'js/app/CoreArrangerRuntimeService.js'
);
const coreFocusModeService = read('js/app/CoreFocusModeService.js');
const corePopupRuntimeService = read('js/app/CorePopupRuntimeService.js');
const coreSyncModeBridgeService = read(
  'js/app/CoreSyncModeBridgeService.js'
);
const coreSequentialChordRemapService = read(
  'js/app/CoreSequentialChordRemapService.js'
);
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
assert.doesNotMatch(archiveRuntimeAdapter, /EdCurAdapter|getEdCur|setEdCur/);
assert.match(archiveRuntimeAdapter, /getDAW\(\)/);
assert.match(archiveRuntimeAdapter, /getPERF\(\)/);
assert.match(editorRuntimeAdapter, /getDAWOrThrow\(\)/);
assert.match(editorRuntimeAdapter, /getPERFOrThrow\(\)/);
assert.match(editorRuntimeAdapter, /startPointerDrag/);
assert.match(editorRuntimeAdapter, /onSongChange/);
assert.doesNotMatch(editorRuntimeAdapter, /EdCurAdapter/);
assert.doesNotMatch(
  editorRuntimeAdapter,
  /globalScope\.(?:getEditorDAW|getEditorPERF|getEditorSong|startEditorPointerDrag)/
);
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
assert.match(editorSongRuntimeService, /onSongChange/);
assert.doesNotMatch(editorSongRuntimeService, /EdCurAdapter|getEdCur|setEdCur/);
assert.doesNotMatch(
  editorSongRuntimeService,
  /EditorLegacySongBridge|getLegacySong|setLegacySong|legacyBridge/
);
assert.doesNotMatch(editor, /EditorLegacySongBridge/);
assert.match(
  editorAudioStorageRuntimeService,
  /EditorAudioStorageRuntimeService/
);
assert.match(
  editorAudioStorageRuntimeService,
  /EditorAudioStorageRuntime\s*=\s*create\(\)/
);
assert.doesNotMatch(
  editorAudioStorageRuntimeService,
  /Object\.assign\(globalScope,\s*create\(\)\)/
);
assert.doesNotMatch(
  editorAudioStorageRuntimeService,
  /globalScope\.(?:getAudioCompressionService|openAudioDB|saveFileHandle|getFileHandle|saveAudioBlobToDB|getAudioBlobFromDB|saveAudioBlobsForProject|loadAudioBlobsForProject|deleteAudioBlobsForProject|formatBytes|base64ToUint8|decodeWebMToBuffer|resampleFloat32|refreshStorageInfo)\b/
);
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
assert.match(editorChordImportService, /function parseChordPage\(html, url\)/);
assert.match(
  editorChordImportService,
  /function applyImportChords\(parsedOverride = null\)/
);
assert.doesNotMatch(editor, /function parseChordPage\(html, url\)/);
assert.doesNotMatch(editor, /function applyImportChords\(\)/);
assert.doesNotMatch(editor, /_importParsed/);
assert.match(editorMidiInputService, /function handleMessage\(event\)/);
assert.match(editorMidiInputService, /function evaluateInput\(\)/);
assert.match(editorMidiInputService, /function highlightPianoKey\(midiNote, on\)/);
assert.doesNotMatch(editorMidiInputService, /\bedCur\b/);
assert.doesNotMatch(editorMidiInputService, /\bDAW\b/);
assert.doesNotMatch(editorMidiInputService, /\bPERF\b/);
assert.doesNotMatch(editorMidiInputService, /window\.edCur/);
assert.doesNotMatch(editor, /function handleMIDIMessage\(e\)/);
assert.doesNotMatch(editor, /function evaluateMidiInput\(\)/);
assert.doesNotMatch(editor, /function highlightPianoKey\(midiNote, on\)/);
assert.match(editorAutoImportStateService, /function getResults\(\)/);
assert.match(editorAutoImportStateService, /function getStats\(\)/);
assert.match(editorAutoImportStateService, /function getFailedSongs\(\)/);
assert.doesNotMatch(editorAutoImportStateService, /window\._ai/);
assert.doesNotMatch(editor, /window\._ai(?:Results|ArtistMap|Stats|FailedSongs|FailedFiles)/);
assert.doesNotMatch(editor, /window\._autoImportDirHandle/);
assert.doesNotMatch(editor, /window\.(?:timelineScrollbars|timelinePanelLayout)/);
assert.match(editorAutoImportRuntimeService, /function parseArtistNames\(/);
assert.match(editorAutoImportRuntimeService, /function escapeHtml\(/);
assert.match(editorAutoImportRuntimeService, /function saveSongToArchive\(/);
assert.match(editorAutoImportRuntimeService, /function buildProgressDetail\(/);
assert.match(editorAutoImportRuntimeService, /workflowService\.create/);
assert.match(editorAutoImportRuntimeService, /retryService\.create/);
assert.doesNotMatch(editor, /function parseArtistNames\(/);
assert.doesNotMatch(editor, /function saveSongToArchive\(/);
assert.doesNotMatch(editor, /function buildProgressDetail\(/);
assert.match(editorAutoImportFileSaveService, /async function saveFiles\(\)/);
assert.match(
  editorAutoImportFileSaveService,
  /function sanitizeFilePart\(value, fallback = 'Unknown'\)/
);
assert.doesNotMatch(editor, /async function autoImportDoSave\(\)/);
assert.doesNotMatch(editor, /function sanitizeFilePart\(/);
assert.doesNotMatch(editor, /function buildSaveReport\(/);
assert.doesNotMatch(editor, /\/api\/save-to-folder/);
assert.match(editorAutoImportWorkflowService, /async function start\(\)/);
assert.match(
  editorAutoImportWorkflowService,
  /function appendArtistResults/
);
assert.match(
  editorAutoImportWorkflowService,
  /function buildFinalReport/
);
assert.match(editorAutoImportRuntimeService, /function startAutoImport\(\)/);
assert.doesNotMatch(editor, /function startAutoImport\(\)/);
assert.match(editorAutoImportRetryService, /async function retryFailed\(\)/);
assert.match(editorAutoImportRetryService, /function groupByArtist/);
assert.match(editorAutoImportRetryService, /song => !song\.error && song\.rawText/);
assert.match(editorAutoImportRuntimeService, /function autoRetryFailed\(\)/);
assert.doesNotMatch(editor, /function autoRetryFailed\(\)/);
assert.doesNotMatch(editor, /━━━ خلاصه شناسایی ━━━/);
assert.match(editorArrangerSongLoadService, /async function load\(index\)/);
assert.match(
  editorArrangerSongLoadService,
  /function resetPreparationState\(\)/
);
assert.match(
  editorArrangerSongLoadService,
  /function fallbackPlaybackBoundary\(\)/
);
assert.doesNotMatch(
  editor,
  /const arr = arrPerformData \|\| editingArr;/
);
assert.match(
  editor,
  /async function loadArrSong\(idx\)\s*\{\s*return getEditorArrangerRuntime\(\)\?\.loadArrSong\?\.\(idx\);\s*\}/
);
assert.match(editorArrangerHotSwapService, /function hotSwapToNextSong\(\)/);
assert.match(editorArrangerHotSwapService, /function applyPlaybackBoundary/);
assert.match(
  editorArrangerRuntimeService,
  /hotSwapService\.create/
);
assert.match(
  editorArrangerRuntimeService,
  /songLoadService\.create/
);
assert.match(
  editorArrangerControllerService,
  /getSongLoadPerformanceState/
);
assert.match(
  editorArrangerControllerService,
  /EditorArrangerRuntimeService/
);
assert.doesNotMatch(
  editor,
  /EditorArranger(?:SongLoad|HotSwap)Service\.create/
);
assert.doesNotMatch(
  editor,
  /EditorArrangerRuntimeService\.create/
);
assert.match(
  editorSongInitializationControllerService,
  /EditorSongInitializationService/
);
assert.doesNotMatch(
  editor,
  /EditorSongInitializationService\.create/
);
assert.doesNotMatch(
  editor,
  /\b(?:arrPerformActive|arrPerformIdx|arrPerformData|arrPreparePending|_arrNextState|_arrHasLoggedNoNextSong|_arrPrepStartedForIndex|perfModeActive|perfPauseMode|_arrWaitPollActive)\b/
);
assert.doesNotMatch(editor, /if \(!_arrNextState\) return false;/);
assert.doesNotMatch(
  editor,
  /const transition = getEditorSongTransitionService\(\)\?\.applyPreparedState/
);
assert.match(
  editor,
  /function hotSwapToNextSong\(\.\.\.args\)\s*\{\s*return getEditorArrangerRuntime\(\)\?\.hotSwapToNextSong\?\.\(\.\.\.args\);\s*\}/
);
assert.match(editorProjectExportWorkflowService, /async function exportProject/);
assert.match(editorProjectExportWorkflowService, /saveNative\?\.\(/);
assert.match(editorProjectExportWorkflowService, /saveBrowser\?\.\(/);
assert.doesNotMatch(editor, /const blob = new Blob\(\[data\]/);
assert.doesNotMatch(editor, /const linkedInfo = linkedCount > 0/);
assert.match(
  editor,
  /async function edExportProjectFull\(options = \{\}\)\s*\{\s*return getEditorProjectExportWorkflowService\(\)\?\.exportProject\?\.\(options\);\s*\}/
);
assert.match(
  editorPlaylistBackupService,
  /async function exportAllPlaylistsToFile\(\)/
);
assert.match(
  editorPlaylistBackupService,
  /function validateBackup\(data\)/
);
assert.match(
  editorPlaylistBackupService,
  /async function importFile\(file\)/
);
assert.doesNotMatch(editor, /const exportData = \{/);
assert.doesNotMatch(editor, /const supportedVersions = \[1, '1\.0', 2, '2\.0'\]/);
assert.match(
  editor,
  /function exportAllPlaylistsToFile\(\)\s*\{\s*return getEditorPlaylistBackupService\(\)\?\.exportAllPlaylistsToFile\(\);\s*\}/
);
assert.match(
  editor,
  /function importAllPlaylistsFromFile\(\)\s*\{\s*return getEditorPlaylistBackupService\(\)\?\.importAllPlaylistsFromFile\(\);\s*\}/
);
assert.match(editorToolbarDockService, /function showToolbarContextMenu/);
assert.match(editorToolbarDockService, /function beginDrag/);
assert.match(editorToolbarDockService, /function finishDrag/);
assert.doesNotMatch(editor, /let toolbarDragging/);
assert.doesNotMatch(editor, /function showToolbarContextMenu/);
assert.match(
  editor,
  /function toggleToolbarDock\(\)\s*\{\s*return getEditorToolbarDockService\(\)\?\.toggleToolbarDock\?\.\(\);\s*\}/
);
assert.match(editorColorToolService, /function paintContextAware\(event\)/);
assert.match(editorColorToolService, /function applyColorToClip\(clip, color\)/);
assert.match(
  editorColorToolService,
  /function applyColorToSection\(section, color\)/
);
assert.doesNotMatch(editor, /function paintContextAware\(event\)/);
assert.doesNotMatch(editor, /function applyColorToClip\(clip, color\)/);
assert.doesNotMatch(
  editor,
  /function applyColorToSection\(section, color\)/
);
assert.doesNotMatch(editor, /let colorToolMode/);
assert.doesNotMatch(editor, /const COLOR_PALETTE/);
assert.match(editor, /getEditorColorToolService\(\)\?\.init\?\.\(\)/);
assert.doesNotMatch(archive, /_importParsed/);
assert.doesNotMatch(editorLyricsRenderer, /window\.edCur/);
assert.doesNotMatch(editorLyricsRenderer, /\bDAW\b/);
assert.doesNotMatch(editorLyricsRenderer, /\bPERF\b/);
assert.match(editorLyricsRenderer, /function render/);
assert.match(appCore, /function requireEditorSongStateService\(\)/);
assert.match(editorSyncAnalysisRuntimeService, /function detectTempo\(\)[\s\S]*getSyncTimes/);
assert.match(editorSyncAnalysisRuntimeService, /function detectKey\(\)[\s\S]*getChords/);
assert.doesNotMatch(
  editorSyncAnalysisRuntimeService,
  /Object\.assign\(globalScope,\s*create\(\)\)/
);
assert.match(editor, /EditorSyncAnalysisRuntimeService/);
assert.doesNotMatch(editor, /function (tapTempo|detectTempo|detectKey)\(/);
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
assert.match(corePanelLayoutService, /function initTimelinePanelLayout\(\)/);
assert.doesNotMatch(
  corePanelLayoutService,
  /globalScope\.(?:projectPanelLayout|songPropertiesPanelLayout)/
);
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
assert.match(coreTimelineGridService, /function drawLaneGrid\(canvas\)/);
assert.match(coreTimelineGridService, /function renderRuler\(\)/);
assert.match(coreTimelineGridService, /function handleTimingChange\(\)/);
assert.match(
  coreTimelineSectionBridgeService,
  /function getTimelineSectionRendererService\(\)/
);
assert.match(coreTimelineRuntimeService, /function requireService/);
assert.match(coreTimelineRuntimeService, /const geometry =/);
assert.match(coreTimelineRuntimeService, /(?:let|const) clipRenderer =/);
assert.match(
  coreTimelineChordEditorBridgeService,
  /function openTimelineChordEditor\(clipId\)/
);
assert.match(coreTrackSetupService, /function getIconSvg\(icon\)/);
assert.match(coreTrackSetupService, /function openIconPicker\(track\)/);
assert.match(coreTrackSetupService, /function addNewTrack\(name, icon\)/);
assert.doesNotMatch(
  appCore,
  /function getTimelineTrackRendererService\(\)/
);
assert.doesNotMatch(appCore, /function updateTrackSelectionUI\(\)/);
assert.doesNotMatch(appCore, /const ICON_SVG_MAP/);
assert.doesNotMatch(appCore, /function openIconPicker\(track\)/);
assert.doesNotMatch(appCore, /function addNewTrack\(name, icon\)/);
assert.doesNotMatch(appCore, /function drawLaneGrid\(canvas\)/);
assert.doesNotMatch(appCore, /function renderRuler\(\)/);
assert.doesNotMatch(appCore, /function handleTimingChange\(\)/);
assert.doesNotMatch(
  appCore,
  /function getTimelineSectionRendererService\(\)/
);
assert.match(appCore, /CoreTimelineRuntimeService\?\.create/);
assert.doesNotMatch(appCore, /CoreTimelineGeometryService\?\.create/);
assert.doesNotMatch(appCore, /CoreClipRendererService\?\.create/);
assert.doesNotMatch(appCore, /CoreTimelineGridService\?\.create/);
assert.doesNotMatch(appCore, /CoreTimelineSectionBridgeService\?\.create/);
assert.doesNotMatch(
  appCore,
  /function openTimelineChordEditor\(clipId\)/
);
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
assert.match(coreHighlightService, /function setHighlightEffect\(effect\)/);
assert.match(coreHighlightService, /function initHighlightEffect\(\)/);
assert.match(
  coreMovableWindowBridgeService,
  /function getEditorMovableWindowService\(\)/
);
assert.match(coreArrangerMarkerBridgeService, /function create\(\{/);
assert.match(coreArrangerMarkerBridgeService, /controller\.bindDrag/);
assert.match(coreLoopVisualService, /function renderLoopRegion\(\)/);
assert.match(coreLoopVisualService, /function bindLoopDrag\(\)/);
assert.match(coreLoopControlService, /function toggleLoop\(\)/);
assert.match(
  coreLoopControlService,
  /function setLoopFromSelectionAndPlay\(\)/
);
assert.match(
  coreChordLineSyncService,
  /function syncChordLineFromLyrics\(\)/
);
assert.match(corePopupWindowBridgeService, /function isPopupOpen\(popup\)/);
assert.match(corePopupWindowBridgeService, /function openPopupWindow\(name, features\)/);
assert.match(coreHistoryBridgeService, /function attach\(\)/);
assert.match(
  coreArrangerSongNoteService,
  /function openArrSongNote\(index\)/
);
assert.match(
  coreArrangerSongNoteService,
  /function closeArrSongNote\(\)/
);
assert.match(
  coreArrangerSongNoteService,
  /function saveArrSongNote\(\)/
);
assert.match(
  coreArrangerControlsService,
  /function arrSetCrossfade\(value\)/
);
assert.match(
  coreArrangerControlsService,
  /function arrTogglePauseBetween\(\)/
);
assert.match(
  coreArrangerControlsService,
  /function arrAutoTranspose\(\)/
);
assert.match(
  coreArrangerControlsService,
  /function arrClearNotes\(\)/
);
assert.match(
  coreArrangerControlsService,
  /function arrFilterSongs\(\)/
);
assert.match(
  coreArrangerEditorActionsService,
  /function switchArrTab\(tab\)/
);
assert.match(
  coreArrangerEditorActionsService,
  /function closeArrEditor\(\)/
);
assert.match(
  coreArrangerEditorActionsService,
  /function exportCurrentArranger\(\)/
);
assert.match(
  coreArrangerRuntimeService,
  /function requireService\(service, name\)/
);
assert.match(
  coreArrangerRuntimeService,
  /CoreArrangerManagerRendererService/
);
assert.match(
  coreArrangerRuntimeService,
  /CoreArrangerFileImportService/
);
assert.match(
  coreArrangerRuntimeService,
  /CoreArrangerSaveService/
);
assert.match(appCore, /CoreHistoryBridgeService/);
assert.doesNotMatch(appCore, /function attachHistoryService\(\)/);
assert.doesNotMatch(appCore, /function openArrSongNote\(idx\)/);
assert.doesNotMatch(appCore, /function closeArrSongNote\(\)/);
assert.doesNotMatch(appCore, /function saveArrSongNote\(\)/);
assert.doesNotMatch(appCore, /function arrSetCrossfade\(val\)/);
assert.doesNotMatch(appCore, /function arrTogglePauseBetween\(\)/);
assert.doesNotMatch(appCore, /function arrAutoTranspose\(\)/);
assert.doesNotMatch(appCore, /function arrClearNotes\(\)/);
assert.doesNotMatch(appCore, /function arrFilterSongs\(\)/);
assert.doesNotMatch(appCore, /function switchArrTab\(tab\)/);
assert.doesNotMatch(appCore, /function closeArrEditor\(\)/);
assert.doesNotMatch(appCore, /function exportCurrentArranger\(\)/);
assert.match(appCore, /CoreArrangerRuntimeService\?\.create/);
assert.doesNotMatch(
  appCore,
  /CoreArranger(?:ManagerRenderer|FileImport|FileExport|SongsOverview|SongTransfer|EditorActions|Controls|SongNote|SetlistRenderer|PoolRenderer|Editor|Modal|Creation|Save)Service\?\.create/
);
assert.doesNotMatch(appCore, /let arrangers\b/);
assert.doesNotMatch(appCore, /let editingArr\b/);
assert.doesNotMatch(appCore, /window\.arrangers/);
assert.doesNotMatch(projectHub, /window\.arrangers/);
assert.doesNotMatch(
  projectHub,
  /window\.(?:openArrangerModal|createNewArranger)/
);
assert.match(coreFocusModeService, /function toggleFocusMode\(\)/);
assert.match(
  corePopupRuntimeService,
  /function requireService\(service, name\)/
);
assert.match(corePopupRuntimeService, /CorePlayerViewPopupService/);
assert.match(corePopupRuntimeService, /CoreLyricOnlyPopupService/);
assert.match(corePopupRuntimeService, /CoreChordLinePopupService/);
assert.match(corePopupRuntimeService, /function openLyricPopup\(\)/);
assert.match(corePopupRuntimeService, /function openLyricOnlyPopup\(\)/);
assert.match(
  appCore,
  /corePublicApi\.publish\(\{[\s\S]*?syncExistingPopup,[\s\S]*?render[\s\S]*?\}, \{ exposeGlobals: false \}\)/
);
assert.doesNotMatch(appCore, /Object\.assign\(globalScope,\s*coreTransportRuntime\)/);
assert.match(appCore, /corePublicApi\.publish\(coreTransportRuntime, \{ exposeGlobals: false \}\)/);
assert.doesNotMatch(masterSync, /globalScope\.(?:seekTransport|startTransport|pauseTransport|stopTransport)/);
assert.match(masterSync, /globalScope\.AkordyarCoreApi/);
assert.match(
  coreSyncModeBridgeService,
  /function createSyncModeControllerBridge\(\)/
);
assert.match(
  coreSyncModeBridgeService,
  /function requireSyncModeController\(\)/
);
assert.match(
  coreSequentialChordRemapService,
  /function remap\(oldText, newText\)/
);
assert.doesNotMatch(
  appCore,
  /function deleteSelected\(\)/
);
assert.doesNotMatch(appCore, /function startRec\(\)/);
assert.doesNotMatch(appCore, /function finishRec\(blob\)/);
assert.doesNotMatch(appCore, /function previewMetronomeSound\(/);
assert.doesNotMatch(appCore, /function setHighlightEffect\(effect\)/);
assert.doesNotMatch(appCore, /function getEditorMovableWindowService\(\)/);
assert.doesNotMatch(
  appCore,
  /EditorArrangerMarkerControllerService\.create/
);
assert.doesNotMatch(appCore, /function renderLoopRegion\(\)/);
assert.doesNotMatch(appCore, /function toggleLoop\(\)/);
assert.doesNotMatch(appCore, /function setLoopFromSelectionAndPlay\(\)/);
assert.doesNotMatch(appCore, /function syncChordLineFromLyrics\(\)/);
assert.doesNotMatch(appCore, /function openPopupWindow\(name, features\)/);
assert.doesNotMatch(appCore, /function toggleFocusMode\(\)/);
assert.match(appCore, /CorePopupRuntimeService\?\.create/);
assert.doesNotMatch(appCore, /CorePlayerViewPopupService\?\.create/);
assert.doesNotMatch(appCore, /CoreLyricOnlyPopupService\?\.create/);
assert.doesNotMatch(appCore, /CoreChordLinePopupService\?\.create/);
assert.doesNotMatch(
  appCore,
  /function createSyncModeControllerBridge\(\)/
);
assert.doesNotMatch(
  appCore,
  /function requireSyncModeController\(\)/
);
assert.doesNotMatch(
  appCore,
  /function edRemapSeqPoints\(oldText, newText\)/
);
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
assert.match(appCore, /RuntimeStateAdapter\.setDAW\(DAW\)/);
assert.match(appCore, /RuntimeStateAdapter\.setPERF\(PERF\)/);
assert.doesNotMatch(appCore, /globalScope\.(?:DAW|PERF)\s*=/);
assert.doesNotMatch(
  appCore,
  /\b(?:getEditorDAW|getEditorPERF|getEditorSong|startEditorPointerDrag)\b/
);
assert.doesNotMatch(
  editor,
  /\b(?:getEditorDAW|getEditorPERF|getEditorSong|startEditorPointerDrag)\b/
);
assert.doesNotMatch(
  appCore,
  /globalScope\.DAW\s*=\s*\{\s*audioContext:/,
  'core must not publish a placeholder DAW'
);
assert.match(appCore, /CoreMetronomeService/);
assert.match(coreTransportService, /function startTransport\(\)/);
assert.match(coreTransportService, /function pauseTransport\(\)/);
assert.match(coreTransportService, /function getArrangerEnd\(\)/);
assert.match(appCore, /CoreTransportService/);
assert.doesNotMatch(appCore, /function startTransport\(\)/);
assert.doesNotMatch(appCore, /function pauseTransport\(\)/);
assert.doesNotMatch(appCore, /function getArrangerEnd\(\)/);
assert.match(corePerformanceModeService, /async function openPerfMode\(\)/);
assert.match(corePerformanceModeService, /function perfTogglePlay\(\)/);
assert.match(corePerformanceModeService, /function perfTranspose\(/);
assert.match(corePerformanceModeService, /function startPerfTimer\(\)/);
assert.match(corePerformanceRuntimeService, /function requireService/);
assert.match(corePerformanceRuntimeService, /performanceModeService/);
assert.match(corePerformanceRuntimeService, /backgroundPreloadService/);
assert.match(corePerformanceRuntimeService, /performanceUiService/);
assert.match(corePerformanceControllerService, /runtimeService/);
assert.match(appCore, /CorePerformanceControllerService/);
assert.doesNotMatch(appCore, /CorePerformanceRuntimeService\?\.create/);
assert.doesNotMatch(appCore, /async function openPerfMode\(\)/);
assert.doesNotMatch(appCore, /function perfTogglePlay\(\)/);
assert.doesNotMatch(appCore, /function perfTranspose\(/);
assert.doesNotMatch(appCore, /function startPerfTimer\(\)/);
assert.doesNotMatch(appCore, /CoreArrangerPreparationService\?\.create/);
assert.doesNotMatch(appCore, /CoreArrangerBackgroundPreloadService\?\.create/);
assert.doesNotMatch(appCore, /CoreArrangerCrossfadeService\?\.create/);
assert.doesNotMatch(appCore, /CorePerformanceUiService\?\.create/);
assert.match(appCore, /coreEditorRuntime\.setSong/);
assert.doesNotMatch(appCore, /EdCurAdapter\?\./);
assert.doesNotMatch(appCore, /\bedCur\b/);
assert.doesNotMatch(appCore, /\bsetEditorSong\b/);
assert.doesNotMatch(editor, /\bsetEditorSong\b/);
assert.doesNotMatch(archive, /\bsetEditorSong\b/);
assert.doesNotMatch(
  editor,
  /\b(?:rebuildSongDocumentFromEdCur|syncViewStylesFromEdCur|syncViewStylesToEdCur)\b/
);
assert.doesNotMatch(
  performanceBridge,
  /\b(?:rebuildSongDocumentFromEdCur|syncViewStylesFromEdCur|syncViewStylesToEdCur)\b/
);
assert.doesNotMatch(
  domainBridge,
  /\b(?:rebuildSongDocumentFromEdCur|syncViewStylesFromEdCur|syncViewStylesToEdCur)\b/
);
assert.doesNotMatch(editor, /EdCurAdapter\?\.setEdCur/);
assert.doesNotMatch(editor, /EdCurAdapter/);
assert.doesNotMatch(archive, /EdCurAdapter\?\.setEdCur/);

assert.doesNotMatch(search, /document\.addEventListener\(['"](?:mousemove|mouseup)['"]/);
assert.doesNotMatch(editor, /document\.addEventListener\(['"](?:mousemove|mouseup)['"]/);
assert.doesNotMatch(appCore, /document\.addEventListener\(['"](?:mousemove|mouseup)['"]/);

console.log('Runtime dependency budget tests passed');
