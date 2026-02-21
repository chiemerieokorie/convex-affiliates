/**
 * Better Auth Server Plugin for Convex Affiliates
 *
 * This plugin automatically handles affiliate attribution when users sign up
 * through Better Auth. It uses databaseHooks to intercept user creation events,
 * which fires for ALL auth methods (email, OAuth, magic-link, etc.).
 *
 * @example
 * ```typescript
 * // convex/auth.ts
 * import { betterAuth } from "better-auth";
 * import { affiliatePlugin } from "convex-affiliates/better-auth";
 * import { components } from "./_generated/api";
 *
 * export const createAuth = (ctx) => {
 *   return betterAuth({
 *     database: authComponent.adapter(ctx),
 *     plugins: [
 *       affiliatePlugin(ctx, components.affiliates),
 *     ],
 *   });
 * };
 * ```
 *
 * @module
 */

import type { BetterAuthPlugin } from "better-auth";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Convex context with query/mutation capabilities.
 * Uses Pick<GenericActionCtx> so consumers can pass their ActionCtx
 * directly without @ts-expect-error.
 */
type ConvexCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

/**
 * Optional configuration for the affiliate plugin
 */
export interface AffiliatePluginOptions {
  /**
   * Custom field names for referral data in signup body.
   * @default { referralId: "referralId", referralCode: "referralCode" }
   */
  fieldNames?: {
    referralId?: string;
    referralCode?: string;
  };

  /**
   * Cookie name for affiliate code (for SSR support).
   * @default "affiliate_code"
   */
  cookieName?: string;

  /**
   * Cookie name for referral ID (for SSR support).
   * @default "affiliate_referral_id"
   */
  referralIdCookieName?: string;

  /**
   * Callback when attribution succeeds
   */
  onAttributionSuccess?: (data: {
    userId: string;
    affiliateCode?: string;
  }) => Promise<void>;

  /**
   * Callback when attribution fails or no referral data found
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
 * Uses `databaseHooks.user.create.after` to intercept user creation at the
 * database level. This fires for ALL auth methods (email, OAuth, magic-link,
 * passkey, etc.) and receives the actual user record directly — no need
 * for endpoint path matching or response parsing.
 *
 * @param ctx - The Convex context (from createAuth function)
 * @param component - The affiliates component (components.affiliates)
 * @param options - Optional configuration
 * @returns Better Auth plugin
 *
 * @example
 * ```typescript
 * import { betterAuth } from "better-auth";
 * import { affiliatePlugin } from "convex-affiliates/better-auth";
 * import { components } from "./_generated/api";
 *
 * export const createAuth = (ctx) => {
 *   return betterAuth({
 *     database: authComponent.adapter(ctx),
 *     plugins: [
 *       // Simple usage - just pass ctx and component
 *       affiliatePlugin(ctx, components.affiliates),
 *
 *       // Or with options
 *       affiliatePlugin(ctx, components.affiliates, {
 *         onAttributionSuccess: async ({ userId, affiliateCode }) => {
 *           console.log(`Attributed ${userId} to ${affiliateCode}`);
 *         },
 *       }),
 *     ],
 *   });
 * };
 * ```
 */
export function affiliatePlugin(
  ctx: ConvexCtx,
  component: ComponentApi,
  options: AffiliatePluginOptions = {}
) {
  const config = {
    referralIdField: options.fieldNames?.referralId ?? "referralId",
    referralCodeField: options.fieldNames?.referralCode ?? "referralCode",
    cookieName: options.cookieName ?? "affiliate_code",
    referralIdCookieName: options.referralIdCookieName ?? "affiliate_referral_id",
    onAttributionSuccess: options.onAttributionSuccess,
    onAttributionFailure: options.onAttributionFailure,
  };

  return {
    id: "convex-affiliates",

    init() {
      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                after: async (
                  user: { id: string } & Record<string, unknown>,
                  endpointCtx: { body?: unknown; headers?: Headers } | null
                ) => {
                  // Top-level try-catch: NEVER let attribution crash the auth flow
                  try {
                    if (!endpointCtx) return;

                    const userId = user.id;

                    // Extract referral data from body (email signups)
                    const body = endpointCtx.body as Record<string, unknown> | undefined;
                    let referralId = body?.[config.referralIdField] as string | undefined;
                    let referralCode = body?.[config.referralCodeField] as string | undefined;

                    // Also check cookies (OAuth signups — cookies forwarded by Next.js proxy)
                    const cookieHeader = endpointCtx.headers?.get("cookie");
                    if (cookieHeader) {
                      const cookies = parseCookies(cookieHeader);
                      if (!referralId) referralId = cookies[config.referralIdCookieName];
                      if (!referralCode) referralCode = cookies[config.cookieName];
                    }

                    if (!referralId && !referralCode) {
                      try { await config.onAttributionFailure?.({ userId, reason: "No referral data found" }); } catch { /* swallow */ }
                      return;
                    }

                    // Attribution logic
                    let attributed = false;
                    let affiliateCode: string | undefined;

                    // Try by referral ID first (more accurate)
                    if (referralId) {
                      const referral = await ctx.runQuery(
                        component.referrals.getByReferralId,
                        { referralId }
                      );

                      if (referral?.status === "clicked") {
                        await ctx.runMutation(component.referrals.attributeSignup, {
                          referralId,
                          userId,
                        });
                        attributed = true;
                        const affiliate = await ctx.runQuery(
                          component.affiliates.getById,
                          { affiliateId: referral.affiliateId }
                        );
                        affiliateCode = affiliate?.code;
                      }
                    }

                    // Try by affiliate code if referral ID didn't work
                    if (!attributed && referralCode) {
                      const result = await ctx.runMutation(
                        component.referrals.attributeSignupByCode,
                        { userId, affiliateCode: referralCode }
                      );
                      attributed = result.success;
                      affiliateCode = referralCode;
                    }

                    if (attributed) {
                      try { await config.onAttributionSuccess?.({ userId, affiliateCode }); } catch { /* swallow */ }
                    } else {
                      try { await config.onAttributionFailure?.({ userId, reason: "Attribution failed - referral not found or invalid" }); } catch { /* swallow */ }
                    }
                  } catch (error) {
                    console.error("[convex-affiliates] Attribution error:", error);
                    try { await config.onAttributionFailure?.({ userId: user.id, reason: error instanceof Error ? error.message : "Unknown error" }); } catch { /* swallow */ }
                  }
                },
              },
            },
          },
        },
      };
    },
  } satisfies BetterAuthPlugin;
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      const value = valueParts.join("=");
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }
  }
  return cookies;
}

// =============================================================================
// Exports
// =============================================================================

export type { BetterAuthPlugin };