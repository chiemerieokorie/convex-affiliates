import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api, components } from "./_generated/api";

describe("affiliate example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("track referral click", async () => {
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
        userId: "user-123",
        email: "test@example.com",
        campaignId,
      },
    );

    // Approve the affiliate
    await t.mutation(components.affiliates.affiliates.approve, {
      affiliateId: affiliateResult.affiliateId,
    });

    // Track a click via the example function
    const clickResult = await t.mutation(api.example.trackClick, {
      affiliateCode: affiliateResult.code,
      landingPage: "/pricing",
    });

    expect(clickResult).toBeDefined();
    expect(clickResult?.referralId).toBeDefined();
  });

  test("get admin dashboard", async () => {
    const t = initConvexTest();

    // Create a campaign
    await t.mutation(components.affiliates.campaigns.create, {
      name: "Test Campaign",
      slug: "test",
      commissionType: "percentage",
      commissionValue: 20,
      payoutTerm: "NET-30",
      cookieDurationDays: 30,
      isDefault: true,
    });

    // Query the dashboard directly from the component
    const dashboard = await t.query(
      components.affiliates.analytics.getAdminDashboard,
    );

    expect(dashboard).toBeDefined();
    expect(dashboard.activeCampaigns).toBe(1);
    expect(dashboard.totalAffiliates).toBe(0);
  });
});
