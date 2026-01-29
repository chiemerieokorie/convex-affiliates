import { httpRouter } from "convex/server";
import { affiliates } from "./affiliates.js";

const http = httpRouter();

// Register HTTP routes for the affiliate component
affiliates.registerRoutes(http);

// Stripe webhook with signature verification
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: affiliates.createStripeWebhookHandler({
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

export default http;
