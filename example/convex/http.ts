import { httpRouter } from "convex/server";
import { affiliates } from "./affiliates.js";

const http = httpRouter();

// Register HTTP routes for the affiliate component
affiliates.registerRoutes(http);

// =============================================================================
// Option 1: Legacy Stripe webhook (standalone, no @convex-dev/stripe required)
// =============================================================================
// Use this if you're handling Stripe webhooks manually without @convex-dev/stripe.
// The handler includes built-in signature verification.

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: affiliates.createStripeWebhookHandler({
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

// =============================================================================
// Option 2: With @convex-dev/stripe (recommended for new projects)
// =============================================================================
// Uncomment the following to use withAffiliates with @convex-dev/stripe.
// This provides automatic commission tracking through Stripe webhooks.
//
// Prerequisites:
// 1. npm install @convex-dev/stripe
// 2. Add to convex.config.ts:
//    import stripe from "@convex-dev/stripe/convex.config";
//    app.use(stripe);
//
// import { registerRoutes } from "@convex-dev/stripe";
// import { withAffiliates } from "convex-affiliates/stripe";
// import { components } from "./_generated/api.js";
//
// // This replaces the manual webhook route above
// registerRoutes(http, components.stripe, withAffiliates(components.affiliates));
//
// See stripe.ts and payments.ts for the full setup.

export default http;
