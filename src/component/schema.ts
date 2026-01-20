import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  commissionTypeValidator,
  commissionDurationValidator,
  payoutTermValidator,
  affiliateStatusValidator,
  referralStatusValidator,
  commissionStatusValidator,
  payoutStatusValidator,
  payoutMethodValidator,
  eventTypeValidator,
  socialsValidator,
  customCopyValidator,
  promoContentValidator,
  affiliateStatsValidator,
} from "./validators.js";

export default defineSchema({
  // ============================================
  // Campaigns
  // ============================================
  campaigns: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    isDefault: v.boolean(),

    // Commission structure
    commissionType: commissionTypeValidator,
    commissionValue: v.number(), // Percentage (0-100) or cents for fixed

    // Duration settings
    commissionDuration: commissionDurationValidator,
    commissionDurationValue: v.optional(v.number()),

    // Tracking
    cookieDurationDays: v.number(),

    // Payout settings
    minPayoutCents: v.number(),
    payoutTerm: payoutTermValidator,

    // Product restrictions (Stripe product IDs)
    allowedProducts: v.optional(v.array(v.string())),
    excludedProducts: v.optional(v.array(v.string())),

    // Two-sided rewards: Discount for referred customers
    refereeDiscountType: v.optional(commissionTypeValidator), // "percentage" or "fixed"
    refereeDiscountValue: v.optional(v.number()), // Percentage (0-100) or cents for fixed
    refereeStripeCouponId: v.optional(v.string()), // Pre-created Stripe coupon ID

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_default", ["isDefault"])
    .index("by_active", ["isActive"]),

  // ============================================
  // Affiliates (linked to Better Auth users via string ID)
  // ============================================
  affiliates: defineTable({
    userId: v.string(), // Better Auth user ID (string, not Id<>)
    campaignId: v.id("campaigns"),

    // Unique tracking
    code: v.string(), // e.g., "JOHN20"

    // Profile (affiliate can customize)
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    promoContent: v.optional(promoContentValidator), // { type: "youtube_video", url: "...", title: "..." }
    website: v.optional(v.string()),

    // Socials
    socials: v.optional(socialsValidator),

    // Custom messaging/copy for their promotions
    customCopy: v.optional(customCopyValidator),

    // Custom commission override (per-affiliate rates)
    customCommissionType: v.optional(commissionTypeValidator),
    customCommissionValue: v.optional(v.number()),

    // Payout info (Stripe Connect or manual)
    payoutMethod: v.optional(payoutMethodValidator),
    stripeConnectAccountId: v.optional(v.string()),
    stripeConnectStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("enabled"),
        v.literal("disabled")
      )
    ),
    payoutEmail: v.optional(v.string()),

    // Status
    status: affiliateStatusValidator,

    // Denormalized stats (updated on each conversion)
    stats: affiliateStatsValidator,

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_userId", ["userId"])
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_status", ["campaignId", "status"])
    .index("by_status", ["status"]),

  // ============================================
  // Commission Tiers (for tiered commission structures)
  // ============================================
  commissionTiers: defineTable({
    campaignId: v.id("campaigns"),
    minReferrals: v.number(), // Activate at this many conversions
    commissionType: commissionTypeValidator,
    commissionValue: v.number(),
  }).index("by_campaign", ["campaignId"]),

  // ============================================
  // Product-specific commission overrides
  // ============================================
  productCommissions: defineTable({
    campaignId: v.id("campaigns"),
    stripeProductId: v.string(),
    commissionType: commissionTypeValidator,
    commissionValue: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_product", ["campaignId", "stripeProductId"]),

  // ============================================
  // Referrals (visitors who clicked affiliate links)
  // ============================================
  referrals: defineTable({
    affiliateId: v.id("affiliates"),

    // Tracking
    referralId: v.string(), // UUID passed via URL
    landingPage: v.string(),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    subId: v.optional(v.string()), // Affiliate's custom sub-tracking

    // Device info (for analytics, not fingerprinting)
    deviceType: v.optional(v.string()),
    country: v.optional(v.string()),

    // Conversion tracking
    status: referralStatusValidator,

    // Linked records (strings for cross-component references)
    userId: v.optional(v.string()), // Better Auth user who signed up
    stripeCustomerId: v.optional(v.string()),

    clickedAt: v.number(),
    signedUpAt: v.optional(v.number()),
    convertedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index("by_referralId", ["referralId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_affiliate_status", ["affiliateId", "status"])
    .index("by_userId", ["userId"])
    .index("by_stripeCustomer", ["stripeCustomerId"])
    .index("by_expiresAt", ["expiresAt"]),

  // ============================================
  // Commissions
  // ============================================
  commissions: defineTable({
    affiliateId: v.id("affiliates"),
    referralId: v.id("referrals"),

    // Stripe references
    stripeCustomerId: v.string(),
    stripeInvoiceId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripeProductId: v.optional(v.string()),

    // Payment tracking for recurring limits
    paymentNumber: v.optional(v.number()), // 1st, 2nd, 3rd payment...
    subscriptionStartedAt: v.optional(v.number()),

    // Amounts
    saleAmountCents: v.number(),
    commissionAmountCents: v.number(),
    commissionRate: v.number(), // The rate used (for audit)
    commissionType: commissionTypeValidator,
    currency: v.string(),

    // Status
    status: commissionStatusValidator,

    // Payout tracking
    payoutId: v.optional(v.id("payouts")),
    dueAt: v.number(), // When it becomes payable

    // Timestamps
    createdAt: v.number(),
    approvedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    reversedAt: v.optional(v.number()),
    reversalReason: v.optional(v.string()),
  })
    .index("by_affiliate", ["affiliateId"])
    .index("by_affiliate_status", ["affiliateId", "status"])
    .index("by_referral", ["referralId"])
    .index("by_stripeInvoice", ["stripeInvoiceId"])
    .index("by_stripeCharge", ["stripeChargeId"])
    .index("by_payout", ["payoutId"])
    .index("by_status_dueAt", ["status", "dueAt"]),

  // ============================================
  // Payouts
  // ============================================
  payouts: defineTable({
    affiliateId: v.id("affiliates"),

    // Amount
    amountCents: v.number(),
    currency: v.string(),

    // Method
    method: payoutMethodValidator,

    // Period
    periodStart: v.number(),
    periodEnd: v.number(),

    // Status
    status: payoutStatusValidator,

    // Metadata
    commissionsCount: v.number(),
    notes: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_affiliate", ["affiliateId"])
    .index("by_status", ["status"])
    .index("by_affiliate_status", ["affiliateId", "status"]),

  // ============================================
  // Analytics Events (for detailed reporting)
  // ============================================
  events: defineTable({
    affiliateId: v.id("affiliates"),
    type: eventTypeValidator,
    metadata: v.optional(v.string()), // JSON
    timestamp: v.number(),
  })
    .index("by_affiliate", ["affiliateId"])
    .index("by_affiliate_type", ["affiliateId", "type"])
    .index("by_timestamp", ["timestamp"]),
});
