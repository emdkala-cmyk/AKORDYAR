/**
 * mobileTimeline.js — آینه‌ی سبک Player View برای صفحه‌ی گوشی.
 *
 * تایم‌لاین بر اساس کلیپ‌های واقعی chord-lane ساخته می‌شود:
 * - گرید و شماره‌ی میزان‌ها با همان tempo / time signature رسم می‌شوند.
 * - پلی‌هد ثابت می‌ماند و track زیر آن از راست به چپ حرکت می‌کند.
 * - لمس یا کشیدن روی نوار، seek واقعی روی لپ‌تاپ انجام می‌دهد.
 */
(function attachMobileChordTimeline(globalScope) {
  'use strict';

  function finite(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function meterConfig(timeSignature, tempo) {
    return globalScope.Meter.getMeterConfig(timeSignature, tempo);
  }

  function normalizeTimeline(input) {
    const source = input || {};
    const rawClips = Array.isArray(source.clips) ? source.clips : [];
    const clips = rawClips
      .filter(clip => clip && (clip.type === 'chord' || clip.type == null))
      .map((clip, index) => {
        const start = Math.max(0, finite(clip.start, 0));
        const duration = Math.max(0.05, finite(clip.duration, 1));
        return {
          id: String(clip.id || 'mobile-chord-' + index),
          name: String(clip.name || clip.label || '').trim(),
          start,
          duration,
          color: clip.color || '#9F7AEA'
        };
      })
      .filter(clip => clip.name)
      .sort((a, b) => a.start - b.start);

    let duration = Math.max(0, finite(source.duration, 0));
    clips.forEach(clip => {
      duration = Math.max(duration, clip.start + clip.duration);
    });

    return {
      duration,
      pxPerSecond: clamp(finite(source.pxPerSecond, 70), 12, 260),
      tempo: Math.max(1, finite(source.tempo, 120)),
      timeSignature: source.timeSignature || '4/4',
      clips
    };
  }

  function create(root, options) {
    if (!root) return null;

    const opts = options || {};
    const doc = root.ownerDocument || document;
    const state = {
      timeline: normalizeTimeline(null),
      playback: { time: 0, isPlaying: false, duration: 0 },
      sceneWidth: 0,
      trackLeft: 0,
      pixelsPerSecond: 70,
      originSeconds: 2,
      timelineKey: ''
    };

    root.innerHTML =
      '<div class="mobile-timeline-ruler">' +
        '<div class="mobile-timeline-ruler-track"></div>' +
      '</div>' +
      '<div class="mobile-timeline-viewport">' +
        '<div class="mobile-timeline-track">' +
          '<div class="mobile-timeline-grid"></div>' +
          '<div class="mobile-timeline-clips"></div>' +
        '</div>' +
        '<div class="mobile-timeline-playhead" aria-hidden="true"></div>' +
      '</div>';

    const viewport = root.querySelector('.mobile-timeline-viewport');
    const rulerTrack = root.querySelector('.mobile-timeline-ruler-track');
    const track = root.querySelector('.mobile-timeline-track');
    const grid = root.querySelector('.mobile-timeline-grid');
    const clipsLayer = root.querySelector('.mobile-timeline-clips');

    function getWidth() {
      return Math.max(1, viewport.clientWidth || root.clientWidth || 1);
    }

    function makeLine(className, left) {
      const line = doc.createElement('div');
      line.className = className;
      line.style.left = left + 'px';
      return line;
    }

    function renderScene() {
      const timeline = state.timeline;
      const meter = meterConfig(timeline.timeSignature, timeline.tempo);
      state.pixelsPerSecond = timeline.pxPerSecond;
      // Empty space at both edges lets the first/last chord pass cleanly
      // through the fixed playhead instead of sticking to the frame edge.
      state.originSeconds = 2;
      const totalSeconds = Math.max(
        timeline.duration,
        timeline.clips.reduce(
          (end, clip) => Math.max(end, clip.start + clip.duration),
          0
        )
      );
      const sceneSeconds = totalSeconds + state.originSeconds * 2;
      state.sceneWidth = Math.max(
        getWidth() * 2,
        Math.ceil(sceneSeconds * state.pixelsPerSecond)
      );

      rulerTrack.innerHTML = '';
      grid.innerHTML = '';
      clipsLayer.innerHTML = '';
      rulerTrack.style.width = state.sceneWidth + 'px';
      track.style.width = state.sceneWidth + 'px';
      grid.style.width = state.sceneWidth + 'px';
      clipsLayer.style.width = state.sceneWidth + 'px';

      const maxBars = 500;
      const barCount = Math.min(
        maxBars,
        Math.ceil(totalSeconds / meter.measureDuration) + 1
      );

      for (let bar = 0; bar < barCount; bar += 1) {
        const barStartBeat = bar * meter.beatsPerMeasure;
        const time = globalScope.Meter.beatIndexToTime(
          barStartBeat,
          meter
        );
        const x = (state.originSeconds + time) * state.pixelsPerSecond;

        grid.appendChild(makeLine('mobile-timeline-bar-line', x));

        const label = doc.createElement('span');
        label.className = 'mobile-timeline-bar-label';
        label.style.left = (x + 3) + 'px';
        label.textContent = String(bar + 1);
        rulerTrack.appendChild(label);

        for (let beat = 1; beat < meter.beatsPerMeasure; beat += 1) {
          const beatTime = globalScope.Meter.beatIndexToTime(
            barStartBeat + beat,
            meter
          );
          const beatX =
            (state.originSeconds + beatTime) *
            state.pixelsPerSecond;
          if (beatX >= state.sceneWidth) break;
          grid.appendChild(makeLine('mobile-timeline-beat-line', beatX));
        }
      }

      timeline.clips.forEach(clip => {
        const clipEl = doc.createElement('div');
        clipEl.className = 'mobile-timeline-chord';
        clipEl.dataset.clipId = clip.id;
        clipEl.textContent = clip.name;
        clipEl.style.left =
          ((state.originSeconds + clip.start) * state.pixelsPerSecond) + 'px';
        clipEl.style.width =
          Math.max(30, clip.duration * state.pixelsPerSecond) + 'px';
        clipEl.style.borderColor = clip.color;
        clipEl.style.background =
          'linear-gradient(180deg, ' + clip.color + 'bb, ' + clip.color + '66)';
        clipsLayer.appendChild(clipEl);
      });

      updatePosition();
    }

    function updatePosition() {
      const width = getWidth();
      const playheadX = width / 2;
      const time = clamp(
        finite(state.playback.time, 0),
        0,
        Math.max(0, state.timeline.duration)
      );
      state.trackLeft =
        playheadX - ((state.originSeconds + time) * state.pixelsPerSecond);
      const transform = 'translate3d(' + state.trackLeft + 'px,0,0)';
      track.style.transform = transform;
      rulerTrack.style.transform = transform;
      root.dataset.playing = state.playback.isPlaying ? 'true' : 'false';
    }

    function seekFromPointer(event) {
      const rect = viewport.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const time =
        ((localX - state.trackLeft) / state.pixelsPerSecond) -
        state.originSeconds;
      if (typeof opts.onSeek === 'function') {
        opts.onSeek(clamp(time, 0, state.timeline.duration));
      }
    }

    let dragging = false;
    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true;
      try { viewport.setPointerCapture(event.pointerId); } catch (_) {}
      seekFromPointer(event);
    });
    viewport.addEventListener('pointermove', event => {
      if (dragging) seekFromPointer(event);
    });
    const finishPointer = event => {
      if (!dragging) return;
      dragging = false;
      try { viewport.releasePointerCapture(event.pointerId); } catch (_) {}
    };
    viewport.addEventListener('pointerup', finishPointer);
    viewport.addEventListener('pointercancel', finishPointer);

    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => renderScene())
        : null;
    resizeObserver?.observe(root);

    function setTimeline(next) {
      const normalized = normalizeTimeline(next);
      const key = JSON.stringify(normalized);
      if (key === state.timelineKey) return;
      state.timelineKey = key;
      state.timeline = normalized;
      if (state.playback.duration <= 0) {
        state.playback.duration = state.timeline.duration;
      }
      renderScene();
    }

    function setPlayback(next) {
      state.playback = Object.assign({}, state.playback, next || {});
      if (!Number.isFinite(Number(state.playback.duration)) ||
          Number(state.playback.duration) <= 0) {
        state.playback.duration = state.timeline.duration;
      }
      updatePosition();
    }

    return {
      setTimeline,
      setPlayback,
      getState: () => ({ timeline: state.timeline, playback: state.playback }),
      destroy: () => resizeObserver?.disconnect()
    };
  }

  globalScope.MobileChordTimeline = { create, normalizeTimeline };
})(typeof window !== 'undefined' ? window : globalThis);
