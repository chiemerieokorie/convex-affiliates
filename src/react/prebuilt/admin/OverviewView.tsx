"use client";

import * as React from "react";
import { OverviewStats } from "../../AdminDashboard.js";
import { ConversionFunnel } from "../../AdminDashboard.js";
import { PayoutSummary } from "../../AdminDashboard.js";
import { StatCard, Card, CardHeader, CardTitle, CardContent, ProgressBar } from "../ui.js";

export function OverviewView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Overview</h2>

      <OverviewStats>
        {({ metrics }) => (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {metrics.map((m) => (
              <StatCard key={m.key} label={m.label} value={m.value} />
            ))}
          </div>
        )}
      </OverviewStats>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionFunnel>
          {({ funnel, rates }) => (
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {funnel.map((stage) => (
                  <div key={stage.stage}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{stage.stage}</span>
                      <span className="text-muted-foreground">
                        {stage.formattedCount} ({stage.formattedPercentage})
                      </span>
                    </div>
                    <ProgressBar value={stage.percentage} />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Overall conversion rate: {rates.overall.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          )}
        </ConversionFunnel>

        <PayoutSummary>
          {({ pendingAmount, paidAmount, totalAmount }) => (
            <Card>
              <CardHeader>
                <CardTitle>Payout Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {pendingAmount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {paidAmount}
                  </span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total</span>
                    <span>{totalAmount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </PayoutSummary>
      </div>
    </div>
  );
}
