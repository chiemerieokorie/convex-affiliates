import {
  actionGeneric,
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
  internalMutationGeneric,
  internalActionGeneric,
} from "convex/server";
import type {
  Auth,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDataModel,
  HttpRouter,
} from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import {
  affiliateStatusValidator,
  payoutTermValidator,
  commissionTypeValidator,
  payoutMethodValidator,
} from "../component/validators.js";

// =============================================================================
// Types
// =============================================================================

export interface AffiliateConfig {
  /**
   * Default commission type for new campaigns.
   */
  defaultCommissionType?: "percentage" | "fixed";

  /**
   * Default commission value (percentage 0-100 or fixed cents).
   */
  defaultCommissionValue?: number;

  /**
   * Default payout term for new campaigns.
   */
  defaultPayoutTerm?: "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";

  /**
   * Minimum payout amount in cents.
   */
  minPayoutCents?: number;

  /**
   * Default cookie duration in days.
   */
  defaultCookieDurationDays?: number;

  /**
   * Base URL for generating affiliate links.
   */
  baseUrl?: string;

  /**
   * Stripe secret key (passed to Connect actions).
   */
  stripeSecretKey?: string;
}

export interface AffiliateRegistration {
  userId: string;
  email: string;
  displayName?: string;
  website?: string;
  socialMedia?: string;
  campaignId?: string;
  customCode?: string;
}

export interface PortalData {
  affiliate: {
    _id: string;
    code: string;
    displayName?: string;
    status: string;
    stats: {
      totalClicks: number;
      totalSignups: number;
      totalConversions: number;
      totalRevenueCents: number;
      totalCommissionsCents: number;
      pendingCommissionsCents: number;
      paidCommissionsCents: number;
    };
    stripeConnectStatus?: string;
  };
  campaign: {
    name: string;
    commissionType: string;
    commissionValue: number;
  };
  recentCommissions: Array<{
    _id: string;
    saleAmountCents: number;
    commissionAmountCents: number;
    currency: string;
    status: string;
    createdAt: number;
  }>;
  pendingPayout: {
    amountCents: number;
    count: number;
  };
}

export interface AdminDashboard {
  totalAffiliates: number;
  pendingApprovals: number;
  activeAffiliates: number;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalRevenueCents: number;
  totalCommissionsCents: number;
  pendingPayoutsCents: number;
  paidPayoutsCents: number;
  activeCampaigns: number;
}

// Context types
type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

// =============================================================================
// AffiliateManager Class
// =============================================================================

/**
 * Main client wrapper for the Affiliate component.
 * Use this class to interact with the affiliate system from your Convex functions.
 */
export class AffiliateManager {
  private component: ComponentApi;
  private config: AffiliateConfig;

  constructor(component: ComponentApi, config: AffiliateConfig = {}) {
    this.component = component;
    this.config = {
      defaultCommissionType: "percentage",
      defaultCommissionValue: 20,
      defaultPayoutTerm: "NET-30",
      minPayoutCents: 5000, // $50 minimum
      defaultCookieDurationDays: 30,
      ...config,
    };
  }

  // ===========================================================================
  // Setup & Initialization
  // ===========================================================================

  /**
   * Initialize the affiliate system with default settings.
   * Should be called once during app setup.
   */
  async initialize(ctx: MutationCtx): Promise<void> {
    // Check if already initialized
    const existing = await ctx.runQuery(this.component.settings.get);
    if (existing) {
      return;
    }

    // Initialize settings
    await ctx.runMutation(this.component.settings.initialize, {
      defaultCommissionType: this.config.defaultCommissionType!,
      defaultCommissionValue: this.config.defaultCommissionValue!,
      defaultPayoutTerm: this.config.defaultPayoutTerm!,
      defaultMinPayoutCents: this.config.minPayoutCents!,
      defaultCookieDurationDays: this.config.defaultCookieDurationDays!,
    });

    // Create default campaign
    await ctx.runMutation(this.component.campaigns.create, {
      name: "Default Campaign",
      slug: "default",
      commissionType: this.config.defaultCommissionType!,
      commissionValue: this.config.defaultCommissionValue!,
      payoutTerm: this.config.defaultPayoutTerm!,
      cookieDurationDays: this.config.defaultCookieDurationDays!,
      isDefault: true,
    });
  }

  // ===========================================================================
  // Attribution (Better Auth Integration)
  // ===========================================================================

  /**
   * Attribute a user signup to an affiliate.
   * Call this after user registration to link the referral.
   *
   * @param ctx - Mutation context
   * @param userId - The new user's ID from Better Auth
   * @param referralCode - The affiliate code from URL params (optional)
   * @param referralId - The referral ID from cookie/storage (optional)
   */
  async attributeSignup(
    ctx: MutationCtx,
    params: {
      userId: string;
      referralCode?: string;
      referralId?: string;
    }
  ): Promise<{ attributed: boolean; affiliateCode?: string }> {
    // First try by referral ID (from cookie/storage)
    if (params.referralId) {
      const referral = await ctx.runQuery(
        this.component.referrals.getByReferralId,
        { referralId: params.referralId }
      );
      if (referral && referral.status === "clicked") {
        await ctx.runMutation(this.component.referrals.attributeSignup, {
          referralId: referral._id,
          userId: params.userId,
        });
        const affiliate = await ctx.runQuery(
          this.component.affiliates.getByUserId,
          { userId: "" } // Placeholder - we need the affiliate code
        );
        return { attributed: true };
      }
    }

    // Try by affiliate code (from URL params)
    if (params.referralCode) {
      const result = await ctx.runMutation(
        this.component.referrals.attributeSignupByCode,
        {
          userId: params.userId,
          affiliateCode: params.referralCode,
        }
      );
      return {
        attributed: result.success,
        affiliateCode: result.success ? params.referralCode : undefined,
      };
    }

    return { attributed: false };
  }

  // ===========================================================================
  // Stripe Webhook Handlers
  // ===========================================================================

  /**
   * Handle Stripe invoice.paid webhook event.
   * Creates a commission for the attributed affiliate.
   */
  async handleInvoicePaid(
    ctx: MutationCtx,
    invoice: {
      id: string;
      customer: string;
      subscription?: string;
      amount_paid: number;
      currency: string;
      metadata?: { affiliate_code?: string };
      lines?: {
        data: Array<{
          price?: { product?: string };
        }>;
      };
      charge?: string;
    }
  ): Promise<string | null> {
    const productId = invoice.lines?.data[0]?.price?.product;

    const commissionId = await ctx.runMutation(
      this.component.internal.stripe.handleInvoicePaid,
      {
        invoiceId: invoice.id,
        stripeCustomerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amountPaidCents: invoice.amount_paid,
        currency: invoice.currency,
        affiliateCode: invoice.metadata?.affiliate_code,
        productId: typeof productId === "string" ? productId : undefined,
        chargeId: typeof invoice.charge === "string" ? invoice.charge : undefined,
      }
    );

    return commissionId;
  }

  /**
   * Handle Stripe charge.refunded webhook event.
   * Reverses the commission for the refunded charge.
   */
  async handleChargeRefunded(
    ctx: MutationCtx,
    charge: {
      id: string;
      customer: string;
      amount_refunded: number;
      refunds?: {
        data: Array<{ reason?: string }>;
      };
    }
  ): Promise<void> {
    await ctx.runMutation(
      this.component.internal.stripe.handleChargeRefunded,
      {
        chargeId: charge.id,
        stripeCustomerId:
          typeof charge.customer === "string" ? charge.customer : "",
        refundAmountCents: charge.amount_refunded,
        reason: charge.refunds?.data[0]?.reason,
      }
    );
  }

  /**
   * Handle Stripe checkout.session.completed webhook event.
   * Links Stripe customer to referral for attribution.
   */
  async handleCheckoutCompleted(
    ctx: MutationCtx,
    session: {
      id: string;
      customer: string;
      client_reference_id?: string;
      metadata?: { affiliate_code?: string };
    }
  ): Promise<void> {
    await ctx.runMutation(
      this.component.internal.stripe.handleCheckoutCompleted,
      {
        sessionId: session.id,
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : "",
        affiliateCode: session.metadata?.affiliate_code,
        userId: session.client_reference_id,
      }
    );
  }

  // ===========================================================================
  // Affiliate Registration
  // ===========================================================================

  /**
   * Register a new affiliate.
   * Returns the affiliate code.
   */
  async registerAffiliate(
    ctx: MutationCtx,
    params: AffiliateRegistration
  ): Promise<{ affiliateId: string; code: string }> {
    // Get campaign (use provided or default)
    let campaignId = params.campaignId;
    if (!campaignId) {
      const defaultCampaign = await ctx.runQuery(
        this.component.campaigns.getDefault
      );
      if (!defaultCampaign) {
        throw new Error("No default campaign configured");
      }
      campaignId = defaultCampaign._id;
    }

    const result = await ctx.runMutation(this.component.affiliates.register, {
      userId: params.userId,
      email: params.email,
      displayName: params.displayName,
      website: params.website,
      socialMedia: params.socialMedia,
      campaignId: campaignId as any,
      customCode: params.customCode,
    });

    return result;
  }

  // ===========================================================================
  // Portal Data
  // ===========================================================================

  /**
   * Get all data needed for the affiliate portal.
   */
  async getAffiliatePortalData(
    ctx: QueryCtx,
    userId: string
  ): Promise<PortalData | null> {
    return await ctx.runQuery(this.component.analytics.getPortalData, {
      userId,
    });
  }

  /**
   * Get paginated commission history for an affiliate.
   */
  async getAffiliateCommissions(
    ctx: QueryCtx,
    params: {
      affiliateId: string;
      status?: "pending" | "approved" | "paid" | "reversed" | "processing";
      paginationOpts: { numItems: number; cursor: string | null };
    }
  ) {
    return await ctx.runQuery(this.component.commissions.listByAffiliate, {
      affiliateId: params.affiliateId as any,
      status: params.status,
      paginationOpts: params.paginationOpts,
    });
  }

  /**
   * Get paginated payout history for an affiliate.
   */
  async getAffiliatePayouts(
    ctx: QueryCtx,
    params: {
      affiliateId: string;
      status?:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled";
      paginationOpts: { numItems: number; cursor: string | null };
    }
  ) {
    return await ctx.runQuery(this.component.payouts.listByAffiliate, {
      affiliateId: params.affiliateId as any,
      status: params.status,
      paginationOpts: params.paginationOpts,
    });
  }

  // ===========================================================================
  // Stripe Connect
  // ===========================================================================

  /**
   * Create a Stripe Connect onboarding link for an affiliate.
   */
  async createConnectOnboardingLink(
    ctx: ActionCtx,
    params: {
      affiliateId: string;
      refreshUrl: string;
      returnUrl: string;
    }
  ): Promise<{ accountId: string; url: string }> {
    if (!this.config.stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    const result = await ctx.runAction(
      this.component.internal.connect.createAccountLink,
      {
        affiliateId: params.affiliateId as any,
        stripeSecretKey: this.config.stripeSecretKey,
        refreshUrl: params.refreshUrl,
        returnUrl: params.returnUrl,
      }
    );

    return {
      accountId: result.accountId,
      url: result.accountLinkUrl,
    };
  }

  /**
   * Create a Stripe Connect dashboard login link for an affiliate.
   */
  async createConnectLoginLink(
    ctx: ActionCtx,
    stripeConnectAccountId: string
  ): Promise<string> {
    if (!this.config.stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    const result = await ctx.runAction(
      this.component.internal.connect.createLoginLink,
      {
        stripeSecretKey: this.config.stripeSecretKey,
        stripeConnectAccountId,
      }
    );

    return result.url;
  }

  // ===========================================================================
  // Admin Functions
  // ===========================================================================

  /**
   * Get admin dashboard overview.
   */
  async getAdminDashboard(ctx: QueryCtx): Promise<AdminDashboard> {
    return await ctx.runQuery(this.component.analytics.getAdminDashboard);
  }

  /**
   * List affiliates with optional filters.
   */
  async listAffiliates(
    ctx: QueryCtx,
    params?: {
      status?: "pending" | "approved" | "rejected" | "suspended";
      campaignId?: string;
      limit?: number;
    }
  ) {
    return await ctx.runQuery(this.component.affiliates.list, {
      status: params?.status,
      campaignId: params?.campaignId as any,
      limit: params?.limit,
    });
  }

  /**
   * Approve an affiliate application.
   */
  async approveAffiliate(ctx: MutationCtx, affiliateId: string): Promise<void> {
    await ctx.runMutation(this.component.affiliates.approve, {
      affiliateId: affiliateId as any,
    });
  }

  /**
   * Reject an affiliate application.
   */
  async rejectAffiliate(
    ctx: MutationCtx,
    affiliateId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.affiliates.reject, {
      affiliateId: affiliateId as any,
    });
  }

  /**
   * Suspend an affiliate.
   */
  async suspendAffiliate(
    ctx: MutationCtx,
    affiliateId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.affiliates.suspend, {
      affiliateId: affiliateId as any,
    });
  }

  /**
   * Trigger payout processing for all eligible affiliates.
   */
  async processPayouts(ctx: ActionCtx): Promise<{
    triggered: number;
    affiliateIds: string[];
  }> {
    if (!this.config.stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    return await ctx.runAction(
      this.component.internal.workflows.processAllDuePayouts,
      {
        stripeSecretKey: this.config.stripeSecretKey,
        minPayoutCents: this.config.minPayoutCents!,
      }
    );
  }

  // ===========================================================================
  // Campaign Management
  // ===========================================================================

  /**
   * List all campaigns.
   */
  async listCampaigns(ctx: QueryCtx, includeInactive = false) {
    return await ctx.runQuery(this.component.campaigns.list, {
      activeOnly: !includeInactive,
    });
  }

  /**
   * Create a new campaign.
   */
  async createCampaign(
    ctx: MutationCtx,
    params: {
      name: string;
      slug: string;
      description?: string;
      commissionType: "percentage" | "fixed";
      commissionValue: number;
      payoutTerm: "NET-0" | "NET-15" | "NET-30" | "NET-60" | "NET-90";
      cookieDurationDays?: number;
      commissionDuration?: "lifetime" | "max_payments" | "max_months";
      commissionDurationValue?: number;
      allowedProducts?: string[];
      excludedProducts?: string[];
    }
  ) {
    return await ctx.runMutation(this.component.campaigns.create, {
      ...params,
      cookieDurationDays:
        params.cookieDurationDays ?? this.config.defaultCookieDurationDays!,
    });
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Generate an affiliate link with the given code and path.
   */
  generateAffiliateLink(
    code: string,
    path = "/",
    subId?: string
  ): string {
    const baseUrl = this.config.baseUrl ?? "";
    const url = new URL(path, baseUrl);
    url.searchParams.set("ref", code);
    if (subId) {
      url.searchParams.set("sub", subId);
    }
    return url.toString();
  }

  /**
   * Parse referral info from URL search params.
   */
  parseReferralParams(searchParams: URLSearchParams): {
    code?: string;
    subId?: string;
  } {
    return {
      code: searchParams.get("ref") ?? undefined,
      subId: searchParams.get("sub") ?? undefined,
    };
  }
}

// =============================================================================
// Legacy API (for backwards compatibility)
// =============================================================================

/**
 * For re-exporting of an API accessible from React clients.
 * Creates query/mutation/action exports for use in the host app.
 */
export function exposeApi(
  component: ComponentApi,
  options: {
    /**
     * Authenticate the request and return the user ID.
     */
    auth: (
      ctx: { auth: Auth },
      operation:
        | { type: "read" }
        | { type: "write" }
        | { type: "admin" }
    ) => Promise<string>;
  }
) {
  return {
    // Affiliate Portal
    getPortalData: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.analytics.getPortalData, {
          userId,
        });
      },
    }),

    getAffiliate: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.affiliates.getByUserId, {
          userId,
        });
      },
    }),

    // Registration
    register: mutationGeneric({
      args: {
        email: v.string(),
        displayName: v.optional(v.string()),
        website: v.optional(v.string()),
        socialMedia: v.optional(v.string()),
        customCode: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, { type: "write" });
        const defaultCampaign = await ctx.runQuery(component.campaigns.getDefault);
        if (!defaultCampaign) {
          throw new Error("No default campaign configured");
        }
        return await ctx.runMutation(component.affiliates.register, {
          userId,
          email: args.email,
          displayName: args.displayName,
          website: args.website,
          socialMedia: args.socialMedia,
          campaignId: defaultCampaign._id,
          customCode: args.customCode,
        });
      },
    }),

    // Track referral click (public - no auth required)
    trackClick: mutationGeneric({
      args: {
        affiliateCode: v.string(),
        landingPage: v.string(),
        referrer: v.optional(v.string()),
        userAgent: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
        subId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.referrals.trackClick, args);
      },
    }),

    // Commissions
    listCommissions: queryGeneric({
      args: {
        status: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("approved"),
            v.literal("paid"),
            v.literal("reversed"),
            v.literal("processing")
          )
        ),
        paginationOpts: v.object({
          numItems: v.number(),
          cursor: v.union(v.string(), v.null()),
        }),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, { type: "read" });
        const affiliate = await ctx.runQuery(component.affiliates.getByUserId, {
          userId,
        });
        if (!affiliate) {
          return { page: [], isDone: true, continueCursor: "" };
        }
        return await ctx.runQuery(component.commissions.listByAffiliate, {
          affiliateId: affiliate._id,
          status: args.status,
          paginationOpts: args.paginationOpts,
        });
      },
    }),

    // Payouts
    listPayouts: queryGeneric({
      args: {
        status: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("cancelled")
          )
        ),
        paginationOpts: v.object({
          numItems: v.number(),
          cursor: v.union(v.string(), v.null()),
        }),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, { type: "read" });
        const affiliate = await ctx.runQuery(component.affiliates.getByUserId, {
          userId,
        });
        if (!affiliate) {
          return { page: [], isDone: true, continueCursor: "" };
        }
        return await ctx.runQuery(component.payouts.listByAffiliate, {
          affiliateId: affiliate._id,
          status: args.status,
          paginationOpts: args.paginationOpts,
        });
      },
    }),

    // Admin: Dashboard
    adminDashboard: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "admin" });
        return await ctx.runQuery(component.analytics.getAdminDashboard);
      },
    }),

    // Admin: List affiliates
    adminListAffiliates: queryGeneric({
      args: {
        status: v.optional(affiliateStatusValidator),
        campaignId: v.optional(v.id("campaigns")),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        return await ctx.runQuery(component.affiliates.list, args);
      },
    }),

    // Admin: Approve affiliate
    adminApproveAffiliate: mutationGeneric({
      args: { affiliateId: v.id("affiliates") },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        return await ctx.runMutation(component.affiliates.approve, args);
      },
    }),

    // Admin: Reject affiliate
    adminRejectAffiliate: mutationGeneric({
      args: {
        affiliateId: v.id("affiliates"),
        reason: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        return await ctx.runMutation(component.affiliates.reject, args);
      },
    }),

    // Admin: Top affiliates
    adminTopAffiliates: queryGeneric({
      args: {
        sortBy: v.optional(
          v.union(
            v.literal("conversions"),
            v.literal("revenue"),
            v.literal("commissions")
          )
        ),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        return await ctx.runQuery(component.analytics.getTopAffiliates, args);
      },
    }),
  };
}

/**
 * Register HTTP routes for webhook handling.
 */
export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  options: {
    pathPrefix?: string;
    stripeWebhookSecret?: string;
  } = {}
) {
  const prefix = options.pathPrefix ?? "/affiliates";

  // Stripe webhook endpoint
  // Note: The host app should handle signature verification
  // This just provides a route template
  http.route({
    path: `${prefix}/webhooks/stripe`,
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      // Host app should verify webhook signature and call appropriate
      // AffiliateManager methods. This is just a placeholder that
      // returns documentation.
      return new Response(
        JSON.stringify({
          message: "Use AffiliateManager methods in your webhook handler",
          methods: [
            "handleInvoicePaid",
            "handleChargeRefunded",
            "handleCheckoutCompleted",
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }),
  });

  // Get affiliate by code (public endpoint for link validation)
  http.route({
    path: `${prefix}/affiliate/:code`,
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const code = url.pathname.split("/").pop();

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Code required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const affiliate = await ctx.runQuery(component.affiliates.getByCode, {
        code: code.toUpperCase(),
      });

      if (!affiliate) {
        return new Response(
          JSON.stringify({ error: "Affiliate not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          code: affiliate.code,
          displayName: affiliate.displayName,
          valid: affiliate.status === "approved",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }),
  });
}

// =============================================================================
// Exports
// =============================================================================

export type { ComponentApi };
