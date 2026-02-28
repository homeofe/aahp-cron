# aahp-cron: Next Actions for Incoming Agent

> Priority order. Work top-down.
> Each item must be self-contained - the agent must be able to start without asking questions.
> Blocked tasks go to the bottom.

---

## Status Summary

| Status | Count |
|--------|-------|
| Done   | 3     |
| Ready  | 0     |
| Blocked| 0     |

All scaffolding tasks are complete. The project is built, pushed to GitHub, and has CI enabled.

---

## Ready - Work These Next

No tasks are currently ready. All backlog items have been completed.

Suggested next tasks to add:
- Add ESLint configuration and lint step to CI
- Add unit tests with a test framework (vitest or node:test)
- Add test step to CI workflow once tests exist
- Implement end-to-end smoke test (dry-run mode)

---

## Blocked

No blocked tasks.

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
