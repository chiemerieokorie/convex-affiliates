/**
 * Stripe Plugin for Convex Affiliates
 *
 * Automatically tracks affiliate commissions from Stripe payments.
 * Works with @convex-dev/stripe component for webhooks.
 *
 * ## Quick Start - Webhooks
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
 * ## Checkout with Affiliate Tracking
 *
 * IMPORTANT: You must use the Stripe SDK directly and pass `client_reference_id`
 * for commission tracking to work. The `userId` links the Stripe customer to
 * the user's referral in the webhooks.
 *
 * ```typescript
 * // convex/payments.ts
 * import { action } from "./_generated/server";
 * import { v } from "convex/values";
 * import { getAffiliateMetadata } from "convex-affiliates/stripe";
 * import { components } from "./_generated/api";
 * import Stripe from "stripe";
 *
 * const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *
 * export const createCheckout = action({
 *   args: { priceId: v.string() },
 *   handler: async (ctx, { priceId }) => {
 *     // Get affiliate data: { userId, affiliate_code? }
 *     const { userId, ...metadata } = await getAffiliateMetadata(ctx, components.affiliates);
 *
 *     const session = await stripeSDK.checkout.sessions.create({
 *       mode: "subscription",
 *       line_items: [{ price: priceId, quantity: 1 }],
 *       success_url: `${process.env.BASE_URL}/success`,
 *       cancel_url: `${process.env.BASE_URL}/cancel`,
 *       client_reference_id: userId, // REQUIRED for commission tracking!
 *       metadata, // { affiliate_code?: string }
 *     });
 *
 *     return session.url;
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

import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

/**
 * Convex context with mutation/query capabilities.
 */
type ConvexCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

/**
 * Convex action context with auth.
 */
type ConvexActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "auth"
>;

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
  commissionAmountCents: number;
  currency: string;
}

/**
 * Commission reversed event data
 */
export interface CommissionReversedData {
  commissionId: string;
  affiliateId: string;
  commissionAmountCents: number;
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
 * Affiliate metadata to include in Stripe checkout.
 *
 * IMPORTANT: For commission tracking to work, you must pass `userId` as
 * `client_reference_id` when creating the Stripe checkout session.
 * This links the Stripe customer to the user's referral.
 */
export interface AffiliateMetadata {
  /** The affiliate code for attribution (pass to metadata) */
  affiliate_code?: string;
  /** The user ID for attribution (pass to client_reference_id) */
  userId?: string;
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
 *     console.log(`Commission created: $${data.commissionAmountCents / 100}`);
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
  component: ComponentApi,
  options: WithAffiliatesOptions = {}
): StripeRegisterOptions {
  const { events: userEvents, onCommissionCreated, onCommissionReversed, onCustomerLinked, ...rest } = options;

  // Create affiliate event handlers
  const affiliateEvents: Record<string, StripeEventHandler> = {
    "invoice.paid": async (ctx, event) => {
      const invoice = event.data.object as {
        id: string;
        customer: string;
        charge?: string;
        subscription?: string;
        lines?: { data?: Array<{ price?: { product?: string } }> };
        amount_paid: number;
        currency: string;
        metadata?: Record<string, string>;
      };
      if (!invoice.id || !invoice.customer || invoice.amount_paid == null || !invoice.currency) {
        return; // Skip malformed invoice events
      }
      const result = (await ctx.runMutation(component.commissions.createFromInvoice, {
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer,
        stripeChargeId: invoice.charge ?? undefined,
        stripeSubscriptionId: invoice.subscription ?? undefined,
        stripeProductId: invoice.lines?.data?.[0]?.price?.product ?? undefined,
        amountPaidCents: invoice.amount_paid,
        currency: invoice.currency,
        affiliateCode: invoice.metadata?.affiliate_code,
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
          commissionAmountCents: result.commissionAmountCents!,
          currency: invoice.currency,
        });
      }
    },

    "charge.refunded": async (ctx, event) => {
      const charge = event.data.object as {
        id: string;
        refunds?: { data?: Array<{ reason?: string }> };
      };
      const result = (await ctx.runMutation(component.commissions.reverseByCharge, {
        stripeChargeId: charge.id,
        reason: charge.refunds?.data?.[0]?.reason ?? "Charge refunded",
      })) as {
        commissionId?: string;
        affiliateId?: string;
        commissionAmountCents?: number;
      } | null;

      if (result?.commissionId && onCommissionReversed) {
        await safeCall(onCommissionReversed, {
          commissionId: result.commissionId,
          affiliateId: result.affiliateId!,
          commissionAmountCents: result.commissionAmountCents!,
          reason: charge.refunds?.data?.[0]?.reason,
        });
      }
    },

    "checkout.session.completed": async (ctx, event) => {
      const session = event.data.object as {
        customer: string;
        client_reference_id?: string;
        metadata?: Record<string, string>;
      };
      await ctx.runMutation(component.referrals.linkStripeCustomer, {
        stripeCustomerId: session.customer,
        userId: session.client_reference_id ?? undefined,
        affiliateCode: session.metadata?.affiliate_code,
      });

      if (onCustomerLinked) {
        await safeCall(onCustomerLinked, {
          stripeCustomerId: session.customer,
          userId: session.client_reference_id ?? undefined,
          affiliateCode: session.metadata?.affiliate_code,
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
 * Returns:
 * - `userId` - Pass as `client_reference_id` (REQUIRED for commission tracking)
 * - `affiliate_code` - Pass in `metadata` (if user was referred)
 *
 * IMPORTANT: You must pass `userId` as `client_reference_id` when creating
 * the Stripe checkout session. This is required for the webhook to link
 * the Stripe customer to the user's referral and create commissions.
 *
 * @param ctx - Convex action context (must have authenticated user)
 * @param component - The affiliates component (components.affiliates)
 * @returns Object with userId and affiliate_code (if user was referred)
 *
 * @example
 * ```typescript
 * // Using Stripe SDK directly (recommended for full control)
 * import Stripe from "stripe";
 * const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *
 * export const createCheckout = action({
 *   args: { priceId: v.string() },
 *   handler: async (ctx, { priceId }) => {
 *     const { userId, ...metadata } = await getAffiliateMetadata(ctx, components.affiliates);
 *
 *     const session = await stripeSDK.checkout.sessions.create({
 *       mode: "subscription",
 *       line_items: [{ price: priceId, quantity: 1 }],
 *       success_url: `${process.env.BASE_URL}/success`,
 *       cancel_url: `${process.env.BASE_URL}/cancel`,
 *       client_reference_id: userId, // REQUIRED for commission tracking!
 *       metadata, // { affiliate_code?: string }
 *     });
 *
 *     return session.url;
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Merging with other metadata
 * const { userId, ...affiliateMetadata } = await getAffiliateMetadata(ctx, components.affiliates);
 *
 * const session = await stripeSDK.checkout.sessions.create({
 *   mode: "subscription",
 *   line_items: [{ price: priceId, quantity: 1 }],
 *   success_url: "/success",
 *   cancel_url: "/cancel",
 *   client_reference_id: userId,
 *   metadata: {
 *     ...affiliateMetadata,
 *     plan: "pro",
 *     source: "landing-page",
 *   },
 * });
 * ```
 */
export async function getAffiliateMetadata(
  ctx: ConvexActionCtx,
  component: ComponentApi
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
      return { userId, affiliate_code: discount.affiliateCode };
    }
  } catch (error) {
    // Silently continue if lookup fails
    console.error("[convex-affiliates] Error looking up affiliate:", error);
  }

  // Always return userId even if no affiliate code found
  // This ensures client_reference_id is set for future attribution
  return { userId };
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
