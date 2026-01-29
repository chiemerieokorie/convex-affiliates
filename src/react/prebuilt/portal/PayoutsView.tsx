"use client";

import * as React from "react";
import { useAffiliatePortalContext } from "../../AffiliatePortal.js";
import { PayoutHistory } from "../../AffiliatePortal.js";
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, EmptyState } from "../ui.js";
import type { PayoutItem } from "../../AffiliatePortal.js";

export function PayoutsView({ payouts = [] }: { payouts?: PayoutItem[] }) {
  const ctx = useAffiliatePortalContext();
  const items: PayoutItem[] = payouts.length > 0 ? payouts : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Payouts</h2>
      <PayoutHistory payouts={items}>
        {({ payouts: formatted, isEmpty }) =>
          isEmpty ? (
            <EmptyState message="No payouts yet." />
          ) : (
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formatted.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="font-medium">{p.amount}</TableCell>
                      <TableCell>
                        <Badge color={p.statusColor}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>{p.completedDate ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        }
      </PayoutHistory>
    </div>
  );
}
