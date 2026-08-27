const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'Akordyar.html'),
  'utf8'
);

const syncClientHtml = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'sync-client.html'),
  'utf8'
);

const coreSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'core.js'),
  'utf8'
);

const editorSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'editor.js'),
  'utf8'
);

const searchSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'search.js'),
  'utf8'
);

assert.equal(
  fs.existsSync(path.resolve(__dirname, '..', 'app.js')),
  false,
  'legacy application loader must be removed'
);
assert.doesNotMatch(
  html,
  /<script[^>]+src=["']js\/app\.js["']/
);
assert.doesNotThrow(
  () => new vm.Script(`${coreSource}\n${editorSource}\n${searchSource}`),
  'classic app scripts must not redeclare lexical bindings'
);

function scriptIndex(sourceName) {
  const index = html.indexOf(`src="${sourceName}"`);
  assert.notEqual(index, -1, `${sourceName} must be loaded`);
  return index;
}

assert.ok(
  scriptIndex('js/core/FunctionUtils.js') <
    scriptIndex('js/app/constants.js')
);
assert.ok(
  scriptIndex('js/core/DAWRuntimeState.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/WindowBridge.js') <
    scriptIndex('js/core/PopupWindowService.js')
);
assert.ok(
  scriptIndex('js/core/PopupWindowService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/PopupWindowService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/core/EditorRuntimeAdapter.js') <
    scriptIndex('js/core/EditorMovableWindowService.js')
);
assert.ok(
  scriptIndex('js/core/EditorMovableWindowService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorCustomPromptService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorTransportStateService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/constants.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/RuntimeStateAdapter.js') <
    scriptIndex('js/archive/ArchiveRuntimeAdapter.js')
);
assert.ok(
  scriptIndex('js/core/TransposeService.js') <
    scriptIndex('js/editor/EditorNotationService.js')
);
assert.ok(
  scriptIndex('js/core/Meter.js') <
    scriptIndex('js/core/MusicTheory.js')
);
assert.ok(
  scriptIndex('js/core/MidiFileParser.js') <
    scriptIndex('js/core/MidiScoreModel.js')
);
assert.ok(
  scriptIndex('js/core/MidiScoreModel.js') <
    scriptIndex('js/core/MidiScoreRenderer.js')
);
assert.ok(
  scriptIndex('js/core/MusicXmlScoreParser.js') <
    scriptIndex('js/core/MusicXmlScoreModel.js')
);
assert.ok(
  scriptIndex('js/core/MusicXmlScoreModel.js') <
    scriptIndex('js/core/MusicXmlScoreRenderer.js')
);
assert.ok(
  scriptIndex('js/core/ScoreTransposeService.js') <
    scriptIndex('js/editor/MidiScoreController.js')
);
assert.ok(
  scriptIndex('js/core/ScorePartMappingService.js') <
    scriptIndex('js/core/MusicXmlScoreRenderer.js')
);
assert.ok(
  scriptIndex('js/core/MidiScoreRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/MusicXmlScoreRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/AudioContextService.js') <
    scriptIndex('js/core/CountInScheduler.js')
);
assert.ok(
  scriptIndex('js/core/AudioCompressionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TransportClockService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/CorePublicApi.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/AppI18nService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/MidiMonitorService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreGridQuantizeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreMetronomeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CorePanelLayoutService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreTimelineGeometryService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreTimelineRendererService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreTimelineGridService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreTimelineSectionBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreTimelineChordEditorBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreTrackSetupService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreClipService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreAudioImportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreClipEditService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreSelectionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreClipDragService.js') <
    scriptIndex('js/app/CoreClipInteractionService.js')
);
assert.ok(
  scriptIndex('js/app/CoreClipInteractionService.js') <
    scriptIndex('js/app/CoreTimelineRuntimeService.js')
);
assert.ok(
  scriptIndex('js/app/CoreTimelineRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreClipDeletionService.js') <
    scriptIndex('js/app/CoreClipboardBridgeService.js')
);
assert.ok(
  scriptIndex('js/app/CoreClipboardBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreMixerBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreRecordingService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreSettingsService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreHighlightService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreMovableWindowBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreArrangerMarkerBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreTransportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CorePerformanceModeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CorePerformanceRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CorePerformanceControllerService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreLoopVisualService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreLoopControlService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreChordLineSyncService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CorePopupWindowBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreHistoryBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreArrangerSongNoteService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreArrangerControlsService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreArrangerEditorActionsService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreArrangerRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreFocusModeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CorePopupRuntimeService.js?v=20260827-11') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreSyncModeBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/app/CoreSequentialChordRemapService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/CountInScheduler.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TransportSchedulingService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorTransportRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/ElectronMenuCommandService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/Meter.js') <
  scriptIndex('js/playerViewRenderer.js?v=20260827-11')
);
assert.ok(
  syncClientHtml.indexOf('src="js/core/Meter.js"') <
    syncClientHtml.indexOf('src="js/playerViewRenderer.js')
);
assert.ok(
  syncClientHtml.indexOf('src="js/core/MidiFileParser.js"') <
    syncClientHtml.indexOf('src="js/core/MidiScoreRenderer.js"')
);
assert.ok(
  syncClientHtml.indexOf('src="js/core/Meter.js"') <
    syncClientHtml.indexOf('src="js/sync/mobileTimeline.js')
);
assert.ok(
  scriptIndex('js/editor/EditorNotationService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorLyricsRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorToolbarService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongPersistenceService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/AudioRecoveryService.js') <
    scriptIndex('js/editor/EditorSongInitializationService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongInitializationService.js') <
    scriptIndex('js/editor/EditorSongInitializationControllerService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongInitializationControllerService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/DockablePanelLayoutService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/ArrangerMarkerService.js') <
    scriptIndex('js/editor/EditorHydrationService.js')
);
assert.ok(
  scriptIndex('js/editor/ArrangerMarkerService.js') <
    scriptIndex('js/editor/EditorArrangerMarkerControllerService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorArrangerMarkerControllerService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/ArrangerMarkerService.js') <
    scriptIndex('js/editor/EditorSongTransitionService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongTransitionService.js') <
    scriptIndex('js/editor/ArrangerPlaybackPolicyService.js')
);
assert.ok(
  scriptIndex('js/editor/ArrangerPlaybackPolicyService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/WaveformService.js') <
    scriptIndex('js/core/EditorWaveformBridgeService.js')
);
assert.ok(
  scriptIndex('js/core/EditorWaveformBridgeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorWaveformBridgeService.js') <
    scriptIndex('js/core/EditorMixerService.js')
);
assert.ok(
  scriptIndex('js/core/EditorMixerService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectFileService.js') <
    scriptIndex('js/editor/EditorProjectExportRouteService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectExportRouteService.js') <
    scriptIndex('js/editor/EditorProjectExportService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectExportService.js') <
    scriptIndex('js/editor/EditorProjectExportWorkflowService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectExportWorkflowService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectImportRouteService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectExportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongImportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordImportService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportStateService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportStateService.js') <
    scriptIndex('js/editor/EditorAutoImportRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportUiService.js') <
    scriptIndex('js/editor/EditorAutoImportRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportFileSaveService.js') <
    scriptIndex('js/editor/EditorAutoImportRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportWorkflowService.js') <
    scriptIndex('js/editor/EditorAutoImportRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportRetryService.js') <
    scriptIndex('js/editor/EditorAutoImportRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorRawSongParserService.js') <
    scriptIndex('js/editor/EditorAutoImportRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportRuntimeService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/MidiScoreImportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/MusicXmlScoreImportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/MidiScoreController.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordVersionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorGlobalBindingsService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorCommitService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordStateService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAnchorService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSelectionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordDragService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordInteractionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorTextSelectionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorMutationService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordQuantizeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordCommandService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorShortcutStoreService.js') <
    scriptIndex('js/editor/KeyboardMappingService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportUiService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportFileSaveService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportWorkflowService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAutoImportRetryService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorArrangerSongLoadService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorArrangerHotSwapService.js') <
    scriptIndex('js/editor/EditorArrangerRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorArrangerRuntimeService.js') <
    scriptIndex('js/editor/EditorArrangerControllerService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorArrangerControllerService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorPlaylistBackupService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorToolbarDockService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordCommandService.js') <
    scriptIndex('js/editor/EditorChordModalService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordModalService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorMidiChordService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorTimelineChordEditorService.js') <
    scriptIndex('js/editor/EditorPublicApi.js')
);
assert.ok(
  scriptIndex('js/editor/EditorPublicApi.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorMidiInputService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorMidiConnectionService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorMidiTransportService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAudioStorageService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorTimelineInteractionService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorLyricsChordInteractionService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorPopupTimelineSyncService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAudioStorageRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/LyricPositionMapper.js') <
    scriptIndex('js/editor/EditorRawSongParserService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorRawSongParserService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/KeyboardMappingService.js') <
    scriptIndex('js/editor/EditorKeyboardService.js?v=20260827-11')
);
assert.ok(
  scriptIndex('js/editor/EditorKeyboardService.js?v=20260827-11') <
    scriptIndex('js/editor/EditorKeyboardRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorKeyboardRuntimeService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorKeyboardControllerService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorColorToolService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorKeyCommandService.js') <
    scriptIndex('js/editor/EditorKeyCommandControllerService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorKeyCommandControllerService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorRuntimeAdapter.js') <
    scriptIndex('js/archive/ArchiveRuntimeAdapter.js')
);
assert.ok(
  scriptIndex('js/core/TextEncodingService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveRuntimeAdapter.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveStorageService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveStorageFallbackService.js') <
    scriptIndex('js/archive/ArchiveStorageService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveStorageService.js') <
    scriptIndex('js/archive/ArchiveMigrationService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveMigrationService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveMigrationService.js') <
    scriptIndex('js/archive/ArchiveNormalizationService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveNormalizationService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveNormalizationService.js') <
    scriptIndex('js/archive/ArchiveArtistService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveUndoService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveConfirmService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveProjectPersistenceService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveBatchImportService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveTransferService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveLifecycleService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveSelectionFilterService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveMutationService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistUiService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistImageService.js') <
    scriptIndex('js/archive/ArchiveArtistUiService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveRenderService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveSearchService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveListViewService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveStateService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistCatalogService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveSongLoadService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveReadOnlyService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveMetadataEditService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveProjectAudioRecoveryService.js') <
    scriptIndex('js/archive/ArchiveProjectFileImportService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveProjectFileImportService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchivePublicApi.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/editor/HistoryService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorLifecycleService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/SyncAnalysis.js') <
    scriptIndex('js/editor/EditorSyncAnalysisRuntimeService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSyncAnalysisRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorHydrationService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/SyncModeController.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorRuntimeAdapter.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorSongRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TimelineViewportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TimelineScrollbarsService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TimelinePanelLayoutService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TimelineTrackRendererService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TimelineSectionRendererService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/PlaybackTimelineController.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorSongStateService.js') <
    scriptIndex('js/app/core.js')
);

console.log('Script load-order contract tests passed');
