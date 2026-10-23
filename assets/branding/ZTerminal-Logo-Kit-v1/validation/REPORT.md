# Validation report — 2026-10-23

**PASS — 704 automated assertions.**

- 130 exported PNGs: exact dimensions and channel modes; transparent margins for mark assets; alpha-free RGB for opaque platform tiles; sRGB profiles.
- 32 SVGs: XML parsed and rendered, no embedded rasters, scripts, gradients, filters or glows. All canonical masters have exactly the same three named paths.
- Off-white, black and blue exports have identical alpha geometry at every requested square size. Fully opaque interior colors match specified hex values.
- Three distinct connected pieces survive at 16, 24, 32, 48, 64 and 128 px (alpha threshold 128).
- Five ICO containers independently parsed: seven real PNG frames each, 16/24/32/48/64/128/256 px; dimensions, frame offsets and 32-bit declarations checked; Pillow decoded each container.
- ICNS: eleven valid PNG chunks with standard / Retina size mappings through 1024 px. Every chunk and the ICNS container decoded successfully in Pillow.
- iOS catalog: all entries resolve to correctly sized RGB images; 1024 px marketing entry present.
- Android XML parses; actual foreground pixels checked at all five densities. Foreground bounding rectangle radius 32.0999 dp < 33 dp safe radius.
- PWA manifests resolve to real icons at stated dimensions. Maskable artwork bounding radius 0.374499 of width < 0.4. Actual exported foreground pixels also fit that circle in both themes.
- Original source overlay and color / tiny-size / mask / platform proof sheets are included for visual review.

Curve-fit evidence before rounding: upper-left median boundary error 0.259 px, maximum 1.028 px; lower-right median 0.199 px, maximum 0.771 px, measured on sampled alpha boundaries of the 1254 px original. This measures reconstruction agreement with a raster source, not original CAD accuracy.

**NOT TESTED:** native Xcode or Android compilation; store upload acceptance; installed Windows shell rendering; macOS rendering; Safari pinned-tab behavior. File-format decoding and mask simulations do not substitute for these platform tests. No Icon Composer layered source is claimed.

`results.json` contains individual check results. PNG metadata are in `expected-rasters.json`. `platform-proof.png` includes actual exported PNGs and decoded ICO / ICNS frames.

**Visual review: PASS.** Original-overlay alignment, off-white/black/blue masters, wordmark lockup, small-size marks, OG card, circular/rounded/squircle mask previews and decoded platform-container proof were inspected.
