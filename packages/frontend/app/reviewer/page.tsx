import type { Metadata } from "next";
import { RoleWorkspace } from "@/components/RoleWorkspace";

export const metadata: Metadata = { title: "Reviewer workspace · PatchPool" };

export default function ReviewerWorkspaceRoute() {
  return <RoleWorkspace role="reviewer" />;
}
