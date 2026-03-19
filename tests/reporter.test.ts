import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { saveRunHistory, loadLastRun, writeRunLog } from '../src/reporter.js'
import type { PipelineRun, RunResult } from '../src/types.js'

// The reporter module hard-codes paths under os.homedir() at module load time.
// We use the real home dir and clean up the test artefacts afterwards.
const HISTORY_FILE = path.join(os.homedir(), '.aahp', 'cron-history.json')
const LOG_DIR = path.join(os.homedir(), '.aahp', 'cron-logs')

// Snapshot of the history file *before* tests run so we can restore it
let historySnapshot: string | null = null

beforeAll(() => {
  if (fs.existsSync(HISTORY_FILE)) {
    historySnapshot = fs.readFileSync(HISTORY_FILE, 'utf8')
  }
})

afterAll(() => {
  // Restore history file (or remove it if it didn't exist before tests)
  if (historySnapshot !== null) {
    fs.writeFileSync(HISTORY_FILE, historySnapshot, 'utf8')
  } else if (fs.existsSync(HISTORY_FILE)) {
    fs.unlinkSync(HISTORY_FILE)
  }
})

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    startedAt: '2025-01-01T02:00:00.000Z',
    finishedAt: '2025-01-01T02:03:00.000Z',
    totalProjects: 2,
    ran: 2,
    succeeded: 1,
    failed: 1,
    skipped: 0,
    results: [],
    ...overrides,
  }
}

function makeResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    projectName: 'test-proj',
    repoPath: '/dev/test-proj',
    success: true,
    exitCode: 0,
    durationMs: 5000,
    summary: 'all good',
    ...overrides,
  }
}

describe('saveRunHistory / loadLastRun', () => {
  it('saves a run and loads it back as the last run', () => {
    const run = makeRun()
    saveRunHistory(run)
    const last = loadLastRun()
    expect(last).not.toBeNull()
    expect(last!.startedAt).toBe(run.startedAt)
  })

  it('most recent run is always first after multiple saves', () => {
    const run1 = makeRun({ startedAt: '2025-01-01T00:00:00.000Z' })
    const run2 = makeRun({ startedAt: '2025-01-02T00:00:00.000Z' })
    saveRunHistory(run1)
    saveRunHistory(run2)
    const last = loadLastRun()
    expect(last!.startedAt).toBe(run2.startedAt)
  })

  it('caps history at 50 entries after many saves', () => {
    // Save a lot of runs sequentially to trigger the cap
    for (let i = 0; i < 55; i++) {
      const hour = String(i % 24).padStart(2, '0')
      saveRunHistory(makeRun({ startedAt: `2025-01-01T${hour}:00:00.000Z` }))
    }
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) as PipelineRun[]
    expect(history.length).toBeLessThanOrEqual(50)
  })

  it('preserves results array in the saved run', () => {
    const result = makeResult({ projectName: 'proj-x', success: false })
    const run = makeRun({ results: [result] })
    saveRunHistory(run)
    const last = loadLastRun()!
    expect(last.results).toHaveLength(1)
    expect(last.results[0]!.projectName).toBe('proj-x')
  })

  it('loadLastRun returns null when history file is absent', () => {
    // Temporarily rename the history file
    const tmpPath = HISTORY_FILE + '.bak'
    if (fs.existsSync(HISTORY_FILE)) fs.renameSync(HISTORY_FILE, tmpPath)
    try {
      expect(loadLastRun()).toBeNull()
    } finally {
      if (fs.existsSync(tmpPath)) fs.renameSync(tmpPath, HISTORY_FILE)
    }
  })
})

describe('writeRunLog', () => {
  it('creates a log file and returns its path', () => {
    const run = makeRun()
    const logPath = writeRunLog(run)
    expect(fs.existsSync(logPath)).toBe(true)
    // Cleanup
    fs.unlinkSync(logPath)
  })

  it('log file contains key run information', () => {
    const run = makeRun({
      results: [makeResult({ projectName: 'alpha', success: false, durationMs: 12000, error: 'timeout' })],
    })
    const logPath = writeRunLog(run)
    const content = fs.readFileSync(logPath, 'utf8')
    expect(content).toContain('aahp-cron Pipeline Run')
    expect(content).toContain('alpha')
    expect(content).toContain('timeout')
    // Cleanup
    fs.unlinkSync(logPath)
  })

  it('log filename is derived from the run startedAt timestamp', () => {
    const run = makeRun({ startedAt: '2025-06-15T08:30:00.000Z' })
    const logPath = writeRunLog(run)
    expect(path.basename(logPath)).toMatch(/^run-2025-06-15/)
    // Cleanup
    fs.unlinkSync(logPath)
  })
})
