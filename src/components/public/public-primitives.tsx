import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./public-primitives.module.css";

export function BackgroundField({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.backgroundField} ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

export function TechnicalEyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`${styles.eyebrow} ${className}`}>{children}</p>;
}

export function EditorialHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`${styles.heading} ${className}`}>{children}</h2>;
}

export function CTAButton({
  href,
  children,
  secondary = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${styles.cta} ${secondary ? styles.secondary : ""} ${className}`}
    >
      <span>{children}</span>
      <span className={styles.ctaArrow} aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}

export function ProductWindow({
  title = "ZTerminal / Research workspace",
  readout,
  children,
  className = "",
}: {
  title?: string;
  readout?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.productWindow} ${className}`}>
      <div className={styles.windowHeader} aria-hidden="true">
        <div className={styles.windowDots}>
          <i />
          <i />
          <i />
        </div>
        <span className={styles.windowTitle}>{title}</span>
        {readout ? (
          <span className={styles.windowReadout}>{readout}</span>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </div>
      <div className={styles.windowContent}>{children}</div>
    </div>
  );
}

export function CodeSurface({
  filename,
  runtime = "PYTHON 3.11+",
  code,
  className = "",
}: {
  filename: string;
  runtime?: string;
  code: string;
  className?: string;
}) {
  return (
    <div className={`${styles.codeSurface} ${className}`}>
      <div className={styles.codeBar}>
        <span>{filename}</span>
        <span>{runtime}</span>
      </div>
      <pre className={styles.codeSnippet}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function GlassPanel({
  children,
  className = "",
  highlight = true,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`${styles.glassPanel} ${highlight ? styles.glassHighlight : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({
  children,
  showDot = true,
  variant = "amber",
  className = "",
}: {
  children: ReactNode;
  showDot?: boolean;
  variant?: "amber" | "emerald" | "lilac";
  className?: string;
}) {
  const variantClass =
    variant === "emerald"
      ? styles.statusEmerald
      : variant === "lilac"
      ? styles.statusLilac
      : styles.statusAmber;

  return (
    <span className={`${styles.statusBadge} ${variantClass} ${className}`}>
      {showDot && <span className={styles.statusDot} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`${styles.hairline} ${className}`} />;
}

export function DataLabel({ children }: { children: ReactNode }) {
  return <span className={styles.dataLabel}>{children}</span>;
}
