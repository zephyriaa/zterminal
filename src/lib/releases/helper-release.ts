import { z } from "zod";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const helperReleaseSchema = z.object({
  version: z.string().regex(SEMVER_PATTERN).optional(),
  download_url: z.string().url(),
  platform: z.literal("windows").default("windows"),
  architecture: z.literal("x64").default("x64"),
});

export type HelperRelease = z.infer<typeof helperReleaseSchema>;
export type HelperReleaseResolution =
  | { available: true; release: HelperRelease }
  | { available: false; reason: "HELPER_RELEASE_NOT_CONFIGURED" | "HELPER_RELEASE_CONFIGURATION_INVALID" };

/**
 * The local-research helper is a separate artifact from the desktop workstation.
 * It intentionally has its own release record so a desktop package can never be
 * presented as a Helper installer by accident.
 */
export function resolveHelperRelease(env: NodeJS.ProcessEnv = process.env): HelperReleaseResolution {
  const raw = env.ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON;
  const allowedHosts = new Set(
    (env.ZTERMINAL_HELPER_RELEASE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!raw || allowedHosts.size === 0) return { available: false, reason: "HELPER_RELEASE_NOT_CONFIGURED" };

  try {
    const parsed = helperReleaseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { available: false, reason: "HELPER_RELEASE_CONFIGURATION_INVALID" };
    const url = new URL(parsed.data.download_url);
    const path = url.pathname.toLowerCase();
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase()) || ![".exe", ".msix"].some((suffix) => path.endsWith(suffix))) {
      return { available: false, reason: "HELPER_RELEASE_CONFIGURATION_INVALID" };
    }
    return { available: true, release: parsed.data };
  } catch {
    return { available: false, reason: "HELPER_RELEASE_CONFIGURATION_INVALID" };
  }
}

/** Public, credential-free release metadata for the in-terminal download action. */
export function publicHelperRelease() {
  const resolution = resolveHelperRelease();
  if (!resolution.available) return resolution;
  return { available: true as const, ...resolution.release };
}
