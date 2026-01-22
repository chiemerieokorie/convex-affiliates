import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import {
  affiliateStatusValidator,
  commissionTypeValidator,
  payoutMethodValidator,
  socialsValidator,
  customCopyValidator,
  promoContentValidator,
  affiliateStatsValidator,
  subAffiliateStatsValidator,
  generateAffiliateCode,
  generateRecruitmentCode,
  initializeSubAffiliateStats,
} from "./validators.js";

// ============================================
// Queries
// ============================================

/**
 * Get an affiliate by their unique code.
 */
export const getByCode = query({
  args: {
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      userId: v.string(),
      campaignId: v.id("campaigns"),
      code: v.string(),
      displayName: v.optional(v.string()),
      bio: v.optional(v.string()),
      promoContent: v.optional(promoContentValidator),
      website: v.optional(v.string()),
      socials: v.optional(socialsValidator),
      customCopy: v.optional(customCopyValidator),
      customCommissionType: v.optional(commissionTypeValidator),
      customCommissionValue: v.optional(v.number()),
      payoutMethod: v.optional(payoutMethodValidator),
      payoutEmail: v.optional(v.string()),
      status: affiliateStatusValidator,
      stats: affiliateStatsValidator,
      referredByAffiliateId: v.optional(v.id("affiliates")),
      recruitmentCode: v.optional(v.string()),
      subAffiliateStats: v.optional(subAffiliateStatsValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
  },
});

/**
 * Get an affiliate by their document ID.
 */
export const getById = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      userId: v.string(),
      campaignId: v.id("campaigns"),
      code: v.string(),
      displayName: v.optional(v.string()),
      bio: v.optional(v.string()),
      promoContent: v.optional(promoContentValidator),
      website: v.optional(v.string()),
      socials: v.optional(socialsValidator),
      customCopy: v.optional(customCopyValidator),
      customCommissionType: v.optional(commissionTypeValidator),
      customCommissionValue: v.optional(v.number()),
      payoutMethod: v.optional(payoutMethodValidator),
      payoutEmail: v.optional(v.string()),
      status: affiliateStatusValidator,
      stats: affiliateStatsValidator,
      referredByAffiliateId: v.optional(v.id("affiliates")),
      recruitmentCode: v.optional(v.string()),
      subAffiliateStats: v.optional(subAffiliateStatsValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.affiliateId);
  },
});

/**
 * Get an affiliate by their Better Auth user ID.
 */
export const getByUserId = query({
  args: {
    userId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      userId: v.string(),
      campaignId: v.id("campaigns"),
      code: v.string(),
      displayName: v.optional(v.string()),
      bio: v.optional(v.string()),
      promoContent: v.optional(promoContentValidator),
      website: v.optional(v.string()),
      socials: v.optional(socialsValidator),
      customCopy: v.optional(customCopyValidator),
      customCommissionType: v.optional(commissionTypeValidator),
      customCommissionValue: v.optional(v.number()),
      payoutMethod: v.optional(payoutMethodValidator),
      payoutEmail: v.optional(v.string()),
      status: affiliateStatusValidator,
      stats: affiliateStatsValidator,
      referredByAffiliateId: v.optional(v.id("affiliates")),
      recruitmentCode: v.optional(v.string()),
      subAffiliateStats: v.optional(subAffiliateStatsValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliates")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * List affiliates with optional filters.
 */
export const list = query({
  args: {
    status: v.optional(affiliateStatusValidator),
    campaignId: v.optional(v.id("campaigns")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      userId: v.string(),
      campaignId: v.id("campaigns"),
      code: v.string(),
      displayName: v.optional(v.string()),
      bio: v.optional(v.string()),
      promoContent: v.optional(promoContentValidator),
      website: v.optional(v.string()),
      socials: v.optional(socialsValidator),
      customCopy: v.optional(customCopyValidator),
      customCommissionType: v.optional(commissionTypeValidator),
      customCommissionValue: v.optional(v.number()),
      payoutMethod: v.optional(payoutMethodValidator),
      payoutEmail: v.optional(v.string()),
      status: affiliateStatusValidator,
      stats: affiliateStatsValidator,
      referredByAffiliateId: v.optional(v.id("affiliates")),
      recruitmentCode: v.optional(v.string()),
      subAffiliateStats: v.optional(subAffiliateStatsValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const { campaignId, status } = args;

    if (campaignId !== undefined && status !== undefined) {
      return await ctx.db
        .query("affiliates")
        .withIndex("by_campaign_status", (q) =>
          q.eq("campaignId", campaignId).eq("status", status)
        )
        .take(limit);
    }

    if (status !== undefined) {
      return await ctx.db
        .query("affiliates")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(limit);
    }

    if (campaignId !== undefined) {
      return await ctx.db
        .query("affiliates")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .take(limit);
    }

    return await ctx.db.query("affiliates").take(limit);
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Register a new affiliate.
 */
export const register = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    campaignId: v.id("campaigns"),
    customCode: v.optional(v.string()),
    displayName: v.optional(v.string()),
    website: v.optional(v.string()),
    socialMedia: v.optional(v.string()),
    payoutEmail: v.optional(v.string()),
    recruitmentReferralId: v.optional(v.string()), // Track who recruited this affiliate
  },
  returns: v.object({
    affiliateId: v.id("affiliates"),
    code: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check if user is already an affiliate
    const existing = await ctx.db
      .query("affiliates")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      throw new Error("User is already an affiliate");
    }

    // Verify campaign exists
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Look up recruitment referral if provided
    let referredByAffiliateId: Id<"affiliates"> | undefined = undefined;
    if (args.recruitmentReferralId) {
      const recruitmentReferral = await ctx.db
        .query("affiliateRecruitmentReferrals")
        .withIndex("by_referralId", (q) =>
          q.eq("referralId", args.recruitmentReferralId!)
        )
        .first();

      if (recruitmentReferral && recruitmentReferral.status === "clicked") {
        // Check if referral hasn't expired
        if (recruitmentReferral.expiresAt > Date.now()) {
          referredByAffiliateId = recruitmentReferral.recruitingAffiliateId;

          // Prevent self-recruitment
          const recruitingAffiliate = await ctx.db.get(referredByAffiliateId);
          if (recruitingAffiliate?.userId === args.userId) {
            throw new Error("Cannot recruit yourself as an affiliate");
          }
        }
      }
    }

    // Generate or validate code
    let code = args.customCode?.toUpperCase() ?? generateAffiliateCode();

    // Ensure code is unique
    let existingCode = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    while (existingCode) {
      code = generateAffiliateCode();
      existingCode = await ctx.db
        .query("affiliates")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }

    // Generate recruitment code for this affiliate
    const recruitmentCode = generateRecruitmentCode(code);

    const now = Date.now();
    const affiliateId = await ctx.db.insert("affiliates", {
      userId: args.userId,
      campaignId: args.campaignId,
      code,
      recruitmentCode,
      displayName: args.displayName,
      website: args.website,
      payoutEmail: args.payoutEmail ?? args.email,
      status: "pending",
      referredByAffiliateId,
      stats: {
        totalClicks: 0,
        totalSignups: 0,
        totalConversions: 0,
        totalRevenueCents: 0,
        totalCommissionsCents: 0,
        pendingCommissionsCents: 0,
        paidCommissionsCents: 0,
      },
      createdAt: now,
      updatedAt: now,
    });

    // Update recruitment referral status if applicable
    if (args.recruitmentReferralId && referredByAffiliateId) {
      const recruitmentReferral = await ctx.db
        .query("affiliateRecruitmentReferrals")
        .withIndex("by_referralId", (q) =>
          q.eq("referralId", args.recruitmentReferralId!)
        )
        .first();

      if (recruitmentReferral) {
        await ctx.db.patch(recruitmentReferral._id, {
          status: "signed_up",
          recruitedAffiliateId: affiliateId,
          signedUpAt: now,
        });
      }

      // Update parent's totalRecruits
      const parentAffiliate = await ctx.db.get(referredByAffiliateId);
      if (parentAffiliate) {
        const subStats = parentAffiliate.subAffiliateStats ?? initializeSubAffiliateStats();
        await ctx.db.patch(referredByAffiliateId, {
          subAffiliateStats: {
            ...subStats,
            totalRecruits: subStats.totalRecruits + 1,
          },
          updatedAt: now,
        });
      }
    }

    return { affiliateId, code };
  },
});

/**
 * Approve an affiliate application.
 */
export const approve = mutation({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    if (affiliate.status !== "pending") {
      throw new Error(`Cannot approve affiliate with status: ${affiliate.status}`);
    }

    const now = Date.now();

    await ctx.db.patch(args.affiliateId, {
      status: "approved",
      updatedAt: now,
    });

    // Update parent affiliate's stats if this affiliate was recruited
    if (affiliate.referredByAffiliateId) {
      const parentAffiliate = await ctx.db.get(affiliate.referredByAffiliateId);
      if (parentAffiliate) {
        const subStats = parentAffiliate.subAffiliateStats ?? initializeSubAffiliateStats();
        await ctx.db.patch(affiliate.referredByAffiliateId, {
          subAffiliateStats: {
            ...subStats,
            activeRecruits: subStats.activeRecruits + 1,
          },
          updatedAt: now,
        });
      }

      // Update recruitment referral status to approved
      const recruitmentReferral = await ctx.db
        .query("affiliateRecruitmentReferrals")
        .withIndex("by_recruitedAffiliateId", (q) =>
          q.eq("recruitedAffiliateId", args.affiliateId)
        )
        .first();

      if (recruitmentReferral) {
        await ctx.db.patch(recruitmentReferral._id, {
          status: "approved",
          approvedAt: now,
        });
      }
    }

    return null;
  },
});

/**
 * Reject an affiliate application.
 */
export const reject = mutation({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    if (affiliate.status !== "pending") {
      throw new Error(`Cannot reject affiliate with status: ${affiliate.status}`);
    }

    await ctx.db.patch(args.affiliateId, {
      status: "rejected",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Suspend an affiliate.
 */
export const suspend = mutation({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    if (affiliate.status === "suspended") {
      return null;
    }

    await ctx.db.patch(args.affiliateId, {
      status: "suspended",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Reactivate a suspended affiliate.
 */
export const reactivate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    if (affiliate.status !== "suspended") {
      throw new Error(`Cannot reactivate affiliate with status: ${affiliate.status}`);
    }

    await ctx.db.patch(args.affiliateId, {
      status: "approved",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Update affiliate profile.
 */
export const updateProfile = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    promoContent: v.optional(promoContentValidator),
    website: v.optional(v.string()),
    socials: v.optional(socialsValidator),
    customCopy: v.optional(customCopyValidator),
    payoutEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.displayName !== undefined) updates.displayName = args.displayName;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.promoContent !== undefined) updates.promoContent = args.promoContent;
    if (args.website !== undefined) updates.website = args.website;
    if (args.socials !== undefined) updates.socials = args.socials;
    if (args.customCopy !== undefined) updates.customCopy = args.customCopy;
    if (args.payoutEmail !== undefined) updates.payoutEmail = args.payoutEmail;

    await ctx.db.patch(args.affiliateId, updates);
    return null;
  },
});

/**
 * Set custom commission rate for an affiliate.
 */
export const setCustomCommission = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    commissionType: commissionTypeValidator,
    commissionValue: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    await ctx.db.patch(args.affiliateId, {
      customCommissionType: args.commissionType,
      customCommissionValue: args.commissionValue,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Update affiliate stats (called after events).
 */
export const updateStats = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    incrementClicks: v.optional(v.number()),
    incrementSignups: v.optional(v.number()),
    incrementConversions: v.optional(v.number()),
    incrementRevenueCents: v.optional(v.number()),
    incrementCommissionsCents: v.optional(v.number()),
    incrementPendingCents: v.optional(v.number()),
    decrementPendingCents: v.optional(v.number()),
    incrementPaidCents: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const stats = { ...affiliate.stats };

    if (args.incrementClicks) {
      stats.totalClicks += args.incrementClicks;
    }
    if (args.incrementSignups) {
      stats.totalSignups += args.incrementSignups;
    }
    if (args.incrementConversions) {
      stats.totalConversions += args.incrementConversions;
    }
    if (args.incrementRevenueCents) {
      stats.totalRevenueCents += args.incrementRevenueCents;
    }
    if (args.incrementCommissionsCents) {
      stats.totalCommissionsCents += args.incrementCommissionsCents;
    }
    if (args.incrementPendingCents) {
      stats.pendingCommissionsCents += args.incrementPendingCents;
    }
    if (args.decrementPendingCents) {
      stats.pendingCommissionsCents -= args.decrementPendingCents;
    }
    if (args.incrementPaidCents) {
      stats.paidCommissionsCents += args.incrementPaidCents;
    }

    await ctx.db.patch(args.affiliateId, {
      stats,
      updatedAt: Date.now(),
    });

    return null;
  },
});
