import type { Metadata } from "next";
import Link from "next/link";
import { publicWindowsRelease } from "@/lib/releases/windows-release";
import styles from "../../docs.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Installing ZTerminal on Windows — Documentation",
  description: "Official ZTerminal Windows installation, package verification, and security guidelines.",
};

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true">↗</span>;
}

export default function WindowsInstallationGuide() {
  const release = publicWindowsRelease();

  return (
    <article className={styles.docArticle}>
      <Link href="/docs" className={styles.backLink}>← Documentation index</Link>

      <p className={styles.eyebrow}>ZTERMINAL FOR WINDOWS</p>
      <h1 className={styles.docTitle}>
        Installing ZTerminal
        <em>on Windows.</em>
      </h1>
      <p className={styles.docLead}>
        This guide is the official reference for verified ZTerminal Windows releases. It clearly distinguishes verified public releases from desktop work in active development.
      </p>

      {/* RELEASE STATUS CARD */}
      <section className={styles.statusBox}>
        <div className={styles.statusBoxHeader}>
          <span className={styles.statusLabel}>CURRENT RELEASE STATUS</span>
          <span className={styles.statusChannel}>
            {release.available ? `CHANNEL: ${release.channel}` : "CHANNEL: PRE-RELEASE"}
          </span>
        </div>
        {release.available ? (
          <div>
            <h2 className={styles.statusHeading}>ZTerminal {release.version} is available for Windows x64.</h2>
            <p className={styles.statusText}>
              The official package is signed, versioned, and distributed through the verified ZTerminal route. Verify the publisher and SHA-256 hash before installation.
            </p>
            <div className={styles.statusActions}>
              <Link href="/download" className={styles.primaryButtonSmall}>
                Download ZTerminal <Arrow />
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h2 className={styles.statusHeading}>No signed public Windows installer is available yet.</h2>
            <p className={styles.statusText}>
              ZTerminal will never ask users to run an unsigned or unverified development binary. Windows compatibility, verified publisher signatures, benchmark metrics, and release notes will be published before the first installer is enabled.
            </p>
            <div className={styles.statusDetail}>
              STATUS CODE: <code>{release.reason.replaceAll("_", " ")}</code>
            </div>
          </div>
        )}
      </section>

      {/* VERIFIED RELEASE PROCEDURE */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Verified installation procedure</h2>
        <p className={styles.sectionPara}>
          When an official release becomes available, follow these security-first verification steps:
        </p>
        <ol className={styles.stepList}>
          <li>
            <strong>Download only from the official release page:</strong> Never install binaries from third-party mirrors, forums, or unofficial repositories.
          </li>
          <li>
            <strong>Confirm publisher signature:</strong> Right-click the downloaded <code>.msix</code> package, select Properties &gt; Digital Signatures, and verify the publisher identity.
          </li>
          <li>
            <strong>Verify SHA-256 hash:</strong> Open PowerShell or Command Prompt and compute the cryptographic hash:
            <pre className={styles.codeSnippet}><code>certutil -hashfile ZTerminal-Setup.msix SHA256</code></pre>
            Ensure the output matches the published hash on the download page.
          </li>
          <li>
            <strong>Complete the installation:</strong> Run the MSIX installer. Windows will handle sandboxed package registration and local permissions.
          </li>
        </ol>
      </section>

      {/* UPDATES & PERSISTENCE */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Updates, caching &amp; data persistence</h2>
        <p className={styles.sectionPara}>
          ZTerminal stores historical tick data, Parquet files, and strategy logs in standard local directories. Upgrades to the application binary preserve your research databases and configuration without loss.
        </p>
        <div className={styles.callout}>
          <strong>User Data Isolation:</strong> Uninstalling the application binary does not delete your local Parquet data lake or private Python strategy scripts unless you explicitly remove the user directory.
        </div>
      </section>

      {/* BROWSER WORKSPACE FALLBACK */}
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>Immediate browser workspace</h2>
        <p className={styles.sectionPara}>
          While the Windows native client completes final package signing, the browser research terminal remains available for immediate exploration.
        </p>
        <Link href="/terminal" className={styles.primaryButtonSmall}>
          Launch web terminal <Arrow />
        </Link>
      </section>
    </article>
  );
}
