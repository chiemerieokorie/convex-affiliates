# CLAUDE.md

## Project Overview

`convex-affiliates` is a Convex component that provides a complete affiliate/referral tracking system. It's published as an npm package and used by consumer apps.

## Architecture

- `src/component/` — Convex component functions (queries, mutations, schema)
- `src/component/_generated/component.ts` — Hand-maintained boundary type file (see below)
- `src/client/index.ts` — `createAffiliateApi()` factory that wraps component functions
- `src/client/react.tsx` — React hooks for client-side usage
- `example/` — Example consumer app showing usage patterns

## Commands

- `npm run build` — Clean + compile TypeScript
- `npm run typecheck` — Full typecheck (main + example + example/convex)
- `npm run test` — Vitest with typecheck enabled
- `npm run lint` — ESLint

## Component Boundary Types

**Critical**: `src/component/_generated/component.ts` defines the TypeScript types that consumers see. This file is hand-maintained and must match what Convex codegen produces in consumer apps.

### Boundary Rules

1. **No branded `Id<"tableName">` types** — Use `string` instead. Convex flattens branded IDs to `string` at the component boundary.
2. **Visibility must be `"internal"`** — All functions use `"internal"` visibility, not `"public"`.
3. **No imports from `dataModel`** — The file must not import `Id` or anything from `./dataModel.js`.
4. **`PaginationResult` uses `any`** — Consumer codegen produces `PaginationResult<any>` for paginated queries.
5. **Union types become string** — Some fields like `getPortalData.recentCommissions.status` are `string` in the consumer, not the union type.

### How to Update component.ts

Compare with the consumer's `_generated/api.d.ts` (e.g., in crucible-fund/asvab). The consumer's types are the source of truth for what the boundary looks like:

- All `Id<"tableName">` → `string`
- All `"public"` visibility → `"internal"`
- Return types for `Id<>` returning mutations → `string`
- `PaginationResult<DetailedType>` → `PaginationResult<any>`

### Auth Callback Context Type

The `auth` and `isAdmin` callbacks use `AffiliateCtx`, a permissive type:

```typescript
export type AffiliateCtx = { auth: Auth } & Record<string, any>;
```

This accepts any Convex context (query, mutation, action) so consumers can pass `ctx` directly to their own auth helpers (e.g., `authComponent.safeGetAuthUser(ctx)`) which may require the full `GenericCtx` with `scheduler`, `storage`, etc.

### No `as any` Casts in Client Code

`src/client/index.ts` must not contain any `as any` casts. If a cast is needed, the component.ts types are wrong and should be fixed instead.

### CI Tests

Boundary validation tests in `src/client/index.test.ts` prevent regressions:

- No `"public"` visibility in component.ts
- No `Id<"` branded types in component.ts
- No `dataModel` imports in component.ts
- No `as any` casts in client/index.ts

### Why Local Typecheck Doesn't Catch Boundary Errors

Local `tsc` resolves component types from the local `dist/` which has the same branded `Id<>` types as the source. Consumer apps get boundary-flattened types from Convex codegen. The boundary validation tests catch what typecheck cannot.
