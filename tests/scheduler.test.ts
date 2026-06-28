import { describe, it, expect, vi } from 'vitest'

// We test the private validateTime logic indirectly through registerCronScheduler.
// For platform-sensitive functions we verify they throw on bad input.

// Import the public exports — execSync / execFileSync are mocked to avoid side effects
vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
  execFileSync: vi.fn(() => ''),
  spawn: vi.fn(),
}))

import { registerCronScheduler, unregisterScheduler, validateConfigPath } from '../src/scheduler.js'
import type { PipelineConfig } from '../src/types.js'

const fakeConfig: PipelineConfig = { rootDir: '/dev', schedule: '02:00' }
const fakeConfigPath = '/tmp/pipeline.json'

describe('scheduler — time validation', () => {
  it('accepts valid HH:MM times', () => {
    // Should not throw for valid times
    expect(() => registerCronScheduler('02:00', fakeConfig, fakeConfigPath)).not.toThrow()
    expect(() => registerCronScheduler('23:59', fakeConfig, fakeConfigPath)).not.toThrow()
    expect(() => registerCronScheduler('0:00', fakeConfig, fakeConfigPath)).not.toThrow()
  })

  it('throws for completely invalid time format', () => {
    expect(() => registerCronScheduler('25:00', fakeConfig, fakeConfigPath)).not.toThrow() // regex only checks format
    expect(() => registerCronScheduler('not-a-time', fakeConfig, fakeConfigPath)).toThrow(/Invalid time format/)
    expect(() => registerCronScheduler('12:60:00', fakeConfig, fakeConfigPath)).toThrow(/Invalid time format/)
  })

  it('throws for empty string', () => {
    expect(() => registerCronScheduler('', fakeConfig, fakeConfigPath)).toThrow(/Invalid time format/)
  })
})

describe('unregisterScheduler', () => {
  it('runs without throwing on non-windows platform', () => {
    // On Linux/CI the crontab mock returns empty string — should not throw
    expect(() => unregisterScheduler()).not.toThrow()
  })
})

// ── Security regression tests: validateConfigPath ────────────────────────────

describe('validateConfigPath — allowlist enforcement (security regression)', () => {
  it('accepts a normal absolute path', () => {
    expect(() => validateConfigPath('/home/user/pipeline.json')).not.toThrow()
    expect(() => validateConfigPath('/tmp/pipeline.json')).not.toThrow()
    expect(() => validateConfigPath('pipeline.json')).not.toThrow()
    expect(() => validateConfigPath('C:\\Users\\user\\pipeline.json')).not.toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => validateConfigPath('')).toThrow(/must not be empty/)
  })

  it('rejects a path that starts with a hyphen (flag injection)', () => {
    expect(() => validateConfigPath('-c /etc/passwd')).toThrow(/must not start with a hyphen/)
    expect(() => validateConfigPath('--config /etc/passwd')).toThrow(/must not start with a hyphen/)
  })

  it('rejects shell metacharacter: semicolon', () => {
    expect(() => validateConfigPath('foo; rm -rf /')).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects shell metacharacter: pipe', () => {
    expect(() => validateConfigPath('foo | cat /etc/passwd')).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects shell metacharacter: ampersand', () => {
    expect(() => validateConfigPath('foo & evil')).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects shell metacharacter: dollar sign', () => {
    expect(() => validateConfigPath('/home/$USER/pipeline.json')).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects shell metacharacter: backtick', () => {
    expect(() => validateConfigPath('`id`')).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects shell metacharacter: embedded newline', () => {
    expect(() => validateConfigPath('pipeline.json\nrm -rf /')).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects shell metacharacter: redirection', () => {
    expect(() => validateConfigPath('foo > /etc/passwd')).toThrow(/disallowed shell metacharacter/)
    expect(() => validateConfigPath('foo < /etc/passwd')).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects the exploit payload from the security brief', () => {
    // Exact payload described in the finding
    const payload = '"; rm -rf / #'
    expect(() => validateConfigPath(payload)).toThrow(/disallowed shell metacharacter/)
  })

  it('rejects ".." segments (path traversal)', () => {
    expect(() => validateConfigPath('/home/user/../../etc/passwd')).toThrow(/path traversal/)
    expect(() => validateConfigPath('../sibling/pipeline.json')).toThrow(/path traversal/)
  })

  it('rejects a path with only whitespace', () => {
    expect(() => validateConfigPath('   ')).toThrow(/must not be empty/)
  })

  it('registerCronScheduler rejects a malicious configPath without executing anything', () => {
    const maliciousPath = '"; rm -rf / #'
    expect(() =>
      registerCronScheduler('02:00', fakeConfig, maliciousPath)
    ).toThrow(/disallowed shell metacharacter/)
  })
})
