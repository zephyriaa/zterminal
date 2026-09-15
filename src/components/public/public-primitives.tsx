import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./public-primitives.module.css";

export function BackgroundField({ className = "" }: { className?: string }) {
  return <div className={`${styles.backgroundField} ${className}`} aria-hidden="true"><i /><i /><i /></div>;
}

export function TechnicalEyebrow({ children }: { children: ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function EditorialHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`${styles.heading} ${className}`}>{children}</h2>;
}

export function CTAButton({ href, children, secondary = false, className = "" }: { href: string; children: ReactNode; secondary?: boolean; className?: string }) {
  return <Link href={href} className={`${styles.cta} ${secondary ? styles.secondary : ""} ${className}`}>{children}<span aria-hidden="true">↗</span></Link>;
}

export function DataLabel({ children }: { children: ReactNode }) {
  return <span className={styles.dataLabel}>{children}</span>;
}
