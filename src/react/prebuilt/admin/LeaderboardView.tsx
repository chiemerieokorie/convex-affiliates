"use client";

import * as React from "react";
import { TopAffiliatesLeaderboard } from "../../AdminDashboard.js";
import { Table, Thead, Th, Td, EmptyState } from "../ui.js";

export function LeaderboardView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Top Affiliates</h2>

      <TopAffiliatesLeaderboard>
        {({ affiliates, isEmpty }) =>
          isEmpty ? (
            <EmptyState message="No affiliate data yet." />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <Table>
                <Thead>
                  <tr>
                    <Th>Rank</Th>
                    <Th>Affiliate</Th>
                    <Th>Conversions</Th>
                    <Th>Revenue</Th>
                    <Th>Commissions</Th>
                    <Th>Conv. Rate</Th>
                  </tr>
                </Thead>
                <tbody className="divide-y divide-gray-200">
                  {affiliates.map((a) => (
                    <tr key={a.id}>
                      <Td>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {a.rank}
                        </span>
                      </Td>
                      <Td>
                        <div>
                          <p className="font-medium text-gray-900">
                            {a.displayName}
                          </p>
                          <code className="text-xs text-gray-500">{a.code}</code>
                        </div>
                      </Td>
                      <Td>{a.conversions}</Td>
                      <Td>{a.revenue}</Td>
                      <Td>{a.commissions}</Td>
                      <Td>{a.conversionRate}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )
        }
      </TopAffiliatesLeaderboard>
    </div>
  );
}
