import { describe, it, expect } from 'vitest'
import { validateConfig, assertValidConfig, isValidHHMM } from '../src/validate.js'

// ── isValidHHMM ──────────────────────────────────────────────────────────────

describe('isValidHHMM', () => {
  it('accepts zero-padded valid times', () => {
    expect(isValidHHMM('00:00')).toBe(true)
    expect(isValidHHMM('02:00')).toBe(true)
    expect(isValidHHMM('23:59')).toBe(true)
  })

  it('accepts single-digit hour', () => {
    expect(isValidHHMM('0:00')).toBe(true)
    expect(isValidHHMM('9:30')).toBe(true)
  })

  it('rejects out-of-range hours', () => {
    expect(isValidHHMM('24:00')).toBe(false)
    expect(isValidHHMM('25:00')).toBe(false)
  })

  it('rejects out-of-range minutes', () => {
    expect(isValidHHMM('12:60')).toBe(false)
    expect(isValidHHMM('12:99')).toBe(false)
  })

  it('rejects non-time strings', () => {
    expect(isValidHHMM('not-a-time')).toBe(false)
    expect(isValidHHMM('')).toBe(false)
    expect(isValidHHMM('12:60:00')).toBe(false)
    expect(isValidHHMM('1200')).toBe(false)
  })
})

// ── validateConfig — non-object input ────────────────────────────────────────

describe('validateConfig — non-object input', () => {
  it('fails for null', () => {
    const r = validateConfig(null)
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('Config must be a JSON object')
  })

  it('fails for array', () => {
    const r = validateConfig([])
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('Config must be a JSON object')
  })

  it('fails for string', () => {
    const r = validateConfig('{"rootDir":"/dev"}')
    expect(r.valid).toBe(false)
  })
})

// ── validateConfig — rootDir ──────────────────────────────────────────────────

describe('validateConfig — rootDir', () => {
  it('fails when rootDir is missing', () => {
    const r = validateConfig({})
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('rootDir'))).toBe(true)
  })

  it('fails when rootDir is empty string', () => {
    const r = validateConfig({ rootDir: '' })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('rootDir'))).toBe(true)
  })

  it('fails when rootDir is not a string', () => {
    const r = validateConfig({ rootDir: 42 })
    expect(r.valid).toBe(false)
  })

  it('passes with a valid rootDir', () => {
    const r = validateConfig({ rootDir: '/dev/projects' })
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })
})

// ── validateConfig — schedule ─────────────────────────────────────────────────

describe('validateConfig — schedule', () => {
  it('passes with valid HH:MM schedule', () => {
    const r = validateConfig({ rootDir: '/dev', schedule: '02:00' })
    expect(r.valid).toBe(true)
  })

  it('fails with invalid schedule format', () => {
    const r = validateConfig({ rootDir: '/dev', schedule: 'not-a-time' })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('schedule'))).toBe(true)
  })

  it('fails with out-of-range schedule', () => {
    const r = validateConfig({ rootDir: '/dev', schedule: '25:00' })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('schedule'))).toBe(true)
  })

  it('fails when schedule is not a string', () => {
    const r = validateConfig({ rootDir: '/dev', schedule: 200 })
    expect(r.valid).toBe(false)
  })

  it('is optional — config is valid without it', () => {
    const r = validateConfig({ rootDir: '/dev' })
    expect(r.valid).toBe(true)
  })
})

// ── validateConfig — runnerPath ───────────────────────────────────────────────

describe('validateConfig — runnerPath', () => {
  it('passes with a string runnerPath', () => {
    const r = validateConfig({ rootDir: '/dev', runnerPath: '/usr/bin/aahp-runner' })
    expect(r.valid).toBe(true)
  })

  it('fails when runnerPath is not a string', () => {
    const r = validateConfig({ rootDir: '/dev', runnerPath: true })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('runnerPath'))).toBe(true)
  })
})

// ── validateConfig — defaults ─────────────────────────────────────────────────

describe('validateConfig — defaults', () => {
  it('passes with valid defaults', () => {
    const r = validateConfig({
      rootDir: '/dev',
      defaults: { backend: 'claude', limit: 3, timeoutMinutes: 15, pauseBetweenProjects: 5 },
    })
    expect(r.valid).toBe(true)
  })

  it('fails when defaults is not an object', () => {
    const r = validateConfig({ rootDir: '/dev', defaults: 'invalid' })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('defaults'))).toBe(true)
  })

  it('fails with invalid backend', () => {
    const r = validateConfig({ rootDir: '/dev', defaults: { backend: 'gpt4' } })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('backend'))).toBe(true)
  })

  it('fails with non-integer limit', () => {
    const r = validateConfig({ rootDir: '/dev', defaults: { limit: 2.5 } })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('limit'))).toBe(true)
  })

  it('fails with zero limit', () => {
    const r = validateConfig({ rootDir: '/dev', defaults: { limit: 0 } })
    expect(r.valid).toBe(false)
  })

  it('fails with negative pauseBetweenProjects', () => {
    const r = validateConfig({ rootDir: '/dev', defaults: { pauseBetweenProjects: -1 } })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('pauseBetweenProjects'))).toBe(true)
  })

  it('passes when defaults is empty object', () => {
    const r = validateConfig({ rootDir: '/dev', defaults: {} })
    expect(r.valid).toBe(true)
  })

  it('accepts all four valid backends', () => {
    for (const backend of ['auto', 'claude', 'copilot', 'sdk']) {
      const r = validateConfig({ rootDir: '/dev', defaults: { backend } })
      expect(r.valid).toBe(true)
    }
  })
})

// ── validateConfig — projects ─────────────────────────────────────────────────

describe('validateConfig — projects', () => {
  it('passes with a valid project list', () => {
    const r = validateConfig({
      rootDir: '/dev',
      projects: [
        { name: 'my-repo', priority: 1, backend: 'claude', limit: 2, timeoutMinutes: 5 },
        { name: 'other-repo', enabled: false },
      ],
    })
    expect(r.valid).toBe(true)
  })

  it('fails when projects is not an array', () => {
    const r = validateConfig({ rootDir: '/dev', projects: {} })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('projects'))).toBe(true)
  })

  it('fails when a project is not an object', () => {
    const r = validateConfig({ rootDir: '/dev', projects: ['not-an-object'] })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('projects[0]'))).toBe(true)
  })

  it('fails when project name is missing', () => {
    const r = validateConfig({ rootDir: '/dev', projects: [{ priority: 1 }] })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('name'))).toBe(true)
  })

  it('fails when project name is empty string', () => {
    const r = validateConfig({ rootDir: '/dev', projects: [{ name: '' }] })
    expect(r.valid).toBe(false)
  })

  it('fails with duplicate project names', () => {
    const r = validateConfig({
      rootDir: '/dev',
      projects: [{ name: 'same' }, { name: 'same' }],
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('duplicated'))).toBe(true)
  })

  it('fails with invalid project backend', () => {
    const r = validateConfig({ rootDir: '/dev', projects: [{ name: 'p', backend: 'gpt' }] })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('backend'))).toBe(true)
  })

  it('fails with negative project priority', () => {
    const r = validateConfig({ rootDir: '/dev', projects: [{ name: 'p', priority: -1 }] })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('priority'))).toBe(true)
  })

  it('fails with non-boolean enabled', () => {
    const r = validateConfig({ rootDir: '/dev', projects: [{ name: 'p', enabled: 'yes' }] })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('enabled'))).toBe(true)
  })

  it('passes with an empty projects array', () => {
    const r = validateConfig({ rootDir: '/dev', projects: [] })
    expect(r.valid).toBe(true)
  })

  it('reports errors for multiple invalid projects with correct indices', () => {
    const r = validateConfig({
      rootDir: '/dev',
      projects: [
        { name: 'valid-proj' },
        { priority: 1 }, // missing name
        { name: 'p2', limit: 0 }, // bad limit
      ],
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('projects[1]'))).toBe(true)
    expect(r.errors.some(e => e.includes('projects[2]'))).toBe(true)
  })
})

// ── assertValidConfig ─────────────────────────────────────────────────────────

describe('assertValidConfig', () => {
  it('does not throw for a valid config', () => {
    expect(() => assertValidConfig({ rootDir: '/dev', schedule: '03:00' })).not.toThrow()
  })

  it('throws with formatted message listing all errors', () => {
    expect(() => assertValidConfig({})).toThrow(/Invalid config/)
    expect(() => assertValidConfig({})).toThrow(/rootDir/)
  })

  it('includes the source name in the error message', () => {
    try {
      assertValidConfig({}, 'my-pipeline.json')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as Error).message).toContain('my-pipeline.json')
    }
  })

  it('throws for null input', () => {
    expect(() => assertValidConfig(null)).toThrow(/Invalid config/)
  })
})
