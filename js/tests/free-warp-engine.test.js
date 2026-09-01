const assert = require('node:assert/strict');
const Engine = require('../core/FreeWarpEngine.js');

/* ==================== TESTS ==================== */

/* 1) defaultMarkers */
{
  const m = Engine.defaultMarkers(2.0, 4.0, 0.5);
  assert.equal(m.length, 2, 'default markers count');
  assert.equal(m[0].sourceTime, 0, 'start source');
  assert.equal(m[0].timelineTime, 2.0, 'start timeline');
  assert.equal(m[1].sourceTime, 4.0, 'end source');
  assert.equal(m[1].timelineTime, 6.0, 'end timeline');
  assert.equal(m[0].pinned, true, 'start pinned');
}

/* 2) timelineToSource — identity (no warp) */
{
  const m = Engine.defaultMarkers(0, 4.0, 0);
  assert.equal(Engine.timelineToSource(0, m), 0, 't=0');
  assert.equal(Engine.timelineToSource(2.0, m), 2.0, 't=2');
  assert.equal(Engine.timelineToSource(4.0, m), 4.0, 't=4');
}

/* 3) timelineToSource — compression */
{
  const m = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: '_end',   sourceTime: 4.0, timelineTime: 2.0, pinned: true }
  ];
  // timeline 0-2 maps to source 0-4 → compression by 2x
  assert.equal(Engine.timelineToSource(1.0, m), 2.0, 'midpoint');
  assert.equal(Engine.timelineToSource(0.5, m), 1.0, 'quarter');
}

/* 4) timelineToSource — stretching */
{
  const m = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: '_end',   sourceTime: 2.0, timelineTime: 4.0, pinned: true }
  ];
  // timeline 0-4 maps to source 0-2 → stretch by 2x
  assert.equal(Engine.timelineToSource(2.0, m), 1.0, 'midpoint');
  assert.equal(Engine.timelineToSource(4.0, m), 2.0, 'end');
}

/* 5) timelineToSource — multi-segment */
{
  const m = [
    { id: 'a', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: 'b', sourceTime: 2, timelineTime: 3, pinned: false },
    { id: 'c', sourceTime: 4, timelineTime: 5, pinned: true }
  ];
  // segment 0-3: source 0-2 (stretch), segment 3-5: source 2-4 (compress)
  assert.equal(Engine.timelineToSource(1.5, m), 1.0, 'seg1 mid');
  assert.equal(Engine.timelineToSource(4.0, m), 3.0, 'seg2 mid');
}

/* 6) sourceToTimeline — inverse */
{
  const m = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: '_end',   sourceTime: 4.0, timelineTime: 2.0, pinned: true }
  ];
  assert.equal(Engine.sourceToTimeline(0, m), 0, 'src=0');
  assert.equal(Engine.sourceToTimeline(2.0, m), 1.0, 'src=2');
  assert.equal(Engine.sourceToTimeline(4.0, m), 2.0, 'src=4');
}

/* 7) insertMarker */
{
  const m = Engine.defaultMarkers(0, 4.0, 0);
  const m2 = Engine.insertMarker(m, 'w1', 2.0, 2.0, false);
  assert.equal(m2.length, 3, 'inserted');
  assert.equal(m2[1].id, 'w1', 'middle marker');
  assert.equal(m2[1].sourceTime, 2.0, 'source time');
  assert.equal(m2[1].timelineTime, 2.0, 'timeline time');
}

/* 8) removeMarker */
{
  const m = Engine.defaultMarkers(0, 4.0, 0);
  const m2 = Engine.insertMarker(m, 'w1', 2.0, 2.0, false);
  const m3 = Engine.removeMarker(m2, 'w1');
  assert.equal(m3.length, 2, 'removed');
  const m4 = Engine.removeMarker(m2, '_start');
  assert.equal(m4.length, 3, 'cannot remove _start');
}

/* 9) moveMarker */
{
  let m = Engine.defaultMarkers(0, 4.0, 0);
  m = Engine.insertMarker(m, 'w1', 2.0, 2.0, false);
  m = Engine.moveMarker(m, 'w1', 3.0);
  assert.equal(m[1].timelineTime, 3.0, 'moved');
}

/* 10) effectiveDuration */
{
  const m = Engine.defaultMarkers(0, 4.0, 0);
  assert.equal(Engine.effectiveDuration(m), 4.0, 'default dur');
  const m2 = Engine.insertMarker(m, 'w1', 2.0, 2.0, false);
  assert.equal(Engine.effectiveDuration(m2), 4.0, 'with marker');
}

/* 11) stretchRatioAt */
{
  const m = Engine.defaultMarkers(0, 4.0, 0);
  assert.equal(Engine.stretchRatioAt(2.0, m), 1.0, 'no warp');
  const m2 = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: '_end',   sourceTime: 4.0, timelineTime: 2.0, pinned: true }
  ];
  assert.equal(Engine.stretchRatioAt(1.0, m2), 2.0, 'compression 2x');
}

/* 12) applyWarpDrag */
{
  let m = Engine.defaultMarkers(0, 4.0, 0);
  m = Engine.insertMarker(m, 'w1', 2.0, 2.0, false);
  const m2 = Engine.applyWarpDrag(m, 1, 3.0);
  assert.equal(m2[1].timelineTime, 3.0, 'dragged');
  // should not go past end
  const m3 = Engine.applyWarpDrag(m, 1, 10.0);
  assert.ok(m3[1].timelineTime < 4.0, 'clamped to before end');
}

/* 13) clamp edge cases */
{
  assert.equal(Engine.clamp(5, 0, 10), 5, 'in range');
  assert.equal(Engine.clamp(-1, 0, 10), 0, 'below min');
  assert.equal(Engine.clamp(15, 0, 10), 10, 'above max');
}

/* 14) timelineToSource with null/empty markers */
{
  assert.equal(Engine.timelineToSource(1.0, null), null, 'null markers');
  assert.equal(Engine.timelineToSource(1.0, []), null, 'empty markers');
  assert.equal(Engine.timelineToSource(1.0, [{ id: 'a', sourceTime: 0, timelineTime: 0 }]), null, 'single marker');
}

/* 15) round-trip: timelineToSource → sourceToTimeline */
{
  const m = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: 'w1', sourceTime: 1.5, timelineTime: 2.0, pinned: false },
    { id: '_end', sourceTime: 3.0, timelineTime: 5.0, pinned: true }
  ];
  for (let t = 0; t <= 5; t += 0.5) {
    const src = Engine.timelineToSource(t, m);
    const tl = Engine.sourceToTimeline(src, m);
    assert.ok(Math.abs(tl - t) < 1e-6, `round-trip at t=${t}: got ${tl}`);
  }
}

/* 16) snapToGrid callback in moveMarker */
{
  let m = Engine.defaultMarkers(0, 4.0, 0);
  m = Engine.insertMarker(m, 'w1', 2.0, 2.0, false);
  const snapFn = v => Math.round(v * 4) / 4; // snap to 0.25
  m = Engine.moveMarker(m, 'w1', 2.1, snapFn);
  assert.equal(m[1].timelineTime, 2.0, 'snapped to 2.0');
  m = Engine.moveMarker(m, 'w1', 2.3, snapFn);
  assert.equal(m[1].timelineTime, 2.25, 'snapped to 2.25');
}

/* 17) defaultMarkers with sourceOffset (trimmed clip) */
{
  const m = Engine.defaultMarkers(2.0, 3.0, 0, 1.5);
  assert.equal(m.length, 2, 'offset markers count');
  assert.equal(m[0].sourceTime, 1.5, 'start source includes offset');
  assert.equal(m[0].timelineTime, 2.0, 'start timeline');
  assert.equal(m[1].sourceTime, 4.5, 'end source = offset + duration');
  assert.equal(m[1].timelineTime, 5.0, 'end timeline');
}

/* 18) segments — three-marker anchor layout */
{
  const m = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: 'w1', sourceTime: 2, timelineTime: 3, pinned: false },
    { id: '_end', sourceTime: 4, timelineTime: 5, pinned: true }
  ];
  const segs = Engine.segments(m);
  assert.equal(segs.length, 2, 'two segments');
  assert.equal(segs[0].srcStart, 0, 'seg1 srcStart');
  assert.equal(segs[0].srcEnd, 2, 'seg1 srcEnd');
  assert.equal(segs[0].tlStart, 0, 'seg1 tlStart');
  assert.equal(segs[0].tlEnd, 3, 'seg1 tlEnd');
  assert.ok(Math.abs(segs[0].ratio - 2 / 3) < 1e-9, 'seg1 ratio (stretch)');
  assert.ok(Math.abs(segs[1].ratio - 1) < 1e-9, 'seg2 ratio (identity)');
  assert.deepEqual(Engine.segments(null), [], 'null segments');
  assert.deepEqual(Engine.segments([{ id: 'a', sourceTime: 0, timelineTime: 0 }]), [], 'single marker');
}

/* 19) markersKey — stable for equal sets, distinct after edits */
{
  const a = Engine.defaultMarkers(0, 4, 0);
  const b = Engine.defaultMarkers(0, 4, 0);
  assert.equal(Engine.markersKey(a), Engine.markersKey(b), 'equal sets → equal key');
  const c = Engine.insertMarker(a, 'w1', 2, 2.5, false);
  assert.notEqual(Engine.markersKey(a), Engine.markersKey(c), 'edited set → different key');
  // 1ms rounding keeps jitter from thrashing the cache
  const jittered = c.map(m => ({ ...m, timelineTime: m.timelineTime + 0.0004 }));
  assert.equal(Engine.markersKey(c), Engine.markersKey(jittered), 'sub-ms jitter → same key');
  assert.equal(Engine.markersKey(null), 'none', 'null key');
}

/* 20) isWarped */
{
  assert.equal(Engine.isWarped(Engine.defaultMarkers(0, 4, 0)), false, 'identity not warped');
  assert.equal(Engine.isWarped(null), false, 'null not warped');
  const warped = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: '_end', sourceTime: 4, timelineTime: 2, pinned: true }
  ];
  assert.equal(Engine.isWarped(warped), true, 'compressed set is warped');
}

/* 21) resamplePeaksThroughWarp — identity */
{
  const peaks = Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const identity = Engine.defaultMarkers(0, 10, 0);
  const out = Engine.resamplePeaksThroughWarp(peaks, 10, identity, 10);
  assert.equal(out.length, 10, 'identity bucket count');
  for (let i = 0; i < 10; i += 1) {
    assert.equal(out[i], peaks[i], `identity bucket ${i}`);
  }
}

/* 22) resamplePeaksThroughWarp — 2x compression */
{
  const peaks = Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const compressed = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: '_end', sourceTime: 10, timelineTime: 5, pinned: true }
  ];
  const out = Engine.resamplePeaksThroughWarp(peaks, 10, compressed, 6);
  assert.equal(out.length, 6, 'compressed bucket count');
  assert.equal(out[0], peaks[0], 't=0 → src 0');
  // 6 buckets over 5s: bucket i sits at t=i → source 2i
  assert.equal(out[2], peaks[4], 't=2 → src 4');
  assert.equal(out[3], peaks[6], 't=3 → src 6');
  // last bucket sits at t=5 → source 10 → clamped to last peak
  assert.equal(out[5], peaks[9], 'end clamps to last peak');
}

console.log('free-warp-engine.test.js — all assertions passed.');
