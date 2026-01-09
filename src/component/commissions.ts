import { query, internalQuery, internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  commissionStatusValidator,
  commissionTypeValidator,
  calculateCommissionAmount,
  getPayoutTermDelayMs,
  type CommissionType,
} from "./validators.js";

// ============================================
// Public Queries
// ============================================

/**
 * List commissions for an affiliate with pagination.
 */
export const listByAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
    status: v.optional(commissionStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { status } = args;
    if (status !== undefined) {
      return await ctx.db
        .query("commissions")
        .withIndex("by_affiliate_status", (q) =>
          q.eq("affiliateId", args.affiliateId).eq("status", status)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get total pending commissions for an affiliate.
 */
export const getPendingTotal = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.object({
    totalCents: v.number(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    const pendingCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate_status", (q) =>
        q.eq("affiliateId", args.affiliateId).eq("status", "pending")
      )
      .collect();

    const approvedCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate_status", (q) =>
        q.eq("affiliateId", args.affiliateId).eq("status", "approved")
      )
      .collect();

    const allPending = [...pendingCommissions, ...approvedCommissions];

    return {
      totalCents: allPending.reduce((sum, c) => sum + c.commissionAmountCents, 0),
      count: allPending.length,
    };
  },
});

// ============================================
// Internal Queries
// ============================================

/**
 * Calculate commission amount for a sale.
 * Checks for: affiliate custom rate > product rate > campaign rate > default rate
 */
export const calculateCommission = internalQuery({
  args: {
    affiliateId: v.id("affiliates"),
    saleAmountCents: v.number(),
    stripeProductId: v.optional(v.string()),
  },
  returns: v.object({
    commissionAmountCents: v.number(),
    commissionType: commissionTypeValidator,
    commissionRate: v.number(),
  }),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Priority 1: Affiliate custom rate
    if (
      affiliate.customCommissionType &&
      affiliate.customCommissionValue !== undefined
    ) {
      const amount = calculateCommissionAmount(
        args.saleAmountCents,
        affiliate.customCommissionType,
        affiliate.customCommissionValue
      );
      return {
        commissionAmountCents: amount,
        commissionType: affiliate.customCommissionType,
        commissionRate: affiliate.customCommissionValue,
      };
    }

    // Priority 2: Product-specific rate
    const { stripeProductId } = args;
    if (stripeProductId !== undefined) {
      const productCommission = await ctx.db
        .query("productCommissions")
        .withIndex("by_campaign_product", (q) =>
          q
            .eq("campaignId", affiliate.campaignId)
            .eq("stripeProductId", stripeProductId)
        )
        .first();

      if (productCommission) {
        const amount = calculateCommissionAmount(
          args.saleAmountCents,
          productCommission.commissionType,
          productCommission.commissionValue
        );
        return {
          commissionAmountCents: amount,
          commissionType: productCommission.commissionType,
          commissionRate: productCommission.commissionValue,
        };
      }
    }

    // Priority 3: Check for tiered commission based on affiliate performance
    const tiers = await ctx.db
      .query("commissionTiers")
      .withIndex("by_campaign", (q) => q.eq("campaignId", affiliate.campaignId))
      .collect();

    if (tiers.length > 0) {
      // Sort by minReferrals descending to find the highest applicable tier
      const sortedTiers = tiers.sort((a, b) => b.minReferrals - a.minReferrals);
      const applicableTier = sortedTiers.find(
        (t) => affiliate.stats.totalConversions >= t.minReferrals
      );

      if (applicableTier) {
        const amount = calculateCommissionAmount(
          args.saleAmountCents,
          applicableTier.commissionType,
          applicableTier.commissionValue
        );
        return {
          commissionAmountCents: amount,
          commissionType: applicableTier.commissionType,
          commissionRate: applicableTier.commissionValue,
        };
      }
    }

    // Priority 4: Campaign default rate
    const amount = calculateCommissionAmount(
      args.saleAmountCents,
      campaign.commissionType,
      campaign.commissionValue
    );
    return {
      commissionAmountCents: amount,
      commissionType: campaign.commissionType,
      commissionRate: campaign.commissionValue,
    };
  },
});

/**
 * Get commissions that are due for payout.
 */
export const getDueForPayout = internalQuery({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.array(
    v.object({
      _id: v.id("commissions"),
      commissionAmountCents: v.number(),
      currency: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get approved commissions that are past their due date
    const approvedCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate_status", (q) =>
        q.eq("affiliateId", args.affiliateId).eq("status", "approved")
      )
      .filter((q) => q.lte(q.field("dueAt"), now))
      .collect();

    return approvedCommissions.map((c) => ({
      _id: c._id,
      commissionAmountCents: c.commissionAmountCents,
      currency: c.currency,
    }));
  },
});

// ============================================
// Internal Mutations
// ============================================

/**
 * Create a new commission record.
 */
export const create = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    referralId: v.id("referrals"),
    stripeCustomerId: v.string(),
    stripeInvoiceId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripeProductId: v.optional(v.string()),
    paymentNumber: v.optional(v.number()),
    subscriptionStartedAt: v.optional(v.number()),
    saleAmountCents: v.number(),
    commissionAmountCents: v.number(),
    commissionRate: v.number(),
    commissionType: commissionTypeValidator,
    currency: v.string(),
  },
  returns: v.id("commissions"),
  handler: async (ctx, args) => {
    // Get affiliate and campaign to determine payout term
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const now = Date.now();
    const dueAt = now + getPayoutTermDelayMs(campaign.payoutTerm);

    const commissionId = await ctx.db.insert("commissions", {
      affiliateId: args.affiliateId,
      referralId: args.referralId,
      stripeCustomerId: args.stripeCustomerId,
      stripeInvoiceId: args.stripeInvoiceId,
      stripeChargeId: args.stripeChargeId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeProductId: args.stripeProductId,
      paymentNumber: args.paymentNumber,
      subscriptionStartedAt: args.subscriptionStartedAt,
      saleAmountCents: args.saleAmountCents,
      commissionAmountCents: args.commissionAmountCents,
      commissionRate: args.commissionRate,
      commissionType: args.commissionType,
      currency: args.currency,
      status: "pending",
      dueAt,
      createdAt: now,
    });

    // Update affiliate stats
    await ctx.db.patch(affiliate._id, {
      stats: {
        ...affiliate.stats,
        totalRevenueCents:
          affiliate.stats.totalRevenueCents + args.saleAmountCents,
        totalCommissionsCents:
          affiliate.stats.totalCommissionsCents + args.commissionAmountCents,
        pendingCommissionsCents:
          affiliate.stats.pendingCommissionsCents + args.commissionAmountCents,
      },
      updatedAt: now,
    });

    return commissionId;
  },
});

/**
 * Approve a pending commission.
 */
export const approve = internalMutation({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }

    if (commission.status !== "pending") {
      throw new Error(`Cannot approve commission with status: ${commission.status}`);
    }

    await ctx.db.patch(args.commissionId, {
      status: "approved",
      approvedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Mark a commission as paid.
 */
export const markPaid = internalMutation({
  args: {
    commissionId: v.id("commissions"),
    payoutId: v.id("payouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.commissionId, {
      status: "paid",
      payoutId: args.payoutId,
      paidAt: now,
    });

    // Update affiliate stats
    const affiliate = await ctx.db.get(commission.affiliateId);
    if (affiliate) {
      await ctx.db.patch(affiliate._id, {
        stats: {
          ...affiliate.stats,
          pendingCommissionsCents:
            affiliate.stats.pendingCommissionsCents -
            commission.commissionAmountCents,
          paidCommissionsCents:
            affiliate.stats.paidCommissionsCents +
            commission.commissionAmountCents,
        },
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Reverse a commission (refund/chargeback).
 */
export const reverse = internalMutation({
  args: {
    commissionId: v.id("commissions"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }

    const now = Date.now();
    const wasPending = commission.status === "pending" || commission.status === "approved";

    await ctx.db.patch(args.commissionId, {
      status: "reversed",
      reversedAt: now,
      reversalReason: args.reason,
    });

    // Update affiliate stats
    const affiliate = await ctx.db.get(commission.affiliateId);
    if (affiliate) {
      const updates = {
        ...affiliate.stats,
        totalCommissionsCents:
          affiliate.stats.totalCommissionsCents -
          commission.commissionAmountCents,
      };

      if (wasPending) {
        updates.pendingCommissionsCents =
          affiliate.stats.pendingCommissionsCents -
          commission.commissionAmountCents;
      } else if (commission.status === "paid") {
        updates.paidCommissionsCents =
          affiliate.stats.paidCommissionsCents -
          commission.commissionAmountCents;
      }

      await ctx.db.patch(affiliate._id, {
        stats: updates,
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Find commission by Stripe invoice ID.
 */
export const getByStripeInvoice = internalQuery({
  args: {
    stripeInvoiceId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      affiliateId: v.id("affiliates"),
      status: commissionStatusValidator,
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const commission = await ctx.db
      .query("commissions")
      .withIndex("by_stripeInvoice", (q) =>
        q.eq("stripeInvoiceId", args.stripeInvoiceId)
      )
      .first();

    if (!commission) return null;

    return {
      _id: commission._id,
      affiliateId: commission.affiliateId,
      status: commission.status,
    };
  },
});

/**
 * Find commission by Stripe charge ID.
 */
export const getByStripeCharge = internalQuery({
  args: {
    stripeChargeId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      affiliateId: v.id("affiliates"),
      status: commissionStatusValidator,
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const commission = await ctx.db
      .query("commissions")
      .withIndex("by_stripeCharge", (q) =>
        q.eq("stripeChargeId", args.stripeChargeId)
      )
      .first();

    if (!commission) return null;

    return {
      _id: commission._id,
      affiliateId: commission.affiliateId,
      status: commission.status,
    };
  },
});
