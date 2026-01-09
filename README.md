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

### 2. Create and Export the API

Create `convex/affiliates.ts`:

```typescript
import { components } from "./_generated/api";
import { createAffiliateApi } from "chief_emerie";

// Create the API with your config
const affiliates = createAffiliateApi(components.affiliates, {
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

  // Authentication callback - return the user ID
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },

  // Optional: Admin authorization callback
  isAdmin: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.tokenIdentifier?.includes("admin") ?? false;
  },
});

// Re-export ready-to-use functions
export const {
  // Public (no auth required)
  trackClick,
  validateCode,

  // Authenticated user functions
  register,
  getAffiliate,
  getPortalData,
  listCommissions,
  listPayouts,
  listReferrals,
  generateLink,
  attributeSignup,

  // Stripe Connect
  createConnectOnboardingLink,
  createConnectLoginLink,

  // Admin functions
  adminDashboard,
  adminListAffiliates,
  adminTopAffiliates,
  adminApproveAffiliate,
  adminRejectAffiliate,
  adminSuspendAffiliate,
  adminProcessPayouts,
  adminListCampaigns,
  adminCreateCampaign,

  // Webhook handlers (use in HTTP routes)
  handleInvoicePaid,
  handleChargeRefunded,
  handleCheckoutCompleted,
} = affiliates;
```

### 3. Deploy

```bash
npx convex deploy
```

## Usage Guide

### Calling Functions from Your App

All exported functions are ready to use from your frontend:

```tsx
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function AffiliatePortal() {
  // Query affiliate data
  const portal = useQuery(api.affiliates.getPortalData);
  const commissions = useQuery(api.affiliates.listCommissions, { limit: 10 });

  // Register as affiliate
  const register = useMutation(api.affiliates.register);

  const handleRegister = async () => {
    await register({
      email: "me@example.com",
      displayName: "My Brand",
    });
  };

  // ...
}
```

### Referral Tracking

Track clicks when visitors land on your site with an affiliate code:

```tsx
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect } from "react";

function ReferralTracker() {
  const trackClick = useMutation(api.affiliates.trackClick);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref") || params.get("via");

    if (code) {
      trackClick({ affiliateCode: code, landingPage: window.location.pathname });
    }
  }, []);

  return null;
}
```

### Attribution (Better Auth Integration)

Attribute signups to affiliates after user registration. In your Better Auth hook or signup handler:

```typescript
// convex/users.ts
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const onUserCreated = internalMutation({
  args: { userId: v.string(), referralCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.referralCode) {
      // attributeSignup is already exported from your affiliates.ts
      await ctx.runMutation(internal.affiliates.attributeSignup, {
        userId: args.userId,
        affiliateCode: args.referralCode,
      });
    }
  },
});
```

### Stripe Webhook Integration

Handle Stripe webhooks to create commissions automatically. The webhook handlers are already exported from your `affiliates.ts`:

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
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
        await ctx.runMutation(api.affiliates.handleInvoicePaid, {
          invoice: event.data.object,
        });
        break;
      case "charge.refunded":
        await ctx.runMutation(api.affiliates.handleChargeRefunded, {
          charge: event.data.object,
        });
        break;
      case "checkout.session.completed":
        await ctx.runMutation(api.affiliates.handleCheckoutCompleted, {
          session: event.data.object,
        });
        break;
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

### Portal Data

Query affiliate dashboard data from your frontend:

```tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function Dashboard() {
  const portal = useQuery(api.affiliates.getPortalData);

  if (!portal) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {portal.affiliate.displayName}</h1>
      <p>Your code: {portal.affiliate.code}</p>
      <p>Total earnings: ${portal.affiliate.stats.paidCommissionsCents / 100}</p>
    </div>
  );
}
```

### Admin Functions

All admin functions are exported and check authorization via your `isAdmin` callback:

```tsx
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";

function AdminDashboard() {
  const dashboard = useQuery(api.affiliates.adminDashboard);
  const affiliates = useQuery(api.affiliates.adminListAffiliates, { status: "pending" });
  const approve = useMutation(api.affiliates.adminApproveAffiliate);
  const processPayouts = useAction(api.affiliates.adminProcessPayouts);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Total affiliates: {dashboard?.totalAffiliates}</p>
      <p>Pending approval: {affiliates?.length}</p>

      {affiliates?.map((aff) => (
        <button key={aff._id} onClick={() => approve({ affiliateId: aff._id })}>
          Approve {aff.displayName}
        </button>
      ))}

      <button onClick={() => processPayouts()}>Process Payouts</button>
    </div>
  );
}
```

## React Integration

Since all functions are exported directly from your `convex/affiliates.ts`, use standard Convex hooks:

### Track Referrals on Page Load

```tsx
// components/ReferralTracker.tsx
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useRef } from "react";

export function ReferralTracker() {
  const trackClick = useMutation(api.affiliates.trackClick);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref") || params.get("via");

    if (code) {
      tracked.current = true;
      trackClick({
        affiliateCode: code,
        landingPage: window.location.pathname,
      });
    }
  }, [trackClick]);

  return null;
}
```

### Affiliate Portal Example

```tsx
// components/AffiliatePortal.tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function AffiliatePortal() {
  const portal = useQuery(api.affiliates.getPortalData);
  const commissions = useQuery(api.affiliates.listCommissions, { limit: 10 });

  if (!portal) return <div>Loading...</div>;

  const formatCents = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  return (
    <div>
      <h1>Welcome, {portal.affiliate.displayName}</h1>
      <p>Your code: <code>{portal.affiliate.code}</code></p>

      <div className="stats">
        <div>Clicks: {portal.affiliate.stats.totalClicks}</div>
        <div>Signups: {portal.affiliate.stats.totalSignups}</div>
        <div>Conversions: {portal.affiliate.stats.totalConversions}</div>
        <div>Pending: {formatCents(portal.affiliate.stats.pendingCommissionsCents)}</div>
        <div>Paid: {formatCents(portal.affiliate.stats.paidCommissionsCents)}</div>
      </div>

      <h2>Recent Commissions</h2>
      {commissions?.data.map((c) => (
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
import { useState } from "react";

export function LinkGenerator({ code, baseUrl }: { code: string; baseUrl: string }) {
  const [copied, setCopied] = useState(false);

  const link = `${baseUrl}?ref=${code}`;

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <input value={link} readOnly />
      <button onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
    </div>
  );
}
```

## API Reference

### createAffiliateApi

```typescript
function createAffiliateApi(
  component: ComponentApi,
  config: AffiliateApiConfig
): AffiliateApi;
```

Returns an object with ready-to-export Convex functions:

| Function | Type | Auth | Description |
|----------|------|------|-------------|
| `trackClick` | mutation | public | Track affiliate link click |
| `validateCode` | query | public | Validate affiliate code |
| `register` | mutation | user | Register as affiliate |
| `getAffiliate` | query | user | Get current user's affiliate |
| `getPortalData` | query | user | Get dashboard data |
| `listCommissions` | query | user | List user's commissions |
| `listPayouts` | query | user | List user's payouts |
| `listReferrals` | query | user | List user's referrals |
| `generateLink` | query | user | Generate affiliate link |
| `attributeSignup` | mutation | user | Attribute signup to referral |
| `createConnectOnboardingLink` | action | user | Stripe Connect onboarding |
| `createConnectLoginLink` | action | user | Stripe Connect dashboard |
| `handleInvoicePaid` | mutation | internal | Stripe webhook handler |
| `handleChargeRefunded` | mutation | internal | Stripe webhook handler |
| `handleCheckoutCompleted` | mutation | internal | Stripe webhook handler |
| `adminDashboard` | query | admin | Admin dashboard stats |
| `adminListAffiliates` | query | admin | List all affiliates |
| `adminTopAffiliates` | query | admin | Top performing affiliates |
| `adminApproveAffiliate` | mutation | admin | Approve affiliate |
| `adminRejectAffiliate` | mutation | admin | Reject affiliate |
| `adminSuspendAffiliate` | mutation | admin | Suspend affiliate |
| `adminProcessPayouts` | action | admin | Process pending payouts |
| `adminListCampaigns` | query | admin | List campaigns |
| `adminCreateCampaign` | mutation | admin | Create campaign |

### Configuration

```typescript
interface AffiliateApiConfig {
  // Commission defaults
  defaultCommissionType?: "percentage" | "fixed";
  defaultCommissionValue?: number; // Percentage (0-100) or cents for fixed
  defaultPayoutTerm?: "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";
  minPayoutCents?: number;
  defaultCookieDurationDays?: number;

  // URLs
  baseUrl?: string;

  // Stripe
  stripeSecretKey?: string;

  // Authentication callback (required for user functions)
  auth: (ctx: { auth: Auth }) => Promise<string>;

  // Admin authorization callback (optional, defaults to allowing all)
  isAdmin?: (ctx: { auth: Auth }) => Promise<boolean>;
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
2. Set the `stripeSecretKey` in your config
3. Use the exported `createConnectOnboardingLink` action:

```tsx
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

function ConnectButton() {
  const createOnboardingLink = useAction(api.affiliates.createConnectOnboardingLink);

  const handleConnect = async () => {
    const { url } = await createOnboardingLink({
      returnUrl: "https://yourapp.com/affiliate/connect/complete",
      refreshUrl: "https://yourapp.com/affiliate/connect/refresh",
    });
    window.location.href = url;
  };

  return <button onClick={handleConnect}>Connect with Stripe</button>;
}
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
