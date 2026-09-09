import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import "@/components/public/public-theme.css";
import { publicWindowsRelease } from "@/lib/releases/windows-release";

import styles from "./download.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ZTerminal for Windows — Native Quantitative Workstation",
  description: "Official ZTerminal Windows release channel, verified packages, and cryptographic installation guidance.",
};

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true">↗</span>;
}

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
    <main className={`${styles.page} publicScope`}>
      <PublicHeader />

      <div className={styles.content}>
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="download-title">
          <p className={styles.eyebrow}>ZTERMINAL FOR WINDOWS</p>
          <h1 id="download-title" className={styles.title}>
            Your research.
            <em>On your machine.</em>
          </h1>
          <p className={styles.lead}>
            ZTerminal is engineered as a native, client-first Windows workstation. By moving analytics to local hardware, your machine processes tick data, runs vectorized simulations, and renders charts directly on your GPU without cloud network latency or server compute caps.
          </p>
        </section>

        {/* RELEASE SPECIFICATION & STATUS */}
        {release.available ? (
          <section className={styles.releasePanel} aria-labelledby="release-title">
            <div className={styles.releaseHeader}>
              <div>
                <p className={styles.label}>OFFICIAL SIGNED RELEASE</p>
                <h2 id="release-title" className={styles.releaseVersion}>ZTerminal {release.version}</h2>
                <p className={styles.releaseMeta}>
                  Windows x64 · {release.channel} channel · Published {new Date(release.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <a className={styles.primaryButton} href="/download/windows">
                Download for Windows <span aria-hidden="true">↓</span>
              </a>
            </div>

            <dl className={styles.facts}>
              <div className={styles.factItem}>
                <dt>Package</dt>
                <dd>MSIX · {formatBytes(release.size_bytes)}</dd>
              </div>
              <div className={styles.factItem}>
                <dt>Publisher</dt>
                <dd>{release.publisher}</dd>
              </div>
              <div className={styles.factItem}>
                <dt>SHA-256 Hash</dt>
                <dd className={styles.hash}>{release.sha256}</dd>
              </div>
              <div className={styles.factItem}>
                <dt>Channel</dt>
                <dd>Verified Windows x64 Release</dd>
              </div>
            </dl>

            <div className={styles.releaseFooter}>
              <a className={styles.textLink} href={release.release_notes_url}>
                Read verified release notes <Arrow />
              </a>
            </div>
          </section>
        ) : (
          <section className={styles.releasePanel} aria-labelledby="release-title">
            <div className={styles.releaseHeader}>
              <div>
                <div className={styles.statusBadge}>
                  <span className={styles.statusDot} />
                  STATUS / PRE-RELEASE VERIFICATION
                </div>
                <h2 id="release-title" className={styles.releaseHeading}>
                  The signed public installer is in preparation.
                </h2>
                <p className={styles.releaseDescription}>
                  ZTerminal does not distribute unverified binaries or development artifacts. Compatibility matrices, code signing certificates, and automated performance benchmarks are being verified before public distribution.
                </p>
              </div>
              <div className={styles.reasonTag}>
                REASON: {release.reason.replaceAll("_", " ")}
              </div>
            </div>

            <div className={styles.specPreview}>
              <p className={styles.specTitle}>VERIFIED TARGET SPECIFICATIONS</p>
              <div className={styles.specGrid}>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>PLATFORM</span>
                  <strong className={styles.specValue}>Windows 11 &amp; Windows 10 (x64)</strong>
                </div>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>PACKAGING</span>
                  <strong className={styles.specValue}>Signed MSIX / NSIS Installer</strong>
                </div>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>RUNTIME CORE</span>
                  <strong className={styles.specValue}>Rust 2024 / Tauri Native Shell</strong>
                </div>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>LOCAL COMPUTE</span>
                  <strong className={styles.specValue}>DuckDB Columnar + Polars Engine</strong>
                </div>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>CODE SIGNING</span>
                  <strong className={styles.specValue}>Verified Organization Certificate</strong>
                </div>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>INTEGRITY</span>
                  <strong className={styles.specValue}>Cryptographic SHA-256 Published</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TWO SURFACES */}
        <section className={styles.surfacesSection} aria-labelledby="surfaces-title">
          <div className={styles.surfacesIntro}>
            <p className={styles.eyebrow}>TWO SURFACES</p>
            <h2 id="surfaces-title" className={styles.sectionHeading}>
              Windows at the core.
              <em>The web, within reach.</em>
            </h2>
          </div>

          <div className={styles.surfaceCards}>
            <article className={styles.surfaceCard}>
              <div className={styles.surfaceNum}>01 / NATIVE WORKSTATION</div>
              <h3 className={styles.surfaceTitle}>Native Windows Desktop (Primary)</h3>
              <p className={styles.surfaceBody}>
                The intended environment for quantitative traders. Direct access to your local filesystem, NVMe read bandwidth for massive tick datasets, and native multithreaded simulation.
              </p>
              <div className={styles.surfaceFooter}>
                <Link className={styles.textLink} href="/docs/windows/install">
                  Read installation status &amp; guide <Arrow />
                </Link>
              </div>
            </article>

            <article className={styles.surfaceCard}>
              <div className={styles.surfaceNum}>02 / WEB TERMINAL</div>
              <h3 className={styles.surfaceTitle}>Browser Research Workstation</h3>
              <p className={styles.surfaceBody}>
                Zero installation required. Launch the browser terminal to explore the market canvas, inspect research indicators, and evaluate setups immediately.
              </p>
              <div className={styles.surfaceFooter}>
                <Link className={styles.primaryButtonSmall} href="/terminal">
                  Launch web terminal <Arrow />
                </Link>
              </div>
            </article>
          </div>
        </section>

        {/* RELEASE SECURITY & VERIFICATION */}
        <section className={styles.securitySection} aria-labelledby="security-title">
          <div className={styles.securityInner}>
            <p className={styles.eyebrow}>RELEASE SECURITY</p>
            <h2 id="security-title" className={styles.sectionHeading}>
              One official path.
            </h2>
            <p className={styles.securityLead}>
              Install only packages linked directly from this page. Official releases are served exclusively over encrypted HTTPS and published with a verified publisher signature, release notes, and SHA-256 checksum.
            </p>

            <div className={styles.securityBox}>
              <p className={styles.securityBoxTitle}>VERIFY CHECKSUM IN POWERSHELL / CMD</p>
              <code className={styles.securityCode}>
                certutil -hashfile ZTerminal-Setup.msix SHA256
              </code>
              <p className={styles.securityNote}>
                Compare the computed hash with the published checksum above before running the installer.
              </p>
            </div>
          </div>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
