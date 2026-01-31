"use client";

import * as React from "react";
import { Button } from "../ui.js";

export function NotFoundPage({ basePath = "/admin" }: { basePath?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">Page not found</p>
        <a href={basePath} className="mt-6 inline-block">
          <Button>Back to Dashboard</Button>
        </a>
      </div>
    </div>
  );
}
