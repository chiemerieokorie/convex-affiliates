"use client";

import * as React from "react";
import {
  AdminDashboardProvider,
  type AdminDashboardProviderProps,
} from "../../AdminDashboard.js";

// =============================================================================
// RootLayout — wraps children with AdminDashboardProvider
// =============================================================================

export type RootLayoutProps = Omit<AdminDashboardProviderProps, "children"> & {
  children: React.ReactNode;
};

/**
 * Pre-wired layout that wraps its children with `AdminDashboardProvider`.
 *
 * Usage in Next.js:
 * ```tsx
 * // app/(affiliates)/admin/layout.tsx
 * import { RootLayout } from "convex-affiliates/react/admin";
 *
 * export default function Layout({ children }: { children: React.ReactNode }) {
 *   const stats      = …; // from your Convex query
 *   const affiliates = …;
 *   return (
 *     <RootLayout stats={stats} affiliates={affiliates} onApprove={…} onReject={…}>
 *       {children}
 *     </RootLayout>
 *   );
 * }
 * ```
 */
export function RootLayout({
  children,
  ...providerProps
}: RootLayoutProps) {
  return (
    <AdminDashboardProvider {...providerProps}>
      {children}
    </AdminDashboardProvider>
  );
}
