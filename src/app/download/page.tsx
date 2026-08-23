import type { Metadata } from "next";
import Link from "next/link";

import { publicWindowsRelease } from "@/lib/releases/windows-release";

import styles from "./download.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Download ZTerminal for Windows",
  description:
    "ZTerminal for Windows release information, signed installer guidance, and the browser-based research terminal.",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = "B";
  for (const candidate of units) {
    value /= 1024;
    unit = candidate;
    if (value < 1024) break;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

export default function DownloadPage() {
  const release = publicWindowsRelease();

  return (
    <main className={styles.page} id="main">
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="ZTerminal home">
          <img src="/landing/zterminal-logo-mark.png" alt="" />
          <span>ZTERMINAL</span>
        </Link>
        <nav aria-label="Download page navigation">
          <Link href="/">Overview</Link>
          <Link href="/terminal">Web terminal</Link>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="download-title">
        <p className={styles.eyebrow}>ZTERMINAL FOR WINDOWS</p>
        <h1 id="download-title">Native desktop research,<br /><em>when it is ready.</em></h1>
        <p className={styles.lead}>
          The Windows application is being built as a local-first terminal with a native graphics surface,
          local data processing, and research-only safeguards. It will be published here only after Windows
          validation, package signing, and release verification are complete.
        </p>
      </section>

      {release.available ? (
        <section className={styles.releaseCard} aria-labelledby="release-title">
          <div>
            <p className={styles.cardLabel}>OFFICIAL SIGNED RELEASE</p>
            <h2 id="release-title">ZTerminal {release.version}</h2>
            <p>Windows x64 · {release.channel} channel · published {new Date(release.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <a className={styles.downloadButton} href="/download/windows">Download for Windows <span>↓</span></a>
          <dl className={styles.releaseFacts}>
            <div><dt>Package</dt><dd>MSIX · {formatBytes(release.size_bytes)}</dd></div>
            <div><dt>Publisher</dt><dd>{release.publisher}</dd></div>
            <div><dt>SHA-256</dt><dd className={styles.hash}>{release.sha256}</dd></div>
            <div><dt>Updates</dt><dd>Managed from the verified release channel</dd></div>
          </dl>
          <a className={styles.notesLink} href={release.release_notes_url}>Read release notes <span>↗</span></a>
        </section>
      ) : (
        <section className={styles.unavailableCard} aria-labelledby="unavailable-title">
          <p className={styles.cardLabel}>RELEASE STATUS</p>
          <h2 id="unavailable-title">The official Windows installer is not available yet.</h2>
          <p>
            ZTerminal will not distribute an unsigned, untested, or unverified installer. Windows compatibility,
            package signature, release notes, and update details will appear here after the first verified release.
          </p>
          <p className={styles.statusCode}>Status: {release.reason.replaceAll("_", " ")}</p>
        </section>
      )}

      <section className={styles.comparison} aria-labelledby="choose-title">
        <div>
          <p className={styles.eyebrow}>CHOOSE YOUR WORKSPACE</p>
          <h2 id="choose-title">Use the web terminal today.<br /><em>Keep the desktop path honest.</em></h2>
        </div>
        <div className={styles.comparisonGrid}>
          <article>
            <p className={styles.cardLabel}>WEB TERMINAL</p>
            <h3>Open now in your browser.</h3>
            <p>Research tools, market views, and local browser workspace state are available without an installation.</p>
            <Link href="/terminal" className={styles.secondaryButton}>Launch web terminal <span>↗</span></Link>
          </article>
          <article>
            <p className={styles.cardLabel}>WINDOWS TERMINAL</p>
            <h3>Native desktop work in progress.</h3>
            <p>Native rendering, local caching, and installation support will be described with measured requirements once a signed Windows build passes validation.</p>
            <Link href="/docs/windows/install" className={styles.textLink}>Read installation status <span>↗</span></Link>
          </article>
        </div>
      </section>

      <section className={styles.security} aria-labelledby="security-title">
        <p className={styles.eyebrow}>RELEASE SECURITY</p>
        <h2 id="security-title">One official release path.</h2>
        <p>
          Official packages will be served over HTTPS, signed and timestamp-verified before publication, and
          announced through a version-aware release record. Never install ZTerminal from an unknown mirror or a file
          that is not linked from this page.
        </p>
      </section>
    </main>
  );
}
