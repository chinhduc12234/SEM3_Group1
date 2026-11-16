"use client";

import { createContext, useContext } from "react";
import type { Workspace } from "@/features/organizations/types/workspace";

export const WorkspaceContext = createContext<{
  data: Workspace;
  reload: () => Promise<void>;
} | null>(null);

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace)
    throw new Error("WorkspaceContext is required to use the organization workspace.");
  return workspace;
}
