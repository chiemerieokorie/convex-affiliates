"use client";

// =============================================================================
// Hooks
// =============================================================================

export {
  // Hook factory
  createAffiliateHooks,
  // Utility hooks
  useTrackReferralOnLoad,
  useStoredReferral,
  useAffiliateLinkGenerator,
  useCopyToClipboard,
  // Formatting utilities
  formatCents,
  formatPercentage,
  formatDate,
  formatRelativeTime,
  // Types
  type AffiliatePortalData,
  type AffiliateProfile,
  type AdminDashboardData,
  type Commission,
  type Payout,
  type StorageMode,
  type AffiliateHooksConfig,
  type CookieOptions,
} from "./hooks.js";

// =============================================================================
// Affiliate Portal Components
// =============================================================================

export {
  // Provider
  AffiliatePortalProvider,
  // Context hook
  useAffiliatePortalContext,
  // Headless components
  AffiliateStatsDisplay,
  AffiliateLinkGenerator,
  CommissionHistory,
  PendingPayoutDisplay,
  CommissionRateDisplay,
  StripeConnectStatus,
  AffiliateStatusBadge,
  PayoutHistory,
  // Types
  type AffiliatePortalProviderProps,
  type AffiliatePortalContextValue,
  type AffiliateStats,
  type CommissionItem,
  type PayoutItem,
  type AffiliateStatsRenderProps,
  type AffiliateStatsProps,
  type AffiliateLinkGeneratorRenderProps,
  type AffiliateLinkGeneratorProps,
  type CommissionHistoryRenderProps,
  type CommissionHistoryProps,
  type PendingPayoutRenderProps,
  type PendingPayoutProps,
  type CommissionRateRenderProps,
  type CommissionRateProps,
  type StripeConnectStatusRenderProps,
  type StripeConnectStatusProps,
  type AffiliateStatusRenderProps,
  type AffiliateStatusProps,
  type PayoutHistoryRenderProps,
  type PayoutHistoryProps,
} from "./AffiliatePortal.js";

// =============================================================================
// Admin Dashboard Components
// =============================================================================

export {
  // Provider
  AdminDashboardProvider,
  // Context hook
  useAdminDashboardContext,
  // Headless components
  OverviewStats,
  ConversionFunnel,
  AffiliateTable,
  PendingApprovals,
  TopAffiliatesLeaderboard,
  PayoutSummary,
  CampaignStats,
  // Types
  type AdminDashboardProviderProps,
  type AdminDashboardContextValue,
  type AdminDashboardStats,
  type AffiliateListItem,
  type TopAffiliate,
  type OverviewStatsRenderProps,
  type OverviewStatsProps,
  type ConversionFunnelRenderProps,
  type ConversionFunnelProps,
  type AffiliateTableRenderProps,
  type AffiliateTableProps,
  type PendingApprovalsRenderProps,
  type PendingApprovalsProps,
  type TopAffiliatesRenderProps,
  type TopAffiliatesProps,
  type PayoutSummaryRenderProps,
  type PayoutSummaryProps,
  type CampaignStatsRenderProps,
  type CampaignStatsProps,
} from "./AdminDashboard.js";
