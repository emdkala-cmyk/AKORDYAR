const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(
  path.join(projectRoot, 'Akordyar.html'),
  'utf8'
);

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const removedLegacyFiles = [
  'js/app.js',
  'js/core/MidiBridge.js',
  'js/core/NetworkBridge.js',
  'js/core/FileSystemBridge.js',
  'js/core/AudioManager.js',
  'js/core/AudioFileLoader.js',
  'js/core/ProjectStore.js'
];

for (const script of removedLegacyFiles) {
  assert.equal(
    fs.existsSync(path.join(projectRoot, script)),
    false,
    `${script} must be removed from the repository`
  );
  assert.doesNotMatch(
    html,
    new RegExp(`<script[^>]+src=["']${escapeRegExp(script)}["']`)
  );
}

for (const activeScript of [
  'js/core/ProjectAudioService.js',
  'js/core/PopupWindowService.js',
  'js/core/TimelineSectionRendererService.js',
  'js/editor/ArrangerMarkerService.js',
  'js/editor/ArrangerPlaybackPolicyService.js',
  'js/editor/AudioRecoveryService.js',
  'js/editor/EditorAudioStorageService.js',
  'js/editor/EditorAudioStorageRuntimeService.js',
  'js/editor/EditorPopupTimelineSyncService.js',
  'js/editor/EditorSyncAnalysisRuntimeService.js',
  'js/editor/EditorLyricsChordInteractionService.js',
  'js/app/AppI18nService.js',
  'js/app/CoreArrangerSongNoteService.js',
  'js/app/CoreArrangerControlsService.js',
  'js/app/CoreArrangerEditorActionsService.js',
  'js/app/CoreArrangerRuntimeService.js',
  'js/app/MidiMonitorService.js',
  'js/app/CoreGridQuantizeService.js',
  'js/app/CoreMetronomeService.js',
  'js/app/CoreTransportService.js',
  'js/app/CorePerformanceModeService.js',
  'js/app/CorePerformanceRuntimeService.js',
  'js/app/CorePerformanceControllerService.js',
  'js/app/CorePanelLayoutService.js',
  'js/app/CoreTimelineGeometryService.js',
  'js/app/CoreTimelineRendererService.js',
  'js/app/CoreTimelineGridService.js',
  'js/app/CoreTimelineSectionBridgeService.js',
  'js/app/CoreTimelineChordEditorBridgeService.js',
  'js/app/CoreTrackSetupService.js',
  'js/app/CoreClipService.js',
  'js/app/CoreAudioImportService.js',
  'js/app/CoreClipEditService.js',
  'js/app/CoreSelectionService.js',
  'js/app/CoreClipDragService.js',
  'js/app/CoreClipInteractionService.js',
  'js/app/CoreTimelineRuntimeService.js',
  'js/app/CoreClipDeletionService.js',
  'js/app/CoreClipboardBridgeService.js',
  'js/app/CoreMixerBridgeService.js',
  'js/app/CoreRecordingService.js',
  'js/app/CoreSettingsService.js',
  'js/app/CoreHighlightService.js',
  'js/app/CoreMovableWindowBridgeService.js',
  'js/app/CoreArrangerMarkerBridgeService.js',
  'js/app/CoreLoopVisualService.js',
  'js/app/CoreLoopControlService.js',
  'js/app/CoreChordLineSyncService.js',
  'js/app/CorePopupWindowBridgeService.js',
  'js/app/CoreHistoryBridgeService.js',
  'js/app/CoreFocusModeService.js',
  'js/app/CorePopupRuntimeService.js',
  'js/app/CoreSyncModeBridgeService.js',
  'js/app/CoreSequentialChordRemapService.js',
  'js/editor/EditorChordImportService.js',
  'js/editor/EditorKeyboardRuntimeService.js',
  'js/editor/EditorKeyboardControllerService.js',
  'js/editor/EditorAutoImportStateService.js',
  'js/editor/EditorAutoImportRuntimeService.js',
  'js/editor/EditorAutoImportFileSaveService.js',
  'js/editor/EditorAutoImportWorkflowService.js',
  'js/editor/EditorAutoImportRetryService.js',
  'js/editor/EditorArrangerSongLoadService.js',
  'js/editor/EditorArrangerHotSwapService.js',
  'js/editor/EditorArrangerRuntimeService.js',
  'js/editor/EditorArrangerControllerService.js',
  'js/editor/EditorPlaylistBackupService.js',
  'js/editor/EditorToolbarDockService.js',
  'js/editor/EditorMidiInputService.js',
  'js/editor/EditorTimelineChordEditorService.js',
  'js/editor/EditorPublicApi.js',
  'js/archive/ArchivePublicApi.js',
  'js/editor/EditorProjectFileService.js',
  'js/editor/EditorProjectExportRouteService.js',
  'js/editor/EditorProjectExportWorkflowService.js',
  'js/editor/EditorProjectImportRouteService.js',
  'js/editor/EditorSongPersistenceService.js'
]) {
  assert.match(html, new RegExp(escapeRegExp(activeScript)));
}

console.log('Legacy runtime script contract tests passed');
