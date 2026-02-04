/**
 * Stripe with Affiliate Tracking Example
 *
 * This file demonstrates how to use AffiliateStripe to wrap @convex-dev/stripe
 * for automatic affiliate commission tracking.
 *
 * Prerequisites:
 * 1. Install @convex-dev/stripe: npm install @convex-dev/stripe
 * 2. Add stripe to convex.config.ts:
 *    ```
 *    import stripe from "@convex-dev/stripe/convex.config";
 *    app.use(stripe);
 *    ```
 * 3. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in your environment
 */

import { components } from "./_generated/api.js";
import { AffiliateStripe } from "convex-affiliates/stripe";

// Note: In a real app, you would import Stripe from @convex-dev/stripe:
// import { Stripe } from "@convex-dev/stripe";
//
// For this example, we create a mock to avoid the peer dependency requirement.
// Replace this with the real Stripe import in your app.
const MockStripe = class {
  constructor(_component: unknown) {}
};

/**
 * AffiliateStripe wraps the Stripe component to automatically:
 * - Handle webhook events for commission creation/reversal
 * - Enrich checkout sessions with affiliate data
 */
export const stripe = new AffiliateStripe(
  new MockStripe(null) as any, // Replace with: new Stripe(components.stripe)
  components.affiliates,
  {
    // Optional: Get notified when affiliate events occur
    onCommissionCreated: async (data) => {
      console.log(
        `[Affiliates] Commission created: $${(data.amountCents / 100).toFixed(2)} ` +
          `for affiliate ${data.affiliateCode}`
      );
    },
    onCommissionReversed: async (data) => {
      console.log(
        `[Affiliates] Commission reversed: $${(data.amountCents / 100).toFixed(2)} ` +
          `for affiliate ${data.affiliateId}`
      );
    },
    onCustomerLinked: async (data) => {
      console.log(
        `[Affiliates] Customer ${data.stripeCustomerId} linked to affiliate ${data.affiliateCode}`
      );
    },
  }
);

/**
 * Export route options for use with registerRoutes in http.ts
 *
 * Usage in http.ts:
 * ```
 * import { registerRoutes } from "@convex-dev/stripe";
 * import { stripe } from "./stripe.js";
 *
 * registerRoutes(http, components.stripe, stripe.getRouteOptions());
 * ```
 */
export const stripeRouteOptions = stripe.getRouteOptions();
