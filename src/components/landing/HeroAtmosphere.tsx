"use client";

import { useEffect, useRef } from "react";

/** Lighting reacts to input; the product and document remain in normal flow. */
export function HeroAtmosphere() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const scene = marker.current?.closest<HTMLElement>("[data-hero-scene]");
    if (!scene) return;
    // An offscreen entrance can disturb the browser's restored anchor position.
    if (!location.hash && window.scrollY < 10) scene.dataset.heroEntry = "true";
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let visible = true;
    let lightX = 62;
    let lightY = 32;
    const paint = () => {
      frame = 0;
      if (!visible || !motion.matches || document.hidden) return;
      const bounds = scene.getBoundingClientRect();
      const travel = Math.min(1, Math.max(0, -bounds.top / window.innerHeight));
      scene.style.setProperty("--scene-travel", String(travel));
      scene.style.setProperty("--light-x", `${lightX}%`);
      scene.style.setProperty("--light-y", `${lightY}%`);
    };
    const schedule = () => { if (!frame && visible && motion.matches) frame = requestAnimationFrame(paint); };
    const move = (event: PointerEvent) => {
      if (!pointer.matches || !motion.matches) return;
      const bounds = scene.getBoundingClientRect();
      lightX = 56 + (event.clientX - bounds.left) / bounds.width * 12;
      lightY = 26 + Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) * 12;
      schedule();
    };
    const reset = () => { lightX = 62; lightY = 32; schedule(); };
    const configure = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      scene.style.removeProperty("--scene-travel");
      scene.style.removeProperty("--light-x");
      scene.style.removeProperty("--light-y");
      schedule();
    };
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) schedule();
    }) : undefined;
    observer?.observe(scene);
    scene.addEventListener("pointermove", move);
    scene.addEventListener("pointerleave", reset);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", configure);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      scene.removeEventListener("pointermove", move);
      scene.removeEventListener("pointerleave", reset);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
      motion.removeEventListener("change", configure);
      scene.style.removeProperty("--scene-travel");
      scene.style.removeProperty("--light-x");
      scene.style.removeProperty("--light-y");
      delete scene.dataset.heroEntry;
    };
  }, []);
  return <span ref={marker} hidden />;
}
