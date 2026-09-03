/**
 * TempoMap — one canonical musical-time map for the editor timeline.
 *
 * Timeline positions remain seconds so existing clips and pixel geometry keep
 * their meaning. The map converts those seconds to a monotonic quarter-note
 * position and back, while allowing tempo and meter changes to be represented
 * as piecewise segments. Grid rendering, seeking and the Web Audio scheduler
 * can therefore use the same beat boundaries.
 */
(function attachTempoMap(globalScope) {
  'use strict';

  const meter =
    globalScope.Meter ||
    (typeof require === 'function' ? require('./Meter.js') : null);
  const EPSILON = 1e-9;
  const DEFAULT_TEMPO = 120;
  const DEFAULT_TIME_SIGNATURE = '4/4';

  function finitePositive(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  function finiteNonNegative(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
  }

  function normalizeTiming(timing = {}, fallback = {}) {
    const tempo = finitePositive(
      timing.tempo ?? timing.bpm,
      finitePositive(fallback.tempo ?? fallback.bpm, DEFAULT_TEMPO)
    );
    const timeSignature =
      timing.timeSignature ||
      fallback.timeSignature ||
      DEFAULT_TIME_SIGNATURE;
    const config = meter?.getMeterConfig?.(timeSignature, tempo) || {
      numerator: 4,
      denominator: 4,
      beatsPerMeasure: 4,
      subdivisionsPerBeat: 4,
      beatDuration: 60 / tempo,
      measureDuration: 4 * (60 / tempo),
      timeSignature: String(timeSignature)
    };
    return {
      tempo,
      timeSignature: config.timeSignature || String(timeSignature),
      config
    };
  }

  function modulo(value, divisor) {
    if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0) {
      return 0;
    }
    return ((value % divisor) + divisor) % divisor;
  }

  function cloneEvent(event) {
    return {
      time: event.time,
      quarter: event.quarter,
      tempo: event.tempo,
      timeSignature: event.timeSignature,
      gridOriginQuarter: event.gridOriginQuarter,
      barStartQuarter: event.barStartQuarter,
      barNumber: event.barNumber
    };
  }

  function asRawTempoMap(value) {
    if (!value) return null;
    if (typeof value.toJSON === 'function') {
      try {
        return value.toJSON();
      } catch (_) {
        return null;
      }
    }
    if (Array.isArray(value.events)) return value;
    return null;
  }

  function normalizeEvents(input = {}) {
    const rawMap = asRawTempoMap(input.tempoMap || input.map) ||
      asRawTempoMap(input);
    const fallback = normalizeTiming(
      {
        tempo: rawMap?.baseTempo ?? input.tempo ?? input.bpm,
        timeSignature:
          rawMap?.baseTimeSignature ?? input.timeSignature
      }
    );
    const source = Array.isArray(rawMap?.events) ? rawMap.events : [];
    const events = source
      .map((event, index) => {
        const timing = normalizeTiming(event, fallback);
        return {
          time: finiteNonNegative(event?.time, index === 0 ? 0 : NaN),
          quarter: Number.isFinite(Number(event?.quarter))
            ? Number(event.quarter)
            : null,
          tempo: timing.tempo,
          timeSignature: timing.timeSignature,
          gridOriginQuarter: Number.isFinite(
            Number(event?.gridOriginQuarter)
          )
            ? Number(event.gridOriginQuarter)
            : null,
          barStartQuarter: Number.isFinite(Number(event?.barStartQuarter))
            ? Number(event.barStartQuarter)
            : null,
          barNumber: Number.isFinite(Number(event?.barNumber))
            ? Math.max(1, Math.trunc(Number(event.barNumber)))
            : null
        };
      })
      .filter(event => Number.isFinite(event.time))
      .sort((left, right) => left.time - right.time);

    if (!events.length || events[0].time > EPSILON) {
      events.unshift({
        time: 0,
        quarter: 0,
        tempo: fallback.tempo,
        timeSignature: fallback.timeSignature,
        gridOriginQuarter: 0,
        barStartQuarter: 0,
        barNumber: 1
      });
    }

    const deduplicated = [];
    events.forEach(event => {
      const previous = deduplicated[deduplicated.length - 1];
      if (previous && Math.abs(previous.time - event.time) <= EPSILON) {
        deduplicated[deduplicated.length - 1] = event;
      } else {
        deduplicated.push(event);
      }
    });

    if (deduplicated[0].time > EPSILON) {
      deduplicated.unshift({
        time: 0,
        quarter: 0,
        tempo: fallback.tempo,
        timeSignature: fallback.timeSignature,
        gridOriginQuarter: 0,
        barStartQuarter: 0,
        barNumber: 1
      });
    }

    deduplicated.forEach((event, index) => {
      const previous = deduplicated[index - 1];
      if (index === 0) {
        event.time = 0;
        event.quarter = 0;
        event.gridOriginQuarter = Number.isFinite(event.gridOriginQuarter)
          ? event.gridOriginQuarter
          : 0;
        event.barStartQuarter = Number.isFinite(event.barStartQuarter)
          ? event.barStartQuarter
          : event.gridOriginQuarter;
        event.barNumber = Math.max(1, event.barNumber || 1);
        return;
      }

      if (!Number.isFinite(event.quarter)) {
        event.quarter =
          previous.quarter +
          (event.time - previous.time) * previous.tempo / 60;
      }

      const previousConfig = meter?.getMeterConfig?.(
        previous.timeSignature,
        previous.tempo
      );
      const signatureChanged =
        event.timeSignature !== previous.timeSignature;
      event.gridOriginQuarter = Number.isFinite(event.gridOriginQuarter)
        ? event.gridOriginQuarter
        : signatureChanged
          ? event.quarter
          : previous.gridOriginQuarter;
      event.barStartQuarter = Number.isFinite(event.barStartQuarter)
        ? event.barStartQuarter
        : signatureChanged
          ? event.quarter
          : previous.barStartQuarter;
      event.barNumber = Math.max(
        1,
        event.barNumber ||
          (signatureChanged
            ? getBarNumberAtQuarter(
                previous,
                event.quarter,
                previousConfig
              )
            : previous.barNumber)
      );
    });

    return deduplicated;
  }

  function getBarNumberAtQuarter(event, quarter, config) {
    const unit = 4 / Math.max(1, Number(config?.denominator) || 4);
    const beatsPerMeasure = Math.max(
      1,
      Number(config?.beatsPerMeasure) || 4
    );
    const beatIndex = Math.max(
      0,
      Math.floor(
        (Number(quarter) - Number(event.gridOriginQuarter || 0)) /
          unit +
          EPSILON
      )
    );
    return Math.max(
      1,
      Number(event.barNumber) || 1
    ) + Math.floor(beatIndex / beatsPerMeasure);
  }

  function create(input = {}) {
    const events = normalizeEvents(input).map(cloneEvent);

    function segmentIndexAtTime(time) {
      const safeTime = Math.max(0, Number(time) || 0);
      let low = 0;
      let high = events.length - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (events[middle].time <= safeTime + EPSILON) low = middle;
        else high = middle - 1;
      }
      return Math.max(0, low);
    }

    function segmentIndexAtQuarter(quarter) {
      const safeQuarter = Number(quarter) || 0;
      let low = 0;
      let high = events.length - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (events[middle].quarter <= safeQuarter + EPSILON) low = middle;
        else high = middle - 1;
      }
      return Math.max(0, low);
    }

    function nextSegmentTime(index, fallback = Number.POSITIVE_INFINITY) {
      return events[index + 1]?.time ?? fallback;
    }

    function configFor(event) {
      return meter?.getMeterConfig?.(
        event.timeSignature,
        event.tempo
      ) || normalizeTiming(event).config;
    }

    function timelineToBeat(time) {
      const safeTime = Math.max(0, Number(time) || 0);
      const index = segmentIndexAtTime(safeTime);
      const event = events[index];
      return event.quarter +
        (safeTime - event.time) * event.tempo / 60;
    }

    function beatToTimeline(beat) {
      const safeBeat = Math.max(0, Number(beat) || 0);
      const index = segmentIndexAtQuarter(safeBeat);
      const event = events[index];
      return Math.max(
        0,
        event.time + (safeBeat - event.quarter) * 60 / event.tempo
      );
    }

    function timelineToQuarter(time) {
      return timelineToBeat(time);
    }

    function quarterToTimeline(quarter) {
      return beatToTimeline(quarter);
    }

    function getTimingAt(time = 0) {
      const event = events[segmentIndexAtTime(time)];
      const config = configFor(event);
      return {
        ...config,
        tempo: event.tempo,
        bpm: event.tempo,
        timeSignature: event.timeSignature,
        timelineTime: Math.max(0, Number(time) || 0)
      };
    }

    function getBeatDurationAt(time = 0) {
      return Number(getTimingAt(time).beatDuration) || 0;
    }

    function getBeatInfoAtTime(time = 0) {
      const safeTime = Math.max(0, Number(time) || 0);
      const index = segmentIndexAtTime(safeTime);
      const event = events[index];
      const config = configFor(event);
      const unit = 4 / Math.max(1, Number(config.denominator) || 4);
      const relativeBeat = Math.max(
        0,
        Math.floor(
          (timelineToBeat(safeTime) - event.gridOriginQuarter) /
            unit +
            EPSILON
        )
      );
      const beatsPerMeasure = Math.max(
        1,
        Number(config.beatsPerMeasure) || 4
      );
      const beatInMeasure = modulo(relativeBeat, beatsPerMeasure);
      const bar = event.barNumber +
        Math.floor(relativeBeat / beatsPerMeasure);
      return {
        time: safeTime,
        quarter: timelineToBeat(safeTime),
        beatIndex: relativeBeat,
        beatInMeasure,
        bar,
        isBarStart: beatInMeasure === 0,
        isAccent:
          meter?.isStrongBeat?.(beatInMeasure, event.timeSignature) === true,
        tempo: event.tempo,
        bpm: event.tempo,
        timeSignature: event.timeSignature,
        config,
        segmentIndex: index
      };
    }

    function createBeatEvent(event, segmentIndex, beatIndex) {
      const config = configFor(event);
      const unit = 4 / Math.max(1, Number(config.denominator) || 4);
      const quarter = event.gridOriginQuarter + beatIndex * unit;
      const time = beatToTimeline(quarter);
      const beatsPerMeasure = Math.max(
        1,
        Number(config.beatsPerMeasure) || 4
      );
      const beatInMeasure = modulo(beatIndex, beatsPerMeasure);
      const bar = event.barNumber +
        Math.floor(beatIndex / beatsPerMeasure);
      return {
        time,
        quarter,
        beatIndex,
        beatInMeasure,
        bar,
        isBarStart: beatInMeasure === 0,
        isAccent:
          meter?.isStrongBeat?.(beatInMeasure, event.timeSignature) === true,
        tempo: event.tempo,
        bpm: event.tempo,
        timeSignature: event.timeSignature,
        config,
        segmentIndex
      };
    }

    function beatAtOrAfter(time, { includeCurrent = true } = {}) {
      const safeTime = Math.max(0, Number(time) || 0);
      let firstIndex = segmentIndexAtTime(safeTime);

      for (let index = firstIndex; index < events.length; index++) {
        const event = events[index];
        const config = configFor(event);
        const unit = 4 / Math.max(1, Number(config.denominator) || 4);
        const isInitialSegment = index === firstIndex;
        const segmentStart = index === firstIndex
          ? safeTime
          : event.time;
        const segmentEnd = nextSegmentTime(index);
        const quarterAtStart = timelineToBeat(segmentStart);
        const ratio =
          (quarterAtStart - event.gridOriginQuarter) / unit;
        // If the candidate from the previous segment lands exactly on this
        // segment's start, it is still the first beat after the original
        // query. Only a query that starts on this segment may exclude its
        // current beat.
        const includeSegmentStart =
          !isInitialSegment || includeCurrent !== false;
        let beatIndex = includeSegmentStart
          ? Math.ceil(ratio - EPSILON)
          : Math.floor(ratio + EPSILON) + 1;
        beatIndex = Math.max(0, beatIndex);

        let candidate = createBeatEvent(event, index, beatIndex);
        if (candidate.time < segmentStart - EPSILON) {
          beatIndex++;
          candidate = createBeatEvent(event, index, beatIndex);
        }

        if (
          candidate.time >= segmentStart - EPSILON &&
          candidate.time < segmentEnd - EPSILON
        ) {
          return candidate;
        }
      }

      return null;
    }

    function nextBeatAfter(beatEvent) {
      if (!beatEvent) return beatAtOrAfter(0);
      return beatAtOrAfter(beatEvent.time + EPSILON * 100, {
        includeCurrent: true
      });
    }

    function getGridPoints(
      startTime = 0,
      endTime = Number.POSITIVE_INFINITY,
      { maxPoints = 12000 } = {}
    ) {
      const start = Math.max(0, Number(startTime) || 0);
      const end = Math.max(start, Number(endTime) || 0);
      const points = {
        beats: [],
        subdivisions: [],
        bars: []
      };
      const seen = {
        beats: new Set(),
        subdivisions: new Set(),
        bars: new Set()
      };
      let pointCount = 0;

      for (let index = 0; index < events.length; index++) {
        if (pointCount >= maxPoints) break;
        const event = events[index];
        const config = configFor(event);
        const unit = 4 / Math.max(1, Number(config.denominator) || 4);
        const subdivisionsPerBeat = Math.max(
          1,
          Math.floor(Number(config.subdivisionsPerBeat) || 1)
        );
        const segmentStart = Math.max(start, event.time);
        const segmentEnd = Math.min(end, nextSegmentTime(index, end));
        const hasNextSegment =
          index + 1 < events.length &&
          events[index + 1].time <= end + EPSILON;
        if (
          segmentStart > segmentEnd + EPSILON ||
          (hasNextSegment && segmentEnd <= segmentStart + EPSILON)
        ) {
          continue;
        }

        const qStart = timelineToBeat(segmentStart);
        const qEnd = timelineToBeat(segmentEnd);
        const firstBeat = Math.max(
          0,
          Math.ceil(
            (qStart - event.gridOriginQuarter) / unit - EPSILON
          )
        );
        const lastBeat = Math.floor(
          (qEnd - event.gridOriginQuarter) / unit + EPSILON
        );

        for (
          let beatIndex = firstBeat;
          beatIndex <= lastBeat && pointCount < maxPoints;
          beatIndex++
        ) {
          const beat = createBeatEvent(event, index, beatIndex);
          if (
            beat.time < start - EPSILON ||
            beat.time > end + EPSILON ||
            (hasNextSegment && beat.time >= segmentEnd - EPSILON)
          ) {
            continue;
          }
          const key = beat.time.toFixed(9);
          if (!seen.beats.has(key)) {
            seen.beats.add(key);
            points.beats.push(beat);
            pointCount++;
          }
          if (beat.isBarStart && !seen.bars.has(key)) {
            seen.bars.add(key);
            points.bars.push(beat);
          }

          for (
            let subdivision = 1;
            subdivision < subdivisionsPerBeat &&
            pointCount < maxPoints;
            subdivision++
          ) {
            const quarter =
              beat.quarter + unit * subdivision / subdivisionsPerBeat;
            if (quarter >= qEnd - EPSILON) break;
            const subdivisionTime = beatToTimeline(quarter);
            if (
              subdivisionTime < start - EPSILON ||
              subdivisionTime > end + EPSILON ||
              (hasNextSegment && subdivisionTime >= segmentEnd - EPSILON)
            ) {
              continue;
            }
            const subdivisionKey = subdivisionTime.toFixed(9);
            if (seen.subdivisions.has(subdivisionKey)) continue;
            seen.subdivisions.add(subdivisionKey);
            points.subdivisions.push({
              time: subdivisionTime,
              quarter,
              beatIndex,
              subdivision,
              subdivisionsPerBeat,
              segmentIndex: index
            });
            pointCount++;
          }
        }
      }

      points.beats.sort((left, right) => left.time - right.time);
      points.subdivisions.sort((left, right) => left.time - right.time);
      points.bars.sort((left, right) => left.time - right.time);
      return points;
    }

    function snapToNearestBar(time) {
      const safeTime = Math.max(0, Number(time) || 0);
      const info = getBeatInfoAtTime(safeTime);
      const event = events[info.segmentIndex];
      const config = info.config;
      const unit = 4 / Math.max(1, Number(config.denominator) || 4);
      const beatsPerMeasure = Math.max(
        1,
        Number(config.beatsPerMeasure) || 4
      );
      const barIndex = Math.floor(info.beatIndex / beatsPerMeasure);
      const currentBarQuarter =
        event.gridOriginQuarter + barIndex * beatsPerMeasure * unit;
      const nextBarQuarter =
        currentBarQuarter + beatsPerMeasure * unit;
      const current = beatToTimeline(currentBarQuarter);
      const next = beatToTimeline(nextBarQuarter);
      return Math.abs(safeTime - current) <= Math.abs(next - safeTime)
        ? current
        : next;
    }

    function snapTimeToGrid(time, preset = '1/4') {
      const safeTime = Math.max(0, Number(time) || 0);
      const info = getBeatInfoAtTime(safeTime);
      const event = events[info.segmentIndex];
      const config = info.config;
      const beatUnit = 4 / Math.max(1, Number(config.denominator) || 4);
      const measureUnit =
        beatUnit * Math.max(1, Number(config.beatsPerMeasure) || 4);
      const step = {
        '1/1': measureUnit,
        '1/2': measureUnit / 2,
        '1/4': beatUnit,
        '1/8': beatUnit / 2,
        '1/16': beatUnit / 4,
        '1/32': beatUnit / 8,
        triplet: beatUnit / 3,
        dotted: beatUnit * 1.5
      }[preset] || beatUnit;
      const quarter = timelineToBeat(safeTime);
      const ratio = (quarter - event.gridOriginQuarter) / step;
      const candidates = [
        Math.floor(ratio) * step,
        Math.ceil(ratio) * step
      ].map(offset => beatToTimeline(event.gridOriginQuarter + offset));
      return candidates.reduce((closest, candidate) =>
        Math.abs(candidate - safeTime) < Math.abs(closest - safeTime)
          ? candidate
          : closest
      );
    }

    function timeToBarBeat(time) {
      const info = getBeatInfoAtTime(time);
      return {
        bar: info.bar,
        beat: info.beatInMeasure + 1,
        beatDur: info.config.beatDuration,
        barDur: info.config.measureDuration,
        beatsPerBar: info.config.beatsPerMeasure
      };
    }

    function barBeatToTime(bar, beat) {
      const targetBar = Math.max(1, Number(bar) || 1);
      const targetBeat = Math.max(1, Number(beat) || 1);
      for (let index = events.length - 1; index >= 0; index--) {
        const event = events[index];
        const config = configFor(event);
        const beatsPerMeasure = Math.max(
          1,
          Number(config.beatsPerMeasure) || 4
        );
        if (targetBar < event.barNumber) continue;
        const beatIndex =
          (targetBar - event.barNumber) * beatsPerMeasure +
          targetBeat - 1;
        const quarter =
          event.gridOriginQuarter +
          Math.max(0, beatIndex) *
            (4 / Math.max(1, Number(config.denominator) || 4));
        const time = beatToTimeline(quarter);
        if (index === events.length - 1 || time >= event.time - EPSILON) {
          return time;
        }
      }
      return 0;
    }

    function toJSON() {
      return {
        version: 1,
        baseTempo: events[0].tempo,
        baseTimeSignature: events[0].timeSignature,
        events: events.map(cloneEvent)
      };
    }

    function changeAt(time, timing = {}) {
      const safeTime = Math.max(0, Number(time) || 0);
      const current = getBeatInfoAtTime(safeTime);
      const next = normalizeTiming(timing, current);
      const currentEvent = events[current.segmentIndex];
      const signatureChanged =
        next.timeSignature !== currentEvent.timeSignature;
      const nextRaw = toJSON();
      const nextEvent = {
        time: safeTime,
        quarter: timelineToBeat(safeTime),
        tempo: next.tempo,
        timeSignature: next.timeSignature,
        gridOriginQuarter: signatureChanged
          ? timelineToBeat(safeTime)
          : currentEvent.gridOriginQuarter,
        barStartQuarter: signatureChanged
          ? timelineToBeat(safeTime)
          : currentEvent.barStartQuarter,
        barNumber: signatureChanged
          ? current.bar
          : currentEvent.barNumber
      };

      if (safeTime <= EPSILON) {
        nextRaw.baseTempo = next.tempo;
        nextRaw.baseTimeSignature = next.timeSignature;
        nextRaw.events[0] = nextEvent;
      } else {
        const index = nextRaw.events.findIndex(
          event => Math.abs(Number(event.time) - safeTime) <= EPSILON
        );
        if (index >= 0) nextRaw.events[index] = nextEvent;
        else nextRaw.events.push(nextEvent);
      }

      return create({ tempoMap: nextRaw });
    }

    return Object.freeze({
      EPSILON,
      getSegments: () => events.map(cloneEvent),
      toJSON,
      timelineToBeat,
      beatToTimeline,
      timelineToQuarter,
      quarterToTimeline,
      getTimingAt,
      getBeatDurationAt,
      getBeatInfoAtTime,
      getBeatAtOrAfter: beatAtOrAfter,
      nextBeatAfter,
      getGridPoints,
      snapToNearestBar,
      snapTimeToGrid,
      timeToBarBeat,
      barBeatToTime,
      changeAt
    });
  }

  const service = Object.freeze({ create, EPSILON });
  globalScope.TempoMap = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
