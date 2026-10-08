"""Screenshot every slide (animations off: ?static) with headless Edge and print browser console errors.

usage: python shots.py [deck] [--from N] [--to N] [--size W,H] [--out DIR] [--jobs N] [--reports]
  deck       deck workspace, its presentation folder or the .html (default: current folder)
  --out      default <deck>\\work\\shots  (files sNN.png)
  --jobs     slides captured at the same time (default 6). A slide that fails or times out is retried
             alone afterwards; the ones that still fail are listed at the end
  --reports  also capture the top of every report a slide opens (data-report) and save it as the
             report card preview: presentation\\assets\\img\\reports\\<report name>.webp
Prints when the deck .html was last saved — if a build step writes it, check that the build really ran.
"""
import argparse
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from deckutil import count_slides, deck_root, edge_cli, find_html


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", nargs="?")
    ap.add_argument("--from", dest="first", type=int, default=1)
    ap.add_argument("--to", dest="last", type=int)
    ap.add_argument("--size", default="1600,900")
    ap.add_argument("--out")
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--reports", action="store_true")
    a = ap.parse_args()

    html = find_html(a.deck)
    out = Path(a.out) if a.out else deck_root(html) / "work" / "shots"
    out.mkdir(parents=True, exist_ok=True)
    n = count_slides(html)
    last = min(a.last or n, n)

    def one(k):
        f = out / ("s%02d.png" % k)
        if f.exists():
            f.unlink()
        try:
            _, errors = edge_cli(html.as_uri() + "?static#%d" % k, "--screenshot=" + str(f), size=a.size)
        except subprocess.TimeoutExpired:
            errors = []
        return k, f, errors

    def show(f, errors):
        print(("ok      " if f.exists() else "MISSING ") + f.name)
        for e in errors:
            print("   console:", e.split("CONSOLE", 1)[-1].strip())

    saved = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(html.stat().st_mtime))
    print("%s (saved %s) — %d slides → %s" % (html.name, saved, n, out))
    failed = []
    with ThreadPoolExecutor(a.jobs) as ex:
        for k, f, errors in ex.map(one, range(a.first, last + 1)):
            if f.exists():
                show(f, errors)
            else:
                print("retry   " + f.name)
                failed.append(k)
    for k in failed[:]:                                  # alone, after the others: heavy slides time out in parallel
        _, f, errors = one(k)
        show(f, errors)
        if f.exists():
            failed.remove(k)
    if failed:
        print("FAILED slides:", ", ".join(map(str, failed)))
    bad = len(failed)
    if a.reports:
        bad += reports(html, out)
    raise SystemExit(1 if bad else 0)


def reports(html, out):
    from PIL import Image
    dest = html.parent / "assets" / "img" / "reports"
    bad = 0
    for rel in sorted(set(re.findall(r'data-report="([^"]+)"', html.read_text(encoding="utf-8")))):
        rep = html.parent / rel
        if not rep.is_file():
            print("MISSING report", rel)
            bad += 1
            continue
        png = out / ("report_%s.png" % rep.stem)
        edge_cli(rep.as_uri(), "--screenshot=" + str(png), size="1600,1000", budget=20000, timeout=300)
        dest.mkdir(parents=True, exist_ok=True)
        thumb = dest / (rep.stem + ".webp")
        Image.open(png).convert("RGB").save(thumb, quality=86, method=6)
        print("report preview → " + thumb.relative_to(html.parent).as_posix())
    return bad


if __name__ == "__main__":
    main()
