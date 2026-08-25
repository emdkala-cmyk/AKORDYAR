/**
 * MidiMonitorService
 *
 * Owns MIDI monitor rendering and the small public MIDI state used by the
 * editor. Legacy global names remain available for classic scripts.
 */
(function attachMidiMonitorService(globalScope) {
  'use strict';

  const NOTE_NAMES = Object.freeze([
    'C', 'C#', 'D', 'D#', 'E', 'F',
    'F#', 'G', 'G#', 'A', 'A#', 'B'
  ]);
  const MIDI_MESSAGE_TYPES = Object.freeze({
    0x80: 'Note Off',
    0x90: 'Note On',
    0xA0: 'Aftertouch',
    0xB0: 'Control',
    0xC0: 'Program',
    0xD0: 'Channel',
    0xE0: 'Pitch',
    0xF0: 'SysEx',
    0xF1: 'MTC',
    0xF8: 'Clock',
    0xFA: 'Start',
    0xFC: 'Stop',
    0xFB: 'Continue',
    0xFE: 'ActiveSense'
  });

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    initialMidiAccess = null,
    logger = console
  } = {}) {
    let midiAccess = initialMidiAccess;
    let autoScroll = true;

    function getMidiAccess() {
      return midiAccess;
    }

    function setMidiAccess(value) {
      midiAccess = value;
      return midiAccess;
    }

    function toggleMidiMonitor() {
      const monitor = getElement('midiMonitor');
      if (!monitor) return false;
      monitor.classList.toggle('show');
      return monitor.classList.contains('show');
    }

    function logMidiMsg(direction, message) {
      const body = getElement('midiMonitorBody');
      const bytes = Array.from(message || []);
      if (!body || bytes.length === 0) return false;

      const status = bytes[0] & 0xF0;
      const channel = bytes[0] & 0x0F;
      const type = MIDI_MESSAGE_TYPES[status] ||
        MIDI_MESSAGE_TYPES[bytes[0]] ||
        'Unknown';
      const hex = bytes
        .map(byte => `0x${byte.toString(16).padStart(2, '0').toUpperCase()}`)
        .join(' ');
      let detail = '';

      if (status === 0x90 && bytes[2] > 0) {
        detail = `${NOTE_NAMES[bytes[1] % 12]}${Math.floor(bytes[1] / 12) - 1} vel:${bytes[2]}`;
      } else if (status === 0x80 || (status === 0x90 && bytes[2] === 0)) {
        detail = `${NOTE_NAMES[bytes[1] % 12]}${Math.floor(bytes[1] / 12) - 1} off`;
      } else if (status === 0xB0) {
        detail = `CC${bytes[1]} val:${bytes[2]}`;
      } else if (status === 0xC0) {
        detail = `prog:${bytes[1]}`;
      } else if (bytes[0] === 0xFA) {
        detail = '▶ START';
      } else if (bytes[0] === 0xFC) {
        detail = '⏹ STOP';
      } else if (bytes[0] === 0xFB) {
        detail = '⏯ CONTINUE';
      } else if (bytes[0] === 0xF8) {
        detail = '⏱ CLOCK';
      }

      const div = documentRef?.createElement?.('div');
      if (!div) return false;
      div.className = 'midi-msg';
      const directionClass = direction === 'IN'
        ? 'in'
        : direction === 'OUT'
          ? 'out'
          : 'sys';
      div.innerHTML =
        `<span class="dir ${directionClass}">${direction}</span>` +
        `<span class="data">${type} ch${channel} ${detail}</span>` +
        `<span class="time">${hex}</span>`;
      body.appendChild(div);

      while (body.children.length > 200) {
        body.removeChild(body.firstChild);
      }
      if (autoScroll) body.scrollTop = body.scrollHeight;
      return true;
    }

    function clearMidiLog() {
      const body = getElement('midiMonitorBody');
      if (!body) return false;
      body.innerHTML = '';
      return true;
    }

    function toggleMidiMonitorAutoScroll() {
      autoScroll = !autoScroll;
      return autoScroll;
    }

    function updateMidiMonitor(message) {
      return logMidiMsg('IN', message);
    }

    function updateMidiMonitorOut(message) {
      return logMidiMsg('OUT', message);
    }

    function updateMidiStatusDot() {
      const dot = getElement('midiStatusDot');
      if (!dot) return false;
      dot.className = `midi-status-dot ${
        getMidiAccess() ? 'connected' : 'disconnected'
      }`;
      return true;
    }

    function updateMidiChordDisplay(name, notes) {
      const info = getElement('midiChordInfo');
      const nameElement = getElement('midiChordName');
      const notesElement = getElement('midiChordNotes');
      if (!info || !nameElement || !name) return false;
      info.style.display = 'block';
      nameElement.textContent = name;
      if (notesElement) notesElement.textContent = notes || '';
      return true;
    }

    return Object.freeze({
      getMidiAccess,
      setMidiAccess,
      getNoteNames: () => NOTE_NAMES,
      toggleMidiMonitor,
      logMidiMsg,
      clearMidiLog,
      toggleMidiMonitorAutoScroll,
      updateMidiMonitor,
      updateMidiMonitorOut,
      updateMidiStatusDot,
      updateMidiChordDisplay
    });
  }

  const service = Object.freeze({
    create,
    noteNames: NOTE_NAMES,
    messageTypes: MIDI_MESSAGE_TYPES
  });

  globalScope.MidiMonitorService = service;

  if (typeof window !== 'undefined') {
    const runtime = create();
    const bindings = [
      'toggleMidiMonitor',
      'logMidiMsg',
      'clearMidiLog',
      'toggleMidiMonitorAutoScroll',
      'updateMidiMonitor',
      'updateMidiMonitorOut',
      'updateMidiStatusDot',
      'updateMidiChordDisplay'
    ];
    bindings.forEach(name => {
      globalScope[name] = runtime[name];
    });
    Object.defineProperty(globalScope, 'midiAccess', {
      configurable: true,
      enumerable: false,
      get: runtime.getMidiAccess,
      set: runtime.setMidiAccess
    });
    Object.defineProperty(globalScope, 'noteNames', {
      configurable: true,
      enumerable: false,
      get: runtime.getNoteNames
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
