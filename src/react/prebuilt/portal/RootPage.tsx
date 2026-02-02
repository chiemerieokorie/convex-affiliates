"use client";

import * as React from "react";
import { PageShell, SidebarNav, LoadingSpinner } from "../ui.js";
import { useAffiliatePortalContext } from "../../AffiliatePortal.js";
import { DashboardView } from "./DashboardView.js";
import { CommissionsView } from "./CommissionsView.js";
import { PayoutsView } from "./PayoutsView.js";
import { LinksView } from "./LinksView.js";
import { NotFoundPage } from "./NotFoundPage.js";
import type { PayoutItem } from "../../AffiliatePortal.js";

// =============================================================================
// Route definitions
// =============================================================================

const NAV_ITEMS = [
  { segment: "", label: "Dashboard" },
  { segment: "commissions", label: "Commissions" },
  { segment: "payouts", label: "Payouts" },
  { segment: "links", label: "Referral Links" },
];

// =============================================================================
// Metadata
// =============================================================================

const segmentTitles: Record<string, string> = {
  "": "Dashboard",
  commissions: "Commissions",
  payouts: "Payouts",
  links: "Referral Links",
};

export function generatePageMetadata(segments?: string[]) {
  const segment = segments?.[0] ?? "";
  const title = segmentTitles[segment] ?? "Not Found";
  return { title: `${title} | Affiliate Portal` };
}

// =============================================================================
// RootPage
// =============================================================================

export interface RootPageProps {
  /** The resolved segments param from Next.js catch-all route. */
  segments?: string[];
  /** Base path for navigation links. Defaults to "/portal". */
  basePath?: string;
  /** Title shown in the page shell. */
  title?: string;
  /** Payout items for the payouts view. */
  payouts?: PayoutItem[];
}

export function RootPage({
  segments,
  basePath = "/portal",
  title = "Affiliate Portal",
  payouts,
}: RootPageProps) {
  const { isLoading } = useAffiliatePortalContext();
  const activeSegment = segments?.[0] ?? "";

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const sidebar = (
    <SidebarNav items={NAV_ITEMS} activeSegment={activeSegment} basePath={basePath} />
  );

  const view = resolveView(activeSegment, { payouts });

  return (
    <PageShell sidebar={sidebar} title={title}>
      {view ?? <NotFoundPage basePath={basePath} />}
    </PageShell>
  );
}

function resolveView(
  segment: string,
  opts: { payouts?: PayoutItem[] }
): React.ReactNode | null {
  switch (segment) {
    case "":
      return <DashboardView />;
    case "commissions":
      return <CommissionsView />;
    case "payouts":
      return <PayoutsView payouts={opts.payouts} />;
    case "links":
      return <LinksView />;
    default:
      return null;
  }
}
