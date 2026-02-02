import React from "react";
import { AffiliatePortalProvider } from "../src/react/AffiliatePortal";
import { AdminDashboardProvider } from "../src/react/AdminDashboard";

// =============================================================================
// Mock data for Affiliate Portal
// =============================================================================

export const mockAffiliate = {
  _id: "affiliate_1",
  code: "ALICE2025",
  displayName: "Alice Johnson",
  status: "approved" as const,
  stripeConnectStatus: "enabled" as const,
  stats: {
    totalClicks: 1_234,
    totalSignups: 312,
    totalConversions: 89,
    totalRevenueCents: 567_800,
    totalCommissionsCents: 56_780,
    pendingCommissionsCents: 12_340,
    paidCommissionsCents: 44_440,
  },
};

export const mockCampaign = {
  name: "Default Campaign",
  commissionType: "percentage",
  commissionValue: 10,
};

export const mockCommissions = [
  { _id: "c1", saleAmountCents: 9900, commissionAmountCents: 990, currency: "USD", status: "paid", createdAt: Date.now() - 86400000 },
  { _id: "c2", saleAmountCents: 14900, commissionAmountCents: 1490, currency: "USD", status: "approved", createdAt: Date.now() - 172800000 },
  { _id: "c3", saleAmountCents: 4900, commissionAmountCents: 490, currency: "USD", status: "pending", createdAt: Date.now() - 259200000 },
  { _id: "c4", saleAmountCents: 29900, commissionAmountCents: 2990, currency: "USD", status: "paid", createdAt: Date.now() - 345600000 },
  { _id: "c5", saleAmountCents: 7900, commissionAmountCents: 790, currency: "USD", status: "reversed", createdAt: Date.now() - 432000000 },
];

export const mockPendingPayout = { amountCents: 12_340, count: 3 };

// =============================================================================
// Mock data for Admin Dashboard
// =============================================================================

export const mockAdminStats = {
  totalAffiliates: 47,
  pendingApprovals: 5,
  activeAffiliates: 38,
  totalClicks: 12_450,
  totalSignups: 3_120,
  totalConversions: 890,
  totalRevenueCents: 5_678_000,
  totalCommissionsCents: 567_800,
  pendingPayoutsCents: 123_400,
  paidPayoutsCents: 444_400,
  activeCampaigns: 3,
};

export const mockAffiliateList = [
  {
    _id: "a1", code: "ALICE2025", email: "alice@example.com", displayName: "Alice Johnson",
    status: "approved",
    stats: { totalClicks: 1234, totalSignups: 312, totalConversions: 89, totalRevenueCents: 567800, totalCommissionsCents: 56780, pendingCommissionsCents: 12340, paidCommissionsCents: 44440 },
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    _id: "a2", code: "BOB2025", email: "bob@example.com", displayName: "Bob Smith",
    status: "approved",
    stats: { totalClicks: 890, totalSignups: 201, totalConversions: 52, totalRevenueCents: 312000, totalCommissionsCents: 31200, pendingCommissionsCents: 8400, paidCommissionsCents: 22800 },
    createdAt: Date.now() - 45 * 86400000,
  },
  {
    _id: "a3", code: "CAROL2025", email: "carol@example.com", displayName: "Carol Davis",
    status: "pending",
    stats: { totalClicks: 0, totalSignups: 0, totalConversions: 0, totalRevenueCents: 0, totalCommissionsCents: 0, pendingCommissionsCents: 0, paidCommissionsCents: 0 },
    createdAt: Date.now() - 2 * 86400000,
  },
  {
    _id: "a4", code: "DAN2025", email: "dan@example.com", displayName: "Dan Wilson",
    status: "pending",
    stats: { totalClicks: 0, totalSignups: 0, totalConversions: 0, totalRevenueCents: 0, totalCommissionsCents: 0, pendingCommissionsCents: 0, paidCommissionsCents: 0 },
    createdAt: Date.now() - 1 * 86400000,
  },
  {
    _id: "a5", code: "EVE2025", email: "eve@example.com", displayName: "Eve Chen",
    status: "suspended",
    stats: { totalClicks: 45, totalSignups: 3, totalConversions: 0, totalRevenueCents: 0, totalCommissionsCents: 0, pendingCommissionsCents: 0, paidCommissionsCents: 0 },
    createdAt: Date.now() - 90 * 86400000,
  },
];

export const mockTopAffiliates = [
  {
    _id: "a1", code: "ALICE2025", displayName: "Alice Johnson",
    stats: { totalClicks: 1234, totalSignups: 312, totalConversions: 89, totalRevenueCents: 567800, totalCommissionsCents: 56780, pendingCommissionsCents: 12340, paidCommissionsCents: 44440 },
  },
  {
    _id: "a2", code: "BOB2025", displayName: "Bob Smith",
    stats: { totalClicks: 890, totalSignups: 201, totalConversions: 52, totalRevenueCents: 312000, totalCommissionsCents: 31200, pendingCommissionsCents: 8400, paidCommissionsCents: 22800 },
  },
];

// =============================================================================
// Provider wrappers for stories
// =============================================================================

export function PortalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AffiliatePortalProvider
      affiliate={mockAffiliate}
      campaign={mockCampaign}
      recentCommissions={mockCommissions}
      pendingPayout={mockPendingPayout}
      baseUrl="https://example.com"
    >
      {children}
    </AffiliatePortalProvider>
  );
}

const noop = async () => {};

export function AdminWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AdminDashboardProvider
      stats={mockAdminStats}
      affiliates={mockAffiliateList}
      topAffiliates={mockTopAffiliates}
      onApprove={noop}
      onReject={noop}
      onSuspend={noop}
    >
      {children}
    </AdminDashboardProvider>
  );
}
