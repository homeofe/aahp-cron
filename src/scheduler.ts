import * as fs from 'fs'
import * as path from 'path'
import { execFileSync, execSync } from 'child_process'
import os from 'os'
import type { PipelineConfig } from './types.js'

const TASK_NAME = 'AAHP-Cron-Pipeline'
const CRON_MARKER = '# AAHP-Cron-Pipeline'

/**
 * Validate a file path supplied as a CLI argument before it is embedded in a
 * scheduled command string.  Rejects:
 *   - empty strings
 *   - paths that contain shell metacharacters (;, |, &, $, `, (, ), <, >, \n, \r, !, {, })
 *   - paths that start with a hyphen (flag injection)
 *   - path segments equal to ".." (traversal outside a confined directory)
 *
 * Throws an Error with a descriptive message on violation.
 */
export function validateConfigPath(configPath: string): void {
  if (!configPath || configPath.trim() === '') {
    throw new Error('Config path must not be empty')
  }

  // Reject leading hyphen (flag injection).
  if (configPath.trimStart().startsWith('-')) {
    throw new Error(`Config path must not start with a hyphen: "${configPath}"`)
  }

  // Reject shell metacharacters.
  // eslint-disable-next-line no-control-regex
  if (/[;|&$`()\n\r!{}]|<|>/.test(configPath)) {
    throw new Error(`Config path contains disallowed shell metacharacter(s): "${configPath}"`)
  }

  // Reject ".." segments to prevent path traversal.
  const segments = configPath.split(/[\\/]/)
  if (segments.some(seg => seg === '..')) {
    throw new Error(`Config path must not contain ".." (path traversal): "${configPath}"`)
  }
}

function buildWindowsAction(config: PipelineConfig, configPath: string): string {
  const nodePath = process.execPath
  const cliPath = path.resolve(path.dirname(process.argv[1] ?? ''), '..', 'dist', 'cli.js')
  return `"${nodePath}" "${cliPath}" run --config "${configPath}"`
}

/** Register a daily Windows Task Scheduler entry at HH:MM. */
export function registerWindowsScheduler(time: string, config: PipelineConfig, configPath: string): void {
  const [hour, minute] = validateTime(time)
  validateConfigPath(configPath)

  const action = buildWindowsAction(config, configPath)

  try {
    execFileSync('schtasks', ['/Delete', '/TN', TASK_NAME, '/F'], { stdio: 'ignore' })
  } catch { /* task may not exist yet */ }

  execFileSync('schtasks', [
    '/Create', '/TN', TASK_NAME,
    '/TR', action,
    '/SC', 'DAILY',
    '/ST', `${hour}:${minute}`,
    '/RL', 'HIGHEST',
    '/F',
  ], { encoding: 'utf8' })

  console.log(`\nScheduled: ${TASK_NAME}`)
  console.log(`   Runs daily at ${time}`)
  console.log(`   Command: ${action}`)
  console.log(`\n   View in Windows: Task Scheduler - "${TASK_NAME}"`)
  console.log(`   To remove: aahp-cron schedule remove`)
}

/** Register a daily cron entry at HH:MM (Linux/macOS). */
export function registerCronScheduler(time: string, config: PipelineConfig, configPath: string): void {
  const [hour, minute] = validateTime(time)
  validateConfigPath(configPath)

  const nodePath = process.execPath
  const cliPath = path.resolve(path.dirname(process.argv[1] ?? ''), '..', 'dist', 'cli.js')
  const command = `"${nodePath}" "${cliPath}" run --config "${configPath}"`
  const cronLine = `${minute} ${hour} * * * ${command} ${CRON_MARKER}`

  const existing = readCrontab()
  const cleaned = existing.split('\n').filter(l => !l.includes(CRON_MARKER)).join('\n')
  const newCrontab = (cleaned.endsWith('\n') || cleaned === '' ? cleaned : cleaned + '\n') + cronLine + '\n'
  writeCrontab(newCrontab)

  console.log(`\nScheduled: AAHP-Cron-Pipeline (cron)`)
  console.log(`   Runs daily at ${time}`)
  console.log(`   Cron expression: ${minute} ${hour} * * *`)
}

/** Remove the scheduled aahp-cron job. */
export function unregisterScheduler(): void {
  if (process.platform === 'win32') {
    try {
      execFileSync('schtasks', ['/Delete', '/TN', TASK_NAME, '/F'], { encoding: 'utf8' })
      console.log(`Removed Windows scheduled task: ${TASK_NAME}`)
    } catch {
      console.log('No Windows scheduled task found to remove.')
    }
  } else {
    const existing = readCrontab()
    if (existing.includes(CRON_MARKER)) {
      const cleaned = existing.split('\n').filter(l => !l.includes(CRON_MARKER)).join('\n')
      writeCrontab(cleaned)
      console.log('Removed aahp-cron cron entry.')
    } else {
      console.log('No aahp-cron cron entry found.')
    }
  }
}

/** Register using the appropriate OS mechanism. */
export function registerScheduler(time: string, config: PipelineConfig, configPath: string): void {
  if (process.platform === 'win32') {
    registerWindowsScheduler(time, config, configPath)
  } else {
    registerCronScheduler(time, config, configPath)
  }
}

function validateTime(time: string): [string, string] {
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid time format "${time}" - expected HH:MM (e.g. "02:00")`)
  }
  const [h, m] = time.split(':')
  return [h!.padStart(2, '0'), m!]
}

function readCrontab(): string {
  try { return execSync('crontab -l 2>/dev/null', { encoding: 'utf8' }) } catch { return '' }
}

function writeCrontab(content: string): void {
  const tmpFile = path.join(os.tmpdir(), `aahp-cron-crontab-${process.pid}.tmp`)
  try {
    fs.writeFileSync(tmpFile, content, { encoding: 'utf8', mode: 0o600 })
    execFileSync('crontab', [tmpFile], { encoding: 'utf8' })
  } finally {
    try { fs.unlinkSync(tmpFile) } catch { /* best-effort cleanup */ }
  }
}
