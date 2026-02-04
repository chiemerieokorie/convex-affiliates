# Better Auth + Stripe Integration Guide

This guide shows how to implement a complete affiliate tracking system using:
- **convex-affiliates** - Affiliate tracking component
- **Better Auth** - Authentication with affiliate plugin
- **@convex-dev/stripe** - Stripe payments

## Overview

The integration automatically tracks the full affiliate journey:

1. **Visit** - User visits your site with `?ref=CODE`
2. **Signup** - Better Auth captures and stores the referral
3. **Checkout** - Affiliate code is included in Stripe metadata
4. **Payment** - Webhook creates commission for the affiliate

## Prerequisites

```bash
npm install convex-affiliates @convex-dev/stripe better-auth
```

## Step 1: Configure Convex Components

### `convex/convex.config.ts`

```typescript
import { defineApp } from "convex/server";
import affiliates from "convex-affiliates/convex.config";
import stripe from "@convex-dev/stripe/convex.config";

const app = defineApp();
app.use(affiliates);
app.use(stripe);

export default app;
```

## Step 2: Set Up Better Auth Server

### `convex/auth.ts`

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import { betterAuth } from "better-auth";
import { convexAdapter } from "@better-auth/convex";
import { affiliatePlugin } from "convex-affiliates/better-auth";
import { components } from "./_generated/api";

export const auth = convexAuth({
  providers: [
    // Your auth providers (Google, GitHub, Email, etc.)
  ],
});

// Better Auth instance with affiliate plugin
export const betterAuthInstance = (ctx: any) =>
  betterAuth({
    database: convexAdapter(ctx),
    plugins: [
      affiliatePlugin(ctx, components.affiliates, {
        // Called when a new user signs up with a referral
        onReferralAttributed: async (data) => {
          console.log(
            `User ${data.userId} was referred by affiliate ${data.affiliateCode}`
          );
        },
      }),
    ],
  });
```

## Step 3: Set Up Better Auth Client

### `src/lib/auth-client.ts`

```typescript
import { createAuthClient } from "better-auth/react";
import { affiliateClientPlugin } from "convex-affiliates/better-auth/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_URL,
  plugins: [
    affiliateClientPlugin({
      // Customize the referral parameter (default: "ref")
      paramName: "ref",
      // Customize storage keys if needed
      storageConfig: {
        affiliateCodeKey: "affiliate_code",
      },
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
```

## Step 4: Configure Stripe Webhooks

### `convex/http.ts`

```typescript
import { httpRouter } from "convex/server";
import { registerRoutes } from "@convex-dev/stripe";
import { withAffiliates } from "convex-affiliates/stripe";
import { components } from "./_generated/api";

const http = httpRouter();

// Register Stripe routes with affiliate tracking
registerRoutes(
  http,
  components.stripe,
  withAffiliates(components.affiliates, {
    // Optional: Get notified when affiliate events occur
    onCommissionCreated: async (data) => {
      console.log(
        `Commission created: $${(data.amountCents / 100).toFixed(2)} for ${data.affiliateCode}`
      );
      // You could send a notification to the affiliate here
    },
    onCommissionReversed: async (data) => {
      console.log(`Commission reversed: $${(data.amountCents / 100).toFixed(2)}`);
    },
    onCustomerLinked: async (data) => {
      console.log(`Customer ${data.stripeCustomerId} linked to affiliate`);
    },
  })
);

export default http;
```

## Step 5: Create Payment Actions

**IMPORTANT**: For commission tracking to work, you must pass `client_reference_id` to Stripe.
This links the Stripe customer to the user's referral. The `@convex-dev/stripe` component
doesn't support `client_reference_id`, so you need to use the Stripe SDK directly.

### `convex/payments.ts`

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { getAffiliateMetadata } from "convex-affiliates/stripe";
import Stripe from "stripe";

// Use Stripe SDK directly for full control
const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Create a checkout session with automatic affiliate tracking
 */
export const createCheckout = action({
  args: {
    priceId: v.string(),
  },
  handler: async (ctx, { priceId }) => {
    // Get affiliate metadata: { userId, affiliate_code? }
    // - userId: Pass as client_reference_id (REQUIRED for commission tracking)
    // - affiliate_code: Pass in metadata (for attribution)
    const { userId, ...metadata } = await getAffiliateMetadata(ctx, components.affiliates);

    const session = await stripeSDK.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      client_reference_id: userId, // REQUIRED for commission tracking!
      metadata, // { affiliate_code?: string }
    });

    return { sessionId: session.id, url: session.url };
  },
});

/**
 * Create a checkout with additional custom metadata
 */
export const createCheckoutWithPlan = action({
  args: {
    priceId: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, { priceId, plan }) => {
    const { userId, ...affiliateMetadata } = await getAffiliateMetadata(ctx, components.affiliates);

    const session = await stripeSDK.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      client_reference_id: userId, // REQUIRED for commission tracking!
      // Merge affiliate data with your own metadata
      metadata: {
        ...affiliateMetadata,
        plan,
        source: "pricing-page",
      },
    });

    return { sessionId: session.id, url: session.url };
  },
});
```

## Step 6: Frontend Integration

### Pricing Page Component

```tsx
// src/components/PricingPage.tsx
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

export function PricingPage() {
  const createCheckout = useAction(api.payments.createCheckout);

  const handleSubscribe = async (priceId: string) => {
    const result = await createCheckout({ priceId });
    if (result.url) {
      window.location.href = result.url;
    }
  };

  return (
    <div>
      <h1>Choose Your Plan</h1>
      <button onClick={() => handleSubscribe("price_basic_monthly")}>
        Basic - $9/mo
      </button>
      <button onClick={() => handleSubscribe("price_pro_monthly")}>
        Pro - $29/mo
      </button>
    </div>
  );
}
```

### Landing Page with Referral

The Better Auth client plugin automatically captures referrals from URLs:

```tsx
// src/App.tsx
function App() {
  // When user visits example.com?ref=PARTNER20
  // The affiliate client plugin automatically:
  // 1. Detects the ?ref= parameter
  // 2. Stores the affiliate code in localStorage/cookies
  // 3. Includes it during signup

  return (
    <div>
      <h1>Welcome!</h1>
      <SignUpForm />
    </div>
  );
}
```

## How It Works

### Data Flow

```
1. User visits: example.com/pricing?ref=PARTNER20
   └─> Better Auth client plugin stores affiliate code

2. User signs up
   └─> Better Auth server plugin:
       - Tracks the click (referrals.trackClick)
       - Attributes signup (referrals.attributeSignupByCode)
       - Links user to affiliate

3. User clicks "Subscribe"
   └─> createCheckout action:
       - Calls getAffiliateMetadata(ctx, components.affiliates)
       - Returns { userId: "user_123", affiliate_code: "PARTNER20" }
       - Uses Stripe SDK with client_reference_id: userId and metadata

4. User completes payment
   └─> Stripe sends webhook

5. Webhook: checkout.session.completed
   └─> withAffiliates handler:
       - Links Stripe customer to affiliate via:
         - client_reference_id (userId) - for user lookup
         - metadata.affiliate_code - for attribution

6. Webhook: invoice.paid
   └─> withAffiliates handler:
       - Looks up affiliate by customer
       - Creates commission record
       - Calls onCommissionCreated callback
```

### Commission Calculation

Commissions are calculated based on campaign settings:

```typescript
// In your affiliates setup (convex/affiliates.ts)
import { createAffiliateApi } from "convex-affiliates";

export const affiliates = createAffiliateApi(components.affiliates, {
  defaultCommissionType: "percentage", // or "fixed"
  defaultCommissionValue: 20, // 20% or $20 fixed
  defaultPayoutTerm: "NET-30", // Pay after 30 days
  minPayoutCents: 5000, // $50 minimum payout
  // ... auth config
});
```

## Environment Variables

```env
# Convex
CONVEX_DEPLOYMENT=your-deployment

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
BASE_URL=https://yourapp.com
```

## Testing the Integration

### 1. Test Referral Tracking

```bash
# Visit with referral
open "http://localhost:5173?ref=TESTCODE"
```

### 2. Test Signup Attribution

Sign up while the referral code is stored. Check the console for:
```
User user_xxx was referred by affiliate TESTCODE
```

### 3. Test Checkout

Create a checkout session and verify the metadata includes `affiliate_code`.

### 4. Test Webhooks

Use Stripe CLI to forward webhooks:
```bash
stripe listen --forward-to localhost:3000/stripe/webhook
```

### 5. Verify Commission

After payment, check the commissions table:
```typescript
// Query commissions
const commissions = await ctx.runQuery(
  components.affiliates.commissions.listByAffiliate,
  { affiliateId: "..." }
);
```

## Advanced Configuration

### Custom Commission Rates by Campaign

```typescript
// Create campaign with specific rates
await adminCreateCampaign({
  name: "Partner Program",
  slug: "partner",
  commissionType: "percentage",
  commissionValue: 30, // 30% for partners
  payoutTerm: "NET-15",
  stripeCouponId: "PARTNER_DISCOUNT", // Optional: give referees a discount
});
```

### First Payment Only

To only create commissions on first payment:

```typescript
// In withAffiliates options
withAffiliates(components.affiliates, {
  onCommissionCreated: async (data) => {
    // The component handles first-payment logic internally
    // based on stripeSubscriptionId tracking
  },
});
```

## Troubleshooting

### Affiliate code not in checkout metadata

- Verify user is authenticated when calling `createCheckout`
- Check that the user has a referral linked (was referred during signup)
- Verify `getAffiliateMetadata` is being called

### Commission not created

- Check webhook is being received (Stripe CLI logs)
- Verify `withAffiliates` is wrapping the route options
- Check the affiliate exists and is approved
- Verify the customer is linked to an affiliate

### Referral not stored on signup

- Check Better Auth client plugin is configured
- Verify the `?ref=` parameter is in the URL
- Check browser localStorage for `affiliate_code`

## API Reference

### Server Functions

| Function | Description |
|----------|-------------|
| `withAffiliates(component, options)` | Wrap Stripe route options with affiliate handlers |
| `getAffiliateMetadata(ctx, component)` | Get affiliate metadata for checkout |

### Client Functions (optional, for non-Better Auth)

| Function | Description |
|----------|-------------|
| `storeReferral(data)` | Manually store referral data |
| `getStoredReferral()` | Get stored referral data |
| `hasStoredReferral()` | Check if referral data exists |
| `clearStoredReferral()` | Clear stored referral data |

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Links customer to affiliate |
| `invoice.paid` | Creates commission |
| `charge.refunded` | Reverses commission |
