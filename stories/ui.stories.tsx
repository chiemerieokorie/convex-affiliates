import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Badge,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  LoadingSpinner,
  SidebarNav,
  ProgressBar,
} from "../src/react/prebuilt/ui";

// =============================================================================
// Badge
// =============================================================================

const badgeMeta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
};

export default badgeMeta;

export const AllBadgeVariants: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge color="default">Default</Badge>
      <Badge color="secondary">Secondary</Badge>
      <Badge color="destructive">Destructive</Badge>
      <Badge color="outline">Outline</Badge>
      <Badge color="green">Approved</Badge>
      <Badge color="yellow">Pending</Badge>
      <Badge color="red">Rejected</Badge>
      <Badge color="blue">Processing</Badge>
      <Badge color="gray">Inactive</Badge>
    </div>
  ),
};

// =============================================================================
// Button
// =============================================================================

export const AllButtonVariants: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  ),
};

// =============================================================================
// Card
// =============================================================================

export const Cards: StoryObj = {
  render: () => (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Simple Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This is a basic card with header and content.
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Clicks" value="1,234" />
        <StatCard label="Revenue" value="$5,678" description="+12% from last month" />
        <StatCard label="Conversions" value="89" />
      </div>
    </div>
  ),
};

// =============================================================================
// Input
// =============================================================================

export const Inputs: StoryObj = {
  render: () => (
    <div className="max-w-sm space-y-3">
      <Input placeholder="Default input" />
      <Input value="With value" readOnly />
      <Input disabled placeholder="Disabled" />
      <div className="flex gap-2">
        <Input placeholder="With button" className="font-mono" />
        <Button>Copy</Button>
      </div>
    </div>
  ),
};

// =============================================================================
// Table
// =============================================================================

export const Tables: StoryObj = {
  render: () => (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { name: "Alice", status: "approved", revenue: "$1,200" },
            { name: "Bob", status: "pending", revenue: "$340" },
            { name: "Charlie", status: "rejected", revenue: "$0" },
          ].map((row) => (
            <TableRow key={row.name}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>
                <Badge
                  color={
                    row.status === "approved"
                      ? "green"
                      : row.status === "pending"
                        ? "yellow"
                        : "red"
                  }
                >
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell>{row.revenue}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline">
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  ),
};

// =============================================================================
// Empty State & Loading
// =============================================================================

export const States: StoryObj = {
  render: () => (
    <div className="max-w-md space-y-6">
      <EmptyState message="No commissions yet. Share your link to start earning!" />
      <LoadingSpinner />
    </div>
  ),
};

// =============================================================================
// Sidebar Nav
// =============================================================================

export const Navigation: StoryObj = {
  render: () => (
    <div className="w-56">
      <SidebarNav
        items={[
          { segment: "", label: "Dashboard" },
          { segment: "commissions", label: "Commissions" },
          { segment: "payouts", label: "Payouts" },
          { segment: "links", label: "Referral Links" },
        ]}
        activeSegment="commissions"
        basePath="/portal"
      />
    </div>
  ),
};

// =============================================================================
// Progress Bar
// =============================================================================

export const ProgressBars: StoryObj = {
  render: () => (
    <div className="max-w-md space-y-4">
      {[100, 72, 45, 12, 0].map((v) => (
        <div key={v}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{v}%</span>
          </div>
          <ProgressBar value={v} />
        </div>
      ))}
    </div>
  ),
};
