# makefun-csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/RieryBuild/makefun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/RieryBuild/makefun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: `run({text, header})` returns the same `{columns, rows, errors}` — byte-identical as a JSON value — on every case, including all of csv-reader's broken-row policy (stray CRs, quote junk, unterminated quotes, short/long rows, BOM, CRLF and lone CRs inside quotes). The speed comes from bulk scanning (`indexOf`/`slice`) instead of reading one character at a time: each unquoted field is one slice up to the next comma, LF or end of text, and each quoted field is one slice up to its closing quote when it holds no doubled quote and no line break inside. Only fields that actually contain doubled quotes, embedded line breaks, or stray CRs take a slower path.

Measured locally (Node 22.21, practice set, 6 cases, ~10.2 MB): ~5× the reference's CPU time on `run()` alone (median user CPU ~0.15 s vs ~0.74 s), ~2.1× end-to-end through the driver including JSON parse/stringify. Practice grade: 6/6 cases passed.

## Run it

```sh
node main.ts
```

`main.ts` reads `cases.json` from `MAKEFUN_INPUT_DIR` (default `/input`) and writes `answers.json` to `MAKEFUN_OUTPUT_DIR` (default `/output`). `solve.js` is a dependency-free ES module with zero imports; `main.ts` uses only `node:` builtins (`fs`, `path`, `v8`). Nothing is installed before the program runs; no WebAssembly, native addon, or prebuilt binary.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
