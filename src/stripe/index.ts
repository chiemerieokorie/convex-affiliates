/**
 * Stripe Plugin for Convex Affiliates
 *
 * Automatically tracks affiliate commissions from Stripe payments.
 * Works with @convex-dev/stripe component.
 *
 * ## Quick Start
 *
 * ```typescript
 * // convex/http.ts
 * import { httpRouter } from "convex/server";
 * import { registerRoutes } from "@convex-dev/stripe";
 * import { withAffiliates } from "convex-affiliates/stripe";
 * import { components } from "./_generated/api";
 *
 * const http = httpRouter();
 *
 * // One line - that's it!
 * registerRoutes(http, components.stripe, withAffiliates(components.affiliates));
 *
 * export default http;
 * ```
 *
 * ## With Custom Handlers
 *
 * ```typescript
 * registerRoutes(http, components.stripe, withAffiliates(components.affiliates, {
 *   events: {
 *     // Your handler runs AFTER affiliate logic
 *     "invoice.paid": async (ctx, event) => {
 *       await sendSlackNotification(event);
 *     },
 *   },
 * }));
 * ```
 *
 * ## Checkout with Affiliate Data
 *
 * ```typescript
 * // convex/payments.ts
 * import { enrichCheckout } from "convex-affiliates/stripe";
 *
 * export const createCheckout = action(async (ctx, { priceId }) => {
 *   // Automatically adds affiliate data for logged-in user
 *   const params = await enrichCheckout(ctx, components.affiliates, {
 *     priceId,
 *     successUrl: "/success",
 *     cancelUrl: "/cancel",
 *   });
 *
 *   return stripe.checkout.sessions.create(params);
 * });
 * ```
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Convex context with mutation/query capabilities
 */
interface ConvexCtx {
  runQuery: <T>(query: unknown, args?: unknown) => Promise<T>;
  runMutation: <T>(mutation: unknown, args?: unknown) => Promise<T>;
}

/**
 * Convex action context with auth
 */
interface ConvexActionCtx extends ConvexCtx {
  auth: {
    getUserIdentity: () => Promise<{ subject: string } | null>;
  };
}

/**
 * Stripe event shape
 */
interface StripeEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

/**
 * Stripe event handler
 */
type StripeEventHandler = (ctx: ConvexCtx, event: StripeEvent) => Promise<void>;

/**
 * The affiliates component API shape
 */
interface AffiliatesComponent {
  commissions: {
    createFromInvoice: unknown;
    reverseByCharge: unknown;
  };
  referrals: {
    linkStripeCustomer: unknown;
    getByUserId: unknown;
    getRefereeDiscount: unknown;
  };
}

/**
 * Options for @convex-dev/stripe registerRoutes
 */
interface StripeRegisterOptions {
  events?: Record<string, StripeEventHandler>;
  [key: string]: unknown;
}

/**
 * Commission created event data
 */
export interface CommissionCreatedData {
  commissionId: string;
  affiliateId: string;
  affiliateCode: string;
  amountCents: number;
  currency: string;
}

/**
 * Commission reversed event data
 */
export interface CommissionReversedData {
  commissionId: string;
  affiliateId: string;
  amountCents: number;
  reason?: string;
}

/**
 * Customer linked event data
 */
export interface CustomerLinkedData {
  stripeCustomerId: string;
  userId?: string;
  affiliateCode?: string;
}

/**
 * Options for withAffiliates
 */
export interface WithAffiliatesOptions extends StripeRegisterOptions {
  /**
   * Called when a commission is created from a paid invoice.
   */
  onCommissionCreated?: (data: CommissionCreatedData) => Promise<void>;

  /**
   * Called when a commission is reversed (refund/chargeback).
   */
  onCommissionReversed?: (data: CommissionReversedData) => Promise<void>;

  /**
   * Called when a Stripe customer is linked to an affiliate.
   */
  onCustomerLinked?: (data: CustomerLinkedData) => Promise<void>;
}

/**
 * Checkout params to enrich
 */
export interface CheckoutParams {
  priceId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Enriched checkout params with affiliate data
 */
export interface EnrichedCheckoutParams extends CheckoutParams {
  client_reference_id?: string;
  metadata: Record<string, string>;
  discounts?: Array<{ coupon: string }>;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Wrap @convex-dev/stripe options with automatic affiliate tracking.
 *
 * Handles these Stripe webhook events:
 * - `invoice.paid` → Creates commission for affiliate
 * - `charge.refunded` → Reverses commission
 * - `checkout.session.completed` → Links Stripe customer to affiliate
 *
 * @param component - The affiliates component (components.affiliates)
 * @param options - Optional @convex-dev/stripe options and callbacks
 * @returns Options object to pass to registerRoutes
 *
 * @example
 * ```typescript
 * // Basic usage - just works
 * registerRoutes(http, components.stripe, withAffiliates(components.affiliates));
 * ```
 *
 * @example
 * ```typescript
 * // With callbacks
 * registerRoutes(http, components.stripe, withAffiliates(components.affiliates, {
 *   onCommissionCreated: async (data) => {
 *     console.log(`Commission created: $${data.amountCents / 100}`);
 *   },
 * }));
 * ```
 *
 * @example
 * ```typescript
 * // With your own event handlers (both run - affiliate first, then yours)
 * registerRoutes(http, components.stripe, withAffiliates(components.affiliates, {
 *   events: {
 *     "invoice.paid": async (ctx, event) => {
 *       // This runs AFTER affiliate commission is created
 *       await notifyTeam(event);
 *     },
 *   },
 * }));
 * ```
 */
export function withAffiliates(
  component: AffiliatesComponent,
  options: WithAffiliatesOptions = {}
): StripeRegisterOptions {
  const { events: userEvents, onCommissionCreated, onCommissionReversed, onCustomerLinked, ...rest } = options;

  // Create affiliate event handlers
  const affiliateEvents: Record<string, StripeEventHandler> = {
    "invoice.paid": async (ctx, event) => {
      const invoice = event.data.object;
      const result = await ctx.runMutation<{
        commissionId?: string;
        affiliateId?: string;
        affiliateCode?: string;
        commissionAmountCents?: number;
      } | null>(component.commissions.createFromInvoice, {
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer,
        stripeChargeId: invoice.charge ?? undefined,
        stripeSubscriptionId: invoice.subscription ?? undefined,
        stripeProductId:
          (invoice.lines as { data?: Array<{ price?: { product?: string } }> })
            ?.data?.[0]?.price?.product ?? undefined,
        amountPaidCents: invoice.amount_paid,
        currency: invoice.currency,
        affiliateCode: (invoice.metadata as Record<string, string>)?.affiliate_code,
      });

      if (result?.commissionId && onCommissionCreated) {
        await safeCall(onCommissionCreated, {
          commissionId: result.commissionId,
          affiliateId: result.affiliateId!,
          affiliateCode: result.affiliateCode!,
          amountCents: result.commissionAmountCents!,
          currency: invoice.currency as string,
        });
      }
    },

    "charge.refunded": async (ctx, event) => {
      const charge = event.data.object;
      const result = await ctx.runMutation<{
        commissionId?: string;
        affiliateId?: string;
        commissionAmountCents?: number;
      } | null>(component.commissions.reverseByCharge, {
        stripeChargeId: charge.id,
        reason:
          (charge.refunds as { data?: Array<{ reason?: string }> })?.data?.[0]?.reason ??
          "Charge refunded",
      });

      if (result?.commissionId && onCommissionReversed) {
        await safeCall(onCommissionReversed, {
          commissionId: result.commissionId,
          affiliateId: result.affiliateId!,
          amountCents: result.commissionAmountCents!,
          reason: (charge.refunds as { data?: Array<{ reason?: string }> })?.data?.[0]?.reason,
        });
      }
    },

    "checkout.session.completed": async (ctx, event) => {
      const session = event.data.object;
      await ctx.runMutation(component.referrals.linkStripeCustomer, {
        stripeCustomerId: session.customer,
        userId: session.client_reference_id ?? undefined,
        affiliateCode: (session.metadata as Record<string, string>)?.affiliate_code,
      });

      if (onCustomerLinked) {
        await safeCall(onCustomerLinked, {
          stripeCustomerId: session.customer as string,
          userId: (session.client_reference_id as string) ?? undefined,
          affiliateCode: (session.metadata as Record<string, string>)?.affiliate_code,
        });
      }
    },
  };

  // Compose affiliate handlers with user handlers
  const composedEvents = composeEventHandlers(affiliateEvents, userEvents ?? {});

  return {
    ...rest,
    events: composedEvents,
  };
}

/**
 * Enrich checkout params with affiliate data for the logged-in user.
 *
 * Automatically:
 * - Gets user ID from auth context
 * - Looks up user's referral
 * - Adds `client_reference_id` for attribution tracking
 * - Adds `metadata.affiliate_code`
 * - Adds discount coupon if campaign has one configured
 *
 * @param ctx - Convex action context
 * @param component - The affiliates component (components.affiliates)
 * @param params - Base checkout params
 * @returns Enriched params with affiliate data
 *
 * @example
 * ```typescript
 * // convex/payments.ts
 * export const createCheckout = action(async (ctx, { priceId }) => {
 *   const params = await enrichCheckout(ctx, components.affiliates, {
 *     priceId,
 *     successUrl: `${process.env.SITE_URL}/success`,
 *     cancelUrl: `${process.env.SITE_URL}/cancel`,
 *   });
 *
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *   const session = await stripe.checkout.sessions.create({
 *     mode: "subscription",
 *     line_items: [{ price: params.priceId, quantity: 1 }],
 *     success_url: params.successUrl,
 *     cancel_url: params.cancelUrl,
 *     client_reference_id: params.client_reference_id,
 *     metadata: params.metadata,
 *     discounts: params.discounts,
 *   });
 *
 *   return session.url;
 * });
 * ```
 */
export async function enrichCheckout(
  ctx: ConvexActionCtx,
  component: AffiliatesComponent,
  params: CheckoutParams
): Promise<EnrichedCheckoutParams> {
  // Get user ID from auth context
  const identity = await ctx.auth.getUserIdentity();
  const userId = identity?.subject;

  // Start with base params
  const enriched: EnrichedCheckoutParams = {
    ...params,
    metadata: { ...params.metadata },
  };

  if (!userId) {
    return enriched;
  }

  // Set client_reference_id for webhook attribution
  enriched.client_reference_id = userId;

  // Look up user's referral for discount
  try {
    const discount = await ctx.runQuery<{
      stripeCouponId?: string;
      affiliateCode?: string;
      discountType?: string;
      discountValue?: number;
    } | null>(component.referrals.getRefereeDiscount, { userId });

    if (discount) {
      // Add affiliate code to metadata
      if (discount.affiliateCode) {
        enriched.metadata.affiliate_code = discount.affiliateCode;
      }

      // Add coupon if configured
      if (discount.stripeCouponId) {
        enriched.discounts = [{ coupon: discount.stripeCouponId }];
      }
    }
  } catch (error) {
    // Silently continue if discount lookup fails
    console.error("[convex-affiliates] Error looking up discount:", error);
  }

  return enriched;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compose two sets of event handlers.
 * When both have a handler for the same event, both run (first handler, then second).
 */
function composeEventHandlers(
  first: Record<string, StripeEventHandler>,
  second: Record<string, StripeEventHandler>
): Record<string, StripeEventHandler> {
  const composed: Record<string, StripeEventHandler> = { ...first };

  for (const [eventType, handler] of Object.entries(second)) {
    const existingHandler = composed[eventType];
    if (existingHandler) {
      // Both have handlers - run first, then second
      composed[eventType] = async (ctx, event) => {
        await existingHandler(ctx, event);
        await handler(ctx, event);
      };
    } else {
      composed[eventType] = handler;
    }
  }

  return composed;
}

/**
 * Safely call a callback, catching and logging errors.
 */
async function safeCall<T>(fn: (data: T) => Promise<void>, data: T): Promise<void> {
  try {
    await fn(data);
  } catch (error) {
    console.error("[convex-affiliates] Callback error:", error);
  }
}
