import chalk from 'chalk'
import { spawn } from 'child_process'
import type { PipelineConfig, PipelineRun } from './types.js'
import { discoverProjects } from './discovery.js'
import { resolveRunnerPath } from './config.js'

export interface RunOptions {
  /** One or more project names to run (comma-separated string or array). Omit to run all. */
  project?: string | string[]
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
 *
 * When multiple projects are given (comma-separated or array), each gets its own
 * aahp-runner subprocess running in parallel. Output is prefixed with [project-name].
 */
export async function runPipeline(config: PipelineConfig, opts: RunOptions = {}): Promise<PipelineRun> {
  const startedAt = new Date().toISOString()
  const runnerPath = resolveRunnerPath(config)
  const defaults = config.defaults ?? {}

  const isJsFile = runnerPath.endsWith('.js')
  const cmd = isJsFile ? process.execPath : runnerPath
  const baseArgs = isJsFile ? [runnerPath] : []

  // Normalise project list: undefined → [], 'a,b' → ['a','b'], ['a','b'] → ['a','b']
  // Also splits on spaces: PowerShell converts bare commas (ai-red,ai-blue) into
  // space-joined strings ("ai-red ai-blue") when passing to external commands.
  const projectList: string[] = opts.project
    ? (Array.isArray(opts.project) ? opts.project : opts.project.split(/[,\s]+/).map(s => s.trim()).filter(Boolean))
    : []

  if (opts.dryRun) {
    // Dry-run: just show what would run via aahp list
    const all = discoverProjects(config).filter(p => p.config.enabled && p.readyTaskCount + p.activeTaskCount > 0)
    const projects = projectList.length > 0
      ? all.filter(p => projectList.some(n => p.name.toLowerCase().includes(n.toLowerCase())))
      : all
    console.log(chalk.bold(`\naahp-cron dry-run`))
    console.log(chalk.gray(`  Runner : ${runnerPath}`))
    console.log(chalk.yellow(`  ${projects.length} project(s) would run:\n`))
    for (const p of projects) {
      const blockedStr = p.blockedTaskCount > 0 ? chalk.yellow(` blocked:${p.blockedTaskCount}`) : ''
      console.log(chalk.gray(`    ${p.name.padEnd(35)} ready:${p.readyTaskCount} active:${p.activeTaskCount}`) + blockedStr)
    }
    console.log()
    return { startedAt, finishedAt: new Date().toISOString(), totalProjects: projects.length, ran: 0, succeeded: 0, failed: 0, skipped: 0, results: [] }
  }

  // Base args shared by all spawned runner instances
  const sharedArgs = [
    ...baseArgs,
    'run',
    '--yes',
    '--follow-up',
    '--root', config.rootDir,
    '--backend', String(defaults.backend ?? 'auto'),
    '--limit', String(defaults.limit ?? 5),
    '--timeout', String(defaults.timeoutMinutes ?? 10),
  ]

  // ── Single project or all: inherit stdio (identical UX to running aahp directly) ──
  if (projectList.length <= 1) {
    const args = [...sharedArgs, ...(projectList.length === 1 ? [projectList[0]!] : ['--all'])]
    return spawnRunner(cmd, args, config.rootDir, opts.signal, startedAt)
  }

  // ── Multiple projects: run in parallel, prefix each line with [project-name] ──
  console.log(chalk.bold(`\n🚀 Running ${projectList.length} projects in parallel: ${projectList.join(', ')}\n`))

  const runs = await Promise.all(
    projectList.map(project =>
      spawnRunnerPrefixed(cmd, [...sharedArgs, project], config.rootDir, project, opts.signal)
    )
  )

  const finishedAt = new Date().toISOString()
  return {
    startedAt,
    finishedAt,
    totalProjects: projectList.length,
    ran: runs.length,
    succeeded: runs.filter(r => r.succeeded > 0).length,
    failed: runs.filter(r => r.failed > 0).length,
    skipped: 0,
    results: [],
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Spawn a single runner process with inherited stdio. */
function spawnRunner(
  cmd: string, args: string[], cwd: string,
  signal: AbortSignal | undefined, startedAt: string
): Promise<PipelineRun> {
  return new Promise<PipelineRun>((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env } })

    if (signal) signal.addEventListener('abort', () => child.kill('SIGTERM'))

    child.on('close', (code) => {
      resolve({
        startedAt,
        finishedAt: new Date().toISOString(),
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
      resolve({ startedAt, finishedAt: new Date().toISOString(), totalProjects: 0, ran: 0, succeeded: 0, failed: 1, skipped: 0, results: [] })
    })
  })
}

/** Spawn a runner process with piped stdio, prefixing each output line with [project]. */
function spawnRunnerPrefixed(
  cmd: string, args: string[], cwd: string,
  project: string, signal: AbortSignal | undefined
): Promise<PipelineRun> {
  const startedAt = new Date().toISOString()
  const prefix = chalk.cyan(`[${project}] `)

  return new Promise<PipelineRun>((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } })

    if (signal) signal.addEventListener('abort', () => child.kill('SIGTERM'))

    let buf = ''
    const flush = (stream: NodeJS.WriteStream, data: string) => {
      const combined = buf + data
      buf = ''
      const lines = combined.split('\n')
      // Last element may be an incomplete line — keep it in buffer
      buf = lines.pop() ?? ''
      for (const line of lines) {
        stream.write(prefix + line + '\n')
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => flush(process.stdout, chunk.toString()))
    child.stderr?.on('data', (chunk: Buffer) => flush(process.stderr, chunk.toString()))

    child.on('close', (code) => {
      // Flush any remaining buffer content
      if (buf) process.stdout.write(prefix + buf + '\n')
      buf = ''
      resolve({
        startedAt,
        finishedAt: new Date().toISOString(),
        totalProjects: 1,
        ran: 1,
        succeeded: code === 0 ? 1 : 0,
        failed: code !== 0 ? 1 : 0,
        skipped: 0,
        results: [],
      })
    })

    child.on('error', (err) => {
      process.stderr.write(prefix + chalk.red(`Failed to start aahp-runner: ${err.message}\n`))
      resolve({ startedAt, finishedAt: new Date().toISOString(), totalProjects: 1, ran: 1, succeeded: 0, failed: 1, skipped: 0, results: [] })
    })
  })
}
