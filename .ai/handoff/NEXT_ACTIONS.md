# NEXT_ACTIONS - aahp-cron

> Priority order. Work top-down.
> Each item must be self-contained - the agent must be able to start without asking questions.

---

## Ready - Work These Next

### T-004: Add vitest and unit tests for core modules [high] (issue #1)
- **Goal:** Establish a test foundation so future changes can be validated automatically
- **Context:** The codebase has zero tests. All 8 source modules are fully implemented and production-ready, but nothing is verified beyond "it compiles." Config loading, project discovery, and reporter logic are all pure-function-heavy and highly testable without mocking the filesystem extensively.
- **What to do:**
  1. Install vitest as a devDependency (`npm i -D vitest`)
  2. Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to package.json
  3. Create `src/__tests__/` directory
  4. Write unit tests for these modules (priority order):
     - **config.ts** - test `resolveDefaults()`, `resolveProjectConfig()`, `resolveRunnerPath()` with various input combinations. Mock fs for `loadConfig()`/`saveConfig()`.
     - **discovery.ts** - test `discoverProjects()` with a temp directory containing mock project dirs with/without MANIFEST.json. Verify sorting (enabled first, then priority, then activity).
     - **reporter.ts** - test `saveRunHistory()` and `loadLastRun()` with mocked fs. Test history rotation (max 50 entries).
     - **pipeline.ts** - test dry-run mode (no subprocess spawning). Verify project filtering by name.
  5. Verify all tests pass with `npm test`
  6. Verify build still passes with `npm run build`
- **Files:**
  - Read: `src/config.ts`, `src/discovery.ts`, `src/reporter.ts`, `src/pipeline.ts`, `src/types.ts`
  - Create: `src/__tests__/config.test.ts`, `src/__tests__/discovery.test.ts`, `src/__tests__/reporter.test.ts`, `src/__tests__/pipeline.test.ts`
  - Modify: `package.json` (add vitest dep + scripts)
- **Definition of Done:**
  - [ ] vitest installed and configured
  - [ ] At least 4 test files covering config, discovery, reporter, pipeline
  - [ ] `npm test` passes with all tests green
  - [ ] `npm run build` still passes (no regressions)

---

### T-005: Add ESLint with TypeScript support [medium] (issue #2)
- **Goal:** Enforce consistent code quality and catch potential bugs statically
- **Context:** No linter is configured. The code is clean but has no automated style enforcement. Adding ESLint now (before more code is written) sets the standard early.
- **What to do:**
  1. Install ESLint v9+ with flat config and TypeScript support:
     `npm i -D eslint @eslint/js typescript-eslint`
  2. Create `eslint.config.js` (flat config format) with:
     - `@eslint/js` recommended rules
     - `typescript-eslint` strict-type-checked rules
     - Ignore patterns for `dist/`, `node_modules/`
  3. Add `"lint": "eslint src/"` script to package.json
  4. Run `npm run lint` and fix any violations found
  5. Verify build still passes
- **Files:**
  - Create: `eslint.config.js`
  - Modify: `package.json` (add eslint deps + lint script)
  - Possibly modify: any `src/*.ts` files that have lint violations
- **Definition of Done:**
  - [ ] ESLint v9+ installed with TypeScript plugin
  - [ ] `eslint.config.js` configured with strict TypeScript rules
  - [ ] `npm run lint` passes with zero errors
  - [ ] `npm run build` still passes

---

### T-006: Update CI workflow to run tests and lint [medium] (issue #3)
- **Goal:** Gate PRs on test and lint results so regressions are caught before merge
- **Context:** CI currently only runs `npm run build` and checks that `dist/cli.js` exists. With tests (T-004) and lint (T-005) in place, CI should run all three.
- **What to do:**
  1. Edit `.github/workflows/ci.yml`
  2. Add a `lint` step after install: `npm run lint`
  3. Add a `test` step after lint: `npm test`
  4. Keep the existing build and verify steps
  5. Verify the workflow YAML is valid (proper indentation, step ordering)
- **Files:**
  - Modify: `.github/workflows/ci.yml`
- **Definition of Done:**
  - [ ] CI runs lint, test, and build in that order
  - [ ] Workflow YAML is valid
  - [ ] All three steps pass on push

---

### T-007: Add runtime validation for pipeline.json [medium] (issue #4)
- **Goal:** Give users clear error messages when pipeline.json is malformed instead of cryptic runtime crashes
- **Context:** `config.ts:loadConfig()` does `JSON.parse()` on the raw file but performs no schema validation. A typo like `"bakend": "claude"` silently becomes a no-op. Adding validation catches these issues early with actionable error messages.
- **What to do:**
  1. Create `src/validate.ts` with a `validateConfig(raw: unknown): PipelineConfig` function
  2. Validate required fields: `rootDir` must be a non-empty string
  3. Validate optional fields against allowed values:
     - `defaults.backend` must be one of `auto | claude | copilot | sdk`
     - `defaults.limit` must be a positive integer
     - `defaults.timeoutMinutes` must be a positive number
     - `projects[].name` must be a non-empty string
     - `projects[].priority` must be a number if present
  4. Throw a descriptive error listing all validation failures (not just the first)
  5. Call `validateConfig()` from `loadConfig()` after JSON.parse
  6. Add unit tests for validation in `src/__tests__/validate.test.ts`
  7. Verify `npm test` and `npm run build` pass
- **Files:**
  - Create: `src/validate.ts`, `src/__tests__/validate.test.ts`
  - Modify: `src/config.ts` (call validateConfig after parse)
- **Definition of Done:**
  - [ ] `validateConfig()` rejects invalid configs with clear multi-error messages
  - [ ] `validateConfig()` accepts valid configs (including minimal ones with only `rootDir`)
  - [ ] Unit tests cover valid, invalid, and edge-case configs
  - [ ] `npm test` and `npm run build` pass

---

### T-008: Add integration smoke test with dry-run [low] (issue #5)
- **Goal:** Verify the full CLI pipeline works end-to-end without spawning real agents
- **Context:** Unit tests (T-004) cover individual modules but do not exercise the full CLI flow. A smoke test using `--dry-run` validates the integration of all components together: config loading, project discovery, filtering, sorting, and reporting.
- **What to do:**
  1. Create `src/__tests__/smoke.test.ts`
  2. Set up a temp directory structure:
     - Create 2-3 mock project dirs with `.ai/handoff/MANIFEST.json` files
     - Write a minimal `pipeline.json` pointing `rootDir` at the temp dir
  3. Import and call `runPipeline()` with `dryRun: true` and the test config
  4. Assert: all discovered projects appear in the returned `PipelineRun`
  5. Assert: no subprocesses were actually spawned (results have `durationMs: 0` or similar dry-run markers)
  6. Assert: project ordering respects priority settings
  7. Clean up temp directory after test
- **Files:**
  - Create: `src/__tests__/smoke.test.ts`
  - Read: `src/pipeline.ts`, `src/discovery.ts`, `src/types.ts`
- **Definition of Done:**
  - [ ] Smoke test creates temp dirs, runs dry-run pipeline, asserts correct discovery and ordering
  - [ ] `npm test` passes including the smoke test
  - [ ] No real aahp-runner processes are spawned during the test

---

## Blocked

(none)

---

## Recently Completed

| Task | Title | Completed |
|------|-------|-----------|
| T-003 | Add GitHub Actions CI workflow | 2026-02-28 |
| T-002 | Initialize git repo and push to github.com/homeofe/aahp-cron | 2026-02-28 |
| T-001 | Install dependencies and verify build | 2026-02-28 |

---

## Reference: Key File Locations

| What | Where |
|------|-------|
| CLI entry | `src/cli.ts` |
| Pipeline core | `src/pipeline.ts` |
| Config | `src/config.ts` |
| Discovery | `src/discovery.ts` |
| Runner wrapper | `src/runner.ts` |
| Reporter | `src/reporter.ts` |
| Scheduler | `src/scheduler.ts` |
| Types | `src/types.ts` |
| Example config | `pipeline.example.json` |
| CI workflow | `.github/workflows/ci.yml` |
| aahp-runner | `../aahp-runner/dist/cli.js` |
