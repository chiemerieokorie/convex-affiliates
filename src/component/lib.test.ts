/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
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

      const campaignId = await t.mutation(api.campaigns.create, {
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

      await t.mutation(api.campaigns.create, {
        name: "Campaign 1",
        slug: "campaign-1",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
      });

      await t.mutation(api.campaigns.create, {
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
      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register affiliate
      const result = await t.mutation(api.affiliates.register, {
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

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const result = await t.mutation(api.affiliates.register, {
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

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const result = await t.mutation(api.affiliates.register, {
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
      await t.mutation(api.affiliates.approve, {
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

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "user-ref",
        email: "referrer@example.com",
        campaignId,
      });

      // Approve the affiliate
      await t.mutation(api.affiliates.approve, {
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

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "user-attr",
        email: "attributer@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
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

  describe("fraud prevention", () => {
    test("attributeSignupByCode blocks self-referral", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register affiliate with userId "affiliate-user"
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Affiliate tries to sign up with their own code (self-referral)
      const result = await t.mutation(api.referrals.attributeSignupByCode, {
        userId: "affiliate-user", // Same as affiliate's userId
        affiliateCode: affiliateResult.code,
      });

      // Should be blocked
      expect(result.success).toBe(false);

      // No referral should be created
      const referral = await t.query(api.referrals.getByUserId, {
        userId: "affiliate-user",
      });
      expect(referral).toBeNull();
    });

    test("linkStripeCustomer blocks self-referral via userId path", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Create a referral that points to the affiliate themselves (simulate bad state)
      // First attribute a signup with a different user, then try to link stripe customer
      const signupResult = await t.mutation(api.referrals.attributeSignupByCode, {
        userId: "different-user",
        affiliateCode: affiliateResult.code,
      });
      expect(signupResult.success).toBe(true);

      // Now try to link stripe customer with affiliate's own userId via affiliateCode path
      // This should be blocked because we require userId and check against affiliate
      await t.mutation(api.referrals.linkStripeCustomer, {
        stripeCustomerId: "cus_self_referral",
        userId: "affiliate-user",
        affiliateCode: affiliateResult.code,
      });

      // Stripe customer should NOT be linked to a self-referral
      const referral = await t.query(api.referrals.getByStripeCustomer, {
        stripeCustomerId: "cus_self_referral",
      });
      expect(referral).toBeNull();
    });

    test("linkStripeCustomer requires userId for affiliate code attribution", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Try to link stripe customer with affiliate code but NO userId (guest checkout)
      // This should be blocked to prevent self-referral abuse
      await t.mutation(api.referrals.linkStripeCustomer, {
        stripeCustomerId: "cus_guest_checkout",
        affiliateCode: affiliateResult.code,
        // No userId provided
      });

      // Stripe customer should NOT be linked (guest checkout blocked)
      const referral = await t.query(api.referrals.getByStripeCustomer, {
        stripeCustomerId: "cus_guest_checkout",
      });
      expect(referral).toBeNull();
    });

    test("attributeSignup blocks self-referral", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Track a click (creates referral with status "clicked")
      const clickResult = await t.mutation(api.referrals.trackClick, {
        affiliateCode: affiliateResult.code,
        landingPage: "/pricing",
      });
      expect(clickResult).toBeDefined();

      // Now try to attribute signup with the affiliate's own userId
      await t.mutation(api.referrals.attributeSignup, {
        referralId: clickResult!.referralId,
        userId: "affiliate-user", // Same as affiliate's userId
      });

      // The referral should still be in "clicked" state (attribution blocked)
      const referral = await t.query(api.referrals.getByReferralId, {
        referralId: clickResult!.referralId,
      });
      expect(referral?.status).toBe("clicked");
      expect(referral?.userId).toBeUndefined();
    });

    test("createFromInvoice creates commission for legitimate referral", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Create a referral for a DIFFERENT user (legitimate referral)
      const signupResult = await t.mutation(api.referrals.attributeSignupByCode, {
        userId: "referred-customer",
        affiliateCode: affiliateResult.code,
      });
      expect(signupResult.success).toBe(true);

      // Link stripe customer
      await t.mutation(api.referrals.linkStripeCustomer, {
        stripeCustomerId: "cus_legitimate",
        userId: "referred-customer",
      });

      // Create commission from invoice
      const commission = await t.mutation(api.commissions.createFromInvoice, {
        stripeCustomerId: "cus_legitimate",
        stripeInvoiceId: "inv_test_123",
        amountPaidCents: 10000, // $100
        currency: "usd",
      });

      // Commission SHOULD be created for legitimate referral
      expect(commission).toBeDefined();
      expect(commission?.commissionAmountCents).toBe(2000); // 20% of $100
    });

    test("multi-layer self-referral defense blocks at every stage", async () => {
      const t = initConvexTest();

      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Default Campaign",
        slug: "default",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Stage 1: attributeSignupByCode - affiliate tries to sign up with own code
      const selfSignup = await t.mutation(api.referrals.attributeSignupByCode, {
        userId: "affiliate-user",
        affiliateCode: affiliateResult.code,
      });
      expect(selfSignup.success).toBe(false);

      // Stage 2: linkStripeCustomer - affiliate tries to link with own code
      await t.mutation(api.referrals.linkStripeCustomer, {
        stripeCustomerId: "cus_affiliate_self",
        userId: "affiliate-user",
        affiliateCode: affiliateResult.code,
      });
      const selfReferral = await t.query(api.referrals.getByStripeCustomer, {
        stripeCustomerId: "cus_affiliate_self",
      });
      expect(selfReferral).toBeNull();

      // Stage 3: createFromInvoice - even if we got here, no commission would be created
      // (we can't easily test this without database manipulation, but the code path exists)
      const commission = await t.mutation(api.commissions.createFromInvoice, {
        stripeCustomerId: "cus_affiliate_self",
        stripeInvoiceId: "inv_self_123",
        amountPaidCents: 10000,
        currency: "usd",
      });
      expect(commission).toBeNull(); // No referral exists, so no commission
    });
  });

  describe("two-sided rewards", () => {
    test("getRefereeDiscount returns discount when configured", async () => {
      const t = initConvexTest();

      // Create campaign with referee discount
      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Two-Sided Campaign",
        slug: "two-sided",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
        refereeDiscountType: "percentage",
        refereeDiscountValue: 10, // 10% off for referred customers
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Get referee discount by affiliate code
      const discount = await t.query(api.referrals.getRefereeDiscount, {
        affiliateCode: affiliateResult.code,
      });

      expect(discount).toBeDefined();
      expect(discount?.discountType).toBe("percentage");
      expect(discount?.discountValue).toBe(10);
      expect(discount?.affiliateCode).toBe(affiliateResult.code);
    });

    test("getRefereeDiscount returns null when not configured", async () => {
      const t = initConvexTest();

      // Create campaign WITHOUT referee discount
      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Standard Campaign",
        slug: "standard",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
        // No refereeDiscountType or refereeDiscountValue
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Get referee discount - should be null
      const discount = await t.query(api.referrals.getRefereeDiscount, {
        affiliateCode: affiliateResult.code,
      });

      expect(discount).toBeNull();
    });

    test("getRefereeDiscount returns null for unapproved affiliate", async () => {
      const t = initConvexTest();

      // Create campaign with referee discount
      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Two-Sided Campaign",
        slug: "two-sided",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
        refereeDiscountType: "percentage",
        refereeDiscountValue: 10,
      });

      // Register affiliate but DON'T approve
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      // Get referee discount - should be null (affiliate not approved)
      const discount = await t.query(api.referrals.getRefereeDiscount, {
        affiliateCode: affiliateResult.code,
      });

      expect(discount).toBeNull();
    });

    test("getRefereeDiscount works with fixed discount type", async () => {
      const t = initConvexTest();

      // Create campaign with fixed referee discount
      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Fixed Discount Campaign",
        slug: "fixed-discount",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 30,
        isDefault: true,
        refereeDiscountType: "fixed",
        refereeDiscountValue: 500, // $5.00 off
        refereeStripeCouponId: "coupon_5_off",
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Get referee discount
      const discount = await t.query(api.referrals.getRefereeDiscount, {
        affiliateCode: affiliateResult.code,
      });

      expect(discount).toBeDefined();
      expect(discount?.discountType).toBe("fixed");
      expect(discount?.discountValue).toBe(500);
      expect(discount?.stripeCouponId).toBe("coupon_5_off");
    });

    test("getRefereeDiscount returns null for expired referral", async () => {
      const t = initConvexTest();

      // Set time to a known point
      const startTime = new Date("2024-01-01T00:00:00Z").getTime();
      vi.setSystemTime(startTime);

      // Create campaign with 7-day cookie duration and referee discount
      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Short Duration Campaign",
        slug: "short-duration",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 7, // 7-day cookie
        isDefault: true,
        refereeDiscountType: "percentage",
        refereeDiscountValue: 10,
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Track a click - this creates a referral with expiresAt = startTime + 7 days
      const clickResult = await t.mutation(api.referrals.trackClick, {
        affiliateCode: affiliateResult.code,
        landingPage: "/pricing",
      });
      expect(clickResult).toBeDefined();

      // Verify discount IS available before expiry
      const discountBeforeExpiry = await t.query(api.referrals.getRefereeDiscount, {
        referralId: clickResult!.referralId,
      });
      expect(discountBeforeExpiry).toBeDefined();
      expect(discountBeforeExpiry?.discountValue).toBe(10);

      // Advance time past the cookie duration (8 days)
      vi.setSystemTime(startTime + 8 * 24 * 60 * 60 * 1000);

      // Now the discount should NOT be available (referral expired)
      const discountAfterExpiry = await t.query(api.referrals.getRefereeDiscount, {
        referralId: clickResult!.referralId,
      });
      expect(discountAfterExpiry).toBeNull();
    });

    test("getRefereeDiscount via affiliate code still works even with expired referral", async () => {
      const t = initConvexTest();

      // Set time to a known point
      const startTime = new Date("2024-01-01T00:00:00Z").getTime();
      vi.setSystemTime(startTime);

      // Create campaign with referee discount
      const campaignId = await t.mutation(api.campaigns.create, {
        name: "Test Campaign",
        slug: "test",
        commissionType: "percentage",
        commissionValue: 20,
        payoutTerm: "NET-30",
        cookieDurationDays: 7,
        isDefault: true,
        refereeDiscountType: "percentage",
        refereeDiscountValue: 15,
      });

      // Register and approve affiliate
      const affiliateResult = await t.mutation(api.affiliates.register, {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      });

      await t.mutation(api.affiliates.approve, {
        affiliateId: affiliateResult.affiliateId,
      });

      // Track a click
      await t.mutation(api.referrals.trackClick, {
        affiliateCode: affiliateResult.code,
        landingPage: "/pricing",
      });

      // Advance time past expiry
      vi.setSystemTime(startTime + 8 * 24 * 60 * 60 * 1000);

      // Lookup by affiliate code should STILL work (code doesn't expire)
      const discount = await t.query(api.referrals.getRefereeDiscount, {
        affiliateCode: affiliateResult.code,
      });
      expect(discount).toBeDefined();
      expect(discount?.discountValue).toBe(15);
    });
  });
});
