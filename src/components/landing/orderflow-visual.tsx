import type { CSSProperties } from "react";
import styles from "./landing-page.module.css";

const candles = [
  [5, 36, 8, 9, 7, "down"], [11, 34, 10, 7, 8, "down"], [17, 37, 6, 11, 6, "up"], [23, 43, 10, 10, 7, "up"],
  [29, 42, 9, 8, 8, "down"], [35, 47, 8, 11, 6, "up"], [41, 50, 5, 7, 5, "down"], [47, 48, 11, 7, 8, "down"],
  [53, 52, 8, 9, 6, "up"], [59, 54, 6, 6, 5, "down"], [65, 55, 5, 7, 6, "up"], [71, 51, 10, 8, 10, "down"],
  [77, 55, 6, 11, 6, "up"], [83, 59, 13, 9, 7, "up"], [89, 57, 8, 7, 9, "down"], [95, 62, 6, 11, 5, "up"],
] as const;

const markers = [
  [4, 43, "", "micro", "sell"], [6, 47, "", "micro", "sell"], [8, 44, "1M", "small", "sell"], [10, 50, "", "micro", "buy"],
  [16, 42, "", "micro", "buy"], [18, 47, "2M", "small", "buy"], [22, 55, "3M", "medium", "buy"], [24, 49, "", "micro", "buy"], [26, 57, "", "micro", "sell"],
  [29, 49, "2M", "small", "sell"], [33, 54, "", "micro", "buy"], [35, 57, "4M", "medium", "buy"], [37, 53, "", "micro", "buy"],
  [41, 54, "", "micro", "sell"], [45, 62, "2M", "small", "sell"], [47, 60, "5M", "medium", "sell"], [49, 56, "", "micro", "sell"],
  [53, 59, "", "micro", "buy"], [56, 63, "3M", "small", "buy"], [59, 60, "4M", "medium", "sell"], [62, 57, "", "micro", "sell"],
  [65, 62, "", "micro", "buy"], [68, 57, "2M", "small", "buy"], [71, 63, "6M", "medium", "sell"], [74, 59, "", "micro", "sell"],
  [77, 63, "5M", "medium", "buy"], [80, 59, "", "micro", "buy"], [83, 74, "8M", "large", "buy"], [86, 69, "", "micro", "buy"],
  [88, 67, "12M", "large", "sell"], [90, 65, "25M", "large", "buy"], [93, 70, "", "micro", "sell"], [95, 68, "7M", "medium", "buy"],
] as const;

const profileBars = [
  [18, "sell"], [31, "sell"], [46, "buy"], [64, "buy"], [82, "buy"], [94, "buy"], [76, "sell"], [58, "sell"], [42, "buy"], [27, "buy"], [15, "sell"],
] as const;

function Candle({ x, bottom, height, wickTop, wickBottom, direction, index }: { x: number; bottom: number; height: number; wickTop: number; wickBottom: number; direction: string; index: number }) {
  const tone = direction === "up" ? styles.terminalCandleUp : styles.terminalCandleDown;
  return <span className={`${styles.terminalCandle} ${tone}`} style={{ "--x": `${x}%`, "--b": `${bottom}%`, "--h": `${height}%`, "--wick-top": `${wickTop}px`, "--wick-bottom": `${wickBottom}px`, "--delay": `${index * 55}ms` } as CSSProperties}><i /></span>;
}

const overlayController = `
(() => {
  const shell = document.getElementById('zt-terminal-comparison');
  const body = shell?.querySelector('[data-terminal-body]');
  const divider = shell?.querySelector('[data-terminal-divider]');
  if (!shell || !body || !divider || shell.dataset.bound === 'true') return;
  shell.dataset.bound = 'true';
  let dragging = false;
  const apply = (clientX) => {
    const rect = body.getBoundingClientRect();
    const next = Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100));
    shell.style.setProperty('--split', next.toFixed(1) + '%');
    divider.setAttribute('aria-valuenow', String(Math.round(next)));
  };
  divider.addEventListener('pointerdown', (event) => { dragging = true; divider.setPointerCapture?.(event.pointerId); apply(event.clientX); });
  divider.addEventListener('pointermove', (event) => { if (dragging) apply(event.clientX); });
  divider.addEventListener('pointerup', () => { dragging = false; });
  divider.addEventListener('pointercancel', () => { dragging = false; });
  divider.addEventListener('keydown', (event) => {
    const current = Number.parseFloat(getComputedStyle(shell).getPropertyValue('--split')) || 50;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = Math.max(8, Math.min(92, current + (event.key === 'ArrowLeft' ? -4 : 4)));
      shell.style.setProperty('--split', next + '%');
      divider.setAttribute('aria-valuenow', String(next));
    }
  });
})();
`;

export function OrderflowVisual() {
  return (
    <section className={styles.orderflowVisual} aria-label="ZTerminal market lens with a draggable order-flow overlay">
      <div className={styles.terminalShell} id="zt-terminal-comparison" style={{ "--split": "8%" } as CSSProperties}>
        <div className={styles.terminalTopbar}>
          <div className={styles.terminalIdentity}><img className={styles.surfaceLogo} src="/landing/zterminal-logo-mark.png" alt="" /><strong>ZT / MARKET LENS</strong><span>1M</span><span>CONTEXT VIEW</span><em>ILLUSTRATIVE</em></div>
          <div className={styles.terminalTools}><b>ORDER FLOW</b><i /><i /><i /><i /></div>
        </div>

        <div className={styles.terminalBody} data-terminal-body>
          <div className={styles.terminalChartPanel}>
            <div className={`${styles.marketPanelLabel} ${styles.plainLabel}`}><b>01</b><span>PLAIN CANDLES</span></div>
            <div className={`${styles.marketPanelLabel} ${styles.flowLabel}`}><b>02</b><span>WITH ORDER FLOW <em>/ BIG ACTIVITY</em></span></div>
            <div className={styles.terminalCandleField}>
              {candles.map(([x, bottom, height, wickTop, wickBottom, direction], index) => <Candle key={`${x}-${bottom}`} x={x} bottom={bottom} height={height} wickTop={wickTop} wickBottom={wickBottom} direction={direction} index={index} />)}
              <div className={styles.pricePath} aria-hidden="true" />
              <div className={styles.marketFloor} />
              <div className={styles.orderFlowOverlay} aria-hidden="true">
                {markers.map(([x, anchor, label, scale, side], index) => <span className={`${styles.flowMarker} ${styles[`marker${scale[0].toUpperCase()}${scale.slice(1)}`]} ${styles[`marker${side[0].toUpperCase()}${side.slice(1)}`]}`} key={`${x}-${anchor}-${index}`} style={{ "--x": `${x}%`, "--anchor": `${anchor}%`, "--delay": `${index * 90}ms` } as CSSProperties}><b>{label}</b><i /></span>)}
                <div className={styles.volumeProfile} aria-label="Illustrative volume profile"><span>VOL</span>{profileBars.map(([width, side], index) => <i className={side === "buy" ? styles.profileBuy : styles.profileSell} key={`${width}-${index}`} style={{ "--w": `${width}%` } as CSSProperties} />)}</div>
              </div>
            </div>
            <button className={styles.terminalDivide} type="button" data-terminal-divider aria-label="Drag to reveal or hide large order overlays" role="slider" aria-valuemin={8} aria-valuemax={92} aria-valuenow={8}><i>↔</i></button>
            <div className={styles.priceScale}><span>21,772.00</span><span>21,768.00</span><span>21,764.00</span><span>21,760.00</span><b>21,756.50</b><span>21,752.00</span><span>21,748.00</span></div>
            <div className={styles.panelTimes}><span>08:45</span><span>08:50</span><span>08:55</span><span>09:00</span><span>09:05</span><span>09:10</span><span>09:15</span><span>09:20</span><span>09:25</span><span>09:30</span><span>09:35</span></div>
          </div>
        </div>

        <div className={styles.terminalFooter}><div><b>1D</b><span>5D</span><span className={styles.activeTimeframe}>1M</span><span>3M</span><span>6M</span><span>YTD</span><span>1Y</span><span>ALL</span></div><div><span>09:23:37</span><span>UTC−5</span><span>%</span><span>LOG</span><b>AUTO</b></div></div>
        <script dangerouslySetInnerHTML={{ __html: overlayController }} />
      </div>
    </section>
  );
}
