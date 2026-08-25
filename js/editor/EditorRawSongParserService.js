/**
 * EditorRawSongParserService
 *
 * Pure parser for raw chord/lyric text. DOM, editor state and DAW
 * orchestration remain outside this module.
 */
(function attachEditorRawSongParserService(globalScope) {
  const CHORD_ONLY_REGEX = /^[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?(?:[\s*]+[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?)*\s*$/;
  const CHORD_EXTRACT_REGEX = /[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?/g;
  const DEFAULT_LOGGER = { log() {}, warn() {} };

  function create({
    positionMapper = globalScope.LyricPositionMapper,
    logger = globalScope.console || DEFAULT_LOGGER,
    debug = false
  } = {}) {
    if (
      !positionMapper ||
      typeof positionMapper.mapChordColumnsToLyricIndices !== 'function'
    ) {
      throw new Error(
        'EditorRawSongParserService requires LyricPositionMapper'
      );
    }

    function normalizeRawText(rawText) {
      if (!rawText) return '';
      let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      while (text.startsWith('\n')) text = text.substring(1);
      while (text.endsWith('\n')) text = text.substring(0, text.length - 1);
      return text;
    }

    function normalizeLineForDetection(line) {
      return line
        .replace(/[│┃┃│┆┇┊┋╎╏║►▶◆◇○●★☆♦♣♠♥♪♫]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    function hasPersian(value) {
      return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(value);
    }

    function isChordOnlyLine(line) {
      return CHORD_ONLY_REGEX.test(String(line ?? ''));
    }

    function extractChordPositions(originalLine) {
      const expanded = positionMapper.expandTabsForVisualColumns
        ? positionMapper.expandTabsForVisualColumns(originalLine)
        : originalLine;
      const positions = [];
      let match;
      const regex = new RegExp(CHORD_EXTRACT_REGEX.source, 'g');
      while ((match = regex.exec(expanded)) !== null) {
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
      const anchors = rawAnchors.map(function (index) {
        return Math.min(index, visibleLength);
      });
      return { cleanText, anchors };
    }

    function makeExplicitAnchor(rawIndex, lyricLength) {
      if (lyricLength <= 0) {
        return { charIndex: 0, anchorType: 'LineStart' };
      }
      if (rawIndex <= 0) {
        return { charIndex: 0, anchorType: 'LineStart' };
      }
      if (rawIndex >= lyricLength) {
        return { charIndex: lyricLength, anchorType: 'LineEnd' };
      }
      return { charIndex: rawIndex, anchorType: 'OnCharacter' };
    }

    function mapChordColumnsToLyricIndices(
      chordLine,
      lyricLine,
      chordPositions
    ) {
      return positionMapper.mapChordColumnsToLyricIndices(
        chordLine,
        lyricLine,
        chordPositions
      );
    }

    function validateParsedSong(result) {
      const warnings = [];
      if (typeof result.lyrics !== 'string') {
        warnings.push({
          code: 'INVALID_LYRICS_TYPE',
          message: 'lyrics must be string'
        });
        return warnings;
      }
      if (!Array.isArray(result.chords)) {
        warnings.push({
          code: 'INVALID_CHORDS_TYPE',
          message: 'chords must be array'
        });
        return warnings;
      }
      const lines = result.lyrics.split('\n');
      for (let i = 0; i < result.chords.length; i++) {
        const chord = result.chords[i];
        if (
          typeof chord.lineIndex !== 'number' ||
          chord.lineIndex !== Math.floor(chord.lineIndex)
        ) {
          warnings.push({
            code: 'INVALID_LINE_INDEX',
            message: 'chord ' + i + ': lineIndex must be integer'
          });
          continue;
        }
        if (
          typeof chord.charIndex !== 'number' ||
          chord.charIndex !== Math.floor(chord.charIndex)
        ) {
          warnings.push({
            code: 'INVALID_CHAR_INDEX',
            message: 'chord ' + i + ': charIndex must be integer'
          });
          continue;
        }
        if (chord.lineIndex < 0 || chord.lineIndex >= lines.length) {
          warnings.push({
            code: 'LINE_INDEX_OUT_OF_RANGE',
            message:
              'chord ' + i + ': lineIndex ' + chord.lineIndex + ' out of range'
          });
          continue;
        }
        const line = lines[chord.lineIndex];
        if (chord.anchorType === 'LineEnd') {
          if (chord.charIndex !== line.length) {
            warnings.push({
              code: 'INVALID_LINE_END_INDEX',
              message:
                'chord ' +
                i +
                ': LineEnd charIndex ' +
                chord.charIndex +
                ' != lyric length ' +
                line.length
            });
          }
        } else if (
          line.length > 0 &&
          (chord.charIndex < 0 || chord.charIndex >= line.length)
        ) {
          warnings.push({
            code: 'CLAMPED_CHAR_INDEX',
            message:
              'chord ' +
              i +
              ': charIndex ' +
              chord.charIndex +
              ' out of range for line length ' +
              line.length
          });
        }
        if (
          !chord.name ||
          typeof chord.name !== 'string' ||
          !chord.name.trim()
        ) {
          warnings.push({
            code: 'EMPTY_CHORD_NAME',
            message: 'chord ' + i + ': empty name'
          });
        }
        if (
          !['LineStart', 'OnCharacter', 'LineEnd'].includes(
            chord.anchorType
          )
        ) {
          warnings.push({
            code: 'INVALID_ANCHOR_TYPE',
            message:
              'chord ' + i + ': invalid anchorType ' + chord.anchorType
          });
        }
      }
      if (result.lyrics.includes('*')) {
        warnings.push({
          code: 'STAR_IN_FINAL_LYRICS',
          message: 'Final lyrics contain star characters'
        });
      }
      return warnings;
    }

    function parseRawSongToEdCur(parsedSong) {
      const result = {
        title: parsedSong.title || '',
        artist: parsedSong.artist || '',
        key: parsedSong.key || '',
        keyMode: 'maj',
        timeSignature: parsedSong.rhythm || '',
        lyrics: '',
        chords: [],
        warnings: []
      };
      if (parsedSong.key && parsedSong.key.endsWith('m')) {
        result.keyMode = 'min';
        result.key = parsedSong.key.replace(/m$/, '');
      }
      const rawText = normalizeRawText(parsedSong.rawText || '');
      if (!rawText) return result;

      const allRawLines = rawText.split('\n');
      const lineInfos = allRawLines.map(function (raw) {
        return {
          originalLine: raw,
          detectionLine: normalizeLineForDetection(raw),
          type: 'unknown'
        };
      });

      for (let i = 0; i < lineInfos.length; i++) {
        const info = lineInfos[i];
        if (!info.detectionLine) {
          info.type = 'empty';
          continue;
        }
        if (hasPersian(info.detectionLine)) {
          const endChordMatch = info.detectionLine.match(
            /\s+([A-G][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-G][#b]?|\d+)?(?:\s+[A-G][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-G][#b]?|\d+)?)*)\s*$/
          );
          if (endChordMatch) {
            const originalText = info.originalLine;
            const chordSuffixRegex =
              /\s+([A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?(?:\s+[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?)*)\s*$/;
            const originalMatch = originalText.match(chordSuffixRegex);
            let lyricPartOriginal;
            let chordPartOriginal;
            if (originalMatch) {
              lyricPartOriginal = originalText.substring(
                0,
                originalText.length - originalMatch[0].length
              );
              chordPartOriginal = originalMatch[1];
            } else {
              const detectionLyricPart = info.detectionLine
                .substring(
                  0,
                  info.detectionLine.length - endChordMatch[0].length
                )
                .trim();
              const detectionChordPart = endChordMatch[1].trim();
              lyricPartOriginal = detectionLyricPart;
              chordPartOriginal = detectionChordPart;
            }
            if (lyricPartOriginal.trim()) {
              lineInfos[i] = {
                originalLine: lyricPartOriginal,
                detectionLine: normalizeLineForDetection(lyricPartOriginal),
                type: 'lyric'
              };
              lineInfos.splice(i + 1, 0, {
                originalLine: chordPartOriginal,
                detectionLine: normalizeLineForDetection(chordPartOriginal),
                type: 'chord'
              });
            } else {
              lineInfos[i] = {
                originalLine: chordPartOriginal,
                detectionLine: normalizeLineForDetection(chordPartOriginal),
                type: 'chord'
              };
            }
          } else {
            info.type = 'lyric';
          }
        } else {
          if (
            /^[-=_~─━═━━─﹍﹎＿]{3,}$/.test(
              info.detectionLine.replace(/\s/g, '')
            )
          ) {
            info.type = 'empty';
            continue;
          }
          const stripped = info.detectionLine.replace(/\*/g, '');
          if (stripped && CHORD_ONLY_REGEX.test(stripped)) {
            info.type = 'chord';
          } else {
            info.type = 'lyric';
          }
        }
      }

      const consumed = new Set();
      const pairs = [];
      for (let i = 0; i < lineInfos.length; i++) {
        const item = lineInfos[i];
        if (item.type === 'chord') {
          let nextLyricIdx = -1;
          for (let j = i + 1; j < lineInfos.length; j++) {
            if (
              lineInfos[j].type === 'lyric' &&
              !consumed.has(j)
            ) {
              nextLyricIdx = j;
              break;
            }
            if (lineInfos[j].type === 'chord') break;
          }
          if (nextLyricIdx >= 0) {
            consumed.add(nextLyricIdx);
            pairs.push({
              chordLineOriginal: item.originalLine,
              lyricLineOriginal: lineInfos[nextLyricIdx].originalLine
            });
          } else {
            result.warnings.push({
              sourceLineIndex: i,
              code: 'INSTRUMENTAL_CHORD_LINE',
              message:
                'Chord-only line at source index ' +
                i +
                ' preserved as intro/interlude'
            });
          }
        } else if (item.type === 'lyric' && !consumed.has(i)) {
          pairs.push({
            chordLineOriginal: '',
            lyricLineOriginal: item.originalLine
          });
        }
      }

      for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
        const pair = pairs[pairIdx];
        const chordLine = pair.chordLineOriginal;
        const lyricRaw = pair.lyricLineOriginal;
        const {
          cleanText: finalLyricLine,
          anchors: starAnchors
        } = stripStarsAndCollectAnchors(lyricRaw);
        pair.finalLyricLine = finalLyricLine;

        if (!chordLine || !finalLyricLine) continue;

        const chordTokens = chordLine.match(CHORD_EXTRACT_REGEX) || [];
        if (chordTokens.length === 0) continue;

        const validChords = [];
        let chordMatch;
        const chordExpression = new RegExp(
          CHORD_EXTRACT_REGEX.source,
          'g'
        );
        while ((chordMatch = chordExpression.exec(chordLine)) !== null) {
          validChords.push({ name: chordMatch[0] });
        }

        if (starAnchors.length > 0) {
          if (validChords.length === starAnchors.length) {
            for (let ci = 0; ci < validChords.length; ci++) {
              const explicit = makeExplicitAnchor(
                starAnchors[ci],
                finalLyricLine.length
              );
              result.chords.push({
                name: validChords[ci].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
          } else if (validChords.length > starAnchors.length) {
            for (let ci = 0; ci < starAnchors.length; ci++) {
              const explicit = makeExplicitAnchor(
                starAnchors[ci],
                finalLyricLine.length
              );
              result.chords.push({
                name: validChords[ci].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
            const remainingChords = validChords.slice(starAnchors.length);
            const chordPositions = extractChordPositions(chordLine);
            const fallbackPositions = chordPositions.slice(
              starAnchors.length
            );
            const mapped = mapChordColumnsToLyricIndices(
              chordLine,
              finalLyricLine,
              fallbackPositions
            );
            for (
              let fi = 0;
              fi < mapped.length && fi < remainingChords.length;
              fi++
            ) {
              const explicit = makeExplicitAnchor(
                mapped[fi].charIndex,
                finalLyricLine.length
              );
              result.chords.push({
                name: remainingChords[fi].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
            result.warnings.push({
              sourceLineIndex: pairIdx,
              code: 'STAR_CHORD_COUNT_MISMATCH',
              message:
                'More chords (' +
                validChords.length +
                ') than star anchors (' +
                starAnchors.length +
                ')'
            });
          } else {
            for (let ci = 0; ci < validChords.length; ci++) {
              const anchorIdx =
                ci < starAnchors.length ? starAnchors[ci] : 0;
              const explicit = makeExplicitAnchor(
                anchorIdx,
                finalLyricLine.length
              );
              result.chords.push({
                name: validChords[ci].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
            result.warnings.push({
              sourceLineIndex: pairIdx,
              code: 'STAR_CHORD_COUNT_MISMATCH',
              message:
                'More star anchors (' +
                starAnchors.length +
                ') than chords (' +
                validChords.length +
                ')'
            });
          }
        } else {
          const chordPositions = extractChordPositions(chordLine);
          const mapped = mapChordColumnsToLyricIndices(
            chordLine,
            finalLyricLine,
            chordPositions
          );
          for (const mappedChord of mapped) {
            const explicit = makeExplicitAnchor(
              mappedChord.charIndex,
              finalLyricLine.length
            );
            result.chords.push({
              name: mappedChord.name,
              lineIndex: pairIdx,
              charIndex: explicit.charIndex,
              anchorType: explicit.anchorType
            });
          }
          if (debug) {
            logger.log('[IMPORT DEBUG] no-star pair', pairIdx, {
              chordLine,
              lyricLine: finalLyricLine,
              chords: mapped
            });
          }
        }
      }

      result.lyrics = pairs
        .map(function (pair) {
          return pair.finalLyricLine || '';
        })
        .join('\n');

      const validationWarnings = validateParsedSong(result);
      if (validationWarnings.length > 0) {
        result.warnings = result.warnings.concat(validationWarnings);
        if (debug) logger.warn('[IMPORT WARNINGS]', validationWarnings);
      }

      return result;
    }

    return Object.freeze({
      normalizeRawText,
      normalizeLineForDetection,
      hasPersian,
      isChordOnlyLine,
      extractChordPositions,
      validateParsedSong,
      parseRawSongToEdCur
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorRawSongParserService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
