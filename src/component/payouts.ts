import { query, mutation } from "./_generated/server.js";
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
      periodStart: v.number(),
      periodEnd: v.number(),
      status: payoutStatusValidator,
      commissionsCount: v.number(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.payoutId);
  },
});

// ============================================
// Queries
// ============================================

/**
 * List pending payouts for processing.
 */
export const listPending = query({
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
    }));
  },
});

/**
 * Get affiliates that are due for payout.
 */
export const getAffiliatesDueForPayout = query({
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
// Mutations
// ============================================

/**
 * Create a new payout.
 */
export const create = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    amountCents: v.number(),
    currency: v.string(),
    method: payoutMethodValidator,
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
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: "pending",
      commissionsCount: args.commissionIds.length,
      createdAt: now,
    });

    // Validate and mark all commissions as processing
    for (const commissionId of args.commissionIds) {
      const commission = await ctx.db.get(commissionId);
      if (!commission) {
        throw new Error(`Commission ${commissionId} not found`);
      }
      if (commission.affiliateId !== args.affiliateId) {
        throw new Error("Commission belongs to a different affiliate");
      }
      if (commission.status !== "approved") {
        throw new Error(
          `Commission ${commissionId} is not in approved status (current: ${commission.status})`
        );
      }
      await ctx.db.patch(commissionId, {
        status: "processing",
        payoutId,
      });
    }

    return payoutId;
  },
});

/**
 * Mark payout as completed.
 */
export const markCompleted = mutation({
  args: {
    payoutId: v.id("payouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      throw new Error("Payout not found");
    }

    // Idempotency guard — prevent double-completion corrupting stats
    if (payout.status === "completed") return null;

    const now = Date.now();

    await ctx.db.patch(args.payoutId, {
      status: "completed",
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
 * Cancel a pending payout.
 */
export const cancel = mutation({
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

/**
 * Record a manual payout for an affiliate.
 * This creates a payout record and marks all due commissions as paid.
 * Used when payouts are processed outside of Stripe Connect (e.g., PayPal, bank transfer).
 */
export const record = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    amountCents: v.number(),
    currency: v.string(),
    method: payoutMethodValidator,
    notes: v.optional(v.string()),
  },
  returns: v.id("payouts"),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const now = Date.now();

    // Get all approved commissions due for payout
    const dueCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate_status", (q) =>
        q.eq("affiliateId", args.affiliateId).eq("status", "approved")
      )
      .filter((q) => q.lte(q.field("dueAt"), now))
      .collect();

    if (dueCommissions.length === 0) {
      throw new Error("No commissions are due for payout");
    }

    // Create the payout record
    const payoutId = await ctx.db.insert("payouts", {
      affiliateId: args.affiliateId,
      amountCents: args.amountCents,
      currency: args.currency,
      method: args.method,
      periodStart: dueCommissions.length > 0
        ? Math.min(...dueCommissions.map(c => c.createdAt))
        : now,
      periodEnd: now,
      status: "completed",
      commissionsCount: dueCommissions.length,
      notes: args.notes,
      createdAt: now,
      completedAt: now,
    });

    // Mark all due commissions as paid
    for (const commission of dueCommissions) {
      await ctx.db.patch(commission._id, {
        status: "paid",
        payoutId,
        paidAt: now,
      });
    }

    // Update affiliate stats
    const totalPaid = dueCommissions.reduce((sum, c) => sum + c.commissionAmountCents, 0);
    await ctx.db.patch(affiliate._id, {
      stats: {
        ...affiliate.stats,
        pendingCommissionsCents: affiliate.stats.pendingCommissionsCents - totalPaid,
        paidCommissionsCents: affiliate.stats.paidCommissionsCents + totalPaid,
      },
      updatedAt: now,
    });

    return payoutId;
  },
});
