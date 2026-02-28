import * as fs from 'fs'
import * as path from 'path'
import type { PipelineConfig, DiscoveredProject } from './types.js'
import { resolveDefaults, resolveProjectConfig } from './config.js'

const MANIFEST_REL = path.join('.ai', 'handoff', 'MANIFEST.json')

interface ManifestSnippet {
  tasks?: Record<string, { status: string }>
}

function countTasks(repoPath: string): { ready: number; active: number } {
  try {
    const raw = fs.readFileSync(path.join(repoPath, MANIFEST_REL), 'utf8')
    const m = JSON.parse(raw) as ManifestSnippet
    const tasks = Object.values(m.tasks ?? {})
    return {
      ready: tasks.filter(t => t.status === 'ready').length,
      active: tasks.filter(t => t.status === 'in_progress').length,
    }
  } catch {
    return { ready: 0, active: 0 }
  }
}

/** Scan rootDir for subdirectories that have .ai/handoff/MANIFEST.json.
 *  Merges each with overrides from pipeline.json if present. */
export function discoverProjects(config: PipelineConfig): DiscoveredProject[] {
  const defaults = resolveDefaults(config)
  let entries: fs.Dirent[]

  try {
    entries = fs.readdirSync(config.rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  const projects: DiscoveredProject[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const repoPath = path.join(config.rootDir, entry.name)
    const manifestPath = path.join(repoPath, MANIFEST_REL)
    if (!fs.existsSync(manifestPath)) continue

    const projConfig = resolveProjectConfig(entry.name, config, defaults)
    const { ready, active } = countTasks(repoPath)

    projects.push({
      name: entry.name,
      repoPath,
      readyTaskCount: ready,
      activeTaskCount: active,
      config: projConfig,
    })
  }

  // Also include any pipeline.json project entries that reference absolute paths
  // or names not yet auto-discovered (useful for repos outside rootDir)
  for (const override of config.projects ?? []) {
    const isAbsolute = path.isAbsolute(override.name)
    if (!isAbsolute) continue
    if (projects.some(p => p.repoPath === override.name)) continue

    const manifestPath = path.join(override.name, MANIFEST_REL)
    if (!fs.existsSync(manifestPath)) continue

    const projConfig = resolveProjectConfig(override.name, config, defaults)
    const { ready, active } = countTasks(override.name)

    projects.push({
      name: path.basename(override.name),
      repoPath: override.name,
      readyTaskCount: ready,
      activeTaskCount: active,
      config: projConfig,
    })
  }

  // Sort: disabled last, then by priority asc, then by active+ready desc
  return projects.sort((a, b) => {
    if (a.config.enabled !== b.config.enabled) return a.config.enabled ? -1 : 1
    if (a.config.priority !== b.config.priority) return a.config.priority - b.config.priority
    const aScore = a.activeTaskCount * 10 + a.readyTaskCount
    const bScore = b.activeTaskCount * 10 + b.readyTaskCount
    return bScore - aScore
  })
}
