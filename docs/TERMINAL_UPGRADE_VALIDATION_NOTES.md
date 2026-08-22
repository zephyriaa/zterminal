# Terminal Upgrade Validation Notes

## Local workstation review

The rebuilt `/terminal` was reviewed in a local browser after the full static and production checks passed. The chart displayed live Binance-labelled trade and price data, while the workspace retained its floating chart canvas and separate supporting windows.

The dedicated Indicators rail action opened the new **Indicators** library window. The window showed a Library and On chart split, a searchable list of supported deterministic overlays, and explicit add-state controls. The previous Studies wording and Order Flow / Flow controls were absent from the visible workstation rail and chart toolbar.

The top-right Research Mode control opened an account information panel. It accurately showed public-market-research permissions, active provider, selected market, feed state, and an explicit no-brokerage-account-connected notice. It did not display balances, positions, identity, execution controls, or fabricated cloud state.

A pointer-sequence exercise was dispatched to the chart canvas. The visible chart remained in place inside its desktop window and the canvas accepted the plot gesture rather than moving the parent window. The chart now advertises time pan, price pan with Alt/middle drag, price-scale manipulation, pinch, and reset affordances.

The first local selector check reported a catalogue unavailable response because the locally running gateway had not been restarted after the new `/contracts` endpoint was added. After restarting that gateway from current source, the endpoint returned a provider-backed contract catalogue. The local gateway defaulted to Gate.io because no local `MARKET_PROVIDER=binance` override was present. The production configuration remains Binance and the selector has no static cross-venue fallback.

## Hydration follow-up

The initial local console review showed an SSR/client hydration warning that could be caused by reading local favorites during client state initialization. The picker was corrected to load favorites only after a user-initiated picker open. TypeScript, lint, the 36-test deterministic suite, and the production build all passed after the correction.

A subsequent fresh local load still reported a hydration attribute mismatch. The floating window primitive initialized its z-index from a module-global increment, which could diverge between server render and browser hydration. The initial z-index was changed to a stable value; focus ordering continues to be applied only in the active browser session after hydration.

After the stable initial z-index correction, a fresh local terminal load produced only normal development connection information in the browser console and no hydration mismatch. The chart canvas and workstation chrome rendered cleanly.
