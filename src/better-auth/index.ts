/**
 * Better Auth Server Plugin for Convex Affiliates
 *
 * This plugin automatically handles affiliate attribution when users sign up
 * through Better Auth. It hooks into the signup flow and calls `attributeSignup`
 * to link new users to their referring affiliates.
 *
 * @example
 * ```typescript
 * // convex/betterAuth/auth.ts
 * import { betterAuth } from "better-auth";
 * import { affiliatePlugin } from "convex-affiliates/better-auth";
 * import { components } from "../_generated/api";
 *
 * export const auth = betterAuth({
 *   database: authComponent.adapter(ctx),
 *   plugins: [
 *     affiliatePlugin({
 *       attributeSignup: async (userId, referralData) => {
 *         await ctx.runMutation(api.affiliates.attributeSignup, {
 *           userId,
 *           referralId: referralData.referralId,
 *           referralCode: referralData.referralCode,
 *         });
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * @module
 */

import type { BetterAuthPlugin, HookEndpointContext } from "better-auth";

// =============================================================================
// Types
// =============================================================================

/**
 * Referral data extracted from signup request
 */
export interface ReferralData {
  /** The stored referral ID from tracking (preferred) */
  referralId?: string;
  /** The affiliate code from URL params */
  referralCode?: string;
}

/**
 * Result of attribution attempt
 */
export interface AttributionResult {
  /** Whether the signup was attributed to an affiliate */
  attributed: boolean;
  /** The affiliate code if attribution succeeded */
  affiliateCode?: string;
}

/**
 * Configuration for the affiliate plugin
 */
export interface AffiliatePluginConfig {
  /**
   * Function to attribute a signup to an affiliate.
   * This is called after a user successfully signs up.
   *
   * @param userId - The ID of the newly created user
   * @param referralData - The referral data from the signup request
   * @returns Attribution result or void
   *
   * @example
   * ```typescript
   * attributeSignup: async (userId, referralData) => {
   *   return await ctx.runMutation(api.affiliates.attributeSignup, {
   *     userId,
   *     referralId: referralData.referralId,
   *     referralCode: referralData.referralCode,
   *   });
   * }
   * ```
   */
  attributeSignup: (
    userId: string,
    referralData: ReferralData
  ) => Promise<AttributionResult | void>;

  /**
   * Optional: Custom field names for referral data in signup body.
   * Defaults to { referralId: "referralId", referralCode: "referralCode" }
   */
  fieldNames?: {
    referralId?: string;
    referralCode?: string;
  };

  /**
   * Optional: Also read referral code from cookies.
   * Cookie name to look for (e.g., "affiliate_code").
   */
  cookieName?: string;

  /**
   * Optional: Also read referral ID from cookies.
   * Cookie name to look for (e.g., "referral_id").
   */
  referralIdCookieName?: string;

  /**
   * Optional: Extend the user schema with a referredBy field.
   * If true, adds a `referredBy` string field to the user table.
   * @default false
   */
  extendUserSchema?: boolean;

  /**
   * Optional: Callback when attribution succeeds
   */
  onAttributionSuccess?: (data: {
    userId: string;
    affiliateCode?: string;
  }) => Promise<void>;

  /**
   * Optional: Callback when attribution fails or no referral data found
   */
  onAttributionFailure?: (data: {
    userId: string;
    reason: string;
  }) => Promise<void>;
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Better Auth plugin for automatic affiliate attribution.
 *
 * This plugin intercepts signup requests and automatically attributes
 * new users to affiliates based on referral data passed in the request body
 * or cookies.
 *
 * @param config - Plugin configuration
 * @returns Better Auth plugin
 *
 * @example
 * ```typescript
 * import { betterAuth } from "better-auth";
 * import { affiliatePlugin } from "convex-affiliates/better-auth";
 *
 * export const auth = betterAuth({
 *   // ... other config
 *   plugins: [
 *     affiliatePlugin({
 *       attributeSignup: async (userId, referralData) => {
 *         // Your attribution logic here
 *         return await attributeSignup({
 *           userId,
 *           referralId: referralData.referralId,
 *           referralCode: referralData.referralCode,
 *         });
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export const affiliatePlugin = (
  config: AffiliatePluginConfig
): BetterAuthPlugin => {
  const fieldNames = {
    referralId: config.fieldNames?.referralId ?? "referralId",
    referralCode: config.fieldNames?.referralCode ?? "referralCode",
  };

  return {
    id: "convex-affiliates",

    // Optionally extend user schema with referredBy field
    schema: config.extendUserSchema
      ? {
          user: {
            fields: {
              referredBy: {
                type: "string",
                required: false,
              },
            },
          },
        }
      : undefined,

    hooks: {
      after: [
        {
          // Match all signup-related endpoints
          matcher: (context: HookEndpointContext) => {
            const path = context.path ?? "";
            return (
              path === "/sign-up/email" ||
              path === "/sign-up/username" ||
              path === "/sign-in/social" || // OAuth can also create new users
              path.startsWith("/sign-up/")
            );
          },
          // Use unknown cast to work around complex AuthMiddleware types
          handler: (async (ctx: unknown) => {
            const hookCtx = ctx as {
              context: {
                returned?: unknown;
                body?: Record<string, unknown>;
                request?: Request;
              };
              body?: Record<string, unknown>;
              headers?: Headers;
            };

            // Only proceed if we have a successful signup (user was created)
            // The response body should contain the user data
            const returned = hookCtx.context?.returned;

            if (!returned || typeof returned !== "object") {
              return;
            }

            // Extract user ID from response
            // Better Auth typically returns { user: { id: "..." }, session: { ... } }
            const responseObj = returned as Record<string, unknown>;
            const user = responseObj.user as { id?: string } | undefined;

            if (!user?.id) {
              // Not a successful signup or user creation
              return;
            }

            const userId = user.id;

            // Extract referral data from request body
            const body = hookCtx.body ?? hookCtx.context?.body;
            let referralId = body?.[fieldNames.referralId] as string | undefined;
            let referralCode = body?.[fieldNames.referralCode] as
              | string
              | undefined;

            // Also check cookies if configured
            if (config.cookieName || config.referralIdCookieName) {
              const cookieHeader =
                hookCtx.headers?.get?.("cookie") ??
                hookCtx.context?.request?.headers?.get?.("cookie");
              if (cookieHeader) {
                const cookies = parseCookies(cookieHeader);

                if (config.referralIdCookieName && !referralId) {
                  referralId = cookies[config.referralIdCookieName];
                }

                if (config.cookieName && !referralCode) {
                  referralCode = cookies[config.cookieName];
                }
              }
            }

            // Skip if no referral data
            if (!referralId && !referralCode) {
              await config.onAttributionFailure?.({
                userId,
                reason: "No referral data found",
              });
              return;
            }

            // Call the attribution function
            try {
              const result = await config.attributeSignup(userId, {
                referralId,
                referralCode,
              });

              if (result?.attributed) {
                await config.onAttributionSuccess?.({
                  userId,
                  affiliateCode: result.affiliateCode,
                });
              } else {
                await config.onAttributionFailure?.({
                  userId,
                  reason: "Attribution returned false",
                });
              }
            } catch (error) {
              console.error("[convex-affiliates] Attribution error:", error);
              await config.onAttributionFailure?.({
                userId,
                reason:
                  error instanceof Error ? error.message : "Unknown error",
              });
            }
          }) as unknown,
        },
      ],
    },
  } as BetterAuthPlugin;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse cookies from a cookie header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      cookies[name] = valueParts.join("=");
    }
  });

  return cookies;
}

// =============================================================================
// Convex-Specific Integration
// =============================================================================

/**
 * Configuration for creating a Convex-integrated affiliate plugin
 */
export interface ConvexAffiliatePluginConfig {
  /**
   * The Convex component API reference.
   * Pass `components.affiliates` from your generated API.
   */
  component: {
    referrals: {
      attributeSignup: unknown;
      attributeSignupByCode: unknown;
      getByReferralId: unknown;
    };
  };

  /**
   * Optional: Custom field names for referral data in signup body.
   */
  fieldNames?: {
    referralId?: string;
    referralCode?: string;
  };

  /**
   * Optional: Cookie name for affiliate code
   */
  cookieName?: string;

  /**
   * Optional: Cookie name for referral ID
   */
  referralIdCookieName?: string;

  /**
   * Optional: Extend user schema with referredBy field
   */
  extendUserSchema?: boolean;

  /**
   * Optional callbacks
   */
  onAttributionSuccess?: (data: {
    userId: string;
    affiliateCode?: string;
  }) => Promise<void>;
  onAttributionFailure?: (data: {
    userId: string;
    reason: string;
  }) => Promise<void>;
}

/**
 * Create a Better Auth plugin pre-configured for Convex.
 *
 * This is a convenience wrapper that sets up the plugin with
 * Convex-specific attribution logic.
 *
 * @param ctx - The Convex context (with runQuery and runMutation)
 * @param config - Plugin configuration
 * @returns Better Auth plugin
 *
 * @example
 * ```typescript
 * // convex/betterAuth/auth.ts
 * import { createConvexAffiliatePlugin } from "convex-affiliates/better-auth";
 * import { components } from "../_generated/api";
 *
 * export const createAuth = (ctx: GenericCtx<DataModel>) => {
 *   return betterAuth({
 *     database: authComponent.adapter(ctx),
 *     plugins: [
 *       createConvexAffiliatePlugin(ctx, {
 *         component: components.affiliates,
 *         cookieName: "affiliate_code",
 *         referralIdCookieName: "referral_id",
 *       }),
 *     ],
 *   });
 * };
 * ```
 */
export function createConvexAffiliatePlugin(
  ctx: {
    runQuery: (query: unknown, args?: unknown) => Promise<unknown>;
    runMutation: (mutation: unknown, args?: unknown) => Promise<unknown>;
  },
  config: ConvexAffiliatePluginConfig
): BetterAuthPlugin {
  return affiliatePlugin({
    fieldNames: config.fieldNames,
    cookieName: config.cookieName,
    referralIdCookieName: config.referralIdCookieName,
    extendUserSchema: config.extendUserSchema,
    onAttributionSuccess: config.onAttributionSuccess,
    onAttributionFailure: config.onAttributionFailure,

    attributeSignup: async (userId, referralData) => {
      // Try by referral ID first (more accurate)
      if (referralData.referralId) {
        const referral = (await ctx.runQuery(
          config.component.referrals.getByReferralId,
          { referralId: referralData.referralId }
        )) as { _id: string; status: string } | null;

        if (referral && referral.status === "clicked") {
          await ctx.runMutation(config.component.referrals.attributeSignup, {
            referralId: referral._id,
            userId,
          });
          return { attributed: true };
        }
      }

      // Try by affiliate code
      if (referralData.referralCode) {
        const result = (await ctx.runMutation(
          config.component.referrals.attributeSignupByCode,
          {
            userId,
            affiliateCode: referralData.referralCode,
          }
        )) as { success: boolean };

        return {
          attributed: result.success,
          affiliateCode: referralData.referralCode,
        };
      }

      return { attributed: false };
    },
  });
}

// =============================================================================
// Exports
// =============================================================================

export type { BetterAuthPlugin };
