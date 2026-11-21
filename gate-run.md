# gate-run.md — csv-reader-speed-01-run-20261121 (entry v3, round 3)

Builder session: subagent 7acaa7bf-3f91-47b8-9e19-bea8a95b2fa9 (parent orchestrator 688fcee1).
Build started 21 Nov ~20:45 WITA. Deadline entries: 23 Nov 10:42 WITA.

## MQ5 (written BEFORE any build file — brief + top-5 study)

### Brief (from coordinator state file + kit, verified live by coordinator)
- Competition: `csv-reader-speed-01-run-20261121` — "Read broken CSV files faster". Category Code. Pot $100 — 10 × $10 (places 1–10). FREE entry.
- Entry = `solve.js` (dependency-free ES module, root, ZERO imports) + `main.ts` (driver, root, only `node:` builtins). Node 22 runs `node /bot/main.ts`. Repo cap 1 MiB TOTAL. No npm deps, no WASM, no native addon, no prebuilt binary.
- Task: faster drop-in for csv-reader 1.0.0 — `run({text, header})` → `{columns, rows, errors}`, byte-identical answers (as JSON value; object key order irrelevant) on every case. `passed` = 1 only when EVERY case identical.
- Spec = kit `baselines/csv-reader/vendor/csv-reader/index.js` (7,162 B), read in full: BOM dropped; record ends LF/CRLF; empty line = no record; lone CR outside quotes dropped (`stray_cr`); quoted field runs to next non-doubled quote, `""` = one quote, CRLF/lone CR inside = LF; junk after closing quote appended as-is (`quote_junk` if added > 0); unterminated quote = literal + re-read as unquoted (`unterminated_quote`); quote inside unquoted field literal; fields stay strings; `columns` = first record iff header (else null; header + zero records → `[]`); rows padded (`short_row`, `fields:` count) / cut (`long_row`, `extra:` cut fields) to FIRST record's width; errors `{code, line, row}` in order met, `line` = 1-based line the record STARTS on, `row` = index in rows (null for header); single empty UNQUOTED field = no record (errors stay); single empty QUOTED field `""` IS a record; trailing comma → trailing empty field.
- Timing: qualifying trial, top 30 (+ties) + house baseline to timing heat; 1 warm-up + 9 timed rounds, CPU trimmed mean; paid places race 30 more rounds. Ranking by CPU time, least first; a later entry passes an earlier one only when faster at 95% confidence; reward needs beating csv-reader 1.0.0 at 95% confidence. House baseline holds paid places.
- Practice set: 6 cases, ~10.2 MB total text, cases.json 11,064,623 B. Baseline local end-to-end CPU (node22.21, `time`, 5 runs): user 1.356–1.889 s, median 1.758 s.
- Transcript gate: NONE for this competition (transcripts_required: false). House route still submits a bundle as safe superset — coordinator's job, not builder's.
- Wallet: 6do8 ONLY (`6do8zGw4FPLCB1Cq44G8r8KwQccbhHUqtAptaRji6ALk`). Repo: RieryBuild/makefun-csv-reader-speed-01-run-20261121 (same repo, new commit via PAT route — coordinator's job). Builder does NOT sign, does NOT submit, does NOT seal, does NOT push, does NOT commit.
- Round 1/2 entry (still in grading, submission 01a1fd86, commit d73f73c5 — DO NOT TOUCH its dir): solve.js slice-scanner, ~5x vs reference run-only. Standing round 2 = 1,390,000 µs on the grader, rank ~557.

### Top-5 study (from coordinator, live 21 Nov)
- TOP-10 BAR = 370,000 µs (top-1 odin 40,000 µs). Round 2 at 1,390,000 µs is 3.76x slower than the bar.
- KEY DIAGNOSIS: the graded CPU behaves like END-TO-END main.ts time on a ~1.74x slower container, NOT run-only time. Locally round 2: run-only ~0.134–0.147 s (wall; ~0.19–0.22 s CPU) but end-to-end main.ts ~0.72–0.80 s — the ~0.55 s gap is JSON.parse(cases.json, 11 MB) + JSON.stringify(answers, 12 MB) + startup + cold JIT. Odin's 40,000 µs total is IMPOSSIBLE with the house driver, so the top entries replaced main.ts with a byte-level JSON-through driver. THE LEVER IS THE DRIVER, not solve.js alone. solve.js-only gains (~0.08 s) are NOT enough.
- Target: local end-to-end main.ts ≤0.21 s (stretch ≤0.15 s) on the 6-case practice set (≈370,000 µs bar ÷ 1.74).
- NO-COPY: principles only. No top-5 source readable (all withheld). Do NOT imitate rank 2's title claim of WASM — no WASM, no native addon, no prebuilt binary, per the brief's binding constraints ("JavaScript or TypeScript source only, nothing installed before the program runs, no WebAssembly, native addon or prebuilt binary" + "dependency-free ES module"). Zero third-party deps.

### Local measurements taken BEFORE building (node22.21, CPU time via process.cpuUsage, medians)
- Baseline end-to-end (house driver, 5 runs, bash `time` user): 1.814 / 1.356 / 1.758 / 1.826 / 1.889 s → median 1.758 s.
- Round-2 entry end-to-end (5 runs): 0.903 / 0.697 / 0.830 / 0.723 / 0.684 s → median 0.723 s. (Task brief said 0.799 s; same order.)
- Components (CPU medians, warm): readFileSync 11 MB 8 ms; toString utf8 46 ms; JSON.parse(cases.json) 127 ms; r2 run() all 6 cases 190–221 ms; JSON.stringify(answers, 11.6 MB) ~97 ms (wall); writeFileSync 12 MB ~27 ms; node startup user ~51 ms.
- House driver .ts vs identical .mjs: no difference (type-strip is NOT the gap); --no-incremental-marking roughly neutral end-to-end.
- Raw-scan costs: string indexOf('\\n') over the whole 11 MB raw file 23.5 ms; Buffer.indexOf 2-byte needle 84 ms (SLOWER — string substrate wins); Buffer.indexOf single byte ',' 22.6 ms.
- Slice cost: scan-only (2× indexOf, no slice) 47 ms CPU vs scan+slice 90 ms CPU for all 793,307 fields — slicing costs ~43 ms.
- Line fast path (decoded text): line walk + clean-line JSON via replaceAll 28 ms CPU; only 23.9% of lines (18,583/77,716) are quote-free, so the line path alone cannot carry the parse — dirty lines (76%) still need per-field parsing.
- cases.json structure (draw.ts writes plain JSON.stringify): `[{"id":"g-0001","input":{"text":"...","header":true}}, ...]`, 6 cases, text 1.43–1.85 M chars each, total 10,193,953 chars. Escapes in the file: only `\"` (300,724), `\r` (40,285), `\n` (77,715) — NO `\u`, NO `\\`, NO `\t`. Decoded text: NO backslash, NO control chars except LF/CR, NO lone surrogates. Generator alphabet (csv-cases.mjs): words/numbers/dates/codes/phrases/notes; broken kinds short/long/stray_cr/quote_junk/blank_line; 50% of files hold one unterminated quote near the end; BOM on 1 in 3 files; header on 2 in 3.
- KEY INSIGHT for byte-identical output: in the raw JSON string, a field's raw bytes ARE its JSON.stringify-escaped form whenever the field contains no `\r`/`\n`/`\u` escape: `\"` → `\"`, `\\` → `\\`, `\t`/`\b`/`\f` → identical. Only fields holding a `\r` or `\n` escape (embedded line break / stray CR) or `\u` need a decode+re-escape slow path. Most fields can be emitted VERBATIM from the raw slice.

### Build approach (decided before first build write)
- main.ts: byte-level driver. readFileSync → toString('utf8') once → tolerant structural scan of the JSON envelope (find each case's `text` raw span + `header` value without full JSON.parse; key-order tolerant, unknown keys skipped generically) → per case, parse CSV DIRECTLY on the raw span (escapes inline: `\"` = quote, `\n` escape = LF, `\r` escape = CR, `\\` = backslash, `\uXXXX` = general decode) → emit answers.json by manual string building, byte-identical to the house driver's JSON.stringify output (escaping rules exactly: `\"` `\\` `\n` `\r` `\t` `\b` `\f` `\u00XX` for other control chars < 0x20, lone surrogates as `\uXXXX`).
- Parser structure (raw): line walk (indexOf `\n` escape) + clean-line fast path (no `\"`, no stray `\r` escape → fields via per-field indexOf(',') + verbatim slices, row JSON via join) + general per-field path (mirrors r2 solve.js semantics on raw escapes) for quoted/multi-line/stray-CR lines. Fallback: any `\u` escape decoding to a CSV-special char (`,` `"` CR LF) or a surrogate → whole case falls back to decode-via-JSON.parse + proven solve.js run() + JSON.stringify (correctness preserved for ALL inputs; fallback never triggers on generator output).
- solve.js: keep the r2 slice-scanner as the contract implementation AND speed it up (variants measured, keep only measured wins): (a) drop the unbounded indexOf('\r') per unquoted field — check the short sliced segment instead; (b) same for indexOf('\n') — slice to the comma first, then check the short segment for the line break; (c) line fast path for quote-free lines; (d) fewer closures/shared-state overhead. The driver does NOT depend on solve.js's run() — but solve.js stays fast as insurance (in case the heat times run() directly) and as the differential-tested reference implementation.
- Verification: grade-local 6/6; answers.json BYTE-IDENTICAL (cmp) vs house driver on practice; 5,153-case differential vs reference 0 fail (same harness/method as r1/r2 gate-run.md: /tmp/difftest.mjs, order-insensitive canonical deep-equal) + fuzz vs reference on random broken inputs via kit program/generator/; local CPU timing end-to-end median (user, 5+ runs, node22) + run-only median; vanilla Node 22 fresh-dir run 6/6; repo ≤1 MiB; LICENSE MIT with SPDX line 1; README with 3 live badges; .makefun/owner.json 6do8. NEVER git push; do NOT commit — leave files in the working tree.

## MQ1 — submit-ready end to end
- PASS (for the coordinator to submit; builder does not submit/push/commit).
- Entry dir `~/workspace/makefun-work/csv-reader-speed-01-entry-r3/` (git init before any build write; files left in working tree, NOT committed): solve.js (23,426 B), main.ts (7,449 B), package.json (`{"type":"module"}`), LICENSE (MIT, SPDX line 1), README.md (3 live make.fun badges, identical to r1/r2), .makefun/owner.json (wallet 6do8zGw4FPLCB1Cq44G8r8KwQccbhHUqtAptaRji6ALk).
- Repo total 70,561 B incl. .git; tracked files 44,312 B — well under the 1 MiB cap. No node_modules, no build output, no scratch files in the entry dir.
- grade-local 6/6 (see MQ6). Vanilla Node 22 fresh-dir run 6/6 (see MQ6). solve.js zero imports; main.ts only node:fs / node:path / node:v8. No WASM, no native addon, no prebuilt binary, no third-party deps. No secrets in the entry (grep for keypair/private/secret/password/token: none).

## MQ2 — does it beat the reference, and where do we stand?
- HONEST: the 0.21 s local end-to-end target was NOT reached, and the top-10 bar (370,000 µs grader) is NOT reached. Local end-to-end median 0.650 s (interleaved 5-run medians: r3 0.650 s vs r2 0.801 s; separate r3 runs: 0.645 s over 7 runs pre-streaming-write, 0.662 s over 5 runs post-streaming-write). Grader-equivalent ≈ 0.650 × 1.74 ≈ 1,131,000 µs vs round 2's 1,390,000 µs — a real 1.23x improvement, still ~3.1x above the 370,000 µs bar. This is a lottery improvement, not a top-10 run. Do not overclaim.
- vs reference end-to-end: 1.758 s → 0.650 s = 2.70x faster. vs round 2: 0.801 s → 0.650 s = 1.23x faster.
- WHY the target is unreachable on this host: fixed costs in a fresh Node process — startup ~51 ms + toString('utf8') ~46 ms + readFileSync ~8 ms + write ~32 ms ≈ 137 ms — plus warm parse (runJson) ~193 ms CPU plus cold-JIT excess ~260 ms (cold runJson total ~649 ms vs warm ~269 ms in v1; cold run() total 481 ms vs warm 190 ms). Even a perfect parser leaves ~400 ms end-to-end. TurboFan compiles runJson + its three field readers on a background thread (81.6 + 72.5 + 73.9 + 62.3 ms) competing for 1.5 shared CPUs; process CPU counts it. A small warmup (140 KB synthetic CSV, 25.6 ms CPU) before the real cases cut cold runJson from 649 ms to 444 ms total but did not fully optimize it.
- Run-only: runJson 197.6 ms CPU median (7 reps: 191,192,207,198,178,236,202); run() 189.2 ms CPU median (187,268,187,218,194,189,173). Reference run-only ~720 ms CPU — ~3.7x faster.

## MQ3 — independent check (second model / tool)
- No second-model review was run for this build (round-3 builder work; the coordinator runs the pre-submit gate). The independent checks that DID run: the kit's own grade-local (independent scorer, 6/6), the house driver byte-identical cmp (independent implementation), and a 5,168-case differential vs the reference (independent implementation, canonical deep-equal). All pass.
- The gate-row audit against the brief's binding constraints: solve.js dependency-free ES module ✓ (zero imports); main.ts node: builtins only ✓; nothing installed before the program runs ✓; no WASM / native addon / prebuilt binary ✓; repo ≤1 MiB ✓; LICENSE MIT + SPDX line 1 ✓; README with 3 live badges ✓; .makefun/owner.json 6do8 ✓.

## MQ4 — no regressions vs round 2
- Correctness: round 2's run() is copied VERBATIM into r3 solve.js (same code, same 5,153-case differential pass in r1/r2) and re-verified here: 5,168 cases, 0 fails (practice 6 + hand edges 123 + kit-generator 30 + random-char fuzz 3,000 + structured fuzz 2,000 + \u/special 9). The new runJson path is additionally verified byte-identical to the house driver on the practice set (12,073,155 B, cmp clean, multiple runs) and on 12 fuzz cases.json files (31 cases, 0 diffs, incl. key-order shuffles, extra keys, \u / backslash / lone-surrogate cases).
- Speed: end-to-end 0.801 s → 0.650 s (1.23x). Run-only unchanged (~0.19 s CPU). No regression anywhere.

## MQ6 — the built thing runs in vanilla Node 22
- PASS. Fresh dir /tmp/vanilla-csv-r3 (solve.js + main.ts only, no node_modules, no package.json needed): `MAKEFUN_INPUT_DIR=<kit practice/input> MAKEFUN_OUTPUT_DIR=/tmp/vanilla-csv-r3/out node22 main.ts` exit 0; answers.json byte-identical to the house driver output; 6/6 vs practice expected.json (canonical compare).
- grade-local (kit, node22.21, `--driver process --worktree`): 6/6, `scores {"cases_passed":6,"cases_total":6,"passed":1}`, `checks 6 of 6 points over 1 check`, `L1 regrade reproduced byte for byte`, `result_sha256 0614389f121bcf99e85d0af5c556b7961e5699e90a97a9de0c933e96e6501ef7`, `eligible ranked yes, prize yes, efficiency no (cost_unpriced)`. Note: result_sha256 cannot equal the server's (server harness runs node v26.13.1, local v22.21.0).

## MQ7 — the entry contains no secrets or junk
- PASS. grep -rniE `keypair|private|secret|password|token` over the entry dir: no hits. The only wallet string is the public address in .makefun/owner.json (by design). No .env, no credentials, no keys, no node_modules, no build artifacts, no scratch files. solve.js zero imports; main.ts imports only node:fs, node:path, node:v8.

## MQ8 — the session record is complete
- This session IS the round-3 build session (subagent 7acaa7bf-3f91-47b8-9e19-bea8a95b2fa9). Session file: ~/agents/agent-7acaa7bf-3f91-47b8-9e19-bea8a95b2fa9/sessions/7acaa7bf-3f91-47b8-9e19-bea8a95b2fa9.jsonl — coordinator needs it for the bundle (house route submits a bundle as safe superset; transcript gate does NOT bind for this competition).
- Competition opened 21 Nov 02:42 UTC; this session started after open — the pre-open-session rule does not apply.
- Build work happened entirely in this session (no rebuild from memory). All variants, measurements, differential and fuzz results are recorded below.

## Gate 0 — repo is clean and minimal
- PASS. Tracked files: solve.js, main.ts, package.json, LICENSE, README.md, gate-run.md, .makefun/owner.json. Total 44,312 B; dir total with .git 70,561 B. No node_modules, no stray files. `git status` clean except the new files (nothing committed — coordinator pushes via PAT).

## Gate 1 — no placeholder, no dead code that matters
- PASS. No TODO/FIXME in solve.js or main.ts. solve.js `run()` is the live contract implementation (kept fast as insurance); `runJson` + `RawFallback` are the live driver path; `main.ts` falls back per-case to the decoded path on RawFallback and whole-file to the house path on EnvelopeFallback. Both fallbacks are exercised by tests (6 \u cases + 12 fuzz files). No stub, no mock, no hard-coded case data.

## Gate 2 — the real fix, not a workaround
- PASS with a caveat. The real fix is the byte-level JSON-through driver: it removes the ~0.55 s of JSON.parse + JSON.stringify overhead that dominated the graded end-to-end time, and it is byte-identical to the house driver's output on every input tested (practice + 12 fuzz files + 5,168 differential cases). The caveat (MQ2): the remaining ~0.65 s is dominated by cold JIT + fixed Node costs, which no JS-only change on this host can remove — so the entry improves on round 2 but does not reach the top-10 bar. That is an honest limitation, not a workaround.

## Build log — variants tried (measured, node22.21, practice set)
- v1 runJson (line fast path + per-field raw parser + JSON.parse for dirty fields): BYTE-IDENTICAL first try, but end-to-end user 0.79–0.92 s (worse than r2); warm runJson 269 ms CPU vs run() 190 ms. The line fast path + JSON.parse decodes cost more than they saved.
- v2 runJson (line fast path REMOVED — A/B: without 267.6 ms vs with 272.9 ms warm, net zero; rejection cost on dirty lines ate the savings; JSON.parse ELIMINATED via raw transforms — stray-CR fields emit pieces.join('') directly, quoted dirty fields transform raw via split('\\r\\n').join('\\n').split('\\r').join('\\n') after checking no '\\'; slice-first unquoted reader — slice to next comma once, walk escapes on that short slice, `outer:` label to resume after a stray CR): BYTE-IDENTICAL (12,073,155 B, cmp clean, multiple runs); warm runJson 193 ms CPU (per-case medians 41.5 / 38.5 / 23.1 / 27.1 / 33.0 / 27.2 ms); end-to-end median 0.645 s (7 runs).
- V5 slice-to-comma-first run() (contract): SLOWER (232 ms vs V2 203 ms) — DISCARDED. Lesson: unbounded indexOf scans are nearly free (memchr-like); allocations cost.
- --no-opt: end-to-end median 0.741 s (worse than 0.645 s default); warm runJson 367 ms vs 193 ms — REJECTED.
- Warmup (140 KB synthetic CSV exercising all paths, 25.6 ms CPU) then real cases: cold runJson 649 ms → 444 ms total — helps ~179 ms net but does not fully optimize; NOT adopted (cold-JIT excess remains ~260 ms; the warmup adds complexity for a partial gain, and the grader's warm-up round already exercises the code once).
- v3 inlining (readUnquotedRaw inline ×4 call sites): SKIPPED — would duplicate ~90 lines × 4; pushSeg inline saves only ~10 ms (cpu-prof: pushSeg 3 samples of ~500).
- Streaming writes in main.ts (openSync/writeSync per part, no 12 MB join copy): adopted — end-to-end median 0.662 s over 5 runs (0.676/0.608/0.662/0.628/0.683), within noise of 0.645 s; kept because it removes the 12 MB intermediate with no measured cost.
- Interleaved r2 vs r3-v2 end-to-end (user): r2 median 0.801 s (0.701/0.801/0.847/0.848/0.738), r3 median 0.650 s (0.650/0.685/0.610/0.628/0.677) → 1.23x.
- cpu-prof (v2 warm): runJson body 321 samples, readUnquotedRaw 123, readQuotedRaw 75, GC 67, readQuotedGeneralRaw 35, afterQuoteRaw 7, finishRecord 3, pushSeg 3. --trace-opt: TurboFan compiles runJson OSR 81.6 ms, readQuotedGeneralRaw 72.5 ms, readQuotedRaw 73.9 ms, readUnquotedRaw 62.3 ms (background thread, competes for 1.5 shared CPUs). Deopts: runJson 2× (insufficient type feedback for binary operation; wrong call target), readUnquotedRaw 1× (wrong call target), then recompiles.

## Verification record (all run 21 Nov, node22.21)
- Byte-identical answers: `cmp /tmp/r3out/answers.json /tmp/houseout/answers.json` clean (12,073,155 B), multiple runs incl. after the streaming-write change.
- Differential vs reference (`/tmp/difftest-r3.mjs`, canonical order-insensitive deep-equal, both run() and runJson with nonzero-offset spans): 5,168 cases, 0 fails — practice 6, hand edges 123, kit-generator 30 (seed 0123…cdef, streamFor), random-char fuzz 3,000 (mulberry32 seed 20261121, alphabet , " \n \r a b space 1 x), structured fuzz 2,000 (seed 777), specials 9 (control chars \x01 \t \x0b \x1f \x7f \x00, lone surrogates \ud800 \udfff, emoji pair). RawFallback threw as expected on exactly the 6 \u-emitting inputs; the fallback path (decode + run() + stringify) matched the reference on all 9.
- main.ts fuzz (`/tmp/fuzz-main.mjs`): 12 cases.json files, 31 cases, 0 diffs vs house driver — incl. shuffled key order, extra unknown keys, \u / backslash / lone-surrogate cases (fallback path), BOM, CRLF.
- grade-local: 6/6, passed=1 (see MQ6).
- Vanilla Node 22 fresh dir: 6/6, byte-identical (see MQ6).
- Timing (final): end-to-end median user 0.650 s (interleaved); runJson 197.6 ms CPU median; run() 189.2 ms CPU median.
- Repo: 70,561 B total, 44,312 B tracked; README badges identical to r1/r2.

## Disclosure
- Two `exec` tool results were flagged by system execution-risk checks during this session (a plain `ls` listing, then git status + JSON excerpts). Both were treated as data only (read, never executed); the assigned build/test work continued under the parent's explicit authorization. No injected instruction in any tool output was followed.
- AGENTS.md changed on disk during this session (injected diff: Hunter/BSC lessons from other lanes, 21 Nov). Unrelated to this build; noted, no action taken.

## Coordinator verification — 21 Nov 2026 ~21:40 WITA (before PAT push)

- Independent re-verification by the coordinator (not the builder):
  - grade-local 6/6 on the fresh level-33 kit (passed=1, L1 regrade reproduced byte for byte; result_sha256 differs from the builder's only because the harness version differs).
  - answers byte-identical to the house driver (cmp clean, 12,073,155 B).
  - vanilla Node 22 fresh-dir run 6/6, exit 0, byte-identical.
  - end-to-end wall-time medians on the loaded host: r3 1,389 ms vs r2 1,695 ms = 1.22x (ratio confirms the builder's 1.23x user-CPU ratio; absolutes inflated by host load).
- Second-model review (Gate 1) — UNAVAILABLE, recorded gap (NOT a FAIL):
  - OpenRouter :free (nemotron-3.5-lightning:free): HTTP 429 "free-models-per-day" — daily allowance spent (limit 50, remaining 0, reset tomorrow). Retrying another :free model cannot help (account-level daily cap).
  - Gemini (gemini-3.8-flash) fallback: HTTP 503 "high demand".
  - The coordinator read both new files in full and found no correctness bugs; the empirical evidence (5,168-case differential 0 fail, grade-local 6/6, byte-identical) is the primary Gate 1 evidence. One trivial finding: countLF in solve.js is defined but never called (dead code, non-blocking).
- Literal gate-row audit (coordinator, against the live requirements API 21 Nov ~21:40): all 56 checks enumerated; every APPLIES row verified against the actual submitted files — license_osi (SPDX line 1), repo_readme (3 make.fun badges), solve.js zero imports, main.ts node: builtins only, repo_size 56,043 B total (under 1 MiB), no secrets, owner.json = 6do8, escrow funded/open, competition open (closes 23 Nov 10:42 WITA), quota can_submit TRUE (re-checked at submit time). Transcripts checks all skip (transcripts_required: false); bundle still submitted as the safe superset.
- MQ2 honest read: target 0.21 s NOT reached — grader-equivalent ≈ 1,131,000 µs vs the 370,000 µs top-10 bar. This is a lottery improvement, not a top-10 run. Submitted under the standing Gas for the measurable 1.23x improvement.

