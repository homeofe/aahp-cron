import * as fs from 'fs'
import * as path from 'path'
import os from 'os'
import chalk from 'chalk'
import type { PipelineRun, RunResult } from './types.js'

const LOG_DIR = path.join(os.homedir(), '.aahp', 'cron-logs')
const HISTORY_FILE = path.join(os.homedir(), '.aahp', 'cron-history.json')

function fmtDuration(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

/** Print a live status line during a run. */
export function printRunStart(projectName: string, index: number, total: number): void {
  console.log(chalk.cyan(`\n[${index}/${total}] Running: ${chalk.bold(projectName)}`))
}

/** Print result of a single project run. */
export function printRunResult(result: RunResult): void {
  const dur = fmtDuration(result.durationMs)
  if (result.success) {
    console.log(chalk.green(`  ✅ ${result.projectName}`) + chalk.gray(` (${dur})`))
  } else {
    console.log(chalk.red(`  ❌ ${result.projectName}`) + chalk.gray(` (${dur}) — ${result.error ?? 'failed'}`))
  }
}

/** Print final summary table after a pipeline run. */
export function printSummary(run: PipelineRun): void {
  const dur = fmtDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
  console.log('\n' + chalk.bold('━'.repeat(55)))
  console.log(chalk.bold('  Pipeline Run Summary'))
  console.log('  ' + chalk.gray(`${run.startedAt} → ${run.finishedAt}  (${dur})`))
  console.log('  ' + chalk.gray(`Projects: ${run.totalProjects} total  |  Ran: ${run.ran}  |  Skipped: ${run.skipped}`))
  console.log('  ' + chalk.green(`✅ Succeeded: ${run.succeeded}`) + '  ' + chalk.red(`❌ Failed: ${run.failed}`))

  if (run.failed > 0) {
    console.log('\n' + chalk.red('  Failed projects:'))
    run.results.filter(r => !r.success).forEach(r => {
      console.log(chalk.red(`    • ${r.projectName}: ${r.error ?? 'unknown error'}`))
    })
  }

  console.log(chalk.bold('━'.repeat(55)))
}

/** Persist run history to ~/.aahp/cron-history.json (last 50 runs). */
export function saveRunHistory(run: PipelineRun): void {
  fs.mkdirSync(path.join(os.homedir(), '.aahp'), { recursive: true })
  let history: PipelineRun[] = []
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) as PipelineRun[]
    }
  } catch { /* start fresh */ }

  history.unshift(run)
  if (history.length > 50) history = history.slice(0, 50)
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n', 'utf8')
}

/** Load last run from history. */
export function loadLastRun(): PipelineRun | null {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return null
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) as PipelineRun[]
    return history[0] ?? null
  } catch {
    return null
  }
}

/** Write a full run report log to ~/.aahp/cron-logs/run-YYYY-MM-DD_HH-mm.log */
export function writeRunLog(run: PipelineRun): string {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const stamp = new Date(run.startedAt).toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
  const logPath = path.join(LOG_DIR, `run-${stamp}.log`)

  const lines = [
    `aahp-cron Pipeline Run`,
    `Started : ${run.startedAt}`,
    `Finished: ${run.finishedAt}`,
    `Projects: ${run.totalProjects} total | Ran: ${run.ran} | Skipped: ${run.skipped}`,
    `Results : ${run.succeeded} succeeded, ${run.failed} failed`,
    '',
    ...run.results.map(r => {
      const status = r.success ? 'OK ' : 'ERR'
      const dur = fmtDuration(r.durationMs)
      return `[${status}] ${r.projectName.padEnd(30)} ${dur.padStart(8)}${r.error ? `  ${r.error}` : ''}`
    }),
  ]

  fs.writeFileSync(logPath, lines.join('\n') + '\n', 'utf8')
  return logPath
}
