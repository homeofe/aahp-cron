import chalk from 'chalk'
import type { PipelineConfig, PipelineRun, RunResult } from './types.js'
import { discoverProjects } from './discovery.js'
import { resolveRunnerPath } from './config.js'
import { runProject } from './runner.js'
import { printRunStart, printRunResult, printSummary, saveRunHistory, writeRunLog } from './reporter.js'

export interface RunOptions {
  /** Only run a project with this name */
  project?: string
  /** Show what would run without spawning agents */
  dryRun?: boolean
  /** AbortController to cancel in-flight runs */
  signal?: AbortSignal
}

/** Execute the full pipeline: Discover → Filter → Sort → Run → Report */
export async function runPipeline(config: PipelineConfig, opts: RunOptions = {}): Promise<PipelineRun> {
  const startedAt = new Date().toISOString()
  const runnerPath = resolveRunnerPath(config)
  const defaults = config.defaults ?? {}
  const pauseMs = (defaults.pauseBetweenProjects ?? 0) * 1000

  // 1. Discover all projects
  let projects = discoverProjects(config)

  // 2. Filter
  if (opts.project) {
    projects = projects.filter(p => p.name === opts.project || p.repoPath === opts.project)
    if (projects.length === 0) {
      console.error(chalk.red(`No project found matching: ${opts.project}`))
    }
  }

  const enabled = projects.filter(p => p.config.enabled)
  const skipped = projects.filter(p => !p.config.enabled)

  console.log(chalk.bold(`\naahp-cron pipeline`))
  console.log(chalk.gray(`  Runner   : ${runnerPath}`))
  console.log(chalk.gray(`  Projects : ${enabled.length} to run, ${skipped.length} disabled`))
  if (opts.dryRun) {
    console.log(chalk.yellow('\n  DRY RUN - no agents will be spawned\n'))
  }

  const results: RunResult[] = []

  // 3. Run each enabled project
  for (let i = 0; i < enabled.length; i++) {
    const project = enabled[i]!
    printRunStart(project.name, i + 1, enabled.length)

    if (opts.dryRun) {
      console.log(chalk.gray(`    [dry-run] would run: ${project.name} (backend=${project.config.backend} limit=${project.config.limit})`))
      results.push({
        projectName: project.name,
        repoPath: project.repoPath,
        success: true,
        exitCode: 0,
        durationMs: 0,
        summary: 'dry-run',
      })
      continue
    }

    if (opts.signal?.aborted) break

    const result = await runProject(project, runnerPath, opts.signal)
    results.push(result)
    printRunResult(result)

    // Pause between projects if configured
    if (pauseMs > 0 && i < enabled.length - 1 && !opts.signal?.aborted) {
      console.log(chalk.gray(`  Pausing ${defaults.pauseBetweenProjects}s before next project...`))
      await new Promise(r => setTimeout(r, pauseMs))
    }
  }

  const finishedAt = new Date().toISOString()
  const run: PipelineRun = {
    startedAt,
    finishedAt,
    totalProjects: projects.length,
    ran: results.filter(r => r.summary !== 'dry-run' || !opts.dryRun).length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    skipped: skipped.length,
    results,
  }

  printSummary(run)

  if (!opts.dryRun) {
    saveRunHistory(run)
    const logPath = writeRunLog(run)
    console.log(chalk.gray(`  Log: ${logPath}`))
  }

  return run
}
