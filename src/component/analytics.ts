import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import {
  eventTypeValidator,
  affiliateStatsValidator,
  affiliateStatusValidator,
  payoutStatusValidator,
} from "./validators.js";

// ============================================
// Public Queries
// ============================================

/**
 * Get all data needed for the affiliate portal.
 */
export const getPortalData = query({
  args: {
    userId: v.string(),
  },
  returns: v.union(
    v.object({
      affiliate: v.object({
        _id: v.id("affiliates"),
        code: v.string(),
        displayName: v.optional(v.string()),
        status: affiliateStatusValidator,
        stats: affiliateStatsValidator,
      }),
      campaign: v.object({
        name: v.string(),
        commissionType: v.union(v.literal("percentage"), v.literal("fixed")),
        commissionValue: v.number(),
      }),
      recentCommissions: v.array(
        v.object({
          _id: v.id("commissions"),
          saleAmountCents: v.number(),
          commissionAmountCents: v.number(),
          currency: v.string(),
          status: v.string(),
          createdAt: v.number(),
        })
      ),
      pendingPayout: v.object({
        amountCents: v.number(),
        count: v.number(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find affiliate by user ID
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!affiliate) {
      return null;
    }

    // Get campaign
    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign) {
      return null;
    }

    // Get recent commissions
    const recentCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .order("desc")
      .take(10);

    // Calculate pending payout
    const pendingCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate_status", (q) =>
        q.eq("affiliateId", affiliate._id).eq("status", "pending")
      )
      .collect();

    const approvedCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate_status", (q) =>
        q.eq("affiliateId", affiliate._id).eq("status", "approved")
      )
      .collect();

    const allPending = [...pendingCommissions, ...approvedCommissions];
    const pendingPayout = {
      amountCents: allPending.reduce(
        (sum, c) => sum + c.commissionAmountCents,
        0
      ),
      count: allPending.length,
    };

    return {
      affiliate: {
        _id: affiliate._id,
        code: affiliate.code,
        displayName: affiliate.displayName,
        status: affiliate.status,
        stats: affiliate.stats,
      },
      campaign: {
        name: campaign.name,
        commissionType: campaign.commissionType,
        commissionValue: campaign.commissionValue,
      },
      recentCommissions: recentCommissions.map((c) => ({
        _id: c._id,
        saleAmountCents: c.saleAmountCents,
        commissionAmountCents: c.commissionAmountCents,
        currency: c.currency,
        status: c.status,
        createdAt: c.createdAt,
      })),
      pendingPayout,
    };
  },
});

/**
 * Get admin dashboard overview.
 */
export const getAdminDashboard = query({
  args: {},
  returns: v.object({
    totalAffiliates: v.number(),
    pendingApprovals: v.number(),
    activeAffiliates: v.number(),
    totalClicks: v.number(),
    totalSignups: v.number(),
    totalConversions: v.number(),
    totalRevenueCents: v.number(),
    totalCommissionsCents: v.number(),
    pendingPayoutsCents: v.number(),
    paidPayoutsCents: v.number(),
    activeCampaigns: v.number(),
  }),
  handler: async (ctx) => {
    // Count affiliates
    const allAffiliates = await ctx.db.query("affiliates").collect();
    const pendingAffiliates = allAffiliates.filter(
      (a) => a.status === "pending"
    );
    const activeAffiliates = allAffiliates.filter(
      (a) => a.status === "approved"
    );

    // Aggregate stats from all affiliates
    let totalClicks = 0;
    let totalSignups = 0;
    let totalConversions = 0;
    let totalRevenueCents = 0;
    let totalCommissionsCents = 0;
    let pendingPayoutsCents = 0;
    let paidPayoutsCents = 0;

    for (const affiliate of allAffiliates) {
      totalClicks += affiliate.stats.totalClicks;
      totalSignups += affiliate.stats.totalSignups;
      totalConversions += affiliate.stats.totalConversions;
      totalRevenueCents += affiliate.stats.totalRevenueCents;
      totalCommissionsCents += affiliate.stats.totalCommissionsCents;
      pendingPayoutsCents += affiliate.stats.pendingCommissionsCents;
      paidPayoutsCents += affiliate.stats.paidCommissionsCents;
    }

    // Count active campaigns
    const activeCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return {
      totalAffiliates: allAffiliates.length,
      pendingApprovals: pendingAffiliates.length,
      activeAffiliates: activeAffiliates.length,
      totalClicks,
      totalSignups,
      totalConversions,
      totalRevenueCents,
      totalCommissionsCents,
      pendingPayoutsCents,
      paidPayoutsCents,
      activeCampaigns: activeCampaigns.length,
    };
  },
});

/**
 * Get top performing affiliates.
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
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      code: v.string(),
      displayName: v.optional(v.string()),
      stats: affiliateStatsValidator,
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const sortBy = args.sortBy ?? "conversions";

    // Get all approved affiliates
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    // Sort by the specified metric
    const sorted = affiliates.sort((a, b) => {
      switch (sortBy) {
        case "revenue":
          return b.stats.totalRevenueCents - a.stats.totalRevenueCents;
        case "commissions":
          return b.stats.totalCommissionsCents - a.stats.totalCommissionsCents;
        case "conversions":
        default:
          return b.stats.totalConversions - a.stats.totalConversions;
      }
    });

    return sorted.slice(0, limit).map((a) => ({
      _id: a._id,
      code: a.code,
      displayName: a.displayName,
      stats: a.stats,
    }));
  },
});

/**
 * Get conversion funnel stats.
 */
export const getConversionFunnel = query({
  args: {
    affiliateId: v.optional(v.id("affiliates")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    clicks: v.number(),
    signups: v.number(),
    conversions: v.number(),
    clickToSignupRate: v.number(),
    signupToConversionRate: v.number(),
    overallConversionRate: v.number(),
  }),
  handler: async (ctx, args) => {
    let clicks = 0;
    let signups = 0;
    let conversions = 0;

    if (args.affiliateId) {
      // Get stats for a specific affiliate
      const affiliate = await ctx.db.get(args.affiliateId);
      if (affiliate) {
        clicks = affiliate.stats.totalClicks;
        signups = affiliate.stats.totalSignups;
        conversions = affiliate.stats.totalConversions;
      }
    } else {
      // Aggregate all affiliates
      const affiliates = await ctx.db.query("affiliates").collect();
      for (const affiliate of affiliates) {
        clicks += affiliate.stats.totalClicks;
        signups += affiliate.stats.totalSignups;
        conversions += affiliate.stats.totalConversions;
      }
    }

    const clickToSignupRate = clicks > 0 ? (signups / clicks) * 100 : 0;
    const signupToConversionRate = signups > 0 ? (conversions / signups) * 100 : 0;
    const overallConversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

    return {
      clicks,
      signups,
      conversions,
      clickToSignupRate: Math.round(clickToSignupRate * 100) / 100,
      signupToConversionRate: Math.round(signupToConversionRate * 100) / 100,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100,
    };
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Record an analytics event.
 */
export const recordEvent = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    type: eventTypeValidator,
    metadata: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      affiliateId: args.affiliateId,
      type: args.type,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  },
});

/**
 * Get recent events for an affiliate.
 */
export const getRecentEvents = query({
  args: {
    affiliateId: v.id("affiliates"),
    type: v.optional(eventTypeValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("events"),
      type: eventTypeValidator,
      metadata: v.optional(v.string()),
      timestamp: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const { type } = args;

    if (type !== undefined) {
      return await ctx.db
        .query("events")
        .withIndex("by_affiliate_type", (q) =>
          q.eq("affiliateId", args.affiliateId).eq("type", type)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("events")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .take(limit);
  },
});
