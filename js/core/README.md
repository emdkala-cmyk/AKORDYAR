# معماری صوت و پروژه در آکوردیار

مسیر صوت و پروژهٔ فعال برنامه دیگر بر پایهٔ singletonهای قدیمی نیست. صفحهٔ
اصلی سرویس‌های مدرن را با ترتیب صریح بارگذاری می‌کند و `core.js` فقط
هماهنگی runtime را انجام می‌دهد.

## سرویس‌های فعال

| مسئولیت | سرویس |
| --- | --- |
| ذخیره و بازیابی فایل صوتی | `js/core/ProjectAudioService.js` |
| نگهداری و بازیابی صدای پروژه | `js/editor/EditorAudioStorageService.js` |
| runtime ذخیره و بازیابی صوت | `js/editor/EditorAudioStorageRuntimeService.js` |
| بازیابی صدای پروژه | `js/editor/AudioRecoveryService.js` |
| ورود فایل صوتی و ساخت waveform | `js/app/CoreAudioImportService.js` |
| ذخیرهٔ پروژهٔ editor | `js/editor/EditorSongPersistenceService.js` |
| export/import پروژه | `js/editor/EditorProjectExportWorkflowService.js` |

## مسیر افزودن فایل صوتی

ورود فایل از انتخاب فایل یا drag & drop به `CoreAudioImportService` می‌رسد.
این سرویس از runtime صوتی تزریقی برای ذخیره، decode، ساخت waveform، ثبت
کلیپ و refresh تایم‌لاین استفاده می‌کند. در Electron دسترسی فایل فقط از
`window.electronAPI` و در وب از storage سرویس‌های جدید انجام می‌شود.

## مسیر ذخیره و بارگذاری پروژه

ذخیرهٔ پروژه از `EditorSongPersistenceService` و workflow خروجی پروژه انجام
می‌شود. بارگذاری نیز از مسیر `EditorSongInitializationService` و
`EditorProjectFileService` عبور می‌کند و بازیابی فایل‌های صوتی را
`AudioRecoveryService` انجام می‌دهد.

## وضعیت legacy

ماژول‌های مستقل قدیمی صوت و پروژه از این repository حذف شده‌اند و دیگر API
عمومی مانند `window.FileSystemBridge`، `window.AudioManager`,
`window.AudioFileLoader` یا `window.ProjectStore` تولید نمی‌شود. این نام‌ها
نباید در کد جدید استفاده شوند؛ برای مسیرهای موجود باید سرویس تخصصی مربوط به
جدول بالا تزریق شود.

برای دسترسی Electron، preload همچنان باید قبل از runtime اصلی بارگذاری شود.
URLهای ساخته‌شده با `URL.createObjectURL` نیز باید توسط مالک lifecycle آن‌ها
آزاد شوند.
