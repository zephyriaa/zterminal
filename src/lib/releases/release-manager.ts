/**
 * Release Management Tooling
 * Utilities for calculating binary hashes, generating release manifests,
 * validating semantic version upgrades, and formatting deployment payloads.
 */

import * as crypto from "node:crypto";
import type { WindowsRelease } from "./windows-release";

export interface ReleaseAssetMetadata {
  filePath: string;
  buffer: Buffer;
  version: string;
  channel: "stable" | "beta";
  publisher: string;
  baseUrl: string;
  releaseNotesUrl: string;
}

export interface GeneratedReleaseBundle {
  manifest: WindowsRelease;
  sha256: string;
  sizeBytes: number;
  envVariableString: string;
}

/**
 * Computes SHA-256 hash of a file buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validates whether a version transition is a legal semver progression.
 */
export function isValidVersionProgression(prevVersion: string, nextVersion: string): boolean {
  const parse = (v: string) => {
    const clean = v.replace(/^v/, "").split("-")[0];
    return clean.split(".").map(Number);
  };

  const [majPrev, minPrev, patPrev] = parse(prevVersion);
  const [majNext, minNext, patNext] = parse(nextVersion);

  if (majNext > majPrev) return true;
  if (majNext === majPrev && minNext > minPrev) return true;
  if (majNext === majPrev && minNext === minPrev && patNext > patPrev) return true;
  return false;
}

/**
 * Generates an institutional release manifest conforming to WindowsRelease specifications.
 */
export function generateReleaseManifest(meta: ReleaseAssetMetadata): GeneratedReleaseBundle {
  const sha256 = computeSha256(meta.buffer);
  const sizeBytes = meta.buffer.length;

  const fileName = meta.filePath.split(/[/\\]/).pop() || `ZTerminal_${meta.version}_x64-setup.exe`;
  const packageUrl = `${meta.baseUrl.replace(/\/$/, "")}/${fileName}`;
  const appinstallerUrl = `${meta.baseUrl.replace(/\/$/, "")}/zterminal.appinstaller`;

  const manifest: WindowsRelease = {
    schema_version: 1,
    state: "published",
    platform: "windows",
    architecture: "x64",
    channel: meta.channel,
    version: meta.version.replace(/^v/, ""),
    package_url: packageUrl,
    appinstaller_url: appinstallerUrl,
    sha256,
    size_bytes: sizeBytes,
    published_at: new Date().toISOString(),
    minimum_supported_version: "0.1.0",
    release_notes_url: meta.releaseNotesUrl,
    publisher: meta.publisher,
    signature_verified: true,
  };

  const envVariableString = JSON.stringify(manifest);

  return {
    manifest,
    sha256,
    sizeBytes,
    envVariableString,
  };
}
