"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Progressive enhancement: one observer, no scroll loop, no hidden SSR content. */
export function PublicMotion() {
  const marker = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const scope = marker.current?.closest<HTMLElement>(".publicScope");
    if (!scope) return;
    let pressed: HTMLElement | null = null;
    const release = () => { pressed?.removeAttribute("data-pressed"); pressed = null; };
    const press = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      release();
      const control = (event.target as Element).closest<HTMLElement>("a, button");
      if (!control || control.closest("header") || !scope.contains(control)) return;
      pressed = control;
      control.dataset.pressed = "true";
    };
    scope.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      release();
      scope.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, []);

  useEffect(() => {
    const scope = marker.current?.closest<HTMLElement>(".publicScope");
    if (!scope) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = Array.from(scope.querySelectorAll<HTMLElement>("[data-public-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.revealState = "shown";
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });

    for (const target of targets) {
      target.querySelectorAll<HTMLElement>(":scope > [data-reveal-item]").forEach((item, index) => {
        item.style.setProperty("--reveal-index", String(Math.min(index, 4)));
      });
      // Above-the-fold and restored scroll positions stay immediately readable.
      if (reduced.matches || target.getBoundingClientRect().top < window.innerHeight) continue;
      target.dataset.revealState = "pending";
      observer.observe(target);
    }
    const finish = () => {
      if (!reduced.matches) return;
      observer.disconnect();
      targets.forEach((target) => { delete target.dataset.revealState; });
    };
    const focus = (event: FocusEvent) => {
      const target = (event.target as Element).closest<HTMLElement>("[data-reveal-state='pending']");
      if (target) { delete target.dataset.revealState; observer.unobserve(target); }
    };
    reduced.addEventListener("change", finish);
    scope.addEventListener("focusin", focus);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", finish);
      scope.removeEventListener("focusin", focus);
      targets.forEach((target) => { delete target.dataset.revealState; });
    };
  }, [pathname]);

  return <span ref={marker} hidden aria-hidden="true" />;
}
