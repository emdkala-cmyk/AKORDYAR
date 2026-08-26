const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const files = [
  'Akordyar.html',
  'js/app/AppI18nService.js',
  'js/app/CoreArrangerSongNoteService.js',
  'js/app/CoreArrangerControlsService.js',
  'js/app/CoreArrangerEditorActionsService.js',
  'js/app/MidiMonitorService.js',
  'js/app/CoreGridQuantizeService.js',
  'js/app/CoreMetronomeService.js',
  'js/app/CoreTransportService.js',
  'js/app/CorePerformanceModeService.js',
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
  'js/app/CoreSyncModeBridgeService.js',
  'js/app/CoreSequentialChordRemapService.js',
  'js/editor/EditorChordImportService.js',
  'js/editor/EditorAutoImportStateService.js',
  'js/editor/EditorMidiInputService.js',
  'js/editor/EditorTimelineChordEditorService.js',
  'js/app/core.js',
  'js/app/editor.js',
  'js/app/search.js',
  'js/archive/ArchiveModule.js',
  'js/projecthub.js',
  'گزارش-کامل-روند-ویرایش-و-ساماندهی-پروژه.md'
];

for (const relativePath of files) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  assert.equal(
    source.includes('\uFFFD'),
    false,
    `${relativePath} contains a Unicode replacement character`
  );
}

console.log('Encoding integrity tests passed');
