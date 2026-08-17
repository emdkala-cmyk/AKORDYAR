const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const core = read('js/app/core.js');
const editor = read('js/app/editor.js');
const keyboardService = read('js/editor/EditorKeyboardService.js');
const timelineRenderer = read('js/core/TimelineTrackRendererService.js');
const timelineScrollbars = read('js/core/TimelineScrollbarsService.js');
const timelinePanelLayout = read('js/core/TimelinePanelLayoutService.js');
const html = read('Akordyar.html');
const timelineCss = read('styles/timeline.css');

assert.match(core, /selectedTrackId:\s*null/);
assert.match(core, /function selectTrack\(trackId\)/);
assert.match(core, /getTimelineTrackRendererService/);
assert.match(timelineRenderer, /function selectTrack\(trackId\)/);
assert.match(timelineRenderer, /selectTrack\(track\.id\)/);
assert.match(html, /js\/core\/TimelineTrackRendererService\.js/);
assert.doesNotMatch(
  core,
  /h\.addEventListener\('click',\s*\(e\)\s*=>\s*\{[^}]*openChordEditor\(\)/
);
assert.match(core, /let returnToStartOnPause = true/);
assert.match(core, /function previewMetronomeSound/);
assert.match(html, /data-action="previewMetroSound"/);
assert.match(editor, /function toggleSelectedTrackHeight/);
assert.match(editor, /EditorKeyboardService/);
assert.match(keyboardService, /event\.code === 'KeyZ'/);
assert.match(html, /id="timelineHorizontalScrollbar"/);
assert.match(html, /id="timelineVerticalScrollbar"/);
assert.match(html, /id="timelinePanelDragHandle"/);
assert.match(html, /data-timeline-layout-action="toggle-floating"/);
assert.match(editor, /TimelineScrollbarsService/);
assert.match(editor, /TimelinePanelLayoutService/);
assert.match(timelineScrollbars, /function calculateProxyExtent/);
assert.match(timelinePanelLayout, /function handleSeparatorDragStart/);
assert.match(timelinePanelLayout, /function handlePanelDragStart/);
assert.match(core, /app\.style\.gridTemplateRows = `\$\{topRow\} \$\{workspaceRow\} 4px/);
assert.match(timelineCss, /\.track-name\.selected-track/);
assert.match(timelineCss, /\.track-lane\.selected-track/);
assert.match(timelineCss, /\.timeline-bottom-scrollbar/);
assert.match(timelineCss, /\.timeline-vertical-scrollbar/);
assert.match(timelineCss, /\.timeline\.timeline-floating/);

console.log('Timeline interaction contract tests passed');
