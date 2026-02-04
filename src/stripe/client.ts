/**
 * Stripe Client Utilities for Convex Affiliates
 *
 * Helpers for client-side Stripe integrations. Use these when you need
 * to enrich Stripe checkout on the client side (e.g., with Stripe.js).
 *
 * For most use cases, prefer the server-side `enrichCheckout` function
 * which automatically gets the user's referral from auth context.
 *
 * @example
 * ```typescript
 * // For client-side Stripe checkout (Stripe.js)
 * import { getStoredReferral, enrichClientCheckout } from "convex-affiliates/stripe/client";
 *
 * // Get referral from storage (set by Better Auth client plugin)
 * const referral = getStoredReferral();
 *
 * // Or enrich checkout params directly
 * const params = enrichClientCheckout({
 *   priceId: "price_xxx",
 *   successUrl: "/success",
 *   cancelUrl: "/cancel",
 * });
 * ```
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Stored referral data (compatible with Better Auth client plugin)
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

/**
 * Checkout params for client-side enrichment
 */
export interface ClientCheckoutParams {
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  [key: string]: unknown;
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
 * Compatible with the Better Auth client plugin storage format.
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
// Checkout Enrichment
// =============================================================================

/**
 * Enrich checkout params with stored affiliate data (client-side).
 *
 * Use this for client-side Stripe integrations where you can't use
 * the server-side `enrichCheckout` function.
 *
 * Note: This only adds data from localStorage/cookies. For full
 * attribution including discount coupons, use server-side enrichment.
 *
 * @param params - Base checkout params
 * @param options - Optional configuration
 * @returns Enriched params with affiliate metadata
 *
 * @example
 * ```typescript
 * // With Stripe.js redirectToCheckout
 * import { loadStripe } from "@stripe/stripe-js";
 * import { enrichClientCheckout } from "convex-affiliates/stripe/client";
 *
 * const stripe = await loadStripe("pk_xxx");
 *
 * const params = enrichClientCheckout({
 *   successUrl: window.location.origin + "/success",
 *   cancelUrl: window.location.origin + "/cancel",
 * });
 *
 * // Pass metadata to your backend for checkout session creation
 * const response = await fetch("/api/checkout", {
 *   method: "POST",
 *   body: JSON.stringify({
 *     priceId: "price_xxx",
 *     metadata: params.metadata,
 *     clientReferenceId: params.client_reference_id,
 *   }),
 * });
 * ```
 */
export function enrichClientCheckout<T extends ClientCheckoutParams>(
  params: T,
  options: { userId?: string; config?: StorageConfig } = {}
): T & { client_reference_id?: string; metadata: Record<string, string> } {
  const referral = getStoredReferral(options.config);

  const enriched = {
    ...params,
    metadata: { ...(params.metadata ?? {}) },
  } as T & { client_reference_id?: string; metadata: Record<string, string> };

  // Add client_reference_id if userId provided
  if (options.userId) {
    enriched.client_reference_id = options.userId;
  }

  // Add affiliate data from storage
  if (referral?.affiliateCode) {
    enriched.metadata.affiliate_code = referral.affiliateCode;
  }

  if (referral?.referralId && !enriched.client_reference_id) {
    // Use referralId as client_reference_id if no userId
    enriched.client_reference_id = referral.referralId;
  }

  return enriched;
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
