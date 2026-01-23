"use client";

import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import type { FunctionReference } from "convex/server";

// =============================================================================
// Types
// =============================================================================

export interface AffiliatePortalData {
  affiliate: {
    _id: string;
    code: string;
    displayName?: string;
    status: string;
    stats: {
      totalClicks: number;
      totalSignups: number;
      totalConversions: number;
      totalRevenueCents: number;
      totalCommissionsCents: number;
      pendingCommissionsCents: number;
      paidCommissionsCents: number;
    };
    stripeConnectStatus?: string;
  };
  campaign: {
    name: string;
    commissionType: string;
    commissionValue: number;
  };
  recentCommissions: Array<{
    _id: string;
    saleAmountCents: number;
    commissionAmountCents: number;
    currency: string;
    status: string;
    createdAt: number;
  }>;
  pendingPayout: {
    amountCents: number;
    count: number;
  };
}

export interface AffiliateProfile {
  _id: string;
  userId: string;
  code: string;
  email: string;
  displayName?: string;
  website?: string;
  socialMedia?: string;
  status: string;
  stats: {
    totalClicks: number;
    totalSignups: number;
    totalConversions: number;
    totalRevenueCents: number;
    totalCommissionsCents: number;
    pendingCommissionsCents: number;
    paidCommissionsCents: number;
  };
  stripeConnectStatus?: string;
  stripeConnectAccountId?: string;
  createdAt: number;
}

export interface AdminDashboardData {
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
}

export interface Commission {
  _id: string;
  affiliateId: string;
  referralId: string;
  stripeCustomerId: string;
  stripeInvoiceId: string;
  stripeChargeId?: string;
  stripeSubscriptionId?: string;
  stripeProductId?: string;
  paymentNumber?: number;
  saleAmountCents: number;
  commissionAmountCents: number;
  commissionRate: number;
  commissionType: string;
  currency: string;
  status: string;
  createdAt: number;
  approvedAt?: number;
  paidAt?: number;
  reversedAt?: number;
}

export interface Payout {
  _id: string;
  affiliateId: string;
  amountCents: number;
  currency: string;
  method: string;
  stripeConnectAccountId?: string;
  stripeTransferId?: string;
  periodStart: number;
  periodEnd: number;
  status: string;
  commissionsCount: number;
  notes?: string;
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
  failedAt?: number;
  failureReason?: string;
}

export interface LandingPageData {
  landingPage: {
    _id: string;
    campaignId: string;
    mediaPreset: string;
    hero: {
      headline: string;
      subheadline?: string;
      videoUrl?: string;
      imageUrl?: string;
    };
    benefits?: string[];
    testimonials?: Array<{
      name: string;
      quote: string;
      avatar?: string;
      earnings?: string;
    }>;
    socialProofText?: string;
    commissionPreviewText?: string;
    cta?: {
      text: string;
      subtext?: string;
      buttonLabel?: string;
      url?: string;
    };
    status: string;
    totalViews: number;
  };
  campaign: {
    name: string;
    slug: string;
    commissionType: string;
    commissionValue: number;
  } | null;
}

// Generic API type
type AffiliateApi = {
  getPortalData: FunctionReference<"query">;
  getAffiliate: FunctionReference<"query">;
  register: FunctionReference<"mutation">;
  trackClick: FunctionReference<"mutation">;
  listCommissions: FunctionReference<"query">;
  listPayouts: FunctionReference<"query">;
  adminDashboard: FunctionReference<"query">;
  adminListAffiliates: FunctionReference<"query">;
  adminApproveAffiliate: FunctionReference<"mutation">;
  adminRejectAffiliate: FunctionReference<"mutation">;
  adminTopAffiliates: FunctionReference<"query">;
  getLandingPageData: FunctionReference<"query">;
  trackLandingPageView: FunctionReference<"mutation">;
  adminListLandingPages: FunctionReference<"query">;
};

// =============================================================================
// Hook Factory
// =============================================================================

/**
 * Create affiliate hooks bound to your API functions.
 * Usage:
 * ```ts
 * import { api } from "../convex/_generated/api";
 * const hooks = createAffiliateHooks(api.affiliates);
 * ```
 */
export function createAffiliateHooks(affiliateApi: AffiliateApi) {
  return {
    /**
     * Get the current user's affiliate profile.
     */
    useAffiliate: () => {
      return useQuery(affiliateApi.getAffiliate);
    },

    /**
     * Get all data needed for the affiliate portal.
     */
    useAffiliatePortal: () => {
      return useQuery(affiliateApi.getPortalData) as AffiliatePortalData | undefined;
    },

    /**
     * Get paginated commission history.
     */
    useAffiliateCommissions: (
      status?: "pending" | "approved" | "paid" | "reversed" | "processing"
    ) => {
      return usePaginatedQuery(
        affiliateApi.listCommissions,
        { status },
        { initialNumItems: 10 }
      );
    },

    /**
     * Get paginated payout history.
     */
    useAffiliatePayouts: (
      status?: "pending" | "processing" | "completed" | "failed" | "cancelled"
    ) => {
      return usePaginatedQuery(
        affiliateApi.listPayouts,
        { status },
        { initialNumItems: 10 }
      );
    },

    /**
     * Register as an affiliate.
     */
    useRegisterAffiliate: () => {
      const register = useMutation(affiliateApi.register);

      return useCallback(
        async (params: {
          email: string;
          displayName?: string;
          website?: string;
          socialMedia?: string;
          customCode?: string;
        }) => {
          return await register(params);
        },
        [register]
      );
    },

    /**
     * Track a referral click.
     */
    useTrackReferral: () => {
      const trackClick = useMutation(affiliateApi.trackClick);

      return useCallback(
        async (params: {
          affiliateCode: string;
          landingPage: string;
          referrer?: string;
          userAgent?: string;
          subId?: string;
        }) => {
          return await trackClick(params);
        },
        [trackClick]
      );
    },

    /**
     * Get admin dashboard data.
     */
    useAdminDashboard: () => {
      return useQuery(affiliateApi.adminDashboard) as AdminDashboardData | undefined;
    },

    /**
     * Get list of affiliates (admin).
     */
    useAffiliateList: (params?: {
      status?: "pending" | "approved" | "rejected" | "suspended";
      campaignId?: string;
      limit?: number;
    }) => {
      return useQuery(affiliateApi.adminListAffiliates, params ?? {});
    },

    /**
     * Get top performing affiliates (admin).
     */
    useTopAffiliates: (params?: {
      sortBy?: "conversions" | "revenue" | "commissions";
      limit?: number;
    }) => {
      return useQuery(affiliateApi.adminTopAffiliates, params ?? {});
    },

    /**
     * Approve an affiliate (admin).
     */
    useApproveAffiliate: () => {
      const approve = useMutation(affiliateApi.adminApproveAffiliate);

      return useCallback(
        async (affiliateId: string) => {
          return await approve({ affiliateId: affiliateId as any });
        },
        [approve]
      );
    },

    /**
     * Reject an affiliate (admin).
     */
    useRejectAffiliate: () => {
      const reject = useMutation(affiliateApi.adminRejectAffiliate);

      return useCallback(
        async (affiliateId: string, reason?: string) => {
          return await reject({ affiliateId: affiliateId as any, reason });
        },
        [reject]
      );
    },

    /**
     * Fetch landing page data by campaign slug and optional media preset.
     * Automatically tracks the view on first load.
     */
    useLandingPage: (campaignSlug: string, mediaPreset?: string) => {
      const data = useQuery(affiliateApi.getLandingPageData, {
        slug: campaignSlug,
        mediaPreset,
      }) as LandingPageData | null | undefined;
      const trackView = useMutation(affiliateApi.trackLandingPageView);
      const [viewTracked, setViewTracked] = useState(false);

      useEffect(() => {
        if (data?.landingPage && !viewTracked) {
          trackView({ slug: campaignSlug, mediaPreset }).catch(() => {});
          setViewTracked(true);
        }
      }, [data?.landingPage, viewTracked, trackView, campaignSlug, mediaPreset]);

      return data;
    },

    /**
     * Admin: list all landing pages for a campaign.
     */
    useAdminLandingPages: (campaignId?: string) => {
      return useQuery(
        affiliateApi.adminListLandingPages,
        campaignId ? { campaignId: campaignId as any } : "skip"
      );
    },
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Track referral on page load.
 * Automatically tracks when a referral code is present in URL params.
 */
export function useTrackReferralOnLoad(
  trackClick: (params: {
    affiliateCode: string;
    landingPage: string;
    referrer?: string;
    userAgent?: string;
    subId?: string;
  }) => Promise<{ referralId: string } | null>
) {
  const [tracked, setTracked] = useState(false);
  const [referralId, setReferralId] = useState<string | null>(null);

  useEffect(() => {
    if (tracked) return;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("ref");
    const subId = searchParams.get("sub") ?? undefined;

    if (!code) return;

    const track = async () => {
      try {
        const result = await trackClick({
          affiliateCode: code,
          landingPage: window.location.pathname,
          referrer: document.referrer || undefined,
          userAgent: navigator.userAgent,
          subId,
        });

        if (result?.referralId) {
          setReferralId(result.referralId);
          // Store in localStorage for attribution
          localStorage.setItem("affiliate_referral_id", result.referralId);
          localStorage.setItem("affiliate_code", code);
        }

        setTracked(true);
      } catch (error) {
        console.error("Failed to track referral:", error);
      }
    };

    track();
  }, [tracked, trackClick]);

  return { tracked, referralId };
}

/**
 * Get stored referral info from localStorage.
 */
export function useStoredReferral() {
  const [referral, setReferral] = useState<{
    referralId: string | null;
    code: string | null;
  }>(() => {
    // Lazy initialization to avoid setState in useEffect
    if (typeof window === "undefined") {
      return { referralId: null, code: null };
    }
    return {
      referralId: localStorage.getItem("affiliate_referral_id"),
      code: localStorage.getItem("affiliate_code"),
    };
  });

  const clear = useCallback(() => {
    localStorage.removeItem("affiliate_referral_id");
    localStorage.removeItem("affiliate_code");
    setReferral({ referralId: null, code: null });
  }, []);

  return { ...referral, clear };
}

/**
 * Generate affiliate links.
 */
export function useAffiliateLinkGenerator(baseUrl: string, code: string) {
  const generate = useCallback(
    (path = "/", subId?: string) => {
      const url = new URL(path, baseUrl);
      url.searchParams.set("ref", code);
      if (subId) {
        url.searchParams.set("sub", subId);
      }
      return url.toString();
    },
    [baseUrl, code]
  );

  return { generate };
}

/**
 * Copy to clipboard with status tracking.
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copy, copied };
}

/**
 * Parse Smartlead URL parameters for landing page context.
 * Extracts: name, email, company, ref, sub, media from the URL.
 * SSR-safe.
 *
 * @example
 * ```tsx
 * const { name, email, company, ref, sub, media } = useLandingPageParams();
 * // Pre-fill registration form with name/email
 * // Use media to select landing page preset
 * ```
 */
export function useLandingPageParams() {
  const [params] = useState<{
    name: string | null;
    email: string | null;
    company: string | null;
    ref: string | null;
    sub: string | null;
    media: string | null;
  }>(() => {
    if (typeof window === "undefined") {
      return { name: null, email: null, company: null, ref: null, sub: null, media: null };
    }
    const sp = new URLSearchParams(window.location.search);
    return {
      name: sp.get("name"),
      email: sp.get("email"),
      company: sp.get("company"),
      ref: sp.get("ref"),
      sub: sp.get("sub"),
      media: sp.get("media"),
    };
  });

  return params;
}

/**
 * Handle auto-registration of an affiliate from landing page URL params.
 * Call this after the user authenticates on the landing page.
 *
 * @param registerFn - The register mutation function
 * @param options.autoRegister - If true, registers automatically when params exist
 *
 * @example
 * ```tsx
 * const { register, registered, error, loading, params } =
 *   useAutoRegisterAffiliate(registerMutation, { autoRegister: true });
 *
 * if (registered) {
 *   return <div>Welcome aboard!</div>;
 * }
 * ```
 */
export function useAutoRegisterAffiliate(
  registerFn: (params: {
    email: string;
    displayName?: string;
    customCode?: string;
  }) => Promise<{ affiliateId: string; code: string }>,
  options?: { autoRegister?: boolean }
) {
  const params = useLandingPageParams();
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doRegister = useCallback(async () => {
    if (!params.email) {
      setError("Email is required for registration");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await registerFn({
        email: params.email,
        displayName: params.name ?? undefined,
        customCode: params.ref ?? undefined,
      });
      setRegistered(true);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [params.email, params.name, params.ref, registerFn]);

  useEffect(() => {
    if (options?.autoRegister && params.email && !registered && !loading) {
      doRegister();
    }
  }, [options?.autoRegister, params.email, registered, loading, doRegister]);

  return { register: doRegister, registered, error, loading, params };
}

// =============================================================================
// Formatting Utilities
// =============================================================================

/**
 * Format cents to currency string.
 */
export function formatCents(
  cents: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Format percentage.
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date.
 */
export function formatDate(
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/**
 * Format relative time.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}
