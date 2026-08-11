/**
 * MidiBridge — MIDI architecture placeholder
 * 
 * Target Architecture:
 *   MidiBridge (this file) → PerformanceStore → Renderers
 * 
 * Current State:
 *   MIDI code is mixed into app.js (MIDI Monitor, MIDI Transport,
 *   MIDI Learn/MIDI Map).  For now this file documents the intended
 *   separation; the actual code remains in app.js.
 * 
 * Planned Modules:
 *   1. MidiMonitor.js    — MIDI message logging & monitor UI
 *   2. MidiTransport.js  — MIDI clock sync (MTC, SPP)
 *   3. MidiLearn.js      — MIDI CC → action mapping
 *   4. MidiBridge.js     — unified Web MIDI API access point
 * 
 * Integration Point:
 *   MidiBridge.init() → request MIDIAccess
 *   → dispatch to MidiMonitor / MidiTransport / MidiLearn
 *   → all state changes go through PerformanceStore
 * 
 * Do NOT import or load this file yet.
 * Migrate MIDI code from app.js when ready.
 */

const MidiBridge = (() => {

  let _access = null;
  let _inputs = [];
  let _outputs = [];

  // Placeholder — actual implementation in app.js currently
  function init() {
    if (!navigator.requestMIDIAccess) {
      console.warn('[MidiBridge] Web MIDI API not available');
      return Promise.resolve(null);
    }
    return navigator.requestMIDIAccess()
      .then(function(access) {
        _access = access;
        console.log('[MidiBridge] MIDI access granted');
        return access;
      })
      .catch(function(err) {
        console.warn('[MidiBridge] MIDI access denied:', err);
        return null;
      });
  }

  return {
    init: init
  };

})();

if (typeof window !== 'undefined') {
  window.MidiBridge = MidiBridge;
}
