import {
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
  paginationOptsValidator,
} from "convex/server";
import type { Auth, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
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
}

// Context types for internal use
type QueryCtx = { runQuery: any; auth: Auth };
type MutationCtx = { runQuery: any; runMutation: any; auth: Auth };
type ActionCtx = { runQuery: any; runMutation: any; runAction: any; auth: Auth };

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
  component: ComponentApi,
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
        return ctx.runMutation(component.affiliates.register, {
          userId,
          email: args.email,
          displayName: args.displayName,
          website: args.website,
          socialMedia: args.socialMedia,
          campaignId: campaign._id,
          customCode: args.customCode,
        });
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
        return ctx.runMutation(component.affiliates.approve, args);
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
        return ctx.runMutation(component.affiliates.reject, args);
      },
    }),

    /**
     * Suspend an active affiliate.
     */
    adminSuspendAffiliate: mutationGeneric({
      args: { affiliateId: v.id("affiliates") },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return ctx.runMutation(component.affiliates.suspend, args);
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
  component: ComponentApi,
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
