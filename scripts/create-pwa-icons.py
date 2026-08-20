from pathlib import Path
from PIL import Image

root = Path("/home/ubuntu/zterminal-recovery")
source = root / "client/src/assets/zterminal-mark.png"
target = root / "client/public/icons"
target.mkdir(parents=True, exist_ok=True)

with Image.open(source) as image:
    rgba = image.convert("RGBA")
    for size in (192, 512):
        icon = rgba.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(target / f"zterminal-{size}.png", optimize=True)
