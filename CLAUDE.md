# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Convex Component** — a reusable backend package that implements an affiliate marketing system. Published to npm as `convex-affiliates`. See `.examples/` for reference implementations of other Convex components (better-auth, stripe, rate-limiter, etc.).

## Development Commands

```bash
# Install and run development (backend + frontend + build watcher)
npm i
npm run dev

# Run tests
npm run test              # Single run with typechecking
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report

# Code quality
npm run lint              # ESLint
npm run typecheck         # TypeScript checks (root + example + example/convex)

# Build
npm run build             # Clean + tsc (no codegen, used in CI)
npm run build:codegen     # Generate types + build (use after schema changes)
npm run build:clean       # Clean + codegen + build (requires CONVEX_DEPLOYMENT)

# Development with tests
npm run all               # Run dev + test:watch in parallel
```

## Architecture

### Two-Layer Component Structure

```
src/
├── component/              # Core component logic (runs in Convex)
│   ├── convex.config.ts    # Component name and configuration
│   ├── schema.ts           # Component's database tables
│   ├── affiliates.ts       # Affiliate CRUD functions
│   ├── campaigns.ts        # Campaign management
│   ├── commissions.ts      # Commission tracking
│   ├── referrals.ts        # Referral/click tracking
│   ├── payouts.ts          # Payout processing
│   ├── analytics.ts        # Dashboard analytics
│   └── crons.ts            # Scheduled jobs
├── client/                 # Client-side API (used by consuming apps)
│   └── index.ts            # createAffiliateApi(), registerRoutes(), etc.
├── react/                  # React hooks (optional)
│   └── index.ts            # useTrackReferralOnLoad, useStoredReferral, etc.
└── bin/                    # CLI scaffolding tool
    └── init.mts            # npx convex-affiliates init
```

### Example App

The `example/` directory contains a working Convex app that demonstrates component usage:
- `example/convex/convex.config.ts` - Shows how to import and use the component
- `example/convex/example.ts` - Example function implementations
- `example/convex/http.ts` - HTTP endpoint registration
- `example/src/App.tsx` - Frontend demo

### Key Patterns

**Component Registration** (in consuming app's convex.config.ts):
```typescript
import affiliates from "convex-affiliates/convex.config.js";
const app = defineApp();
app.use(affiliates);
```

**Calling Component Functions**:
```typescript
import { components } from "./_generated/api";
await ctx.runMutation(components.affiliates.lib.add, { ... });
```

**HTTP Route Registration**:
```typescript
import { registerRoutes } from "convex-affiliates";
registerRoutes(http, components.affiliates, { pathPrefix: "/affiliates" });
```

## Testing

Uses Vitest with `convex-test` for isolated component testing. Test files are colocated with source (`*.test.ts`).

```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode for development
```

## Convex Best Practices

- **Always use new function syntax** with `args` and `returns` validators
- **Use `v.null()`** for null values (not undefined)
- **Use `v.int64()`** for BigInt (not deprecated `v.bigint()`)
- **Never use `.filter()`** without indexes - use `.withIndex()` instead
- **Index naming**: Include all fields (e.g., `by_field1_and_field2`)
- **Public vs Internal**: Use `query`/`mutation` for public APIs, `internalQuery`/`internalMutation` for private functions
- **Actions**: Use `"use node";` at file top for Node.js modules, cannot use `ctx.db`
- **Function calls**: Use `ctx.runQuery`, `ctx.runMutation`, `ctx.runAction` with FunctionReferences from `api`/`internal` objects

## Component Boundary Rules

Convex components serialize data at the boundary between host app and component:
- **IDs become plain `string`** — branded `Id<"tableName">` types are stripped when crossing the component boundary
- **Client API validators must use `v.string()`** for any ID args/returns, never `v.id("tableName")`
- **Only use `v.id()` inside `src/component/`** — the internal functions keep branded IDs
- **Cast at the boundary** — when passing string IDs to internal component functions, use `as any` at the call site
- **Test from the consumer's perspective** — typecheck the example app or a mock consumer to catch boundary type issues

## CI/CD & Publishing Rules

Publishing is fully automated via `semantic-release` on push to `main`. Key rules:

- **`prepublishOnly` must NOT run codegen** — use `npm run build` (tsc only), not `build:clean`. Codegen requires `CONVEX_DEPLOYMENT` which is unavailable in CI. Generated types are committed to the repo.
- **Use `npm ci --legacy-peer-deps`** in CI workflows — the lockfile has peer dep conflicts that require `--legacy-peer-deps`
- **ESLint must ignore `.examples/`** — these contain compiled `dist/` files that produce thousands of lint errors
- **OIDC trusted publishing** — no npm token needed. The release workflow uses GitHub Actions OIDC with `id-token: write` permission. Provenance attestations are generated automatically.
- **Commit messages control releases**: `fix:` → patch, `feat:` → minor, `feat!:` → major, `chore:/ci:/test:` → no release

Additional CI tooling:
- **pkg-pr-new** — publishes preview npm packages on every PR for consumer testing (pattern from all `.examples/`)
- **`npm whoami`** in `prepublishOnly` — catches npm auth issues before publish attempt (pattern from better-auth/stripe)
- **Concurrency groups** — cancel stale CI runs on new pushes, prevent duplicate releases
- **30min timeout** — prevent hung CI jobs

See `PUBLISHING.md` for full details and `.examples/better-auth` or `.examples/stripe` for reference patterns used by other Convex components.

## Commit Message Rules

All commits must use [Conventional Commits](https://www.conventionalcommits.org/) format. semantic-release uses these to determine version bumps.

**Format**: `type: description` or `type(scope): description`

| Type | When to use | Release |
|------|------------|---------|
| `fix:` | Bug fixes | Patch |
| `feat:` | New features | Minor |
| `feat!:` or `BREAKING CHANGE:` footer | Breaking changes | Major |
| `perf:` | Performance improvements | Patch |
| `docs:` | Documentation (README only triggers patch) | Patch/None |
| `chore:` | Dependencies, config, maintenance | None |
| `ci:` | CI/CD workflow changes | None |
| `test:` | Adding or updating tests | None |
| `refactor:` | Code restructuring without behavior change | None |

**Rules**:
- Use lowercase for type and description
- No period at the end
- Keep the first line under 72 characters
- Use imperative mood ("add feature" not "added feature")
- Never include AI-generated footers or co-author attributions

**Examples**:
```
fix: handle null affiliate codes in referral tracking
feat: add webhook retry logic for failed payouts
feat!: change commission calculation API response format
chore: update dependencies
ci: add concurrency groups to release workflow
```

## Documentation Maintenance

After making changes that affect the public API, package name, repository URLs, schema, or project structure, **always update the relevant docs**:

- **CLAUDE.md** — architecture, commands, CI/CD rules, key patterns
- **README.md** — installation, usage examples, API reference
- **PUBLISHING.md** — release workflow and configuration

Keep all package name references, import paths, and URLs consistent across docs.