#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEMPLATE = `import { components } from "./_generated/api";
import { createAffiliateApi } from "convex-affiliates";

const affiliates = createAffiliateApi(components.affiliates, {
  // Commission defaults
  defaultCommissionType: "percentage",
  defaultCommissionValue: 20, // 20%
  defaultPayoutTerm: "NET-30",
  minPayoutCents: 5000, // $50 minimum
  defaultCookieDurationDays: 30,

  // Your app's base URL for generating affiliate links
  baseUrl: process.env.BASE_URL ?? "https://yourapp.com",

  // Authentication callback
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return identity.subject;
  },

  // Optional: Admin authorization
  // isAdmin: async (ctx) => {
  //   const identity = await ctx.auth.getUserIdentity();
  //   return identity?.email?.endsWith("@yourcompany.com") ?? false;
  // },
});

// Public (no auth required)
export const { trackClick, validateCode } = affiliates;

// Authenticated user functions
export const {
  register,
  getAffiliate,
  updateProfile,
  getPortalData,
  listCommissions,
  listPayouts,
  listReferrals,
  generateLink,
  attributeSignup,
  getRefereeDiscount,
} = affiliates;

// Admin functions
export const {
  adminDashboard,
  adminListAffiliates,
  adminTopAffiliates,
  adminApproveAffiliate,
  adminRejectAffiliate,
  adminSuspendAffiliate,
  adminListCampaigns,
  adminCreateCampaign,
} = affiliates;
`;

function main() {
  const cwd = process.cwd();
  const convexDir = join(cwd, "convex");
  const outputPath = join(convexDir, "affiliates.ts");

  if (existsSync(outputPath)) {
    console.error("convex/affiliates.ts already exists. Aborting.");
    process.exit(1);
  }

  if (!existsSync(convexDir)) {
    mkdirSync(convexDir, { recursive: true });
  }

  writeFileSync(outputPath, TEMPLATE);
  console.log("Created convex/affiliates.ts");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Update the auth callback with your auth provider");
  console.log("  2. Adjust commission defaults as needed");
  console.log("  3. Add the component to convex/convex.config.ts:");
  console.log("");
  console.log('     import affiliates from "convex-affiliates/convex.config";');
  console.log("     app.use(affiliates);");
  console.log("");
  console.log("  4. Run: npx convex dev");
}

main();
