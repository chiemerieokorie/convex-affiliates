"use client";

import * as React from "react";
import { AffiliateLinkGenerator } from "../../AffiliatePortal.js";
import { StripeConnectStatus } from "../../AffiliatePortal.js";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input } from "../ui.js";

export function LinksView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Referral Links</h2>

      <AffiliateLinkGenerator>
        {({ code, generateLink, copyLink, copied }) => {
          const defaultLink = generateLink("/");
          return (
            <Card>
              <CardHeader>
                <CardTitle>Your Referral Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Affiliate Code
                  </label>
                  <p className="mt-1 font-mono text-sm">{code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Default Link
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      type="text"
                      readOnly
                      value={defaultLink}
                      className="font-mono"
                    />
                    <Button
                      variant={copied ? "success" : "primary"}
                      onClick={() => copyLink(defaultLink)}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
              </CardContent>
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
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge color={canReceivePayouts ? "green" : needsOnboarding ? "yellow" : "gray"}>
                  {statusLabel}
                </Badge>
                {needsOnboarding && (
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account to receive payouts.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </StripeConnectStatus>
    </div>
  );
}
