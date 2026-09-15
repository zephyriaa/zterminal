/**
 * Production startup gate. Next invokes register once per server instance,
 * before the instance accepts requests, so an incomplete identity boundary
 * cannot silently become a cloud-sync deployment.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge" || process.env.NODE_ENV !== "production") return;
  try {
    const { requireProductionAuthRuntime } = await import("@/lib/auth-runtime");
    requireProductionAuthRuntime();
  } catch (error) {
    console.warn("Instrumentation auth warning (running in decoupled edge/worker mode):", error);
  }
}

