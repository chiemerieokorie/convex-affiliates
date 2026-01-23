/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("landing pages", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function createCampaign(t: ReturnType<typeof initConvexTest>) {
    return await t.mutation(api.campaigns.create, {
      name: "Test Campaign",
      slug: "test-campaign",
      commissionType: "percentage",
      commissionValue: 25,
      payoutTerm: "NET-30",
      cookieDurationDays: 30,
      isDefault: true,
    });
  }

  test("create and get by slug and preset", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    const pageId = await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "youtube",
      hero: {
        headline: "Join Our Affiliate Program",
        subheadline: "Earn 25% recurring commissions",
      },
      benefits: ["High commissions", "Real-time tracking", "Monthly payouts"],
      status: "published",
    });

    expect(pageId).toBeDefined();

    const page = await t.query(api.landingPages.getBySlugAndPreset, {
      slug: "test-campaign",
      mediaPreset: "youtube",
    });

    expect(page).toBeDefined();
    expect(page?.mediaPreset).toBe("youtube");
    expect(page?.hero.headline).toBe("Join Our Affiliate Program");
    expect(page?.benefits).toHaveLength(3);
    expect(page?.status).toBe("published");
  });

  test("fallback to first published page when preset not found", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "default",
      hero: { headline: "Default Page" },
      status: "published",
    });

    await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "twitter",
      hero: { headline: "Twitter Page" },
      status: "draft",
    });

    // Request a preset that doesn't exist
    const page = await t.query(api.landingPages.getBySlugAndPreset, {
      slug: "test-campaign",
      mediaPreset: "nonexistent",
    });

    // Should fallback to first published page
    expect(page).toBeDefined();
    expect(page?.mediaPreset).toBe("default");
    expect(page?.hero.headline).toBe("Default Page");
  });

  test("increment views counter", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    const pageId = await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "default",
      hero: { headline: "Test" },
      status: "published",
    });

    // Initial views should be 0
    const pages = await t.query(api.landingPages.listByCampaign, { campaignId });
    expect(pages[0].totalViews).toBe(0);

    // Increment views
    await t.mutation(api.landingPages.incrementViews, { landingPageId: pageId });
    await t.mutation(api.landingPages.incrementViews, { landingPageId: pageId });
    await t.mutation(api.landingPages.incrementViews, { landingPageId: pageId });

    const pagesAfter = await t.query(api.landingPages.listByCampaign, { campaignId });
    expect(pagesAfter[0].totalViews).toBe(3);
  });

  test("prevent duplicate mediaPreset per campaign", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "youtube",
      hero: { headline: "First" },
    });

    await expect(
      t.mutation(api.landingPages.create, {
        campaignId,
        mediaPreset: "youtube",
        hero: { headline: "Duplicate" },
      })
    ).rejects.toThrow("already exists");
  });

  test("update landing page fields and status", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    const pageId = await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "default",
      hero: { headline: "Original" },
      status: "draft",
    });

    await t.mutation(api.landingPages.update, {
      landingPageId: pageId,
      hero: { headline: "Updated Headline", subheadline: "New subheadline" },
      status: "published",
      testimonials: [
        { name: "John", quote: "Great program!", earnings: "$5,000/mo" },
      ],
      cta: { text: "Sign up now", buttonLabel: "Get Started" },
    });

    const page = await t.query(api.landingPages.getBySlugAndPreset, {
      slug: "test-campaign",
    });

    expect(page?.hero.headline).toBe("Updated Headline");
    expect(page?.hero.subheadline).toBe("New subheadline");
    expect(page?.status).toBe("published");
    expect(page?.testimonials).toHaveLength(1);
    expect(page?.testimonials?.[0].name).toBe("John");
    expect(page?.cta?.buttonLabel).toBe("Get Started");
  });

  test("delete landing page", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    const pageId = await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "default",
      hero: { headline: "To Delete" },
      status: "published",
    });

    // Verify exists
    const pages = await t.query(api.landingPages.listByCampaign, { campaignId });
    expect(pages).toHaveLength(1);

    // Delete
    await t.mutation(api.landingPages.remove, { landingPageId: pageId });

    // Verify gone
    const pagesAfter = await t.query(api.landingPages.listByCampaign, { campaignId });
    expect(pagesAfter).toHaveLength(0);
  });

  test("draft pages not returned by public query", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "draft-page",
      hero: { headline: "Draft Only" },
      status: "draft",
    });

    // Public query should not return draft pages
    const page = await t.query(api.landingPages.getBySlugAndPreset, {
      slug: "test-campaign",
      mediaPreset: "draft-page",
    });

    expect(page).toBeNull();

    // Also shouldn't return as fallback
    const fallback = await t.query(api.landingPages.getBySlugAndPreset, {
      slug: "test-campaign",
    });

    expect(fallback).toBeNull();
  });

  test("list all pages for a campaign", async () => {
    const t = initConvexTest();
    const campaignId = await createCampaign(t);

    await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "youtube",
      hero: { headline: "YouTube" },
      status: "published",
    });

    await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "twitter",
      hero: { headline: "Twitter" },
      status: "draft",
    });

    await t.mutation(api.landingPages.create, {
      campaignId,
      mediaPreset: "linkedin",
      hero: { headline: "LinkedIn" },
      status: "published",
    });

    // listByCampaign returns all pages regardless of status
    const pages = await t.query(api.landingPages.listByCampaign, { campaignId });
    expect(pages).toHaveLength(3);
  });
});
