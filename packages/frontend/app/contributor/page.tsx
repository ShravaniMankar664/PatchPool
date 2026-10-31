import type { Metadata } from "next";
import { RoleWorkspace } from "@/components/RoleWorkspace";

export const metadata: Metadata = { title: "Contributor workspace · PatchPool" };

export default function ContributorWorkspaceRoute() {
  return <RoleWorkspace role="contributor" />;
}
