import {
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
  paginationOptsValidator,
} from "convex/server";
import type { Auth, FunctionReference, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

// =============================================================================
// Type Utilities
// =============================================================================

/**
 * Recursively transforms ComponentApi to accept any visibility.
 * This allows host apps to pass `components.affiliates` without type assertions,
 * regardless of how Convex generates the function reference visibility.
 *
 * @example
 * ```typescript
 * // Works without type assertions
 * const affiliates = createAffiliateApi(components.affiliates, { ... });
 * ```
 */
export type UseApi<API> = API extends FunctionReference<
  infer FType,
  infer _Visibility,
  infer Args,
  infer Returns,
  infer Name
>
  ? FunctionReference<FType, "public" | "internal", Args, Returns, Name>
  : API extends object
    ? { [K in keyof API]: UseApi<API[K]> }
    : API;
import {
  affiliateStatusValidator,
  payoutTermValidator,
  commissionTypeValidator,
  commissionStatusValidator,
  payoutStatusValidator,
  promoContentValidator,
  socialsValidator,
  customCopyValidator,
} from "../component/validators.js";

// =============================================================================
// Stripe Handler Types (local definition to avoid duplicate type issues)
// =============================================================================

/**
 * Generic Stripe event handler context type.
 * Matches the ctx parameter from @convex-dev/stripe handlers.
 */
type StripeHandlerCtx = {
  runQuery: (query: any, args?: any) => Promise<any>;
  runMutation: (mutation: any, args?: any) => Promise<any>;
  runAction: (action: any, args?: any) => Promise<any>;
};

/**
 * Generic Stripe event type.
 * Matches the event parameter from @convex-dev/stripe handlers.
 */
type StripeEvent = {
  type: string;
  data: { object: unknown };
};

/**
 * Generic Stripe event handler function type.
 */
type StripeHandler = (ctx: StripeHandlerCtx, event: StripeEvent) => Promise<void>;

/**
 * Map of Stripe event types to their handlers.
 * Compatible with @convex-dev/stripe's AffiliateStripeHandlers type.
 */
export type AffiliateStripeHandlers = {
  [eventType: string]: StripeHandler | undefined;
};

// =============================================================================
// Lifecycle Hook Types (Type-Safe Event Handlers)
// =============================================================================

/**
 * Data passed to affiliate.registered hook.
 */
export interface AffiliateRegisteredData {
  affiliateId: string;
  affiliateCode: string;
  affiliateEmail: string;
  affiliateUserId: string;
}

/**
 * Data passed to affiliate status change hooks (approved, rejected, suspended).
 */
export interface AffiliateStatusChangeData {
  affiliateId: string;
  affiliateCode: string;
  affiliateEmail: string;
  affiliateUserId: string;
}

/**
 * Data passed to commission.created hook.
 */
export interface CommissionCreatedData {
  commissionId: string;
  affiliateId: string;
  affiliateCode: string;
  commissionAmountCents: number;
  currency: string;
}

/**
 * Data passed to commission.reversed hook.
 */
export interface CommissionReversedData {
  commissionId: string;
  affiliateId: string;
  commissionAmountCents: number;
}


/**
 * Type-safe hooks interface for affiliate lifecycle events.
 * Each event has its own typed handler function.
 *
 * @example
 * ```typescript
 * const api = createAffiliateApi(components.affiliates, {
 *   auth: async (ctx) => { ... },
 *   hooks: {
 *     "affiliate.registered": async (data) => {
 *       // data is typed as AffiliateRegisteredData
 *       await sendEmail(data.affiliateEmail, "Welcome!");
 *     },
 *     "affiliate.approved": async (data) => {
 *       // data is typed as AffiliateStatusChangeData
 *       await sendEmail(data.affiliateEmail, "You're approved!");
 *     },
 *     "commission.created": async (data) => {
 *       // data is typed as CommissionCreatedData
 *       await sendEmail(data.affiliateEmail, `You earned $${data.commissionAmountCents / 100}!`);
 *     },
 *   },
 * });
 * ```
 */
export interface AffiliateHooks {
  "affiliate.registered"?: (data: AffiliateRegisteredData) => Promise<void>;
  "affiliate.approved"?: (data: AffiliateStatusChangeData) => Promise<void>;
  "affiliate.rejected"?: (data: AffiliateStatusChangeData) => Promise<void>;
  "affiliate.suspended"?: (data: AffiliateStatusChangeData) => Promise<void>;
  "commission.created"?: (data: CommissionCreatedData) => Promise<void>;
  "commission.reversed"?: (data: CommissionReversedData) => Promise<void>;
}

// =============================================================================
// Types
// =============================================================================

export interface AffiliateConfig {
  /**
   * Default commission type for new campaigns.
   */
  defaultCommissionType?: "percentage" | "fixed";

  /**
   * Default commission value (percentage 0-100 or fixed cents).
   */
  defaultCommissionValue?: number;

  /**
   * Default payout term for new campaigns.
   */
  defaultPayoutTerm?: "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";

  /**
   * Minimum payout amount in cents.
   */
  minPayoutCents?: number;

  /**
   * Default cookie duration in days.
   */
  defaultCookieDurationDays?: number;

  /**
   * Base URL for generating affiliate links.
   */
  baseUrl?: string;
}

export interface CreateAffiliateApiConfig extends AffiliateConfig {
  /**
   * Authentication function that returns the user ID.
   * Called for all authenticated endpoints.
   */
  auth: (ctx: { auth: Auth }) => Promise<string>;

  /**
   * Optional admin check function.
   * If not provided, admin endpoints will use the auth function only.
   */
  isAdmin?: (ctx: { auth: Auth }) => Promise<boolean>;

  /**
   * Optional type-safe hooks for affiliate lifecycle events.
   * Each hook receives typed data specific to that event.
   *
   * @example
   * ```typescript
   * hooks: {
   *   "affiliate.registered": async (data) => {
   *     await sendEmail(data.affiliateEmail, "Welcome!");
   *   },
   *   "affiliate.approved": async (data) => {
   *     await sendEmail(data.affiliateEmail, "You're approved!");
   *   },
   * }
   * ```
   */
  hooks?: AffiliateHooks;
}

// Context types for internal use
type QueryCtx = { runQuery: any; auth: Auth };
type MutationCtx = { runQuery: any; runMutation: any; auth: Auth };
type _ActionCtx = { runQuery: any; runMutation: any; runAction: any; auth: Auth };

// =============================================================================
// createAffiliateApi - Main API Factory
// =============================================================================

/**
 * Create a complete affiliate API with all queries, mutations, and actions.
 * Returns ready-to-use Convex functions that can be directly exported.
 *
 * @example
 * ```typescript
 * // convex/affiliates.ts
 * import { createAffiliateApi } from "chief_emerie";
 * import { components } from "./_generated/api";
 *
 * export const {
 *   trackClick,
 *   register,
 *   getPortalData,
 *   adminDashboard,
 * } = createAffiliateApi(components.affiliates, {
 *   defaultCommissionValue: 25,
 *   auth: async (ctx) => {
 *     const identity = await ctx.auth.getUserIdentity();
 *     if (!identity) throw new Error("Not authenticated");
 *     return identity.subject;
 *   },
 * });
 * ```
 */
export function createAffiliateApi(
  component: UseApi<ComponentApi>,
  config: CreateAffiliateApiConfig
) {
  const defaults = {
    defaultCommissionType: config.defaultCommissionType ?? "percentage",
    defaultCommissionValue: config.defaultCommissionValue ?? 20,
    defaultPayoutTerm: config.defaultPayoutTerm ?? "NET-30",
    defaultCookieDurationDays: config.defaultCookieDurationDays ?? 30,
    minPayoutCents: config.minPayoutCents ?? 5000,
  };

  // Helper to ensure default campaign exists (lazy initialization)
  const ensureDefaultCampaign = async (ctx: MutationCtx) => {
    let campaign = await ctx.runQuery(component.campaigns.getDefault);
    if (!campaign) {
      await ctx.runMutation(component.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: defaults.defaultCommissionType,
        commissionValue: defaults.defaultCommissionValue,
        payoutTerm: defaults.defaultPayoutTerm,
        cookieDurationDays: defaults.defaultCookieDurationDays,
        minPayoutCents: defaults.minPayoutCents,
        isDefault: true,
      });
      campaign = await ctx.runQuery(component.campaigns.getDefault);
    }
    return campaign!;
  };

  // Helper to check admin access
  const requireAdmin = async (ctx: { auth: Auth }) => {
    if (config.isAdmin) {
      const isAdmin = await config.isAdmin(ctx);
      if (!isAdmin) throw new Error("Not authorized - admin access required");
    } else {
      // Fall back to just requiring auth
      await config.auth(ctx);
    }
  };

  // Helper to get affiliate by userId
  const getAffiliateByUserId = async (ctx: QueryCtx, userId: string) => {
    return ctx.runQuery(component.affiliates.getByUserId, { userId });
  };

  // Helper to call lifecycle hooks safely (errors are logged, not thrown)
  async function callHook<K extends keyof AffiliateHooks>(
    hookName: K,
    data: Parameters<NonNullable<AffiliateHooks[K]>>[0]
  ): Promise<void> {
    const hook = config.hooks?.[hookName];
    if (hook) {
      try {
        await hook(data as never);
      } catch (error) {
        // Log but don't fail the mutation if hook fails
        console.error(`Hook error for ${hookName}:`, error);
      }
    }
  }

  return {
    // =========================================================================
    // PUBLIC ENDPOINTS (no authentication required)
    // =========================================================================

    /**
     * Track when a visitor clicks an affiliate link.
     * Returns a referral ID that should be stored client-side.
     */
    trackClick: mutationGeneric({
      args: {
        affiliateCode: v.string(),
        landingPage: v.string(),
        referrer: v.optional(v.string()),
        userAgent: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
        subId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return ctx.runMutation(component.referrals.trackClick, args);
      },
    }),

    /**
     * Validate an affiliate code and get basic info.
     */
    validateCode: queryGeneric({
      args: { code: v.string() },
      handler: async (ctx, args) => {
        const affiliate = await ctx.runQuery(component.affiliates.getByCode, {
          code: args.code.toUpperCase(),
        });
        if (!affiliate) return null;
        return {
          valid: affiliate.status === "approved",
          displayName: affiliate.displayName,
          code: affiliate.code,
        };
      },
    }),

    // =========================================================================
    // AUTHENTICATED ENDPOINTS (require user login)
    // =========================================================================

    /**
     * Register as a new affiliate.
     */
    register: mutationGeneric({
      args: {
        email: v.string(),
        displayName: v.optional(v.string()),
        website: v.optional(v.string()),
        socialMedia: v.optional(v.string()),
        customCode: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await config.auth(ctx);
        const campaign = await ensureDefaultCampaign(ctx);
        const result = await ctx.runMutation(component.affiliates.register, {
          userId,
          email: args.email,
          displayName: args.displayName,
          website: args.website,
          socialMedia: args.socialMedia,
          campaignId: campaign._id,
          customCode: args.customCode,
        });

        // Call hook for new registration
        await callHook("affiliate.registered", {
          affiliateId: result.affiliateId,
          affiliateCode: result.code,
          affiliateEmail: args.email,
          affiliateUserId: userId,
        });

        return result;
      },
    }),

    /**
     * Get the current user's affiliate profile.
     */
    getAffiliate: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await config.auth(ctx);
        return ctx.runQuery(component.affiliates.getByUserId, { userId });
      },
    }),

    /**
     * Update the current user's affiliate profile.
     */
    updateProfile: mutationGeneric({
      args: {
        displayName: v.optional(v.string()),
        bio: v.optional(v.string()),
        promoContent: v.optional(promoContentValidator),
        website: v.optional(v.string()),
        socials: v.optional(socialsValidator),
        customCopy: v.optional(customCopyValidator),
        payoutEmail: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await config.auth(ctx);
        const affiliate = await ctx.runQuery(component.affiliates.getByUserId, {
          userId,
        });
        if (!affiliate) {
          throw new Error("User is not an affiliate");
        }
        return ctx.runMutation(component.affiliates.updateProfile, {
          affiliateId: affiliate._id,
          ...args,
        });
      },
    }),

    /**
     * Get complete portal data for the affiliate dashboard.
     */
    getPortalData: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await config.auth(ctx);
        return ctx.runQuery(component.analytics.getPortalData, { userId });
      },
    }),

    /**
     * List commissions with pagination.
     */
    listCommissions: queryGeneric({
      args: {
        status: v.optional(commissionStatusValidator),
        paginationOpts: paginationOptsValidator,
      },
      handler: async (ctx, args) => {
        const userId = await config.auth(ctx);
        const affiliate = await getAffiliateByUserId(ctx, userId);
        if (!affiliate) {
          return { page: [], isDone: true, continueCursor: "" };
        }
        return ctx.runQuery(component.commissions.listByAffiliate, {
          affiliateId: affiliate._id,
          status: args.status,
          paginationOpts: args.paginationOpts,
        });
      },
    }),

    /**
     * List payouts with pagination.
     */
    listPayouts: queryGeneric({
      args: {
        status: v.optional(payoutStatusValidator),
        paginationOpts: paginationOptsValidator,
      },
      handler: async (ctx, args) => {
        const userId = await config.auth(ctx);
        const affiliate = await getAffiliateByUserId(ctx, userId);
        if (!affiliate) {
          return { page: [], isDone: true, continueCursor: "" };
        }
        return ctx.runQuery(component.payouts.listByAffiliate, {
          affiliateId: affiliate._id,
          status: args.status,
          paginationOpts: args.paginationOpts,
        });
      },
    }),

    /**
     * List referrals/clicks.
     */
    listReferrals: queryGeneric({
      args: {
        status: v.optional(
          v.union(
            v.literal("clicked"),
            v.literal("signed_up"),
            v.literal("converted"),
            v.literal("expired")
          )
        ),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await config.auth(ctx);
        const affiliate = await getAffiliateByUserId(ctx, userId);
        if (!affiliate) {
          return [];
        }
        return ctx.runQuery(component.referrals.listByAffiliate, {
          affiliateId: affiliate._id,
          status: args.status,
          limit: args.limit,
        });
      },
    }),

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Generate an affiliate link for the current user.
     */
    generateLink: queryGeneric({
      args: {
        path: v.optional(v.string()),
        subId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await config.auth(ctx);
        const affiliate = await ctx.runQuery(component.affiliates.getByUserId, {
          userId,
        });
        if (!affiliate) {
          throw new Error("User is not an affiliate");
        }
        const baseUrl = config.baseUrl ?? "";
        const url = new URL(args.path ?? "/", baseUrl);
        url.searchParams.set("ref", affiliate.code);
        if (args.subId) {
          url.searchParams.set("sub", args.subId);
        }
        return url.toString();
      },
    }),

    /**
     * Attribute a signup to an affiliate (call after user registration).
     */
    attributeSignup: mutationGeneric({
      args: {
        userId: v.string(),
        referralCode: v.optional(v.string()),
        referralId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        // Try by referral ID first
        if (args.referralId) {
          const referral = await ctx.runQuery(
            component.referrals.getByReferralId,
            { referralId: args.referralId }
          );
          if (referral && referral.status === "clicked") {
            await ctx.runMutation(component.referrals.attributeSignup, {
              referralId: referral._id,
              userId: args.userId,
            });
            return { attributed: true };
          }
        }

        // Try by affiliate code
        if (args.referralCode) {
          const result = await ctx.runMutation(
            component.referrals.attributeSignupByCode,
            {
              userId: args.userId,
              affiliateCode: args.referralCode,
            }
          );
          return { attributed: result.success, affiliateCode: args.referralCode };
        }

        return { attributed: false };
      },
    }),

    // =========================================================================
    // ADMIN ENDPOINTS
    // =========================================================================

    /**
     * Get admin dashboard overview.
     */
    adminDashboard: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await requireAdmin(ctx);
        return ctx.runQuery(component.analytics.getAdminDashboard);
      },
    }),

    /**
     * List all affiliates with optional filters.
     */
    adminListAffiliates: queryGeneric({
      args: {
        status: v.optional(affiliateStatusValidator),
        campaignId: v.optional(v.id("campaigns")),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return ctx.runQuery(component.affiliates.list, args);
      },
    }),

    /**
     * Get top performing affiliates.
     */
    adminTopAffiliates: queryGeneric({
      args: {
        sortBy: v.optional(
          v.union(
            v.literal("conversions"),
            v.literal("revenue"),
            v.literal("commissions")
          )
        ),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return ctx.runQuery(component.analytics.getTopAffiliates, args);
      },
    }),

    /**
     * Approve an affiliate application.
     */
    adminApproveAffiliate: mutationGeneric({
      args: { affiliateId: v.id("affiliates") },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Get affiliate info before approval for hook
        const affiliateData = await ctx.runQuery(component.affiliates.getById, {
          affiliateId: args.affiliateId,
        });

        await ctx.runMutation(component.affiliates.approve, args);

        // Call hook for approval
        if (affiliateData) {
          await callHook("affiliate.approved", {
            affiliateId: args.affiliateId,
            affiliateCode: affiliateData.code,
            affiliateUserId: affiliateData.userId,
            affiliateEmail: affiliateData.payoutEmail ?? "",
          });
        }

        return null;
      },
    }),

    /**
     * Reject an affiliate application.
     */
    adminRejectAffiliate: mutationGeneric({
      args: {
        affiliateId: v.id("affiliates"),
        reason: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Get affiliate info before rejection for hook
        const affiliateData = await ctx.runQuery(component.affiliates.getById, {
          affiliateId: args.affiliateId,
        });

        await ctx.runMutation(component.affiliates.reject, args);

        // Call hook for rejection
        if (affiliateData) {
          await callHook("affiliate.rejected", {
            affiliateId: args.affiliateId,
            affiliateCode: affiliateData.code,
            affiliateUserId: affiliateData.userId,
            affiliateEmail: affiliateData.payoutEmail ?? "",
          });
        }

        return null;
      },
    }),

    /**
     * Suspend an active affiliate.
     */
    adminSuspendAffiliate: mutationGeneric({
      args: { affiliateId: v.id("affiliates") },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Get affiliate info before suspension for hook
        const affiliateData = await ctx.runQuery(component.affiliates.getById, {
          affiliateId: args.affiliateId,
        });

        await ctx.runMutation(component.affiliates.suspend, args);

        // Call hook for suspension
        if (affiliateData) {
          await callHook("affiliate.suspended", {
            affiliateId: args.affiliateId,
            affiliateCode: affiliateData.code,
            affiliateUserId: affiliateData.userId,
            affiliateEmail: affiliateData.payoutEmail ?? "",
          });
        }

        return null;
      },
    }),

    /**
     * List all campaigns.
     */
    adminListCampaigns: queryGeneric({
      args: {
        activeOnly: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return ctx.runQuery(component.campaigns.list, args);
      },
    }),

    /**
     * Create a new campaign.
     */
    adminCreateCampaign: mutationGeneric({
      args: {
        name: v.string(),
        slug: v.string(),
        description: v.optional(v.string()),
        commissionType: commissionTypeValidator,
        commissionValue: v.number(),
        payoutTerm: v.optional(payoutTermValidator),
        cookieDurationDays: v.optional(v.number()),
        minPayoutCents: v.optional(v.number()),
        allowedProducts: v.optional(v.array(v.string())),
        excludedProducts: v.optional(v.array(v.string())),
      },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return ctx.runMutation(component.campaigns.create, {
          ...args,
          payoutTerm: args.payoutTerm ?? defaults.defaultPayoutTerm,
          cookieDurationDays:
            args.cookieDurationDays ?? defaults.defaultCookieDurationDays,
          minPayoutCents: args.minPayoutCents ?? defaults.minPayoutCents,
        });
      },
    }),
  };
}

// =============================================================================
// HTTP Routes Helper
// =============================================================================

/**
 * Register HTTP routes for affiliate functionality.
 * Useful for public API endpoints and webhook handling.
 */
export function registerRoutes(
  http: HttpRouter,
  component: UseApi<ComponentApi>,
  options: {
    pathPrefix?: string;
  } = {}
) {
  const prefix = options.pathPrefix ?? "/affiliates";

  // Get affiliate by code (public endpoint for link validation)
  http.route({
    path: `${prefix}/affiliate/:code`,
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const code = url.pathname.split("/").pop();

      if (!code) {
        return new Response(JSON.stringify({ error: "Code required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const affiliate = await ctx.runQuery(component.affiliates.getByCode, {
        code: code.toUpperCase(),
      });

      if (!affiliate) {
        return new Response(JSON.stringify({ error: "Affiliate not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          code: affiliate.code,
          displayName: affiliate.displayName,
          valid: affiliate.status === "approved",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }),
  });
}

// =============================================================================
// Stripe Webhook Handler
// =============================================================================

/**
 * Verify Stripe webhook signature without the Stripe SDK.
 * Uses Web Crypto API for HMAC-SHA256.
 */
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Parse signature header: t=timestamp,v1=signature
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sig = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!timestamp || !sig) return false;

  // Check timestamp is within tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  return sig === expectedSig;
}

export interface StripeWebhookConfig {
  /**
   * Stripe webhook signing secret (whsec_...).
   * Required for security - verifies webhook signatures.
   * Get this from Stripe Dashboard > Webhooks > Signing secret.
   */
  webhookSecret: string;
}

/**
 * Create a Stripe webhook handler that processes affiliate-related events.
 * Handles invoice.paid, charge.refunded, and checkout.session.completed events.
 *
 * @example
 * ```typescript
 * import { httpRouter } from "convex/server";
 * import { createStripeWebhookHandler } from "chief_emerie";
 * import { components } from "./_generated/api";
 *
 * const http = httpRouter();
 *
 * http.route({
 *   path: "/webhooks/stripe",
 *   method: "POST",
 *   handler: createStripeWebhookHandler(components.affiliates, {
 *     webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
 *   }),
 * });
 *
 * export default http;
 * ```
 */
export function createStripeWebhookHandler(
  component: UseApi<ComponentApi>,
  config: StripeWebhookConfig
) {
  // Validate webhook secret at creation time for helpful error messages
  if (!config.webhookSecret) {
    throw new Error(
      "webhookSecret is required for Stripe webhook handler. " +
        "Set STRIPE_WEBHOOK_SECRET in your Convex environment variables."
    );
  }

  return httpActionGeneric(async (ctx, request) => {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify signature (required)
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const isValid = await verifyStripeSignature(
      rawBody,
      signature,
      config.webhookSecret
    );
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody) as { type: string; data: { object: any } };

    try {
      switch (event.type) {
        case "invoice.paid": {
          const invoice = event.data.object;
          await ctx.runMutation(component.commissions.createFromInvoice, {
            stripeInvoiceId: invoice.id,
            stripeCustomerId: invoice.customer,
            stripeChargeId: invoice.charge,
            stripeSubscriptionId: invoice.subscription,
            stripeProductId: invoice.lines?.data?.[0]?.price?.product,
            amountPaidCents: invoice.amount_paid,
            currency: invoice.currency,
            affiliateCode: invoice.metadata?.affiliate_code,
          });
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object;
          await ctx.runMutation(component.commissions.reverseByCharge, {
            stripeChargeId: charge.id,
            reason: charge.refunds?.data?.[0]?.reason ?? "Charge refunded",
          });
          break;
        }

        case "checkout.session.completed": {
          const session = event.data.object;
          await ctx.runMutation(component.referrals.linkStripeCustomer, {
            stripeCustomerId: session.customer,
            userId: session.client_reference_id,
            affiliateCode: session.metadata?.affiliate_code,
          });
          break;
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  });
}

// =============================================================================
// @convex-dev/stripe Integration
// =============================================================================

/**
 * Options for Stripe event handlers.
 */
export interface AffiliateStripeHandlersOptions {
  /**
   * Optional type-safe hooks for commission events.
   * Called after commission is created or reversed.
   */
  hooks?: Pick<AffiliateHooks, "commission.created" | "commission.reversed">;
}

/**
 * Get Stripe event handlers for affiliate tracking.
 * Optionally merge with your own handlers (affiliate runs first).
 *
 * Handles:
 * - invoice.paid → creates commission
 * - charge.refunded → reverses commission
 * - checkout.session.completed → links customer to affiliate
 *
 * @param component - The affiliate component API
 * @param options - Optional configuration including hooks
 *
 * @example
 * ```typescript
 * import { getAffiliateStripeHandlers } from "chief_emerie";
 *
 * export const affiliateHandlers = getAffiliateStripeHandlers(
 *   components.affiliates,
 *   {
 *     hooks: {
 *       "commission.created": async (data) => {
 *         // data is typed as CommissionCreatedData
 *         await sendEmail(affiliateEmail, `You earned $${data.commissionAmountCents / 100}!`);
 *       },
 *       "commission.reversed": async (data) => {
 *         // data is typed as CommissionReversedData
 *         await sendEmail(affiliateEmail, "A commission was reversed.");
 *       },
 *     },
 *   }
 * );
 * ```
 */
export function getAffiliateStripeHandlers(
  component: UseApi<ComponentApi>,
  options?: AffiliateStripeHandlersOptions
): AffiliateStripeHandlers {
  // Helper to call hooks safely
  type StripeHooks = Pick<AffiliateHooks, "commission.created" | "commission.reversed">;
  async function callHook<K extends keyof StripeHooks>(
    hookName: K,
    data: Parameters<NonNullable<StripeHooks[K]>>[0]
  ): Promise<void> {
    const hook = options?.hooks?.[hookName];
    if (hook) {
      try {
        await hook(data as never);
      } catch (error) {
        console.error(`Hook error for ${hookName}:`, error);
      }
    }
  }

  return {
    "invoice.paid": async (ctx, event) => {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const result = await ctx.runMutation(component.commissions.createFromInvoice, {
        stripeInvoiceId: invoice.id as string,
        stripeCustomerId: invoice.customer as string,
        stripeChargeId: (invoice.charge as string) ?? undefined,
        stripeSubscriptionId: (invoice.subscription as string) ?? undefined,
        stripeProductId:
          ((invoice.lines as { data?: Array<{ price?: { product?: string } }> })
            ?.data?.[0]?.price?.product as string) ?? undefined,
        amountPaidCents: invoice.amount_paid as number,
        currency: invoice.currency as string,
        affiliateCode: (invoice.metadata as Record<string, string>)
          ?.affiliate_code,
      });

      // Call hook if commission was created
      if (result && result.commissionId) {
        await callHook("commission.created", {
          commissionId: result.commissionId,
          affiliateId: result.affiliateId,
          affiliateCode: result.affiliateCode,
          commissionAmountCents: result.commissionAmountCents,
          currency: invoice.currency as string,
        });
      }
    },

    "charge.refunded": async (ctx, event) => {
      const charge = event.data.object as unknown as Record<string, unknown>;
      const result = await ctx.runMutation(component.commissions.reverseByCharge, {
        stripeChargeId: charge.id as string,
        reason:
          ((charge.refunds as { data?: Array<{ reason?: string }> })?.data?.[0]
            ?.reason as string) ?? "Charge refunded",
      });

      // Call hook if commission was reversed
      if (result && result.commissionId) {
        await callHook("commission.reversed", {
          commissionId: result.commissionId,
          affiliateId: result.affiliateId,
          commissionAmountCents: result.commissionAmountCents,
        });
      }
    },

    "checkout.session.completed": async (ctx, event) => {
      const session = event.data.object as unknown as Record<string, unknown>;
      await ctx.runMutation(component.referrals.linkStripeCustomer, {
        stripeCustomerId: session.customer as string,
        userId: (session.client_reference_id as string) ?? undefined,
        affiliateCode: (session.metadata as Record<string, string>)
          ?.affiliate_code,
      });
    },
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate an affiliate link with the given code and path.
 */
export function generateAffiliateLink(
  baseUrl: string,
  code: string,
  path = "/",
  subId?: string
): string {
  const url = new URL(path, baseUrl);
  url.searchParams.set("ref", code);
  if (subId) {
    url.searchParams.set("sub", subId);
  }
  return url.toString();
}

/**
 * Parse referral info from URL search params.
 */
export function parseReferralParams(searchParams: URLSearchParams): {
  code?: string;
  subId?: string;
} {
  return {
    code: searchParams.get("ref") ?? undefined,
    subId: searchParams.get("sub") ?? undefined,
  };
}

// =============================================================================
// Exports
// =============================================================================

export type { ComponentApi };
