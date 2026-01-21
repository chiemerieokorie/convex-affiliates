import { v } from "convex/values";

// ============================================
// Commission Types
// ============================================

export const commissionTypeValidator = v.union(
  v.literal("percentage"),
  v.literal("fixed")
);

export type CommissionType = "percentage" | "fixed";

// ============================================
// Commission Duration
// ============================================

export const commissionDurationValidator = v.union(
  v.literal("lifetime"),
  v.literal("max_payments"),
  v.literal("max_months")
);

export type CommissionDuration = "lifetime" | "max_payments" | "max_months";

// ============================================
// Payout Terms
// ============================================

export const payoutTermValidator = v.union(
  v.literal("NET-0"),
  v.literal("NET-15"),
  v.literal("NET-30"),
  v.literal("NET-60"),
  v.literal("NET-90")
);

export type PayoutTerm = "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";

// ============================================
// Affiliate Status
// ============================================

export const affiliateStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("suspended"),
  v.literal("rejected")
);

export type AffiliateStatus = "pending" | "approved" | "suspended" | "rejected";

// ============================================
// Referral Status
// ============================================

export const referralStatusValidator = v.union(
  v.literal("clicked"),
  v.literal("signed_up"),
  v.literal("converted"),
  v.literal("expired")
);

export type ReferralStatus = "clicked" | "signed_up" | "converted" | "expired";

// ============================================
// Commission Status
// ============================================

export const commissionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("processing"),
  v.literal("paid"),
  v.literal("reversed")
);

export type CommissionStatus =
  | "pending"
  | "approved"
  | "processing"
  | "paid"
  | "reversed";

// ============================================
// Payout Status
// ============================================

export const payoutStatusValidator = v.union(
  v.literal("pending"),
  v.literal("completed"),
  v.literal("cancelled")
);

export type PayoutStatus = "pending" | "completed" | "cancelled";

// ============================================
// Payout Method
// ============================================

export const payoutMethodValidator = v.union(
  v.literal("manual"),
  v.literal("bank_transfer"),
  v.literal("paypal"),
  v.literal("other")
);

export type PayoutMethod = "manual" | "bank_transfer" | "paypal" | "other";

// ============================================
// Event Types (for analytics)
// ============================================

export const eventTypeValidator = v.union(
  v.literal("click"),
  v.literal("signup"),
  v.literal("conversion"),
  v.literal("refund"),
  v.literal("payout")
);

export type EventType = "click" | "signup" | "conversion" | "refund" | "payout";

// ============================================
// Socials Object Validator
// ============================================

export const socialsValidator = v.object({
  twitter: v.optional(v.string()),
  youtube: v.optional(v.string()),
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  linkedin: v.optional(v.string()),
});

// ============================================
// Custom Copy Object Validator
// ============================================

export const customCopyValidator = v.object({
  headline: v.optional(v.string()),
  description: v.optional(v.string()),
  cta: v.optional(v.string()),
});

// ============================================
// Promo Content Type Validator
// ============================================

export const promoContentTypeValidator = v.union(
  v.literal("youtube_video"),
  v.literal("blog"),
  v.literal("twitter"),
  v.literal("instagram"),
  v.literal("tiktok"),
  v.literal("other")
);

export type PromoContentType =
  | "youtube_video"
  | "blog"
  | "twitter"
  | "instagram"
  | "tiktok"
  | "other";

// ============================================
// Promo Content Object Validator
// ============================================

export const promoContentValidator = v.object({
  type: promoContentTypeValidator,
  url: v.string(),
  title: v.optional(v.string()),
});

// ============================================
// Affiliate Stats Object Validator
// ============================================

export const affiliateStatsValidator = v.object({
  totalClicks: v.number(),
  totalSignups: v.number(),
  totalConversions: v.number(),
  totalRevenueCents: v.number(),
  totalCommissionsCents: v.number(),
  pendingCommissionsCents: v.number(),
  paidCommissionsCents: v.number(),
});

// ============================================
// Pagination Validators
// ============================================

export const paginationArgsValidator = {
  limit: v.optional(v.number()),
  cursor: v.optional(v.string()),
};

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate the delay in milliseconds for a given payout term
 */
export function getPayoutTermDelayMs(term: PayoutTerm): number {
  const delays: Record<PayoutTerm, number> = {
    "NET-0": 0,
    "NET-15": 15 * 24 * 60 * 60 * 1000,
    "NET-30": 30 * 24 * 60 * 60 * 1000,
    "NET-60": 60 * 24 * 60 * 60 * 1000,
    "NET-90": 90 * 24 * 60 * 60 * 1000,
  };
  return delays[term];
}

/**
 * Generate a unique affiliate code
 */
export function generateAffiliateCode(prefix?: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = prefix ? prefix.toUpperCase() : "";
  const targetLength = 8;
  const charsToAdd = targetLength - code.length;
  for (let i = 0; i < charsToAdd; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculate commission amount based on type and value
 */
export function calculateCommissionAmount(
  saleAmountCents: number,
  commissionType: CommissionType,
  commissionValue: number
): number {
  if (commissionType === "percentage") {
    return Math.round((saleAmountCents * commissionValue) / 100);
  }
  return commissionValue; // Fixed amount in cents
}
