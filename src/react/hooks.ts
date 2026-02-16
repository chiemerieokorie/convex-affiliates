"use client";

import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FunctionReference } from "convex/server";
import type {
  AffiliateStatus,
  CommissionStatus,
  CommissionType,
  PayoutMethod,
  PayoutStatus,
} from "../component/validators.js";

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
  displayName?: string;
  website?: string;
  socials?: {
    twitter?: string;
    youtube?: string;
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
  };
  payoutEmail?: string;
  status: AffiliateStatus;
  stats: {
    totalClicks: number;
    totalSignups: number;
    totalConversions: number;
    totalRevenueCents: number;
    totalCommissionsCents: number;
    pendingCommissionsCents: number;
    paidCommissionsCents: number;
  };
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
  commissionType: CommissionType;
  currency: string;
  status: CommissionStatus;
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
  method: PayoutMethod;
  periodStart: number;
  periodEnd: number;
  status: PayoutStatus;
  commissionsCount: number;
  notes?: string;
  createdAt: number;
  completedAt?: number;
}

// =============================================================================
// Storage Adapter
// =============================================================================

export type StorageMode = "localStorage" | "cookie" | "both";

export interface CookieOptions {
  domain?: string;
  path?: string;
  maxAge?: number;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
}

export interface AffiliateHooksConfig {
  storage?: StorageMode;
  cookieOptions?: CookieOptions;
}

interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, opts: CookieOptions = {}): void {
  if (typeof document === "undefined") return;
  const {
    path = "/",
    maxAge = 30 * 24 * 60 * 60,
    secure = true,
    sameSite = "lax",
    domain,
  } = opts;
  let cookie = `${name}=${encodeURIComponent(value)}; path=${path}; max-age=${maxAge}; samesite=${sameSite}`;
  if (secure) cookie += "; secure";
  if (domain) cookie += `; domain=${domain}`;
  document.cookie = cookie;
}

function removeCookie(name: string, opts: CookieOptions = {}): void {
  if (typeof document === "undefined") return;
  const { path = "/", domain } = opts;
  let cookie = `${name}=; path=${path}; max-age=0`;
  if (domain) cookie += `; domain=${domain}`;
  document.cookie = cookie;
}

function createStorageAdapter(
  mode: StorageMode = "localStorage",
  cookieOpts: CookieOptions = {}
): StorageAdapter {
  const ls: StorageAdapter = {
    get: (key) =>
      typeof window !== "undefined" ? localStorage.getItem(key) : null,
    set: (key, value) => {
      if (typeof window !== "undefined") localStorage.setItem(key, value);
    },
    remove: (key) => {
      if (typeof window !== "undefined") localStorage.removeItem(key);
    },
  };

  const ck: StorageAdapter = {
    get: (key) => getCookie(key),
    set: (key, value) => setCookie(key, value, cookieOpts),
    remove: (key) => removeCookie(key, cookieOpts),
  };

  if (mode === "localStorage") return ls;
  if (mode === "cookie") return ck;

  // "both" — dual-write, read cookie-first
  return {
    get: (key) => ck.get(key) ?? ls.get(key),
    set: (key, value) => {
      ck.set(key, value);
      ls.set(key, value);
    },
    remove: (key) => {
      ck.remove(key);
      ls.remove(key);
    },
  };
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
export function createAffiliateHooks(
  affiliateApi: AffiliateApi,
  config?: AffiliateHooksConfig
) {
  const storage = createStorageAdapter(config?.storage, config?.cookieOptions);
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
      status?: PayoutStatus
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
          return await approve({ affiliateId });
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
          return await reject({ affiliateId, reason });
        },
        [reject]
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
  }) => Promise<{ referralId: string } | null>,
  config?: AffiliateHooksConfig
) {
  const adapter = createStorageAdapter(config?.storage, config?.cookieOptions);
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
          adapter.set("affiliate_referral_id", result.referralId);
          adapter.set("affiliate_code", code);
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
 * Get stored referral info.
 * Reads from the configured storage (localStorage, cookie, or both).
 */
export function useStoredReferral(config?: AffiliateHooksConfig) {
  const adapter = useMemo(
    () => createStorageAdapter(config?.storage, config?.cookieOptions),
    [config?.storage, config?.cookieOptions]
  );

  const [referral, setReferral] = useState<{
    referralId: string | null;
    code: string | null;
  }>(() => ({
    referralId: adapter.get("affiliate_referral_id"),
    code: adapter.get("affiliate_code"),
  }));

  const clear = useCallback(() => {
    adapter.remove("affiliate_referral_id");
    adapter.remove("affiliate_code");
    setReferral({ referralId: null, code: null });
  }, [adapter]);

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
