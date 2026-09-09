import Image from "next/image";
import styles from "./device-frame.module.css";

export function DeviceFrame() {
  return (
    <div className={styles.scene} aria-label="ZTerminal research workstation shown on a laptop">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.laptop}>
        <div className={styles.lid}>
          <div className={styles.bezel}>
            <div className={styles.camera} aria-hidden="true" />
            <div className={styles.display}>
              <Image
                src="/landing/terminal-screenshot.png"
                alt="Current ZTerminal market canvas showing a BTC chart and research navigation"
                width={3200}
                height={1800}
                sizes="(max-width: 900px) 92vw, 72vw"
                className={styles.screenshot}
                priority
              />
              <div className={styles.glare} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className={styles.base} aria-hidden="true">
          <div className={styles.keyboard} />
          <div className={styles.trackpad} />
          <div className={styles.frontEdge} />
        </div>
      </div>
      <div className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
