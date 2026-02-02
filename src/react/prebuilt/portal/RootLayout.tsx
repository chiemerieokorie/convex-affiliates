"use client";

import * as React from "react";
import {
  AffiliatePortalProvider,
  type AffiliatePortalProviderProps,
} from "../../AffiliatePortal.js";

// =============================================================================
// RootLayout — wraps children with AffiliatePortalProvider
// =============================================================================

export type RootLayoutProps = Omit<AffiliatePortalProviderProps, "children"> & {
  children: React.ReactNode;
};

/**
 * Pre-wired layout that wraps its children with `AffiliatePortalProvider`.
 *
 * Usage in Next.js:
 * ```tsx
 * // app/(affiliates)/portal/layout.tsx
 * import { RootLayout } from "convex-affiliates/react/portal";
 *
 * export default function Layout({ children }: { children: React.ReactNode }) {
 *   const affiliate = …; // from your auth / Convex query
 *   const campaign   = …;
 *   return (
 *     <RootLayout affiliate={affiliate} campaign={campaign}>
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
    <AffiliatePortalProvider {...providerProps}>
      {children}
    </AffiliatePortalProvider>
  );
}
