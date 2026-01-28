import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import {
  recruitmentReferralStatusValidator,
  affiliateStatusValidator,
  affiliateStatsValidator,
  subAffiliateStatsValidator,
  commissionStatusValidator,
  initializeSubAffiliateStats,
} from "./validators.js";

// ============================================
// Queries
// ============================================

/**
 * Get a recruitment referral by its referral ID.
 */
export const getRecruitmentReferralById = query({
  args: {
    referralId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliateRecruitmentReferrals"),
      _creationTime: v.number(),
      recruitingAffiliateId: v.id("affiliates"),
      referralId: v.string(),
      landingPage: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      status: recruitmentReferralStatusValidator,
      recruitedAffiliateId: v.optional(v.id("affiliates")),
      clickedAt: v.number(),
      signedUpAt: v.optional(v.number()),
      approvedAt: v.optional(v.number()),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliateRecruitmentReferrals")
      .withIndex("by_referralId", (q) => q.eq("referralId", args.referralId))
      .first();
  },
});

/**
 * Get an affiliate by their recruitment code.
 */
export const getByRecruitmentCode = query({
  args: {
    recruitmentCode: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      code: v.string(),
      recruitmentCode: v.optional(v.string()),
      displayName: v.optional(v.string()),
      status: affiliateStatusValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_recruitmentCode", (q) =>
        q.eq("recruitmentCode", args.recruitmentCode.toUpperCase()),
      )
      .first();

    if (!affiliate) return null;

    return {
      _id: affiliate._id,
      code: affiliate.code,
      recruitmentCode: affiliate.recruitmentCode,
      displayName: affiliate.displayName,
      status: affiliate.status,
    };
  },
});

/**
 * List sub-affiliates for a parent affiliate.
 */
export const listSubAffiliates = query({
  args: {
    parentAffiliateId: v.id("affiliates"),
    status: v.optional(affiliateStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      code: v.string(),
      displayName: v.optional(v.string()),
      status: affiliateStatusValidator,
      stats: affiliateStatsValidator,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const subAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_referredByAffiliateId", (q) =>
        q.eq("referredByAffiliateId", args.parentAffiliateId),
      )
      .take(limit);

    // Filter by status if provided
    const filtered = args.status
      ? subAffiliates.filter((a) => a.status === args.status)
      : subAffiliates;

    return filtered.map((a) => ({
      _id: a._id,
      code: a.code,
      displayName: a.displayName,
      status: a.status,
      stats: a.stats,
      createdAt: a.createdAt,
    }));
  },
});

/**
 * Get sub-affiliate commission stats for a parent affiliate.
 */
export const getSubAffiliateStats = query({
  args: {
    parentAffiliateId: v.id("affiliates"),
  },
  returns: v.union(subAffiliateStatsValidator, v.null()),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.parentAffiliateId);
    if (!affiliate) return null;
    return affiliate.subAffiliateStats ?? initializeSubAffiliateStats();
  },
});

/**
 * List sub-affiliate commissions for a parent affiliate.
 */
export const listSubAffiliateCommissions = query({
  args: {
    parentAffiliateId: v.id("affiliates"),
    status: v.optional(commissionStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("subAffiliateCommissions"),
      subAffiliateId: v.id("affiliates"),
      sourceCommissionAmountCents: v.number(),
      subCommissionAmountCents: v.number(),
      subCommissionPercent: v.number(),
      currency: v.string(),
      status: commissionStatusValidator,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const commissionsQuery = ctx.db
      .query("subAffiliateCommissions")
      .withIndex("by_parentAffiliate", (q) =>
        q.eq("parentAffiliateId", args.parentAffiliateId),
      );

    const commissions = await commissionsQuery.take(limit);

    // Filter by status if provided
    const filtered = args.status
      ? commissions.filter((c) => c.status === args.status)
      : commissions;

    return filtered.map((c) => ({
      _id: c._id,
      subAffiliateId: c.subAffiliateId,
      sourceCommissionAmountCents: c.sourceCommissionAmountCents,
      subCommissionAmountCents: c.subCommissionAmountCents,
      subCommissionPercent: c.subCommissionPercent,
      currency: c.currency,
      status: c.status,
      createdAt: c.createdAt,
    }));
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Track a recruitment click.
 */
export const trackRecruitmentClick = mutation({
  args: {
    recruitmentCode: v.string(),
    landingPage: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      referralId: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Find the recruiting affiliate
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_recruitmentCode", (q) =>
        q.eq("recruitmentCode", args.recruitmentCode.toUpperCase()),
      )
      .first();

    if (!affiliate) {
      return { success: false as const, error: "invalid_recruitment_code" };
    }

    // Check affiliate is approved
    if (affiliate.status !== "approved") {
      return { success: false as const, error: "affiliate_not_approved" };
    }

    // Get campaign for cookie duration
    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign) {
      return { success: false as const, error: "campaign_not_found" };
    }

    // Check if recruitment is enabled
    if (!campaign.affiliateRecruitmentEnabled) {
      return { success: false as const, error: "recruitment_not_enabled" };
    }

    // Check max sub-affiliates limit
    if (campaign.maxSubAffiliatesPerAffiliate) {
      const subStats =
        affiliate.subAffiliateStats ?? initializeSubAffiliateStats();
      if (subStats.totalRecruits >= campaign.maxSubAffiliatesPerAffiliate) {
        return { success: false as const, error: "max_sub_affiliates_reached" };
      }
    }

    // Generate referral ID
    const referralId = crypto.randomUUID();

    // Calculate expiration
    const cookieDays =
      campaign.recruitmentCookieDurationDays ??
      campaign.cookieDurationDays ??
      30;
    const expiresAt = Date.now() + cookieDays * 24 * 60 * 60 * 1000;

    // Create recruitment referral
    await ctx.db.insert("affiliateRecruitmentReferrals", {
      recruitingAffiliateId: affiliate._id,
      referralId,
      landingPage: args.landingPage,
      ipAddress: args.ipAddress,
      status: "clicked",
      clickedAt: Date.now(),
      expiresAt,
    });

    return { success: true as const, referralId };
  },
});

/**
 * Create a sub-affiliate commission when a sub-affiliate earns a commission.
 * This is called internally when a commission is created.
 */
export const createSubAffiliateCommission = mutation({
  args: {
    sourceCommissionId: v.id("commissions"),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      subCommissionId: v.id("subAffiliateCommissions"),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Get the source commission
    const sourceCommission = await ctx.db.get(args.sourceCommissionId);
    if (!sourceCommission) {
      return { success: false as const, error: "commission_not_found" };
    }

    // Get the sub-affiliate (the one who earned the commission)
    const subAffiliate = await ctx.db.get(sourceCommission.affiliateId);
    if (!subAffiliate) {
      return { success: false as const, error: "sub_affiliate_not_found" };
    }

    // Check if sub-affiliate was recruited
    if (!subAffiliate.referredByAffiliateId) {
      return { success: false as const, error: "not_a_sub_affiliate" };
    }

    // Get the parent affiliate
    const parentAffiliate = await ctx.db.get(
      subAffiliate.referredByAffiliateId,
    );
    if (!parentAffiliate) {
      return { success: false as const, error: "parent_affiliate_not_found" };
    }

    // Get campaign settings
    const campaign = await ctx.db.get(subAffiliate.campaignId);
    if (!campaign) {
      return { success: false as const, error: "campaign_not_found" };
    }

    // Check if sub-affiliate commission is enabled
    if (
      !campaign.affiliateRecruitmentEnabled ||
      !campaign.subAffiliateCommissionPercent
    ) {
      return {
        success: false as const,
        error: "sub_affiliate_commission_not_enabled",
      };
    }

    // Calculate sub-affiliate commission
    const subCommissionPercent = campaign.subAffiliateCommissionPercent;
    const subCommissionAmountCents = Math.round(
      (sourceCommission.commissionAmountCents * subCommissionPercent) / 100,
    );

    if (subCommissionAmountCents <= 0) {
      return { success: false as const, error: "commission_too_small" };
    }

    const now = Date.now();

    // Create sub-affiliate commission
    const subCommissionId = await ctx.db.insert("subAffiliateCommissions", {
      parentAffiliateId: parentAffiliate._id,
      subAffiliateId: subAffiliate._id,
      sourceCommissionId: args.sourceCommissionId,
      sourceCommissionAmountCents: sourceCommission.commissionAmountCents,
      subCommissionAmountCents,
      subCommissionPercent,
      currency: sourceCommission.currency,
      status: "pending",
      dueAt: sourceCommission.dueAt,
      createdAt: now,
    });

    // Update parent's sub-affiliate stats
    const subStats =
      parentAffiliate.subAffiliateStats ?? initializeSubAffiliateStats();
    await ctx.db.patch(parentAffiliate._id, {
      subAffiliateStats: {
        ...subStats,
        totalSubCommissionsCents:
          subStats.totalSubCommissionsCents + subCommissionAmountCents,
        pendingSubCommissionsCents:
          subStats.pendingSubCommissionsCents + subCommissionAmountCents,
      },
      updatedAt: now,
    });

    return { success: true as const, subCommissionId };
  },
});

/**
 * Reverse a sub-affiliate commission (when the source commission is reversed).
 */
export const reverseSubAffiliateCommission = mutation({
  args: {
    sourceCommissionId: v.id("commissions"),
    reason: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Find the sub-affiliate commission linked to this source commission
    const subCommission = await ctx.db
      .query("subAffiliateCommissions")
      .withIndex("by_sourceCommission", (q) =>
        q.eq("sourceCommissionId", args.sourceCommissionId),
      )
      .first();

    if (!subCommission) {
      // No sub-affiliate commission exists, which is fine
      return { success: true as const };
    }

    if (subCommission.status === "reversed") {
      // Already reversed
      return { success: true as const };
    }

    const now = Date.now();

    // Reverse the sub-affiliate commission
    await ctx.db.patch(subCommission._id, {
      status: "reversed",
      reversedAt: now,
      reversalReason: args.reason,
    });

    // Update parent's sub-affiliate stats
    const parentAffiliate = await ctx.db.get(subCommission.parentAffiliateId);
    if (parentAffiliate) {
      const subStats =
        parentAffiliate.subAffiliateStats ?? initializeSubAffiliateStats();

      // Decrement pending if it was pending, or paid if it was paid
      const updates: typeof subStats = { ...subStats };
      if (
        subCommission.status === "pending" ||
        subCommission.status === "approved"
      ) {
        updates.pendingSubCommissionsCents -=
          subCommission.subCommissionAmountCents;
      } else if (subCommission.status === "paid") {
        updates.paidSubCommissionsCents -=
          subCommission.subCommissionAmountCents;
      }

      await ctx.db.patch(parentAffiliate._id, {
        subAffiliateStats: updates,
        updatedAt: now,
      });
    }

    return { success: true as const };
  },
});
