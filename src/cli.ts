#!/usr/bin/env node
import { program } from 'commander'
import chalk from 'chalk'
import * as path from 'path'
import * as fs from 'fs'
import { loadConfig, saveConfig, buildInitialConfig, resolveRunnerPath } from './config.js'
import { discoverProjects } from './discovery.js'
import { runPipeline } from './pipeline.js'
import { registerScheduler, unregisterScheduler } from './scheduler.js'

const DEFAULT_CONFIG_LOCATIONS = ['pipeline.json', '~/.aahp-cron.json']

function requireConfig(explicitPath?: string) {
  const config = loadConfig(explicitPath)
  if (!config) {
    console.error(chalk.red('No pipeline.json found.'))
    console.error(chalk.gray(`  Looked in: ${DEFAULT_CONFIG_LOCATIONS.join(', ')}`))
    console.error(chalk.gray('  Run: aahp-cron init'))
    process.exit(1)
  }
  return config
}

// ── run ───────────────────────────────────────────────────────────────────────

program
  .command('run')
  .description('Run the full pipeline (or one/more specific projects)')
  .option('-c, --config <path>', 'Path to pipeline.json')
  .option('-p, --project <names>', 'Run only these projects (comma-separated for multiple, e.g. ai-red-team,ai-blue-team)')
  .option('--dry-run', 'Show what would run without spawning agents')
  .action(async (opts: { config?: string; project?: string; dryRun?: boolean }) => {
    const config = requireConfig(opts.config)
    const ac = new AbortController()
    process.on('SIGINT', () => { console.log('\nInterrupted.'); ac.abort() })
    const run = await runPipeline(config, { project: opts.project, dryRun: opts.dryRun, signal: ac.signal })
    process.exit(run.failed > 0 ? 1 : 0)
  })

// ── list ──────────────────────────────────────────────────────────────────────

program
  .command('list')
  .description('List all discovered projects and their status')
  .option('-c, --config <path>', 'Path to pipeline.json')
  .action((opts: { config?: string }) => {
    const config = requireConfig(opts.config)
    const projects = discoverProjects(config)

    console.log(chalk.bold(`\nDiscovered projects in ${config.rootDir}\n`))
    if (projects.length === 0) {
      console.log(chalk.gray('  No projects with .ai/handoff/MANIFEST.json found.'))
      return
    }

    for (const p of projects) {
      const enabledStr = p.config.enabled ? '' : chalk.red(' [disabled]')
      const tasksStr = chalk.gray(`ready:${p.readyTaskCount} active:${p.activeTaskCount}`)
      const backendStr = chalk.gray(`backend=${p.config.backend} limit=${p.config.limit}`)
      console.log(`  ${chalk.cyan(p.name.padEnd(35))} ${tasksStr}  ${backendStr}${enabledStr}`)
    }
    console.log()
  })

// ── status ────────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show all projects and their current task status (delegates to aahp list)')
  .option('-c, --config <path>', 'Path to pipeline.json')
  .action((opts: { config?: string }) => {
    const config = requireConfig(opts.config)
    const { spawnSync } = require('child_process')
    const runnerPath = resolveRunnerPath(config)
    const isJs = runnerPath.endsWith('.js')
    const cmd = isJs ? process.execPath : runnerPath
    const args = [...(isJs ? [runnerPath] : []), 'list', '--all', '--root', config.rootDir]
    spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env } })
  })

// ── config ────────────────────────────────────────────────────────────────────

program
  .command('config')
  .description('Print the resolved pipeline config')
  .option('-c, --config <path>', 'Path to pipeline.json')
  .action((opts: { config?: string }) => {
    const config = requireConfig(opts.config)
    const runnerPath = resolveRunnerPath(config)
    console.log(chalk.bold('\nResolved pipeline config\n'))
    console.log(`  rootDir    : ${config.rootDir}`)
    console.log(`  runnerPath : ${runnerPath}`)
    console.log(`  schedule   : ${config.schedule ?? '(not set)'}`)
    console.log(`  defaults   : ${JSON.stringify(config.defaults ?? {})}`)
    console.log(`  projects   : ${(config.projects ?? []).length} override(s)`)
    console.log()
  })

// ── init ──────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Create a pipeline.json in the current directory')
  .option('-r, --root <path>', 'Root development directory')
  .action((opts: { root?: string }) => {
    const dest = path.join(process.cwd(), 'pipeline.json')
    if (fs.existsSync(dest)) {
      console.log(chalk.yellow('pipeline.json already exists. Edit it directly.'))
      return
    }
    const rootDir = opts.root ?? process.cwd()
    const config = buildInitialConfig(rootDir)
    saveConfig(config, dest)
    console.log(chalk.green(`Created pipeline.json`))
    console.log(chalk.gray(`  Edit ${dest} to configure your projects.`))
    console.log(chalk.gray('  Then run: aahp-cron list'))
  })

// ── schedule ──────────────────────────────────────────────────────────────────

const schedule = program
  .command('schedule')
  .description('Manage scheduled pipeline runs')

schedule
  .command('set <time>')
  .description('Register a daily schedule at HH:MM (e.g. aahp-cron schedule set 02:00)')
  .option('-c, --config <path>', 'Path to pipeline.json')
  .action((time: string, opts: { config?: string }) => {
    const config = requireConfig(opts.config)
    const configPath = opts.config ?? path.join(process.cwd(), 'pipeline.json')
    try {
      registerScheduler(time, config, configPath)
    } catch (e) {
      console.error(chalk.red(`Failed to register schedule: ${(e as Error).message}`))
      process.exit(1)
    }
  })

schedule
  .command('remove')
  .description('Remove the scheduled aahp-cron task')
  .action(() => {
    unregisterScheduler()
  })

// ── entry ─────────────────────────────────────────────────────────────────────

program.name('aahp-cron').description('AAHP pipeline orchestrator').version('0.1.0')
program.parse()
