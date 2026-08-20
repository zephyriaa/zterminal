import zterminalMark from "@/assets/zterminal-mark.png";
import { ArrowLeft, ArrowRight, CheckCircle2, Cloud, Database, LockKeyhole, ScanLine, ShieldCheck, Workflow } from "lucide-react";
import { Link } from "wouter";

type InformationPageKind = "research" | "data-contract" | "access";

type InformationPageProps = { kind: InformationPageKind };

const content = {
  research: {
    eyebrow: "Research workflow",
    icon: Workflow,
    title: "Turn a market observation into inspectable evidence.",
    summary: "ZTerminal keeps the chart, source window, strategy logic, and historical result in one non-executing research workspace.",
    principles: [
      ["Start with a bounded market window", "The chart discloses source, coverage, timestamp, and withheld state before it becomes research input."],
      ["Make the rule inspectable", "Indicator Lab uses a closed declarative runtime rather than importing or executing Pine Script or arbitrary user code."],
      ["Keep historical evidence in context", "Strategy evaluation is deterministic next-bar research evidence, not an order simulation, forecast, or trading qualification."],
    ],
  },
  "data-contract": {
    eyebrow: "Public data contract",
    icon: Database,
    title: "Public market data is useful only when its limits stay visible.",
    summary: "ZTerminal labels venue, source state, coverage, and time context rather than silently filling unavailable public data with assumptions.",
    principles: [
      ["Source-scoped by design", "Candles, public tape, depth, and derived order-flow views disclose their venue and may never be combined as if they were one universal feed."],
      ["Fail closed when evidence is missing", "LIVE, STALE, DEGRADED, and UNAVAILABLE states remain visible. An unreconciled feed is withheld rather than shown as current."],
      ["No hidden execution path", "The product accepts no trading credentials and exposes no broker, order-entry, paper-trading, or automated execution route."],
    ],
  },
  access: {
    eyebrow: "Account access",
    icon: LockKeyhole,
    title: "Keep public research open. Keep workspace ownership explicit.",
    summary: "Guests can inspect public research data. Signed-in researchers use Google identity to own and explicitly synchronize a bounded workspace across devices.",
    principles: [
      ["Guest access remains useful", "A browser-local fallback retains only bounded terminal preferences. It stores neither market data nor account credentials."],
      ["Cloud workspaces are account isolated", "Signed-in workspace preferences and research drafts are stored per account, use revision-aware conflict handling, and are synchronized explicitly."],
      ["No password or trading-credential vault", "Google sign-in establishes an account session. ZTerminal does not collect broker credentials or create an execution surface."],
    ],
  },
} as const;

export function ProductInformationPage({ kind }: InformationPageProps) {
  const page = content[kind];
  const Icon = page.icon;
  return <div className="product-information-page">
    <header className="product-information-nav">
      <Link href="/" className="landing-brand" aria-label="ZTerminal home"><img src={zterminalMark} alt="ZTerminal" /><span>ZTERMINAL</span></Link>
      <div><Link href="/" className="product-information-back"><ArrowLeft size={15} />Landing</Link><Link href="/terminal" className="product-information-terminal">Open terminal <ArrowRight size={15} /></Link></div>
    </header>
    <main className="product-information-shell">
      <section className="product-information-hero">
        <span className="product-information-eyebrow"><Icon size={15} />{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.summary}</p>
        <div className="product-information-proof"><span><CheckCircle2 size={15} />Public-source labelled</span><span><ShieldCheck size={15} />Execution disabled</span><span><ScanLine size={15} />Evidence-led workspace</span></div>
      </section>
      <section className="product-information-principles" aria-label={`${page.eyebrow} principles`}>
        {page.principles.map(([title, detail], index) => <article key={title}><span>0{index + 1}</span><div><h2>{title}</h2><p>{detail}</p></div></article>)}
      </section>
      <section className="product-information-callout">
        <Cloud size={19} /><div><b>Research-only by design</b><p>ZTerminal supports deliberate, source-aware market research. It does not make investment recommendations or provide a route to place trades.</p></div>
      </section>
    </main>
    <footer className="product-information-footer"><span>Public-market research only · No broker route</span><Link href="/account">Account access</Link><Link href="/terminal">Open terminal</Link></footer>
  </div>;
}
