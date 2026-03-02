import chalk from 'chalk'
import { spawn } from 'child_process'
import type { PipelineConfig, PipelineRun } from './types.js'
import { discoverProjects } from './discovery.js'
import { resolveRunnerPath } from './config.js'

export interface RunOptions {
  /** Only run a project with this name */
  project?: string
  /** Show what would run without spawning agents */
  dryRun?: boolean
  /** AbortController to cancel in-flight runs */
  signal?: AbortSignal
}

/**
 * Execute the full pipeline by delegating to `aahp run --all --yes --follow-up`.
 * Output is piped directly to stdout/stderr so the format is identical to running
 * `aahp run` by hand. GitHub issue sync happens automatically inside aahp-runner's
 * scanProjects() call (fetchAndImportGitHubIssues + createMissingGitHubIssues).
 */
export async function runPipeline(config: PipelineConfig, opts: RunOptions = {}): Promise<PipelineRun> {
  const startedAt = new Date().toISOString()
  const runnerPath = resolveRunnerPath(config)
  const defaults = config.defaults ?? {}

  const isJsFile = runnerPath.endsWith('.js')
  const cmd = isJsFile ? process.execPath : runnerPath
  const baseArgs = isJsFile ? [runnerPath] : []

  if (opts.dryRun) {
    // Dry-run: just show what would run via aahp list
    const projects = discoverProjects(config).filter(p => p.config.enabled && p.readyTaskCount + p.activeTaskCount > 0)
    console.log(chalk.bold(`\naahp-cron dry-run`))
    console.log(chalk.gray(`  Runner : ${runnerPath}`))
    console.log(chalk.yellow(`  ${projects.length} project(s) would run:\n`))
    for (const p of projects) {
      console.log(chalk.gray(`    ${p.name.padEnd(35)} ready:${p.readyTaskCount} active:${p.activeTaskCount}`))
    }
    console.log()
    return { startedAt, finishedAt: new Date().toISOString(), totalProjects: projects.length, ran: 0, succeeded: 0, failed: 0, skipped: 0, results: [] }
  }

  // Build args — single project or all
  const args: string[] = [
    ...baseArgs,
    'run',
    '--yes',
    '--follow-up',
    '--root', config.rootDir,
    '--backend', String(defaults.backend ?? 'auto'),
    '--limit', String(defaults.limit ?? 5),
    '--timeout', String(defaults.timeoutMinutes ?? 10),
  ]

  if (opts.project) {
    args.push(opts.project)
  } else {
    args.push('--all')
  }

  return new Promise<PipelineRun>((resolve) => {
    // inherit stdio — output format is identical to running `aahp run` directly
    const child = spawn(cmd, args, {
      cwd: config.rootDir,
      stdio: 'inherit',
      env: { ...process.env },
    })

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => child.kill('SIGTERM'))
    }

    child.on('close', (code) => {
      const finishedAt = new Date().toISOString()
      resolve({
        startedAt,
        finishedAt,
        totalProjects: 0,
        ran: 0,
        succeeded: code === 0 ? 1 : 0,
        failed: code !== 0 ? 1 : 0,
        skipped: 0,
        results: [],
      })
    })

    child.on('error', (err) => {
      console.error(chalk.red(`\nFailed to start aahp-runner: ${err.message}`))
      console.error(chalk.gray(`  Tried: ${cmd} ${baseArgs.join(' ')}`))
      resolve({
        startedAt,
        finishedAt: new Date().toISOString(),
        totalProjects: 0,
        ran: 0,
        succeeded: 0,
        failed: 1,
        skipped: 0,
        results: [],
      })
    })
  })
}
