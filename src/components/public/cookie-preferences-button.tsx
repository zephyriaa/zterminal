"use client";

import styles from "./public-shared.module.css";

export function CookiePreferencesButton() {
  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("zt:open-cookie-settings"));
    }
  };

  return (
    <button type="button" onClick={handleClick} className={styles.footerButton}>
      Cookie Preferences
    </button>
  );
}
