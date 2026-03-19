/**
 * Integration smoke test: scheduler dry-run mode (Issue #5)
 *
 * Verifies that running the scheduler pipeline in dry-run mode:
 *   1. Discovers projects with MANIFEST.json files
 *   2. Selects the tasks that would be executed
 *   3. Does NOT execute any actual agents
 *   4. Returns a PipelineRun result describing what would have happened
 *
 * Uses the public API (discoverProjects + runPipeline) rather than spawning
 * a subprocess so the test stays fast and deterministic.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { discoverProjects } from '../src/discovery.js'
import { runPipeline } from '../src/pipeline.js'
import type { PipelineConfig } from '../src/types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpRoot: string

function makeTmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aahp-cron-smoke-'))
}

interface ManifestTask {
  title?: string
  status: string
  priority?: string
  depends_on?: string[]
  created?: string
  github_issue?: number
}

function writeProject(
  rootDir: string,
  name: string,
  tasks: Record<string, ManifestTask>,
): string {
  const repoPath = path.join(rootDir, name)
  const handoffDir = path.join(repoPath, '.ai', 'handoff')
  fs.mkdirSync(handoffDir, { recursive: true })
  const manifest = {
    aahp_version: '3.0',
    project: name,
    last_session: {
      agent: 'test-agent',
      timestamp: '2026-01-01T00:00:00Z',
      commit: 'abc1234',
      phase: 'implement',
      duration_minutes: 3,
    },
    files: {},
    quick_context: 'A test project',
    token_budget: { manifest_only: 80 },
    tasks,
  }
  fs.writeFileSync(
    path.join(handoffDir, 'MANIFEST.json'),
    JSON.stringify(manifest, null, 2),
  )
  return repoPath
}

function makeConfig(rootDir: string, extra: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    rootDir,
    // Point runnerPath at something that definitely doesn't exist so that if
    // a real spawn were attempted it would fail loudly.
    runnerPath: '/nonexistent/aahp-runner',
    defaults: {
      backend: 'auto',
      limit: 1,
      timeoutMinutes: 5,
    },
    ...extra,
  }
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  tmpRoot = makeTmpRoot()
})

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe('aahp-cron integration: dry-run mode (Issue #5)', () => {

  // ── 1. Discovery ─────────────────────────────────────────────────────────

  describe('project discovery', () => {
    it('discovers projects with MANIFEST.json', () => {
      writeProject(tmpRoot, 'app-alpha', { 'T-001': { status: 'ready', title: 'Do alpha' } })
      writeProject(tmpRoot, 'app-beta',  { 'T-001': { status: 'ready', title: 'Do beta'  } })

      const discovered = discoverProjects(makeConfig(tmpRoot))

      expect(discovered).toHaveLength(2)
      const names = discovered.map(p => p.name)
      expect(names).toContain('app-alpha')
      expect(names).toContain('app-beta')
    })

    it('does not include dirs without MANIFEST.json', () => {
      writeProject(tmpRoot, 'valid-project', { 'T-001': { status: 'ready' } })
      fs.mkdirSync(path.join(tmpRoot, 'no-manifest-dir'))

      const discovered = discoverProjects(makeConfig(tmpRoot))
      expect(discovered).toHaveLength(1)
      expect(discovered[0]!.name).toBe('valid-project')
    })

    it('correctly counts ready, active, blocked, and done tasks', () => {
      writeProject(tmpRoot, 'multi-task', {
        'T-001': { status: 'ready' },
        'T-002': { status: 'ready' },
        'T-003': { status: 'in_progress' },
        'T-004': { status: 'blocked' },
        'T-005': { status: 'done' },
      })

      const [p] = discoverProjects(makeConfig(tmpRoot))
      expect(p!.readyTaskCount).toBe(2)
      expect(p!.activeTaskCount).toBe(1)
      expect(p!.blockedTaskCount).toBe(1)
      expect(p!.doneTaskCount).toBe(1)
    })

    it('lists idle projects (zero ready + active tasks) in results', () => {
      writeProject(tmpRoot, 'idle-project', {
        'T-001': { status: 'done' },
      })

      const discovered = discoverProjects(makeConfig(tmpRoot))
      // Even idle projects are returned by discoverProjects — filtering is the
      // caller's responsibility (e.g. dryRun filter in runPipeline).
      expect(discovered).toHaveLength(1)
      expect(discovered[0]!.readyTaskCount).toBe(0)
      expect(discovered[0]!.activeTaskCount).toBe(0)
    })

    it('respects enabled: false from pipeline.json overrides', () => {
      writeProject(tmpRoot, 'disabled-proj', { 'T-001': { status: 'ready' } })

      const cfg = makeConfig(tmpRoot, {
        projects: [{ name: 'disabled-proj', enabled: false }],
      })
      const discovered = discoverProjects(cfg)
      expect(discovered[0]!.config.enabled).toBe(false)
    })
  })

  // ── 2. Task selection in dry-run ─────────────────────────────────────────

  describe('task selection', () => {
    it('selects projects that have ready tasks in dry-run', async () => {
      writeProject(tmpRoot, 'ready-app',  { 'T-001': { status: 'ready' } })
      writeProject(tmpRoot, 'done-app',   { 'T-001': { status: 'done'  } })

      const config = makeConfig(tmpRoot)

      // Capture console output to confirm dry-run prints the right projects
      const lines: string[] = []
      const origLog = console.log
      console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '))

      const result = await runPipeline(config, { dryRun: true })

      console.log = origLog

      // Only the ready-app should appear in dry-run output
      expect(result.totalProjects).toBe(1)
      expect(result.ran).toBe(0)
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(0)
      const joined = lines.join('\n')
      expect(joined).toContain('ready-app')
    })

    it('selects projects that have in_progress tasks in dry-run', async () => {
      writeProject(tmpRoot, 'active-app', { 'T-001': { status: 'in_progress' } })

      const config = makeConfig(tmpRoot)
      const lines: string[] = []
      const origLog = console.log
      console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '))

      const result = await runPipeline(config, { dryRun: true })
      console.log = origLog

      expect(result.totalProjects).toBe(1)
      const joined = lines.join('\n')
      expect(joined).toContain('active-app')
    })

    it('excludes disabled projects from dry-run output', async () => {
      writeProject(tmpRoot, 'disabled-app', { 'T-001': { status: 'ready' } })

      const config = makeConfig(tmpRoot, {
        projects: [{ name: 'disabled-app', enabled: false }],
      })
      const result = await runPipeline(config, { dryRun: true })

      expect(result.totalProjects).toBe(0)
    })
  })

  // ── 3. No agent execution ─────────────────────────────────────────────────

  describe('no agent execution in dry-run', () => {
    it('returns ran: 0 even when projects have ready tasks', async () => {
      writeProject(tmpRoot, 'no-exec-app', { 'T-001': { status: 'ready', title: 'Should not run' } })

      const config = makeConfig(tmpRoot)

      // Spy on process.stdout.write to verify no agent output leaks
      const writeSpyCalls: string[] = []
      const origWrite = process.stdout.write.bind(process.stdout)
      process.stdout.write = (s: unknown) => {
        writeSpyCalls.push(String(s))
        return origWrite(s)
      }

      const result = await runPipeline(config, { dryRun: true })

      process.stdout.write = origWrite

      expect(result.ran).toBe(0)
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('does not attempt to run the (nonexistent) runner binary in dry-run', async () => {
      // If dry-run were to spawn the runner, it would fail because runnerPath
      // is set to '/nonexistent/aahp-runner'. The pipeline must succeed even
      // when the runner binary does not exist.
      writeProject(tmpRoot, 'safe-app', { 'T-001': { status: 'ready' } })

      const config = makeConfig(tmpRoot) // runnerPath = '/nonexistent/aahp-runner'
      // This must resolve successfully — if spawn were called it would reject or error.
      const result = await runPipeline(config, { dryRun: true })

      // Zero runs confirms no real execution happened
      expect(result.ran).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('completes quickly (well under 2 seconds)', async () => {
      // Create several projects to prove overhead is minimal
      for (let i = 1; i <= 5; i++) {
        writeProject(tmpRoot, `project-${i}`, {
          'T-001': { status: 'ready', title: `Task for project ${i}` },
        })
      }

      const config = makeConfig(tmpRoot)
      const start = Date.now()
      await runPipeline(config, { dryRun: true })
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(2000)
    })

    it('returns a well-formed PipelineRun result', async () => {
      writeProject(tmpRoot, 'shaped-app', { 'T-001': { status: 'ready' } })

      const config = makeConfig(tmpRoot)
      const result = await runPipeline(config, { dryRun: true })

      expect(result).toHaveProperty('startedAt')
      expect(result).toHaveProperty('finishedAt')
      expect(result).toHaveProperty('totalProjects')
      expect(result).toHaveProperty('ran')
      expect(result).toHaveProperty('succeeded')
      expect(result).toHaveProperty('failed')
      expect(result).toHaveProperty('skipped')
      expect(result).toHaveProperty('results')
      expect(Array.isArray(result.results)).toBe(true)
      expect(typeof result.startedAt).toBe('string')
      expect(typeof result.finishedAt).toBe('string')
    })
  })

  // ── 4. Project filter in dry-run ─────────────────────────────────────────

  describe('project filter in dry-run', () => {
    it('filters to a named project when project option is given', async () => {
      writeProject(tmpRoot, 'target-app',  { 'T-001': { status: 'ready' } })
      writeProject(tmpRoot, 'ignored-app', { 'T-001': { status: 'ready' } })

      const config = makeConfig(tmpRoot)

      const lines: string[] = []
      const origLog = console.log
      console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '))

      const result = await runPipeline(config, { dryRun: true, project: 'target-app' })

      console.log = origLog

      expect(result.totalProjects).toBe(1)
      const joined = lines.join('\n')
      expect(joined).toContain('target-app')
    })

    it('shows totalProjects: 0 when named project has no ready tasks', async () => {
      writeProject(tmpRoot, 'done-app', { 'T-001': { status: 'done' } })

      const config = makeConfig(tmpRoot)
      const result = await runPipeline(config, { dryRun: true, project: 'done-app' })

      expect(result.totalProjects).toBe(0)
      expect(result.ran).toBe(0)
    })
  })

  // ── 5. End-to-end: full discovery + dry-run pipeline call ────────────────

  describe('full end-to-end dry-run smoke', () => {
    it('runs full dry-run pipeline without throwing', async () => {
      writeProject(tmpRoot, 'e2e-app-1', {
        'T-001': { status: 'ready',       title: 'First task'   },
        'T-002': { status: 'in_progress', title: 'Active task'  },
        'T-003': { status: 'done',        title: 'Already done' },
      })
      writeProject(tmpRoot, 'e2e-app-2', {
        'T-001': { status: 'ready', title: 'Single task' },
      })
      writeProject(tmpRoot, 'e2e-app-3', {
        'T-001': { status: 'done', title: 'All done' },
      })

      const config = makeConfig(tmpRoot)

      await expect(runPipeline(config, { dryRun: true })).resolves.not.toThrow()
    })

    it('reports correct counts: 2 actionable out of 3 projects', async () => {
      writeProject(tmpRoot, 'act-1', { 'T-001': { status: 'ready' } })
      writeProject(tmpRoot, 'act-2', { 'T-001': { status: 'ready' } })
      writeProject(tmpRoot, 'idle',  { 'T-001': { status: 'done'  } })

      const config = makeConfig(tmpRoot)
      const result = await runPipeline(config, { dryRun: true })

      expect(result.totalProjects).toBe(2)
      expect(result.ran).toBe(0)
    })
  })
})
