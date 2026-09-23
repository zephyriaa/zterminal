import type { CSSProperties, ReactNode } from "react";

// Stable server markup. PublicMotion arms only offscreen content, preventing
// a visible -> hidden hydration flash or remounts of interactive children.
type RevealProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  yOffset?: number;
  duration?: number;
};

export function FadeInView({ children, className, style, delay = 0 }: RevealProps) {
  return <div className={className} data-public-reveal="content" style={{ "--reveal-delay": `${Math.min(delay, .24)}s`, ...style } as CSSProperties}>{children}</div>;
}

export function ScaleReveal({ children, className, style, delay = 0 }: RevealProps) {
  return <div className={className} data-public-reveal="image" style={{ "--reveal-delay": `${Math.min(delay, .24)}s`, ...style } as CSSProperties}>{children}</div>;
}

export function StaggerContainer({ children, className, style, staggerDelay = .08, delay = 0 }: RevealProps & { staggerDelay?: number }) {
  return <div className={className} data-public-reveal="group" style={{ "--reveal-step": `${staggerDelay}s`, "--reveal-delay": `${Math.min(delay, .24)}s`, ...style } as CSSProperties}>{children}</div>;
}

export function StaggerItem({ children, className, style }: RevealProps) {
  return <div className={className} data-reveal-item="" style={style}>{children}</div>;
}
