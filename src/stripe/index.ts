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
 * registerRoutes(http, components.stripe, withAffiliates(components.affiliates));
 * export default http;
 * ```
 *
 * ## With Checkout (using @convex-dev/stripe)
 *
 * ```typescript
 * // convex/payments.ts
 * import { action } from "./_generated/server";
 * import { v } from "convex/values";
 * import { getAffiliateMetadata } from "convex-affiliates/stripe";
 * import { stripe } from "./stripe";
 *
 * export const createCheckout = action({
 *   args: { priceId: v.string() },
 *   handler: async (ctx, { priceId }) => {
 *     // Get affiliate metadata for the current user
 *     const affiliateData = await getAffiliateMetadata(ctx, components.affiliates);
 *
 *     // Pass to @convex-dev/stripe's checkout
 *     return stripe.createCheckoutSession(ctx, {
 *       priceId,
 *       mode: "subscription",
 *       successUrl: "/success",
 *       cancelUrl: "/cancel",
 *       metadata: affiliateData, // { affiliate_code?: string }
 *     });
 *   },
 * });
 * ```
 *
 * ## Full Integration with Better Auth
 *
 * See the integration guide for complete setup with Better Auth and Stripe.
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Convex context with mutation/query capabilities.
 * Uses permissive types to accept any Convex context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ConvexCtx {
  runQuery: (query: any, args?: any) => Promise<any>;
  runMutation: (mutation: any, args?: any) => Promise<any>;
}

/**
 * Convex action context with auth.
 * Uses permissive types to accept any Convex action context.
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
 * Affiliate metadata to include in Stripe checkout
 */
export interface AffiliateMetadata {
  /** The affiliate code for attribution */
  affiliate_code?: string;
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
 * // Basic usage
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
      const result = (await ctx.runMutation(component.commissions.createFromInvoice, {
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
      })) as {
        commissionId?: string;
        affiliateId?: string;
        affiliateCode?: string;
        commissionAmountCents?: number;
      } | null;

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
      const result = (await ctx.runMutation(component.commissions.reverseByCharge, {
        stripeChargeId: charge.id,
        reason:
          (charge.refunds as { data?: Array<{ reason?: string }> })?.data?.[0]?.reason ??
          "Charge refunded",
      })) as {
        commissionId?: string;
        affiliateId?: string;
        commissionAmountCents?: number;
      } | null;

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
 * Get affiliate metadata for the current user to include in Stripe checkout.
 *
 * Looks up the user's referral and returns the affiliate code to include
 * in checkout metadata. This enables commission tracking when the payment
 * webhook fires.
 *
 * @param ctx - Convex action context (must have authenticated user)
 * @param component - The affiliates component (components.affiliates)
 * @returns Metadata object with affiliate_code (if user was referred)
 *
 * @example
 * ```typescript
 * // convex/payments.ts
 * import { getAffiliateMetadata } from "convex-affiliates/stripe";
 *
 * export const createCheckout = action({
 *   args: { priceId: v.string() },
 *   handler: async (ctx, { priceId }) => {
 *     const affiliateData = await getAffiliateMetadata(ctx, components.affiliates);
 *
 *     return stripe.createCheckoutSession(ctx, {
 *       priceId,
 *       mode: "subscription",
 *       successUrl: "/success",
 *       cancelUrl: "/cancel",
 *       metadata: affiliateData,
 *     });
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Merging with other metadata
 * const affiliateData = await getAffiliateMetadata(ctx, components.affiliates);
 *
 * return stripe.createCheckoutSession(ctx, {
 *   priceId,
 *   mode: "subscription",
 *   successUrl: "/success",
 *   cancelUrl: "/cancel",
 *   metadata: {
 *     ...affiliateData,
 *     plan: "pro",
 *     source: "landing-page",
 *   },
 * });
 * ```
 */
export async function getAffiliateMetadata(
  ctx: ConvexActionCtx,
  component: AffiliatesComponent
): Promise<AffiliateMetadata> {
  // Get user ID from auth context
  const identity = await ctx.auth.getUserIdentity();
  const userId = identity?.subject;

  if (!userId) {
    return {};
  }

  try {
    const discount = (await ctx.runQuery(component.referrals.getRefereeDiscount, {
      userId,
    })) as {
      affiliateCode?: string;
    } | null;

    if (discount?.affiliateCode) {
      return { affiliate_code: discount.affiliateCode };
    }
  } catch (error) {
    // Silently continue if lookup fails
    console.error("[convex-affiliates] Error looking up affiliate:", error);
  }

  return {};
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
