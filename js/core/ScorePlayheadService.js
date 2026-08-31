/**
 * ScorePlayheadService
 *
 * Pure bridge between the Audio-Clock-derived project time and either score
 * representation.  It owns no timer and never reads DOM time; callers provide
 * the current seconds from the transport clock and renderers only consume the
 * resulting tick/score position.
 */
(function attachScorePlayheadService(globalScope) {
  'use strict';

  function number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function beatUnitQuarter(beatUnit) {
    const value = String(beatUnit || 'quarter').toLowerCase();
    if (value === 'whole' || value === 'breve') return 4;
    if (value === 'half') return 2;
    if (value === 'eighth' || value === '8th') return 0.5;
    if (value === '16th' || value === 'sixteenth') return 0.25;
    if (value === '32nd' || value === 'thirty-second') return 0.125;
    return 1;
  }

  function musicXmlTickToSeconds(score, tick) {
    const ppqn = Math.max(1, number(score?.ticksPerQuarter, 480));
    const events = (score?.tempoMap?.events || []).slice()
      .sort((a, b) => number(a.tick) - number(b.tick));
    if (!events.length) return number(tick) / ppqn * 0.5;
    let seconds = 0;
    let previousTick = number(events[0].tick, 0);
    let bpm = Math.max(1, number(events[0].bpm, 120));
    let quarterFactor = beatUnitQuarter(events[0].beatUnit);
    const target = Math.max(0, number(tick, 0));
    events.slice(1).some(event => {
      const eventTick = Math.max(previousTick, number(event.tick, previousTick));
      const delta = Math.min(target, eventTick) - previousTick;
      if (delta > 0) seconds += delta / ppqn * (60 / bpm) / quarterFactor;
      if (target <= eventTick) return true;
      previousTick = eventTick;
      bpm = Math.max(1, number(event.bpm, bpm));
      quarterFactor = beatUnitQuarter(event.beatUnit);
      return false;
    });
    if (target > previousTick) {
      seconds += (target - previousTick) / ppqn * (60 / bpm) / quarterFactor;
    }
    return Math.max(0, seconds);
  }

  function musicXmlSecondsToTick(score, seconds) {
    const ppqn = Math.max(1, number(score?.ticksPerQuarter, 480));
    const events = (score?.tempoMap?.events || []).slice()
      .sort((a, b) => number(a.tick) - number(b.tick));
    const target = Math.max(0, number(seconds, 0));
    if (!events.length) return target / 0.5 * ppqn;
    let tick = Math.max(0, number(events[0].tick, 0));
    let remaining = target;
    let bpm = Math.max(1, number(events[0].bpm, 120));
    let quarterFactor = beatUnitQuarter(events[0].beatUnit);
    for (let index = 1; index < events.length; index += 1) {
      const nextTick = Math.max(tick, number(events[index].tick, tick));
      const segmentSeconds = (nextTick - tick) / ppqn * (60 / bpm) / quarterFactor;
      if (remaining <= segmentSeconds) {
        return tick + remaining / ((60 / bpm) / quarterFactor) * ppqn;
      }
      remaining -= segmentSeconds;
      tick = nextTick;
      bpm = Math.max(1, number(events[index].bpm, bpm));
      quarterFactor = beatUnitQuarter(events[index].beatUnit);
    }
    return tick + remaining / ((60 / bpm) / quarterFactor) * ppqn;
  }

  function scorePpqn(score) {
    const division = score?.division;
    return Math.max(
      1,
      number(
        score?.ticksPerQuarter,
        number(division?.ticksPerQuarter, number(division?.ppqn, 480))
      )
    );
  }

  /**
   * Convert project wall-clock seconds to musical ticks using the current
   * project tempo.  MIDI files carry their own tempo map, but the editor
   * transport is allowed to change `song.tempo` after import.  In that case
   * the live score must follow the project tempo rather than the import-time
   * conversion table.
   */
  function projectSecondsToTick(score, seconds, projectTempo) {
    const bpm = Number(projectTempo);
    if (!(bpm > 0)) return null;
    return Math.max(0, number(seconds, 0)) * bpm / 60 * scorePpqn(score);
  }

  function projectTickToSeconds(score, tick, projectTempo) {
    const bpm = Number(projectTempo);
    if (!(bpm > 0)) return null;
    return Math.max(0, number(tick, 0)) / scorePpqn(score) * 60 / bpm;
  }

  function isMusicXmlScore(score) {
    const format = String(score?.format || '').toLowerCase();
    const mimeType = String(score?.source?.mimeType || '').toLowerCase();
    return format === 'score-partwise' ||
      format === 'score-timewise' ||
      score?.meterMap?.source === 'musicxml' ||
      mimeType.includes('musicxml');
  }

  function create({
    midiScore = null,
    musicXmlScore = null,
    projectTempo = null,
    tempo = null,
    midiModel = globalScope.MidiScoreModel,
    musicXmlModel = globalScope.MusicXmlScoreModel
  } = {}) {
    let midi = midiScore;
    let xml = musicXmlScore;
    let activeProjectTempo = Number(projectTempo ?? tempo);

    function setScores(next = {}) {
      if (Object.prototype.hasOwnProperty.call(next, 'midiScore')) midi = next.midiScore;
      if (Object.prototype.hasOwnProperty.call(next, 'musicXmlScore')) xml = next.musicXmlScore;
      if (
        Object.prototype.hasOwnProperty.call(next, 'projectTempo') ||
        Object.prototype.hasOwnProperty.call(next, 'tempo')
      ) {
        const nextTempo = next.projectTempo ?? next.tempo;
        activeProjectTempo = Number(nextTempo);
      }
      return api;
    }

    function secondsToTickFor(score, seconds) {
      const target = score || midi || xml;
      const projectTick = projectSecondsToTick(target, seconds, activeProjectTempo);
      if (projectTick != null) return projectTick;
      if (target?.conversions?.secondsToTick) {
        return target.conversions.secondsToTick(seconds);
      }
      return isMusicXmlScore(target)
        ? musicXmlSecondsToTick(target, seconds)
        : musicXmlSecondsToTick(xml, seconds);
    }

    function secondsToTick(seconds) {
      return secondsToTickFor(midi || xml, seconds);
    }

    function tickToSecondsFor(score, tick) {
      const target = score || midi || xml;
      const projectSeconds = projectTickToSeconds(target, tick, activeProjectTempo);
      if (projectSeconds != null) return projectSeconds;
      if (target?.conversions?.tickToSeconds) {
        return target.conversions.tickToSeconds(tick);
      }
      return isMusicXmlScore(target)
        ? musicXmlTickToSeconds(target, tick)
        : musicXmlTickToSeconds(xml, tick);
    }

    function tickToSeconds(tick) {
      return tickToSecondsFor(midi || xml, tick);
    }

    function tickToMeasureBeatFor(score, tick, partId) {
      const target = score || midi || xml;
      if (isMusicXmlScore(target) && musicXmlModel?.tickToMeasureBeat) {
        return musicXmlModel.tickToMeasureBeat(target, tick, partId);
      }
      return target?.conversions?.tickToBarBeat
        ? target.conversions.tickToBarBeat(tick)
        : null;
    }

    function tickToMeasureBeat(tick, partId) {
      return tickToMeasureBeatFor(midi || xml, tick, partId);
    }

    function measureBeatToTick(measureIndex, beat, tickInBeat = 0, partId) {
      if (xml && musicXmlModel?.measureBeatToTick) {
        return musicXmlModel.measureBeatToTick(xml, measureIndex, beat, tickInBeat, partId);
      }
      return 0;
    }

    function activeNotes(partId, seconds) {
      const tick = secondsToTick(seconds);
      const notes = xml && musicXmlModel?.getNotes
        ? musicXmlModel.getNotes(xml, partId)
        : midi && midiModel?.getNotes
          ? midiModel.getNotes(midi, partId)
          : [];
      return notes.filter(note => {
        const start = number(note.timing?.startTick, note.startTick);
        const end = number(note.timing?.endTick, note.endTick);
        return !note.rest && tick >= start && tick < end;
      });
    }

    const api = {
      setScores,
      secondsToTick,
      secondsToTickFor,
      tickToSeconds,
      tickToSecondsFor,
      tickToMeasureBeat,
      tickToMeasureBeatFor,
      measureBeatToTick,
      activeNotes
    };
    return Object.freeze(api);
  }

  const api = Object.freeze({
    create,
    musicXmlTickToSeconds,
    musicXmlSecondsToTick,
    projectSecondsToTick,
    projectTickToSeconds
  });
  globalScope.ScorePlayheadService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
