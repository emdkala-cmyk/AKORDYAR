const fs = require('fs');
// Grid logic now lives in the core application chunk.
const path = 'js/app/core.js';
let src = fs.readFileSync(path, 'utf8');

const edits = [
  // ۱) applyQuantize: ارسال bpm به کانفیگ + واحد ضرب بر اساس مخرج
  { n: 1,
    old: `      const config = getTimeSignatureGridConfig(sig);
      const beatDur = 60 / bpm;
      const barDur = beatDur * config.beatsPerMeasure; // مدت زمان یک میزان بر اساس تعداد ضرب‌ها`,
    neu: `      const config = getTimeSignatureGridConfig(sig, bpm);
      const beatDur = config.beatDuration; // مدت واحد مخرج (سیاه در x/4، چنگ در x/8)
      const barDur = config.measureDuration; // مدت زمان یک میزان بر اساس Time Signature فعال` },
  // ۲) quantizeSelectedChords + drawLaneGrid + renderRuler (سه بلاک یکسان)
  { n: 3,
    old: `      const beatsPerBar = parseInt(sig.split('/')[0]);
      const beatDur = 60 / bpm;
      const barDur = beatDur * beatsPerBar;`,
    neu: `      const config = getTimeSignatureGridConfig(sig, bpm);
      const beatsPerBar = config.beatsPerMeasure;
      const beatDur = config.beatDuration; // مدت واحد مخرج (سیاه در x/4، چنگ در x/8)
      const barDur = config.measureDuration;` },
  // ۳) timeToBarBeat
  { n: 1,
    old: `      const beatsPerBar = parseInt(sig.split('/')[0]);
      const beatDur = 60 / bpm; // seconds per beat
      const barDur = beatDur * beatsPerBar; // seconds per bar`,
    neu: `      const config = getTimeSignatureGridConfig(sig, bpm);
      const beatsPerBar = config.beatsPerMeasure;
      const beatDur = config.beatDuration; // seconds per beat (واحد مخرج)
      const barDur = config.measureDuration; // seconds per bar` },
  // ۴) barBeatToTime — با measureDuration (خواناتر)
  { n: 1,
    old: `      const beatsPerBar = parseInt(sig.split('/')[0]);
      const beatDur = 60 / bpm;
      return ((bar - 1) * beatsPerBar + (beat - 1)) * beatDur;`,
    neu: `      const config = getTimeSignatureGridConfig(sig, bpm);
      return ((bar - 1) * config.measureDuration) + ((beat - 1) * config.beatDuration);` },
  // ۵) ساب‌بیت‌های drawLaneGrid بر اساس subdivisionsPerBeat
  { n: 1,
    old: `      if (pxPerSec > 40) {
        const subBeatDur = beatDur / 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        let subCount = 0;
        for (let sub = 0; sub * subBeatDur <= total && subCount < maxLines; sub++) {
          if (sub % 4 === 0) continue;`,
    neu: `      if (pxPerSec > 40) {
        const subBeatDur = beatDur / config.subdivisionsPerBeat;
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        let subCount = 0;
        for (let sub = 0; sub * subBeatDur <= total && subCount < maxLines; sub++) {
          if (sub % config.subdivisionsPerBeat === 0) continue;` },
  // ۶) ساب‌بیت‌های رولر: برای همه ضرب‌ها و بر اساس سیگنچر
  { n: 1,
    old: `        // ساب‌بیت (زوم خیلی زیاد)
        if (showSubBeats) {
          for (let sub = 1; sub < 4; sub++) {
            const sx = x + sub * (beatDur / 4) * pxPerSec;
            if (sx > cappedWidth) break;
            rctx.strokeStyle = 'rgba(45, 55, 72, 0.25)';
            rctx.lineWidth = 1;
            rctx.beginPath(); rctx.moveTo(sx + 0.5, 28); rctx.lineTo(sx + 0.5, 32); rctx.stroke();
          }
        }`,
    neu: `        // ساب‌بیت (زوم خیلی زیاد) — برای همه ضرب‌های میزان، بر اساس سیگنچر
        if (showSubBeats) {
          const subDiv = config.subdivisionsPerBeat;
          for (let beat = 0; beat < beatsPerBar; beat++) {
            for (let sub = 1; sub < subDiv; sub++) {
              const sx = x + (beat + sub / subDiv) * beatDur * pxPerSec;
              if (sx > cappedWidth) break;
              rctx.strokeStyle = 'rgba(45, 55, 72, 0.25)';
              rctx.lineWidth = 1;
              rctx.beginPath(); rctx.moveTo(sx + 0.5, 28); rctx.lineTo(sx + 0.5, 32); rctx.stroke();
            }
          }
        }` },
  // ۷) مترونوم
  { n: 1,
    old: `      const bpm = parseInt($('edTempo')?.value) || 120;
      const sig = $('edTimeSig')?.value || '4/4';
      const beatsPerBar = parseInt(sig.split('/')[0]);
      const beatDur = 60 / bpm;
      const currentBeat = Math.floor(playheadTime / beatDur);`,
    neu: `      const bpm = parseInt($('edTempo')?.value) || 120;
      const sig = $('edTimeSig')?.value || '4/4';
      const config = getTimeSignatureGridConfig(sig, bpm);
      const beatsPerBar = config.beatsPerMeasure;
      const beatDur = config.beatDuration;
      const currentBeat = Math.floor(playheadTime / beatDur);` },
  // ۸) شمارش قبل از پخش (count-in)
  { n: 1,
    old: `        const bpm = parseInt($('edTempo')?.value) || 120;
        const sig = $('edTimeSig')?.value || '4/4';
        const beatsPerBar = parseInt(sig.split('/')[0]);
        const beatDur = 60 / bpm;
        let countBeat = 0;`,
    neu: `        const bpm = parseInt($('edTempo')?.value) || 120;
        const sig = $('edTimeSig')?.value || '4/4';
        const config = getTimeSignatureGridConfig(sig, bpm);
        const beatsPerBar = config.beatsPerMeasure;
        const beatDur = config.beatDuration;
        let countBeat = 0;` },
  // ۹) گرید پاپ‌آپ متن ترانه (در scope window اصلی اجرا می‌شود — امن)
  { n: 1,
    old: `        const _gbeatsPerBar = parseInt(_gsig.split('/')[0]);
        const _gbeatDur = 60 / _gbpm;
        const _gbarDur = _gbeatDur * _gbeatsPerBar;`,
    neu: `        const _gcfg = getTimeSignatureGridConfig(_gsig, _gbpm);
        const _gbeatsPerBar = _gcfg.beatsPerMeasure;
        const _gbeatDur = _gcfg.beatDuration;
        const _gbarDur = _gcfg.measureDuration;` },
  // ۱۰) ساب‌بیت پاپ‌آپ
  { n: 1,
    old: `          const _gSubBeatDur = _gbeatDur / 4;
          _gctx.strokeStyle = 'rgba(255,255,255,0.02)';
          let _gSubCount = 0;
          for (let _sub = 0; _sub * _gSubBeatDur <= _glen && _gSubCount < 500; _sub++) {
            if (_sub % 4 === 0) continue;`,
    neu: `          const _gSubBeatDur = _gbeatDur / _gcfg.subdivisionsPerBeat;
          _gctx.strokeStyle = 'rgba(255,255,255,0.02)';
          let _gSubCount = 0;
          for (let _sub = 0; _sub * _gSubBeatDur <= _glen && _gSubCount < 500; _sub++) {
            if (_sub % _gcfg.subdivisionsPerBeat === 0) continue;` },
  // ۱۱) جابه‌جایی پلی‌هد با کلیدهای جهت‌دار
  { n: 1,
    old: `        const barDur = 60 / (parseInt($('edTempo')?.value) || 120) * parseInt(($('edTimeSig')?.value || '4/4').split('/')[0]);`,
    neu: `        const barDur = getTimeSignatureGridConfig(($('edTimeSig')?.value || '4/4'), (parseInt($('edTempo')?.value) || 120)).measureDuration;` },
  // ۱۲) بازرسم فوری گرید هنگام تغییر سیگنچر (renderTracks لازم است — renderClips گرید را بازرسم نمی‌کند)
  { n: 1,
    old: `    if ($('edTimeSig')) $('edTimeSig').onchange = () => { if (edCur) { edCur.timeSignature = $('edTimeSig').value; edSaveSong(); } };`,
    neu: `    if ($('edTimeSig')) $('edTimeSig').onchange = () => { if (edCur) { edCur.timeSignature = $('edTimeSig').value; edSaveSong(); renderTracks(); renderRuler(); renderClips(); } };` }
];

for (let i = 0; i < edits.length; i++) {
  const e = edits[i];
  const count = src.split(e.old).length - 1;
  if (count !== e.n) {
    console.error('Edit #' + (i + 1) + ': expected ' + e.n + ' match(es), found ' + count + '. Aborting, file NOT modified.');
    process.exit(1);
  }
  src = src.split(e.old).join(e.neu);
  console.log('Edit #' + (i + 1) + ': applied (' + count + ')');
}
fs.writeFileSync(path, src, 'utf8');
console.log('Done.');
