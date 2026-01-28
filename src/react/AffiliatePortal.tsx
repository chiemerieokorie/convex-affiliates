"use client";

import * as React from "react";
import { formatCents, formatDate, formatRelativeTime } from "./hooks.js";

// =============================================================================
// Types
// =============================================================================

export interface AffiliateStats {
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalRevenueCents: number;
  totalCommissionsCents: number;
  pendingCommissionsCents: number;
  paidCommissionsCents: number;
}

export interface CommissionItem {
  _id: string;
  saleAmountCents: number;
  commissionAmountCents: number;
  currency: string;
  status: string;
  createdAt: number;
}

export interface PayoutItem {
  _id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: number;
  completedAt?: number;
  failureReason?: string;
}

// =============================================================================
// Affiliate Portal Context
// =============================================================================

export interface AffiliatePortalContextValue {
  affiliate: {
    _id: string;
    code: string;
    displayName?: string;
    status: string;
    stats: AffiliateStats;
    stripeConnectStatus?: string;
  } | null;
  campaign: {
    name: string;
    commissionType: string;
    commissionValue: number;
  } | null;
  recentCommissions: CommissionItem[];
  pendingPayout: {
    amountCents: number;
    count: number;
  };
  isLoading: boolean;
  baseUrl: string;
}

const AffiliatePortalContext =
  React.createContext<AffiliatePortalContextValue | null>(null);

export function useAffiliatePortalContext() {
  const context = React.useContext(AffiliatePortalContext);
  if (!context) {
    throw new Error(
      "useAffiliatePortalContext must be used within an AffiliatePortalProvider",
    );
  }
  return context;
}

// =============================================================================
// Provider Component
// =============================================================================

export interface AffiliatePortalProviderProps {
  children: React.ReactNode;
  affiliate: AffiliatePortalContextValue["affiliate"];
  campaign: AffiliatePortalContextValue["campaign"];
  recentCommissions?: CommissionItem[];
  pendingPayout?: { amountCents: number; count: number };
  isLoading?: boolean;
  baseUrl?: string;
}

export function AffiliatePortalProvider({
  children,
  affiliate,
  campaign,
  recentCommissions = [],
  pendingPayout = { amountCents: 0, count: 0 },
  isLoading = false,
  baseUrl = typeof window !== "undefined" ? window.location.origin : "",
}: AffiliatePortalProviderProps) {
  const value = React.useMemo(
    () => ({
      affiliate,
      campaign,
      recentCommissions,
      pendingPayout,
      isLoading,
      baseUrl,
    }),
    [affiliate, campaign, recentCommissions, pendingPayout, isLoading, baseUrl],
  );

  return (
    <AffiliatePortalContext.Provider value={value}>
      {children}
    </AffiliatePortalContext.Provider>
  );
}

// =============================================================================
// Headless Components
// =============================================================================

/**
 * Affiliate Stats - Headless component for displaying affiliate statistics.
 */
export interface AffiliateStatsRenderProps {
  stats: AffiliateStats;
  formatted: {
    totalClicks: string;
    totalSignups: string;
    totalConversions: string;
    totalRevenue: string;
    totalCommissions: string;
    pendingCommissions: string;
    paidCommissions: string;
    conversionRate: string;
  };
}

export interface AffiliateStatsProps {
  children: (props: AffiliateStatsRenderProps) => React.ReactNode;
  currency?: string;
}

export function AffiliateStatsDisplay({
  children,
  currency = "USD",
}: AffiliateStatsProps) {
  const { affiliate } = useAffiliatePortalContext();

  if (!affiliate) return null;

  const stats = affiliate.stats;
  const conversionRate =
    stats.totalClicks > 0
      ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
      : "0.0";

  const formatted = {
    totalClicks: stats.totalClicks.toLocaleString(),
    totalSignups: stats.totalSignups.toLocaleString(),
    totalConversions: stats.totalConversions.toLocaleString(),
    totalRevenue: formatCents(stats.totalRevenueCents, currency),
    totalCommissions: formatCents(stats.totalCommissionsCents, currency),
    pendingCommissions: formatCents(stats.pendingCommissionsCents, currency),
    paidCommissions: formatCents(stats.paidCommissionsCents, currency),
    conversionRate: `${conversionRate}%`,
  };

  return <>{children({ stats, formatted })}</>;
}

/**
 * Affiliate Link Generator - Headless component for generating and copying links.
 */
export interface AffiliateLinkGeneratorRenderProps {
  code: string;
  generateLink: (path?: string, subId?: string) => string;
  copyLink: (link: string) => Promise<boolean>;
  copied: boolean;
  baseUrl: string;
}

export interface AffiliateLinkGeneratorProps {
  children: (props: AffiliateLinkGeneratorRenderProps) => React.ReactNode;
}

export function AffiliateLinkGenerator({
  children,
}: AffiliateLinkGeneratorProps) {
  const { affiliate, baseUrl } = useAffiliatePortalContext();
  const [copied, setCopied] = React.useState(false);

  const generateLink = React.useCallback(
    (path = "/", subId?: string) => {
      if (!affiliate) return "";
      const url = new URL(path, baseUrl);
      url.searchParams.set("ref", affiliate.code);
      if (subId) {
        url.searchParams.set("sub", subId);
      }
      return url.toString();
    },
    [affiliate, baseUrl],
  );

  const copyLink = React.useCallback(async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);

  if (!affiliate) return null;

  return (
    <>
      {children({
        code: affiliate.code,
        generateLink,
        copyLink,
        copied,
        baseUrl,
      })}
    </>
  );
}

/**
 * Commission History - Headless component for displaying commission list.
 */
export interface CommissionHistoryRenderProps {
  commissions: Array<{
    id: string;
    saleAmount: string;
    commissionAmount: string;
    currency: string;
    status: string;
    statusColor: "yellow" | "green" | "blue" | "red" | "gray";
    date: string;
    relativeTime: string;
  }>;
  isEmpty: boolean;
}

export interface CommissionHistoryProps {
  children: (props: CommissionHistoryRenderProps) => React.ReactNode;
  currency?: string;
}

export function CommissionHistory({
  children,
  currency = "USD",
}: CommissionHistoryProps) {
  const { recentCommissions } = useAffiliatePortalContext();

  const commissions = recentCommissions.map((c) => ({
    id: c._id,
    saleAmount: formatCents(c.saleAmountCents, currency),
    commissionAmount: formatCents(c.commissionAmountCents, currency),
    currency: c.currency,
    status: c.status,
    statusColor: getStatusColor(c.status),
    date: formatDate(c.createdAt),
    relativeTime: formatRelativeTime(c.createdAt),
  }));

  return <>{children({ commissions, isEmpty: commissions.length === 0 })}</>;
}

/**
 * Pending Payout - Headless component for displaying pending payout info.
 */
export interface PendingPayoutRenderProps {
  amountCents: number;
  formattedAmount: string;
  commissionCount: number;
  hasPayoutPending: boolean;
}

export interface PendingPayoutProps {
  children: (props: PendingPayoutRenderProps) => React.ReactNode;
  currency?: string;
}

export function PendingPayoutDisplay({
  children,
  currency = "USD",
}: PendingPayoutProps) {
  const { pendingPayout } = useAffiliatePortalContext();

  return (
    <>
      {children({
        amountCents: pendingPayout.amountCents,
        formattedAmount: formatCents(pendingPayout.amountCents, currency),
        commissionCount: pendingPayout.count,
        hasPayoutPending: pendingPayout.count > 0,
      })}
    </>
  );
}

/**
 * Commission Rate Display - Shows the affiliate's commission rate.
 */
export interface CommissionRateRenderProps {
  campaignName: string;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  formattedRate: string;
}

export interface CommissionRateProps {
  children: (props: CommissionRateRenderProps) => React.ReactNode;
}

export function CommissionRateDisplay({ children }: CommissionRateProps) {
  const { campaign } = useAffiliatePortalContext();

  if (!campaign) return null;

  const formattedRate =
    campaign.commissionType === "percentage"
      ? `${campaign.commissionValue}%`
      : formatCents(campaign.commissionValue);

  return (
    <>
      {children({
        campaignName: campaign.name,
        commissionType: campaign.commissionType as "percentage" | "fixed",
        commissionValue: campaign.commissionValue,
        formattedRate,
      })}
    </>
  );
}

/**
 * Stripe Connect Status - Displays the affiliate's Stripe Connect status.
 */
export interface StripeConnectStatusRenderProps {
  status: "pending" | "enabled" | "disabled" | "not_connected";
  statusLabel: string;
  canReceivePayouts: boolean;
  needsOnboarding: boolean;
}

export interface StripeConnectStatusProps {
  children: (props: StripeConnectStatusRenderProps) => React.ReactNode;
}

export function StripeConnectStatus({ children }: StripeConnectStatusProps) {
  const { affiliate } = useAffiliatePortalContext();

  if (!affiliate) return null;

  const rawStatus = affiliate.stripeConnectStatus;
  const status = rawStatus ?? "not_connected";

  const statusLabels: Record<string, string> = {
    pending: "Onboarding in progress",
    enabled: "Connected",
    disabled: "Account disabled",
    not_connected: "Not connected",
  };

  return (
    <>
      {children({
        status: status as "pending" | "enabled" | "disabled" | "not_connected",
        statusLabel: statusLabels[status] || "Unknown",
        canReceivePayouts: status === "enabled",
        needsOnboarding: status === "not_connected" || status === "pending",
      })}
    </>
  );
}

/**
 * Affiliate Status Badge - Shows the affiliate's account status.
 */
export interface AffiliateStatusRenderProps {
  status: "pending" | "approved" | "rejected" | "suspended";
  statusLabel: string;
  statusColor: "yellow" | "green" | "red" | "gray";
  isActive: boolean;
}

export interface AffiliateStatusProps {
  children: (props: AffiliateStatusRenderProps) => React.ReactNode;
}

export function AffiliateStatusBadge({ children }: AffiliateStatusProps) {
  const { affiliate } = useAffiliatePortalContext();

  if (!affiliate) return null;

  const status = affiliate.status as
    | "pending"
    | "approved"
    | "rejected"
    | "suspended";

  const statusLabels: Record<string, string> = {
    pending: "Pending Approval",
    approved: "Active",
    rejected: "Rejected",
    suspended: "Suspended",
  };

  const statusColors: Record<string, "yellow" | "green" | "red" | "gray"> = {
    pending: "yellow",
    approved: "green",
    rejected: "red",
    suspended: "gray",
  };

  return (
    <>
      {children({
        status,
        statusLabel: statusLabels[status] || "Unknown",
        statusColor: statusColors[status] || "gray",
        isActive: status === "approved",
      })}
    </>
  );
}

// =============================================================================
// Payout History Component
// =============================================================================

export interface PayoutHistoryRenderProps {
  payouts: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    statusColor: "yellow" | "green" | "blue" | "red" | "gray";
    date: string;
    completedDate?: string;
    failureReason?: string;
  }>;
  isEmpty: boolean;
  loadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export interface PayoutHistoryProps {
  children: (props: PayoutHistoryRenderProps) => React.ReactNode;
  payouts: PayoutItem[];
  loadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  currency?: string;
}

export function PayoutHistory({
  children,
  payouts,
  loadMore,
  hasMore,
  isLoading,
  currency = "USD",
}: PayoutHistoryProps) {
  const formattedPayouts = payouts.map((p) => ({
    id: p._id,
    amount: formatCents(p.amountCents, currency),
    currency: p.currency,
    status: p.status,
    statusColor: getPayoutStatusColor(p.status),
    date: formatDate(p.createdAt),
    completedDate: p.completedAt ? formatDate(p.completedAt) : undefined,
    failureReason: p.failureReason,
  }));

  return (
    <>
      {children({
        payouts: formattedPayouts,
        isEmpty: formattedPayouts.length === 0,
        loadMore,
        hasMore,
        isLoading,
      })}
    </>
  );
}

// =============================================================================
// Utilities
// =============================================================================

function getStatusColor(
  status: string,
): "yellow" | "green" | "blue" | "red" | "gray" {
  switch (status) {
    case "pending":
      return "yellow";
    case "approved":
      return "blue";
    case "paid":
      return "green";
    case "reversed":
      return "red";
    case "processing":
      return "blue";
    default:
      return "gray";
  }
}

function getPayoutStatusColor(
  status: string,
): "yellow" | "green" | "blue" | "red" | "gray" {
  switch (status) {
    case "pending":
      return "yellow";
    case "processing":
      return "blue";
    case "completed":
      return "green";
    case "failed":
      return "red";
    case "cancelled":
      return "gray";
    default:
      return "gray";
  }
}
