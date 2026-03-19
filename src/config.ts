import * as fs from 'fs'
import * as path from 'path'
import os from 'os'
import type { PipelineConfig, PipelineDefaults, ProjectOverride } from './types.js'

const CONFIG_LOCATIONS = [
  path.join(process.cwd(), 'pipeline.json'),
  path.join(os.homedir(), '.aahp-cron.json'),
]

export const DEFAULT_DEFAULTS: Required<PipelineDefaults> = {
  backend: 'auto',
  limit: 5,
  timeoutMinutes: 10,
  pauseBetweenProjects: 0,
}

export const DEFAULT_PROJECT_CONFIG: Required<Omit<ProjectOverride, 'name'>> = {
  enabled: true,
  priority: 99,
  backend: 'auto',
  limit: 5,
  timeoutMinutes: 10,
}

/** Find and load pipeline.json (or ~/.aahp-cron.json). Returns null if none found. */
export function loadConfig(explicitPath?: string): PipelineConfig | null {
  const candidates = explicitPath ? [explicitPath] : CONFIG_LOCATIONS
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as PipelineConfig
      } catch (e) {
        throw new Error(`Failed to parse config at ${p}: ${(e as Error).message}`, { cause: e })
      }
    }
  }
  return null
}

/** Write pipeline.json in cwd (used by `aahp-cron init`). */
export function saveConfig(config: PipelineConfig, outputPath?: string): void {
  const dest = outputPath ?? path.join(process.cwd(), 'pipeline.json')
  fs.writeFileSync(dest, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
}

/** Resolve effective defaults by merging config.defaults over built-in defaults. */
export function resolveDefaults(config: PipelineConfig): Required<PipelineDefaults> {
  return { ...DEFAULT_DEFAULTS, ...config.defaults }
}

/** Resolve per-project config by merging project override over resolved defaults. */
export function resolveProjectConfig(
  name: string,
  config: PipelineConfig,
  defaults: Required<PipelineDefaults>
): Required<Omit<ProjectOverride, 'name'>> {
  const override = config.projects?.find(p => p.name === name || p.name === path.basename(name))
  return {
    enabled: override?.enabled ?? true,
    priority: override?.priority ?? DEFAULT_PROJECT_CONFIG.priority,
    backend: override?.backend ?? defaults.backend,
    limit: override?.limit ?? defaults.limit,
    timeoutMinutes: override?.timeoutMinutes ?? defaults.timeoutMinutes,
  }
}

/** Try to auto-detect the aahp-runner CLI path. */
export function resolveRunnerPath(config: PipelineConfig): string {
  if (config.runnerPath && fs.existsSync(config.runnerPath)) return config.runnerPath

  // Common locations relative to rootDir
  const candidates = [
    path.join(config.rootDir, 'aahp-runner', 'dist', 'cli.js'),
    path.join(os.homedir(), 'Development', 'aahp-runner', 'dist', 'cli.js'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }

  // Fallback: assume globally installed `aahp-runner` on PATH
  return 'aahp-runner'
}

/** Generate a starter pipeline.json content for `aahp-cron init`. */
export function buildInitialConfig(rootDir: string): PipelineConfig {
  return {
    rootDir,
    schedule: '02:00',
    defaults: {
      backend: 'auto',
      limit: 5,
      timeoutMinutes: 10,
      pauseBetweenProjects: 0,
    },
    projects: [],
  }
}
