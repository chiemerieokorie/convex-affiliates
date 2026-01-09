"use node";

import { internalAction, internalMutation } from "../_generated/server.js";
import { v } from "convex/values";
import { api, internal } from "../_generated/api.js";

/**
 * Note: For production use, integrate @convex-dev/workflow for durable workflows.
 * This simplified version processes payouts directly without workflow orchestration.
 */

/**
 * Process payout for a single affiliate.
 * In production, this would use @convex-dev/workflow for durability.
 */
export const processPayoutForAffiliate = internalAction({
  args: {
    affiliateId: v.id("affiliates"),
    stripeSecretKey: v.string(),
    minPayoutCents: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    payoutId: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    error: v.optional(v.string()),
    skipped: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    payoutId?: string;
    amountCents?: number;
    error?: string;
    skipped?: boolean;
    reason?: string;
  }> => {
    // Step 1: Get due commissions for this affiliate
    const dueCommissions = await ctx.runQuery(
      internal.commissions.getDueForPayout,
      { affiliateId: args.affiliateId }
    );

    if (dueCommissions.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: "no_due_commissions",
      };
    }

    // Step 2: Calculate total
    const totalCents = dueCommissions.reduce(
      (sum: number, c: { commissionAmountCents: number }) =>
        sum + c.commissionAmountCents,
      0
    );

    // Step 3: Check minimum payout threshold
    if (totalCents < args.minPayoutCents) {
      return {
        success: true,
        skipped: true,
        reason: "below_minimum",
        amountCents: totalCents,
      };
    }

    // Step 4: Get affiliate details for Stripe Connect
    const affiliates = await ctx.runQuery(api.affiliates.list, {
      limit: 1000,
    });
    const affiliate = affiliates.find(
      (a: { _id: string }) => a._id === args.affiliateId
    );

    if (!affiliate || !affiliate.stripeConnectAccountId) {
      return {
        success: false,
        error: "Affiliate not found or Stripe Connect not configured",
      };
    }

    // Step 5: Create payout record
    const now = Date.now();
    const payoutId = await ctx.runMutation(internal.payouts.create, {
      affiliateId: args.affiliateId,
      amountCents: totalCents,
      currency: dueCommissions[0].currency,
      method: "stripe_connect" as const,
      stripeConnectAccountId: affiliate.stripeConnectAccountId,
      periodStart: now - 30 * 24 * 60 * 60 * 1000,
      periodEnd: now,
      commissionIds: dueCommissions.map(
        (c: { _id: string }) => c._id
      ) as any,
    });

    // Step 6: Mark payout as processing
    await ctx.runMutation(internal.payouts.markProcessing, {
      payoutId,
    });

    // Step 7: Process Stripe transfer
    const transferResult = await ctx.runAction(
      internal.internal.connect.processTransfer as any,
      {
        stripeSecretKey: args.stripeSecretKey,
        payoutId,
        stripeConnectAccountId: affiliate.stripeConnectAccountId,
        amountCents: totalCents,
        currency: dueCommissions[0].currency,
        description: `Affiliate payout for ${dueCommissions.length} commissions`,
      }
    );

    if (!transferResult.success) {
      return {
        success: false,
        payoutId,
        error: transferResult.error,
      };
    }

    return {
      success: true,
      payoutId,
      amountCents: totalCents,
    };
  },
});

/**
 * Trigger payout for an affiliate.
 */
export const triggerPayoutWorkflow = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    stripeSecretKey: v.string(),
    minPayoutCents: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Schedule the payout action
    const scheduledId = await ctx.scheduler.runAfter(
      0,
      internal.internal.workflows.processPayoutForAffiliate as any,
      {
        affiliateId: args.affiliateId,
        stripeSecretKey: args.stripeSecretKey,
        minPayoutCents: args.minPayoutCents,
      }
    );

    return scheduledId.toString();
  },
});

/**
 * Batch process payouts for all eligible affiliates.
 */
export const processAllDuePayouts = internalAction({
  args: {
    stripeSecretKey: v.string(),
    minPayoutCents: v.number(),
  },
  returns: v.object({
    triggered: v.number(),
    affiliateIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get all affiliates due for payout
    const dueAffiliates = await ctx.runQuery(
      internal.payouts.getAffiliatesDueForPayout,
      { minPayoutCents: args.minPayoutCents }
    );

    const triggeredIds: string[] = [];

    for (const due of dueAffiliates) {
      // Trigger payout for each affiliate
      await ctx.runMutation(
        internal.internal.workflows.triggerPayoutWorkflow as any,
        {
          affiliateId: due.affiliateId,
          stripeSecretKey: args.stripeSecretKey,
          minPayoutCents: args.minPayoutCents,
        }
      );

      triggeredIds.push(due.affiliateId);
    }

    return {
      triggered: triggeredIds.length,
      affiliateIds: triggeredIds,
    };
  },
});
