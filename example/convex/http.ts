import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { registerRoutes } from "chief_emerie";

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

// Example Stripe webhook handler that calls the affiliate component's public mutations.
// In production, you should use @convex-dev/stripe for proper webhook signature verification.
//
// For proper setup with @convex-dev/stripe:
// 1. Install: npm install @convex-dev/stripe
// 2. Configure stripe component in convex.config.ts
// 3. Use registerRoutes() with event handlers that call these mutations
//
// See: https://github.com/get-convex/convex-stripe
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // In production, you would verify the Stripe webhook signature.
    // This example is for demonstration purposes only.

    const stripeSignature = request.headers.get("stripe-signature");
    if (!stripeSignature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For production, use @convex-dev/stripe to verify signatures:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const event = stripe.webhooks.constructEvent(
    //   await request.text(),
    //   stripeSignature,
    //   process.env.STRIPE_WEBHOOK_SECRET
    // );

    const body = await request.json();
    const event = body as {
      type: string;
      data: { object: any };
    };

    try {
      switch (event.type) {
        case "invoice.paid": {
          // Create a commission when an invoice is paid
          const invoice = event.data.object;
          await ctx.runMutation(
            components.affiliates.commissions.createFromInvoice,
            {
              stripeInvoiceId: invoice.id,
              stripeCustomerId: invoice.customer,
              stripeSubscriptionId: invoice.subscription,
              stripeChargeId: invoice.charge,
              stripeProductId: invoice.lines?.data?.[0]?.price?.product,
              amountPaidCents: invoice.amount_paid,
              currency: invoice.currency,
              affiliateCode: invoice.metadata?.affiliate_code,
            }
          );
          break;
        }

        case "charge.refunded": {
          // Reverse commission when a charge is refunded
          const charge = event.data.object;
          await ctx.runMutation(
            components.affiliates.commissions.reverseByCharge,
            {
              stripeChargeId: charge.id,
              reason: charge.refunds?.data?.[0]?.reason ?? "Charge refunded",
            }
          );
          break;
        }

        case "checkout.session.completed": {
          // Link Stripe customer to affiliate referral
          const session = event.data.object;
          await ctx.runMutation(
            components.affiliates.referrals.linkStripeCustomer,
            {
              stripeCustomerId: session.customer,
              userId: session.client_reference_id,
              affiliateCode: session.metadata?.affiliate_code,
            }
          );
          break;
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
