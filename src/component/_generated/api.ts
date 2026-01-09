/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as affiliates from "../affiliates.js";
import type * as analytics from "../analytics.js";
import type * as campaigns from "../campaigns.js";
import type * as commissions from "../commissions.js";
import type * as crons from "../crons.js";
import type * as payouts from "../payouts.js";
import type * as referrals from "../referrals.js";
import type * as internal_connect from "../internal/connect.js";
import type * as internal_stripe from "../internal/stripe.js";
import type * as internal_workflows from "../internal/workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

// Use a simplified type to avoid circular references
type InternalModules = {
  affiliates: typeof affiliates;
  analytics: typeof analytics;
  campaigns: typeof campaigns;
  commissions: typeof commissions;
  crons: typeof crons;
  payouts: typeof payouts;
  referrals: typeof referrals;
};

const fullApi = anyApi as unknown as ApiFromModules<InternalModules>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> & {
  // Add internal modules explicitly
  internal: {
    connect: typeof internal_connect;
    stripe: typeof internal_stripe;
    workflows: typeof internal_workflows;
  };
} = anyApi as any;

export const components = componentsGeneric() as unknown as {};
