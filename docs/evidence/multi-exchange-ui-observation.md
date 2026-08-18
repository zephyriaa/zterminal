# Local Multi-Exchange UI Observation

At local startup on `http://localhost:3003`, the supplied ZTerminal mark rendered in the top-left brand lockup with the new **crypto order-flow research** subtitle. The new public-feed strip rendered Gate.io, Binance USDⓈ-M, and Bybit Linear as individual controls. All three initially displayed `UNAVAILABLE` while server-side public streams and the Gate.io chart window were still initializing; no live order-flow panel was rendered from that non-live state.

After initialization, Gate.io became `LIVE` for `QQQX_USDT` and the verified Gate.io chart loaded 97 15-minute bars. Binance USDⓈ-M and Bybit Linear remained visibly `DEGRADED` for that Gate-specific symbol; the UI did not misrepresent their tapes as live.

For the common `BTC_USDT` symbol, the verified Gate.io chart loaded 97 15-minute bars; Gate.io and Bybit Linear each reported `LIVE` public trade tape, while Binance USDⓈ-M reported `DEGRADED`. The workstation explicitly displayed that non-live state and did not render it as a current tape. A direct Binance public REST ping reached `https://fapi.binance.com/fapi/v1/ping` with HTTP 200 from this environment, while the bounded Binance WebSocket probe did not receive an event; Binance therefore remains a visible degraded/verification path rather than a claimed live feed.
