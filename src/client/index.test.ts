import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { generateAffiliateLink, verifyStripeSignature } from "./index.js";
import { components, initConvexTest } from "./setup.test.js";

describe("component boundary validation", () => {
  const componentPath = resolve(__dirname, "../component/_generated/component.ts");
  const content = readFileSync(componentPath, "utf-8");

  test("component.ts should use internal visibility for all functions", () => {
    const publicMatches = content.match(/"public"/g);
    expect(publicMatches).toBeNull();
  });

  test("component.ts should not contain branded Id<> types", () => {
    const idMatches = content.match(/Id<"/g);
    expect(idMatches).toBeNull();
  });

  test("component.ts should not import from dataModel", () => {
    expect(content).not.toContain('from "./dataModel');
  });

  test("client code should not use 'as any' type casts", () => {
    const clientContent = readFileSync(resolve(__dirname, "./index.ts"), "utf-8");
    const anyCasts = clientContent.match(/as any/g);
    expect(anyCasts).toBeNull();
  });

  test("react hooks should not use 'as any' type casts", () => {
    const hooksContent = readFileSync(resolve(__dirname, "../react/hooks.ts"), "utf-8");
    const anyCasts = hooksContent.match(/as any/g);
    expect(anyCasts).toBeNull();
  });

  test("stripe plugin should not use 'as any' type casts", () => {
    const stripeContent = readFileSync(resolve(__dirname, "../stripe/index.ts"), "utf-8");
    const anyCasts = stripeContent.match(/as any/g);
    expect(anyCasts).toBeNull();
  });

  test("better-auth plugin should not use 'as any' type casts", () => {
    const authContent = readFileSync(resolve(__dirname, "../better-auth/index.ts"), "utf-8");
    const anyCasts = authContent.match(/as any/g);
    expect(anyCasts).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  async function createSignature(payload: string, secret: string, timestamp: number): Promise<string> {
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const sig = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `t=${timestamp},v1=${sig}`;
  }

  const secret = "whsec_test_secret";
  const payload = '{"type":"invoice.paid"}';

  test("valid signature passes", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = await createSignature(payload, secret, timestamp);
    expect(await verifyStripeSignature(payload, header, secret)).toBe(true);
  });

  test("invalid signature fails", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = `t=${timestamp},v1=${"a".repeat(64)}`;
    expect(await verifyStripeSignature(payload, header, secret)).toBe(false);
  });

  test("expired timestamp fails", async () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago
    const header = await createSignature(payload, secret, staleTimestamp);
    expect(await verifyStripeSignature(payload, header, secret)).toBe(false);
  });

  test("malformed header fails", async () => {
    expect(await verifyStripeSignature(payload, "garbage", secret)).toBe(false);
    expect(await verifyStripeSignature(payload, "", secret)).toBe(false);
    expect(await verifyStripeSignature(payload, "t=,v1=", secret)).toBe(false);
  });

  test("wrong secret fails", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = await createSignature(payload, secret, timestamp);
    expect(await verifyStripeSignature(payload, header, "wrong_secret")).toBe(false);
  });
});

describe("client tests", () => {
  test("generateAffiliateLink generates link correctly", async () => {
    const baseUrl = "https://example.com";

    const link = generateAffiliateLink(baseUrl, "ABC123", "/pricing");
    expect(link).toBe("https://example.com/pricing?ref=ABC123");

    const linkWithSubId = generateAffiliateLink(baseUrl, "ABC123", "/pricing", "campaign1");
    expect(linkWithSubId).toBe("https://example.com/pricing?ref=ABC123&sub=campaign1");
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
      }
    );

    // Register an affiliate
    const affiliateResult = await t.mutation(
      components.affiliates.affiliates.register,
      {
        userId: "affiliate-user",
        email: "affiliate@example.com",
        campaignId,
      }
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
      }
    );

    expect(clickResult).toBeDefined();
    expect(clickResult?.referralId).toBeDefined();

    // Attribute signup using the public mutation
    const signupResult = await t.mutation(
      components.affiliates.referrals.attributeSignupByCode,
      {
        affiliateCode: affiliateResult.code,
        userId: "new-customer",
      }
    );

    expect(signupResult.success).toBe(true);
    expect(signupResult.referralId).toBeDefined();

    // Get the referral
    const referral = await t.query(
      components.affiliates.referrals.getByUserId,
      { userId: "new-customer" }
    );

    expect(referral).toBeDefined();
    expect(referral?.status).toBe("signed_up");
  });
});
