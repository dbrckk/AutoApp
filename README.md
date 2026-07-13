# AutoApp

AutoApp is an autonomous product-building workspace. It generates application projects, stores long-running jobs, improves them in repeated steps, scores quality, inspects files, creates release reports and exports code to GitHub or ZIP.

The current architecture is a React/Vite frontend backed by a Cloudflare Worker, Hono, D1 and a scheduled job loop.

## Current capabilities

### Autonomous project execution

- Create persistent autonomous jobs from a product prompt.
- Start new autonomous work without blocking the HTTP request on the first AI cycle.
- Run a single step manually or continue work through the scheduled Worker trigger.
- Resume, improve and delete projects.
- Track phase, strategy, score, attempts, logs and next scheduled execution.
- Support finite jobs and continuous `auto improve forever` jobs.
- Schedule only due jobs: paused jobs and completed finite jobs do not consume cron capacity.
- Claim scheduled and manual work with short D1 execution leases to reduce duplicate processing.

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
- Job logs with backend timestamps.
- Runtime status banner and action notifications.
- Error boundary for render recovery.
- Local crash/reload session recovery.
- Visibility-aware polling that pauses while the page is hidden and refreshes on return.
- Local persistence for prompt, GitHub target and active workspace tab.

### Intelligence and integration

- Company Brain analysis.
- Live Workspace snapshots.
- AI providers: Gemini, Groq and OpenAI-compatible endpoints.
- GitHub access test, write test, export and history.
- GitHub repository owner restriction for privileged Worker operations.
- ZIP export.
- Cloudflare D1 persistence.
- Runtime D1 schema alignment for jobs and project memory.

### Validation

GitHub Actions validates every branch and pull request with:

- frontend TypeScript
- frontend production build
- API TypeScript

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

Runtime schema checks ensure:

- `jobs`
- `project_memory`
- required columns
- job scheduling indexes
- project memory indexes

The static schema remains in `apps/api/schema.sql`.

## Security status

Privileged GitHub operations are restricted to repositories owned by `dbrckk`. Full application-level authentication remains a future hardening step if the API is ever shared with other users or exposed as a multi-tenant service.

Do not put AI keys or GitHub tokens in the frontend bundle or commit them to the repository.

## Current engineering priorities

1. Add full authenticated API access before any multi-user or multi-tenant use.
2. Add reproducible dependency locking instead of `latest` dependency ranges.
3. Add a real isolated build/preview runner instead of relying only on virtual checks.
4. Add durable server-side event history instead of mixing local activity with job logs.
5. Add explicit deployment execution and deployment health monitoring.
6. Add product-level automated tests for the autonomous job lifecycle.
7. Continue consolidating dormant advanced panels into the mobile-first workspace.

## Product direction

AutoApp should be judged as an autonomous product operating system, not only as a prompt-to-code generator. The target is a closed loop:

```text
Goal -> Plan -> Build -> Inspect -> Score -> Repair -> Validate -> Publish -> Observe -> Improve
```

The repository now implements most of this loop. The remaining work is focused on stronger authentication, reproducible installs, real isolated builds, durable observability and deployment automation.
