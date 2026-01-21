# Convex Affiliates

A comprehensive affiliate marketing component for [Convex](https://convex.dev) with zero-cookie tracking, flexible commission structures, and seamless Stripe integration.

[![npm version](https://badge.fury.io/js/chief_emerie.svg)](https://www.npmjs.com/package/chief_emerie)

## Features

- **Zero-Cookie Tracking** - URL parameter-based attribution that works without cookies
- **Stripe Integration** - Easy webhook handlers for automatic commission creation
- **Flexible Commission Structures** - Percentage or fixed, with tiered and product-specific rates
- **Campaign Management** - Multiple campaigns with different terms
- **NET-0/15/30/60/90 Scheduling** - Configurable payout terms with automatic due date calculation
- **Manual Payout Recording** - Record payouts made via PayPal, bank transfer, or other methods
- **Pure Data Layer** - Component handles data, your app handles integrations

## Installation

```bash
npm install chief_emerie
```

### Peer Dependencies

```bash
npm install convex
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

  // Authentication callback - works with any Convex auth provider
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject; // User ID from JWT token
  },

  // Optional: Admin authorization callback
  isAdmin: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    // Example: check email domain or custom claim
    return identity?.email?.endsWith("@yourcompany.com") ?? false;
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

  // Admin functions
  adminDashboard,
  adminListAffiliates,
  adminTopAffiliates,
  adminApproveAffiliate,
  adminRejectAffiliate,
  adminSuspendAffiliate,
  adminListCampaigns,
  adminCreateCampaign,
} = affiliates;
```

### 3. Deploy

```bash
npx convex deploy
```

### 4. Add Lifecycle Hooks (Optional)

The affiliate API supports type-safe hooks for lifecycle events. Use these to send emails, trigger webhooks, or integrate with other systems.

```typescript
import { components } from "./_generated/api";
import { createAffiliateApi } from "chief_emerie";

const affiliates = createAffiliateApi(components.affiliates, {
  // ... other config ...

  hooks: {
    "affiliate.registered": async (data) => {
      // data: { affiliateId, affiliateCode, affiliateEmail, affiliateUserId }
      await sendEmail(data.affiliateEmail, "Welcome to our affiliate program!");
    },
    "affiliate.approved": async (data) => {
      // data: { affiliateId, affiliateCode, affiliateEmail, affiliateUserId }
      await sendEmail(data.affiliateEmail, "Your application has been approved!");
    },
    "affiliate.rejected": async (data) => {
      await sendEmail(data.affiliateEmail, "Unfortunately, your application was not approved.");
    },
    "affiliate.suspended": async (data) => {
      await sendEmail(data.affiliateEmail, "Your affiliate account has been suspended.");
    },
  },
});
```

#### Available Hooks

| Hook | Typed Data | Fields |
|------|-----------|--------|
| `affiliate.registered` | `AffiliateRegisteredData` | affiliateId, affiliateCode, affiliateEmail, affiliateUserId |
| `affiliate.approved` | `AffiliateStatusChangeData` | affiliateId, affiliateCode, affiliateEmail, affiliateUserId |
| `affiliate.rejected` | `AffiliateStatusChangeData` | affiliateId, affiliateCode, affiliateEmail, affiliateUserId |
| `affiliate.suspended` | `AffiliateStatusChangeData` | affiliateId, affiliateCode, affiliateEmail, affiliateUserId |
| `commission.created` | `CommissionCreatedData` | commissionId, affiliateId, affiliateCode, commissionAmountCents, currency |
| `commission.reversed` | `CommissionReversedData` | commissionId, affiliateId, commissionAmountCents |
| `payout.created` | `PayoutData` | payoutId, affiliateId, payoutAmountCents |
| `payout.completed` | `PayoutData` | payoutId, affiliateId, payoutAmountCents |

#### Stripe Integration with Hooks

For commission events via Stripe webhooks, pass hooks to the Stripe handlers:

```typescript
import { getAffiliateStripeHandlers } from "chief_emerie";

export const stripeHandlers = getAffiliateStripeHandlers(
  components.affiliates,
  {
    hooks: {
      "commission.created": async (data) => {
        // data: { commissionId, affiliateId, affiliateCode, commissionAmountCents, currency }
        await notifyAffiliate(data.affiliateId, `You earned $${(data.commissionAmountCents / 100).toFixed(2)}!`);
      },
      "commission.reversed": async (data) => {
        await notifyAffiliate(data.affiliateId, "A commission was reversed due to a refund.");
      },
    },
  }
);
```

#### Error Handling

Hooks are wrapped in try/catch - if a hook throws an error, the mutation still succeeds. Errors are logged to console. This ensures hook failures don't break critical operations like registrations or approvals.

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

#### With @convex-dev/stripe (Recommended)

If you're using `@convex-dev/stripe`, use `getAffiliateStripeHandlers` to get type-safe handlers:

```typescript
// convex/stripeHandlers.ts
import { getAffiliateStripeHandlers } from "chief_emerie";
import { components } from "./_generated/api";

// Get affiliate handlers for invoice.paid, charge.refunded, checkout.session.completed
export const affiliateHandlers = getAffiliateStripeHandlers(components.affiliates);
```

Then use them in your Stripe webhook setup. You can combine with your own handlers as needed.

#### Standalone Webhook Handler

If you're not using `@convex-dev/stripe`, use the standalone handler with built-in signature verification:

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { createStripeWebhookHandler } from "chief_emerie";

const http = httpRouter();

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: createStripeWebhookHandler(components.affiliates, {
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

export default http;
```

Set `STRIPE_WEBHOOK_SECRET` in your Convex environment variables.

Both approaches handle `invoice.paid`, `charge.refunded`, and `checkout.session.completed` events automatically

### Recording Payouts

Record payouts when you pay affiliates (via PayPal, bank transfer, etc.):

```typescript
// In your admin panel or payout handler
await ctx.runMutation(components.affiliates.payouts.record, {
  affiliateId: affiliate._id,
  amountCents: 5000, // $50.00
  currency: "usd",
  method: "paypal", // or "bank_transfer", "manual", "other"
  notes: "Monthly payout for December 2024",
});
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
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function AdminDashboard() {
  const dashboard = useQuery(api.affiliates.adminDashboard);
  const affiliates = useQuery(api.affiliates.adminListAffiliates, { status: "pending" });
  const approve = useMutation(api.affiliates.adminApproveAffiliate);

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
      {commissions?.page.map((c) => (
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
| `adminDashboard` | query | admin | Admin dashboard stats |
| `adminListAffiliates` | query | admin | List all affiliates |
| `adminTopAffiliates` | query | admin | Top performing affiliates |
| `adminApproveAffiliate` | mutation | admin | Approve affiliate |
| `adminRejectAffiliate` | mutation | admin | Reject affiliate |
| `adminSuspendAffiliate` | mutation | admin | Suspend affiliate |
| `adminListCampaigns` | query | admin | List campaigns |
| `adminCreateCampaign` | mutation | admin | Create campaign |

### Component Mutations (for webhook handlers)

Call these directly via `components.affiliates.*`:

| Function | Description |
|----------|-------------|
| `commissions.createFromInvoice` | Create commission from Stripe invoice data |
| `commissions.reverseByCharge` | Reverse commission on refund |
| `referrals.linkStripeCustomer` | Link Stripe customer to affiliate referral |
| `payouts.record` | Record a manual payout |

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

  // Product restrictions (Stripe product IDs)
  allowedProducts?: string[];
  excludedProducts?: string[];
}
```

### Payout Methods

When recording payouts, use one of these methods:

- `manual` - Generic manual payout
- `bank_transfer` - Bank/wire transfer
- `paypal` - PayPal payment
- `other` - Other payment method

## Architecture

This component follows a **pure data layer** pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                          HOST APP                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Stripe Webhook Handler (your code)                       │   │
│  │  - Verify webhook signatures                              │   │
│  │  - Parse events                                           │   │
│  │  - Call component mutations                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              AFFILIATES COMPONENT (Pure Data)             │   │
│  │                                                           │   │
│  │  Internal mutations for host app to call:                 │   │
│  │  - commissions.createFromInvoice(invoiceData)             │   │
│  │  - commissions.reverseByCharge(chargeId)                  │   │
│  │  - referrals.linkStripeCustomer(customerId, code)         │   │
│  │  - payouts.record(affiliateId, amount, method)            │   │
│  │                                                           │   │
│  │  NO Stripe SDK, NO Node.js runtime dependencies           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

This design:
- Keeps the component lightweight and portable
- Gives you full control over webhook handling and verification
- Works with any payment processor (not just Stripe)
- Allows flexible payout methods (PayPal, bank transfer, crypto, etc.)

## Troubleshooting

### TypeScript type errors with components.affiliates

If you get type errors when passing `components.affiliates` to `createAffiliateApi`, you can use a type assertion:

```typescript
import { createAffiliateApi, ComponentApi } from "chief_emerie";

const affiliates = createAffiliateApi(
  components.affiliates as unknown as ComponentApi,
  { ... }
);
```

This may be needed if your TypeScript configuration differs from the component's.

### Authentication with different providers

The `auth` callback receives the full Convex context, but the type only shows `{ auth: Auth }`. The recommended pattern works with any Convex-compatible auth provider:

```typescript
auth: async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject; // User ID from JWT token
},
```

For Better Auth or other providers, the `identity.subject` contains the user ID from your auth provider's JWT token.

## Local Development

```bash
# Clone and install
git clone https://github.com/your-org/convex-affiliates
cd convex-affiliates
npm install

# Run development (backend + example app)
npm run dev

# Run tests
npm run test

# Build (automatically cleans dist/ first)
npm run build
```

## License

Apache-2.0

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.
