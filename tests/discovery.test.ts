import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { discoverProjects } from '../src/discovery.js'
import type { PipelineConfig } from '../src/types.js'

let tmpDir: string

/** Helper: create a fake AAHP project directory with a MANIFEST.json. */
function createFakeProject(
  root: string,
  name: string,
  tasks: Record<string, { status: string }> = {}
): string {
  const repoPath = path.join(root, name)
  const handoffDir = path.join(repoPath, '.ai', 'handoff')
  fs.mkdirSync(handoffDir, { recursive: true })
  fs.writeFileSync(path.join(handoffDir, 'MANIFEST.json'), JSON.stringify({ tasks }))
  return repoPath
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aahp-disc-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const baseConfig = (rootDir: string, extra: Partial<PipelineConfig> = {}): PipelineConfig => ({
  rootDir,
  ...extra,
})

describe('discoverProjects', () => {
  it('returns empty array when rootDir does not exist', () => {
    const result = discoverProjects(baseConfig('/nonexistent/path'))
    expect(result).toEqual([])
  })

  it('returns empty array when no projects have MANIFEST.json', () => {
    fs.mkdirSync(path.join(tmpDir, 'some-dir'), { recursive: true })
    const result = discoverProjects(baseConfig(tmpDir))
    expect(result).toEqual([])
  })

  it('discovers a single project with a MANIFEST.json', () => {
    createFakeProject(tmpDir, 'my-project')
    const result = discoverProjects(baseConfig(tmpDir))
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('my-project')
  })

  it('discovers multiple projects', () => {
    createFakeProject(tmpDir, 'proj-a')
    createFakeProject(tmpDir, 'proj-b')
    fs.mkdirSync(path.join(tmpDir, 'no-manifest-dir'))
    const result = discoverProjects(baseConfig(tmpDir))
    const names = result.map(p => p.name)
    expect(names).toContain('proj-a')
    expect(names).toContain('proj-b')
    expect(result).toHaveLength(2)
  })

  it('counts task statuses correctly', () => {
    createFakeProject(tmpDir, 'counted', {
      't1': { status: 'ready' },
      't2': { status: 'ready' },
      't3': { status: 'in_progress' },
      't4': { status: 'blocked' },
      't5': { status: 'done' },
      't6': { status: 'completed' },
    })
    const result = discoverProjects(baseConfig(tmpDir))
    const proj = result[0]!
    expect(proj.readyTaskCount).toBe(2)
    expect(proj.activeTaskCount).toBe(1)
    expect(proj.blockedTaskCount).toBe(1)
    expect(proj.doneTaskCount).toBe(2)
  })

  it('handles MANIFEST.json with no tasks key gracefully', () => {
    const repoPath = path.join(tmpDir, 'empty-manifest')
    const handoffDir = path.join(repoPath, '.ai', 'handoff')
    fs.mkdirSync(handoffDir, { recursive: true })
    fs.writeFileSync(path.join(handoffDir, 'MANIFEST.json'), JSON.stringify({}))
    const result = discoverProjects(baseConfig(tmpDir))
    const proj = result[0]!
    expect(proj.readyTaskCount).toBe(0)
    expect(proj.activeTaskCount).toBe(0)
  })

  it('handles corrupt MANIFEST.json without throwing', () => {
    const repoPath = path.join(tmpDir, 'corrupt')
    const handoffDir = path.join(repoPath, '.ai', 'handoff')
    fs.mkdirSync(handoffDir, { recursive: true })
    fs.writeFileSync(path.join(handoffDir, 'MANIFEST.json'), '{ invalid json !')
    expect(() => discoverProjects(baseConfig(tmpDir))).not.toThrow()
  })

  it('applies pipeline.json project overrides (enabled: false)', () => {
    createFakeProject(tmpDir, 'disabled-proj')
    const cfg = baseConfig(tmpDir, { projects: [{ name: 'disabled-proj', enabled: false }] })
    const result = discoverProjects(cfg)
    expect(result[0]!.config.enabled).toBe(false)
  })

  it('sorts disabled projects after enabled ones', () => {
    createFakeProject(tmpDir, 'alpha')
    createFakeProject(tmpDir, 'beta')
    const cfg = baseConfig(tmpDir, { projects: [{ name: 'alpha', enabled: false }] })
    const result = discoverProjects(cfg)
    // beta (enabled) should come before alpha (disabled)
    expect(result[0]!.name).toBe('beta')
    expect(result[result.length - 1]!.name).toBe('alpha')
  })

  it('sorts by priority ascending among enabled projects', () => {
    createFakeProject(tmpDir, 'low-prio')
    createFakeProject(tmpDir, 'high-prio')
    const cfg = baseConfig(tmpDir, {
      projects: [
        { name: 'low-prio', priority: 10 },
        { name: 'high-prio', priority: 1 },
      ],
    })
    const result = discoverProjects(cfg).filter(p => p.config.enabled)
    expect(result[0]!.name).toBe('high-prio')
  })

  it('populates repoPath correctly', () => {
    createFakeProject(tmpDir, 'my-repo')
    const result = discoverProjects(baseConfig(tmpDir))
    expect(result[0]!.repoPath).toBe(path.join(tmpDir, 'my-repo'))
  })
})
