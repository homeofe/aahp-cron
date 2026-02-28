# aahp-cron: Agent Journal

> **Append-only.** Never delete or edit past entries.
> Every agent session adds a new entry at the top.
> This file is the immutable history of decisions and work done.

---

## 2026-02-28 GitHub Copilot CLI: Project Scaffolding

**Agent:** GitHub Copilot CLI (Claude Sonnet 4.6)
**Phase:** 1 - Initial scaffolding
**Branch:** main (pre-git)

### What was done

- Created full TypeScript/Node.js project structure for `aahp-cron`
- Wrote `src/types.ts` - shared types: PipelineConfig, DiscoveredProject, RunResult, PipelineRun
- Wrote `src/config.ts` - load/save pipeline.json, resolve defaults + project overrides
- Wrote `src/discovery.ts` - scan rootDir for AAHP projects, merge with config overrides
- Wrote `src/runner.ts` - subprocess wrapper: spawns `aahp-runner run --repo-path` per project
- Wrote `src/reporter.ts` - console summary, log file writer, run history (cron-history.json)
- Wrote `src/pipeline.ts` - core orchestrator: Discover -> Filter -> Sort -> Run -> Report
- Wrote `src/scheduler.ts` - Windows Task Scheduler (schtasks) + cron registration
- Wrote `src/cli.ts` - Commander CLI: run, list, status, config, init, schedule set/remove
- Created `package.json`, `tsconfig.json`, `.gitignore`
- Created `pipeline.example.json` and `README.md`
- Created AAHP v3 handoff structure in `.ai/handoff/`

### Decisions made

- **Subprocess over library**: aahp-runner called as CLI subprocess for loose coupling. aahp-runner can be updated independently without breaking aahp-cron.
- **pipeline.json**: Gitignored user config. `pipeline.example.json` committed as template.
- **Run history**: Stored in `~/.aahp/cron-history.json` (last 50 runs) for `aahp-cron status`.
- **Per-project logs**: `~/.aahp/cron-logs/<project>-YYYY-MM-DD.log` for per-agent output.
- **Backend delegation**: Backend selection (claude/copilot/sdk) passed through to aahp-runner per project, not handled in aahp-cron itself.

### Next steps

- T-001: npm install + build
- T-002: git init + GitHub push
- T-003: GitHub Actions CI

---
