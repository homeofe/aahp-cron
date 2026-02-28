# aahp-cron: Build Dashboard

> Single source of truth for build health, pipeline state, and open tasks.
> Updated by agents at the end of every completed task.

---

## Components

| Name | Version | Build | Tests | Status | Notes |
|------|---------|-------|-------|--------|-------|
| cli.ts | 0.1.0 | ❌ Not built | - | ⏳ Pending | Needs `npm run build` |
| pipeline.ts | 0.1.0 | ❌ Not built | - | ⏳ Pending | |
| config.ts | 0.1.0 | ❌ Not built | - | ⏳ Pending | |
| discovery.ts | 0.1.0 | ❌ Not built | - | ⏳ Pending | |
| runner.ts | 0.1.0 | ❌ Not built | - | ⏳ Pending | |
| reporter.ts | 0.1.0 | ❌ Not built | - | ⏳ Pending | |
| scheduler.ts | 0.1.0 | ❌ Not built | - | ⏳ Pending | |

**Legend:** green = passing, red = failing, blue = stub/mock, pending = not yet run, blocked = external blocker

---

## Pipeline State

| Field | Value |
|-------|-------|
| Current task | T-001: npm install + build |
| Phase | scaffolding |
| Last completed | Project scaffolding (2026-02-28) |
| Blocking issue | None |

---

## Open Tasks

| ID | Task | Priority | Blocked by | Ready? |
|----|------|----------|-----------|--------|
| T-001 | Install dependencies and verify build | HIGH | - | Ready |
| T-002 | Initialize git repo and push to GitHub | HIGH | T-001 | Blocked |
| T-003 | Add GitHub Actions CI workflow | MEDIUM | T-002 | Blocked |

---

## Update Instructions (for agents)

After completing any task:

1. Update the relevant component row to green with current date
2. Update test counts when tests are added
3. Update "Pipeline State" table
4. Move completed task out of "Open Tasks"
5. Add newly discovered tasks with correct priority

**Pipeline rules:**
- Blocked task -> skip, take next unblocked
- All tasks blocked -> notify the project owner
- On build failures: attempt 1-2 self-fixes before escalating
