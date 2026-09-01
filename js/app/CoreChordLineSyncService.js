/*
 * CoreChordLineSyncService
 *
 * Owns the stateful orchestration for copying Lyrics Chord names into the
 * existing Chord Line clips. Pure ordering and mutation stay in
 * ChordLineSyncService.
 */
(function attachCoreChordLineSyncService(globalScope) {
  'use strict';

  function create({
    getSongState = () => null,
    getDAW = () => null,
    getChordLineSyncService = () => globalScope.ChordLineSyncService,
    isPopupOpen = () => false,
    getChordLinePopup = () => null,
    syncChordLinePopup = () => {},
    saveState = () => {},
    renderAll = () => {},
    toast = () => {},
    saveSong = () => {},
    saveCurrentVersion = () => {},
    scheduleAllFromPlayhead = () => {},
    ensureTimelineFits = () => {},
    uid = prefix => `${prefix || 'c'}${Date.now()}`,
    roundMs = value => value,
    colors = ['#9F7AEA'],
    getFileInput = () =>
      globalScope.document?.getElementById?.('chord-line-file-input'),
    parser = globalScope.MidiFileParser,
    chordService = globalScope.EditorMidiChordService?.create?.(),
    navigatorRef = globalScope.navigator,
    logger = console
  } = {}) {
    function requireChordLineSyncService() {
      const service = getChordLineSyncService?.();
      if (!service) {
        throw new Error(
          'ChordLineSyncService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.'
        );
      }
      return service;
    }

    function decodeXmlEntities(value) {
      return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
          String.fromCodePoint(parseInt(hex, 16))
        )
        .replace(/&#([0-9]+);/g, (_, decimal) =>
          String.fromCodePoint(parseInt(decimal, 10))
        );
    }

    function normalizeChordName(value) {
      let name = decodeXmlEntities(value)
        .replace(/[\[\]]/g, '')
        .replace(/\s+/g, '')
        .trim();
      if (!name) return '';
      name = name.replace(/\/[A-Ga-g][#b]?\d*$/, '');
      name = name.replace(/^([A-Ga-g][#b]?)(?:minor|min)$/i, '$1m');
      name = name.replace(/^([A-Ga-g][#b]?)(?:major|maj)$/i, '$1');
      name = name.replace(/^([A-Ga-g][#b]?)min(?=\d|$)/i, '$1m');
      name = name.replace(/^([A-Ga-g][#b]?)maj(?=\d|$)/i, '$1');
      return name.toLowerCase() === 'none' ? '' : name;
    }

    function noteToMidi(value) {
      const pitchClasses = {
        C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4,
        F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9,
        'A#': 10, Bb: 10, B: 11
      };
      const match = String(value || '').trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
      if (!match) return null;
      const pitchClass = pitchClasses[`${match[1].toUpperCase()}${match[2]}`];
      const octave = Number(match[3]);
      return Number.isFinite(pitchClass) && Number.isFinite(octave)
        ? (octave + 1) * 12 + pitchClass
        : null;
    }

    function readXmlTag(block, tagName) {
      const pattern = new RegExp(
        `<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
        'i'
      );
      const match = block.match(pattern);
      if (!match) return null;
      const attributes = {};
      const attributePattern =
        /([A-Za-z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g;
      let attributeMatch;
      while ((attributeMatch = attributePattern.exec(match[1]))) {
        attributes[attributeMatch[1].toLowerCase()] =
          decodeXmlEntities(attributeMatch[2]);
      }
      return {
        attributes,
        value: decodeXmlEntities(match[2])
      };
    }

    function xmlTimeToSeconds(projectTime, tempo) {
      if (!projectTime) return null;
      const value = Number(projectTime.value);
      if (!Number.isFinite(value)) return null;
      const domain = String(projectTime.attributes.domain || 'quarterNotes')
        .toLowerCase()
        .replace(/[\s_-]/g, '');
      if (domain === 'seconds' || domain === 'second') return Math.max(0, value);
      const quarterSeconds = Number(tempo) > 0 ? 60 / Number(tempo) : 0.5;
      return Math.max(0, value * quarterSeconds);
    }

    function parseCubaseChordXml(text, tempo = 120) {
      const blocks = String(text || '').match(
        /<chord\b[^>]*>[\s\S]*?<\/chord>/gi
      ) || [];
      const parsed = blocks.map(block => {
        const projectTime = readXmlTag(block, 'projectTime');
        const rawName = readXmlTag(block, 'name')?.value || '';
        const pitches = (readXmlTag(block, 'pitches')?.value || '')
          .split(/[;\s]+/)
          .map(noteToMidi)
          .filter(note => Number.isFinite(note));
        const identified = chordService?.identifyChord?.(pitches);
        const name = normalizeChordName(
          rawName || chordService?.formatChordName?.(identified) || ''
        );
        return {
          name,
          start: xmlTimeToSeconds(projectTime, tempo)
        };
      }).filter(item => item.name);

      let previousStart = 0;
      parsed.forEach(item => {
        item.start = Number.isFinite(item.start)
          ? Math.max(previousStart, item.start)
          : previousStart;
        previousStart = item.start;
      });
      const quarterSeconds = Number(tempo) > 0 ? 60 / Number(tempo) : 0.5;
      return parsed.map((item, index) => {
        const nextStart = parsed[index + 1]?.start;
        return {
          name: item.name,
          start: item.start,
          duration: Number.isFinite(nextStart)
            ? Math.max(0.03, nextStart - item.start)
            : quarterSeconds * 2
        };
      });
    }

    function projectTempo(score = null) {
      const song = getSongState()?.currentSong?.();
      const scoreTempo =
        score?.tempoMap?.events?.[0]?.bpm ||
        score?.tempoMap?.segments?.[0]?.bpm;
      return Number(scoreTempo || song?.tempo || getDAW()?.tempo || 120) > 0
        ? Number(scoreTempo || song?.tempo || getDAW()?.tempo || 120)
        : 120;
    }

    function selectMidiTrack(score) {
      const tracks = (score?.tracks || []).filter(
        track => Array.isArray(track.notes) && track.notes.length
      );
      if (!tracks.length) return null;
      const chordTrack = tracks.find(track =>
        /(chord|harmony|harmonie|comp)/i.test(
          `${track.name || ''} ${track.instrumentName || ''}`
        )
      );
      return chordTrack || tracks.reduce((longest, track) =>
        track.notes.length > (longest?.notes?.length || 0) ? track : longest,
      tracks[0]);
    }

    function noteStartSeconds(note, score) {
      const direct = Number(note?.startSeconds);
      if (Number.isFinite(direct)) return Math.max(0, direct);
      const tick = Number(note?.startTick);
      if (!Number.isFinite(tick)) return 0;
      if (typeof score?.conversions?.tickToSeconds === 'function') {
        return Math.max(0, score.conversions.tickToSeconds(tick));
      }
      const ticksPerQuarter =
        Number(score?.division?.ticksPerQuarter) || 480;
      return Math.max(0, tick / ticksPerQuarter * (60 / projectTempo(score)));
    }

    function noteEndSeconds(note, score) {
      const direct = Number(note?.endSeconds);
      if (Number.isFinite(direct)) return Math.max(0, direct);
      const tick = Number(note?.endTick);
      if (!Number.isFinite(tick)) return noteStartSeconds(note, score);
      if (typeof score?.conversions?.tickToSeconds === 'function') {
        return Math.max(0, score.conversions.tickToSeconds(tick));
      }
      const ticksPerQuarter =
        Number(score?.division?.ticksPerQuarter) || 480;
      return Math.max(0, tick / ticksPerQuarter * (60 / projectTempo(score)));
    }

    function midiChordEvents(score) {
      const track = selectMidiTrack(score);
      if (!track) return [];

      const notes = [...track.notes]
        .filter(note => Number.isFinite(Number(note?.pitch ?? note?.note)))
        .sort((left, right) => {
          const leftTick = Number(left?.startTick);
          const rightTick = Number(right?.startTick);
          if (Number.isFinite(leftTick) && Number.isFinite(rightTick)) {
            return leftTick - rightTick ||
              Number(left.pitch ?? left.note) - Number(right.pitch ?? right.note);
          }
          return noteStartSeconds(left, score) - noteStartSeconds(right, score);
        });
      const ticksPerQuarter =
        Number(score?.division?.ticksPerQuarter) || 480;
      const clusterWindowTicks = Math.max(1, Math.round(ticksPerQuarter * 0.03));
      const groups = [];

      notes.forEach(note => {
        const startTick = Number(note?.startTick);
        const startSeconds = noteStartSeconds(note, score);
        const previous = groups[groups.length - 1];
        const sameStart = previous && (
          Number.isFinite(startTick) && Number.isFinite(previous.startTick)
            ? Math.abs(startTick - previous.startTick) <= clusterWindowTicks
            : Math.abs(startSeconds - previous.startSeconds) <= 0.03
        );
        if (sameStart) {
          previous.notes.push(note);
          previous.endSeconds = Math.max(
            previous.endSeconds,
            noteEndSeconds(note, score)
          );
          return;
        }
        groups.push({
          startTick,
          startSeconds,
          endSeconds: noteEndSeconds(note, score),
          notes: [note]
        });
      });

      const detected = groups.map(group => {
        const pitches = [
          ...new Set(
            group.notes
              .map(note => Number(note?.pitch ?? note?.note))
              .filter(Number.isFinite)
          )
        ];
        const identified = chordService?.identifyChord?.(pitches);
        const name = normalizeChordName(
          chordService?.formatChordName?.(identified) || ''
        );
        return name && name.toLowerCase() !== 'none'
          ? {
              name,
              start: group.startSeconds,
              end: Math.max(group.startSeconds, group.endSeconds)
            }
          : null;
      }).filter(Boolean);

      const fallbackDuration = (60 / projectTempo(score)) * 2;
      return detected.map((event, index) => {
        const nextStart = detected[index + 1]?.start;
        const end = Number.isFinite(nextStart)
          ? nextStart
          : Math.max(event.end, event.start + fallbackDuration);
        return {
          name: event.name,
          start: event.start,
          duration: Math.max(0.03, end - event.start)
        };
      });
    }

    function replaceChordLine(events) {
      const daw = getDAW();
      const chordTrack = daw?.tracks?.find(track => track.type === 'chord');
      if (!daw || !chordTrack || !Array.isArray(events) || !events.length) {
        return 0;
      }
      if (chordTrack.locked) {
        toast('Chord Line قفل است');
        return 0;
      }

      const importedClips = events
        .map((event, index) => {
          const start = Math.max(0, Number(event?.start) || 0);
          const duration = Math.max(0.03, Number(event?.duration) || 0.03);
          const name = normalizeChordName(event?.name);
          if (!name || name.toLowerCase() === 'none') return null;
          return {
            id: uid('c'),
            type: 'chord',
            trackId: chordTrack.id,
            name,
            start: roundMs(start),
            duration: roundMs(duration),
            color: colors[index % Math.max(1, colors.length)] || '#9F7AEA',
            _chordLineImport: true
          };
        })
        .filter(Boolean);
      if (!importedClips.length) return 0;

      saveState();
      daw.selectedTrackId = chordTrack.id;
      daw.clips = (daw.clips || []).filter(
        clip => !(clip.type === 'chord' && clip.trackId === chordTrack.id)
      );
      daw.clips.push(...importedClips);
      daw.selectedIds = new Set(importedClips.map(clip => clip.id));
      const endTime = importedClips.reduce(
        (end, clip) => Math.max(end, clip.start + clip.duration),
        0
      );
      ensureTimelineFits(endTime + 5);
      saveCurrentVersion();
      saveSong();
      renderAll();
      if (daw.isPlaying) scheduleAllFromPlayhead();
      return importedClips.length;
    }

    function isXmlFile(file) {
      return /\.(?:xml|vstxml|vst-xml)$/i.test(String(file?.name || '')) ||
        /xml/i.test(String(file?.type || ''));
    }

    async function importChordLineFile(file) {
      if (!file) return 0;
      try {
        let events;
        if (isXmlFile(file)) {
          events = parseCubaseChordXml(
            await file.text(),
            projectTempo()
          );
        } else {
          if (typeof parser?.parseFile !== 'function') {
            throw new Error('MidiFileParser is not configured');
          }
          const score = await parser.parseFile(file, {
            includeSource: false,
            fileName: file.name || ''
          });
          events = midiChordEvents(score);
        }
        if (!events.length) {
          toast('هیچ آکورد قابل تشخیصی در فایل پیدا نشد.');
          return 0;
        }
        const count = replaceChordLine(events);
        toast(`✔ ${count} آکورد در Chord Line وارد شد.`);
        return count;
      } catch (error) {
        logger?.error?.('[Chord Line] import failed:', error);
        toast('ورود فایل آکورد انجام نشد.');
        return 0;
      }
    }

    async function importChordLineText(text) {
      try {
        const events = parseCubaseChordXml(text, projectTempo());
        if (!events.length) {
          toast('هیچ آکوردی در XML کیوبیس پیدا نشد.');
          return 0;
        }
        const count = replaceChordLine(events);
        toast(`✔ ${count} آکورد در Chord Line وارد شد.`);
        return count;
      } catch (error) {
        logger?.error?.('[Chord Line] XML import failed:', error);
        toast('XML آکورد معتبر نیست.');
        return 0;
      }
    }

    async function importChordLineClipboard() {
      try {
        const text = await navigatorRef?.clipboard?.readText?.();
        if (!text?.trim()) {
          toast('کلیپ‌بورد خالی است.');
          return 0;
        }
        return importChordLineText(text);
      } catch (error) {
        logger?.warn?.('[Chord Line] clipboard read failed:', error);
        toast('خواندن کلیپ‌بورد ممکن نیست؛ فایل XML را وارد کنید.');
        return 0;
      }
    }

    function openChordLineImporter(mode = 'file', payload = null) {
      if (mode === 'drop') {
        if (payload && typeof payload.arrayBuffer === 'function') {
          importChordLineFile(payload);
        } else if (typeof payload === 'string') {
          importChordLineText(payload);
        }
        return true;
      }
      if (mode === 'clipboard') {
        importChordLineClipboard();
        return true;
      }
      const input = getFileInput();
      if (!input) {
        toast('ورودی فایل Chord Line پیدا نشد.');
        return false;
      }
      input.value = '';
      input.click?.();
      return true;
    }

    async function handleChordLineFileInputChange(event) {
      const input = event?.currentTarget || event?.target;
      const file = input?.files?.[0];
      event?.stopImmediatePropagation?.();
      return file ? importChordLineFile(file) : 0;
    }

    let boundInput = null;
    let boundHandler = null;

    function bindChordLineFileInput(target = getFileInput()) {
      if (!target?.addEventListener || boundInput === target) {
        return boundHandler;
      }
      if (boundInput && boundHandler) {
        boundInput.removeEventListener('change', boundHandler);
      }
      boundInput = target;
      boundHandler = event => handleChordLineFileInputChange(event);
      target.addEventListener('change', boundHandler);
      return boundHandler;
    }

    function unbindChordLineFileInput() {
      if (boundInput && boundHandler) {
        boundInput.removeEventListener('change', boundHandler);
      }
      boundInput = null;
      boundHandler = null;
    }

    function syncChordLineFromLyrics() {
      const songState = getSongState();
      const song = songState?.currentSong?.();
      if (!song) {
        toast('سندی برای سینک وجود ندارد');
        return;
      }

      const lyricsChords = songState.getChords(song);
      if (lyricsChords.length === 0) {
        toast('هیچ آکوردی در Lyrics Chord وجود ندارد.');
        return;
      }

      const chordLineSyncService = requireChordLineSyncService();
      const lyricsChordsInSyncOrder =
        chordLineSyncService.sortLyricsChordsForSync(lyricsChords);
      const daw = getDAW();
      const chordTrack = daw.tracks.find(track => track.type === 'chord');
      const currentChordLineClips = chordTrack
        ? daw.clips
            .filter(
              clip =>
                clip.type === 'chord' && clip.trackId === chordTrack.id
            )
            .sort((a, b) => a.start - b.start)
        : [];

      if (currentChordLineClips.length === 0) {
        toast(
          'برای همگام‌سازی، ابتدا حداقل یک آکورد در Chord Line ایجاد کنید.'
        );
        return;
      }

      const appliedCount = chordLineSyncService.applyChordNamesToClips(
        lyricsChordsInSyncOrder,
        currentChordLineClips
      );
      songState.markChordLineSynced(song);

      if (isPopupOpen(getChordLinePopup())) {
        syncChordLinePopup();
      }

      saveState();
      renderAll();

      if (lyricsChordsInSyncOrder.length > currentChordLineClips.length) {
        toast(
          `فقط ${appliedCount} آکورد اول Lyrics روی ${currentChordLineClips.length} آکورد موجود در Chord Line اعمال شد.`
        );
      } else {
        toast(
          `✔ Chord Line با موفقیت از Lyrics Chord همگام شد (${appliedCount} آکورد).`
        );
      }
    }

    return Object.freeze({
      syncChordLineFromLyrics,
      parseCubaseChordXml,
      midiChordEvents,
      importChordLineFile,
      importChordLineText,
      importChordLineClipboard,
      openChordLineImporter,
      handleChordLineFileInputChange,
      bindChordLineFileInput,
      unbindChordLineFileInput
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreChordLineSyncService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
