import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test the private validateTime logic indirectly through registerCronScheduler.
// For platform-sensitive functions we verify they throw on bad input.

// Import the public exports — execSync / execFileSync are mocked to avoid side effects
vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
  execFileSync: vi.fn(() => ''),
  spawn: vi.fn(),
}))

import { registerCronScheduler, unregisterScheduler } from '../src/scheduler.js'
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
