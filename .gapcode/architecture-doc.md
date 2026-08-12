# Akordyar — Current Architecture Documentation

**Phase 2/15 — مستندسازی معماری فعلی | 2026-08-09**

---

## وضعیت معتبر فعلی — ۱۲ اوت ۲۰۲۶

این بخش مرجع فعلی معماری است؛ اعداد و مسیرهای قدیمی پایین‌تر، baseline تاریخی هستند.

| مورد | وضعیت فعلی |
|---|---|
| loader | `js/app.js`، loader ترتیبی ۱۱۶ خطی؛ `document.write` فقط compatibility path صریح |
| هستهٔ برنامه | `js/app/core.js`، ۵٬۸۸۹ خط |
| ادیتور | `js/app/editor.js`، ۶٬۷۶۵ خط |
| استخراج‌های جدید | `EditorHydrationService`، `EditorLifecycleService`، `EditorNotationService`، `EditorAnchorService`، `EditorSelectionService`، `EditorChordDragService`، `EditorTextSelectionService`، `EditorChordCommandService`، `EditorKeyCommandService`، `EditorSongStateService`، `EditorChordRenderer`، `EditorChordStateService`، `EventBindings` |
| مالکیت سند فعلی | setter رسمی `setEditorSong` در core و bridge خواندن/نوشتن `EdCurAdapter` |
| رویدادهای HTML | در محدودهٔ فعلی `Akordyar.html` و مسیرهای app/archive/projecthub/search، بدون `onclick`/`onchange`/`oninput` |
| Electron | `contextBridge`، whitelist کانال‌ها، sender/origin validation و validation ورودی IPC |
| تست | `npm test` با ۳۹ ورودی موفق |

### جریان فعلی state

```text
Editor / Archive
    -> setEditorSong / EdCurAdapter
    -> DomainBridge + PerformanceStore برای viewهای performance

Timeline / DAW
    -> RuntimeStateAdapter / EditorRuntimeAdapter
    -> EventBindings و سرویس‌های lifecycle/render

Electron renderer
    -> preload invoke whitelist
    -> registerIpcHandler
    -> sender + origin validation
```

### بدهی‌های باقی‌مانده

- `window.edCur` هنوز compatibility boundary است و باید مصرف مستقیم legacy به‌تدریج کم شود.
- `DAW` و `PERF` از طریق adapter قابل مصرف‌اند، اما مالک تاریخی آن‌ها هنوز core است.
- `DomainBridge` و `PerformanceStore` عمدتاً viewهای performance را پوشش می‌دهند؛ editor/timeline هنوز کاملاً store-driven نیستند.
- بخش‌هایی از editor هنوز handler property داخلی (`element.onclick = ...`) دارند؛ این‌ها با inline attribute فرق دارند و در extraction بعدی به controller منتقل می‌شوند.
- مترونوم ۶/۸ اکنون فقط ضرب اول را accent می‌کند؛ صدای مترونوم از تنظیمات قابل preview است.
- انتخاب لاین، resize عمودی و میانبر `Z` در مرز فعلی core/editor تثبیت شده‌اند و contract test دارند.
- state انتخاب آکورد از طریق `EditorSelectionService` mutation و projection می‌شود؛ مالکیت آرایهٔ legacy همچنان در editor است.
- محاسبات مقصد drag از طریق `EditorChordDragService` انجام می‌شود؛ pointer lifecycle و mutation سند هنوز در editor است.
- ساخت و restore انتخاب متن از طریق `EditorTextSelectionService` انجام می‌شود؛ focus و lifecycle همچنان در wrapper editor کنترل می‌شوند.
- نرمال‌سازی، parse و mutation نام آکورد از طریق `EditorChordCommandService` انجام می‌شود؛ modal، sequence progression و render همچنان در editor باقی مانده‌اند.
- mutationهای تغییر گام، ترنسپوز، تغییر گام اصلی و reset از طریق `EditorKeyCommandService` انجام می‌شود؛ refresh، save و sync تایم‌لاین همچنان orchestration editor است.
- خواندن و mutation محدود state آهنگ در core از طریق `EditorSongStateService` انجام می‌شود؛ quantize، tempo/key detection، timeline grid، popupها، performance tempo، history و audio-save دیگر برای این مسیرها مستقیماً `edCur` را لمس نمی‌کنند.
- direct `edCur` در core اکنون به setter رسمی، sequence legacy و compatibility state ارنجر محدود شده و extraction بعدی باید روی sequence/CL state متمرکز شود.

## 1. Overall Architecture (Layered)

```
Akordyar.html (173 inline onclick handlers)
    |
app.js (14,415 lines)  +  projecthub.js (archive UI)
    |                        |
    |   Editor, Lyrics,      |   Archive CRUD
    |   Chords, Sync,        |   Artist slider
    |   Arranger, Perf,      |   Search, Import/Export
    |   Timeline, Transport, |
    |   Mixer, Rec, MIDI,    |
    |   Settings, Import     |
    |                        |
Performance Bridge (pub-sub glue between edCur and Store)
    |
PerformanceStore (event bus + shared state)
    |
SongDocumentModel  |  SharedEngine (parse, align, transpose, highlight)
    |
Renderers: PlayerView / SingerView / EmbeddedPerformance
    |
Core: Meter | MusicTheory | AudioManager | ProjectStore | FileSystemBridge | AudioFileLoader
    |
Platform: Electron (preload.js + IPC) / Web
```

## 2. Data Flow

### Path A: Editor to Performance Views (implemented, partial)
edCur (app.js global)
  -> rebuildSongDocumentFromEdCur()
  -> SongDocumentModel.buildSongDocumentFromEdCur(edCur)
  -> SharedEngine.processSong(doc)  [parse + align + transpose]
  -> PerformanceStore.setSongDocument(doc)
  -> emit contentUpdated
  -> Renderers re-render

### Path B: Playback to Highlight (implemented)
DAW.transportElapsed
  -> PerformanceStore.setPlaybackState({time, isPlaying})
  -> SharedEngine.computeHighlight(playbackState, songDocument)
  -> PerformanceStore.setHighlightState(hl)
  -> emit highlightChanged
  -> Renderers update highlight

### Path C: Direct DOM Mutation (dominant, legacy)
User action
  -> onclick handler in HTML
  -> function in app.js
  -> read/write edCur directly
  -> edRenderChords() / renderAll() (direct DOM)
  -> manual DOM updates via element.style/textContent

**Problem:** Path C bypasses PerformanceStore entirely.
Most UI updates are direct DOM, not through store->renderer.

## 3. Key Patterns

| Pattern | Description | Status |
|---------|-------------|--------|
| IIFE Modules | songDocumentModel, sharedEngine, performanceStore, renderers | Good |
| window.X Singletons | AudioManager, FileSystemBridge, etc. | Acceptable |
| God Object edCur | 621 refs, 12 manual sync points | Problematic |
| Perf Architecture v2 | Store + Bridge + Renderers (partial) | Emerging |
| Direct DOM | onclick HTML + manual DOM writes | Legacy |

## 4. Perf Architecture v2 Coverage

| Component | Uses Store? | Status |
|-----------|-------------|--------|
| Singer View | Yes (full) | Done |
| Player View | Yes (full) | Done |
| Embedded View | Yes (full) | Done |
| Main Editor | No (direct DOM) | Not migrated |
| Timeline | No (direct DOM) | Not migrated |
| Archive | No (direct DOM) | Not migrated |
| Arranger/Perf | No (direct DOM) | Not migrated |

## 5. Technology Stack

- Vanilla JS (no framework, no build system, no bundler)
- Web Audio API
- IndexedDB (archive, audio blobs, file handles)
- localStorage (settings, state backups)
- Electron contextBridge + IPC
- Plain CSS (10 files)

## 6. Critical Integration Points

1. window.edCur — single source of truth (no access control)
2. rebuildSongDocumentFromEdCur() — edCur to Store bridge
3. syncViewStylesFromEdCur() — per-view settings sync
4. onPerformanceSongChanged() — song change API
5. DOM helper: el = document.getElementById(id)
6. DAW object — audio engine (transport, tracks, clips)
7. PERF object — performance state

## 7. Target Architecture (Desired)

```
Core Domain (Meter, SongDocument, Chord, Key, TimeSignature)
    |
Application Services (SharedEngine, AudioManager)
    |
State Store (PerformanceStore + event bus)
    |
Renderers (Player, Singer, Embedded, Editor, Timeline, Archive)
    |
Platform (DOM / Electron / Web / MIDI / Network)
```

Rule: NO platform layer shall directly access Core Domain.
All state flows through the Store.

## 7. Critical Reality Check

**Operational Source of Truth:** `window.edCur` — all mutations originate here.
**Derived Model:** `SongDocument` — built from edCur via `DomainBridge`, used by Performance views only.
**PerformanceStore:** Shared event/state layer for Singer, Player, Embedded views. Does NOT cover Editor, Timeline, Archive, or Arranger.

**Current Data Flow (mixed):**
```
Performance views:   edCur → DomainBridge → SongDocument → Store → Renderer ✓
Everything else:     onclick → app.js global → edCur mutation → direct DOM  (legacy)
```

**Migration rule:** New modules must NOT directly mutate edCur or DOM.
Legacy code may temporarily violate this until each domain is migrated.

## Current refactor snapshot — ۱۲ اوت ۲۰۲۶

- `js/app.js`: ۱۱۶ خط
- `js/app/core.js`: ۵٬۸۹۳ خط
- `js/app/editor.js`: ۶٬۷۸۷ خط
- `js/core/EditorSongStateService.js`: ۱۹۰ خط
- `npm test`: ۳۹ ورودی موفق

در commit `56d087e`، مسیرهای sync، نقاط sequential و ثبت آکوردهای CL از
`SyncModeController` به `EditorSongStateService` منتقل شدند. کنترلر دیگر
`getEdCur` دریافت نمی‌کند و bridge آن را با `songState` می‌سازد.

باقی‌ماندهٔ مجاز فعلی:

- setter سازگاری `setEditorSong` در core
- فیلد compatibility مربوط به آماده‌سازی Arranger
- بدنهٔ بزرگ editor که هنوز برای render و mutationهای قدیمی به `edCur` متکی است

مرحلهٔ بعد باید روی `EditorSelectionService`/`EditorMutationService` و سپس
`EditorRenderer` متمرکز شود؛ حذف مستقیم `edCur` از این بخش‌ها بدون contract test
برای selection، transpose و lifecycle انجام نشود.

## Snapshot معماری — ۱۲ اوت ۲۰۲۶، پس از موج extraction ادیتور

### مرزهای جدید

- `EditorToolbarService`: metadata/style/key/tempo و lock bindings.
- `EditorSongPersistenceService`: snapshot و persistence سند + DAW.
- `EditorSongInitializationService`: transaction restore/hydration؛ با factory
  تزریقی، wiring initialization یک‌بار ساخته می‌شود و `editor.js` فقط lifecycle
  را اجرا می‌کند.
- `HistoryService`: مالک کامل autosave timer است؛ `core.js` دیگر bridge موازی
  برای timer نگه نمی‌دارد.
- `AudioRecoveryService`: بازیابی صوت در startup، arranger و preload با contract
  callback محور.
- `KeyboardMappingService`: lifecycle موقت یادگیری shortcut و پاک‌سازی listenerها.
- `EditorChordVersionService`: version snapshot و timeline chord clips.
- `EditorGlobalBindingsService`: lifecycle listenerهای resize/Alt/scroll.
- `EditorLyricsRenderer`، `EditorMutationService` و
  `EditorChordInteractionService`: renderer و interactionهای قبلی.

### شمارش واقعی

```text
app.js       116
core.js      5893
editor.js    6342
print.js     197
search.js    195
edCur refs در editor.js  201
edCur refs در core.js      7
npm test     47 test entries passed
```

این وضعیت هنوز hybrid است: مسیرهای جدید callback/adapter محور هستند، اما
orchestration اصلی DOM و command keyboard در `editor.js` باقی مانده است. هدف
مرحلهٔ بعد انتقال popup/keyboard بزرگ و کاهش مستقیم mutationهای `edCur` است؛
حذف compatibility boundary تا زمانی که hot-swap و Electron contract تست نشده‌اند
مجاز نیست.

`EditorCommitService` نیز اکنون مرز commit به History و PerformanceStore را
فراهم می‌کند؛ `edCommit()` فقط wrapper سازگاری است.

## آخرین snapshot عملیاتی — ۱۲ اوت ۲۰۲۶، extraction رندر timeline و popup seam

### extractionهای این موج

- `TimelineTrackRendererService` projection ساخت هدر ترک، lane، selection،
  resize، drag reorder، کنترل mute/solo/lock/transpose و chord-version header
  را از `js/app/core.js` خارج کرد.
- `AudioDropImportService` مسیر drag/drop فایل صوتی، ساخت track، decode،
  linked Electron path و fallback ذخیرهٔ Blob را از orchestration editor جدا کرد.
- `EdCurAdapter` یک مالک canonical برای song نگه می‌دارد و `window.edCur` فقط
  facade سازگاری getter/setter است؛ listener تغییر نیز contract تست دارد.
- `WindowBridge` اکنون get/set/call/dispatch و پاک‌سازی registryهای popup را
  پوشش می‌دهد؛ دسترسی مستقیم popup property و `dispatchEvent` از core/editor
  حذف شد و `SyncModeController` نیز highlight پنجره‌ها را از همین bridge عبور
  می‌دهد.
- contract test قدیمی timeline به محل جدید سرویس منتقل شد و تست seam مستقل برای
  selection سرویس اضافه شد.

### شمارش و کیفیت واقعی

```text
js/app.js       117 خط
js/app/core.js  5662 خط در quality line-budget
js/app/editor.js 6208 خط در quality line-budget
TimelineTrackRendererService.js 535 خط
AudioDropImportService.js       214 خط
npm test         59 ورودی موفق
npm run lint     موفق — 68 فایل
quality:legacy-deps موفق
```

`core.js` و `editor.js` هنوز warning هدف extraction دارند، اما هر دو زیر سقف
سخت ۶۰۰۰ و ۶۵۰۰ خط هستند. مرحلهٔ بعد باید روی hydration/restore و keyboard
seamهای باقی‌مانده تمرکز کند؛ بدنهٔ legacy رندر ترک دیگر در core باقی نمانده است.
