import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import {
  referralStatusValidator,
  commissionTypeValidator,
} from "./validators.js";

// ============================================
// Public Queries
// ============================================

/**
 * Get an active referral by referral ID.
 */
export const getByReferralId = query({
  args: {
    referralId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("referrals"),
      _creationTime: v.number(),
      affiliateId: v.id("affiliates"),
      referralId: v.string(),
      landingPage: v.string(),
      utmSource: v.optional(v.string()),
      utmMedium: v.optional(v.string()),
      utmCampaign: v.optional(v.string()),
      subId: v.optional(v.string()),
      deviceType: v.optional(v.string()),
      country: v.optional(v.string()),
      status: referralStatusValidator,
      userId: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      clickedAt: v.number(),
      signedUpAt: v.optional(v.number()),
      convertedAt: v.optional(v.number()),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_referralId", (q) => q.eq("referralId", args.referralId))
      .first();
  },
});

/**
 * Get a referral by the user who was referred.
 */
export const getByUserId = query({
  args: {
    userId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("referrals"),
      _creationTime: v.number(),
      affiliateId: v.id("affiliates"),
      referralId: v.string(),
      landingPage: v.string(),
      utmSource: v.optional(v.string()),
      utmMedium: v.optional(v.string()),
      utmCampaign: v.optional(v.string()),
      subId: v.optional(v.string()),
      deviceType: v.optional(v.string()),
      country: v.optional(v.string()),
      status: referralStatusValidator,
      userId: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      clickedAt: v.number(),
      signedUpAt: v.optional(v.number()),
      convertedAt: v.optional(v.number()),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Get a referral by Stripe customer ID.
 */
export const getByStripeCustomer = query({
  args: {
    stripeCustomerId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("referrals"),
      _creationTime: v.number(),
      affiliateId: v.id("affiliates"),
      referralId: v.string(),
      landingPage: v.string(),
      utmSource: v.optional(v.string()),
      utmMedium: v.optional(v.string()),
      utmCampaign: v.optional(v.string()),
      subId: v.optional(v.string()),
      deviceType: v.optional(v.string()),
      country: v.optional(v.string()),
      status: referralStatusValidator,
      userId: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      clickedAt: v.number(),
      signedUpAt: v.optional(v.number()),
      convertedAt: v.optional(v.number()),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_stripeCustomer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
  },
});

/**
 * List referrals for an affiliate.
 */
export const listByAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
    status: v.optional(referralStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("referrals"),
      _creationTime: v.number(),
      affiliateId: v.id("affiliates"),
      referralId: v.string(),
      landingPage: v.string(),
      utmSource: v.optional(v.string()),
      utmMedium: v.optional(v.string()),
      utmCampaign: v.optional(v.string()),
      subId: v.optional(v.string()),
      deviceType: v.optional(v.string()),
      country: v.optional(v.string()),
      status: referralStatusValidator,
      userId: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      clickedAt: v.number(),
      signedUpAt: v.optional(v.number()),
      convertedAt: v.optional(v.number()),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const { status } = args;

    if (status !== undefined) {
      return await ctx.db
        .query("referrals")
        .withIndex("by_affiliate_status", (q) =>
          q.eq("affiliateId", args.affiliateId).eq("status", status)
        )
        .take(limit);
    }

    return await ctx.db
      .query("referrals")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(limit);
  },
});

/**
 * Get the referee discount for a referral.
 * Used by host apps to apply discounts during checkout.
 * Returns discount details if the referral's campaign has a referee discount configured.
 */
export const getRefereeDiscount = query({
  args: {
    referralId: v.optional(v.string()),
    affiliateCode: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      discountType: commissionTypeValidator,
      discountValue: v.number(),
      stripeCouponId: v.optional(v.string()),
      affiliateCode: v.string(),
      affiliateDisplayName: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find the referral by any of the provided identifiers
    let affiliate = null;

    // Try by referral ID first
    if (args.referralId) {
      const referral = await ctx.db
        .query("referrals")
        .withIndex("by_referralId", (q) => q.eq("referralId", args.referralId!))
        .first();
      if (referral) {
        affiliate = await ctx.db.get(referral.affiliateId);
      }
    }

    // Try by user ID
    if (!affiliate && args.userId) {
      const referral = await ctx.db
        .query("referrals")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
        .first();
      if (referral) {
        affiliate = await ctx.db.get(referral.affiliateId);
      }
    }

    // Try by affiliate code directly
    if (!affiliate && args.affiliateCode) {
      affiliate = await ctx.db
        .query("affiliates")
        .withIndex("by_code", (q) => q.eq("code", args.affiliateCode!.toUpperCase()))
        .first();
    }

    if (!affiliate || affiliate.status !== "approved") {
      return null;
    }

    // Get the campaign to check for referee discount
    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign || !campaign.isActive) {
      return null;
    }

    // Check if campaign has a referee discount configured
    if (!campaign.refereeDiscountType || campaign.refereeDiscountValue === undefined) {
      return null;
    }

    return {
      discountType: campaign.refereeDiscountType,
      discountValue: campaign.refereeDiscountValue,
      stripeCouponId: campaign.refereeStripeCouponId,
      affiliateCode: affiliate.code,
      affiliateDisplayName: affiliate.displayName,
    };
  },
});

// ============================================
// Public Mutations
// ============================================

/**
 * Track a referral click.
 * Called from the frontend when a user visits with a referral code.
 */
export const trackClick = mutation({
  args: {
    affiliateCode: v.string(),
    landingPage: v.string(),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    subId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      referralId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find the affiliate by code
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", args.affiliateCode.toUpperCase()))
      .first();

    if (!affiliate) {
      return null; // Invalid affiliate code
    }

    if (affiliate.status !== "approved") {
      return null; // Affiliate not approved
    }

    // Get campaign to determine cookie duration
    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign || !campaign.isActive) {
      return null; // Campaign not found or inactive
    }

    // Generate a referral ID
    const referralId = crypto.randomUUID();

    const now = Date.now();
    const expiresAt = now + campaign.cookieDurationDays * 24 * 60 * 60 * 1000;

    await ctx.db.insert("referrals", {
      affiliateId: affiliate._id,
      referralId,
      landingPage: args.landingPage,
      subId: args.subId,
      status: "clicked",
      clickedAt: now,
      expiresAt,
    });

    // Update affiliate stats
    await ctx.db.patch(affiliate._id, {
      stats: {
        ...affiliate.stats,
        totalClicks: affiliate.stats.totalClicks + 1,
      },
      updatedAt: now,
    });

    return { referralId };
  },
});

// ============================================
// Mutations (Host App Callable)
// ============================================

/**
 * Attribute a signup to a referral.
 * Called during user registration when referral code is present.
 */
export const attributeSignup = mutation({
  args: {
    referralId: v.string(), // The referral tracking ID
    userId: v.string(), // Better Auth user ID
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_referralId", (q) => q.eq("referralId", args.referralId))
      .first();

    if (!referral) {
      return null; // Referral not found
    }

    // Check if referral has expired
    if (referral.expiresAt < Date.now()) {
      await ctx.db.patch(referral._id, { status: "expired" });
      return null;
    }

    // Check if referral is still in clicked state
    if (referral.status !== "clicked") {
      return null; // Already signed up or converted
    }

    const now = Date.now();

    // Update referral with user ID
    await ctx.db.patch(referral._id, {
      userId: args.userId,
      status: "signed_up",
      signedUpAt: now,
    });

    // Update affiliate stats
    const affiliate = await ctx.db.get(referral.affiliateId);
    if (affiliate) {
      await ctx.db.patch(affiliate._id, {
        stats: {
          ...affiliate.stats,
          totalSignups: affiliate.stats.totalSignups + 1,
        },
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Attribute a signup by user ID (when referral code comes from a different source).
 */
export const attributeSignupByCode = mutation({
  args: {
    affiliateCode: v.string(),
    userId: v.string(),
    landingPage: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    referralId: v.optional(v.id("referrals")),
  }),
  handler: async (ctx, args) => {
    // Find the affiliate by code
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", args.affiliateCode.toUpperCase()))
      .first();

    if (!affiliate || affiliate.status !== "approved") {
      return { success: false };
    }

    // Check if user already has a referral
    const existingReferral = await ctx.db
      .query("referrals")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existingReferral) {
      return { success: true, referralId: existingReferral._id }; // Already attributed
    }

    // Get campaign
    const campaign = await ctx.db.get(affiliate.campaignId);
    if (!campaign || !campaign.isActive) {
      return { success: false };
    }

    const now = Date.now();
    const expiresAt = now + campaign.cookieDurationDays * 24 * 60 * 60 * 1000;

    // Create a new referral record
    const referralId = crypto.randomUUID();
    const referralDocId = await ctx.db.insert("referrals", {
      affiliateId: affiliate._id,
      referralId,
      landingPage: args.landingPage ?? "/",
      userId: args.userId,
      status: "signed_up",
      clickedAt: now,
      signedUpAt: now,
      expiresAt,
    });

    // Update affiliate stats
    await ctx.db.patch(affiliate._id, {
      stats: {
        ...affiliate.stats,
        totalClicks: affiliate.stats.totalClicks + 1,
        totalSignups: affiliate.stats.totalSignups + 1,
      },
      updatedAt: now,
    });

    return { success: true, referralId: referralDocId };
  },
});

/**
 * Link a Stripe customer to a referral.
 * Called by host app's webhook handler when checkout.session.completed event is received.
 * This creates attribution between a Stripe customer and an affiliate.
 */
export const linkStripeCustomer = mutation({
  args: {
    stripeCustomerId: v.string(),
    userId: v.optional(v.string()),
    affiliateCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // If we have a user ID, try to find their referral and link the customer
    if (args.userId) {
      const referral = await ctx.db
        .query("referrals")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();

      if (referral && !referral.stripeCustomerId) {
        // Link Stripe customer to existing referral
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
 * Convert a referral (mark as converted after payment).
 */
export const convertReferral = mutation({
  args: {
    referralId: v.id("referrals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const referral = await ctx.db.get(args.referralId);
    if (!referral) {
      return null;
    }

    if (referral.status === "converted") {
      return null; // Already converted
    }

    const now = Date.now();

    await ctx.db.patch(args.referralId, {
      status: "converted",
      convertedAt: now,
    });

    // Update affiliate stats
    const affiliate = await ctx.db.get(referral.affiliateId);
    if (affiliate) {
      await ctx.db.patch(affiliate._id, {
        stats: {
          ...affiliate.stats,
          totalConversions: affiliate.stats.totalConversions + 1,
        },
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Expire old referrals (called by cron).
 */
export const expireReferrals = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let count = 0;

    // Find all expired referrals that haven't been marked as expired yet
    const expiredReferrals = await ctx.db
      .query("referrals")
      .withIndex("by_expiresAt")
      .filter((q) =>
        q.and(
          q.lt(q.field("expiresAt"), now),
          q.neq(q.field("status"), "expired"),
          q.neq(q.field("status"), "converted")
        )
      )
      .take(100); // Process in batches

    for (const referral of expiredReferrals) {
      await ctx.db.patch(referral._id, { status: "expired" });
      count++;
    }

    return count;
  },
});
