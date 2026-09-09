import Image from "next/image";
import styles from "./device-frame.module.css";

export function DeviceFrame() {
  return (
    <div className={styles.deviceWrapper}>
      <div className={styles.devicePerspective}>
        <div className={styles.laptop}>
          {/* Screen Lid */}
          <div className={styles.lid}>
            <div className={styles.bezel}>
              <div className={styles.cameraNotch} aria-hidden="true" />
              <div className={styles.display}>
                <Image
                  src="/landing/terminal-screenshot.png"
                  alt="ZTerminal Quantitative Research Workstation"
                  width={1600}
                  height={900}
                  className={styles.screenshot}
                  priority
                />
                <div className={styles.glassGlare} aria-hidden="true" />
              </div>
            </div>
            <div className={styles.lidHighlight} aria-hidden="true" />
          </div>

          {/* Laptop Base (Keyboard Deck + Trackpad) */}
          <div className={styles.base} aria-hidden="true">
            <div className={styles.deck}>
              <div className={styles.keyboardWell}>
                <div className={styles.keyboardTexture} />
              </div>
              <div className={styles.trackpad} />
            </div>
            <div className={styles.baseFrontEdge} />
            <div className={styles.baseLeftEdge} />
          </div>

          {/* Under-laptop Contact Shadow & Ambient Reflection */}
          <div className={styles.contactShadow} aria-hidden="true" />
          <div className={styles.ambientReflection} aria-hidden="true" />
        </div>
      </div>

      {/* Atmospheric Purple Glow behind the screen */}
      <div className={styles.screenBackdropGlow} aria-hidden="true" />
    </div>
  );
}
