# Editor Domain Extraction — Inventory و نقشهٔ Commitها

**تاریخ:** 2026-08-11
**هدف رسمی:** کاهش حداقل ۱٬۰۰۰ خط از `js/app.js` (وضعیت فعلی: ~15٬528 خط)
**مرز:** Lyrics Parser + Chord Sync + Editor State + Editor Rendering + Editor Events
**اصول:** Safe Extraction — state در مالکیت `app.js`/`edCur` می‌ماند، wrapperهای همنام در app.js، هر commit جداگانه تست و ثبت می‌شود.

---

## وضعیت معتبر فعلی — ۱۲ اوت ۲۰۲۶

نقشهٔ زیر نسخهٔ جاری inventory است؛ line rangeهای قدیمی پایین‌تر برای ردیابی تاریخی extraction نگه داشته شده‌اند.

### خروجی‌های انجام‌شده

| خروجی | مسیر | وضعیت |
|---|---|---|
| parser و mapperهای پایه | `js/editor/LyricsParser.js`, `LyricPositionMapper.js` | موجود و تست‌شده |
| sync آکورد/متن | `js/editor/ChordLineSyncService.js` | موجود و تست‌شده |
| sync mode | `js/editor/SyncModeController.js` | موجود و contract test دارد |
| history | `js/editor/HistoryService.js` | موجود؛ autosave bridge تثبیت شده |
| notation | `js/editor/EditorNotationService.js` | استخراج‌شده؛ delegation به `TransposeService` |
| chord renderer | `js/editor/EditorChordRenderer.js` | استخراج‌شده؛ projection callbackمحور با حفظ wrapper legacy |
| chord state | `js/editor/EditorChordStateService.js` | استخراج‌شده؛ mutationهای deterministic برای chords/base names |
| anchor geometry | `js/editor/EditorAnchorService.js` | استخراج‌شده؛ Range، caret و تشخیص anchor با DOM dependency تزریقی |
| selection state | `js/editor/EditorSelectionService.js` | استخراج‌شده؛ انتخاب، toggle، clear و projection کلاس selected |
| drag geometry | `js/editor/EditorChordDragService.js` | استخراج‌شده؛ nearest character، anchor normalization و انتخاب anchor مرجع |
| text selection restore | `js/editor/EditorTextSelectionService.js` | استخراج‌شده؛ mapping offset به Range و restore Selection |
| chord commands | `js/editor/EditorChordCommandService.js` | استخراج‌شده؛ نرمال‌سازی، parse و mutation نام آکورد با callback نام پایه |
| key/transpose commands | `js/editor/EditorKeyCommandService.js` | استخراج‌شده؛ mutation تغییر گام، ترنسپوز، گام اصلی و reset با callbackهای notation/state |
| song state boundary | `js/core/EditorSongStateService.js` | استخراج‌شده؛ accessor و mutation محدود timing، metadata، chords، popup state و تنظیمات song |
| lifecycle | `js/editor/EditorLifecycleService.js` | استخراج‌شده |
| hydration/restore | `js/editor/EditorHydrationService.js` | استخراج‌شده؛ ۱۷۵ خط |
| event binding | `js/core/EventBindings.js` | استخراج‌شده و برای action/form contract تست دارد |

### وضعیت فعلی فایل‌های اصلی

| فایل | خطوط | مرز فعلی |
|---|---:|---|
| `js/app/core.js` | ۵٬۸۸۹ | DAW/runtime glue، timeline، transport و compatibility wrapperها؛ مسیرهای عمومی song state از `EditorSongStateService` |
| `js/app/editor.js` | ۶٬۷۶۵ | render/editor commandها، audio restore و legacy UI glue؛ selection، drag، text restore، chord command و key/transpose mutation از مسیر سرویس |
| `js/app/search.js` | ۱۹۵ | quick search؛ نتیجهٔ داینامیک با `data-command` |

### extraction بعدی با ریسک کنترل‌شده

1. `EditorAudioRestoreService`: مسیرهای restore صدا از editor، با حفظ `EditorRuntimeAdapter`.
2. `TimelineController`: commandهای DAW و render loop با تست load-order.
3. `LyricPopupController`: پاپ‌اپ‌های lyric/chord line پس از تثبیت مرزهای state.

هر مرحله باید قبل از جابه‌جایی، contract test و regression کامل داشته باشد؛ ترتیب scriptهای `Akordyar.html` بدون عبور تست load-order تغییر نمی‌کند.

### آخرین مرحلهٔ ثبت‌شده

- `EditorKeyCommandService` در commit `6039a81` اضافه شد.
- `editor.js` در این مرحله ۳ خط خالص کاهش یافت؛ mutationهای key/transpose از orchestration مربوط به UI، save و timeline جدا شدند.
- `npm test` پس از مرحله ۳۸ ورودی موفق دارد.

## آخرین مرحلهٔ ثبت‌شده — کنترل دسترسی state آهنگ در core

- `EditorSongStateService` در commit `163806a` اضافه شد.
- مسیرهای عمومی core برای timing، quantize، tempo/key detection، popupها، highlight، performance tempo، history و audio-save از accessor رسمی استفاده می‌کنند.
- direct `edCur` در core از مسیرهای عمومی حذف شد؛ sequence/CL legacy و setter سازگاری هنوز برای مرحلهٔ بعد باقی مانده‌اند.
- `core.js` در snapshot فعلی ۵٬۸۸۹ خط و `npm test` برابر ۳۹ ورودی موفق است.

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

## 2026-08-12 — انتقال sync و seq/CL به song state service

### تغییرات

- `EditorSongStateService` به accessorهای `seqPoints` و mutationهای
  `setSyncTime`، `replaceSyncTimes`، `setSeqPoints`، `appendChords` و
  `setChordName` مجهز شد.
- `SyncModeController` از `getEdCur` جدا شد و فقط `songState` دریافت می‌کند.
- `edRemapSeqPoints`، placement نقاط در editor و commitهای sequential از مرز
  رسمی state استفاده می‌کنند.
- رفتار DOM و transport کنترلر حفظ شد و فقط مالکیت mutationهای song state تغییر کرد.

### وضعیت واقعی پس از این مرحله

| فایل | خطوط |
|---|---:|
| `js/app.js` | ۱۱۶ |
| `js/app/core.js` | ۵٬۸۹۳ |
| `js/app/editor.js` | ۶٬۷۸۷ |
| `js/core/EditorSongStateService.js` | ۱۹۰ |
| تست‌های `npm test` | ۳۹ ورودی موفق |

### مرحلهٔ بعد

استخراج selection و mutationهای عمومی chord از `editor.js` در سرویس‌های مستقل؛
سپس انتقال renderer و bindingهای editor با contract test برای RTL، drag، undo و
lifecycle.

### کنترل

- `npm test`: موفق.
- `node --check`: موفق.
- `git diff --check`: موفق.
- commit فنی: `56d087e`.

## آخرین snapshot واقعی — ۱۲ اوت ۲۰۲۶

### extractionهای تکمیل‌شده

| سرویس | مسئولیت |
|---|---|
| `EditorToolbarService` | binding نوار ابزار، style، metadata، key و lock |
| `EditorSongPersistenceService` | snapshot و ذخیرهٔ song/DAW |
| `EditorSongInitializationService` | transaction اولیه و hydration |
| `AudioRecoveryService` | recovery صوت در startup، arranger و preload |
| `EditorChordVersionService` | نسخه‌های آکورد و clip snapshot |
| `EditorGlobalBindingsService` | resize، Alt tracker و scroll lifecycle |
| `EditorLyricsRenderer` | projection متن و آمار چاپ |
| `EditorMutationService` | mutation خالص آکورد و حرکت/حذف |
| `EditorChordInteractionService` | pointer/drag و commit interaction |

### خطوط و تست

```text
js/app.js        116
js/app/core.js   5893
js/app/editor.js 6342
npm test         47 test entries passed
```

### وضعیت مرز legacy

`edCur` در `core.js` به setter رسمی و compatibility state ارنجر محدود شده
است؛ `editor.js` هنوز ۲۰۰ رفرنس دارد، اما مسیرهای toolbar، persistence،
initialization، version و listenerهای کوچک از آن خارج شده‌اند. `DAW` و `PERF`
در سرویس‌های جدید فقط callback/adapter هستند. extraction بعدی باید روی popupهای
cross-document و keyboard command بزرگ تمرکز کند و قبل از حذف compatibility
setter، تست hot-swap و Electron را اضافه کند.

`EditorCommitService` نیز به فهرست مرزهای فعال اضافه شده است؛ این سرویس state
را مالک نمی‌شود و فقط ترتیب commit به History، seq state و Performance bridge
را از طریق callbackها تضمین می‌کند.

## آخرین snapshot واقعی — ۱۲ اوت ۲۰۲۶، پس از extraction timeline/popup

| بخش | مالک فعلی |
|---|---|
| projection هدر ترک و lane | `js/core/TimelineTrackRendererService.js` |
| drag/drop فایل صوتی | `js/editor/AudioDropImportService.js` |
| مالک canonical song و facade `window.edCur` | `js/core/EdCurAdapter.js` |
| popup lifecycle و cross-document property access | `js/core/WindowBridge.js` |

```text
js/app.js        117
js/app/core.js   5662 (line-budget)
js/app/editor.js 6208 (line-budget)
npm test         59 test entries passed
```

در این موج بدنهٔ قدیمی `renderTracks` به‌طور کامل از `core.js` حذف شد؛
wrapperهای `renderTracks`، `selectTrack` و `updateTrackSelectionUI` برای حفظ
نام‌های legacy باقی مانده‌اند و به سرویس جدید delegate می‌کنند. callbackهای
وابسته به `editor.js` lazy هستند تا ترتیب load در وب و Electron تغییر نکند.
