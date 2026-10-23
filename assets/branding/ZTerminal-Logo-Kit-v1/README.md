# ZTerminal logo asset kit — v1.0

Flat, three-piece Z identity. Start with `PREVIEW.png` and the editable vector masters in `masters/`.

## Design authority

`reference/original-upload.png` is the original user upload recovered from the referenced conversation (1254 × 1254 RGBA). The later upload carries the same geometry with extra edge artifacts. The metallic surface was removed. The generated comparison image was not exposed by the conversation export; its written Concept A specification supplies the flat off-white-on-near-black treatment.

The original three pieces remain separate. Straight boundaries were rebuilt as straight lines. Each inward edge uses one cubic Bézier fitted to the visible original boundary, with coordinates rounded to two decimals. Slight original asymmetry is intentional: the lower-right corner is narrower and inset. The diagonal was regularized to a true parallelogram with a correction of approximately one source pixel. `reference/reconstruction-overlay.png` shows the new outline in green over the original. Stray pixels, metallic effects and faint ghost alpha are excluded from production assets.

Master viewBox: `0 0 644 572`; width/height = 1.125874. Paths have stable IDs `upper-left`, `diagonal`, `lower-right`. All variants share these paths. `masters/geometry.json` records exact geometry. Production SVGs contain no embedded raster images, gradients, shadows, glows, or filters.

## Palette

| Color | Hex | Use |
| --- | --- | --- |
| Off-white | `#F5F5F0` | Primary mark on dark backgrounds |
| Black | `#000000` | Mark on light backgrounds |
| Blue | `#3563E9` | Optional solid accent |
| Near-black | `#101114` | Dark opaque tile / social background |
| Light | `#F5F5F0` | Light opaque tile / social background |

PNG exports carry an sRGB profile. SVG colors use sRGB hex values. Fractional edge alpha is intentional antialiasing; fully opaque mark interiors retain the exact fill. Use black on pale backgrounds and off-white on dark. Choose a contrasting background for blue.

## Inventory and naming

- `masters/`: tightly cropped transparent SVGs and geometry data. `currentcolor.svg` inherits color when inlined in HTML.
- `brandmark/svg/`: transparent square canvases with proportional padding.
- `brandmark/png/{off-white,black,blue}/`: transparent square PNGs at **16, 24, 32, 48, 64, 128, 256, 512, 1024 px**. Numbers indicate canvas size, not artwork width.
- `wordmark/`: mark + wordmark lockups and wordmark-only assets. `outlined.svg` is the portable production version; `editable/` contains real live text. Transparent PNGs are supplied at 1× and 2×.
- `web/{dark,light}/`: complete web bundles. Choose one and copy its contents into your site's `/brand/` directory.
- `mobile/ios/`: opaque 1024 px App Store icon, alternate light artwork, and a conventional iPhone/iPad `Assets.xcassets/AppIcon.appiconset` with marketing entry.
- `mobile/android/res/`: native vector foreground, monochrome layer, solid background, API 26/33 adaptive XML, and legacy density icons. `layers/` contains SVG and density PNG alternatives.
- `desktop/windows/`: multiresolution ICOs. `zterminal.ico` has a near-black tile for mixed shell backgrounds. `zterminal-dark.ico` is a transparent off-white mark for dark surfaces; `zterminal-light.ico` is transparent black for light surfaces.
- `desktop/macos/`: ICNS, `.iconset` sources, and editable rounded-tile SVG. The outer margin is transparent; no effects are included.
- `desktop/linux/`: transparent square PNGs by theme/size plus SVG.
- `social/`: circle-safe 512/1024 px avatars and 1200 × 630 px OG images in light/dark treatments, with editable OG SVGs.
- `reference/`: original, construction overlay, and mask proof. These inspection images are not application assets.
- `validation/`: actual checks, raster metadata, and platform proof sheet.
- `fonts/`: unmodified Inter variable font, source note and SIL Open Font License.

`dark` means the dark-background treatment; `light` means the light-background treatment. Explicit color names identify transparent foregrounds. `@2x` doubles both dimensions. All raster dimensions are pixels.

## Clear space, safe areas and usage

Keep at least **one eighth of the visible mark width** clear around a standalone mark. Square assets use 75% canvas width for artwork, with 12.5% left/right padding; height follows the original aspect ratio. Favicons intentionally use 87.5% width at 16–48 px for readability. Tiny tips naturally antialias against the pixel grid; the pieces are never joined or redrawn.

Opaque iOS, Apple touch, Play Store and legacy Android tiles use 70% mark width. iOS files have square corners; the operating system applies its mask. Never pre-round iOS artwork.

PWA maskable icons and social avatars use 56% mark width. The entire artwork bounding rectangle fits within the central circle of radius 40% of canvas width. Their backgrounds fill the complete canvas. The separate PWA `any` icons use 75% width: do not relabel those files as maskable.

Android adaptive layers use a **108 × 108 dp** coordinate space. The mark is **48 × 42.63 dp**, centered at (54,54). Its complete bounding rectangle fits inside the central 66 dp diameter circle. The background fills the full layer. Leave adaptive layers unmasked so Android can apply launcher shapes and motion. The monochrome layer contains only a white mark and transparency; Android supplies its themed color.

Do not add metallic effects, shadows, gradients, glows, outlines, chart graphics or text inside the symbol. Do not connect the pieces, change their relative spacing, rotate, or stretch the mark. Recommended lockup minimum: 160 CSS px wide; use the symbol alone in smaller areas, with accessible text elsewhere.

## Wordmark and font

The wordmark uses genuine **Inter Medium (500), optical size 32**, spelling exactly `ZTerminal`. Outlined SVGs contain actual font glyph contours and require no installed font. Live-text SVGs require the included Inter variable font, optical size 32 and kerning disabled to match exported glyph advances. They remain text-editable. The font's SIL Open Font License is included; the font license does not grant rights over the user-supplied logo. No font licensing is asserted beyond the included license.

## Web integration

Copy either `web/dark/*` or `web/light/*` into `public/brand/` or your equivalent static folder. Keep filenames and layout. Update manifest `id`, `start_url`, and `scope` for an application hosted below a subpath. No deployment domain is assumed.

```html
<link rel="icon" href="/brand/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png">
<link rel="mask-icon" href="/brand/safari-pinned-tab.svg" color="#3563E9">
<link rel="manifest" href="/brand/site.webmanifest">
<meta name="theme-color" content="#101114">
<img src="/brand/brandmark.svg" alt="ZTerminal" width="36" height="32">
```

For the light bundle, set theme-color to `#F5F5F0`. The brandmark has intrinsic 644:572 proportions; use `height:auto` in CSS when setting width. For theme-responsive navigation use both fixed-color transparent masters or inline the `currentColor` SVG. External SVG files loaded with `<img>` do not inherit page color.

After hosting an OG image, use your actual absolute URL:

```html
<meta property="og:title" content="ZTerminal">
<meta property="og:image" content="https://YOUR-DOMAIN.example/brand/zterminal-og-dark-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

## Mobile integration

**iOS / iPadOS:** Import `AppIcon.appiconset` into your existing asset catalog, or import the supplied `Assets.xcassets` if you have none. Select `AppIcon` in the target's app icon source setting. Do not overwrite a whole catalog containing other artwork. All catalog PNGs and the 1024 px marketing file are RGB without alpha. This is a conventional flat raster catalog, not an Icon Composer / layered Liquid Glass file. Additional appearance variants can be configured in Xcode from the vector masters.

**Android:** Merge `mobile/android/res` into `app/src/main/res`, reviewing existing launcher resources first. Do not install both vector and alternative PNG layers under identical resource names. Set these application attributes:

```xml
<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round" />
```

API 26 XML uses separate background/foreground; the API 33 override adds monochrome. Legacy mdpi / hdpi / xhdpi / xxhdpi / xxxhdpi icons are 48 / 72 / 96 / 144 / 192 px. Layer PNGs are 108 / 162 / 216 / 324 / 432 px. Compile with an SDK recognizing the API 33 monochrome element. The Play Store 512 px image is separate from launcher resources.

## Desktop integration

**Windows:** Use `desktop/windows/zterminal.ico` as the executable / shortcut icon. A Win32 resource entry is `IDI_APP_ICON ICON "zterminal.ico"`. Each ICO contains 16, 24, 32, 48, 64, 128 and 256 px 32-bit PNG frames. The transparent variants suit controlled dark/light UI surfaces.

**macOS:** Add `ZTerminal.icns` to application resources and set `CFBundleIconFile` to `ZTerminal` for an ICNS-based bundle. For an Xcode catalog, import the corresponding `.iconset` source images. The ICNS contains standard and Retina representations through 1024 px; the tile SVG is retained.

**Linux:** Install selected PNGs into `hicolor/{SIZE}x{SIZE}/apps/zterminal.png` and a fixed-color SVG master into `hicolor/scalable/apps/zterminal.svg`. Use `Icon=zterminal` in the desktop entry. Choose the foreground color for the intended shell background. The included standalone Linux SVG defaults to black unless its renderer supplies `currentColor`.

## Verification and boundaries

See `validation/REPORT.md` for actual results, `FILE-MANIFEST.csv` for inventory and `SHA256SUMS.txt` for integrity. Platform proofs use real exports and decoded icon-container frames. Transparent mark assets have genuine alpha and no baked backgrounds; opaque platform tiles and social cards have intentional backgrounds.

This is asset-file validation. Native Xcode / Android builds, store submissions, installed Windows shell behavior and macOS display were not run in this Windows workspace. ICNS was structurally decoded and pixel-checked, not tested on macOS. Safari pinned-tab artwork is supplied; Safari behavior was not tested. No unsupported native design format has been fabricated.

## Platform and font references

- [Apple asset catalogs](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)
- [Apple catalog schema](https://developer.apple.com/library/archive/documentation/Xcode/Reference/xcode_ref-Asset_Catalog_Format/AppIconType.html)
- [Apple iconset sizes](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html)
- [Android adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
- [PWA maskable safe circle](https://web.dev/articles/maskable-icon)
- [Inter font source and license](https://github.com/google/fonts/tree/main/ofl/inter)
