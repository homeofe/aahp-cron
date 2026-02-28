import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import os from 'os'
import type { DiscoveredProject, RunResult } from './types.js'

const LOG_DIR = path.join(os.homedir(), '.aahp', 'cron-logs')

function ensureLogDir(): void {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function logPath(projectName: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return path.join(LOG_DIR, `${projectName}-${stamp}.log`)
}

/** Spawn aahp-runner (via node or directly if it's on PATH) and run a project's top task.
 *  Streams stdout/stderr to a log file and captures last lines for summary. */
export async function runProject(
  project: DiscoveredProject,
  runnerPath: string,
  signal?: AbortSignal
): Promise<RunResult> {
  ensureLogDir()
  const started = Date.now()
  const lp = logPath(project.name)
  const logStream = fs.createWriteStream(lp, { flags: 'a' })

  const header = `\n${'='.repeat(60)}\n[${new Date().toISOString()}] aahp-cron: ${project.name}\n${'='.repeat(60)}\n`
  logStream.write(header)

  // Build the command: either `node path/to/cli.js` or `aahp-runner` on PATH
  const isJsFile = runnerPath.endsWith('.js')
  const cmd = isJsFile ? process.execPath : runnerPath
  const baseArgs = isJsFile ? [runnerPath] : []

  const args = [
    ...baseArgs,
    'run',
    '--repo-path', project.repoPath,
    '--yes',
    '--backend', project.config.backend,
    '--limit', String(project.config.limit),
    '--timeout', String(project.config.timeoutMinutes),
  ]

  const outputLines: string[] = []
  const MAX_TAIL = 30

  return new Promise<RunResult>((resolve) => {
    const child = spawn(cmd, args, {
      cwd: project.repoPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    if (signal) {
      signal.addEventListener('abort', () => child.kill('SIGTERM'))
    }

    const handleLine = (line: string) => {
      logStream.write(line + '\n')
      outputLines.push(line)
      if (outputLines.length > MAX_TAIL) outputLines.shift()
    }

    let stdoutBuf = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString()
      const lines = stdoutBuf.split('\n')
      stdoutBuf = lines.pop() ?? ''
      lines.forEach(handleLine)
    })

    let stderrBuf = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString()
      const lines = stderrBuf.split('\n')
      stderrBuf = lines.pop() ?? ''
      lines.forEach(l => handleLine('[stderr] ' + l))
    })

    child.on('close', (code) => {
      if (stdoutBuf) handleLine(stdoutBuf)
      if (stderrBuf) handleLine('[stderr] ' + stderrBuf)
      logStream.end()

      const durationMs = Date.now() - started
      const exitCode = code ?? -1
      const summary = outputLines.filter(l => l.trim()).slice(-10).join('\n')

      resolve({
        projectName: project.name,
        repoPath: project.repoPath,
        success: exitCode === 0,
        exitCode,
        durationMs,
        summary,
        error: exitCode !== 0 ? `exited with code ${exitCode}` : undefined,
      })
    })

    child.on('error', (err) => {
      logStream.end()
      resolve({
        projectName: project.name,
        repoPath: project.repoPath,
        success: false,
        exitCode: -1,
        durationMs: Date.now() - started,
        summary: '',
        error: err.message,
      })
    })
  })
}
