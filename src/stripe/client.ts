/**
 * Stripe Client Utilities for Convex Affiliates
 *
 * These utilities are for client-side referral tracking WITHOUT Better Auth.
 *
 * ## If you're using Better Auth:
 * You DON'T need these utilities. Better Auth's affiliate plugin automatically:
 * - Stores referral data when user visits with `?ref=CODE`
 * - Links the referral to the user on signup
 * - The server-side `getAffiliateMetadata()` handles checkout
 *
 * ## If you're NOT using Better Auth:
 * Use these utilities to manually track referrals on the client side.
 *
 * @example
 * ```typescript
 * // Without Better Auth - manual tracking
 * import { storeReferral, getStoredReferral } from "convex-affiliates/stripe/client";
 *
 * // On page load with ?ref=CODE
 * const params = new URLSearchParams(location.search);
 * const code = params.get("ref");
 * if (code) {
 *   storeReferral({ affiliateCode: code });
 * }
 *
 * // On checkout - pass the code to your backend
 * const referral = getStoredReferral();
 * await createCheckout({
 *   priceId: "price_xxx",
 *   affiliateCode: referral?.affiliateCode,
 * });
 * ```
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Stored referral data
 */
export interface StoredReferral {
  referralId?: string;
  affiliateCode?: string;
  subId?: string;
  detectedAt?: number;
}

/**
 * Configuration for storage access
 */
export interface StorageConfig {
  /**
   * localStorage key for referral ID
   * @default "affiliate_referral_id"
   */
  referralIdKey?: string;

  /**
   * localStorage key for affiliate code
   * @default "affiliate_code"
   */
  affiliateCodeKey?: string;

  /**
   * Cookie name for referral ID
   * @default "affiliate_referral_id"
   */
  referralIdCookieName?: string;

  /**
   * Cookie name for affiliate code
   * @default "affiliate_code"
   */
  affiliateCodeCookieName?: string;
}

// =============================================================================
// Storage Access
// =============================================================================

const DEFAULT_CONFIG: Required<StorageConfig> = {
  referralIdKey: "affiliate_referral_id",
  affiliateCodeKey: "affiliate_code",
  referralIdCookieName: "affiliate_referral_id",
  affiliateCodeCookieName: "affiliate_code",
};

/**
 * Get stored referral data from localStorage and cookies.
 *
 * @param config - Optional storage configuration
 * @returns Stored referral or null if not found
 *
 * @example
 * ```typescript
 * const referral = getStoredReferral();
 * if (referral?.affiliateCode) {
 *   console.log(`Referred by: ${referral.affiliateCode}`);
 * }
 * ```
 */
export function getStoredReferral(config: StorageConfig = {}): StoredReferral | null {
  if (typeof window === "undefined") return null;

  const opts = { ...DEFAULT_CONFIG, ...config };
  let referralId: string | undefined;
  let affiliateCode: string | undefined;
  let subId: string | undefined;
  let detectedAt: number | undefined;

  // Try localStorage first
  try {
    referralId = localStorage.getItem(opts.referralIdKey) ?? undefined;
    affiliateCode = localStorage.getItem(opts.affiliateCodeKey) ?? undefined;
    subId = localStorage.getItem("affiliate_sub_id") ?? undefined;
    const storedTime = localStorage.getItem("affiliate_detected_at");
    detectedAt = storedTime ? parseInt(storedTime, 10) : undefined;
  } catch {
    // localStorage not available
  }

  // Try cookies as fallback
  if (!referralId && !affiliateCode) {
    const cookies = parseCookies(document.cookie);
    referralId = cookies[opts.referralIdCookieName];
    affiliateCode = cookies[opts.affiliateCodeCookieName];
    subId = subId ?? cookies["affiliate_sub_id"];
  }

  if (!referralId && !affiliateCode) {
    return null;
  }

  return { referralId, affiliateCode, subId, detectedAt };
}

/**
 * Check if there's an active referral stored.
 *
 * @param config - Optional storage configuration
 * @returns true if referral data is found
 *
 * @example
 * ```typescript
 * if (hasStoredReferral()) {
 *   // Show "Referred by partner" badge
 * }
 * ```
 */
export function hasStoredReferral(config: StorageConfig = {}): boolean {
  const referral = getStoredReferral(config);
  return !!(referral?.referralId || referral?.affiliateCode);
}

/**
 * Store referral data manually.
 *
 * Note: If using Better Auth, you don't need this - the affiliate
 * client plugin handles storage automatically.
 *
 * @param data - Referral data to store
 * @param config - Optional storage configuration
 *
 * @example
 * ```typescript
 * // Store referral from URL params
 * const params = new URLSearchParams(window.location.search);
 * const code = params.get("ref");
 * if (code) {
 *   storeReferral({ affiliateCode: code });
 * }
 * ```
 */
export function storeReferral(
  data: Partial<StoredReferral>,
  config: StorageConfig = {}
): void {
  if (typeof window === "undefined") return;

  const opts = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  // Store in localStorage
  try {
    if (data.referralId) {
      localStorage.setItem(opts.referralIdKey, data.referralId);
    }
    if (data.affiliateCode) {
      localStorage.setItem(opts.affiliateCodeKey, data.affiliateCode);
    }
    if (data.subId) {
      localStorage.setItem("affiliate_sub_id", data.subId);
    }
    localStorage.setItem("affiliate_detected_at", now.toString());
  } catch {
    // localStorage not available
  }

  // Also store in cookies for cross-page access
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  const isSecure = window.location.protocol === "https:";
  const cookieOptions = `path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? "; Secure" : ""}`;

  if (data.referralId) {
    document.cookie = `${opts.referralIdCookieName}=${encodeURIComponent(data.referralId)}; ${cookieOptions}`;
  }
  if (data.affiliateCode) {
    document.cookie = `${opts.affiliateCodeCookieName}=${encodeURIComponent(data.affiliateCode)}; ${cookieOptions}`;
  }
  if (data.subId) {
    document.cookie = `affiliate_sub_id=${encodeURIComponent(data.subId)}; ${cookieOptions}`;
  }
}

/**
 * Clear stored referral data.
 *
 * @param config - Optional storage configuration
 *
 * @example
 * ```typescript
 * // Clear after successful purchase
 * clearStoredReferral();
 * ```
 */
export function clearStoredReferral(config: StorageConfig = {}): void {
  if (typeof window === "undefined") return;

  const opts = { ...DEFAULT_CONFIG, ...config };

  // Clear localStorage
  try {
    localStorage.removeItem(opts.referralIdKey);
    localStorage.removeItem(opts.affiliateCodeKey);
    localStorage.removeItem("affiliate_sub_id");
    localStorage.removeItem("affiliate_detected_at");
  } catch {
    // localStorage not available
  }

  // Clear cookies
  document.cookie = `${opts.referralIdCookieName}=; path=/; max-age=0`;
  document.cookie = `${opts.affiliateCodeCookieName}=; path=/; max-age=0`;
  document.cookie = `affiliate_sub_id=; path=/; max-age=0`;
}

// =============================================================================
// Helpers
// =============================================================================

function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieString.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      const value = valueParts.join("=");
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }
  });

  return cookies;
}
