"use client";

import * as React from "react";
import { AffiliateStatsDisplay } from "../../AffiliatePortal.js";
import { AffiliateStatusBadge } from "../../AffiliatePortal.js";
import { CommissionRateDisplay } from "../../AffiliatePortal.js";
import { PendingPayoutDisplay } from "../../AffiliatePortal.js";
import { StatCard, Card, CardHeader, CardTitle, Badge } from "../ui.js";

export function DashboardView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <AffiliateStatusBadge>
          {({ statusLabel, statusColor }) => (
            <Badge color={statusColor}>{statusLabel}</Badge>
          )}
        </AffiliateStatusBadge>
      </div>

      <AffiliateStatsDisplay>
        {({ formatted }) => (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Clicks" value={formatted.totalClicks} />
            <StatCard label="Conversions" value={formatted.totalConversions} />
            <StatCard label="Conv. Rate" value={formatted.conversionRate} />
            <StatCard label="Earnings" value={formatted.totalCommissions} />
          </div>
        )}
      </AffiliateStatsDisplay>

      <div className="grid gap-4 sm:grid-cols-2">
        <PendingPayoutDisplay>
          {({ formattedAmount, commissionCount, hasPayoutPending }) => (
            <Card>
              <CardHeader>
                <CardTitle>Pending Payout</CardTitle>
              </CardHeader>
              {hasPayoutPending ? (
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {formattedAmount}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {commissionCount} commission{commissionCount !== 1 ? "s" : ""}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No pending payouts</p>
              )}
            </Card>
          )}
        </PendingPayoutDisplay>

        <CommissionRateDisplay>
          {({ campaignName, formattedRate, commissionType }) => (
            <Card>
              <CardHeader>
                <CardTitle>Commission Rate</CardTitle>
              </CardHeader>
              <p className="text-3xl font-bold text-gray-900">{formattedRate}</p>
              <p className="mt-1 text-sm text-gray-500">
                {commissionType === "percentage" ? "per sale" : "flat rate"} &middot;{" "}
                {campaignName}
              </p>
            </Card>
          )}
        </CommissionRateDisplay>
      </div>
    </div>
  );
}
