# WS12 App

Learner app for **Winning Strategies for Grade 12** (Wenner Strategieë vir Graad 12) by Melvin Monroe Tobias.

## How this repo is run

The app is built in weekly sprints by an agent team defined in `.claude/agents/`, led by `ws12-product-lead` and checked by `ws12-qa`. Progress lives in `SPRINTS.md`.

- Rules for all agents: `CLAUDE.md`
- What we are building: `docs/build-brief.md`, `docs/build-plan.md`, `docs/product-bible.md` (Sprint 0)
- Decisions: `docs/decisions.md`

To run a sprint manually in Claude Code, open this repo and say: "Use ws12-product-lead to run the current sprint."

## Run it locally

Needs Node.js 22.

```bash
npm install
npm run dev
```

The app runs in demo mode (sample learner Thabo Mokoena) with no Supabase project. To connect a Supabase project later, copy `.env.example` to `.env.local` and fill in the project URL and publishable (anon) key. Never put a service role key, payment secret or AI key in a `VITE_` variable.

## Checks

| Command                | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run build`        | Type check and production build                                     |
| `npm run lint`         | ESLint, including folder boundary rules, with zero warnings allowed |
| `npm run typecheck`    | TypeScript for the app, the config and the database tests           |
| `npm test`             | App tests and database tests (RLS and consent rules in PGlite)      |
| `npm run format:check` | Prettier                                                            |
| `npm run copy:check`   | Copy rules: no ampersands, no em or en dashes                       |

CI runs all of these on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

## Folders

| Folder                | Holds                                                         |
| --------------------- | ------------------------------------------------------------- |
| `src/app`             | Router, app shell and navigation config                       |
| `src/ui`              | Reusable presentational components                            |
| `src/features`        | One folder per screen or feature                              |
| `src/domain`          | Pure TypeScript business logic (no React, no Supabase)        |
| `src/data`            | Supabase client, repositories and data hooks                  |
| `src/ai`              | Client for the AI gateway edge function (no model keys)       |
| `src/auth`            | Session and demo mode state                                   |
| `src/i18n`            | English and Afrikaans strings                                 |
| `src/demo`            | Demo learner data, clearly labelled                           |
| `supabase/migrations` | Schema and Row Level Security                                 |
| `supabase/tests`      | Database tests run in PGlite with a stub of the Supabase auth |
| `supabase/seed.sql`   | Reference lists and the demo learner, flagged `is_demo`       |
