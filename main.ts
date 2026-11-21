// csv-reader 1.0.0, the round-3 entry: a byte-level JSON-through driver. The
// harness runs `node /bot/main.ts` (node22). It reads every case from
// /input/cases.json and writes /output/answers.json: a JSON array of the
// answers, one per case and in the cases' order. Outside a container
// MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and /output.
//
// Instead of JSON.parse on the whole 11 MB file and JSON.stringify on the
// 12 MB of answers, this driver scans the JSON envelope structurally (the
// file is one JSON array of {id, input:{text, header}}), hands each case's
// "text" value to solve.js runJson() as a RAW span — the escaped content,
// never decoded into a JS string — and joins the per-case answer JSON
// strings. The output is byte-identical to what the house driver
// (JSON.parse + run + JSON.stringify) produces. A case holding a \u escape,
// or an envelope the scanner does not recognise, falls back to the house
// path for that case (decode with JSON.parse, run(), JSON.stringify).

import { openSync, readFileSync, writeSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of its work runs under it.
setFlagsFromString('--no-incremental-marking');

/** solve.js, imported by its URL (a .js module carries no types) and typed by its contract. */
const { run, runJson, RawFallback } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
  runJson: (s: string, start: number, end: number, header: boolean) => string;
  RawFallback: new () => Error;
};

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The envelope scanner hit something it does not recognise: use the house path. */
class EnvelopeFallback extends Error {}

const raw = readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8');
const n = raw.length;

function skipWs(p: number): number {
  while (p < n) {
    const c = raw.charCodeAt(p);
    if (c === 32 || c === 9 || c === 10 || c === 13) p += 1;
    else break;
  }
  return p;
}

/** A JSON string starting at p (raw[p] is '"'): [contentStart, contentEnd, endPos]. */
function readString(p: number): [number, number, number] {
  let q = p + 1;
  for (;;) {
    const iQ = raw.indexOf('"', q);
    const iB = raw.indexOf('\\', q);
    if (iB !== -1 && (iQ === -1 || iB < iQ)) {
      q = raw.charCodeAt(iB + 1) === 117 ? iB + 6 : iB + 2;
      continue;
    }
    if (iQ === -1) throw new EnvelopeFallback();
    return [p + 1, iQ, iQ + 1];
  }
}

/** Skip one JSON value starting at p; returns the position just past it. */
function skipValue(p: number): number {
  p = skipWs(p);
  const c = raw[p];
  if (c === '"') return readString(p)[2];
  if (c === '{') {
    p = skipWs(p + 1);
    if (raw[p] === '}') return p + 1;
    for (;;) {
      if (raw[p] !== '"') throw new EnvelopeFallback();
      p = skipWs(readString(p)[2]);
      if (raw[p] !== ':') throw new EnvelopeFallback();
      p = skipValue(p + 1);
      p = skipWs(p);
      if (raw[p] === ',') {
        p = skipWs(p + 1);
        continue;
      }
      if (raw[p] === '}') return p + 1;
      throw new EnvelopeFallback();
    }
  }
  if (c === '[') {
    p = skipWs(p + 1);
    if (raw[p] === ']') return p + 1;
    for (;;) {
      p = skipValue(p);
      p = skipWs(p);
      if (raw[p] === ',') {
        p = skipWs(p + 1);
        continue;
      }
      if (raw[p] === ']') return p + 1;
      throw new EnvelopeFallback();
    }
  }
  // A number, true, false or null: scan to a delimiter.
  let q = p;
  while (q < n && ',}] \t\n\r'.indexOf(raw[q]) === -1) q += 1;
  if (q === p) throw new EnvelopeFallback();
  return q;
}

/** One case's answer JSON, by the fast path, or the house path on \u escapes. */
function answerCase(tStart: number, tEnd: number, header: boolean): string {
  try {
    return runJson(raw, tStart, tEnd, header);
  } catch (e) {
    if (e instanceof RawFallback) {
      const text = JSON.parse('"' + raw.slice(tStart, tEnd) + '"') as string;
      return JSON.stringify(run({ text, header }));
    }
    throw e;
  }
}

/** The fast path: scan the envelope, answer each case off its raw text span. */
function fastPath(): string[] {
  let p = skipWs(0);
  if (raw[p] !== '[') throw new EnvelopeFallback();
  p += 1;
  const out: string[] = ['['];
  let first = true;
  for (;;) {
    p = skipWs(p);
    if (raw[p] === ']') break;
    if (raw[p] === ',') {
      p += 1;
      continue;
    }
    if (raw[p] !== '{') throw new EnvelopeFallback();
    p += 1;
    let textSpan: [number, number] | null = null;
    let header = false;
    for (;;) {
      p = skipWs(p);
      if (raw[p] === '}') {
        p += 1;
        break;
      }
      if (raw[p] !== '"') throw new EnvelopeFallback();
      const [ks, ke, kend] = readString(p);
      const key = raw.slice(ks, ke);
      p = skipWs(kend);
      if (raw[p] !== ':') throw new EnvelopeFallback();
      p = skipWs(p + 1);
      if (key === 'input') {
        if (raw[p] !== '{') throw new EnvelopeFallback();
        p += 1;
        for (;;) {
          p = skipWs(p);
          if (raw[p] === '}') {
            p += 1;
            break;
          }
          if (raw[p] !== '"') throw new EnvelopeFallback();
          const [iks, ike, ikend] = readString(p);
          const ikey = raw.slice(iks, ike);
          p = skipWs(ikend);
          if (raw[p] !== ':') throw new EnvelopeFallback();
          p = skipWs(p + 1);
          if (ikey === 'text') {
            if (raw[p] !== '"') throw new EnvelopeFallback();
            const [ts, te, tend] = readString(p);
            textSpan = [ts, te];
            p = tend;
          } else if (ikey === 'header') {
            if (raw.startsWith('true', p)) {
              header = true;
              p += 4;
            } else if (raw.startsWith('false', p)) {
              header = false;
              p += 5;
            } else {
              throw new EnvelopeFallback();
            }
          } else {
            p = skipValue(p);
          }
          p = skipWs(p);
          if (raw[p] === ',') {
            p += 1;
            continue;
          }
          if (raw[p] !== '}') throw new EnvelopeFallback();
        }
      } else {
        p = skipValue(p);
      }
      p = skipWs(p);
      if (raw[p] === ',') {
        p += 1;
        continue;
      }
      if (raw[p] !== '}') throw new EnvelopeFallback();
    }
    if (textSpan === null) throw new EnvelopeFallback();
    if (!first) out.push(',');
    first = false;
    out.push(answerCase(textSpan[0], textSpan[1], header));
  }
  out.push(']');
  return out;
}

/** The house path: JSON.parse the whole file, run() each case, stringify. */
function housePath(): string {
  const cases = JSON.parse(raw) as { id: string; input: unknown }[];
  const answers: unknown[] = [];
  for (const c of cases) answers.push(run(c.input));
  return JSON.stringify(answers);
}

let parts: string[];
try {
  parts = fastPath();
} catch (e) {
  if (e instanceof EnvelopeFallback) parts = [housePath()];
  else throw e;
}
// Stream the parts out one by one: no 12 MB join copy before the write.
const fd = openSync(join(OUTPUT_DIR, 'answers.json'), 'w');
try {
  for (const part of parts) writeSync(fd, part);
} finally {
  closeSync(fd);
}
