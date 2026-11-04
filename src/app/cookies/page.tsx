import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { BackgroundField } from "@/components/public/public-primitives";
import styles from "@/components/public/legal.module.css";
import "@/components/public/public-theme.css";

export const metadata: Metadata = {
  title: "Cookie Policy — ZTerminal",
  description:
    "Cookie Policy and storage inventory for ZTerminal. Details strictly necessary and optional cookies under the ePrivacy Directive Article 5(3) and CNIL standards.",
};

export default function CookiePolicyPage() {
  const lastUpdated = "November 4, 2026";

  return (
    <div className={`${styles.legalPage} publicScope`}>
      <BackgroundField />
      <PublicHeader />

      <main className={styles.legalContainer}>
        <div className={styles.breadcrumbs}>
          <Link href="/" className={styles.breadcrumbLink}>
            ZTerminal
          </Link>
          <span>/</span>
          <span>Legal</span>
          <span>/</span>
          <span>Cookie Policy</span>
        </div>

        <header className={styles.legalHeader}>
          <h1 className={styles.legalTitle}>Cookie Policy</h1>
          <p className={styles.legalSubtitle}>
            Transparent disclosure of all cookies, local storage identifiers, and browser storage mechanisms used across the ZTerminal platform under the EU ePrivacy Directive (Article 5(3)) and CNIL guidelines.
          </p>
          <div className={styles.legalMeta}>
            <span>Last Updated: {lastUpdated}</span>
            <span>·</span>
            <span>Version: 2.0</span>
          </div>
        </header>

        <article className={styles.legalContent}>
          <div className={styles.calloutBox}>
            <strong>Privacy-First Storage Policy:</strong> ZTerminal does not use third-party tracking pixels, cross-site advertising cookies, or behavioral profiling trackers.
            The cookies we use are strictly necessary to authenticate your account, secure your sessions, and preserve your chosen theme.
          </div>

          <h2>1. What Are Cookies and Local Storage?</h2>
          <p>
            Cookies are small text files placed on your device by websites that you visit. LocalStorage is an HTML5 browser storage mechanism that allows web applications to store data locally within the user&apos;s browser. Both mechanisms are governed by Article 5(3) of the EU ePrivacy Directive (Directive 2002/58/EC as amended by Directive 2009/136/EC).
          </p>

          <h2>2. The Strictly Necessary Exemption (ePrivacy Art. 5(3))</h2>
          <p>
            Under Article 5(3) of the ePrivacy Directive and European Data Protection Board (EDPB) / Article 29 Working Party guidance (Opinion 04/2012 on Cookie Consent Exemption, WP 194), cookies that are <em>strictly necessary in order to deliver an information society service explicitly requested by the user</em> are exempt from the requirement of prior consent.
          </p>
          <p>
            The table below itemizes the strictly necessary cookies and storage keys deployed on ZTerminal:
          </p>

          <div className={styles.legalTableWrapper}>
            <table className={styles.legalTable}>
              <thead>
                <tr>
                  <th>Name / Key</th>
                  <th>Storage Type</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                  <th>Exempt? (WP 194)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>__Secure-next-auth.session-token</code></td>
                  <td>HTTP Cookie (HttpOnly, Secure, SameSite=Lax)</td>
                  <td>Maintains verified Google OAuth session state across requests.</td>
                  <td>30 days</td>
                  <td>Yes (Category B: Authentication)</td>
                </tr>
                <tr>
                  <td><code>__Host-next-auth.csrf-token</code></td>
                  <td>HTTP Cookie (HttpOnly, Secure, SameSite=Lax)</td>
                  <td>Cryptographic Anti-CSRF token protecting against cross-site request forgery.</td>
                  <td>Session</td>
                  <td>Yes (Security Exemption)</td>
                </tr>
                <tr>
                  <td><code>next-auth.callback-url</code></td>
                  <td>HTTP Cookie (HttpOnly, Secure, SameSite=Lax)</td>
                  <td>Stores the destination return URL during the OAuth authentication flow.</td>
                  <td>Session</td>
                  <td>Yes (User Input State)</td>
                </tr>
                <tr>
                  <td><code>zt_cookie_consent_v1</code></td>
                  <td>LocalStorage</td>
                  <td>Remembers your cookie consent choices and timestamp.</td>
                  <td>180 days (6-month renewal cycle)</td>
                  <td>Yes (Compliance Record)</td>
                </tr>
                <tr>
                  <td><code>theme</code></td>
                  <td>LocalStorage</td>
                  <td>Stores user-selected interface color theme (dark/light mode).</td>
                  <td>Persistent</td>
                  <td>Yes (Category C: User Customization)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>3. Optional Analytics &amp; Performance Cookies</h2>
          <p>
            ZTerminal does not currently load any third-party marketing or cross-device advertising trackers.
            Any optional performance measurement is disabled by default and will only run if you explicitly consent via our Cookie Preferences banner.
          </p>

          <h2>4. Managing and Withdrawing Consent</h2>
          <p>
            You have the right to withdraw or modify your consent preferences at any time. When you reject non-essential cookies, ZTerminal remains fully functional without any degradation of terminal features, charting, or local backtesting capabilities (no &quot;cookie walls&quot;, in accordance with CNIL 2020-091 guidelines).
          </p>

          <h2>5. Browser-Level Cookie Management</h2>
          <p>
            You can also control or delete cookies through your web browser settings:
          </p>
          <ul>
            <li><strong>Google Chrome:</strong> Settings &gt; Privacy and security &gt; Third-party cookies</li>
            <li><strong>Mozilla Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
            <li><strong>Apple Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
            <li><strong>Microsoft Edge:</strong> Settings &gt; Cookies and site permissions &gt; Manage and delete cookies</li>
          </ul>

          <div className={styles.actionRow}>
            <Link href="/privacy" className={styles.actionButton}>
              Read Privacy Policy ↗
            </Link>
            <Link href="/terms" className={styles.actionButton}>
              Read Terms of Service ↗
            </Link>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
