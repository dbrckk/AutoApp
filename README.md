# AutoApp

AutoApp is an autonomous product-building workspace. It generates application projects, stores long-running jobs, improves them in repeated steps, scores quality, inspects files, creates release reports and exports code to GitHub or ZIP.

The current architecture is a React/Vite frontend backed by a Cloudflare Worker, Hono, D1 and a scheduled job loop.

## Current capabilities

### Autonomous project execution

- Create persistent autonomous jobs from a product prompt.
- Run a single step manually or continue work through the scheduled Worker trigger.
- Resume, improve and delete projects.
- Track phase, strategy, score, attempts, logs and next scheduled execution.
- Support finite jobs and continuous `auto improve forever` jobs.

### Product quality system

- Pipeline planning.
- Quality scoring by buildability, structure, UI/UX, mobile behavior, resilience and product depth.
- Blocker detection for missing entry files, invalid `package.json`, duplicate paths and broken relative imports.
- Autofix workflow.
- Project report and publish-readiness checks.
- Frontend preflight before export or release.

### Workspace

- Multi-project dashboard.
- Functional project filters: All, Running, Done and Attention.
- File explorer and editor.
- Job logs and monitoring.
- Runtime status banner and action notifications.
- Error boundary for render recovery.
- Local persistence for prompt, GitHub target and active workspace tab.

### Intelligence and integration

- Company Brain analysis.
- Live Workspace snapshots.
- AI providers: Gemini, Groq and OpenAI-compatible endpoints.
- GitHub access test, write test, export and history.
- ZIP export.
- Cloudflare D1 persistence.

## Architecture

```text
Browser
  React + TypeScript + Vite
          |
          v
Cloudflare Worker API
  Hono routes
  AI provider router
  autonomous job engine
  quality pipeline
  GitHub integration
          |
          +--> D1: jobs and project memory
          |
          +--> Cron: every 5 minutes
```

### Frontend

```text
src/
  App.tsx
  components/
  hooks/useAutoApp.ts
  lib/api.ts
```

### API

```text
apps/api/
  src/worker.ts
  src/routes/
  src/core/
  schema.sql
  wrangler.toml
```

## Local development

Requirements:

- Node.js 20+
- npm
- Cloudflare account for Worker/D1 deployment
- At least one AI provider key for generation

### Frontend

```bash
npm install
npm run typecheck
npm run dev
```

Production build:

```bash
npm run build
```

### Worker API

```bash
cd apps/api
npm install
npm run typecheck
npm run dev
```

Deploy:

```bash
npm run deploy
```

## Cloudflare configuration

The Worker is configured as `autoapp-api` and binds D1 as `DB`. The scheduled trigger runs every five minutes.

Set AI secrets with Wrangler rather than committing them:

```bash
cd apps/api
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GITHUB_TOKEN
```

Only the keys for providers you actually use are required.

## D1 schema

The repository contains `apps/api/schema.sql` for:

- `jobs`
- `project_memory`
- job and memory indexes

Apply schema changes deliberately to the configured D1 database before relying on new persistence features.

## Security status

The current Worker accepts cross-origin requests and does not yet enforce application-level authentication. A Worker that contains a privileged `GITHUB_TOKEN` must therefore be treated as private infrastructure until API authentication and repository restrictions are added.

Do not put AI keys or GitHub tokens in the frontend bundle or commit them to the repository.

## Current engineering priorities

1. Add authenticated API access before broad public exposure.
2. Align runtime D1 auto-migration with the full static schema.
3. Add job leases so cron and manual execution cannot process the same job concurrently.
4. Exclude completed finite jobs from the scheduler queue.
5. Add reproducible dependency locking and automated frontend/API CI.
6. Enable the existing frontend session snapshot recovery path.
7. Add a real isolated build/preview runner instead of relying only on virtual checks.

## Product direction

AutoApp should be judged as an autonomous product operating system, not only as a prompt-to-code generator. The target is a closed loop:

```text
Goal -> Plan -> Build -> Inspect -> Score -> Repair -> Validate -> Publish -> Observe -> Improve
```

The repository already contains most of these layers. The remaining work is primarily production hardening: security, concurrency control, schema consistency, reproducible builds and verified deployment execution.
