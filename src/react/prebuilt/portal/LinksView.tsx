"use client";

import * as React from "react";
import { AffiliateLinkGenerator } from "../../AffiliatePortal.js";
import { StripeConnectStatus } from "../../AffiliatePortal.js";
import { Card, CardHeader, CardTitle, Badge, Button } from "../ui.js";

export function LinksView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Referral Links</h2>

      <AffiliateLinkGenerator>
        {({ code, generateLink, copyLink, copied }) => {
          const defaultLink = generateLink("/");
          return (
            <Card>
              <CardHeader>
                <CardTitle>Your Referral Link</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Affiliate Code
                  </label>
                  <p className="mt-1 font-mono text-sm text-gray-900">{code}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Link
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={defaultLink}
                      className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Button
                      variant={copied ? "success" : "primary"}
                      onClick={() => copyLink(defaultLink)}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        }}
      </AffiliateLinkGenerator>

      <StripeConnectStatus>
        {({ statusLabel, canReceivePayouts, needsOnboarding }) => (
          <Card>
            <CardHeader>
              <CardTitle>Payout Account</CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3">
              <Badge color={canReceivePayouts ? "green" : needsOnboarding ? "yellow" : "gray"}>
                {statusLabel}
              </Badge>
              {needsOnboarding && (
                <p className="text-sm text-gray-500">
                  Connect your Stripe account to receive payouts.
                </p>
              )}
            </div>
          </Card>
        )}
      </StripeConnectStatus>
    </div>
  );
}
