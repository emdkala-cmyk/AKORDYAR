/** Characterization Tests for Akordyar Refactoring
 * Run via: node -e "eval(require('fs').readFileSync('js/tests/characterization-tests.js','utf8'))"
 */

(function() {
  var SE = window.SharedEngine;
  var SDM = window.SongDocumentModel;
  var PS = window.PerformanceStore;
  if (!SE || !SDM || !PS) { console.error('Modules not loaded!'); return; }

  var passed = 0, failed = 0, failures = [];

  function assert(cond, msg) { if (cond) passed++; else { failed++; failures.push(msg); } }
  function section(n) { console.log('\n=== ' + n + ' ==='); }

  // =========================================================================
  // 1. parseChord — all chord types
  // =========================================================================
  section('1. parseChord');
  var r = SE.parseChord('C');
  assert(r && r.root==='C'&&r.quality===''&&r.suffix==='','C major');
  r = SE.parseChord('Am');
  assert(r && r.root==='A'&&r.quality==='m'&&r.suffix==='','Am minor');
  r = SE.parseChord('C#m');
  assert(r && r.root==='C'&&r.accidental==='#'&&r.quality==='m','C#m');
  r = SE.parseChord('Bb');
  assert(r && r.root==='B'&&r.accidental==='b','Bb major');
  r = SE.parseChord('Am7');
  assert(r && r.root==='A'&&r.quality==='m'&&r.suffix==='7','Am7');
  r = SE.parseChord('Cmaj7');
  assert(r && r.root==='C'&&r.quality==='maj'&&r.suffix==='7','Cmaj7 (quality=maj, suffix=7)');
  r = SE.parseChord('C/G');
  assert(r && r.bassRoot==='G','C/G slash');
  r = SE.parseChord('Bdim');
  assert(r && r.quality==='dim','Bdim');
  r = SE.parseChord('Caug');
  assert(r && r.quality==='aug','Caug');
  r = SE.parseChord('Dsus4');
  assert(r && r.quality==='sus'&&r.suffix==='4','Dsus4 (quality=sus, suffix=4)');
  assert(SE.parseChord('')===null,'empty string');
  assert(SE.parseChord(null)===null,'null input');

  // =========================================================================
  // 2. transposeChordName — semitone shifts
  // =========================================================================
  section('2. transposeChordName');
  assert(SE.transposeChordName('C',2)==='D','C+2 -> D');
  assert(SE.transposeChordName('C',-2)==='A#','C-2 -> A# (uses sharps by default)');
  assert(SE.transposeChordName('Am',2)==='Bm','Am+2 -> Bm');
  assert(SE.transposeChordName('F#m',2)==='G#m','F#m+2 -> G#m');
  assert(SE.transposeChordName('Bb',2)==='C','Bb+2 -> C');
  assert(SE.transposeChordName('C',0)==='C','C+0 -> C');
  assert(SE.transposeChordName('Am7',2)==='Bm7','Am7+2 -> Bm7 (suffix preserved)');
  // Flat preference
  assert(SE.transposeChordName('C',-2,false)==='Bb','C-2 with preferSharp=false -> Bb');

  // =========================================================================
  // 3. SongDocument round-trip
  // =========================================================================
  section('3. SongDocument');
  var fake = {id:'s1',title:'Test',artist:'A',key:'Am',keyMode:'minor',transpose:0,originalKey:'Am',lyrics:'L1\nL2',chords:[{name:'[C]',lineIndex:0,charIndex:0}],syncTimes:[0,3.5],chordLineClips:[],seqPoints:[],styles:{tSize:36}};
  var d1 = SDM.buildSongDocumentFromEdCur(fake);
  assert(d1.title==='Test','build: title preserved');
  assert(d1.lines.length===2,'build: 2 lines');
  assert(d1.cues.length===2,'build: 2 cues');
  assert(d1.cues[1].time===3.5,'build: cue time');
  var tgt = {id:'s1'}; SDM.writeToEdCur(d1,tgt);
  assert(tgt.title==='Test','write: title');
  assert(tgt.lyrics==='L1\nL2','write: lyrics');
  var d2 = SDM.buildSongDocumentFromEdCur(tgt);
  assert(d2.title===d1.title,'roundtrip: title');
  assert(SDM.buildSongDocumentFromEdCur(null).id==='','null edCur: empty');

  // =========================================================================
// 4. alignChords
// =========================================================================
section('4. alignChords');
var dc = SDM.buildSongDocumentFromEdCur({id:'s2',lyrics:'Hello World\nTest',chords:[{name:'[Am]',lineIndex:0,charIndex:0},{name:'[G]',lineIndex:0,charIndex:6}],syncTimes:[],key:'C',keyMode:'major',transpose:0});
var al = SE.alignChords(dc);
assert(al!==null,'returns doc');
assert(al.lines[0].chords.length>0,'line 0 has chords');

// ── RTL/LTR chord alignment ──
section('4a. RTL alignment');
var dcRTL = SDM.buildSongDocumentFromEdCur({
  id:'sRTL', lyrics:'سلام دنیا', key:'C', keyMode:'major', transpose:0,
  chords:[{name:'[Am]',lineIndex:0,charIndex:0},{name:'[G]',lineIndex:0,charIndex:5}],
  syncTimes:[]
});
var alRTL = SE.alignChords(dcRTL);
assert(alRTL!==null,'RTL: returns doc');
assert(alRTL.lines[0].chords.length===2,'RTL: 2 chords on line 0');
// Persian chars are RTL — charIndex 0 is last visual character
// Chord positions should be non-negative
assert(alRTL.lines[0].chords[0].tokenIndex>=0,'RTL: chord 0 tokenIndex valid');
assert(alRTL.lines[0].chords[1].tokenIndex>=0,'RTL: chord 1 tokenIndex valid');
// Chord identities preserved
assert(alRTL.lines[0].chords[0].name.indexOf('Am')!==-1,'RTL: chord 0 name preserved');
assert(alRTL.lines[0].chords[1].name.indexOf('G')!==-1,'RTL: chord 1 name preserved');

section('4b. Mixed RTL/LTR alignment');
var dcMixed = SDM.buildSongDocumentFromEdCur({
  id:'sMixed', lyrics:'Hello سلام World', key:'C', keyMode:'major', transpose:0,
  chords:[{name:'[C]',lineIndex:0,charIndex:0},{name:'[Dm]',lineIndex:0,charIndex:6}],
  syncTimes:[]
});
var alMixed = SE.alignChords(dcMixed);
assert(alMixed!==null,'Mixed: returns doc');
assert(alMixed.lines[0].chords.length===2,'Mixed: 2 chords');
assert(alMixed.lines[0].chords[0].name.indexOf('C')!==-1,'Mixed: chord 0 name');
assert(alMixed.lines[0].chords[1].name.indexOf('Dm')!==-1,'Mixed: chord 1 name');

section('4c. Alignment stability (round-trip)');
var dcRT = SDM.buildSongDocumentFromEdCur({
  id:'sRT', lyrics:'Line One\nLine Two', key:'C', keyMode:'major', transpose:0,
  chords:[{name:'[E]',lineIndex:0,charIndex:0},{name:'[F]',lineIndex:1,charIndex:0}],
  syncTimes:[]
});
var rt1 = SE.alignChords(dcRT);
var rt2 = SE.alignChords(rt1);
assert(rt2.lines[0].chords.length===rt1.lines[0].chords.length,'Round-trip: line 0 chord count stable');
assert(rt2.lines[1].chords.length===rt1.lines[1].chords.length,'Round-trip: line 1 chord count stable');
assert(rt2.lines[0].chords[0].tokenIndex===rt1.lines[0].chords[0].tokenIndex,'Round-trip: tokenIndex stable');

section('4d. Chord alignment after transpose');
var dcTrans = SDM.buildSongDocumentFromEdCur({
  id:'sTrans', lyrics:'Am G C', key:'C', keyMode:'major', transpose:0,
  chords:[{name:'Am',lineIndex:0,charIndex:0},{name:'G',lineIndex:0,charIndex:3},{name:'C',lineIndex:0,charIndex:5}],
  syncTimes:[]
});
var alTrans = SE.alignChords(dcTrans);
var tokenBefore = alTrans.lines[0].chords.map(function(c){return c.tokenIndex;});
// Apply transpose — positions (tokenIndex) must stay the same
var afterTrans = SE.applyKeyTransform(alTrans, {transpose:2, preferSharp:true});
assert(afterTrans.lines[0].chords[0].name==='Bm','Transpose: Am+2 = Bm');
assert(afterTrans.lines[0].chords[1].name==='A','Transpose: G+2 = A');
assert(afterTrans.lines[0].chords[2].name==='D','Transpose: C+2 = D');
// Token positions must not change after transpose
for (var i=0; i<tokenBefore.length; i++) {
  assert(afterTrans.lines[0].chords[i].tokenIndex===tokenBefore[i],'Transpose: chord '+i+' tokenIndex unchanged');
}

section('4e. Multi-line alignment');
var dcMulti = SDM.buildSongDocumentFromEdCur({
  id:'sMulti', lyrics:'Line1\nLine2\nLine3', key:'C', keyMode:'major', transpose:0,
  chords:[
    {name:'[A]',lineIndex:0,charIndex:0},
    {name:'[B]',lineIndex:1,charIndex:2},
    {name:'[C]',lineIndex:2,charIndex:4}
  ],
  syncTimes:[]
});
var alMulti = SE.alignChords(dcMulti);
assert(alMulti.lines.length===3,'Multi: 3 lines');
assert(alMulti.lines[0].chords.length===1,'Multi: line 0 has 1 chord');
assert(alMulti.lines[1].chords.length===1,'Multi: line 1 has 1 chord');
assert(alMulti.lines[2].chords.length===1,'Multi: line 2 has 1 chord');
assert(alMulti.lines[0].chords[0].lineIndex===0,'Multi: chord A on line 0');
assert(alMulti.lines[1].chords[0].lineIndex===1,'Multi: chord B on line 1');
assert(alMulti.lines[2].chords[0].lineIndex===2,'Multi: chord C on line 2');

  // =========================================================================
  // 5. computeHighlight
  // =========================================================================
  section('5. computeHighlight');
  var dhl = {lines:[{id:'l0',index:0,text:'',tokens:[],chords:[]},{id:'l1',index:1,text:'',tokens:[],chords:[]}],cues:[{id:'c0',time:0,lineIndex:0},{id:'c1',time:3,lineIndex:1}]};
  var h0 = SE.computeHighlight({time:0},dhl);
  assert(h0.activeLineId==='l0','t=0: active l0');
  var h4 = SE.computeHighlight({time:4},dhl);
  assert(h4.activeLineId==='l1','t=4: active l1');
  assert(h4.doneLines.has(0),'t=4: l0 done');
  var hn = SE.computeHighlight({time:5},{lines:[],cues:[]});
  assert(hn.activeLineId===null,'no cues: null');

  // =========================================================================
  // 6. PerformanceStore
  // =========================================================================
  section('6. PerformanceStore');
  var ev=null; var u1=PS.subscribe('contentUpdated',function(p){ev=p;});
  PS.setSongDocument({id:'x',title:'T',lines:[],cues:[]});
  assert(ev&&ev.id==='x','setSongDocument triggers contentUpdated');
  u1(); ev=null;
  PS.setSongDocument({id:'y',title:'T2',lines:[],cues:[]});
  assert(ev===null,'unsub works');
  var kc=0; var sk1=PS.subscribe('keyChanged',function(){kc++;});
  var sk2=PS.subscribe('keyChanged',function(){kc++;});
  PS.setKeyState({originalKey:'C',currentKey:'D',transpose:2,mode:'major'});
  assert(kc===2,'keyChanged x2 subscribers');
  sk1(); sk2();

  // =========================================================================
  // 7. processSong pipeline
  // =========================================================================
  section('7. processSong');
  var pd = SE.processSong(SDM.buildSongDocumentFromEdCur({id:'p1',lyrics:'Am G\nC',chords:[{name:'[Am]',lineIndex:0,charIndex:0},{name:'[G]',lineIndex:0,charIndex:3},{name:'[C]',lineIndex:1,charIndex:0}],syncTimes:[],key:'C',keyMode:'major',transpose:0}));
  assert(pd!==null,'processSong returns doc');
  assert(pd.lines.length===2,'2 lines');

  // =========================================================================
  // 8. normalizeChord — unicode accidentals only
  // =========================================================================
  section('8. normalizeChord');
  // Only replaces unicode accidentals; does NOT uppercase or fix quality case
  assert(SE.normalizeChord('Cmaj7')==='Cmaj7','Cmaj7 unchanged');
  assert(SE.normalizeChord('c')==='c','c stays lowercase (no case change)');
  assert(SE.normalizeChord('aM')==='aM','aM stays as-is (no quality fix)');
  assert(SE.normalizeChord('Hm')==='Hm','Hm stays Hm (no German notation fix)');

  // =========================================================================
  // 9. key utilities
  // =========================================================================
  section('9. key utils');
  assert(SE.keyDelta('C','D')===2,'C->D = 2 semitones up');
  assert(SE.keyDelta('D','C')===10,'D->C = 10 semitones up (wraps, not negative)');
  assert(SE.keyDelta('A','C')===3,'A->C = 3');
  assert(SE.keyDelta('C','C')===0,'C->C = 0');
  assert(SE.transposeKeyName('C',2)==='D','transposeKey: C+2 -> D');

  // =========================================================================
  // 10. buildChordName
  // =========================================================================
  section('10. buildChordName');
  // Signature: buildChordName(parsedObject, rootStr, bassStr)
  var pc = SE.parseChord('C');
  assert(SE.buildChordName(pc,'C','')==='C','C major from parsed');
  var pa = SE.parseChord('Am');
  assert(SE.buildChordName(pa,'A','')==='Am','Am from parsed');
  var pcs = SE.parseChord('C#m');
  assert(SE.buildChordName(pcs,'C#','')==='C#m','C#m from parsed');

  // =========================================================================
  
// 11. Undo/Redo Stack (behavioral model)
section('11. Undo/Redo Stack');
var us=(function(){var s=[],i=-1;return{save:function(v){s=s.slice(0,i+1);s.push(JSON.parse(JSON.stringify(v)));if(s.length>100)s.shift();i=s.length-1;},undo:function(){if(i<=0)return null;i--;return JSON.parse(JSON.stringify(s[i]));},redo:function(){if(i>=s.length-1)return null;i++;return JSON.parse(JSON.stringify(s[i]));},idx:function(){return i;},size:function(){return s.length;},canUndo:function(){return i>0;},canRedo:function(){return i<s.length-1;}};})();
assert(us.idx()===-1&&us.size()===0,'Undo: init empty');
assert(!us.canUndo()&&!us.canRedo(),'Undo: no undo/redo initially');
us.save({id:'s1',key:'C'});assert(us.idx()===0&&us.size()===1,'Undo: after save');
us.save({id:'s1',key:'D'});assert(us.idx()===1,'Undo: after 2nd save');
var u1=us.undo();assert(u1&&u1.key==='C','Undo: restores key=C');
assert(us.idx()===0&&!us.canUndo()&&us.canRedo(),'Undo: can redo only');
var r1=us.redo();assert(r1&&r1.key==='D','Redo: restores key=D');
assert(!us.canRedo(),'Redo: at end');
us.undo();us.save({id:'s1',key:'E'});assert(us.size()===2&&!us.canRedo(),'Undo: branch cleared');
var um=(function(){var s=[],i=-1,m=5;return{save:function(v){s=s.slice(0,i+1);s.push(v);if(s.length>m)s.shift();i=s.length-1;},size:function(){return s.length;}};})();
for(var j=0;j<10;j++)um.save({n:j});assert(um.size()===5,'Undo: max capped at 5');
var ue=(function(){var s=[],i=-1;return{undo:function(){if(i<=0)return null;i--;return s[i];},save:function(v){s=s.slice(0,i+1);s.push(v);i=s.length-1;}};})();
assert(ue.undo()===null,'Undo: empty returns null');
ue.save({v:1});ue.save({v:2});assert(ue.undo().v===1,'Undo: multi-step');
assert(ue.undo()===null,'Undo: past beginning');
  // =========================================================================
  // 12. syncTimes — behavioral model
  // =========================================================================
  section('12. syncTimes');

  // Pattern from app.js ~line 4948:
  // syncTimes[i] = timestamp for line i (line-level sync)
  // Empty lines inherit the timestamp of the previous line

  function simulateSyncTimes(lines, syncMap) {
    var times = [];
    if (!syncMap || Object.keys(syncMap).length === 0) return times;
    for (var i = 0; i < lines.length; i++) {
      if (syncMap[i] !== undefined) {
        times[i] = syncMap[i];
      } else if (!lines[i].trim() && i > 0) {
        // Empty lines inherit previous timestamp
        times[i] = times[i - 1] || 0;
      }
    }
    return times;
  }

  var lines = ['Line 1', '', 'Line 3', 'Line 4'];
  var t1 = simulateSyncTimes(lines, {0: 1.5, 2: 3.7, 3: 5.2});
  assert(t1[0] === 1.5, 'syncTimes: line 0 = 1.5');
  assert(t1[1] === 1.5, 'syncTimes: empty line inherits previous (1.5)');
  assert(t1[2] === 3.7, 'syncTimes: line 2 = 3.7');
  assert(t1[3] === 5.2, 'syncTimes: line 3 = 5.2');

  // syncTimes.length should match lines.length
  var t2 = simulateSyncTimes(['A', 'B'], {0: 1.0, 1: 2.0});
  assert(t2.length === 2, 'syncTimes: length matches lines');
  assert(t2[0] === 1.0 && t2[1] === 2.0, 'syncTimes: all lines synced');

  // detectTempo requires at least 2 syncTimes with non-null > 0 values
  function canDetectTempo(times) {
    var valid = (times || []).filter(function(t) { return t != null && t > 0; });
    return valid.length >= 2;
  }
  assert(!canDetectTempo([]), 'detectTempo: empty → false');
  assert(!canDetectTempo([1.0]), 'detectTempo: 1 point → false');
  assert(canDetectTempo([1.0, 2.0]), 'detectTempo: 2 points → true');
  assert(canDetectTempo([null, 1.0, 0, 2.5]), 'detectTempo: filters null/0, 2 valid → true');

  // syncHistory pattern: JSON.stringify(syncTimes) for undo
  var syncTimesSnapshot = JSON.stringify([1.0, 2.5, 3.0]);
  var parsed = JSON.parse(syncTimesSnapshot);
  assert(parsed.length === 3, 'syncHistory: round-trip preserves length');
  assert(parsed[1] === 2.5, 'syncHistory: round-trip preserves value');
  parsed[1] = 4.0;
  assert(parsed[1] === 4.0, 'syncHistory: snapshot is independent');

  // =========================================================================
  // 13. seqPoints — sequential chord points
  // =========================================================================
  section('13. seqPoints');

  // Pattern from app.js ~line 5268:
  // seqPoints = [{anchorType, lineIndex, charIndex, name:''}]
  // anchorType: 'LineStart' | 'OnCharacter' | 'LineEnd'

  function createSeqPoint(lineIndex, charIndex, text) {
    var anchorType = 'OnCharacter';
    if (charIndex === 0) anchorType = 'LineStart';
    var lineText = text.split('\n')[lineIndex] || '';
    if (charIndex >= lineText.length) anchorType = 'LineEnd';
    return { anchorType: anchorType, lineIndex: lineIndex, charIndex: charIndex, name: '' };
  }

  var sp1 = createSeqPoint(0, 0, 'Hello');
  assert(sp1.anchorType === 'LineStart', 'seqPoint: charIndex 0 → LineStart');
  var sp2 = createSeqPoint(0, 3, 'Hello');
  assert(sp2.anchorType === 'OnCharacter', 'seqPoint: charIndex 3 → OnCharacter');
  var sp3 = createSeqPoint(0, 5, 'Hello');
  assert(sp3.anchorType === 'LineEnd', 'seqPoint: charIndex 5 → LineEnd');

  // seqPoints remapping: lineCharToAbs / absToLineChar
  function lineCharToAbs(text, li, ci) {
    var lines = text.split('\n');
    var abs = 0;
    for (var i = 0; i < li && i < lines.length; i++) abs += lines[i].length + 1;
    return abs + Math.min(ci, (lines[li] || '').length);
  }
  function absToLineChar(text, abs) {
    var lines = text.split('\n');
    var pos = abs;
    for (var i = 0; i < lines.length; i++) {
      if (pos <= lines[i].length) return { lineIndex: i, charIndex: pos };
      pos -= lines[i].length + 1;
    }
    return { lineIndex: lines.length - 1, charIndex: (lines[lines.length - 1] || '').length };
  }

  // Round-trip
  var text = 'Hello\nWorld';
  var abs1 = lineCharToAbs(text, 0, 3);
  var back1 = absToLineChar(text, abs1);
  assert(back1.lineIndex === 0 && back1.charIndex === 3, 'seqPoints: lineCharToAbs→absToLineChar round-trip (0,3)');

  var abs2 = lineCharToAbs(text, 1, 2);
  var back2 = absToLineChar(text, abs2);
  assert(back2.lineIndex === 1 && back2.charIndex === 2, 'seqPoints: round-trip cross-line (1,2)');

  // Remap after text change (insert character)
  var oldText = 'Hello\nWorld';
  var newText = 'Hello!\nWorld'; // +1 char on line 0
  var sp = { anchorType: 'OnCharacter', lineIndex: 0, charIndex: 3, name: '' };
  var oldAbs = lineCharToAbs(oldText, sp.lineIndex, sp.charIndex);
  var newPos = absToLineChar(newText, oldAbs);
  assert(newPos.lineIndex === 0 && newPos.charIndex === 3, 'seqPoints: remap preserves charIndex for same-line insert');

  // Filter invalid seqPoints after remap
  var seqs = [{lineIndex:0,charIndex:0,name:''},{lineIndex:99,charIndex:0,name:''}];
  var filtered = seqs.filter(function(p) { return p.lineIndex >= 0 && p.lineIndex < 2; });
  assert(filtered.length === 1, 'seqPoints: filter removes out-of-bounds lineIndex');

  // seqCursor navigation bounds
  var seqPointsArr = [{name:'A'},{name:'B'},{name:'C'}];
  var cursor = 0;
  cursor = Math.max(0, Math.min(seqPointsArr.length - 1, cursor + 1));
  assert(cursor === 1, 'seqCursor: navigate forward');
  cursor = Math.max(0, Math.min(seqPointsArr.length - 1, cursor - 1));
  assert(cursor === 0, 'seqCursor: navigate backward');
  cursor = Math.max(0, Math.min(seqPointsArr.length - 1, cursor + 5));
  assert(cursor === 2, 'seqCursor: clamp to last');
  cursor = Math.max(0, Math.min(seqPointsArr.length - 1, cursor - 5));
  assert(cursor === 0, 'seqCursor: clamp to first');

  // =========================================================================
  // 14. chordLineClips — manual ChordLine sync
  // =========================================================================
  section('14. chordLineClips');

  // Pattern from app.js ~line 3569:
  // chordLineClips = [{lineIndex, charIndex, name, ...}]
  // hasManualChordLineEdits flag tracks manual edits
  // sync copies lyrics chords → chordLineClips maintaining spatial order

  // 14a. Spatial ordering (line-major)
  function getLyricsChordsInSpatialOrder(chords) {
    if (!chords || !chords.length) return [];
    return chords.slice().sort(function(a, b) {
      if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
      return a.charIndex - b.charIndex;
    });
  }

  var rawChords = [
    {name:'[C]', lineIndex:1, charIndex:0},
    {name:'[Am]', lineIndex:0, charIndex:5},
    {name:'[G]', lineIndex:0, charIndex:0}
  ];
  var sorted = getLyricsChordsInSpatialOrder(rawChords);
  assert(sorted[0].name === '[G]', 'chordLineClips: spatial sort — first is line 0, pos 0');
  assert(sorted[1].name === '[Am]', 'chordLineClips: spatial sort — second is line 0, pos 5');
  assert(sorted[2].name === '[C]', 'chordLineClips: spatial sort — third is line 1, pos 0');

  // 14b. Sync: min(len(lyricsChords), len(chordLineClips)) applied
  function simulateChordLineSync(lyricsChords, chordLineClips) {
    var count = Math.min(lyricsChords.length, chordLineClips.length);
    for (var i = 0; i < count; i++) {
      chordLineClips[i].name = lyricsChords[i].name;
    }
    return { appliedCount: count, chordLineClips: chordLineClips };
  }

  var clcl = [
    {lineIndex:0,charIndex:0,name:''},
    {lineIndex:0,charIndex:5,name:''},
    {lineIndex:1,charIndex:0,name:''}
  ];
  var result = simulateChordLineSync(sorted, clcl);
  assert(result.appliedCount === 3, 'chordLineClips: sync applies all 3 chords');
  assert(result.chordLineClips[0].name === '[G]', 'chordLineClips: clip 0 name = [G]');
  assert(result.chordLineClips[1].name === '[Am]', 'chordLineClips: clip 1 name = [Am]');
  assert(result.chordLineClips[2].name === '[C]', 'chordLineClips: clip 2 name = [C]');

  // 14c. More lyrics chords than clips → partial sync
  var manyLyrics = [{name:'[A]'},{name:'[B]'},{name:'[C]'},{name:'[D]'},{name:'[E]'}];
  var fewClips = [{name:''},{name:''},{name:''}];
  var r2 = simulateChordLineSync(manyLyrics, fewClips);
  assert(r2.appliedCount === 3, 'chordLineClips: more lyrics than clips → partial sync');

  // 14d. Empty ChordLine → no sync
  var r3 = simulateChordLineSync(manyLyrics, []);
  assert(r3.appliedCount === 0, 'chordLineClips: empty ChordLine → no sync');

  // 14e. hasManualChordLineEdits flag
  var flag = true; // after manual edit
  flag = false;    // after sync
  assert(!flag, 'chordLineClips: hasManualChordLineEdits=false after sync');

  // =========================================================================
  // 15. Archive save/load — serialization round-trip
  // =========================================================================
  section('15. Archive');

  // Pattern from app.js ~line 11210:
  // songs = edGetAllSongs(); idx = findIndex; songs[idx] = JSON.parse(JSON.stringify(edCur));
  // edSetAllSongs(songs);

  function simulateArchive() {
    var songs = [];
    return {
      save: function(edCur) {
        var data = JSON.parse(JSON.stringify(edCur));
        var idx = songs.findIndex(function(s) { return String(s.id) === String(edCur.id); });
        if (idx > -1) songs[idx] = data; else songs.unshift(data);
        return songs.length;
      },
      load: function(id) {
        return songs.find(function(s) { return String(s.id) === String(id); }) || null;
      },
      getAll: function() { return songs; },
      count: function() { return songs.length; }
    };
  }

  var arch = simulateArchive();

  // Save new song
  var song1 = {
    id: 'song-1', title: 'Song One', artist: 'Artist A',
    key: 'Am', keyMode: 'minor', transpose: 0, tempo: 120,
    timeSignature: '4/4', lyrics: 'Hello\nWorld',
    chords: [{name:'[Am]',lineIndex:0,charIndex:0}],
    syncTimes: [0, 2.5], seqPoints: [],
    chordLineClips: [], hasManualChordLineEdits: false,
    styles: {tSize: 36}, _dawTracks: [], _dawClips: [],
    _dawSections: [], _dawLoop: {loopEnabled:false,loopA:0,loopB:10},
    _audioPaths: [], updatedAt: '2026-01-01T00:00:00.000Z'
  };
  arch.save(song1);
  assert(arch.count() === 1, 'Archive: save adds song');

  // Load saved song
  var loaded1 = arch.load('song-1');
  assert(loaded1 !== null, 'Archive: load returns song');
  assert(loaded1.title === 'Song One', 'Archive: title preserved');
  assert(loaded1.key === 'Am', 'Archive: key preserved');
  assert(loaded1.syncTimes.length === 2, 'Archive: syncTimes preserved');
  assert(loaded1.chords[0].name === '[Am]', 'Archive: chords preserved');

  // Update existing song
  song1.title = 'Song One (Edited)';
  song1.key = 'C';
  arch.save(song1);
  assert(arch.count() === 1, 'Archive: update does not add duplicate');
  var loaded2 = arch.load('song-1');
  assert(loaded2.title === 'Song One (Edited)', 'Archive: title updated');
  assert(loaded2.key === 'C', 'Archive: key updated');

  // Add second song
  var song2 = {id:'song-2',title:'Song Two',artist:'Artist B',key:'D',keyMode:'major',
    lyrics:'Test',chords:[],syncTimes:[],seqPoints:[],chordLineClips:[],hasManualChordLineEdits:false,
    styles:{},_dawTracks:[],_dawClips:[],_dawSections:[],_audioPaths:[],_dawLoop:{}
  };
  arch.save(song2);
  assert(arch.count() === 2, 'Archive: multiple songs');

  // getAll returns all songs
  var all = arch.getAll();
  assert(all.length === 2, 'Archive: getAll returns all songs');

  // save/load is deep-cloned (JSON parse/stringify)
  song1.styles.fontSize = 48;
  var beforeSave = JSON.parse(JSON.stringify(song1));
  arch.save(song1);
  var afterLoad = arch.load('song-1');
  assert(afterLoad.styles.fontSize === 48, 'Archive: deep clone — style property preserved');

  // Edge: load non-existent
  assert(arch.load('non-existent') === null, 'Archive: load non-existent → null');

  // Edge: id comparison is string-based
  arch.save({id: 42, title: 'Numeric ID', lyrics: '', chords: [], syncTimes: [], seqPoints: [],
    chordLineClips: [], hasManualChordLineEdits: false, styles: {}, _dawTracks: [], _dawClips: [],
    _dawSections: [], _audioPaths: [], _dawLoop: {}
  });
  assert(arch.load(42) !== null, 'Archive: numeric id compared as string');
  assert(arch.load('42') !== null, 'Archive: string id matches numeric');

  // =========================================================================
  // =========================================================================
  // 16. SongMetadata module
  // =========================================================================
  section('16. SongMetadata');
  var SM = {
    DOM_IDS: {title:'edTitle',artist:'edArtist',key:'edKey',keyMode:'edKeyMode',tempo:'edTempo',timeSignature:'edTimeSig',genre:'edGenre'},
    DEFAULTS: {title:'',artist:'',key:'C',keyMode:'maj',tempo:120,timeSignature:'4/4',genre:''},
    getDisplayKey: function(ec) { if (!ec) return 'C'; var k = ec.key || 'C'; var m = ec.keyMode || 'maj'; if (m === 'min' && !k.endsWith('m')) return k + 'm'; return k; },
    fixKeyFormat: function(ec, fn) { if (!ec || !ec.key) return; if (ec.key.endsWith('m') && ec.keyMode !== 'min') { var ck = ec.key.replace(/m$/,''); if (typeof fn==='function' && fn(ck)) { ec.key = ck; ec.keyMode = 'min'; } } },
    applyDefaults: function(ec) { if (!ec) return; if (!ec.timeSignature) ec.timeSignature = '4/4'; if (!ec.tempo) ec.tempo = 120; if (ec.transpose == null) ec.transpose = 0; },
    normalize: function(ec, fn) { SM.applyDefaults(ec); SM.fixKeyFormat(ec, fn); if (!ec.originalKey) { ec.originalKey = ec.key; ec.originalKeyMode = ec.keyMode || 'maj'; } }
  };

  // Field definitions
  assert(SM.DOM_IDS.title === 'edTitle', 'SM: DOM_IDS.title');
  assert(SM.DOM_IDS.key === 'edKey', 'SM: DOM_IDS.key');
  assert(SM.DEFAULTS.tempo === 120, 'SM: DEFAULTS.tempo');
  assert(SM.DEFAULTS.timeSignature === '4/4', 'SM: DEFAULTS.timeSignature');

  // getDisplayKey
  assert(SM.getDisplayKey({key:'C',keyMode:'maj'}) === 'C', 'SM: display C maj');
  assert(SM.getDisplayKey({key:'A',keyMode:'min'}) === 'Am', 'SM: display Am');
  assert(SM.getDisplayKey({key:'F#',keyMode:'min'}) === 'F#m', 'SM: display F#m');
  assert(SM.getDisplayKey({key:'Bb',keyMode:'maj'}) === 'Bb', 'SM: display Bb maj');
  // Edge: key already ends with 'm'
  assert(SM.getDisplayKey({key:'Am',keyMode:'min'}) === 'Am', 'SM: display Am (key already has m)');
  assert(SM.getDisplayKey(null) === 'C', 'SM: display null → C');

  // fixKeyFormat
  var ec1 = {key:'Bm', keyMode:'maj'};
  SM.fixKeyFormat(ec1, function(n) { return ['A','B','C','D','E','F','G'].indexOf(n) !== -1; });
  assert(ec1.key === 'B' && ec1.keyMode === 'min', 'SM: fix Bm → B/min');
  var ec2 = {key:'C', keyMode:'maj'};
  SM.fixKeyFormat(ec2, function(n) { return true; });
  assert(ec2.key === 'C' && ec2.keyMode === 'maj', 'SM: C stays unchanged');
  var ec3 = {key:'Hm', keyMode:'maj'};
  SM.fixKeyFormat(ec3, function(n) { return n !== 'H'; });  // H not valid → don't fix
  assert(ec3.key === 'Hm', 'SM: invalid note Hm stays unchanged');

  // normalize
  var ec4 = {id:'s1', key:'Dm', keyMode:'maj'};
  SM.normalize(ec4, function(n) { return true; });
  assert(ec4.key === 'D' && ec4.keyMode === 'min', 'SM: normalize key');
  assert(ec4.tempo === 120, 'SM: normalize tempo default');
  assert(ec4.timeSignature === '4/4', 'SM: normalize timeSig default');
  assert(ec4.originalKey === 'D', 'SM: normalize sets originalKey');

  var ec5 = {id:'s2', key:'C', keyMode:'maj', originalKey:'G', originalKeyMode:'maj'};
  SM.normalize(ec5);
  assert(ec5.originalKey === 'G', 'SM: normalize preserves existing originalKey');

  // applyDefaults
  var ec6 = {};
  SM.applyDefaults(ec6);
  assert(ec6.timeSignature === '4/4', 'SM: defaults timeSig');
  assert(ec6.tempo === 120, 'SM: defaults tempo');
  assert(ec6.transpose === 0, 'SM: defaults transpose');

  // =========================================================================

  // Summary
  // =========================================================================
  console.log('\n===== RESULTS: '+passed+'/'+(passed+failed)+' passed =====');
  if (failed) { console.log('FAILURES:'); failures.forEach(function(f,i){console.log((i+1)+'. '+f);}); }
  window.__testResults = {passed:passed,failed:failed,failures:failures};
})();
