import type { Metadata } from "next";
import BountyDetailPage from "@/components/BountyDetailPage";

export const metadata: Metadata = {
  title: "Bounty details · PatchPool",
  description: "Review the verified terms, reward, roles, submissions, and current state of a PatchPool bounty.",
};

export default async function BountyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BountyDetailPage bountyId={id} />;
}
