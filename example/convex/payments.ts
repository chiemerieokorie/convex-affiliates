/**
 * Payment Actions with Affiliate Tracking Example
 *
 * This file demonstrates how to create checkout sessions that automatically
 * include affiliate attribution data for commission tracking.
 */

import { action } from "./_generated/server.js";
import { v } from "convex/values";
import { stripe } from "./stripe.js";

/**
 * Create a Stripe checkout session with automatic affiliate data.
 *
 * The AffiliateStripe wrapper automatically:
 * - Gets the user ID from auth context
 * - Looks up the user's referral and campaign
 * - Adds client_reference_id for webhook attribution
 * - Adds affiliate_code to metadata
 * - Applies discount coupon if the campaign has one configured
 *
 * @example
 * ```tsx
 * // In your React component
 * const createCheckout = useAction(api.payments.createCheckout);
 *
 * const handleSubscribe = async () => {
 *   const url = await createCheckout({ priceId: "price_xxx" });
 *   if (url) window.location.href = url;
 * };
 * ```
 */
export const createCheckout = action({
  args: {
    priceId: v.string(),
  },
  handler: async (ctx, { priceId }) => {
    // Get enriched checkout params with affiliate data
    const params = await stripe.createCheckoutSession(ctx, {
      priceId,
      successUrl: `${process.env.BASE_URL ?? "http://localhost:5173"}/success`,
      cancelUrl: `${process.env.BASE_URL ?? "http://localhost:5173"}/cancel`,
    });

    // In a real app, you would create the Stripe session:
    //
    // import Stripe from "stripe";
    // const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);
    //
    // const session = await stripeSDK.checkout.sessions.create({
    //   mode: "subscription",
    //   line_items: [{ price: params.priceId, quantity: 1 }],
    //   success_url: params.successUrl,
    //   cancel_url: params.cancelUrl,
    //   client_reference_id: params.client_reference_id,
    //   metadata: params.metadata,
    //   discounts: params.discounts,
    // });
    //
    // return session.url;

    // For this example, we just return the enriched params
    console.log("[Payments] Checkout params:", {
      priceId: params.priceId,
      client_reference_id: params.client_reference_id,
      metadata: params.metadata,
      discounts: params.discounts,
    });

    return `https://checkout.stripe.com/example?price=${priceId}`;
  },
});

/**
 * Create a checkout session with manual affiliate code.
 *
 * Use this when you need to pass affiliate data from the client
 * (e.g., for guest checkout without auth context).
 *
 * @example
 * ```tsx
 * // Get stored referral from client
 * import { getStoredReferral } from "convex-affiliates/stripe/client";
 *
 * const referral = getStoredReferral();
 * const url = await createCheckoutWithReferral({
 *   priceId: "price_xxx",
 *   affiliateCode: referral?.affiliateCode,
 *   referralId: referral?.referralId,
 * });
 * ```
 */
export const createCheckoutWithReferral = action({
  args: {
    priceId: v.string(),
    affiliateCode: v.optional(v.string()),
    referralId: v.optional(v.string()),
  },
  handler: async (ctx, { priceId, affiliateCode, referralId }) => {
    // Pass affiliate data explicitly
    const params = await stripe.createCheckoutSession(ctx, {
      priceId,
      successUrl: `${process.env.BASE_URL ?? "http://localhost:5173"}/success`,
      cancelUrl: `${process.env.BASE_URL ?? "http://localhost:5173"}/cancel`,
      // These are used when there's no auth context or for fallback
      affiliateCode,
      referralId,
    });

    console.log("[Payments] Checkout with referral:", {
      priceId: params.priceId,
      client_reference_id: params.client_reference_id,
      metadata: params.metadata,
      discounts: params.discounts,
    });

    return `https://checkout.stripe.com/example?price=${priceId}`;
  },
});
