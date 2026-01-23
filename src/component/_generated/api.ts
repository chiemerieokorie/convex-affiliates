/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as affiliateRecruitment from "../affiliateRecruitment.js";
import type * as affiliates from "../affiliates.js";
import type * as analytics from "../analytics.js";
import type * as campaigns from "../campaigns.js";
import type * as commissions from "../commissions.js";
import type * as crons from "../crons.js";
import type * as landingPages from "../landingPages.js";
import type * as payouts from "../payouts.js";
import type * as referrals from "../referrals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

// Use a simplified type to avoid circular references
type InternalModules = {
  affiliateRecruitment: typeof affiliateRecruitment;
  affiliates: typeof affiliates;
  analytics: typeof analytics;
  campaigns: typeof campaigns;
  commissions: typeof commissions;
  crons: typeof crons;
  landingPages: typeof landingPages;
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
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
