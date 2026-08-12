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

### `EdCurAdapter`

`EdCurAdapter` فقط compatibility shim است:

```js
EdCurAdapter.getEdCur()             // Song | null
EdCurAdapter.setEdCur(song)         // void
EdCurAdapter.onChange(listener)     // unsubscribe()
EdCurAdapter.rebuildSongDocument()  // SongDocument | null
EdCurAdapter.syncViewStyles()       // void
```

کد جدید نباید مستقیماً `window.edCur` را بخواند یا بنویسد.
این قاعده با `npm run quality:legacy-deps` روی سرویس‌های `js/editor` کنترل می‌شود.

## قرارداد lifecycle و commit

### `EditorSongInitializationService`

```js
await EditorSongInitializationService.initialize({
  getSong: () => Song | null,
  setSong: song => void,
  blankSong: () => Song,
  repairSong: song => Song,
  hydrationService,
  daw,
  syncToolbar: () => void,
  renderEditor: force => void,
  resetHistory: () => void,
  renderAll: () => void,
  saveState: () => void,
  rebuildSongDocument: song => void,
  syncViewStyles: song => void
}) // Song
```

سرویس lifecycle مالک state نیست؛ state را از callbackها می‌گیرد و در پایان
آهنگ نهایی را برمی‌گرداند.

### `EditorCommitService`

```js
const result = service.commit() // boolean
```

در `true` بودن، metadata/sequence، history و performance document به‌ترتیب
همگام می‌شوند. سرویس نباید خودش DOM را render کند.

### `HistoryService`

```js
history.init(context)             // void
history.saveState()               // boolean
history.applyState(serialized)    // boolean
history.undo()                    // boolean
history.redo()                    // boolean
history.reset()                   // void
```

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

## قانون seam

هر تغییر در `setEditorSong`، `EditorRuntimeAdapter`، `EdCurAdapter` یا
`EditorSongInitializationService` باید تست
`js/tests/editor-runtime-seam.test.js` را حفظ کند. تست seam باید نشان دهد که
پس از restore/hydration، reference legacy و runtime adapter به یک object اشاره
می‌کنند.
