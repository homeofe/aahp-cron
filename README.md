# aahp-cron

Pipeline orchestrator for [AAHP v3](https://github.com/homeofe/AAHP). Discovers all projects in your dev root, fetches their GitHub issues, and runs [`aahp-runner`](https://github.com/homeofe/aahp-runner) agents across them on a schedule.

## What it does

1. **Discover** - scans `rootDir` for subdirectories with `.ai/handoff/MANIFEST.json`
2. **Filter + sort** - applies `pipeline.json` overrides (disable projects, set priority order, per-project model/limit)
3. **Run** - spawns `aahp-runner run --repo-path <dir> --yes` for each project
4. **Report** - prints a summary table, writes logs to `~/.aahp/cron-logs/`

## Prerequisites

- Node.js >= 20
- [`aahp-runner`](https://github.com/homeofe/aahp-runner) built at `<rootDir>/aahp-runner/dist/cli.js` (or on PATH as `aahp-runner`)
- `gh` CLI authenticated (for GitHub issue sync)
- `ANTHROPIC_API_KEY` set (if using sdk backend) or `claude` CLI installed

## Setup

```bash
cd aahp-cron
npm install
npm run build

# Create your pipeline.json (copy from example)
cp pipeline.example.json pipeline.json
# Edit pipeline.json to set your rootDir and project overrides
```

## Usage

```bash
# List all discovered projects
aahp-cron list

# Run the full pipeline once
aahp-cron run

# Preview what would run (no agents spawned)
aahp-cron run --dry-run

# Run a single project
aahp-cron run --project openclaw-memory-core

# Show last run results
aahp-cron status

# Print resolved config
aahp-cron config

# Schedule daily at 02:00
aahp-cron schedule set 02:00

# Remove scheduled task
aahp-cron schedule remove
```

## pipeline.json

Copy `pipeline.example.json` to `pipeline.json` (gitignored) and edit:

```json
{
  "rootDir": "E:\\_Development",
  "schedule": "02:00",
  "defaults": {
    "backend": "auto",
    "limit": 5,
    "timeoutMinutes": 10,
    "pauseBetweenProjects": 0
  },
  "projects": [
    {
      "name": "my-priority-project",
      "priority": 1,
      "backend": "claude",
      "limit": 3
    },
    {
      "name": "project-to-skip",
      "enabled": false
    }
  ]
}
```

| Field | Description |
|---|---|
| `rootDir` | Absolute path scanned for AAHP projects |
| `runnerPath` | Optional: explicit path to `aahp-runner`'s `dist/cli.js` |
| `schedule` | HH:MM used by `aahp-cron schedule set` |
| `defaults.backend` | `auto` (claude-cli > copilot > sdk), `claude`, `copilot`, or `sdk` |
| `defaults.limit` | Max concurrent agents per project |
| `defaults.timeoutMinutes` | Per-agent timeout |
| `defaults.pauseBetweenProjects` | Seconds to wait between projects |
| `projects[].name` | Dir name under `rootDir`, or absolute path |
| `projects[].enabled` | `false` to skip |
| `projects[].priority` | Lower = runs first |

## Logs

- Per-project agent logs: `~/.aahp/cron-logs/<project>-YYYY-MM-DD.log`
- Run summary logs: `~/.aahp/cron-logs/run-YYYY-MM-DD_HH-mm.log`
- Run history (last 50): `~/.aahp/cron-history.json`

## vs aahp-overnight.ps1

`aahp-overnight.ps1` was a simple loop that ran `aahp run --all` repeatedly for N hours. `aahp-cron` replaces it with:

- Per-project configuration (model, concurrency, enabled/disabled, priority)
- Proper pipeline with structured output and history
- `--dry-run` support
- Windows Task Scheduler / cron integration via `aahp-cron schedule set`
- Run history and status command
