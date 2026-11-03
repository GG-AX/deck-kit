"""Make the shared presentation folder smaller: videos, pictures and the pictures inside HTML reports.

usage: python compress.py [deck] [--dry-run]
  deck       deck workspace, its presentation folder or the .html (default: current folder)
  --dry-run  only list what would change
Files keep their names and formats, so the deck needs no edit. A file is replaced only when the result is
at least 10% smaller; the file it replaces goes to <deck>\\work\\compress_originals\\ (delete it once the
deck is checked). A second run changes nothing it already did.
  videos   bigger than 1920 px or above 6 Mbit/s: re-encoded to H.264, at most 1920 px
  pictures longest side at most 1600 px
  reports  pictures embedded in the .html (data:image/…) the same way; clips inside are left alone
Prints the folder size before and after; above 100 MB it warns (too big to send).
"""
import argparse
import base64
import io
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from deckutil import deck_root, find_ffmpeg, find_html

MAX_PX, MAX_MBPS, MAX_VIDEO_PX, WARN_MB = 1600, 6, 1920, 100
IMG = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}
DATA_IMG = re.compile(r"data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)")


def folder_mb(p):
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) / 1e6


def shrink_image(data, fmt):
    """Bytes of the picture with its longest side ≤ MAX_PX, or None when it is already small enough."""
    im = Image.open(io.BytesIO(data))
    if max(im.size) <= MAX_PX:
        return None
    s = MAX_PX / max(im.size)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    if fmt == "JPEG" and im.mode != "RGB":
        im = im.convert("RGB")
    b = io.BytesIO()
    im.save(b, fmt, **({"quality": 86} if fmt in ("JPEG", "WEBP") else {"optimize": True}))
    return b.getvalue()


def video_check(ff, f):
    """(width, height, why) when the video is too big or too heavy, else None."""
    err = subprocess.run([ff, "-hide_banner", "-i", str(f)], capture_output=True, text=True, errors="replace").stderr
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    v = re.search(r"Video: \w+.*?, (\d{2,5})x(\d{2,5})", err)
    if not (d and v):
        return None
    w, h = int(v[1]), int(v[2])
    mbps = f.stat().st_size * 8 / max(int(d[1]) * 3600 + int(d[2]) * 60 + float(d[3]), 0.1) / 1e6
    why = [x for x, bad in (("%dx%d" % (w, h), max(w, h) > MAX_VIDEO_PX), ("%.1f Mbit/s" % mbps, mbps > MAX_MBPS)) if bad]
    return (w, h, ", ".join(why)) if why else None


def shrink_video(ff, f, w, h, tmp):
    s = min(1, MAX_VIDEO_PX / max(w, h))
    out = Path(tmp) / f.name
    r = subprocess.run([ff, "-y", "-hide_banner", "-loglevel", "error", "-i", str(f),
                        "-vf", "scale=%d:%d" % (round(w * s / 2) * 2, round(h * s / 2) * 2),
                        "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out)],
                       capture_output=True, text=True, errors="replace")
    if r.returncode:
        print("   skipped:", r.stderr.strip()[-200:])
        return None
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    html = find_html(a.deck)
    pres = html.parent
    keep = deck_root(html) / "work" / "compress_originals"
    before = folder_mb(pres)
    saved = 0

    def replace(f, data, why):
        nonlocal saved
        old = f.stat().st_size
        if len(data) > old * 0.9:
            return
        print("%-8s %6.1f → %6.1f MB  %s  (%s)" % ("would" if a.dry_run else "replaced", old / 1e6, len(data) / 1e6,
                                                 f.relative_to(pres), why))
        saved += old - len(data)
        if a.dry_run:
            return
        dst = keep / f.relative_to(pres)
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists():                      # a second run keeps the first original
            shutil.copy2(f, dst)
        f.write_bytes(data)

    ff = None
    with tempfile.TemporaryDirectory(prefix="deckkit_compress_") as tmp:
        for f in sorted(pres.rglob("*")):
            ext = f.suffix.lower()
            if not f.is_file() or f.stat().st_size < 200_000:
                continue
            if ext in IMG:
                data = shrink_image(f.read_bytes(), IMG[ext])
                if data:
                    replace(f, data, "longest side %d px" % MAX_PX)
            elif ext == ".mp4":
                ff = ff or find_ffmpeg()
                c = video_check(ff, f)
                if not c:
                    continue
                if a.dry_run:
                    print("would    re-encode %6.1f MB  %s  (%s)" % (f.stat().st_size / 1e6, f.relative_to(pres), c[2]))
                    continue
                print("encoding %s …" % f.relative_to(pres), flush=True)
                out = shrink_video(ff, f, c[0], c[1], tmp)
                if out:
                    replace(f, out.read_bytes(), c[2])
            elif ext in (".html", ".htm") and f.parent.name == "reports":
                t = f.read_text(encoding="utf-8", errors="surrogateescape")
                n = [0]

                def sub(m):
                    fmt = "JPEG" if m[1] in ("jpeg", "jpg") else m[1].upper()
                    try:
                        data = shrink_image(base64.b64decode(m[2]), fmt)
                    except Exception:            # not a picture Pillow reads: leave it
                        return m[0]
                    if not data or len(data) * 4 / 3 > len(m[2]) * 0.9:
                        return m[0]
                    n[0] += 1
                    return "data:image/%s;base64,%s" % (m[1], base64.b64encode(data).decode())

                t2 = DATA_IMG.sub(sub, t)
                if n[0]:
                    replace(f, t2.encode("utf-8", errors="surrogateescape"), "%d embedded pictures" % n[0])

    after = before - saved / 1e6
    print("presentation: %.0f MB → %.0f MB%s" % (before, after, " (dry run)" if a.dry_run else ""))
    if after > WARN_MB:
        print("WARN  still above %d MB — too big to send by mail or messenger. Biggest files:" % WARN_MB)
        for f in sorted((f for f in pres.rglob("*") if f.is_file()), key=lambda f: -f.stat().st_size)[:5]:
            print("      %6.1f MB  %s" % (f.stat().st_size / 1e6, f.relative_to(pres)))


if __name__ == "__main__":
    main()
