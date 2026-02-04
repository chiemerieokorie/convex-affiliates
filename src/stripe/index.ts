/**
 * Stripe Plugin for Convex Affiliates
 *
 * Automatically tracks affiliate commissions from Stripe payments.
 * Works with @convex-dev/stripe component.
 *
 * ## Quick Start (Recommended)
 *
 * ```typescript
 * // convex/stripe.ts
 * import { Stripe } from "@convex-dev/stripe";
 * import { AffiliateStripe } from "convex-affiliates/stripe";
 * import { components } from "./_generated/api";
 *
 * // Wrap Stripe with affiliate tracking
 * export const stripe = new AffiliateStripe(
 *   new Stripe(components.stripe),
 *   components.affiliates
 * );
 *
 * // convex/http.ts
 * import { httpRouter } from "convex/server";
 * import { registerRoutes } from "@convex-dev/stripe";
 * import { stripe } from "./stripe";
 *
 * const http = httpRouter();
 * registerRoutes(http, components.stripe, stripe.getRouteOptions());
 * export default http;
 *
 * // convex/payments.ts - checkout is automatic
 * export const createCheckout = action(async (ctx, { priceId }) => {
 *   const params = await stripe.createCheckoutSession(ctx, {
 *     priceId,
 *     successUrl: "/success",
 *     cancelUrl: "/cancel",
 *   });
 *   // params has affiliate data, just pass to Stripe API
 * });
 * ```
 *
 * ## Alternative: Direct withAffiliates
 *
 * ```typescript
 * // convex/http.ts
 * import { registerRoutes } from "@convex-dev/stripe";
 * import { withAffiliates } from "convex-affiliates/stripe";
 *
 * registerRoutes(http, components.stripe, withAffiliates(components.affiliates));
 * ```
 *
 * ## With Better Auth
 *
 * ```typescript
 * // Server: convex/auth.ts
 * import { affiliatePlugin } from "convex-affiliates/better-auth";
 * betterAuth({ plugins: [affiliatePlugin(ctx, components.affiliates)] });
 *
 * // Client: lib/auth-client.ts
 * import { affiliateClientPlugin } from "convex-affiliates/better-auth/client";
 * createAuthClient({ plugins: [affiliateClientPlugin()] });
 *
 * // Stripe: convex/stripe.ts
 * import { AffiliateStripe } from "convex-affiliates/stripe";
 * export const stripe = new AffiliateStripe(new Stripe(components.stripe), components.affiliates);
 *
 * // Now: signup tracks affiliate, checkout includes affiliate data, webhooks create commissions
 * ```
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
 * Checkout params to enrich
 */
export interface CheckoutParams {
  priceId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  /** Optional referral ID (from localStorage/cookie tracking) */
  referralId?: string;
  /** Optional affiliate code (fallback if no referralId) */
  affiliateCode?: string;
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

  // Extract affiliate params (don't include in final output)
  const { referralId, affiliateCode, ...baseParams } = params;

  // Start with base params
  const enriched: EnrichedCheckoutParams = {
    ...baseParams,
    metadata: { ...params.metadata },
  };

  // Set client_reference_id for webhook attribution (userId or referralId)
  if (userId) {
    enriched.client_reference_id = userId;
  } else if (referralId) {
    enriched.client_reference_id = referralId;
  }

  // Look up referral for discount - try multiple methods
  try {
    const discount = (await ctx.runQuery(component.referrals.getRefereeDiscount, {
      userId: userId ?? undefined,
      referralId: referralId ?? undefined,
      affiliateCode: affiliateCode ?? undefined,
    })) as {
      stripeCouponId?: string;
      affiliateCode?: string;
      discountType?: string;
      discountValue?: number;
    } | null;

    if (discount) {
      // Add affiliate code to metadata
      if (discount.affiliateCode) {
        enriched.metadata.affiliate_code = discount.affiliateCode;
      }

      // Add coupon if configured
      if (discount.stripeCouponId) {
        enriched.discounts = [{ coupon: discount.stripeCouponId }];
      }
    } else if (affiliateCode) {
      // No discount found but affiliate code was provided - still add to metadata
      enriched.metadata.affiliate_code = affiliateCode;
    }
  } catch (error) {
    // Silently continue if discount lookup fails
    console.error("[convex-affiliates] Error looking up discount:", error);

    // Still add affiliate code to metadata if provided
    if (affiliateCode) {
      enriched.metadata.affiliate_code = affiliateCode;
    }
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

// =============================================================================
// Stripe Instance Wrapper
// =============================================================================

/**
 * Options for AffiliateStripe wrapper
 */
export interface AffiliateStripeOptions {
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
 * Stripe component interface (from @convex-dev/stripe)
 */
interface StripeComponentApi {
  createCheckoutSession?: unknown;
  [key: string]: unknown;
}

/**
 * Wrapped Stripe instance with automatic affiliate tracking.
 *
 * Wraps @convex-dev/stripe to automatically:
 * - Handle webhooks for commission creation/reversal
 * - Enrich checkout sessions with affiliate data
 *
 * @example
 * ```typescript
 * // convex/stripe.ts
 * import { Stripe } from "@convex-dev/stripe";
 * import { AffiliateStripe } from "convex-affiliates/stripe";
 * import { components } from "./_generated/api";
 *
 * // Wrap the Stripe instance
 * export const stripe = new AffiliateStripe(
 *   new Stripe(components.stripe),
 *   components.affiliates
 * );
 *
 * // Use stripe.registerRoutes() - webhooks are automatic
 * // Use stripe.createCheckoutSession() - affiliate data is automatic
 * ```
 */
export class AffiliateStripe<T extends StripeComponentApi> {
  private stripeInstance: T;
  private affiliatesComponent: AffiliatesComponent;
  private options: AffiliateStripeOptions;

  constructor(
    stripeInstance: T,
    affiliatesComponent: AffiliatesComponent,
    options: AffiliateStripeOptions = {}
  ) {
    this.stripeInstance = stripeInstance;
    this.affiliatesComponent = affiliatesComponent;
    this.options = options;
  }

  /**
   * Get the underlying Stripe instance.
   */
  get stripe(): T {
    return this.stripeInstance;
  }

  /**
   * Get options for registerRoutes with affiliate handlers included.
   *
   * @param additionalOptions - Additional options to merge
   * @returns Options object for registerRoutes
   *
   * @example
   * ```typescript
   * registerRoutes(http, components.stripe, stripe.getRouteOptions());
   * ```
   */
  getRouteOptions(additionalOptions: StripeRegisterOptions = {}): StripeRegisterOptions {
    return withAffiliates(this.affiliatesComponent, {
      ...additionalOptions,
      onCommissionCreated: this.options.onCommissionCreated,
      onCommissionReversed: this.options.onCommissionReversed,
      onCustomerLinked: this.options.onCustomerLinked,
    });
  }

  /**
   * Create a checkout session with automatic affiliate data.
   *
   * Gets the user from auth context and enriches the session with:
   * - client_reference_id (userId for attribution)
   * - metadata.affiliate_code
   * - discounts[] (if campaign has coupon configured)
   *
   * @param ctx - Convex action context
   * @param params - Checkout params
   * @returns Enriched checkout params
   *
   * @example
   * ```typescript
   * export const createCheckout = action({
   *   args: { priceId: v.string() },
   *   handler: async (ctx, { priceId }) => {
   *     const params = await stripe.createCheckoutSession(ctx, {
   *       priceId,
   *       successUrl: "/success",
   *       cancelUrl: "/cancel",
   *     });
   *     // params is already enriched with affiliate data
   *     return stripeApi.checkout.sessions.create(params);
   *   },
   * });
   * ```
   */
  async createCheckoutSession(
    ctx: ConvexActionCtx,
    params: CheckoutParams
  ): Promise<EnrichedCheckoutParams> {
    return enrichCheckout(ctx, this.affiliatesComponent, params);
  }
}

/**
 * Create an AffiliateStripe instance.
 *
 * Factory function alternative to using `new AffiliateStripe()`.
 *
 * @param stripeInstance - The @convex-dev/stripe instance
 * @param affiliatesComponent - The affiliates component
 * @param options - Optional callbacks
 * @returns Wrapped Stripe instance
 *
 * @example
 * ```typescript
 * import { Stripe } from "@convex-dev/stripe";
 * import { createAffiliateStripe } from "convex-affiliates/stripe";
 *
 * export const stripe = createAffiliateStripe(
 *   new Stripe(components.stripe),
 *   components.affiliates,
 *   {
 *     onCommissionCreated: async (data) => {
 *       console.log(`Commission: $${data.amountCents / 100}`);
 *     },
 *   }
 * );
 * ```
 */
export function createAffiliateStripe<T extends StripeComponentApi>(
  stripeInstance: T,
  affiliatesComponent: AffiliatesComponent,
  options: AffiliateStripeOptions = {}
): AffiliateStripe<T> {
  return new AffiliateStripe(stripeInstance, affiliatesComponent, options);
}

