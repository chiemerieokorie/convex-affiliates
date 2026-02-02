"use client";

import * as React from "react";
import { TopAffiliatesLeaderboard } from "../../AdminDashboard.js";
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from "../ui.js";

export function LeaderboardView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Top Affiliates</h2>

      <TopAffiliatesLeaderboard>
        {({ affiliates, isEmpty }) =>
          isEmpty ? (
            <EmptyState message="No affiliate data yet." />
          ) : (
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Conversions</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Commissions</TableHead>
                    <TableHead>Conv. Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {a.rank}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{a.displayName}</p>
                          <code className="text-xs text-muted-foreground">{a.code}</code>
                        </div>
                      </TableCell>
                      <TableCell>{a.conversions}</TableCell>
                      <TableCell>{a.revenue}</TableCell>
                      <TableCell>{a.commissions}</TableCell>
                      <TableCell>{a.conversionRate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        }
      </TopAffiliatesLeaderboard>
    </div>
  );
}
