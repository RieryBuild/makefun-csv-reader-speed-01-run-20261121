// Fast drop-in for make.fun's csv-reader 1.0.0: run({text, header}) -> {columns, rows, errors},
// byte-identical answers (as a JSON value) on every case, written from scratch in this
// session from the reference's own broken-row policy (kit baselines/csv-reader/
// vendor/csv-reader/index.js). No imports, no dependencies.
//
// Speed comes from bulk scanning instead of char-at-a-time reads: each unquoted
// field is one slice up to the next comma / LF / EOF (a CR inside it is handled
// segment-wise, never char by char), and each quoted field is one slice up to its
// closing quote when it holds no doubled quote and no line break inside. Only
// fields that actually contain doubled quotes or embedded line breaks take the
// general path, and only fields that actually contain a stray CR take the CR path.
// Field results travel in module-scope slots, never in a fresh object per field.

/** Field endings: 0 = comma, 1 = line break, 2 = end of text. */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** The reading of one CSV input, {text, header}: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The last field read: its ending, and how many characters readUnquoted kept.
  let ended = END;
  let added = 0;

  // Reads an unquoted field starting at pos, onto `value`: the segment up to the
  // next comma, LF or end of text. A CR inside the segment is dropped (stray_cr),
  // except a CR directly before the LF that ends the segment, which is the CRLF
  // line break itself. Sets `ended` and `added` (characters kept, not counting
  // the initial value's length) and returns the field.
  function readUnquoted(value) {
    added = 0;
    const iC = text.indexOf(',', pos);
    const iL = text.indexOf('\n', pos);
    let end = n;
    let kind = END;
    if (iC !== -1 && iC < end) {
      end = iC;
      kind = COMMA;
    }
    if (iL !== -1 && iL < end) {
      end = iL;
      kind = LINE_BREAK;
    }
    let seg = text.slice(pos, end);
    // A CR directly before the LF that ends this segment is the CRLF line break.
    if (kind === LINE_BREAK && seg.charCodeAt(seg.length - 1) === 13) seg = seg.slice(0, -1);
    const r = seg.indexOf('\r');
    if (r === -1) {
      if (seg.length !== 0) {
        value = value === '' ? seg : value + seg;
        added += seg.length;
      }
    } else {
      // Every CR left in the segment is a lone CR: drop it, one stray_cr each.
      const parts = seg.split('\r');
      for (let i = 1; i < parts.length; i++) {
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      }
      const kept = parts.join('');
      if (kept.length !== 0) {
        value = value === '' ? kept : value + kept;
        added += kept.length;
      }
    }
    if (kind === COMMA) {
      pos = end + 1;
      ended = COMMA;
      return value;
    }
    if (kind === LINE_BREAK) {
      pos = end + 1;
      line += 1;
      ended = LINE_BREAK;
      return value;
    }
    pos = n;
    ended = END;
    return value;
  }

  // A quoted segment with its CRLF / lone CR line breaks turned into LF, and the
  // global line advanced past every line break it held (after conversion each
  // break is exactly one '\n', so counting '\n' in the converted text is exact).
  function convertSeg(s) {
    const hasCR = s.indexOf('\r') !== -1;
    const hasLF = s.indexOf('\n') !== -1;
    if (!hasCR && !hasLF) return s;
    const c = hasCR ? s.replace(/\r\n?/g, '\n') : s;
    let d = 0;
    let idx = c.indexOf('\n');
    while (idx !== -1) {
      d += 1;
      idx = c.indexOf('\n', idx + 1);
    }
    line += d;
    return c;
  }

  // What follows a quoted field's closing quote (pos is just past it).
  function afterQuote(value) {
    if (pos >= n) {
      ended = END;
      return value;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      ended = COMMA;
      return value;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      ended = LINE_BREAK;
      return value;
    }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      ended = LINE_BREAK;
      return value;
    }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    const junk = readUnquoted(value);
    if (added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  // Reads a quoted field whose opening quote is at pos, through its closing
  // quote, when it holds a doubled quote or a line break inside it.
  function readQuotedGeneral(open, openLine) {
    let p = open + 1;
    let segStart = p;
    let parts = null;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after
        // it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return readUnquoted('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote: one literal quote, and the field goes on.
        const seg = convertSeg(text.slice(segStart, q));
        if (parts === null) parts = [];
        parts.push(seg, '"');
        p = q + 2;
        segStart = p;
        continue;
      }
      const seg = convertSeg(text.slice(segStart, q));
      let value;
      if (parts === null) {
        value = seg;
      } else {
        parts.push(seg);
        value = parts.join('');
      }
      pos = q + 1;
      return afterQuote(value);
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets `ended`.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    const p = pos + 1;
    const q = text.indexOf('"', p);
    if (q === -1) {
      // The quote never closes: it is a literal character, and the text after
      // it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    if (text.charCodeAt(q + 1) !== 34) {
      // The first quote is the closing one, unless a line break sits inside it:
      // check the slice between the quotes, bounded to that slice alone.
      const inner = text.slice(p, q);
      if (inner.indexOf('\n') === -1 && inner.indexOf('\r') === -1) {
        pos = q + 1;
        return afterQuote(inner);
      }
    }
    return readQuotedGeneral(open, openLine);
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      if (text.charCodeAt(pos) === 10) {
        pos += 1;
        line += 1;
      } else if (text.charCodeAt(pos) === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      fields.push(quoted ? readQuoted() : readUnquoted(''));
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

// ---------------------------------------------------------------------------
// Byte-level JSON-through parsing (round 3): parse CSV directly on a raw JSON
// string span — the escaped content of a "text" value inside cases.json — and
// return the answer as a JSON string, byte-identical to
// JSON.stringify(run(decoded text)).
//
// Why: the house driver pays JSON.parse(cases.json, 11 MB) + JSON.stringify
// (answers, 12 MB) + building the full answer objects, ~0.55 s end to end.
// This parser never materialises the decoded text or the answer objects.
//
// Raw-span facts it relies on (all true for any JSON.stringify output):
//   - a field's raw bytes ARE its JSON.stringify-escaped form whenever the
//     field holds no \r / \n / \u escape: \" stays \", \\ stays \\, \t stays
//     \t. Only fields holding a \r or \n escape (embedded line break / stray
//     CR) or a doubled quote need a decode + re-escape slow path.
//   - a closing quote is the raw two characters \" ; a doubled quote is \"\".
//   - a record break is the raw two characters \n, or \r\n (four characters).
// Any \u escape throws RawFallback: the caller then decodes that case with
// JSON.parse and answers it with run() above, so correctness holds for every
// input while the fast path covers 100% of generator output (which has no \u).
// ---------------------------------------------------------------------------

/** Thrown when a case needs the decoded path (a \u escape was met). */
export class RawFallback extends Error {
  constructor() {
    super('csv-reader-raw-fallback');
    this.name = 'RawFallback';
  }
}

const FALLBACK = new RawFallback();

/** The four hex digits at p as a number, or -1. */
function hex4(s, p) {
  let v = 0;
  for (let i = 0; i < 4; i++) {
    const c = s.charCodeAt(p + i);
    let d;
    if (c >= 48 && c <= 57) d = c - 48;
    else if (c >= 97 && c <= 102) d = c - 87;
    else if (c >= 65 && c <= 70) d = c - 55;
    else return -1;
    v = v * 16 + d;
  }
  return v;
}

/** A raw JSON string-content span decoded to its JS string (short strings only). */
function decodeRawSpan(raw) {
  return JSON.parse('"' + raw + '"');
}

/** How many '\n' the string holds. */
function countLF(str) {
  let d = 0;
  let idx = str.indexOf('\n');
  while (idx !== -1) {
    d += 1;
    idx = str.indexOf('\n', idx + 1);
  }
  return d;
}

/**
 * Parse one case straight off the raw JSON file string: the case text's raw
 * content is s[start..end), header is the case's header flag. Returns the
 * answer as a JSON string, byte-identical to JSON.stringify(run({text, header})).
 *
 * No JSON.parse of the text, no answer objects: a field's raw bytes ARE its
 * JSON.stringify-escaped form whenever it holds no \r / \n escape and no
 * doubled quote, so most fields are emitted verbatim from the raw slice.
 * Fields that do hold a line break or a doubled quote are rebuilt from the
 * raw segments with string transforms (no JSON.parse); JSON.parse is kept
 * only for the never-in-practice case of a literal backslash (\\) inside
 * such a field. Any \u escape throws RawFallback: the caller then decodes
 * that case with JSON.parse and answers it with run().
 */
export function runJson(s, start, end, header) {
  const errs = []; // error JSON strings, in order met
  const rowsParts = []; // row JSON strings
  let columnsJson = null;
  let width = -1;
  let rowsCount = 0;

  let pos = start;
  let line = 1;
  if (pos < end && s.charCodeAt(pos) === 0xfeff) {
    pos += 1; // literal BOM
  } else if (pos + 6 <= end && s.charCodeAt(pos) === 92 && s.charCodeAt(pos + 1) === 117) {
    if (hex4(s, pos + 2) === 0xfeff) pos += 6; // \ufeff BOM
    else throw FALLBACK;
  }

  let recordLine = 1;
  let recordRow = null;

  // The last field read: how it ended, its emitted content (no surrounding
  // quotes), whether its decoded value is empty, and how many decoded
  // characters the last junk read kept (quote_junk check).
  let fEnded = END;
  let fEmitted = '';
  let fEmpty = true;
  let fAdded = 0;
  let fQuoted = false;

  function errJson(code, extra) {
    return (
      '{"code":"' +
      code +
      '","line":' +
      recordLine +
      ',"row":' +
      (recordRow === null ? 'null' : recordRow) +
      (extra || '') +
      '}'
    );
  }

  // Reads an unquoted field starting at pos. Sets fEnded / fEmitted / fEmpty /
  // fAdded (decoded characters kept by this read). The segment up to the next
  // comma is sliced once; its escapes are walked on that short slice, never
  // by an unbounded scan for the next backslash.
  function readUnquotedRaw() {
    const fieldStart = pos;
    let p = pos;
    let pieceStart = fieldStart;
    let pieces = null; // raw pieces, only once a stray \r splits the field
    let transparent = 0; // transparent 2-char escapes met (each: 1 decoded char)
    let stray = 0; // stray \r escapes met (each: 0 decoded chars)
    let ended = END;
    let endRaw = end;
    outer: for (;;) {
      const iC = s.indexOf(',', p);
      const segEnd = iC === -1 || iC >= end ? end : iC;
      const seg = s.slice(p, segEnd);
      let k = seg.indexOf('\\');
      while (k !== -1) {
        const t = seg.charCodeAt(k + 1);
        if (t === 110) {
          // \n: the line break ends the field.
          endRaw = p + k;
          pos = p + k + 2;
          line += 1;
          ended = LINE_BREAK;
          break outer;
        }
        if (t === 114) {
          // \r: CRLF when a \n escape follows, else a stray CR (dropped).
          if (seg.charCodeAt(k + 2) === 92 && seg.charCodeAt(k + 3) === 110) {
            endRaw = p + k;
            pos = p + k + 4;
            line += 1;
            ended = LINE_BREAK;
            break outer;
          }
          errs.push(errJson('stray_cr'));
          if (pieces === null) pieces = [];
          pieces.push(s.slice(pieceStart, p + k));
          stray += 1;
          p = p + k + 2;
          pieceStart = p;
          continue outer;
        }
        if (t === 117) throw FALLBACK; // \u: the decoded path handles it
        // \" \\ \t \b \f \/: transparent — the escape stays in the piece.
        transparent += 1;
        k = seg.indexOf('\\', k + 2);
      }
      // No (more) escapes in this segment: the field ends at the comma / end.
      if (iC !== -1 && iC < end) {
        endRaw = segEnd;
        pos = segEnd + 1;
        ended = COMMA;
      } else {
        endRaw = end;
        pos = end;
        ended = END;
      }
      break;
    }
    const totalRaw = endRaw - fieldStart;
    const decodedLen = totalRaw - transparent - 2 * stray;
    fEnded = ended;
    fAdded = decodedLen;
    fEmpty = decodedLen === 0;
    if (pieces === null) {
      fEmitted = s.slice(fieldStart, endRaw);
      return;
    }
    pieces.push(s.slice(pieceStart, endRaw));
    // The pieces are the raw content with the stray \r escapes removed; every
    // escape left in them passes through verbatim, so this IS the emitted form.
    fEmitted = pieces.join('');
  }

  // What follows a quoted field's closing quote (pos is just past it);
  // qEmitted is the quoted field's emitted content.
  function afterQuoteRaw(qEmitted) {
    fQuoted = true;
    fEmpty = false;
    if (pos >= end) {
      fEnded = END;
      fEmitted = qEmitted;
      return;
    }
    const c = s.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fEnded = COMMA;
      fEmitted = qEmitted;
      return;
    }
    if (s.charCodeAt(pos) === 92 && s.charCodeAt(pos + 1) === 110) {
      pos += 2;
      line += 1;
      fEnded = LINE_BREAK;
      fEmitted = qEmitted;
      return;
    }
    if (
      s.charCodeAt(pos) === 92 &&
      s.charCodeAt(pos + 1) === 114 &&
      s.charCodeAt(pos + 2) === 92 &&
      s.charCodeAt(pos + 3) === 110
    ) {
      pos += 4;
      line += 1;
      fEnded = LINE_BREAK;
      fEmitted = qEmitted;
      return;
    }
    // What follows the closing quote is appended as it stands.
    readUnquotedRaw();
    if (fAdded > 0) errs.push(errJson('quote_junk'));
    fEmitted = qEmitted + fEmitted;
    fEmpty = false;
    // fEnded / fAdded stay the junk read's; fQuoted stays the field's.
  }

  // Reads a quoted field whose opening quote is at pos, when it holds a doubled
  // quote or a line break inside it.
  function readQuotedGeneralRaw(open, openLine) {
    let p = open + 2;
    let segStart = p;
    let rawParts = null; // the field's raw segments, in order
    let segBreaks = 0; // line breaks the segments hold
    let segHasRN = false; // a segment holds a \r or \n escape
    let segHasDbl = false; // a segment holds a literal backslash (\\)
    // Scans one segment's escapes once: counts its line breaks, flags a
    // literal backslash, throws on \u. Pushes the segment as it stands.
    function pushSeg(seg) {
      let i = seg.indexOf('\\');
      while (i !== -1) {
        const t = seg.charCodeAt(i + 1);
        if (t === 117) throw FALLBACK;
        if (t === 92) {
          segHasDbl = true;
          i = seg.indexOf('\\', i + 2);
          continue;
        }
        if (t === 114) {
          segBreaks += 1;
          segHasRN = true;
          if (seg.charCodeAt(i + 2) === 92 && seg.charCodeAt(i + 3) === 110) i = seg.indexOf('\\', i + 4);
          else i = seg.indexOf('\\', i + 2);
          continue;
        }
        if (t === 110) {
          segBreaks += 1;
          segHasRN = true;
          i = seg.indexOf('\\', i + 2);
          continue;
        }
        i = seg.indexOf('\\', i + 2);
      }
      if (rawParts === null) rawParts = [];
      rawParts.push(seg);
    }
    for (;;) {
      const q = s.indexOf('\\"', p);
      if (q === -1 || q >= end) {
        // The quote never closes: literal, re-read as unquoted.
        pos = open + 2;
        line = openLine;
        errs.push(errJson('unterminated_quote'));
        readUnquotedRaw();
        fEmitted = '\\"' + fEmitted;
        fEmpty = false;
        fQuoted = true;
        return;
      }
      if (s.charCodeAt(q + 2) === 92 && s.charCodeAt(q + 3) === 34) {
        // A doubled quote: one literal quote, and the field goes on.
        pushSeg(s.slice(segStart, q));
        p = q + 4;
        segStart = p;
        continue;
      }
      pushSeg(s.slice(segStart, q));
      pos = q + 2;
      line += segBreaks;
      fQuoted = true;
      if (segHasDbl) {
        // A literal backslash inside: decode the field the safe way.
        const dec = decodeRawSpan(rawParts.join('\\"\\"'));
        const conv = dec.replaceAll('""', '"').replace(/\r\n?/g, '\n');
        afterQuoteRaw(JSON.stringify(conv).slice(1, -1));
        return;
      }
      let joined = rawParts.join('\\"');
      if (segHasRN) joined = joined.split('\\r\\n').join('\\n').split('\\r').join('\\n');
      afterQuoteRaw(joined);
      return;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuotedRaw() {
    const open = pos;
    const openLine = line;
    const p = open + 2;
    const q = s.indexOf('\\"', p);
    if (q === -1 || q >= end) {
      pos = open + 2;
      line = openLine;
      errs.push(errJson('unterminated_quote'));
      readUnquotedRaw();
      fEmitted = '\\"' + fEmitted;
      fEmpty = false;
      fQuoted = true;
      return;
    }
    if (s.charCodeAt(q + 2) === 92 && s.charCodeAt(q + 3) === 34) {
      readQuotedGeneralRaw(open, openLine);
      return;
    }
    // The first quote is the closing one, unless a line break sits inside it.
    const inner = s.slice(p, q);
    let dirty = false;
    let hasDbl = false;
    let breaks = 0;
    let b = inner.indexOf('\\');
    while (b !== -1) {
      const t = inner.charCodeAt(b + 1);
      if (t === 117) throw FALLBACK;
      if (t === 92) {
        hasDbl = true;
        b = inner.indexOf('\\', b + 2);
        continue;
      }
      if (t === 114) {
        dirty = true;
        breaks += 1;
        if (inner.charCodeAt(b + 2) === 92 && inner.charCodeAt(b + 3) === 110) b = inner.indexOf('\\', b + 4);
        else b = inner.indexOf('\\', b + 2);
        continue;
      }
      if (t === 110) {
        dirty = true;
        breaks += 1;
        b = inner.indexOf('\\', b + 2);
        continue;
      }
      b = inner.indexOf('\\', b + 2);
    }
    pos = q + 2;
    fQuoted = true;
    if (!dirty) {
      afterQuoteRaw(inner);
      return;
    }
    line += breaks;
    if (hasDbl) {
      const dec = decodeRawSpan(inner);
      const conv = dec.replace(/\r\n?/g, '\n');
      afterQuoteRaw(JSON.stringify(conv).slice(1, -1));
      return;
    }
    afterQuoteRaw(inner.split('\\r\\n').join('\\n').split('\\r').join('\\n'));
  }

  // Finalises one record: rowJson is the row's JSON (already cut to width when
  // long), fieldCount its field count, extraJson the cut fields' JSON (or null).
  function finishRecord(rowJson, fieldCount, extraJson) {
    if (width < 0) {
      width = fieldCount;
      if (header) {
        columnsJson = rowJson;
        return;
      }
      rowsParts.push(rowJson);
      rowsCount += 1;
      return;
    }
    if (fieldCount < width) {
      errs.push(errJson('short_row', ',"fields":' + fieldCount));
      rowJson = rowJson.slice(0, -1) + ',""'.repeat(width - fieldCount) + ']';
    } else if (fieldCount > width) {
      errs.push(errJson('long_row', ',"extra":' + extraJson));
    }
    if (header && columnsJson === null) {
      columnsJson = rowJson;
      return;
    }
    rowsParts.push(rowJson);
    rowsCount += 1;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < end) {
      if (s.charCodeAt(pos) === 92 && s.charCodeAt(pos + 1) === 110) {
        pos += 2;
        line += 1;
      } else if (
        s.charCodeAt(pos) === 92 &&
        s.charCodeAt(pos + 1) === 114 &&
        s.charCodeAt(pos + 2) === 92 &&
        s.charCodeAt(pos + 3) === 110
      ) {
        pos += 4;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= end) break;

    recordLine = line;
    recordRow = header && columnsJson === null ? null : rowsCount;
    const fields = [];
    let quoted = false;
    do {
      quoted = s.charCodeAt(pos) === 92 && s.charCodeAt(pos + 1) === 34;
      if (quoted) readQuotedRaw();
      else readUnquotedRaw();
      fields.push(fEmitted);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fEmpty && !quoted) continue;

    const fieldCount = fields.length;
    let rowJson;
    let extraJson = null;
    if (width >= 0 && fieldCount > width) {
      rowJson = '["' + fields.slice(0, width).join('","') + '"]';
      extraJson = '["' + fields.slice(width).join('","') + '"]';
    } else {
      rowJson = '["' + fields.join('","') + '"]';
    }
    finishRecord(rowJson, fieldCount, extraJson);
  }

  return (
    '{"columns":' +
    (header ? columnsJson ?? '[]' : 'null') +
    ',"rows":[' +
    rowsParts.join(',') +
    '],"errors":[' +
    errs.join(',') +
    ']}'
  );
}
