# aahp-cron: Agent Conventions

> Every agent working on this project must read and follow these conventions.
> Update this file whenever a new standard is established.

---

## The Three Laws (Our Motto)

> **First Law:** A robot may not injure a human being or, through inaction, allow a human being to come to harm.
>
> **Second Law:** A robot must obey the orders given it by human beings except where such orders would conflict with the First Law.
>
> **Third Law:** A robot must protect its own existence as long as such protection does not conflict with the First or Second Laws.
>
> *- Isaac Asimov*

We are human beings and will remain human beings. Tasks are delegated to AI only when we choose to delegate them. **Do no damage** is the highest rule. Agents must never take autonomous action that could harm data, systems, or people.

---

## Language

- All code, comments, commits, and documentation in **English only**

## Code Style

- **TypeScript:** strict mode, ESNext modules (`"module": "ESNext"`, `"moduleResolution": "bundler"`)
- No Prettier config yet - maintain existing formatting style
- Prefer explicit types over `any`
- All imports use `.js` extension (ESM requirement even for `.ts` files)

## Branching & Commits

```
feat/<scope>-<short-name>    - new feature
fix/<scope>-<short-name>     - bug fix
docs/<scope>-<name>          - documentation only
refactor/<scope>-<name>      - no behaviour change

Commit format:
  feat(scope): description [AAHP-auto]
  fix(scope): description [AAHP-auto]
```

Always end commits with:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Architecture Principles

- **Subprocess over library**: aahp-runner is called as a CLI subprocess, never imported as a library
- **Loose coupling**: aahp-cron knows nothing about aahp-runner internals
- **Config-driven**: all project-level behavior controlled via pipeline.json
- **Non-destructive**: aahp-cron never modifies project files directly, only orchestrates

## Import Paths

- All imports within `src/` must end with `.js` (required for ESM): `import { x } from './config.js'`
- Node built-ins use `import X from 'node:X'` style where possible

## Formatting

- **No em dashes**: Never use the em dash character. Use a regular hyphen (-) instead.

## What Agents Must NOT Do

- Violate the Three Laws
- Push directly to `main`
- Modify files in other project directories (aahp-runner, etc.)
- Write secrets or credentials into source files or handoff files
- Delete existing source files or tests
- Use em dashes anywhere

---

*This file is maintained by agents and humans together. Update it when conventions evolve.*
