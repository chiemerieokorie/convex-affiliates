import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { PortalWrapper, mockCommissions } from "./helpers";
import { RootPage } from "../src/react/prebuilt/portal/RootPage";
import { NotFoundPage } from "../src/react/prebuilt/portal/NotFoundPage";
import { DashboardView } from "../src/react/prebuilt/portal/DashboardView";
import { CommissionsView } from "../src/react/prebuilt/portal/CommissionsView";
import { PayoutsView } from "../src/react/prebuilt/portal/PayoutsView";
import { LinksView } from "../src/react/prebuilt/portal/LinksView";

const meta: Meta = {
  title: "Portal",
  decorators: [(Story) => <PortalWrapper><Story /></PortalWrapper>],
  parameters: { layout: "fullscreen" },
};

export default meta;

// =============================================================================
// Full RootPage — each segment
// =============================================================================

export const Dashboard: StoryObj = {
  name: "RootPage / Dashboard",
  render: () => <RootPage segments={[]} basePath="/portal" />,
};

export const Commissions: StoryObj = {
  name: "RootPage / Commissions",
  render: () => <RootPage segments={["commissions"]} basePath="/portal" />,
};

export const Payouts: StoryObj = {
  name: "RootPage / Payouts",
  render: () => <RootPage segments={["payouts"]} basePath="/portal" payouts={[]} />,
};

export const Links: StoryObj = {
  name: "RootPage / Links",
  render: () => <RootPage segments={["links"]} basePath="/portal" />,
};

export const NotFound: StoryObj = {
  name: "RootPage / 404",
  render: () => <RootPage segments={["unknown-route"]} basePath="/portal" />,
};

// =============================================================================
// Individual views (standalone)
// =============================================================================

export const DashboardViewStory: StoryObj = {
  name: "Views / Dashboard",
  render: () => <DashboardView />,
};

export const CommissionsViewStory: StoryObj = {
  name: "Views / Commissions",
  render: () => <CommissionsView />,
};

export const PayoutsViewStory: StoryObj = {
  name: "Views / Payouts (Empty)",
  render: () => <PayoutsView payouts={[]} />,
};

export const LinksViewStory: StoryObj = {
  name: "Views / Links",
  render: () => <LinksView />,
};

export const NotFoundPageStory: StoryObj = {
  name: "Views / NotFoundPage",
  render: () => <NotFoundPage basePath="/portal" />,
};
