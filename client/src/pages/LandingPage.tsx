import { startLogin } from "@/const";
import zterminalMark from "@/assets/zterminal-mark.png";
import {
  ArrowRight,
  CandlestickChart,
  CheckCircle2,
  Database,
  Layers3,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Link } from "wouter";

const capabilities = [
  {
    icon: CandlestickChart,
    eyebrow: "Verified market windows",
    title: "Start with a chart you can inspect.",
    body: "Public Gate.io perpetual snapshots and historical candles show their source, coverage, timestamp, and withheld state rather than filling gaps with assumptions.",
  },
  {
    icon: Workflow,
    eyebrow: "Research workflow",
    title: "Turn an observation into evidence.",
    body: "Write a hypothesis, lock a verified historical window, and review deterministic next-bar evaluation evidence without a broker route or automated execution.",
  },
  {
    icon: Layers3,
    eyebrow: "Order-flow context",
    title: "Keep the venue in view.",
    body: "Selected-venue public tape, Gate.io depth, Flow Pulse, footprint, and large-print context remain live-only and explicitly labelled by source.",
  },
];

const guardrails = [
  "Public-market research only — no broker, order, paper-trading, or execution route.",
  "A stale or unreconciled public feed is withheld instead of presented as current data.",
  "Browser-local preferences are kept separate from market data and credentials.",
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="ZTerminal home">
          <img src={zterminalMark} alt="ZTerminal" />
          <span>ZTERMINAL</span>
        </Link>
        <nav aria-label="Primary navigation">
          <a href="#research">Research</a>
          <a href="#data-contract">Data contract</a>
          <a href="#access">Access</a>
        </nav>
        <div className="landing-nav-actions">
          <Link href="/terminal" className="landing-text-link">Open terminal</Link>
          <button className="landing-login" onClick={() => startLogin()}>Account access</button>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">Evidence-led market research</div>
            <h1 id="landing-title">Research the market with evidence.</h1>
            <p>ZTerminal is a chart-first research terminal for public-market data, venue-labelled order-flow context, and reproducible analysis. The interface remains strictly non-executing.</p>
            <div className="landing-hero-actions">
              <Link href="/terminal" className="landing-primary-cta">Open terminal <ArrowRight size={17} /></Link>
              <button className="landing-secondary-cta" onClick={() => startLogin()}><LockKeyhole size={16} /> Account access</button>
            </div>
            <div className="landing-hero-proof" aria-label="Product principles">
              <span><CheckCircle2 size={15} /> Public source labelled</span>
              <span><CheckCircle2 size={15} /> Fail-closed data states</span>
              <span><CheckCircle2 size={15} /> Execution disabled</span>
            </div>
          </div>
          <div className="landing-terminal-preview" aria-label="ZTerminal product preview">
            <div className="preview-topline"><span className="preview-dot mint" /><span className="preview-dot violet" /><span className="preview-dot dim" /><b>ZT / VERIFIED RESEARCH</b><span>15m · public</span></div>
            <div className="preview-market-row"><div><small>GATE.IO · PERPETUAL</small><strong>BTC / USDT</strong></div><div><small>LAST</small><b>104,862.4</b></div><div className="preview-up"><small>24H</small><b>+2.18%</b></div></div>
            <div className="preview-chart" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="preview-status"><span><i /> Verified candles · 97 bars</span><span>Pan / zoom enabled</span></div>
          </div>
        </section>

        <section className="landing-trustbar" aria-label="Research terminal capabilities">
          <span>Built for deliberate research</span><b>Verified chart data</b><b>Venue-labelled flow</b><b>Closed strategy runtime</b><b>Local-first workspace</b>
        </section>

        <section className="landing-section landing-capabilities" id="research" aria-labelledby="research-title">
          <div className="landing-section-heading"><span>Research, not noise</span><h2 id="research-title">A compact workstation where each layer has a reason to exist.</h2><p>The terminal keeps chart context primary. Studies and research tools open when you ask for them, and every visible panel discloses its source and live-data limits.</p></div>
          <div className="landing-capability-grid">
            {capabilities.map(({ icon: Icon, eyebrow, title, body }) => <article key={title} className="landing-capability-card"><span className="landing-card-icon"><Icon size={20} /></span><small>{eyebrow}</small><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </section>

        <section className="landing-contract" id="data-contract" aria-labelledby="contract-title">
          <div className="landing-contract-index" aria-hidden="true"><span>01</span><small>DATA CONTRACT</small><Database size={22} /></div>
          <div><span className="landing-eyebrow"><span><ShieldCheck size={14} /></span> A visible data contract</span><h2 id="contract-title">No invented tape. No hidden automation.</h2><p>Public exchange data can be useful when it is represented honestly. ZTerminal separates live, stale, degraded, and unavailable states so that the interface cannot quietly promote an old snapshot into current order-flow evidence.</p><ul>{guardrails.map((item) => <li key={item}><CheckCircle2 size={17} />{item}</li>)}</ul></div>
        </section>

        <section className="landing-access" id="access" aria-labelledby="access-title">
          <div><span>Research ownership</span><h2 id="access-title">Keep public research open. Keep ownership explicit.</h2><p>Open the terminal as a guest to inspect public market data. A signed-in workspace will be introduced only with a configured identity provider and verified durable storage.</p></div>
          <div className="landing-access-actions"><Link href="/terminal" className="landing-secondary-cta">Continue as guest <ScanLine size={16} /></Link><button className="landing-primary-cta" onClick={() => startLogin()}>Account access <ArrowRight size={17} /></button><small>Identity provider configuration required · no password vault · no trading credentials</small></div>
        </section>
      </main>

      <footer className="landing-footer"><span>© {new Date().getFullYear()} ZTerminal</span><span>Public-market research only · Execution disabled · No broker route</span><Link href="/terminal">Open terminal</Link></footer>
    </div>
  );
}
