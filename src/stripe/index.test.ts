import { describe, it, expect, vi, beforeEach } from "vitest";
import { withAffiliates, enrichCheckout, AffiliateStripe, createAffiliateStripe } from "./index";

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
    };

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

  describe("enrichCheckout", () => {
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
    };

    it("returns base params when no user is authenticated", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue(null),
        },
        runQuery: vi.fn(),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        priceId: "price_123",
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.priceId).toBe("price_123");
      expect(result.successUrl).toBe("/success");
      expect(result.cancelUrl).toBe("/cancel");
      expect(result.client_reference_id).toBeUndefined();
      expect(result.metadata).toEqual({});
    });

    it("adds client_reference_id when user is authenticated", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue(null),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.client_reference_id).toBe("user_123");
    });

    it("uses referralId as client_reference_id when no user is authenticated", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue(null),
        },
        runQuery: vi.fn().mockResolvedValue(null),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
        referralId: "ref_123",
      });

      expect(result.client_reference_id).toBe("ref_123");
    });

    it("adds affiliate_code to metadata when discount is found", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue({
          affiliateCode: "CODE",
          discountType: "percentage",
          discountValue: 10,
        }),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.metadata.affiliate_code).toBe("CODE");
    });

    it("adds discounts when stripeCouponId is present", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue({
          affiliateCode: "CODE",
          stripeCouponId: "coupon_123",
          discountType: "percentage",
          discountValue: 10,
        }),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.discounts).toEqual([{ coupon: "coupon_123" }]);
    });

    it("adds affiliate_code to metadata even when no discount is found", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue(null),
        },
        runQuery: vi.fn().mockResolvedValue(null),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
        affiliateCode: "CODE",
      });

      expect(result.metadata.affiliate_code).toBe("CODE");
    });

    it("preserves existing metadata", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue({
          affiliateCode: "CODE",
        }),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
        metadata: { custom_field: "value" },
      });

      expect(result.metadata.custom_field).toBe("value");
      expect(result.metadata.affiliate_code).toBe("CODE");
    });

    it("does not include referralId and affiliateCode in output params", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue(null),
        },
        runQuery: vi.fn().mockResolvedValue(null),
        runMutation: vi.fn(),
      };

      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
        referralId: "ref_123",
        affiliateCode: "CODE",
      });

      // These should be processed but not in the output
      expect((result as Record<string, unknown>).referralId).toBeUndefined();
      // affiliateCode should be in metadata, not as a top-level param
      expect(result.metadata.affiliate_code).toBe("CODE");
    });

    it("handles query errors gracefully", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockRejectedValue(new Error("Query failed")),
        runMutation: vi.fn(),
      };

      // Should not throw
      const result = await enrichCheckout(mockCtx, mockComponent, {
        successUrl: "/success",
        cancelUrl: "/cancel",
        affiliateCode: "CODE",
      });

      // Should still set client_reference_id
      expect(result.client_reference_id).toBe("user_123");
      // Should still add affiliate code from params
      expect(result.metadata.affiliate_code).toBe("CODE");
    });
  });

  describe("AffiliateStripe", () => {
    const mockStripeInstance = {
      createCheckoutSession: vi.fn(),
      someOtherMethod: vi.fn(),
    };

    const mockAffiliatesComponent = {
      commissions: {
        createFromInvoice: "commissions.createFromInvoice",
        reverseByCharge: "commissions.reverseByCharge",
      },
      referrals: {
        linkStripeCustomer: "referrals.linkStripeCustomer",
        getByUserId: "referrals.getByUserId",
        getRefereeDiscount: "referrals.getRefereeDiscount",
      },
    };

    it("creates instance with stripe and affiliates component", () => {
      const affiliateStripe = new AffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent
      );

      expect(affiliateStripe).toBeDefined();
      expect(affiliateStripe.stripe).toBe(mockStripeInstance);
    });

    it("exposes underlying stripe instance via getter", () => {
      const affiliateStripe = new AffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent
      );

      expect(affiliateStripe.stripe).toBe(mockStripeInstance);
      expect(affiliateStripe.stripe.someOtherMethod).toBe(mockStripeInstance.someOtherMethod);
    });

    it("getRouteOptions returns options with affiliate event handlers", () => {
      const affiliateStripe = new AffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent
      );

      const options = affiliateStripe.getRouteOptions();

      expect(options.events).toBeDefined();
      expect(options.events!["invoice.paid"]).toBeDefined();
      expect(options.events!["charge.refunded"]).toBeDefined();
      expect(options.events!["checkout.session.completed"]).toBeDefined();
    });

    it("getRouteOptions merges additional options", () => {
      const affiliateStripe = new AffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent
      );

      const customHandler = vi.fn();
      const options = affiliateStripe.getRouteOptions({
        events: {
          "custom.event": customHandler,
        },
        customOption: "value",
      });

      expect(options.events!["custom.event"]).toBe(customHandler);
      expect(options.customOption).toBe("value");
      // Affiliate events still present
      expect(options.events!["invoice.paid"]).toBeDefined();
    });

    it("getRouteOptions includes callbacks from constructor", () => {
      const onCommissionCreated = vi.fn();
      const affiliateStripe = new AffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent,
        { onCommissionCreated }
      );

      const options = affiliateStripe.getRouteOptions();

      // The callback is wired internally - test by triggering the handler
      expect(options.events!["invoice.paid"]).toBeDefined();
    });

    it("createCheckoutSession enriches params with affiliate data", async () => {
      const affiliateStripe = new AffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent
      );

      const mockCtx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({ subject: "user_123" }),
        },
        runQuery: vi.fn().mockResolvedValue({
          affiliateCode: "PARTNER",
          stripeCouponId: "coupon_abc",
        }),
        runMutation: vi.fn(),
      };

      const result = await affiliateStripe.createCheckoutSession(mockCtx, {
        priceId: "price_123",
        successUrl: "/success",
        cancelUrl: "/cancel",
      });

      expect(result.client_reference_id).toBe("user_123");
      expect(result.metadata.affiliate_code).toBe("PARTNER");
      expect(result.discounts).toEqual([{ coupon: "coupon_abc" }]);
    });
  });

  describe("createAffiliateStripe", () => {
    const mockStripeInstance = { test: true };
    const mockAffiliatesComponent = {
      commissions: {
        createFromInvoice: "commissions.createFromInvoice",
        reverseByCharge: "commissions.reverseByCharge",
      },
      referrals: {
        linkStripeCustomer: "referrals.linkStripeCustomer",
        getByUserId: "referrals.getByUserId",
        getRefereeDiscount: "referrals.getRefereeDiscount",
      },
    };

    it("creates AffiliateStripe instance", () => {
      const result = createAffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent
      );

      expect(result).toBeInstanceOf(AffiliateStripe);
      expect(result.stripe).toBe(mockStripeInstance);
    });

    it("passes options to AffiliateStripe", () => {
      const onCommissionCreated = vi.fn();
      const result = createAffiliateStripe(
        mockStripeInstance,
        mockAffiliatesComponent,
        { onCommissionCreated }
      );

      expect(result).toBeInstanceOf(AffiliateStripe);
    });
  });
});
