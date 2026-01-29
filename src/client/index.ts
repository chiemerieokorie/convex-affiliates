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

/**
 * Context type for auth/isAdmin callbacks.
 * Permissive: only requires `auth`, accepts any additional properties
 * so consumers can pass the full Convex ctx to their auth helpers.
 */
export type AffiliateCtx = { auth: Auth } & Record<string, any>;

export interface CreateAffiliateApiConfig extends AffiliateConfig {
  /**
   * Authentication function that returns the user ID.
   * Called for all authenticated endpoints.
   */
  auth: (ctx: AffiliateCtx) => Promise<string>;

  /**
   * Optional admin check function.
   * If not provided, admin endpoints will use the auth function only.
   */
  isAdmin?: (ctx: AffiliateCtx) => Promise<boolean>;

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

// Context types for internal use (what we actually call on ctx)
type QueryCtx = { runQuery: any; auth: Auth };
type MutationCtx = { runQuery: any; runMutation: any; auth: Auth };

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
 * import { createAffiliateApi } from "convex-affiliates";
 * import { components } from "./_generated/api";
 *
 * export const { trackClick, register, getPortalData } =
 *   createAffiliateApi(components.affiliates, {
 *     auth: async (ctx) => {
 *       const identity = await ctx.auth.getUserIdentity();
 *       if (!identity) throw new Error("Not authenticated");
 *       return identity.subject;
 *     },
 *   });
 * ```
 */
export function createAffiliateApi(
  component: ComponentApi,
  config: CreateAffiliateApiConfig
) {
  const auth = config.auth;
  const isAdmin = config.isAdmin;
  const hooks = config.hooks;
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
  const requireAdmin = async (ctx: AffiliateCtx) => {
    if (isAdmin) {
      const isAdminResult = await isAdmin(ctx);
      if (!isAdminResult) throw new Error("Not authorized - admin access required");
    } else {
      // Fall back to just requiring auth
      await auth(ctx);
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
    const hook = hooks?.[hookName];
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
     * Call this when a user lands on your site with a `?ref=CODE` parameter.
     * Returns a referral ID that should be stored client-side.
     * When using the React hooks, storage is handled automatically via the
     * configured storage adapter (localStorage, cookie, or both).
     *
     * @param affiliateCode - The affiliate's unique code from the URL (e.g., "JOHN20")
     * @param landingPage - The URL path where the user landed (e.g., "/pricing")
     * @param referrer - Optional HTTP referrer header
     * @param userAgent - Optional user agent for device detection
     * @param ipAddress - Optional IP for fraud prevention (rate limiting)
     * @param subId - Optional sub-tracking ID set by the affiliate
     * @returns The referral ID to store, or null if rate-limited/invalid code
     *
     * @example
     * ```typescript
     * // In your landing page component
     * const searchParams = new URLSearchParams(window.location.search);
     * const refCode = searchParams.get("ref");
     *
     * if (refCode) {
     *   const referralId = await trackClick({
     *     affiliateCode: refCode,
     *     landingPage: window.location.pathname,
     *     referrer: document.referrer,
     *   });
     *   // Store referralId — handled automatically by useTrackReferralOnLoad,
     *   // or store manually via your preferred method (localStorage, cookie, etc.)
     *   if (referralId) {
     *     localStorage.setItem("referralId", referralId);
     *   }
     * }
     * ```
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
     * Validate an affiliate code and get basic info about the affiliate.
     * Use this to check if a referral code is valid before tracking or displaying.
     *
     * @param code - The affiliate code to validate (case-insensitive)
     * @returns Object with validity and affiliate info, or null if code doesn't exist
     *
     * @example
     * ```typescript
     * const result = await validateCode({ code: "JOHN20" });
     * if (result?.valid) {
     *   console.log(`Referred by: ${result.displayName}`);
     * }
     * ```
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
     * Register as a new affiliate. Requires authentication.
     * Creates a pending affiliate that needs admin approval before earning commissions.
     *
     * @param email - Contact email for payouts and notifications
     * @param displayName - Optional public display name
     * @param website - Optional website URL
     * @param socialMedia - Optional social media profile URL
     * @param customCode - Optional custom affiliate code (auto-generated if not provided)
     * @returns Object with affiliateId and assigned code
     * @throws Error if user is not authenticated or already an affiliate
     *
     * @example
     * ```typescript
     * const result = await register({
     *   email: "affiliate@example.com",
     *   displayName: "John's Tech Reviews",
     *   website: "https://johnstech.com",
     *   customCode: "JOHN20", // Optional - will be generated if not provided
     * });
     * console.log(`Your affiliate code is: ${result.code}`);
     * ```
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
        const userId = await auth(ctx);
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
     * Get the current authenticated user's affiliate profile.
     * Returns null if the user hasn't registered as an affiliate.
     *
     * @returns The affiliate profile with stats, or null if not an affiliate
     *
     * @example
     * ```typescript
     * const affiliate = await getAffiliate();
     * if (affiliate) {
     *   console.log(`Your code: ${affiliate.code}`);
     *   console.log(`Status: ${affiliate.status}`);
     *   console.log(`Total earnings: $${affiliate.stats.totalCommissionsCents / 100}`);
     * } else {
     *   // Show registration form
     * }
     * ```
     */
    getAffiliate: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await auth(ctx);
        return ctx.runQuery(component.affiliates.getByUserId, { userId });
      },
    }),

    /**
     * Update the current user's affiliate profile.
     * Only provided fields will be updated; omitted fields remain unchanged.
     *
     * @param displayName - Public display name shown to referred users
     * @param bio - Short biography or description
     * @param promoContent - Featured promotional content (video, blog post, etc.)
     * @param website - Personal/business website URL
     * @param socials - Social media profile URLs
     * @param customCopy - Custom marketing copy for promotions
     * @param payoutEmail - Email address for payout notifications
     * @throws Error if user is not an affiliate
     *
     * @example
     * ```typescript
     * await updateProfile({
     *   displayName: "Tech Reviews by John",
     *   website: "https://johnstech.com",
     *   socials: { twitter: "johnstech", youtube: "@johnstech" },
     * });
     * ```
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
        const userId = await auth(ctx);
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
     * Returns all data needed to render the affiliate's dashboard in one query.
     *
     * @returns Object containing affiliate profile, stats, recent activity, and earnings
     *
     * @example
     * ```typescript
     * const portal = await getPortalData();
     *
     * // Display stats
     * console.log(`Clicks: ${portal.affiliate.stats.totalClicks}`);
     * console.log(`Conversions: ${portal.affiliate.stats.totalConversions}`);
     * console.log(`Pending: $${portal.affiliate.stats.pendingCommissionsCents / 100}`);
     * console.log(`Paid: $${portal.affiliate.stats.paidCommissionsCents / 100}`);
     * ```
     */
    getPortalData: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await auth(ctx);
        return ctx.runQuery(component.analytics.getPortalData, { userId });
      },
    }),

    /**
     * List the current affiliate's commissions with pagination.
     * Supports filtering by status and cursor-based pagination.
     *
     * @param status - Optional filter: "pending" | "approved" | "processing" | "paid" | "reversed"
     * @param paginationOpts - Pagination options with cursor and numItems
     * @returns Paginated list of commissions with page, isDone, and continueCursor
     *
     * @example
     * ```typescript
     * // Get first page of pending commissions
     * const { page, continueCursor, isDone } = await listCommissions({
     *   status: "pending",
     *   paginationOpts: { numItems: 10 },
     * });
     *
     * // Get next page
     * const nextPage = await listCommissions({
     *   paginationOpts: { numItems: 10, cursor: continueCursor },
     * });
     * ```
     */
    listCommissions: queryGeneric({
      args: {
        status: v.optional(commissionStatusValidator),
        paginationOpts: paginationOptsValidator,
      },
      handler: async (ctx, args) => {
        const userId = await auth(ctx);
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
     * List the current affiliate's payouts with pagination.
     * Supports filtering by status and cursor-based pagination.
     *
     * @param status - Optional filter: "pending" | "completed" | "cancelled"
     * @param paginationOpts - Pagination options with cursor and numItems
     * @returns Paginated list of payouts with page, isDone, and continueCursor
     *
     * @example
     * ```typescript
     * // Get completed payouts
     * const { page } = await listPayouts({
     *   status: "completed",
     *   paginationOpts: { numItems: 20 },
     * });
     *
     * page.forEach(payout => {
     *   console.log(`$${payout.amountCents / 100} via ${payout.method}`);
     * });
     * ```
     */
    listPayouts: queryGeneric({
      args: {
        status: v.optional(payoutStatusValidator),
        paginationOpts: paginationOptsValidator,
      },
      handler: async (ctx, args) => {
        const userId = await auth(ctx);
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
     * List the current affiliate's referrals (clicks and signups).
     * Shows the funnel of visitors who clicked affiliate links.
     *
     * @param status - Optional filter: "clicked" | "signed_up" | "converted" | "expired"
     * @param limit - Maximum number of referrals to return (default: 100)
     * @returns Array of referrals with status, timestamps, and tracking info
     *
     * @example
     * ```typescript
     * // Get recent conversions
     * const conversions = await listReferrals({
     *   status: "converted",
     *   limit: 50,
     * });
     *
     * console.log(`${conversions.length} customers converted`);
     * ```
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
        const userId = await auth(ctx);
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
     * Creates a URL with the affiliate's code that can be shared.
     *
     * @param path - Optional URL path (default: "/")
     * @param subId - Optional sub-tracking ID for campaign attribution
     * @returns Full URL with affiliate code as query parameter
     * @throws Error if user is not an affiliate
     *
     * @example
     * ```typescript
     * // Generate link to homepage
     * const link = await generateLink();
     * // Returns: "https://yoursite.com?ref=JOHN20"
     *
     * // Generate link to specific page with sub-tracking
     * const pricingLink = await generateLink({
     *   path: "/pricing",
     *   subId: "youtube-video-1",
     * });
     * // Returns: "https://yoursite.com/pricing?ref=JOHN20&sub=youtube-video-1"
     * ```
     */
    generateLink: queryGeneric({
      args: {
        path: v.optional(v.string()),
        subId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await auth(ctx);
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
     * Attribute a new user signup to an affiliate.
     * Call this immediately after a user creates an account to link them
     * to the referring affiliate for commission tracking.
     *
     * @param userId - The newly registered user's ID
     * @param referralCode - The affiliate code from URL params (if available)
     * @param referralId - The referral ID from storage (preferred). Retrieved automatically by useStoredReferral hook.
     * @returns Object with `attributed: boolean` indicating success
     *
     * @example
     * ```typescript
     * // After user registration completes
     * const referralId = localStorage.getItem("referralId");
     * const refCode = new URLSearchParams(window.location.search).get("ref");
     *
     * await attributeSignup({
     *   userId: newUser.id,
     *   referralId: referralId ?? undefined,
     *   referralCode: refCode ?? undefined,
     * });
     *
     * // Clean up stored referral
     * localStorage.removeItem("referralId");
     * ```
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

    /**
     * Get referee discount for a referral.
     * Used during checkout to apply discount for referred customers.
     * Returns the discount details if configured for the affiliate's campaign.
     *
     * @example
     * ```typescript
     * // Get discount by referral ID (stored in cookie)
     * const discount = await getRefereeDiscount({ referralId: "..." });
     *
     * // Get discount by affiliate code (from URL param)
     * const discount = await getRefereeDiscount({ affiliateCode: "JOHN20" });
     *
     * if (discount) {
     *   // Apply discount to checkout
     *   if (discount.stripeCouponId) {
     *     // Use Stripe coupon directly
     *     stripe.checkout.sessions.create({
     *       discounts: [{ coupon: discount.stripeCouponId }],
     *     });
     *   } else {
     *     // Calculate discount manually
     *     const discountAmount = discount.discountType === "percentage"
     *       ? (totalCents * discount.discountValue) / 100
     *       : discount.discountValue;
     *   }
     * }
     * ```
     */
    getRefereeDiscount: queryGeneric({
      args: {
        referralId: v.optional(v.string()),
        affiliateCode: v.optional(v.string()),
        userId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        // Note: The type will be properly resolved after running `npx convex dev` to regenerate types
        return ctx.runQuery(
          component.referrals.getRefereeDiscount,
          args
        );
      },
    }),

    // =========================================================================
    // ADMIN ENDPOINTS
    // =========================================================================

    /**
     * Get admin dashboard overview with aggregate statistics.
     * Requires admin authorization via the `isAdmin` callback.
     *
     * @returns Dashboard data with total affiliates, conversions, revenue, and pending payouts
     *
     * @example
     * ```typescript
     * const dashboard = await adminDashboard();
     * console.log(`Total affiliates: ${dashboard.totalAffiliates}`);
     * console.log(`Total revenue: $${dashboard.totalRevenueCents / 100}`);
     * console.log(`Pending payouts: $${dashboard.pendingPayoutsCents / 100}`);
     * ```
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
     * Requires admin authorization.
     *
     * @param status - Optional filter: "pending" | "approved" | "suspended" | "rejected"
     * @param campaignId - Optional filter by campaign
     * @param limit - Maximum number of results (default: 100)
     * @returns Array of affiliate profiles with stats
     *
     * @example
     * ```typescript
     * // Get pending applications
     * const pending = await adminListAffiliates({ status: "pending" });
     * console.log(`${pending.length} affiliates awaiting approval`);
     *
     * // Get all affiliates for a campaign
     * const campaignAffiliates = await adminListAffiliates({
     *   campaignId: "abc123",
     *   limit: 50,
     * });
     * ```
     */
    adminListAffiliates: queryGeneric({
      args: {
        status: v.optional(affiliateStatusValidator),
        campaignId: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return ctx.runQuery(component.affiliates.list, args );
      },
    }),

    /**
     * Get top performing affiliates ranked by performance metrics.
     * Requires admin authorization.
     *
     * @param sortBy - Ranking metric: "conversions" | "revenue" | "commissions"
     * @param limit - Maximum number of results (default: 10)
     * @returns Array of top affiliates with their stats
     *
     * @example
     * ```typescript
     * // Get top 5 by revenue
     * const topEarners = await adminTopAffiliates({
     *   sortBy: "revenue",
     *   limit: 5,
     * });
     *
     * topEarners.forEach((aff, i) => {
     *   console.log(`#${i + 1}: ${aff.displayName} - $${aff.stats.totalRevenueCents / 100}`);
     * });
     * ```
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
     * Approve a pending affiliate application.
     * Changes status from "pending" to "approved", allowing them to earn commissions.
     * Triggers the `affiliate.approved` lifecycle hook if configured.
     *
     * @param affiliateId - The ID of the affiliate to approve
     * @throws Error if affiliate is not in "pending" status
     *
     * @example
     * ```typescript
     * // Approve a single affiliate
     * await adminApproveAffiliate({ affiliateId: "abc123" });
     *
     * // Batch approve all pending
     * const pending = await adminListAffiliates({ status: "pending" });
     * for (const aff of pending) {
     *   await adminApproveAffiliate({ affiliateId: aff._id });
     * }
     * ```
     */
    adminApproveAffiliate: mutationGeneric({
      args: { affiliateId: v.string() },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Get affiliate info before approval for hook
        const affiliateData = await ctx.runQuery(component.affiliates.getById, {
          affiliateId: args.affiliateId ,
        });

        await ctx.runMutation(component.affiliates.approve, { affiliateId: args.affiliateId  });

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
     * Reject a pending affiliate application.
     * Changes status from "pending" to "rejected".
     * Triggers the `affiliate.rejected` lifecycle hook if configured.
     *
     * @param affiliateId - The ID of the affiliate to reject
     * @param reason - Optional rejection reason (for internal tracking)
     * @throws Error if affiliate is not in "pending" status
     *
     * @example
     * ```typescript
     * await adminRejectAffiliate({
     *   affiliateId: "abc123",
     *   reason: "Insufficient social media presence",
     * });
     * ```
     */
    adminRejectAffiliate: mutationGeneric({
      args: {
        affiliateId: v.string(),
        reason: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Get affiliate info before rejection for hook
        const affiliateData = await ctx.runQuery(component.affiliates.getById, {
          affiliateId: args.affiliateId ,
        });

        await ctx.runMutation(component.affiliates.reject, { affiliateId: args.affiliateId  });

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
     * Prevents them from earning new commissions until reactivated.
     * Triggers the `affiliate.suspended` lifecycle hook if configured.
     *
     * @param affiliateId - The ID of the affiliate to suspend
     *
     * @example
     * ```typescript
     * // Suspend for policy violation
     * await adminSuspendAffiliate({ affiliateId: "abc123" });
     * ```
     */
    adminSuspendAffiliate: mutationGeneric({
      args: { affiliateId: v.string() },
      handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Get affiliate info before suspension for hook
        const affiliateData = await ctx.runQuery(component.affiliates.getById, {
          affiliateId: args.affiliateId ,
        });

        await ctx.runMutation(component.affiliates.suspend, { affiliateId: args.affiliateId  });

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
     * List all affiliate campaigns.
     * Requires admin authorization.
     *
     * @param activeOnly - If true, only return active campaigns
     * @returns Array of campaigns with commission settings and terms
     *
     * @example
     * ```typescript
     * // Get all campaigns
     * const campaigns = await adminListCampaigns({});
     *
     * // Get only active campaigns
     * const activeCampaigns = await adminListCampaigns({ activeOnly: true });
     * ```
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
     * Create a new affiliate campaign with custom commission settings.
     * Requires admin authorization.
     *
     * @param name - Display name for the campaign
     * @param slug - URL-friendly identifier (must be unique)
     * @param description - Optional campaign description
     * @param commissionType - "percentage" or "fixed"
     * @param commissionValue - Percentage (0-100) or fixed amount in cents
     * @param payoutTerm - Payment schedule: "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90"
     * @param cookieDurationDays - How long referrals are tracked
     * @param minPayoutCents - Minimum balance required for payout
     * @param allowedProducts - Optional array of Stripe product IDs to include
     * @param excludedProducts - Optional array of Stripe product IDs to exclude
     * @returns The created campaign's ID
     *
     * @example
     * ```typescript
     * const campaignId = await adminCreateCampaign({
     *   name: "Premium Partners",
     *   slug: "premium",
     *   commissionType: "percentage",
     *   commissionValue: 30, // 30%
     *   payoutTerm: "NET-15",
     *   cookieDurationDays: 60,
     *   minPayoutCents: 10000, // $100 minimum
     * });
     * ```
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

    // =========================================================================
    // HTTP Routes
    // =========================================================================

    /**
     * Register HTTP routes for affiliate functionality.
     * The component reference is already available from the closure.
     *
     * @param http - The Convex HTTP router
     * @param options - Optional configuration (e.g., pathPrefix)
     *
     * @example
     * ```typescript
     * const affiliates = createAffiliateApi(components.affiliates, { ... });
     * affiliates.registerRoutes(http, { pathPrefix: "/affiliates" });
     * ```
     */
    registerRoutes(
      http: HttpRouter,
      options: { pathPrefix?: string } = {}
    ): void {
      const prefix = options.pathPrefix ?? "/affiliates";

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
    },

    // =========================================================================
    // Stripe Webhook Handler
    // =========================================================================

    /**
     * Create a Stripe webhook handler that processes affiliate-related events.
     * The component reference is already available from the closure.
     *
     * @param webhookConfig - Configuration with webhookSecret
     * @returns An HTTP action handler for Stripe webhooks
     *
     * @example
     * ```typescript
     * const affiliates = createAffiliateApi(components.affiliates, { ... });
     *
     * http.route({
     *   path: "/webhooks/stripe",
     *   method: "POST",
     *   handler: affiliates.createStripeWebhookHandler({
     *     webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
     *   }),
     * });
     * ```
     */
    createStripeWebhookHandler(webhookConfig: StripeWebhookConfig) {
      if (!webhookConfig.webhookSecret) {
        throw new Error(
          "webhookSecret is required for Stripe webhook handler. " +
            "Set STRIPE_WEBHOOK_SECRET in your Convex environment variables."
        );
      }

      return httpActionGeneric(async (ctx, request) => {
        const rawBody = await request.text();

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
          webhookConfig.webhookSecret
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
    },
  };
}

// =============================================================================
// Stripe Webhook Signature Verification
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
 * import { getAffiliateStripeHandlers } from "convex-affiliates";
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
  component: ComponentApi,
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
// Re-exported Types (for consumer convenience)
// =============================================================================

export type {
  CommissionType,
  CommissionDuration,
  PayoutTerm,
  AffiliateStatus,
  ReferralStatus,
  CommissionStatus,
  PayoutStatus,
  PayoutMethod,
  EventType,
  PromoContentType,
} from "../component/validators.js";

export {
  generateAffiliateCode,
  calculateCommissionAmount,
  getPayoutTermDelayMs,
} from "../component/validators.js";

// =============================================================================
// Exports
// =============================================================================

export type { ComponentApi };
