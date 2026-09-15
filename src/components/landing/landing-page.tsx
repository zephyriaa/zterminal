"use client";

import Link from "next/link";
import { HeroScene } from "./hero-scene";
import { ResearchLoop } from "./research-loop";
import { PublicFooter } from "@/components/public/public-footer";
import "@/components/public/public-theme.css";
import styles from "./landing-page.module.css";

const Arrow = () => <span aria-hidden="true">→</span>;

export function LandingPage() {
  return <main className={`${styles.page} publicScope`} id="main">
    <a className={styles.skipLink} href="#research">Skip to content</a>
    <HeroScene />
    <div className={styles.content}>
      <section className={styles.statement} id="research" aria-labelledby="statement-title">
        <p className={styles.eyebrow}>A FOCUSED MARKET RESEARCH WORKSPACE</p>
        <h2 id="statement-title">See the market. Test the thesis. Understand the result.</h2>
        <div><p>ZTerminal brings charting, market context, strategy research, and experiment records into one place—so an idea does not disappear between disconnected tools.</p><Link href="/terminal" className={styles.textLink}>Open ZTerminal <Arrow /></Link></div>
      </section>
      <section className={styles.product} aria-labelledby="product-title">
        <div><p className={styles.eyebrow}>START WITH WHAT IS HAPPENING</p><h2 id="product-title">A market view with room to investigate.</h2></div>
        <div className={styles.productGrid}>
          <article><span>01</span><h3>Chart workspaces</h3><p>Build and persist chart documents with studies, drawings, and multiple market views.</p></article>
          <article><span>02</span><h3>Live market context</h3><p>Inspect public Binance and Gate.io feeds, local order books, feed health, and large trades in context.</p></article>
          <article><span>03</span><h3>Research records</h3><p>Keep datasets, strategy revisions, runs, and one-variable experiments connected to the question they answer.</p></article>
        </div>
      </section>
      <ResearchLoop />
      <section className={styles.split} aria-labelledby="testing-title">
        <div><p className={styles.eyebrow}>TURN AN IDEA INTO A TEST</p><h2 id="testing-title">Make the assumptions visible.</h2><p>Use Python through the local Helper to run research against selected historical data. Review next-bar fills, archived results, and stress-test primitives before deciding what to change.</p><Link className={styles.textLink} href="/docs/python-research">Read the Python research guide <Arrow /></Link></div>
        <pre aria-label="Illustrative Python research code"><code>{`# Research rules stay explicit\nfast = ema(close, 20)\nslow = ema(close, 50)\nentry = crossover(fast, slow)\n\nrun(\n  strategy=entry,\n  dataset="BTC/USDT · 1h",\n  fills="next-bar"\n)`}</code></pre>
      </section>
      <section className={styles.local} aria-labelledby="local-title"><p className={styles.eyebrow}>LOCAL WHEN IT MATTERS</p><h2 id="local-title">Your research runs where you can inspect it.</h2><div><p>ZTerminal’s Windows Helper is the boundary for local research compute and persistent secrets. It archives results and supports cancellation and data hashing. Treat pasted code as trusted only after review: it runs with your Windows user permissions.</p><Link className={styles.primaryButton} href="/download">Download for Windows <Arrow /></Link></div></section>
      <section className={styles.final} aria-labelledby="final-title"><p className={styles.eyebrow}>BEGIN WITH THE REAL PRODUCT</p><h2 id="final-title">Research without leaving the thread.</h2><p>Explore the web terminal today, or follow the Windows release channel for verified installer status.</p><div><Link className={styles.primaryButton} href="/terminal">Open ZTerminal <Arrow /></Link><Link className={styles.textLink} href="/download">Download for Windows <Arrow /></Link></div><small>Decision-support software. Market data can be delayed or incomplete. Backtests are hypothetical.</small></section>
    </div>
    <PublicFooter />
  </main>;
}
