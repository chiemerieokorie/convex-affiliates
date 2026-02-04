/**
 * Stripe with Affiliate Tracking Example
 *
 * This file demonstrates how to use withAffiliates to add automatic affiliate
 * commission tracking to @convex-dev/stripe.
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
import { withAffiliates } from "convex-affiliates/stripe";

/**
 * Route options for use with registerRoutes in http.ts
 *
 * withAffiliates adds handlers for:
 * - invoice.paid → Creates commission for affiliate
 * - charge.refunded → Reverses commission
 * - checkout.session.completed → Links customer to affiliate
 *
 * Usage in http.ts:
 * ```
 * import { registerRoutes } from "@convex-dev/stripe";
 * import { stripeRouteOptions } from "./stripe.js";
 *
 * registerRoutes(http, components.stripe, stripeRouteOptions);
 * ```
 */
export const stripeRouteOptions = withAffiliates(components.affiliates, {
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
});
