"use client";

import * as React from "react";
import { formatCents, formatDate, formatRelativeTime } from "./hooks.js";

// =============================================================================
// Types
// =============================================================================

export interface AdminDashboardStats {
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

export interface AffiliateListItem {
  _id: string;
  code: string;
  email: string;
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
  createdAt: number;
}

export interface TopAffiliate {
  _id: string;
  code: string;
  displayName?: string;
  stats: {
    totalClicks: number;
    totalSignups: number;
    totalConversions: number;
    totalRevenueCents: number;
    totalCommissionsCents: number;
    pendingCommissionsCents: number;
    paidCommissionsCents: number;
  };
}

// =============================================================================
// Admin Dashboard Context
// =============================================================================

export interface AdminDashboardContextValue {
  stats: AdminDashboardStats | null;
  affiliates: AffiliateListItem[];
  topAffiliates: TopAffiliate[];
  pendingApprovals: AffiliateListItem[];
  isLoading: boolean;
  onApprove?: (affiliateId: string) => Promise<void>;
  onReject?: (affiliateId: string, reason?: string) => Promise<void>;
  onSuspend?: (affiliateId: string, reason?: string) => Promise<void>;
}

const AdminDashboardContext =
  React.createContext<AdminDashboardContextValue | null>(null);

export function useAdminDashboardContext() {
  const context = React.useContext(AdminDashboardContext);
  if (!context) {
    throw new Error(
      "useAdminDashboardContext must be used within an AdminDashboardProvider",
    );
  }
  return context;
}

// =============================================================================
// Provider Component
// =============================================================================

export interface AdminDashboardProviderProps {
  children: React.ReactNode;
  stats: AdminDashboardStats | null;
  affiliates?: AffiliateListItem[];
  topAffiliates?: TopAffiliate[];
  isLoading?: boolean;
  onApprove?: (affiliateId: string) => Promise<void>;
  onReject?: (affiliateId: string, reason?: string) => Promise<void>;
  onSuspend?: (affiliateId: string, reason?: string) => Promise<void>;
}

export function AdminDashboardProvider({
  children,
  stats,
  affiliates = [],
  topAffiliates = [],
  isLoading = false,
  onApprove,
  onReject,
  onSuspend,
}: AdminDashboardProviderProps) {
  const pendingApprovals = React.useMemo(
    () => affiliates.filter((a) => a.status === "pending"),
    [affiliates],
  );

  const value = React.useMemo(
    () => ({
      stats,
      affiliates,
      topAffiliates,
      pendingApprovals,
      isLoading,
      onApprove,
      onReject,
      onSuspend,
    }),
    [
      stats,
      affiliates,
      topAffiliates,
      pendingApprovals,
      isLoading,
      onApprove,
      onReject,
      onSuspend,
    ],
  );

  return (
    <AdminDashboardContext.Provider value={value}>
      {children}
    </AdminDashboardContext.Provider>
  );
}

// =============================================================================
// Headless Components
// =============================================================================

/**
 * Overview Stats - Displays key metrics for the admin dashboard.
 */
export interface OverviewStatsRenderProps {
  metrics: Array<{
    key: string;
    label: string;
    value: string;
    change?: number;
  }>;
  raw: AdminDashboardStats;
}

export interface OverviewStatsProps {
  children: (props: OverviewStatsRenderProps) => React.ReactNode;
  currency?: string;
}

export function OverviewStats({
  children,
  currency = "USD",
}: OverviewStatsProps) {
  const { stats } = useAdminDashboardContext();

  if (!stats) return null;

  const metrics = [
    {
      key: "affiliates",
      label: "Total Affiliates",
      value: stats.totalAffiliates.toLocaleString(),
    },
    {
      key: "active",
      label: "Active Affiliates",
      value: stats.activeAffiliates.toLocaleString(),
    },
    {
      key: "pending",
      label: "Pending Approvals",
      value: stats.pendingApprovals.toLocaleString(),
    },
    {
      key: "clicks",
      label: "Total Clicks",
      value: stats.totalClicks.toLocaleString(),
    },
    {
      key: "signups",
      label: "Total Signups",
      value: stats.totalSignups.toLocaleString(),
    },
    {
      key: "conversions",
      label: "Total Conversions",
      value: stats.totalConversions.toLocaleString(),
    },
    {
      key: "revenue",
      label: "Total Revenue",
      value: formatCents(stats.totalRevenueCents, currency),
    },
    {
      key: "commissions",
      label: "Total Commissions",
      value: formatCents(stats.totalCommissionsCents, currency),
    },
    {
      key: "pendingPayouts",
      label: "Pending Payouts",
      value: formatCents(stats.pendingPayoutsCents, currency),
    },
    {
      key: "paidPayouts",
      label: "Paid Payouts",
      value: formatCents(stats.paidPayoutsCents, currency),
    },
    {
      key: "campaigns",
      label: "Active Campaigns",
      value: stats.activeCampaigns.toLocaleString(),
    },
  ];

  return <>{children({ metrics, raw: stats })}</>;
}

/**
 * Conversion Funnel - Shows click-to-conversion funnel.
 */
export interface ConversionFunnelRenderProps {
  funnel: Array<{
    stage: string;
    count: number;
    percentage: number;
    formattedCount: string;
    formattedPercentage: string;
  }>;
  rates: {
    clickToSignup: number;
    signupToConversion: number;
    overall: number;
  };
}

export interface ConversionFunnelProps {
  children: (props: ConversionFunnelRenderProps) => React.ReactNode;
}

export function ConversionFunnel({ children }: ConversionFunnelProps) {
  const { stats } = useAdminDashboardContext();

  if (!stats) return null;

  const clicks = stats.totalClicks;
  const signups = stats.totalSignups;
  const conversions = stats.totalConversions;

  const funnel = [
    {
      stage: "Clicks",
      count: clicks,
      percentage: 100,
      formattedCount: clicks.toLocaleString(),
      formattedPercentage: "100%",
    },
    {
      stage: "Signups",
      count: signups,
      percentage: clicks > 0 ? (signups / clicks) * 100 : 0,
      formattedCount: signups.toLocaleString(),
      formattedPercentage:
        clicks > 0 ? `${((signups / clicks) * 100).toFixed(1)}%` : "0%",
    },
    {
      stage: "Conversions",
      count: conversions,
      percentage: clicks > 0 ? (conversions / clicks) * 100 : 0,
      formattedCount: conversions.toLocaleString(),
      formattedPercentage:
        clicks > 0 ? `${((conversions / clicks) * 100).toFixed(1)}%` : "0%",
    },
  ];

  const rates = {
    clickToSignup: clicks > 0 ? (signups / clicks) * 100 : 0,
    signupToConversion: signups > 0 ? (conversions / signups) * 100 : 0,
    overall: clicks > 0 ? (conversions / clicks) * 100 : 0,
  };

  return <>{children({ funnel, rates })}</>;
}

/**
 * Affiliate Table - Displays list of affiliates with actions.
 */
export interface AffiliateTableRenderProps {
  affiliates: Array<{
    id: string;
    code: string;
    email: string;
    displayName: string;
    status: string;
    statusColor: "yellow" | "green" | "red" | "gray";
    clicks: string;
    conversions: string;
    revenue: string;
    commissions: string;
    joinDate: string;
    joinDateRelative: string;
  }>;
  isEmpty: boolean;
  onApprove?: (affiliateId: string) => Promise<void>;
  onReject?: (affiliateId: string, reason?: string) => Promise<void>;
  onSuspend?: (affiliateId: string, reason?: string) => Promise<void>;
}

export interface AffiliateTableProps {
  children: (props: AffiliateTableRenderProps) => React.ReactNode;
  currency?: string;
}

export function AffiliateTable({
  children,
  currency = "USD",
}: AffiliateTableProps) {
  const { affiliates, onApprove, onReject, onSuspend } =
    useAdminDashboardContext();

  const formattedAffiliates = affiliates.map((a) => ({
    id: a._id,
    code: a.code,
    email: a.email,
    displayName: a.displayName || a.email.split("@")[0],
    status: a.status,
    statusColor: getAffiliateStatusColor(a.status),
    clicks: a.stats.totalClicks.toLocaleString(),
    conversions: a.stats.totalConversions.toLocaleString(),
    revenue: formatCents(a.stats.totalRevenueCents, currency),
    commissions: formatCents(a.stats.totalCommissionsCents, currency),
    joinDate: formatDate(a.createdAt),
    joinDateRelative: formatRelativeTime(a.createdAt),
  }));

  return (
    <>
      {children({
        affiliates: formattedAffiliates,
        isEmpty: formattedAffiliates.length === 0,
        onApprove,
        onReject,
        onSuspend,
      })}
    </>
  );
}

/**
 * Pending Approvals - Shows affiliates awaiting approval.
 */
export interface PendingApprovalsRenderProps {
  pendingAffiliates: Array<{
    id: string;
    code: string;
    email: string;
    displayName: string;
    website?: string;
    socialMedia?: string;
    appliedDate: string;
    appliedDateRelative: string;
  }>;
  count: number;
  isEmpty: boolean;
  onApprove?: (affiliateId: string) => Promise<void>;
  onReject?: (affiliateId: string, reason?: string) => Promise<void>;
}

export interface PendingApprovalsProps {
  children: (props: PendingApprovalsRenderProps) => React.ReactNode;
}

export function PendingApprovals({ children }: PendingApprovalsProps) {
  const { pendingApprovals, onApprove, onReject } = useAdminDashboardContext();

  const formatted = pendingApprovals.map((a) => ({
    id: a._id,
    code: a.code,
    email: a.email,
    displayName: a.displayName || a.email.split("@")[0],
    website: undefined, // Would need to be in the affiliate object
    socialMedia: undefined,
    appliedDate: formatDate(a.createdAt),
    appliedDateRelative: formatRelativeTime(a.createdAt),
  }));

  return (
    <>
      {children({
        pendingAffiliates: formatted,
        count: formatted.length,
        isEmpty: formatted.length === 0,
        onApprove,
        onReject,
      })}
    </>
  );
}

/**
 * Top Affiliates Leaderboard - Shows top performing affiliates.
 */
export interface TopAffiliatesRenderProps {
  affiliates: Array<{
    id: string;
    rank: number;
    code: string;
    displayName: string;
    conversions: string;
    revenue: string;
    commissions: string;
    conversionRate: string;
  }>;
  isEmpty: boolean;
}

export interface TopAffiliatesProps {
  children: (props: TopAffiliatesRenderProps) => React.ReactNode;
  currency?: string;
}

export function TopAffiliatesLeaderboard({
  children,
  currency = "USD",
}: TopAffiliatesProps) {
  const { topAffiliates } = useAdminDashboardContext();

  const formatted = topAffiliates.map((a, index) => ({
    id: a._id,
    rank: index + 1,
    code: a.code,
    displayName: a.displayName || a.code,
    conversions: a.stats.totalConversions.toLocaleString(),
    revenue: formatCents(a.stats.totalRevenueCents, currency),
    commissions: formatCents(a.stats.totalCommissionsCents, currency),
    conversionRate:
      a.stats.totalClicks > 0
        ? `${((a.stats.totalConversions / a.stats.totalClicks) * 100).toFixed(
            1,
          )}%`
        : "0%",
  }));

  return (
    <>
      {children({
        affiliates: formatted,
        isEmpty: formatted.length === 0,
      })}
    </>
  );
}

/**
 * Payout Summary - Shows pending payout totals.
 */
export interface PayoutSummaryRenderProps {
  pendingAmount: string;
  pendingAmountCents: number;
  paidAmount: string;
  paidAmountCents: number;
  totalAmount: string;
  totalAmountCents: number;
}

export interface PayoutSummaryProps {
  children: (props: PayoutSummaryRenderProps) => React.ReactNode;
  currency?: string;
}

export function PayoutSummary({
  children,
  currency = "USD",
}: PayoutSummaryProps) {
  const { stats } = useAdminDashboardContext();

  if (!stats) return null;

  const pendingCents = stats.pendingPayoutsCents;
  const paidCents = stats.paidPayoutsCents;
  const totalCents = pendingCents + paidCents;

  return (
    <>
      {children({
        pendingAmount: formatCents(pendingCents, currency),
        pendingAmountCents: pendingCents,
        paidAmount: formatCents(paidCents, currency),
        paidAmountCents: paidCents,
        totalAmount: formatCents(totalCents, currency),
        totalAmountCents: totalCents,
      })}
    </>
  );
}

/**
 * Campaign Stats - Shows campaign performance summary.
 */
export interface CampaignStatsRenderProps {
  activeCampaigns: number;
  formattedActiveCampaigns: string;
}

export interface CampaignStatsProps {
  children: (props: CampaignStatsRenderProps) => React.ReactNode;
}

export function CampaignStats({ children }: CampaignStatsProps) {
  const { stats } = useAdminDashboardContext();

  if (!stats) return null;

  return (
    <>
      {children({
        activeCampaigns: stats.activeCampaigns,
        formattedActiveCampaigns: stats.activeCampaigns.toLocaleString(),
      })}
    </>
  );
}

// =============================================================================
// Utilities
// =============================================================================

function getAffiliateStatusColor(
  status: string,
): "yellow" | "green" | "red" | "gray" {
  switch (status) {
    case "pending":
      return "yellow";
    case "approved":
      return "green";
    case "rejected":
      return "red";
    case "suspended":
      return "gray";
    default:
      return "gray";
  }
}
