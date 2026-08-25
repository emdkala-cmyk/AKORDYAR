/**
 * EditorMidiTransportService
 *
 * Handles MIDI system messages that control transport, MIDI Clock and MTC.
 * Note messages remain in editor.js for MIDI Learn and chord recording.
 */
(function attachEditorMidiTransportService(globalScope) {
  function create({
    getSyncActive = () => false,
    getDAW = () => null,
    seekTransport = () => {},
    startTransport = () => {},
    pauseTransport = () => {},
    getNow = () => globalScope.performance?.now?.() || Date.now(),
    onTempoChange = () => {},
    schedule = globalScope.setTimeout,
    cancel = globalScope.clearTimeout
  } = {}) {
    let midiClockRunning = false;
    let lastClockTime = 0;
    let clockCount = 0;
    let clockDetectTimer = null;
    let clockIntervals = [];
    let midiSyncBPM = 0;

    function handleClock() {
      if (!getSyncActive()) return;
      const now = getNow();

      if (!midiClockRunning) {
        midiClockRunning = true;
        clockIntervals = [];
        clockCount = 0;
        if (!getDAW()?.isPlaying) {
          seekTransport(0, false);
          startTransport();
        }
      }

      if (lastClockTime > 0) {
        const interval = now - lastClockTime;
        if (interval > 5 && interval < 100) {
          clockIntervals.push(interval);
          if (clockIntervals.length > 48) clockIntervals.shift();

          if (clockCount % 24 === 0 && clockIntervals.length >= 12) {
            const average = clockIntervals.reduce((sum, value) => sum + value, 0) /
              clockIntervals.length;
            const beatInterval = average * 24;
            const newBPM = Math.round(60000 / beatInterval);
            if (newBPM >= 20 && newBPM <= 300 && newBPM !== midiSyncBPM) {
              midiSyncBPM = newBPM;
              onTempoChange(newBPM);
            }
          }
        }
      }
      lastClockTime = now;
      clockCount++;

      cancel(clockDetectTimer);
      clockDetectTimer = schedule(() => {
        if (midiClockRunning && getSyncActive()) {
          midiClockRunning = false;
          lastClockTime = 0;
          clockIntervals = [];
          if (getDAW()?.isPlaying) pauseTransport();
        }
      }, 500);
    }

    function handleMessage(data) {
      const status = data?.[0];
      if (status === 0xFA) {
        midiClockRunning = true;
        if (getSyncActive()) {
          seekTransport(0, false);
          if (!getDAW()?.isPlaying) startTransport();
        }
        return true;
      }
      if (status === 0xFC) {
        midiClockRunning = false;
        if (getSyncActive() && getDAW()?.isPlaying) pauseTransport();
        return true;
      }
      if (status === 0xFB) {
        midiClockRunning = true;
        if (getSyncActive() && !getDAW()?.isPlaying) startTransport();
        return true;
      }
      if (status === 0xF8) {
        handleClock();
        return true;
      }
      if (status === 0xF1) return true;
      if (status === 0xF0) {
        if (
          data.length >= 10 &&
          data[1] === 0x7F &&
          data[3] === 0x01 &&
          data[4] === 0x01
        ) {
          const hours = data[5] & 0x1F;
          const minutes = data[6] & 0x3F;
          const seconds = data[7] & 0x3F;
          const frames = data[8] & 0x1F;
          const totalSeconds =
            hours * 3600 + minutes * 60 + seconds + frames / 30;
          if (getSyncActive()) seekTransport(totalSeconds, false);
        }
        return true;
      }
      return false;
    }

    return Object.freeze({ handleMessage });
  }

  const service = Object.freeze({ create });
  globalScope.EditorMidiTransportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
