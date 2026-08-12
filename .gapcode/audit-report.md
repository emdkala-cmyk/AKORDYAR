
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
| `js/app/editor.js` | ۶٬۷۰۰ خط |
| `js/app/print.js` | ۱۹۷ خط |
| `js/app/search.js` | ۱۹۵ خط |
| `js/editor/EditorAnchorService.js` | ۱۹۷ خط |
| `js/editor/EditorSelectionService.js` | ۶۱ خط |
| `js/editor/EditorChordRenderer.js` | ۱۵۶ خط |
| `js/editor/EditorChordStateService.js` | ۸۵ خط |
| `js/editor/EditorHydrationService.js` | ۱۷۵ خط |
| `js/editor/EditorLifecycleService.js` | ۱۰۴ خط |
| تست‌های `npm test` | ۳۴ ورودی موفق |
| inline attribute در مسیرهای برنامه | صفر |

### قراردادهای تثبیت‌شده

1. تغییر سند فعلی از `setEditorSong` عبور می‌کند؛ `EdCurAdapter` compatibility bridge رسمی است.
2. مصرف‌کننده‌های archive، projecthub و editor برای DAW/PERF از adapterها استفاده می‌کنند.
3. `EventBindings` رویدادهای delegated را ثبت می‌کند و برای فرم‌ها `input`/`change` را از `click` جدا می‌کند.
4. loader معمولی dynamic است و `document.write` فقط با `data-loader-mode="document-write"` فعال می‌شود.
5. Electron فقط کانال‌های whitelist‌شده را می‌پذیرد و sender پنجره/‌origin را بررسی می‌کند.
6. state انتخاب آکورد از مسیر `EditorSelectionService` عبور می‌کند و wrapperهای legacy حفظ شده‌اند.

### بدهی‌های قابل پیگیری

- کاهش دسترسی مستقیم legacy به `window.edCur`
- کاهش مصرف مستقیم `DAW` و `PERF` در core/editor و انتقال مالکیت به store/adapter
- انتقال handlerهای property داخلی به controllerهای editor
- تکمیل contract test برای adapterهای باقی‌مانده و همسان‌سازی این فایل با گزارش کامل
- بررسی ادامهٔ extraction محاسبات DOM editor بعد از `EditorAnchorService`
- نگه‌داشتن رفتار ۶/۸ در regression test تا accent ثانویه دوباره برنگردد

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
