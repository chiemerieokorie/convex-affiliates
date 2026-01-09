import { query, internalQuery, internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { payoutStatusValidator, payoutMethodValidator } from "./validators.js";

// ============================================
// Public Queries
// ============================================

/**
 * List payouts for an affiliate with pagination.
 */
export const listByAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
    status: v.optional(payoutStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { status } = args;
    if (status !== undefined) {
      return await ctx.db
        .query("payouts")
        .withIndex("by_affiliate_status", (q) =>
          q.eq("affiliateId", args.affiliateId).eq("status", status)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("payouts")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get a single payout by ID.
 */
export const get = query({
  args: {
    payoutId: v.id("payouts"),
  },
  returns: v.union(
    v.object({
      _id: v.id("payouts"),
      _creationTime: v.number(),
      affiliateId: v.id("affiliates"),
      amountCents: v.number(),
      currency: v.string(),
      method: payoutMethodValidator,
      stripeConnectAccountId: v.optional(v.string()),
      stripeTransferId: v.optional(v.string()),
      periodStart: v.number(),
      periodEnd: v.number(),
      status: payoutStatusValidator,
      commissionsCount: v.number(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      processedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      failureReason: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.payoutId);
  },
});

// ============================================
// Internal Queries
// ============================================

/**
 * List pending payouts for processing.
 */
export const listPending = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("payouts"),
      affiliateId: v.id("affiliates"),
      amountCents: v.number(),
      currency: v.string(),
      method: payoutMethodValidator,
      stripeConnectAccountId: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(limit);

    return payouts.map((p) => ({
      _id: p._id,
      affiliateId: p.affiliateId,
      amountCents: p.amountCents,
      currency: p.currency,
      method: p.method,
      stripeConnectAccountId: p.stripeConnectAccountId,
    }));
  },
});

/**
 * Get affiliates that are due for payout.
 */
export const getAffiliatesDueForPayout = internalQuery({
  args: {
    minPayoutCents: v.number(),
  },
  returns: v.array(
    v.object({
      affiliateId: v.id("affiliates"),
      totalDueCents: v.number(),
      commissionCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all approved commissions that are past their due date
    const dueCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_status_dueAt", (q) => q.eq("status", "approved"))
      .filter((q) => q.lte(q.field("dueAt"), now))
      .collect();

    // Group by affiliate
    const byAffiliate = new Map<
      string,
      { totalCents: number; count: number }
    >();

    for (const commission of dueCommissions) {
      const key = commission.affiliateId;
      const existing = byAffiliate.get(key) ?? { totalCents: 0, count: 0 };
      byAffiliate.set(key, {
        totalCents: existing.totalCents + commission.commissionAmountCents,
        count: existing.count + 1,
      });
    }

    // Filter by minimum payout and return
    const results: Array<{
      affiliateId: typeof dueCommissions[0]["affiliateId"];
      totalDueCents: number;
      commissionCount: number;
    }> = [];

    for (const [affiliateId, data] of byAffiliate) {
      if (data.totalCents >= args.minPayoutCents) {
        results.push({
          affiliateId: affiliateId as typeof dueCommissions[0]["affiliateId"],
          totalDueCents: data.totalCents,
          commissionCount: data.count,
        });
      }
    }

    return results;
  },
});

// ============================================
// Internal Mutations
// ============================================

/**
 * Create a new payout.
 */
export const create = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    amountCents: v.number(),
    currency: v.string(),
    method: payoutMethodValidator,
    stripeConnectAccountId: v.optional(v.string()),
    periodStart: v.number(),
    periodEnd: v.number(),
    commissionIds: v.array(v.id("commissions")),
  },
  returns: v.id("payouts"),
  handler: async (ctx, args) => {
    const now = Date.now();

    const payoutId = await ctx.db.insert("payouts", {
      affiliateId: args.affiliateId,
      amountCents: args.amountCents,
      currency: args.currency,
      method: args.method,
      stripeConnectAccountId: args.stripeConnectAccountId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: "pending",
      commissionsCount: args.commissionIds.length,
      createdAt: now,
    });

    // Mark all commissions as processing
    for (const commissionId of args.commissionIds) {
      await ctx.db.patch(commissionId, {
        status: "processing",
        payoutId,
      });
    }

    return payoutId;
  },
});

/**
 * Mark payout as processing.
 */
export const markProcessing = internalMutation({
  args: {
    payoutId: v.id("payouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      throw new Error("Payout not found");
    }

    if (payout.status !== "pending") {
      throw new Error(`Cannot process payout with status: ${payout.status}`);
    }

    await ctx.db.patch(args.payoutId, {
      status: "processing",
      processedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Mark payout as completed.
 */
export const markCompleted = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    stripeTransferId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      throw new Error("Payout not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.payoutId, {
      status: "completed",
      stripeTransferId: args.stripeTransferId,
      completedAt: now,
    });

    // Mark all commissions in this payout as paid
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_payout", (q) => q.eq("payoutId", args.payoutId))
      .collect();

    for (const commission of commissions) {
      await ctx.db.patch(commission._id, {
        status: "paid",
        paidAt: now,
      });
    }

    // Update affiliate stats
    const affiliate = await ctx.db.get(payout.affiliateId);
    if (affiliate) {
      await ctx.db.patch(affiliate._id, {
        stats: {
          ...affiliate.stats,
          pendingCommissionsCents:
            affiliate.stats.pendingCommissionsCents - payout.amountCents,
          paidCommissionsCents:
            affiliate.stats.paidCommissionsCents + payout.amountCents,
        },
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Mark payout as failed.
 */
export const markFailed = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      throw new Error("Payout not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.payoutId, {
      status: "failed",
      failedAt: now,
      failureReason: args.reason,
    });

    // Revert commissions back to approved status
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_payout", (q) => q.eq("payoutId", args.payoutId))
      .collect();

    for (const commission of commissions) {
      await ctx.db.patch(commission._id, {
        status: "approved",
        payoutId: undefined,
      });
    }

    return null;
  },
});

/**
 * Cancel a pending payout.
 */
export const cancel = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      throw new Error("Payout not found");
    }

    if (payout.status !== "pending") {
      throw new Error(`Cannot cancel payout with status: ${payout.status}`);
    }

    await ctx.db.patch(args.payoutId, {
      status: "cancelled",
      notes: args.notes,
    });

    // Revert commissions back to approved status
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_payout", (q) => q.eq("payoutId", args.payoutId))
      .collect();

    for (const commission of commissions) {
      await ctx.db.patch(commission._id, {
        status: "approved",
        payoutId: undefined,
      });
    }

    return null;
  },
});
