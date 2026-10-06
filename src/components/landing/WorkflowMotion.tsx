"use client";
import { useEffect, useRef } from "react";

/** Presentation only: all chapters and evidence are available without JavaScript. */
export function WorkflowMotion() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>("[data-workflow]");
    if (!root || !("IntersectionObserver" in window)) return;
    const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-workflow-step]"));
    const desktop = window.matchMedia("(min-width: 1024px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)");
    let observer: IntersectionObserver | undefined;
    const activate = () => {
      const middle = window.innerHeight * .48;
      let selected = 0;
      chapters.forEach((chapter, index) => { if (chapter.getBoundingClientRect().top <= middle) selected = index; });
      root.dataset.activeStep = String(selected);
      root.style.setProperty("--workflow-progress", String(selected / Math.max(1, chapters.length - 1)));
    };
    const configure = () => {
      observer?.disconnect();
      if (!desktop.matches) { delete root.dataset.enhanced; return; }
      root.dataset.enhanced = "true";
      activate();
      // Percentage root margins use viewport width; pixels keep the band vertical.
      observer = new IntersectionObserver(activate, {
        rootMargin: `-${Math.round(window.innerHeight * .47)}px 0px -${Math.round(window.innerHeight * .51)}px 0px`,
        threshold: 0,
      });
      chapters.forEach(chapter => observer?.observe(chapter));
    };
    configure();
    desktop.addEventListener("change", configure);
    window.addEventListener("pageshow", configure);
    window.addEventListener("resize", configure);
    return () => {
      observer?.disconnect();
      desktop.removeEventListener("change", configure);
      window.removeEventListener("pageshow", configure);
      window.removeEventListener("resize", configure);
      delete root.dataset.enhanced;
      root.style.removeProperty("--workflow-progress");
    };
  }, []);
  return <span ref={marker} hidden />;
}
