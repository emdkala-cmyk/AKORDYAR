/**
 * PlaybackTimelineController
 *
 * Audio scheduling and playhead presentation helpers.  The app owns the
 * transport state; this module only receives lazy accessors so scheduling and
 * rendering stay testable and do not become a second clock.
 */
(function attachPlaybackTimelineController(globalScope) {
  'use strict';

  function create({
    getDAW,
    ensureAudioCtx,
    stopAllVoices,
    getTransportClockSnapshot,
    getNode,
    timeToX,
    formatTime,
    onPlayheadTime = () => {}
  } = {}) {
    if (typeof getDAW !== 'function') throw new TypeError('PlaybackTimelineController requires getDAW');
    if (typeof ensureAudioCtx !== 'function') throw new TypeError('PlaybackTimelineController requires ensureAudioCtx');
    if (typeof stopAllVoices !== 'function') throw new TypeError('PlaybackTimelineController requires stopAllVoices');
    if (typeof getTransportClockSnapshot !== 'function') throw new TypeError('PlaybackTimelineController requires getTransportClockSnapshot');
    if (typeof getNode !== 'function') throw new TypeError('PlaybackTimelineController requires getNode');
    if (typeof timeToX !== 'function') throw new TypeError('PlaybackTimelineController requires timeToX');
    if (typeof formatTime !== 'function') throw new TypeError('PlaybackTimelineController requires formatTime');

    const renderState = {
      lastDisplayTime: NaN,
      lastX: NaN,
      lastActiveChordId: null,
      lastActiveChordName: null
    };
    const nodes = {};
    const getRenderNodes = () => {
      if (!nodes.main) {
        nodes.main = getNode('main-playhead');
        nodes.hit = getNode('playhead-hit');
        nodes.timeDisplay = getNode('time-display');
        nodes.phLabel = getNode('ph-label');
        nodes.liveChord = getNode('live-chord');
        nodes.scroll = getNode('tl-scroll');
      }
      return nodes;
    };

    function getDisplayPlayheadTime(performanceTime = performance.now()) {
      const daw = getDAW();
      if (!daw.isPlaying) return Number.isFinite(daw.playhead) ? daw.playhead : 0;
      // The editor timeline grid and metronome are both anchored to the raw
      // AudioContext transport clock. Electron's output timestamp is a
      // presentation projection intended for popup highlights; using it for
      // this playhead introduces a small phase offset against the grid.
      const snapshot = getTransportClockSnapshot({
        visual: false,
        performanceTime
      });
      return Math.max(
        0,
        Number.isFinite(snapshot.timelineTime)
          ? snapshot.timelineTime
          : snapshot.visualTimelineTime
      );
    }

    function syncTimelineViewportToPlayhead(
      displayTime = getDisplayPlayheadTime(),
      playheadX = timeToX(displayTime)
    ) {
      const scroll = getRenderNodes().scroll;
      if (!scroll) return;
      const viewportService = globalScope.TimelineViewportService;
      const current = Number(scroll.scrollLeft) || 0;
      const maxScrollLeft = Math.max(
        0,
        (scroll.scrollWidth || 0) - (scroll.clientWidth || 0)
      );
      const next = viewportService?.getScrollLeftForPlayhead
        ? viewportService.getScrollLeftForPlayhead({
            playheadX,
            scrollLeft: current,
            viewportWidth: scroll.clientWidth,
            mode: getDAW().playheadMode,
            margin: 60,
            maxScrollLeft
          })
        : current;
      if (Number.isFinite(next) && Math.abs(next - current) > 0.5) {
        scroll.scrollLeft = next;
      }
    }

    function updatePlayheadUI({ performanceTime = performance.now() } = {}) {
      const renderNodes = getRenderNodes();
      const displayTime = getDisplayPlayheadTime(performanceTime);
      onPlayheadTime(displayTime);
      const x = timeToX(displayTime);
      if (
        renderNodes.main &&
        (
          !Number.isFinite(renderState.lastX) ||
          Math.abs(x - renderState.lastX) > 0.0001
        )
      ) {
        const transform = `translate3d(${x}px, 0, 0)`;
        renderNodes.main.style.transform = transform;
        if (renderNodes.hit) renderNodes.hit.style.transform = transform;
        renderState.lastX = x;
      }

      const formattedTime = formatTime(displayTime);
      if (renderNodes.timeDisplay && renderNodes.timeDisplay.value !== formattedTime) {
        renderNodes.timeDisplay.value = formattedTime;
      }
      if (renderNodes.phLabel && renderNodes.phLabel.textContent !== formattedTime) {
        renderNodes.phLabel.textContent = formattedTime;
      }

      const daw = getDAW();
      const activeChord = daw.clips
        .filter(c =>
          c.type === 'chord' &&
          displayTime >= c.start &&
          displayTime < c.start + c.duration
        )
        .pop();
      const activeChordId = activeChord?.id || null;
      const activeChordName = activeChord?.name || 'None';
      if (
        activeChordId !== renderState.lastActiveChordId ||
        activeChordName !== renderState.lastActiveChordName
      ) {
        if (renderNodes.liveChord) renderNodes.liveChord.textContent = activeChordName;
        renderState.lastActiveChordId = activeChordId;
        renderState.lastActiveChordName = activeChordName;
      }

      if (
        !Number.isFinite(renderState.lastDisplayTime) ||
        Math.abs(displayTime - renderState.lastDisplayTime) > 0.0001
      ) {
        syncTimelineViewportToPlayhead(displayTime, x);
        renderState.lastDisplayTime = displayTime;
      }
    }

    function scheduleAllFromPlayhead({
      preserveVoices = false,
      loopOnly = false
    } = {}) {
      const ctx = ensureAudioCtx();
      if (!preserveVoices) stopAllVoices();
      const daw = getDAW();
      if (!daw.isPlaying || daw.isScrubbing) return;
      const clock = getTransportClockSnapshot();
      const nowT = clock.timelineTime;
      const ctxNow = Number.isFinite(clock.audioTime) ? clock.audioTime : ctx.currentTime;
      const scheduleStartAudio =
        Number.isFinite(clock.transportStartAudioTime) &&
        clock.transportStartAudioTime > ctxNow
          ? clock.transportStartAudioTime
          : ctxNow;
      const hasLoop =
        Boolean(daw.loopEnabled) &&
        Number.isFinite(daw.loopA) &&
        Number.isFinite(daw.loopB) &&
        daw.loopB - daw.loopA > 1e-6;
      const scheduleClipSegment = (clip, when, mediaOffset, playDur, voiceKey) => {
        const tr = daw.tracks.find(t => t.id === clip.trackId);
        if (tr && (tr.muted || (daw.tracks.some(t => t.solo) && !tr.solo))) return;
        const buffer = daw.bufferCache.get(clip.bufferKey);
        if (!buffer || mediaOffset >= buffer.duration - 0.0005) return;
        playDur = Math.min(playDur, buffer.duration - mediaOffset);
        if (playDur <= 0.005 || !tr?._pannerNode) return;
        const gain = ctx.createGain();
        gain.gain.value = 1;
        gain.connect(tr._pannerNode);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        const semitones = tr.transpose || 0;
        if (semitones !== 0) source.playbackRate.value = Math.pow(2, semitones / 12);
        try {
          source.start(when, mediaOffset, playDur);
        } catch (_) {
          return;
        }
        source.onended = () => {
          if (daw.voices.get(voiceKey)?.source === source) daw.voices.delete(voiceKey);
        };
        daw.voices.set(voiceKey, { source, gain });
      };

      /* ---- Warp-aware time remap helper ---- */
      const FreeWarp = globalScope.FreeWarpEngine;
      const warpService = globalScope.AkordyarCoreApi?.getFreeWarpService?.();
      function warpMediaOffset(clip, timelineT) {
        if (!clip.warpMarkers || clip.warpMarkers.length < 3 || !FreeWarp) {
          return clip.offset + (timelineT - clip.start);
        }
        const srcT = FreeWarp.timelineToSource(timelineT, clip.warpMarkers);
        if (srcT == null) return clip.offset + (timelineT - clip.start);
        return srcT;
      }
      function warpPlayDur(clip, tlStart, tlEnd) {
        if (!clip.warpMarkers || clip.warpMarkers.length < 3 || !FreeWarp) {
          return tlEnd - tlStart;
        }
        const srcStart = FreeWarp.timelineToSource(tlStart, clip.warpMarkers);
        const srcEnd = FreeWarp.timelineToSource(tlEnd, clip.warpMarkers);
        if (srcStart == null || srcEnd == null) return tlEnd - tlStart;
        return Math.abs(srcEnd - srcStart);
      }

      daw.clips.forEach(clip => {
        if (clip.type === 'chord') return;
        const clipEnd = clip.start + clip.duration;
        const local = nowT - clip.start;
        if (
          !loopOnly &&
          local < clip.duration &&
          (!hasLoop || nowT < daw.loopB)
        ) {
          const currentEnd = hasLoop ? Math.min(clipEnd, daw.loopB) : clipEnd;
          if (currentEnd > Math.max(nowT, clip.start)) {
            const when = local < 0 ? scheduleStartAudio + (-local) : scheduleStartAudio;
            const tlOrigin = Math.max(nowT, clip.start);
            const mediaOffset = local < 0 ? clip.offset : warpMediaOffset(clip, nowT);
            const playDur = warpPlayDur(clip, tlOrigin, currentEnd);
            scheduleClipSegment(
              clip,
              when,
              mediaOffset,
              playDur,
              clip.id
            );
          }
        }
        if (hasLoop) {
          const loopSegmentStart = Math.max(clip.start, daw.loopA);
          const loopSegmentEnd = Math.min(clipEnd, daw.loopB);
          const loopBoundaryAudio = scheduleStartAudio + (daw.loopB - nowT);
          if (
            loopSegmentEnd > loopSegmentStart &&
            loopBoundaryAudio > ctxNow + 1e-6
          ) {
            scheduleClipSegment(
              clip,
              loopBoundaryAudio + (loopSegmentStart - daw.loopA),
              warpMediaOffset(clip, loopSegmentStart),
              warpPlayDur(clip, loopSegmentStart, loopSegmentEnd),
              `${clip.id}@loop`
            );
          }
        }
      });
    }

    return {
      getDisplayPlayheadTime,
      updatePlayheadUI,
      syncTimelineViewportToPlayhead,
      scheduleAllFromPlayhead
    };
  }

  globalScope.PlaybackTimelineController = Object.freeze({ create });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.PlaybackTimelineController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
