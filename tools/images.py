"""Prepare pictures for a deck. Sources are never changed; results go to --out as .webp.

usage: python images.py web  <images or folders…> --out DIR [--max 1600] [--quality 86]
       python images.py cut  <images…> --out DIR [--model birefnet-portrait]
       python images.py trim <images…> --out DIR [--pad 6]
       python images.py fit  <cut-outs…> --out DIR [--size 900x1200] [--fill 0.88] [--bg transparent|#RRGGBB]
  web   longest side ≤ --max px (web size), alpha dropped when it hides nothing
  cut   remove the background (rembg; the model downloads once, ~1 GB for birefnet-portrait) and trim to the
        person/object; prints the {"img", "w", "h"} lines a collage needs in data.js
  trim  cut the empty margin around a logo (transparent or plain background)
  fit   cut-outs on one canvas size: everyone the same height (--fill of the canvas), feet on one line,
        centred — for product cards. The background stays transparent unless --bg is given.
"""
import argparse
import json
from pathlib import Path

from PIL import Image

import deckutil  # noqa: F401  (utf-8 console output)

EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
_sessions = {}


def files(paths):
    for p in map(Path, paths):
        if p.is_dir():
            yield from sorted(f for f in p.rglob("*") if f.suffix.lower() in EXT)
        elif p.suffix.lower() in EXT:
            yield p


def out_path(src, out):
    out.mkdir(parents=True, exist_ok=True)
    return out / (src.stem + ".webp")


def web(src, out, a):
    im = Image.open(src)
    im.load()
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 255:
        im = im.convert("RGB")
    s = min(1.0, a.max / max(im.size))
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    dst = out_path(src, out)
    im.save(dst, "WEBP", quality=a.quality, method=6)
    return dst, im.size


def clean_alpha(alpha, keep=0.08):
    """Drop specks and far-off blobs (anything smaller than `keep` of the biggest part)."""
    import numpy as np
    from scipy import ndimage
    a = np.asarray(alpha).copy()
    a[a < 8] = 0
    lab, n = ndimage.label(a > 8)
    if n:
        solid = ndimage.sum(a > 128, lab, range(1, n + 1))
        a[~np.isin(lab, [i + 1 for i, v in enumerate(solid) if v >= keep * solid.max()])] = 0
    return Image.fromarray(a)


def cut(src, out, a):
    from rembg import new_session, remove
    if a.model not in _sessions:
        _sessions[a.model] = new_session(a.model)
    im = Image.open(src).convert("RGB")
    rgba = remove(im, session=_sessions[a.model]).convert("RGBA")
    alpha = clean_alpha(rgba.getchannel("A"))
    im.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    if not box:
        raise ValueError("nothing left after removing the background")
    pad = max(2, int(0.015 * max(box[2] - box[0], box[3] - box[1])))
    im = im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
    dst = out_path(src, out)
    im.save(dst, "WEBP", quality=88, method=6, exact=False)
    return dst, im.size


def trim(src, out, a):
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A")
    if alpha.getextrema()[0] < 250:                       # transparent background
        box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
        bg = (0, 0, 0, 0)
    else:                                                 # plain background: compare with the corner colour
        from PIL import ImageChops
        corner = im.getpixel((0, 0))
        diff = ImageChops.difference(im.convert("RGB"), Image.new("RGB", im.size, corner[:3])).convert("L")
        box = diff.point(lambda v: 255 if v > 24 else 0).getbbox()
        bg = corner
    if not box:
        raise ValueError("the image is empty")
    im = im.crop(box)
    canvas = Image.new("RGBA", (im.width + 2 * a.pad, im.height + 2 * a.pad), bg)
    canvas.alpha_composite(im, (a.pad, a.pad))
    dst = out_path(src, out)
    canvas.save(dst, "WEBP", lossless=True, method=6)
    return dst, canvas.size


def fit(src, out, a):
    W, H = (int(x) for x in a.size.lower().split("x"))
    im = Image.open(src).convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    if not box or box == (0, 0, im.width, im.height):
        raise ValueError("not a cut-out (no transparent background) — run `cut` first")
    fig = im.crop(box)
    s = min(a.fill * H / fig.height, 0.94 * W / fig.width)
    fig = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
    bg = (0, 0, 0, 0) if a.bg == "transparent" else tuple(int(a.bg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    canvas = Image.new("RGBA", (W, H), bg)
    canvas.alpha_composite(fig, ((W - fig.width) // 2, round(H * (1 - FOOT) - fig.height)))
    dst = out_path(src, out)
    canvas.save(dst, "WEBP", quality=88, method=6)
    return dst, canvas.size


FOOT = 0.04   # gap under the feet, share of the canvas height


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", choices=["web", "cut", "trim", "fit"])
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max", type=int, default=1600)
    ap.add_argument("--quality", type=int, default=86)
    ap.add_argument("--model", default="birefnet-portrait")
    ap.add_argument("--pad", type=int, default=6)
    ap.add_argument("--size", default="900x1200")
    ap.add_argument("--fill", type=float, default=0.88)
    ap.add_argument("--bg", default="transparent")
    a = ap.parse_args()
    out = Path(a.out)
    do = {"web": web, "cut": cut, "trim": trim, "fit": fit}[a.action]
    done = 0
    for src in files(a.images):
        try:
            dst, (w, h) = do(src, out, a)
        except (OSError, ValueError) as e:
            print("skip", src, "-", e)
            continue
        done += 1
        if a.action == "cut":
            print(json.dumps({"img": dst.as_posix(), "w": w, "h": h}, ensure_ascii=False))
        else:
            print("%s → %s (%d×%d)" % (src.name, dst, w, h))
    print("%d image(s) → %s" % (done, out))


if __name__ == "__main__":
    main()
