import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import {
  commissionTypeValidator,
  commissionDurationValidator,
  payoutTermValidator,
} from "./validators.js";

// ============================================
// Queries
// ============================================

/**
 * List all campaigns, optionally filtered by active status.
 */
export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      isDefault: v.boolean(),
      commissionType: commissionTypeValidator,
      commissionValue: v.number(),
      commissionDuration: commissionDurationValidator,
      commissionDurationValue: v.optional(v.number()),
      cookieDurationDays: v.number(),
      minPayoutCents: v.number(),
      payoutTerm: payoutTermValidator,
      allowedProducts: v.optional(v.array(v.string())),
      excludedProducts: v.optional(v.array(v.string())),
      maxClicksPerIpPerHour: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return await ctx.db
        .query("campaigns")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }
    return await ctx.db.query("campaigns").collect();
  },
});

/**
 * Get a campaign by ID.
 */
export const get = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.union(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      isDefault: v.boolean(),
      commissionType: commissionTypeValidator,
      commissionValue: v.number(),
      commissionDuration: commissionDurationValidator,
      commissionDurationValue: v.optional(v.number()),
      cookieDurationDays: v.number(),
      minPayoutCents: v.number(),
      payoutTerm: payoutTermValidator,
      allowedProducts: v.optional(v.array(v.string())),
      excludedProducts: v.optional(v.array(v.string())),
      maxClicksPerIpPerHour: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.campaignId);
  },
});

/**
 * Get a campaign by slug.
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      isDefault: v.boolean(),
      commissionType: commissionTypeValidator,
      commissionValue: v.number(),
      commissionDuration: commissionDurationValidator,
      commissionDurationValue: v.optional(v.number()),
      cookieDurationDays: v.number(),
      minPayoutCents: v.number(),
      payoutTerm: payoutTermValidator,
      allowedProducts: v.optional(v.array(v.string())),
      excludedProducts: v.optional(v.array(v.string())),
      maxClicksPerIpPerHour: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("campaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Get the default campaign.
 */
export const getDefault = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      isDefault: v.boolean(),
      commissionType: commissionTypeValidator,
      commissionValue: v.number(),
      commissionDuration: commissionDurationValidator,
      commissionDurationValue: v.optional(v.number()),
      cookieDurationDays: v.number(),
      minPayoutCents: v.number(),
      payoutTerm: payoutTermValidator,
      allowedProducts: v.optional(v.array(v.string())),
      excludedProducts: v.optional(v.array(v.string())),
      maxClicksPerIpPerHour: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("campaigns")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Create a new campaign.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
    commissionType: commissionTypeValidator,
    commissionValue: v.number(),
    commissionDuration: v.optional(commissionDurationValidator),
    commissionDurationValue: v.optional(v.number()),
    cookieDurationDays: v.optional(v.number()),
    minPayoutCents: v.optional(v.number()),
    payoutTerm: v.optional(payoutTermValidator),
    allowedProducts: v.optional(v.array(v.string())),
    excludedProducts: v.optional(v.array(v.string())),
    maxClicksPerIpPerHour: v.optional(v.number()),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    // Check for unique slug
    const existing = await ctx.db
      .query("campaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      throw new Error(`Campaign with slug "${args.slug}" already exists`);
    }

    // If this will be the default, unset any existing default
    if (args.isDefault) {
      const currentDefault = await ctx.db
        .query("campaigns")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .first();
      if (currentDefault) {
        await ctx.db.patch(currentDefault._id, { isDefault: false });
      }
    }

    const now = Date.now();
    return await ctx.db.insert("campaigns", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      isActive: args.isActive ?? true,
      isDefault: args.isDefault ?? false,
      commissionType: args.commissionType,
      commissionValue: args.commissionValue,
      commissionDuration: args.commissionDuration ?? "lifetime",
      commissionDurationValue: args.commissionDurationValue,
      cookieDurationDays: args.cookieDurationDays ?? 30,
      minPayoutCents: args.minPayoutCents ?? 5000,
      payoutTerm: args.payoutTerm ?? "NET-30",
      allowedProducts: args.allowedProducts,
      excludedProducts: args.excludedProducts,
      maxClicksPerIpPerHour: args.maxClicksPerIpPerHour,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing campaign.
 */
export const update = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    commissionType: v.optional(commissionTypeValidator),
    commissionValue: v.optional(v.number()),
    commissionDuration: v.optional(commissionDurationValidator),
    commissionDurationValue: v.optional(v.number()),
    cookieDurationDays: v.optional(v.number()),
    minPayoutCents: v.optional(v.number()),
    payoutTerm: v.optional(payoutTermValidator),
    allowedProducts: v.optional(v.array(v.string())),
    excludedProducts: v.optional(v.array(v.string())),
    maxClicksPerIpPerHour: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Check for unique slug if changing
    const { slug } = args;
    if (slug !== undefined && slug !== campaign.slug) {
      const existing = await ctx.db
        .query("campaigns")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (existing) {
        throw new Error(`Campaign with slug "${slug}" already exists`);
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.commissionType !== undefined)
      updates.commissionType = args.commissionType;
    if (args.commissionValue !== undefined)
      updates.commissionValue = args.commissionValue;
    if (args.commissionDuration !== undefined)
      updates.commissionDuration = args.commissionDuration;
    if (args.commissionDurationValue !== undefined)
      updates.commissionDurationValue = args.commissionDurationValue;
    if (args.cookieDurationDays !== undefined)
      updates.cookieDurationDays = args.cookieDurationDays;
    if (args.minPayoutCents !== undefined)
      updates.minPayoutCents = args.minPayoutCents;
    if (args.payoutTerm !== undefined) updates.payoutTerm = args.payoutTerm;
    if (args.allowedProducts !== undefined)
      updates.allowedProducts = args.allowedProducts;
    if (args.excludedProducts !== undefined)
      updates.excludedProducts = args.excludedProducts;
    if (args.maxClicksPerIpPerHour !== undefined)
      updates.maxClicksPerIpPerHour = args.maxClicksPerIpPerHour;

    await ctx.db.patch(args.campaignId, updates);
    return null;
  },
});

/**
 * Set a campaign as the default.
 */
export const setDefault = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Unset any existing default
    const currentDefault = await ctx.db
      .query("campaigns")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();
    if (currentDefault && currentDefault._id !== args.campaignId) {
      await ctx.db.patch(currentDefault._id, { isDefault: false });
    }

    // Set this campaign as default
    await ctx.db.patch(args.campaignId, {
      isDefault: true,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Archive (soft delete) a campaign.
 */
export const archive = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.isDefault) {
      throw new Error("Cannot archive the default campaign");
    }

    await ctx.db.patch(args.campaignId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return null;
  },
});
