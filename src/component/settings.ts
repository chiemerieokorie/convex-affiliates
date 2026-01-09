import { query, internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import {
  commissionTypeValidator,
  payoutTermValidator,
} from "./validators.js";

/**
 * Get the current settings.
 * Returns null if settings haven't been initialized.
 */
export const get = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("settings"),
      _creationTime: v.number(),
      defaultCommissionType: commissionTypeValidator,
      defaultCommissionValue: v.number(),
      defaultCookieDurationDays: v.number(),
      defaultMinPayoutCents: v.number(),
      defaultPayoutTerm: payoutTermValidator,
      fraudDetectionEnabled: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").first();
    return settings ?? null;
  },
});

/**
 * Initialize settings with default values.
 * Should be called once during component setup.
 */
export const initialize = internalMutation({
  args: {
    defaultCommissionType: v.optional(commissionTypeValidator),
    defaultCommissionValue: v.optional(v.number()),
    defaultCookieDurationDays: v.optional(v.number()),
    defaultMinPayoutCents: v.optional(v.number()),
    defaultPayoutTerm: v.optional(payoutTermValidator),
    fraudDetectionEnabled: v.optional(v.boolean()),
  },
  returns: v.id("settings"),
  handler: async (ctx, args) => {
    // Check if settings already exist
    const existing = await ctx.db.query("settings").first();
    if (existing) {
      return existing._id;
    }

    // Create with defaults
    return await ctx.db.insert("settings", {
      defaultCommissionType: args.defaultCommissionType ?? "percentage",
      defaultCommissionValue: args.defaultCommissionValue ?? 20, // 20%
      defaultCookieDurationDays: args.defaultCookieDurationDays ?? 30,
      defaultMinPayoutCents: args.defaultMinPayoutCents ?? 5000, // $50
      defaultPayoutTerm: args.defaultPayoutTerm ?? "NET-30",
      fraudDetectionEnabled: args.fraudDetectionEnabled ?? true,
    });
  },
});

/**
 * Update settings.
 */
export const update = internalMutation({
  args: {
    defaultCommissionType: v.optional(commissionTypeValidator),
    defaultCommissionValue: v.optional(v.number()),
    defaultCookieDurationDays: v.optional(v.number()),
    defaultMinPayoutCents: v.optional(v.number()),
    defaultPayoutTerm: v.optional(payoutTermValidator),
    fraudDetectionEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      throw new Error("Settings not initialized. Call initialize first.");
    }

    const updates: Record<string, unknown> = {};
    if (args.defaultCommissionType !== undefined) {
      updates.defaultCommissionType = args.defaultCommissionType;
    }
    if (args.defaultCommissionValue !== undefined) {
      updates.defaultCommissionValue = args.defaultCommissionValue;
    }
    if (args.defaultCookieDurationDays !== undefined) {
      updates.defaultCookieDurationDays = args.defaultCookieDurationDays;
    }
    if (args.defaultMinPayoutCents !== undefined) {
      updates.defaultMinPayoutCents = args.defaultMinPayoutCents;
    }
    if (args.defaultPayoutTerm !== undefined) {
      updates.defaultPayoutTerm = args.defaultPayoutTerm;
    }
    if (args.fraudDetectionEnabled !== undefined) {
      updates.fraudDetectionEnabled = args.fraudDetectionEnabled;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(settings._id, updates);
    }

    return null;
  },
});
