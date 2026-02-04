import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStoredReferral,
  hasStoredReferral,
  storeReferral,
  clearStoredReferral,
} from "./client";

// Mock browser globals manually for cross-environment compatibility
function createMockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  };
}

function createMockDocument() {
  let cookieString = "";
  return {
    get cookie() {
      return cookieString;
    },
    set cookie(value: string) {
      // Parse and handle cookie setting
      const [nameValue] = value.split(";");
      const [name, val] = nameValue.split("=");
      if (val === "" || value.includes("max-age=0")) {
        // Remove cookie
        const cookies = cookieString.split("; ").filter((c) => c && !c.startsWith(name + "="));
        cookieString = cookies.join("; ");
      } else {
        // Add/update cookie
        const cookies = cookieString.split("; ").filter((c) => c && !c.startsWith(name + "="));
        cookies.push(`${name}=${val}`);
        cookieString = cookies.join("; ");
      }
    },
    _setCookieString(value: string) {
      cookieString = value;
    },
    _clearCookies() {
      cookieString = "";
    },
  };
}

describe("Stripe Client Utilities", () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;
  let mockDocument: ReturnType<typeof createMockDocument>;
  let originalWindow: typeof globalThis.window;
  let originalDocument: typeof globalThis.document;
  let originalLocalStorage: typeof globalThis.localStorage;

  beforeEach(() => {
    // Save originals
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalLocalStorage = (globalThis as any).localStorage;

    // Create mocks
    mockLocalStorage = createMockLocalStorage();
    mockDocument = createMockDocument();

    // Set up global mocks
    (globalThis as any).window = {
      location: { protocol: "https:" },
    };
    (globalThis as any).document = mockDocument;
    (globalThis as any).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    // Restore originals
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      (globalThis as any).document = originalDocument;
    }
    if (originalLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = originalLocalStorage;
    }
  });

  describe("storeReferral", () => {
    it("stores affiliateCode in localStorage", () => {
      storeReferral({ affiliateCode: "PARTNER20" });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("affiliate_code", "PARTNER20");
    });

    it("stores referralId in localStorage", () => {
      storeReferral({ referralId: "ref_123" });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("affiliate_referral_id", "ref_123");
    });

    it("stores subId in localStorage", () => {
      storeReferral({ affiliateCode: "CODE", subId: "campaign-1" });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("affiliate_sub_id", "campaign-1");
    });

    it("stores detectedAt timestamp", () => {
      const before = Date.now();
      storeReferral({ affiliateCode: "CODE" });

      // Check that setItem was called with a timestamp
      const calls = mockLocalStorage.setItem.mock.calls;
      const timestampCall = calls.find((c) => c[0] === "affiliate_detected_at");
      expect(timestampCall).toBeDefined();
      const storedTime = parseInt(timestampCall![1], 10);
      expect(storedTime).toBeGreaterThanOrEqual(before);
      expect(storedTime).toBeLessThanOrEqual(Date.now());
    });

    it("stores data in cookies", () => {
      storeReferral({ affiliateCode: "PARTNER20", referralId: "ref_123" });

      expect(mockDocument.cookie).toContain("affiliate_code=PARTNER20");
      expect(mockDocument.cookie).toContain("affiliate_referral_id=ref_123");
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

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("custom_code_key", "CODE");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("custom_ref_key", "ref_123");
      expect(mockDocument.cookie).toContain("custom_code_cookie=CODE");
      expect(mockDocument.cookie).toContain("custom_ref_cookie=ref_123");
    });

    it("encodes special characters in cookies", () => {
      storeReferral({ affiliateCode: "CODE=WITH&SPECIAL" });

      // Should be URL encoded
      expect(mockDocument.cookie).toContain("affiliate_code=CODE%3DWITH%26SPECIAL");
    });
  });

  describe("getStoredReferral", () => {
    it("returns null when no referral is stored", () => {
      const result = getStoredReferral();

      expect(result).toBeNull();
    });

    it("reads affiliateCode from localStorage", () => {
      mockLocalStorage._store["affiliate_code"] = "PARTNER20";

      const result = getStoredReferral();

      expect(result).not.toBeNull();
      expect(result!.affiliateCode).toBe("PARTNER20");
    });

    it("reads referralId from localStorage", () => {
      mockLocalStorage._store["affiliate_referral_id"] = "ref_123";

      const result = getStoredReferral();

      expect(result).not.toBeNull();
      expect(result!.referralId).toBe("ref_123");
    });

    it("reads subId from localStorage", () => {
      mockLocalStorage._store["affiliate_code"] = "CODE";
      mockLocalStorage._store["affiliate_sub_id"] = "campaign-1";

      const result = getStoredReferral();

      expect(result!.subId).toBe("campaign-1");
    });

    it("reads detectedAt from localStorage", () => {
      const timestamp = Date.now();
      mockLocalStorage._store["affiliate_code"] = "CODE";
      mockLocalStorage._store["affiliate_detected_at"] = timestamp.toString();

      const result = getStoredReferral();

      expect(result!.detectedAt).toBe(timestamp);
    });

    it("falls back to cookies when localStorage is empty", () => {
      mockDocument._setCookieString("affiliate_code=COOKIE_CODE; affiliate_referral_id=cookie_ref");

      const result = getStoredReferral();

      expect(result).not.toBeNull();
      expect(result!.affiliateCode).toBe("COOKIE_CODE");
      expect(result!.referralId).toBe("cookie_ref");
    });

    it("prefers localStorage over cookies", () => {
      mockLocalStorage._store["affiliate_code"] = "LOCAL_CODE";
      mockDocument._setCookieString("affiliate_code=COOKIE_CODE");

      const result = getStoredReferral();

      expect(result!.affiliateCode).toBe("LOCAL_CODE");
    });

    it("uses custom storage keys", () => {
      mockLocalStorage._store["my_code"] = "CUSTOM";

      const result = getStoredReferral({ affiliateCodeKey: "my_code" });

      expect(result!.affiliateCode).toBe("CUSTOM");
    });

    it("decodes URL-encoded cookie values", () => {
      mockDocument._setCookieString("affiliate_code=CODE%3DWITH%26SPECIAL");

      const result = getStoredReferral();

      expect(result!.affiliateCode).toBe("CODE=WITH&SPECIAL");
    });
  });

  describe("hasStoredReferral", () => {
    it("returns false when no referral is stored", () => {
      expect(hasStoredReferral()).toBe(false);
    });

    it("returns true when affiliateCode is stored", () => {
      mockLocalStorage._store["affiliate_code"] = "CODE";

      expect(hasStoredReferral()).toBe(true);
    });

    it("returns true when referralId is stored", () => {
      mockLocalStorage._store["affiliate_referral_id"] = "ref_123";

      expect(hasStoredReferral()).toBe(true);
    });

    it("returns true when both are stored", () => {
      mockLocalStorage._store["affiliate_code"] = "CODE";
      mockLocalStorage._store["affiliate_referral_id"] = "ref_123";

      expect(hasStoredReferral()).toBe(true);
    });
  });

  describe("clearStoredReferral", () => {
    it("clears localStorage items", () => {
      mockLocalStorage._store["affiliate_code"] = "CODE";
      mockLocalStorage._store["affiliate_referral_id"] = "ref_123";
      mockLocalStorage._store["affiliate_sub_id"] = "sub";
      mockLocalStorage._store["affiliate_detected_at"] = "123456";

      clearStoredReferral();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("affiliate_code");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("affiliate_referral_id");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("affiliate_sub_id");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("affiliate_detected_at");
    });

    it("expires cookies", () => {
      mockDocument._setCookieString("affiliate_code=CODE; affiliate_referral_id=ref_123");

      clearStoredReferral();

      // Cookies should be cleared by the mock
      expect(mockDocument.cookie).not.toContain("affiliate_code=CODE");
    });

    it("uses custom storage keys", () => {
      mockLocalStorage._store["my_code"] = "CODE";
      mockLocalStorage._store["my_ref"] = "ref_123";

      clearStoredReferral({
        affiliateCodeKey: "my_code",
        referralIdKey: "my_ref",
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("my_code");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("my_ref");
    });
  });

  describe("SSR handling", () => {
    it("getStoredReferral returns null when window is undefined", () => {
      delete (globalThis as any).window;

      const result = getStoredReferral();

      expect(result).toBeNull();
    });

    it("storeReferral does nothing when window is undefined", () => {
      delete (globalThis as any).window;

      // Should not throw
      expect(() => storeReferral({ affiliateCode: "CODE" })).not.toThrow();
    });

    it("clearStoredReferral does nothing when window is undefined", () => {
      delete (globalThis as any).window;

      // Should not throw
      expect(() => clearStoredReferral()).not.toThrow();
    });

    it("hasStoredReferral returns false when window is undefined", () => {
      delete (globalThis as any).window;

      expect(hasStoredReferral()).toBe(false);
    });
  });
});
