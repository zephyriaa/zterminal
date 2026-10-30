import type { Metadata } from "next";
import Link from "next/link";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Chart credits — ZTerminal Documentation",
  description: "Lightweight Charts attribution and license notice.",
};

export default function ChartCreditsPage() {
  return (
    <article className={styles.docArticle}>
      <Link href="/docs" className={styles.backLink}>← Documentation index</Link>
      <h1 className={styles.docTitle}>Chart credits</h1>
      <section className={styles.docSection}>
        <h2 className={styles.sectionTitle}>TradingView Lightweight Charts™</h2>
        <p className={styles.sectionPara}>
          Copyright (с) 2025 TradingView, Inc. <a href="https://www.tradingview.com/">https://www.tradingview.com/</a>
        </p>
        <p className={styles.sectionPara}>
          ZTerminal uses Lightweight Charts for chart rendering, licensed under the <a href="/licenses/lightweight-charts-LICENSE.txt">Apache License, Version 2.0</a>.
        </p>
      </section>
    </article>
  );
}
