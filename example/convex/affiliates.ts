import { components } from "./_generated/api.js";
import { createAffiliateApi } from "convex-affiliates";
import { Auth } from "convex/server";

// Single shared affiliate API instance.
// Import this from other files instead of calling createAffiliateApi again.
export const affiliates = createAffiliateApi(components.affiliates, {
  defaultCommissionType: "percentage",
  defaultCommissionValue: 20,
  defaultPayoutTerm: "NET-30",
  minPayoutCents: 5000,
  defaultCookieDurationDays: 30,
  baseUrl: process.env.BASE_URL ?? "https://example.com",

  auth: async (ctx: { auth: Auth }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },

  isAdmin: async (ctx: { auth: Auth }) => {
    const identity = await ctx.auth.getUserIdentity();
    // TODO: Implement your admin check logic here
    return !!identity;
  },
});
