"use client";

import * as React from "react";
import { CampaignStats } from "../../AdminDashboard.js";
import { Card, CardHeader, CardTitle, CardContent, StatCard, EmptyState } from "../ui.js";

export function CampaignsView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Campaigns</h2>

      <CampaignStats>
        {({ activeCampaigns, formattedActiveCampaigns }) =>
          activeCampaigns === 0 ? (
            <EmptyState message="No active campaigns." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Active Campaigns"
                  value={formattedActiveCampaigns}
                />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Manage your campaigns from the Convex dashboard or via the
                    API. Each campaign can have its own commission structure,
                    payout terms, and product-specific overrides.
                  </p>
                </CardContent>
              </Card>
            </div>
          )
        }
      </CampaignStats>
    </div>
  );
}
