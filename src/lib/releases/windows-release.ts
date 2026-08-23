import { z } from "zod";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const releaseRecordSchema = z.object({
  schema_version: z.literal(1),
  state: z.literal("published"),
  platform: z.literal("windows"),
  architecture: z.literal("x64"),
  channel: z.enum(["stable", "beta"]),
  version: z.string().regex(SEMVER_PATTERN),
  package_url: z.string().url(),
  appinstaller_url: z.string().url(),
  sha256: z.string().regex(SHA256_PATTERN),
  size_bytes: z.number().int().positive(),
  published_at: z.string().datetime(),
  minimum_supported_version: z.string().regex(SEMVER_PATTERN),
  release_notes_url: z.string().url(),
  publisher: z.string().trim().min(1).max(160),
  signature_verified: z.literal(true),
});

export type WindowsRelease = z.infer<typeof releaseRecordSchema>;

export type WindowsReleaseResolution =
  | { available: true; release: WindowsRelease }
  | {
      available: false;
      reason:
        | "NO_SIGNED_WINDOWS_RELEASE"
        | "WINDOWS_RELEASE_PUBLISHING_DISABLED"
        | "WINDOWS_RELEASE_CONFIGURATION_INVALID";
    };

function allowedArtifactHosts(): Set<string> {
  return new Set(
    (process.env.WINDOWS_RELEASE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAllowedHttpsUrl(value: string, allowedHosts: Set<string>, expectedSuffix?: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      allowedHosts.has(url.hostname.toLowerCase()) &&
      (expectedSuffix === undefined || url.pathname.toLowerCase().endsWith(expectedSuffix))
    );
  } catch {
    return false;
  }
}

function recordHasApprovedTargets(release: WindowsRelease): boolean {
  const hosts = allowedArtifactHosts();
  if (hosts.size === 0) return false;

  return (
    isAllowedHttpsUrl(release.package_url, hosts, ".msix") &&
    isAllowedHttpsUrl(release.appinstaller_url, hosts, ".appinstaller") &&
    isAllowedHttpsUrl(release.release_notes_url, new Set(["zterminal.onrender.com"]))
  );
}

/**
 * Resolves a public Windows release only when publishing was explicitly enabled
 * and a CI-produced release envelope passes server-side structural and target
 * validation. The value is public metadata, not a signing authority; CI must
 * verify signing and hashes before it writes this configured record.
 */
export function resolveWindowsRelease(): WindowsReleaseResolution {
  if (process.env.WINDOWS_RELEASE_PUBLISH_ENABLED !== "true") {
    return { available: false, reason: "WINDOWS_RELEASE_PUBLISHING_DISABLED" };
  }

  const rawRecord = process.env.WINDOWS_RELEASE_MANIFEST_JSON;
  if (!rawRecord) {
    return { available: false, reason: "NO_SIGNED_WINDOWS_RELEASE" };
  }

  try {
    const parsed = releaseRecordSchema.safeParse(JSON.parse(rawRecord));
    if (!parsed.success || !recordHasApprovedTargets(parsed.data)) {
      return { available: false, reason: "WINDOWS_RELEASE_CONFIGURATION_INVALID" };
    }

    return { available: true, release: parsed.data };
  } catch {
    return { available: false, reason: "WINDOWS_RELEASE_CONFIGURATION_INVALID" };
  }
}

/** Returns a public projection and never exposes configuration or credentials. */
export function publicWindowsRelease() {
  const resolution = resolveWindowsRelease();
  if (!resolution.available) return resolution;

  const { release } = resolution;
  return {
    available: true as const,
    schema_version: release.schema_version,
    platform: release.platform,
    architecture: release.architecture,
    channel: release.channel,
    version: release.version,
    download_url: release.package_url,
    appinstaller_url: release.appinstaller_url,
    sha256: release.sha256,
    size_bytes: release.size_bytes,
    published_at: release.published_at,
    minimum_supported_version: release.minimum_supported_version,
    release_notes_url: release.release_notes_url,
    publisher: release.publisher,
  };
}
