import { redirect } from "next/navigation";

export default async function TerminalEntry({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const source = await searchParams, params = new URLSearchParams();
  for (const key of ["account", "error"]) if (typeof source[key] === "string") params.set(key, source[key]);
  redirect(`/workspaces${params.size ? `?${params}` : ""}`);
}
