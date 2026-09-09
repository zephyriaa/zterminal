import Image from "next/image";
import styles from "./device-frame.module.css";

export function DeviceFrame() {
  return (
    <div className={styles.deviceWrapper}>
      <div className={styles.deviceBezel}>
        <div className={styles.deviceScreen}>
          <Image
            src="/landing/terminal-screenshot.png"
            alt="ZTerminal Workstation Interface"
            width={1440}
            height={900}
            className={styles.deviceImage}
            priority
          />
        </div>
        <div className={styles.deviceShine} aria-hidden="true" />
      </div>
      <div className={styles.deviceBase} aria-hidden="true">
        <div className={styles.deviceBaseTop} />
        <div className={styles.deviceBaseFront} />
      </div>
      <div className={styles.deviceGlow} aria-hidden="true" />
    </div>
  );
}

