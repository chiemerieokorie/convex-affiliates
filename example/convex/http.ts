import { httpRouter } from "convex/server";
import { components } from "./_generated/api.js";
import { registerRoutes, createStripeWebhookHandler } from "chief_emerie";

const http = httpRouter();

// =============================================================================
// Affiliate Component Routes
// =============================================================================

// Register HTTP routes for the affiliate component
// This exposes endpoints like:
// - GET /affiliates/affiliate/:code - Validate affiliate code
registerRoutes(http, components.affiliates, {
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
  handler: createStripeWebhookHandler(components.affiliates, {
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

export default http;
