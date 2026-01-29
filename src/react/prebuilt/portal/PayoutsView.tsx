"use client";

import * as React from "react";
import { useAffiliatePortalContext } from "../../AffiliatePortal.js";
import { PayoutHistory } from "../../AffiliatePortal.js";
import { Table, Thead, Th, Td, Badge, EmptyState } from "../ui.js";
import type { PayoutItem } from "../../AffiliatePortal.js";

export function PayoutsView({ payouts = [] }: { payouts?: PayoutItem[] }) {
  const ctx = useAffiliatePortalContext();
  // If no explicit payouts prop, show empty state guidance
  const items: PayoutItem[] = payouts.length > 0 ? payouts : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Payouts</h2>
      <PayoutHistory payouts={items}>
        {({ payouts: formatted, isEmpty }) =>
          isEmpty ? (
            <EmptyState message="No payouts yet." />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Completed</Th>
                  </tr>
                </Thead>
                <tbody className="divide-y divide-gray-200">
                  {formatted.map((p) => (
                    <tr key={p.id}>
                      <Td>{p.date}</Td>
                      <Td className="font-medium">{p.amount}</Td>
                      <Td>
                        <Badge color={p.statusColor}>{p.status}</Badge>
                      </Td>
                      <Td>{p.completedDate ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )
        }
      </PayoutHistory>
    </div>
  );
}
