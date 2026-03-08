#!/usr/bin/env node
import { program } from 'commander'
import chalk from 'chalk'
import * as path from 'path'
import os from 'os'
import * as fs from 'fs'
import { spawnSync } from 'node:child_process'
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
      const blockedStr = p.blockedTaskCount > 0 ? chalk.yellow(` blocked:${p.blockedTaskCount}`) : ''
      const doneStr   = p.doneTaskCount   > 0 ? chalk.green(` done:${p.doneTaskCount}`)         : ''
      const tasksStr = chalk.gray(`ready:${p.readyTaskCount} active:${p.activeTaskCount}`) + blockedStr + doneStr
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
  .description('Create ~/.aahp-cron.json (global config, works from any directory)')
  .option('-r, --root <path>', 'Workspace root directory containing your projects (required)')
  .option('--local', 'Write pipeline.json in current directory instead of ~/.aahp-cron.json')
  .action((opts: { root?: string; local?: boolean }) => {
    const homeConfig = path.join(os.homedir(), '.aahp-cron.json')
    const localConfig = path.join(process.cwd(), 'pipeline.json')
    const dest = opts.local ? localConfig : homeConfig

    if (fs.existsSync(dest)) {
      console.log(chalk.yellow(`Config already exists at ${dest}. Edit it directly.`))
      console.log(chalk.gray(`  Or delete it and re-run: aahp-cron init --root <path>`))
      return
    }

    if (!opts.root) {
      console.error(chalk.red('Error: --root <path> is required.'))
      console.error(chalk.gray('  Example: aahp-cron init --root ~/workspace'))
      console.error(chalk.gray('  The root should be the directory containing all your projects.'))
      process.exit(1)
    }

    const rootDir = path.resolve(opts.root.replace(/^~/, os.homedir()))
    if (!fs.existsSync(rootDir)) {
      console.error(chalk.red(`Error: root directory does not exist: ${rootDir}`))
      process.exit(1)
    }

    const config = buildInitialConfig(rootDir)
    saveConfig(config, dest)
    console.log(chalk.green(`Created ${dest}`))
    console.log(chalk.gray(`  rootDir: ${rootDir}`))
    console.log(chalk.gray('  Run: aahp-cron list'))
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

program.name('aahp-cron').description('AAHP pipeline orchestrator').version('0.1.1')
program.parse()
