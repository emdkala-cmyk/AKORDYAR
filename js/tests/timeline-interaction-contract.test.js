const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const core = read('js/app/core.js');
const corePanelLayout = read('js/app/CorePanelLayoutService.js');
const coreTimelineRenderer = read('js/app/CoreTimelineRendererService.js');
const coreClipInteraction = read('js/app/CoreClipInteractionService.js');
const dawState = read('js/core/DAWRuntimeState.js');
const transportState = read('js/core/EditorTransportStateService.js');
const editor = read('js/app/editor.js');
const keyboardService = read('js/editor/EditorKeyboardService.js');
const timelineRenderer = read('js/core/TimelineTrackRendererService.js');
const sectionRenderer = read('js/core/TimelineSectionRendererService.js');
const playbackTimelineController = read('js/core/PlaybackTimelineController.js');
const timelineScrollbars = read('js/core/TimelineScrollbarsService.js');
const timelinePanelLayout = read('js/core/TimelinePanelLayoutService.js');
const dockablePanelLayout = read('js/core/DockablePanelLayoutService.js');
const html = read('Akordyar.html');
const layoutCss = read('styles/layout.css');
const timelineCss = read('styles/timeline.css');

assert.match(dawState, /selectedTrackId:\s*null/);
assert.match(coreTimelineRenderer, /function selectTrack\(trackId\)/);
assert.match(coreTimelineRenderer, /getTimelineTrackRendererService/);
assert.match(core, /CoreTimelineRendererService/);
assert.match(timelineRenderer, /function selectTrack\(trackId\)/);
assert.match(timelineRenderer, /selectTrack\(track\.id\)/);
assert.match(html, /js\/core\/TimelineTrackRendererService\.js/);
assert.doesNotMatch(
  core,
  /h\.addEventListener\('click',\s*\(e\)\s*=>\s*\{[^}]*openChordEditor\(\)/
);
assert.match(core, /EditorTransportStateService\.create\(\)/);
assert.match(transportState, /returnToStartOnPause:\s*true/);
assert.match(core, /function previewMetronomeSound/);
assert.match(html, /data-action="previewMetroSound"/);
assert.match(editor, /function toggleSelectedTrackHeight/);
assert.match(editor, /item\.id === track\.id \? expandedHeight : MIN_LANE_HEIGHT/);
assert.match(editor, /renderAll\(\{ preserveWaveforms: true \}\)/);
assert.match(core, /scheduleAheadTime: 1\.5/);
assert.match(core, /PlaybackTimelineController/);
assert.match(playbackTimelineController, /translate3d/);
assert.doesNotMatch(playbackTimelineController, /\.style\.left/);
assert.match(core, /function renderAll\(options = \{\}\)/);
assert.match(core, /function renderClips\(options = \{\}\)/);
assert.match(core, /preserveWaveforms/);
assert.match(editor, /EditorKeyboardService/);
assert.match(keyboardService, /event\.code === 'KeyZ'/);
assert.match(html, /id="timelineHorizontalScrollbar"/);
assert.match(html, /id="timelineVerticalScrollbar"/);
assert.match(html, /id="timelinePanelDragHandle"/);
assert.match(html, /id="timelineCloseBtn"/);
assert.match(html, /id="timelineRestoreBtn"/);
assert.match(html, /data-timeline-layout-action="toggle-floating"/);
assert.match(html, /id="projectPanel"/);
assert.match(html, /id="songPropertiesPanel"/);
assert.match(html, /id="projectPanelDragHandle"/);
assert.match(html, /id="songPropertiesPanelDragHandle"/);
assert.match(html, /id="projectPanelRestoreBtn"/);
assert.match(html, /id="songPropertiesPanelRestoreBtn"/);
assert.match(editor, /TimelineScrollbarsService/);
assert.match(editor, /TimelinePanelLayoutService/);
assert.match(corePanelLayout, /function initDockableSidePanels\(\)/);
assert.match(core, /CorePanelLayoutService/);
assert.match(corePanelLayout, /projectPanelLayout/);
assert.match(corePanelLayout, /songPropertiesPanelLayout/);
assert.match(editor, /function paintTimelineItemAtPoint\(clientX, clientY\)/);
assert.match(editor, /function getTimelineItemAtPoint\(clientX, clientY\)/);
assert.match(editor, /function beginTimelineBrushDrag\(event\)/);
assert.match(editor, /elementFromPoint\?\.\(clientX, clientY\)/);
assert.match(editor, /getBoundingClientRect\(\)/);
assert.match(editor, /timeline-color-dragging/);
assert.match(timelineScrollbars, /function calculateProxyExtent/);
assert.match(timelinePanelLayout, /function handleSeparatorDragStart/);
assert.match(timelinePanelLayout, /appBottom - moveEvent\.clientY/);
assert.match(timelinePanelLayout, /function handlePanelDragStart/);
assert.match(timelinePanelLayout, /function toggleClosed\(\)/);
assert.match(timelinePanelLayout, /function openPanel\(\)/);
assert.match(timelineRenderer, /trackId: track\.id/);
assert.match(timelineRenderer, /x0: marqueePoint\.x/);
assert.match(timelineRenderer, /y0: marqueePoint\.y/);
assert.match(sectionRenderer, /function renderSections\(\)/);
assert.match(sectionRenderer, /section-tag/);
assert.match(sectionRenderer, /selectedSectionIds/);
assert.match(sectionRenderer, /resize-handle left/);
assert.match(sectionRenderer, /resize-handle right/);
assert.match(core, /CoreClipInteractionService/);
assert.match(
  coreClipInteraction,
  /function getMarqueeLaneElements\(selector\)/
);
assert.match(coreClipInteraction, /getMarqueeLaneElements\('\.clip'\)/);
assert.match(
  coreClipInteraction,
  /getMarqueeLaneElements\('\.section-tag'\)/
);
assert.doesNotMatch(core, /function getMarqueeLaneElements\(selector\)/);
assert.match(core, /function openTimelineChordEditor\(clipId\)/);
assert.match(
  corePanelLayout,
  /app\.style\.gridTemplateRows =\s*`auto minmax\(0, 1fr\) 4px/
);
assert.match(timelineCss, /\.track-name\.selected-track/);
assert.match(timelineCss, /\.track-lane\.selected-track/);
assert.match(timelineCss, /\.timeline-bottom-scrollbar/);
assert.match(timelineCss, /\.timeline-vertical-scrollbar/);
assert.match(timelineCss, /\.timeline\.timeline-floating/);
assert.match(dockablePanelLayout, /function handlePanelDragStart/);
assert.match(dockablePanelLayout, /function toggleMaximized/);
assert.match(layoutCss, /\.side-panel-content/);
assert.match(layoutCss, /\.side-panel-floating/);
assert.match(layoutCss, /height: 100dvh/);
assert.match(timelineCss, /\.timeline \{ grid-area: timeline; padding: 6px 10px 0/);
assert.match(timelineCss, /will-change: transform/);

console.log('Timeline interaction contract tests passed');
