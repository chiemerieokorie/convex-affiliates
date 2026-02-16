/**
 * Verify all export paths resolve correctly.
 * If any import fails to resolve, tsc will error.
 */

// Root export — client API factory and utilities
import {
  createAffiliateApi,
  generateAffiliateLink,
  parseReferralParams,
  generateAffiliateCode,
  calculateCommissionAmount,
  getPayoutTermDelayMs,
  getAffiliateStripeHandlers,
} from "convex-affiliates";

// Root export — types
import type {
  ComponentApi,
  AffiliateId,
  CommissionId,
  PayoutId,
  ReferralId,
  CampaignId,
  CommissionRecord,
  PayoutRecord,
  AffiliateStripeHandlers,
  CreateAffiliateApiConfig,
  AffiliateConfig,
  AffiliateHooks,
  AffiliateRegisteredData,
  AffiliateStatusChangeData,
  CommissionCreatedData,
  CommissionReversedData,
  StripeWebhookConfig,
  AffiliateStripeHandlersOptions,
  CommissionType,
  CommissionDuration,
  PayoutTerm,
  AffiliateStatus,
  ReferralStatus,
  CommissionStatus,
  PayoutStatus,
  PayoutMethod,
  EventType,
  PromoContentType,
  // Stripe type re-exports from root
  StripeCommissionCreatedData,
  StripeCommissionReversedData,
} from "convex-affiliates";

// React hooks and utilities
import {
  createAffiliateHooks,
  useTrackReferralOnLoad,
  useStoredReferral,
  useAffiliateLinkGenerator,
  useCopyToClipboard,
  formatCents,
  formatPercentage,
  formatDate,
  formatRelativeTime,
} from "convex-affiliates/react";

// React types — hooks
import type {
  AffiliatePortalData,
  AffiliateProfile,
  AdminDashboardData,
  Commission,
  Payout,
  StorageMode,
  AffiliateHooksConfig,
  CookieOptions,
} from "convex-affiliates/react";

// React types — portal component props and render props
import type {
  AffiliatePortalProviderProps,
  AffiliatePortalContextValue,
  AffiliateStats,
  CommissionItem,
  PayoutItem,
  AffiliateStatsRenderProps,
  AffiliateStatsProps,
  AffiliateLinkGeneratorRenderProps,
  AffiliateLinkGeneratorProps,
  CommissionHistoryRenderProps,
  CommissionHistoryProps,
  PendingPayoutRenderProps,
  PendingPayoutProps,
  CommissionRateRenderProps,
  CommissionRateProps,
  StripeConnectStatusRenderProps,
  StripeConnectStatusProps,
  AffiliateStatusRenderProps,
  AffiliateStatusProps,
  PayoutHistoryRenderProps,
  PayoutHistoryProps,
} from "convex-affiliates/react";

// React types — admin dashboard props and render props
import type {
  AdminDashboardProviderProps,
  AdminDashboardContextValue,
  AdminDashboardStats,
  AffiliateListItem,
  TopAffiliate,
  OverviewStatsRenderProps,
  OverviewStatsProps,
  ConversionFunnelRenderProps,
  ConversionFunnelProps,
  AffiliateTableRenderProps,
  AffiliateTableProps,
  PendingApprovalsRenderProps,
  PendingApprovalsProps,
  TopAffiliatesRenderProps,
  TopAffiliatesProps,
  PayoutSummaryRenderProps,
  PayoutSummaryProps,
  CampaignStatsRenderProps,
  CampaignStatsProps,
} from "convex-affiliates/react";

// React portal components
import {
  AffiliatePortalProvider,
  useAffiliatePortalContext,
  AffiliateStatsDisplay,
  AffiliateLinkGenerator,
  CommissionHistory,
  PendingPayoutDisplay,
  CommissionRateDisplay,
  StripeConnectStatus,
  AffiliateStatusBadge,
  PayoutHistory,
} from "convex-affiliates/react";

// React admin components
import {
  AdminDashboardProvider,
  useAdminDashboardContext,
  OverviewStats,
  ConversionFunnel,
  AffiliateTable,
  PendingApprovals,
  TopAffiliatesLeaderboard,
  PayoutSummary,
  CampaignStats,
} from "convex-affiliates/react";

// Stripe plugin
import {
  withAffiliates,
  getAffiliateMetadata,
} from "convex-affiliates/stripe";

import type {
  WithAffiliatesOptions,
  AffiliateMetadata,
  CustomerLinkedData,
  CommissionCreatedData as StripeModuleCommissionCreatedData,
  CommissionReversedData as StripeModuleCommissionReversedData,
} from "convex-affiliates/stripe";

// Stripe client utilities
import {
  getStoredReferral,
  hasStoredReferral,
  storeReferral,
  clearStoredReferral,
} from "convex-affiliates/stripe/client";

import type {
  StoredReferral,
  StorageConfig,
} from "convex-affiliates/stripe/client";

// Better Auth server plugin
import { affiliatePlugin } from "convex-affiliates/better-auth";

import type {
  AffiliatePluginOptions,
} from "convex-affiliates/better-auth";

// Better Auth client plugin
import {
  affiliateClientPlugin,
  extractReferralParams,
  createReferralUrl,
} from "convex-affiliates/better-auth/client";

import type {
  StorageStrategy,
  AffiliateClientPluginConfig,
  StoredReferral as BetterAuthStoredReferral,
} from "convex-affiliates/better-auth/client";

// Convex config
import affiliatesConfig from "convex-affiliates/convex.config";

// Suppress unused variable warnings — these are type-only tests
void [
  createAffiliateApi, generateAffiliateLink, parseReferralParams,
  generateAffiliateCode, calculateCommissionAmount, getPayoutTermDelayMs,
  getAffiliateStripeHandlers,
  createAffiliateHooks, useTrackReferralOnLoad, useStoredReferral,
  useAffiliateLinkGenerator, useCopyToClipboard,
  formatCents, formatPercentage, formatDate, formatRelativeTime,
  AffiliatePortalProvider, useAffiliatePortalContext,
  AffiliateStatsDisplay, AffiliateLinkGenerator, CommissionHistory,
  PendingPayoutDisplay, CommissionRateDisplay, StripeConnectStatus,
  AffiliateStatusBadge, PayoutHistory,
  AdminDashboardProvider, useAdminDashboardContext,
  OverviewStats, ConversionFunnel, AffiliateTable, PendingApprovals,
  TopAffiliatesLeaderboard, PayoutSummary, CampaignStats,
  withAffiliates, getAffiliateMetadata,
  getStoredReferral, hasStoredReferral, storeReferral, clearStoredReferral,
  affiliatePlugin,
  affiliateClientPlugin, extractReferralParams, createReferralUrl,
  affiliatesConfig,
];
