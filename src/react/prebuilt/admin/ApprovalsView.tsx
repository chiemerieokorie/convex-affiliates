"use client";

import * as React from "react";
import { PendingApprovals } from "../../AdminDashboard.js";
import { Card, CardContent, Button, EmptyState } from "../ui.js";

export function ApprovalsView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Pending Approvals</h2>

      <PendingApprovals>
        {({ pendingAffiliates, isEmpty, onApprove, onReject }) =>
          isEmpty ? (
            <EmptyState message="No pending approvals." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pendingAffiliates.map((a) => (
                <Card key={a.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{a.displayName}</p>
                        <p className="text-sm text-muted-foreground">{a.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          Applied {a.appliedDateRelative}
                        </p>
                      </div>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {a.code}
                      </code>
                    </div>
                    <div className="mt-4 flex gap-2">
                      {onApprove && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => onApprove(a.id)}
                        >
                          Approve
                        </Button>
                      )}
                      {onReject && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onReject(a.id)}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        }
      </PendingApprovals>
    </div>
  );
}
