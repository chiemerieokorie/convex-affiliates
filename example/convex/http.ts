import { httpRouter } from "convex/server";
import { components } from "./_generated/api.js";
import { createAffiliateApi } from "convex-affiliates";

const http = httpRouter();

const affiliates = createAffiliateApi(components.affiliates, {
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },
});

// =============================================================================
// Affiliate Component Routes
// =============================================================================

// Register HTTP routes for the affiliate component
// This exposes endpoints like:
// - GET /affiliates/affiliate/:code - Validate affiliate code
affiliates.registerRoutes(http, {
  pathPrefix: "/affiliates",
});

// =============================================================================
// Stripe Webhook Handler
// =============================================================================

// Stripe webhook with signature verification.
// Set STRIPE_WEBHOOK_SECRET in your Convex environment variables.
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: affiliates.createStripeWebhookHandler({
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

export default http;
