# ZTerminal branding

The user-approved source is `assets/branding/ZTerminal-Logo-Kit-v1`, imported
from `ZTerminal-Logo-Kit-v1.zip` on 23 October 2026. Use these supplied exports
for all new ZTerminal surfaces. Reference and validation images are not product
assets. The pack's README describes its construction; this adoption does not
claim pixel-identical geometry to the older raster upload.

The dark product UI uses the off-white mark. Use the black variant on light
surfaces. Preserve the three pieces, aspect ratio and clear space; do not
reconstruct or add effects to the symbol.

- Web: `/brand/zterminal-mark-kit-v1.png`, supplied dark favicons, Apple icon,
  PWA manifest and social card. Existing historical logo paths now resolve to
  the new artwork, too.
- Research Helper: supplied 256px off-white PNG embedded as `logo.png` and
  Windows tile ICO embedded as `app.ico` and the executable icon. The shortcut
  uses the executable icon. Build with `research/desktop/build-private.ps1`.
- Desktop/mobile packaging: existing `src-tauri/icons` resources use this kit.
  Supplied platform sizes are copied directly. Windows Store sizes absent from
  the pack are proportionally resized from its dark square tile.

The native Helper implements the approved Figma ready, connected and expired
states at https://www.figma.com/design/Ajrj5V38QFmpfBlOSR46og?node-id=3-2,
with the new mark replacing the reference's old logo. Native title bars and
Segoe UI / Consolas are retained; Geist is not bundled with this launcher.

Run `research/desktop/test-launcher.ps1` on Windows for state and layout checks.
Its resulting `artifacts/helper-redesign/LauncherChecks.exe --preview expired`
(or `--preview connected`) shows the same controls with sample values and no
Python service. These previews are visual fixtures, not live expiry evidence.
