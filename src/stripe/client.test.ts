/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStoredReferral,
  hasStoredReferral,
  storeReferral,
  clearStoredReferral,
  enrichClientCheckout,
} from "./client";

describe("Stripe Client Utilities", () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Clear cookies
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name) {
        document.cookie = `${name}=; path=/; max-age=0`;
      }
    });
  });

  describe("storeReferral", () => {
    it("stores affiliateCode in localStorage", () => {
      storeReferral({ affiliateCode: "PARTNER20" });

      expect(localStorage.getItem("affiliate_code")).toBe("PARTNER20");
    });

    it("stores referralId in localStorage", () => {
      storeReferral({ referralId: "ref_123" });

      expect(localStorage.getItem("affiliate_referral_id")).toBe("ref_123");
    });

    it("stores subId in localStorage", () => {
      storeReferral({ affiliateCode: "CODE", subId: "campaign-1" });

      expect(localStorage.getItem("affiliate_sub_id")).toBe("campaign-1");
    });

    it("stores detectedAt timestamp", () => {
      const before = Date.now();
      storeReferral({ affiliateCode: "CODE" });
      const after = Date.now();

      const stored = parseInt(localStorage.getItem("affiliate_detected_at")!, 10);
      expect(stored).toBeGreaterThanOrEqual(before);
      expect(stored).toBeLessThanOrEqual(after);
    });

    it("stores data in cookies", () => {
      storeReferral({ affiliateCode: "PARTNER20", referralId: "ref_123" });

      expect(document.cookie).toContain("affiliate_code=PARTNER20");
      expect(document.cookie).toContain("affiliate_referral_id=ref_123");
    });

    it("uses custom storage keys", () => {
      storeReferral(
        { affiliateCode: "CODE", referralId: "ref_123" },
        {
          affiliateCodeKey: "custom_code_key",
          referralIdKey: "custom_ref_key",
          affiliateCodeCookieName: "custom_code_cookie",
          referralIdCookieName: "custom_ref_cookie",
        }
      );

      expect(localStorage.getItem("custom_code_key")).toBe("CODE");
      expect(localStorage.getItem("custom_ref_key")).toBe("ref_123");
      expect(document.cookie).toContain("custom_code_cookie=CODE");
      expect(document.cookie).toContain("custom_ref_cookie=ref_123");
    });

    it("encodes special characters in cookies", () => {
      storeReferral({ affiliateCode: "CODE=WITH&SPECIAL" });

      // Should be URL encoded
      expect(document.cookie).toContain("affiliate_code=CODE%3DWITH%26SPECIAL");
    });
  });

  describe("getStoredReferral", () => {
    it("returns null when no referral is stored", () => {
      const result = getStoredReferral();

      expect(result).toBeNull();
    });

    it("reads affiliateCode from localStorage", () => {
      localStorage.setItem("affiliate_code", "PARTNER20");

      const result = getStoredReferral();

      expect(result).not.toBeNull();
      expect(result!.affiliateCode).toBe("PARTNER20");
    });

    it("reads referralId from localStorage", () => {
      localStorage.setItem("affiliate_referral_id", "ref_123");

      const result = getStoredReferral();

      expect(result).not.toBeNull();
      expect(result!.referralId).toBe("ref_123");
    });

    it("reads subId from localStorage", () => {
      localStorage.setItem("affiliate_code", "CODE");
      localStorage.setItem("affiliate_sub_id", "campaign-1");

      const result = getStoredReferral();

      expect(result!.subId).toBe("campaign-1");
    });

    it("reads detectedAt from localStorage", () => {
      const timestamp = Date.now();
      localStorage.setItem("affiliate_code", "CODE");
      localStorage.setItem("affiliate_detected_at", timestamp.toString());

      const result = getStoredReferral();

      expect(result!.detectedAt).toBe(timestamp);
    });

    it("falls back to cookies when localStorage is empty", () => {
      document.cookie = "affiliate_code=COOKIE_CODE; path=/";
      document.cookie = "affiliate_referral_id=cookie_ref; path=/";

      const result = getStoredReferral();

      expect(result).not.toBeNull();
      expect(result!.affiliateCode).toBe("COOKIE_CODE");
      expect(result!.referralId).toBe("cookie_ref");
    });

    it("prefers localStorage over cookies", () => {
      localStorage.setItem("affiliate_code", "LOCAL_CODE");
      document.cookie = "affiliate_code=COOKIE_CODE; path=/";

      const result = getStoredReferral();

      expect(result!.affiliateCode).toBe("LOCAL_CODE");
    });

    it("uses custom storage keys", () => {
      localStorage.setItem("my_code", "CUSTOM");

      const result = getStoredReferral({ affiliateCodeKey: "my_code" });

      expect(result!.affiliateCode).toBe("CUSTOM");
    });

    it("decodes URL-encoded cookie values", () => {
      document.cookie = "affiliate_code=CODE%3DWITH%26SPECIAL; path=/";

      const result = getStoredReferral();

      expect(result!.affiliateCode).toBe("CODE=WITH&SPECIAL");
    });
  });

  describe("hasStoredReferral", () => {
    it("returns false when no referral is stored", () => {
      expect(hasStoredReferral()).toBe(false);
    });

    it("returns true when affiliateCode is stored", () => {
      localStorage.setItem("affiliate_code", "CODE");

      expect(hasStoredReferral()).toBe(true);
    });

    it("returns true when referralId is stored", () => {
      localStorage.setItem("affiliate_referral_id", "ref_123");

      expect(hasStoredReferral()).toBe(true);
    });

    it("returns true when both are stored", () => {
      localStorage.setItem("affiliate_code", "CODE");
      localStorage.setItem("affiliate_referral_id", "ref_123");

      expect(hasStoredReferral()).toBe(true);
    });
  });

  describe("clearStoredReferral", () => {
    it("clears localStorage items", () => {
      localStorage.setItem("affiliate_code", "CODE");
      localStorage.setItem("affiliate_referral_id", "ref_123");
      localStorage.setItem("affiliate_sub_id", "sub");
      localStorage.setItem("affiliate_detected_at", "123456");

      clearStoredReferral();

      expect(localStorage.getItem("affiliate_code")).toBeNull();
      expect(localStorage.getItem("affiliate_referral_id")).toBeNull();
      expect(localStorage.getItem("affiliate_sub_id")).toBeNull();
      expect(localStorage.getItem("affiliate_detected_at")).toBeNull();
    });

    it("clears cookies", () => {
      document.cookie = "affiliate_code=CODE; path=/";
      document.cookie = "affiliate_referral_id=ref_123; path=/";
      document.cookie = "affiliate_sub_id=sub; path=/";

      clearStoredReferral();

      // Cookies should be expired (empty or not present)
      expect(document.cookie).not.toContain("affiliate_code=CODE");
      expect(document.cookie).not.toContain("affiliate_referral_id=ref_123");
    });

    it("uses custom storage keys", () => {
      localStorage.setItem("my_code", "CODE");
      localStorage.setItem("my_ref", "ref_123");

      clearStoredReferral({
        affiliateCodeKey: "my_code",
        referralIdKey: "my_ref",
      });

      expect(localStorage.getItem("my_code")).toBeNull();
      expect(localStorage.getItem("my_ref")).toBeNull();
    });

    it("getStoredReferral returns null after clear", () => {
      storeReferral({ affiliateCode: "CODE", referralId: "ref_123" });
      expect(hasStoredReferral()).toBe(true);

      clearStoredReferral();

      expect(hasStoredReferral()).toBe(false);
      expect(getStoredReferral()).toBeNull();
    });
  });

  describe("enrichClientCheckout", () => {
    it("returns base params when no referral is stored", () => {
      const result = enrichClientCheckout({
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.successUrl).toBe("/success");
      expect(result.cancelUrl).toBe("/cancel");
      expect(result.metadata).toEqual({});
      expect(result.client_reference_id).toBeUndefined();
    });

    it("adds affiliate_code to metadata from storage", () => {
      localStorage.setItem("affiliate_code", "PARTNER20");

      const result = enrichClientCheckout({
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.metadata.affiliate_code).toBe("PARTNER20");
    });

    it("adds referralId as client_reference_id when no userId", () => {
      localStorage.setItem("affiliate_referral_id", "ref_123");

      const result = enrichClientCheckout({
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.client_reference_id).toBe("ref_123");
    });

    it("uses userId as client_reference_id when provided", () => {
      localStorage.setItem("affiliate_referral_id", "ref_123");

      const result = enrichClientCheckout(
        { successUrl: "/success", cancelUrl: "/cancel" },
        { userId: "user_456" }
      );

      expect(result.client_reference_id).toBe("user_456");
    });

    it("preserves existing metadata", () => {
      localStorage.setItem("affiliate_code", "CODE");

      const result = enrichClientCheckout({
        successUrl: "/success",
        cancelUrl: "/cancel",
        metadata: { custom_field: "value" },
      });

      expect(result.metadata.custom_field).toBe("value");
      expect(result.metadata.affiliate_code).toBe("CODE");
    });

    it("preserves additional params", () => {
      const result = enrichClientCheckout({
        successUrl: "/success",
        cancelUrl: "/cancel",
        priceId: "price_123",
        quantity: 2,
      });

      expect(result.priceId).toBe("price_123");
      expect(result.quantity).toBe(2);
    });

    it("uses custom storage config", () => {
      localStorage.setItem("my_affiliate_code", "CUSTOM_CODE");

      const result = enrichClientCheckout(
        { successUrl: "/success", cancelUrl: "/cancel" },
        { config: { affiliateCodeKey: "my_affiliate_code" } }
      );

      expect(result.metadata.affiliate_code).toBe("CUSTOM_CODE");
    });

    it("handles both affiliateCode and referralId", () => {
      localStorage.setItem("affiliate_code", "PARTNER");
      localStorage.setItem("affiliate_referral_id", "ref_789");

      const result = enrichClientCheckout({
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.metadata.affiliate_code).toBe("PARTNER");
      expect(result.client_reference_id).toBe("ref_789");
    });
  });

  describe("integration: store and retrieve flow", () => {
    it("full flow: store, check, retrieve, enrich, clear", () => {
      // Initially no referral
      expect(hasStoredReferral()).toBe(false);

      // Store referral from URL param simulation
      storeReferral({
        affiliateCode: "INFLUENCER50",
        referralId: "ref_abc",
        subId: "instagram",
      });

      // Check it exists
      expect(hasStoredReferral()).toBe(true);

      // Retrieve full data
      const referral = getStoredReferral();
      expect(referral).toEqual({
        affiliateCode: "INFLUENCER50",
        referralId: "ref_abc",
        subId: "instagram",
        detectedAt: expect.any(Number),
      });

      // Enrich checkout params
      const checkoutParams = enrichClientCheckout({
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      expect(checkoutParams.metadata.affiliate_code).toBe("INFLUENCER50");
      expect(checkoutParams.client_reference_id).toBe("ref_abc");

      // Clear after purchase
      clearStoredReferral();

      // Verify cleared
      expect(hasStoredReferral()).toBe(false);
      expect(getStoredReferral()).toBeNull();
    });
  });
});
