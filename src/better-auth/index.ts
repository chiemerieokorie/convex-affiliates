/**
 * Better Auth Server Plugin for Convex Affiliates
 *
 * This plugin automatically handles affiliate attribution when users sign up
 * through Better Auth. It hooks into the signup flow and calls the component's
 * attributeSignup mutation directly.
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

import type { BetterAuthPlugin, HookEndpointContext } from "better-auth";
import { createAuthMiddleware } from "better-auth/plugins";
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
 * This plugin intercepts signup requests and automatically attributes
 * new users to affiliates. It reads referral data from the request body
 * (injected by the client plugin) or from cookies.
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

    hooks: {
      after: [
        {
          // Match signup endpoints and OAuth callback (where social auth users are created)
          matcher: (context: HookEndpointContext) => {
            const path = context.path ?? "";
            return (
              path === "/sign-up/email" ||
              path === "/sign-up/username" ||
              path.startsWith("/sign-up/") ||
              path.startsWith("/callback/")
            );
          },

          handler: createAuthMiddleware(async (ctx_hook) => {
            const context = ctx_hook as unknown as {
              context: {
                returned?: unknown;
                body?: Record<string, unknown>;
                request?: Request;
              };
              body?: Record<string, unknown>;
              headers?: Headers;
            };

            // Check if signup was successful (user was created)
            const returned = context.context?.returned;
            if (!returned || typeof returned !== "object") {
              return;
            }

            // Extract user ID from response
            const responseObj = returned as Record<string, unknown>;
            const user = responseObj.user as {
              id?: string;
              createdAt?: Date | string | number;
            } | undefined;
            if (!user?.id) {
              return;
            }

            const userId = user.id;

            // For OAuth sign-ins, check if this is actually a new user
            // by comparing createdAt to current time (within 10 seconds = new user)
            if (user.createdAt) {
              const createdAt = new Date(user.createdAt).getTime();
              const now = Date.now();
              const isNewUser = now - createdAt < 10000; // 10 seconds
              if (!isNewUser) {
                // Existing user signing in via OAuth, skip attribution
                return;
              }
            }

            // Extract referral data from request body
            const body = context.body ?? context.context?.body;
            let referralId = body?.[config.referralIdField] as string | undefined;
            let referralCode = body?.[config.referralCodeField] as string | undefined;

            // Also check cookies
            const cookieHeader =
              context.headers?.get?.("cookie") ??
              context.context?.request?.headers?.get?.("cookie");

            if (cookieHeader) {
              const cookies = parseCookies(cookieHeader);
              if (!referralId && config.referralIdCookieName) {
                referralId = cookies[config.referralIdCookieName];
              }
              if (!referralCode && config.cookieName) {
                referralCode = cookies[config.cookieName];
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

            // Attribute the signup
            try {
              let attributed = false;
              let affiliateCode: string | undefined;

              // Try by referral ID first (more accurate)
              if (referralId) {
                const referral = await ctx.runQuery(
                  component.referrals.getByReferralId,
                  { referralId }
                );

                if (referral && referral.status === "clicked") {
                  await ctx.runMutation(component.referrals.attributeSignup, {
                    referralId: referralId,
                    userId,
                  });
                  attributed = true;
                  // Look up the affiliate to get their code
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
                await config.onAttributionSuccess?.({ userId, affiliateCode });
              } else {
                await config.onAttributionFailure?.({
                  userId,
                  reason: "Attribution failed - referral not found or invalid",
                });
              }
            } catch (error) {
              console.error("[convex-affiliates] Attribution error:", error);
              await config.onAttributionFailure?.({
                userId,
                reason: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      const value = valueParts.join("=");
      // Decode URI-encoded values (handles special characters in affiliate codes)
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        // If decoding fails, use the raw value
        cookies[name] = value;
      }
    }
  });
  return cookies;
}

// =============================================================================
// Exports
// =============================================================================

export type { BetterAuthPlugin };
