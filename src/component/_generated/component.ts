/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference, PaginationResult } from "convex/server";
import type { Id } from "./dataModel.js";

// Type definitions for validators
type CommissionType = "percentage" | "fixed";
type AffiliateStatus = "pending" | "approved" | "suspended" | "rejected";
type CommissionStatus = "pending" | "approved" | "processing" | "paid" | "reversed";
type PayoutStatus = "pending" | "completed" | "cancelled";
type PayoutTerm = "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";
type CommissionDuration = "lifetime" | "max_payments" | "max_months";
type ReferralStatus = "clicked" | "signed_up" | "converted" | "expired";
type PayoutMethod = "manual" | "bank_transfer" | "paypal" | "other";
type EventType = "click" | "signup" | "conversion" | "refund" | "payout";

// Affiliate stats type
type AffiliateStats = {
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalRevenueCents: number;
  totalCommissionsCents: number;
  pendingCommissionsCents: number;
  paidCommissionsCents: number;
};

// Socials type
type Socials = {
  twitter?: string;
  youtube?: string;
  instagram?: string;
  tiktok?: string;
  linkedin?: string;
};

// Custom copy type
type CustomCopy = {
  headline?: string;
  description?: string;
  cta?: string;
};

// Pagination options type
type PaginationOpts = {
  numItems: number;
  cursor: string | null;
  id?: number;
  endCursor?: string | null;
  maximumRowsRead?: number;
  maximumBytesRead?: number;
};

/**
 * A utility for referencing a Convex component's exposed API.
 */
export type ComponentApi<Name extends string | undefined = string | undefined> = {
  // Campaigns module
  campaigns: {
    list: FunctionReference<
      "query",
      "internal",
      { activeOnly?: boolean },
      Array<{
        _id: Id<"campaigns">;
        _creationTime: number;
        name: string;
        slug: string;
        description?: string;
        isActive: boolean;
        isDefault: boolean;
        commissionType: CommissionType;
        commissionValue: number;
        commissionDuration: CommissionDuration;
        commissionDurationValue?: number;
        payoutTerm: PayoutTerm;
        cookieDurationDays: number;
        minPayoutCents: number;
        allowedProducts?: string[];
        excludedProducts?: string[];
        createdAt: number;
        updatedAt: number;
      }>,
      Name
    >;
    get: FunctionReference<
      "query",
      "internal",
      { campaignId: Id<"campaigns"> },
      {
        _id: Id<"campaigns">;
        _creationTime: number;
        name: string;
        slug: string;
        description?: string;
        isActive: boolean;
        isDefault: boolean;
        commissionType: CommissionType;
        commissionValue: number;
        commissionDuration: CommissionDuration;
        commissionDurationValue?: number;
        payoutTerm: PayoutTerm;
        cookieDurationDays: number;
        minPayoutCents: number;
        allowedProducts?: string[];
        excludedProducts?: string[];
        createdAt: number;
        updatedAt: number;
      } | null,
      Name
    >;
    getBySlug: FunctionReference<
      "query",
      "internal",
      { slug: string },
      {
        _id: Id<"campaigns">;
        _creationTime: number;
        name: string;
        slug: string;
        description?: string;
        isActive: boolean;
        isDefault: boolean;
        commissionType: CommissionType;
        commissionValue: number;
        commissionDuration: CommissionDuration;
        commissionDurationValue?: number;
        payoutTerm: PayoutTerm;
        cookieDurationDays: number;
        minPayoutCents: number;
        allowedProducts?: string[];
        excludedProducts?: string[];
        createdAt: number;
        updatedAt: number;
      } | null,
      Name
    >;
    getDefault: FunctionReference<
      "query",
      "internal",
      Record<string, never>,
      {
        _id: Id<"campaigns">;
        _creationTime: number;
        name: string;
        slug: string;
        description?: string;
        isActive: boolean;
        isDefault: boolean;
        commissionType: CommissionType;
        commissionValue: number;
        commissionDuration: CommissionDuration;
        commissionDurationValue?: number;
        payoutTerm: PayoutTerm;
        cookieDurationDays: number;
        minPayoutCents: number;
        allowedProducts?: string[];
        excludedProducts?: string[];
        createdAt: number;
        updatedAt: number;
      } | null,
      Name
    >;
    create: FunctionReference<
      "mutation",
      "internal",
      {
        name: string;
        slug: string;
        description?: string;
        commissionType: CommissionType;
        commissionValue: number;
        commissionDuration?: CommissionDuration;
        commissionDurationValue?: number;
        payoutTerm?: PayoutTerm;
        cookieDurationDays?: number;
        minPayoutCents?: number;
        isActive?: boolean;
        isDefault?: boolean;
        allowedProducts?: string[];
        excludedProducts?: string[];
      },
      Id<"campaigns">,
      Name
    >;
    update: FunctionReference<
      "mutation",
      "internal",
      {
        campaignId: Id<"campaigns">;
        name?: string;
        slug?: string;
        description?: string;
        commissionType?: CommissionType;
        commissionValue?: number;
        commissionDuration?: CommissionDuration;
        commissionDurationValue?: number;
        payoutTerm?: PayoutTerm;
        cookieDurationDays?: number;
        minPayoutCents?: number;
        isActive?: boolean;
        allowedProducts?: string[];
        excludedProducts?: string[];
      },
      null,
      Name
    >;
    setDefault: FunctionReference<
      "mutation",
      "internal",
      { campaignId: Id<"campaigns"> },
      null,
      Name
    >;
    archive: FunctionReference<
      "mutation",
      "internal",
      { campaignId: Id<"campaigns"> },
      null,
      Name
    >;
  };

  // Affiliates module
  affiliates: {
    getById: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates"> },
      {
        _id: Id<"affiliates">;
        _creationTime: number;
        userId: string;
        campaignId: Id<"campaigns">;
        code: string;
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
        website?: string;
        socials?: Socials;
        customCopy?: CustomCopy;
        customCommissionType?: CommissionType;
        customCommissionValue?: number;
        payoutMethod?: PayoutMethod;
        payoutEmail?: string;
        status: AffiliateStatus;
        stats: AffiliateStats;
        createdAt: number;
        updatedAt: number;
      } | null,
      Name
    >;
    getByCode: FunctionReference<
      "query",
      "internal",
      { code: string },
      {
        _id: Id<"affiliates">;
        _creationTime: number;
        userId: string;
        campaignId: Id<"campaigns">;
        code: string;
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
        website?: string;
        socials?: Socials;
        customCopy?: CustomCopy;
        customCommissionType?: CommissionType;
        customCommissionValue?: number;
        payoutMethod?: PayoutMethod;
        payoutEmail?: string;
        status: AffiliateStatus;
        stats: AffiliateStats;
        createdAt: number;
        updatedAt: number;
      } | null,
      Name
    >;
    getByUserId: FunctionReference<
      "query",
      "internal",
      { userId: string },
      {
        _id: Id<"affiliates">;
        _creationTime: number;
        userId: string;
        campaignId: Id<"campaigns">;
        code: string;
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
        website?: string;
        socials?: Socials;
        customCopy?: CustomCopy;
        customCommissionType?: CommissionType;
        customCommissionValue?: number;
        payoutMethod?: PayoutMethod;
        payoutEmail?: string;
        status: AffiliateStatus;
        stats: AffiliateStats;
        createdAt: number;
        updatedAt: number;
      } | null,
      Name
    >;
    list: FunctionReference<
      "query",
      "internal",
      { status?: AffiliateStatus; campaignId?: Id<"campaigns">; limit?: number },
      Array<{
        _id: Id<"affiliates">;
        _creationTime: number;
        userId: string;
        campaignId: Id<"campaigns">;
        code: string;
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
        website?: string;
        socials?: Socials;
        customCopy?: CustomCopy;
        customCommissionType?: CommissionType;
        customCommissionValue?: number;
        payoutMethod?: PayoutMethod;
        payoutEmail?: string;
        status: AffiliateStatus;
        stats: AffiliateStats;
        createdAt: number;
        updatedAt: number;
      }>,
      Name
    >;
    register: FunctionReference<
      "mutation",
      "internal",
      {
        userId: string;
        email: string;
        campaignId: Id<"campaigns">;
        customCode?: string;
        displayName?: string;
        website?: string;
        socialMedia?: string;
        payoutEmail?: string;
      },
      { affiliateId: Id<"affiliates">; code: string },
      Name
    >;
    approve: FunctionReference<"mutation", "internal", { affiliateId: Id<"affiliates"> }, null, Name>;
    reject: FunctionReference<"mutation", "internal", { affiliateId: Id<"affiliates"> }, null, Name>;
    suspend: FunctionReference<"mutation", "internal", { affiliateId: Id<"affiliates"> }, null, Name>;
    reactivate: FunctionReference<"mutation", "internal", { affiliateId: Id<"affiliates"> }, null, Name>;
    updateProfile: FunctionReference<
      "mutation",
      "internal",
      {
        affiliateId: Id<"affiliates">;
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
        website?: string;
        socials?: Socials;
        customCopy?: CustomCopy;
        payoutEmail?: string;
      },
      null,
      Name
    >;
    setCustomCommission: FunctionReference<
      "mutation",
      "internal",
      { affiliateId: Id<"affiliates">; commissionType: CommissionType; commissionValue: number },
      null,
      Name
    >;
    updateStats: FunctionReference<
      "mutation",
      "internal",
      {
        affiliateId: Id<"affiliates">;
        incrementClicks?: number;
        incrementSignups?: number;
        incrementConversions?: number;
        incrementRevenueCents?: number;
        incrementCommissionsCents?: number;
        incrementPendingCents?: number;
        decrementPendingCents?: number;
        incrementPaidCents?: number;
      },
      null,
      Name
    >;
  };

  // Referrals module
  referrals: {
    getByReferralId: FunctionReference<
      "query",
      "internal",
      { referralId: string },
      {
        _id: Id<"referrals">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        referralId: string;
        landingPage: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        subId?: string;
        deviceType?: string;
        country?: string;
        status: ReferralStatus;
        userId?: string;
        stripeCustomerId?: string;
        clickedAt: number;
        signedUpAt?: number;
        convertedAt?: number;
        expiresAt: number;
      } | null,
      Name
    >;
    getByUserId: FunctionReference<
      "query",
      "internal",
      { userId: string },
      {
        _id: Id<"referrals">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        referralId: string;
        landingPage: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        subId?: string;
        deviceType?: string;
        country?: string;
        status: ReferralStatus;
        userId?: string;
        stripeCustomerId?: string;
        clickedAt: number;
        signedUpAt?: number;
        convertedAt?: number;
        expiresAt: number;
      } | null,
      Name
    >;
    getByStripeCustomer: FunctionReference<
      "query",
      "internal",
      { stripeCustomerId: string },
      {
        _id: Id<"referrals">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        referralId: string;
        landingPage: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        subId?: string;
        deviceType?: string;
        country?: string;
        status: ReferralStatus;
        userId?: string;
        stripeCustomerId?: string;
        clickedAt: number;
        signedUpAt?: number;
        convertedAt?: number;
        expiresAt: number;
      } | null,
      Name
    >;
    listByAffiliate: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates">; status?: ReferralStatus; limit?: number },
      Array<{
        _id: Id<"referrals">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        referralId: string;
        landingPage: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        subId?: string;
        deviceType?: string;
        country?: string;
        status: ReferralStatus;
        userId?: string;
        stripeCustomerId?: string;
        clickedAt: number;
        signedUpAt?: number;
        convertedAt?: number;
        expiresAt: number;
      }>,
      Name
    >;
    trackClick: FunctionReference<
      "mutation",
      "internal",
      {
        affiliateCode: string;
        landingPage: string;
        referrer?: string;
        userAgent?: string;
        ipAddress?: string;
        subId?: string;
      },
      { referralId: string } | null,
      Name
    >;
    attributeSignup: FunctionReference<
      "mutation",
      "internal",
      { referralId: string; userId: string },
      null,
      Name
    >;
    attributeSignupByCode: FunctionReference<
      "mutation",
      "internal",
      { affiliateCode: string; userId: string; landingPage?: string },
      { success: boolean; referralId?: Id<"referrals"> },
      Name
    >;
    linkStripeCustomer: FunctionReference<
      "mutation",
      "internal",
      { stripeCustomerId: string; userId?: string; affiliateCode?: string },
      null,
      Name
    >;
    convertReferral: FunctionReference<
      "mutation",
      "internal",
      { referralId: Id<"referrals"> },
      null,
      Name
    >;
    expireReferrals: FunctionReference<"mutation", "internal", Record<string, never>, number, Name>;
  };

  // Commissions module
  commissions: {
    listByAffiliate: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates">; status?: CommissionStatus; paginationOpts: PaginationOpts },
      PaginationResult<{
        _id: Id<"commissions">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        referralId: Id<"referrals">;
        stripeCustomerId: string;
        stripeProductId?: string;
        stripeInvoiceId?: string;
        stripeChargeId?: string;
        stripeSubscriptionId?: string;
        paymentNumber?: number;
        subscriptionStartedAt?: number;
        saleAmountCents: number;
        commissionAmountCents: number;
        commissionRate: number;
        commissionType: CommissionType;
        currency: string;
        status: CommissionStatus;
        payoutId?: Id<"payouts">;
        dueAt: number;
        createdAt: number;
        approvedAt?: number;
        paidAt?: number;
        reversedAt?: number;
        reversalReason?: string;
      }>,
      Name
    >;
    getPendingTotal: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates"> },
      { totalCents: number; count: number },
      Name
    >;
    calculateCommission: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates">; saleAmountCents: number; stripeProductId?: string },
      { commissionAmountCents: number; commissionType: CommissionType; commissionRate: number },
      Name
    >;
    getDueForPayout: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates"> },
      Array<{ _id: Id<"commissions">; commissionAmountCents: number; currency: string }>,
      Name
    >;
    create: FunctionReference<
      "mutation",
      "internal",
      {
        affiliateId: Id<"affiliates">;
        referralId: Id<"referrals">;
        stripeCustomerId: string;
        stripeProductId?: string;
        stripeInvoiceId?: string;
        stripeChargeId?: string;
        stripeSubscriptionId?: string;
        paymentNumber?: number;
        subscriptionStartedAt?: number;
        saleAmountCents: number;
        commissionAmountCents: number;
        commissionRate: number;
        commissionType: CommissionType;
        currency: string;
      },
      Id<"commissions">,
      Name
    >;
    approve: FunctionReference<"mutation", "internal", { commissionId: Id<"commissions"> }, null, Name>;
    markPaid: FunctionReference<
      "mutation",
      "internal",
      { commissionId: Id<"commissions">; payoutId: Id<"payouts"> },
      null,
      Name
    >;
    reverse: FunctionReference<
      "mutation",
      "internal",
      { commissionId: Id<"commissions">; reason: string },
      null,
      Name
    >;
    getByStripeInvoice: FunctionReference<
      "query",
      "internal",
      { stripeInvoiceId: string },
      { _id: Id<"commissions">; affiliateId: Id<"affiliates">; status: CommissionStatus } | null,
      Name
    >;
    getByStripeCharge: FunctionReference<
      "query",
      "internal",
      { stripeChargeId: string },
      { _id: Id<"commissions">; affiliateId: Id<"affiliates">; status: CommissionStatus } | null,
      Name
    >;
    createFromInvoice: FunctionReference<
      "mutation",
      "internal",
      {
        stripeInvoiceId: string;
        stripeCustomerId: string;
        stripeChargeId?: string;
        stripeSubscriptionId?: string;
        stripeProductId?: string;
        amountPaidCents: number;
        currency: string;
        affiliateCode?: string;
      },
      {
        commissionId: Id<"commissions">;
        affiliateId: Id<"affiliates">;
        affiliateCode: string;
        affiliateUserId: string;
        commissionAmountCents: number;
      } | null,
      Name
    >;
    reverseByCharge: FunctionReference<
      "mutation",
      "internal",
      { stripeChargeId: string; reason?: string },
      {
        commissionId: Id<"commissions">;
        affiliateId: Id<"affiliates">;
        affiliateCode?: string;
        commissionAmountCents: number;
      } | null,
      Name
    >;
  };

  // Payouts module
  payouts: {
    listByAffiliate: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates">; status?: PayoutStatus; paginationOpts: PaginationOpts },
      PaginationResult<{
        _id: Id<"payouts">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        amountCents: number;
        currency: string;
        method: PayoutMethod;
        periodStart: number;
        periodEnd: number;
        status: PayoutStatus;
        commissionsCount: number;
        notes?: string;
        createdAt: number;
        completedAt?: number;
      }>,
      Name
    >;
    get: FunctionReference<
      "query",
      "internal",
      { payoutId: Id<"payouts"> },
      {
        _id: Id<"payouts">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        amountCents: number;
        currency: string;
        method: PayoutMethod;
        periodStart: number;
        periodEnd: number;
        status: PayoutStatus;
        commissionsCount: number;
        notes?: string;
        createdAt: number;
        completedAt?: number;
      } | null,
      Name
    >;
    listPending: FunctionReference<
      "query",
      "internal",
      { limit?: number },
      Array<{
        _id: Id<"payouts">;
        affiliateId: Id<"affiliates">;
        amountCents: number;
        currency: string;
        method: PayoutMethod;
      }>,
      Name
    >;
    getAffiliatesDueForPayout: FunctionReference<
      "query",
      "internal",
      { minPayoutCents: number },
      Array<{ affiliateId: Id<"affiliates">; totalDueCents: number; commissionCount: number }>,
      Name
    >;
    create: FunctionReference<
      "mutation",
      "internal",
      {
        affiliateId: Id<"affiliates">;
        amountCents: number;
        currency: string;
        method: PayoutMethod;
        periodStart: number;
        periodEnd: number;
        commissionIds: Id<"commissions">[];
      },
      Id<"payouts">,
      Name
    >;
    markCompleted: FunctionReference<
      "mutation",
      "internal",
      { payoutId: Id<"payouts"> },
      null,
      Name
    >;
    cancel: FunctionReference<
      "mutation",
      "internal",
      { payoutId: Id<"payouts">; notes?: string },
      null,
      Name
    >;
    record: FunctionReference<
      "mutation",
      "internal",
      {
        affiliateId: Id<"affiliates">;
        amountCents: number;
        currency: string;
        method: PayoutMethod;
        notes?: string;
      },
      Id<"payouts">,
      Name
    >;
  };

  // Analytics module
  analytics: {
    getPortalData: FunctionReference<
      "query",
      "internal",
      { userId: string },
      {
        affiliate: {
          _id: Id<"affiliates">;
          code: string;
          displayName?: string;
          status: AffiliateStatus;
          stats: AffiliateStats;
        };
        campaign: { name: string; commissionType: CommissionType; commissionValue: number };
        recentCommissions: Array<{
          _id: Id<"commissions">;
          saleAmountCents: number;
          commissionAmountCents: number;
          currency: string;
          status: CommissionStatus;
          createdAt: number;
        }>;
        pendingPayout: { amountCents: number; count: number };
      } | null,
      Name
    >;
    getAdminDashboard: FunctionReference<
      "query",
      "internal",
      Record<string, never>,
      {
        totalAffiliates: number;
        pendingApprovals: number;
        activeAffiliates: number;
        totalClicks: number;
        totalSignups: number;
        totalConversions: number;
        totalRevenueCents: number;
        totalCommissionsCents: number;
        pendingPayoutsCents: number;
        paidPayoutsCents: number;
        activeCampaigns: number;
      },
      Name
    >;
    getTopAffiliates: FunctionReference<
      "query",
      "internal",
      { limit?: number; sortBy?: "commissions" | "conversions" | "revenue" },
      Array<{
        _id: Id<"affiliates">;
        code: string;
        displayName?: string;
        stats: AffiliateStats;
      }>,
      Name
    >;
    getConversionFunnel: FunctionReference<
      "query",
      "internal",
      { affiliateId?: Id<"affiliates">; startDate?: number; endDate?: number },
      {
        clicks: number;
        signups: number;
        conversions: number;
        clickToSignupRate: number;
        signupToConversionRate: number;
        overallConversionRate: number;
      },
      Name
    >;
    recordEvent: FunctionReference<
      "mutation",
      "internal",
      { affiliateId: Id<"affiliates">; type: EventType; metadata?: string },
      Id<"events">,
      Name
    >;
    getRecentEvents: FunctionReference<
      "query",
      "internal",
      { affiliateId: Id<"affiliates">; type?: EventType; limit?: number },
      Array<{
        _id: Id<"events">;
        _creationTime: number;
        affiliateId: Id<"affiliates">;
        type: EventType;
        metadata?: string;
        timestamp: number;
      }>,
      Name
    >;
  };
};
