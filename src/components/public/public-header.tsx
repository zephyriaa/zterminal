"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./public-shared.module.css";
const links = [{ href: "/", label: "Overview" }, { href: "/#research-loop", label: "Research loop" }, { href: "/download", label: "Windows" }, { href: "/docs", label: "Docs" }];
export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname(); const headerRef = useRef<HTMLElement>(null); const [open, setOpen] = useState(false);
  useEffect(() => { const update = () => headerRef.current?.style.setProperty("--scroll", String(Math.min(1, window.scrollY / 90))); update(); window.addEventListener("scroll", update, { passive: true }); return () => window.removeEventListener("scroll", update); }, []);
  useEffect(() => { setOpen(false); }, [pathname]); useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  const active = (href: string) => href.includes("#") ? pathname === "/" : href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <header ref={headerRef} className={`${styles.header} ${overlay ? styles.overlay : ""}`}><Link href="/" className={styles.brand} aria-label="ZTerminal home"><i className={styles.brandMark} aria-hidden="true" /><span className={styles.brandName}>ZTERMINAL <span className={styles.betaBadge}>BETA</span></span></Link><button className={styles.menuButton} type="button" aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(value => !value)}><span /><span className={styles.srOnly}>Open navigation</span></button><nav id="public-navigation" className={`${styles.nav} ${open ? styles.navOpen : ""}`} aria-label="Public navigation">{links.map(link => <Link key={link.href} href={link.href} className={`${styles.navLink} ${active(link.href) ? styles.navLinkActive : ""}`} aria-current={active(link.href) ? "page" : undefined}>{link.label}</Link>)}<Link href="/terminal" className={styles.navCta}>Open ZTerminal <span aria-hidden="true">↗</span></Link></nav></header>;
}
