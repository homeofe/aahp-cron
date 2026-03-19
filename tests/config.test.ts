import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  loadConfig,
  saveConfig,
  resolveDefaults,
  resolveProjectConfig,
  buildInitialConfig,
  DEFAULT_DEFAULTS,
  DEFAULT_PROJECT_CONFIG,
} from '../src/config.js'
import type { PipelineConfig } from '../src/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aahp-cron-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ── loadConfig ──────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  it('returns null when no config file exists', () => {
    const result = loadConfig(path.join(tmpDir, 'nonexistent.json'))
    expect(result).toBeNull()
  })

  it('loads a valid pipeline.json from an explicit path', () => {
    const cfg: PipelineConfig = { rootDir: '/dev', schedule: '03:00' }
    const filePath = path.join(tmpDir, 'pipeline.json')
    fs.writeFileSync(filePath, JSON.stringify(cfg))
    const result = loadConfig(filePath)
    expect(result).toMatchObject({ rootDir: '/dev', schedule: '03:00' })
  })

  it('throws when the file contains invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json')
    fs.writeFileSync(filePath, '{ not valid json }')
    expect(() => loadConfig(filePath)).toThrow(/Failed to parse config/)
  })

  it('reads all top-level fields correctly', () => {
    const cfg: PipelineConfig = {
      rootDir: '/projects',
      runnerPath: '/usr/bin/aahp-runner',
      schedule: '02:30',
      defaults: { backend: 'claude', limit: 3 },
      projects: [{ name: 'my-repo', priority: 1 }],
    }
    const filePath = path.join(tmpDir, 'pipeline.json')
    fs.writeFileSync(filePath, JSON.stringify(cfg))
    const result = loadConfig(filePath)!
    expect(result.rootDir).toBe('/projects')
    expect(result.defaults?.backend).toBe('claude')
    expect(result.projects).toHaveLength(1)
  })
})

// ── saveConfig ──────────────────────────────────────────────────────────────

describe('saveConfig', () => {
  it('writes a valid JSON file at the given output path', () => {
    const cfg: PipelineConfig = { rootDir: '/tmp/dev' }
    const dest = path.join(tmpDir, 'out.json')
    saveConfig(cfg, dest)
    const parsed = JSON.parse(fs.readFileSync(dest, 'utf8'))
    expect(parsed.rootDir).toBe('/tmp/dev')
  })

  it('produces pretty-printed JSON (indented)', () => {
    const cfg: PipelineConfig = { rootDir: '/tmp/dev' }
    const dest = path.join(tmpDir, 'out.json')
    saveConfig(cfg, dest)
    const raw = fs.readFileSync(dest, 'utf8')
    expect(raw).toContain('\n')
  })

  it('file content is round-trip stable', () => {
    const cfg: PipelineConfig = {
      rootDir: '/dev',
      schedule: '02:00',
      defaults: { limit: 5 },
      projects: [{ name: 'proj-a', priority: 1 }],
    }
    const dest = path.join(tmpDir, 'rt.json')
    saveConfig(cfg, dest)
    const loaded = loadConfig(dest)
    expect(loaded?.schedule).toBe('02:00')
    expect(loaded?.projects?.[0]?.name).toBe('proj-a')
  })
})

// ── resolveDefaults ─────────────────────────────────────────────────────────

describe('resolveDefaults', () => {
  it('returns built-in defaults when config.defaults is absent', () => {
    const result = resolveDefaults({ rootDir: '/dev' })
    expect(result).toEqual(DEFAULT_DEFAULTS)
  })

  it('overrides individual fields from config.defaults', () => {
    const result = resolveDefaults({ rootDir: '/dev', defaults: { backend: 'claude', limit: 2 } })
    expect(result.backend).toBe('claude')
    expect(result.limit).toBe(2)
    expect(result.timeoutMinutes).toBe(DEFAULT_DEFAULTS.timeoutMinutes)
  })

  it('all required fields are present in the result', () => {
    const result = resolveDefaults({ rootDir: '/dev' })
    expect(result).toHaveProperty('backend')
    expect(result).toHaveProperty('limit')
    expect(result).toHaveProperty('timeoutMinutes')
    expect(result).toHaveProperty('pauseBetweenProjects')
  })
})

// ── resolveProjectConfig ────────────────────────────────────────────────────

describe('resolveProjectConfig', () => {
  const baseConfig: PipelineConfig = {
    rootDir: '/dev',
    projects: [
      { name: 'my-repo', priority: 1, backend: 'sdk', limit: 2, timeoutMinutes: 5 },
      { name: 'disabled-repo', enabled: false },
    ],
  }

  it('returns override values when project is listed in config', () => {
    const result = resolveProjectConfig('my-repo', baseConfig, DEFAULT_DEFAULTS)
    expect(result.priority).toBe(1)
    expect(result.backend).toBe('sdk')
    expect(result.limit).toBe(2)
    expect(result.timeoutMinutes).toBe(5)
    expect(result.enabled).toBe(true)
  })

  it('uses defaults for unlisted projects', () => {
    const result = resolveProjectConfig('unknown-project', baseConfig, DEFAULT_DEFAULTS)
    expect(result.backend).toBe(DEFAULT_DEFAULTS.backend)
    expect(result.limit).toBe(DEFAULT_DEFAULTS.limit)
    expect(result.enabled).toBe(true)
    expect(result.priority).toBe(DEFAULT_PROJECT_CONFIG.priority)
  })

  it('respects enabled: false override', () => {
    const result = resolveProjectConfig('disabled-repo', baseConfig, DEFAULT_DEFAULTS)
    expect(result.enabled).toBe(false)
  })

  it('matches by basename when name is a full path', () => {
    const cfg: PipelineConfig = {
      rootDir: '/dev',
      projects: [{ name: 'my-repo', backend: 'copilot' }],
    }
    const result = resolveProjectConfig('/dev/my-repo', cfg, DEFAULT_DEFAULTS)
    expect(result.backend).toBe('copilot')
  })
})

// ── buildInitialConfig ──────────────────────────────────────────────────────

describe('buildInitialConfig', () => {
  it('produces a valid PipelineConfig with the given rootDir', () => {
    const cfg = buildInitialConfig('/my/dev')
    expect(cfg.rootDir).toBe('/my/dev')
  })

  it('includes a default schedule', () => {
    const cfg = buildInitialConfig('/my/dev')
    expect(cfg.schedule).toBeDefined()
    expect(typeof cfg.schedule).toBe('string')
  })

  it('includes defaults block with all required fields', () => {
    const cfg = buildInitialConfig('/my/dev')
    expect(cfg.defaults).toMatchObject({
      backend: expect.any(String),
      limit: expect.any(Number),
      timeoutMinutes: expect.any(Number),
    })
  })

  it('starts with an empty projects array', () => {
    const cfg = buildInitialConfig('/my/dev')
    expect(Array.isArray(cfg.projects)).toBe(true)
    expect(cfg.projects).toHaveLength(0)
  })
})
