import { internalMutation, internalQuery } from "../_generated/server.js";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";

/**
 * Handle invoice.paid webhook event.
 * Creates a commission for the attributed affiliate.
 */
export const handleInvoicePaid = internalMutation({
  args: {
    invoiceId: v.string(),
    stripeCustomerId: v.string(),
    subscriptionId: v.optional(v.string()),
    amountPaidCents: v.number(),
    currency: v.string(),
    affiliateCode: v.optional(v.string()),
    productId: v.optional(v.string()),
    chargeId: v.optional(v.string()),
  },
  returns: v.union(v.id("commissions"), v.null()),
  handler: async (ctx, args) => {
    // Skip zero-amount invoices
    if (args.amountPaidCents <= 0) {
      return null;
    }

    // First, try to find referral by Stripe customer ID
    let referral = await ctx.db
      .query("referrals")
      .withIndex("by_stripeCustomer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();

    // If not found and we have an affiliate code, try to attribute directly
    if (!referral && args.affiliateCode) {
      const code = args.affiliateCode;
      const affiliate = await ctx.db
        .query("affiliates")
        .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
        .first();

      if (affiliate && affiliate.status === "approved") {
        // Create a referral for this customer
        const now = Date.now();
        const campaign = await ctx.db.get(affiliate.campaignId);
        if (campaign && campaign.isActive) {
          const expiresAt = now + campaign.cookieDurationDays * 24 * 60 * 60 * 1000;
          const referralId = await ctx.db.insert("referrals", {
            affiliateId: affiliate._id,
            referralId: crypto.randomUUID(),
            landingPage: "/checkout",
            stripeCustomerId: args.stripeCustomerId,
            status: "converted",
            clickedAt: now,
            convertedAt: now,
            expiresAt,
          });
          referral = await ctx.db.get(referralId);
        }
      }
    }

    if (!referral) {
      return null; // No attribution found
    }

    // Check if referral is valid (not expired, affiliate approved)
    const affiliate = await ctx.db.get(referral.affiliateId);
    if (!affiliate || affiliate.status !== "approved") {
      return null;
    }

    // Check for existing commission for this invoice
    const existingCommission = await ctx.db
      .query("commissions")
      .withIndex("by_stripeInvoice", (q) => q.eq("stripeInvoiceId", args.invoiceId))
      .first();

    if (existingCommission) {
      return existingCommission._id as any; // Already processed
    }

    // Get campaign to check commission duration rules
    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign || !campaign.isActive) {
      return null;
    }

    // For subscriptions, track payment number and check duration limits
    let paymentNumber: number | undefined;
    if (args.subscriptionId) {
      // Count existing commissions for this subscription
      const existingForSub = await ctx.db
        .query("commissions")
        .filter((q) =>
          q.eq(q.field("stripeSubscriptionId"), args.subscriptionId)
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
    if (args.productId) {
      if (campaign.excludedProducts?.includes(args.productId)) {
        return null; // Product excluded
      }
      if (
        campaign.allowedProducts &&
        campaign.allowedProducts.length > 0 &&
        !campaign.allowedProducts.includes(args.productId)
      ) {
        return null; // Product not in allowed list
      }
    }

    // Calculate commission
    const commissionCalc: {
      commissionAmountCents: number;
      commissionType: "percentage" | "fixed";
      commissionRate: number;
    } = await ctx.runQuery(internal.commissions.calculateCommission, {
      affiliateId: affiliate._id,
      saleAmountCents: args.amountPaidCents,
      stripeProductId: args.productId,
    });

    // Create commission
    const commissionId = await ctx.runMutation(
      internal.commissions.create,
      {
        affiliateId: affiliate._id,
        referralId: referral._id,
        stripeCustomerId: args.stripeCustomerId,
        stripeInvoiceId: args.invoiceId,
        stripeChargeId: args.chargeId,
        stripeSubscriptionId: args.subscriptionId,
        stripeProductId: args.productId,
        paymentNumber,
        saleAmountCents: args.amountPaidCents,
        commissionAmountCents: commissionCalc.commissionAmountCents,
        commissionRate: commissionCalc.commissionRate,
        commissionType: commissionCalc.commissionType,
        currency: args.currency,
      }
    );

    // Mark referral as converted if not already
    if (referral.status !== "converted") {
      await ctx.runMutation(internal.referrals.convertReferral, {
        referralId: referral._id,
      });
    }

    // Record analytics event
    await ctx.runMutation(internal.analytics.recordEvent, {
      affiliateId: affiliate._id,
      type: "conversion",
      metadata: JSON.stringify({
        invoiceId: args.invoiceId,
        amountCents: args.amountPaidCents,
        commissionCents: commissionCalc.commissionAmountCents,
      }),
    });

    return commissionId;
  },
});

/**
 * Handle charge.refunded webhook event.
 * Reverses the commission for the refunded charge.
 */
export const handleChargeRefunded = internalMutation({
  args: {
    chargeId: v.string(),
    stripeCustomerId: v.string(),
    refundAmountCents: v.number(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find commission by charge ID
    const commission = await ctx.db
      .query("commissions")
      .withIndex("by_stripeCharge", (q) => q.eq("stripeChargeId", args.chargeId))
      .first();

    if (!commission) {
      return null; // No commission found for this charge
    }

    if (commission.status === "reversed") {
      return null; // Already reversed
    }

    // Reverse the commission
    await ctx.runMutation(internal.commissions.reverse, {
      commissionId: commission._id,
      reason: args.reason ?? "Charge refunded",
    });

    // Record analytics event
    await ctx.runMutation(internal.analytics.recordEvent, {
      affiliateId: commission.affiliateId,
      type: "refund",
      metadata: JSON.stringify({
        chargeId: args.chargeId,
        refundAmountCents: args.refundAmountCents,
        commissionReversedCents: commission.commissionAmountCents,
      }),
    });

    return null;
  },
});

/**
 * Handle checkout.session.completed webhook event.
 * Links Stripe customer to referral for attribution.
 */
export const handleCheckoutCompleted = internalMutation({
  args: {
    sessionId: v.string(),
    stripeCustomerId: v.string(),
    affiliateCode: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // If we have a user ID, try to find their referral
    if (args.userId) {
      const referral = await ctx.db
        .query("referrals")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();

      if (referral && !referral.stripeCustomerId) {
        // Link Stripe customer to referral
        await ctx.db.patch(referral._id, {
          stripeCustomerId: args.stripeCustomerId,
        });
        return null;
      }
    }

    // If we have an affiliate code, create attribution
    if (args.affiliateCode) {
      const code = args.affiliateCode;
      const affiliate = await ctx.db
        .query("affiliates")
        .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
        .first();

      if (affiliate && affiliate.status === "approved") {
        // Check if customer already has a referral
        const existingReferral = await ctx.db
          .query("referrals")
          .withIndex("by_stripeCustomer", (q) =>
            q.eq("stripeCustomerId", args.stripeCustomerId)
          )
          .first();

        if (!existingReferral) {
          // Create a referral for this customer
          const campaign = await ctx.db.get(affiliate.campaignId);
          if (campaign && campaign.isActive) {
            const now = Date.now();
            const expiresAt = now + campaign.cookieDurationDays * 24 * 60 * 60 * 1000;

            await ctx.db.insert("referrals", {
              affiliateId: affiliate._id,
              referralId: crypto.randomUUID(),
              landingPage: "/checkout",
              stripeCustomerId: args.stripeCustomerId,
              userId: args.userId,
              status: args.userId ? "signed_up" : "clicked",
              clickedAt: now,
              signedUpAt: args.userId ? now : undefined,
              expiresAt,
            });

            // Update affiliate stats
            await ctx.db.patch(affiliate._id, {
              stats: {
                ...affiliate.stats,
                totalClicks: affiliate.stats.totalClicks + 1,
                totalSignups: args.userId
                  ? affiliate.stats.totalSignups + 1
                  : affiliate.stats.totalSignups,
              },
              updatedAt: now,
            });
          }
        }
      }
    }

    return null;
  },
});

/**
 * Handle subscription payment (recurring).
 * Note: This function uses the same logic as handleInvoicePaid.
 * For subscription payments, call handleInvoicePaid with the subscription ID.
 */
// Removed: handleSubscriptionPayment - use handleInvoicePaid with subscriptionId parameter instead
