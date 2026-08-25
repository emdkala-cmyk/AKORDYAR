/**
 * EditorMidiConnectionService
 *
 * Owns Web MIDI access request and input listener lifecycle.
 * MIDI message interpretation and transport synchronization remain outside.
 */
(function attachEditorMidiConnectionService(globalScope) {
  function create({
    navigatorRef = globalScope.navigator,
    getElement = id => globalScope.document?.getElementById?.(id),
    getMidiAccess = () => null,
    setMidiAccess = () => {},
    getSyncActive = () => false,
    setSyncActive = () => {},
    onMessage = () => {},
    toast = () => {},
    logger = globalScope.console || { error() {} }
  } = {}) {
    function updateSyncUi(active) {
      getElement('tab-midi-sync')?.classList.toggle('active-pink', active);
      const label = getElement('midiSyncLabel');
      if (label) label.textContent = active ? 'ON' : 'OFF';
    }

    async function connect() {
      if (typeof navigatorRef?.requestMIDIAccess !== 'function') {
        toast('MIDI پشتیبانی نمیشه (HTTPS لازمه)');
        return false;
      }

      try {
        const access = await navigatorRef.requestMIDIAccess();
        setMidiAccess(access);
        access?.inputs?.forEach(input => {
          input.onmidimessage = onMessage;
        });
        toast('MIDI وصل شد - پیام‌ها دریافت میشه');
        if (!getSyncActive()) {
          setSyncActive(true);
          updateSyncUi(true);
          toast('همگام‌سازی خودکار فعال شد');
        }
        return true;
      } catch (error) {
        logger.error?.('MIDI Error:', error);
        toast('خطا در اتصال MIDI: ' + (error.message || error));
        return false;
      }
    }

    function disconnect() {
      getMidiAccess()?.inputs?.forEach(input => {
        input.onmidimessage = null;
      });
      setSyncActive(false);
      updateSyncUi(false);
      toast('MIDI قطع شد');
      return true;
    }

    return Object.freeze({ connect, disconnect });
  }

  const service = Object.freeze({ create });
  globalScope.EditorMidiConnectionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
