"use client";

import React from "react";
import styles from "./aapl-workstation-screen.module.css";

const WATCHLIST_DATA = [
  { symbol: "AAPL", last: "178.24", chg: "+2.17", pct: "+1.23%", up: true, active: true },
  { symbol: "MSFT", last: "425.11", chg: "+1.94", pct: "+0.46%", up: true },
  { symbol: "NVDA", last: "903.62", chg: "+8.48", pct: "+0.95%", up: true },
  { symbol: "TSLA", last: "171.32", chg: "-2.11", pct: "-1.22%", up: false },
  { symbol: "AMZN", last: "186.54", chg: "+1.26", pct: "+0.68%", up: true },
  { symbol: "GOOGL", last: "153.21", chg: "+0.73", pct: "+0.48%", up: true },
  { symbol: "META", last: "493.18", chg: "+2.90", pct: "+0.59%", up: true },
  { symbol: "SPY", last: "518.32", chg: "+0.72", pct: "+0.14%", up: true },
  { symbol: "QQQ", last: "445.18", chg: "+1.45", pct: "+0.33%", up: true },
];

const NEWS_DATA = [
  { time: "08:24", headline: "Apple tops estimates, raises guidance on AI demand", source: "Bloomberg" },
  { time: "06:41", headline: "iPhone upgrade cycle shows signs of acceleration", source: "Reuters" },
  { time: "Apr 14", headline: "Apple expands on-device AI with new developer tools", source: "The Verge" },
  { time: "Apr 13", headline: "Analysts see services growth as key upside driver", source: "MarketWatch" },
];

export function AAPLWorkstationScreen() {
  return (
    <div className={styles.screen} role="region" aria-label="AAPL Market Workstation Screen">
      {/* 1. Top App Navigation Bar */}
      <header className={styles.topNav}>
        <div className={styles.brandGroup}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            <span>ZTERMINAL</span>
          </div>
          <nav className={styles.navTabs} aria-label="Workstation views">
            <span className={`${styles.navTab} ${styles.active}`}>Chart</span>
            <span className={styles.navTab}>Watchlists</span>
            <span className={styles.navTab}>Research</span>
            <span className={styles.navTab}>Alerts</span>
            <span className={styles.navTab}>Workspace</span>
          </nav>
        </div>

        <div className={styles.rightControls}>
          <div className={styles.searchBox}>
            <span aria-hidden="true">🔍</span>
            <span>Search symbols, notes...</span>
            <span className={styles.searchKbd}>⌘ K</span>
          </div>
          <div className={styles.userAvatar} aria-label="User profile J">J</div>
        </div>
      </header>

      {/* 2. Main Workspace */}
      <div className={styles.workspaceBody}>
        {/* Left Drawing Tools Rail */}
        <aside className={styles.toolsRail} aria-label="Drawing Tools">
          <div className={styles.toolIcon} title="Crosshair">✛</div>
          <div className={styles.toolIcon} title="Trendline">╱</div>
          <div className={styles.toolIcon} title="Fibonacci">≡</div>
          <div className={styles.toolIcon} title="Text">T</div>
          <div className={styles.toolIcon} title="Brush">✎</div>
          <div className={styles.toolIcon} title="Measure">⤢</div>
          <div className={styles.toolIcon} title="Magnet">🧲</div>
          <div className={styles.toolIcon} title="Lock">🔒</div>
          <div className={styles.toolIcon} title="Hide">👁</div>
          <div className={styles.toolIcon} title="Delete">🗑</div>
        </aside>

        {/* Center Chart Area */}
        <section className={styles.centerArea} aria-label="AAPL Candlestick Chart">
          {/* Symbol Bar */}
          <div className={styles.chartBar}>
            <div className={styles.symbolInfo}>
              <div className={styles.symbolBadge}>
                <span className={styles.appleMark}></span>
                <span>AAPL</span>
                <span style={{ color: "#6e7681", margin: "0 2px" }}>···</span>
                <span className={styles.symbolName}>Apple Inc.</span>
              </div>
              <div className={styles.timeframes}>
                <span className={styles.tfBtn}>1m</span>
                <span className={styles.tfBtn}>5m</span>
                <span className={styles.tfBtn}>15m</span>
                <span className={styles.tfBtn}>1h</span>
                <span className={styles.tfBtn}>4h</span>
                <span className={`${styles.tfBtn} ${styles.activeTf}`}>D</span>
                <span className={styles.tfBtn}>W</span>
                <span className={styles.tfBtn}>M</span>
              </div>
            </div>
            <div className={styles.chartActions}>
              <span>⚙ Indicators</span>
              <span>📷</span>
              <span>⛶</span>
            </div>
          </div>

          {/* Real-time OHLC Metrics */}
          <div className={styles.tickerMetrics}>
            <div className={styles.metricItem}>O <span>176.20</span></div>
            <div className={styles.metricItem}>H <span>178.42</span></div>
            <div className={styles.metricItem}>L <span>175.31</span></div>
            <div className={styles.metricItem}>C <span>178.24</span></div>
            <div className={styles.metricGreen}>+2.17 (+1.23%)</div>
          </div>

          {/* SVG Candlestick Chart with Volume and Glowing Price Axis */}
          <div className={styles.chartCanvasWrapper}>
            <svg className={styles.chartSvg} viewBox="0 0 770 480" preserveAspectRatio="none">
              <defs>
                <linearGradient id="volGradUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="volGradDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.1" />
                </linearGradient>
                <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              <g stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1">
                <line x1="0" y1="60" x2="710" y2="60" />
                <line x1="0" y1="120" x2="710" y2="120" />
                <line x1="0" y1="180" x2="710" y2="180" />
                <line x1="0" y1="240" x2="710" y2="240" />
                <line x1="0" y1="300" x2="710" y2="300" />
                <line x1="0" y1="360" x2="710" y2="360" />

                <line x1="120" y1="0" x2="120" y2="440" />
                <line x1="280" y1="0" x2="280" y2="440" />
                <line x1="440" y1="0" x2="440" y2="440" />
                <line x1="600" y1="0" x2="600" y2="440" />
              </g>

              {/* Volume Bars */}
              <g>
                <rect x="20" y="380" width="8" height="30" fill="url(#volGradDown)" />
                <rect x="34" y="365" width="8" height="45" fill="url(#volGradDown)" />
                <rect x="48" y="350" width="8" height="60" fill="url(#volGradUp)" />
                <rect x="62" y="375" width="8" height="35" fill="url(#volGradDown)" />
                <rect x="76" y="340" width="8" height="70" fill="url(#volGradUp)" />
                <rect x="90" y="355" width="8" height="55" fill="url(#volGradDown)" />
                <rect x="104" y="330" width="8" height="80" fill="url(#volGradUp)" />
                <rect x="118" y="345" width="8" height="65" fill="url(#volGradUp)" />
                <rect x="132" y="370" width="8" height="40" fill="url(#volGradDown)" />
                <rect x="146" y="360" width="8" height="50" fill="url(#volGradDown)" />
                <rect x="160" y="335" width="8" height="75" fill="url(#volGradUp)" />
                <rect x="174" y="325" width="8" height="85" fill="url(#volGradUp)" />
                <rect x="188" y="350" width="8" height="60" fill="url(#volGradDown)" />
                <rect x="202" y="365" width="8" height="45" fill="url(#volGradDown)" />
                <rect x="216" y="340" width="8" height="70" fill="url(#volGradDown)" />
                <rect x="230" y="320" width="8" height="90" fill="url(#volGradUp)" />
                <rect x="244" y="310" width="8" height="100" fill="url(#volGradUp)" />
                <rect x="258" y="330" width="8" height="80" fill="url(#volGradDown)" />
                <rect x="272" y="345" width="8" height="65" fill="url(#volGradDown)" />
                <rect x="286" y="360" width="8" height="50" fill="url(#volGradDown)" />
                <rect x="300" y="320" width="8" height="90" fill="url(#volGradUp)" />
                <rect x="314" y="305" width="8" height="105" fill="url(#volGradUp)" />
                <rect x="328" y="335" width="8" height="75" fill="url(#volGradDown)" />
                <rect x="342" y="350" width="8" height="60" fill="url(#volGradDown)" />
                <rect x="356" y="315" width="8" height="95" fill="url(#volGradUp)" />
                <rect x="370" y="300" width="8" height="110" fill="url(#volGradUp)" />
                <rect x="384" y="325" width="8" height="85" fill="url(#volGradDown)" />
                <rect x="398" y="340" width="8" height="70" fill="url(#volGradDown)" />
                <rect x="412" y="360" width="8" height="50" fill="url(#volGradDown)" />
                <rect x="426" y="330" width="8" height="80" fill="url(#volGradUp)" />
                <rect x="440" y="315" width="8" height="95" fill="url(#volGradUp)" />
                <rect x="454" y="300" width="8" height="110" fill="url(#volGradUp)" />
                <rect x="468" y="320" width="8" height="90" fill="url(#volGradDown)" />
                <rect x="482" y="295" width="8" height="115" fill="url(#volGradUp)" />
                <rect x="496" y="285" width="8" height="125" fill="url(#volGradUp)" />
                <rect x="510" y="310" width="8" height="100" fill="url(#volGradDown)" />
                <rect x="524" y="290" width="8" height="120" fill="url(#volGradUp)" />
                <rect x="538" y="275" width="8" height="135" fill="url(#volGradUp)" />
                <rect x="552" y="295" width="8" height="115" fill="url(#volGradDown)" />
                <rect x="566" y="280" width="8" height="130" fill="url(#volGradUp)" />
                <rect x="580" y="260" width="8" height="150" fill="url(#volGradUp)" />
                <rect x="594" y="270" width="8" height="140" fill="url(#volGradDown)" />
                <rect x="608" y="250" width="8" height="160" fill="url(#volGradUp)" />
                <rect x="622" y="240" width="8" height="170" fill="url(#volGradUp)" />
                <rect x="636" y="260" width="8" height="150" fill="url(#volGradDown)" />
                <rect x="650" y="245" width="8" height="165" fill="url(#volGradUp)" />
                <rect x="664" y="235" width="8" height="175" fill="url(#volGradUp)" />
                <rect x="678" y="250" width="8" height="160" fill="url(#volGradDown)" />
              </g>

              {/* Candlesticks: Wicks & Real Bodies */}
              <g strokeWidth="1.2">
                {/* Jan-Feb Dip */}
                <line x1="24" y1="180" x2="24" y2="240" stroke="#f43f5e" />
                <rect x="20" y="195" width="8" height="35" fill="#f43f5e" />

                <line x1="38" y1="210" x2="38" y2="270" stroke="#f43f5e" />
                <rect x="34" y="225" width="8" height="35" fill="#f43f5e" />

                <line x1="52" y1="230" x2="52" y2="285" stroke="#10b981" />
                <rect x="48" y="240" width="8" height="35" fill="#10b981" />

                <line x1="66" y1="220" x2="66" y2="265" stroke="#f43f5e" />
                <rect x="62" y="230" width="8" height="25" fill="#f43f5e" />

                <line x1="80" y1="200" x2="80" y2="255" stroke="#10b981" />
                <rect x="76" y="210" width="8" height="35" fill="#10b981" />

                <line x1="94" y1="215" x2="94" y2="270" stroke="#f43f5e" />
                <rect x="90" y="225" width="8" height="35" fill="#f43f5e" />

                <line x1="108" y1="190" x2="108" y2="250" stroke="#10b981" />
                <rect x="104" y="200" width="8" height="40" fill="#10b981" />

                <line x1="122" y1="175" x2="122" y2="230" stroke="#10b981" />
                <rect x="118" y="185" width="8" height="35" fill="#10b981" />

                <line x1="136" y1="190" x2="136" y2="250" stroke="#f43f5e" />
                <rect x="132" y="200" width="8" height="40" fill="#f43f5e" />

                <line x1="150" y1="210" x2="150" y2="280" stroke="#f43f5e" />
                <rect x="146" y="230" width="8" height="40" fill="#f43f5e" />

                <line x1="164" y1="225" x2="164" y2="295" stroke="#f43f5e" />
                <rect x="160" y="245" width="8" height="40" fill="#f43f5e" />

                <line x1="178" y1="260" x2="178" y2="330" stroke="#f43f5e" />
                <rect x="174" y="280" width="8" height="40" fill="#f43f5e" />

                {/* Bottoming Out (March low) */}
                <line x1="192" y1="290" x2="192" y2="350" stroke="#10b981" />
                <rect x="188" y="300" width="8" height="35" fill="#10b981" />

                <line x1="206" y1="285" x2="206" y2="340" stroke="#f43f5e" />
                <rect x="202" y="295" width="8" height="35" fill="#f43f5e" />

                <line x1="220" y1="270" x2="220" y2="335" stroke="#10b981" />
                <rect x="216" y="280" width="8" height="45" fill="#10b981" />

                <line x1="234" y1="250" x2="234" y2="310" stroke="#10b981" />
                <rect x="230" y="260" width="8" height="40" fill="#10b981" />

                <line x1="248" y1="235" x2="248" y2="290" stroke="#10b981" />
                <rect x="244" y="245" width="8" height="35" fill="#10b981" />

                <line x1="262" y1="240" x2="262" y2="300" stroke="#f43f5e" />
                <rect x="258" y="250" width="8" height="35" fill="#f43f5e" />

                <line x1="276" y1="255" x2="276" y2="320" stroke="#f43f5e" />
                <rect x="272" y="270" width="8" height="40" fill="#f43f5e" />

                <line x1="290" y1="245" x2="290" y2="305" stroke="#10b981" />
                <rect x="286" y="255" width="8" height="35" fill="#10b981" />

                {/* April Trend Reversal */}
                <line x1="304" y1="225" x2="304" y2="285" stroke="#10b981" />
                <rect x="300" y="235" width="8" height="35" fill="#10b981" />

                <line x1="318" y1="210" x2="318" y2="270" stroke="#10b981" />
                <rect x="314" y="220" width="8" height="35" fill="#10b981" />

                <line x1="332" y1="220" x2="332" y2="280" stroke="#f43f5e" />
                <rect x="328" y="230" width="8" height="35" fill="#f43f5e" />

                <line x1="346" y1="230" x2="346" y2="290" stroke="#f43f5e" />
                <rect x="342" y="240" width="8" height="35" fill="#f43f5e" />

                <line x1="360" y1="205" x2="360" y2="265" stroke="#10b981" />
                <rect x="356" y="215" width="8" height="35" fill="#10b981" />

                <line x1="374" y1="190" x2="374" y2="250" stroke="#10b981" />
                <rect x="370" y="200" width="8" height="35" fill="#10b981" />

                <line x1="388" y1="200" x2="388" y2="260" stroke="#f43f5e" />
                <rect x="384" y="210" width="8" height="35" fill="#f43f5e" />

                <line x1="402" y1="215" x2="402" y2="275" stroke="#f43f5e" />
                <rect x="398" y="225" width="8" height="35" fill="#f43f5e" />

                <line x1="416" y1="195" x2="416" y2="255" stroke="#10b981" />
                <rect x="412" y="205" width="8" height="35" fill="#10b981" />

                <line x1="430" y1="175" x2="430" y2="235" stroke="#10b981" />
                <rect x="426" y="185" width="8" height="35" fill="#10b981" />

                <line x1="444" y1="160" x2="444" y2="220" stroke="#10b981" />
                <rect x="440" y="170" width="8" height="35" fill="#10b981" />

                <line x1="458" y1="170" x2="458" y2="230" stroke="#f43f5e" />
                <rect x="454" y="180" width="8" height="35" fill="#f43f5e" />

                <line x1="472" y1="150" x2="472" y2="210" stroke="#10b981" />
                <rect x="468" y="160" width="8" height="35" fill="#10b981" />

                {/* May Breakout Wave to 178.24 */}
                <line x1="486" y1="135" x2="486" y2="195" stroke="#10b981" />
                <rect x="482" y="145" width="8" height="35" fill="#10b981" />

                <line x1="500" y1="145" x2="500" y2="205" stroke="#f43f5e" />
                <rect x="496" y="155" width="8" height="35" fill="#f43f5e" />

                <line x1="514" y1="125" x2="514" y2="185" stroke="#10b981" />
                <rect x="510" y="135" width="8" height="35" fill="#10b981" />

                <line x1="528" y1="110" x2="528" y2="170" stroke="#10b981" />
                <rect x="524" y="120" width="8" height="35" fill="#10b981" />

                <line x1="542" y1="120" x2="542" y2="180" stroke="#f43f5e" />
                <rect x="538" y="130" width="8" height="35" fill="#f43f5e" />

                <line x1="556" y1="105" x2="556" y2="165" stroke="#10b981" />
                <rect x="552" y="115" width="8" height="35" fill="#10b981" />

                <line x1="570" y1="90" x2="570" y2="150" stroke="#10b981" />
                <rect x="566" y="100" width="8" height="35" fill="#10b981" />

                <line x1="584" y1="100" x2="584" y2="160" stroke="#f43f5e" />
                <rect x="580" y="110" width="8" height="35" fill="#f43f5e" />

                <line x1="598" y1="85" x2="598" y2="145" stroke="#10b981" />
                <rect x="594" y="95" width="8" height="35" fill="#10b981" />

                <line x1="612" y1="75" x2="612" y2="135" stroke="#10b981" />
                <rect x="608" y="85" width="8" height="35" fill="#10b981" />

                <line x1="626" y1="90" x2="626" y2="150" stroke="#f43f5e" />
                <rect x="622" y="100" width="8" height="35" fill="#f43f5e" />

                <line x1="640" y1="80" x2="640" y2="140" stroke="#10b981" />
                <rect x="636" y="90" width="8" height="35" fill="#10b981" />

                <line x1="654" y1="100" x2="654" y2="160" stroke="#a855f7" />
                <rect x="650" y="110" width="8" height="35" fill="#a855f7" />

                {/* Final Current Bar at 178.24 */}
                <line x1="668" y1="102" x2="668" y2="155" stroke="#c084fc" />
                <rect x="664" y="112" width="8" height="28" fill="#c084fc" />
              </g>

              {/* Glowing Violet Active Price Line at y=126 (178.24) */}
              <g filter="url(#purpleGlow)">
                <line
                  x1="0"
                  y1="126"
                  x2="710"
                  y2="126"
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              </g>

              {/* Price Axis Background Border */}
              <line x1="710" y1="0" x2="710" y2="440" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />

              {/* Price Axis Labels on the right */}
              <g fill="#6e7681" fontSize="10" fontFamily="sans-serif" textAnchor="start">
                <text x="716" y="64">190.00</text>
                <text x="716" y="94">185.00</text>
                <text x="716" y="118">180.00</text>

                {/* Active Price Badge (178.24) in Glowing Purple */}
                <g>
                  <rect x="712" y="116" width="54" height="18" rx="3" fill="#7c3aed" />
                  <text x="717" y="129" fill="#ffffff" fontWeight="bold" fontSize="10">178.24</text>
                </g>

                <text x="716" y="152">175.00</text>
                <text x="716" y="182">170.00</text>
                <text x="716" y="212">165.00</text>
                <text x="716" y="242">160.00</text>
                <text x="716" y="272">155.00</text>
                <text x="716" y="340">100M</text>
              </g>

              {/* Time Axis at Bottom */}
              <line x1="0" y1="440" x2="770" y2="440" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
              <g fill="#6e7681" fontSize="10" fontFamily="sans-serif">
                <text x="70" y="458">Feb</text>
                <text x="230" y="458">Mar</text>
                <text x="430" y="458">Apr</text>
                <text x="610" y="458">May</text>
              </g>
            </svg>
          </div>
        </section>

        {/* Right Watchlist Panel */}
        <aside className={styles.watchlistPanel} aria-label="Symbol Watchlist">
          <div className={styles.watchlistHeader}>
            <span>Watchlist</span>
            <div style={{ display: "flex", gap: "8px", color: "#8b949e", cursor: "pointer" }}>
              <span>+</span>
              <span>×</span>
            </div>
          </div>

          <div className={styles.tableHeader}>
            <span>Symbol</span>
            <span>Last</span>
            <span>Chg</span>
            <span>%</span>
          </div>

          <div className={styles.watchlistRows}>
            {WATCHLIST_DATA.map((row) => (
              <div
                key={row.symbol}
                className={`${styles.watchRow} ${row.active ? styles.activeRow : ""}`}
              >
                <span className={styles.symName}>{row.symbol}</span>
                <span className={styles.priceVal}>{row.last}</span>
                <span className={row.up ? styles.gain : styles.loss}>{row.chg}</span>
                <span className={row.up ? styles.gain : styles.loss}>{row.pct}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* 3. Bottom Multi-Tab Deck & Quick Note */}
      <footer className={styles.bottomDeck}>
        <div className={styles.deckLeft}>
          <div className={styles.deckTabs}>
            <span className={`${styles.deckTab} ${styles.activeDeckTab}`}>News</span>
            <span className={styles.deckTab}>Notes</span>
            <span className={styles.deckTab}>Ideas</span>
            <span className={styles.deckTab}>Alerts</span>
            <span className={styles.deckTab}>Positions</span>
            <span className={styles.deckTab}>Performance</span>
          </div>
          <div className={styles.newsList}>
            {NEWS_DATA.map((item, idx) => (
              <div key={idx} className={styles.newsItem}>
                <span className={styles.newsTime}>{item.time}</span>
                <span className={styles.newsHeadline}>{item.headline}</span>
                <span className={styles.newsSource}>{item.source}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.deckRight}>
          <div className={styles.noteHeader}>
            <span>AAPL — Quick Note</span>
            <span style={{ color: "#6e7681", cursor: "pointer" }}>×</span>
          </div>
          <div className={styles.noteBody}>
            Strong relative strength. Watching for continuation above 180.
          </div>
          <div className={styles.noteFooter}>
            <div className={styles.noteTags}>
              <span>#macros</span>
              <span>#earnings</span>
              <span>#risk</span>
            </div>
            <button type="button" className={styles.saveBtn}>Save note</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
