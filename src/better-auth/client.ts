/**
 * Better Auth Client Plugin for Convex Affiliates
 *
 * This plugin automatically handles referral tracking on the client side.
 * It stores referral data and includes it with signup requests so the server
 * plugin can attribute signups to affiliates.
 *
 * @example
 * ```typescript
 * // lib/auth-client.ts
 * import { createAuthClient } from "better-auth/client";
 * import { affiliateClientPlugin } from "convex-affiliates/better-auth/client";
 *
 * export const authClient = createAuthClient({
 *   plugins: [
 *     affiliateClientPlugin({
 *       storage: "both", // localStorage + cookie for SSR support
 *       cookieDurationDays: 30,
 *       paramName: "ref",
 *     }),
 *   ],
 * });
 * ```
 *
 * @module
 */

import type { BetterAuthClientPlugin } from "better-auth/client";

// =============================================================================
// Types
// =============================================================================

/**
 * Storage strategy for referral data
 */
export type StorageStrategy = "localStorage" | "cookie" | "both";

/**
 * Configuration for the affiliate client plugin
 */
export interface AffiliateClientPluginConfig {
  /**
   * Where to store referral data.
   * - "localStorage": Browser localStorage only (not available in SSR)
   * - "cookie": Cookies only (available in SSR)
   * - "both": Both localStorage and cookies (recommended)
   * @default "both"
   */
  storage?: StorageStrategy;

  /**
   * Cookie/storage duration in days.
   * @default 30
   */
  cookieDurationDays?: number;

  /**
   * URL parameter name for affiliate code.
   * @default "ref"
   */
  paramName?: string;

  /**
   * URL parameter name for sub-tracking ID.
   * @default "sub"
   */
  subIdParamName?: string;

  /**
   * localStorage key for referral ID.
   * @default "affiliate_referral_id"
   */
  referralIdKey?: string;

  /**
   * localStorage key for affiliate code.
   * @default "affiliate_code"
   */
  affiliateCodeKey?: string;

  /**
   * Cookie name for referral ID.
   * @default "affiliate_referral_id"
   */
  referralIdCookieName?: string;

  /**
   * Cookie name for affiliate code.
   * @default "affiliate_code"
   */
  affiliateCodeCookieName?: string;

  /**
   * Field name in signup body for referral ID.
   * @default "referralId"
   */
  referralIdFieldName?: string;

  /**
   * Field name in signup body for affiliate code.
   * @default "referralCode"
   */
  referralCodeFieldName?: string;

  /**
   * Whether to automatically track referrals on page load.
   * If true, will check URL params and store referral data.
   * @default true
   */
  autoTrack?: boolean;

  /**
   * Whether to clear referral data after successful signup.
   * @default true
   */
  clearOnSignup?: boolean;

  /**
   * Optional callback to track clicks with your backend.
   * Called when a referral is detected from URL params.
   *
   * @example
   * ```typescript
   * onReferralDetected: async (code, subId) => {
   *   const { referralId } = await trackClick({
   *     affiliateCode: code,
   *     landingPage: window.location.pathname,
   *   });
   *   return referralId; // Will be stored
   * }
   * ```
   */
  onReferralDetected?: (
    affiliateCode: string,
    subId?: string
  ) => Promise<string | void>;

  /**
   * Optional callback when referral data is cleared after signup.
   */
  onReferralCleared?: () => void;
}

/**
 * Stored referral data
 */
export interface StoredReferral {
  referralId?: string;
  affiliateCode?: string;
  subId?: string;
  detectedAt: number;
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Better Auth client plugin for affiliate tracking.
 *
 * This plugin:
 * 1. Detects referral codes from URL parameters
 * 2. Stores referral data in localStorage/cookies
 * 3. Automatically includes referral data in signup requests
 * 4. Optionally clears referral data after successful signup
 *
 * @param config - Plugin configuration
 * @returns Better Auth client plugin
 *
 * @example
 * ```typescript
 * import { createAuthClient } from "better-auth/client";
 * import { affiliateClientPlugin } from "convex-affiliates/better-auth/client";
 *
 * export const authClient = createAuthClient({
 *   plugins: [
 *     affiliateClientPlugin({
 *       storage: "both",
 *       cookieDurationDays: 30,
 *       onReferralDetected: async (code) => {
 *         // Call your backend to track the click
 *         const result = await trackClick({ affiliateCode: code });
 *         return result.referralId;
 *       },
 *     }),
 *   ],
 * });
 *
 * // Referral data is automatically included in signup:
 * await authClient.signUp.email({
 *   email: "user@example.com",
 *   password: "password123",
 *   // referralId and referralCode are auto-added by the plugin!
 * });
 * ```
 */
export const affiliateClientPlugin = (
  config: AffiliateClientPluginConfig = {}
): BetterAuthClientPlugin => {
  // Merge defaults
  const options = {
    storage: config.storage ?? "both",
    cookieDurationDays: config.cookieDurationDays ?? 30,
    paramName: config.paramName ?? "ref",
    subIdParamName: config.subIdParamName ?? "sub",
    referralIdKey: config.referralIdKey ?? "affiliate_referral_id",
    affiliateCodeKey: config.affiliateCodeKey ?? "affiliate_code",
    referralIdCookieName: config.referralIdCookieName ?? "affiliate_referral_id",
    affiliateCodeCookieName:
      config.affiliateCodeCookieName ?? "affiliate_code",
    referralIdFieldName: config.referralIdFieldName ?? "referralId",
    referralCodeFieldName: config.referralCodeFieldName ?? "referralCode",
    autoTrack: config.autoTrack ?? true,
    clearOnSignup: config.clearOnSignup ?? true,
    onReferralDetected: config.onReferralDetected,
    onReferralCleared: config.onReferralCleared,
  };

  // Helper to check if we're in browser
  const isBrowser = () => typeof window !== "undefined";

  // Storage helpers
  const storage = {
    get(): StoredReferral | null {
      if (!isBrowser()) return null;

      let referralId: string | undefined;
      let affiliateCode: string | undefined;
      let subId: string | undefined;
      let detectedAt: number | undefined;

      // Try localStorage first
      if (
        options.storage === "localStorage" ||
        options.storage === "both"
      ) {
        try {
          referralId =
            localStorage.getItem(options.referralIdKey) ?? undefined;
          affiliateCode =
            localStorage.getItem(options.affiliateCodeKey) ?? undefined;
          subId = localStorage.getItem("affiliate_sub_id") ?? undefined;
          const storedTime = localStorage.getItem("affiliate_detected_at");
          detectedAt = storedTime ? parseInt(storedTime, 10) : undefined;
        } catch {
          // localStorage not available
        }
      }

      // Try cookies as fallback
      if (
        (!referralId && !affiliateCode) &&
        (options.storage === "cookie" || options.storage === "both")
      ) {
        const cookies = parseCookies(document.cookie);
        referralId = referralId ?? cookies[options.referralIdCookieName];
        affiliateCode = affiliateCode ?? cookies[options.affiliateCodeCookieName];
      }

      if (!referralId && !affiliateCode) {
        return null;
      }

      return {
        referralId,
        affiliateCode,
        subId,
        detectedAt: detectedAt ?? Date.now(),
      };
    },

    set(data: Partial<StoredReferral>): void {
      if (!isBrowser()) return;

      const now = Date.now();
      const maxAge = options.cookieDurationDays * 24 * 60 * 60;

      // Store in localStorage
      if (
        options.storage === "localStorage" ||
        options.storage === "both"
      ) {
        try {
          if (data.referralId) {
            localStorage.setItem(options.referralIdKey, data.referralId);
          }
          if (data.affiliateCode) {
            localStorage.setItem(options.affiliateCodeKey, data.affiliateCode);
          }
          if (data.subId) {
            localStorage.setItem("affiliate_sub_id", data.subId);
          }
          localStorage.setItem("affiliate_detected_at", now.toString());
        } catch {
          // localStorage not available
        }
      }

      // Store in cookies
      if (options.storage === "cookie" || options.storage === "both") {
        const cookieOptions = `path=/; max-age=${maxAge}; SameSite=Lax`;

        if (data.referralId) {
          document.cookie = `${options.referralIdCookieName}=${data.referralId}; ${cookieOptions}`;
        }
        if (data.affiliateCode) {
          document.cookie = `${options.affiliateCodeCookieName}=${data.affiliateCode}; ${cookieOptions}`;
        }
      }
    },

    clear(): void {
      if (!isBrowser()) return;

      // Clear localStorage
      if (
        options.storage === "localStorage" ||
        options.storage === "both"
      ) {
        try {
          localStorage.removeItem(options.referralIdKey);
          localStorage.removeItem(options.affiliateCodeKey);
          localStorage.removeItem("affiliate_sub_id");
          localStorage.removeItem("affiliate_detected_at");
        } catch {
          // localStorage not available
        }
      }

      // Clear cookies
      if (options.storage === "cookie" || options.storage === "both") {
        document.cookie = `${options.referralIdCookieName}=; path=/; max-age=0`;
        document.cookie = `${options.affiliateCodeCookieName}=; path=/; max-age=0`;
      }

      options.onReferralCleared?.();
    },
  };

  // Auto-track on initialization
  if (options.autoTrack && isBrowser()) {
    // Use setTimeout to ensure this runs after page load
    setTimeout(async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get(options.paramName);
      const subId = params.get(options.subIdParamName) ?? undefined;

      if (code) {
        // Check if we already have this referral stored
        const existing = storage.get();
        if (existing?.affiliateCode === code) {
          // Already tracking this affiliate
          return;
        }

        // Store the affiliate code
        storage.set({ affiliateCode: code, subId });

        // Call the tracking callback if provided
        if (options.onReferralDetected) {
          try {
            const referralId = await options.onReferralDetected(code, subId);
            if (referralId) {
              storage.set({ referralId });
            }
          } catch (error) {
            console.error(
              "[convex-affiliates] Error tracking referral:",
              error
            );
          }
        }
      }
    }, 0);
  }

  return {
    id: "convex-affiliates",

    // Inject referral data into signup requests via Better Fetch plugin
    fetchPlugins: [
      {
        id: "convex-affiliates-inject",
        name: "Convex Affiliates Data Injector",
        hooks: {
          onRequest: async (context) => {
            // Check if this is a signup request
            const urlStr = context.url.toString();
            const isSignup =
              urlStr.includes("/sign-up/") ||
              urlStr.endsWith("/sign-up");

            if (!isSignup) {
              return context;
            }

            // Get stored referral data
            const referral = storage.get();
            if (!referral?.referralId && !referral?.affiliateCode) {
              return context;
            }

            // Parse existing body
            let body: Record<string, unknown> =
              context.body && typeof context.body === "object"
                ? (context.body as Record<string, unknown>)
                : {};

            // Inject referral data
            if (referral.referralId) {
              body[options.referralIdFieldName] = referral.referralId;
            }
            if (referral.affiliateCode) {
              body[options.referralCodeFieldName] = referral.affiliateCode;
            }

            // Return modified context
            return {
              ...context,
              body,
            };
          },

          onSuccess: async (context) => {
            // Check if this was a successful signup
            if (!options.clearOnSignup) {
              return;
            }

            const urlStr = context.request.url.toString();
            const isSignup =
              urlStr.includes("/sign-up/") ||
              urlStr.endsWith("/sign-up");

            if (isSignup) {
              // Clear referral data after successful signup
              storage.clear();
            }
          },
        },
      },
    ],

    // Provide actions for manual control
    getActions: () => ({
      /**
       * Get the currently stored referral data.
       *
       * @example
       * ```typescript
       * const referral = authClient.affiliate.getStoredReferral();
       * if (referral) {
       *   console.log(`Referred by: ${referral.affiliateCode}`);
       * }
       * ```
       */
      getStoredReferral: (): StoredReferral | null => {
        return storage.get();
      },

      /**
       * Manually store referral data.
       * Useful when you want to track referrals from non-URL sources.
       *
       * @example
       * ```typescript
       * authClient.affiliate.storeReferral({
       *   affiliateCode: "PARTNER20",
       *   referralId: "abc123",
       * });
       * ```
       */
      storeReferral: (data: Partial<StoredReferral>): void => {
        storage.set(data);
      },

      /**
       * Clear stored referral data.
       *
       * @example
       * ```typescript
       * authClient.affiliate.clearReferral();
       * ```
       */
      clearReferral: (): void => {
        storage.clear();
      },

      /**
       * Check if there's an active referral.
       *
       * @example
       * ```typescript
       * if (authClient.affiliate.hasReferral()) {
       *   // Show "Referred by partner" badge
       * }
       * ```
       */
      hasReferral: (): boolean => {
        const referral = storage.get();
        return !!(referral?.referralId || referral?.affiliateCode);
      },

      /**
       * Track a referral click manually.
       * Stores the code and optionally calls onReferralDetected.
       *
       * @example
       * ```typescript
       * // From a partner link click
       * await authClient.affiliate.trackReferral("PARTNER20");
       * ```
       */
      trackReferral: async (
        affiliateCode: string,
        subId?: string
      ): Promise<string | undefined> => {
        storage.set({ affiliateCode, subId });

        if (options.onReferralDetected) {
          try {
            const referralId = await options.onReferralDetected(
              affiliateCode,
              subId
            );
            if (referralId) {
              storage.set({ referralId });
              return referralId;
            }
          } catch (error) {
            console.error(
              "[convex-affiliates] Error tracking referral:",
              error
            );
          }
        }

        return undefined;
      },
    }),
  } satisfies BetterAuthClientPlugin;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse cookies from a cookie string
 */
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieString.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      cookies[name] = valueParts.join("=");
    }
  });

  return cookies;
}

// =============================================================================
// Standalone Utilities
// =============================================================================

/**
 * Extract referral params from URL.
 * Useful for custom tracking implementations.
 *
 * @example
 * ```typescript
 * const { code, subId } = extractReferralParams(window.location.search);
 * if (code) {
 *   await trackClick({ affiliateCode: code });
 * }
 * ```
 */
export function extractReferralParams(
  searchString: string,
  paramName = "ref",
  subIdParamName = "sub"
): { code?: string; subId?: string } {
  const params = new URLSearchParams(searchString);
  return {
    code: params.get(paramName) ?? undefined,
    subId: params.get(subIdParamName) ?? undefined,
  };
}

/**
 * Create a referral URL with affiliate code.
 *
 * @example
 * ```typescript
 * const url = createReferralUrl("https://example.com/pricing", "PARTNER20");
 * // Returns: "https://example.com/pricing?ref=PARTNER20"
 * ```
 */
export function createReferralUrl(
  baseUrl: string,
  affiliateCode: string,
  subId?: string,
  paramName = "ref",
  subIdParamName = "sub"
): string {
  const url = new URL(baseUrl);
  url.searchParams.set(paramName, affiliateCode);
  if (subId) {
    url.searchParams.set(subIdParamName, subId);
  }
  return url.toString();
}

// =============================================================================
// Exports
// =============================================================================

export type { BetterAuthClientPlugin };
