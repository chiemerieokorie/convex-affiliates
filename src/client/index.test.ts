import { describe, expect, test } from "vitest";
import { generateAffiliateLink } from "./index.js";
import { components, initConvexTest } from "./setup.test.js";

describe("client tests", () => {
  test("generateAffiliateLink generates link correctly", async () => {
    const baseUrl = "https://example.com";

    const link = generateAffiliateLink(baseUrl, "ABC123", "/pricing");
    expect(link).toBe("https://example.com/pricing?ref=ABC123");

    const linkWithSubId = generateAffiliateLink(
      baseUrl,
      "ABC123",
      "/pricing",
      "campaign1",
    );
    expect(linkWithSubId).toBe(
      "https://example.com/pricing?ref=ABC123&sub=campaign1",
    );
  });

  test("should track click and attribute signup", async () => {
    const t = initConvexTest();

    // First create a campaign
    const campaignId = await t.mutation(
      components.affiliates.campaigns.create,
      {
        name: "Test Campaign",
        slug: "test",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      },
    );

    // Register an affiliate
    const affiliateResult = await t.mutation(
      components.affiliates.affiliates.register,
      {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      },
    );

    // Approve the affiliate
    await t.mutation(components.affiliates.affiliates.approve, {
      affiliateId: affiliateResult.affiliateId,
    });

    // Track a click
    const clickResult = await t.mutation(
      components.affiliates.referrals.trackClick,
      {
        affiliateCode: affiliateResult.code,
        landingPage: "/pricing",
      },
    );

    expect(clickResult).toBeDefined();
    expect(clickResult?.referralId).toBeDefined();

    // Attribute signup using the public mutation
    const signupResult = await t.mutation(
      components.affiliates.referrals.attributeSignupByCode,
      {
        affiliateCode: affiliateResult.code,
        userId: "new-customer",
      },
    );

    expect(signupResult.success).toBe(true);
    expect(signupResult.referralId).toBeDefined();

    // Get the referral
    const referral = await t.query(
      components.affiliates.referrals.getByUserId,
      { userId: "new-customer" },
    );

    expect(referral).toBeDefined();
    expect(referral?.status).toBe("signed_up");
  });
});
