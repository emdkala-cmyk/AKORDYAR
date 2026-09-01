#!/usr/bin/env node
const fs = require('fs');

const SHORTCUT_MAP = {
  'برگشت (Undo)': 'scUndo',
  'جلو (Redo)': 'scRedo',
  'پخش / توقف': 'scPlay',
  'روشن/خاموش مترونوم': 'scMetronome',
  'برش در پخشگر': 'scSplit',
  'کپی': 'scCopy',
  'بریدن': 'scCut',
  'چسباندن': 'scPaste',
  'انتخاب همه': 'scSelectAll',
  'کپی + چسباندن': 'scDuplicate',
  'روشن/خاموش حلقه': 'scLoop',
  'شروع حلقه': 'scLoopA',
  'پایان حلقه': 'scLoopB',
  'پنجره تمام\u200Cصفحه': 'scFullscreen',
  'حالت تمرکز': 'scFocusMode',
  'عقب\u200Cرفتن': 'scSeekBack',
  'جلورفتن': 'scSeekFwd',
  'رفتن به ابتدا': 'scGoStart',
  'محدوده loop از selection': 'scSetLoopFromSel',
  'بزرگنمایی افقی (کم)': 'scZoomHOut',
  'بزرگنمایی افقی (زیاد)': 'scZoomHIn',
  'بزرگنمایی عمودی (کم)': 'scZoomVOut',
  'بزرگنمایی عمودی (زیاد)': 'scZoomVIn',
  'بزرگنمایی به انتخاب': 'scZoomToSelection',
  'بزرگنمایی کامل': 'scZoomFull',
  'حالت پخشگر': 'scTogglePlayheadMode',
  'ضبط': 'scToggleRecording',
  'ارتفاع ترک': 'scToggleTrackHeight',
  'پخش با حلقه': 'scLoopPlay',
  'قلمموی رنگ': 'scColorBrush',
  'قطره\u200Cچکان رنگ': 'scColorEyedropper',
};

const SHORTCUT_EN = {
  scUndo: 'Undo', scRedo: 'Redo', scPlay: 'Play / Stop',
  scMetronome: 'Metronome On/Off', scSplit: 'Split',
  scCopy: 'Copy', scCut: 'Cut', scPaste: 'Paste',
  scSelectAll: 'Select All', scDuplicate: 'Duplicate',
  scLoop: 'Loop On/Off', scLoopA: 'Loop Start', scLoopB: 'Loop End',
  scFullscreen: 'Fullscreen', scFocusMode: 'Focus Mode',
  scSeekBack: 'Seek Back', scSeekFwd: 'Seek Forward',
  scGoStart: 'Go to Start', scSetLoopFromSel: 'Set Loop from Selection',
  scZoomHOut: 'Zoom Horizontal Out', scZoomHIn: 'Zoom Horizontal In',
  scZoomVOut: 'Zoom Vertical Out', scZoomVIn: 'Zoom Vertical In',
  scZoomToSelection: 'Zoom to Selection', scZoomFull: 'Zoom Full',
  scTogglePlayheadMode: 'Toggle Playhead Mode',
  scToggleRecording: 'Toggle Recording',
  scToggleTrackHeight: 'Toggle Track Height',
  scLoopPlay: 'Loop + Play',
  scColorBrush: 'Color Brush', scColorEyedropper: 'Color Eyedropper',
};

const SHORTCUT_FA = {
  scUndo: 'برگشت (Undo)', scRedo: 'جلو (Redo)', scPlay: 'پخش / توقف',
  scMetronome: 'روشن/خاموش مترونوم', scSplit: 'برش در پخشگر',
  scCopy: 'کپی', scCut: 'بریدن', scPaste: 'چسباندن',
  scSelectAll: 'انتخاب همه', scDuplicate: 'کپی + چسباندن',
  scLoop: 'روشن/خاموش حلقه', scLoopA: 'شروع حلقه', scLoopB: 'پایان حلقه',
  scFullscreen: 'پنجره تمام\u200Cصفحه', scFocusMode: 'حالت تمرکز',
  scSeekBack: 'عقب\u200Cرفتن', scSeekFwd: 'جلورفتن',
  scGoStart: 'رفتن به ابتدا', scSetLoopFromSel: 'محدوده loop از selection',
  scZoomHOut: 'بزرگنمایی افقی (کم)', scZoomHIn: 'بزرگنمایی افقی (زیاد)',
  scZoomVOut: 'بزرگنمایی عمودی (کم)', scZoomVIn: 'بزرگنمایی عمودی (زیاد)',
  scZoomToSelection: 'بزرگنمایی به انتخاب', scZoomFull: 'بزرگنمایی کامل',
  scTogglePlayheadMode: 'حالت پخشگر',
  scToggleRecording: 'ضبط',
  scToggleTrackHeight: 'ارتفاع ترک',
  scLoopPlay: 'پخش با حلقه',
  scColorBrush: 'قلمموی رنگ', scColorEyedropper: 'قطره\u200Cچکان رنگ',
};

// 1. Replace Persian labels with i18n keys in SHORTCUT_DEFAULTS
let scContent = fs.readFileSync('js/editor/EditorShortcutStoreService.js', 'utf8');
let count = 0;
for (const [fa, key] of Object.entries(SHORTCUT_MAP)) {
  const old = "label: '" + fa + "'";
  const rep = "labelKey: '" + key + "'";
  if (scContent.includes(old)) {
    scContent = scContent.split(old).join(rep);
    count++;
  }
}
fs.writeFileSync('js/editor/EditorShortcutStoreService.js', scContent, 'utf8');
console.log('Shortcuts: ' + count + ' labels replaced');

// 2. Add a helper to get translated label
// Find where shortcuts are rendered in editor.js
let editorContent = fs.readFileSync('js/app/editor.js', 'utf8');

// Replace label lookups: ?.label → ?.labelKey and translate
editorContent = editorContent.replace(
  /const label = SHORTCUT_DEFAULTS\.find\(s => s\.id === funcId\)\?\.label/g,
  "const label = t(SHORTCUT_DEFAULTS.find(s => s.id === funcId)?.labelKey || funcId)"
);
editorContent = editorContent.replace(
  /SHORTCUT_DEFAULTS\.find\(shortcut => shortcut\.id === actionId\)\?\.label/g,
  "t(SHORTCUT_DEFAULTS.find(shortcut => shortcut.id === actionId)?.labelKey || actionId)"
);
fs.writeFileSync('js/app/editor.js', editorContent, 'utf8');
console.log('editor.js: label lookups updated');

// 3. Add keys to i18n
let i18n = fs.readFileSync('js/app/AppI18nService.js', 'utf8');
let added = 0;
for (const [k, v] of Object.entries(SHORTCUT_FA)) {
  if (!i18n.includes(k + ':')) {
    i18n = i18n.replace(/artist: 'خواننده',/, "artist: 'خواننده', " + k + ": '" + v + "', ");
    added++;
  }
}
for (const [k, v] of Object.entries(SHORTCUT_EN)) {
  if (!i18n.includes(k + ':')) {
    i18n = i18n.replace(/artist: 'Artist',/, "artist: 'Artist', " + k + ": '" + v + "', ");
    added++;
  }
}
fs.writeFileSync('js/app/AppI18nService.js', i18n, 'utf8');
console.log('i18n: ' + added + ' shortcut keys added');
