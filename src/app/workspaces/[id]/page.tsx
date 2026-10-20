import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkspaceClient } from "@/components/workspaces/workspace-client";
export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return <WorkspaceClient id={id} />;
}
