import { action, internalMutation, mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { AffiliateManager, exposeApi } from "chief_emerie";
import { v } from "convex/values";
import { Auth } from "convex/server";

// =============================================================================
// AffiliateManager Setup
// =============================================================================

// Environment variables aren't available in the component,
// so we pass them in as config to the AffiliateManager.
const affiliates = new AffiliateManager(components.affiliates, {
  defaultCommissionType: "percentage",
  defaultCommissionValue: 20, // 20%
  defaultPayoutTerm: "NET-30",
  minPayoutCents: 5000, // $50 minimum
  defaultCookieDurationDays: 30,
  baseUrl: process.env.BASE_URL ?? "https://example.com",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
});

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the affiliate system. Call this once during app setup.
 */
export const initialize = internalMutation({
  args: {},
  handler: async (ctx) => {
    await affiliates.initialize(ctx);
  },
});

// =============================================================================
// Affiliate Registration
// =============================================================================

/**
 * Register as an affiliate.
 */
export const registerAffiliate = mutation({
  args: {
    email: v.string(),
    displayName: v.optional(v.string()),
    website: v.optional(v.string()),
    socialMedia: v.optional(v.string()),
    customCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to register as an affiliate");
    }

    return await affiliates.registerAffiliate(ctx, {
      userId,
      email: args.email,
      displayName: args.displayName,
      website: args.website,
      socialMedia: args.socialMedia,
      customCode: args.customCode,
    });
  },
});

// =============================================================================
// Portal Queries
// =============================================================================

/**
 * Get affiliate portal data for the current user.
 */
export const getPortalData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return await affiliates.getAffiliatePortalData(ctx, userId);
  },
});

/**
 * Get commission history for the current user.
 */
export const getCommissions = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("paid"),
        v.literal("reversed"),
        v.literal("processing")
      )
    ),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const affiliate = await ctx.runQuery(
      components.affiliates.affiliates.getByUserId,
      { userId }
    );
    if (!affiliate) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    return await affiliates.getAffiliateCommissions(ctx, {
      affiliateId: affiliate._id,
      status: args.status,
      paginationOpts: args.paginationOpts,
    });
  },
});

// =============================================================================
// Referral Tracking
// =============================================================================

/**
 * Track a referral click. This is called from the frontend.
 */
export const trackClick = mutation({
  args: {
    affiliateCode: v.string(),
    landingPage: v.string(),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    subId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.affiliates.referrals.trackClick, args);
  },
});

/**
 * Attribute a signup to an affiliate. Call this after user registration.
 */
export const attributeSignup = internalMutation({
  args: {
    userId: v.string(),
    referralCode: v.optional(v.string()),
    referralId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await affiliates.attributeSignup(ctx, args);
  },
});

// =============================================================================
// Stripe Connect
// =============================================================================

/**
 * Create a Stripe Connect onboarding link for the current affiliate.
 */
export const createConnectOnboardingLink = action({
  args: {
    refreshUrl: v.string(),
    returnUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    const affiliate = await ctx.runQuery(
      components.affiliates.affiliates.getByUserId,
      { userId }
    );
    if (!affiliate) {
      throw new Error("Not registered as an affiliate");
    }

    return await affiliates.createConnectOnboardingLink(ctx, {
      affiliateId: affiliate._id,
      refreshUrl: args.refreshUrl,
      returnUrl: args.returnUrl,
    });
  },
});

// =============================================================================
// Admin Functions
// =============================================================================

/**
 * Get admin dashboard data.
 */
export const getAdminDashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await affiliates.getAdminDashboard(ctx);
  },
});

/**
 * List all affiliates (admin only).
 */
export const listAffiliates = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("suspended")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await affiliates.listAffiliates(ctx, args);
  },
});

/**
 * Approve an affiliate (admin only).
 */
export const approveAffiliate = mutation({
  args: { affiliateId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await affiliates.approveAffiliate(ctx, args.affiliateId);
  },
});

/**
 * Reject an affiliate (admin only).
 */
export const rejectAffiliate = mutation({
  args: {
    affiliateId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await affiliates.rejectAffiliate(ctx, args.affiliateId);
  },
});

/**
 * Get top affiliates (admin only).
 */
export const getTopAffiliates = query({
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
    return await ctx.runQuery(components.affiliates.analytics.getTopAffiliates, args);
  },
});

/**
 * Process payouts for all eligible affiliates (admin only).
 */
export const processPayouts = action({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await affiliates.processPayouts(ctx);
  },
});

// =============================================================================
// Alternative: Using exposeApi for direct exports
// =============================================================================

// You can also use exposeApi to expose the component's API directly:
export const api = exposeApi(components.affiliates, {
  auth: async (ctx, operation) => {
    const userId = await getAuthUserId(ctx);
    if (!userId && operation.type !== "read") {
      throw new Error("Unauthorized");
    }
    // For admin operations, add additional check
    if (operation.type === "admin") {
      await requireAdmin(ctx);
    }
    return userId ?? "";
  },
});

// =============================================================================
// Utility Functions
// =============================================================================

async function getAuthUserId(ctx: { auth: Auth }): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

async function requireAdmin(ctx: { auth: Auth }): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  // TODO: Implement your admin check logic here
  // For example: check if user has admin role in your auth system
  // const isAdmin = identity.tokenIdentifier.includes("admin");
  // if (!isAdmin) throw new Error("Not authorized");
}
