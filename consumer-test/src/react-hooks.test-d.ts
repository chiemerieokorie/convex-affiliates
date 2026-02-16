/**
 * Verify createAffiliateHooks factory compiles with expected API shape.
 */
import { createAffiliateHooks } from "convex-affiliates/react";
import type { FunctionReference } from "convex/server";

// Simulate the API shape that createAffiliateHooks expects
declare const affiliateApi: {
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

const hooks = createAffiliateHooks(affiliateApi, {
  storage: "both",
  cookieOptions: {
    domain: ".example.com",
    path: "/",
    maxAge: 2592000,
    secure: true,
    sameSite: "lax",
  },
});

// Verify all hooks exist and are functions
hooks.useAffiliate;
hooks.useAffiliatePortal;
hooks.useAffiliateCommissions;
hooks.useAffiliatePayouts;
hooks.useRegisterAffiliate;
hooks.useTrackReferral;
hooks.useAdminDashboard;
hooks.useAffiliateList;
hooks.useTopAffiliates;
hooks.useApproveAffiliate;
hooks.useRejectAffiliate;
