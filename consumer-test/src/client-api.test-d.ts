/**
 * Verify createAffiliateApi works with the boundary ComponentApi type.
 * This catches mismatches between the client wrapper and component.ts boundary.
 */
import { createAffiliateApi } from "convex-affiliates";
import type { ComponentApi } from "convex-affiliates";
import type { HttpRouter } from "convex/server";

// Simulate what the consumer's _generated/api.d.ts provides
declare const component: ComponentApi<"affiliates">;

// Full config with all options
const api = createAffiliateApi(component, {
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },
  isAdmin: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return !!identity;
  },
  defaultCommissionType: "percentage",
  defaultCommissionValue: 20,
  defaultPayoutTerm: "NET-30",
  minPayoutCents: 5000,
  defaultCookieDurationDays: 30,
  baseUrl: "https://example.com",
  hooks: {
    "affiliate.registered": async (data) => {
      console.log(data.affiliateId, data.affiliateCode, data.affiliateEmail);
    },
    "affiliate.approved": async (data) => {
      console.log(data.affiliateId, data.affiliateCode);
    },
    "affiliate.rejected": async (data) => {
      console.log(data.affiliateId, data.affiliateCode);
    },
    "affiliate.suspended": async (data) => {
      console.log(data.affiliateId, data.affiliateCode);
    },
    "commission.created": async (data) => {
      console.log(data.commissionId, data.commissionAmountCents, data.currency);
    },
    "commission.reversed": async (data) => {
      console.log(data.commissionId, data.commissionAmountCents, data.reason);
    },
  },
});

// ---- Verify all public API functions exist ----

// Public (no auth)
api.trackClick;
api.validateCode;

// Authenticated
api.register;
api.getAffiliate;
api.updateProfile;
api.getPortalData;
api.listCommissions;
api.listPayouts;
api.listReferrals;
api.generateLink;
api.attributeSignup;
api.getRefereeDiscount;

// Admin
api.adminDashboard;
api.adminListAffiliates;
api.adminTopAffiliates;
api.adminApproveAffiliate;
api.adminRejectAffiliate;
api.adminSuspendAffiliate;
api.adminListCampaigns;
api.adminCreateCampaign;

// HTTP routes
declare const http: HttpRouter;
api.registerRoutes(http, { pathPrefix: "/affiliates" });

// Stripe webhook handler
api.createStripeWebhookHandler({ webhookSecret: "whsec_test" });
