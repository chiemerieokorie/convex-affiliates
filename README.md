# Convex Affiliates

A comprehensive affiliate marketing component for [Convex](https://convex.dev) with flexible attribution tracking, configurable commission structures, and seamless Stripe integration.

[![npm version](https://badge.fury.io/js/convex-affiliates.svg)](https://www.npmjs.com/package/convex-affiliates)

## Features

- **Flexible Attribution Tracking** - Configurable storage (localStorage, cookie, or both) with URL parameter-based attribution
- **Stripe Integration** - Easy webhook handlers for automatic commission creation
- **Flexible Commission Structures** - Percentage or fixed, with tiered and product-specific rates
- **Campaign Management** - Multiple campaigns with different terms
- **NET-0/15/30/60/90 Scheduling** - Configurable payout terms with automatic due date calculation
- **Manual Payout Recording** - Record payouts made via PayPal, bank transfer, or other methods
- **Pure Data Layer** - Component handles data, your app handles integrations

## Installation

```bash
npm install convex-affiliates
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
import affiliates from "convex-affiliates/convex.config";

const app = defineApp();
app.use(affiliates);

export default app;
```

### 2. Generate the API file

```bash
npx convex-affiliates init
```

This creates `convex/affiliates.ts` with all exports pre-configured. Edit the file to set your auth callback and commission defaults.

<details>
<summary>Or create it manually</summary>

```typescript
import { components } from "./_generated/api";
import { createAffiliateApi } from "convex-affiliates";

const affiliates = createAffiliateApi(components.affiliates, {
  defaultCommissionValue: 20,
  defaultPayoutTerm: "NET-30",
  baseUrl: process.env.BASE_URL ?? "https://yourapp.com",
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },
});

// Export only the functions you need
export const { trackClick, validateCode } = affiliates;
export const { register, getAffiliate, getPortalData, listCommissions,
  listPayouts, listReferrals, generateLink, attributeSignup } = affiliates;
export const { adminDashboard, adminListAffiliates, adminApproveAffiliate,
  adminRejectAffiliate, adminSuspendAffiliate, adminListCampaigns,
  adminCreateCampaign } = affiliates;
```
</details>

### 3. Deploy

```bash
npx convex deploy
```

### 4. Add Lifecycle Hooks (Optional)

The affiliate API supports type-safe hooks for lifecycle events. Use these to send emails, trigger webhooks, or integrate with other systems.

```typescript
import { components } from "./_generated/api";
import { createAffiliateApi } from "convex-affiliates";

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

#### Stripe Integration with Hooks

For commission events via Stripe webhooks, pass hooks to the Stripe handlers:

```typescript
import { getAffiliateStripeHandlers } from "convex-affiliates";

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

### Attribution (Manual Integration)

Attribute signups to affiliates after user registration. In your auth hook or signup handler:

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

## Better Auth Plugin

For projects using [Better Auth](https://better-auth.com), we provide dedicated plugins that handle referral tracking and attribution automatically.

### Quick Start

```typescript
// Server: convex/auth.ts
import { affiliatePlugin } from "convex-affiliates/better-auth";
import { components } from "./_generated/api";

export const createAuth = (ctx) => {
  return betterAuth({
    database: authComponent.adapter(ctx),
    plugins: [
      affiliatePlugin(ctx, components.affiliates),
    ],
  });
};

// Client: lib/auth-client.ts
import { affiliateClientPlugin } from "convex-affiliates/better-auth/client";

export const authClient = createAuthClient({
  plugins: [
    affiliateClientPlugin(),
  ],
});
```

That's it! The plugins handle everything automatically.

### How It Works

1. **Visitor arrives** with `?ref=CODE` in the URL
2. **Client plugin** detects the code and stores it (localStorage + cookie)
3. **User signs up** via Better Auth
4. **Client plugin** injects `referralId` and `referralCode` into signup request
5. **Server plugin** reads referral data and calls component's `attributeSignup`
6. **Referral is linked** to the new user automatically

### Server Plugin Options

```typescript
affiliatePlugin(ctx, components.affiliates, {
  // Custom field names (optional)
  fieldNames: {
    referralId: "referralId",
    referralCode: "referralCode",
  },

  // Cookie names for SSR support (optional)
  cookieName: "affiliate_code",
  referralIdCookieName: "affiliate_referral_id",

  // Callbacks (optional)
  onAttributionSuccess: async ({ userId, affiliateCode }) => {
    console.log(`Attributed ${userId} to ${affiliateCode}`);
  },
  onAttributionFailure: async ({ userId, reason }) => {
    console.log(`Attribution failed: ${reason}`);
  },
});
```

### Client Plugin Options

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

affiliateClientPlugin({
  // All options have sensible defaults
  storage: "both",           // "localStorage" | "cookie" | "both"
  cookieDurationDays: 30,
  paramName: "ref",          // URL param: ?ref=CODE
  subIdParamName: "sub",     // URL param: ?sub=campaign-1
  autoTrack: true,           // Auto-detect from URL
  clearOnSignup: true,       // Clear after successful signup

  // Automatic click tracking (recommended)
  // Tracks clicks when a referral is detected from URL
  trackClick: (args) => convex.mutation(api.affiliates.trackClick, args),
});
```

The `trackClick` option automatically tracks referral clicks when detected from URL parameters. The mutation receives:
- `affiliateCode`: The affiliate code from the URL
- `landingPage`: The full URL where the visitor landed
- `subId`: Optional sub-tracking ID (if `?sub=...` is present)

### Client Plugin Actions

```typescript
// Get stored referral
const referral = authClient.affiliate.getStoredReferral();

// Check if referred
if (authClient.affiliate.hasReferral()) {
  // Show "Referred by partner" badge
}

// Manual tracking
await authClient.affiliate.trackReferral("PARTNER20");

// Clear referral data
authClient.affiliate.clearReferral();
```

## Stripe Plugin

For projects using [@convex-dev/stripe](https://www.convex.dev/components/stripe), we provide a plugin that automatically handles affiliate tracking for payments.

### Quick Start

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { registerRoutes } from "@convex-dev/stripe";
import { withAffiliates } from "convex-affiliates/stripe";
import { components } from "./_generated/api";

const http = httpRouter();

// One line - that's it!
registerRoutes(http, components.stripe, withAffiliates(components.affiliates));

export default http;
```

That's it! The plugin automatically handles:
- `invoice.paid` → Creates commission for the affiliate
- `charge.refunded` → Reverses commission on refund
- `checkout.session.completed` → Links Stripe customer to affiliate

### With Your Own Event Handlers

If you need custom logic alongside affiliate tracking, both handlers run (affiliate first, then yours):

```typescript
registerRoutes(http, components.stripe, withAffiliates(components.affiliates, {
  events: {
    // Your handler runs AFTER affiliate commission is created
    "invoice.paid": async (ctx, event) => {
      await sendSlackNotification(event);
    },
  },
}));
```

### With Callbacks

Get notified when affiliate events occur:

```typescript
registerRoutes(http, components.stripe, withAffiliates(components.affiliates, {
  onCommissionCreated: async (data) => {
    // data: { commissionId, affiliateId, affiliateCode, amountCents, currency }
    await notifyAffiliate(data.affiliateId, `You earned $${data.amountCents / 100}!`);
  },
  onCommissionReversed: async (data) => {
    // data: { commissionId, affiliateId, amountCents, reason }
    await notifyAffiliate(data.affiliateId, "A commission was reversed.");
  },
  onCustomerLinked: async (data) => {
    // data: { stripeCustomerId, userId, affiliateCode }
    console.log(`Customer ${data.stripeCustomerId} linked to affiliate`);
  },
}));
```

### Checkout with Affiliate Data

Use `enrichCheckout` to automatically add affiliate data to checkout sessions. It gets the user from the auth context and looks up their referral:

```typescript
// convex/payments.ts
import { action } from "./_generated/server";
import { enrichCheckout } from "convex-affiliates/stripe";
import { components } from "./_generated/api";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createCheckout = action({
  args: { priceId: v.string() },
  handler: async (ctx, { priceId }) => {
    // Automatically adds:
    // - client_reference_id (userId for attribution)
    // - metadata.affiliate_code
    // - discounts[] (if campaign has coupon configured)
    const params = await enrichCheckout(ctx, components.affiliates, {
      priceId,
      successUrl: `${process.env.SITE_URL}/success`,
      cancelUrl: `${process.env.SITE_URL}/cancel`,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.client_reference_id,
      metadata: params.metadata,
      discounts: params.discounts,
    });

    return session.url;
  },
});
```

### Client-Side Utilities

For client-side Stripe integrations (Stripe.js), use the client utilities:

```typescript
import { getStoredReferral, enrichClientCheckout } from "convex-affiliates/stripe/client";

// Check if user was referred
const referral = getStoredReferral();
if (referral?.affiliateCode) {
  console.log(`Referred by: ${referral.affiliateCode}`);
}

// Enrich checkout params with stored referral data
const params = enrichClientCheckout({
  successUrl: window.location.origin + "/success",
  cancelUrl: window.location.origin + "/cancel",
});
// params now includes metadata.affiliate_code and client_reference_id
```

### Complete Flow

1. **User clicks affiliate link** → `?ref=CODE` in URL
2. **Better Auth client plugin** stores the code (or use `trackClick` mutation)
3. **User signs up** → Better Auth plugin calls `attributeSignup`
4. **User checkouts** → `enrichCheckout` adds affiliate data to session
5. **Payment succeeds** → `withAffiliates` webhook creates commission
6. **Refund happens** → `withAffiliates` webhook reverses commission

### Legacy: Standalone Handlers

If you're not using `@convex-dev/stripe`, you can still use the standalone handlers:

```typescript
import { getAffiliateStripeHandlers } from "convex-affiliates";

// Get handlers for manual integration
const handlers = getAffiliateStripeHandlers(components.affiliates, {
  hooks: {
    "commission.created": async (data) => { /* ... */ },
  },
});
```

Or use the standalone webhook handler with built-in signature verification:

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { createAffiliateApi } from "convex-affiliates";
import { components } from "./_generated/api";

const http = httpRouter();

const affiliates = createAffiliateApi(components.affiliates, {
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },
});

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: affiliates.createStripeWebhookHandler({
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

export default http;
```

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

### Storage Configuration

By default, referral data is stored in `localStorage`. You can switch to cookies (useful for cross-subdomain tracking or server-side access) or use both:

```ts
import { createAffiliateHooks } from "convex-affiliates/react";
import { api } from "../convex/_generated/api";

// Cookie storage with cross-subdomain support
const hooks = createAffiliateHooks(api.affiliates, {
  storage: "cookie",
  cookieOptions: {
    domain: ".example.com",  // shared across subdomains
    maxAge: 30 * 24 * 60 * 60, // 30 days (default)
    secure: true,            // HTTPS only (default)
    sameSite: "lax",         // default
  },
});

// Dual-write: writes to both, reads cookie-first
const hooks = createAffiliateHooks(api.affiliates, { storage: "both" });
```

The same config can be passed to `useTrackReferralOnLoad` and `useStoredReferral` standalone hooks.

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

## Fraud Prevention

The component includes comprehensive fraud prevention measures to protect your affiliate program:

### Self-Referral Protection

Affiliates cannot earn commissions on their own purchases. This is enforced at multiple levels:

- **Signup Attribution**: `attributeSignup` and `attributeSignupByCode` block attempts where the signing-up user matches the affiliate's userId
- **Stripe Customer Linking**: `linkStripeCustomer` blocks self-referral when linking customers to affiliates
- **Commission Creation**: `createFromInvoice` rejects commissions where the referral's userId matches the affiliate

### Attribution Security

- **First-Touch Attribution**: Once a user is attributed to an affiliate, they cannot be re-attributed to a different affiliate (prevents affiliate code switching)
- **Authenticated Attribution Only**: Affiliate code attribution via `linkStripeCustomer` requires a userId - guest checkout cannot use affiliate codes to prevent anonymous self-referral
- **Webhook Attribution Disabled**: The `createFromInvoice` webhook handler does not create new referrals via affiliate codes - all attribution must happen through the authenticated frontend flow (`trackClick` → `attributeSignup` → `linkStripeCustomer`)

### Click Velocity Limiting

IP-based rate limiting prevents click fraud using `@convex-dev/rate-limiter`:

```typescript
// Configurable per campaign (default: 10 clicks per IP per hour)
maxClicksPerIpPerHour: 10
```

### Silent Rejection

All fraud prevention checks silently reject suspicious activity (returning `null` or `{ success: false }`) without throwing errors. This prevents attackers from learning detection logic through error messages.

## Troubleshooting

### TypeScript type errors with components.affiliates

If you get type errors when passing `components.affiliates` to `createAffiliateApi`, you can use a type assertion:

```typescript
import { createAffiliateApi, ComponentApi } from "convex-affiliates";

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

## Common Recipes

### Complete Referral Flow (Track → Store → Attribute)

Using the built-in React hooks with configurable storage:

```tsx
import { createAffiliateHooks, useTrackReferralOnLoad, useStoredReferral } from "convex-affiliates/react";
import { api } from "../convex/_generated/api";

// Choose storage mode: "localStorage" (default), "cookie", or "both"
const storageConfig = {
  storage: "cookie" as const,
  cookieOptions: { domain: ".example.com", maxAge: 30 * 24 * 60 * 60 },
};

const hooks = createAffiliateHooks(api.affiliates, storageConfig);

// 1. Track referral on landing — automatically reads ?ref= and stores the referral ID
function ReferralTracker() {
  const trackReferral = hooks.useTrackReferral();
  useTrackReferralOnLoad(trackReferral, storageConfig);
  return null;
}

// 2. Attribute after signup (in your auth callback)
function useAttributeOnSignup(userId: string) {
  const { referralId, code, clear } = useStoredReferral(storageConfig);
  const attributeSignup = useMutation(api.affiliates.attributeSignup);

  useEffect(() => {
    if (!userId || (!referralId && !code)) return;
    attributeSignup({
      userId,
      referralId: referralId ?? undefined,
      referralCode: code ?? undefined,
    }).then(() => clear());
  }, [userId]);
}
```

### Two-Sided Rewards (Affiliate Coupon Codes)

Two-sided rewards let affiliates offer discounts to referred customers (e.g., "Get 10% off with code JOHN20") while earning their commission. This creates a win-win: customers get a discount, affiliates get credit for the sale.

**How it works:**
1. You configure a discount at the **campaign level** (all affiliates in that campaign offer the same discount)
2. When a referred customer checks out, you query for their discount
3. You apply the discount to their Stripe checkout session

#### Step 1: Create a Stripe Coupon (Optional but Recommended)

If you want Stripe to handle the discount calculation and display, create a coupon in Stripe first:

```bash
# Using Stripe CLI
stripe coupons create \
  --percent-off=10 \
  --duration=once \
  --id="AFFILIATE_10_PERCENT"

# Or for a fixed amount discount
stripe coupons create \
  --amount-off=500 \
  --currency=usd \
  --duration=once \
  --id="AFFILIATE_5_OFF"
```

Or create via the [Stripe Dashboard](https://dashboard.stripe.com/coupons) → Products → Coupons → Create coupon.

> **Note:** The coupon ID (e.g., `AFFILIATE_10_PERCENT`) is what you'll store in the campaign configuration.

#### Step 2: Configure Campaign with Discount Settings

When creating or updating a campaign, include the discount configuration:

```typescript
// Creating a new campaign with discount
await ctx.runMutation(api.affiliates.adminCreateCampaign, {
  name: "Partner Program",
  slug: "partners",
  commissionType: "percentage",
  commissionValue: 20, // Affiliates earn 20% commission

  // Two-sided rewards configuration
  refereeDiscountType: "percentage",      // "percentage" or "fixed"
  refereeDiscountValue: 10,               // 10% off for referred customers
  refereeStripeCouponId: "AFFILIATE_10_PERCENT", // Optional: pre-created Stripe coupon
});

// Or for a fixed discount
await ctx.runMutation(api.affiliates.adminCreateCampaign, {
  name: "Influencer Program",
  slug: "influencers",
  commissionType: "fixed",
  commissionValue: 500, // Affiliates earn $5.00 per sale

  // $5 off for referred customers
  refereeDiscountType: "fixed",
  refereeDiscountValue: 500,              // 500 cents = $5.00
  refereeStripeCouponId: "AFFILIATE_5_OFF",
});
```

**Discount fields:**

| Field | Type | Description |
|-------|------|-------------|
| `refereeDiscountType` | `"percentage"` \| `"fixed"` | How the discount is calculated |
| `refereeDiscountValue` | `number` | Percentage (0-100) or cents for fixed |
| `refereeStripeCouponId` | `string` (optional) | Pre-created Stripe coupon ID |

#### Step 3: Apply Discount at Checkout

##### With @convex-dev/stripe (Recommended)

If you're using `@convex-dev/stripe`, here's the complete flow:

```typescript
// convex/checkout.ts
import { mutation } from "./_generated/server";
import { api, components } from "./_generated/api";
import { v } from "convex/values";

export const createCheckoutSession = mutation({
  args: {
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // 1. Get discount for referred customer
    const discount = await ctx.runQuery(api.affiliates.getRefereeDiscount, {
      userId,
    });

    // 2. Build checkout session config
    const sessionConfig: Parameters<typeof components.stripe.checkout.createSession>[1] = {
      line_items: [{ price: args.priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    };

    // 3. Apply discount if available
    if (discount?.stripeCouponId) {
      // Use the pre-configured Stripe coupon
      sessionConfig.discounts = [{ coupon: discount.stripeCouponId }];
    }

    // 4. Create the checkout session
    const session = await ctx.runAction(components.stripe.checkout.createSession, sessionConfig);

    return { url: session.url };
  },
});
```

##### Without a Stripe Coupon (Manual Calculation)

If you prefer to calculate discounts manually without a pre-configured Stripe coupon:

```typescript
// convex/checkout.ts
export const createCheckoutSession = mutation({
  args: {
    priceId: v.string(),
    subtotalCents: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // 1. Get discount for referred customer
    const discount = await ctx.runQuery(api.affiliates.getRefereeDiscount, {
      userId,
    });

    // 2. Calculate discount amount
    let discountAmountCents = 0;
    if (discount) {
      discountAmountCents = discount.discountType === "percentage"
        ? Math.round((args.subtotalCents * discount.discountValue) / 100)
        : discount.discountValue;
    }

    // 3. Create a one-time coupon in Stripe (if discount applies)
    let couponId: string | undefined;
    if (discountAmountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountAmountCents,
        currency: "usd",
        duration: "once",
        name: `Referral discount from ${discount?.affiliateDisplayName || discount?.affiliateCode}`,
      });
      couponId = coupon.id;
    }

    // 4. Create checkout session with discount
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: args.priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      ...(couponId && { discounts: [{ coupon: couponId }] }),
    });

    return { url: session.url };
  },
});
```

##### Displaying the Discount to Users

Show users their available discount before checkout:

```tsx
// components/CheckoutButton.tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function CheckoutButton({ userId }: { userId: string }) {
  const discount = useQuery(api.affiliates.getRefereeDiscount, { userId });

  return (
    <div>
      {discount && (
        <div className="discount-banner">
          {discount.discountType === "percentage"
            ? `${discount.discountValue}% off`
            : `$${(discount.discountValue / 100).toFixed(2)} off`}
          {" "}with code {discount.affiliateCode}!
        </div>
      )}
      <button onClick={handleCheckout}>
        Proceed to Checkout
      </button>
    </div>
  );
}
```

#### getRefereeDiscount Response

The `getRefereeDiscount` query returns:

```typescript
{
  discountType: "percentage" | "fixed",
  discountValue: number,           // Percentage (0-100) or cents
  stripeCouponId?: string,         // Pre-configured Stripe coupon ID
  affiliateCode: string,           // e.g., "JOHN20"
  affiliateDisplayName?: string,   // e.g., "John's Deals"
}
// Returns null if no discount is available
```

You can query by any of these parameters:
- `userId` - The referred customer's user ID
- `referralId` - The referral tracking ID from localStorage
- `affiliateCode` - The affiliate's code directly

#### Troubleshooting Discounts

**Discount returns `null`:**

| Issue | Solution |
|-------|----------|
| Affiliate not approved | Ensure affiliate status is `"approved"` via `adminApproveAffiliate` |
| Campaign inactive | Ensure campaign `isActive` is `true` |
| No discount configured | Set `refereeDiscountType` and `refereeDiscountValue` on the campaign |
| Referral expired | Discount expires after `cookieDurationDays` (default: 30 days) |
| User not attributed | Ensure `attributeSignup` was called after the user signed up |

**Stripe coupon not applying:**

| Issue | Solution |
|-------|----------|
| Invalid coupon ID | Verify the coupon exists in Stripe Dashboard → Products → Coupons |
| Coupon expired | Check the coupon's `redeem_by` date in Stripe |
| Coupon restrictions | Check if the coupon has product/price restrictions in Stripe |
| Wrong mode | Ensure coupon `duration` matches checkout mode (one-time vs subscription) |

**Debug checklist:**

```typescript
// 1. Check if user has a referral
const referral = await ctx.runQuery(api.affiliates.getRefereeDiscount, { userId });
console.log("Referral discount:", referral);

// 2. If null, check the user's referral directly
const referrals = await ctx.runQuery(components.affiliates.referrals.listByUser, { userId });
console.log("User referrals:", referrals);

// 3. Check the affiliate's status
const affiliate = await ctx.runQuery(components.affiliates.affiliates.getByCode, {
  code: "AFFILIATE_CODE"
});
console.log("Affiliate:", affiliate?.status);

// 4. Check the campaign's discount config
const campaign = await ctx.runQuery(components.affiliates.campaigns.get, {
  campaignId: affiliate?.campaignId
});
console.log("Campaign discount:", {
  type: campaign?.refereeDiscountType,
  value: campaign?.refereeDiscountValue,
  couponId: campaign?.refereeStripeCouponId,
});
```

### Batch Admin Operations

```typescript
// Approve all pending affiliates
const pending = await ctx.runQuery(api.affiliates.adminListAffiliates, {
  status: "pending",
});

for (const affiliate of pending) {
  await adminApproveAffiliate({ affiliateId: affiliate._id });
}
```

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
