/**
 * Verify Stripe plugin types compile correctly for consumers.
 */
import { withAffiliates, getAffiliateMetadata } from "convex-affiliates/stripe";
import { getAffiliateStripeHandlers } from "convex-affiliates";
import type { ComponentApi } from "convex-affiliates";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

declare const component: ComponentApi<"affiliates">;

// withAffiliates — used with @convex-dev/stripe registerRoutes
const routeOptions = withAffiliates(component, {
  onCommissionCreated: async (data) => {
    console.log(data.commissionAmountCents, data.affiliateCode);
  },
  onCommissionReversed: async (data) => {
    console.log(data.commissionId, data.commissionAmountCents);
  },
  onCustomerLinked: async (data) => {
    console.log(data.stripeCustomerId, data.affiliateCode);
  },
});

// getAffiliateMetadata — used in checkout actions
declare const ctx: GenericActionCtx<GenericDataModel>;
const metadataPromise = getAffiliateMetadata(ctx, component);

// getAffiliateStripeHandlers — standalone event handlers
const handlers = getAffiliateStripeHandlers(component, {
  hooks: {
    "commission.created": async (data) => {
      console.log(data.commissionAmountCents);
    },
    "commission.reversed": async (data) => {
      console.log(data.reason);
    },
  },
});

void [routeOptions, metadataPromise, handlers];
