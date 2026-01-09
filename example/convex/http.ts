import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { components, internal } from "./_generated/api.js";
import { registerRoutes, AffiliateManager } from "chief_emerie";

const http = httpRouter();

// =============================================================================
// Affiliate Component Routes
// =============================================================================

// Register HTTP routes for the affiliate component
// This exposes endpoints like:
// - GET /affiliates/affiliate/:code - Validate affiliate code
// - POST /affiliates/webhooks/stripe - Stripe webhook endpoint (placeholder)
registerRoutes(http, components.affiliates, {
  pathPrefix: "/affiliates",
});

// =============================================================================
// Stripe Webhook Handler
// =============================================================================

// You should implement your own Stripe webhook handler to verify signatures
// and call the appropriate AffiliateManager methods.
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // In production, you would:
    // 1. Verify the Stripe webhook signature
    // 2. Parse the event
    // 3. Call the appropriate handler

    const stripeSignature = request.headers.get("stripe-signature");
    if (!stripeSignature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For now, this is a placeholder. In production:
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
          const invoice = event.data.object;
          await ctx.runMutation(
            components.affiliates.internal.stripe.handleInvoicePaid,
            {
              invoiceId: invoice.id,
              stripeCustomerId: invoice.customer,
              subscriptionId: invoice.subscription,
              amountPaidCents: invoice.amount_paid,
              currency: invoice.currency,
              affiliateCode: invoice.metadata?.affiliate_code,
              productId: invoice.lines?.data?.[0]?.price?.product,
              chargeId: invoice.charge,
            }
          );
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object;
          await ctx.runMutation(
            components.affiliates.internal.stripe.handleChargeRefunded,
            {
              chargeId: charge.id,
              stripeCustomerId: charge.customer,
              refundAmountCents: charge.amount_refunded,
              reason: charge.refunds?.data?.[0]?.reason,
            }
          );
          break;
        }

        case "checkout.session.completed": {
          const session = event.data.object;
          await ctx.runMutation(
            components.affiliates.internal.stripe.handleCheckoutCompleted,
            {
              sessionId: session.id,
              stripeCustomerId: session.customer,
              affiliateCode: session.metadata?.affiliate_code,
              userId: session.client_reference_id,
            }
          );
          break;
        }

        case "account.updated": {
          // Handle Stripe Connect account updates
          const account = event.data.object;
          await ctx.runMutation(
            components.affiliates.internal.connect.handleAccountUpdated,
            {
              stripeConnectAccountId: account.id,
              chargesEnabled: account.charges_enabled ?? false,
              payoutsEnabled: account.payouts_enabled ?? false,
              detailsSubmitted: account.details_submitted ?? false,
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
