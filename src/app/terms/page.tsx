import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { BackgroundField } from "@/components/public/public-primitives";
import styles from "@/components/public/legal.module.css";
import "@/components/public/public-theme.css";

export const metadata: Metadata = {
  title: "Terms of Service — ZTerminal",
  description:
    "Terms of Service for ZTerminal. Explains software licensing, decision-support disclaimers, hypothetical backtest limitations under CFTC Rule 4.41, and user responsibilities.",
};

export default function TermsOfServicePage() {
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
          <span>Terms of Service</span>
        </div>

        <header className={styles.legalHeader}>
          <h1 className={styles.legalTitle}>Terms of Service</h1>
          <p className={styles.legalSubtitle}>
            Terms and conditions governing the use of the ZTerminal web workstation, native desktop client, Python research APIs, and simulation engines.
          </p>
          <div className={styles.legalMeta}>
            <span>Last Updated: {lastUpdated}</span>
            <span>·</span>
            <span>Version: 2.0</span>
          </div>
        </header>

        <article className={styles.legalContent}>
          <div className={`${styles.calloutBox} ${styles.calloutWarning}`}>
            <strong>Important Regulatory Notice:</strong> ZTerminal is specialized decision-support software for empirical market research, charting, and strategy simulation.
            ZTerminal is not a broker, exchange, investment adviser, or commodity trading advisor. All market data and simulation tools are provided for analytical and educational research only.
          </div>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the ZTerminal web terminal, downloading the Windows workstation, or interacting with the ZTerminal API, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the software.
          </p>

          <h2>2. Description of the Service</h2>
          <p>
            ZTerminal provides a quantitative research workspace comprising:
          </p>
          <ul>
            <li>High-performance multi-provider market charting (candlesticks, order flow, depth surfaces, volume profiles).</li>
            <li>A vectorized Python backtesting environment and strategy simulation framework.</li>
            <li>Empirical research tooling, journal logs, and reproducible evidence archives.</li>
            <li>Optional cloud synchronization for named workspace configurations via Google authentication.</li>
          </ul>

          <h2>3. CFTC Rule 4.41 &amp; Hypothetical Performance Disclaimer</h2>
          <div className={styles.calloutBox}>
            <p>
              <strong>MANDATORY REGULATORY DISCLOSURE (CFTC RULE 4.41):</strong>
            </p>
            <p>
              HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN INHERENT LIMITATIONS. UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE NOT ACTUALLY BEEN EXECUTED, THE RESULTS MAY HAVE UNDER- OR OVER-COMPENSATED FOR THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF LIQUIDITY.
            </p>
            <p>
              SIMULATED TRADING PROGRAMS IN GENERAL ARE ALSO SUBJECT TO THE FACT THAT THEY ARE DESIGNED WITH THE BENEFIT OF HINDSIGHT. NO REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS LIKELY TO ACHIEVE PROFITS OR LOSSES SIMILAR TO THOSE SHOWN.
            </p>
          </div>
          <p>
            Past performance, backtest simulations, and historical replay metrics generated within ZTerminal do not guarantee future results. All financial trading involves substantial risk of capital loss. You are solely responsible for evaluating the merits and risks associated with any trading decisions.
          </p>

          <h2>4. Local Execution Boundary &amp; Intellectual Property</h2>
          <p>
            ZTerminal is engineered around a strict local compute boundary:
          </p>
          <ul>
            <li><strong>Your Strategies Belong to You:</strong> You retain complete, unencumbered ownership of all Python strategy files, custom indicator algorithms, proprietary formulas, and trade logs created in ZTerminal.</li>
            <li><strong>Local Engine Execution:</strong> Custom Python scripts, vectorized simulations, and backtests execute on your local machine using your installed Python runtime (or within the browser WebAssembly sandbox). We do not inspect, copy, or retain your algorithmic source code on our servers unless you explicitly sync a workspace record.</li>
          </ul>

          <h2>5. Acceptable Use and Security Responsibilities</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Abuse, overwhelm, or attempt denial-of-service attacks against market data relays, websocket feeds, or terminal servers.</li>
            <li>Attempt to bypass authentication, session boundaries, or CSRF safeguards.</li>
            <li>Upload or execute malicious software, viruses, or exploit payloads through the Monaco editor or Python workspace.</li>
            <li>Reverse engineer, decompile, or extract proprietary runtime components except as expressly permitted under applicable open-source licenses.</li>
          </ul>

          <h2>6. Third-Party Market Data Feeds</h2>
          <p>
            ZTerminal relays public market data streams from third-party cryptocurrency and market venues (e.g., Binance, Gate.io, Bybit, OKX). We do not guarantee the timeliness, sequence, accuracy, or completeness of market data feeds. Market feeds may be delayed, intermittent, or unavailable during high market volatility or venue outages.
          </p>

          <h2>7. Disclaimer of Warranties &amp; Limitation of Liability</h2>
          <p>
            ZTERMINAL IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>
          <p>
            IN NO EVENT SHALL ZTERMINAL, ITS CONTRIBUTORS, OR OPERATORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING LOSS OF PROFITS, TRADING LOSSES, CAPITAL DEPLETION, SYSTEM DOWNTIME, OR DATA CORRUPTION) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.
          </p>

          <h2>8. Governing Law and Amendments</h2>
          <p>
            These Terms shall be governed by and construed in accordance with applicable laws, without giving effect to conflict of laws principles. We reserve the right to amend these terms at any time by posting the updated terms on this page with an updated revision date.
          </p>

          <div className={styles.actionRow}>
            <Link href="/privacy" className={styles.actionButton}>
              Read Privacy Policy ↗
            </Link>
            <Link href="/cookies" className={styles.actionButton}>
              View Cookie Policy ↗
            </Link>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
