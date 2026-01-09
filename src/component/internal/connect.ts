"use node";

import { internalAction, internalMutation } from "../_generated/server.js";
import { v } from "convex/values";
import { api, internal } from "../_generated/api.js";
import Stripe from "stripe";

// Note: Stripe client is initialized with API key passed as argument
// to avoid environment variable access in component

/**
 * Create a Stripe Connect account link for onboarding.
 */
export const createAccountLink = internalAction({
  args: {
    affiliateId: v.id("affiliates"),
    stripeSecretKey: v.string(),
    refreshUrl: v.string(),
    returnUrl: v.string(),
  },
  returns: v.object({
    accountId: v.string(),
    accountLinkUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const stripe = new Stripe(args.stripeSecretKey);

    // Get all affiliates and find by ID (workaround since we don't have getById)
    const affiliates = await ctx.runQuery(api.affiliates.list, { limit: 1000 });
    const affiliateDoc = affiliates.find(
      (a: { _id: string }) => a._id === args.affiliateId
    );

    if (!affiliateDoc) {
      throw new Error("Affiliate not found");
    }

    // Check if affiliate already has a Connect account
    let accountId: string;

    if (affiliateDoc.stripeConnectAccountId) {
      accountId = affiliateDoc.stripeConnectAccountId;
    } else {
      // Create a new Connect account
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Update affiliate with Connect account ID
      await ctx.runMutation(internal.affiliates.updateStripeConnect, {
        affiliateId: args.affiliateId,
        stripeConnectAccountId: accountId,
        stripeConnectStatus: "pending",
      });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: args.refreshUrl,
      return_url: args.returnUrl,
      type: "account_onboarding",
    });

    return {
      accountId,
      accountLinkUrl: accountLink.url,
    };
  },
});

/**
 * Check Stripe Connect account status.
 */
export const getAccountStatus = internalAction({
  args: {
    stripeSecretKey: v.string(),
    stripeConnectAccountId: v.string(),
  },
  returns: v.object({
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
    status: v.union(
      v.literal("pending"),
      v.literal("enabled"),
      v.literal("disabled")
    ),
  }),
  handler: async (ctx, args) => {
    const stripe = new Stripe(args.stripeSecretKey);

    const account = await stripe.accounts.retrieve(args.stripeConnectAccountId);

    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    let status: "pending" | "enabled" | "disabled";
    if (chargesEnabled && payoutsEnabled && detailsSubmitted) {
      status = "enabled";
    } else if (account.requirements?.disabled_reason) {
      status = "disabled";
    } else {
      status = "pending";
    }

    return {
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      status,
    };
  },
});

/**
 * Process a transfer to a connected account.
 */
export const processTransfer = internalAction({
  args: {
    stripeSecretKey: v.string(),
    payoutId: v.id("payouts"),
    stripeConnectAccountId: v.string(),
    amountCents: v.number(),
    currency: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    transferId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const stripe = new Stripe(args.stripeSecretKey);

    try {
      // First verify the account can receive transfers
      const account = await stripe.accounts.retrieve(args.stripeConnectAccountId);

      if (!account.payouts_enabled) {
        await ctx.runMutation(internal.payouts.markFailed, {
          payoutId: args.payoutId,
          reason: "Connected account payouts not enabled",
        });

        return {
          success: false,
          error: "Connected account payouts not enabled",
        };
      }

      // Create the transfer
      const transfer = await stripe.transfers.create({
        amount: args.amountCents,
        currency: args.currency.toLowerCase(),
        destination: args.stripeConnectAccountId,
        description: args.description ?? `Affiliate payout`,
        metadata: {
          payoutId: args.payoutId,
        },
      });

      // Mark payout as completed
      await ctx.runMutation(internal.payouts.markCompleted, {
        payoutId: args.payoutId,
        stripeTransferId: transfer.id,
      });

      return {
        success: true,
        transferId: transfer.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Mark payout as failed
      await ctx.runMutation(internal.payouts.markFailed, {
        payoutId: args.payoutId,
        reason: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Create a login link for an existing connected account.
 */
export const createLoginLink = internalAction({
  args: {
    stripeSecretKey: v.string(),
    stripeConnectAccountId: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    const stripe = new Stripe(args.stripeSecretKey);

    const loginLink = await stripe.accounts.createLoginLink(
      args.stripeConnectAccountId
    );

    return {
      url: loginLink.url,
    };
  },
});

/**
 * Handle account.updated webhook for Connect accounts.
 */
export const handleAccountUpdated = internalMutation({
  args: {
    stripeConnectAccountId: v.string(),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find affiliate by Connect account ID
    const affiliates = await ctx.db.query("affiliates").collect();
    const affiliate = affiliates.find(
      (a) => a.stripeConnectAccountId === args.stripeConnectAccountId
    );

    if (!affiliate) {
      return null;
    }

    // Determine status
    let status: "pending" | "enabled" | "disabled";
    if (args.chargesEnabled && args.payoutsEnabled && args.detailsSubmitted) {
      status = "enabled";
    } else if (!args.chargesEnabled || !args.payoutsEnabled) {
      status = "disabled";
    } else {
      status = "pending";
    }

    // Update affiliate
    await ctx.db.patch(affiliate._id, {
      stripeConnectStatus: status,
      updatedAt: Date.now(),
    });

    return null;
  },
});
