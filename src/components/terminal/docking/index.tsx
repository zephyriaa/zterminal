import dynamic from "next/dynamic";

// Force client-side rendering only to prevent SSR mismatches in Cloudflare Workers
export const DynamicWorkspaceDock = dynamic(
  () => import("./workspace-dock").then(mod => mod.WorkspaceDock),
  { ssr: false, loading: () => <div className="h-full w-full bg-background animate-pulse" /> }
);
