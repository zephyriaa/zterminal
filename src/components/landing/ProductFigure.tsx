import Image from "next/image";
import type { ProductCapture } from "./landing-content";
import styles from "./landing.module.css";

export function ProductFigure({ capture, hero = false, className = "" }: {
  capture: ProductCapture; hero?: boolean; className?: string;
}) {
  return (
    <figure className={`${styles.productFigure} ${className}`}>
      <div className={styles.productFrame}>
        <picture>
          {capture.mobileSrc && <source media="(max-width: 600px)" srcSet={capture.mobileSrc} width={1000} height={800} />}
          <Image src={capture.src} alt={capture.alt} width={capture.width} height={capture.height}
            sizes={hero ? "(max-width: 600px) 100vw, (max-width: 1440px) 88vw, 1240px" : "(max-width: 1023px) 90vw, 60vw"}
            loading={hero ? "eager" : "lazy"} fetchPriority={hero ? "high" : "auto"} className={styles.productImage} />
        </picture>
      </div>
      <figcaption className={styles.productCaption}><span>{capture.label}</span><span>{capture.context}</span></figcaption>
    </figure>
  );
}
