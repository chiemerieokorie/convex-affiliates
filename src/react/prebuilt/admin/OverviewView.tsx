"use client";

import * as React from "react";
import { OverviewStats } from "../../AdminDashboard.js";
import { ConversionFunnel } from "../../AdminDashboard.js";
import { PayoutSummary } from "../../AdminDashboard.js";
import { StatCard, Card, CardHeader, CardTitle } from "../ui.js";

export function OverviewView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Overview</h2>

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
              <div className="space-y-4">
                {funnel.map((stage) => (
                  <div key={stage.stage}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {stage.stage}
                      </span>
                      <span className="text-gray-500">
                        {stage.formattedCount} ({stage.formattedPercentage})
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Overall conversion rate: {rates.overall.toFixed(1)}%
                </p>
              </div>
            </Card>
          )}
        </ConversionFunnel>

        <PayoutSummary>
          {({ pendingAmount, paidAmount, totalAmount }) => (
            <Card>
              <CardHeader>
                <CardTitle>Payout Summary</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pending</span>
                  <span className="font-medium text-yellow-600">
                    {pendingAmount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paid</span>
                  <span className="font-medium text-green-600">{paidAmount}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{totalAmount}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </PayoutSummary>
      </div>
    </div>
  );
}
