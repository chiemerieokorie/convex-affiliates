import { affiliates } from "./affiliates.js";

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
