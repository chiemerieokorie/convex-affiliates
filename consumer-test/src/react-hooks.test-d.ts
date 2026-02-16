/**
 * Verify createAffiliateHooks factory compiles with expected API shape.
 *
 * NOTE: createAffiliateHooks expects FunctionReference types (from components.affiliates),
 * NOT the RegisteredQuery/RegisteredMutation types returned by createAffiliateApi.
 * This is a known type gap — consumers must pass components.affiliates directly.
 */
import { createAffiliateHooks } from "convex-affiliates/react";
import type { FunctionReference } from "convex/server";

// This matches the shape consumers get from components.affiliates
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

// Verify all hooks exist
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

void [hooks];
