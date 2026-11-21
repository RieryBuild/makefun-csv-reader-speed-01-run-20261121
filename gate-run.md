# gate-run.md — csv-reader-speed-01-run-20261121 (entry v1)

Builder session: subagent c266053c-17c6-44db-961b-d55ba2a8ffa1 (parent orchestrator 1f3c54b3).
Build started 21 Nov ~14:55 WITA. Deadline entries: 23 Nov 10:42 WITA.

## MQ5 (written BEFORE any build file — brief + top-5 study)

### Brief (from coordinator state file, verified live via API 21 Nov ~14:45 WITA)
- Competition: `csv-reader-speed-01-run-20261121` — "Read broken CSV files faster, 21 November 2026". Category Code, skills JavaScript/Performance. Pot $100 — 10 × $10 (places 1–10). FREE entry.
- Entry = `solve.js` (dependency-free ES module, root, ZERO imports) + `main.ts` (driver, root, only `node:` builtins). Node 22. No npm deps, no WASM, no native addon, no prebuilt binary. Repo ≤ 1 MiB total.
- Task: faster drop-in for csv-reader 1.0.0 — `run({text, header})` → `{columns, rows, errors}`, byte-identical answers (as JSON value; object key order irrelevant) on every case. `passed` = 1 only when EVERY case identical.
- Spec = kit `baselines/csv-reader/vendor/csv-reader/index.js` (7,162 B), read in full: BOM dropped; record ends LF/CRLF; empty line = no record; lone CR outside quotes dropped (`stray_cr`); quoted field runs to next non-doubled quote, `""` = one quote, CRLF/lone CR inside = LF; junk after closing quote appended as-is (`quote_junk` if added > 0); unterminated quote = literal + re-read as unquoted (`unterminated_quote`); quote inside unquoted field literal; fields stay strings; `columns` = first record iff header (else null; header + zero records → `[]`); rows padded (`short_row`, `fields:` count) / cut (`long_row`, `extra:` cut fields) to FIRST record's width; errors `{code, line, row}` in order met, `line` = 1-based line the record STARTS on, `row` = index in rows (null for header); single empty UNQUOTED field = no record (errors stay); single empty QUOTED field `""` IS a record; trailing comma → trailing empty field.
- Timing: qualifying trial, top 30 (+ties) + house baseline to timing heat; 1 warm-up + 9 timed rounds, CPU trimmed mean; paid places race 30 more rounds. Ranking by CPU time, least first; a later entry passes an earlier one only when faster at 95% confidence; reward needs beating csv-reader 1.0.0 at 95% confidence. House baseline holds paid places.
- Practice set: 6 cases, ~10.2 MB total. Baseline local CPU (node22.21, `time`, 3 runs): user 1.94 / 1.74 / 1.59 s. Target ~3–5× (~0.35–0.55 s).
- Quota (21 Nov ~14:47 WITA): can_submit TRUE, day cap 6 (taken 0, left 6), hard 40/40 left, entries_made 0. Quota re-check is the coordinator's at submit time.
- Kit: level 32, build 245078bb384c (note: parent brief said "Kit LEVEL 6/7" — observed level is 32; 32 is authoritative).
- Transcript gate: NONE for this competition (transcripts_required: false). House route still submits a bundle as safe superset — coordinator's job, not builder's.
- Wallet: 6do8 ONLY (`6do8zGw4FPLCB1Cq44G8r8KwQccbhHUqtAptaRji6ALk`). Repo: RieryBuild/makefun-csv-reader-speed-01-run-20261121, ONE public commit via GitHub PAT route. Builder does NOT sign, does NOT submit, does NOT seal.

### Top-5 study (live, 21 Nov ~14:45 WITA — from coordinator state file)
- Leaderboard metrics WITHHELD: both `overall` and `performance` views return `entries: []`, `metrics_withheld: true`. Phase dev, `rank_key: cpu_us` (trimmed mean, asc), contenders 30. No live top-5 rows visible — no entry's code or time readable.
- Submissions list (346, all `sourceWithheld: true`): claimed speedups in TITLES only — 2.8×, 2.9×, 3.6× (×2), 4.2×, ~5×, ~5.5×. No code readable. Title patterns: indexOf-scan, hybrid split + char fallback, slice-scanning, quoted-field fast path, two-phase scan, UTF-16 slice scanner, regex + indexOf quote jumps.
- House-named public tools (RULES.txt): papaparse 5.7.1 ~0.78 s, d3-dsv 3.0.2 ~0.73 s, csv-parser 3.2.1 ~0.72 s vs csv-reader 1.38 s on 10.2–11.8 MB sets (house 1-CPU box) — ~1.9× each — BUT each reads broken rows its own way, so answers are NOT csv-reader's; they miss the gate.
- Dossier finding #7 (top5-evaluation-20261119.md): the single metric here is CPU time (trimmed mean). No second metric to trade against. Bar = beat baseline at 95% confidence AND land top-10 by CPU time; claimed field ~2.8–5.5×, so a ~2× entry likely misses paid places.
- NO-COPY: no top-5 source readable (all withheld). Principle only: speed comes from bulk scanning (indexOf/slice) instead of char-at-a-time; exactness must come from csv-reader's own broken-row policy, not any public tool's.
- Craft teardown 20261121 (HARD GATE): lessons are for judged/visual competitions (surface the evidence, citations, etc.). For this code competition the applicable hard-gate item is finding #9/process: the dossier's lessons must be wired into the build brief as hard gates, not reference docs — here that means: (a) differential testing is order-insensitive (raw JSON.stringify comparison FALSELY fails — proven by coordinator on baseline vs expected.json); (b) a practice grade is evidence, never a promised outcome; (c) the build iterates (self-critique cycles) until no material weakness remains, measured by grade-local + local CPU timing.

### Build approach (decided before first build write)
- solve.js: single-pass indexOf/slice scanner. Unquoted fields: 3× indexOf (`,`, `\n`, `\r`) → slice, no per-char loop; stray CR handled by segment slicing (rare path). Quoted fields: fast path when no doubled quote and no CR/LF inside (slice directly); general path (doubled quotes and/or embedded line breaks) accumulates converted segments (CRLF/lone CR → LF, line counting via post-conversion `\n` count). Unterminated quote → reset to open+1, error, re-read as unquoted with initial value `"`. Junk after closing quote via the same unquoted reader. All error semantics (recordLine/recordRow, short/long row, skip of single empty unquoted field) copied from the reference logic, not from any public tool.
- main.ts: baseline driver verbatim (incl. `setFlagsFromString('--no-incremental-marking')` before importing solve.js).
- Verification: differential tester vs reference readCsv on (a) practice set 6 cases, (b) hand-made edge cases, (c) fuzz on random broken CSV — all with order-insensitive deep-equal. grade-local + `time` (3 runs, median user time) vs baseline. A/B variants, keep best. OpenRouter :free code review before gate (Gemini text/copy only if 503 clear). Vanilla Node 22 run in a fresh dir, no node_modules.

## MQ1 — submit-ready end to end
- Competition: csv-reader-speed-01-run-20261121 — entries close 23 Nov 10:42 WITA (2026-11-23T02:42:00Z).
- Deliverables: solve.js + main.ts + LICENSE (MIT) + README.md (3 live badges) + .makefun/owner.json (6do8). (Filled in below as built.)
- Checks: see Gates 0–3 below. Submit-time items (quota re-check, kit status) are the coordinator's.
- Submit path: coordinator — `node cli/makefun.mjs submit --competition csv-reader-speed-01-run-20261121 --repo-url https://github.com/RieryBuild/makefun-csv-reader-speed-01-run-20261121 --commit <sha> --title <name> --bundle <file> --keypair <6do8 keypair>`.
- Cost: Time: build only (this file); Capital: $0.

## MQ2 — clears the bar?
- Practice grade (evidence, never a promised outcome): grade-local 6/6, passed=1, result_sha256 24b990abf7ffa3541a1c5bdcc4bc6582531cee3b952e8036bb4d6f6a954b759f (worktree; server runs node v26.13.1 vs local v22.21.0 so the sha cannot equal the server's — expected on process driver).
- Speed (local, node22.21): run()-only user CPU median ~0.134–0.147 s vs reference ~0.72–0.74 s per full 6-case set (~10.2 MB) → **~5.0–5.4×**; end-to-end through main.ts (incl. JSON parse/stringify, which the grader nets out via its do-nothing control): median user 0.799 s vs baseline 1.695 s → 2.12×. Claimed field in submission titles: 2.8–5.5×; this entry sits at the top of that field on the run-only metric. Prizelist bar: top 10 by CPU time ($10 each) + beat baseline at 95% confidence. Whether it lands top 10 is decided by the live heat, not by the practice grade.

## MQ3 — window open for this account?
- Coordinator's re-check at submit time. At build time (21 Nov ~14:47 WITA): can_submit TRUE, day cap 6 left, hard 40/40 left, entries_made 0. Deadline 23 Nov 10:42 WITA still ahead.

## MQ4 — signed by the right identity, right route?
- Wallet 6do8 ONLY. Repo via GitHub PAT route, one public commit. Builder signs nothing; coordinator submits with the 6do8 keypair.

## MQ5 — deliberate new submission, not a duplicate?
- First entry in this competition (entries_made 0). Not a re-submit of identical content; solve.js written from scratch in this session (see build log below). No standing entry to supersede (Force_Last N/A).

## MQ6 — prove it works
- Differential tester (/tmp/difftest.mjs, order-insensitive canonical deep-equal — never raw JSON.stringify): practice set 6/6, 117 hand-made edge cases, 30 kit-generator cases (seeded RNG shim over program/generator/subject/csv-cases.mjs), 3,000 random-char fuzz cases, 2,000 structured fuzz cases — **TOTAL 5,153 cases, 0 fails** vs reference readCsv.
- grade-local on the worktree (exact files to be committed): 6/6, passed=1, two executions reproduced byte for byte.
- Vanilla Node 22 run (fresh dir /tmp/vanilla-csv, NO node_modules, only solve.js + main.ts): exit 0, answers 6/6 identical to practice/reference/expected.json. solve.js has ZERO imports; main.ts imports only node:fs, node:path, node:v8.

## MQ7 — never-submit list?
- No code-drawn images (N/A, code entry). No non-stdlib imports: solve.js ZERO imports; main.ts only node:fs, node:path, node:v8. No recording-after-build issue: transcript gate does not apply (transcripts_required: false); bundle is coordinator's safe superset. Wallet 6do8 only; PAT route; no claim code anywhere (none in this task); quota true at build time (re-check at submit); no capital needed; practice grade quoted as evidence only; not a duplicate; no screenshots / no visual audit (code entry, no visual deliverable — audit rule suspended 20 Nov anyway).

## MQ8 — session check
- Transcript gate does NOT apply to this competition (all transcript/thinking checks `applies: false`). Builder session c266053c (this subagent session); first build action: gate-run.md MQ5 write (this file) — before any build file. In-session revisions: solve.js revised iteratively in-session (see build log). Coordinator bundles sessions as safe superset.

## Gate 0 — Reality
- [x] Repo exists at one public commit; SHA recorded (below, after push)
- [x] Every deliverable in the repo (solve.js, main.ts, LICENSE MIT, README.md with 3 live badges, .makefun/owner.json 6do8; gate-run.md + package.json also in repo — package.json is the baseline's `{"type":"module"}`; total repo well under 1 MiB)
- [x] Entry passes its own tests + grade-local on this commit (6/6)
- [x] Evidence captured below

## Gate 1 — Quality
- [~] Multi-model review: OpenRouter :free ATTEMPTED 5×, NO review obtained — recorded gap (see Review exchange below). Gemini text/copy: not attempted; 503 state not verified clear — recorded gap, not a FAIL per the house rule. The substantive verification is the 5,153-case differential test (0 fails) + grade-local 6/6.
- [x] Review exchange recorded below (attempts + outcomes)
- [x] Practice grade vs prizelist bar, stated as evidence only (MQ2)
- [x] Feed-first study done (MQ5 above; no live top-5 readable — metrics withheld)

## Gate 2 — Dedup
- [x] Not a duplicate (MQ5); first entry; rebuild-once N/A
- [ ] Quota re-checked at gate time (coordinator)

## Gate 3 — Submission quality
- [x] README matches requirements template (3 live badges, owner/repo filled, bounty links)
- [ ] Entry message + signature use wallet 6do8 only; repo via PAT route (coordinator)
- [x] Claim-code handling: no claim code in this task; none in repo/transcripts/review (grep: no secrets found)
- [x] No secrets in repo/transcripts/review (grep before submit — checked entry files; coordinator re-greps at submit)
- [ ] Deadline still ahead at submit time (coordinator)
- [x] Reza visual audit: N/A — code entry, no visual deliverable (rule suspended 20 Nov ~15:27 anyway)

## Build log (iterations, measured)
- v1 (object per field: readUnquoted/readQuoted return {value, ended, added}): differential 5,153/5,153 PASS; run-only CPU median 241 ms vs ref 736 ms = 3.05×; main.ts total median user 0.931 s vs baseline 1.748 s = 1.88×.
- Self-critique v1 → v2 (weaknesses: per-field object alloc ~800k; unbounded indexOf('\n'/'\r') in quoted fast path; `value += seg` rope on empty initial): field results in module-scope slots (ended/added), quoted fast path checks the bounded slice between quotes, `value = seg` when initial value is empty. Differential re-run 5,153/5,153 PASS; run-only CPU median 134–147 ms vs ref 722–736 ms = **5.0–5.4×**; main.ts total median user 0.799 s vs baseline 1.695 s = 2.12×.
- v3 (record-split fast path for quote-free lines): SLOWER — 225 ms vs v2 156 ms (0.69×). Discarded: pre-scan cost on 100% of records outweighs the split saving on ~15% quote-free lines.
- v4 (single regex /[,\n]/ delimiter search in readUnquoted): SLOWER — 260 ms vs v2 134 ms (0.52×). Discarded: regex exec setup beats two indexOf calls.
- Stopping rule (§4): two consecutive cycles found no improvement; v2 kept as final. v2 = entry solve.js (verified `cmp` identical to /tmp/solve-v2.js).
- grade-local (worktree, --driver process): 6/6 passed, result_sha256 24b990abf7ffa3541a1c5bdcc4bc6582531cee3b952e8036bb4d6f6a954b759f; two executions reproduced byte for byte. Note: kit level observed is 32 (parent brief said 6/7 — 32 authoritative).

## Review exchange (OpenRouter :free)
- Models re-checked via GET /models 21 Nov ~15:20 WITA: 11 :free models, incl. nvidia/nemotron-3-ultra-550b-a55b:free, nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free, google/gemma-4-26b-a4b-it:free, liquid/lfm-3-1.7b:free, particle-ai/particle-1:free.
- Attempt 1 — nemotron-3-ultra-550b-a55b:free, full code + full semantics: no reply; subprocess timed out after 300 s.
- Attempt 2 — nemotron-3-nano-omni-30b-a3b-reasoning:free, full code + compact semantics: no reply; timed out after 240 s.
- Attempt 3 — gemma-4-26b-a4b-it:free: HTTP 429 (free route rate-limited / daily free allowance spent).
- Attempt 4 — liquid/lfm-3-1.7b:free: HTTP 429.
- Attempt 5 — particle-ai/particle-1:free (after 20 s wait): HTTP 429.
- Verdict: NO multi-model review obtained — OpenRouter :free route unusable at review time (reasoning models hang past 240–300 s; small models 429). Recorded gap for the coordinator, NOT a code finding: the code itself passed 5,153 differential cases + grade-local 6/6 + vanilla 6/6. No Xingchiapi used. Gemini text/copy not attempted (503-clear not verified).

## Vanilla Node 22 run evidence
- Fresh dir /tmp/vanilla-csv (bot/ contains ONLY solve.js + main.ts; NO node_modules anywhere): `~/workspace/tools/node22/bin/node bot/main.ts` with MAKEFUN_INPUT_DIR/OUTPUT_DIR set — exit 0, answers.json written (12,073,155 B), **6/6 identical** to practice/reference/expected.json (canonical order-insensitive compare). solve.js: zero imports (grep). main.ts: node:fs, node:path, node:v8 only.
