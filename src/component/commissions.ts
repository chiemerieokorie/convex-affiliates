import { query, mutation } from "./_generated/server.js";
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
// Queries
// ============================================

/**
 * Calculate commission amount for a sale.
 * Checks for: affiliate custom rate > product rate > campaign rate > default rate
 */
export const calculateCommission = query({
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
export const getDueForPayout = query({
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
// Mutations
// ============================================

/**
 * Create a new commission record.
 */
export const create = mutation({
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
export const approve = mutation({
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
export const markPaid = mutation({
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
          pendingCommissionsCents: Math.max(0,
            affiliate.stats.pendingCommissionsCents -
            commission.commissionAmountCents),
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
export const reverse = mutation({
  args: {
    commissionId: v.id("commissions"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }

    if (commission.status === "reversed") {
      return null; // Already reversed
    }

    const now = Date.now();
    const wasPending = commission.status === "pending" || commission.status === "approved";

    await ctx.db.patch(args.commissionId, {
      status: "reversed",
      reversedAt: now,
      reversalReason: args.reason ?? "Commission reversed",
    });

    // Update affiliate stats
    const affiliate = await ctx.db.get(commission.affiliateId);
    if (affiliate) {
      const updates = {
        ...affiliate.stats,
        totalCommissionsCents: Math.max(0,
          affiliate.stats.totalCommissionsCents -
          commission.commissionAmountCents),
      };

      if (wasPending) {
        updates.pendingCommissionsCents = Math.max(0,
          affiliate.stats.pendingCommissionsCents -
          commission.commissionAmountCents);
      } else if (commission.status === "paid") {
        updates.paidCommissionsCents = Math.max(0,
          affiliate.stats.paidCommissionsCents -
          commission.commissionAmountCents);
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
export const getByStripeInvoice = query({
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
export const getByStripeCharge = query({
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

/**
 * Create a commission from a paid invoice.
 * Called by host app's webhook handler when invoice.paid event is received.
 * Returns commission details for notification purposes.
 */
export const createFromInvoice = mutation({
  args: {
    stripeInvoiceId: v.string(),
    stripeCustomerId: v.string(),
    stripeChargeId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripeProductId: v.optional(v.string()),
    amountPaidCents: v.number(),
    currency: v.string(),
    affiliateCode: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      commissionId: v.id("commissions"),
      affiliateId: v.id("affiliates"),
      affiliateCode: v.string(),
      affiliateUserId: v.string(),
      commissionAmountCents: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Skip zero-amount invoices
    if (args.amountPaidCents <= 0) {
      return null;
    }

    // FRAUD PREVENTION: Duplicate customer detection
    // First check if this Stripe customer already has attribution
    // A customer can only be attributed to ONE affiliate
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_stripeCustomer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();

    // FRAUD PREVENTION: Do NOT create new referrals via affiliateCode in webhook handlers
    // This path could be exploited for self-referral since we cannot verify user identity.
    // Proper attribution flow: trackClick -> attributeSignup -> linkStripeCustomer
    // If no referral exists by now, the customer was not properly attributed through
    // the frontend flow, and we should not create last-minute attribution via webhook.
    // The affiliateCode parameter is kept for backwards compatibility but ignored
    // for new referral creation.

    if (!referral) {
      return null; // No attribution found
    }

    // Check if referral is valid (affiliate approved)
    const affiliate = await ctx.db.get(referral.affiliateId);
    if (!affiliate || affiliate.status !== "approved") {
      return null;
    }

    // FRAUD PREVENTION: Block self-referral commissions
    // If the referral has a userId that matches the affiliate's userId, reject
    if (referral.userId && affiliate.userId === referral.userId) {
      return null; // Affiliate cannot earn commissions on their own purchases
    }

    // Check for existing commission for this invoice (deduplication)
    const existingCommission = await ctx.db
      .query("commissions")
      .withIndex("by_stripeInvoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    if (existingCommission) {
      // Already processed - return existing commission details
      return {
        commissionId: existingCommission._id,
        affiliateId: affiliate._id,
        affiliateCode: affiliate.code,
        affiliateUserId: affiliate.userId,
        commissionAmountCents: existingCommission.commissionAmountCents,
      };
    }

    // Get campaign to check commission duration rules
    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign || !campaign.isActive) {
      return null;
    }

    // For subscriptions, track payment number and check duration limits
    let paymentNumber: number | undefined;
    if (args.stripeSubscriptionId) {
      // Count existing commissions for this subscription
      const existingForSub = await ctx.db
        .query("commissions")
        .filter((q) =>
          q.eq(q.field("stripeSubscriptionId"), args.stripeSubscriptionId)
        )
        .collect();
      paymentNumber = existingForSub.length + 1;

      // Check commission duration rules
      if (campaign.commissionDuration === "max_payments") {
        const maxPayments = campaign.commissionDurationValue ?? 1;
        if (paymentNumber > maxPayments) {
          return null; // Exceeded max payments
        }
      } else if (campaign.commissionDuration === "max_months") {
        const firstCommission = existingForSub[0];
        if (firstCommission) {
          const maxMonths = campaign.commissionDurationValue ?? 12;
          const monthsElapsed = Math.floor(
            (Date.now() - firstCommission.createdAt) / (30 * 24 * 60 * 60 * 1000)
          );
          if (monthsElapsed >= maxMonths) {
            return null; // Exceeded max months
          }
        }
      }
      // "lifetime" has no limits
    }

    // Check product restrictions
    if (args.stripeProductId) {
      if (campaign.excludedProducts?.includes(args.stripeProductId)) {
        return null; // Product excluded
      }
      if (
        campaign.allowedProducts &&
        campaign.allowedProducts.length > 0 &&
        !campaign.allowedProducts.includes(args.stripeProductId)
      ) {
        return null; // Product not in allowed list
      }
    }

    // Calculate commission amount (inline logic to avoid ctx.runQuery in mutation)
    let commissionType: CommissionType = campaign.commissionType;
    let commissionRate: number = campaign.commissionValue;

    // Priority 1: Affiliate custom rate
    if (affiliate.customCommissionType && affiliate.customCommissionValue !== undefined) {
      commissionType = affiliate.customCommissionType;
      commissionRate = affiliate.customCommissionValue;
    } else if (args.stripeProductId) {
      // Priority 2: Product-specific rate
      const productCommission = await ctx.db
        .query("productCommissions")
        .withIndex("by_campaign_product", (q) =>
          q.eq("campaignId", affiliate.campaignId).eq("stripeProductId", args.stripeProductId!)
        )
        .first();

      if (productCommission) {
        commissionType = productCommission.commissionType;
        commissionRate = productCommission.commissionValue;
      } else {
        // Priority 3: Check for tiered commission based on affiliate performance
        const tiers = await ctx.db
          .query("commissionTiers")
          .withIndex("by_campaign", (q) => q.eq("campaignId", affiliate.campaignId))
          .collect();

        if (tiers.length > 0) {
          const sortedTiers = tiers.sort((a, b) => b.minReferrals - a.minReferrals);
          const applicableTier = sortedTiers.find(
            (t) => affiliate.stats.totalConversions >= t.minReferrals
          );
          if (applicableTier) {
            commissionType = applicableTier.commissionType;
            commissionRate = applicableTier.commissionValue;
          }
        }
      }
    }

    // Calculate the actual commission amount
    const commissionAmountCents = calculateCommissionAmount(
      args.amountPaidCents,
      commissionType,
      commissionRate
    );

    const now = Date.now();
    const dueAt = now + getPayoutTermDelayMs(campaign.payoutTerm);

    // Create commission record directly
    const commissionId = await ctx.db.insert("commissions", {
      affiliateId: affiliate._id,
      referralId: referral._id,
      stripeCustomerId: args.stripeCustomerId,
      stripeInvoiceId: args.stripeInvoiceId,
      stripeChargeId: args.stripeChargeId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeProductId: args.stripeProductId,
      paymentNumber,
      saleAmountCents: args.amountPaidCents,
      commissionAmountCents,
      commissionRate,
      commissionType,
      currency: args.currency,
      status: "pending" as const,
      dueAt,
      createdAt: now,
    });

    // Update affiliate stats with commission
    await ctx.db.patch(affiliate._id, {
      stats: {
        ...affiliate.stats,
        totalRevenueCents: affiliate.stats.totalRevenueCents + args.amountPaidCents,
        totalCommissionsCents: affiliate.stats.totalCommissionsCents + commissionAmountCents,
        pendingCommissionsCents: affiliate.stats.pendingCommissionsCents + commissionAmountCents,
        totalConversions: referral.status !== "converted"
          ? affiliate.stats.totalConversions + 1
          : affiliate.stats.totalConversions,
      },
      updatedAt: now,
    });

    // Mark referral as converted if not already
    if (referral.status !== "converted") {
      await ctx.db.patch(referral._id, {
        status: "converted" as const,
        convertedAt: now,
      });
    }

    // Record analytics event
    await ctx.db.insert("events", {
      affiliateId: affiliate._id,
      type: "conversion" as const,
      metadata: JSON.stringify({
        invoiceId: args.stripeInvoiceId,
        amountCents: args.amountPaidCents,
        commissionCents: commissionAmountCents,
      }),
      timestamp: now,
    });

    // Return commission details for notification purposes
    return {
      commissionId,
      affiliateId: affiliate._id,
      affiliateCode: affiliate.code,
      affiliateUserId: affiliate.userId,
      commissionAmountCents,
    };
  },
});

/**
 * Reverse a commission by Stripe charge ID.
 * Called by host app's webhook handler when charge.refunded event is received.
 * Returns commission details for notification purposes.
 */
export const reverseByCharge = mutation({
  args: {
    stripeChargeId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      commissionId: v.id("commissions"),
      affiliateId: v.id("affiliates"),
      affiliateCode: v.optional(v.string()),
      commissionAmountCents: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find commission by charge ID
    const commission = await ctx.db
      .query("commissions")
      .withIndex("by_stripeCharge", (q) => q.eq("stripeChargeId", args.stripeChargeId))
      .first();

    if (!commission) {
      return null; // No commission found for this charge
    }

    if (commission.status === "reversed") {
      return null; // Already reversed
    }

    const now = Date.now();
    const wasPending = commission.status === "pending" || commission.status === "approved";
    const reason = args.reason ?? "Charge refunded";

    // Reverse the commission directly
    await ctx.db.patch(commission._id, {
      status: "reversed" as const,
      reversedAt: now,
      reversalReason: reason,
    });

    // Update affiliate stats
    const affiliate = await ctx.db.get(commission.affiliateId);
    if (affiliate) {
      const updates = {
        ...affiliate.stats,
        totalCommissionsCents: Math.max(0,
          affiliate.stats.totalCommissionsCents - commission.commissionAmountCents),
      };

      if (wasPending) {
        updates.pendingCommissionsCents = Math.max(0,
          affiliate.stats.pendingCommissionsCents - commission.commissionAmountCents);
      } else if (commission.status === "paid") {
        updates.paidCommissionsCents = Math.max(0,
          affiliate.stats.paidCommissionsCents - commission.commissionAmountCents);
      }

      await ctx.db.patch(affiliate._id, {
        stats: updates,
        updatedAt: now,
      });
    }

    // Record analytics event directly
    await ctx.db.insert("events", {
      affiliateId: commission.affiliateId,
      type: "refund" as const,
      metadata: JSON.stringify({
        chargeId: args.stripeChargeId,
        commissionReversedCents: commission.commissionAmountCents,
      }),
      timestamp: now,
    });

    // Return commission details for notification purposes
    return {
      commissionId: commission._id,
      affiliateId: commission.affiliateId,
      affiliateCode: affiliate?.code,
      commissionAmountCents: commission.commissionAmountCents,
    };
  },
});
