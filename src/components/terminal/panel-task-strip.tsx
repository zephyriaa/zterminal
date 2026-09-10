"use client";
import { useEffect } from "react";
import { usePanels } from "@/stores/panels";

export function PanelTaskStrip() {
  useEffect(() => {
    void usePanels.persist.rehydrate();
    const canvas = document.querySelector(".zt-reference-canvas");
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) =>
      usePanels.getState().setViewport(entry.contentRect.width, entry.contentRect.height)
    );
    observer.observe(canvas);
    const reset = () => usePanels.getState().reset();
    window.addEventListener("zterminal:reset-layout", reset);
    return () => {
      observer.disconnect();
      window.removeEventListener("zterminal:reset-layout", reset);
    };
  }, []);
  return null;
}
