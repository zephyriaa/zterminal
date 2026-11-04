import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { BackgroundField } from "@/components/public/public-primitives";
import styles from "@/components/public/legal.module.css";
import "@/components/public/public-theme.css";

export const metadata: Metadata = {
  title: "Privacy Policy — ZTerminal",
  description:
    "ZTerminal Privacy Notice and Data Protection Policy. Explains how user information is processed, stored, and protected under GDPR, CCPA, and applicable privacy laws.",
};

export default function PrivacyPolicyPage() {
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
          <span>Privacy Policy</span>
        </div>

        <header className={styles.legalHeader}>
          <h1 className={styles.legalTitle}>Privacy Policy</h1>
          <p className={styles.legalSubtitle}>
            How ZTerminal collects, processes, and protects your personal data under the EU General Data Protection
            Regulation (GDPR), UK GDPR, the California Consumer Privacy Act (CCPA/CPRA), and international privacy frameworks.
          </p>
          <div className={styles.legalMeta}>
            <span>Last Updated: {lastUpdated}</span>
            <span>·</span>
            <span>Version: 2.1 (GDPR Art. 13 & CCPA §1798.100 Compliant)</span>
          </div>
        </header>

        <article className={styles.legalContent}>
          <div className={styles.calloutBox}>
            <strong>Core Privacy Guarantee:</strong> ZTerminal is an empirical market research terminal and decision-support workspace.
            Strategy development, vector computations, and backtests execute locally by default. We never store brokerage account credentials,
            broker passwords, trading execution keys, or financial account credentials.
          </div>

          <h2>1. Data Controller Identity and Contact</h2>
          <p>
            The data controller responsible for the processing of personal data on the ZTerminal platform is:
          </p>
          <p>
            <strong>ZTerminal Platform</strong><br />
            Data Protection &amp; Privacy Operations<br />
            Email: <a href="mailto:privacy@zterminal.dpdns.org">privacy@zterminal.dpdns.org</a><br />
            Legal Contact: <a href="mailto:legal@zterminal.dpdns.org">legal@zterminal.dpdns.org</a>
          </p>

          <h2>2. Personal Data We Collect</h2>
          <p>
            We adhere strictly to the principle of <strong>data minimization</strong> (GDPR Article 5(1)(c)). We only collect data necessary to provide and secure the terminal:
          </p>
          <div className={styles.legalTableWrapper}>
            <table className={styles.legalTable}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Data Elements Collected</th>
                  <th>Purpose</th>
                  <th>Legal Basis (GDPR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Identity &amp; Authentication</strong></td>
                  <td>Google OAuth identifier, name, email address, profile picture URI, verified email status.</td>
                  <td>User authentication, workspace ownership, session integrity.</td>
                  <td>Art. 6(1)(b) Contract performance</td>
                </tr>
                <tr>
                  <td><strong>Session &amp; Security</strong></td>
                  <td>Cryptographic session token, CSRF token, native device authorization codes, IP address (ephemeral during requests).</td>
                  <td>Maintaining secure authentication, preventing CSRF attacks, device linking.</td>
                  <td>Art. 6(1)(f) Legitimate interest &amp; Art. 6(1)(c) Security</td>
                </tr>
                <tr>
                  <td><strong>Workspace &amp; Research Assets</strong></td>
                  <td>Named workspaces, indicator preferences, research datasets, Python strategy files, journal notes, backtest parameter logs.</td>
                  <td>Cloud synchronization across authenticated devices when enabled by the user.</td>
                  <td>Art. 6(1)(b) Contract performance</td>
                </tr>
                <tr>
                  <td><strong>Preferences &amp; Telemetry</strong></td>
                  <td>UI theme mode (dark/light), cookie consent choices, market watchlists.</td>
                  <td>Delivering user-selected interface settings.</td>
                  <td>Art. 6(1)(f) Legitimate interest / Consent</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>3. What We Do NOT Collect</h2>
          <ul>
            <li><strong>No Brokerage Credentials:</strong> We never collect, store, or transmit your exchange trading keys, brokerage passwords, or order execution secrets.</li>
            <li><strong>No Sensitive Personal Data:</strong> We do not process special category data (health, biometric, racial/ethnic origin, political affiliations) under GDPR Article 9 or CPRA §1798.121.</li>
            <li><strong>No Sale or Sharing of Personal Data:</strong> We do not sell, rent, or share personal data with data brokers or third-party advertising networks.</li>
          </ul>

          <h2>4. Storage, Retention, and Security</h2>
          <p>
            Personal data is stored in encrypted databases (PostgreSQL with TLS in-transit and encryption at rest).
          </p>
          <ul>
            <li><strong>Active Accounts:</strong> Account data and workspace assets are retained for the duration of your active account.</li>
            <li><strong>Session Expiry:</strong> Web session tokens expire automatically after 30 days of inactivity. Native desktop device sessions expire after 30 days unless renewed.</li>
            <li><strong>Immediate Deletion:</strong> When you delete your account using our self-service erasure endpoint or settings panel, all personal records, sessions, and associated cloud workspaces are purged immediately from active databases.</li>
          </ul>

          <h2>5. Your Data Protection Rights (GDPR &amp; CCPA/CPRA)</h2>
          <p>
            Under European data protection laws (GDPR Articles 15–22) and California privacy law (CCPA/CPRA §1798.100 et seq.), you possess explicit rights regarding your personal information:
          </p>
          <ul>
            <li>
              <strong>Right of Access &amp; Portability (GDPR Art. 15 &amp; 20 / CCPA §1798.100):</strong> You have the right to receive a machine-readable copy (JSON format) of all personal data and workspace content associated with your account. You can download this directly from the Terminal Account Panel or via our API endpoint at <code>/api/user/export</code>.
            </li>
            <li>
              <strong>Right to Erasure / &quot;Right to be Forgotten&quot; (GDPR Art. 17 / CCPA §1798.105):</strong> You have the right to permanently erase your account and all associated personal data. You can trigger this self-service deletion from the Account Panel or by sending a DELETE request to <code>/api/user/profile</code>.
            </li>
            <li>
              <strong>Right to Rectification (GDPR Art. 16 / CCPA §1798.106):</strong> You may update your profile information, display name, and avatar at any time in Account Settings.
            </li>
            <li>
              <strong>Right to Restrict or Object to Processing (GDPR Art. 18 &amp; 21):</strong> You may object to any processing based on legitimate interests.
            </li>
            <li>
              <strong>Right to Non-Discrimination (CCPA §1798.125):</strong> We will never deny services, charge different prices, or provide a different quality of service because you exercised your privacy rights.
            </li>
            <li>
              <strong>Right to Lodge a Complaint (GDPR Art. 77):</strong> You have the right to lodge a complaint with an EU/EEA supervisory authority in the Member State of your habitual residence or place of work.
            </li>
          </ul>

          <h2>6. Third-Party Service Providers and Subprocessors</h2>
          <p>
            We utilize trusted infrastructure providers bound by Data Processing Agreements (DPAs) incorporating standard contractual clauses (SCCs) to ensure equivalent protection:
          </p>
          <ul>
            <li><strong>Google Identity Services (OAuth 2.0):</strong> Federated authentication provider. Google processes your sign-in request subject to the Google Privacy Policy.</li>
            <li><strong>Cloudflare / Edge Hosting:</strong> Content delivery network, SSL/TLS termination, and edge proxying.</li>
            <li><strong>Public Market Data Feeds (Binance, Gate.io, Bybit, OKX):</strong> Public websocket connections for market pricing. These feeds do not receive your personal identity or account information.</li>
          </ul>

          <h2>7. Cookies and Tracking Technologies</h2>
          <p>
            For a comprehensive breakdown of cookies used on ZTerminal, please review our dedicated <Link href="/cookies">Cookie Policy</Link>. We do not use third-party tracking or advertising cookies.
          </p>

          <h2>8. Exercising Your Rights</h2>
          <p>
            To exercise your data subject rights:
          </p>
          <div className={styles.actionRow}>
            <Link href="/terminal" className={styles.actionButton}>
              Open Terminal Account Panel ↗
            </Link>
            <a href="mailto:privacy@zterminal.dpdns.org?subject=Data%20Subject%20Request" className={styles.actionButton}>
              Email Privacy Team ↗
            </a>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
