import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { AdminWrapper } from "./helpers";
import { RootPage } from "../src/react/prebuilt/admin/RootPage";
import { NotFoundPage } from "../src/react/prebuilt/admin/NotFoundPage";
import { OverviewView } from "../src/react/prebuilt/admin/OverviewView";
import { AffiliatesView } from "../src/react/prebuilt/admin/AffiliatesView";
import { ApprovalsView } from "../src/react/prebuilt/admin/ApprovalsView";
import { LeaderboardView } from "../src/react/prebuilt/admin/LeaderboardView";
import { CampaignsView } from "../src/react/prebuilt/admin/CampaignsView";

const meta: Meta = {
  title: "Admin",
  decorators: [(Story) => <AdminWrapper><Story /></AdminWrapper>],
  parameters: { layout: "fullscreen" },
};

export default meta;

// =============================================================================
// Full RootPage — each segment
// =============================================================================

export const Overview: StoryObj = {
  name: "RootPage / Overview",
  render: () => <RootPage segments={[]} basePath="/admin" />,
};

export const Affiliates: StoryObj = {
  name: "RootPage / Affiliates",
  render: () => <RootPage segments={["affiliates"]} basePath="/admin" />,
};

export const Approvals: StoryObj = {
  name: "RootPage / Approvals",
  render: () => <RootPage segments={["approvals"]} basePath="/admin" />,
};

export const Leaderboard: StoryObj = {
  name: "RootPage / Leaderboard",
  render: () => <RootPage segments={["leaderboard"]} basePath="/admin" />,
};

export const Campaigns: StoryObj = {
  name: "RootPage / Campaigns",
  render: () => <RootPage segments={["campaigns"]} basePath="/admin" />,
};

export const NotFound: StoryObj = {
  name: "RootPage / 404",
  render: () => <RootPage segments={["unknown-route"]} basePath="/admin" />,
};

// =============================================================================
// Individual views (standalone)
// =============================================================================

export const OverviewViewStory: StoryObj = {
  name: "Views / Overview",
  render: () => <OverviewView />,
};

export const AffiliatesViewStory: StoryObj = {
  name: "Views / Affiliates",
  render: () => <AffiliatesView />,
};

export const ApprovalsViewStory: StoryObj = {
  name: "Views / Approvals",
  render: () => <ApprovalsView />,
};

export const LeaderboardViewStory: StoryObj = {
  name: "Views / Leaderboard",
  render: () => <LeaderboardView />,
};

export const CampaignsViewStory: StoryObj = {
  name: "Views / Campaigns",
  render: () => <CampaignsView />,
};

export const NotFoundPageStory: StoryObj = {
  name: "Views / NotFoundPage",
  render: () => <NotFoundPage basePath="/admin" />,
};
