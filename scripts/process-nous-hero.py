"""Remove background from Nous hero art and add a thin white outline.

Uses rembg (isnet-anime) for cutout — re-run when replacing assets/girl_nous.jpg.

Outputs:
  assets/girl_nous.png — full-color cutout + thin white outline (hero / nav / BM on Nous)

Chat tab uses assets/girl_steampunk.svg as a CSS mask (all themes).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "girl_nous.jpg"
OUT_COLOR = ROOT / "assets" / "girl_nous.png"

# Source is ~944px; thin outline for large UI surfaces.
OUTLINE_THIN_PX = 10


def compose_with_outline(
    rgb: np.ndarray,
    alpha: np.ndarray,
    outline_px: int,
) -> Image.Image:
    subject_bin = Image.fromarray(alpha, mode="L").point(lambda p: 255 if p >= 16 else 0)
    dilated = subject_bin
    for _ in range(outline_px):
        dilated = dilated.filter(ImageFilter.MaxFilter(3))
    outline_ring = ImageChops.subtract(dilated, subject_bin)
    ring = np.array(outline_ring) > 0

    canvas = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    canvas[ring] = (255, 255, 255, 255)

    subj = alpha > 0
    canvas[subj, 0] = rgb[subj, 0]
    canvas[subj, 1] = rgb[subj, 1]
    canvas[subj, 2] = rgb[subj, 2]
    canvas[subj, 3] = alpha[subj]
    canvas[:, :, 3] = np.maximum(canvas[:, :, 3], np.where(ring, 255, 0).astype(np.uint8))
    return Image.fromarray(canvas, mode="RGBA")


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    print("loading isnet-anime…")
    session = new_session("isnet-anime")
    print("removing background…")
    cut = remove(src, session=session).convert("RGBA")
    arr = np.array(cut)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]
    print("opaque fraction after rembg", float((alpha > 10).mean()))

    # Light cleanup + edge soften
    alpha_img = Image.fromarray(alpha, mode="L")
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.MaxFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.4))
    alpha = np.array(alpha_img)

    color = compose_with_outline(rgb, alpha, OUTLINE_THIN_PX)
    color.save(OUT_COLOR, "PNG", optimize=True)
    print("saved", OUT_COLOR, color.size, "bytes", OUT_COLOR.stat().st_size)

    for legacy in (
        ROOT / "assets" / "girl_tab_mask.png",
        ROOT / "assets" / "girl_nous_tab.png",
    ):
        if legacy.exists():
            legacy.unlink()
            print("removed legacy", legacy)


if __name__ == "__main__":
    main()
