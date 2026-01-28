# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Rule: Keep Docs Updated

After making any code changes (schema, API, architecture, features), **always update this file and README.md** to reflect those changes before committing. Documentation must stay in sync with the codebase.

## Project Overview

This is a **Convex Component** for **affiliate marketing** — published to npm as `convex-affiliates`. It provides referral tracking, commission management, campaign configuration, payouts, Stripe integration, and fraud prevention. There is no comments functionality.

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

### Component Structure

```
src/
├── component/              # Core component logic (runs in Convex)
│   ├── convex.config.ts    # Component name ("affiliates") + rate-limiter dep
│   ├── schema.ts           # 9 database tables
│   ├── affiliates.ts       # Affiliate account management
│   ├── campaigns.ts        # Campaign CRUD
│   ├── commissions.ts      # Commission calculation & tracking
│   ├── referrals.ts        # Click & attribution tracking
│   ├── payouts.ts          # Payout recording
│   ├── analytics.ts        # Dashboard aggregation
│   ├── crons.ts            # Scheduled tasks
│   └── validators.ts       # Shared type validators
├── client/                 # Host app API wrapper
│   └── index.ts            # createAffiliateApi() factory function
└── react/                  # React hooks & headless components
    ├── index.ts
    └── hooks.ts
```

### Example App

The `example/` directory contains a working Convex app that demonstrates component usage:
- `example/convex/convex.config.ts` - Imports and installs the component
- `example/convex/example.ts` - Creates API via `createAffiliateApi()` and re-exports functions
- `example/src/App.tsx` - Frontend demo

### Key Patterns

**Component Registration** (in consuming app's `convex.config.ts`):
```typescript
import affiliates from "convex-affiliates/convex.config.js";
const app = defineApp();
app.use(affiliates);
```

**Creating the API** (in consuming app's Convex functions):
```typescript
import { createAffiliateApi } from "convex-affiliates";
import { components } from "./_generated/api.js";

const affiliates = createAffiliateApi(components.affiliates, {
  defaultCommissionType: "percentage",
  defaultCommissionValue: 20,
  defaultPayoutTerm: "NET-30",
  auth: async (ctx) => { /* return userId */ },
  isAdmin: async (ctx) => { /* return boolean */ },
});

export const { trackClick, register, getAffiliate, ... } = affiliates;
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

## Database Schema

The component defines these core tables (see `src/component/schema.ts` for full details):

| Table | Purpose |
|-------|---------|
| `campaigns` | Affiliate programs with commission rates, tiers, referral discounts, rate limiting |
| `affiliates` | Affiliate profiles with Stripe Connect, custom commissions, denormalized stats |
| `commissionTiers` | Volume-based tiered commission structures |
| `productCommissions` | Per-Stripe-product commission overrides |
| `referrals` | Click/signup/conversion tracking with device, IP, UTM attribution |
| `commissions` | Earned commissions (pending → approved → processing → paid/reversed) |
| `payouts` | Payout records (manual, bank_transfer, paypal, other) |
| `events` | Analytics event log |

Also depends on `@convex-dev/rate-limiter` for IP-based fraud prevention.

## Key Features

- Zero-cookie referral tracking (URL params + localStorage)
- Stripe webhook handlers (invoice.paid, charge.refunded, checkout.session.completed)
- Multi-campaign support with per-campaign rates
- Commission tiers based on referral volume
- Two-sided rewards (referee discounts)
- Payout scheduling (NET-0/15/30/60/90)
- Self-referral prevention and IP rate limiting
- Headless React components for affiliate portal and admin dashboard
