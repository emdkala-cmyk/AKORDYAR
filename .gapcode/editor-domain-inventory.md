# Editor Domain Extraction — Inventory و نقشهٔ Commitها

**تاریخ:** 2026-08-11
**هدف رسمی:** کاهش حداقل ۱٬۰۰۰ خط از `js/app.js` (وضعیت فعلی: ~15٬528 خط)
**مرز:** Lyrics Parser + Chord Sync + Editor State + Editor Rendering + Editor Events
**اصول:** Safe Extraction — state در مالکیت `app.js`/`edCur` می‌ماند، wrapperهای همنام در app.js، هر commit جداگانه تست و ثبت می‌شود.

---

## ۱) نقشهٔ مناطق Editor Domain در app.js

شماره خطوط بر اساس HEAD فعلی (بعد از استخراج ProjectAudioService) است.

| # | بازهٔ خطی | حجم تقریبی | محتوا |
|---|---|---:|---|
| G | 1060–1120 | ~60 | `edGetSelectionState`، `edFlushPendingCommit` |
| D | 2957–3025 | ~70 | `syncChordLineFromLyrics` (در میان بلوک Settings!) |
| C | 3281–4527 | ~1٬250 | پاپ‌اپ‌های Lyric/ChordLine: `openLyricPopup`، `openLyricOnlyPopup`، `syncLyricOnlyPopup`، `openChordLinePopup`، `syncChordLinePopup`، `syncLyricPopup` + highlight/config داخلی + `_pvApply` |
| B | 4528–5026 | ~500 | سیستم Sync: `renderSyncLyrics`، `selectSyncLine`، `syncTap`، `updateSyncHighlight`، `syncTick`، `enterSyncMode`/`exitSyncMode`، `edRemapSeqPoints`، seq chording (`edToggleSeqMode`، `edStartSeqChording`، `edSeqNavigate`)، CL markers (`edClTap` تا `edClApplyMarkers`)، `initSyncUI` |
| F | 7363–7379 | ~20 | `mapChordColumnsToLyricIndices` (callerها در 7537/7565 داخل جریان import) |
| E | 8562–8656 | ~95 | `parseChordLyricText`، `showImportPreview`، `applyImportChords` |
| H | 9364–9596 | ~230 | `edScheduleEditorRefresh`، `edScheduleSave`، `edBlankSong`، `edInitSong` (~210 خط) |
| A | 12735–14233 | ~1٬500 | بدنهٔ اصلی editor: `edSyncToolbar`، `edRenderEditor`، alignment نام آکوردها، `edShiftNote`/`edTransposeChord`، `edRenderChords` (~470 خط)، `edGetLyricsFromDOM`، `edRemapAnchors`، selection (`edSelectChord`، `edClearChordSelection`، `edRestoreSelectionState`)، `edAttachChordDrag`، `edCommit`/`edRestore`، chord modal (`edOpenChordModal`، `edConfirmChord`، `edDeleteChord`)، transpose/key (`applyTranspose`، `applyKeyChange`، `refreshKeyUI`...)، styles (`edBindStyle`، `toggleSizeLock`، palette)، `toggleEditorLock`، `edNavigateChord` + bindingهای `input`/`paste`/`mousedown` روی `#editor` و `#editorWrap` |

**جمع دامنهٔ editor: ~3٬750 خط** — یعنی هدف ۱٬۰۰۰+ خط با حاشیهٔ امن قابل دستیابی است.

## ۲) جزیره‌های غیر-editor (دست نزن — دامنه‌های بعدی)

| بازهٔ خطی | حجم | دامنه |
|---|---:|---|
| 9597–10435 | ~840 | Audio persistence (IndexedDB: blobها، فشرده‌سازی، WebM/WAV) |
| 10436–12710 | ~2٬270 | Archive system (`arch*`، import/export، read-only) |
| 7069–7200 + 8657–8760 | ~240 | Shortcut system + MIDI-learn |
| 14234+ | — | Color tools / quickbar (متعلق به Arranger) |

## ۳) Dependency graph (خلاصهٔ بحرانی)

### state مرکزی
- **`edCur` — 604 رفرنس در کل app.js**؛ بزرگ‌ترین کوپلینگ پروژه. 12 نقطهٔ sync با `window.edCur` (خطوط 1046، 1050، 6476، 8621، 9350، 9392، 10776، 11393، 12221، 12446 و...) که projecthub.js و EdCurAdapter به آن وابسته‌اند.
- `edSeqPoints` (26 رفرنس)، `edChordIdx` (19)، `edPendingAnchor` (8)، `undoStack`/`saveState` (از طریق `edCommit`).

### وابستگی‌های خروجی editor
- `$`، `toast`، `t()`، `saveState`/`undo`، `renderTimeline`/`renderAll`
- `syncTransposeToTimelineChords` → پل به DAW clips (آکوردهای timeline)
- `songDocumentModel`، `EdCurAdapter`، `performanceBridge`، `singerViewRenderer`/`playerViewRenderer` (از طریق `syncUIAfterSongChange` در 6326)
- DOM: `#editor`، `#editorWrap`، `#chord-modal`، `window.open` (پاپ‌اپ‌ها)

### وابستگی‌های ورودی به editor (نقاط شکست ممنوع)
- inline handlerهای Akordyar.html: `edNewSong`، `edOpenArchive`، `edAtPlayhead`، `syncChordLineFromLyrics`
- `ACTION_FUNCTIONS` (خط 14568) و سیستم SHORTCUTS — توابع ed را **با نام** صدا می‌زنند → wrapperهای همنام اجباری‌اند
- جریانهای auto-load/import که `edRenderEditor(true)` را صدا می‌زنند (637، 1075، 6405، 6523، 8650، 9368، 9575، 10874، 12265، 12483، 13428)
- `Alt+Click` و `stopPropagation` در mousedownهای `editorWrap` (13224، 13325)
- رویدادهای `input`/`paste` روی `#editor` (13175، 13202) — remap لنگرها بعد از تغییر متن

### فرصت dedup (مهم)
منطق transpose در app.js **تکراری** است: `keyToSemi`/`ED_SEMITONE` (13792)، `edShiftNote` (12945)، `edTransposeChord` (12966)، `edTransposeKeyName` (13737) — در حالی که `js/core/MusicTheory.js` و `js/core/TransposeService.js` از قبل وجود دارند. در Commit 1 این توابع باید **delegate** شوند، نه کپی.

## ۴) نقشهٔ Commitها (به‌روزشده بر اساس نقشهٔ واقعی)

| Commit | ماژول خروجی | محتوا | کاهش محتمل |
|---|---|---|---:|
| 1 | `js/editor/LyricsParser.js` + `js/editor/ChordLineSyncService.js` | `parseChordLyricText`، `mapChordColumnsToLyricIndices`، `edRemapSeqPoints` (+`lineCharToAbs`/`absToLineChar`)، `edRemapAnchors`، منطق خالص `syncChordLineFromLyrics`، و delegateکردن transpose به TransposeService | 250–450 |
| 2 | `js/editor/SyncModeController.js` | کل ناحیهٔ B: sync lyrics، tap، highlight، tick، enter/exit، seq chording، CL markers، `initSyncUI` | 450–550 |
| 3 | `js/editor/EditorSelectionService.js` + `EditorMutationService.js` | ناحیهٔ G + selection/drag/commit/restore + chord modal از ناحیهٔ A | 600–800 |
| 4 | `js/editor/EditorRenderer.js` + `EditorController.js` | باقی ناحیهٔ A: `edRenderEditor`، `edRenderChords`، toolbar، styles، transpose UI، event bindingها + ناحیهٔ H | 900–1٬200 |
| 5 (اختیاری/جدا) | `js/editor/LyricPopupController.js` | ناحیهٔ C: پاپ‌اپ‌ها — پرریسک‌ترین (window.open + cross-document)؛ آخر از همه | ~1٬250 |
| **جمع (1–4)** | | | **2٬200–3٬000 خط** |

Commitهای 1+2+3 به‌تنهایی از هدف ۱٬۰۰۰ خط عبور می‌کنند.

## ۵) چک‌لیست رفتارهای پنهان (باید در characterization test پوشش داده شود)

- ترتیب RTL/LTR در `edRenderChords` و mapping ستون→حرف (`mapChordColumnsToLyricIndices`)
- `Alt+Click` + `stopPropagation` روی chord itemها و editorWrap
- remap لنگرهای آکورد بعد از ویرایش/پیست متن (`edRemapAnchors`، `edRemapSeqPoints`)
- sync دوطرفهٔ transpose بین editor و timeline chords
- `edCommit` → `saveState` (undo snapshot) قبل از mutation
- حفظ 12 نقطهٔ `window.edCur = edCur`
- نام و امضای توابعی که از `ACTION_FUNCTIONS`/HTML صدا زده می‌شوند

## ۶) قاعدهٔ اجرا

هیچ جابه‌جایی قبل از ثبت commit مربوطه در «گزارش کامل روند» انجام نمی‌شود. هر commit: `node --check` + تست اختصاصی + رگرسیون چهار تست موجود + `git diff --check`.
