/**
 * Runtime validation for pipeline.json config.
 *
 * Validates required fields, correct types, and valid cron-compatible schedule
 * expressions. Reports clear error messages for each violation found.
 */

import type { PipelineConfig, PipelineDefaults, ProjectOverride, Backend } from './types.js'

// ── Public API ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a pipeline config object. Returns a list of all errors found.
 * An empty errors array means the config is valid.
 */
export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = []

  if (!isObject(raw)) {
    return { valid: false, errors: ['Config must be a JSON object'] }
  }

  validateRootFields(raw, errors)
  validateDefaults(raw, errors)
  validateProjects(raw, errors)

  return { valid: errors.length === 0, errors }
}

/**
 * Validate a pipeline config and throw with a formatted message if invalid.
 * Use this at startup to fail fast on bad configs.
 */
export function assertValidConfig(raw: unknown, source = 'pipeline.json'): void {
  const result = validateConfig(raw)
  if (!result.valid) {
    const lines = result.errors.map(e => `  - ${e}`).join('\n')
    throw new Error(`Invalid config in ${source}:\n${lines}`)
  }
}

// ── Root field validators ────────────────────────────────────────────────────

const VALID_BACKENDS: Backend[] = ['auto', 'claude', 'copilot', 'sdk']

function validateRootFields(cfg: Record<string, unknown>, errors: string[]): void {
  // rootDir — required string
  if (!('rootDir' in cfg)) {
    errors.push('Missing required field: rootDir')
  } else if (typeof cfg['rootDir'] !== 'string' || cfg['rootDir'].trim() === '') {
    errors.push('rootDir must be a non-empty string')
  }

  // runnerPath — optional string
  if ('runnerPath' in cfg && typeof cfg['runnerPath'] !== 'string') {
    errors.push('runnerPath must be a string')
  }

  // schedule — optional HH:MM string
  if ('schedule' in cfg) {
    if (typeof cfg['schedule'] !== 'string') {
      errors.push('schedule must be a string in HH:MM format')
    } else if (!isValidHHMM(cfg['schedule'])) {
      errors.push(`schedule "${cfg['schedule']}" is not a valid HH:MM time (e.g. "02:00", "23:59")`)
    }
  }
}

// ── Defaults validator ───────────────────────────────────────────────────────

function validateDefaults(cfg: Record<string, unknown>, errors: string[]): void {
  if (!('defaults' in cfg)) return

  const d = cfg['defaults']
  if (!isObject(d)) {
    errors.push('defaults must be an object')
    return
  }

  if ('backend' in d && !VALID_BACKENDS.includes(d['backend'] as Backend)) {
    errors.push(`defaults.backend must be one of: ${VALID_BACKENDS.join(', ')}`)
  }

  if ('limit' in d) {
    if (typeof d['limit'] !== 'number' || !Number.isInteger(d['limit']) || d['limit'] < 1) {
      errors.push('defaults.limit must be a positive integer')
    }
  }

  if ('timeoutMinutes' in d) {
    if (typeof d['timeoutMinutes'] !== 'number' || !Number.isInteger(d['timeoutMinutes']) || d['timeoutMinutes'] < 1) {
      errors.push('defaults.timeoutMinutes must be a positive integer')
    }
  }

  if ('pauseBetweenProjects' in d) {
    if (typeof d['pauseBetweenProjects'] !== 'number' || d['pauseBetweenProjects'] < 0) {
      errors.push('defaults.pauseBetweenProjects must be a non-negative number')
    }
  }
}

// ── Projects validator ───────────────────────────────────────────────────────

function validateProjects(cfg: Record<string, unknown>, errors: string[]): void {
  if (!('projects' in cfg)) return

  if (!Array.isArray(cfg['projects'])) {
    errors.push('projects must be an array')
    return
  }

  const names = new Set<string>()

  for (let i = 0; i < cfg['projects'].length; i++) {
    const p = cfg['projects'][i]
    const prefix = `projects[${i}]`

    if (!isObject(p)) {
      errors.push(`${prefix} must be an object`)
      continue
    }

    validateProjectOverride(p, prefix, errors)

    // Duplicate name check
    const name = p['name'] as string
    if (typeof name === 'string') {
      if (names.has(name)) {
        errors.push(`${prefix}.name "${name}" is duplicated — project names must be unique`)
      }
      names.add(name)
    }
  }
}

function validateProjectOverride(
  p: Record<string, unknown>,
  prefix: string,
  errors: string[]
): void {
  // name — required string
  if (!('name' in p)) {
    errors.push(`${prefix} is missing required field: name`)
  } else if (typeof p['name'] !== 'string' || (p['name'] as string).trim() === '') {
    errors.push(`${prefix}.name must be a non-empty string`)
  }

  // enabled — optional boolean
  if ('enabled' in p && typeof p['enabled'] !== 'boolean') {
    errors.push(`${prefix}.enabled must be a boolean`)
  }

  // priority — optional positive integer
  if ('priority' in p) {
    if (typeof p['priority'] !== 'number' || !Number.isInteger(p['priority']) || p['priority'] < 0) {
      errors.push(`${prefix}.priority must be a non-negative integer`)
    }
  }

  // backend — optional enum
  if ('backend' in p && !VALID_BACKENDS.includes(p['backend'] as Backend)) {
    errors.push(`${prefix}.backend must be one of: ${VALID_BACKENDS.join(', ')}`)
  }

  // limit — optional positive integer
  if ('limit' in p) {
    if (typeof p['limit'] !== 'number' || !Number.isInteger(p['limit']) || p['limit'] < 1) {
      errors.push(`${prefix}.limit must be a positive integer`)
    }
  }

  // timeoutMinutes — optional positive integer
  if ('timeoutMinutes' in p) {
    if (typeof p['timeoutMinutes'] !== 'number' || !Number.isInteger(p['timeoutMinutes']) || p['timeoutMinutes'] < 1) {
      errors.push(`${prefix}.timeoutMinutes must be a positive integer`)
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * Validates HH:MM format. Hours 0-23, minutes 0-59.
 * Accepts both "2:00" and "02:00" formats.
 */
export function isValidHHMM(time: string): boolean {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return false
  const [h, m] = time.split(':').map(Number)
  return h! >= 0 && h! <= 23 && m! >= 0 && m! <= 59
}

// Re-export types for consumers who only import from validate.ts
export type { PipelineConfig, PipelineDefaults, ProjectOverride }
