# Convex Affiliates

A comprehensive affiliate marketing component for [Convex](https://convex.dev) with zero-cookie tracking, Stripe Connect payouts, and workflow-based NET-15/30/60/90 scheduling.

[![npm version](https://badge.fury.io/js/chief_emerie.svg)](https://www.npmjs.com/package/chief_emerie)

## Features

- **Zero-Cookie Tracking** - URL parameter-based attribution that works without cookies
- **Stripe Integration** - Automatic commission creation from Stripe webhooks
- **Stripe Connect Payouts** - Pay affiliates directly via Stripe Connect
- **Flexible Commission Structures** - Percentage or fixed, with tiered and product-specific rates
- **Campaign Management** - Multiple campaigns with different terms
- **Workflow-Based Payouts** - NET-0/15/30/60/90 scheduling with durable execution
- **React Hooks** - Ready-to-use hooks for affiliate portals
- **Headless Components** - Unstyled components for full customization

## Installation

```bash
npm install chief_emerie
```

### Peer Dependencies

```bash
npm install convex @convex-dev/workflow stripe
```

## Quick Start

### 1. Configure the Component

Create or update `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import affiliates from "chief_emerie/convex.config";

const app = defineApp();
app.use(affiliates);

export default app;
```

### 2. Create the AffiliateManager

Create `convex/affiliates.ts`:

```typescript
import { components } from "./_generated/api";
import { AffiliateManager } from "chief_emerie";

export const affiliates = new AffiliateManager(components.affiliates, {
  // Commission defaults
  defaultCommissionType: "percentage",
  defaultCommissionValue: 20, // 20%
  defaultPayoutTerm: "NET-30",
  minPayoutCents: 5000, // $50 minimum
  defaultCookieDurationDays: 30,

  // Your app's base URL for generating affiliate links
  baseUrl: process.env.BASE_URL ?? "https://yourapp.com",

  // Stripe secret key for Connect payouts (optional)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
});
```

### 3. Initialize the System

Run this once during app setup:

```typescript
import { internalMutation } from "./_generated/server";
import { affiliates } from "./affiliates";

export const initializeAffiliates = internalMutation({
  handler: async (ctx) => {
    await affiliates.initialize(ctx);
  },
});
```

### 4. Deploy

```bash
npx convex deploy
```

## Usage Guide

### Affiliate Registration

Allow users to register as affiliates:

```typescript
// convex/affiliates.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { affiliates } from "./affiliates";

export const register = mutation({
  args: {
    email: v.string(),
    displayName: v.optional(v.string()),
    website: v.optional(v.string()),
    customCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await affiliates.registerAffiliate(ctx, {
      userId: identity.subject,
      email: args.email,
      displayName: args.displayName,
      website: args.website,
      customCode: args.customCode, // Optional custom affiliate code
    });
  },
});
```

### Referral Tracking

Track when visitors click affiliate links:

```typescript
// convex/affiliates.ts
export const trackClick = mutation({
  args: {
    affiliateCode: v.string(),
    landingPage: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.affiliates.referrals.trackClick, {
      affiliateCode: args.affiliateCode,
      landingPage: args.landingPage,
    });
  },
});
```

### Attribution (Better Auth Integration)

Attribute signups to affiliates after user registration:

```typescript
// In your Better Auth hook or signup handler
import { affiliates } from "./affiliates";

export const onUserCreated = internalMutation({
  args: { userId: v.string(), referralCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.referralCode) {
      await affiliates.attributeSignup(ctx, {
        userId: args.userId,
        referralCode: args.referralCode,
      });
    }
  },
});
```

### Stripe Webhook Integration

Handle Stripe webhooks to create commissions automatically:

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const signature = request.headers.get("stripe-signature")!;
    const body = await request.text();

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case "invoice.paid":
        await ctx.runMutation(internal.affiliates.handleInvoicePaid, {
          invoice: event.data.object,
        });
        break;
      case "charge.refunded":
        await ctx.runMutation(internal.affiliates.handleChargeRefunded, {
          charge: event.data.object,
        });
        break;
      case "checkout.session.completed":
        await ctx.runMutation(internal.affiliates.handleCheckoutCompleted, {
          session: event.data.object,
        });
        break;
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

```typescript
// convex/affiliates.ts (add these handlers)
export const handleInvoicePaid = internalMutation({
  args: { invoice: v.any() },
  handler: async (ctx, args) => {
    await affiliates.handleInvoicePaid(ctx, args.invoice);
  },
});

export const handleChargeRefunded = internalMutation({
  args: { charge: v.any() },
  handler: async (ctx, args) => {
    await affiliates.handleChargeRefunded(ctx, args.charge);
  },
});

export const handleCheckoutCompleted = internalMutation({
  args: { session: v.any() },
  handler: async (ctx, args) => {
    await affiliates.handleCheckoutCompleted(ctx, args.session);
  },
});
```

### Portal Data

Get data for affiliate dashboards:

```typescript
// convex/affiliates.ts
export const getPortalData = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await affiliates.getAffiliatePortalData(ctx, identity.subject);
  },
});
```

### Admin Functions

```typescript
// convex/admin.ts
import { affiliates } from "./affiliates";

export const getDashboard = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await affiliates.getAdminDashboard(ctx);
  },
});

export const listAffiliates = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("suspended")
    )),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await affiliates.listAffiliates(ctx, { status: args.status });
  },
});

export const approveAffiliate = mutation({
  args: { affiliateId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await affiliates.approveAffiliate(ctx, args.affiliateId);
  },
});

export const processPayouts = action({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await affiliates.processPayouts(ctx);
  },
});
```

## React Integration

### Setup Hooks

```typescript
// lib/affiliate-hooks.ts
import { api } from "../convex/_generated/api";
import { createAffiliateHooks } from "chief_emerie/react";

// Create hooks bound to your API
export const {
  useAffiliate,
  useAffiliatePortal,
  useAffiliateCommissions,
  useAffiliatePayouts,
  useRegisterAffiliate,
  useTrackReferral,
  useAdminDashboard,
  useAffiliateList,
  useApproveAffiliate,
} = createAffiliateHooks(api.affiliates);
```

### Track Referrals on Page Load

```tsx
// components/ReferralTracker.tsx
import { useTrackReferralOnLoad } from "chief_emerie/react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function ReferralTracker() {
  const trackClick = useMutation(api.affiliates.trackClick);

  const { tracked, referralId } = useTrackReferralOnLoad(async (params) => {
    return await trackClick(params);
  });

  return null; // Invisible tracker component
}
```

### Affiliate Portal Example

```tsx
// components/AffiliatePortal.tsx
import { useAffiliatePortal } from "../lib/affiliate-hooks";
import { formatCents } from "chief_emerie/react";

export function AffiliatePortal() {
  const portal = useAffiliatePortal();

  if (!portal) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {portal.affiliate.displayName}</h1>
      <p>Your code: <code>{portal.affiliate.code}</code></p>

      <div className="stats">
        <div>Clicks: {portal.affiliate.stats.totalClicks}</div>
        <div>Signups: {portal.affiliate.stats.totalSignups}</div>
        <div>Conversions: {portal.affiliate.stats.totalConversions}</div>
        <div>
          Pending: {formatCents(portal.affiliate.stats.pendingCommissionsCents)}
        </div>
        <div>
          Paid: {formatCents(portal.affiliate.stats.paidCommissionsCents)}
        </div>
      </div>

      <h2>Recent Commissions</h2>
      {portal.recentCommissions.map((c) => (
        <div key={c._id}>
          {formatCents(c.commissionAmountCents)} - {c.status}
        </div>
      ))}
    </div>
  );
}
```

### Link Generator

```tsx
import { useAffiliateLinkGenerator, useCopyToClipboard } from "chief_emerie/react";

export function LinkGenerator({ code }: { code: string }) {
  const { generate } = useAffiliateLinkGenerator("https://yourapp.com", code);
  const { copy, copied } = useCopyToClipboard();

  const link = generate("/pricing");

  return (
    <div>
      <input value={link} readOnly />
      <button onClick={() => copy(link)}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
```

## API Reference

### AffiliateManager

```typescript
class AffiliateManager {
  constructor(component: ComponentApi, config: AffiliateConfig)

  // Setup
  initialize(ctx: MutationCtx): Promise<void>

  // Attribution
  attributeSignup(ctx, params): Promise<{ attributed: boolean; affiliateCode?: string }>

  // Stripe Webhooks
  handleInvoicePaid(ctx, invoice): Promise<string | null>
  handleChargeRefunded(ctx, charge): Promise<void>
  handleCheckoutCompleted(ctx, session): Promise<void>

  // Registration
  registerAffiliate(ctx, params): Promise<{ affiliateId: string; code: string }>

  // Portal
  getAffiliatePortalData(ctx, userId): Promise<PortalData | null>
  getAffiliateCommissions(ctx, params): Promise<PaginatedResult>
  getAffiliatePayouts(ctx, params): Promise<PaginatedResult>

  // Stripe Connect
  createConnectOnboardingLink(ctx, params): Promise<{ accountId: string; url: string }>
  createConnectLoginLink(ctx, accountId): Promise<string>

  // Admin
  getAdminDashboard(ctx): Promise<AdminDashboard>
  listAffiliates(ctx, params?): Promise<Affiliate[]>
  approveAffiliate(ctx, affiliateId): Promise<void>
  rejectAffiliate(ctx, affiliateId): Promise<void>
  suspendAffiliate(ctx, affiliateId): Promise<void>
  processPayouts(ctx): Promise<{ triggered: number; affiliateIds: string[] }>

  // Campaigns
  listCampaigns(ctx, includeInactive?): Promise<Campaign[]>
  createCampaign(ctx, params): Promise<string>

  // Utilities
  generateAffiliateLink(code, path?, subId?): string
  parseReferralParams(searchParams): { code?: string; subId?: string }
}
```

### Configuration

```typescript
interface AffiliateConfig {
  defaultCommissionType?: "percentage" | "fixed";
  defaultCommissionValue?: number;
  defaultPayoutTerm?: "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";
  minPayoutCents?: number;
  defaultCookieDurationDays?: number;
  baseUrl?: string;
  stripeSecretKey?: string;
}
```

### Campaign Options

```typescript
interface Campaign {
  name: string;
  slug: string;
  description?: string;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  payoutTerm: "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";
  cookieDurationDays: number;

  // Commission duration for subscriptions
  commissionDuration?: "lifetime" | "max_payments" | "max_months";
  commissionDurationValue?: number;

  // Product restrictions
  allowedProducts?: string[];
  excludedProducts?: string[];
}
```

## Stripe Connect Setup

1. Enable Stripe Connect in your Stripe dashboard
2. Set the `stripeSecretKey` in your AffiliateManager config
3. Create onboarding links for affiliates:

```typescript
export const getConnectOnboardingLink = action({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const affiliate = await ctx.runQuery(api.affiliates.getAffiliate);

    return await affiliates.createConnectOnboardingLink(ctx, {
      affiliateId: affiliate._id,
      refreshUrl: "https://yourapp.com/affiliate/connect/refresh",
      returnUrl: "https://yourapp.com/affiliate/connect/complete",
    });
  },
});
```

## Local Development

```bash
# Link the component locally
npm link

# In your app
npm link chief_emerie

# Run Convex dev
npx convex dev
```

## License

Apache-2.0

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.
