import { components } from "./_generated/api.js";
import { createAffiliateApi } from "convex-affiliates";
import { Auth } from "convex/server";

// =============================================================================
// Create Affiliate API
// =============================================================================

// Create the API with ready-to-use functions
const affiliates = createAffiliateApi(components.affiliates, {
  // Commission defaults
  defaultCommissionType: "percentage",
  defaultCommissionValue: 20, // 20%
  defaultPayoutTerm: "NET-30",
  minPayoutCents: 5000, // $50 minimum
  defaultCookieDurationDays: 30,

  // URLs
  baseUrl: process.env.BASE_URL ?? "https://example.com",

  // Authentication callback
  auth: async (ctx: { auth: Auth }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },

  // Admin authorization callback (optional)
  isAdmin: async (ctx: { auth: Auth }) => {
    const identity = await ctx.auth.getUserIdentity();
    // TODO: Implement your admin check logic here
    return !!identity;
  },
});

// =============================================================================
// Re-export ready-to-use functions
// =============================================================================

export const {
  // Public (no auth required)
  trackClick,
  validateCode,

  // Authenticated user functions
  register,
  getAffiliate,
  updateProfile,
  getPortalData,
  listCommissions,
  listPayouts,
  listReferrals,
  generateLink,
  attributeSignup,

  // Admin functions
  adminDashboard,
  adminListAffiliates,
  adminTopAffiliates,
  adminApproveAffiliate,
  adminRejectAffiliate,
  adminSuspendAffiliate,
  adminListCampaigns,
  adminCreateCampaign,
} = affiliates;
