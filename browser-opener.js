/**
 * browser-opener.js — باز کردن خودکار مرورگر در حالت وب
 *
 * این فایل فقط زمانی استفاده می‌شه که server.js مستقلاً (نه توسط Electron) اجرا بشه.
 * در حالت Electron، این فایل نادیده گرفته می‌شه چون app.isPackaged یا process.versions.electron
 * ست شده است.
 */

const { exec } = require('child_process');

/**
 * باز کردن URL در مرورگر پیش‌فرض سیستم
 * @param {string} url
 */
function openBrowser(url) {
  // اگر داخل Electron اجرا می‌شه، چیزی باز نکن
  if (process.versions && process.versions.electron) {
    return;
  }

  const platform = process.platform;
  let cmd;

  switch (platform) {
    case 'win32':
      cmd = `start "" "${url}"`;
      break;
    case 'darwin':
      cmd = `open "${url}"`;
      break;
    default:
      // Linux / others
      cmd = `xdg-open "${url}"`;
      break;
  }

  exec(cmd, (err) => {
    if (err) {
      console.log(`\x1b[33m[Akordyar]\x1b[0m Could not auto-open browser. Please open manually: ${url}`);
    } else {
      console.log(`\x1b[32m[Akordyar]\x1b[0m Browser opened automatically.`);
    }
  });
}

module.exports = { openBrowser };
