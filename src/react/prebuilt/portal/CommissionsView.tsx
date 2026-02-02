"use client";

import * as React from "react";
import { CommissionHistory } from "../../AffiliatePortal.js";
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, EmptyState } from "../ui.js";

export function CommissionsView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Commissions</h2>
      <CommissionHistory>
        {({ commissions, isEmpty }) =>
          isEmpty ? (
            <EmptyState message="No commissions yet. Share your link to start earning!" />
          ) : (
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sale</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.date}</TableCell>
                      <TableCell>{c.saleAmount}</TableCell>
                      <TableCell className="font-medium">{c.commissionAmount}</TableCell>
                      <TableCell>
                        <Badge color={c.statusColor}>{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        }
      </CommissionHistory>
    </div>
  );
}
