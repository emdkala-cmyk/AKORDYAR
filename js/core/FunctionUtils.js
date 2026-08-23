/**
 * ابزارهای عمومی بدون وابستگی به منطق DAW.
 *
 * این سرویس عمداً DOM و state برنامه را نمی‌شناسد؛ مصرف‌کننده‌ها فقط callback
 * و دادهٔ خودشان را به آن می‌دهند.
 */
(function publishAkordyarFunctionUtils(globalScope) {
  if (globalScope.AkordyarFunctionUtils) return;

  function rafThrottle(fn) {
    let scheduled = false;
    let lastArgs = null;
    return function throttled(...args) {
      lastArgs = args;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        fn.apply(this, lastArgs);
      });
    };
  }

  function debounce(fn, delay = 200) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function arrayShallowEqual(a = [], b = []) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function safeText(value) {
    return value == null ? '' : String(value);
  }

  function buildDoneKey(times = [], time = 0, activeLine = -1) {
    let key = '';
    for (let i = 0; i < times.length; i += 1) {
      const lineTime = times[i];
      if (Number.isFinite(lineTime) && lineTime < time && i !== activeLine) {
        key += i + '|';
      }
    }
    return key;
  }

  globalScope.AkordyarFunctionUtils = {
    rafThrottle,
    debounce,
    arrayShallowEqual,
    safeText,
    buildDoneKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
