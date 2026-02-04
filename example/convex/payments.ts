/**
 * Payment Actions with Affiliate Tracking Example
 *
 * This file demonstrates how to create checkout sessions that automatically
 * include affiliate attribution data for commission tracking.
 */

import { action } from "./_generated/server.js";
import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { getAffiliateMetadata } from "convex-affiliates/stripe";

// Note: In a real app, you would import and instantiate the Stripe component:
// import StripeSubscriptions from "@convex-dev/stripe";
// const stripe = new StripeSubscriptions(components.stripe);

/**
 * Create a Stripe checkout session with automatic affiliate data.
 *
 * The getAffiliateMetadata function:
 * - Gets the user ID from auth context
 * - Looks up the user's referral
 * - Returns { affiliate_code: string } if user was referred
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
    // Get affiliate metadata for the current user
    const affiliateData = await getAffiliateMetadata(ctx, components.affiliates);

    // In a real app, you would use @convex-dev/stripe:
    //
    // return stripe.createCheckoutSession(ctx, {
    //   priceId,
    //   mode: "subscription",
    //   successUrl: `${process.env.BASE_URL}/success`,
    //   cancelUrl: `${process.env.BASE_URL}/cancel`,
    //   metadata: affiliateData, // { affiliate_code?: string }
    // });

    // For this example, we just log and return mock data
    console.log("[Payments] Checkout with affiliate data:", {
      priceId,
      affiliateData,
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
    // Get affiliate metadata for the current user
    const affiliateData = await getAffiliateMetadata(ctx, components.affiliates);

    // Merge with your own metadata
    const metadata = {
      ...affiliateData,
      plan,
      source: "pricing-page",
    };

    // In a real app:
    //
    // return stripe.createCheckoutSession(ctx, {
    //   priceId,
    //   mode: "subscription",
    //   successUrl: `${process.env.BASE_URL}/success`,
    //   cancelUrl: `${process.env.BASE_URL}/cancel`,
    //   metadata,
    // });

    console.log("[Payments] Checkout with merged metadata:", {
      priceId,
      metadata,
    });

    return {
      sessionId: "cs_test_example",
      url: `https://checkout.stripe.com/example?price=${priceId}`,
    };
  },
});
