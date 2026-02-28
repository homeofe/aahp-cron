// Shared types for aahp-cron pipeline orchestrator

export type Backend = 'auto' | 'claude' | 'copilot' | 'sdk'

/** Per-project override in pipeline.json */
export interface ProjectOverride {
  /** Directory name under rootDir (or absolute path) */
  name: string
  /** Set false to skip this project entirely */
  enabled?: boolean
  /** Lower number = higher priority in run order */
  priority?: number
  /** Override default backend for this project */
  backend?: Backend
  /** Max concurrent agents for this project */
  limit?: number
  /** Per-agent timeout in minutes */
  timeoutMinutes?: number
}

/** Default settings applied to all projects unless overridden */
export interface PipelineDefaults {
  backend?: Backend
  /** Max agents per project run */
  limit?: number
  /** Per-agent timeout in minutes */
  timeoutMinutes?: number
  /** Seconds to wait between project runs (0 = no pause) */
  pauseBetweenProjects?: number
}

/** Top-level pipeline.json shape */
export interface PipelineConfig {
  /** Absolute path to root development directory */
  rootDir: string
  /** Path to aahp-runner CLI (dist/cli.js). Auto-detected if omitted. */
  runnerPath?: string
  /** Scheduled run time in HH:MM format (used by `aahp-cron schedule set`) */
  schedule?: string
  defaults?: PipelineDefaults
  /** Per-project overrides. Projects not listed are included with defaults. */
  projects?: ProjectOverride[]
}

/** A project discovered on disk (has .ai/handoff/MANIFEST.json) */
export interface DiscoveredProject {
  name: string
  repoPath: string
  readyTaskCount: number
  activeTaskCount: number
  /** Merged config: discovery + any override from pipeline.json */
  config: Required<Omit<ProjectOverride, 'name'>>
}

/** Result of running aahp-runner on a single project */
export interface RunResult {
  projectName: string
  repoPath: string
  success: boolean
  exitCode: number
  durationMs: number
  /** Last lines of agent output (trimmed) */
  summary: string
  error?: string
}

/** Summary of a full pipeline run */
export interface PipelineRun {
  startedAt: string
  finishedAt: string
  totalProjects: number
  ran: number
  succeeded: number
  failed: number
  skipped: number
  results: RunResult[]
}
