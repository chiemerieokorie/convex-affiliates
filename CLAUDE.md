# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Convex Component** - a reusable backend package that implements a comments/affiliates system. The component is published to npm as `convex-affiliates` and demonstrates best practices for building production-ready Convex components.

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
npm run build             # Build src/component to dist/
npm run build:codegen     # Generate types + build (use after schema changes)
npm run build:clean       # Clean dist and rebuild

# Development with tests
npm run all               # Run dev + test:watch in parallel

# Publishing
npm run alpha             # Publish alpha version
npm run release           # Publish patch version
```

## Architecture

### Two-Layer Component Structure

```
src/
├── component/              # Core component logic (runs in Convex)
│   ├── convex.config.ts    # Component name and configuration
│   ├── schema.ts           # Component's database tables
│   └── lib.ts              # Queries, mutations, actions
├── client/                 # Client-side API (used by consuming apps)
│   └── index.ts            # exposeApi(), registerRoutes(), translate()
└── react/                  # React hooks (optional)
    └── index.ts
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
registerRoutes(http, components.affiliates, { pathPrefix: "/comments" });
```

## Testing

Uses Vitest with `convex-test` for isolated component testing. Test files are colocated with source (`*.test.ts`).

```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode for development
```

## Convex Best Practices (from .cursor/rules/convex_rules.mdc)

- **Always use new function syntax** with `args` and `returns` validators
- **Use `v.null()`** for null values (not undefined)
- **Use `v.int64()`** for BigInt (not deprecated `v.bigint()`)
- **Never use `.filter()`** without indexes - use `.withIndex()` instead
- **Index naming**: Include all fields (e.g., `by_field1_and_field2`)
- **Public vs Internal**: Use `query`/`mutation` for public APIs, `internalQuery`/`internalMutation` for private functions
- **Actions**: Use `"use node";` at file top for Node.js modules, cannot use `ctx.db`
- **Function calls**: Use `ctx.runQuery`, `ctx.runMutation`, `ctx.runAction` with FunctionReferences from `api`/`internal` objects

## Documentation Maintenance

After making changes that affect the public API, package name, repository URLs, schema, or project structure, **always update the relevant docs**:

- **CLAUDE.md** — architecture, commands, key patterns
- **README.md** — installation, usage examples, API reference
- **PUBLISHING.md** — release workflow and configuration

Keep all package name references, import paths, and URLs consistent across docs.