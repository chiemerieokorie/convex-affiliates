/**
 * Verify Better Auth plugin types compile correctly for consumers.
 */
import { affiliatePlugin } from "convex-affiliates/better-auth";
import { affiliateClientPlugin, extractReferralParams, createReferralUrl } from "convex-affiliates/better-auth/client";
import type { ComponentApi } from "convex-affiliates";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

declare const component: ComponentApi<"affiliates">;
declare const ctx: GenericActionCtx<GenericDataModel>;

// Server plugin — used in betterAuth({ plugins: [...] })
const serverPlugin = affiliatePlugin(ctx, component, {
  fieldNames: {
    referralId: "referralId",
    referralCode: "referralCode",
  },
  cookieName: "affiliate_code",
  referralIdCookieName: "affiliate_referral_id",
  onAttributionSuccess: async (data) => {
    console.log(`User ${data.userId} attributed to ${data.affiliateCode}`);
  },
  onAttributionFailure: async (data) => {
    console.error(`Attribution failed for ${data.userId}: ${data.reason}`);
  },
});

// Client plugin — used in createAuthClient({ plugins: [...] })
const clientPlugin = affiliateClientPlugin({
  storage: "both",
  cookieDurationDays: 30,
  paramName: "ref",
  subIdParamName: "sub",
  autoTrack: true,
  clearOnSignup: true,
  trackClick: async (args) => {
    console.log(args.affiliateCode, args.landingPage, args.subId);
    return { referralId: "test" };
  },
});

// Standalone utilities
const { code, subId } = extractReferralParams("?ref=ABC&sub=test");
const url = createReferralUrl("https://example.com", "ABC123", "campaign1");

void [serverPlugin, clientPlugin, code, subId, url];
