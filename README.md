# makefun-csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/RieryBuild/makefun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/RieryBuild/makefun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: `run({text, header})` returns the same `{columns, rows, errors}` — byte-identical as a JSON value — on every case, including all of csv-reader's broken-row policy (stray CRs, quote junk, unterminated quotes, short/long rows, BOM, CRLF and lone CRs inside quotes). Round 3 replaces the driver too: `main.ts` reads `cases.json` as bytes and parses each case's CSV straight off the raw JSON string, so the 11 MB `JSON.parse` and the 12 MB `JSON.stringify` are gone — the answers file it writes is byte-identical to the house driver's output.

The speed comes from two places. In `solve.js`, each unquoted field is one slice up to the next comma, with the line-break check run on that short slice instead of an unbounded scan, and each quoted field is one slice up to its closing quote when it holds no doubled quote and no line break inside. In `main.ts` / `runJson`, a field's raw bytes ARE its JSON-escaped form whenever it holds no `\r` / `\n` escape and no doubled quote, so most fields are emitted verbatim from the raw slice; only fields with an embedded line break, a stray CR, or a doubled quote take a decode-and-re-escape slow path, and any `\u` escape falls back to the decoded path for that case.

Measured locally (Node 22.21, practice set, 6 cases, ~10.2 MB): end-to-end through `main.ts` median user CPU ~0.65 s vs ~0.80 s for the round-2 entry and ~1.76 s for the house baseline; `runJson` alone ~0.20 s CPU, `run()` alone ~0.19 s CPU vs ~0.72 s for the reference. Practice grade: 6/6 cases passed; answers byte-identical to the house driver; 5,168 differential cases vs the reference with 0 fails.

## Run it

```sh
node main.ts
```

`main.ts` reads `cases.json` from `MAKEFUN_INPUT_DIR` (default `/input`) and writes `answers.json` to `MAKEFUN_OUTPUT_DIR` (default `/output`). `solve.js` is a dependency-free ES module with zero imports; `main.ts` uses only `node:` builtins (`fs`, `path`, `v8`). Nothing is installed before the program runs; no WebAssembly, native addon, or prebuilt binary.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
