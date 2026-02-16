/**
 * Verify common consumer DX patterns compile correctly.
 * Tests branded ID types, type re-exports, and utility functions.
 */
import {
  generateAffiliateLink,
  parseReferralParams,
  generateAffiliateCode,
  calculateCommissionAmount,
  getPayoutTermDelayMs,
} from "convex-affiliates";

import type {
  AffiliateId,
  CommissionId,
  PayoutId,
  ReferralId,
  CampaignId,
  CommissionRecord,
  PayoutRecord,
  CommissionType,
  PayoutTerm,
  AffiliateStatus,
  ReferralStatus,
  CommissionStatus,
  PayoutStatus,
  PayoutMethod,
} from "convex-affiliates";

// ---- Utility functions return expected types ----

const link: string = generateAffiliateLink("https://example.com", "ABC123", "/pricing", "campaign1");
const params: { code?: string; subId?: string } = parseReferralParams(new URLSearchParams("?ref=ABC&sub=test"));
const code: string = generateAffiliateCode("PRE");
const commission: number = calculateCommissionAmount(10000, "percentage", 20);
const delay: number = getPayoutTermDelayMs("NET-30");

// ---- Branded IDs are assignable with proper cast ----

const affId = "abc" as unknown as AffiliateId;
const commId = "def" as unknown as CommissionId;
const payId = "ghi" as unknown as PayoutId;
const refId = "jkl" as unknown as ReferralId;
const campId = "mno" as unknown as CampaignId;

// Branded IDs should be usable as strings
const str1: string = affId;
const str2: string = commId;

// ---- Union type re-exports are usable ----

const status1: AffiliateStatus = "approved";
const status2: AffiliateStatus = "pending";
const status3: AffiliateStatus = "rejected";
const status4: AffiliateStatus = "suspended";

const commType: CommissionType = "percentage";
const commType2: CommissionType = "fixed";

const payoutTerm: PayoutTerm = "NET-30";
const payoutTerm2: PayoutTerm = "NET-0";

const commStatus: CommissionStatus = "pending";
const commStatus2: CommissionStatus = "approved";
const commStatus3: CommissionStatus = "paid";
const commStatus4: CommissionStatus = "reversed";
const commStatus5: CommissionStatus = "processing";

const payoutStatus: PayoutStatus = "pending";
const payoutStatus2: PayoutStatus = "completed";
const payoutStatus3: PayoutStatus = "cancelled";

const payoutMethod: PayoutMethod = "manual";
const payoutMethod2: PayoutMethod = "bank_transfer";
const payoutMethod3: PayoutMethod = "paypal";

const refStatus: ReferralStatus = "clicked";
const refStatus2: ReferralStatus = "signed_up";
const refStatus3: ReferralStatus = "converted";
const refStatus4: ReferralStatus = "expired";

// ---- CommissionRecord fields are accessible ----

declare const record: CommissionRecord;
const _id: CommissionId = record._id;
const _affId: AffiliateId = record.affiliateId;
const _refId: ReferralId = record.referralId;
const _amount: number = record.commissionAmountCents;
const _rate: number = record.commissionRate;
const _type: "percentage" | "fixed" = record.commissionType;
const _currency: string = record.currency;
const _dueAt: number = record.dueAt;
const _status: "pending" | "approved" | "processing" | "paid" | "reversed" = record.status;

// ---- PayoutRecord fields are accessible ----

declare const payout: PayoutRecord;
const _payId: PayoutId = payout._id;
const _payAffId: AffiliateId = payout.affiliateId;
const _payAmount: number = payout.amountCents;
const _payMethod: "manual" | "bank_transfer" | "paypal" | "other" = payout.method;
const _payStatus: "pending" | "completed" | "cancelled" = payout.status;

void [
  link, params, code, commission, delay,
  affId, commId, payId, refId, campId, str1, str2,
  status1, status2, status3, status4,
  commType, commType2, payoutTerm, payoutTerm2,
  commStatus, commStatus2, commStatus3, commStatus4, commStatus5,
  payoutStatus, payoutStatus2, payoutStatus3,
  payoutMethod, payoutMethod2, payoutMethod3,
  refStatus, refStatus2, refStatus3, refStatus4,
  _id, _affId, _refId, _amount, _rate, _type, _currency, _dueAt, _status,
  _payId, _payAffId, _payAmount, _payMethod, _payStatus,
];
