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
