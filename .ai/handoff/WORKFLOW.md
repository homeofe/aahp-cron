# aahp-cron: Autonomous Multi-Agent Workflow

> Based on the [AAHP Protocol](https://github.com/homeofe/AAHP).
> No manual triggers. Agents read `DASHBOARD.md` and work autonomously.

---

## Agent Roles

| Agent | Model | Role | Responsibility |
|-------|-------|------|---------------|
| Implementer | claude-sonnet / copilot | Implementer | Code, build, fixes, commits |
| Reviewer | second model | Reviewer | Code review, edge cases, security |

> aahp-cron is a small utility project - a full 4-agent pipeline is overkill.
> A single Implementer + optional Reviewer is sufficient.

---

## The Pipeline

### Phase 1: Pick Task

```
Reads:   .ai/handoff/MANIFEST.json (quick_context + tasks)
         .ai/handoff/NEXT_ACTIONS.md (top ready task)

Does:    Reads quick_context to orient
         Picks top task where status = "ready" and all depends_on = "done"
         Sets task status = "in_progress" in MANIFEST.json
```

### Phase 2: Implementation

```
Reads:   NEXT_ACTIONS.md task description
         CONVENTIONS.md (MANDATORY before first commit)
         Relevant source files in src/

Does:    Installs deps / builds / fixes TypeScript errors
         Creates git commits with conventional format
         Pushes to origin

Commit format:
  feat(scope): description [AAHP-auto]
  fix(scope): description [AAHP-fix]
```

### Phase 3: Completion & Handoff

```
MANIFEST.json:    Mark task as "done", update quick_context, last_session
                  Unblock any tasks whose depends_on are now all done
NEXT_ACTIONS.md:  Move task to "Recently Completed", update remaining tasks
STATUS.md:        Update build health table
DASHBOARD.md:     Update pipeline state, open tasks table
LOG.md:           Append session entry
TRUST.md:         Update verified rows for any properties confirmed this session

Git:     Commit all handoff file changes in a single commit
```

---

## Autonomy Boundaries

| Allowed | Not allowed |
|---------|------------|
| Write & commit code in aahp-cron | Push directly to `main` without review |
| Install npm dependencies (document in LOG.md) | Modify files in other projects (aahp-runner etc.) |
| Create GitHub repos and branches | Write secrets or PII into any file |
| Run builds and tests | Delete existing source files |
| Register scheduled tasks | Make production system changes |

---

## Task Selection Rules

1. Read `MANIFEST.json`, pick top task where `status = "ready"` and all `depends_on` are `done`
2. If a task is blocked - skip it, take the next unblocked one
3. If all tasks are blocked - notify the project owner, stop
4. Always read `CONVENTIONS.md` before the first commit in a session
5. Always update handoff files before ending the session

---

## Error Handling

If an agent fails or is uncertain:
- Mark the task as blocked in MANIFEST.json with a `blocked_by` note
- Document the blocker in LOG.md
- Update NEXT_ACTIONS.md to reflect the blocked state
- **Never proceed on assumptions when certainty is missing**

---

*This document lives in the repo and is continuously refined by the agents themselves.*
