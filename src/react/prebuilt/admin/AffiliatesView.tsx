"use client";

import * as React from "react";
import { AffiliateTable } from "../../AdminDashboard.js";
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button, EmptyState } from "../ui.js";

export function AffiliatesView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Affiliates</h2>

      <AffiliateTable>
        {({ affiliates, isEmpty, onApprove, onReject, onSuspend }) =>
          isEmpty ? (
            <EmptyState message="No affiliates registered yet." />
          ) : (
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Conv.</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Commissions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{a.displayName}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {a.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge color={a.statusColor}>{a.status}</Badge>
                      </TableCell>
                      <TableCell>{a.clicks}</TableCell>
                      <TableCell>{a.conversions}</TableCell>
                      <TableCell>{a.revenue}</TableCell>
                      <TableCell>{a.commissions}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {a.status === "pending" && onApprove && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => onApprove(a.id)}
                            >
                              Approve
                            </Button>
                          )}
                          {a.status === "pending" && onReject && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => onReject(a.id)}
                            >
                              Reject
                            </Button>
                          )}
                          {a.status === "approved" && onSuspend && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onSuspend(a.id)}
                            >
                              Suspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        }
      </AffiliateTable>
    </div>
  );
}
