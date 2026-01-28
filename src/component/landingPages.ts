import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import {
  landingPageStatusValidator,
  testimonialValidator,
  ctaConfigValidator,
  heroContentValidator,
} from "./validators.js";

// Reusable return validator for landing page queries
const landingPageReturnValidator = v.object({
  _id: v.id("campaignLandingPages"),
  _creationTime: v.number(),
  campaignId: v.id("campaigns"),
  mediaPreset: v.string(),
  hero: heroContentValidator,
  benefits: v.optional(v.array(v.string())),
  testimonials: v.optional(v.array(testimonialValidator)),
  socialProofText: v.optional(v.string()),
  commissionPreviewText: v.optional(v.string()),
  cta: v.optional(ctaConfigValidator),
  status: landingPageStatusValidator,
  totalViews: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================
// Queries
// ============================================

/**
 * Get a landing page by campaign slug and optional media preset.
 * Falls back to first published page if preset not found.
 */
export const getBySlugAndPreset = query({
  args: {
    slug: v.string(),
    mediaPreset: v.optional(v.string()),
  },
  returns: v.union(landingPageReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!campaign || !campaign.isActive) return null;

    // If preset specified, try exact match
    if (args.mediaPreset) {
      const page = await ctx.db
        .query("campaignLandingPages")
        .withIndex("by_campaignId_mediaPreset", (q) =>
          q.eq("campaignId", campaign._id).eq("mediaPreset", args.mediaPreset!),
        )
        .first();

      if (page && page.status === "published") return page;
    }

    // Fallback: first published page for this campaign
    const pages = await ctx.db
      .query("campaignLandingPages")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
      .collect();

    return pages.find((p) => p.status === "published") ?? null;
  },
});

/**
 * List all landing pages for a campaign.
 */
export const listByCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.array(landingPageReturnValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("campaignLandingPages")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Create a new landing page.
 */
export const create = mutation({
  args: {
    campaignId: v.id("campaigns"),
    mediaPreset: v.string(),
    hero: heroContentValidator,
    benefits: v.optional(v.array(v.string())),
    testimonials: v.optional(v.array(testimonialValidator)),
    socialProofText: v.optional(v.string()),
    commissionPreviewText: v.optional(v.string()),
    cta: v.optional(ctaConfigValidator),
    status: v.optional(landingPageStatusValidator),
  },
  returns: v.id("campaignLandingPages"),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Check for unique mediaPreset within campaign
    const existing = await ctx.db
      .query("campaignLandingPages")
      .withIndex("by_campaignId_mediaPreset", (q) =>
        q.eq("campaignId", args.campaignId).eq("mediaPreset", args.mediaPreset),
      )
      .first();
    if (existing) {
      throw new Error(
        `Landing page with preset "${args.mediaPreset}" already exists for this campaign`,
      );
    }

    const now = Date.now();
    return await ctx.db.insert("campaignLandingPages", {
      campaignId: args.campaignId,
      mediaPreset: args.mediaPreset,
      hero: args.hero,
      benefits: args.benefits,
      testimonials: args.testimonials,
      socialProofText: args.socialProofText,
      commissionPreviewText: args.commissionPreviewText,
      cta: args.cta,
      status: args.status ?? "draft",
      totalViews: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing landing page.
 */
export const update = mutation({
  args: {
    landingPageId: v.id("campaignLandingPages"),
    hero: v.optional(heroContentValidator),
    benefits: v.optional(v.array(v.string())),
    testimonials: v.optional(v.array(testimonialValidator)),
    socialProofText: v.optional(v.string()),
    commissionPreviewText: v.optional(v.string()),
    cta: v.optional(ctaConfigValidator),
    status: v.optional(landingPageStatusValidator),
    mediaPreset: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.landingPageId);
    if (!page) {
      throw new Error("Landing page not found");
    }

    // If changing mediaPreset, check uniqueness
    if (args.mediaPreset && args.mediaPreset !== page.mediaPreset) {
      const existing = await ctx.db
        .query("campaignLandingPages")
        .withIndex("by_campaignId_mediaPreset", (q) =>
          q
            .eq("campaignId", page.campaignId)
            .eq("mediaPreset", args.mediaPreset!),
        )
        .first();
      if (existing) {
        throw new Error(
          `Landing page with preset "${args.mediaPreset}" already exists for this campaign`,
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.hero !== undefined) updates.hero = args.hero;
    if (args.benefits !== undefined) updates.benefits = args.benefits;
    if (args.testimonials !== undefined)
      updates.testimonials = args.testimonials;
    if (args.socialProofText !== undefined)
      updates.socialProofText = args.socialProofText;
    if (args.commissionPreviewText !== undefined)
      updates.commissionPreviewText = args.commissionPreviewText;
    if (args.cta !== undefined) updates.cta = args.cta;
    if (args.status !== undefined) updates.status = args.status;
    if (args.mediaPreset !== undefined) updates.mediaPreset = args.mediaPreset;

    await ctx.db.patch(args.landingPageId, updates);
    return null;
  },
});

/**
 * Delete a landing page.
 */
export const remove = mutation({
  args: {
    landingPageId: v.id("campaignLandingPages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.landingPageId);
    if (!page) {
      throw new Error("Landing page not found");
    }
    await ctx.db.delete(args.landingPageId);
    return null;
  },
});

/**
 * Increment view counter for a landing page.
 */
export const incrementViews = mutation({
  args: {
    landingPageId: v.id("campaignLandingPages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.landingPageId);
    if (!page) return null;
    await ctx.db.patch(args.landingPageId, {
      totalViews: page.totalViews + 1,
    });
    return null;
  },
});
