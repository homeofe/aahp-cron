# aahp-cron: Trust Register

> Tracks verification status of critical system properties.
> In multi-agent pipelines, hallucinations and drift are real risks.
> Every claim here has a confidence level tied to how it was verified.

---

## Confidence Levels

| Level | Meaning |
|-------|---------|
| **verified** | An agent executed code, ran tests, or observed output to confirm this |
| **assumed** | Derived from docs, config files, or chat, not directly tested |
| **untested** | Status unknown; needs verification |

---

## Build System

| Property | Status | Last Verified | Agent | Notes |
|----------|--------|---------------|-------|-------|
| `npm install` succeeds | untested | - | - | |
| `npm run build` passes (tsc) | untested | - | - | |
| `dist/cli.js` shebang correct | untested | - | - | |
| `aahp-cron list` runs without error | untested | - | - | |
| `aahp-cron run --dry-run` runs | untested | - | - | |

---

## Runtime Dependencies

| Property | Status | Last Verified | Agent | Notes |
|----------|--------|---------------|-------|-------|
| aahp-runner CLI reachable at `../aahp-runner/dist/cli.js` | assumed | - | - | Based on workspace layout |
| `node >= 20` available | assumed | - | - | Required by package.json engines |
| `gh` CLI installed + authenticated | assumed | - | - | Needed for issue sync |
| `ANTHROPIC_API_KEY` or `claude` CLI available | assumed | - | - | Passed through to aahp-runner |

---

## Integration

| Property | Status | Last Verified | Agent | Notes |
|----------|--------|---------------|-------|-------|
| aahp-runner subprocess spawns correctly | untested | - | - | |
| Project discovery finds MANIFEST.json files | untested | - | - | |
| Windows Task Scheduler registration works | untested | - | - | |
| Run history written to `~/.aahp/cron-history.json` | untested | - | - | |
| Log files written to `~/.aahp/cron-logs/` | untested | - | - | |

---

## Security

| Property | Status | Last Verified | Agent | Notes |
|----------|--------|---------------|-------|-------|
| No secrets in source | assumed | - | - | `.aiignore` configured |
| `pipeline.json` gitignored | assumed | - | - | Listed in `.gitignore` |
| No PII in handoff files | assumed | - | - | `.aiignore` in place |

---

## Update Rules (for agents)

- Change `untested` -> `verified` only after **running actual code/tests**
- Change `assumed` -> `verified` after direct confirmation
- Never downgrade `verified` without explaining why in `LOG.md`
- Add new rows when new system properties become critical

---

*Trust degrades over time. Re-verify periodically, especially after major refactors.*
