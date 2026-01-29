"use client";

import * as React from "react";
import { CommissionHistory } from "../../AffiliatePortal.js";
import { Table, Thead, Th, Td, Badge, EmptyState } from "../ui.js";

export function CommissionsView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Commissions</h2>
      <CommissionHistory>
        {({ commissions, isEmpty }) =>
          isEmpty ? (
            <EmptyState message="No commissions yet. Share your link to start earning!" />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Sale</Th>
                    <Th>Commission</Th>
                    <Th>Status</Th>
                  </tr>
                </Thead>
                <tbody className="divide-y divide-gray-200">
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <Td>{c.date}</Td>
                      <Td>{c.saleAmount}</Td>
                      <Td className="font-medium">{c.commissionAmount}</Td>
                      <Td>
                        <Badge color={c.statusColor}>{c.status}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )
        }
      </CommissionHistory>
    </div>
  );
}
