> Note (2026-07-19, claude-opus-4-8): Aligned the AAHP v3.8.0 conformance PR (#49) with its code review. Restored the MANIFEST project field to aahp-cron (the CLI regen had rewritten it to the temporary clone-directory name) and confirmed the handoff tasks and next_task_id survived the regen intact, preserving the task-to-github_issue links. Corrected the PR-body follow-up note that claimed GitHub Actions was off org-wide (homeofe Actions is on). Left the canonical GROUNDING.md and TRUST.md wording and the seeded Provenance placeholders unchanged, since those are copied verbatim from the @elvatis_com/aahp package and asserting specific provenance values here would fabricate verification.

> Note (2026-07-14, claude-opus-4-8): Synced the canonical AAHP gate scripts from homeofe/improvements (v3.5.0 fixes: aahp-manifest.sh --phase documentation + cross_repo_ref preservation, lint-handoff.sh SC2034), AAHP_HANDOFF_FILES preserved, and refreshed the local hook tooling (scripts/hooks/, install-hooks.sh, verify-hooks.sh). Fleet re-sync.

> Note (2026-07-14, claude-opus-4-8): Synced the canonical Layer 3 tolerance fix from homeofe/improvements. verify-handoff.sh now downgrades a non-ancestor MANIFEST.last_session.commit from FAIL to WARN so a squash-merge or rebase-merge no longer trips AAHP Verify Layer 3 on main; Layers 1-2 still gate real staleness.

﻿# aahp-cron: Current State of the Nation

> Last updated: 2026-06-26 by cli-tool
> Commit: (initial - not yet committed)
>
> **Rule:** This file is rewritten (not appended) at the end of every session.
> It reflects the *current* reality, not history. History lives in LOG.md.

---

<!-- SECTION: summary -->
Build green (`npm run build` clean, `dist/` exists). Repo not yet initialized on GitHub.

2026-06-21: Added status-badge block (CI, AAHP Verify, Security, License Apache-2.0) to README header.
<!-- /SECTION: summary -->

---

<!-- SECTION: build_health -->
## Build Health

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | green | 22 packages, 0 vulnerabilities |
| `build` | green | `tsc` clean, all 8 modules in `dist/` |
| `type-check` | green | Included in build via `tsc` |
| `lint` | â³ No linter configured | Add eslint if desired |
<!-- /SECTION: build_health -->

---

<!-- SECTION: infrastructure -->
## Infrastructure

| Component | Location | State |
|-----------|----------|-------|
| aahp-runner | `../aahp-runner/dist/cli.js` | (Assumed) built |
| gh CLI | PATH | (Assumed) installed + authenticated |
| node | PATH | (Assumed) >= 20 |
| GitHub repo | github.com/homeofe/aahp-cron | Not created yet |
<!-- /SECTION: infrastructure -->

---

<!-- SECTION: components -->
## Components

| Module | File | State |
|--------|------|-------|
| CLI entry | `src/cli.ts` | Written, not built |
| Pipeline orchestrator | `src/pipeline.ts` | Written, not built |
| Config loader | `src/config.ts` | Written, not built |
| Project discovery | `src/discovery.ts` | Written, not built |
| Runner subprocess wrapper | `src/runner.ts` | Written, not built |
| Reporter | `src/reporter.ts` | Written, not built |
| Scheduler (schtasks/cron) | `src/scheduler.ts` | Written, not built |
| Types | `src/types.ts` | Written, not built |
<!-- /SECTION: components -->

---

<!-- SECTION: what_is_missing -->
## What is Missing

| Gap | Severity | Description |
|-----|----------|-------------|
| npm install + build | HIGH | No dist/ yet - project cannot run |
| Git init + GitHub repo | HIGH | No version control yet |
| CI workflow | MEDIUM | No GitHub Actions yet |
| Tests | MEDIUM | No unit tests written |
| pipeline.json (user config) | LOW | User must create from example |
<!-- /SECTION: what_is_missing -->

---

## Trust Levels

- **(Verified)**: confirmed by running code/tests
- **(Assumed)**: derived from docs/config, not directly tested
- **(Unknown)**: needs verification

<!-- aahp-gate -->
_AAHP verify gate: v3.0.5 synced 2026-06-20._

> 2026-06-21 install-hooks.sh: Windows drive-letter path fix propagated from AAHP.

> 2026-06-21 ci: add supply-chain-guard v5.2.35 Action workflow (fail-on critical).

> 2026-06-21 ci(aahp): fix unquoted next_task_id + lint-handoff noreply@ PII exclusion.

> 2026-06-27 ci: re-pin supply-chain-guard action to v5.2.37 (be1d718b17cc38e4bce7fa48579b7112e557943b) and enable Dependabot github-actions weekly updates.

> 2026-06-28 security(scheduler): fixed command-injection vulnerability (CVE-class: CWE-78). The configPath CLI argument was interpolated directly into a cron command string without validation. Added validateConfigPath() to src/scheduler.ts which rejects shell metacharacters, leading hyphens (flag injection), and ".." segments (path traversal). Called before command assembly in both registerCronScheduler() and registerWindowsScheduler(). Also fixed pre-existing tsconfig missing "types":["node"] which caused build failure. All 113 tests pass including new regression suite in tests/scheduler.test.ts.

> 2026-06-30 feat(verify): added reviewed expiring PII allowlist, rolled out from AAHP v3.2.0.

> 2026-06-30 ci: exempt Dependabot from the aahp-verify handoff gate (keep supply-chain-guard/codeql/build).

> 2026-07-18 chore(aahp): adopt AAHP v3.8.0 CLI conformance. Stopped vendoring the package-provided gate scripts (removed scripts/_aahp-lib.sh, aahp-manifest.sh, lint-handoff.sh, verify-handoff.sh, install-hooks.sh, verify-hooks.sh, hooks/pre-commit, hooks/pre-push); the AAHP CLI now provides them. aahp-verify.yml runs the pinned CLI (npm ci + npx --no-install aahp verify/doctor) instead of bash scripts/verify-handoff.sh. Pinned @elvatis_com/aahp to exact 3.8.0 in devDependencies + lockfile, added aahp.config.json (pinnedDep + em-dash forbidden pattern). Added .ai/handoff/GROUNDING.md and a Provenance section in TRUST.md (Grounded Reflection Layer). Repo-specific scripts/validate-pii-allowlist.py kept.

> Note (2026-07-19): Re-pinned @elvatis_com/aahp from 3.8.0 to 3.8.1 (picks up the v3.8.1 Windows/MSYS manifest-regen fix so tasks, next_task_id and cross_repo_ref survive regeneration). No runtime behavior change on Linux or CI. Handoff refreshed and MANIFEST regenerated.
