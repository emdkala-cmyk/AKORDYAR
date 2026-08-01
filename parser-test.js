// ---- Parser Test Suite ----
// Tests for the Laminor chord parser helpers.
// Run with: node parser-test.js

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.error('FAIL: ' + msg); }
}

function assertEq(a, b, msg) {
  if (a === b) { passed++; }
  else { failed++; console.error('FAIL: ' + msg + ' — expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
}

function assertIncludes(arr, val, msg) {
  if (arr.includes(val)) { passed++; }
  else { failed++; console.error('FAIL: ' + msg + ' — array does not include ' + JSON.stringify(val)); }
}

// ---- Import the helpers from 1.html by extracting them ----
// We replicate the pure functions here for testing.

function expandTabsForVisualColumns(line, tabSize) {
  tabSize = tabSize || 4;
  let result = '';
  let col = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\t') {
      const spaces = tabSize - (col % tabSize);
      for (let s = 0; s < spaces; s++) result += ' ';
      col += spaces;
    } else {
      result += line[i];
      col++;
    }
  }
  return result;
}

function hasPersian(s) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
}

const CHORD_ONLY_REGEX = /^[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?(?:[\s*]+[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?)*\s*$/;
const CHORD_EXTRACT_REGEX = /[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?/g;

function normalizeRawText(rawText) {
  if (!rawText) return '';
  let t = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (t.startsWith('\n')) t = t.substring(1);
  while (t.endsWith('\n')) t = t.substring(0, t.length - 1);
  return t;
}

function normalizeLineForDetection(line) {
  return line.replace(/[│┃┃│┆┇┊┋╎╏║►▶◆◇○●★☆♦♣♠♥♪♫]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function extractChordPositions(originalLine) {
  const expanded = expandTabsForVisualColumns(originalLine);
  const positions = [];
  let match;
  const re = new RegExp(CHORD_EXTRACT_REGEX.source, 'g');
  while ((match = re.exec(expanded)) !== null) {
    positions.push({
      name: match[0],
      startColumn: match.index,
      endColumn: match.index + match[0].length,
      centerColumn: match.index + match[0].length / 2
    });
  }
  return positions;
}

function stripStarsAndCollectAnchors(rawLyricLine) {
  const raw = String(rawLyricLine ?? '');
  let textWithoutStars = '';
  const rawAnchors = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '*') {
      rawAnchors.push(textWithoutStars.length);
    } else {
      textWithoutStars += raw[i];
    }
  }
  const cleanText = textWithoutStars.replace(/[ \t\u00A0]+$/u, '');
  const visibleLength = cleanText.length;
  const anchors = rawAnchors.map(function(idx) {
    return Math.min(idx, visibleLength);
  });
  return { cleanText: cleanText, anchors: anchors };
}

function snapToWordBoundary(charIndex, lyricText) {
  const len = lyricText.length;
  if (len === 0) return 0;
  charIndex = Math.max(0, Math.min(charIndex, len - 1));
  let bestLeft = charIndex;
  for (let i = charIndex; i >= 0; i--) {
    const prevChar = i > 0 ? lyricText[i - 1] : ' ';
    const curChar = lyricText[i];
    if ((prevChar === ' ' || prevChar === '\u200C' || i === 0) && curChar !== ' ' && curChar !== '\u200C') {
      bestLeft = i; break;
    }
  }
  let bestRight = charIndex;
  for (let i = charIndex; i < len; i++) {
    const prevChar = i > 0 ? lyricText[i - 1] : ' ';
    const curChar = lyricText[i];
    if ((prevChar === ' ' || prevChar === '\u200C' || i === 0) && curChar !== ' ' && curChar !== '\u200C') {
      bestRight = i; break;
    }
  }
  const distLeft = Math.abs(bestLeft - charIndex);
  const distRight = Math.abs(bestRight - charIndex);
  if (distLeft <= distRight) return bestLeft;
  return bestRight;
}

function determineAnchorType(charIndex, lyricLength, explicitStart, explicitEnd) {
  if (lyricLength === 0 || explicitStart || charIndex === 0) return 'LineStart';
  if (explicitEnd || charIndex >= lyricLength) return 'LineEnd';
  return 'OnCharacter';
}

function makeExplicitAnchor(rawIndex, lyricLength) {
  if (lyricLength <= 0) return { charIndex: 0, anchorType: 'LineStart' };
  if (rawIndex <= 0) return { charIndex: 0, anchorType: 'LineStart' };
  if (rawIndex >= lyricLength) return { charIndex: lyricLength, anchorType: 'LineEnd' };
  return { charIndex: rawIndex, anchorType: 'OnCharacter' };
}

function mapChordColumnsToLyricIndices(chordLine, lyricLine, chordPositions) {
  const lyricLen = lyricLine.length;
  if (lyricLen === 0) return [];
  const isRTL = hasPersian(lyricLine);
  const lyricExpanded = expandTabsForVisualColumns(lyricLine);
  const lyricVisualWidth = lyricExpanded.length;
  return chordPositions.map(function(ch) {
    let charIdx;
    if (isRTL) {
      charIdx = lyricVisualWidth - ch.endColumn;
    } else {
      charIdx = ch.startColumn;
    }
    charIdx = Math.max(0, Math.min(charIdx, lyricLen));
    return { name: ch.name, charIndex: charIdx };
  });
}

function validateParsedSong(result) {
  const warnings = [];
  if (typeof result.lyrics !== 'string') { warnings.push({ code: 'INVALID_LYRICS_TYPE', message: 'lyrics must be string' }); return warnings; }
  if (!Array.isArray(result.chords)) { warnings.push({ code: 'INVALID_CHORDS_TYPE', message: 'chords must be array' }); return warnings; }
  const lines = result.lyrics.split('\n');
  for (let i = 0; i < result.chords.length; i++) {
    const ch = result.chords[i];
    if (typeof ch.lineIndex !== 'number' || ch.lineIndex !== Math.floor(ch.lineIndex)) { warnings.push({ code: 'INVALID_LINE_INDEX', message: 'chord ' + i + ': lineIndex must be integer' }); continue; }
    if (typeof ch.charIndex !== 'number' || ch.charIndex !== Math.floor(ch.charIndex)) { warnings.push({ code: 'INVALID_CHAR_INDEX', message: 'chord ' + i + ': charIndex must be integer' }); continue; }
    if (ch.lineIndex < 0 || ch.lineIndex >= lines.length) { warnings.push({ code: 'LINE_INDEX_OUT_OF_RANGE', message: 'chord ' + i + ': lineIndex ' + ch.lineIndex + ' out of range' }); continue; }
    const line = lines[ch.lineIndex];
    // LineEnd anchor: charIndex === lyricLine.length is valid
    if (ch.anchorType === 'LineEnd') {
      if (ch.charIndex !== line.length) { warnings.push({ code: 'INVALID_LINE_END_INDEX', message: 'chord ' + i + ': LineEnd charIndex ' + ch.charIndex + ' != lyric length ' + line.length }); }
    } else if (line.length > 0 && (ch.charIndex < 0 || ch.charIndex >= line.length)) {
      warnings.push({ code: 'CLAMPED_CHAR_INDEX', message: 'chord ' + i + ': charIndex ' + ch.charIndex + ' out of range for line length ' + line.length });
    }
    if (!ch.name || typeof ch.name !== 'string' || !ch.name.trim()) { warnings.push({ code: 'EMPTY_CHORD_NAME', message: 'chord ' + i + ': empty name' }); }
    if (!['LineStart', 'OnCharacter', 'LineEnd'].includes(ch.anchorType)) { warnings.push({ code: 'INVALID_ANCHOR_TYPE', message: 'chord ' + i + ': invalid anchorType ' + ch.anchorType }); }
  }
  if (result.lyrics.includes('*')) { warnings.push({ code: 'STAR_IN_FINAL_LYRICS', message: 'Final lyrics contain star characters' }); }
  return warnings;
}

function parseRawSongToEdCur(parsedSong) {
  const result = { title: parsedSong.title || '', artist: parsedSong.artist || '', key: parsedSong.key || '', keyMode: 'maj', timeSignature: parsedSong.rhythm || '', lyrics: '', chords: [], warnings: [] };
  if (parsedSong.key && parsedSong.key.endsWith('m')) { result.keyMode = 'min'; result.key = parsedSong.key.replace(/m$/, ''); }
  const rawText = normalizeRawText(parsedSong.rawText || '');
  if (!rawText) return result;

  const allRawLines = rawText.split('\n');
  const lineInfos = allRawLines.map(function(raw) {
    return { originalLine: raw, detectionLine: normalizeLineForDetection(raw), type: 'unknown' };
  });

  for (let i = 0; i < lineInfos.length; i++) {
    const info = lineInfos[i];
    if (!info.detectionLine) { info.type = 'empty'; continue; }
    if (hasPersian(info.detectionLine)) {
      const endChordMatch = info.detectionLine.match(/\s+([A-G][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-G][#b]?|\d+)?(?:\s+[A-G][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-G][#b]?|\d+)?)*)\s*$/);
      if (endChordMatch) {
        const origText = info.originalLine;
        const chordSuffixRegex = /\s+([A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?(?:\s+[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?)*)\s*$/;
        const origMatch = origText.match(chordSuffixRegex);
        let lyricPartOriginal, chordPartOriginal;
        if (origMatch) {
          lyricPartOriginal = origText.substring(0, origText.length - origMatch[0].length);
          chordPartOriginal = origMatch[1];
        } else {
          const detLyricPart = info.detectionLine.substring(0, info.detectionLine.length - endChordMatch[0].length).trim();
          const detChordPart = endChordMatch[1].trim();
          lyricPartOriginal = info.originalLine;
          chordPartOriginal = detChordPart;
        }
        if (lyricPartOriginal.trim()) {
          lineInfos[i] = { originalLine: lyricPartOriginal, detectionLine: normalizeLineForDetection(lyricPartOriginal), type: 'lyric' };
          lineInfos.splice(i + 1, 0, { originalLine: chordPartOriginal, detectionLine: normalizeLineForDetection(chordPartOriginal), type: 'chord' });
        } else {
          lineInfos[i] = { originalLine: chordPartOriginal, detectionLine: normalizeLineForDetection(chordPartOriginal), type: 'chord' };
        }
      } else {
        info.type = 'lyric';
      }
    } else {
      if (/^[-=_~─━═━━─﹍﹎＿]{3,}$/.test(info.detectionLine.replace(/\s/g, ''))) { info.type = 'empty'; continue; }
      const stripped = info.detectionLine.replace(/\*/g, '');
      if (stripped && CHORD_ONLY_REGEX.test(stripped)) { info.type = 'chord'; }
      else { info.type = 'lyric'; }
    }
  }

  const consumed = new Set();
  const pairs = [];
  for (let i = 0; i < lineInfos.length; i++) {
    const item = lineInfos[i];
    if (item.type === 'chord') {
      let nextLyricIdx = -1;
      for (let j = i + 1; j < lineInfos.length; j++) {
        if (lineInfos[j].type === 'lyric' && !consumed.has(j)) { nextLyricIdx = j; break; }
        if (lineInfos[j].type === 'chord') break;
      }
      if (nextLyricIdx >= 0) {
        consumed.add(nextLyricIdx);
        pairs.push({ chordLineOriginal: item.originalLine, lyricLineOriginal: lineInfos[nextLyricIdx].originalLine });
      } else {
        result.warnings.push({ sourceLineIndex: i, code: 'INSTRUMENTAL_CHORD_LINE', message: 'Chord-only line at source index ' + i + ' preserved as intro/interlude' });
      }
    } else if (item.type === 'lyric' && !consumed.has(i)) {
      pairs.push({ chordLineOriginal: '', lyricLineOriginal: item.originalLine });
    }
  }

  for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
    const pair = pairs[pairIdx];
    const chordLine = pair.chordLineOriginal;
    const lyricRaw = pair.lyricLineOriginal;
    const { cleanText: finalLyricLine, anchors: starAnchors } = stripStarsAndCollectAnchors(lyricRaw);
    pair.finalLyricLine = finalLyricLine;
    if (!chordLine || !finalLyricLine) continue;

    const chordTokens = chordLine.match(CHORD_EXTRACT_REGEX) || [];
    if (chordTokens.length === 0) continue;

    const validChords = [];
    let cm;
    const ce = new RegExp(CHORD_EXTRACT_REGEX.source, 'g');
    while ((cm = ce.exec(chordLine)) !== null) {
      validChords.push({ name: cm[0] });
    }

    if (starAnchors.length > 0) {
      if (validChords.length === starAnchors.length) {
        for (let ci = 0; ci < validChords.length; ci++) {
          const explicit = makeExplicitAnchor(starAnchors[ci], finalLyricLine.length);
          result.chords.push({
            name: validChords[ci].name,
            lineIndex: pairIdx,
            charIndex: explicit.charIndex,
            anchorType: explicit.anchorType
          });
        }
      } else if (validChords.length > starAnchors.length) {
        for (let ci = 0; ci < starAnchors.length; ci++) {
          const explicit = makeExplicitAnchor(starAnchors[ci], finalLyricLine.length);
          result.chords.push({
            name: validChords[ci].name,
            lineIndex: pairIdx,
            charIndex: explicit.charIndex,
            anchorType: explicit.anchorType
          });
        }
        const remainingChords = validChords.slice(starAnchors.length);
        const chordPositions = extractChordPositions(chordLine);
        const fallbackPositions = chordPositions.slice(starAnchors.length);
        const mapped = mapChordColumnsToLyricIndices(chordLine, finalLyricLine, fallbackPositions);
        for (let fi = 0; fi < mapped.length && fi < remainingChords.length; fi++) {
          const explicit = makeExplicitAnchor(mapped[fi].charIndex, finalLyricLine.length);
          result.chords.push({
            name: remainingChords[fi].name,
            lineIndex: pairIdx,
            charIndex: explicit.charIndex,
            anchorType: explicit.anchorType
          });
        }
        result.warnings.push({ sourceLineIndex: pairIdx, code: 'STAR_CHORD_COUNT_MISMATCH', message: 'More chords than star anchors' });
      } else {
        for (let ci = 0; ci < validChords.length; ci++) {
          const explicit = makeExplicitAnchor(starAnchors[ci], finalLyricLine.length);
          result.chords.push({
            name: validChords[ci].name,
            lineIndex: pairIdx,
            charIndex: explicit.charIndex,
            anchorType: explicit.anchorType
          });
        }
        result.warnings.push({ sourceLineIndex: pairIdx, code: 'STAR_CHORD_COUNT_MISMATCH', message: 'More star anchors than chords' });
      }
    } else {
      const chordPositions = extractChordPositions(chordLine);
      const mapped = mapChordColumnsToLyricIndices(chordLine, finalLyricLine, chordPositions);
      for (const m of mapped) {
        const explicit = makeExplicitAnchor(m.charIndex, finalLyricLine.length);
        result.chords.push({
          name: m.name,
          lineIndex: pairIdx,
          charIndex: explicit.charIndex,
          anchorType: explicit.anchorType
        });
      }
    }
  }

  result.lyrics = pairs.map(function(p) { return p.finalLyricLine || ''; }).join('\n');

  const validationWarnings = validateParsedSong(result);
  if (validationWarnings.length > 0) {
    result.warnings = result.warnings.concat(validationWarnings);
  }

  return result;
}

// ============================================================
// TESTS
// ============================================================

console.log('=== Parser Test Suite ===\n');

// ---- TEST A: explicit star mapping ----
console.log('TEST A — explicit star mapping');
{
  const rawText = 'Gm Cm7\n*در کار *عشق ما';
  const result = parseRawSongToEdCur({ rawText: rawText });

  assertEq(result.lyrics.includes('*'), false, 'A1: No stars in final lyrics');

  const lines = result.lyrics.split('\n');
  assertEq(lines.length, 1, 'A2: One lyric line');
  assertEq(lines[0], 'در کار عشق ما', 'A3: Final lyric is clean');

  assertEq(result.chords.length, 2, 'A4: Exactly two chords');
  if (result.chords.length === 2) {
    assertEq(result.chords[0].name, 'Gm', 'A5a: First chord name');
    assertEq(result.chords[1].name, 'Cm7', 'A5b: Second chord name');

    // Verify each charIndex points to the intended character
    const line = lines[0];
    assertEq(line[result.chords[0].charIndex], 'د', 'A6a: Gm points to د');
    assertEq(line[result.chords[1].charIndex], 'ع', 'A6b: Cm7 points to ع');

    // Verify anchor types
    assertEq(result.chords[0].anchorType, 'LineStart', 'A7a: Gm is LineStart');
    assertEq(result.chords[1].anchorType, 'OnCharacter', 'A7b: Cm7 is OnCharacter');
  }
  console.log('  chords:', JSON.stringify(result.chords.map(c => ({ name: c.name, charIndex: c.charIndex, anchorType: c.anchorType }))));
}

// ---- TEST A2: trailing star becomes LineEnd ----
console.log('\nTEST A2 — trailing star becomes LineEnd');
{
  // Use 3 chords to match 3 stars, so the third (trailing) star is used
  const rawText = 'Am Bm Cm\n*سلام *دنیا*  ';
  const result = parseRawSongToEdCur({ rawText: rawText });

  const lines = result.lyrics.split('\n');
  assertEq(lines.length, 1, 'A2-1: One lyric line');
  assertEq(lines[0], 'سلام دنیا', 'A2-2: Trailing spaces removed');

  assertEq(result.chords.length, 3, 'A2-3: Three chords');
  if (result.chords.length === 3) {
    assertEq(result.chords[0].anchorType, 'LineStart', 'A2-4a: Am is LineStart');
    assertEq(result.chords[1].anchorType, 'OnCharacter', 'A2-4b: Bm is OnCharacter');
    // Third star is after visible text → LineEnd
    assertEq(result.chords[2].anchorType, 'LineEnd', 'A2-4c: Cm is LineEnd');
    assertEq(result.chords[2].charIndex, lines[0].length, 'A2-5: LineEnd charIndex == lyric length');
  }
  console.log('  chords:', JSON.stringify(result.chords.map(c => ({ name: c.name, charIndex: c.charIndex, anchorType: c.anchorType }))));
}

// ---- TEST A3: star before trailing whitespace becomes LineEnd ----
console.log('\nTEST A3 — star before trailing whitespace becomes LineEnd');
{
  const rawText = 'Am\nمتن ترانه*      ';
  const result = parseRawSongToEdCur({ rawText: rawText });

  const lines = result.lyrics.split('\n');
  assertEq(lines[0], 'متن ترانه', 'A3-1: Trailing spaces removed');
  assertEq(result.chords.length, 1, 'A3-2: One chord');
  if (result.chords.length === 1) {
    assertEq(result.chords[0].anchorType, 'LineEnd', 'A3-3: Star in trailing area is LineEnd');
    assertEq(result.chords[0].charIndex, lines[0].length, 'A3-4: charIndex == lyric length');
  }
}

// ---- TEST B: multiple stars ----
console.log('\nTEST B — multiple stars');
{
  const rawText = 'Am\n*سلام *من *به تو';
  const result = parseRawSongToEdCur({ rawText: rawText });

  assertEq(result.lyrics.includes('*'), false, 'B1: No stars');
  assertEq(result.lyrics, 'سلام من به تو', 'B2: Clean text');

  const anchors = stripStarsAndCollectAnchors('*سلام *من *به تو');
  assertEq(anchors.cleanText, 'سلام من به تو', 'B3: cleanText correct');
  assertEq(anchors.anchors.length, 3, 'B4: Three anchors');

  // Verify anchors point to word starts
  const ct = anchors.cleanText;
  assertEq(ct[anchors.anchors[0]], 'س', 'B5a: Anchor 0 points to س');
  assertEq(ct[anchors.anchors[1]], 'م', 'B5b: Anchor 1 points to م');
  assertEq(ct[anchors.anchors[2]], 'ب', 'B5c: Anchor 2 points to ب');

  console.log('  anchors:', anchors.anchors, 'chars:', anchors.anchors.map(a => ct[a]));
}

// ---- TEST C: star count mismatch ----
console.log('\nTEST C — star count mismatch');
{
  // More chords than stars
  const r1 = parseRawSongToEdCur({ rawText: 'Am Bm Cm\n*در *کار' });
  assertEq(r1.chords.length, 3, 'C1: All chords retained when more chords than stars');
  assert(r1.warnings.some(w => w.code === 'STAR_CHORD_COUNT_MISMATCH'), 'C2: Warning generated');

  // More stars than chords
  const r2 = parseRawSongToEdCur({ rawText: 'Am\n*در *کار *عشق' });
  assertEq(r2.chords.length, 1, 'C3: Only matched chords retained');
  assert(r2.warnings.some(w => w.code === 'STAR_CHORD_COUNT_MISMATCH'), 'C4: Warning generated');
}

// ---- TEST D: no-star aligned Persian input ----
console.log('\nTEST D — no-star aligned Persian input');
{
  const rawText = 'Gm    Cm7\nدر کار عشق ما';
  const r1 = parseRawSongToEdCur({ rawText: rawText });
  const r2 = parseRawSongToEdCur({ rawText: rawText });

  assertEq(r1.lyrics, r2.lyrics, 'D1: Stable lyrics across parses');
  assertEq(JSON.stringify(r1.chords), JSON.stringify(r2.chords), 'D2: Stable chord JSON across parses');

  const lines = r1.lyrics.split('\n');
  for (const ch of r1.chords) {
    assert(ch.lineIndex >= 0 && ch.lineIndex < lines.length, 'D3: lineIndex in range');
    assert(ch.charIndex >= 0 && ch.charIndex < lines[ch.lineIndex].length, 'D4: charIndex in range');
  }
  console.log('  chords:', JSON.stringify(r1.chords.map(c => ({ name: c.name, ci: c.charIndex, ch: r1.lyrics.split('\n')[c.lineIndex][c.charIndex] }))));
}

// ---- TEST E: spaces and tabs ----
console.log('\nTEST E — spaces and tabs');
{
  const rawText = 'Gm\tCm7\nدر  کار  عشق';
  const result = parseRawSongToEdCur({ rawText: rawText });
  assertEq(result.lyrics.includes('*'), false, 'E1: No stars');
  assertEq(result.lyrics, 'در  کار  عشق', 'E2: Internal spaces preserved');

  const lines = result.lyrics.split('\n');
  for (const ch of result.chords) {
    assert(ch.charIndex >= 0 && ch.charIndex < lines[ch.lineIndex].length, 'E3: Indices in bounds');
  }
}

// ---- TEST F: Persian half-space (U+200C) ----
console.log('\nTEST F — Persian half-space');
{
  const rawText = 'Am\nسلام\u200Cدنیا';
  const result = parseRawSongToEdCur({ rawText: rawText });
  assertEq(result.lyrics, 'سلام\u200Cدنیا', 'F1: Half-space preserved');
  assert(result.chords.length > 0, 'F2: Chord created');
  if (result.chords.length > 0) {
    const ch = result.chords[0];
    assert(ch.charIndex >= 0 && ch.charIndex < result.lyrics.length, 'F3: Index in bounds');
  }
}

// ---- TEST G: lineIndex invariant ----
console.log('\nTEST G — lineIndex invariant');
{
  const rawText = 'Gm Cm7\n\nBb\nدر کار\nAm\nعشق ما';
  const result = parseRawSongToEdCur({ rawText: rawText });
  const lines = result.lyrics.split('\n');
  for (let i = 0; i < result.chords.length; i++) {
    const ch = result.chords[i];
    assert(lines[ch.lineIndex] !== undefined, 'G1: lineIndex ' + ch.lineIndex + ' points to existing line');
    assert(ch.charIndex >= 0 && ch.charIndex < lines[ch.lineIndex].length, 'G2: charIndex ' + ch.charIndex + ' in bounds for line ' + ch.lineIndex);
  }
  console.log('  lyrics:', JSON.stringify(result.lyrics.split('\n')));
  console.log('  chords:', JSON.stringify(result.chords.map(c => ({ name: c.name, li: c.lineIndex, ci: c.charIndex }))));
}

// ---- TEST H: stable round-trip ----
console.log('\nTEST H — stable round-trip');
{
  const rawText = 'Gm Cm7 Bb\n*در کار *عشق ما\nAm\n*سلام *دنیا';
  const r1 = parseRawSongToEdCur({ rawText: rawText });
  const r2 = parseRawSongToEdCur({ rawText: rawText });
  assertEq(r1.lyrics, r2.lyrics, 'H1: Lyrics stable');
  assertEq(JSON.stringify(r1.chords), JSON.stringify(r2.chords), 'H2: Chords stable');
}

// ---- TEST I: renderer contract (pure) ----
console.log('\nTEST I — renderer contract');
{
  const rawText = 'Gm Cm7 Bb\n*در کار *عشق ما *همیشه';
  const result = parseRawSongToEdCur({ rawText: rawText });
  const lines = result.lyrics.split('\n');
  for (const ch of result.chords) {
    const line = lines[ch.lineIndex];
    assert(line !== undefined, 'I1: line exists');
    const slice = line.slice(ch.charIndex);
    assert(slice.length > 0, 'I2: slice from charIndex is non-empty for ' + ch.name);
  }
  console.log('  verified', result.chords.length, 'chords point to valid positions');
}

// ---- TEST validateParsedSong ----
console.log('\nTEST validation');
{
  const good = parseRawSongToEdCur({ rawText: 'Am\n*سلام *دنیا' });
  const warnings = validateParsedSong(good);
  assertEq(warnings.length, 0, 'VAL1: No warnings for good input');

  const bad = { lyrics: 'test', chords: [{ name: '', lineIndex: 0, charIndex: 999, anchorType: 'bad' }] };
  const badWarnings = validateParsedSong(bad);
  assert(badWarnings.length > 0, 'VAL2: Warnings for bad input');
}

// ---- TEST J: explicit star on character ----
console.log('\nTEST J — explicit star on character');
{
  const result = stripStarsAndCollectAnchors('عش*ق');
  assertEq(result.cleanText, 'عشق', 'J1: cleanText correct');
  assertEq(result.anchors.length, 1, 'J2: One anchor');
  assertEq(result.anchors[0], 2, 'J3: Anchor at index 2');
  assertEq(result.cleanText[result.anchors[0]], 'ق', 'J4: Anchor points to ق');
}

// ---- TEST K: trailing star becomes LineEnd ----
console.log('\nTEST K — trailing star becomes LineEnd');
{
  const result = stripStarsAndCollectAnchors('دلگیر می شن      *');
  assertEq(result.cleanText, 'دلگیر می شن', 'K1: Trailing spaces removed');
  assertEq(result.anchors.length, 1, 'K2: One anchor');
  assertEq(result.anchors[0], result.cleanText.length, 'K3: Anchor == lyric length (LineEnd)');
}

// ---- TEST L: trailing spaces removed ----
console.log('\nTEST L — trailing spaces removed');
{
  const result = stripStarsAndCollectAnchors('متن ترانه      ');
  assertEq(result.cleanText, 'متن ترانه', 'L1: Trailing spaces stripped');
}

// ---- TEST M: star before trailing spaces becomes LineEnd ----
console.log('\nTEST M — star before trailing spaces becomes LineEnd');
{
  const result = stripStarsAndCollectAnchors('متن ترانه*      ');
  assertEq(result.cleanText, 'متن ترانه', 'M1: Clean text');
  assertEq(result.anchors[0], result.cleanText.length, 'M2: Star in trailing area → LineEnd');
}

// ---- TEST N: anchor never exceeds lyric length ----
console.log('\nTEST N — anchor never exceeds lyric length');
{
  const result = stripStarsAndCollectAnchors('آدما      *');
  for (let i = 0; i < result.anchors.length; i++) {
    assert(result.anchors[i] >= 0, 'N' + (i * 2 + 1) + ': anchor >= 0');
    assert(result.anchors[i] <= result.cleanText.length, 'N' + (i * 2 + 2) + ': anchor <= lyric length');
  }
}

// ---- TEST O: Persian star targets next character ----
console.log('\nTEST O — Persian star targets next character');
{
  const result = stripStarsAndCollectAnchors('آدما ا*ز آدما');
  assertEq(result.cleanText[result.anchors[0]], 'ز', 'O1: Star points to ز');
}

// ---- TEST P: LineEnd invariant in chord objects ----
console.log('\nTEST P — LineEnd invariant in chord objects');
{
  const rawText = 'Am Bm Cm\n*سلام *دنیا*  ';
  const result = parseRawSongToEdCur({ rawText: rawText });
  const lines = result.lyrics.split('\n');
  for (const ch of result.chords) {
    if (ch.anchorType === 'LineEnd') {
      assertEq(ch.charIndex, lines[ch.lineIndex].length, 'P1: LineEnd charIndex == lyric length for ' + ch.name);
    }
    if (ch.anchorType === 'LineStart') {
      assertEq(ch.charIndex, 0, 'P2: LineStart charIndex == 0 for ' + ch.name);
    }
    if (ch.anchorType === 'OnCharacter') {
      assert(ch.charIndex >= 0 && ch.charIndex < lines[ch.lineIndex].length, 'P3: OnCharacter charIndex in range for ' + ch.name);
    }
  }
}

// ---- TEST Q: Reza Sadeghi first four lines ----
console.log('\nTEST Q — Reza Sadeghi first four lines');
{
  // Chord line spacing matches the Laminor site layout
  const rawText = [
    'Ab Bb Cm',
    'Ab Bb Cm',
    'Gm    Ab       Bb       Cm',
    'من قبول کردم بری باید تورو یادم بره',
    'Ab    Gm       Ab       Bb',
    'این شبا بدون شب بخیر تو خوابم بره',
    'Bb    Ab       Bb       Cm',
    'من قبول کردم ندارمت دیگه پیش خودم',
    'Ab    Gm       Ab       Bb',
    'میدونم سخته ولی باید فراموشت کنم'
  ].join('\n');

  const result = parseRawSongToEdCur({ rawText: rawText });
  const lines = result.lyrics.split('\n');

  // Verify lyrics
  assertEq(lines[0], 'من قبول کردم بری باید تورو یادم بره', 'Q1: Lyric line 0');
  assertEq(lines[1], 'این شبا بدون شب بخیر تو خوابم بره', 'Q2: Lyric line 1');
  assertEq(lines[2], 'من قبول کردم ندارمت دیگه پیش خودم', 'Q3: Lyric line 2');
  assertEq(lines[3], 'میدونم سخته ولی باید فراموشت کنم', 'Q4: Lyric line 3');

  // Verify line lengths
  assertEq(lines[0].length, 35, 'Q5: Line 0 length');
  assertEq(lines[1].length, 33, 'Q6: Line 1 length');
  assertEq(lines[2].length, 33, 'Q7: Line 2 length');
  assertEq(lines[3].length, 32, 'Q8: Line 3 length');

  // Verify intro chord lines are instrumental
  assert(result.warnings.some(function(w) { return w.code === 'INSTRUMENTAL_CHORD_LINE'; }), 'Q9: Intro lines marked as instrumental');

  // Verify chord count (4 chords per lyric line × 4 lines = 16)
  assertEq(result.chords.length, 16, 'Q10: 16 chords total');

  // Verify all charIndex values are in valid range
  for (const ch of result.chords) {
    const line = lines[ch.lineIndex];
    assert(ch.charIndex >= 0 && ch.charIndex <= line.length, 'Q11: charIndex in range for ' + ch.name + ' on line ' + ch.lineIndex);
  }

  // Verify charIndex points to valid character (or LineEnd)
  for (const ch of result.chords) {
    const line = lines[ch.lineIndex];
    if (ch.anchorType === 'LineEnd') {
      assertEq(ch.charIndex, line.length, 'Q12: LineEnd charIndex == lyric length for ' + ch.name);
    } else if (ch.anchorType === 'OnCharacter') {
      assert(ch.charIndex >= 0 && ch.charIndex < line.length, 'Q13: OnCharacter charIndex in range for ' + ch.name);
    }
  }

  console.log('  lyrics:', lines.length, 'lines');
  console.log('  chords:', result.chords.length, 'chords');
  console.log('  warnings:', result.warnings.filter(function(w) { return w.code === 'INSTRUMENTAL_CHORD_LINE'; }).length, 'instrumental lines');
}

// ---- TEST R: RTL projection uses chordEndColumn ----
console.log('\nTEST R — RTL projection uses chordEndColumn');
{
  // Verify the formula: charIndex = lyricLength - chordEndColumn
  const lyric = 'من قبول کردم بری باید تورو یادم بره';
  const chordLine = 'Gm    Ab       Bb       Cm';

  const positions = extractChordPositions(chordLine);
  assertEq(positions.length, 4, 'R1: Four chords extracted');
  if (positions.length === 4) {
    // Verify each chord's charIndex follows the RTL formula
    const mapped = mapChordColumnsToLyricIndices(chordLine, lyric, positions);
    for (let i = 0; i < positions.length; i++) {
      const expected = lyric.length - positions[i].endColumn;
      assertEq(mapped[i].charIndex, expected, 'R2: ' + mapped[i].name + ' charIndex = lyricLen - endColumn');
      // Verify the character at charIndex is valid
      assert(mapped[i].charIndex >= 0 && mapped[i].charIndex <= lyric.length, 'R3: ' + mapped[i].name + ' charIndex in range');
    }
  }
}

// ---- Summary ----
console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
