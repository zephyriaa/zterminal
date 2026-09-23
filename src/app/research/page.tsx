import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import {
  BackgroundField,
  TechnicalEyebrow,
  CTAButton,
  CodeSurface,
  StatusBadge,
} from "@/components/public/public-primitives";
import "@/components/public/public-theme.css";
import styles from "./research.module.css";

export const metadata: Metadata = {
  title: "Research Workflow & Methodology — ZTerminal",
  description:
    "Explore ZTerminal's empirical quantitative research methodology: observation, hypothesis formulation, Python strategy authoring, vectorized testing, and audit inspection.",
};

const PIPELINE_NODES = [
  {
    num: "01 / INGEST",
    title: "Exchange WebSockets",
    desc: "Direct L2 orderbook feeds and tick-by-tick trades from Binance, OKX, Bybit, and Gate.io.",
  },
  {
    num: "02 / BUFFER",
    title: "Supervised Ingress",
    desc: "Ordered event journaling with monotonic sequence validation and staging before persistence.",
  },
  {
    num: "03 / ENGINE",
    title: "Local Python 3.11+",
    desc: "Vectorized signal generation using pandas, NumPy, and vectorbt executed natively on your CPU.",
  },
  {
    num: "04 / ARCHIVE",
    title: "Hashed Parquet Store",
    desc: "Immutable local datasets with SHA-256 parameter manifests and reproducible run records.",
  },
];

const STAGES = [
  {
    num: "01",
    name: "Observe",
    tag: "MICROSTRUCTURE & DEPTH",
    heading: "Microstructure observation without breaking context",
    body: "Quantitative research begins with an empirical phenomenon observed in the real market: order book depth imbalance, liquidity absorption at high-volume nodes, or volatility compressions. ZTerminal provides unified multi-chart docking and real-time DOM depth so you can spot patterns directly on the market canvas.",
    callout: "Principle: An observed market anomaly is a hypothesis prompt, never an automatic signal.",
  },
  {
    num: "02",
    name: "Formulate",
    tag: "SPECIFICATION & BOUNDARIES",
    heading: "State explicit, testable conditions",
    body: "Before running backtests, define your quantitative rules: the specific entry triggers, exit conditions, holding horizons, maximum allowable slippage, and the statistical benchmark. A formal null hypothesis (H0) prevents curve-fitting and retrospective justification.",
    callout: "Principle: If a hypothesis cannot be falsified by historical evidence, it is not quantitative.",
  },
  {
    num: "03",
    name: "Code",
    tag: "PYTHON 3.11+ & VECTORBT",
    heading: "Standard scientific Python on your machine",
    body: "ZTerminal abandons proprietary domain-specific scripting languages. You write strategies in standard Python using pandas, NumPy, and vectorbt. Python code executes natively on your CPU through the local helper process, giving you complete access to the broader scientific computing ecosystem.",
    callout: "Principle: Proprietary scripting DSLs introduce lock-in; standard Python guarantees longevity and transparency.",
  },
  {
    num: "04",
    name: "Test",
    tag: "VECTORIZED SIMULATION",
    heading: "Vectorized backtesting with realistic friction",
    body: "Simulate strategy execution across millions of observed bars in sub-second runtimes. The simulation engine applies explicit taker and maker exchange fee structures, slippage penalties, and timestamp alignment rules to ensure no future information leaks into historical decisions.",
    callout: "Principle: Frictionless backtests are mathematical fiction; model execution costs upfront.",
  },
  {
    num: "05",
    name: "Inspect",
    tag: "EMPIRICAL SCRUTINY",
    heading: "Scrutinize drawdown duration and distribution tails",
    body: "Evaluate more than just cumulative return. Scrutinize Sharpe and Sortino ratios, profit factor, win/loss payoff ratios, underwater drawdown curves, and Monte Carlo bootstrap resamples. Expose whether returns were driven by structural edge or a handful of outlier market regimes.",
    callout: "Principle: A strategy that cannot survive random block-bootstrap resampling is overfitted.",
  },
  {
    num: "06",
    name: "Refine",
    tag: "IMMUTABLE ARCHIVE",
    heading: "Accept, reject, or archive with verifiable hashes",
    body: "Every strategy evaluation, parameter manifest, and backtest run computes explicit cryptographic provenance hashes (sourceHash, datasetHash, resultHash). You can inspect parameter sweeps across runs, track performance degradation, and maintain an auditable local research record.",
    callout: "Principle: Preserving negative test results is just as valuable as recording winning ones.",
  },
];

const CODE_SAMPLE = `# Research Strategy Definition — ZTerminal Python API
import zterminal as zt

def strategy(data, params):
    # Educational research example. Levels use prior completed bars.
    fast_period = int(params.get("fast", 9))
    slow_period = int(params.get("slow", 21))

    # Compute vectorized indicators
    fast = zt.ema(data.close, fast_period)
    slow = zt.ema(data.close, slow_period)

    # Return structured strategy contract evaluated by local helper
    return zt.Strategy(
        entries=zt.crossover(fast, slow),
        exits=zt.crossunder(fast, slow),
        plots={
            "Fast EMA": fast,
            "Slow EMA": slow,
        },
    );`;

export default function ResearchPage() {
  return (
    <div className={`${styles.page} publicScope`}>
      <BackgroundField />
      <PublicHeader />

      <main className={styles.content}>
        {/* HERO */}
        <section data-public-intro="" className={styles.hero} aria-labelledby="research-title">
          <TechnicalEyebrow>QUANTITATIVE METHODOLOGY</TechnicalEyebrow>
          <h1 id="research-title" className={styles.title}>
            The Research Loop.
            <em>From market data to reproducible evidence.</em>
          </h1>
          <p className={styles.lead}>
            ZTerminal structures market research as an empirical scientific loop:
            observe market microstructure, state falsifiable hypotheses, write portable
            Python strategies, test against historical data, and inspect evidence.
          </p>
        </section>

        {/* ARCHITECTURAL DATA PIPELINE */}
        <section data-public-reveal="content" id="loop" className={styles.pipelineSection} aria-labelledby="pipeline-heading">
          <TechnicalEyebrow>DATA ARCHITECTURE</TechnicalEyebrow>
          <div className={styles.pipelineGrid} aria-label="Data flow pipeline stages">
            {PIPELINE_NODES.map((node) => (
              <article key={node.num} className={styles.pipelineNode}>
                <span className={styles.pipelineNodeNum}>{node.num}</span>
                <h3 className={styles.pipelineNodeTitle}>{node.title}</h3>
                <p className={styles.pipelineNodeDesc}>{node.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 6 RESEARCH STAGES */}
        <section data-public-reveal="content" className={styles.stageList} aria-label="Research workflow steps">
          {STAGES.map((stage) => (
            <article key={stage.num} className={styles.stageCard}>
              <div className={styles.stageSidebar}>
                <span className={styles.stageNum}>{stage.num} / 06</span>
                <h2 className={styles.stageName}>{stage.name}</h2>
                <span className={styles.stageTag}>{stage.tag}</span>
              </div>

              <div className={styles.stageContent}>
                <h3 className={styles.stageHeading}>{stage.heading}</h3>
                <p className={styles.stageBody}>{stage.body}</p>
                <div className={styles.stageCallout}>
                  <strong>{stage.callout.split(":")[0]}:</strong>{" "}
                  {stage.callout.split(":").slice(1).join(":")}
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* CODE SURFACE DEMO */}
        <section data-public-reveal="content" className={styles.codeSection} aria-labelledby="code-heading">
          <TechnicalEyebrow>STRATEGY SPECIFICATION</TechnicalEyebrow>
          <h2 id="code-heading" className={styles.codeHeading}>
            Standard Python. Direct execution.
          </h2>
          <p className={styles.codeLead}>
            Below is an illustrative Python strategy using the ZTerminal SDK v1 and vectorbt.
            The code runs locally on your machine without remote sandbox latency.
          </p>
          <CodeSurface
            filename="mean_reversion_strategy.py"
            runtime="PYTHON 3.11+ / LOCAL ENGINE"
            code={CODE_SAMPLE}
          />
        </section>

        {/* LOCAL ARCHITECTURE BOUNDARY */}
        <section data-public-reveal="content"
          id="boundary-heading"
          className={styles.boundarySection}
          aria-labelledby="boundary-title"
        >
          <StatusBadge variant="lilac">EXECUTION PRIVACY &amp; SECURITY</StatusBadge>
          <h2 id="boundary-title" className={styles.boundaryHeading}>
            The Local Compute Boundary
          </h2>
          <p className={styles.boundaryLead}>
            Quantitative trading models are sensitive intellectual property. ZTerminal executes
            Python strategies locally on your own machine.
          </p>

          <div className={styles.boundaryGrid}>
            <div className={styles.boundaryItem}>
              <h3 className={styles.boundaryTitle}>Browser Workspace</h3>
              <p className={styles.boundaryDesc}>
                Connects to public market feeds, renders charts and volume profiles,
                and acts as the command interface for drafting strategy hypotheses.
              </p>
            </div>
            <div className={styles.boundaryItem}>
              <h3 className={styles.boundaryTitle}>Local Process (Helper)</h3>
              <p className={styles.boundaryDesc}>
                Executes user Python scripts with standard packages (pandas, NumPy, vectorbt).
                Stores historical databases and API credentials strictly on local storage.
              </p>
            </div>
          </div>
        </section>

        {/* ACTION CTA BANNER */}
        <section data-public-reveal="content" className={styles.actionBanner}>
          <div>
            <h2 className={styles.actionBannerTitle}>Ready to begin research?</h2>
            <p className={styles.actionBannerLead}>
              Launch the web terminal or consult the Python Research API documentation.
            </p>
          </div>
          <div className={styles.actionBannerButtons}>
            <CTAButton href="/terminal">Open ZTerminal</CTAButton>
            <CTAButton href="/docs/python-research" secondary>
              Python API Guide
            </CTAButton>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
