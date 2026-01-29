"use client";

import * as React from "react";
import { AffiliateTable } from "../../AdminDashboard.js";
import { Table, Thead, Th, Td, Badge, Button, EmptyState } from "../ui.js";

export function AffiliatesView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Affiliates</h2>

      <AffiliateTable>
        {({ affiliates, isEmpty, onApprove, onReject, onSuspend }) =>
          isEmpty ? (
            <EmptyState message="No affiliates registered yet." />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <Table>
                <Thead>
                  <tr>
                    <Th>Affiliate</Th>
                    <Th>Code</Th>
                    <Th>Status</Th>
                    <Th>Clicks</Th>
                    <Th>Conv.</Th>
                    <Th>Revenue</Th>
                    <Th>Commissions</Th>
                    <Th>Actions</Th>
                  </tr>
                </Thead>
                <tbody className="divide-y divide-gray-200">
                  {affiliates.map((a) => (
                    <tr key={a.id}>
                      <Td>
                        <div>
                          <p className="font-medium text-gray-900">
                            {a.displayName}
                          </p>
                          <p className="text-xs text-gray-500">{a.email}</p>
                        </div>
                      </Td>
                      <Td>
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                          {a.code}
                        </code>
                      </Td>
                      <Td>
                        <Badge color={a.statusColor}>{a.status}</Badge>
                      </Td>
                      <Td>{a.clicks}</Td>
                      <Td>{a.conversions}</Td>
                      <Td>{a.revenue}</Td>
                      <Td>{a.commissions}</Td>
                      <Td>
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
                              variant="secondary"
                              onClick={() => onSuspend(a.id)}
                            >
                              Suspend
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )
        }
      </AffiliateTable>
    </div>
  );
}
