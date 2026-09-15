"use client";

import { useEffect, useState } from "react";

export type MotionCapability = "high" | "standard" | "conservative" | "reduced";

function readCapability(): MotionCapability {
  if (typeof window === "undefined") return "standard";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData || window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720) return "conservative";
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 1180 && memory >= 6) return "high";
  return "standard";
}

export function useMotionCapability(): MotionCapability {
  const [capability, setCapability] = useState<MotionCapability>("standard");
  useEffect(() => {
    const update = () => setCapability(readCapability());
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);
  return capability;
}

export function useReducedPublicMotion() {
  return useMotionCapability() === "reduced";
}
