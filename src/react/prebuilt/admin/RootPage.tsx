"use client";

import * as React from "react";
import { PageShell, SidebarNav, LoadingSpinner } from "../ui.js";
import { useAdminDashboardContext } from "../../AdminDashboard.js";
import { OverviewView } from "./OverviewView.js";
import { AffiliatesView } from "./AffiliatesView.js";
import { ApprovalsView } from "./ApprovalsView.js";
import { LeaderboardView } from "./LeaderboardView.js";
import { NotFoundPage } from "./NotFoundPage.js";

// =============================================================================
// Route definitions
// =============================================================================

const NAV_ITEMS = [
  { segment: "", label: "Overview" },
  { segment: "affiliates", label: "Affiliates" },
  { segment: "approvals", label: "Approvals" },
  { segment: "leaderboard", label: "Leaderboard" },
];

// =============================================================================
// Metadata
// =============================================================================

const segmentTitles: Record<string, string> = {
  "": "Overview",
  affiliates: "Affiliates",
  approvals: "Approvals",
  leaderboard: "Leaderboard",
};

export function generatePageMetadata(segments?: string[]) {
  const segment = segments?.[0] ?? "";
  const title = segmentTitles[segment] ?? "Not Found";
  return { title: `${title} | Admin Dashboard` };
}

// =============================================================================
// RootPage
// =============================================================================

export interface RootPageProps {
  /** The resolved segments param from Next.js catch-all route. */
  segments?: string[];
  /** Base path for navigation links. Defaults to "/admin". */
  basePath?: string;
  /** Title shown in the page shell. */
  title?: string;
}

export function RootPage({
  segments,
  basePath = "/admin",
  title = "Admin Dashboard",
}: RootPageProps) {
  const { isLoading } = useAdminDashboardContext();
  const activeSegment = segments?.[0] ?? "";

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const sidebar = (
    <SidebarNav items={NAV_ITEMS} activeSegment={activeSegment} basePath={basePath} />
  );

  const view = resolveView(activeSegment);

  return (
    <PageShell sidebar={sidebar} title={title}>
      {view ?? <NotFoundPage basePath={basePath} />}
    </PageShell>
  );
}

function resolveView(segment: string): React.ReactNode | null {
  switch (segment) {
    case "":
      return <OverviewView />;
    case "affiliates":
      return <AffiliatesView />;
    case "approvals":
      return <ApprovalsView />;
    case "leaderboard":
      return <LeaderboardView />;
    default:
      return null;
  }
}
