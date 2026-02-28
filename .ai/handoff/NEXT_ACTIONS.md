# aahp-cron: Next Actions for Incoming Agent

> Priority order. Work top-down.
> Each item must be self-contained - the agent must be able to start without asking questions.
> Blocked tasks go to the bottom.

---

## T-001: Install dependencies and verify build

**Goal:** Run `npm install` and `npm run build` in aahp-cron, confirm TypeScript compiles without errors.

**Context:**
- All source files are written in `src/` but `node_modules/` and `dist/` do not exist yet
- Project uses TypeScript ESNext modules (`"module": "ESNext"`, `"moduleResolution": "bundler"`)
- Dependencies: `chalk`, `commander` (runtime); `typescript`, `ts-node`, `@types/node` (dev)

**What to do:**
1. `cd E:\_nextcloud.weloveselfmade.com\_Data\_Development\aahp-cron`
2. `npm install`
3. `npm run build`
4. Verify `dist/cli.js` exists and has the shebang line
5. Fix any TypeScript errors (likely none, but check)
6. Update STATUS.md build health table
7. Update MANIFEST.json + this file

**Files:**
- `package.json`: dependencies and build scripts
- `tsconfig.json`: TypeScript config (ESNext, bundler resolution)
- `src/*.ts`: all source modules

**Definition of done:**
- [ ] `npm install` succeeds
- [ ] `npm run build` exits 0, no errors
- [ ] `dist/cli.js` exists
- [ ] STATUS.md build row updated to green

---

## T-002: Initialize git repo and push to GitHub

**Goal:** Create a git repo, make the initial commit, create `github.com/homeofe/aahp-cron`, and push.

**Context:**
- No `.git` directory exists yet
- `pipeline.json` is in `.gitignore` (user config, never committed)
- Depends on T-001 (build must work first)

**What to do:**
1. `cd E:\_nextcloud.weloveselfmade.com\_Data\_Development\aahp-cron`
2. `git init`
3. `git add -A`
4. `git commit -m "feat: initial aahp-cron pipeline orchestrator

TypeScript/Node.js pipeline orchestrator for AAHP v3.
Discovers projects, runs aahp-runner per project, reports results.
Includes schedule management (Windows Task Scheduler + cron).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`
5. `gh repo create homeofe/aahp-cron --public --description "Pipeline orchestrator for AAHP v3 - schedules and runs aahp-runner across all projects"`
6. `git remote add origin https://github.com/homeofe/aahp-cron.git`
7. `git push -u origin main`
8. Update MANIFEST.json with the commit hash

**Files:**
- `.gitignore`: excludes `pipeline.json`, `dist/`, `node_modules/`

**Definition of done:**
- [ ] Repo exists at github.com/homeofe/aahp-cron
- [ ] Initial commit pushed
- [ ] MANIFEST.json updated with commit hash

---

## T-003: Add GitHub Actions CI workflow

**Goal:** Add `.github/workflows/ci.yml` that runs `npm install && npm run build` on push/PR.

**Context:**
- Depends on T-002 (repo must exist first)
- No tests yet, so CI only validates the build

**What to do:**
1. Create `.github/workflows/ci.yml` with Node 20, install, build steps
2. Commit and push
3. Verify the action runs green

**Definition of done:**
- [ ] CI workflow file committed
- [ ] GitHub Actions shows green on first run

---

## Recently Completed

| Item | Resolution |
|------|-----------|
| Scaffold project | All source files written: cli.ts, pipeline.ts, config.ts, discovery.ts, runner.ts, reporter.ts, scheduler.ts, types.ts |
| AAHP protocol setup | .ai/handoff/ structure created with all v3 files |

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
| aahp-runner | `../aahp-runner/dist/cli.js` |
