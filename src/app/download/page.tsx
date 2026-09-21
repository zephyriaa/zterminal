import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import "@/components/public/public-theme.css";
import { publicWindowsRelease } from "@/lib/releases/windows-release";
import {
  BackgroundField,
  CTAButton,
  StatusBadge,
  TechnicalEyebrow,
} from "@/components/public/public-primitives";
import styles from "./download.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ZTerminal for Windows — Native Quantitative Workstation",
  description:
    "Official ZTerminal Windows release status, verified packages, checksums, and installation guidance.",
};

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      ↗
    </span>
  );
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
      <BackgroundField />
      <PublicHeader />

      <div className={styles.content}>
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="download-title">
          <TechnicalEyebrow>ZTERMINAL FOR WINDOWS</TechnicalEyebrow>
          <h1 id="download-title" className={styles.title}>
            Your research.
            <em>On your machine.</em>
          </h1>
          <p className={styles.lead}>
            ZTerminal’s local Helper is built for research that benefits from your own machine:
            selected datasets, Python execution, session-paired local execution, and archived
            results remain under your control.
          </p>

          <div className={styles.heroActions}>
            <CTAButton href="/terminal">Open ZTerminal</CTAButton>
            <CTAButton href="/docs/windows/install" secondary>
              Read installation guide
            </CTAButton>
          </div>
        </section>

        {/* RELEASE SPECIFICATION & STATUS */}
        {release.available ? (
          <section className={styles.releasePanel} aria-labelledby="release-title">
            <div className={styles.releaseHeader}>
              <div>
                <StatusBadge variant="emerald">OFFICIAL SIGNED RELEASE</StatusBadge>
                <h2 id="release-title" className={styles.releaseHeading}>
                  ZTerminal {release.version}
                </h2>
                <p className={styles.releaseDescription}>
                  Windows x64 · {release.channel} channel · Published{" "}
                  {new Date(release.published_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <CTAButton href="/download/windows">
                Download for Windows <span aria-hidden="true">↓</span>
              </CTAButton>
            </div>

            <div className={styles.specPreview}>
              <p className={styles.specTitle}>RELEASE ARTIFACT DETAILS</p>
              <div className={styles.specGrid}>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Package</span>
                  <strong className={styles.specValue}>MSIX · {formatBytes(release.size_bytes)}</strong>
                </div>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Publisher</span>
                  <strong className={styles.specValue}>{release.publisher}</strong>
                </div>
                <div className={styles.specItem}>
                  <span className={styles.specLabel}>Channel</span>
                  <strong className={styles.specValue}>Verified Windows x64 Release</strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <Link className={styles.textLink} href={release.release_notes_url}>
                Read verified release notes <Arrow />
              </Link>
            </div>
          </section>
        ) : (
          <section className={styles.releasePanel} aria-labelledby="release-title">
            <div className={styles.releaseHeader}>
              <div>
                <div className={styles.releaseStatusWrap}>
                  <StatusBadge variant="amber">STATUS / PRE-RELEASE VERIFICATION</StatusBadge>
                </div>
                <h2 id="release-title" className={styles.releaseHeading}>
                  The signed public installer is in preparation.
                </h2>
                <p className={styles.releaseDescription}>
                  ZTerminal does not distribute unverified binaries or development artifacts.
                  Compatibility, package signing, and release documentation are being verified
                  before public distribution.
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
                  <strong className={styles.specValue}>Vectorized Python 3.11+ Engine</strong>
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

        {/* ARCHITECTURE SECTION */}
        <section className={styles.architecture} aria-labelledby="architecture-title">
          <div>
            <TechnicalEyebrow>LOCAL RESEARCH PATH</TechnicalEyebrow>
            <h2 id="architecture-title" className={styles.archHeading}>
              A clear boundary
              <em>for local work.</em>
            </h2>
            <p className={styles.archLead}>
              The browser is where you investigate. The optional Windows Helper is where approved
              local Python research runs and archives its evidence.
            </p>
          </div>

          <div
            className={styles.archDiagram}
            aria-label="Browser to local helper to research archive architecture"
          >
            <article className={styles.archNode}>
              <span className={styles.archNodeNum}>01 / FRONTEND</span>
              <strong className={styles.archNodeTitle}>Browser workspace</strong>
              <small className={styles.archNodeDesc}>Chart, context, strategy editor</small>
            </article>
            <i className={styles.archArrow} aria-hidden="true">
              →
            </i>
            <article className={styles.archNode}>
              <span className={styles.archNodeNum}>02 / ENGINE</span>
              <strong className={styles.archNodeTitle}>Windows Helper</strong>
              <small className={styles.archNodeDesc}>Paired local research process on 127.0.0.1</small>
            </article>
            <i className={styles.archArrow} aria-hidden="true">
              →
            </i>
            <article className={styles.archNode}>
              <span className={styles.archNodeNum}>03 / EVIDENCE</span>
              <strong className={styles.archNodeTitle}>Local evidence</strong>
              <small className={styles.archNodeDesc}>Runs, assumptions, SHA-256 hashes</small>
            </article>
          </div>
        </section>

        {/* TWO SURFACES */}
        <section className={styles.surfacesSection} aria-labelledby="surfaces-title">
          <div className={styles.surfacesIntro}>
            <TechnicalEyebrow>TWO SURFACES</TechnicalEyebrow>
            <h2 id="surfaces-title" className={styles.sectionHeading}>
              Windows at the core.
              <em>The web, within reach.</em>
            </h2>
          </div>

          <div className={styles.surfaceCards}>
            <article className={styles.surfaceCard}>
              <div className={styles.surfaceNum}>01 / NATIVE WORKSTATION</div>
              <h3 className={styles.surfaceTitle}>Windows research environment</h3>
              <p className={styles.surfaceBody}>
                The local Helper provides the current Windows boundary for research compute,
                session-paired local execution, and immutable result archives. The native workstation
                remains in active development.
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
                No installation is required to explore the current browser workspace: inspect
                charts, public market feeds, and available research surfaces right away.
              </p>
              <div className={styles.surfaceFooter}>
                <CTAButton href="/terminal">
                  Open ZTerminal
                </CTAButton>
              </div>
            </article>
          </div>
        </section>

        {/* RELEASE SECURITY & VERIFICATION */}
        <section className={styles.securitySection} aria-labelledby="security-title">
          <div className={styles.securityInner}>
            <TechnicalEyebrow>RELEASE SECURITY</TechnicalEyebrow>
            <h2 id="security-title" className={styles.sectionHeading}>
              One official path.
            </h2>
            <p className={styles.securityLead}>
              Install only packages linked directly from this page. Official releases are served
              exclusively over encrypted HTTPS and published with a verified publisher signature,
              release notes, and SHA-256 checksum.
            </p>

            <div className={styles.securityBox}>
              <p className={styles.securityBoxTitle}>VERIFY CHECKSUM IN POWERSHELL / CMD</p>
              <code className={styles.securityCode}>
                certutil -hashfile ZTerminal-Setup.msix SHA256
              </code>
              <p className={styles.securityNote}>
                Compare the computed hash with the published checksum above before running the
                installer.
              </p>
            </div>
          </div>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
