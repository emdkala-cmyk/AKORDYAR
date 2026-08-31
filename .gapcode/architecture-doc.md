# Akordyar — Current Architecture Documentation

**Phase 2/15 — مستندسازی معماری فعلی | 2026-08-09**

---

## وضعیت معتبر فعلی — ۱۲ اوت ۲۰۲۶

این بخش مرجع فعلی معماری است؛ اعداد و مسیرهای قدیمی پایین‌تر، baseline تاریخی هستند.

| مورد | وضعیت فعلی |
|---|---|
| loader | `js/app.js`، loader ترتیبی ۱۲۴ خطی |
| هستهٔ برنامه | `js/app/core.js`، ۱٬۹۰۴ خط |
| ادیتور | `js/app/editor.js`، ۲٬۸۷۷ خط |
| سرویس‌ها | ۲۶۶ فایل production در `js/` (core: 56، editor: 82، app: 73، sync: 7) |
| استخراج‌های جدید | `EditorHydrationService`، `EditorLifecycleService`، `EditorNotationService`، `EditorAnchorService`، `EditorSelectionService`، `EditorChordDragService`، `EditorTextSelectionService`، `EditorChordCommandService`، `EditorKeyCommandService`، `EditorSongStateService`، `EditorChordRenderer`، `EditorChordStateService`، `EventBindings` |
| مالکیت سند فعلی | setter رسمی `setEditorSong` در core و `EditorSongRuntimeService` |
| رویدادهای HTML | در محدودهٔ فعلی `Akordyar.html` و مسیرهای app/archive/projecthub/search |
| Electron | `contextBridge`، whitelist کانال‌ها، sender/origin validation و validation ورودی IPC |
| تست | `npm test` با ۲۴۴ ورودی موفق |

### جریان فعلی state

```text
Editor / Archive
    -> setEditorSong / EditorSongRuntimeService
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

- `DAW` و `PERF` از طریق adapter قابل مصرف‌اند.
- `DomainBridge` و `PerformanceStore` عمدتاً viewهای performance را پوشش می‌دهند.
- مترونوم ۶/۸ اکنون فقط ضرب اول را accent می‌کند؛ صدای مترونوم از تنظیمات قابل preview است.
- انتخاب لاین، resize عمودی و میانبر `Z` در مرز فعلی core/editor تثبیت شده‌اند و contract test دارند.
- state انتخاب آکورد از طریق `EditorSelectionService` mutation و projection می‌شود.
- محاسبات مقصد drag از طریق `EditorChordDragService` انجام می‌شود.
- ساخت و restore انتخاب متن از طریق `EditorTextSelectionService` انجام می‌شود.
- نرمال‌سازی، parse و mutation نام آکورد از طریق `EditorChordCommandService` انجام می‌شود.
- mutationهای تغییر گام، ترنسپوز، تغییر گام اصلی و reset از طریق `EditorKeyCommandService` انجام می‌شود.
- خواندن و mutation محدود state آهنگ در core از طریق `EditorSongStateService` انجام می‌شود.
- حذف کامل `window.edCur` از کد اجرا انجام شده (0 ارجاع باقی‌مانده).

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

## وضعیت فعلی — ۳۱ اوت ۲۰۲۶

- `js/app.js`: ۱۲۴ خط
- `js/app/core.js`: ۱٬۹۰۴ خط
- `js/app/editor.js`: ۲٬۸۷۷ خط
- `js/core/EditorSongStateService.js`: ۱۹۰ خط
- `npm test`: ۲۴۴ ورودی موفق
- `npm run lint`: ۲۱۱ فایل موفق
- `edCur` در editor.js: ۰ ارجاع
- `edCur` در core.js: ۰ ارجاع
- `window.edCur` در کد اجرا: ۰ ارجاع

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

## مراحل تاریخی extraction (بایگانی)

### مرزهای جدید

- `EditorToolbarService`: metadata/style/key/tempo و lock bindings.
- `EditorSongPersistenceService`: snapshot و persistence سند + DAW.
- `EditorSongInitializationService`: transaction restore/hydration؛ با factory
  تزریقی، wiring initialization یک‌بار ساخته می‌شود و `editor.js` فقط lifecycle
  را اجرا می‌کند.
- `EditorSongStateService`: mutationهای محدود lyrics و style/color در مسیر
  رسمی state انجام می‌شوند و orchestrator برای این تغییرات به `edCur` مستقیم
  وابسته نیست.
- `HistoryService`: مالک کامل autosave timer است؛ `core.js` دیگر bridge موازی
  برای timer نگه نمی‌دارد.
- `AudioRecoveryService`: بازیابی صوت در startup، arranger و preload با contract
  callback محور.
- `KeyboardMappingService`: lifecycle موقت یادگیری shortcut و پاک‌سازی listenerها.
- `EditorChordVersionService`: version snapshot و timeline chord clips.
- `EditorGlobalBindingsService`: lifecycle listenerهای resize/Alt/scroll.
- `EditorLyricsRenderer`، `EditorMutationService` و
  `EditorChordInteractionService`: renderer و interactionهای قبلی.

### شمارش واقعی (بایگانی — اوت ۲۰۲۶)

```text
app.js       116
core.js      5893
editor.js    6342
edCur refs در editor.js  201
edCur refs در core.js      7
npm test     47 test entries passed
```

**وضعیت فعلی (۳۱ اوت ۲۰۲۶):** app.js: 124، core.js: 1,904، editor.js: 2,877، edCur: 0، tests: 244

## آخرین snapshot عملیاتی — ۱۲ اوت ۲۰۲۶، extraction رندر timeline و popup seam

### extractionهای این موج

- `TimelineTrackRendererService` projection ساخت هدر ترک، lane، selection،
  resize، drag reorder، کنترل mute/solo/lock/transpose و chord-version header
  را از `js/app/core.js` خارج کرد.
- `AudioDropImportService` مسیر drag/drop فایل صوتی، ساخت track، decode،
  linked Electron path و fallback ذخیرهٔ Blob را از orchestration editor جدا کرد.
- `EditorSongRuntimeService` مالک canonical برای song است و `window.edCur` حذف شده.
- `WindowBridge` اکنون get/set/call/dispatch و پاک‌سازی registryهای popup را
  پوشش می‌دهد؛ دسترسی مستقیم popup property و `dispatchEvent` از core/editor
  حذف شد و `SyncModeController` نیز highlight پنجره‌ها را از همین bridge عبور
  می‌دهد.
- contract test قدیمی timeline به محل جدید سرویس منتقل شد و تست seam مستقل برای
  selection سرویس اضافه شد.

### شمارش و کیفیت واقعی (بایگانی — اوت ۲۰۲۶)

```text
js/app.js       117 خط
js/app/core.js  5662 خط
js/app/editor.js 6208 خط
npm test         59 ورودی موفق
```

**وضعیت فعلی (۳۱ اوت ۲۰۲۶):** core.js: 1,904، editor.js: 2,877، tests: 244، lint: 211 فایل

## آخرین snapshot عملیاتی — ۲۴ اوت ۲۰۲۶، پس از اختیاری‌شدن A/B ارنجر

مرزهای اصلی این موج اکنون شامل موارد زیر هستند:

- `TimelineSectionRendererService`: projection و تعامل sectionهای timeline؛
- `PopupWindowService`: lifecycle مشترک popupها روی `WindowBridge`؛
- `EditorProjectFileService`، `EditorProjectExportRouteService` و
  `EditorProjectImportRouteService`: مسیرهای مستقل فایل پروژه؛
- `EditorLifecycleService` و سرویس‌های state/audio editor: lifecycle و
  restore callbackمحور؛
- `dead-code-contract.test.js`: جلوگیری از بازگشت placeholderهای بدون مصرف.
- `ArrangerMarkerService` و `ArrangerPlaybackPolicyService`: نگهداری مستقل
  `_arrangerMarkers` با فعال‌سازی opt-in از طریق `enabled` و تبدیل A/B هر
  آهنگ به مرز اجرای setlist؛ مهاجرت خودکار از `loopA/loopB` انجام نمی‌شود.
  loop خاموش می‌شود اما `loopA/loopB` دست‌نخورده می‌مانند؛ hot-swap نیز
  origin صوتی AudioContext را همراه A آهنگ جدید دوباره تنظیم می‌کند.

### وضعیت نهایی — ۳۱ اوت ۲۰۲۶

ریفکتور اصلی تکمیل شده است. all quality gates سبز هستند.

```text
js/app.js       ۱۲۴ خط
js/app/core.js  ۱٬۹۰۴ خط (target: 5,600, max: 6,000)
js/app/editor.js ۲٬۸۷۷ خط (target: 6,000, max: 6,500)
تست‌ها         ۲۴۴ ورودی موفق
lint            ۲۱۱ فایل JavaScript موفق
legacy-deps     PASSED (262 فایل)
edCur refs      0 در کل کد اجرا
```

ایمن‌سازی کامل QR و سینک موبایل طبق دامنهٔ تعیین‌شدهٔ کاربر در این موج
دست‌نخورده باقی مانده‌اند.

در حالت پیش‌فرض `arrangerMarkers.enabled` برابر `false` است؛ در این وضعیت
کنترل‌های A/B و overlayهای آن‌ها نمایش داده نمی‌شوند و policy ارنجر کل بازهٔ
زمانی آهنگ را اجرا می‌کند. فعال‌سازی از دکمهٔ مستقل `A/B` در timeline انجام
می‌شود و به state loop شخصی آهنگ وابسته نیست.
