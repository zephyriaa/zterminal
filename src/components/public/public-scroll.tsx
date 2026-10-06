"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

/** Public documents only; touch, keyboard and nested readers retain native input. */
export function PublicScroll() {
  const marker = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!marker.current?.closest(".publicScope")) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(pointer: fine)");
    let instance: Lenis | undefined;
    let revision = 0;
    let disposed = false;
    const configure = async () => {
      const current = ++revision;
      instance?.destroy();
      instance = undefined;
      if (reduced.matches || !finePointer.matches) return;
      const { default: SmoothScroll } = await import("lenis");
      if (disposed || current !== revision || reduced.matches || !finePointer.matches) return;
      instance = new SmoothScroll({
        autoRaf: true, duration: .95, smoothWheel: true, syncTouch: false,
        anchors: true, allowNestedScroll: true,
        prevent: node => Boolean(node.closest("pre, textarea, select, [data-native-scroll], [role=dialog]")),
      });
    };
    void configure();
    reduced.addEventListener("change", configure);
    finePointer.addEventListener("change", configure);
    return () => {
      disposed = true; revision++;
      instance?.destroy();
      reduced.removeEventListener("change", configure);
      finePointer.removeEventListener("change", configure);
    };
  }, [pathname]);
  return <span ref={marker} hidden />;
}
