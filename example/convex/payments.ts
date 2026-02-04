/**
 * Payment Actions with Affiliate Tracking Example
 *
 * This file demonstrates how to create checkout sessions that automatically
 * include affiliate attribution data for commission tracking.
 *
 * IMPORTANT: For commission tracking to work, you must pass `client_reference_id`
 * to Stripe. This links the Stripe customer to the user's referral. Since
 * @convex-dev/stripe doesn't support `client_reference_id`, we use the Stripe
 * SDK directly.
 */

import { action } from "./_generated/server.js";
import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { getAffiliateMetadata } from "convex-affiliates/stripe";

// Note: In a real app, you would import and instantiate the Stripe SDK:
// import Stripe from "stripe";
// const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Create a Stripe checkout session with automatic affiliate data.
 *
 * The getAffiliateMetadata function:
 * - Gets the user ID from auth context
 * - Looks up the user's referral
 * - Returns { userId, affiliate_code? }
 *   - userId: Pass as client_reference_id (REQUIRED for commission tracking)
 *   - affiliate_code: Pass in metadata (for attribution)
 *
 * @example
 * ```tsx
 * // In your React component
 * const createCheckout = useAction(api.payments.createCheckout);
 *
 * const handleSubscribe = async () => {
 *   const result = await createCheckout({ priceId: "price_xxx" });
 *   if (result.url) window.location.href = result.url;
 * };
 * ```
 */
export const createCheckout = action({
  args: {
    priceId: v.string(),
  },
  handler: async (ctx, { priceId }) => {
    // Get affiliate metadata: { userId, affiliate_code? }
    const { userId, ...metadata } = await getAffiliateMetadata(ctx, components.affiliates);

    // In a real app, you would use the Stripe SDK:
    //
    // const session = await stripeSDK.checkout.sessions.create({
    //   mode: "subscription",
    //   line_items: [{ price: priceId, quantity: 1 }],
    //   success_url: `${process.env.BASE_URL}/success`,
    //   cancel_url: `${process.env.BASE_URL}/cancel`,
    //   client_reference_id: userId, // REQUIRED for commission tracking!
    //   metadata, // { affiliate_code?: string }
    // });
    //
    // return { sessionId: session.id, url: session.url };

    // For this example, we just log and return mock data
    console.log("[Payments] Checkout with affiliate data:", {
      priceId,
      userId,
      metadata,
    });

    return {
      sessionId: "cs_test_example",
      url: `https://checkout.stripe.com/example?price=${priceId}`,
    };
  },
});

/**
 * Create a checkout with additional metadata.
 *
 * Shows how to merge affiliate data with other checkout metadata.
 */
export const createCheckoutWithMetadata = action({
  args: {
    priceId: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, { priceId, plan }) => {
    // Get affiliate metadata: { userId, affiliate_code? }
    const { userId, ...affiliateMetadata } = await getAffiliateMetadata(ctx, components.affiliates);

    // Merge affiliate data with your own metadata
    const metadata = {
      ...affiliateMetadata,
      plan,
      source: "pricing-page",
    };

    // In a real app:
    //
    // const session = await stripeSDK.checkout.sessions.create({
    //   mode: "subscription",
    //   line_items: [{ price: priceId, quantity: 1 }],
    //   success_url: `${process.env.BASE_URL}/success`,
    //   cancel_url: `${process.env.BASE_URL}/cancel`,
    //   client_reference_id: userId, // REQUIRED for commission tracking!
    //   metadata,
    // });
    //
    // return { sessionId: session.id, url: session.url };

    console.log("[Payments] Checkout with merged metadata:", {
      priceId,
      userId,
      metadata,
    });

    return {
      sessionId: "cs_test_example",
      url: `https://checkout.stripe.com/example?price=${priceId}`,
    };
  },
});
