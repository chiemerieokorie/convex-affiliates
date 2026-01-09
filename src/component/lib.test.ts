/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("affiliate component", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("campaigns", () => {
    test("create and get campaign", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(internal.campaigns.create, {
        name: "Test Campaign",
        slug: "test-campaign",
        commissionType: "percentage",
        commissionValue: 25,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      expect(campaignId).toBeDefined();

      const campaign = await t.query(api.campaigns.get, { campaignId });
      expect(campaign).toBeDefined();
      expect(campaign?.name).toBe("Test Campaign");
      expect(campaign?.commissionValue).toBe(25);
    });

    test("list campaigns", async () => {
      const t = initConvexTest();

      await t.mutation(internal.campaigns.create, {
        name: "Campaign 1",
        slug: "campaign-1",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
      });

      await t.mutation(internal.campaigns.create, {
        name: "Campaign 2",
        slug: "campaign-2",
        commissionType: "fixed",
        commissionValue: 1000,
        payoutTerm: "NET-15",
        cookieDurationDays: 14,
      });

      const campaigns = await t.query(api.campaigns.list, {
        activeOnly: false,
      });
      expect(campaigns).toHaveLength(2);
    });
  });

  describe("affiliates", () => {
    test("register affiliate", async () => {
      const t = initConvexTest();

      // First create a campaign
      const campaignId = await t.mutation(internal.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register affiliate
      const result = await t.mutation(internal.affiliates.register, {
        userId: "user-123",
        email: "affiliate@example.com",
        displayName: "Test Affiliate",
        campaignId,
      });

      expect(result.affiliateId).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.code.length).toBe(8);
    });

    test("get affiliate by code", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(internal.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const result = await t.mutation(internal.affiliates.register, {
        userId: "user-456",
        email: "affiliate2@example.com",
        campaignId,
      });

      const affiliate = await t.query(api.affiliates.getByCode, {
        code: result.code,
      });

      expect(affiliate).toBeDefined();
      expect(affiliate?.userId).toBe("user-456");
    });

    test("approve affiliate", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(internal.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const result = await t.mutation(internal.affiliates.register, {
        userId: "user-789",
        email: "affiliate3@example.com",
        campaignId,
      });

      // Initially pending
      let affiliate = await t.query(api.affiliates.getByCode, {
        code: result.code,
      });
      expect(affiliate?.status).toBe("pending");

      // Approve
      await t.mutation(internal.affiliates.approve, {
        affiliateId: result.affiliateId,
      });

      // Now approved
      affiliate = await t.query(api.affiliates.getByCode, {
        code: result.code,
      });
      expect(affiliate?.status).toBe("approved");
    });
  });

  describe("referrals", () => {
    test("track click creates referral", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(internal.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const affiliateResult = await t.mutation(internal.affiliates.register, {
        userId: "user-ref",
        email: "referrer@example.com",
        campaignId,
      });

      // Approve the affiliate
      await t.mutation(internal.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Track a click
      const clickResult = await t.mutation(api.referrals.trackClick, {
        affiliateCode: affiliateResult.code,
        landingPage: "/pricing",
      });

      expect(clickResult).toBeDefined();
      expect(clickResult?.referralId).toBeDefined();
    });

    test("attribute signup to referral", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(internal.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const affiliateResult = await t.mutation(internal.affiliates.register, {
        userId: "user-attr",
        email: "attributer@example.com",
        campaignId,
      });

      await t.mutation(internal.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Attribute signup by code
      const result = await t.mutation(api.referrals.attributeSignupByCode, {
        userId: "new-user-123",
        affiliateCode: affiliateResult.code,
      });

      expect(result.success).toBe(true);

      // Check referral was created
      const referral = await t.query(api.referrals.getByUserId, {
        userId: "new-user-123",
      });

      expect(referral).toBeDefined();
      expect(referral?.status).toBe("signed_up");
    });
  });

  describe("analytics", () => {
    test("get admin dashboard", async () => {
      const t = initConvexTest();

      const dashboard = await t.query(api.analytics.getAdminDashboard);

      expect(dashboard).toBeDefined();
      expect(dashboard.totalAffiliates).toBe(0);
      expect(dashboard.activeCampaigns).toBe(0);
    });

    test("conversion funnel stats", async () => {
      const t = initConvexTest();

      const funnel = await t.query(api.analytics.getConversionFunnel, {});

      expect(funnel).toBeDefined();
      expect(funnel.clicks).toBe(0);
      expect(funnel.signups).toBe(0);
      expect(funnel.conversions).toBe(0);
    });
  });
});
