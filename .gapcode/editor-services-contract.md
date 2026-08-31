# قرارداد سرویس‌های ادیتور و runtime

این فایل مرز رسمی بین سرویس‌های بدون‌دامنه، runtime adapterها و orchestration
قدیمی در `js/app/core.js` و `js/app/editor.js` است. سرویس‌ها نباید DOM، `window.edCur`
یا globalهای `DAW`/`PERF` را به‌عنوان منبع اصلی state مصرف کنند.

## قرارداد مالکیت آهنگ

### `EditorSongRuntimeService`

```js
const service = EditorSongRuntimeService.create({
  getLegacySong: () => Song | null,
  setLegacySong: song => void,
  runtimeAdapter: EditorRuntimeAdapter
});

service.getSong()                  // Song | null
service.setSong(song)              // همان Song
service.assertSynchronized()       // boolean
```

این تنها مسیر رسمی برای تغییر هم‌زمان reference قدیمی و runtime song است.

### `EditorRuntimeAdapter`

```js
adapter.getSong()                  // Song | null
adapter.setSong(song)              // Song
adapter.getDAW()                   // DAW | null
adapter.getDAWOrThrow()            // DAW
adapter.getPERF()                  // PERF | null
adapter.getPERFOrThrow()           // PERF
adapter.getPerformanceStore()      // PerformanceStore | null
```

> **توجه:** `EdCurAdapter` از کد حذف شده و دیگر وجود ندارد.
> `window.edCur` نیز از کد اجرا حذف شده (0 ارجاع باقی‌مانده).
> `EditorSongRuntimeService` مالک رسمی song است.

### `EditorSongStateService`

```js
const state = EditorSongStateService.create({
  getSong: () => Song | null
});

state.getLyrics()                         // string
state.setLyrics(value)                    // boolean
state.getLineColor(index, fallback)       // string | null
state.setLineColor(index, color)          // boolean
state.replaceLineColors(colors)           // boolean
state.clearLineColors()                   // boolean
state.setTextColor(color)                 // boolean
state.setChordColorStyle(color)           // boolean
state.getChordColor(index, fallback)     // string | null
state.setChordColor(index, color)         // boolean
state.colorChordsByLine(colorForLine)     // boolean
state.resetChordColors(color)             // boolean
state.clearChordColors()                  // boolean
```

این API مرز رسمی mutationهای سادهٔ lyrics، رنگ متن و رنگ آکورد است؛
orchestrator نباید برای این تغییرات مستقیماً `song.lyrics`، `song.lineColors`
یا `song.styles` را mutate کند.

## قرارداد lifecycle و commit

### `EditorSongInitializationService`

```js
const initializer = EditorSongInitializationService.create({
  getSong: () => Song | null,
  setSong: song => void,
  blankSong: () => Song,
  repairSong: song => Song,
  hydrationService,
  daw,
  audioRecoveryService: AudioRecoveryService.create({...}),
  syncToolbar: () => void,
  renderEditor: force => void,
  resetHistory: () => void,
  deactivateHistory: () => boolean,
  activateHistory: () => boolean,
  renderAll: () => void,
  saveState: () => void,
  rebuildSongDocument: song => void,
  syncViewStyles: song => void
});

await initializer.initializeEditor() // Song
await initializer.initialize({ storage }) // Song
```

`initialize` همچنان alias سازگار با نسخه‌های قبلی است. سرویس lifecycle مالک state
نیست؛ state را از callbackها می‌گیرد و در پایان آهنگ نهایی را برمی‌گرداند.
ترتیب اتمیک آن چنین است:

```text
deactivateHistory
→ restore/hydrate audio and song
→ render and rebuild derived documents
→ activateHistory
→ saveState (initial snapshot)
```

در طول restore و hydration نباید history یا autosave به state نیمه‌کاره دسترسی
داشته باشد.

`HistoryService` مالک کامل timer مربوط به autosave است؛ orchestration در
`core.js` نباید timer compatibility جداگانه یا callbackهای
`getAutoSaveTimer`/`setAutoSaveTimer` نگه‌داری کند.

### `AudioRecoveryService`

```js
const service = AudioRecoveryService.create({
  getDAW: () => DAW,
  getSong: () => Song | null,
  loadAudioBlobsForProject: async projectId => void,
  getAudioBlobFromDB: async bufferKey => record | null,
  decodeFileToBuffer: async file => ({ buffer, ...meta }),
  loadAudioFromHardDrive: async filePath => AudioBuffer,
  getFileHandle: async bufferKey => FileSystemFileHandle | null,
  getDirHandle: async options => FileSystemDirectoryHandle | null,
  setDirHandle: async handle => void,
  saveDirHandle: async handle => void
});

await service.restoreSongAudio(song, options)
await service.restoreProjectAudio(projectId, silent, options)
await service.preloadAudioForSong(songData, options)
```

این سرویس ترتیب recovery را یک‌دست می‌کند: embedded IndexedDB، مسیر Electron،
Blob و FileHandle ذخیره‌شده، پوشهٔ ذخیره‌شده و در صورت مجاز بودن directory picker.
سرویس به `edCur`، `DAW`، `PERF`، DOM و Electron global دسترسی مستقیم ندارد؛ همهٔ
دسترسی‌ها از callback وارد می‌شوند. `EditorSongInitializationService`، arranger
و preload پس‌زمینه باید از همین contract استفاده کنند تا رفتار بازیابی در startup
و hot-swap دوگانه نشود.

### `EditorSongTransitionService`

```js
const service = EditorSongTransitionService.create({
  getDAW: () => DAW,
  setSong: song => void,
  repairSong: song => Song,
  hydrationService,
  updateNextIdFromClips,
  ensureAudioCtx,
  updateTrackMix,
  restoreAudio: async (projectId, silent) => result
});

service.applyPreparedState({
  song,
  tracks,
  clips,
  sections,
  loopState
}) // { song, audio } | null

await service.loadSong(song, {
  transpose,
  styleDefaults
}) // { song, audio, restoreResult, restoreError } | null
```

این سرویس فقط orchestration تعویض song و آماده‌سازی trackهای صوتی را انجام
می‌دهد. `hotSwapToNextSong` و `loadArrSong` نباید cleanup نودها، hydration،
ساخت panner/gain یا restore audio را به‌صورت موازی پیاده‌سازی کنند. سرویس
نباید DOM، `window.edCur`، `DAW` یا `PERF` global را مستقیماً مصرف کند.

### `EditorProjectExportService`

```js
const service = EditorProjectExportService.create({
  syncMetadata: (song, options) => void,
  encodeAudio: async (buffer, options) => Uint8Array
});

await service.buildBundle({
  song,
  daw,
  onAudioProgress: ({ index, total, clip }) => void
}) // {
   // song, data, defaultName, audioData, audioCount, linkedCount
   // } | null
```

این سرویس snapshot تایم‌لاین، حذف runtime fieldها، embedding فایل‌های
`_embedded` و fallback `float32-b64` را انجام می‌دهد. مسیر انتخاب فایل،
تأیید دانلود، `Blob` و toast همچنان در orchestration رابط کاربری باقی می‌ماند.
سرویس نباید song اصلی را با فیلدهای export mutate کند؛ bundle روی clone ساخته
می‌شود.

### `EditorSongImportService`

```js
const service = EditorSongImportService.create({
  getSong: () => Song | null,
  setSong: song => void,
  createBlankSong: () => Song,
  isValidNote: note => boolean
});

service.applyParsedResult({
  lyrics,
  chords,
  title,
  artist,
  key,
  keyMode,
  timeSignature
}) // { song, chordCount, title } | null
```

این سرویس mutation دامنه‌ی import را انجام می‌دهد: metadata، lyrics، chords،
کلید اصلی، transpose، `baseChordNames` و state مستقل chord-line. حذف clipهای
chord از DAW، save، render و بستن modal جزو orchestration UI هستند و نباید در
سرویس قرار بگیرند.

### `EditorCommitService`

```js
const result = service.commit() // boolean
```

در `true` بودن، metadata/sequence، history و performance document به‌ترتیب
همگام می‌شوند. سرویس نباید خودش DOM را render کند.

### `HistoryService`

```js
history.init(context)             // boolean; context ready, history disabled
history.activate()                // boolean
history.deactivate()              // boolean
history.isHistoryContextReady()   // boolean
history.isEnabled()               // boolean
history.serializeState()          // string | null
history.saveState()               // boolean
history.applyState(serialized)    // boolean
history.undo()                    // boolean
history.redo()                    // boolean
history.reset()                   // void
```

`saveState`، `applyState`، `undo` و `redo` در context ناقص، قبل از فعال‌سازی
یا بدون song معتبر باید بدون exception مقدار `false` برگردانند. `serializeState`
در همین شرایط `null` برمی‌گرداند.

## قرارداد mutation و UI projection

### `EditorMutationService`

توابع pure mutation هستند و نتیجه‌ای با `changed` برمی‌گردانند:

```js
moveChords(song, indices, direction, getLineLength, isRTL)
deleteChords(song, indices)
moveChordsByDelta(song, indices, delta, getLineLength, options)
```

### `EditorChordQuantizeService`

```js
gridStepForPreset(config, preset)   // seconds
quantizeSelectedChords(
  clips,
  selectedIds,
  gridStep,
  { tolerance, round }
) // { changed, count, selectedCount, gridStep }
```

### `EditorToolbarService`

`create(context)` یک facade برای metadata/style controls می‌سازد. متدهای
اصلی `bind()`, `syncToolbar()`, `toggleEditorLock()`, `toggleSizeLock()` و
`syncSizeLocked(id)` هستند؛ سرویس فقط callbackهای تزریق‌شده را اجرا می‌کند.

### `EditorHydrationService`

```js
hydrateSong(song, {
  documentRef,
  daw,
  styleDefaults,
  updateNextIdFromClips,
  initializeAudioTracks
}) // Song
```

وظیفه‌اش normalize/hydrate کردن song و runtime DAW است، نه ذخیره‌سازی یا history.

### `AudioDropImportService`

```js
const service = AudioDropImportService.create({
  getDAW: () => DAW,
  getSong: () => Song | null,
  clearSelection,
  ensureAudioCtx,
  addNewTrack,
  askAudioCopyMode,
  decodeFileToBuffer,
  saveAudioBlobToDB,
  saveAudioBlobsForProject,
  saveState,
  renderAll,
  saveSong
});

service.audioFilesFrom(dataTransfer) // File[]
await service.importFiles(files, event) // boolean
service.bind(target) // unsubscribe()
```

این سرویس مالک state، persistence یا DOM نیست؛ import فایل صوتی را با callbackهای
runtime انجام می‌دهد و مسیر Electron، IndexedDB و linked file را در یک contract
قابل تست نگه می‌دارد.

### `TimelineTrackRendererService`

```js
const service = TimelineTrackRendererService.create(context);

service.renderTracks()                 // void
service.selectTrack(trackId)           // Track | null
service.updateTrackSelectionUI()       // void
```

projection هدر ترک و lane در این سرویس است. mutationهای DAW، chord version،
transport، selection و lifecycle از طریق callbackهای context تزریق می‌شوند؛
`core.js` فقط wrapper سازگاری و orchestration عمومی را نگه می‌دارد.

## قانون seam

هر تغییر در `setEditorSong`، `EditorRuntimeAdapter` یا
`EditorSongInitializationService` باید تست
`js/tests/editor-runtime-seam.test.js` را حفظ کند. تست seam باید نشان دهد که
پس از restore/hydration، reference legacy و runtime adapter به یک object اشاره
می‌کنند.

## قرارداد keyboard و popup

### `EditorKeyboardService`

```js
const service = EditorKeyboardService.create({
  isChordModalOpen,
  hasSelectedChords,
  getDAW,
  getShortcutMatch,
  onQuantizeSelectedChords,
  onMoveSelectedChords,
  onDeleteSelectedChords,
  onTogglePlay,
  onToggleSelectedTrackHeight
});

service.handleKeydown(event)                 // boolean
service.handleGlobalKeydownCapture(event)    // boolean
service.handleGlobalKeydown(event)           // boolean
service.handleGlobalKeyup(event)             // boolean
service.handleAuxiliaryKeydown(event)        // boolean
```

ثبت listenerهای عمومی فقط از `EventBindings` انجام می‌شود. `editor.js` فقط
wrapperهای سازگار و callbackهای command را inject می‌کند. `SyncModeController`
نباید برای `Ctrl+Space` listener مستقل ثبت کند.

### `EventBindings`

```js
new EventBindings({
  actions,
  onGlobalKeydownCapture,
  onGlobalKeydown,
  onGlobalKeyup,
  onGlobalDocumentKeydown,
  onGlobalMousedownCapture
}).init()
```

هر listener باید از `destroy()` قابل حذف باشد. mappingهای موقت MIDI/keyboard
می‌توانند listener scoped خودشان را داشته باشند، اما نباید به binding عمومی
تبدیل شوند.

### `KeyboardMappingService`

```js
const service = KeyboardMappingService.create({
  documentRef,
  getLabel: actionId => string,
  saveShortcut: (actionId, shortcut) => void,
  formatKeyName: code => string,
  toast: message => void
});

service.start(actionId, element)       // boolean
service.cancel()                       // void
service.finish(info)                   // void
service.isActive()                     // boolean
service.getTarget()                    // string | null
service.destroy()                      // void
```

این سرویس فقط lifecycle حالت «یادگیری کلید» را مدیریت می‌کند. listenerهای موقت
`keydown` و `mousedown` با `start()` ثبت و در `cancel()`، `finish()` یا
`destroy()` هر دو حذف می‌شوند. ذخیرهٔ `SHORTCUTS` و نمایش UI از طریق callback
تزریق می‌شود؛ سرویس نباید مستقیماً state ادیتور، `edCur` یا actionهای برنامه را
مصرف کند.

### `WindowBridge`

```js
WindowBridge.open({ windowRef, url, name, features })
WindowBridge.isOpen(popup)
WindowBridge.getDocument(popup)
WindowBridge.focus(popup)
WindowBridge.close(popup)
WindowBridge.onMessage({ windowRef, getSource, type, origin, handler })
WindowBridge.postMessage(popup, payload, targetOrigin)
WindowBridge.get(popup, property)
WindowBridge.set(popup, property, value)
WindowBridge.call(popup, method, ...args)
WindowBridge.dispatch(popup, event)
WindowBridge.clearManagedNodes(popup, registryNames)
```

پیام‌های popup باید نوع و منبع پنجره را بررسی کنند. دسترسی مستقیم به
`popup.document`، propertyهای داخلی، `dispatchEvent` و handlerهای cross-document
نباید در مسیرهای جدید استفاده شوند؛ مسیرهای runtime فعلی از `WindowBridge`
مصرف می‌کنند و فقط خود bridge محل compatibility مستقیم است.

## قرارداد DAW/PERF

### `DAWRuntimeAdapter` و `PerformanceRuntimeAdapter`

```js
const daw = DAWRuntimeAdapter.create(DAW);
daw.getState();
daw.read(key);
daw.write(key, value);
daw.update(values);

const perf = PerformanceRuntimeAdapter.create(PERF);
perf.getState();
perf.read(key);
perf.write(key, value);
perf.update(values);
```

`RuntimeStateAdapter.getDAWAdapter()` و `getPERFAdapter()` تنها gateway سرویس‌های
جدید به این compatibility stateها هستند. مالکیت mutationهای audio/transport
فعلاً در `core.js` می‌ماند تا extraction بعدی بدون تغییر رفتار انجام شود.

## قانون migration

- کد جدید در `js/editor` نباید `window.edCur`، `DAW` یا `PERF` را مستقیم بخواند.
- تغییر song باید از `EditorSongRuntimeService` یا `setEditorSong` عبور کند.
- حذف `RuntimeStateAdapter` یا fallbackهای popup فقط بعد از
  عبور تست‌های seam، load-order و Electron مجاز است.
