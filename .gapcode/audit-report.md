
## Baseline Snapshot � 2026-08-10

| Metric | Value |
|--------|-------|
| app.js lines | 15,755 |
| app.js size | 750 KB |
| Inline onclick handlers | 154 |
| edCur references in app.js | 627 |
| window globals set in app.js | 32 |
| Characterization tests | 139/139 passed |
| Project test files | 5 (characterization-tests.js, test-chord-flats.js, test-shared-engine.js, test-extractLaminorAkordyarLines.js, parser-test.js) |
| js/core modules | 12 (incl. Meter) |
| DomainBridge sync points | 10 (all migrated) |

### Sensitive behaviors (locked by characterization tests)
- [x] RTL/LTR chord alignment � partial coverage
- [x] Undo/Redo stack - behavioral model
- [x] syncTimes / seqPoints - behavioral model
- [x] IndexedDB archive load/save - behavioral model (serialization round-trip)
- [x] Timeline grid (4/4, 3/4, 6/8) � partial (getTimeSignatureGridConfig)
- [x] Manual ChordLine sync - behavioral model (spatial ordering + sync logic)

---

## ممیزی معتبر فعلی — ۱۲ اوت ۲۰۲۶

> اعداد این بخش از فایل‌های موجود در repository استخراج شده‌اند. بخش‌های قدیمی این فایل baseline تاریخی هستند و نباید مبنای تصمیم جدید قرار گیرند.

### snapshot

| شاخص | مقدار |
|---|---:|
| `js/app.js` | ۱۱۶ خط |
| `js/app/core.js` | ۵٬۸۶۳ خط |
| `js/app/editor.js` | ۶٬۷۶۸ خط |
| `js/app/print.js` | ۱۹۷ خط |
| `js/app/search.js` | ۱۹۵ خط |
| `js/editor/EditorAnchorService.js` | ۱۹۷ خط |
| `js/editor/EditorSelectionService.js` | ۶۱ خط |
| `js/editor/EditorChordDragService.js` | ۱۱۶ خط |
| `js/editor/EditorTextSelectionService.js` | ۱۰۷ خط |
| `js/editor/EditorChordCommandService.js` | ۷۲ خط |
| `js/editor/EditorChordRenderer.js` | ۱۵۶ خط |
| `js/editor/EditorChordStateService.js` | ۸۵ خط |
| `js/editor/EditorHydrationService.js` | ۱۷۵ خط |
| `js/editor/EditorLifecycleService.js` | ۱۰۴ خط |
| تست‌های `npm test` | ۳۷ ورودی موفق |
| inline attribute در مسیرهای برنامه | صفر |

### قراردادهای تثبیت‌شده

1. تغییر سند فعلی از `setEditorSong` عبور می‌کند؛ `EdCurAdapter` compatibility bridge رسمی است.
2. مصرف‌کننده‌های archive، projecthub و editor برای DAW/PERF از adapterها استفاده می‌کنند.
3. `EventBindings` رویدادهای delegated را ثبت می‌کند و برای فرم‌ها `input`/`change` را از `click` جدا می‌کند.
4. loader معمولی dynamic است و `document.write` فقط با `data-loader-mode="document-write"` فعال می‌شود.
5. Electron فقط کانال‌های whitelist‌شده را می‌پذیرد و sender پنجره/‌origin را بررسی می‌کند.
6. state انتخاب آکورد از مسیر `EditorSelectionService` عبور می‌کند و wrapperهای legacy حفظ شده‌اند.
7. محاسبات مقصد drag از مسیر `EditorChordDragService` عبور می‌کند و mutation سند در editor باقی مانده است.
8. ساخت و restore Range انتخاب متن از مسیر `EditorTextSelectionService` عبور می‌کند.
9. نرمال‌سازی، parse و mutation نام آکورد از مسیر `EditorChordCommandService` عبور می‌کند؛ orchestration مودال در editor باقی است.

### بدهی‌های قابل پیگیری

- کاهش دسترسی مستقیم legacy به `window.edCur`
- کاهش مصرف مستقیم `DAW` و `PERF` در core/editor و انتقال مالکیت به store/adapter
- انتقال handlerهای property داخلی به controllerهای editor
- تکمیل contract test برای adapterهای باقی‌مانده و همسان‌سازی این فایل با گزارش کامل
- بررسی ادامهٔ extraction محاسبات DOM editor بعد از `EditorAnchorService`
- نگه‌داشتن رفتار ۶/۸ در regression test تا accent ثانویه دوباره برنگردد

---

## به‌روزرسانی معتبر — ۱۲ اوت ۲۰۲۶

### snapshot پس از استخراج فرمان‌های گام و ترنسپوز

| شاخص | مقدار |
|---|---:|
| `js/app.js` | ۱۱۶ خط |
| `js/app/core.js` | ۵٬۸۶۳ خط |
| `js/app/editor.js` | ۶٬۷۶۵ خط |
| `js/editor/EditorKeyCommandService.js` | ۱۶۷ خط |
| تست‌های `npm test` | ۳۸ ورودی موفق |
| inline attribute در مسیرهای برنامه | صفر |

### مرز جدید

`EditorKeyCommandService` فقط mutationهای deterministic مربوط به `transpose`، تغییر گام جاری، تغییر گام اصلی و reset را انجام می‌دهد. editor همچنان مالک `edCur`، render، persistence، نسخهٔ آکورد و sync کلیپ‌های timeline است.

### کنترل

- تست مستقل سرویس و load-order contract موفق.
- `npm test`: هر ۳۸ ورودی موفق.
- `node --check` و `git diff --check`: موفق.
- commit فنی: `6039a81`.

---

## به‌روزرسانی معتبر — ۱۲ اوت ۲۰۲۶

### snapshot پس از کنترل دسترسی state آهنگ در core

| شاخص | مقدار |
|---|---:|
| `js/app.js` | ۱۱۶ خط |
| `js/app/core.js` | ۵٬۸۸۹ خط |
| `js/app/editor.js` | ۶٬۷۶۵ خط |
| `js/core/EditorSongStateService.js` | ۱۴۱ خط |
| تست‌های `npm test` | ۳۹ ورودی موفق |
| inline attribute در مسیرهای برنامه | صفر |

### مرز جدید

`EditorSongStateService` دسترسی callbackمحور به سند جاری، metadata نمایشی، timing، chords، syncTimes، chordLineClips و styleها می‌دهد و mutationهای محدود tempo، key، transpose، highlight و sync را انجام می‌دهد. این سرویس به DOM، `DAW`، `PERF` و `window.edCur` وابسته نیست.

### مسیرهای مهاجرت‌شده

- quantize و timeline grid از timing سرویس استفاده می‌کنند.
- تشخیص tempo/key و تغییر tempo در performance از setterهای سرویس عبور می‌کنند.
- popupهای lyric، chord line و highlight از snapshot/accessor سرویس استفاده می‌کنند.
- History، SyncModeController، arranger و audio blob save برای current song از accessor رسمی استفاده می‌کنند.

### debt باقی‌مانده

- mutationهای `seqPoints` و CL در legacy sequence block هنوز در core/editor باقی مانده‌اند.
- setter رسمی `setEditorSong` و state compatibility ارنجر عمداً حفظ شده‌اند.

### کنترل

- `npm test`: هر ۳۹ ورودی موفق.
- runtime dependency budget، load-order و تست pure سرویس: موفق.
- `node --check` و `git diff --check`: موفق.
- commit فنی: `163806a`.

# Akordyar � Audit Report & Dependency Map

**Phase 1/15 � Audit ???? | 2026-08-09**

---

## 1. File Load Order

1. songDocumentModel.js ? IIFE
2. sharedEngine.js ? IIFE
3. performanceStore.js ? IIFE
4. singerViewRenderer.js ? IIFE
5. playerViewRenderer.js ? IIFE
6. embeddedPerformanceRenderer.js ? IIFE
7. performanceBridge.js ? Module (depends on window.edCur from app.js!)
8-11. core/*.js ? Classes
12. inline script
13-14. laminor importers
15. **app.js � 14,415 lines, 750 KB (621 edCur refs)**
16. projecthub.js � consumer of window.edCur

**Critical:** performanceBridge.js refs window.edCur but loads BEFORE app.js (lazy access pattern).

---

## 2. Window Globals (30+)

**From app.js:** edCur, arrangers, openArrangerModal, closeArrangerModal, createNewArranger, customPrompt, loadAudioFromHardDrive, pathDirname, pathJoin, toggleToolbarDock, getClipFilePath, printSong, onPerformanceSongChanged

**From core/:** AudioManager, AudioFileLoader, FileSystemBridge, ProjectStore

**Standalone:** SongDocumentModel, SharedEngine, PerformanceStore, SingerViewRenderer, PlayerViewRenderer, EmbeddedPerformanceRenderer

---

## 3. edCur: 621 refs in app.js + 23 in other files

**Mutated fields:** title, artist, lyrics, key, keyMode, transpose, originalKey, tempo, timeSignature, chords[], chordLineClips[], syncTimes[], seqPoints[], hasManualChordLineEdits, styles.*, id

**window.edCur sync points:** 12 locations in app.js

---

## 4. app.js Sections (34 domains)

| # | Domain | ~Lines |
|---|--------|--------|
| 1 | Archive System | 1,385 |
| 2 | Song Management | 1,245 |
| 3 | Accidental/Key/Transpose | 1,057 |
| 4 | Auto Import | 975 |
| 5 | Popups (Lyric/Chord) | 960 |
| 6 | Line Colors/Tools | 890 |
| 7 | Timeline Render | 840 |
| 8 | Track/Clip Mgmt | 780 |
| 9 | Arranger | 700 |
| 10 | Editor/Lyrics/Chords | 625 |
| 11 | Audio Dir Handle | 580 |
| 12 | Performance Mode | 570 |
| 13 | Sync Mode | 500 |
| 14 | Init/Interactions | 490 |
| 15 | Project I/O | 310 |
| 16 | Snap/Quantize | 255 |
| 17 | State/Undo/Redo | 250 |
| 18 | Mirror Sync | 250 |
| 19 | Song Save/Load | 250 |
| 20 | MIDI Transport | 240 |
| 21 | Laminor Import | 220 |
| 22 | Chord Editor | 200 |
| 23 | Recording | 200 |
| 24 | Quick Search | 200 |
| 25 | Settings/Themes | 200 |
| 26 | Tempo/Key Detection | 180 |
| 27 | Highlight/Loop | 180 |
| 28 | Audio Import/Load | 145 |
| 29 | MIDI Learn | 140 |
| 30 | MIDI Monitor | 90 |
| 31 | Mixer | 85 |
| 32 | I18N | 80 |
| 33 | Transport | 80 |
| 34 | Shortcuts | 45 |

---

## 5. Key Risks

| Risk | Severity |
|------|----------|
| Monolith app.js (14,415 lines) | CRITICAL |
| edCur God Object (621 refs) | CRITICAL |
| 173 inline event handlers in HTML | HIGH |
| 30+ window globals | HIGH |
| No comprehensive regression suite (scattered tests exist) | HIGH |
| Duplicate functions (renderTimeline x2, lineCharToAbs/absToLineChar x2) | MEDIUM |
| MIDI mixed with DOM | MEDIUM |

---

## 6. Recommended Characterization Tests

1. SongDocument round-trip (build ? writeToEdCur ? build)
2. Chord transpose correctness (C?D, Am?Bm, Bb?C, F#m?G#m)
3. sharedEngine.parseChord (all chord types)
4. sharedEngine.alignChords (RTL positioning)
5. sharedEngine.computeHighlight (cue timing ? active line)
6. PerformanceStore event bus (emit ? subscriber)
7. State serialize/deserialize (edCur ? JSON)
8. Snap to grid (various time sigs + divisions)
9. Time sig grid config (4/4, 6/8, 3/4)
10. Laminor parser (known input ? expected output)
| No comprehensive regression suite (scattered tests exist) | HIGH |
| No comprehensive regression suite (scattered tests exist) | HIGH |

## به‌روزرسانی معتبر — ۱۲ اوت ۲۰۲۶

### مرز state در Sync و Sequential/Chord Line

- `EditorSongStateService` اکنون accessor و mutation رسمی برای `syncTimes`,
  `seqPoints` و chordهای تولیدشده دارد.
- `SyncModeController` دیگر `getEdCur` نمی‌گیرد و مسیرهای sync، undo/redo زمان‌ها،
  sequential chording و CL را از `songState` مصرف می‌کند.
- `core.js` برای ساخت controller فقط `songState` را inject می‌کند.
- نقاط انتخاب sequential در event handler و `edCommit` نیز از setter رسمی سرویس
  عبور می‌کنند.

### کنترل

- `node --check` برای فایل‌های تغییرکرده: موفق.
- تست سرویس state: موفق.
- تست SyncModeController: ۱۵ موفق.
- `npm test`: هر ۳۹ ورودی موفق.
- `git diff --check`: موفق.
- commit فنی: `56d087e`.

### بدهی باقی‌مانده

- `editor.js` هنوز در render، selection، modal و mutationهای عمومی chord مسیرهای
  legacy دارد.
- `setEditorSong` و state compatibility Arranger عمداً برای حفظ load/hot-swap
  نگه داشته شده‌اند.
- `window.edCur` در adapter مرز compatibility است و باید به‌تدریج تنها نقطهٔ
  legacy باقی‌مانده شود.

## به‌روزرسانی معتبر — موج extraction ادیتور، ۱۲ اوت ۲۰۲۶

در این موج، پنج مرز اجرایی جدید اضافه شد:

1. `EditorToolbarService`
2. `EditorSongPersistenceService`
3. `EditorSongInitializationService`
4. `EditorChordVersionService`
5. `EditorGlobalBindingsService`

همراه آن‌ها renderer متن، mutation/interaction آکورد و commandهای key/transpose
در مسیرهای مستقل تست‌پذیر قرار گرفتند. `editor.js` از snapshot قبلی به ۶٬۳۲۶ خط
رسیده است؛ `core.js` برابر ۵٬۸۹۳ خط و `app.js` برابر ۱۱۶ خط است.

کنترل dependency budget اکنون نشان می‌دهد:

- `core.js` فقط ۷ رفرنس `edCur` دارد و مسیرهای عمومی `DAW/PERF` را مستقیم لمس
  نمی‌کند.
- سرویس‌های جدید به `window.edCur`، `DAW` و `PERF` وابسته نیستند.
- listenerهای کوچک global ادیتور یک‌بار ثبت می‌شوند و lifecycle destroy دارند.
- `npm test` شامل ۴۷ ورودی موفق است.

ریسک‌های باقی‌مانده شامل keyboard command بزرگ، popupهای cross-document،
compatibility setter `setEditorSong` و بدنهٔ legacy render/mutation ادیتور است.

آخرین extraction این موج، `EditorCommitService` است که commit/undo orchestration
را callback محور کرده و contract آن تست مستقل دارد. شمارش فعلی `editor.js`
۶٬۳۴۲ خط و suite کامل پس از این مرحله ۴۸ ورودی موفق است.
