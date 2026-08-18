/**
 * ScorePlayheadService
 *
 * Audio clock -> MIDI tick -> measure/beat -> system/x mapping.  This service
 * is deliberately timer-free: the transport owns the clock and calls
 * `positionAt` for each visual frame.
 */
(function attachEditorScorePlayheadService(globalScope) {
  'use strict';

  function number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function create({
    midiScore = null,
    musicXmlScore = null,
    projectTempo = null,
    tempo = null,
    partId = null,
    renderer = globalScope.ScoreRenderer || globalScope.MusicXmlScoreRenderer,
    core = globalScope.ScorePlayheadService
  } = {}) {
    let activeProjectTempo = Number(projectTempo ?? tempo);
    const clock = core?.create?.({
      midiScore,
      musicXmlScore,
      projectTempo: activeProjectTempo
    }) || null;
    let currentPartId = partId;
    let lastSystemIndex = -1;

    function setScores(next = {}) {
      midiScore = Object.prototype.hasOwnProperty.call(next, 'midiScore')
        ? next.midiScore : midiScore;
      musicXmlScore = Object.prototype.hasOwnProperty.call(next, 'musicXmlScore')
        ? next.musicXmlScore : musicXmlScore;
      if (
        Object.prototype.hasOwnProperty.call(next, 'projectTempo') ||
        Object.prototype.hasOwnProperty.call(next, 'tempo')
      ) {
        const nextTempo = next.projectTempo ?? next.tempo;
        activeProjectTempo = Number(nextTempo);
      }
      currentPartId = Object.prototype.hasOwnProperty.call(next, 'partId')
        ? next.partId : currentPartId;
      clock?.setScores?.({
        midiScore,
        musicXmlScore,
        projectTempo: activeProjectTempo
      });
      return api;
    }

    function secondsToTick(seconds) {
      return clock?.secondsToTick?.(Math.max(0, number(seconds))) || 0;
    }

    function tickToMeasureBeat(tick, targetPartId = currentPartId) {
      return clock?.tickToMeasureBeat?.(tick, targetPartId) || null;
    }

    function resolveLoopTime(seconds, loop = {}) {
      const value = Math.max(0, number(seconds));
      if (!loop.enabled) return value;
      const start = Math.max(0, number(loop.start, number(loop.loopA)));
      const end = Math.max(start, number(loop.end, number(loop.loopB)));
      if (end - start < 1e-6 || value < end) return value;
      return start + ((value - start) % (end - start));
    }

    function positionAt(seconds, options = {}) {
      const score = options.score || musicXmlScore || midiScore;
      const targetPartId = options.partId || currentPartId ||
        score?.activePartId || score?.parts?.[0]?.id || null;
      const time = resolveLoopTime(seconds, options.loop || {});
      const wrapped = Math.abs(time - number(seconds)) > 1e-9;
      const tick = !wrapped && Number.isFinite(Number(options.activeTick))
        ? Number(options.activeTick)
        : secondsToTick(time);
      const position = renderer?.getPlayheadPosition
        ? renderer.getPlayheadPosition(score, targetPartId, time, {
            ...options,
            activeTick: tick,
            midiScore,
            clock
          })
        : { tick, x: 0, systemIndex: 0, yTop: 0, yBottom: 0 };
      const barBeat = tickToMeasureBeat(tick, targetPartId);
      const nextSystemIndex = number(position.systemIndex, 0);
      const systemChanged = lastSystemIndex !== -1 && nextSystemIndex !== lastSystemIndex;
      lastSystemIndex = nextSystemIndex;
      return Object.freeze({
        ...position,
        time,
        tick,
        barBeat,
        systemChanged,
        partId: targetPartId
      });
    }

    function viewportTarget(position, viewer, margin = 100) {
      if (!viewer || !position) return null;
      const width = number(viewer.clientWidth);
      const height = number(viewer.clientHeight);
      const maxLeft = Math.max(0, number(viewer.scrollWidth) - width);
      const maxTop = Math.max(0, number(viewer.scrollHeight) - height);
      const left = Math.max(0, Math.min(maxLeft, number(position.x) - width * 0.5));
      const top = Math.max(
        0,
        Math.min(maxTop, number(position.staffTop) - Math.max(margin, height * 0.32))
      );
      return { left, top };
    }

    function reset() {
      lastSystemIndex = -1;
    }

    const api = {
      setScores,
      setPart: part => { currentPartId = part; reset(); },
      secondsToTick,
      tickToMeasureBeat,
      resolveLoopTime,
      positionAt,
      viewportTarget,
      reset
    };
    return Object.freeze(api);
  }

  const api = Object.freeze({ create });
  globalScope.EditorScorePlayheadService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
