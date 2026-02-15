import { describe, it, expect, vi } from "vitest";
import { withAffiliates, getAffiliateMetadata } from "./index";
import type { ComponentApi } from "../component/_generated/component.js";

describe("Stripe Plugin", () => {
  describe("withAffiliates", () => {
    const mockComponent = {
      commissions: {
        createFromInvoice: "commissions.createFromInvoice",
        reverseByCharge: "commissions.reverseByCharge",
      },
      referrals: {
        linkStripeCustomer: "referrals.linkStripeCustomer",
        getByUserId: "referrals.getByUserId",
        getRefereeDiscount: "referrals.getRefereeDiscount",
      },
    } as unknown as ComponentApi;

    it("returns options with affiliate event handlers", () => {
      const result = withAffiliates(mockComponent);

      expect(result.events).toBeDefined();
      expect(result.events!["invoice.paid"]).toBeDefined();
      expect(result.events!["charge.refunded"]).toBeDefined();
      expect(result.events!["checkout.session.completed"]).toBeDefined();
    });

    it("composes user handlers with affiliate handlers", () => {
      const userHandler = vi.fn();

      const result = withAffiliates(mockComponent, {
        events: {
          "invoice.paid": userHandler,
          "custom.event": userHandler,
        },
      });

      expect(result.events).toBeDefined();
      // Affiliate events should still be present
      expect(result.events!["invoice.paid"]).toBeDefined();
      expect(result.events!["charge.refunded"]).toBeDefined();
      expect(result.events!["checkout.session.completed"]).toBeDefined();
      // Custom event should be added
      expect(result.events!["custom.event"]).toBeDefined();
    });

    it("passes through other options", () => {
      const result = withAffiliates(mockComponent, {
        someOption: "value",
        anotherOption: 123,
      });

      expect(result.someOption).toBe("value");
      expect(result.anotherOption).toBe(123);
    });

    it("invoice.paid handler calls createFromInvoice mutation", async () => {
      const mockCtx = {
        runMutation: vi.fn().mockResolvedValue({
          commissionId: "comm_123",
          affiliateId: "aff_123",
          affiliateCode: "CODE",
          commissionAmountCents: 1000,
        }),
        runQuery: vi.fn(),
      };

      const result = withAffiliates(mockComponent);
      const handler = result.events!["invoice.paid"];

      await handler(mockCtx, {
        type: "invoice.paid",
        data: {
          object: {
            id: "inv_123",
            customer: "cus_123",
            charge: "ch_123",
            subscription: "sub_123",
            amount_paid: 10000,
            currency: "usd",
            metadata: { affiliate_code: "CODE" },
            lines: { data: [{ price: { product: "prod_123" } }] },
          },
        },
      });

      expect(mockCtx.runMutation).toHaveBeenCalledWith(
        mockComponent.commissions.createFromInvoice,
        expect.objectContaining({
          stripeInvoiceId: "inv_123",
          stripeCustomerId: "cus_123",
          stripeChargeId: "ch_123",
          amountPaidCents: 10000,
          currency: "usd",
          affiliateCode: "CODE",
        })
      );
    });

    it("charge.refunded handler calls reverseByCharge mutation", async () => {
      const mockCtx = {
        runMutation: vi.fn().mockResolvedValue({
          commissionId: "comm_123",
          affiliateId: "aff_123",
          commissionAmountCents: 1000,
        }),
        runQuery: vi.fn(),
      };

      const result = withAffiliates(mockComponent);
      const handler = result.events!["charge.refunded"];

      await handler(mockCtx, {
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_123",
            refunds: { data: [{ reason: "requested_by_customer" }] },
          },
        },
      });

      expect(mockCtx.runMutation).toHaveBeenCalledWith(
        mockComponent.commissions.reverseByCharge,
        {
          stripeChargeId: "ch_123",
          reason: "requested_by_customer",
        }
      );
    });

    it("checkout.session.completed handler calls linkStripeCustomer mutation", async () => {
      const mockCtx = {
        runMutation: vi.fn().mockResolvedValue(null),
        runQuery: vi.fn(),
      };

      const result = withAffiliates(mockComponent);
      const handler = result.events!["checkout.session.completed"];

      await handler(mockCtx, {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            client_reference_id: "user_123",
            metadata: { affiliate_code: "CODE" },
          },
        },
      });

      expect(mockCtx.runMutation).toHaveBeenCalledWith(
        mockComponent.referrals.linkStripeCustomer,
        {
          stripeCustomerId: "cus_123",
          userId: "user_123",
          affiliateCode: "CODE",
        }
      );
    });

    it("calls onCommissionCreated callback when commission is created", async () => {
      const onCommissionCreated = vi.fn();
      const mockCtx = {
        runMutation: vi.fn().mockResolvedValue({
          commissionId: "comm_123",
          affiliateId: "aff_123",
          affiliateCode: "CODE",
          commissionAmountCents: 1000,
        }),
        runQuery: vi.fn(),
      };

      const result = withAffiliates(mockComponent, { onCommissionCreated });
      const handler = result.events!["invoice.paid"];

      await handler(mockCtx, {
        type: "invoice.paid",
        data: {
          object: {
            id: "inv_123",
            customer: "cus_123",
            amount_paid: 10000,
            currency: "usd",
            metadata: {},
            lines: { data: [] },
          },
        },
      });

      expect(onCommissionCreated).toHaveBeenCalledWith({
        commissionId: "comm_123",
        affiliateId: "aff_123",
        affiliateCode: "CODE",
        amountCents: 1000,
        currency: "usd",
      });
    });

    it("runs both affiliate and user handlers for same event", async () => {
      const userHandler = vi.fn();
      const mockCtx = {
        runMutation: vi.fn().mockResolvedValue(null),
        runQuery: vi.fn(),
      };

      const result = withAffiliates(mockComponent, {
        events: {
          "invoice.paid": userHandler,
        },
      });

      const handler = result.events!["invoice.paid"];

      await handler(mockCtx, {
        type: "invoice.paid",
        data: {
          object: {
            id: "inv_123",
            customer: "cus_123",
            amount_paid: 10000,
            currency: "usd",
            metadata: {},
            lines: { data: [] },
          },
        },
      });

      // Affiliate handler should have run (called mutation)
      expect(mockCtx.runMutation).toHaveBeenCalled();
      // User handler should also have run
      expect(userHandler).toHaveBeenCalled();
    });
  });

  describe("getAffiliateMetadata", () => {
    const mockComponent = {
      commissions: {
        createFromInvoice: "commissions.createFromInvoice",
        reverseByCharge: "commissions.reverseByCharge",
      },
      referrals: {
        linkStripeCustomer: "referrals.linkStripeCustomer",
        getByUserId: "referrals.getByUserId",
        getRefereeDiscount: "referrals.getRefereeDiscount",
      },
    } as unknown as ComponentApi;

    it("returns empty object when no user is authenticated", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue(null),
        },
        runQuery: vi.fn(),
        runMutation: vi.fn(),
      };

      const result = await getAffiliateMetadata(mockCtx, mockComponent);

      expect(result).toEqual({});
      expect(mockCtx.runQuery).not.toHaveBeenCalled();
    });

    it("returns userId and affiliate_code when user has a referral", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue({
          affiliateCode: "PARTNER",
        }),
        runMutation: vi.fn(),
      };

      const result = await getAffiliateMetadata(mockCtx, mockComponent);

      expect(result).toEqual({ userId: "user_123", affiliate_code: "PARTNER" });
      expect(mockCtx.runQuery).toHaveBeenCalledWith(
        mockComponent.referrals.getRefereeDiscount,
        { userId: "user_123" }
      );
    });

    it("returns only userId when user has no referral", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue(null),
        runMutation: vi.fn(),
      };

      const result = await getAffiliateMetadata(mockCtx, mockComponent);

      expect(result).toEqual({ userId: "user_123" });
    });

    it("returns only userId when referral has no affiliateCode", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue({
          discountType: "percentage",
          discountValue: 10,
        }),
        runMutation: vi.fn(),
      };

      const result = await getAffiliateMetadata(mockCtx, mockComponent);

      expect(result).toEqual({ userId: "user_123" });
    });

    it("returns userId even when query errors", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockRejectedValue(new Error("Query failed")),
        runMutation: vi.fn(),
      };

      // Should not throw, and should still return userId
      const result = await getAffiliateMetadata(mockCtx, mockComponent);

      expect(result).toEqual({ userId: "user_123" });
    });
  });
});
